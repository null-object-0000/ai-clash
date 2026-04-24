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
    id: 'summarizer',
    name: 'AI 对撞机总结',
    matchPattern: 'https://ai-clash-service.snewbie.site/*',
    startUrl: 'https://ai-clash-service.snewbie.site/',
    requiresLogin: false, // 内置服务，无需登录
    region: 'cn', // 地区：cn（中国）| global（海外）
    hasContentScript: false,
    // API 模式配置 - 内置总结服务
    apiConfig: {
      enabled: true,
      baseURL: 'https://ai-clash-service.snewbie.site/v1',
      defaultModel: 'summarizer-v1',
      apiKeyLink: '',
      models: [
        {
          id: 'summarizer-v1',
          desc: '内置总结服务',
          maxTokens: 327680,
        },
      ],
    }
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    matchPattern: 'https://chat.deepseek.com/*',
    startUrl: 'https://chat.deepseek.com/',
    requiresLogin: true, // 需要登录
    region: 'cn', // 深度求索 - 中国
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.deepseek.com',
      defaultModel: 'deepseek-v4-flash',
      apiKeyLink: 'https://platform.deepseek.com/api_keys',
      models: [
        {
          id: 'deepseek-v4-flash',
          desc: 'DeepSeek-V4-Flash',
          maxTokens: 393216,
          supportThinking: true,
        },
        {
          id: 'deepseek-v4-pro',
          desc: 'DeepSeek-V4-Pro',
          maxTokens: 393216,
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
    requiresLogin: false, // 不需要登录即可对话
    region: 'cn', // 字节豆包 - 中国
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
    requiresLogin: false, // 不需要登录即可对话
    region: 'cn', // 阿里云通义千问 - 中国
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
    requiresLogin: false, // 需要登录
    region: 'cn', // 腾讯元宝 - 中国
    // 元宝不支持 API 模式，无需 apiConfig
  },
  {
    id: 'wenxin',
    name: '文心一言',
    matchPattern: 'https://yiyan.baidu.com/*',
    startUrl: 'https://yiyan.baidu.com/chat/',
    requiresLogin: false, // 登录拦截: 否（无强制前置拦截）
    region: 'cn', // 百度文心一言 - 中国
    // 文心目前优先集成网页端
  },
  {
    id: 'longcat',
    name: 'LongCat',
    matchPattern: 'https://longcat.chat/*',
    startUrl: 'https://longcat.chat/',
    requiresLogin: true, // 需要登录
    region: 'cn', // 长猫 - 中国
    enabled: false, // 暂时禁用，回归测试中
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
          maxTokens: 327680,
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
  {
    id: 'xiaomi',
    name: 'Xiaomi MIMO',
    matchPattern: 'https://aistudio.xiaomimimo.com/*',
    startUrl: 'https://aistudio.xiaomimimo.com/#/c',
    requiresLogin: true, // 需要登录
    region: 'cn', // 小米 MIMO - 中国
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.xiaomimimo.com/v1',
      defaultModel: 'mimo-v2-pro',
      apiKeyLink: 'https://platform.xiaomimimo.com/#/console/api-keys',
      models: [
        {
          id: 'mimo-v2-pro',
          desc: '面向 Agent 时代的旗舰基座',
          maxTokens: 262144,
        },
        {
          id: 'mimo-v2-omni',
          desc: '看得清，听得懂，能动手的全模态 Agent 基座',
          maxTokens: 262144,
        },
        {
          id: 'mimo-v2-flash',
          desc: '高效推理、代码与 Agent 基座模型',
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
