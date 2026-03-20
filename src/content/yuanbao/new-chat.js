import { createNewConversation } from '../shared/capabilities/new-conversation.js';

export const newChat = createNewConversation({
  provider: 'yuanbao',
  prioritySelectors: [
    '[data-desc="new-chat"]',
    { selector: '.icon-yb-ic_newchat_20', closest: '.yb-common-nav__trigger' },
  ],
  delayAfterClick: 1500,
});
