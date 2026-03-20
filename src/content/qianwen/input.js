import { createInputFiller } from '../shared/capabilities/input-filler.js';

export const inputFiller = createInputFiller({
  provider: 'qianwen',
  selectors: [
    '[data-slate-editor="true"]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
  delayAfterFill: 500,
});
