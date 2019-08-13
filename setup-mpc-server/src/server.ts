import { spawn } from 'child_process';
import { unlink } from 'fs';
import moment, { Moment } from 'moment';
import { MemoryFifo, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { MemoryStateStore, StateStore } from './state-store';
import { TranscriptStore } from './transcript-store';

interface VerifyItem {
  participant: Participant;
  transcriptNumber: number;
  transcriptPath: string;
  signature: string;
}

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifyQueue: MemoryFifo<VerifyItem> = new MemoryFifo();
  protected stateStore: StateStore = new MemoryStateStore();

  constructor(private store: TranscriptStore) {
    this.verifier().catch(console.error);
  }

  public async setState(state: MpcState) {
    await this.stateStore.setState(state);
  }

  public async getState(): Promise<MpcState> {
    return await this.stateStore.getState();
  }

  public async resetState(startTime: Moment, numG1Points: number, numG2Points: number, invalidateAfter: number) {
    this.setState({ numG1Points, numG2Points, startTime, invalidateAfter, participants: [] });
  }

  public async addParticipant(address: Address) {
    const state = await this.stateStore.getState();

    const participant: Participant = {
      state: 'WAITING',
      runningState: 'WAITING',
      position: state.participants.length + 1,
      computeProgress: 0,
      verifyProgress: 0,
      transcripts: [],
      address,
    };

    state.participants.push(participant);
    await this.stateStore.setState(state);
  }

  public start() {
    this.scheduleAdvanceState();
  }

  private scheduleAdvanceState() {
    this.interval = setTimeout(async () => {
      await this.advanceState();
      this.scheduleAdvanceState();
    }, 500);
  }

  public stop() {
    clearInterval(this.interval!);
  }

  protected async advanceState() {
    const state = await this.stateStore.getState();

    if (moment().isBefore(state.startTime)) {
      return;
    }

    const { completedAt, invalidateAfter, participants } = state;

    if (!completedAt && participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
      state.completedAt = moment();
      await this.stateStore.setState(state);
      return;
    }

    const i = participants.findIndex(p => p.state === 'WAITING' || p.state === 'RUNNING');
    const p = participants[i];

    if (!p) {
      return;
    }

    if (p.state === 'WAITING') {
      p.startedAt = moment();
      p.state = 'RUNNING';
      await this.stateStore.setState(state);
      return;
    }

    if (
      moment()
        .subtract(invalidateAfter, 's')
        .isAfter(p.startedAt!)
    ) {
      p.state = 'INVALIDATED';
      p.error = 'timed out';
      this.stateStore.setState(state);
      await this.advanceState();
      return;
    }
  }

  public async updateParticipant(participantData: Participant) {
    const { transcripts, address, runningState, computeProgress, error } = participantData;
    const p = this.getAndAssertRunningParticipant(address);
    // Complete flag is always controlled by the server. Don't allow client to overwrite.
    p.transcripts = transcripts.map((t, i) => ({
      ...t,
      complete: p.transcripts[i] ? p.transcripts[i].complete : false,
    }));
    p.runningState = runningState;
    p.computeProgress = computeProgress;
    p.error = error;
    p.lastUpdate = moment();
  }

  public async downloadData(address: Address, num: number) {
    return this.store.loadTranscript(address, num);
  }

  public async uploadData(address: Address, transcriptNumber: number, transcriptPath: string, signature: string) {
    const participant = this.getAndAssertRunningParticipant(address);
    this.verifyQueue.put({ participant, transcriptNumber, transcriptPath, signature });
  }

  private getLastCompleteParticipant() {
    return this.state.participants.find(p => p.state === 'COMPLETE');
  }

  public getAndAssertRunningParticipant(address: Address) {
    const p = this.getParticipant(address);
    if (p.state !== 'RUNNING') {
      throw new Error('Can only update a running participant.');
    }
    return p;
  }

  private getParticipant(address: Address) {
    const p = this.state.participants.find(p => p.address.equals(address));
    if (!p) {
      throw new Error(`Participant with address ${address} not found.`);
    }
    return p;
  }
}
