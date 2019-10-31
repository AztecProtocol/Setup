import { Participant, MpcState } from 'setup-mpc-common';
import moment = require('moment');

export interface Metrics {
  downloadProgress: number;
  computeProgress: number;
  uploadProgress: number;
  verifyProgress: number;
  verifyTimeout: number;
  totalTimeout: number;
}

export function calculateMetrics(state: MpcState, p: Participant): Metrics {
  const { invalidateAfter, numG1Points, numG2Points, pointsPerTranscript } = state!;
  const completeWithin = p.invalidateAfter || invalidateAfter;
  const verifyWithin = (2 * completeWithin) / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
  const verifyTimeout = Math.max(
    0,
    moment(p.lastVerified || p.startedAt!)
      .add(verifyWithin, 's')
      .diff(moment(), 's')
  );

  const totalTimeout = Math.max(
    0,
    moment(p.startedAt!)
      .add(completeWithin, 's')
      .diff(moment(), 's')
  );

  const totalData = p.transcripts.reduce((a, t) => a + t.size, 0);
  const totalDownloaded = p.transcripts.reduce((a, t) => a + t.downloaded, 0);
  const totalUploaded = p.transcripts.reduce((a, t) => a + t.uploaded, 0);
  const downloadProgress = totalData ? (totalDownloaded / totalData) * 100 : 0;
  const uploadProgress = totalData ? (totalUploaded / totalData) * 100 : 0;
  const computeProgress = p.computeProgress;
  const verifyProgress = p.verifyProgress;

  return {
    downloadProgress,
    uploadProgress,
    computeProgress,
    verifyProgress,
    verifyTimeout,
    totalTimeout,
  };
}
