/**
 * DeepSeek Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const deepseekProvider: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  domain: 'chat.deepseek.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '.ds-icon:has(path[d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8C0.599609 9.13376 0.855461 10.2098 1.3125 11.1719L1.5918 11.7588L2.76562 11.2012L2.48633 10.6143C2.11034 9.82278 1.90039 8.93675 1.90039 8C1.90039 4.63106 4.63106 1.90039 8 1.90039C11.3689 1.90039 14.0996 4.63106 14.0996 8C14.0996 11.3689 11.3689 14.0996 8 14.0996C7.31041 14.0996 6.80528 14.0514 6.35742 13.9277C5.91623 13.8059 5.49768 13.6021 4.99707 13.2529C4.26492 12.7422 3.21611 12.5616 2.35156 13.1074L2.33789 13.1162L2.32422 13.126L1.58789 13.6436L2.01953 14.9297L3.0459 14.207C3.36351 14.0065 3.83838 14.0294 4.25293 14.3184C4.84547 14.7317 5.39743 15.011 6.01172 15.1807C6.61947 15.3485 7.25549 15.4004 8 15.4004C12.0869 15.4004 15.4004 12.0869 15.4004 8C15.4004 3.91309 12.0869 0.599609 8 0.599609ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473V11.0605H8.64551V8.65039H11.0605V7.34961H8.64551V4.93945H7.34473Z"])',
        ],
      },
      // 输入消息
      input: {
        box: [
          'textarea[placeholder*="DeepSeek"]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[role="button"]:has(path[d="M8.3125 0.981587C8.66767 1.0545 8.97902 1.20558 9.2627 1.43374C9.48724 1.61438 9.73029 1.85933 9.97949 2.10854L14.707 6.83608L13.293 8.25014L9 3.95717V15.0431H7V3.95717L2.70703 8.25014L1.29297 6.83608L6.02051 2.10854C6.26971 1.85933 6.51277 1.61438 6.7373 1.43374C6.97662 1.24126 7.28445 1.04542 7.6875 0.981587C7.8973 0.94841 8.1031 0.956564 8.3125 0.981587Z"])',
        ],
      },
    },
    // 思考模式
    thinking: {
      button: ['.ds-toggle-button[role="button"] >> 深度思考'],
      enabledState: { hasClass: 'ds-toggle-button--selected' },
      toggle: { type: 'click', wait: 300 },
    },
    // 智能搜索
    search: {
      button: ['.ds-toggle-button[role="button"] >> 智能搜索'],
      enabledState: { hasClass: 'ds-toggle-button--selected' },
      toggle: { type: 'click', wait: 300 },
    },
  },
  // 会话 ID 提取配置
  conversation: {
    // 从 URL 提取会话 ID
    // DeepSeek URL 格式：https://chat.deepseek.com/c/{conversationId}
    idFromUrl: {
      pattern: '/c/([^/]+)',
      captureGroup: 1,
    },
  },
  // 响应内容提取（DOM 轮询模式）
  response: {
    responseSelectors: [
      '.ds-message .ds-markdown'
    ],
    thinkingSelectors: [
      '.ds-think-content .ds-markdown'
    ],
  },
  // SSE 流式拦截配置
  sse: {
    urlPattern: '/api/v0/chat/completion',
    detectionKeywords: ['event: ready', 'data: {"v"', 'data: {"p"', 'response_message_id', 'event: close'],
    parseLine: (line: string) => {
      if (line === 'event: close') {
        return { text: '', isThink: null, done: true };
      }
      if (!line.startsWith('data: ')) return null;

      const json = line.substring(6).trim();
      if (!json || json === '[DONE]') return null;

      try {
        const d = JSON.parse(json);
        let text = '';
        let isThink = false;

        // 过滤状态消息
        if (d.p === 'response/status' && d.v === 'FINISHED') {
          return { text: '', isThink: null, done: true };
        }

        if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content != null) {
          text = String(d.choices[0].delta.content);
        } else if (d.p === 'response/fragments' && d.o === 'APPEND' && Array.isArray(d.v)) {
          const f = d.v[0];
          text = f && f.content ? f.content : (typeof f === 'string' ? f : '');
          isThink = (f && f.type === 'THINK');
        } else if (d.p === 'response/fragments/-1/content' && d.v != null) {
          text = typeof d.v === 'string' ? d.v : String(d.v);
          // 保持上一次的思考状态，DeepSeek 这里不需要改变
        } else if (d.v && d.v.response && d.v.response.fragments && d.v.response.fragments.length) {
          const fr = d.v.response.fragments[0];
          text = fr && fr.content ? fr.content : '';
          isThink = (fr && fr.type === 'THINK');
        } else if (typeof d.v === 'string') {
          text = String(d.v);
        }

        return { text, isThink, done: false };
      } catch {
        return null;
      }
    },
  },
};

export default deepseekProvider;
