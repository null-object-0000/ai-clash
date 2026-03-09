// src/content/qianwen-hook.js  —  v1
// 注入 MAIN world，实时拦截千问流式 SSE 响应
// 四路拦截：fetch（主） | XHR 轮询 | TextDecoder | ReadableStream.getReader

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abQianwenHookV) return;
    window.__abQianwenHookV = 1;
    console.log('%c[AI Clash qianwen-hook v1]%c MAIN world 注入成功', 'color:#10b981;font-weight:bold', 'color:inherit');

    // ====== SSE 解析核心 ======
    var _chunkCount = 0;
    var _endSentThisSession = false;
    var _currentEvent = '';  // 跟踪当前 SSE event 类型
    var _fetchHandlingInProgress = false;  // fetch 拦截器活跃时，其他拦截器跳过
    var _lastFullContent = '';  // 记录上一次的完整内容，避免重复

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        console.log('[AI Clash qianwen] → END (chunks=' + _chunkCount + ')');
        window.postMessage({ type: 'QIANWEN_HOOK_END' }, '*');
    }

    function emitChunk(text) {
        if (!text) return;
        _chunkCount++;
        if (_chunkCount <= 5) console.log('[AI Clash qianwen] chunk#' + _chunkCount, JSON.stringify(text).slice(0, 80));
        window.postMessage({ type: 'QIANWEN_HOOK_CHUNK', payload: { text: text } }, '*');
    }

    /** 根据 event 类型从 data JSON 中提取文本 */
    function extractByEvent(eventType, d) {
        // 调试日志：输出完整的响应结构
        if (_chunkCount <= 3) console.log('[AI Clash qianwen] 收到响应结构:', JSON.stringify(d).slice(0, 300));

        // 处理千问最新的v2 API格式：data.messages数组最后一个元素的content
        if (d.data && d.data.messages && Array.isArray(d.data.messages)) {
            const lastMsg = d.data.messages[d.data.messages.length - 1];
            if (lastMsg && typeof lastMsg.content === 'string') {
                // 放宽status判断，兼容可能的状态变更：processing/streaming/answering都可以
                if (lastMsg.status === 'processing' || lastMsg.status === 'streaming' || lastMsg.status === 'answering' || !lastMsg.status) {
                    const fullContent = lastMsg.content;
                    // 只返回新增的部分，避免重复
                    if (fullContent.length > _lastFullContent.length) {
                        const newContent = fullContent.substring(_lastFullContent.length);
                        _lastFullContent = fullContent;
                        return newContent;
                    }
                    return ''; // 内容没有变化，返回空
                }
            }
        }
        // 兼容可能的结构变化：直接从d.messages提取
        if (d.messages && Array.isArray(d.messages)) {
            const lastMsg = d.messages[d.messages.length - 1];
            if (lastMsg && typeof lastMsg.content === 'string') {
                const fullContent = lastMsg.content;
                if (fullContent.length > _lastFullContent.length) {
                    const newContent = fullContent.substring(_lastFullContent.length);
                    _lastFullContent = fullContent;
                    return newContent;
                }
                return '';
            }
        }
        // 尝试从常见的字段中提取文本
        if (typeof d.text === 'string') {
            return d.text;
        }
        if (typeof d.content === 'string') {
            return d.content;
        }
        if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
            return String(d.choices[0].delta.content);
        }
        if (d.output && typeof d.output === 'string') {
            return d.output;
        }
        if (d.answer && typeof d.answer === 'string') {
            return d.answer;
        }
        if (d.result && typeof d.result === 'string') {
            return d.result;
        }
        // 尝试从嵌套结构中提取
        if (d.data && typeof d.data === 'object') {
            if (typeof d.data.text === 'string') return d.data.text;
            if (typeof d.data.content === 'string') return d.data.content;
        }
        return '';
    }

    function parseSSE(line) {
        // 跟踪 event: 行
        if (line.startsWith('event: ')) {
            _currentEvent = line.substring(7).trim();
            return;
        }
        // 忽略 id: 行
        if (line.startsWith('id: ')) return;

        // 兼容旧格式 end 信号
        if (line === 'event: close' || line === 'event: done' || line === 'event: complete') { emitEnd(); return; }
        if (!line.startsWith('data: ')) return;

        var json = line.substring(6).trim();
        if (!json || json === '[DONE]' || json === 'true') { emitEnd(); return; }
        try {
            var d = JSON.parse(json);
            var text = '';

            // 检查是否为结束信号
            if (d.event === 'done' || d.event === 'all_done' || d.status === 'done' || d.finished === true ||
                d.status === 'finish' || d.status === 'completed' || d.is_end === true || d.end === true) {
                emitEnd();
                return;
            }

            // 优先：根据 event 类型精确提取
            if (_currentEvent) {
                var result = extractByEvent(_currentEvent, d);
                if (result !== null && result !== '') {
                    emitChunk(result);
                    return;
                }
            }

            // Fallback: 无 event 类型或未知事件，尝试通用模式
            text = extractByEvent('', d);

            emitChunk(text);
        } catch (_) {}
    }

    /** 检测是否为千问聊天 API 端点 */
    function isQianwenApiUrl(url) {
        if (typeof url !== 'string') return false;
        // 只拦截指定的SSE接口
        return url === '/api/v2/chat';
    }

    function resetSession() {
        _chunkCount = 0;
        _endSentThisSession = false;
        _currentEvent = '';
        _fetchHandlingInProgress = false;
        _lastFullContent = '';
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

        if (isQianwenApiUrl(url)) {
            console.log('[AI Clash qianwen] ★ fetch 命中:', url);
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
        this._abQianwen = { url: url, pos: 0, ended: false };
        return _origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        var ab = this._abQianwen;
        if (!ab || !isQianwenApiUrl(ab.url)) {
            return _origXhrSend.apply(this, arguments);
        }

        console.log('[AI Clash qianwen] ★ XHR 命中:', ab.url);
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
                console.log('[AI Clash qianwen] XHR loadend, chunks:', _chunkCount);
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
                console.log('[AI Clash qianwen] ★ TextDecoder 检测到 SSE');
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
                        console.log('[AI Clash qianwen] ★ ReadableStream 检测到 SSE');
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

    console.log('[AI Clash qianwen] 四路拦截就绪 (fetch / XHR / TextDecoder / ReadableStream)');
})();
