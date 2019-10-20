import { S3 } from 'aws-sdk';
import BN from 'bn.js';
import { EventEmitter } from 'events';
import readline from 'readline';
import { MpcState } from 'setup-mpc-common';
import { PassThrough } from 'stream';

export class RangeProofPublisherFactory {
  constructor(private jobServerHost: string) {}

  public create(state: MpcState) {
    return new RangeProofPublisher(state, this.jobServerHost);
  }
}

export class RangeProofPublisher extends EventEmitter {
  private cancelled = false;
  private s3: S3;

  constructor(private state: MpcState, private jobServerHost: string) {
    super();
    this.s3 = new S3();
  }

  public async run() {
    let rangeProofProgress = this.state.rangeProofProgress;
    const { name, rangeProofsPerFile, rangeProofSize } = this.state;

    if (rangeProofProgress === rangeProofSize) {
      return;
    }

    const remainingSignatures = rangeProofSize - rangeProofProgress;
    console.log(`Creating job server jobs: from=${rangeProofProgress} num=${remainingSignatures}`);
    await fetch(`http://${this.jobServerHost}/create-jobs?from=${rangeProofProgress}&num=${remainingSignatures}`);

    while (true) {
      try {
        const remainingSignatures = rangeProofSize - rangeProofProgress;
        const toRequest = Math.min(rangeProofsPerFile, remainingSignatures);
        const responseStream = await this.getResultStream(rangeProofProgress, toRequest);
        if (!responseStream) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          if (this.cancelled) {
            return;
          }
          continue;
        }

        const filename = `data${rangeProofProgress.toString()}.dat`;
        const key = `${name}/range_proofs/${filename}`;
        await this.upload(responseStream, key);
        rangeProofProgress += toRequest;
        this.emit('progress', rangeProofProgress);
        if (rangeProofProgress === rangeProofSize || this.cancelled) {
          return;
        }
      } catch (err) {
        console.error('Range proof publisher failed (will retry): ', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.cancelled) {
          return;
        }
      }
    }
  }

  private async getResultStream(from: number, num: number) {
    const response = await fetch(`http://${this.jobServerHost}/result?from=${from}&num=${num}`);
    if (response.status === 404) {
      return;
    }
    if (response.status !== 200 || response.body == null) {
      throw new Error('Error from job server.');
    }
    const compressionMask = new BN('8000000000000000000000000000000000000000000000000000000000000000', 16);
    const responseStream = new PassThrough();

    readline
      .createInterface({
        input: response.body as any,
        terminal: false,
      })
      .on('line', line => {
        const [xhex, yhex] = JSON.parse(line);
        const x = new BN(xhex.slice(2), 16);
        const y = new BN(yhex.slice(2), 16);
        let compressed = x;
        if (y.testn(0)) {
          compressed = compressed.or(compressionMask);
        }
        const buf = compressed.toBuffer('be', 32);
        responseStream.write(buf);
      })
      .on('close', () => {
        responseStream.end();
      });

    return responseStream;
  }

  public cancel() {
    this.cancelled = true;
  }

  private async upload(body: S3.Body, key: string) {
    while (true) {
      try {
        console.log(`Range proof uploading: ${key}`);
        await new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
          const managedUpload = this.s3.upload({
            Body: body,
            Bucket: 'aztec-ignition',
            Key: key,
            ACL: 'public-read',
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
