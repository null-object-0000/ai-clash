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
    // DeepSeek URL 格式：https://chat.deepseek.com/a/chat/s/{conversationId}
    idFromUrl: {
      pattern: '/a/chat/s/([^/]+)',
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
  // 使用闭包维护当前 fragment 类型状态，因为增量追加需要保持当前类型
  sse: (() => {
    // 当前正在输出的 fragment 是否是思考内容
    let currentIsThink = false;

    return {
      urlPattern: '/api/v0/chat/completion',
      detectionKeywords: ['event: ready', 'data: {"v"', 'data: {"p"', 'response_message_id', 'event: close'],
      parseLine: (line: string) => {
        if (line === 'event: close') {
          // 流结束，重置状态
          currentIsThink = false;
          return { text: '', isThink: null, done: true };
        }
        if (!line.startsWith('data: ')) return null;

        const json = line.substring(6).trim();
        if (!json || json === '[DONE]') return null;

        try {
          const d = JSON.parse(json);
          let text = '';
          let hasOutput = false;

          // 过滤状态消息 - 流完成
          if (d.p === 'response/status' && d.o === 'SET' && d.v === 'FINISHED') {
            currentIsThink = false;
            return { text: '', isThink: null, done: true };
          }

          // DeepSeek SSE 协议解析
          // 四种 fragment 类型: SEARCH (搜索中), THINK (深度思考), RESPONSE (最终回答)
          // SEARCH 类型不输出给用户，只显示过程

          // 案例 1: 完整初始化推送 {"v": {"response": {"fragments": [...]}}}
          if (d.v?.response?.fragments) {
            for (const fr of d.v.response.fragments) {
              if (fr.content && fr.type !== 'SEARCH') {
                text += fr.content;
                currentIsThink = fr.type === 'THINK';
                hasOutput = true;
              }
            }
          }

          // 案例 2: BATCH 操作，批量追加 fragments
          // {"p": "response", "o": "BATCH", "v": [{p: "fragments", o: "APPEND", v: [...]}]}
          if (d.p === 'response' && d.o === 'BATCH' && Array.isArray(d.v)) {
            for (const batchOp of d.v) {
              if (batchOp.p === 'fragments' && batchOp.o === 'APPEND' && Array.isArray(batchOp.v)) {
                for (const fr of batchOp.v) {
                  if (fr.content && fr.type !== 'SEARCH') {
                    text += fr.content;
                    currentIsThink = fr.type === 'THINK';
                    hasOutput = true;
                  }
                }
              }
            }
          }

          // 案例 3: 直接向最后一个 fragment 追加内容
          // {"p": "response/fragments/-1/content", "o": "APPEND", "v": "文字"}
          if (d.p === 'response/fragments/-1/content' && d.v != null) {
            text = typeof d.v === 'string' ? d.v : String(d.v);
            hasOutput = text.length > 0;
            // 增量追加，保持当前 currentIsThink 状态不变
          }

          // 案例 4: 顶级直接字符串推送 {"v": "文字"}
          // 这实际上是增量追加到当前 fragment，保持原有类型
          if (typeof d.v === 'string' && !d.p && !text) {
            text = d.v;
            hasOutput = text.length > 0;
            // 增量追加，保持当前 currentIsThink 状态不变
          }

          // 案例 5: 多 fragments 直接推送 {"p": "response/fragments", "o": "APPEND", "v": [...]}
          if (d.p === 'response/fragments' && d.o === 'APPEND' && Array.isArray(d.v)) {
            for (const fr of d.v) {
              if (fr.content && fr.type !== 'SEARCH') {
                text += fr.content;
                currentIsThink = fr.type === 'THINK';
                hasOutput = true;
              }
            }
          }

          // API 模式格式兼容
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            if (d.choices[0].delta.reasoning_content != null) {
              text = String(d.choices[0].delta.reasoning_content);
              currentIsThink = true;
              hasOutput = true;
            } else if (d.choices[0].delta.content != null) {
              text = String(d.choices[0].delta.content);
              currentIsThink = false;
              hasOutput = true;
            }
          }

          // 忽略搜索结果更新，这些不需要输出
          if (d.p === 'response/fragments/-1/results') {
            return null;
          }

          // 忽略状态更新
          if (d.p === 'response/fragments/-1/status' || d.p === 'response/conversation_mode' || d.p === 'response/has_pending_fragment' || d.p === 'response/fragments/-1/elapsed_secs') {
            return null;
          }

          // 忽略 TIP 类型（底部提示）
          if (d.p === 'response/fragments' && Array.isArray(d.v) && (d.v as Array<{type?: string}>).every(fr => fr.type === 'TIP')) {
            return null;
          }

          if (!hasOutput || !text) {
            return null;
          }

          // 每一行都返回明确的 isThink 值
          return {
            text,
            isThink: currentIsThink,
            done: false
          };
        } catch {
          return null;
        }
      },
    };
  })(),
};

export default deepseekProvider;
