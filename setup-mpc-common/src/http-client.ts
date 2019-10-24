import { createReadStream, existsSync, statSync } from 'fs';
import http from 'http';
import https from 'https';
import fetch from 'isomorphic-fetch';
import progress from 'progress-stream';
import { Readable } from 'stream';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { bufferToHex } from 'web3x/utils';
import { hashFiles } from './hash-files';
import { MpcServer, MpcState, Participant, PatchState, ResetState } from './mpc-server';
import { mpcStateFromJSON } from './mpc-state';

export class HttpClient implements MpcServer {
  private opts: any = {
    keepalive: true,
  };
  constructor(private apiUrl: string, private account?: Account) {
    this.opts.agent = /^https/.test(apiUrl)
      ? new https.Agent({ keepAlive: true })
      : new http.Agent({ keepAlive: true });
  }

  public async resetState(resetState: ResetState) {
    throw new Error('Not implemented.');
  }

  public async loadState(name: string) {}

  public async patchState(state: PatchState): Promise<MpcState> {
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
    const response = await fetch(url.toString(), this.opts);
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
      ...this.opts,
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
    const { transcripts, address, runningState, computeProgress, error, fast } = participant;
    const body = JSON.stringify({
      address: address.toString().toLowerCase(),
      runningState,
      computeProgress,
      transcripts,
      error,
      fast,
    });
    const { signature } = this.account.sign(body);
    const response = await fetch(`${this.apiUrl}/participant/${address.toString().toLowerCase()}`, {
      ...this.opts,
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
    const response = await fetch(
      `${this.apiUrl}/data/${address.toString().toLowerCase()}/${transcriptNumber}`,
      this.opts
    );
    if (response.status !== 200) {
      throw new Error(`Download failed, bad status code: ${response.status}`);
    }
    return (response.body! as any) as Readable;
  }

  public async downloadSignature(address: Address, transcriptNumber: number) {
    const response = await fetch(
      `${this.apiUrl}/signature/${address.toString().toLowerCase()}/${transcriptNumber}`,
      this.opts
    );
    if (response.status !== 200) {
      throw new Error(`Download failed, bad status code: ${response.status}`);
    }
    return (response.body! as any) as string;
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

        const { signature: pingSig } = this.account.sign('ping');
        const { signature: dataSig } = this.account.sign(bufferToHex(hash));

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
          ...this.opts,
          method: 'PUT',
          body: progStream as any,
          headers: {
            'X-Signature': `${pingSig},${dataSig}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': `${stats.size}`,
          },
        });

        if (response.status !== 200) {
          throw new Error(`Upload failed, bad status code: ${response.status}`);
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
