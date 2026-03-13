// src/content/qianwen-hook.js  —  v1
// 注入 MAIN world，实时拦截千问流式 SSE 响应
// 四路拦截：fetch（主） | XHR 轮询 | TextDecoder | ReadableStream.getReader

(function () {
    'use strict';

    // ====== 去重守卫 ======
    if (window.__abQianwenHookV) return;
    window.__abQianwenHookV = 1;

    // ====== Debug 日志控制 ======
    let isDebugEnabled = false;
    const logger = {
        log: (...args) => isDebugEnabled && console.log('[AI Clash qianwen]', ...args),
        info: (...args) => isDebugEnabled && console.info('[AI Clash qianwen]', ...args),
        warn: (...args) => isDebugEnabled && console.warn('[AI Clash qianwen]', ...args),
        error: (...args) => console.error('[AI Clash qianwen]', ...args),
    };

    // 监听来自 content script 的 debug 状态同步消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'AICLASH_DEBUG_STATE') {
            isDebugEnabled = event.data.enabled;
            console.log('%c[AI Clash qianwen-hook v1]%c 调试状态同步：' + (isDebugEnabled ? '开启' : '关闭'), 'color:#10b981;font-weight:bold', 'color:inherit');
        }
    });

    isDebugEnabled && console.log('%c[AI Clash qianwen-hook v1]%c MAIN world 注入成功', 'color:#10b981;font-weight:bold', 'color:inherit');
    // ====== SSE 解析核心 ======
    var _chunkCount = 0;
    var _endSentThisSession = false;
    var _currentEvent = '';  // 跟踪当前 SSE event 类型
    var _fetchHandlingInProgress = false;  // fetch 拦截器活跃时，其他拦截器跳过
    var _lastFullContent = '';  // 记录上一次的完整内容，避免重复

    function emitEnd() {
        if (_endSentThisSession) return;
        _endSentThisSession = true;
        logger.log('→ END 发送 (totalChunks=' + _chunkCount + ', lastFullContentLen=' + _lastFullContent.length + ')');
        window.postMessage({ type: 'QIANWEN_HOOK_END' }, '*');
    }

    function emitChunk(text) {
        if (!text) return;
        _chunkCount++;
        logger.log('chunk#' + _chunkCount + ' len=' + text.length + ' preview=' + JSON.stringify(text).slice(0, 60));
        window.postMessage({ type: 'QIANWEN_HOOK_CHUNK', payload: { text: text } }, '*');
    }

    /**
     * 从千问 v2 SSE 的 data.messages 数组中找到正文消息。
     * 正文消息特征：mime_type 为 "multi_load/iframe" 或类似，且直接携带 string 类型的 content。
     * bar/progress 消息的 content 在 meta_data.elements 里，不是直接的 string，会被自动排除。
     */
    function findContentMessage(messages) {
        // 从后往前找第一个有直接 string content 的消息
        for (var i = messages.length - 1; i >= 0; i--) {
            var msg = messages[i];
            if (msg && typeof msg.content === 'string') {
                logger.log('  findContentMessage idx=' + i + ' mime=' + msg.mime_type + ' status=' + msg.status + ' contentLen=' + msg.content.length);
                return msg;
            }
        }
        return null;
    }

    /** 根据 event 类型从 data JSON 中提取文本 */
    function extractByEvent(eventType, d) {
        logger.log('extractByEvent event="' + eventType + '" keys=' + Object.keys(d).join(','));

        // 千问 v2 API 格式：d.data.messages 数组，找有直接 string content 的消息
        var msgArr = (d.data && Array.isArray(d.data.messages)) ? d.data.messages
                   : (Array.isArray(d.messages)) ? d.messages
                   : null;

        if (msgArr) {
            logger.log('  路径[messages] 数组长度=' + msgArr.length + ' d.data.status=' + (d.data && d.data.status));
            var contentMsg = findContentMessage(msgArr);
            if (contentMsg) {
                var msgStatus = contentMsg.status;
                // 只在 processing/streaming/answering 时提取增量，complete 时忽略（内容已经完整传过了）
                if (msgStatus === 'processing' || msgStatus === 'streaming' || msgStatus === 'answering' || !msgStatus) {
                    var fullContent = contentMsg.content;
                    if (fullContent.length > _lastFullContent.length) {
                        var newContent = fullContent.substring(_lastFullContent.length);
                        logger.log('  → 增量 +' + newContent.length + ' 字符 (全量=' + fullContent.length + ')');
                        _lastFullContent = fullContent;
                        return newContent;
                    }
                    logger.log('  → 无增量 (fullLen=' + fullContent.length + ' lastLen=' + _lastFullContent.length + ')');
                    return '';
                } else {
                    logger.log('  → contentMsg.status=' + msgStatus + ' 跳过提取（非流式状态）');
                    return '';
                }
            } else {
                logger.log('  → msgArr 中无 string content 消息，跳过');
            }
            // 有 messages 数组，但没有可用内容消息，直接返回，不走下面的通用 fallback
            return '';
        }

        // 无 messages 数组时的通用 fallback（兼容其他 API 格式）
        if (typeof d.text === 'string') {
            logger.log('  路径[d.text] len=' + d.text.length);
            return d.text;
        }
        if (typeof d.content === 'string') {
            logger.log('  路径[d.content] len=' + d.content.length);
            return d.content;
        }
        if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
            logger.log('  路径[choices[0].delta.content]');
            return String(d.choices[0].delta.content);
        }
        if (d.output && typeof d.output === 'string') {
            logger.log('  路径[d.output] len=' + d.output.length);
            return d.output;
        }
        if (d.answer && typeof d.answer === 'string') {
            logger.log('  路径[d.answer] len=' + d.answer.length);
            return d.answer;
        }
        if (d.result && typeof d.result === 'string') {
            logger.log('  路径[d.result] len=' + d.result.length);
            return d.result;
        }
        logger.log('  → 未匹配任何路径，返回空串。完整结构=' + JSON.stringify(d).slice(0, 400));
        return '';
    }

    // 兼容 "key: value"（标准SSE有空格）和 "key:value"（千问无空格）两种格式
    function sseFieldValue(line, field) {
        // field 例如 'event'，返回值部分（去除前导空格），匹配失败返回 null
        var withSpace = field + ': ';
        var withoutSpace = field + ':';
        if (line.startsWith(withSpace)) return line.substring(withSpace.length).trim();
        if (line.startsWith(withoutSpace)) return line.substring(withoutSpace.length).trim();
        return null;
    }

    function parseSSE(line) {
        // 跟踪 event 行（兼容有/无空格）
        var eventVal = sseFieldValue(line, 'event');
        if (eventVal !== null) {
            _currentEvent = eventVal;
            logger.log('SSE event 行: "' + _currentEvent + '"');
            return;
        }
        // 忽略 id 行
        var idVal = sseFieldValue(line, 'id');
        if (idVal !== null) {
            logger.log('SSE id 行: ' + idVal);
            return;
        }

        // data 行（兼容有/无空格）
        var json = sseFieldValue(line, 'data');
        if (json === null) {
            logger.log('SSE 未知行(跳过): ' + line.slice(0, 80));
            return;
        }
        if (!json || json === '[DONE]' || json === 'true') {
            logger.log('SSE data 结束标记: "' + json + '"');
            emitEnd(); return;
        }
        try {
            var d = JSON.parse(json);
            var text = '';

            // ── 结束信号检测 ──
            // 千问 v2：event:complete 时 d.data.status === 'complete'，这是主要结束信号
            // 同时兼容其他常见结束字段
            var endReason = '';
            if (_currentEvent === 'complete') endReason = 'currentEvent=complete';
            else if (d.data && d.data.status === 'complete') endReason = 'd.data.status=complete';
            else if (d.event === 'done') endReason = 'd.event=done';
            else if (d.event === 'all_done') endReason = 'd.event=all_done';
            else if (d.status === 'done') endReason = 'd.status=done';
            else if (d.status === 'finish') endReason = 'd.status=finish';
            else if (d.status === 'completed') endReason = 'd.status=completed';
            else if (d.finished === true) endReason = 'd.finished=true';
            else if (d.is_end === true) endReason = 'd.is_end=true';
            else if (d.end === true) endReason = 'd.end=true';

            if (endReason) {
                logger.log('SSE 结束信号命中: ' + endReason + '，data.status=' + (d.data && d.data.status) + ' json前100=' + json.slice(0, 100));
                emitEnd();
                return;
            }

            logger.log('SSE data 行 currentEvent="' + _currentEvent + '" chunkCount=' + _chunkCount + ' json前120=' + json.slice(0, 120));

            // 优先：根据 event 类型精确提取
            if (_currentEvent) {
                var result = extractByEvent(_currentEvent, d);
                if (result !== null && result !== '') {
                    emitChunk(result);
                    return;
                }
                logger.log('  currentEvent 路径返回空，进入 fallback');
            }

            // Fallback: 无 event 类型或未知事件，尝试通用模式
            text = extractByEvent('', d);
            if (!text) {
                logger.log('  fallback 也返回空，本行不 emit');
            }
            emitChunk(text);
        } catch (e) {
            logger.warn('parseSSE JSON.parse 失败: ' + e.message + ' line=' + line.slice(0, 100));
        }
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
            logger.log('★ fetch 命中: ' + url);
            resetSession();
            _fetchHandlingInProgress = true;
            p.then(function (response) {
                logger.log('fetch response status=' + response.status + ' body=' + (response.body ? '有' : '无'));
                if (!response.body) { _fetchHandlingInProgress = false; return; }
                _fetchInterceptedBodies.add(response.body);
                try {
                    var clone = response.clone();
                    var reader = _rawGetReader.call(clone.body);
                    var dec = new TextDecoder('utf-8');
                    var buf = '';
                    var _rawChunkCount = 0;
                    (function pump() {
                        reader.read().then(function (res) {
                            if (res.done) {
                                logger.log('fetch pump done. buf残留=' + buf.length + ' _rawChunks=' + _rawChunkCount + ' sseChunks=' + _chunkCount);
                                if (buf.trim()) parseSSE(buf.trim());
                                _fetchHandlingInProgress = false;
                                emitEnd();
                                return;
                            }
                            var chunk;
                            try { chunk = _rawDecode.call(dec, res.value, { stream: true }); } catch (_) { return; }
                            _rawChunkCount++;
                            if (_rawChunkCount <= 3) logger.log('fetch rawChunk#' + _rawChunkCount + ' bytes=' + (res.value ? res.value.length : 0) + ' preview=' + chunk.slice(0, 80).replace(/\n/g, '↵'));
                            buf += chunk;
                            var lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (var i = 0; i < lines.length; i++) {
                                var t = lines[i].trim();
                                if (t) parseSSE(t);
                            }
                            pump();
                        }).catch(function (e) {
                            logger.warn('fetch pump error: ' + e);
                            _fetchHandlingInProgress = false; emitEnd();
                        });
                    })();
                } catch (e) { logger.warn('fetch clone/reader 失败: ' + e); }
            }).catch(function (e) { logger.warn('fetch promise 失败: ' + e); });
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

        logger.log('[AI Clash qianwen] ★ XHR 命中:', ab.url);
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
                logger.log('[AI Clash qianwen] XHR loadend, chunks:', _chunkCount);
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
                logger.log('[AI Clash qianwen] ★ TextDecoder 检测到 SSE');
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
                        logger.log('[AI Clash qianwen] ★ ReadableStream 检测到 SSE');
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

    logger.log('[AI Clash qianwen] 四路拦截就绪 (fetch / XHR / TextDecoder / ReadableStream)');
})();
