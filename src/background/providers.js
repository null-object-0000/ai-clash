/**
 * 通道注册表 — 新增通道只需在此添加一条配置
 */

export const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    matchPattern: 'https://chat.deepseek.com/*',
    startUrl: 'https://chat.deepseek.com/',
    hookFile: 'src/content/deepseek/hook.js',
    hookScriptId: 'aiclash-deepseek-hook',
    hookGlobalVar: '__abHookV',
    contentScriptFile: 'src/content/deepseek/index.js',
    // API模式配置（OpenAI兼容）
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    }
  },
  {
    id: 'doubao',
    name: '豆包',
    matchPattern: 'https://www.doubao.com/*',
    startUrl: 'https://www.doubao.com/chat/',
    hookFile: 'src/content/doubao/hook.js',
    hookScriptId: 'aiclash-doubao-hook',
    hookGlobalVar: '__abDoubaoHookV',
    contentScriptFile: 'src/content/doubao/index.js',
    // API模式配置 - 暂不支持
    apiConfig: {
      enabled: false
    }
  },
  {
    id: 'qianwen',
    name: '通义千问',
    matchPattern: 'https://www.qianwen.com/*',
    startUrl: 'https://www.qianwen.com/',
    hookFile: 'src/content/qianwen/hook.js',
    hookScriptId: 'aiclash-qianwen-hook',
    hookGlobalVar: '__abQianwenHookV',
    contentScriptFile: 'src/content/qianwen/index.js',
    // API模式配置 - 暂不支持
    apiConfig: {
      enabled: false
    }
  },
  {
    id: 'longcat',
    name: 'LongCat',
    matchPattern: 'https://longcat.chat/*',
    startUrl: 'https://longcat.chat/',
    hookFile: 'src/content/longcat/hook.js',
    hookScriptId: 'aiclash-longcat-hook',
    hookGlobalVar: '__abLongcatHookV',
    contentScriptFile: 'src/content/longcat/index.js',
    // API模式配置（OpenAI兼容）
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.longcat.chat/openai/v1',
      defaultModel: 'LongCat-Flash-Lite',
      models: ['LongCat-Flash-Lite', 'LongCat-Flash-Chat', 'LongCat-Flash-Thinking', 'LongCat-Flash-Thinking-2601'],
      // 各模型默认 max_tokens（未指定时使用）
      modelDefaultMaxTokens: {
        'LongCat-Flash-Chat':          131072,
        'LongCat-Flash-Thinking':      262144,
        'LongCat-Flash-Thinking-2601': 262144,
        'LongCat-Flash-Lite':          262144,
      },
    }
  },
];

/** 通过 provider id 查找配置 */
export function getProvider(id) {
  return PROVIDERS.find(p => p.id === id);
}
