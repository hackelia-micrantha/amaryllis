import { render, act } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { LLMProvider, useLLMContext } from '../AmaryllisContext';
import type { LlmEngine, LlmEngineConfig } from '../Types';

const TestConsumer = () => {
  const ctx = useLLMContext();
  if (!ctx || !ctx.isReady) {
    return <Text testID="loading">Loading...</Text>;
  }

  if (ctx.error) {
    return <Text testID="error">Error: {ctx.error.message}</Text>;
  }

  return (
    <View>
      <Text testID="config">{ctx.config ? ctx.config.modelPath : 'none'}</Text>
      <Text testID="controller">{ctx.controller ? 'exists' : 'none'}</Text>
    </View>
  );
};

describe('LLMProvider', () => {
  const config: LlmEngineConfig = { modelPath: 'foo' } as LlmEngineConfig;

  const mockPipe = {
    init: jest.fn(() => Promise.resolve()),
    newSession: jest.fn(() => Promise.resolve()),
    generate: jest.fn(() => Promise.resolve('result')),
    generateAsync: jest.fn(() => Promise.resolve()),
    close: jest.fn(),
    cancelAsync: jest.fn(),
  } as LlmEngine;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts LlmPipe on mount and closes on unmount', async () => {
    const { unmount } = render(
      <LLMProvider config={config} llmPipe={mockPipe}>
        <TestConsumer />
      </LLMProvider>
    );

    await act(async () => {});

    expect(mockPipe.init).toHaveBeenCalledWith(config);
    // Unmount triggers close
    unmount();
    expect(mockPipe.close).toHaveBeenCalled();
  });

  it('provides config and controller', async () => {
    const { getByTestId } = render(
      <LLMProvider config={config} llmPipe={mockPipe}>
        <TestConsumer />
      </LLMProvider>
    );

    await act(async () => {});

    expect(getByTestId('config').props.children).toBe('foo');
    expect(getByTestId('controller').props.children).toBe('exists');
  });
});
