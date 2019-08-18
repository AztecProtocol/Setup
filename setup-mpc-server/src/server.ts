import moment, { Moment } from 'moment';
import { MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { StateStore } from './state-store';
import { TranscriptStore } from './transcript-store';
import { Verifier } from './verifier';

const OFFLINE_AFTER = 10;

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifier!: Verifier;
  private state!: MpcState;

  constructor(private store: TranscriptStore, private stateStore: StateStore) {}

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
    const lastCompleteParticipant = this.getLastCompleteParticipant();
    const runningParticipant = this.getRunningParticipant();
    this.verifier.lastCompleteAddress = lastCompleteParticipant && lastCompleteParticipant.address;
    this.verifier.runningAddress = runningParticipant && runningParticipant.address;
    this.verifier.run();

    // Get any files awaiting verification and add to the queue.
    if (runningParticipant) {
      const unverified = await this.store.getUnverified(runningParticipant.address);
      unverified.forEach(item => this.verifier.put(item));
    }

    this.scheduleAdvanceState();
  }

  public async getState(sequence?: number): Promise<MpcState> {
    return {
      ...this.state,
      participants:
        sequence === undefined ? this.state.participants : this.state.participants.filter(p => p.sequence > sequence),
    };
  }

  public async resetState(
    startTime: Moment,
    numG1Points: number,
    numG2Points: number,
    pointsPerTranscript: number,
    invalidateAfter: number,
    participants: Address[]
  ) {
    if (this.verifier) {
      this.verifier.cancel();
    }
    this.state.sequence += 1;
    this.state = {
      sequence: this.state.sequence,
      statusSequence: this.state.sequence,
      ceremonyState: 'PRESELECTION',
      numG1Points,
      numG2Points,
      startTime,
      invalidateAfter,
      pointsPerTranscript,
      participants: [],
    };
    participants.forEach(address => this.addNextParticipant(address));
    await this.persistState();
    this.verifier = new Verifier(this.store, numG1Points, numG2Points, this.verifierCallback.bind(this));
    this.verifier.run();
  }

  private addNextParticipant(address: Address) {
    const participant: Participant = {
      sequence: this.state.sequence,
      online: false,
      state: 'WAITING',
      runningState: 'WAITING',
      position: this.state.participants.length + 1,
      priority: this.state.participants.length + 1,
      tier: 1,
      computeProgress: 0,
      verifyProgress: 0,
      transcripts: [],
      address,
    };
    this.state.participants.push(participant);
    return participant;
  }

  public async addParticipant(address: Address) {
    this.state.sequence += 1;
    this.addNextParticipant(address);
    await this.persistState();
  }

  private scheduleAdvanceState() {
    this.interval = setTimeout(async () => {
      try {
        await this.advanceState();
      } finally {
        this.scheduleAdvanceState();
      }
    }, 500);
  }

  public stop() {
    clearInterval(this.interval!);
  }

  protected async advanceState() {
    let writeState = false;
    const state = this.state;

    const { sequence, startTime, completedAt, invalidateAfter, participants } = state;
    const nextSequence = sequence + 1;

    try {
      // Shift any participants that haven't performed an update recently to offline state and reorder accordingly.
      if (this.markIdleParticipantsOffline(nextSequence)) {
        this.orderWaitingParticipants(nextSequence);
        writeState = true;
      }

      if (state.ceremonyState === 'PRESELECTION') {
        // TODO
        state.statusSequence = nextSequence;
        state.ceremonyState = 'SELECTED';
        writeState = true;
      }

      // Nothing to do if not yet running, or already completed.
      if (moment().isBefore(startTime) || completedAt) {
        return;
      }

      // Shift to running state if not already.
      if (state.ceremonyState !== 'RUNNING') {
        state.statusSequence = nextSequence;
        state.ceremonyState = 'RUNNING';
        writeState = true;
      }

      // If all participants are done, shift ceremony to complete state.
      if (participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
        state.statusSequence = nextSequence;
        state.ceremonyState = 'COMPLETE';
        state.completedAt = moment();
        writeState = true;
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
          writeState = true;
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
        writeState = true;
      }
    } finally {
      if (writeState) {
        state.sequence = nextSequence;
        await this.persistState();
      }
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
    const p = this.getParticipant(address);

    p.lastUpdate = moment();

    if (p.online === false) {
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
      p.sequence = this.state.sequence;
      p.online = true;
      this.orderWaitingParticipants(this.state.sequence);
      await this.persistState();
    }
  }

  public async updateParticipant(participantData: Participant) {
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
    await this.persistState();
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
    if (verified) {
      await this.onVerified(address, transcriptNumber);
    } else {
      await this.onRejected(address, transcriptNumber);
    }
  }

  private async onVerified(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);

    p.transcripts[transcriptNumber].complete = true;

    if (p.transcripts.every(t => t.complete)) {
      // Every transcript in clients transcript list is verified. We still need to verify the set
      // as a whole. This just checks the total number of G1 and G2 points is as expected.
      const fullyVerified = await this.verifier.verifyTranscriptSet(p.address);

      if (p.state !== 'RUNNING') {
        // Abort update if state changed during verification process (timed out).
        return;
      }

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

    await this.persistState();
  }

  private async onRejected(address: Address, transcriptNumber: number) {
    const p = this.getParticipant(address);
    console.error(`Verification failed: ${address.toString()} ${transcriptNumber}...`);
    p.state = 'INVALIDATED';
    p.runningState = 'COMPLETE';
    p.error = 'verify failed';
    this.state.sequence += 1;
    p.sequence = this.state.sequence;

    await this.persistState();
  }

  private async persistState() {
    await this.stateStore.setState(this.state);
  }
}
