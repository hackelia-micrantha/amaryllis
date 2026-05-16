import type { LlmRequestParams } from './Types';

const START_OF_TURN = '<start_of_turn>';
const END_OF_TURN = '<end_of_turn>';

export const formatGemmaRequest = (
  params: LlmRequestParams
): LlmRequestParams => ({
  ...params,
  prompt: `${START_OF_TURN}user\n${params.prompt}${END_OF_TURN}\n${START_OF_TURN}model\n`,
});

export const sanitizeGemmaOutput = (text: string): string =>
  text
    .replaceAll(START_OF_TURN, '')
    .replaceAll(END_OF_TURN, '')
    .replaceAll(/<\|[^>]*\|>/g, '')
    .replaceAll(/\|>\s*/g, '')
    .replace(/^\s*model\s*/i, '');
