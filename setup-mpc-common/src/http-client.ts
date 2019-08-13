import { createReadStream, existsSync, statSync } from 'fs';
import fetch from 'isomorphic-fetch';
import moment = require('moment');
import { Moment } from 'moment';
import progress, { Progress } from 'progress-stream';
import { Readable } from 'stream';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { bufferToHex } from 'web3x/utils';
import { hashFiles } from './hash-files';
import { MpcServer, MpcState, Participant } from './mpc-server';

export class HttpClient implements MpcServer {
  constructor(private apiUrl: string, private account?: Account) {}

  public async resetState(startTime: Moment, numG1Points: number, numG2Points: number, invalidateAfter: number) {
    throw new Error('Not implemented.');
  }

  public async getState(): Promise<MpcState> {
    const response = await fetch(`${this.apiUrl}/state`);
    if (response.status !== 200) {
      throw new Error(`Bad status code from server: ${response.status}`);
    }
    const { startTime, completedAt, participants, ...rest } = await response.json();

    return {
      ...rest,
      startTime: moment(startTime),
      completedAt: completedAt ? moment(completedAt) : undefined,
      participants: participants.map(({ startedAt, lastUpdate, completedAt, address, transcripts, ...rest }: any) => ({
        ...rest,
        startedAt: startedAt ? moment(startedAt) : undefined,
        lastUpdate: lastUpdate ? moment(lastUpdate) : undefined,
        completedAt: completedAt ? moment(completedAt) : undefined,
        address: Address.fromString(address),
        transcripts: transcripts.map(({ fromAddress, ...rest }: any) => ({
          ...rest,
          fromAddress: fromAddress ? Address.fromString(fromAddress) : undefined,
        })),
      })),
    };
  }

  public async updateParticipant(participant: Participant) {
    if (!this.account) {
      throw new Error('No account provided. Can only request server state, not modify.');
    }
    const { transcripts, address, runningState, computeProgress, error } = participant;
    const body = JSON.stringify({
      address: address.toString().toLowerCase(),
      runningState,
      computeProgress,
      transcripts,
      error,
    });
    const { signature } = this.account.sign(body);
    const response = await fetch(`${this.apiUrl}/participant/${address.toString().toLowerCase()}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body,
    });
    if (response.status !== 200) {
      throw new Error(`Bad status code from server: ${response.status}`);
    }
  }

  public async downloadData(address: Address, transcriptNumber: number) {
    const response = await fetch(`${this.apiUrl}/data/${address.toString().toLowerCase()}/${transcriptNumber}`);
    if (response.status !== 200) {
      throw new Error(`Download failed, bad status code: ${response.status}`);
    }
    return (response.body! as any) as Readable;
  }

  public async uploadData(
    address: Address,
    transcriptNumber: number,
    transcriptPath: string,
    signaturePath?: string,
    progressCb?: (progress: Progress) => void
  ) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (!this.account) {
          throw new Error('No account provided. Can only request server state, not modify.');
        }

        if (!existsSync(transcriptPath)) {
          throw new Error('Transcript not found.');
        }

        const hash = await hashFiles([transcriptPath]);

        const { signature } = this.account.sign(bufferToHex(hash));

        const transcriptStream = createReadStream(transcriptPath);
        transcriptStream.on('error', error => {
          console.error('Transcript read error: ', error);
          reject(new Error('Failed to read transcript.'));
        });

        const stats = statSync(transcriptPath);
        const progStream = progress({ length: stats.size, time: 1000 });
        if (progressCb) {
          progStream.on('progress', progressCb);
        }
        transcriptStream.pipe(progStream);

        await fetch(`${this.apiUrl}/data/${address.toString().toLowerCase()}/${transcriptNumber}`, {
          method: 'PUT',
          body: progStream as any,
          headers: {
            'X-Signature': signature,
            'Content-Type': 'application/octet-stream',
            'Content-Length': `${stats.size}`,
          },
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
