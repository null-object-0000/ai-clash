import { createMessageSender } from '../shared/capabilities/message-sender.js';

export const messageSender = createMessageSender({
  provider: 'deepseek',
  inputSelectors: ['textarea'],
  parentTraversal: {
    selector: '.ds-icon-button[role="button"][aria-disabled="false"]',
  },
});
