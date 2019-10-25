import { S3 } from 'aws-sdk';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import moment = require('moment');
import { extname } from 'path';
import { MpcState, Participant } from 'setup-mpc-common';
import { TranscriptStore } from './transcript-store';

export class Publisher extends EventEmitter {
  private cancelled = false;
  private s3: S3;
  private progressAccumulator = 0;
  private progressInFlight: { [key: string]: number } = {};
  private s3Folder: string;

  constructor(private transcriptStore: TranscriptStore, private state: MpcState) {
    super();
    this.s3 = new S3();
    this.s3Folder = this.state.name;
  }

  public async run() {
    while (true) {
      try {
        this.progressAccumulator = 0;
        const participants = this.state.participants.filter(p => p.state === 'COMPLETE');

        const totalSize = await this.getTotalSize(participants);

        for (const p of participants) {
          await this.publishParticipant(p, totalSize);
          if (this.cancelled) {
            return;
          }
        }

        await this.publishSealedTranscripts(totalSize);

        if (this.cancelled) {
          return;
        }

        await this.publishCeremonyManifest();
        await this.publishIndex();

        return `https://aztec-ignition.s3.eu-west-2.amazonaws.com/index.html#${this.s3Folder}/`;
      } catch (err) {
        console.log('Publisher failed (will retry): ', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.cancelled) {
          return;
        }
      }
    }
  }

  public cancel() {
    this.cancelled = true;
  }

  private async getTotalSize(participants: Participant[]) {
    if (!participants.length) {
      return 0;
    }
    const records = await this.transcriptStore.getVerified(participants[0].address, true);
    const sizeOfOne = records.reduce((a, p) => a + p.size, 0);
    const sizeOfSealed = records.filter(r => r.path.endsWith('.dat')).reduce((a, p) => a + p.size, 0);
    return sizeOfOne * participants.length + sizeOfSealed;
  }

  private async publishParticipant(participant: Participant, totalSize: number) {
    const { address, position } = participant;
    const records = await this.transcriptStore.getVerified(address, true);
    await Promise.all(
      records.map(async ({ path, size, num }) => {
        const folder = `${position.toString().padStart(3, '0')}_${address.toString().toLowerCase()}`;
        const filename = `transcript${num.toString().padStart(2, '0')}${extname(path)}`;
        const key = `${this.s3Folder}/${folder}/${filename}`;
        const body = createReadStream(path);
        await this.upload(body, key, size, totalSize);
      })
    );
  }

  private async publishSealedTranscripts(totalSize: number) {
    const records = await this.transcriptStore.getSealed();
    await Promise.all(
      records.map(async ({ path, size, num }) => {
        const filename = `transcript${num.toString().padStart(2, '0')}.dat`;
        const key = `${this.s3Folder}/sealed/${filename}`;
        const body = createReadStream(path);
        await this.upload(body, key, size, totalSize);
        if (this.cancelled) {
          return;
        }
      })
    );
  }

  private async publishCeremonyManifest() {
    const {
      name,
      numG1Points,
      numG2Points,
      pointsPerTranscript,
      rangeProofKmax,
      rangeProofSize,
      rangeProofsPerFile,
      network,
      selectBlock,
      startTime,
      participants,
      crs,
    } = this.state;
    const manifest = {
      name,
      numG1Points,
      numG2Points,
      pointsPerTranscript,
      rangeProofKmax,
      rangeProofSize,
      rangeProofsPerFile,
      network,
      selectBlock,
      startTime,
      completedAt: moment(),
      participants: participants
        .filter(p => p.state === 'COMPLETE')
        .map(({ address, position, priority, startedAt, completedAt }) => ({
          address,
          position,
          priority,
          startedAt,
          completedAt,
        })),
      invalidated: participants
        .filter(p => p.state === 'INVALIDATED')
        .map(({ address, position, priority, startedAt, error }) => ({
          address,
          position,
          priority,
          startedAt,
          error,
        })),
      crs,
    };
    const key = `${this.s3Folder}/manifest.json`;
    await this.upload(JSON.stringify(manifest, undefined, 2), key, 0, 0, 'application/json');
  }

  private async publishIndex() {
    const key = `index.html`;
    const body = createReadStream('./src/s3-explorer/index.html');
    await this.upload(body, key, 0, 0, 'text/html');
  }

  private async upload(body: S3.Body, key: string, size: number, totalSize: number, contentType?: string) {
    while (true) {
      try {
        console.log(`Publisher uploading: ${key}`);
        await new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
          const managedUpload = this.s3.upload({
            Body: body,
            Bucket: 'aztec-ignition',
            Key: key,
            ACL: 'public-read',
            ContentType: contentType,
          });

          if (totalSize) {
            managedUpload.on('httpUploadProgress', progress => {
              this.progressInFlight[key] = progress.loaded;
              const inFlight = Object.values(this.progressInFlight).reduce((a, b) => a + b, 0);
              const percent = ((this.progressAccumulator + inFlight) * 100) / totalSize;
              this.emit('progress', percent);
            });
          }

          managedUpload.send((err, data) => {
            delete this.progressInFlight[key];
            if (err) {
              return reject(err);
            }
            if (totalSize) {
              this.progressAccumulator += size;
            }
            return resolve(data);
          });
        });

        return;
      } catch (err) {
        console.log(`Upload of ${key} failed. Will retry.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.cancelled) {
          return;
        }
      }
    }
  }
}
