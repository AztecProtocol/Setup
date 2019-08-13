import moment, { Moment } from 'moment';
import { MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { MemoryStateStore, StateStore } from './state-store';
import { TranscriptStore } from './transcript-store';
import { Verifier } from './verifier';

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifier!: Verifier;
  private stateStore: StateStore = new MemoryStateStore();
  private state!: MpcState;

  constructor(private store: TranscriptStore) {}

  public async start() {
    // Take a copy of the state from the state store.
    this.state = await this.stateStore.getState();

    // Launch verifier.
    this.verifier = new Verifier(
      this.store,
      this.state.numG1Points,
      this.state.numG2Points,
      this.verifierCallback.bind(this)
    );
    this.verifier.run();

    // Get any files awaiting verification and add to the queue.
    const unverified = await this.store.getUnverified();
    unverified.forEach(item => this.verifier.put(item));

    this.scheduleAdvanceState();
  }

  public async getState(): Promise<MpcState> {
    return this.state;
  }

  public async resetState(startTime: Moment, numG1Points: number, numG2Points: number, invalidateAfter: number) {
    if (this.verifier) {
      this.verifier.cancel();
    }
    this.state = { numG1Points, numG2Points, startTime, invalidateAfter, participants: [] };
    await this.stateStore.setState(this.state);
    this.verifier = new Verifier(this.store, numG1Points, numG2Points, this.verifierCallback.bind(this));
    this.verifier.run();
  }

  public async addParticipant(address: Address) {
    const participant: Participant = {
      state: 'WAITING',
      runningState: 'WAITING',
      position: this.state.participants.length + 1,
      computeProgress: 0,
      verifyProgress: 0,
      transcripts: [],
      address,
    };

    this.state.participants.push(participant);
    await this.stateStore.setState(this.state);
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
    const state = this.state;

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
      this.verifier.runningAddress = p.address;
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

  public async uploadData(address: Address, transcriptNumber: number, transcriptPath: string, signaturePath: string) {
    this.getAndAssertRunningParticipant(address);
    await this.store.saveTranscript(address, transcriptNumber, transcriptPath);
    await this.store.saveSignature(address, transcriptNumber, signaturePath);
    this.verifier.put({ address, num: transcriptNumber });
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

  private async verifierCallback(address: Address, transcriptNumber: number, verified: boolean) {
    if (verified) {
      await this.onVerified(address, transcriptNumber);
    } else {
      await this.onRejected(address, transcriptNumber);
    }
  }

  private async onVerified(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);

    p.verifyProgress = ((transcriptNumber + 1) / p.transcripts.length) * 100;
    p.transcripts[transcriptNumber].complete = true;
    p.lastUpdate = moment();

    if (p.transcripts.every(t => t.complete)) {
      // Every transcript in clients transcript list is verified. We still need to verify the set
      // as a whole. This just checks the total number of G1 and G2 points is as expected.
      const fullyVerified = await this.verifier.verifyTranscriptSet(p.address);

      if (p.state !== 'RUNNING') {
        // Abort update if state changed during verification process (timed out).
        return;
      }

      if (fullyVerified) {
        p.state = 'COMPLETE';
        p.runningState = 'COMPLETE';
        p.completedAt = moment();
        this.verifier.lastCompleteAddress = p.address;
      } else {
        console.error(`Verification of set failed for ${p.address}...`);
        p.state = 'INVALIDATED';
        p.runningState = 'COMPLETE';
        p.error = 'verify failed';
      }
    }

    await this.stateStore.setState(this.state);
  }

  private async onRejected(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);
    console.error(`Verification failed: ${address.toString()} ${transcriptNumber}...`);
    p.state = 'INVALIDATED';
    p.runningState = 'COMPLETE';
    p.error = 'verify failed';

    await this.stateStore.setState(this.state);
  }
}
