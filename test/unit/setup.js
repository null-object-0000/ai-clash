// 全局mock Chrome API
import { chrome } from 'jest-chrome'
global.chrome = chrome

// 模拟扩展ID
chrome.runtime.id = 'test-extension-id'

// mock常用API默认返回值
chrome.storage.local.get.mockResolvedValue({})
chrome.storage.local.set.mockResolvedValue()
chrome.runtime.sendMessage.mockResolvedValue()
