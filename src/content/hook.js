// src/content/hook.js
// 注入到页面上下文，尽早劫持 fetch/XHR，以便拦截 DeepSeek 流式接口
(function () {
    try { console.log('[AnyBridge] hook 已注入页面（fetch/XHR 已劫持）'); } catch (_) {}
})();

function isChatCompletionUrl(url) {
    return typeof url === 'string' && url.includes('chat') && (url.includes('completion') || url.includes('completions'));
}

function parseSSELineAndEmit(trimmedLine) {
    if (trimmedLine === 'event: close') {
        window.postMessage({ type: 'DEEPSEEK_HOOK_END' }, '*');
        return;
    }
    if (!trimmedLine.startsWith('data: ')) return;
    const jsonStr = trimmedLine.substring(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') return;
    try {
        const data = JSON.parse(jsonStr);
        let chunkText = "";
        if (typeof data.v === 'string') chunkText = data.v;
        else if (data.p === 'response/fragments' && data.o === 'APPEND' && Array.isArray(data.v))
            chunkText = data.v[0]?.content ?? data.v[0] ?? "";
        else if (data.v?.response?.fragments?.length)
            chunkText = data.v.response.fragments[0]?.content ?? "";
        else if (data.p === 'response/status' && data.v === 'FINISHED') {
            window.postMessage({ type: 'DEEPSEEK_HOOK_END' }, '*');
            return;
        }
        else if (data.choices?.[0]?.delta?.content != null)
            chunkText = typeof data.choices[0].delta.content === 'string' ? data.choices[0].delta.content : String(data.choices[0].delta.content);
        else if (typeof data.content === 'string') chunkText = data.content;
        else if (typeof data.text === 'string') chunkText = data.text;
        else if (data.v && typeof data.v === 'object' && typeof data.v.content === 'string') chunkText = data.v.content;
        if (chunkText) {
            if (typeof window._anyBridgeChunkCount !== 'number') window._anyBridgeChunkCount = 0;
            window._anyBridgeChunkCount++;
            if (window._anyBridgeChunkCount === 1) try { console.log('[AnyBridge] 已解析到首包并发送'); } catch (_) {}
            window.postMessage({ type: 'DEEPSEEK_HOOK_CHUNK', payload: chunkText }, '*');
        }
    } catch (_) {}
}

// ---------- fetch ----------
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const response = await originalFetch.apply(this, args);
    if (isChatCompletionUrl(url)) {
        try { console.log('[AnyBridge] 拦截到 fetch:', url); } catch (_) {}
        const clone = response.clone();
        interceptDeepSeekStreamFromReader(clone);
    }
    return response;
};

// ---------- XMLHttpRequest（部分站点用 XHR 发流式请求）---------
const XHROpen = XMLHttpRequest.prototype.open;
const XHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._anyBridgeUrl = url;
    return XHROpen.apply(this, [method, url, ...rest]);
};
XMLHttpRequest.prototype.send = function (...args) {
    const url = this._anyBridgeUrl;
    if (isChatCompletionUrl(url)) {
        try { console.log('[AnyBridge] 拦截到 XHR:', url); } catch (_) {}
        const origOnReady = this.onreadystatechange;
        this.onreadystatechange = function () {
            if (this.readyState === 4 && this.responseText) {
                const lines = this.responseText.split('\n');
                let buffer = '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) parseSSELineAndEmit(trimmed);
                }
                window.postMessage({ type: 'DEEPSEEK_HOOK_END' }, '*');
            }
            if (origOnReady) origOnReady.apply(this, arguments);
        };
    }
    return XHRSend.apply(this, args);
};

async function interceptDeepSeekStreamFromReader(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                try { console.log('[AnyBridge] 流读取结束，已发送 END'); } catch (_) {}
                window.postMessage({ type: 'DEEPSEEK_HOOK_END' }, '*');
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) parseSSELineAndEmit(trimmed);
            }
        }
    } catch (err) {
        window.postMessage({ type: 'DEEPSEEK_HOOK_END' }, '*');
    }
}