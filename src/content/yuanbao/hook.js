// src/content/yuanbao/hook.js  —  v2
// 注入 MAIN world，实时拦截腾讯元宝流式 SSE 响应
// 三路拦截：fetch（主） | TextDecoder | ReadableStream.getReader
//
// 元宝 SSE 格式：
//   data: {"type":"text","msg":"..."}              — 正文增量
//   data: {"type":"think","content":"...","status":1}  — 思考增量
//   data: {"type":"think","content":"","status":2}     — 思考结束标记
//   data: [DONE]                                   — 整体结束

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abYuanbaoHookV) return;
    window.__abYuanbaoHookV = 1;

    // ====== Debug 日志控制 ======
    let isDebugEnabled = false;
    const logger = {
        log: (...args) => isDebugEnabled && logger.log(...args),
        info: (...args) => isDebugEnabled && console.info(...args),
        warn: (...args) => isDebugEnabled && console.warn(...args),
        error: (...args) => console.error(...args),
    };

    // 监听来自 content script 的 debug 状态同步消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'AICLASH_DEBUG_STATE') {
            isDebugEnabled = event.data.enabled;
            logger.log('%c[AI Clash yuanbao-hook v2]%c 调试状态同步：' + (isDebugEnabled ? '开启' : '关闭'), 'color:#0d9488;font-weight:bold', 'color:inherit');
        }
    });

    // 阻止元宝页面主动清除控制台，确保调试日志可见
    console.clear = function () {};

    logger.log('%c[AI Clash yuanbao-hook v2]%c MAIN world 注入成功', 'color:#0d9488;font-weight:bold', 'color:inherit');

    logger.log('%c[AI Clash yuanbao-hook v2]%c MAIN world 注入成功', 'color:#07c160;font-weight:bold', 'color:inherit');

    // ====== 状态变量 ======
    var _chunkCount = 0;
    var _endSentThisSession = false;
    var _fetchHandlingInProgress = false;

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        logger.log('[AI Clash yuanbao] → END (chunks=' + _chunkCount + ')');
        window.postMessage({ type: 'YUANBAO_HOOK_END' }, '*');
    }

    function emitChunk(text, isThink) {
        if (!text) return;
        _chunkCount++;
        logger.log('[AI Clash yuanbao] chunk#' + _chunkCount, JSON.stringify(text).slice(0, 80), isThink ? '(思考)' : '(正文)');
        window.postMessage({ type: 'YUANBAO_HOOK_CHUNK', payload: { text: text, isThink: !!isThink } }, '*');
    }

    function resetSession() {
        _chunkCount = 0;
        _endSentThisSession = false;
        _fetchHandlingInProgress = false;
    }

    /**
     * 解析单行 SSE data
     * 元宝格式：
     *   data: {"type":"text","msg":"..."}
     *   data: {"type":"think","content":"...","status":1}
     *   data: {"type":"think","content":"","status":2}   ← 思考结束
     *   data: [DONE]
     */
    function parseSSELine(line) {
        if (!line || line.startsWith('event: ') || line.startsWith('id: ')) return;
        if (!line.startsWith('data: ')) return;

        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') { emitEnd(); return; }
        // 非 JSON 的系统行（如 [plugin: ] [MSGINDEX:n] [TRACEID:x]）直接跳过
        if (!json.startsWith('{')) return;

        try {
            var d = JSON.parse(json);

            if (d.type === 'text') {
                // msg 存在且非空 → 正文增量；否则为文本段结束标记，忽略
                if (typeof d.msg === 'string' && d.msg) {
                    emitChunk(d.msg, false);
                }
                return;
            }

            if (d.type === 'think') {
                // status:2 → 思考完成标记，无需输出内容
                if (d.status === 2) {
                    logger.log('[AI Clash yuanbao] 思考阶段完成');
                    return;
                }
                // status:1 → 思考增量
                if (typeof d.content === 'string' && d.content) {
                    emitChunk(d.content, true);
                }
                return;
            }

            // 其他 type（tips / meta 等）：忽略
        } catch (_) {}
    }

    /** 判断是否为元宝聊天 API 端点（兼容绝对/相对路径） */
    function isYuanbaoApiUrl(url) {
        if (typeof url !== 'string') return false;
        // 绝对路径：https://yuanbao.tencent.com/api/chat/{id}
        // 相对路径：/api/chat/{id}
        return url.includes('/api/chat/');
    }

    /** 检测裸文本是否包含元宝 SSE 特征 */
    function hasYuanbaoSignature(text) {
        return text.indexOf('"type":"text"') >= 0 ||
               text.indexOf('"type":"think"') >= 0 ||
               text.indexOf('data: [DONE]') >= 0;
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

        if (isYuanbaoApiUrl(url)) {
            logger.log('[AI Clash yuanbao] ★ fetch 命中:', url);
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
                                if (buf.trim()) parseSSELine(buf.trim());
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
                                if (t) parseSSELine(t);
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
    //  策略 1：XHR 拦截 — 元宝使用 XMLHttpRequest 发送聊天请求
    // =====================================================================
    var _origXhrOpen = XMLHttpRequest.prototype.open;
    var _origXhrSend = XMLHttpRequest.prototype.send;
    var _rtDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

    XMLHttpRequest.prototype.open = function (method, url) {
        this._abYuanbao = { url: url || '', pos: 0, ended: false };
        return _origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        var ab = this._abYuanbao;
        if (!ab || !isYuanbaoApiUrl(ab.url)) {
            return _origXhrSend.apply(this, arguments);
        }

        logger.log('[AI Clash yuanbao] ★ XHR 命中:', ab.url);
        resetSession();
        var xhr = this;

        function processNew(fullText) {
            if (typeof fullText !== 'string' || fullText.length <= ab.pos) return;
            var newData = fullText.substring(ab.pos);
            ab.pos = fullText.length;
            var lines = newData.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var t = lines[i].trim();
                if (t) parseSSELine(t);
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
                logger.log('[AI Clash yuanbao] XHR loadend, chunks:', _chunkCount);
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
            if (hasYuanbaoSignature(result)) {
                st.tracked = true;
                resetSession();
                logger.log('[AI Clash yuanbao] ★ TextDecoder 检测到 SSE');
            } else { st.n++; if (st.n > 3) st.rejected = true; return result; }
        }

        st.buf += result;
        var lines = st.buf.split('\n');
        st.buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) { var t = lines[i].trim(); if (t) parseSSELine(t); }
        return result;
    };

    // =====================================================================
    //  策略 2：ReadableStream.getReader — fetch 直接 pump 场景
    // =====================================================================
    var _origGetReader = ReadableStream.prototype.getReader;
    ReadableStream.prototype.getReader = function () {
        var reader = _origGetReader.apply(this, arguments);
        if (_fetchInterceptedBodies.has(this) || _fetchHandlingInProgress) return reader;
        var origRead = reader.read.bind(reader);
        var st = { tracked: false, rejected: false, buf: '', dec: new TextDecoder('utf-8'), n: 0 };

        reader.read = function () {
            return origRead().then(function (res) {
                if (st.rejected) return res;
                if (res.done) {
                    if (st.tracked) { if (st.buf.trim()) parseSSELine(st.buf.trim()); emitEnd(); }
                    return res;
                }
                if (!res.value) return res;
                var text;
                try { text = typeof res.value === 'string' ? res.value : _rawDecode.call(st.dec, res.value, { stream: true }); }
                catch (_) { st.rejected = true; return res; }

                if (!st.tracked) {
                    if (hasYuanbaoSignature(text)) {
                        st.tracked = true; resetSession();
                        logger.log('[AI Clash yuanbao] ★ ReadableStream 检测到 SSE');
                    } else { st.n++; if (st.n > 3) st.rejected = true; return res; }
                }

                st.buf += text;
                var lines = st.buf.split('\n');
                st.buf = lines.pop() || '';
                for (var i = 0; i < lines.length; i++) { var t = lines[i].trim(); if (t) parseSSELine(t); }
                return res;
            });
        };
        return reader;
    };

    logger.log('[AI Clash yuanbao] 三路拦截就绪 (fetch / TextDecoder / ReadableStream)');
})();
