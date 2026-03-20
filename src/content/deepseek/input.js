import { createInputFiller } from '../shared/capabilities/input-filler.js';

export const inputFiller = createInputFiller({
  provider: 'deepseek',
  selectors: ['textarea'],
});
