/**
 * 豆包 (Doubao) Provider Configuration
 */

import type { ProviderConfig, ToggleAction, AuthAction } from '../core/types.js';
import { findAnyElement, simulateRealClick } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ToggleAction = {
  async getState() {
    // 通过 .items-center 文本判断："思考" = 已开启，"快速" = 未开启
    const el = document.querySelector('[data-testid="mode-select-action-button"] .items-center');
    if (!el) return { found: false, enabled: false };
    const text = el.textContent?.trim() || '';
    return { found: true, enabled: text.includes('思考') && !text.includes('快速') };
  },

  async enable() {
    const selectors = ['[data-testid="mode-select-action-button"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;

    // 点击触发器按钮展开菜单
    const triggerBtn = el.querySelector('[data-slot="dropdown-menu-trigger"]') || el.querySelector('button');
    if (!triggerBtn) return false;
    simulateRealClick(triggerBtn);

    // 等待菜单展开
    await new Promise(resolve => setTimeout(resolve, 300));

    // 查找包含"思考"文本的菜单项并点击
    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [data-slot="dropdown-menu-item"]'));
    const targetItem = menuItems.find(item => item.textContent?.includes('思考'));
    if (targetItem) {
      simulateRealClick(targetItem);
      return true;
    }

    return false;
  },

  async disable() {
    const selectors = ['[data-testid="mode-select-action-button"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;

    // 点击触发器按钮展开菜单
    const triggerBtn = el.querySelector('[data-slot="dropdown-menu-trigger"]') || el.querySelector('button');
    if (!triggerBtn) return false;
    simulateRealClick(triggerBtn);

    // 等待菜单展开
    await new Promise(resolve => setTimeout(resolve, 300));

    // 查找包含"快速"文本的菜单项并点击（关闭思考模式）
    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [data-slot="dropdown-menu-item"]'));
    const targetItem = menuItems.find(item => item.textContent?.includes('快速'));
    if (targetItem) {
      simulateRealClick(targetItem);
      return true;
    }

    return false;
  },
};

// Auth 登录信息配置
const authAction: AuthAction = {
  loggedInSelectors: [
    '#flow_chat_sidebar [data-testid="chat_header_avatar_button"]',
    '#flow_chat_sidebar [data-slot="dropdown-menu-trigger"] .text-dbx-text-primary',
  ],
  usernameSelectors: [
    '#flow_chat_sidebar [data-slot="dropdown-menu-trigger"] .text-dbx-text-primary',
  ],
  avatarSelectors: [
    '#flow_chat_sidebar [data-testid="chat_header_avatar_button"]',
  ],
};

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
    // 思考模式 - 使用抽象接口
    thinking: thinkingAction,
    // 登录信息检测
    auth: authAction,
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
