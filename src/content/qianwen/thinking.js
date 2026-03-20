import { createThinkingToggle } from '../shared/capabilities/thinking-toggle.js';

export const thinkingToggle = createThinkingToggle({
  provider: 'qianwen',
  findToggle: '[data-log-params*="deepThink"]',
  isEnabled: { classPrefix: 'selected' },
  toggle: {
    type: 'click-with-close',
    closeSelector: '[data-icon-type="qwpcicon-close2"]',
  },
});
