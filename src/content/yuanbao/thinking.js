import { createThinkingToggle } from '../shared/capabilities/thinking-toggle.js';

export const thinkingToggle = createThinkingToggle({
  provider: 'yuanbao',
  findToggle: '[dt-button-id="deep_think"]',
  isEnabled: { classContains: 'selected' },
  toggle: { type: 'click', wait: 500 },
});
