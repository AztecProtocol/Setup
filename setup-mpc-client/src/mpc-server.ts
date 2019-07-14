import { Moment } from 'moment';
import { Address } from 'web3x/address';

export const INVALIDATED_AFTER = 20;

export type ParticipantState = 'WAITING' | 'RUNNING' | 'COMPLETE' | 'INVALIDATED';
export type ParticipantRunningState = 'OFFLINE' | 'WAITING' | 'DOWNLOADING' | 'COMPUTING' | 'UPLOADING' | 'COMPLETE';

export interface Participant {
  state: ParticipantState;
  runningState: ParticipantRunningState;
  position: number;
  progress: number;
  startedAt?: Moment;
  lastUpdate?: Moment;
  completedAt?: Moment;
  address: Address;
}

export interface MpcState {
  startTime: Moment;
  completedAt?: Moment;
  participants: Participant[];
}

export interface MpcServer {
  getState(): Promise<MpcState>;
  updateRunningState(index: number, runningState: ParticipantRunningState): Promise<MpcState>;
}
