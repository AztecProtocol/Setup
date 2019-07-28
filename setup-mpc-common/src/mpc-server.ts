import { Moment } from 'moment';
import { Readable } from 'stream';
import { Address } from 'web3x/address';

export const INVALIDATED_AFTER = 180;

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
  address: Address;
  state: ParticipantState;
  position: number;
  verifyProgress: number;
  startedAt?: Moment;
  completedAt?: Moment;
  error?: string;
  // Client controlled data.
  runningState: ParticipantRunningState;
  transcripts: Transcript[];
  computeProgress: number;
  lastUpdate?: Moment;
}

export interface MpcState {
  polynomials: number;
  startTime: Moment;
  completedAt?: Moment;
  participants: Participant[];
}

export interface MpcServer {
  getState(): Promise<MpcState>;
  updateParticipant(participant: Participant): Promise<void>;
  downloadData(address: Address, transcriptNumber: number): Promise<Readable>;
  uploadData(address: Address, transcriptNumber: number, transcriptPath: string, signature?: string): Promise<void>;
}