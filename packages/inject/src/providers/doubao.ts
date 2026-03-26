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
  sse: (() => {
    // 状态标记：是否已经开始输出正式回答，一旦出现 111/tts_content，后续只处理 111
    let hasStartedFormalAnswer = false;
    return {
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
          // 结束时重置状态
          hasStartedFormalAnswer = false;
          return { text: '', isThink: null, done: true };
        }

        try {
          const d = JSON.parse(json);

          // 处理 SSE_REPLY_END 结束信号
          if (d.event === 'SSE_REPLY_END' || d.end_type === 1) {
            // 结束时重置状态
            hasStartedFormalAnswer = false;
            return { text: '', isThink: null, done: true };
          }

          // 规则一：优先检查 STREAM_CHUNK 中的 patch_op
          // 只有 patch_object = 111 的 tts_content 才是正式输出，其他所有内容都算作思考
          const ops = d.patch_op || [];
          if (Array.isArray(ops)) {
            // 第一轮：先找有没有 111/tts_content
            let formalText: string | undefined;
            for (const op of ops) {
              if (op.patch_object === 111 && typeof op.patch_value?.tts_content === 'string') {
                formalText = op.patch_value.tts_content;
                break;
              }
            }
            // 找到正式内容，标记状态开始，直接返回
            if (formalText) {
              hasStartedFormalAnswer = true;
              if (formalText) {
                return {
                  text: formalText,
                  isThink: false, // tts_content = 正式输出
                  done: false,
                };
              }
            }

            // 如果已经开始正式回答了，后面只处理 111，忽略其他内容
            if (hasStartedFormalAnswer) {
              return null;
            }

            // 还没开始正式回答，遍历找任何文本都算作思考
            for (const op of ops) {
              let txt: string | undefined;
              if (op.patch_value?.content_block && Array.isArray(op.patch_value.content_block)) {
                const cbs = op.patch_value.content_block;
                for (const cb of cbs) {
                  if (cb.content?.text_block?.text) {
                    txt = cb.content.text_block.text;
                    break;
                  }
                  if (cb.content?.thinking_block?.text) {
                    txt = cb.content.thinking_block.text;
                    break;
                  }
                }
              }
              if (!txt && typeof op.patch_value?.tts_content === 'string') {
                txt = op.patch_value.tts_content;
              }
              if (!txt && typeof op.patch_value === 'string') {
                txt = op.patch_value;
              }
              if (txt) {
                return {
                  text: txt,
                  isThink: true, // 非 111 = 思考内容（搜索/思维链等）
                  done: false,
                };
              }
            }
          }

          // 已经开始正式回答了，不处理其他格式
          if (hasStartedFormalAnswer) {
            return null;
          }

          // 检查 CHUNK_DELTA / STREAM_MSG_NOTIFY 等其他格式，任何文本都算作思考
          let text: string | undefined;
          if (typeof d.text === 'string') text = d.text;
          else if (typeof d.thinking_text === 'string') text = d.thinking_text;
          else if (typeof d.content === 'string') text = d.content;
          else if (d.choices?.[0]?.delta?.content != null) text = String(d.choices[0].delta.content);

          if (text) {
            return {
              text,
              isThink: true, // 不是来自 111/tts_content = 全部算作思考
              done: false,
            };
          }

          return null;
        } catch {
          // 出错重置状态
          hasStartedFormalAnswer = false;
          return null;
        }
      },
    };
  })(),
};

export default doubaoProvider;
