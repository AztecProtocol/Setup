import { Mutex } from 'async-mutex';
import moment, { Moment } from 'moment';
import { cloneMpcState, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { ParticipantSelector } from './participant-selector';
import { StateStore } from './state-store';
import { TranscriptStore } from './transcript-store';
import { Verifier } from './verifier';

const OFFLINE_AFTER = 10;

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifier!: Verifier;
  private state!: MpcState;
  private readState!: MpcState;
  private mutex = new Mutex();

  constructor(
    private store: TranscriptStore,
    private stateStore: StateStore,
    private participantSelector: ParticipantSelector
  ) {
    this.participantSelector.on('newParticipants', (addresses, latestBlock) =>
      this.addTier2Participants(addresses, latestBlock)
    );
    this.participantSelector.on('selectParticipants', blockHash => this.selectParticipants(blockHash));
  }

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
    latestBlock: number,
    selectBlock: number,
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
      startSequence: this.state.startSequence,
      ceremonyState: 'PRESELECTION',
      numG1Points,
      numG2Points,
      startTime,
      latestBlock,
      selectBlock,
      invalidateAfter,
      pointsPerTranscript,
      participants: [],
    };
    participants.forEach(address => this.addNextParticipant(state, address, 1));

    await this.resetWithState(state);
  }

  private async resetWithState(state: MpcState) {
    this.stop();

    this.state = state;
    this.readState = state;

    this.verifier = await this.createVerifier();
    this.verifier.run();

    await this.participantSelector.restart(state.latestBlock, state.selectBlock);

    this.scheduleAdvanceState();
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

  public async addTier1Participant(address: Address) {
    const release = await this.mutex.acquire();
    this.state.sequence += 1;
    this.addNextParticipant(this.state, address, 1);
    release();
  }

  private async addTier2Participants(addresses: Address[], latestBlock: number) {
    const release = await this.mutex.acquire();
    this.state.sequence += 1;
    this.state.latestBlock = latestBlock;
    addresses.forEach(address => this.addNextParticipant(this.state, address, 2));
    release();
  }

  private selectParticipants(blockHash: any) {}

  private addNextParticipant(state: MpcState, address: Address, tier: number) {
    const participant: Participant = {
      sequence: state.sequence,
      online: false,
      state: 'WAITING',
      runningState: 'WAITING',
      position: state.participants.length + 1,
      priority: state.participants.length + 1,
      tier,
      computeProgress: 0,
      verifyProgress: 0,
      transcripts: [],
      address,
    };
    state.participants.push(participant);
    return participant;
  }

  private scheduleAdvanceState() {
    this.interval = setTimeout(async () => {
      try {
        await this.advanceState();
      } catch (err) {
        console.error(err);
      } finally {
        this.scheduleAdvanceState();
      }
    }, 500);
  }

  protected async advanceState() {
    let stateChanged = false;
    const state = this.state;

    const { sequence, startTime, completedAt, invalidateAfter, participants } = state;
    const nextSequence = sequence + 1;
    const release = await this.mutex.acquire();

    try {
      // Shift any participants that haven't performed an update recently to offline state and reorder accordingly.
      if (this.markIdleParticipantsOffline(nextSequence)) {
        this.orderWaitingParticipants(nextSequence);
        stateChanged = true;
      }

      if (state.ceremonyState === 'PRESELECTION') {
        // TODO
        state.statusSequence = nextSequence;
        state.ceremonyState = 'SELECTED';
        stateChanged = true;
      }

      // Nothing to do if not yet running, or already completed.
      if (moment().isBefore(startTime) || completedAt) {
        return;
      }

      // Shift to running state if not already.
      if (state.ceremonyState !== 'RUNNING') {
        state.statusSequence = nextSequence;
        state.ceremonyState = 'RUNNING';
        stateChanged = true;
      }

      // If all participants are done, shift ceremony to complete state.
      if (participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
        state.statusSequence = nextSequence;
        state.ceremonyState = 'COMPLETE';
        state.completedAt = moment();
        stateChanged = true;
        return;
      }

      // If we have a running participant, mark as invalidated if timed out.
      const runningParticipant = participants.find(p => p.state === 'RUNNING');
      if (runningParticipant) {
        if (
          moment()
            .subtract(invalidateAfter, 's')
            .isAfter(runningParticipant.startedAt!)
        ) {
          runningParticipant.sequence = nextSequence;
          runningParticipant.state = 'INVALIDATED';
          runningParticipant.error = 'timed out';
          stateChanged = true;
        } else {
          return;
        }
      }

      // Find next waiting, online participant and shift them to the running state.
      const waitingParticipant = participants.find(p => p.state === 'WAITING' && p.online);
      if (waitingParticipant && waitingParticipant.state === 'WAITING') {
        await this.store.erase(waitingParticipant.address);
        state.statusSequence = nextSequence;
        waitingParticipant.sequence = nextSequence;
        waitingParticipant.startedAt = moment();
        waitingParticipant.state = 'RUNNING';
        this.verifier.runningAddress = waitingParticipant.address;
        stateChanged = true;
      }
    } finally {
      if (stateChanged) {
        state.sequence = nextSequence;
      }
      await this.stateStore.setState(this.state);
      this.readState = cloneMpcState(state);
      release();
    }
  }

  private markIdleParticipantsOffline(sequence: number) {
    const { participants } = this.state;
    let changed = false;
    participants.forEach(p => {
      if (
        moment()
          .subtract(OFFLINE_AFTER, 's')
          .isAfter(p.lastUpdate!) &&
        p.online
      ) {
        this.state.statusSequence = sequence;
        p.sequence = sequence;
        p.online = false;
        changed = true;
      }
    });
    return changed;
  }

  private orderWaitingParticipants(sequence: number) {
    const { participants } = this.state;
    const indexOfFirstWaiting = participants.findIndex(p => p.state === 'WAITING');

    const waiting = participants.slice(indexOfFirstWaiting).sort((a, b) => {
      if (a.online !== b.online) {
        return a.online ? -1 : 1;
      }
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      return a.priority - b.priority;
    });

    this.state.participants = [...participants.slice(0, indexOfFirstWaiting), ...waiting];

    // Adjust positions based on new order and advance sequence numbers if position changed.
    this.state.participants.forEach((p, i) => {
      if (p.position !== i + 1) {
        p.position = i + 1;
        p.sequence = sequence;
      }
    });
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
        this.orderWaitingParticipants(this.state.sequence);
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

    p.transcripts[transcriptNumber].complete = true;

    if (p.transcripts.every(t => t.complete)) {
      // Every transcript in clients transcript list is verified. We still need to verify the set
      // as a whole. This just checks the total number of G1 and G2 points is as expected.
      const fullyVerified = await this.verifier.verifyTranscriptSet(p.address);

      if (fullyVerified) {
        await this.store.makeLive(address);
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
