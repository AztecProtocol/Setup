import { S3 } from 'aws-sdk';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import readline from 'readline';
import { CRS, G1, G2, MpcState } from 'setup-mpc-common';
import { existsAsync, mkdirAsync, renameAsync } from './fs-async';
import { TranscriptStore } from './transcript-store';

class CancelledError extends Error {}

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
            throw new CancelledError();
          }

          await this.compute();
          await this.renameTranscripts();
        }

        // Prepare g1x data for post processing and upload.
        const g1xPath = this.transcriptStore.getG1xPrepPath();
        await this.prepRangeData(this.sealingPath, g1xPath);
        await this.upload('aztec-post-process', createReadStream(g1xPath), `${state.name}/g1x_prep.dat`);

        if (this.cancelled) {
          throw new CancelledError();
        }

        const generatorPath = await this.fetchOrComputeGenerator(state.rangeProofKmax);

        return {
          h: await this.generateH(generatorPath, g1xPath, state.rangeProofKmax),
          t2: await this.getFinalG2Point(),
        };
      } catch (err) {
        if (err instanceof CancelledError) {
          console.error('Sealer cancelled.');
          return;
        }
        console.error('Sealer failed: ', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        if (this.cancelled) {
          reject(new CancelledError());
        } else if (code === 0) {
          console.error(`Sealing complete.`);
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

  private async fetchOrComputeGenerator(kmax: number) {
    const generatorPath = this.transcriptStore.getGeneratorPath(kmax);

    if (!(await existsAsync(generatorPath))) {
      console.log(`Generator coefficients not found at ${generatorPath}, will compute.`);

      await this.computeGenerator(generatorPath, kmax);
      await Promise.all([
        this.upload('aztec-post-process', createReadStream(generatorPath), `generator${kmax}.dat`),
        this.upload('aztec-ignition', createReadStream(generatorPath), `generator${kmax}.dat`),
      ]);
    }

    return generatorPath;
  }

  private async computeGenerator(generatorPath: string, kmax: number): Promise<G1> {
    return new Promise((resolve, reject) => {
      const binPath = '../setup-tools/compute_generator_polynomial';
      const proc = (this.proc = spawn(binPath, [kmax.toString(), generatorPath]));

      proc.on('close', code => {
        if (this.cancelled) {
          reject(new CancelledError());
        } else if (code !== 0) {
          reject(new Error(`compute_generator_polynomial exited with code ${code}`));
          return;
        }
        resolve();
      });

      proc.on('error', reject);
    });
  }

  private async prepRangeData(inputDir: string, outputPath: string): Promise<G1> {
    return new Promise((resolve, reject) => {
      const binPath = '../setup-tools/prep_range_data';
      const proc = (this.proc = spawn(binPath, [inputDir, outputPath]));

      proc.on('close', code => {
        if (this.cancelled) {
          reject(new CancelledError());
        } else if (code !== 0) {
          reject(new Error(`prep_range_data exited with code ${code}`));
          return;
        }
        resolve();
      });

      proc.on('error', reject);
    });
  }

  private async generateH(generatorPath: string, g1xPath: string, kmax: number): Promise<G1> {
    return new Promise((resolve, reject) => {
      const binPath = '../setup-tools/generate_h';
      const proc = (this.proc = spawn(binPath, [generatorPath, g1xPath, kmax.toString()]));

      readline
        .createInterface({
          input: proc.stdout,
          terminal: false,
        })
        .on('line', line => resolve(JSON.parse(line)));

      proc.on('close', code => {
        if (this.cancelled) {
          reject(new CancelledError());
        } else if (code !== 0) {
          reject(new Error(`generate_h exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private async upload(bucket: string, body: S3.Body, key: string, contentType?: string) {
    const s3 = new S3();
    while (true) {
      try {
        console.log(`Uploading to ${bucket}: ${key}`);
        await new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
          const managedUpload = s3.upload({
            Body: body,
            Bucket: bucket,
            Key: key,
            ACL: 'public-read',
            ContentType: contentType,
          });

          managedUpload.send((err, data) => {
            if (err) {
              return reject(err);
            }
            return resolve(data);
          });
        });

        return;
      } catch (err) {
        console.error(`Upload of ${key} failed. Will retry.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.cancelled) {
          return;
        }
      }
    }
  }
}
