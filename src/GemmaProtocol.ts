import type { LlmProtocol } from './Types';

const START_OF_TURN = '<start_of_turn>';
const END_OF_TURN = '<end_of_turn>';
const END_OF_SEQUENCE = '<eos>';

const formatRequest: LlmProtocol['formatRequest'] = (params) => ({
  ...params,
  prompt: `${START_OF_TURN}user\n${params.prompt}${END_OF_TURN}\n${START_OF_TURN}model\n`,
});

const sanitizeOutput: LlmProtocol['sanitizeOutput'] = (text) => {
  const turnEndIndex = text.indexOf(END_OF_TURN);
  const sequenceEndIndex = text.indexOf(END_OF_SEQUENCE);
  const stopIndexes = [turnEndIndex, sequenceEndIndex].filter(
    (index) => index >= 0
  );
  const visibleText =
    stopIndexes.length > 0 ? text.slice(0, Math.min(...stopIndexes)) : text;

  return visibleText
    .replaceAll(START_OF_TURN, '')
    .replaceAll(END_OF_TURN, '')
    .replaceAll(END_OF_SEQUENCE, '')
    .replaceAll(/<\|[^>]*\|>/g, '')
    .replaceAll(/\|>\s*/g, '')
    .replace(/^\s*model\s*/i, '');
};

export const gemmaProtocol: LlmProtocol = {
  formatRequest,
  sanitizeOutput,
};
