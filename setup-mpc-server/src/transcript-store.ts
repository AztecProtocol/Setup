import { createReadStream, mkdirSync } from 'fs';
import moment = require('moment');
import { Readable } from 'stream';
import { Address } from 'web3x/address';
import {
  copyFileAsync,
  existsAsync,
  mkdirAsync,
  readdirAsync,
  readFileAsync,
  renameAsync,
  rmdirAsync,
  statAsync,
  unlinkAsync,
} from './fs-async';

export interface TranscriptStoreRecord {
  num: number;
  size: number;
  path: string;
}

export interface TranscriptStore {
  save(address: Address, num: number, transcriptPath: string, signaturePath: string): Promise<void>;
  loadTranscript(address: Address, num: number): Readable;
  getTranscriptSignature(address: Address, num: number): Promise<string>;
  makeLive(address: Address): Promise<void>;
  getVerifiedTranscriptPath(address: Address, num: number): string;
  getVerifiedSignaturePath(address: Address, num: number): string;
  getUnverifiedTranscriptPath(address: Address, num: number): string;
  getUnverifiedSignaturePath(address: Address, num: number): string;
  getVerified(address: Address, includeSignatures?: boolean): Promise<TranscriptStoreRecord[]>;
  getUnverified(address: Address, includeSignatures?: boolean): Promise<TranscriptStoreRecord[]>;
  eraseAll(address: Address): Promise<void>;
  eraseUnverified(address: Address, num?: number): Promise<void>;
  copyVerifiedTo(address: Address, path: string): Promise<void>;
  getGeneratorPath(size: number): string;
  getSealedPath(): string;
  getSealed(): Promise<TranscriptStoreRecord[]>;
  getG1xPrepPath(): string;
}

export interface TranscriptStoreFactory {
  create(name: string): TranscriptStore;
}

export class DiskTranscriptStoreFactory implements TranscriptStoreFactory {
  constructor(private storePath: string) {}

  public create(name: string) {
    return new DiskTranscriptStore(`${this.storePath}/${name}`);
  }
}

export class DiskTranscriptStore implements TranscriptStore {
  private unverifiedPath: string;
  private verifiedPath: string;
  private sealingPath: string;
  private generatorsPath: string;
  private fileRegex = /transcript(\d+).(dat|sig)$/;

  constructor(private storePath: string) {
    this.verifiedPath = storePath + '/verified';
    this.unverifiedPath = storePath + '/unverified';
    this.sealingPath = storePath + '/sealed';
    this.generatorsPath = storePath + '/../generators';
    mkdirSync(this.verifiedPath, { recursive: true });
    mkdirSync(this.unverifiedPath, { recursive: true });
    mkdirSync(this.sealingPath, { recursive: true });
    mkdirSync(this.generatorsPath, { recursive: true });
  }

  public async save(address: Address, num: number, transcriptPath: string, signaturePath: string) {
    await mkdirAsync(`${this.unverifiedPath}/${address.toString().toLowerCase()}`, { recursive: true });
    await renameAsync(transcriptPath, this.getUnverifiedTranscriptPath(address, num));
    await renameAsync(signaturePath, this.getUnverifiedSignaturePath(address, num));
  }

  public async makeLive(address: Address) {
    await renameAsync(this.getUnverifiedBasePath(address), this.getVerifiedBasePath(address));
  }

  public loadTranscript(address: Address, num: number) {
    return createReadStream(this.getVerifiedTranscriptPath(address, num));
  }

  public async getTranscriptSignature(address: Address, num: number) {
    return (await readFileAsync(this.getVerifiedSignaturePath(address, num))).toString();
  }

  private getVerifiedBasePath(address: Address) {
    return `${this.verifiedPath}/${address.toString().toLowerCase()}`;
  }

  private getUnverifiedBasePath(address: Address) {
    return `${this.unverifiedPath}/${address.toString().toLowerCase()}`;
  }

  public getVerifiedTranscriptPath(address: Address, num: number) {
    return `${this.getVerifiedBasePath(address)}/transcript${num}.dat`;
  }

  public getVerifiedSignaturePath(address: Address, num: number) {
    return `${this.getVerifiedBasePath(address)}/transcript${num}.sig`;
  }

  public getUnverifiedTranscriptPath(address: Address, num: number) {
    return `${this.getUnverifiedBasePath(address)}/transcript${num}.dat`;
  }

  public getUnverifiedSignaturePath(address: Address, num: number) {
    return `${this.getUnverifiedBasePath(address)}/transcript${num}.sig`;
  }

  private async getDirRecords(dir: string, includeSignatures: boolean) {
    if (!(await existsAsync(dir))) {
      return [];
    }
    let files = await readdirAsync(dir);
    if (!includeSignatures) {
      files = files.filter(path => path.endsWith('.dat'));
    }
    const results = await Promise.all(
      files.map(async file => {
        const path = `${dir}/${file}`;
        const match = file.match(this.fileRegex)!;
        const stats = await statAsync(path);
        return {
          path,
          size: stats.size,
          num: +match[1],
        };
      })
    );
    return results.sort((a, b) => a.num - b.num);
  }

  public async getVerified(address: Address, includeSignatures?: boolean) {
    return this.getDirRecords(this.getVerifiedBasePath(address), !!includeSignatures);
  }

  public async getUnverified(address: Address, includeSignatures?: boolean) {
    return this.getDirRecords(this.getUnverifiedBasePath(address), !!includeSignatures);
  }

  public async eraseAll(address: Address) {
    await this.eraseVerified(address);
    await this.eraseUnverified(address);
  }

  private async eraseVerified(address: Address) {
    try {
      const dir = this.getVerifiedBasePath(address);
      if (!(await existsAsync(dir))) {
        return;
      }
      const files = await readdirAsync(dir);
      for (const file of files) {
        await unlinkAsync(`${dir}/${file}`);
      }
      await rmdirAsync(this.getVerifiedBasePath(address));
    } catch (err) {
      console.error(err);
    }
  }

  public async eraseUnverified(address: Address, num?: number) {
    try {
      const dir = this.getUnverifiedBasePath(address);
      if (!(await existsAsync(dir))) {
        return;
      }
      if (num) {
        await unlinkAsync(this.getUnverifiedTranscriptPath(address, num));
      } else {
        const files = await readdirAsync(dir);
        for (const file of await files) {
          await unlinkAsync(`${dir}/${file}`);
        }
        await rmdirAsync(this.getUnverifiedBasePath(address));
      }
    } catch (err) {
      console.error(err);
    }
  }

  public async copyVerifiedTo(address: Address, path: string) {
    let num = 0;
    while (await existsAsync(this.getVerifiedTranscriptPath(address, num))) {
      await copyFileAsync(this.getVerifiedTranscriptPath(address, num), `${path}/transcript${num}.dat`);
      ++num;
    }
  }

  public getSealedPath() {
    return this.sealingPath;
  }

  public async getSealed() {
    return this.getDirRecords(this.sealingPath, false);
  }

  public getGeneratorPath(size: number) {
    return `${this.generatorsPath}/generator${size}.dat`;
  }

  public getG1xPrepPath() {
    return `${this.storePath}/g1x_prep.dat`;
  }
}
