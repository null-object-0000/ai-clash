import { createThinkingToggle } from '../shared/capabilities/thinking-toggle.js';

export const thinkingToggle = createThinkingToggle({
  provider: 'doubao',

  // 豆包使用 Radix DropdownMenu，需从内部 wrapper 向上找到真正的 trigger
  findToggle() {
    const inner = document.querySelector('[data-testid="deep-thinking-action-button"]');
    if (!inner) return null;
    return inner.closest('[data-slot="dropdown-menu-trigger"]')
      || inner.closest('button[aria-haspopup="menu"]')
      || inner.querySelector('button');
  },

  isEnabled: { textContains: '思考' },

  toggle: {
    type: 'dropdown',
    menuItemSelectors: [
      '[data-testid*="deep-thinking-action-item"]',
      '[role="menuitem"]',
      '[data-slot="dropdown-menu-item"]',
    ],
    enableMatch: {
      texts: ['思考', '擅长解决更难的问题'],
      fallbackTestId: 'deep-thinking-action-item-1',
    },
    disableMatch: {
      texts: ['快速', '适用于大部分情况'],
      fallbackTestId: 'deep-thinking-action-item-0',
    },
  },
});
