import { createInputFiller } from '../shared/capabilities/input-filler.js';

export const inputFiller = createInputFiller({
  provider: 'longcat',
  selectors: [
    '.tiptap.ProseMirror',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ],
  delayAfterFill: 500,
});
