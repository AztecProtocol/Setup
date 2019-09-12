import { S3 } from 'aws-sdk';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { Moment } from 'moment';
import moment = require('moment');
import { MpcState, Participant } from 'setup-mpc-common';
import { TranscriptStore } from './transcript-store';

export class Publisher extends EventEmitter {
  private cancelled = false;
  private s3: S3;
  private progressAccumulator = 0;

  constructor(private transcriptStore: TranscriptStore, private state: MpcState) {
    super();
    this.s3 = new S3();
  }

  public async run() {
    while (true) {
      try {
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

        return;
      } catch (err) {
        console.error('Publisher failed (will retry): ', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  public cancel() {
    this.cancelled = true;
  }

  private async getTotalSize(participants: Participant[]) {
    const sizeOfOne = (await this.transcriptStore.getVerified(participants[0]!.address)).reduce(
      (a, p) => a + p.size,
      0
    );
    return sizeOfOne * (participants.length + 1);
  }

  private async publishParticipant(participant: Participant, totalSize: number) {
    const { address, position } = participant;
    const records = await this.transcriptStore.getVerified(address, true);
    for (const { path, size, num } of records) {
      const folder = `${position.toString().padStart(3, '0')}_${address.toString().toLowerCase()}`;
      const filename = `transcript${num.toString().padStart(2, '0')}.${path.split('.')[1]}`;
      const key = `${this.state.startTime.format('YYYYMMDD_HHmmss')}/${folder}/${filename}`;
      const body = createReadStream(path);
      await this.upload(body, key, size, totalSize);
      if (this.cancelled) {
        break;
      }
    }
  }

  private async publishSealedTranscripts(totalSize: number) {
    const records = await this.transcriptStore.getSealed();
    for (const { path, size, num } of records) {
      const filename = `transcript${num.toString().padStart(2, '0')}.dat`;
      const key = `${this.state.startTime.format('YYYYMMDD_HHmmss')}/sealed/${filename}`;
      const body = createReadStream(path);
      await this.upload(body, key, size, totalSize);
      if (this.cancelled) {
        return;
      }
    }
  }

  private async publishCeremonyManifest() {
    const { numG1Points, numG2Points, pointsPerTranscript, startTime, participants } = this.state;
    const manifest = {
      numG1Points,
      numG2Points,
      pointsPerTranscript,
      startTime,
      completedAt: moment(),
      participants: participants
        .filter(p => p.state === 'COMPLETE')
        .map(({ address, position, startedAt, completedAt }) => ({
          address,
          position,
          startedAt,
          completedAt,
        })),
    };
    const key = `${startTime.format('YYYYMMDD_HHmmss')}/manifest.json`;
    await this.upload(JSON.stringify(manifest, undefined, 2), key, 0, 0, 'application/json');
  }

  private async publishIndex() {
    const key = `${this.state.startTime.format('YYYYMMDD_HHmmss')}/index.html`;
    const body = createReadStream('./s3-explorer/index.html');
    await this.upload(body, key, 0, 0, 'text/html');
  }

  private async upload(body: S3.Body, key: string, size: number, totalSize: number, contentType?: string) {
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
          this.emit('progress', ((this.progressAccumulator + progress.loaded) * 100) / totalSize);
        });
      }

      managedUpload.send((err, data) => {
        if (err) {
          return reject(err);
        }
        this.progressAccumulator += size;
        return resolve(data);
      });
    });
  }
}
