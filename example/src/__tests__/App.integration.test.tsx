import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';

const mockLaunchImageLibrary = jest.fn();
const mockUseContextInferenceAsync = jest.fn();

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

jest.mock('@kesha-antonov/react-native-background-downloader', () => ({
  __esModule: true,
  default: {
    completeHandler: jest.fn(),
    directories: {
      documents: '/documents',
    },
    download: jest.fn(() => {
      const task = {
        done(callback: () => void) {
          callback();
          return task;
        },
        error() {
          return task;
        },
        progress() {
          return task;
        },
      };
      return task;
    }),
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('react-native-progress', () => ({
  Bar: () => null,
}));

jest.mock('../ImportModels', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../ModelContext', () => ({
  ModelProvider: ({ children }: { children: React.ReactNode }) => children,
  useModelContext: () => ({
    paths: {
      llmModelPath: '/documents/amaryllis.model',
      imageEmbedderModelPath: '/documents/amaryllis.vision',
    },
    setPaths: jest.fn(),
  }),
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

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const pressNearestHandler = (node: {
  parent: { props?: { onPress?: () => void }; parent?: any } | null;
}) => {
  let current = node.parent;
  while (current) {
    if (typeof current.props?.onPress === 'function') {
      current.props.onPress();
      return;
    }
    current = current.parent ?? null;
  }
  throw new Error('No press handler found for node');
};

describe('App integration flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseContextInferenceAsync.mockImplementation(
      (props: {
        onGenerate?: () => void;
        onResult?: (result: string, isFinal: boolean) => void;
        onComplete?: () => void;
      }) =>
        async () => {
          try {
            props.onGenerate?.();
          } catch {
            // Test renderer doesn't implement TextInput imperative APIs.
          }
          props.onResult?.('mock-partial', false);
          props.onResult?.('mock-output', true);
          props.onComplete?.();
        }
    );
  });

  it('should initialize the app, run a prompt, and reset via new session', async () => {
    const nativePipeModule = jest.requireMock('../../../src/NativePipe') as {
      newLlmPipe: jest.Mock;
      mockLlmPipe: {
        newSession: jest.Mock;
        generateAsync: jest.Mock;
      };
    };

    const screen = render(<App />);

    await waitFor(() => {
      expect(nativePipeModule.newLlmPipe).toHaveBeenCalledTimes(1);
      expect(nativePipeModule.mockLlmPipe.newSession).toHaveBeenCalledWith(
        undefined
      );
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter prompt...'),
      'hello'
    );
    expect(screen.getByPlaceholderText('Enter prompt...').props.value).toBe(
      'hello'
    );
    await act(async () => {
      pressNearestHandler(screen.getByText('➤'));
    });

    await waitFor(() => {
      expect(mockUseContextInferenceAsync).toHaveBeenCalled();
      expect(screen.getByText('mock-output')).toBeTruthy();
    });

    await act(async () => {
      pressNearestHandler(screen.getByText('➕'));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter prompt...').props.value).toBe(
        ''
      );
      expect(screen.queryByText('mock-output')).toBeNull();
    });
  });

  it('should show personalized demo content for the selected persona', async () => {
    const screen = render(<App />);

    fireEvent.press(screen.getByText('Personas'));

    expect(screen.getByText('Personalized Amaryllis')).toBeTruthy();
    expect(screen.getByText('Developer')).toBeTruthy();
    expect(
      screen.getByText('Build adaptive UI without losing structure')
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Security reviewer'));

    await waitFor(() => {
      expect(
        screen.getByText('Personalization that still respects governance')
      ).toBeTruthy();
    });
  });

  it('should expose current model paths from settings', () => {
    const screen = render(<App />);

    fireEvent.press(screen.getByText('Settings'));

    expect(screen.getByText('Model settings')).toBeTruthy();
    expect(screen.getByText('/documents/amaryllis.model')).toBeTruthy();
    expect(screen.getByText('/documents/amaryllis.vision')).toBeTruthy();
  });
});
