/**
 * Kimi Provider Configuration
 */

import type { ProviderConfig, ToggleAction } from '../core/types.js';
import { findAnyElement, simulateRealClick, wait } from '../core/dom-utils.js';

const MODEL_NAME_SELECTOR = '#chat-container > div.layout-content-main div.chat-action > div.chat-editor > div.chat-editor-action .current-model .model-name span.name, .current-model .model-name span.name';
const MODEL_TRIGGER_SELECTORS = [
  '#chat-container > div.layout-content-main div.chat-action > div.chat-editor > div.chat-editor-action .current-model',
  '.current-model',
];
const MODEL_POPOVER_SELECTOR = '.models-popover .models-container';
const MODEL_ITEM_SELECTOR = '.models-popover .models-container .model-item';

function getCurrentModelText(): string {
  return document.querySelector(MODEL_NAME_SELECTOR)?.textContent?.trim() || '';
}

function isKimiBasicMode(text: string, mode: '快速' | '思考'): boolean {
  return text.includes(mode) && !/Agent/i.test(text);
}

async function selectKimiMode(mode: '快速' | '思考'): Promise<boolean> {
  const trigger = findAnyElement(MODEL_TRIGGER_SELECTORS);
  if (!trigger) return false;

  simulateRealClick(trigger);

  const start = Date.now();
  while (Date.now() - start < 3000) {
    const container = document.querySelector(MODEL_POPOVER_SELECTOR);
    if (container) {
      const items = Array.from(document.querySelectorAll(MODEL_ITEM_SELECTOR));
      const target = items.find((item) => isKimiBasicMode(item.textContent?.trim() || '', mode));
      if (target) {
        simulateRealClick(target);
        return true;
      }
    }
    await wait(100);
  }

  return false;
}

const thinkingAction: ToggleAction = {
  async getState() {
    const text = getCurrentModelText();
    if (!text) return { found: false, enabled: false };
    if (isKimiBasicMode(text, '思考')) return { found: true, enabled: true };
    if (isKimiBasicMode(text, '快速')) return { found: true, enabled: false };
    return { found: true, enabled: false };
  },

  async enable() {
    return selectKimiMode('思考');
  },

  async disable() {
    return selectKimiMode('快速');
  },
};

type ParseResult = { text: string; isThink: boolean | null; done: boolean };

let kimiFrameBuffer = '';
let seenContentFrames = new Set<string>();

function resetKimiSseState() {
  kimiFrameBuffer = '';
  seenContentFrames = new Set<string>();
}

function extractJsonObjects(input: string): { objects: any[]; rest: string } {
  const objects: any[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (start < 0) {
      if (ch === '{') {
        start = i;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const json = input.slice(start, i + 1);
        try {
          objects.push(JSON.parse(json));
        } catch {
          // Ignore malformed frames and continue scanning after this object.
        }
        start = -1;
      }
    }
  }

  return {
    objects,
    rest: start >= 0 ? input.slice(start) : '',
  };
}

function hasOwn(data: any, key: string): boolean {
  return !!data && Object.prototype.hasOwnProperty.call(data, key);
}

function getKimiEventOffset(data: any): number | undefined {
  const eventOffset = data?.eventOffset ?? data?.['eventOffset '];
  return typeof eventOffset === 'number' ? eventOffset : undefined;
}

function isKimiDonePatch(data: any): boolean {
  if (hasOwn(data, 'done')) {
    return true;
  }

  return data?.message?.status === 'MESSAGE_STATUS_COMPLETED';
}

function isDuplicateContentFrame(data: any, content: string, kind: 'think' | 'text'): boolean {
  const eventOffset = getKimiEventOffset(data);
  if (eventOffset === undefined) return false;

  const key = [
    data?.chat?.id || '',
    data?.message?.id || '',
    data?.block?.id || '',
    eventOffset,
    kind,
    content,
  ].join('\u0000');

  if (seenContentFrames.has(key)) {
    return true;
  }
  seenContentFrames.add(key);
  return false;
}

