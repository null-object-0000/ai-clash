import { createInputFiller } from '../shared/capabilities/input-filler.js';

export const inputFiller = createInputFiller({
  provider: 'yuanbao',
  selectors: [
    '[contenteditable="true"]',
    'textarea',
    '[role="textbox"]',
    'input[type="text"]',
  ],
});
