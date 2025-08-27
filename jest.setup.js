import { jest } from '@jest/globals';

jest.mock('./src/NativePipe', () => {
  return {
    newLlmPipe: () => ({
      init: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      newSession: jest.fn().mockReturnValue({ id: 'mock-session' }),
      generate: jest.fn().mockResolvedValue('mock-output'),
    }),
  };
});
