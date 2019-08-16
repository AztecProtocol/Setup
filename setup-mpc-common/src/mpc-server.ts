import { Moment } from 'moment';
import { Readable } from 'stream';
import { Address } from 'web3x/address';

export type ParticipantState = 'WAITING' | 'RUNNING' | 'COMPLETE' | 'INVALIDATED';
export type ParticipantRunningState = 'OFFLINE' | 'WAITING' | 'RUNNING' | 'COMPLETE';

export interface Transcript {
  // Server controlled data.
  complete: boolean;
  // Client controlled data.
  num: number;
  fromAddress?: Address;
  size: number;
  downloaded: number;
  uploaded: number;
}

export interface Participant {
  // Server controlled data.
  sequence: number;
  address: Address;
  state: ParticipantState;
  position: number;
  verifyProgress: number;
  startedAt?: Moment;
  completedAt?: Moment;
  error?: string;
  online: boolean;
  lastUpdate?: Moment;
  // Client controlled data.
  runningState: ParticipantRunningState;
  transcripts: Transcript[]; // Except 'complete'.
  computeProgress: number;
}

export interface MpcState {
  sequence: number;
  statusSequence: number;
  numG1Points: number;
  numG2Points: number;
  pointsPerTranscript: number;
  invalidateAfter: number;
  startTime: Moment;
  completedAt?: Moment;
  participants: Participant[];
}

export interface MpcServer {
  resetState(
    startTime: Moment,
    numG1Points: number,
    numG2Points: number,
    pointsPerTranscript: number,
    invalidateAfter: number,
    participants: Address[]
  ): Promise<void>;
  getState(sequence?: number): Promise<MpcState>;
  ping(address: Address): Promise<void>;
  updateParticipant(participant: Participant): Promise<void>;
  downloadData(address: Address, transcriptNumber: number): Promise<Readable>;
  uploadData(
    address: Address,
    transcriptNumber: number,
    transcriptPath: string,
    signaturePath?: string,
    progressCb?: (transferred: number) => void
  ): Promise<void>;
}
