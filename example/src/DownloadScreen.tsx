import type { DownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import * as Progress from 'react-native-progress';
import {
  useBackgroundDownloader,
  type BackgroundDownloaderParams,
} from './hooks';

export const WelcomeScreen = () => {
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | undefined>(undefined);

  const models = useMemo<BackgroundDownloaderParams>(
    () => [
      {
        jobId: 'amaryllis-model',
        filename: 'amaryllis.model',
        url: 'https://download.micrantha.com/model?type=llm&app=amaryllis',
      },
      {
        jobId: 'amaryllis-vision',
        filename: 'amaryllis.vision',
        url: 'https://download.micrantha.com/model?type=vision&app=amaryllis',
      },
    ],
    []
  );

  const tasks = useBackgroundDownloader(models);

  useEffect(() => {
    tasks.forEach((task: DownloadTask) => {
      task
        .progress(({ bytesDownloaded, bytesTotal }) => {
          setProgress((bytesDownloaded / bytesTotal) * 100);
        })
        .error(({ error: err }) => {
          setError(err);
        });
    });
  }, [tasks]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Downloading AI Model</Text>

      <Progress.Bar
        progress={progress}
        width={300}
        color="#4CAF50"
        borderRadius={6}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  error: {
    color: 'red',
  },
  title: {
    fontSize: 18,
    marginBottom: 20,
  },
  success: {
    marginTop: 20,
    fontSize: 16,
    color: 'green',
  },
});
