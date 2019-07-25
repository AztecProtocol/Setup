import { spawn } from 'child_process';
import moment, { Moment } from 'moment';
import { Address } from 'web3x/address';
import { Wallet } from 'web3x/wallet';
import { INVALIDATED_AFTER, MpcServer, MpcState, Participant } from './setup-mpc-common';
import { TranscriptStore } from './transcript-store';

const TEST_BAD_THINGS: number[] = [];

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  protected state: MpcState = { startTime: moment(), participants: [] };

  constructor(private store: TranscriptStore) {}

  public setState(state: MpcState) {
    this.state = state;
  }

  public async getState(): Promise<MpcState> {
    return this.state;
  }

  public resetState(startTime: Moment) {
    this.setState({ startTime, participants: [] });
  }

  public start() {
    this.interval = setInterval(() => this.advanceState(), 500);
  }

  public stop() {
    clearInterval(this.interval!);
  }

  protected advanceState() {
    if (moment().isBefore(this.state.startTime)) {
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
        .isAfter(p.startedAt!) &&
      p.runningState !== 'VERIFYING'
    ) {
      p.state = 'INVALIDATED';
      p.error = 'timed out';
      this.advanceState();
      return;
    }
  }

  public async updateParticipant(participantData: Participant) {
    const { address, runningState, progress, error } = participantData;
    const p = this.getRunningParticipant(address);
    p.runningState = runningState;
    p.progress = progress;
    p.error = error;
    p.lastUpdate = moment();
  }

  public async downloadData(address: Address) {
    return this.store.loadTranscript(address);
  }

  public async uploadData(address: Address, transcriptPath: string, signature: string) {
    const p = this.getRunningParticipant(address);
    p.runningState = 'VERIFYING';
    p.lastUpdate = moment();

    if (await this.verifyTranscript(transcriptPath)) {
      await this.store.saveTranscript(address, transcriptPath);
      await this.store.saveSignature(address, signature);

      p.state = 'COMPLETE';
      p.runningState = 'COMPLETE';
      p.lastUpdate = moment();
      p.completedAt = moment();
    } else {
      p.state = 'INVALIDATED';
      p.runningState = 'COMPLETE';
      p.error = 'verify failed';
      p.lastUpdate = moment();
    }
  }

  private async verifyTranscript(transcriptPath: string) {
    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify', POLYNOMIAL_DEGREE = '0x10000' } = process.env;
      const verify = spawn(VERIFY_PATH, [transcriptPath, POLYNOMIAL_DEGREE]);

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        console.error(`child process exited with code ${code}`);
        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private getRunningParticipant(address: Address) {
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

export class DemoServer extends Server {
  private wallet: Wallet;

  constructor(numParticipants: number, store: TranscriptStore, private youIndicies: number[] = []) {
    super(store);
    this.wallet = Wallet.fromMnemonic(
      'face cook metal cost prevent term foam drive sure caught pet gentle',
      numParticipants
    );
  }

  public resetState(startTime: Moment) {
    this.setState(this.getNewState(startTime));
  }

  private getNewState(startTime: Moment) {
    const participants = this.wallet.currentAddresses().map(
      (address, i): Participant => ({
        state: 'WAITING',
        runningState: 'WAITING',
        position: i + 1,
        progress: 0,
        address,
      })
    );

    return {
      startTime,
      participants,
    };
  }

  protected advanceState() {
    if (moment().isBefore(this.state.startTime)) {
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
      p.error = 'timed out';
      this.advanceState();
      return;
    }

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
        if (p.runningState === 'VERIFYING') {
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
          this.advanceState();
          return;
        }
      }

      // Exceptional case: Simulate a user that never participates.
      if (i === 3) {
        if (
          moment()
            .subtract(INVALIDATED_AFTER, 's')
            .isAfter(p.startedAt!)
        ) {
          p.state = 'INVALIDATED';
          p.error = 'timed out';
          this.advanceState();
        }
        return;
      }
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
        }, 3000);
      }
      return;
    }

    if (p.runningState === 'COMPUTING') {
      p.progress = Math.min(100, p.progress + Math.floor(3 + Math.random() * 5));
      if (p.progress >= 100) {
        p.runningState = 'UPLOADING';
        setTimeout(() => {
          p.runningState = 'VERIFYING';
          this.advanceState();
        }, 3000);
      }
      return;
    }

    if (p.runningState === 'VERIFYING') {
      setTimeout(() => {
        p.completedAt = moment();
        p.runningState = 'COMPLETE';
        p.state = 'COMPLETE';
        this.advanceState();
      }, 3000);
    }
  }
}
