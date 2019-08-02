import { spawn } from 'child_process';
import { unlink } from 'fs';
import moment, { Moment } from 'moment';
import { MemoryFifo, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { Wallet } from 'web3x/wallet';
import { TranscriptStore } from './transcript-store';

const TEST_BAD_THINGS: number[] = [];

interface VerifyItem {
  participant: Participant;
  transcriptNumber: number;
  transcriptPath: string;
  signature: string;
}

export class Server implements MpcServer {
  private interval?: NodeJS.Timer;
  private verifyQueue: MemoryFifo<VerifyItem> = new MemoryFifo();
  protected state!: MpcState;

  constructor(private store: TranscriptStore) {
    this.verifier().catch(console.error);
  }

  public setState(state: MpcState) {
    this.state = state;
  }

  public async getState(): Promise<MpcState> {
    return this.state;
  }

  public resetState(startTime: Moment, numG1Points: number, numG2Points: number, invalidateAfter: number) {
    this.setState({ numG1Points, numG2Points, startTime, invalidateAfter, participants: [] });
  }

  public addParticipant(address: Address) {
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

    const { completedAt, invalidateAfter, participants } = this.state;

    if (!completedAt && participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
      this.state.completedAt = moment();
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
      return;
    }

    if (
      moment()
        .subtract(invalidateAfter, 's')
        .isAfter(p.startedAt!)
    ) {
      p.state = 'INVALIDATED';
      p.error = 'timed out';
      this.advanceState();
      return;
    }
  }

  public async updateParticipant(participantData: Participant) {
    const { transcripts, address, runningState, computeProgress, error } = participantData;
    const p = this.getRunningParticipant(address);
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
    const participant = this.getRunningParticipant(address);
    this.verifyQueue.put({ participant, transcriptNumber, transcriptPath, signature });
  }

  private async verifier() {
    while (true) {
      const item = await this.verifyQueue.get();
      if (!item) {
        return;
      }
      const { participant, transcriptNumber, transcriptPath, signature } = item;
      const { address } = participant;

      try {
        const p = this.getRunningParticipant(address);

        if (!p.transcripts[transcriptNumber]) {
          throw new Error(`Unknown transcript number: ${transcriptNumber}`);
        }

        if (await this.verifyTranscript(participant, transcriptNumber, transcriptPath)) {
          console.error(`Verification succeeded: ${transcriptPath}...`);

          await this.store.saveTranscript(address, transcriptNumber, transcriptPath);
          await this.store.saveSignature(address, transcriptNumber, signature);

          p.transcripts[transcriptNumber].complete = true;
          p.lastUpdate = moment();

          if (p.transcripts.every(t => t.complete)) {
            // Every transcript in clients transcript list is verified. We still need to verify the set
            // as a whole. This just checks the total number of G1 and G2 points is as expected.
            if (await this.verifyTranscriptSet(p)) {
              p.state = 'COMPLETE';
              p.runningState = 'COMPLETE';
              p.completedAt = moment();
            } else {
              console.error(`Verification of set failed for ${p.address}...`);
              p.state = 'INVALIDATED';
              p.runningState = 'COMPLETE';
              p.error = 'verify failed';
            }
          }
        } else {
          console.error(`Verification failed: ${transcriptPath}...`);
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
        }
      } catch (err) {
        console.error(err);
      } finally {
        unlink(transcriptPath, () => {});
      }
    }
  }

  private async verifyTranscript(participant: Participant, transcriptNumber: number, transcriptPath: string) {
    const args = [transcriptPath];
    args.push(transcriptNumber === 0 ? transcriptPath : this.store.getTranscriptPath(participant.address, 0));
    if (transcriptNumber === 0) {
      const lastCompleteParticipant = this.getLastCompleteParticipant();
      if (lastCompleteParticipant) {
        args.push(this.store.getTranscriptPath(lastCompleteParticipant.address, 0));
      }
    } else {
      args.push(this.store.getTranscriptPath(participant.address, transcriptNumber - 1));
    }

    console.error(`Verifiying transcript ${transcriptNumber}...`);
    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify' } = process.env;
      const verify = spawn(VERIFY_PATH, args);

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        if (code === 0) {
          participant.verifyProgress = ((transcriptNumber + 1) / participant.transcripts.length) * 100;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private async verifyTranscriptSet(participant: Participant) {
    const { numG1Points, numG2Points } = this.state;
    const args = [
      numG1Points.toString(),
      numG2Points.toString(),
      ...this.store.getTranscriptPaths(participant.address),
    ];

    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify_set' } = process.env;
      const verify = spawn(VERIFY_PATH, args);

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        resolve(code === 0 ? true : false);
      });
    });
  }

  private getLastCompleteParticipant() {
    return this.state.participants.find(p => p.state === 'COMPLETE');
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

  public resetState(startTime: Moment, numG1Points: number, numG2Points: number, invalidateAfter: number) {
    super.resetState(startTime, numG1Points, numG2Points, invalidateAfter);
    this.wallet.currentAddresses().forEach(address => super.addParticipant(address));
  }

  protected advanceState() {
    if (moment().isBefore(this.state.startTime)) {
      return;
    }

    const { completedAt, invalidateAfter, participants } = this.state;

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
        .subtract(invalidateAfter, 's')
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

      /*
      if (i === 2) {
        if (p.runningState === 'VERIFYING') {
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
          this.advanceState();
          return;
        }
      }
      */

      // Exceptional case: Simulate a user that never participates.
      if (i === 3) {
        if (
          moment()
            .subtract(invalidateAfter, 's')
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
