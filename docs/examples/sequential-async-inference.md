# Sequential asynchronous inference

`useInferenceAsync` supports repeated calls from the same mounted hook, but `await generate(...)` resolves after native startup rather than model completion. This example wraps the callback lifecycle in an application-level promise and runs two requests sequentially.

```tsx
import React, { useCallback, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import {
  GenerationInProgressError,
  useInferenceAsync,
} from '@micrantha/react-native-amaryllis';

type PendingGeneration = {
  latestText: string;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
};

export function SequentialInferenceExample() {
  const [currentText, setCurrentText] = useState('');
  const [responses, setResponses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const pendingRef = useRef<PendingGeneration | null>(null);

  const generate = useInferenceAsync({
    onResult: (text) => {
      // Hook results are cumulative snapshots. Replace the displayed text.
      setCurrentText(text);
      if (pendingRef.current) {
        pendingRef.current.latestText = text;
      }
    },
    onError: (generationError) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.reject(generationError);
    },
    onComplete: () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.resolve(pending.latestText);
    },
  });

  const runOne = useCallback(
    (prompt: string) =>
      new Promise<string>((resolve, reject) => {
        if (pendingRef.current) {
          reject(new GenerationInProgressError());
          return;
        }

        pendingRef.current = {
          latestText: '',
          resolve,
          reject,
        };
        setCurrentText('');

        // This promise resolves after validation and native startup. The
        // outer application promise resolves from onComplete instead.
        void generate({ prompt }).catch((unknownError: unknown) => {
          const pending = pendingRef.current;
          pendingRef.current = null;
          pending?.reject(
            unknownError instanceof Error
              ? unknownError
              : new Error('Unknown generation error')
          );
        });
      }),
    [generate]
  );

  const runSequentially = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResponses([]);

    try {
      const first = await runOne('Name one benefit of on-device inference.');
      setResponses([first]);

      // The first request has reached a terminal state and released the
      // single-flight lock before the second request starts.
      const second = await runOne('Name one risk that local inference does not remove.');
      setResponses([first, second]);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Unknown generation error'
      );
    } finally {
      setRunning(false);
    }
  }, [runOne]);

  return (
    <View>
      <Button
        title={running ? 'Generating…' : 'Run two requests'}
        disabled={running}
        onPress={() => void runSequentially()}
      />

      <Text>Current stream: {currentText}</Text>
      {responses.map((response, index) => (
        <Text key={index}>Response {index + 1}: {response}</Text>
      ))}
      {error ? <Text>Generation failed: {error}</Text> : null}
    </View>
  );
}
```

## Why the wrapper is necessary

The hook's returned `generate` function starts one request and returns its cancellation function. Completion is reported through callbacks. The `runOne` helper turns those callbacks into a promise without changing Amaryllis ownership rules.

The example also demonstrates these requirements:

- one mounted hook performs multiple sequential generations;
- each request starts with an empty output buffer;
- displayed text is replaced with each cumulative hook result;
- the second request starts only after `onComplete` releases the first;
- an accidental overlapping application call receives `GenerationInProgressError`;
- errors reject the application wrapper rather than being treated as successful completion.

For cancellation, retain the function returned by `generate(...)` and track a separate cancelled state. An explicit cancellation terminates the operation and invokes `onComplete`, but it does not produce a final result.
