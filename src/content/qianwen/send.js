import { createMessageSender } from '../shared/capabilities/message-sender.js';

export const messageSender = createMessageSender({
  provider: 'qianwen',
  prioritySelectors: ['.operateBtn-ehxNOr'],
  clickMethod: 'double-click',
  inputSelectors: [
    '[data-slate-editor="true"]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
  parentTraversal: { depth: 8, pick: 'first-enabled' },
});
