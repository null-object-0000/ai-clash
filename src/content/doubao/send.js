import { createMessageSender } from '../shared/capabilities/message-sender.js';

export const messageSender = createMessageSender({
  provider: 'doubao',
  inputSelectors: [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
});
