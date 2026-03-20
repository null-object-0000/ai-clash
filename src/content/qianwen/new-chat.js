import { createNewConversation } from '../shared/capabilities/new-conversation.js';

export const newChat = createNewConversation({
  provider: 'qianwen',
  prioritySelectors: [
    '[class*="newChatButton"]',
    '[data-icon-type="qwpcicon-newDialogueMedium"]',
    '[data-icon-type="qwpcicon-newDialogue"]',
  ],
});
