/**
 * 百度文心一言 (Wenxin) Provider Configuration
 */

import type { ProviderConfig, AuthAction } from '../core/types.js';

const authAction: AuthAction = {
  loggedInSelectors: [
    '.avatar__* img'
  ],
  usernameSelectors: [
    '.avatar__* p'
  ],
  avatarSelectors: [
    '.avatar__* img'
  ],
};

export const wenxinProvider: ProviderConfig = {
  id: 'wenxin',
  name: '文心一言',
  domain: 'yiyan.baidu.com',
  actions: {
    chat: {
      newChat: {
        button: [
          '.sidebarNewSession__*'
        ],
      },
      input: {
        box: [
          '.editorContainer__* div[contenteditable="true"].editable__*'
        ],
      },
      send: {
        button: [
          '.send__* .btnContainer__* span'
        ],
      },
    },
    auth: authAction,
  },
  conversation: {
    // 例如：https://yiyan.baidu.com/chat/[conversationId]
    idFromUrl: {
      pattern: '/chat/([^/]+)',
      captureGroup: 1,
    },
  },
  sse: (() => {
    /**
     * 文心一言 SSE 数据结构（标准 SSE 协议，event:/data:/id: 各占一行）：
     *
     *   event:thought  → data = { thoughts, is_end, ... }
     *                    thoughts 是增量思考文本
     *
     *   event:message  → data = { code, msg, data: { content, is_end, ... } }
     *                    data.data.content 是增量正文文本
     *                    data.data.is_end === 1 表示整个流结束
     *
     * ⚠️ 注意：injector.ts 的 parseSSELine 会把 event: 行过滤掉，根本不会传给 parseLine。
     *    因此我们无法依赖 event: 行来追踪状态。
     *    改为直接通过 JSON 字段结构区分 thought 和 message：
     *      - thought data 含 "thoughts" 字段（字符串）
     *      - message data 含 "code" 字段 + 嵌套的 "data.content"
     *      - 其他初始化 data（major/state 等）含 "data.createChatResponseVoCommonResult" 或
     *        "memory" 字段，直接忽略
     */
    return {
      // 匹配文心一言的流式对话接口
      urlPattern: '/eb/chat/conversation',
      // 检测关键词，用于判断是否为目标响应
      detectionKeywords: ['event:thought', 'event:message'],

      parseLine: (line: string) => {
        // 去掉 Windows CRLF 的 \r
        line = line.replace(/\r$/, '');

        if (!line) return null;

        // injector.ts 已将 event: / id: 行过滤，这里只处理 data: 行
        if (!line.startsWith('data:')) {
          return null;
        }

        const jsonStr = line.substring(5).trim();
        if (!jsonStr || !jsonStr.startsWith('{')) {
          return null;
        }

        try {
          const parsed = JSON.parse(jsonStr);

          // ── 识别 event:thought 数据 ──
          // 结构: { send_id, thought_index, chat_id, step_id, thoughts, is_end }
          // 特征字段：thoughts（字符串）+ thought_index
          if (typeof parsed.thoughts === 'string' && 'thought_index' in parsed) {
            const thoughts = parsed.thoughts;
            if (thoughts.length > 0) {
              return {
                text: thoughts,
                isThink: true,
                done: false,
              };
            }
            return null;
          }

          // ── 识别 event:message 数据 ──
          // 结构: { code, msg, data: { content, is_end, ... } }
          // 特征字段：code（数字）+ msg（字符串）+ data（对象）
          if (typeof parsed.code === 'number' && parsed.data && typeof parsed.data === 'object') {
            const data = parsed.data;

            // is_end === 1 表示整个流结束
            if (data.is_end === 1) {
              return { text: '', isThink: false, done: true };
            }

            const content = data.content;
            if (typeof content === 'string' && content.length > 0) {
              return {
                text: content,
                isThink: false,
                done: false,
              };
            }

            return null;
          }

          // 其他结构（major / state / renameSession 等）忽略
          return null;
        } catch {
          return null;
        }
      },
    };
  })(),
};

export default wenxinProvider;
