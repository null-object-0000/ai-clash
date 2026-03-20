import { createThinkingToggle } from '../shared/capabilities/thinking-toggle.js';

export const thinkingToggle = createThinkingToggle({
  provider: 'longcat',
  findToggle: { selector: '.v-checked-button', hasChild: 'use[href="#icon-sikao"]' },
  isEnabled: { hasClass: 'active' },
  toggle: { type: 'click', wait: 400 },
});
