import { MSG_TYPES } from '../shared/messages.js';

let observer = null;

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
    executeDeepSeek(request.payload.prompt);
  }
});

async function waitForElement(selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

async function executeDeepSeek(prompt) {
  const textarea = await waitForElement('textarea');
  
  if (!textarea) {
    broadcastError('未找到 DeepSeek 输入框。请确认已登录。');
    return;
  }

  // 1. 强制聚焦，激活 React 的焦点状态
  textarea.focus();

  // 2. 绕过 React 设值
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  nativeInputValueSetter.call(textarea, prompt);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // 3. 稍微等久一点点 (800ms)，让 React 有充足的时间把发送按钮的禁用状态解开
  setTimeout(async () => {
    // 【升级发送逻辑】：优先根据语义化属性找按钮
    const sendBtn = document.querySelector('[aria-label="发送消息"], [aria-label="Send"], [aria-label="发送"]');
    
    if (sendBtn) {
      sendBtn.click();
    } else {
      // 【终极降维打击】：如果找不到按钮，直接在输入框里触发标准的回车事件
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    }
    
    // 给页面 1.5 秒的时间发起网络请求和生成新 DOM，然后开始监听
    setTimeout(startObserving, 1500);
  }, 800);
}

function startObserving() {
  if (observer) observer.disconnect();
  
  // 【升级监听范围】：不再去猜具体的类名，直接监听挂载点或 body
  // 只要页面上有变化，我们就能捕获到
  const chatContainer = document.querySelector('#root, body');
  if (!chatContainer) {
    broadcastError('致命错误：未能锁定页面根节点');
    return;
  }

  observer = new MutationObserver(() => {
    // 寻找回答气泡。DeepSeek 的回答通常带有特定的格式化类名
    const bubbles = document.querySelectorAll('.ds-markdown, .markdown-body, [class*="markdown"]');
    if (bubbles.length > 0) {
      // 永远取页面上最后一个气泡的内容（即当前正在生成的回答）
      const latestText = bubbles[bubbles.length - 1].innerText;
      
      chrome.runtime.sendMessage({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: 'deepseek', text: latestText }
      });
    }

    // 判断结束条件
    // 特征：如果存在包含“重新生成”或“Regenerate”的按钮/SVG，说明生成结束了
    const regenerateBtn = document.querySelector('svg[fill="currentColor"], [aria-label*="重新"], [aria-label*="Regenerate"]');
    
    // 如果找到了回答内容，并且出现了重新生成按钮（或者停止按钮消失了），则判断为完成
    if (bubbles.length > 0 && regenerateBtn) {
      // 延迟 1 秒后再次确认，防止是流式输出过程中的闪烁
      setTimeout(() => {
        observer.disconnect();
        chrome.runtime.sendMessage({
          type: MSG_TYPES.TASK_COMPLETED,
          payload: { provider: 'deepseek' }
        });
      }, 1000);
    }
  });

  // 监听整个 body 的子节点树变化和字符变化
  observer.observe(chatContainer, { 
    childList: true, 
    subtree: true, 
    characterData: true 
  });
}

function broadcastError(msg) {
  chrome.runtime.sendMessage({
    type: MSG_TYPES.ERROR,
    payload: { provider: 'deepseek', message: msg }
  });
}