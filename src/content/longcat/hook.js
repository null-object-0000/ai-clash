// src/content/longcat/hook.js  —  v1
// 注入 MAIN world，实时拦截LongCat流式 SSE 响应
// 四路拦截：fetch（主） | XHR 轮询 | TextDecoder | ReadableStream.getReader

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abLongcatHookV) return;
    window.__abLongcatHookV = 1;

    // ====== Debug 日志控制 ======
    let isDebugEnabled = false;
    const logger = {
        log: (...args) => isDebugEnabled && console.log('[AI Clash longcat]', ...args),
        info: (...args) => isDebugEnabled && console.info('[AI Clash longcat]', ...args),
        warn: (...args) => isDebugEnabled && console.warn('[AI Clash longcat]', ...args),
        error: (...args) => console.error('[AI Clash longcat]', ...args),
    };

    // 监听来自 content script 的 debug 状态同步消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'AICLASH_DEBUG_STATE') {
            isDebugEnabled = event.data.enabled;
            logger.log('%c[AI Clash longcat-hook v1]%c 调试状态同步：' + (isDebugEnabled ? '开启' : '关闭'), 'color:#8b5cf6;font-weight:bold', 'color:inherit');
        }
    });

    logger.log('%c[AI Clash longcat-hook v1]%c MAIN world 注入成功', 'color:#8b5cf6;font-weight:bold', 'color:inherit');

    // ====== SSE 解析核心 ======
    var _chunkCount = 0;
    var _endSentThisSession = false;
    var _currentEvent = '';  // 跟踪当前 SSE event 类型
    var _fetchHandlingInProgress = false;  // fetch 拦截器活跃时，其他拦截器跳过

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        logger.log('[AI Clash longcat] → END (chunks=' + _chunkCount + ')');
        window.postMessage({ type: 'LONGCAT_HOOK_END' }, '*');
    }

    // isThink=true 时走思考通道，false 时走正文通道
    function emitChunk(text, isThink) {
        if (!text) return;
        _chunkCount++;
        if (_chunkCount <= 3) logger.log('[AI Clash longcat] chunk#' + _chunkCount + (isThink ? '(think)' : ''), JSON.stringify(text).slice(0, 80));
        window.postMessage({ type: 'LONGCAT_HOOK_CHUNK', payload: { text: text, isThink: !!isThink } }, '*');
    }

    function parseSSE(line) {
        // 标准 SSE event: 行
        if (line.startsWith('event: ')) {
            _currentEvent = line.substring(7).trim();
            return;
        }
        if (line.startsWith('id: ')) return;
        if (line === 'event: close' || line === 'event: done' || line === 'event: complete') { emitEnd(); return; }

        // 兼容 'data: '（标准）和 'data:'（LongCat 无空格）两种格式
        if (!line.startsWith('data:')) return;
        var json = line.startsWith('data: ') ? line.substring(6).trim() : line.substring(5).trim();
        if (!json || json === '[DONE]' || json === 'true') { emitEnd(); return; }

        try {
            var d = JSON.parse(json);

            // ---- LongCat 私有格式：所有信息在 d.event 对象里 ----
            if (d.event && typeof d.event === 'object') {
                var evType = d.event.type;

                // 结束信号
                if (evType === 'finish') { emitEnd(); return; }

                var content = d.event.content;
                if (content == null || content === '') return;

                if (evType === 'content') {
                    // 最终汇总回复（heavy_summary 阶段）→ 正文
                    emitChunk(String(content), false);
                } else if (evType === 'think') {
                    // 各 Thinker 的思考过程 → 思考通道
                    emitChunk(String(content), true);
                }
                // create / reason / summary 等元数据事件忽略
                return;
            }

            // ---- 标准 OpenAI 格式兜底 ----
            if (d.event === 'done' || d.event === 'all_done' || d.status === 'done' || d.finished === true) {
                emitEnd(); return;
            }
            // choices[0].delta.content
            if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
                emitChunk(String(d.choices[0].delta.content), false); return;
            }
        } catch (_) {}
    }

    /** 检测是否为LongCat聊天 API 端点 */
    function isLongcatApiUrl(url) {
        if (typeof url !== 'string') return false;
        return url.includes('/api/v1/chat-completion-V2');
    }

    function resetSession() {
        _chunkCount = 0;
        _endSentThisSession = false;
        _currentEvent = '';
        _fetchHandlingInProgress = false;
    }

    // =====================================================================
    //  策略 0（最强）：fetch 拦截
    // =====================================================================
    var _origFetch = window.fetch;
    var _rawGetReader = ReadableStream.prototype.getReader;
    var _rawDecode = TextDecoder.prototype.decode;
    var _fetchInterceptedBodies = new WeakSet();

    window.fetch = function () {
        var url = '';
        try {
            var arg0 = arguments[0];
            url = typeof arg0 === 'string' ? arg0 : (arg0 && (arg0.url || ''));
        } catch (_) {}

        var p = _origFetch.apply(this, arguments);

        if (isLongcatApiUrl(url)) {
            logger.log('[AI Clash longcat] ★ fetch 命中:', url);
            resetSession();
            _fetchHandlingInProgress = true;
            p.then(function (response) {
                if (!response.body) return;
                _fetchInterceptedBodies.add(response.body);
                try {
                    var clone = response.clone();
                    var reader = _rawGetReader.call(clone.body);
                    var dec = new TextDecoder('utf-8');
                    var buf = '';
                    (function pump() {
                        reader.read().then(function (res) {
                            if (res.done) {
                                if (buf.trim()) parseSSE(buf.trim());
                                _fetchHandlingInProgress = false;
                                emitEnd();
                                return;
                            }
                            var chunk;
                            try { chunk = _rawDecode.call(dec, res.value, { stream: true }); } catch (_) { return; }
                            buf += chunk;
                            var lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (var i = 0; i < lines.length; i++) {
                                var t = lines[i].trim();
                                if (t) parseSSE(t);
                            }
                            pump();
                        }).catch(function () { _fetchHandlingInProgress = false; emitEnd(); });
                    })();
                } catch (_) {}
            }).catch(function () {});
        }
        return p;
    };

    // =====================================================================
    //  策略 1：XHR — 50ms 轮询 responseText
    // =====================================================================
    var _origXhrOpen = XMLHttpRequest.prototype.open;
    var _origXhrSend = XMLHttpRequest.prototype.send;
    var _rtDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

    XMLHttpRequest.prototype.open = function (method, url) {
        this._abLongcat = { url: url, pos: 0, ended: false };
        return _origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        var ab = this._abLongcat;
        if (!ab || !isLongcatApiUrl(ab.url)) {
            return _origXhrSend.apply(this, arguments);
        }

        logger.log('[AI Clash longcat] ★ XHR 命中:', ab.url);
        resetSession();
        var xhr = this;

        function processNew(fullText) {
            if (typeof fullText !== 'string' || fullText.length <= ab.pos) return;
            var newData = fullText.substring(ab.pos);
            ab.pos = fullText.length;
            var lines = newData.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var t = lines[i].trim();
                if (t) parseSSE(t);
            }
        }

        var poller = setInterval(function () {
            try {
                var txt = _rtDesc && _rtDesc.get ? _rtDesc.get.call(xhr) : xhr.responseText;
                if (txt) processNew(txt);
            } catch (_) {}
            if (xhr.readyState === 4) clearInterval(poller);
        }, 50);

        xhr.addEventListener('loadend', function () {
            clearInterval(poller);
            try {
                var txt = _rtDesc && _rtDesc.get ? _rtDesc.get.call(xhr) : xhr.responseText;
                if (txt) processNew(txt);
            } catch (_) {}
            if (!ab.ended) {
                ab.ended = true;
                logger.log('[AI Clash longcat] XHR loadend, chunks:', _chunkCount);
                emitEnd();
            }
        });

        return _origXhrSend.apply(this, arguments);
    };

    // =====================================================================
    //  策略 2：TextDecoder.prototype.decode — 嗅探 SSE 内容
    // =====================================================================
    var _origDecode = TextDecoder.prototype.decode;
    var _decoderStates = new WeakMap();

    TextDecoder.prototype.decode = function (input, options) {
        var result = _origDecode.apply(this, arguments);
        if (!result || result.length < 5) return result;

        var st = _decoderStates.get(this);
        if (!st) { st = { tracked: false, rejected: false, buf: '', n: 0 }; _decoderStates.set(this, st); }
        if (st.rejected || _fetchHandlingInProgress) return result;

        if (!st.tracked) {
            if (result.indexOf('event: ') >= 0 || result.indexOf('data: {') >= 0 ||
                result.indexOf('data: {"choices"') >= 0 || result.indexOf('"text":') >= 0 ||
                result.indexOf('"content":') >= 0) {
                st.tracked = true;
                resetSession();
                logger.log('[AI Clash longcat] ★ TextDecoder 检测到 SSE');
            } else { st.n++; if (st.n > 3) st.rejected = true; return result; }
        }

        st.buf += result;
        var lines = st.buf.split('\n');
        st.buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) { var t = lines[i].trim(); if (t) parseSSE(t); }
        return result;
    };

    // =====================================================================
    //  策略 3：ReadableStream.getReader — fetch 直接 pump 场景
    // =====================================================================
    var _origGetReader = ReadableStream.prototype.getReader;
    ReadableStream.prototype.getReader = function () {
        var reader = _origGetReader.apply(this, arguments);
        // 已被 fetch 拦截处理过的 body，不再重复解析
        if (_fetchInterceptedBodies.has(this) || _fetchHandlingInProgress) return reader;
        var origRead = reader.read.bind(reader);
        var st = { tracked: false, rejected: false, buf: '', dec: new TextDecoder('utf-8'), n: 0 };

        reader.read = function () {
            return origRead().then(function (res) {
                if (st.rejected) return res;
                if (res.done) {
                    if (st.tracked) { if (st.buf.trim()) parseSSE(st.buf.trim()); emitEnd(); }
                    return res;
                }
                if (!res.value) return res;
                var text;
                try { text = typeof res.value === 'string' ? res.value : _rawDecode.call(st.dec, res.value, { stream: true }); }
                catch (_) { st.rejected = true; return res; }

                if (!st.tracked) {
                    if (text.indexOf('event: ') >= 0 || text.indexOf('data: {') >= 0 ||
                        text.indexOf('data: {"choices"') >= 0 || text.indexOf('"text":') >= 0 ||
                        text.indexOf('"content":') >= 0) {
                        st.tracked = true; resetSession();
                        logger.log('[AI Clash longcat] ★ ReadableStream 检测到 SSE');
                    } else { st.n++; if (st.n > 3) st.rejected = true; return res; }
                }

                st.buf += text;
                var lines = st.buf.split('\n');
                st.buf = lines.pop() || '';
                for (var i = 0; i < lines.length; i++) { var t = lines[i].trim(); if (t) parseSSE(t); }
                return res;
            });
        };
        return reader;
    };

    logger.log('[AI Clash longcat] 四路拦截就绪 (fetch / XHR / TextDecoder / ReadableStream)');
})();
