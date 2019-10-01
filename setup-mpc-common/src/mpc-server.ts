import { Moment } from 'moment';
import { Readable } from 'stream';
import { Address } from 'web3x/address';

export type CeremonyState =
  | 'PRESELECTION'
  | 'SELECTED'
  | 'RUNNING'
  | 'SEALING'
  | 'PUBLISHING'
  | 'RANGE_PROOFS'
  | 'COMPLETE';
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

export type CRS = [string, string, string, string];

export interface Participant {
  // Server controlled data.
  sequence: number;
  address: Address;
  state: ParticipantState;
  // Position in the queue (can vary due to online/offline changes), or position computation took place (fixed).
  position: number;
  // Priority is randomised at the selection date, after which it is fixed. It's used to determine position.
  priority: number;
  tier: number;
  verifyProgress: number;
  lastVerified?: Moment;
  addedAt: Moment;
  startedAt?: Moment;
  completedAt?: Moment;
  error?: string;
  online: boolean;
  lastUpdate?: Moment;
  location?: ParticipantLocation;

  // Client controlled data.
  runningState: ParticipantRunningState;
  transcripts: Transcript[]; // Except 'complete'.
  computeProgress: number;
}

export interface ParticipantLocation {
  city?: string;
  country?: string;
  continent?: string;
  latitude?: number;
  longitude?: number;
}

export interface MpcState {
  name: string;
  sequence: number;
  startSequence: number;
  statusSequence: number;
  ceremonyState: CeremonyState;
  maxTier2: number;
  minParticipants: number;
  numG1Points: number;
  numG2Points: number;
  pointsPerTranscript: number;
  invalidateAfter: number;
  startTime: Moment;
  endTime: Moment;
  latestBlock: number;
  selectBlock: number;
  completedAt?: Moment;
  sealingProgress: number;
  publishProgress: number;
  rangeProofSize: number;
  rangeProofProgress: number;
  rangeProofsPerFile: number;
  crs?: CRS;
  publishPath?: string;
  participants: Participant[];
}

export interface PatchState {
  startTime?: Moment;
  endTime?: Moment;
  selectBlock?: number;
  maxTier2?: number;
  minParticipants?: number;
  numG1Points?: number;
  numG2Points?: number;
  pointsPerTranscript?: number;
  invalidateAfter?: number;
  rangeProofSize: number;
  rangeProofsPerFile: number;
}

export interface MpcServer {
  resetState(
    name: string,
    startTime: Moment,
    endTime: Moment,
    latestBlock: number,
    selectBlock: number,
    maxTier2: number,
    minParticipants: number,
    numG1Points: number,
    numG2Points: number,
    pointsPerTranscript: number,
    rangeProofSize: number,
    rangeProofsPerFile: number,
    invalidateAfter: number,
    participants0: Address[],
    participants1: Address[]
  ): Promise<void>;
  loadState(name: string): Promise<void>;
  patchState(state: PatchState): Promise<MpcState>;
  getState(sequence?: number): Promise<MpcState>;
  ping(address: Address, ip?: string): Promise<void>;
  addParticipant(address: Address, tier: number): Promise<void>;
  updateParticipant(participant: Participant): Promise<void>;
  downloadData(address: Address, transcriptNumber: number): Promise<Readable>;
  downloadSignature(address: Address, num: number): Promise<string>;
  uploadData(
    address: Address,
    transcriptNumber: number,
    transcriptPath: string,
    signaturePath?: string,
    progressCb?: (transferred: number) => void
  ): Promise<void>;
}
