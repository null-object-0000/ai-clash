/**
 * 腾讯元宝 (Yuanbao) Provider Configuration
 */

import type { ProviderConfig, ToggleAction, AuthAction } from '../core/types.js';
import { IncrementalHelper } from '../core/incremental-utils.js';
import { findAnyElement, simulateRealClick } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ToggleAction = {
  async getState() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    const hasSelectedClass = Array.from(el.classList).some(c => c.startsWith('ThinkSelector_selected__'));
    return { found: true, enabled: hasSelectedClass };
  },

  async enable() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

// Auth 登录信息配置
const authAction: AuthAction = {
  loggedInSelectors: [
    '.yb-nav__footer .nick-info-container .nick-info-name',
    '.yb-nav__footer .image-container img',
  ],
  usernameSelectors: [
    '.yb-nav__footer .nick-info-container .nick-info-name',
  ],
  avatarSelectors: [
    '.yb-nav__footer .image-container img',
  ],
};

export const yuanbaoProvider: ProviderConfig = {
  id: 'yuanbao',
  name: '腾讯元宝',
  domain: 'yuanbao.tencent.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-desc="new-chat"]'
        ],
      },
      // 输入消息
      input: {
        box: [
          '.chat-input-editor [contenteditable="true"]'
        ],
      },
      // 发送消息
      send: {
        button: [
          '#yuanbao-send-btn',
        ],
      },
    },
    // 思考模式 - 使用抽象接口
    thinking: thinkingAction,
    // 登录信息检测
    auth: authAction,
  },
  // 会话 ID 提取配置
  conversation: {
    // 从 URL 提取会话 ID
    // Yuanbao URL 格式：https://yuanbao.tencent.com/chat/{category}/{conversationId}
    idFromUrl: {
      pattern: '/chat/[^/]+/([^/]+)',
      captureGroup: 1,
    },
  },
  // SSE 流式拦截配置
  // 腾讯元宝新版 SSE 格式：
  // - event: speech_type + data: {"type":"think","content":"...","status":1} 思考内容增量
  // - event: speech_type + data: {"type":"think","content":"...","status":2} 思考完成
  // - event: speech_type + data: {"type":"text","msg":"..."} 正式回答内容增量
  // - data: [DONE] 流结束
  //
  // 注意：元宝每一行的 content/msg 已经是增量内容，直接返回即可，不需要增量计算
  sse: (() => {
    let thinkingDone = false;
    return {
      urlPattern: '/api/chat/',
      detectionKeywords: ['data: {"type":', 'event: speech_type', 'data: [DONE]'],
      parseLine: (line: string) => {
        line = line.trim();
        if (!line) return null;

        // 处理结束标记
        if (line === 'data: [DONE]' || line === '[DONE]') {
          thinkingDone = false;
          return { text: '', isThink: null, done: true };
        }

        // 跳过 event 行
        if (line.startsWith('event:')) {
          return null;
        }

        // 移除 data: 前缀
        if (line.startsWith('data: ')) {
          line = line.substring(6).trim();
        }

        // 跳过非 JSON 行（如 traceId 注释）
        if (!line.startsWith('{')) {
          return null;
        }

        try {
          const d = JSON.parse(line);

          // 思考内容 - type: think
          // d.content 已经是增量，d.status = 2 表示思考完成
          if (d.type === 'think' && typeof d.content === 'string' && d.content) {
            thinkingDone = d.status === 2;
            return {
              text: d.content,
              isThink: true,
              done: thinkingDone,
            };
          }

          // 搜索思考内容 - type: deepSearch
          // 内容在 contents[].msg 中
          if (d.type === 'deepSearch' && Array.isArray(d.contents)) {
            let text = '';
            let hasOutput = false;
            for (const item of d.contents) {
              if (item && typeof item.msg === 'string' && item.msg) {
                text += item.msg;
                hasOutput = true;
              }
            }
            if (hasOutput && text) {
              thinkingDone = d.status === 2;
              return {
                text,
                isThink: true,
                done: thinkingDone,
              };
            }
          }

          // 正式回答内容 - type: text
          // d.msg 已经是增量，直接返回
          if (d.type === 'text' && typeof d.msg === 'string' && d.msg) {
            // 对于回答内容，done 留到 [DONE] 处理
            return {
              text: d.msg,
              isThink: false,
              done: false,
            };
          }

          // meta 数据行，不包含内容
          if (d.type === 'meta') {
            return null;
          }

          return null;
        } catch {
          return null;
        }
      },
    };
  })(),
};

export default yuanbaoProvider;
