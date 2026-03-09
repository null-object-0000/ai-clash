// src/content/doubao-hook.js  —  v1
// 注入 MAIN world，实时拦截豆包流式 SSE 响应
// 四路拦截：fetch（主） | XHR 轮询 | TextDecoder | ReadableStream.getReader

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abDoubaoHookV) return;
    window.__abDoubaoHookV = 1;
    console.log('%c[AnyBridge doubao-hook v1]%c MAIN world 注入成功', 'color:#f59e0b;font-weight:bold', 'color:inherit');

    // ====== SSE 解析核心 ======
    var _chunkCount = 0;
    var _endSentThisSession = false;

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        console.log('[AnyBridge doubao] → END (chunks=' + _chunkCount + ')');
        window.postMessage({ type: 'DOUBAO_HOOK_END' }, '*');
    }

    function parseSSE(line) {
        if (line === 'event: close' || line === 'event: done') { emitEnd(); return; }
        if (!line.startsWith('data: ')) return;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') { emitEnd(); return; }
        try {
            var d = JSON.parse(json);
            var text = '';

            // 豆包 SSE 格式解析 — 兼容多种可能的结构
            // 格式 1: {"event":"reply","text":"..."}
            if (d.event === 'reply' && typeof d.text === 'string') {
                text = d.text;
            }
            // 格式 2: {"event":"done"} / {"event":"all_done"}
            else if (d.event === 'done' || d.event === 'all_done') {
                emitEnd(); return;
            }
            // 格式 3: OpenAI-compatible {"choices":[{"delta":{"content":"..."}}]}
            else if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
                text = String(d.choices[0].delta.content);
            }
            // 格式 4: {"message":{"content":{"text":"..."}}} 或 {"message":{"text":"..."}}
            else if (d.message) {
                if (d.message.content && typeof d.message.content.text === 'string') {
                    text = d.message.content.text;
                } else if (typeof d.message.text === 'string') {
                    text = d.message.text;
                }
            }
            // 格式 5: {"data":{"message":{"content":"..."}}} 或 {"data":{"text":"..."}}
            else if (d.data) {
                if (d.data.message && typeof d.data.message.content === 'string') {
                    text = d.data.message.content;
                } else if (typeof d.data.text === 'string') {
                    text = d.data.text;
                }
            }
            // 格式 6: 通用 content 字段
            else if (typeof d.content === 'string') {
                text = d.content;
            }
            // 格式 7: 通用文本
            else if (typeof d.text === 'string') {
                text = d.text;
            }

            if (text) {
                _chunkCount++;
                if (_chunkCount <= 3) console.log('[AnyBridge doubao] chunk#' + _chunkCount, JSON.stringify(text).slice(0, 80));
                window.postMessage({ type: 'DOUBAO_HOOK_CHUNK', payload: { text: text } }, '*');
            }
        } catch (_) {}
    }

    /** 检测是否为豆包聊天 API 端点 */
    function isDoubaoApiUrl(url) {
        if (typeof url !== 'string') return false;
        // 匹配豆包的各种 API 路径
        return url.indexOf('/alice/msg') >= 0 ||
               url.indexOf('/samantha/chat') >= 0 ||
               url.indexOf('/api/chat') >= 0 ||
               url.indexOf('/chat/completion') >= 0 ||
               url.indexOf('/stream/chat') >= 0 ||
               (url.indexOf('doubao.com') >= 0 && (url.indexOf('/send') >= 0 || url.indexOf('/message') >= 0));
    }

    function resetSession() {
        _chunkCount = 0;
        _endSentThisSession = false;
    }

    // =====================================================================
    //  策略 0（最强）：fetch 拦截
    // =====================================================================
    var _origFetch = window.fetch;
    var _rawGetReader = ReadableStream.prototype.getReader;
    var _rawDecode = TextDecoder.prototype.decode;

    window.fetch = function () {
        var url = '';
        try {
            var arg0 = arguments[0];
            url = typeof arg0 === 'string' ? arg0 : (arg0 && (arg0.url || ''));
        } catch (_) {}

        var p = _origFetch.apply(this, arguments);

        if (isDoubaoApiUrl(url)) {
            console.log('[AnyBridge doubao] ★ fetch 命中:', url);
            resetSession();
            p.then(function (response) {
                if (!response.body) return;
                try {
                    var clone = response.clone();
                    var reader = _rawGetReader.call(clone.body);
                    var dec = new TextDecoder('utf-8');
                    var buf = '';
                    (function pump() {
                        reader.read().then(function (res) {
                            if (res.done) {
                                if (buf.trim()) parseSSE(buf.trim());
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
                        }).catch(function () { emitEnd(); });
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
        this._abDoubao = { url: url, pos: 0, ended: false };
        return _origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        var ab = this._abDoubao;
        if (!ab || !isDoubaoApiUrl(ab.url)) {
            return _origXhrSend.apply(this, arguments);
        }

        console.log('[AnyBridge doubao] ★ XHR 命中:', ab.url);
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
                console.log('[AnyBridge doubao] XHR loadend, chunks:', _chunkCount);
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
        if (st.rejected) return result;

        if (!st.tracked) {
            if (result.indexOf('event: reply') >= 0 || result.indexOf('event: done') >= 0 ||
                result.indexOf('"event":"reply"') >= 0 || result.indexOf('data: {"choices"') >= 0 ||
                result.indexOf('"alice/msg"') >= 0 || result.indexOf('"message"') >= 0) {
                st.tracked = true;
                resetSession();
                console.log('[AnyBridge doubao] ★ TextDecoder 检测到 SSE');
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
                    if (text.indexOf('event: reply') >= 0 || text.indexOf('event: done') >= 0 ||
                        text.indexOf('"event":"reply"') >= 0 || text.indexOf('data: {"choices"') >= 0 ||
                        text.indexOf('"alice/msg"') >= 0) {
                        st.tracked = true; resetSession();
                        console.log('[AnyBridge doubao] ★ ReadableStream 检测到 SSE');
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

    console.log('[AnyBridge doubao] 四路拦截就绪 (fetch / XHR / TextDecoder / ReadableStream)');
})();
