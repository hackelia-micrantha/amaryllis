import Downloader, {
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';
import { useCallback, useEffect, useState } from 'react';

export type BackgroundDownloaderParams = Array<DownloadInfo>;
export type DownloadInfo = { jobId: string; url: string; filename: string };

export const useBackgroundDownloader = (params: BackgroundDownloaderParams) => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  const startDownload = useCallback(
    async (jobId: string, url: string, filename: string) => {
      const task = Downloader.download({
        id: jobId,
        url: url,
        destination: `${Downloader.directories.documents}/${filename}`,
      }).done(() => {
        Downloader.completeHandler(jobId);
      });
      setTasks((prev: DownloadTask[]) => [...prev, task]);
    },
    []
  );

  useEffect(() => {
    params.forEach((param) =>
      startDownload(param.jobId, param.url, param.filename)
    );
  });

  return tasks;
};