function parseKimiPatch(data: any): ParseResult | null {
  const eventOffset = getKimiEventOffset(data);
  if (eventOffset === 1 && data?.chat?.id) {
    resetKimiSseState();
  }

  const mask = typeof data?.mask === 'string' ? data.mask : '';
  const block = data?.block;
  if (block?.think?.content && mask.includes('block.think')) {
    if (isDuplicateContentFrame(data, block.think.content, 'think')) return null;
    return { text: block.think.content, isThink: true, done: false };
  }
  if (block?.text?.content && mask.includes('block.text')) {
    if (isDuplicateContentFrame(data, block.text.content, 'text')) return null;
    return { text: block.text.content, isThink: false, done: false };
  }

  if (isKimiDonePatch(data)) {
    resetKimiSseState();
    return { text: '', isThink: null, done: true };
  }

  return null;
}

function parseKimiChunk(chunk: string): ParseResult[] {
  kimiFrameBuffer += chunk;
  const { objects, rest } = extractJsonObjects(kimiFrameBuffer);
  kimiFrameBuffer = rest;

  const results: ParseResult[] = [];
  for (const object of objects) {
    const result = parseKimiPatch(object);
    if (result) results.push(result);
  }
  return results;
}

export const kimiProvider: ProviderConfig = {
  id: 'kimi',
  name: 'Kimi',
  domain: 'kimi.com',
  auth: {
    failureMessage: 'Kimi 当前未登录，请先完成登录后再重试',
    async getLoginState() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return { status: 'logged_out', message: 'Kimi 当前未登录，请先完成登录后再重试' };
      }

      try {
        const res = await fetch(`https://www.kimi.com/api/user?t=${Date.now()}`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          method: 'GET',
        });
        const data = await res.json().catch(() => null);

        if (res.status === 200 && data?.id && data?.status === 'normal') {
          return { status: 'logged_in' };
        }
        if (res.status === 401 || data?.error_type === 'auth.token.invalid') {
          return { status: 'logged_out', message: 'Kimi 当前未登录，请先完成登录后再重试' };
        }

        return { status: 'unknown', message: '无法确认 Kimi 登录状态' };
      } catch {
        return { status: 'unknown', message: '无法确认 Kimi 登录状态' };
      }
    },
  },
  actions: {
    chat: {
      newChat: {
        button: [
          '#app > div > div.app.has-sidebar > aside > div.sidebar-new-chat > a',
          '.sidebar-new-chat > a',
        ],
      },
      input: {
        box: [
          '#chat-box > div.chat-input > div.chat-input-editor-container > div.chat-input-editor[contenteditable="true"]',
          '#chat-box > div.chat-input > div.chat-input-editor-container > div.chat-input-editor',
          '.chat-input-editor[contenteditable="true"]',
        ],
      },
      send: {
        button: [
          '#chat-box > div.chat-editor-action > div.right-area > div.send-button-container button',
          '#chat-box > div.chat-editor-action > div.right-area > div.send-button-container',
          '.send-button-container button',
          '.send-button-container',
        ],
      },
    },
    thinking: thinkingAction,
  },
  conversation: {
    idFromUrl: {
      pattern: '/chat/([^?]+)',
      captureGroup: 1,
    },
  },
  sse: {
    urlPattern: '/apiv2/kimi.gateway.chat.v1.ChatService/Chat',
    detectionKeywords: [
      '"op":"',
      '"op":',
      '"block.think.content"',
      '"block.text.content"',
      '"MESSAGE_STATUS_GENERATING"',
      '"MESSAGE_STATUS_COMPLETED"',
      '"content"',
    ],
    parseLine: (line: string) => {
      return parseKimiChunk(line)[0] || null;
    },
    parseChunk: parseKimiChunk,
  },
};

export default kimiProvider;
