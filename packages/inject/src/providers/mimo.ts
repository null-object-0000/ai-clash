/**
 * 小米 MiMo (Xiaomi MiMo) Provider Configuration
 *
 * 官方网址：https://aistudio.xiaomimimo.com/#/c
 * 强制前置登录拦截：是
 */

import type { ProviderConfig, ToggleAction, AuthAction } from '../core/types.js';

// Auth 登录信息配置
const authAction: AuthAction = {
  loggedInSelectors: [
    '.bg-mimo-bg-body .pr-2.pl-2 .items-center button img',
  ],
  usernameSelectors: [
    '.bg-mimo-bg-body .pr-2.pl-2 .items-center button span.text-sm',
  ],
  avatarSelectors: [
    '.bg-mimo-bg-body .pr-2.pl-2 .items-center button img',
  ],
};

// 小米 MiMo 发送按钮的 SVG Path 特征
const MIMO_SEND_BUTTON_PATH = 'M.244 7.921 18.202.03c.254-.111.528.115.452.373L14.51 14.345a.33.33 0 0 1-.448.201l-4.337-1.852a.333.333 0 0 0-.44.178l-1.14 2.923c-.117.298-.565.262-.63-.049l-.851-4.089a.31.31 0 0 1 .09-.285l6.707-6.448c.061-.059-.025-.15-.092-.098L5.396 10.25a.99.99 0 0 1-.92.099L.244 8.65a.395.395 0 0 1 0-.73';

/**
 * 验证按钮是否包含 MiMo 特征的 SVG Path
 */
function isMimoSendButton(button: Element): boolean {
  const path = button.querySelector('path');
  if (!path) return false;
  const d = path.getAttribute('d');
  if (!d) return false;

  // 比对 Path 数据是否匹配
  return d.includes(MIMO_SEND_BUTTON_PATH.substring(0, 50));
}

/**
 * 查找 MiMo 发送按钮（需要验证 SVG Path）
 */
function findMimoSendButton(): Element | null {
  // 先找到所有候选按钮
  const candidates = document.querySelectorAll('.dialogue-container button');

  // 逐一验证 SVG Path
  for (const candidate of Array.from(candidates)) {
    if (isMimoSendButton(candidate)) {
      return candidate;
    }
  }

  return null;
}

export const xiaomiProvider: ProviderConfig = {
  id: 'xiaomi',
  name: '小米 MiMo',
  domain: 'aistudio.xiaomimimo.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          'button[aria-label="新对话"]',
        ],
      },
      // 输入消息
      input: {
        box: [
          '.dialogue-container textarea',
        ],
      },
      // 发送消息 - 需要特殊验证 SVG Path
      send: {
        button: [
          '.dialogue-container button',
        ],
        // 自定义查找方法，验证 SVG Path
        customFind: findMimoSendButton,
      },
    },
    // 登录信息检测
    auth: authAction,
  },
  // 会话 ID 提取配置
  // MiMo URL 格式：https://aistudio.xiaomimimo.com/#/chat/{sessionId}
  conversation: {
    idFromUrl: {
      pattern: '#/chat/([^/?]+)',
      captureGroup: 1,
    },
  },
  // SSE 流式拦截配置
  sse: (() => {
    let currentIsThink = false;

    return {
      urlPattern: '/open-apis/bot/chat',
      detectionKeywords: ['event:message', 'event:finish', '"content":'],
      parseLine: (line: string) => {
        line = line.trim();

        // 忽略空行和非 data: 行
        if (!line || !line.startsWith('data:')) {
          return null;
        }

        const jsonStr = line.substring(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') return null;

        try {
          const data = JSON.parse(jsonStr);

          // MiMo SSE 数据结构解析
          // event:message 时 data 格式：{"type":"text","content":"文本"}
          // event:finish 时 data 格式：{"content":"[DONE]"}

          // 严格检查：只有 type="text" 的才是消息内容
          if (data.type !== 'text' && data.content !== '[DONE]') {
            return null;
          }

          // 检查是否结束
          if (data.content === '[DONE]') {
            currentIsThink = false;
            return { text: '', isThink: null, done: true };
          }

          let text = '';
          let isThink = false;

          // 提取内容
          if (typeof data.content === 'string') {
            text = data.content;
          }

          // 判断内容类型 - MiMo 使用 \u0000 分隔思考和正式内容
          // 思考内容在 <think> 和</think> 标签之间
          if (text.includes('<think>')) {
            currentIsThink = true;
            isThink = true;
            // 提取 <think> 后的内容
            const thinkStart = text.indexOf('<think>') + 7;
            const thinkEnd = text.includes('</think>') ? text.indexOf('</think>') : text.length;
            text = text.substring(thinkStart, thinkEnd);
          } else if (text.includes('</think>')) {
            // 思考结束标记
            currentIsThink = false;
            const afterThink = text.substring(text.indexOf('</think>') + 8);
            text = afterThink.trim();
            if (!text) return null;
          } else {
            // 正式内容
            isThink = currentIsThink;
          }

          // 去除内容中的 \u0000 字符（MiMo 特有）
          text = text.replace(/\u0000/g, '');

          if (!text) return null;

          return {
            text,
            isThink,
            done: false,
          };
        } catch {
          return null;
        }
      },
    };
  })(),
};

export default xiaomiProvider;
