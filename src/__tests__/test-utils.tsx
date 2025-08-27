import { render, renderHook } from '@testing-library/react-native';
import { LLMProvider } from '../AmaryllisContext';
import type { LlmEngine, LlmEngineConfig } from '../Types';
import React from 'react';

export const mockPipe: LlmEngine = {
  init: jest.fn(() => Promise.resolve()),
  newSession: jest.fn(() => Promise.resolve()),
  generate: jest.fn(() => Promise.resolve('result')),
  generateAsync: jest.fn(() => Promise.resolve()),
  close: jest.fn(),
  cancelAsync: jest.fn(),
};

export const config: LlmEngineConfig = { modelPath: 'foo' } as LlmEngineConfig;

const createWrapper = (pipe: LlmEngine) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LLMProvider config={config} llmPipe={pipe}>
      {children}
    </LLMProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: any) =>
  render(ui, { wrapper: createWrapper(mockPipe), ...options });

const customRenderHook = (hook: (props: any) => any, options?: any) =>
  renderHook(hook, { wrapper: createWrapper(mockPipe), ...options });

export * from '@testing-library/react-native';
export { customRender as render, customRenderHook as renderHook };
