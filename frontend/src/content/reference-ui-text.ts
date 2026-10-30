import { uiText1 } from './reference-ui-text-1';
import { uiText2 } from './reference-ui-text-2';
import { uiText3 } from './reference-ui-text-3';

export const uiText = { ...uiText1, ...uiText2, ...uiText3 } as const;
