import { createMessageSender } from '../shared/capabilities/message-sender.js';

export const messageSender = createMessageSender({
  provider: 'yuanbao',
  prioritySelectors: [
    '#yuanbao-send-btn',
    '[class*="send-btn"]',
  ],
  clickMethod: 'real-click',
  inputSelectors: [
    '[contenteditable="true"]',
    'textarea',
    '[role="textbox"]',
    'input[type="text"]',
  ],
  parentTraversal: {
    selector: 'button, [role="button"], a[id*="send"], a[class*="send"]',
  },
});
