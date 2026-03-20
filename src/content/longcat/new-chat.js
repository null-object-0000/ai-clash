import { createNewConversation } from '../shared/capabilities/new-conversation.js';

export const newChat = createNewConversation({
  provider: 'longcat',
  prioritySelectors: ['.new-content', '.chat-icon-box'],
});
