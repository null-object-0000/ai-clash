/**
 * 通义千问 (Qianwen) Provider Configuration
 */

import type { ProviderConfig, ThinkingAction } from '../core/types.js';
import { simulateRealClick } from '../core/dom-utils.js';

// 思考模式实现（深度思考）
const thinkingAction: ThinkingAction = {
  async getState() {
    // 查找关闭按钮，找到就说明已开启深度思考
    const closeBtn = document.querySelector('[data-log-params*="deepThink"] [data-icon-type="qwpcicon-close2"]');
    const container = document.querySelector('[data-log-params*="deepThink"]');
    if (!container) return { found: false, enabled: false };
    return { found: true, enabled: !!closeBtn };
  },

  async enable() {
    // 先检查是否已开启（有关闭按钮说明已开启）
    const closeBtn = document.querySelector('[data-log-params*="deepThink"] [data-icon-type="qwpcicon-close2"]');
    if (closeBtn) return true; // 已开启，无需操作

    // 未开启时点击容器开启深度思考
    const container = document.querySelector('[data-log-params*="deepThink"]');
    if (!container) return false;
    simulateRealClick(container);
    return true;
  },

  async disable() {
    // 点击关闭按钮来关闭深度思考
    const closeBtn = document.querySelector('[data-log-params*="deepThink"] [data-icon-type="qwpcicon-close2"]');
    if (!closeBtn) return false; // 未开启，无需关闭
    simulateRealClick(closeBtn);
    return true;
  },
};

export const qianwenProvider: ProviderConfig = {
  id: 'qianwen',
  name: '通义千问',
  domain: 'tongyi.aliyun.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-icon-type="qwpcicon-newDialogueMedium"]',
          '[data-icon-type="qwpcicon-newDialogue"]',
        ],
      },
      // 输入消息
      input: {
        box: [
          '#chat-input',
          'textarea[placeholder*="输入"]',
          '[contenteditable="true"]',
          '[data-slate-editor]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-icon-type="qwpcicon-sendChat"]'
        ],
      },
    },
    // 思考模式（深度思考）- 使用抽象接口
    thinking: thinkingAction,
  },
  // 会话 ID 提取配置
  // 通义千问 URL 格式：https://www.qianwen.com/chat/{conversationId}
  conversation: {
    idFromUrl: {
      pattern: '/chat/(.+)',
      captureGroup: 1,
    },
  },
  // 响应内容提取（DOM 轮询模式）
  response: {
    responseSelectors: [
      '.message-content .markdown-body',
      '.answer-content .markdown',
    ],
    thinkingSelectors: [
      '.thinking-content .markdown-body',
      '.reasoning-content .markdown',
    ],
  },
  // SSE 流式拦截配置
  sse: (() => {
    // 当前正在输出的 fragment 是否是思考内容
    let currentIsThink = false;

    return {
      urlPattern: '/qingtian/api/chat',
      detectionKeywords: ['data: {', '"id":', '"delta":', '"object":'],
      parseLine: (line: string) => {
        if (!line.startsWith('data: ')) return null;

        const json = line.substring(6).trim();
        if (!json || json === '[DONE]') {
          // 流结束，重置状态
          currentIsThink = false;
          return { text: '', isThink: null, done: true };
        }

        try {
          const d = JSON.parse(json);
          let text = '';
          let hasOutput = false;

          // 通义千问 SSE 格式类似 OpenAI
          // reasoning_content = 思考，content = 正式回答
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            const delta = d.choices[0].delta;

            if (delta.reasoning_content != null) {
              text = String(delta.reasoning_content);
              currentIsThink = true;
              hasOutput = text.length > 0;
            } else if (delta.content != null) {
              text = String(delta.content);
              currentIsThink = false;
              hasOutput = text.length > 0;
            } else if (delta.reasoning != null) {
              // 备选字段名
              text = String(delta.reasoning);
              currentIsThink = true;
              hasOutput = text.length > 0;
            }
          }

          // 通义千问自定义格式
          if (!hasOutput && typeof d.content === 'string') {
            text = d.content;
            hasOutput = text.length > 0;
            // 自定义格式默认是正式回答
            currentIsThink = false;
          }

          if (!hasOutput || !text) {
            return null;
          }

          return {
            text,
            isThink: currentIsThink,
            done: false,
          };
        } catch {
          return null;
        }
      },
    };
  })(),
};

export default qianwenProvider;
