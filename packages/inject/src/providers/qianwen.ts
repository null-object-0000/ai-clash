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
  domain: 'qianwen.com',  // 支持 www.qianwen.com / chat2.qianwen.com
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
    // 跟踪完整内容状态（千问每次发送完整内容，需要提取增量）
    let lastFullContent = '';
    let lastFullThinking = '';
    let currentEvent = '';

    // 从后往前找第一个有直接 string content 的消息
    function findContentMessage(messages: any[]) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg && typeof msg.content === 'string') {
          return msg;
        }
      }
      return null;
    }

    // 根据消息类型判断是否是思考内容
    function isThinkingMessage(msg: any) {
      if (!msg) return false;

      // 千问新格式：multi_load/iframe 如果 content 已经包含 [(deep_think)] 开头
      // 说明整个 content 就是最终输出（已经包含思考块），直接当作回答
      if (msg.mime_type === 'multi_load/iframe') {
        // 如果 content 已经打包好 [(deep_think)]，直接输出为回答
        if (typeof msg.content === 'string' && msg.content.includes('[(deep_think)]')) {
          return false;
        }
        // 纯思考块：meta 有 deep_think 且 content 只是占位/空
        if (msg.meta_data && Array.isArray(msg.meta_data.multi_load)) {
          for (const item of msg.meta_data.multi_load) {
            if (item && item.type && item.type.includes('deep_think')) {
              // 只有当 content 为空或只是 [(deep_think)] 标记时才判定为思考
              if (!msg.content || msg.content === '[(deep_think)]') {
                return true;
              }
            }
          }
        }
        // 其他情况 multi_load/iframe 都是回答
        return false;
      }

      // bar/progress + type=deep_thinking / deep_thought 是思考进度
      if (msg.mime_type === 'bar/progress') {
        if (msg.meta_data?.type === 'deep_thinking' || msg.meta_data?.type === 'deep_thought') {
          return true;
        }
        return false;
      }

      return false;
    }

    return {
      urlPattern: '/api/v2/chat',
      detectionKeywords: ['data:{"error_msg":', '"error_code":', '"messages":'],
      parseLine: (line: string) => {
        // trim 整行，处理换行空格问题
        line = line.trim();
        if (!line) return null;

        // 处理 event 行（跟踪事件类型）
        if (line.startsWith('event:')) {
          const eventVal = line.substring(6).trim();
          currentEvent = eventVal;
          // event:complete 表示整个响应结束
          if (currentEvent === 'complete') {
            const result = { text: '', isThink: null, done: true };
            // 重置状态
            lastFullContent = '';
            lastFullThinking = '';
            currentEvent = '';
            return result;
          }
          return null;
        }

        if (!line.startsWith('data:')) return null;

        const json = line.substring(5).trim();
        if (!json || json === '[DONE]') {
          lastFullContent = '';
          lastFullThinking = '';
          return { text: '', isThink: null, done: true };
        }

        try {
          const d = JSON.parse(json);

          // 检查错误码
          if (d.error_code !== 0) {
            return null;
          }

          let msgArr: any[] | null = null;
          if (d.data && Array.isArray(d.data.messages)) {
            msgArr = d.data.messages;
          } else if (Array.isArray(d.messages)) {
            msgArr = d.messages;
          }

          if (!msgArr) {
            // 回退到 OpenAI 格式
            if (d.choices && d.choices[0] && d.choices[0].delta) {
              const delta = d.choices[0].delta;
              if (delta.reasoning_content != null) {
                return {
                  text: String(delta.reasoning_content),
                  isThink: true,
                  done: false,
                };
              } else if (delta.content != null) {
                return {
                  text: String(delta.content),
                  isThink: false,
                  done: false,
                };
              }
            }
            return null;
          }

          // 千问 v2 格式处理 - 分离思考和回答
          let thinkingDelta = '';
          let answerDelta = '';

          // 收集所有有 content 的消息
          const allWithContent = msgArr.filter(msg => typeof msg.content === 'string');

          // 查找思考内容 - 所有思考消息中最后一个
          const thinkingMsgs = allWithContent.filter(isThinkingMessage);
          if (thinkingMsgs.length > 0) {
            const thinkingMsg = thinkingMsgs[thinkingMsgs.length - 1];
            if (thinkingMsg.status === 'processing') {
              const fullContent = thinkingMsg.content;
              if (fullContent.length > lastFullThinking.length) {
                thinkingDelta = fullContent.substring(lastFullThinking.length);
                lastFullThinking = fullContent;
              }
            }
          }

          // 查找回答内容 - 所有非思考消息中最后一个
          const answerMsgs = allWithContent.filter(msg => !isThinkingMessage(msg));
          if (answerMsgs.length > 0) {
            const answerMsg = answerMsgs[answerMsgs.length - 1];
            if (answerMsg.status === 'processing' || !answerMsg.status) {
              const fullContent = answerMsg.content;
              if (fullContent.length > lastFullContent.length) {
                answerDelta = fullContent.substring(lastFullContent.length);
                lastFullContent = fullContent;
              }
            }
          }

          // 优先返回思考增量，如果没有思考增量返回回答增量
          if (thinkingDelta && thinkingDelta.length > 0) {
            return {
              text: thinkingDelta,
              isThink: true,
              done: false,
            };
          } else if (answerDelta && answerDelta.length > 0) {
            return {
              text: answerDelta,
              isThink: false,
              done: false,
            };
          }

          // 没有增量，返回 null
          return null;
        } catch (e) {
          return null;
        }
      },
    };
  })(),
};

export default qianwenProvider;
