import { createInputFiller } from '../shared/capabilities/input-filler.js';

export const inputFiller = createInputFiller({
  provider: 'doubao',
  selectors: [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
});
