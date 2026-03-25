/**
 * 豆包 (Doubao) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const doubaoProvider: ProviderConfig = {
  id: 'doubao',
  name: '豆包',
  domain: 'doubao.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-testid="create_conversation_button"]',
        ],
      },
      // 输入消息
      input: {
        box: [
          '[data-testid="chat_input_input"]'
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-testid="chat_input_send_button"]',
        ],
      },
    },
    // 思考模式
    thinking: {
      // 注意：data-testid="deep-thinking-action-button" 是一个 wrapper div，
      // 真正的触发器按钮在其内部，通过 closest 查找
      button: ['[data-testid="deep-thinking-action-button"]'],
      enabledState: { textContains: '思考' },
      toggle: {
        type: 'dropdown',
        wait: 800,
        // 触发器按钮选择器（从 wrapper 中找到真正的按钮）
        triggerButtonSelectors: [
          '[data-slot="dropdown-menu-trigger"]',
          'button[aria-haspopup="menu"]',
          'button',
        ],
        // 菜单项选择器（按优先级）
        menuItemSelectors: [
          '[data-testid*="deep-thinking-action-item"]',
          '[role="menuitem"]',
          '[data-slot="dropdown-menu-item"]',
        ],
        // 菜单项内部可点击元素选择器
        clickableItemSelectors: [
          '[role="menuitem"]',
          '[data-slot="dropdown-menu-item"]',
          'button',
        ],
        enableMatch: {
          texts: ['思考', '擅长解决更难的问题'],
          fallbackSelectors: ['[data-testid="deep-thinking-action-item-1"]'],
        },
        disableMatch: {
          texts: ['快速', '适用于大部分情况'],
          fallbackSelectors: ['[data-testid="deep-thinking-action-item-0"]'],
        },
      },
    },
    // 注意：豆包没有手动开关的联网搜索功能，搜索由系统自动判断是否需要联网
  },
  // 会话 ID 提取配置
  // 豆包 URL 格式：https://www.doubao.com/chat/{conversationId}
  conversation: {
    idFromUrl: {
      pattern: '/chat/(.+)',
      captureGroup: 1,
      // 排除临时 ID（local_ 开头）
      excludePattern: '^local_',
    },
  },
  // 响应内容提取（DOM 轮询模式）
  response: {
    responseSelectors: [
      '[data-testid="receive_message"] [data-testid="message_text_content"]',
    ],
    thinkingSelectors: [
      // 豆包的思考内容没有独立的 DOM 选择器，通过 SSE 流式拦截区分
    ],
  },
  // SSE 流式拦截配置
  sse: {
    urlPattern: '/chat/completion',
    detectionKeywords: [
      'event: CHUNK_DELTA',
      'event: STREAM_MSG_NOTIFY',
      'event: STREAM_CHUNK',
      'event: SSE_REPLY_END',
      '"alice/msg"',
    ],
    parseLine: (line: string) => {
      // 非 data 行由 injector 处理，这里只处理 data 行
      if (!line.startsWith('data: ')) {
        return null;
      }

      const json = line.substring(6).trim();
      if (!json || json === '[DONE]') {
        return { text: '', isThink: null, done: true };
      }

      try {
        const d = JSON.parse(json);

        // 处理 SSE_REPLY_END 结束信号
        if (d.event === 'SSE_REPLY_END' || d.end_type === 1) {
          return { text: '', isThink: null, done: true };
        }

        // 使用 JSON 中的 event 字段
        const event = d.event;

        // 处理 STREAM_MSG_NOTIFY - 首包通知
        if (event === 'STREAM_MSG_NOTIFY' || (d.content && d.content.content_block)) {
          const blocks = d.content?.content_block || [];
          if (Array.isArray(blocks)) {
            for (const block of blocks) {
              const isThinkBlock = block.block_type === 10040 || block.content?.thinking_block;
              const tb = block.content?.text_block?.text;
              if (tb) {
                return {
                  text: tb,
                  isThink: isThinkBlock || block.type === 'thinking' || block.is_thinking === true,
                  done: false,
                };
              }
            }
          }
          return null;
        }

        // 处理 CHUNK_DELTA - 纯文本增量
        if (event === 'CHUNK_DELTA') {
          const text = typeof d.text === 'string' ? d.text : (typeof d.thinking_text === 'string' ? d.thinking_text : '');
          if (text) {
            return {
              text,
              isThink: d.type === 'thinking' || d.is_thinking === true || !!d.thinking_text,
              done: false,
            };
          }
          return null;
        }

        // 处理 STREAM_CHUNK - 增量 patch
        if (event === 'STREAM_CHUNK' || (d.patch_op && Array.isArray(d.patch_op))) {
          const ops = d.patch_op || [];
          for (const op of ops) {
            if (op.patch_object === 1 && op.patch_value?.content_block) {
              const cbs = op.patch_value.content_block;
              for (const cb of cbs) {
                // 检测思考完成标记
                if (cb.is_finish && cb.content?.thinking_block?.finish_title?.startsWith('已完成思考')) {
                  continue;
                }
                if (cb.is_finish && !cb.content?.text_block?.text) continue;

                const txt = cb.content?.text_block?.text;
                if (txt) {
                  const isThinkBlock = cb.block_type === 10040 || cb.content?.thinking_block;
                  return {
                    text: txt,
                    isThink: isThinkBlock || cb.type === 'thinking' || cb.is_thinking === true,
                    done: false,
                  };
                }
              }
            }
          }
          return null;
        }

        // Fallback: 通用模式匹配
        let text = '';
        let isThink = false;

        if (d.choices?.[0]?.delta?.content != null) {
          text = String(d.choices[0].delta.content);
        } else if (typeof d.thinking_text === 'string') {
          text = d.thinking_text;
          isThink = true;
        } else if (typeof d.text === 'string') {
          text = d.text;
        } else if (typeof d.content === 'string') {
          text = d.content;
        }

        if (text) {
          return {
            text,
            isThink: isThink || d.type === 'thinking' || d.is_thinking === true,
            done: false,
          };
        }

        return null;
      } catch {
        return null;
      }
    },
  },
};

export default doubaoProvider;
