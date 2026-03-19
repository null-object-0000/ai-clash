// src/content/hook.js  —  v4 2024-06
// 注入 MAIN world，实时拦截 DeepSeek 流式 SSE 响应
// 四路拦截：fetch（主） | XHR 轮询 | TextDecoder | ReadableStream.getReader

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abHookV) return;          // 避免重复注入
    window.__abHookV = 4;

    // ====== Debug 日志控制 ======
    let isDebugEnabled = false;
    const logger = {
        log: (...args) => isDebugEnabled && console.log('[AI Clash deepseek]', ...args),
        info: (...args) => isDebugEnabled && console.info('[AI Clash deepseek]', ...args),
        warn: (...args) => isDebugEnabled && console.warn('[AI Clash deepseek]', ...args),
        error: (...args) => console.error('[AI Clash deepseek]', ...args),
    };

    // 监听来自 content script 的 debug 状态同步消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'AICLASH_DEBUG_STATE') {
            isDebugEnabled = event.data.enabled;
            logger.log('%c[AI Clash hook v4]%c 调试状态同步：' + (isDebugEnabled ? '开启' : '关闭'), 'color:#6366f1;font-weight:bold', 'color:inherit');
        }
    });

    logger.log('%c[AI Clash hook v4]%c MAIN world 注入成功', 'color:#6366f1;font-weight:bold', 'color:inherit');

    // ====== MAIN→ISOLATED 同步通信桥 ======
    // dispatchEvent 是同步的，事件处理函数在调用时立即内联执行，
    // 不像 postMessage（宏任务）会被 ReadableStream 微任务链阻塞
    var _commEl = document.createElement('div');
    _commEl.id = '__aiclash_ds_comm';
    _commEl.style.display = 'none';
    (document.documentElement || document.head).appendChild(_commEl);

    function emitChunk(text, isThink) {
        _commEl.dataset.text = text;
        _commEl.dataset.think = isThink ? '1' : '0';
        window.dispatchEvent(new Event('__aiclash_ds_chunk'));
    }

    // ====== SSE 解析核心 ======
    var _phase = 'RESPONSE';
    var _chunkCount = 0;
    var _endSentThisSession = false;       // 每轮对话只发一次 END

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        logger.log('[AI Clash v4] → END (chunks=' + _chunkCount + ')');
        window.dispatchEvent(new Event('__aiclash_ds_end'));
    }

    function parseSSE(line) {
        if (line === 'event: close') { emitEnd(); return; }
        if (!line.startsWith('data: ')) return;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') return;
        try {
            var d = JSON.parse(json);
            var text = '', isThink = false;

            // 过滤所有状态消息，不要当成内容返回
            if (d.p === 'response/status') {
                if (d.v === 'FINISHED') emitEnd();
                return;
            }
            if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
                text = String(d.choices[0].delta.content);
            } else if (d.p === 'response/fragments' && d.o === 'APPEND' && Array.isArray(d.v)) {
                var f = d.v[0];
                text = f && f.content ? f.content : (typeof f === 'string' ? f : '');
                _phase = (f && f.type === 'THINK') ? 'THINK' : 'RESPONSE';
                isThink = _phase === 'THINK';
            } else if (d.p === 'response/fragments/-1/content' && d.v != null) {
                text = typeof d.v === 'string' ? d.v : String(d.v);
                isThink = _phase === 'THINK';
            } else if (d.v && d.v.response && d.v.response.fragments && d.v.response.fragments.length) {
                var fr = d.v.response.fragments[0];
                text = fr && fr.content ? fr.content : '';
                _phase = (fr && fr.type === 'THINK') ? 'THINK' : 'RESPONSE';
                isThink = _phase === 'THINK';
            } else if (typeof d.v === 'string') {
                text = d.v;
                isThink = _phase === 'THINK';
            } else if (d.v && typeof d.v === 'object' && typeof d.v.content === 'string') {
                text = d.v.content;
            }

            if (text) {
                // 处理DeepSeek联网搜索标识
                if (text.startsWith('FINISHEDSEARCH')) {
                    // 替换为特殊tag，保留后面的内容
                    text = '🔍 已联网搜索\n' + text.substring('FINISHEDSEARCH'.length);
                }
                _chunkCount++;
                if (_chunkCount <= 3) logger.log('[AI Clash v4] chunk#' + _chunkCount, JSON.stringify(text).slice(0, 80));
                emitChunk(text, isThink);
            }
        } catch (_) {}
    }

    function isCompletionUrl(url) {
        return typeof url === 'string' && url === '/api/v0/chat/completion';
    }

    function resetSession() {
        _phase = 'RESPONSE';
        _chunkCount = 0;
        _endSentThisSession = false;
    }

    // =====================================================================
    //  策略 0（最强）：fetch 拦截 — 在页面 JS 运行前 patch，保证被缓存
    //  使用 pull-based ReadableStream 透传：拦截原始 body，逐块解析 SSE 后
    //  原样转发给页面，避免 clone tee 导致的缓冲停滞
    // =====================================================================
    var _origFetch = window.fetch;
    // 保存原始 getReader 以避免策略 3 的 hook 产生递归
    var _rawGetReader = ReadableStream.prototype.getReader;
    // 保存原始 TextDecoder.decode 以避免策略 2 的 hook 产生递归
    var _rawDecode = TextDecoder.prototype.decode;
    // 当策略 0（fetch）已命中时，阻止策略 2/3 重复处理同一 SSE 流
    var _fetchIntercepted = false;

    window.fetch = function () {
        var url = '';
        try {
            var arg0 = arguments[0];
            url = typeof arg0 === 'string' ? arg0 : (arg0 && (arg0.url || ''));
        } catch (_) {}

        if (!isCompletionUrl(url)) {
            return _origFetch.apply(this, arguments);
        }

        logger.log('[AI Clash v4] ★ fetch 命中:', url);
        resetSession();
        _fetchIntercepted = true;

        return _origFetch.apply(this, arguments).then(function (response) {
            if (!response.body) {
                _fetchIntercepted = false;
                return response;
            }

            var dec = new TextDecoder('utf-8');
            var buf = '';
            var sourceReader = _rawGetReader.call(response.body);

            // pull-based ReadableStream：页面每次读取时，从原始流取一块数据，
            // 经我们的 SSE 解析后原样转发，彻底消除 clone tee 的缓冲停滞问题
            var readable = new ReadableStream({
                pull: function (controller) {
                    return sourceReader.read().then(function (result) {
                        if (result.done) {
                            try { if (buf.trim()) parseSSE(buf.trim()); } catch (_) {}
                            emitEnd();
                            _fetchIntercepted = false;
                            controller.close();
                            return;
                        }
                        controller.enqueue(result.value);
                        try {
                            var chunk = _rawDecode.call(dec, result.value, { stream: true });
                            buf += chunk;
                            var lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (var i = 0; i < lines.length; i++) {
                                var t = lines[i].trim();
                                if (t) parseSSE(t);
                            }
                        } catch (_) {}
                    }).catch(function (err) {
                        emitEnd();
                        _fetchIntercepted = false;
                        try { controller.error(err); } catch (_) {}
                    });
                },
                cancel: function () {
                    _fetchIntercepted = false;
                    sourceReader.cancel();
                }
            });

            return new Response(readable, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }).catch(function (err) {
            _fetchIntercepted = false;
            throw err;
        });
    };

    // =====================================================================
    //  策略 1：XHR — 50ms 轮询 responseText
    //  即使压缩导致 responseText 全量到达，也能在 loadend 时兜底解析
    // =====================================================================
    var _origXhrOpen = XMLHttpRequest.prototype.open;
    var _origXhrSend = XMLHttpRequest.prototype.send;
    var _rtDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

    XMLHttpRequest.prototype.open = function (method, url) {
        this._ab = { url: url, pos: 0, ended: false };
        return _origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        var ab = this._ab;
        if (!ab || !isCompletionUrl(ab.url)) {
            return _origXhrSend.apply(this, arguments);
        }

        logger.log('[AI Clash v4] ★ XHR 命中:', ab.url, 'responseType:', this.responseType);
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

        // 50ms 轮询 — 如果浏览器支持增量 responseText 就能实时拿到数据
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
                logger.log('[AI Clash v4] XHR loadend, chunks:', _chunkCount);
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
        if (_fetchIntercepted) return result;

        var st = _decoderStates.get(this);
        if (!st) { st = { tracked: false, rejected: false, buf: '', n: 0 }; _decoderStates.set(this, st); }
        if (st.rejected) return result;

        if (!st.tracked) {
            if (result.indexOf('event: ready') >= 0 || result.indexOf('data: {"v"') >= 0 ||
                result.indexOf('data: {"p"') >= 0 || result.indexOf('data: {"choices"') >= 0 ||
                result.indexOf('"response_message_id"') >= 0) {
                st.tracked = true;
                resetSession();
                logger.log('[AI Clash v4] ★ TextDecoder 检测到 SSE');
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
        var origRead = reader.read.bind(reader);
        var st = { tracked: false, rejected: false, buf: '', dec: new TextDecoder('utf-8'), n: 0 };

        reader.read = function () {
            return origRead().then(function (res) {
                if (st.rejected || _fetchIntercepted) return res;
                if (res.done) {
                    if (st.tracked) { if (st.buf.trim()) parseSSE(st.buf.trim()); emitEnd(); }
                    return res;
                }
                if (!res.value) return res;
                var text;
                try { text = typeof res.value === 'string' ? res.value : _rawDecode.call(st.dec, res.value, { stream: true }); }
                catch (_) { st.rejected = true; return res; }

                if (!st.tracked) {
                    if (text.indexOf('event: ready') >= 0 || text.indexOf('data: {"v"') >= 0 ||
                        text.indexOf('data: {"choices"') >= 0 || text.indexOf('data: {"p"') >= 0 ||
                        text.indexOf('"response_message_id"') >= 0) {
                        st.tracked = true; resetSession();
                        logger.log('[AI Clash v4] ★ ReadableStream 检测到 SSE');
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

    logger.log('[AI Clash v4] 四路拦截就绪 (fetch / XHR / TextDecoder / ReadableStream)');
})();