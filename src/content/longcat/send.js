import { createMessageSender } from '../shared/capabilities/message-sender.js';

export const messageSender = createMessageSender({
  provider: 'longcat',
  prioritySelectors: ['.send-btn:not(.send-btn-disabled)'],
  clickMethod: 'double-click',
  inputSelectors: [
    '.tiptap.ProseMirror',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
  parentTraversal: { depth: 8, pick: 'first-enabled' },
});
