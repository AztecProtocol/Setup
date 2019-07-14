import { MpcServer, Participant, INVALIDATED_AFTER, MpcState, ParticipantRunningState } from './mpc-server';
import { Wallet } from 'web3x/wallet';
import moment, { Moment } from 'moment';

const TEST_BAD_THINGS = false;

export class DemoServer implements MpcServer {
  private wallet: Wallet;
  private state: MpcState;
  private youIndex?: number;

  constructor(numParticipants: number, private startTime: Moment) {
    this.wallet = new Wallet(numParticipants);

    const participants = this.wallet.currentAddresses().map(
      (address, i): Participant => ({
        state: 'WAITING',
        runningState: 'WAITING',
        position: i + 1,
        progress: 0,
        address,
      })
    );

    this.state = {
      startTime,
      participants,
    };
  }

  private advanceState() {
    if (moment().isBefore(this.startTime)) {
      return;
    }

    const { completedAt, participants } = this.state;

    if (!completedAt && participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
      this.state.completedAt = moment();
    }

    const i = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    const p = participants[i];

    if (!p) {
      return;
    }

    if (p.state === 'WAITING') {
      p.startedAt = moment();
      p.state = 'RUNNING';
      return;
    }

    if (
      moment()
        .subtract(INVALIDATED_AFTER, 's')
        .isAfter(p.startedAt!)
    ) {
      p.state = 'INVALIDATED';
      this.advanceState();
      return;
    }

    if (i === this.youIndex) {
      // Only simulate other users.
      return;
    }

    if (TEST_BAD_THINGS && (i === 1 || i === 3)) {
      // Exceptional case: Simulate user offline for 10 seconds.
      if (
        i === 1 &&
        moment()
          .subtract(10, 's')
          .isAfter(p.startedAt!)
      ) {
        p.completedAt = moment();
        p.state = 'COMPLETE';
        this.advanceState();
      }

      // Exceptional case: Simulate a user that never participates.
      if (
        i === 3 &&
        moment()
          .subtract(INVALIDATED_AFTER, 's')
          .isAfter(p.startedAt!)
      ) {
        p.state = 'INVALIDATED';
        this.advanceState();
      }

      return;
    }

    p.lastUpdate = moment();

    if (p.runningState === 'WAITING') {
      if (i === 4) {
        p.runningState = 'OFFLINE';
        setTimeout(() => {
          p.completedAt = moment();
          p.state = 'COMPLETE';
        }, 15000);
      } else {
        p.runningState = 'DOWNLOADING';
        setTimeout(() => {
          p.runningState = 'COMPUTING';
        }, 2000 + Math.random() * 2000);
      }
      return;
    }

    if (p.runningState === 'COMPUTING') {
      p.progress += Math.floor(3 + Math.random() * 5);
      if (p.progress >= 100) {
        p.runningState = 'UPLOADING';
        setTimeout(() => {
          p.completedAt = moment();
          p.runningState = 'COMPLETE';
          p.state = 'COMPLETE';
          this.advanceState();
        }, 2000 + Math.random() * 2000);
      }
      return;
    }
  }

  async getState(): Promise<MpcState> {
    const state = {
      ...this.state,
      participants: this.state.participants.map(p => ({ ...p })),
    };
    this.advanceState();
    return state;
  }

  async updateRunningState(i: number, runningState: ParticipantRunningState) {
    this.state.participants[i].runningState = runningState;
    return this.getState();
  }

  getPrivateKeyAt(i: number) {
    return this.wallet.get(i)!.privateKey;
  }

  setYouIndex(i: number) {
    this.youIndex = i;
  }
}
