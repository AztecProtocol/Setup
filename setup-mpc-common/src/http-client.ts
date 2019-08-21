import { createReadStream, existsSync, statSync } from 'fs';
import fetch from 'isomorphic-fetch';
import { Moment } from 'moment';
import progress from 'progress-stream';
import { Readable } from 'stream';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { bufferToHex } from 'web3x/utils';
import { hashFiles } from './hash-files';
import { MpcServer, MpcState, Participant } from './mpc-server';
import { mpcStateFromJSON } from './mpc-state';

export class HttpClient implements MpcServer {
  constructor(private apiUrl: string, private account?: Account) {}

  public async resetState(
    startTime: Moment,
    startBlock: number,
    selectBlock: number,
    maxTier2: number,
    numG1Points: number,
    numG2Points: number,
    pointsPerTranscript: number,
    invalidateAfter: number,
    participants: Address[]
  ) {
    throw new Error('Not implemented.');
  }

  public async addParticipant(address: Address, tier: number) {
    throw new Error('Not implemented.');
  }

  public async getState(sequence?: number): Promise<MpcState> {
    const url = new URL(`${this.apiUrl}/state`);
    if (sequence !== undefined) {
      url.searchParams.append('sequence', `${sequence}`);
    }
    const response = await fetch(url.toString());
    if (response.status !== 200) {
      throw new Error(`Bad status code from server: ${response.status}`);
    }
    const json = await response.json();

    return mpcStateFromJSON(json);
  }

  public async ping(address: Address) {
    if (!this.account) {
      throw new Error('No account provided. Can only request server state, not modify.');
    }
    const { signature } = this.account.sign('ping');
    const response = await fetch(`${this.apiUrl}/ping/${address.toString().toLowerCase()}`, {
      method: 'GET',
      headers: {
        'X-Signature': signature,
      },
    });
    if (response.status !== 200) {
      throw new Error(`Bad status code from server: ${response.status}`);
    }
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
    progressCb?: (transferred: number) => void
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
          progStream.on('progress', progress => progressCb(progress.transferred));
        }
        transcriptStream.pipe(progStream);

        const response = await fetch(`${this.apiUrl}/data/${address.toString().toLowerCase()}/${transcriptNumber}`, {
          method: 'PUT',
          body: progStream as any,
          headers: {
            'X-Signature': signature,
            'Content-Type': 'application/octet-stream',
            'Content-Length': `${stats.size}`,
          },
        });

        if (response.status !== 200) {
          throw new Error(`Uplaod failed, bad status code: ${response.status}`);
        }

        resolve();
      } catch (err) {
        if (progressCb) {
          progressCb(0);
        }
        reject(err);
      }
    });
  }
}
