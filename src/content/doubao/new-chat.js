import { createNewConversation } from '../shared/capabilities/new-conversation.js';

export const newChat = createNewConversation({
  provider: 'doubao',
  delayAfterClick: 1500,
});
