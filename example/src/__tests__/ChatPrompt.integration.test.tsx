import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { LLMProvider } from '@micrantha/react-native-amaryllis';
import { ContextEngineProvider } from '@micrantha/react-native-amaryllis/context';
import type { LlmEngine } from '../../../src/Types';
import type { ContextEngine } from '../../../src/ContextTypes';
import { PromptProvider } from '../PromptContext';
import { ChatPrompt } from '../components/ChatPrompt';

const mockLaunchImageLibrary = jest.fn();
const mockUseContextInferenceAsync = jest.fn();
const mockCancelInference = jest.fn();

jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (
        props: Record<string, unknown>,
        ref: React.ForwardedRef<{ setSelection: jest.Mock }>
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          setSelection: jest.fn(),
        }));
        return ReactModule.createElement('TextInput', props);
      }
    ),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('@micrantha/react-native-amaryllis/context', () => {
  const actual = jest.requireActual(
    '@micrantha/react-native-amaryllis/context'
  );
  return {
    ...actual,
    useContextInferenceAsync: (...args: unknown[]) =>
      mockUseContextInferenceAsync(...args),
  };
});

const getPressables = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_root.findAll(
    (node: { props?: { onPress?: unknown } }) =>
      typeof node.props?.onPress === 'function'
  );

const createContextEngineMock = (
  overrides: Partial<ContextEngine> = {}
): ContextEngine => ({
  add: jest.fn(),
  search: jest.fn(async () => []),
  setPolicy: jest.fn(),
  compact: jest.fn(),
  formatRequest: jest.fn(({ request }) => request),
  deriveQuery: jest.fn((prompt: string) => ({ text: prompt, limit: 6 })),
  ...overrides,
});

const createPipe = (): LlmEngine => ({
  init: jest.fn(() => Promise.resolve()),
  newSession: jest.fn(() => Promise.resolve()),
  generate: jest.fn(() => Promise.resolve('unused')),
  generateAsync: jest.fn(async (_params, callbacks) => {
    callbacks?.onEvent?.({ type: 'partial', text: 'draft' });
    callbacks?.onEvent?.({ type: 'final', text: 'done' });
  }),
  close: jest.fn(),
  cancelAsync: jest.fn(),
});

const renderChatPrompt = (
  pipe: LlmEngine,
  engine: ContextEngine = createContextEngineMock()
) => {
  return render(
    <LLMProvider
      config={{ modelPath: '/models/amaryllis.task' }}
      llmPipe={pipe}
    >
      <ContextEngineProvider engine={engine}>
        <PromptProvider>
          <ChatPrompt />
        </PromptProvider>
      </ContextEngineProvider>
    </LLMProvider>
  );
};

describe('ChatPrompt integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseContextInferenceAsync.mockImplementation(
      (props: {
        onGenerate?: () => void;
        onResult?: (result: string, isFinal: boolean) => void;
        onComplete?: () => void;
      }) =>
        async ({ prompt, images }: { prompt: string; images?: string[] }) => {
          expect(prompt).toBeDefined();
          expect(images).toBeDefined();
          try {
            props.onGenerate?.();
          } catch {
            // Test renderer doesn't implement TextInput imperative APIs.
          }
          props.onResult?.('draft', false);
          props.onResult?.('done', true);
          props.onComplete?.();
          return () => {};
        }
    );
  });

  it('should augment a prompt, stream results, and persist context items', async () => {
    const engine = createContextEngineMock();
    const pipe = createPipe();
    const screen = renderChatPrompt(pipe, engine);
    await waitFor(() => {
      expect(pipe.init).toHaveBeenCalledWith({
        modelPath: '/models/amaryllis.task',
      });
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter prompt...'),
      'hello'
    );
    await act(async () => {
      getPressables(screen)[0].props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByText('done')).toBeTruthy();
    });

    expect(mockUseContextInferenceAsync).toHaveBeenCalled();
    expect(engine.add).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'done',
          tags: ['assistant'],
        }),
      ])
    );
  });

  it('should keep only the last two selected images and clear them', async () => {
    const pipe = createPipe();
    const screen = renderChatPrompt(pipe);
    await waitFor(() => {
      expect(pipe.init).toHaveBeenCalledWith({
        modelPath: '/models/amaryllis.task',
      });
    });

    mockLaunchImageLibrary
      .mockImplementationOnce(
        (
          _options,
          callback: (response: { assets?: Array<{ uri?: string }> }) => void
        ) => callback({ assets: [{ uri: 'file:///first.png' }] })
      )
      .mockImplementationOnce(
        (
          _options,
          callback: (response: { assets?: Array<{ uri?: string }> }) => void
        ) => callback({ assets: [{ uri: 'file:///second.png' }] })
      )
      .mockImplementationOnce(
        (
          _options,
          callback: (response: { assets?: Array<{ uri?: string }> }) => void
        ) => callback({ assets: [{ uri: 'file:///third.png' }] })
      );

    await act(async () => {
      getPressables(screen)[1].props.onPress();
      getPressables(screen)[1].props.onPress();
      getPressables(screen)[1].props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByText('2 images selected')).toBeTruthy();
    });

    await act(async () => {
      getPressables(screen)[2].props.onPress();
    });

    await waitFor(() => {
      expect(screen.queryByText('2 images selected')).toBeNull();
    });
  });

  it('should cancel an in-flight response from the send button', async () => {
    const pipe = createPipe();
    mockUseContextInferenceAsync.mockImplementation(
      (props: { onGenerate?: () => void }) => async () => {
        props.onGenerate?.();
        return mockCancelInference;
      }
    );

    const screen = renderChatPrompt(pipe);
    await waitFor(() => {
      expect(pipe.init).toHaveBeenCalledWith({
        modelPath: '/models/amaryllis.task',
      });
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter prompt...'),
      'cancel me'
    );

    await act(async () => {
      getPressables(screen)[0].props.onPress();
    });

    expect(screen.getByText('■')).toBeTruthy();

    await act(async () => {
      getPressables(screen)[0].props.onPress();
    });

    expect(mockCancelInference).toHaveBeenCalledTimes(1);
    expect(pipe.cancelAsync).not.toHaveBeenCalled();
    expect(screen.getByText('➤')).toBeTruthy();
  });

  it('should not generate when prompt is blank', async () => {
    const engine = createContextEngineMock();
    const pipe = createPipe();
    const screen = renderChatPrompt(pipe, engine);
    await waitFor(() => {
      expect(pipe.init).toHaveBeenCalledWith({
        modelPath: '/models/amaryllis.task',
      });
    });

    fireEvent.changeText(screen.getByPlaceholderText('Enter prompt...'), '   ');

    await act(async () => {
      getPressables(screen)[0].props.onPress();
    });

    expect(mockUseContextInferenceAsync).toHaveBeenCalled();
    expect(engine.add).not.toHaveBeenCalled();
  });
});
