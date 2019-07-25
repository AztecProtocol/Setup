import { ChildProcess, spawn } from 'child_process';
import { createWriteStream } from 'fs';
import fetch from 'isomorphic-fetch';
import moment = require('moment');
import { MpcServer, MpcState, Participant, ParticipantRunningState } from './setup-mpc-common';

const TRANSCRIPT_PATH = '/usr/src/setup_db/transcript.dat';

export class Compute {
  private proc?: ChildProcess;

  constructor(
    private state: MpcState,
    private myState: Participant,
    private server: MpcServer,
    private computeOffline: boolean
  ) {}

  public async start() {
    const myState = this.myState;

    if (this.computeOffline) {
      await this.updateMyRunningState('OFFLINE');
      return;
    }

    const lastCompletedParticipant = this.state.participants
      .slice()
      .reverse()
      .find(p => p.state === 'COMPLETE');

    if (myState.runningState === 'WAITING') {
      if (lastCompletedParticipant) {
        await this.updateMyRunningState('DOWNLOADING');
      } else {
        await this.updateMyRunningState('COMPUTING');
      }
    }

    if (myState.runningState === 'DOWNLOADING') {
      const readStream = await this.server.downloadData(lastCompletedParticipant!.address);
      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(TRANSCRIPT_PATH);
        writeStream.on('close', resolve);
        readStream.on('error', err => reject(err));
        readStream.pipe(writeStream);
      });
      await this.updateMyRunningState('COMPUTING');
    }

    if (myState.runningState === 'COMPUTING') {
      await this.compute();
      this.updateMyRunningState('UPLOADING');
    }

    if (myState.runningState === 'UPLOADING') {
      await this.server.uploadData(myState.address, TRANSCRIPT_PATH);
    }
  }

  public cancel() {
    if (this.proc) {
      this.proc.kill('SIGINT');
    }
  }

  private async compute() {
    return new Promise((resolve, reject) => {
      const { SETUP_PATH = '../setup-tools/setup', POLYNOMIAL_DEGREE = '0x10000' } = process.env;
      const setup = spawn(SETUP_PATH, [POLYNOMIAL_DEGREE]);
      this.proc = setup;

      setup.stdout.on('data', data => {
        this.updateMyProgress(Number(data));
      });

      setup.stderr.on('data', data => {
        console.error(data.toString());
      });

      setup.on('close', code => {
        this.proc = undefined;
        console.error(`child process exited with code ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`setup exited with code ${code}`));
        }
      });
    });
  }

  private async updateMyRunningState(runningState: ParticipantRunningState) {
    console.error(`${this.myState.runningState} => ${runningState}`);
    this.myState.runningState = runningState;
    this.myState.lastUpdate = moment();
    await this.server.updateParticipant(this.myState);
  }

  private async updateMyProgress(progress: number) {
    this.myState.progress = progress;
    this.myState.lastUpdate = moment();
    await this.server.updateParticipant(this.myState);
  }
}
