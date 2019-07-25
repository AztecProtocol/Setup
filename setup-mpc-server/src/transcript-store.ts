import { createReadStream, mkdirSync, renameSync, writeFileSync } from 'fs';
import { Readable } from 'stream';
import { Address } from 'web3x/address';

export interface TranscriptStore {
  saveTranscript(address: Address, path: string): Promise<void>;
  saveSignature(address: Address, signature: string): Promise<void>;
  loadTranscript(address: Address): Readable;
}

export class DiskTranscriptStore implements TranscriptStore {
  constructor(private storePath: string) {
    mkdirSync(storePath, { recursive: true });
  }

  public async saveTranscript(address: Address, path: string) {
    renameSync(path, `${this.storePath}/transcript_${address.toString().toLowerCase()}.dat`);
  }

  public async saveSignature(address: Address, signature: string) {
    writeFileSync(`${this.storePath}/transcript_${address.toString().toLowerCase()}.sig`, signature);
  }

  public loadTranscript(address: Address) {
    return createReadStream(`${this.storePath}/transcript_${address.toString().toLowerCase()}.dat`);
  }
}
