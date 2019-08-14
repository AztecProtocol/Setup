import moment from 'moment';
import { Wallet } from 'web3x/wallet';
import { Server } from './server';
import { StateStore } from './state-store';
import { TranscriptStore } from './transcript-store';

const TEST_BAD_THINGS: number[] = [];

export class DemoServer extends Server {
  private wallet: Wallet;

  constructor(
    numParticipants: number,
    store: TranscriptStore,
    stateStore: StateStore,
    private youIndicies: number[] = []
  ) {
    super(store, stateStore);
    this.wallet = Wallet.fromMnemonic(
      'face cook metal cost prevent term foam drive sure caught pet gentle',
      numParticipants
    );
  }

  public async addParticipants() {
    for (const address of this.wallet.currentAddresses()) {
      await super.addParticipant(address);
    }
  }

  protected async advanceState() {
    await super.advanceState();

    const { participants } = await this.getState();

    const i = participants.findIndex(p => p.state === 'WAITING' || p.state === 'RUNNING');
    const p = participants[i];

    if (this.youIndicies.includes(i)) {
      // Only simulate other users.
      return;
    }

    if (TEST_BAD_THINGS.includes(i)) {
      // Exceptional case: Simulate user offline for 10 seconds.
      if (i === 1) {
        if (
          moment()
            .subtract(20, 's')
            .isAfter(p.startedAt!)
        ) {
          p.completedAt = moment();
          p.state = 'COMPLETE';
          this.advanceState();
        }
        return;
      }

      if (i === 2) {
        if (p.verifyProgress > 0) {
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
          await this.advanceState();
          return;
        }
      }

      // Exceptional case: Simulate a user that never participates.
      if (i === 3) {
        return;
      }
    }

    p.lastUpdate = moment();

    if (p.runningState === 'WAITING') {
      p.runningState = 'RUNNING';
      p.transcripts = [
        {
          num: 0,
          size: 100,
          downloaded: 0,
          uploaded: 0,
          complete: false,
        },
      ];
    }

    if (p.runningState === 'RUNNING') {
      p.transcripts[0].downloaded = Math.min(100, p.transcripts[0].downloaded + 2.13);
      if (p.transcripts[0].downloaded > 20) {
        p.computeProgress = Math.min(100, p.computeProgress + 2.13);
      }
      if (p.computeProgress > 20) {
        p.transcripts[0].uploaded = Math.min(100, p.transcripts[0].uploaded + 2.13);
      }
      if (p.transcripts[0].uploaded > 20) {
        p.verifyProgress = Math.min(100, p.verifyProgress + 2.13);
      }
      if (p.verifyProgress >= 100) {
        p.state = 'COMPLETE';
        p.completedAt = moment();
        p.runningState = 'COMPLETE';
        this.advanceState();
      }
    }
  }
}
