import { Mutex } from 'async-mutex';
import moment, { Moment } from 'moment';
import { cloneMpcState, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { ParticipantSelector, ParticipantSelectorFactory } from './participant-selector';
import { StateStore } from './state-store';
import { advanceState } from './state/advance-state';
import { createParticipant } from './state/create-participant';
import { orderWaitingParticipants } from './state/order-waiting-participants';
import { selectParticipants } from './state/select-participants';
import { TranscriptStore } from './transcript-store';
import { Verifier } from './verifier';

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifier!: Verifier;
  private state!: MpcState;
  private readState!: MpcState;
  private mutex = new Mutex();
  private participantSelector!: ParticipantSelector;

  constructor(
    private store: TranscriptStore,
    private stateStore: StateStore,
    private participantSelectorFactory: ParticipantSelectorFactory
  ) {}

  public async start() {
    // Take a copy of the state from the state store.
    const state = await this.stateStore.getState();
    await this.resetWithState(state);
  }

  public stop() {
    clearInterval(this.interval!);

    if (this.participantSelector) {
      this.participantSelector.stop();
    }

    if (this.verifier) {
      this.verifier.cancel();
    }
  }

  public async resetState(
    startTime: Moment,
    endTime: Moment,
    latestBlock: number,
    selectBlock: number,
    maxTier2: number,
    minParticipants: number,
    numG1Points: number,
    numG2Points: number,
    pointsPerTranscript: number,
    invalidateAfter: number,
    participants: Address[]
  ) {
    const nextSequence = this.state.sequence + 1;
    const state: MpcState = {
      sequence: nextSequence,
      statusSequence: nextSequence,
      startSequence: nextSequence,
      ceremonyState: 'PRESELECTION',
      numG1Points,
      numG2Points,
      startTime,
      endTime,
      latestBlock,
      selectBlock,
      maxTier2,
      minParticipants,
      invalidateAfter,
      pointsPerTranscript,
      participants: [],
    };
    participants.forEach(address => this.addNextParticipant(state, address, 1));

    await this.resetWithState(state);
  }

  private async resetWithState(state: MpcState) {
    this.stop();

    const release = await this.mutex.acquire();
    this.state = state;
    this.readState = state;
    release();

    this.verifier = await this.createVerifier();
    this.verifier.run();

    this.participantSelector = this.createParticipantSelector(state.latestBlock, state.selectBlock);
    this.participantSelector.run();

    this.scheduleAdvanceState();
  }

  private createParticipantSelector(latestBlock: number, selectBlock: number) {
    const participantSelector = this.participantSelectorFactory.create(latestBlock, selectBlock);
    participantSelector.on('newParticipants', (addresses, latestBlock) => this.addParticipants(addresses, latestBlock));
    participantSelector.on('selectParticipants', blockHash => this.selectParticipants(blockHash));
    return participantSelector;
  }

  private async createVerifier() {
    const verifier = new Verifier(
      this.store,
      this.state.numG1Points,
      this.state.numG2Points,
      this.verifierCallback.bind(this)
    );
    const lastCompleteParticipant = this.getLastCompleteParticipant();
    const runningParticipant = this.getRunningParticipant();
    verifier.lastCompleteAddress = lastCompleteParticipant && lastCompleteParticipant.address;
    verifier.runningAddress = runningParticipant && runningParticipant.address;

    // Get any files awaiting verification and add to the queue.
    if (runningParticipant) {
      const unverified = await this.store.getUnverified(runningParticipant.address);
      unverified.forEach(item => verifier.put(item));
    }

    return verifier;
  }

  public async getState(sequence?: number): Promise<MpcState> {
    return {
      ...this.readState,
      participants:
        sequence === undefined
          ? this.readState.participants
          : this.readState.participants.filter(p => p.sequence > sequence),
    };
  }

  public async addParticipant(address: Address, tier: number) {
    const release = await this.mutex.acquire();
    this.state.sequence += 1;
    this.state.statusSequence = this.state.sequence;
    this.addNextParticipant(this.state, address, tier);
    release();
  }

  private async addParticipants(addresses: Address[], latestBlock: number) {
    const release = await this.mutex.acquire();
    this.state.sequence += 1;
    this.state.statusSequence = this.state.sequence;
    this.state.latestBlock = latestBlock;
    if (addresses.length) {
      console.log(`Adding participants from block ${latestBlock}:`, addresses.map(a => a.toString()));
      const tier = this.state.ceremonyState === 'PRESELECTION' ? 2 : 3;
      addresses.forEach(address => this.addNextParticipant(this.state, address, tier));
    }
    release();
  }

  private async selectParticipants(blockHash: Buffer) {
    const release = await this.mutex.acquire();
    try {
      selectParticipants(this.state, blockHash);
    } finally {
      release();
    }
  }

  private addNextParticipant(state: MpcState, address: Address, tier: number) {
    if (state.participants.find(p => p.address.equals(address))) {
      return;
    }
    const participant = createParticipant(state.sequence, moment(), state.participants.length + 1, tier, address);
    state.participants.push(participant);
    return participant;
  }

  private scheduleAdvanceState() {
    this.interval = setTimeout(() => this.advanceState(), 1000);
  }

  private async advanceState() {
    const release = await this.mutex.acquire();

    try {
      await advanceState(this.state, this.store, this.verifier, moment());
    } catch (err) {
      console.error(err);
    } finally {
      await this.stateStore.setState(this.state);
      this.readState = cloneMpcState(this.state);
      release();
    }

    this.scheduleAdvanceState();
  }

  public async ping(address: Address) {
    const release = await this.mutex.acquire();
    try {
      const p = this.getParticipant(address);

      p.lastUpdate = moment();

      if (p.online === false) {
        this.state.sequence += 1;
        this.state.statusSequence = this.state.sequence;
        p.sequence = this.state.sequence;
        p.online = true;

        this.state.participants = orderWaitingParticipants(this.state.participants, this.state.sequence);
      }
    } finally {
      release();
    }
  }

  public async updateParticipant(participantData: Participant) {
    const release = await this.mutex.acquire();
    try {
      const { transcripts, address, runningState, computeProgress } = participantData;
      const p = this.getAndAssertRunningParticipant(address);
      // Complete flag is always controlled by the server. Don't allow client to overwrite.
      p.transcripts = transcripts.map((t, i) => ({
        ...t,
        complete: p.transcripts[i] ? p.transcripts[i].complete : false,
      }));
      p.runningState = runningState;
      p.computeProgress = computeProgress;
      p.lastUpdate = moment();
      p.online = true;
      this.state.sequence += 1;
      p.sequence = this.state.sequence;
    } finally {
      release();
    }
  }

  public async downloadData(address: Address, num: number) {
    return this.store.loadTranscript(address, num);
  }

  public async uploadData(address: Address, transcriptNumber: number, transcriptPath: string, signaturePath: string) {
    this.getAndAssertRunningParticipant(address);
    await this.store.save(address, transcriptNumber, transcriptPath, signaturePath);
    this.verifier.put({ address, num: transcriptNumber });
  }

  public getAndAssertRunningParticipant(address: Address) {
    const p = this.getRunningParticipant();
    if (!p || !p.address.equals(address)) {
      throw new Error('Can only update a running participant.');
    }
    return p;
  }

  private getRunningParticipant() {
    return this.state.participants.find(p => p.state === 'RUNNING');
  }

  private getLastCompleteParticipant() {
    return [...this.state.participants].reverse().find(p => p.state === 'COMPLETE');
  }

  private getParticipant(address: Address) {
    const p = this.state.participants.find(p => p.address.equals(address));
    if (!p) {
      throw new Error(`Participant with address ${address} not found.`);
    }
    return p;
  }

  private async verifierCallback(address: Address, transcriptNumber: number, verified: boolean) {
    const release = await this.mutex.acquire();
    try {
      if (verified) {
        await this.onVerified(address, transcriptNumber);
      } else {
        await this.onRejected(address, transcriptNumber);
      }
    } finally {
      release();
    }
  }

  private async onVerified(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);

    if (p.state !== 'RUNNING') {
      // Abort update if state changed during verification process (timed out).
      return;
    }

    p.lastVerified = moment();
    p.transcripts[transcriptNumber].complete = true;

    if (p.transcripts.every(t => t.complete)) {
      // Every transcript in clients transcript list is verified. We still need to verify the set
      // as a whole. This just checks the total number of G1 and G2 points is as expected.
      const fullyVerified = await this.verifier.verifyTranscriptSet(p.address);

      if (fullyVerified) {
        await this.store.makeLive(address);
        p.state = 'COMPLETE';
        p.runningState = 'COMPLETE';
        // We may not have yet received final state update from the client, and once we're no longer
        // running we won't process the update. Force compute progress to 100%.
        p.computeProgress = 100;
        p.completedAt = moment();
        this.verifier.lastCompleteAddress = p.address;
      } else {
        console.error(`Verification of set failed for ${p.address}...`);
        p.state = 'INVALIDATED';
        p.runningState = 'COMPLETE';
        p.error = 'verify failed';
      }
    }

    p.verifyProgress = ((transcriptNumber + 1) / p.transcripts.length) * 100;
    p.lastUpdate = moment();
    this.state.sequence += 1;
    p.sequence = this.state.sequence;
  }

  private async onRejected(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);
    console.error(`Verification failed: ${address.toString()} ${transcriptNumber}...`);
    p.state = 'INVALIDATED';
    p.runningState = 'COMPLETE';
    p.error = 'verify failed';
    this.state.sequence += 1;
    p.sequence = this.state.sequence;
  }
}
