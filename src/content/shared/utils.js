// ============================================================================
// 扩展上下文 & 安全通信
// ============================================================================

/** 检测扩展上下文是否仍有效 */
export function isContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** 静默发送消息，忽略"Receiving end does not exist"及上下文失效错误 */
export function safeSend(msg, callback) {
  if (!isContextValid()) return;
  try {
    chrome.runtime.sendMessage(msg, (resp) => {
      void chrome.runtime.lastError;
      callback?.(resp);
    });
  } catch {
    // Extension context invalidated — 静默忽略
  }
}
