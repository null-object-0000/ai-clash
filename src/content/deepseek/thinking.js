import { createThinkingToggle } from '../shared/capabilities/thinking-toggle.js';

export const thinkingToggle = createThinkingToggle({
  provider: 'deepseek',
  findToggle: { selector: '.ds-toggle-button[role="button"]', textContains: '深度思考' },
  isEnabled: { hasClass: 'ds-toggle-button--selected' },
  toggle: { type: 'click' },
});
