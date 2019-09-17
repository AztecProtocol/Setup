import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import readline from 'readline';
import { CRS, MpcState } from 'setup-mpc-common';
import { existsAsync, mkdirAsync, renameAsync } from './fs-async';
import { TranscriptStore } from './transcript-store';

export class Sealer extends EventEmitter {
  private sealingProc?: ChildProcess;
  private sealingPath: string;
  private cancelled = false;

  constructor(private transcriptStore: TranscriptStore) {
    super();
    this.sealingPath = transcriptStore.getSealedPath();
  }

  public async run(state: MpcState) {
    while (true) {
      try {
        const previousParticipant = state.participants
          .slice()
          .reverse()
          .find(p => p.state === 'COMPLETE');

        if (!previousParticipant) {
          throw new Error('No previous participant to perform sealing step on.');
        }

        await mkdirAsync(this.sealingPath, { recursive: true });
        await this.transcriptStore.copyVerifiedTo(previousParticipant.address, this.sealingPath);

        if (this.cancelled) {
          return;
        }

        await this.compute();
        await this.renameTranscripts();

        return this.getFinalG2Point();
      } catch (err) {
        console.error('Sealer failed (will retry): ', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.cancelled) {
          return;
        }
      }
    }
  }

  public cancel() {
    this.cancelled = true;
    this.removeAllListeners();
    if (this.sealingProc) {
      this.sealingProc.kill('SIGINT');
      this.sealingProc = undefined;
    }
  }

  private async renameTranscripts() {
    let num = 0;
    while (await existsAsync(`${this.sealingPath}/transcript${num}_out.dat`)) {
      await renameAsync(`${this.sealingPath}/transcript${num}_out.dat`, `${this.sealingPath}/transcript${num}.dat`);
      ++num;
    }
  }

  private async compute() {
    return new Promise((resolve, reject) => {
      const { SETUP_PATH = '../setup-tools/seal' } = process.env;
      const sealingProc = (this.sealingProc = spawn(SETUP_PATH, [this.sealingPath]));

      readline
        .createInterface({
          input: sealingProc.stdout,
          terminal: false,
        })
        .on('line', this.handleSetupOutput);

      sealingProc.stderr.on('data', data => console.error(data.toString()));

      sealingProc.on('close', code => {
        this.sealingProc = undefined;
        if (code === 0 || this.cancelled) {
          console.error(`Sealing complete or cancelled.`);
          resolve();
        } else {
          reject(new Error(`seal exited with code ${code}`));
        }
      });

      sealingProc.on('error', reject);
    });
  }

  private handleSetupOutput = (data: Buffer) => {
    console.error('From seal: ', data.toString());
    const params = data
      .toString()
      .replace('\n', '')
      .split(' ');
    const cmd = params.shift()!;
    switch (cmd) {
      case 'progress': {
        this.emit('progress', +params[0]);
        break;
      }
    }
  };

  private async getFinalG2Point(): Promise<CRS> {
    return new Promise((resolve, reject) => {
      const { SETUP_PATH = '../setup-tools/print_point' } = process.env;
      const printProc = spawn(SETUP_PATH, [`${this.sealingPath}/transcript0.dat`, 'g2', '0']);

      readline
        .createInterface({
          input: printProc.stdout,
          terminal: false,
        })
        .on('line', line => resolve(JSON.parse(line)));

      printProc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`print_point exited with code ${code}`));
        }
      });

      printProc.on('error', reject);
    });
  }
}
