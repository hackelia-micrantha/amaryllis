import { jest } from '@jest/globals';

const mockLlmPipe = {
  init: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
  newSession: jest.fn().mockResolvedValue(undefined),
  generate: jest.fn().mockResolvedValue('mock-output'),
  generateAsync: jest.fn(async (_params, callbacks) => {
    callbacks?.onEvent?.({ type: 'partial', text: 'mock-partial' });
    callbacks?.onEvent?.({ type: 'final', text: 'mock-output' });
  }),
  cancelAsync: jest.fn(),
};

jest.mock('./src/NativePipe', () => {
  return {
    newLlmPipe: jest.fn(() => mockLlmPipe),
    mockLlmPipe,
  };
});
