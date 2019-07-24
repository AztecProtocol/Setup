import { MpcServer, MpcState, Participant } from './mpc-server';
import fetch from 'isomorphic-fetch';
import moment = require('moment');
import { Address } from 'web3x/address';
import { Account } from 'web3x/account';
import { createReadStream, existsSync } from 'fs';
import FormData from 'form-data';
import { bufferToHex } from 'web3x/utils';
import { hashFiles } from './hash-files';

export class HttpClient implements MpcServer {
  constructor(private host: string, private account?: Account) {}

  async getState(): Promise<MpcState> {
    const response = await fetch(`http://${this.host}/state`);
    if (response.status !== 200) {
      throw new Error(`Bad status code from server: ${response.status}`);
    }
    const { startTime, completedAt, participants } = await response.json();

    return {
      startTime: moment(startTime),
      completedAt: completedAt ? moment(completedAt) : undefined,
      participants: participants.map(({ startedAt, lastUpdated, completedAt, address, ...rest }: any) => ({
        ...rest,
        startedAt: startedAt ? moment(startedAt) : undefined,
        lastUpdated: lastUpdated ? moment(lastUpdated) : undefined,
        completedAt: completedAt ? moment(completedAt) : undefined,
        address: Address.fromString(address),
      })),
    };
  }

  async updateParticipant(participant: Participant) {
    if (!this.account) {
      throw new Error('No account provided. Can only request server state, not modify.');
    }
    const { address, runningState, progress, error } = participant;
    const body = JSON.stringify({
      address: address.toString().toLowerCase(),
      runningState,
      progress,
      error,
    });
    const { signature } = this.account.sign(body);
    const response = await fetch(`http://${this.host}/participant/${address.toString().toLowerCase()}`, {
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

  async uploadData(address: Address, transcriptPath: string) {
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

        const formData = new FormData();
        formData.append('transcript', transcriptStream);

        await fetch(`http://${this.host}/data/${address.toString().toLowerCase()}`, {
          method: 'POST',
          body: formData as any,
          headers: {
            'X-Signature': signature,
          },
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
