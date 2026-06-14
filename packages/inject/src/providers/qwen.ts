/**
 * Qwen International Provider Configuration
 */

import type { ProviderConfig, ToggleAction } from '../core/types.js';
import { simulateRealClick, wait } from '../core/dom-utils.js';

const thinkingSelectSelectors = [
  '.qwen-thinking-selector .ant-select-selector',
  '.qwen-select-thinking .ant-select-selector',
  '.qwen-thinking-selector .ant-select',
];

function getThinkingSelect() {
  return thinkingSelectSelectors
    .map(selector => document.querySelector(selector))
    .find(Boolean) || null;
}

function getThinkingLabel() {
  return document.querySelector('.qwen-thinking-selector .qwen-select-thinking-label-text')?.textContent?.trim() || '';
}

function isThinkingLabel(text: string) {
  const normalized = normalizeOptionText(text);
  if (!normalized) return false;
  if (normalized.includes('自动')
    || normalized.includes('快速')
    || normalized.includes('auto')
    || normalized.includes('fast')) {
    return false;
  }
  return text.includes('思考') || normalized.includes('thinking');
}

function normalizeOptionText(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisibleElement(element: Element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && rect.width > 0
    && rect.height > 0;
}

function findVisibleThinkingOption(enable: boolean): Element | null {
  const options = Array.from(document.querySelectorAll(
    [
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)',
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) [role="option"]',
    ].join(', '),
  )).filter(isVisibleElement);

  return options.find((option) => {
    const text = option.textContent?.trim() || '';
    if (!text) return false;
    const normalized = normalizeOptionText(text);

    if (enable) {
      return normalized === '思考'
        || normalized === 'thinking';
    }

    return normalized === '快速'
      || normalized === 'fast';
  }) || null;
}

async function waitForThinkingOption(enable: boolean, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const option = findVisibleThinkingOption(enable);
    if (option) return option;
    await wait(100);
  }
  return null;
}

async function selectThinkingMode(enable: boolean) {
  const select = getThinkingSelect();
  if (!select) return false;

  simulateRealClick(select);
  await wait(100);

  const option = await waitForThinkingOption(enable);
  if (!option) return false;

  simulateRealClick(option);
  await wait(250);

  const label = getThinkingLabel();
  return enable ? isThinkingLabel(label) : !isThinkingLabel(label);
}

// Qwen 国际版的思考模式是 Ant Select 下拉框。
const thinkingAction: ToggleAction = {
  async getState() {
    const select = getThinkingSelect();
    if (!select) return { found: false, enabled: false };
    return { found: true, enabled: isThinkingLabel(getThinkingLabel()) };
  },

  async enable() {
    const state = await this.getState();
    if (state.found && state.enabled) return true;
    return selectThinkingMode(true);
  },

  async disable() {
    const state = await this.getState();
    if (state.found && !state.enabled) return true;
    return selectThinkingMode(false);
  },
};

export const qwenProvider: ProviderConfig = {
  id: 'qwen',
  name: 'Qwen',
  domain: 'chat.qwen.ai',
  auth: {
    failureMessage: 'Qwen is not signed in. Please sign in on Qwen and try again.',
    getLoginState() {
      const userButton = document.querySelector('.sidebar-user .user-menu-btn');
      const userName = document.querySelector('.sidebar-user .user-menu-btn-text')?.textContent?.trim();
      const userImage = document.querySelector('.sidebar-user .user-img');

      if (userButton && userName && userImage) {
        return { status: 'logged_in' };
      }

      return { status: 'unknown', message: 'Unable to confirm Qwen sign-in status.' };
    },
  },
  actions: {
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '#sidebar .sidebar-entry-fixed-list .sidebar-entry-fixed-list-content >> 新建对话',
          '#sidebar .sidebar-entry-fixed-list .sidebar-entry-fixed-list-content >> New Chat',
        ],
      },
      // 输入消息
      input: {
        box: [
          '.message-input-container-area textarea.message-input-textarea',
        ],
      },
      // 发送消息
      send: {
        button: [
          '.send-button .icon-send'
        ],
      },
    },
    thinking: thinkingAction,
  },
  conversation: {
    idFromUrl: {
      pattern: '/c/([0-9a-fA-F-]{36})',
      captureGroup: 1,
      excludePattern: '^new-chat$',
    },
  },
  sse: (() => {
    let lastThinkingFull = '';

    return {
      urlPattern: '/api/v2/chat/completions',
      detectionKeywords: ['"response.created"', '"choices"', '"phase"'],
      parseLine: (line: string) => {
        line = line.trim();
        if (!line) return null;

        if (line === 'data: [DONE]' || line === '[DONE]' || line === 'event:complete') {
          lastThinkingFull = '';
          return { text: '', isThink: null, done: true };
        }

        if (!line.startsWith('data:')) return null;

        const json = line.substring(5).trim();
        if (!json) return null;

        try {
          const d = JSON.parse(json);

          const conversationId = d?.['response.created']?.chat_id;
          if (conversationId) {
            return {
              text: '',
              isThink: null,
              done: false,
              conversationId,
            };
          }

          const delta = d?.choices?.[0]?.delta;
          if (!delta) return null;

          const phase = delta.phase;
          const status = delta.status;

          if (phase === 'answer') {
            if (typeof delta.content === 'string' && delta.content) {
              return {
                text: delta.content,
                isThink: false,
                done: false,
              };
            }
            if (status === 'finished') {
              lastThinkingFull = '';
              return { text: '', isThink: null, done: true };
            }
            return null;
          }

          if (phase === 'thinking_summary') {
            if (status === 'finished') return null;

            const titles = Array.isArray(delta.extra?.summary_title?.content)
              ? delta.extra.summary_title.content
              : [];
            const thoughts = Array.isArray(delta.extra?.summary_thought?.content)
              ? delta.extra.summary_thought.content
              : [];
            const fullThinking = thoughts
              .map((thought: string, index: number) => {
                const title = titles[index];
                return title ? `### ${title}\n${thought}` : thought;
              })
              .filter(Boolean)
              .join('\n\n');

            if (!fullThinking) return null;
            if (fullThinking.length < lastThinkingFull.length) {
              lastThinkingFull = '';
            }
            const text = fullThinking.slice(lastThinkingFull.length);
            lastThinkingFull = fullThinking;
            if (!text) return null;
            return {
              text,
              isThink: true,
              done: false,
            };
          }

          return null;
        } catch (e) {
          return null;
        }
      },
    };
  })(),
};

export default qwenProvider;
