import { Mutex } from 'async-mutex';
import moment, { Moment } from 'moment';
import { cloneMpcState, EthNet, MpcServer, MpcState, Participant, PatchState, ResetState } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { getGeoData } from './maxmind';
import { ParticipantSelector, ParticipantSelectorFactory } from './participant-selector';
import { Publisher } from './publisher';
import { RangeProofPublisher, RangeProofPublisherFactory } from './range-proof-publisher';
import { Sealer } from './sealer';
import { StateStore } from './state-store';
import { advanceState } from './state/advance-state';
import { createParticipant } from './state/create-participant';
import { orderWaitingParticipants } from './state/order-waiting-participants';
import { resetParticipant } from './state/reset-participant';
import { selectParticipants } from './state/select-participants';
import { TranscriptStore, TranscriptStoreFactory } from './transcript-store';
import { Verifier } from './verifier';

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifier!: Verifier;
  private state!: MpcState;
  private readState!: MpcState;
  private mutex = new Mutex();
  private participantSelector?: ParticipantSelector;
  private sealer?: Sealer;
  private publisher?: Publisher;
  private rangeProofPublisher?: RangeProofPublisher;
  private store!: TranscriptStore;

  constructor(
    private storeFactory: TranscriptStoreFactory,
    private stateStore: StateStore,
    private participantSelectorFactory: ParticipantSelectorFactory,
    private rangeProofPublisherFactory: RangeProofPublisherFactory
  ) {}

  public async start() {
    // Take a copy of the state from the state store.
    const state = await this.stateStore.getState();
    await this.resetWithState(state);
  }

  public stop() {
    clearInterval(this.interval!);

    if (this.sealer) {
      this.sealer.cancel();
      this.sealer = undefined;
    }

    if (this.publisher) {
      this.publisher.cancel();
      this.publisher = undefined;
    }

    if (this.rangeProofPublisher) {
      this.rangeProofPublisher.cancel();
      this.rangeProofPublisher = undefined;
    }

    if (this.participantSelector) {
      this.participantSelector.stop();
    }

    if (this.verifier) {
      this.verifier.cancel();
    }
  }

  private async createUniqueCeremonyName(name: string) {
    // Ensure name is unique.
    if (await this.stateStore.exists(name)) {
      let n = 1;
      while (await this.stateStore.exists(`${name}_${n}`)) {
        ++n;
      }
      return name + `_${n}`;
    }
    return name;
  }

  public async resetState(resetState: ResetState) {
    await this.stateStore.saveState();

    const nextSequence = this.state.sequence + 1;
    const state: MpcState = {
      name: await this.createUniqueCeremonyName(resetState.name),
      sequence: nextSequence,
      statusSequence: nextSequence,
      startSequence: nextSequence,
      ceremonyState: 'PRESELECTION',
      paused: false,
      numG1Points: resetState.numG1Points,
      numG2Points: resetState.numG2Points,
      startTime: resetState.startTime,
      endTime: resetState.endTime,
      network: resetState.network,
      latestBlock: resetState.latestBlock,
      selectBlock: resetState.selectBlock,
      maxTier2: resetState.maxTier2,
      minParticipants: resetState.minParticipants,
      invalidateAfter: resetState.invalidateAfter,
      pointsPerTranscript: resetState.pointsPerTranscript,
      sealingProgress: 0,
      publishProgress: 0,
      rangeProofKmax: resetState.rangeProofKmax,
      rangeProofSize: resetState.rangeProofSize,
      rangeProofProgress: 0,
      rangeProofsPerFile: resetState.rangeProofsPerFile,
      participants: [],
    };

    if (resetState.participants0.length) {
      resetState.participants0.forEach(address => this.addNextParticipant(state, address, 0));
    }
    if (resetState.participants1.length) {
      resetState.participants1.forEach(address => this.addNextParticipant(state, address, 1));
    }
    if (resetState.participants2.length) {
      resetState.participants2.forEach(address => this.addNextParticipant(state, address, 2));
    }

    await this.resetWithState(state);
  }

  public async flushWaiting() {
    const release = await this.mutex.acquire();
    try {
      this.state.participants = this.state.participants.filter(p => p.state !== 'WAITING');
      this.state.sequence += 1;
      // Force clients to re-request entire state.
      this.state.startSequence += this.state.sequence;
      this.state.latestBlock = -1;

      if (this.participantSelector) {
        this.participantSelector.stop();
        this.participantSelector = undefined;
      }
    } finally {
      release();
    }
  }

  public async loadState(name: string) {
    await this.stateStore.saveState();
    const state = await this.stateStore.restoreState(name);
    await this.resetWithState(state);
  }

  public async patchState(state: PatchState) {
    const release = await this.mutex.acquire();
    switch (this.state.ceremonyState) {
      case 'COMPLETE':
      case 'RANGE_PROOFS':
        delete state.rangeProofKmax;
        delete state.rangeProofSize;
        delete state.rangeProofsPerFile;
      case 'PUBLISHING':
      case 'SEALING':
        delete state.endTime;
        delete state.invalidateAfter;
        delete state.minParticipants;
      case 'RUNNING':
        delete state.startTime;
        delete state.numG1Points;
        delete state.numG2Points;
        delete state.pointsPerTranscript;
      case 'SELECTED':
        delete state.selectBlock;
        delete state.maxTier2;
    }

    this.state = {
      ...this.state,
      ...state,
    };

    if (this.state.latestBlock < 0 && this.participantSelector) {
      this.participantSelector.stop();
      this.participantSelector = undefined;
    }

    this.readState = cloneMpcState(this.state);
    release();
    return this.readState;
  }

  private async resetWithState(state: MpcState) {
    this.stop();

    {
      const release = await this.mutex.acquire();

      // If we have a running participant, reset their lastVerified time to give them additional
      // time on current chunk. Not fair to penalise them when we restarted the server.
      const running = state.participants.find(p => p.state === 'RUNNING');
      if (running) {
        running.lastVerified = moment();
      }

      this.state = state;
      this.readState = cloneMpcState(state);
      release();
    }

    this.store = this.storeFactory.create(state.name);

    this.verifier = await this.createVerifier();
    this.verifier.run();

    if (state.latestBlock >= 0) {
      this.participantSelector = this.createParticipantSelector(state.network, state.latestBlock, state.selectBlock);
      this.participantSelector.run();
    }

    this.scheduleAdvanceState();
  }

  private createParticipantSelector(ethNet: EthNet, latestBlock: number, selectBlock: number) {
    const participantSelector = this.participantSelectorFactory.create(ethNet, latestBlock, selectBlock);
    participantSelector.on('newParticipants', (addresses, latestBlock) => this.addParticipants(addresses, latestBlock));
    participantSelector.on('selectParticipants', blockHash => this.selectParticipants(blockHash));
    return participantSelector;
  }

  private async createVerifier() {
    const verifier = new Verifier(
      this.store,
      this.state.numG1Points,
      this.state.numG2Points,
      this.state.pointsPerTranscript,
      this.verifierCallback.bind(this)
    );
    const lastCompleteParticipant = this.getLastCompleteParticipant();
    const runningParticipant = this.getRunningParticipant();
    verifier.lastCompleteAddress = lastCompleteParticipant && lastCompleteParticipant.address;
    verifier.runningAddress = runningParticipant && runningParticipant.address;

    // Get any files awaiting verification and add to the queue.
    if (runningParticipant) {
      const { address, transcripts } = runningParticipant;
      const unverified = await this.store.getUnverified(address);
      unverified
        .filter(uv => transcripts[uv.num].state !== 'COMPLETE')
        .forEach(item => verifier.put({ address, ...item }));
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
    this.state.participants = orderWaitingParticipants(this.state.participants, this.state.sequence);
    release();
  }

  private async addParticipants(addresses: Address[], latestBlock: number) {
    const release = await this.mutex.acquire();
    this.state.latestBlock = latestBlock;
    if (addresses.length || this.state.ceremonyState === 'PRESELECTION') {
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
      if (addresses.length) {
        console.log(
          `Adding participants from block ${latestBlock}:`,
          addresses.map(a => a.toString())
        );
        addresses.forEach(address => this.addNextParticipant(this.state, address, 3));
      }
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

      if (this.state.ceremonyState === 'SEALING' && !this.sealer) {
        this.launchSealer();
      }

      if (this.state.ceremonyState === 'PUBLISHING' && !this.publisher) {
        this.launchPublisher();
      }

      if (this.state.ceremonyState === 'RANGE_PROOFS' && !this.rangeProofPublisher) {
        this.launchRangeProofsPublisher();
      }
    } catch (err) {
      console.log(err);
    } finally {
      await this.stateStore.setState(this.state);
      this.readState = cloneMpcState(this.state);
      release();
    }

    this.scheduleAdvanceState();
  }

  private launchSealer() {
    this.sealer = new Sealer(this.store);
    this.sealer.on('progress', progress => {
      this.state.sealingProgress = progress;
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
    this.sealer.run(this.state).then(crs => {
      if (this.state.ceremonyState !== 'SEALING') {
        // Server was reset.
        return;
      }
      this.state.crs = crs;
      this.state.ceremonyState = 'PUBLISHING';
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
  }

  private launchPublisher() {
    this.publisher = new Publisher(this.store, this.state);
    this.publisher.on('progress', progress => {
      this.state.publishProgress = progress;
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
    this.publisher.run().then(publishPath => {
      if (this.state.ceremonyState !== 'PUBLISHING') {
        // Server was reset.
        return;
      }
      this.state.ceremonyState = this.state.rangeProofSize ? 'RANGE_PROOFS' : 'COMPLETE';
      this.state.publishPath = publishPath;
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
  }

  private launchRangeProofsPublisher() {
    this.rangeProofPublisher = this.rangeProofPublisherFactory.create(this.state);
    this.rangeProofPublisher.on('progress', progress => {
      this.state.rangeProofProgress = progress;
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
    this.rangeProofPublisher.run().then(() => {
      if (this.state.ceremonyState !== 'RANGE_PROOFS') {
        // Server was reset.
        return;
      }
      this.state.ceremonyState = 'COMPLETE';
      this.state.completedAt = moment();
      this.state.sequence += 1;
      this.state.statusSequence = this.state.sequence;
    });
  }

  public async ping(address: Address, ip?: string) {
    const release = await this.mutex.acquire();
    try {
      const p = this.getParticipant(address);

      p.lastUpdate = moment();

      if (p.online === false) {
        this.state.sequence += 1;
        this.state.statusSequence = this.state.sequence;
        if (ip && p.state === 'WAITING') {
          p.location = getGeoData(ip);
        }
        p.sequence = this.state.sequence;
        p.online = true;

        this.state.participants = orderWaitingParticipants(this.state.participants, this.state.sequence);
      }
    } finally {
      release();
    }
  }

  public async updateParticipant(participantData: Participant, admin: boolean = false) {
    const release = await this.mutex.acquire();
    try {
      const { state, transcripts, address, runningState, computeProgress, invalidateAfter, fast } = participantData;
      const p = admin ? this.getParticipant(address) : this.getAndAssertRunningParticipant(address);
      this.state.sequence += 1;
      p.sequence = this.state.sequence;
      if (admin) {
        // Fields that administrator can adjust.
        if (invalidateAfter) {
          if (p.lastVerified) {
            p.lastVerified = moment();
          }
          p.invalidateAfter = invalidateAfter;
        }
        if (state && state === 'WAITING' && p.state === 'INVALIDATED') {
          resetParticipant(this.state, p, invalidateAfter);
        }
      } else {
        if (transcripts) {
          // Only update transcript fields that are permitted.
          p.transcripts.forEach((t, i) => {
            t.size = transcripts[i].size;
            t.downloaded = transcripts[i].downloaded;
            t.uploaded = transcripts[i].uploaded;
          });
        }
        p.fast = fast;
        p.runningState = runningState;
        p.computeProgress = computeProgress;
        p.lastUpdate = moment();
        p.online = true;
      }
    } finally {
      release();
    }
  }

  public async downloadData(address: Address, num: number) {
    return this.store.loadTranscript(address, num);
  }

  public async downloadSignature(address: Address, num: number) {
    return this.store.getTranscriptSignature(address, num);
  }

  public async uploadData(address: Address, transcriptNumber: number, transcriptPath: string, signaturePath: string) {
    const p = this.getAndAssertRunningParticipant(address);

    // If we have any transcripts >= to this one, they must all be invalidated. If the verifier is running just reject
    // outright and client can try again once verifier is complete. Enables safe client restarts.
    const gteCurrent = p.transcripts.filter(t => t.num >= transcriptNumber);
    if (gteCurrent.some(t => t.state !== 'WAITING')) {
      if (await this.verifier.active()) {
        throw new Error('Upload of older transcript rejected until verifier inactive.');
      }
      for (const t of gteCurrent) {
        console.log(`Setting transcript ${t.num} to be WAITING.`);
        await this.store.eraseUnverified(address, transcriptNumber);
        t.state = 'WAITING';
      }
    }

    await this.store.save(address, transcriptNumber, transcriptPath, signaturePath);
    p.transcripts[transcriptNumber].state = 'VERIFYING';
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
      const p = this.getParticipant(address);

      if (p.state !== 'RUNNING') {
        // Abort update if state changed during verification process (timed out).
        return;
      }

      if (verified) {
        await this.onVerified(p, transcriptNumber);
      } else {
        await this.onRejected(p, transcriptNumber);
      }
    } finally {
      release();
    }
  }

  private async onVerified(p: Participant, transcriptNumber: number) {
    p.lastVerified = moment();
    p.transcripts[transcriptNumber].state = 'COMPLETE';
    p.verifyProgress = ((transcriptNumber + 1) / p.transcripts.length) * 100;

    if (p.transcripts.every(t => t.state === 'COMPLETE')) {
      await this.store.makeLive(p.address);
      p.state = 'COMPLETE';
      p.runningState = 'COMPLETE';
      // Don't need transcripts anymore. If we don't clear them, state size will increase over time.
      p.transcripts = [];
      // We may not have yet received final state update from the client, and once we're no longer
      // running we won't process the update. Force compute progress to 100%.
      p.computeProgress = 100;
      p.completedAt = moment();
      this.verifier.lastCompleteAddress = p.address;
    }

    p.lastUpdate = moment();
    this.state.sequence += 1;
    p.sequence = this.state.sequence;
  }

  private async onRejected(p: Participant, transcriptNumber: number) {
    console.log(`Verification failed: ${p.address.toString()} ${transcriptNumber}...`);
    if (p.runningState === 'OFFLINE') {
      // If participant is computing offline, we'll be more lenient and give them a chance to retry.
      p.transcripts[transcriptNumber].uploaded = 0;
      return;
    }
    // Otherwise, *bang*, you're dead.
    p.state = 'INVALIDATED';
    p.runningState = 'COMPLETE';
    p.transcripts = [];
    p.error = 'verify failed';
    this.state.sequence += 1;
    p.sequence = this.state.sequence;
  }
}
