import { S3 } from 'aws-sdk';
import BN from 'bn.js';
import { EventEmitter } from 'events';
import readline from 'readline';
import { MpcState } from 'setup-mpc-common';
import { PassThrough } from 'stream';

export class RangeProofPublisher extends EventEmitter {
  private cancelled = false;
  private s3: S3;

  constructor(private state: MpcState) {
    super();
    this.s3 = new S3();
  }

  public async run() {
    while (true) {
      try {
        const responseStream = await this.getResultStream(this.state.rangeProofProgress, 1024);
        if (!responseStream) {
          await new Promise(resolve => setTimeout(resolve, 60));
          if (this.cancelled) {
            return;
          }
          continue;
        }

        const filename = `data${this.state.rangeProofProgress.toString()}.dat`;
        const key = `${this.state.startTime.format('YYYYMMDD_HHmmss')}/range_proofs/${filename}`;
        await this.upload(responseStream, key);
        this.state.rangeProofProgress += 1024;
        this.emit('progress', (this.state.rangeProofProgress * 100) / this.state.rangeProofSize);
        if (this.cancelled) {
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
    const response = await fetch(`http://job-server/result?from=${from}&num=${num}`);
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
        const [, xstr, ystr] = line.match(/\((\d+) , (\d+)\)/)!;
        const x = new BN(xstr);
        const y = new BN(ystr);
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
