import { ChildProcess, spawn } from 'child_process';
import moment = require('moment');
import { MpcServer, Participant, ParticipantRunningState } from './setup-mpc-common';

export class Compute {
  private proc?: ChildProcess;

  constructor(private myState: Participant, private server: MpcServer, private computeOffline: boolean) {}

  public async start() {
    const myState = this.myState;

    if (this.computeOffline) {
      await this.updateMyRunningState('OFFLINE');
      return;
    }

    if (myState.runningState === 'WAITING') {
      if (myState.transcriptUrl) {
        await this.updateMyRunningState('DOWNLOADING');
      } else {
        await this.updateMyRunningState('COMPUTING');
      }
    }

    if (myState.runningState === 'DOWNLOADING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.updateMyRunningState('COMPUTING');
    }

    if (myState.runningState === 'COMPUTING') {
      await this.compute();
      this.updateMyRunningState('UPLOADING');
    }

    if (myState.runningState === 'UPLOADING') {
      const transcriptPath = '/usr/src/setup_db/transcript.dat';
      await this.server.uploadData(myState.address, transcriptPath);
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
