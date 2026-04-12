/**
 * 通道注册表 — 新增通道只需在此添加一条配置
 *
 * 所有配置数据集中于此，UI 和 manifest 都从此处自动生成
 *
 * 命名规范（自动推导，无需手动配置）：
 * - contentScriptFile: src/content/{id}/index.js
 */

export const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    matchPattern: 'https://chat.deepseek.com/*',
    startUrl: 'https://chat.deepseek.com/',
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      apiKeyLink: 'https://platform.deepseek.com/api_keys',
      models: [
        {
          id: 'deepseek-chat',
          desc: 'DeepSeek-V3.2',
          maxTokens: 8192,
        },
        {
          id: 'deepseek-reasoner',
          desc: 'DeepSeek-V3.2 思考',
          maxTokens: 65536,
          supportThinking: true,
        },
      ],
    }
  },
  {
    id: 'doubao',
    name: '豆包',
    matchPattern: 'https://www.doubao.com/*',
    startUrl: 'https://www.doubao.com/chat/',
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      defaultModel: 'ark-code-latest',
      apiKeyLink: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
      apiNote: '暂仅支持火山方舟 Coding Plan 模式',
      models: [
        {
          id: 'ark-code-latest',
          desc: 'Coding Plan',
          maxTokens: 16384,
        },
      ],
    }
  },
  {
    id: 'qianwen',
    name: '通义千问',
    matchPattern: 'https://www.qianwen.com/*',
    startUrl: 'https://www.qianwen.com/',
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://coding.dashscope.aliyuncs.com/v1',
      defaultModel: 'qwen3.5-plus',
      apiKeyLink: 'https://bailian.console.aliyun.com/cn-beijing/?tab=coding-plan#/efm/detail',
      apiNote: '暂仅支持阿里云百炼 Coding Plan 模式',
      models: [
        {
          id: 'qwen3.5-plus',
          desc: '推荐 · 深度思考 · 图片理解',
          maxTokens: 16384,
          supportThinking: true,
        },
        {
          id: 'kimi-k2.5',
          desc: '推荐 · 深度思考 · 图片理解',
          maxTokens: 16384,
          supportThinking: true,
        },
        {
          id: 'glm-5',
          desc: '推荐 · 深度思考',
          maxTokens: 16384,
          supportThinking: true,
        },
        {
          id: 'MiniMax-M2.5',
          desc: '推荐 · 深度思考',
          maxTokens: 16384,
          supportThinking: true,
        },
        {
          id: 'deepseek-v3.2',
          desc: '推荐',
          maxTokens: 16384,
        },
        {
          id: 'qwen3-max-2026-01-23',
          desc: '旗舰 · 深度思考',
          maxTokens: 16384,
          supportThinking: true,
        },
        {
          id: 'qwen3-coder-next',
          desc: '编程专用',
          maxTokens: 32768,
        },
        {
          id: 'qwen3-coder-plus',
          desc: '编程专用·轻量',
          maxTokens: 16384,
        },
        {
          id: 'glm-4.7',
          desc: '深度思考',
          maxTokens: 16384,
          supportThinking: true,
        },
      ],
    }
  },
  {
    id: 'yuanbao',
    name: '元宝',
    matchPattern: 'https://yuanbao.tencent.com/*',
    startUrl: 'https://yuanbao.tencent.com/chat/',
    // 元宝不支持 API 模式，无需 apiConfig
  },
  {
    id: 'longcat',
    name: 'LongCat',
    matchPattern: 'https://longcat.chat/*',
    startUrl: 'https://longcat.chat/',
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.longcat.chat/openai/v1',
      defaultModel: 'LongCat-Flash-Lite',
      apiKeyLink: 'https://longcat.chat/platform/api_keys',
      models: [
        {
          id: 'LongCat-Flash-Lite',
          desc: '高效轻量 MoE',
          maxTokens: 262144,
        },
        {
          id: 'LongCat-Flash-Chat',
          desc: '通用对话',
          maxTokens: 131072,
        },
        {
          id: 'LongCat-Flash-Thinking',
          desc: '深度思考',
          maxTokens: 262144,
        },
        {
          id: 'LongCat-Flash-Thinking-2601',
          desc: '升级版深度思考',
          maxTokens: 262144,
        },
      ],
    }
  },
];

/**
 * 派生配置 - 按命名规范自动生成，无需手动填写
 */
export function deriveProviderConfig(provider) {
  return {
    contentScriptFile: `src/content/${provider.id}/index.js`,
  };
}

/**
 * 获取完整的提供者配置（包含派生配置）
 */
export function getProvider(id) {
  const provider = PROVIDERS.find(p => p.id === id);
  if (!provider) return undefined;
  return {
    ...provider,
    ...deriveProviderConfig(provider),
  };
}

/**
 * 获取支持 extra_body 注入思考模式的模型 ID 列表
 */
export function getThinkingExtraBodyModels(providerId) {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider?.apiConfig?.models) return [];
  return provider.apiConfig.models
    .filter(m => m.supportThinking)
    .map(m => m.id);
}
