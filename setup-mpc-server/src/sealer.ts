import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import readline from 'readline';
import { CRS, G1, G2, MpcState } from 'setup-mpc-common';
import { Readable } from 'stream';
import { existsAsync, mkdirAsync, renameAsync } from './fs-async';
import { TranscriptStore } from './transcript-store';

export class Sealer extends EventEmitter {
  private proc?: ChildProcess;
  private sealingPath: string;
  private cancelled = false;

  constructor(private transcriptStore: TranscriptStore) {
    super();
    this.sealingPath = transcriptStore.getSealedPath();
  }

  public async run(state: MpcState): Promise<CRS | undefined> {
    while (true) {
      try {
        if (state.sealingProgress < 100) {
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
        }

        return {
          h: await this.generateH(state.numG1Points),
          t2: await this.getFinalG2Point(),
        };
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
    if (this.proc) {
      this.proc.kill('SIGINT');
      this.proc = undefined;
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
      const binPath = '../setup-tools/seal';
      const proc = (this.proc = spawn(binPath, [this.sealingPath]));

      readline
        .createInterface({
          input: proc.stdout,
          terminal: false,
        })
        .on('line', this.handleSetupOutput);

      proc.stderr.on('data', data => console.error(data.toString()));

      proc.on('close', code => {
        this.proc = undefined;
        if (code === 0 || this.cancelled) {
          console.error(`Sealing complete or cancelled.`);
          resolve();
        } else {
          reject(new Error(`seal exited with code ${code}`));
        }
      });

      proc.on('error', reject);
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

  private async getFinalG2Point(): Promise<G2> {
    return new Promise((resolve, reject) => {
      const binPath = '../setup-tools/print_point';
      const proc = spawn(binPath, [`${this.sealingPath}/transcript0.dat`, 'g2', '0']);

      readline
        .createInterface({
          input: proc.stdout,
          terminal: false,
        })
        .on('line', line => resolve(JSON.parse(line)));

      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`print_point exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private async fetchGenerator(numG1Points: number) {
    const generatorPath = this.transcriptStore.getGeneratorPath(numG1Points);
    if (!(await existsAsync(generatorPath))) {
      await new Promise(async (resolve, reject) => {
        const response = await fetch(`https://aztec-ignition.s3-eu-west-2.amazonaws.com/generator${numG1Points}.dat`);
        if (response.status !== 200) {
          reject(new Error(`Bad status code fetching generator: ${response.status}`));
          return;
        }
        const writeStream = createWriteStream(generatorPath);
        writeStream.on('close', resolve);
        ((response.body! as any) as Readable).pipe(writeStream);
      });
    }
    return generatorPath;
  }

  private async generateH(numG1Points: number): Promise<G1> {
    const generatorPath = await this.fetchGenerator(numG1Points);

    return new Promise((resolve, reject) => {
      const binPath = '../setup-tools/generate_h';
      const proc = (this.proc = spawn(binPath, [this.sealingPath, generatorPath]));

      readline
        .createInterface({
          input: proc.stdout,
          terminal: false,
        })
        .on('line', line => resolve(JSON.parse(line)));

      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`generate_h exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }
}
