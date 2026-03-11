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
      // 各模型默认 max_tokens（未指定时使用）
      modelDefaultMaxTokens: {
        'deepseek-chat':     8192,
        'deepseek-reasoner': 65536,
      },
      // 支持通过 extra_body 开启思考模式的模型列表（仅对这些模型注入 thinking 参数）
      thinkingExtraBodyModels: ['deepseek-reasoner'],
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
    // API模式配置（OpenAI兼容，Coding Plan 专用端点）
    apiConfig: {
      enabled: true,
      baseURL: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      defaultModel: 'ark-code-latest',
      models: ['ark-code-latest'],
      modelDefaultMaxTokens: {
        'ark-code-latest': 16384,
      },
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
    // API模式配置（OpenAI兼容，百炼 Coding Plan 专用端点）
    apiConfig: {
      enabled: true,
      baseURL: 'https://coding.dashscope.aliyuncs.com/v1',
      defaultModel: 'qwen3.5-plus',
      models: [
        'qwen3.5-plus', 'kimi-k2.5', 'glm-5', 'MiniMax-M2.5', 'deepseek-v3.2',
        'qwen3-max-2026-01-23', 'qwen3-coder-next', 'qwen3-coder-plus', 'glm-4.7',
      ],
      modelDefaultMaxTokens: {
        'qwen3.5-plus':          16384,
        'kimi-k2.5':             16384,
        'glm-5':                 16384,
        'MiniMax-M2.5':          16384,
        'deepseek-v3.2':         16384,
        'qwen3-max-2026-01-23':  16384,
        'qwen3-coder-next':      32768,
        'qwen3-coder-plus':      16384,
        'glm-4.7':               16384,
      },
      // 支持通过 extra_body 开启思考模式的模型列表
      thinkingExtraBodyModels: ['qwen3.5-plus', 'kimi-k2.5', 'glm-5', 'MiniMax-M2.5', 'qwen3-max-2026-01-23', 'glm-4.7'],
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
  {
    id: 'yuanbao',
    name: '元宝',
    matchPattern: 'https://yuanbao.tencent.com/*',
    startUrl: 'https://yuanbao.tencent.com/chat/',
    hookFile: 'src/content/yuanbao/hook.js',
    hookScriptId: 'aiclash-yuanbao-hook',
    hookGlobalVar: '__abYuanbaoHookV',
    contentScriptFile: 'src/content/yuanbao/index.js',
  },
];

/** 通过 provider id 查找配置 */
export function getProvider(id) {
  return PROVIDERS.find(p => p.id === id);
}
