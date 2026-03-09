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
    // API模式配置
    apiConfig: {
      enabled: true,
      endpoint: 'https://api.deepseek.com/chat/completions',
      authPrefix: 'Bearer ',
      defaultModel: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      // 请求模板
      requestTemplate: (prompt, apiKey, model, settings = {}) => ({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.max_tokens || 4096
        })
      }),
      // 流式响应解析器
      responseParser: (chunk) => {
        if (chunk.startsWith('data: ')) {
          chunk = chunk.slice(6);
          if (chunk === '[DONE]') return null;
          try {
            const data = JSON.parse(chunk);
            return data.choices?.[0]?.delta?.content || '';
          } catch (e) {
            return '';
          }
        }
        return '';
      },
      // 错误解析器
      errorParser: (response, body) => {
        try {
          const error = JSON.parse(body);
          return error.error?.message || `API请求失败 (${response.status})`;
        } catch (e) {
          return `API请求失败 (${response.status})`;
        }
      }
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
    // API模式配置
    apiConfig: {
      enabled: true,
      endpoint: 'https://api.longcat.chat/openai/v1/chat/completions',
      authPrefix: 'Bearer ',
      defaultModel: 'longcat-chat',
      models: ['longcat-chat'],
      // 请求模板（OpenAI兼容格式）
      requestTemplate: (prompt, apiKey, model, settings = {}) => ({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'longcat-chat',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.max_tokens || 4096
        })
      }),
      // 流式响应解析器（OpenAI兼容格式）
      responseParser: (chunk) => {
        if (chunk.startsWith('data: ')) {
          chunk = chunk.slice(6);
          if (chunk === '[DONE]') return null;
          try {
            const data = JSON.parse(chunk);
            return data.choices?.[0]?.delta?.content || '';
          } catch (e) {
            return '';
          }
        }
        return '';
      },
      // 错误解析器
      errorParser: (response, body) => {
        try {
          const error = JSON.parse(body);
          return error.error?.message || `API请求失败 (${response.status})`;
        } catch (e) {
          return `API请求失败 (${response.status})`;
        }
      }
    }
  },
];

/** 通过 provider id 查找配置 */
export function getProvider(id) {
  return PROVIDERS.find(p => p.id === id);
}
