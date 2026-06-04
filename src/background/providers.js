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
        },
      ],
    }
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    matchPattern: 'https://chat.deepseek.com/*',
    startUrl: 'https://chat.deepseek.com/',
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
          supportThinking: true,
        },
        {
          id: 'deepseek-v4-pro',
          desc: 'DeepSeek-V4-Pro',
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
    region: 'cn',
  },
  {
    id: 'qianwen',
    name: '通义千问',
    matchPattern: 'https://www.qianwen.com/*',
    startUrl: 'https://www.qianwen.com/',
    region: 'cn',
  },
  {
    id: 'yuanbao',
    name: '元宝',
    matchPattern: 'https://yuanbao.tencent.com/*',
    startUrl: 'https://yuanbao.tencent.com/chat/',
    region: 'cn',
  },
  {
    id: 'wenxin',
    name: '文心一言',
    matchPattern: 'https://yiyan.baidu.com/*',
    startUrl: 'https://yiyan.baidu.com/chat/',
    region: 'cn',
  },
  {
    id: 'longcat',
    name: 'LongCat',
    matchPattern: 'https://longcat.chat/*',
    startUrl: 'https://longcat.chat/',
    region: 'cn',
    enabled: false, // 暂时禁用，回归测试中
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.longcat.chat/openai/v1',
      defaultModel: 'LongCat-2.0-Preview',
      apiKeyLink: 'https://longcat.chat/platform/api_keys',
      models: [
        {
          id: 'LongCat-2.0-Preview',
          desc: '高性能 Agentic 模型',
        },
      ],
    }
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi MIMO',
    matchPattern: 'https://aistudio.xiaomimimo.com/*',
    startUrl: 'https://aistudio.xiaomimimo.com/#/c',
    region: 'cn', // 小米 MIMO - 中国
    // API 模式配置
    apiConfig: {
      enabled: true,
      baseURL: 'https://api.xiaomimimo.com/v1',
      defaultModel: 'mimo-v2-flash',
      apiKeyLink: 'https://platform.xiaomimimo.com/#/console/api-keys',
      models: [
        {
          id: 'mimo-v2.5-pro',
          desc: '万亿参数，高效架构',
        },
        {
          id: 'mimo-v2.5',
          desc: '原生全模态感知 + 1M 上下文',
        },
        {
          id: 'mimo-v2-pro',
          desc: '面向 Agent 时代的旗舰基座',
        },
        {
          id: 'mimo-v2-omni',
          desc: '看得清，听得懂，能动手的全模态 Agent 基座',
        },
        {
          id: 'mimo-v2-flash',
          desc: '高效推理、代码与 Agent 基座模型',
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
