// 全局日志工具，根据debug开关控制输出
let isDebugEnabled = false

// 从存储中初始化debug状态
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get('isDebugEnabled', (result) => {
    isDebugEnabled = !!result.isDebugEnabled
  })

  // 监听存储变化，实时更新debug状态
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isDebugEnabled) {
      isDebugEnabled = !!changes.isDebugEnabled.newValue
    }
  })
}

/**
 * 设置debug开关状态
 * @param {boolean} enabled 是否开启debug
 */
export const setDebugEnabled = (enabled) => {
  isDebugEnabled = enabled
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ isDebugEnabled: enabled })
  }
}

/**
 * 获取当前debug开关状态
 * @returns {boolean}
 */
export const getDebugEnabled = () => isDebugEnabled

// 封装console方法
export const logger = {
  log: (...args) => isDebugEnabled && console.log(...args),
  info: (...args) => isDebugEnabled && console.info(...args),
  warn: (...args) => isDebugEnabled && console.warn(...args),
  error: (...args) => console.error(...args), // error始终输出
  debug: (...args) => isDebugEnabled && console.debug(...args),
  table: (...args) => isDebugEnabled && console.table(...args),
  trace: (...args) => isDebugEnabled && console.trace(...args),
}

export default logger
