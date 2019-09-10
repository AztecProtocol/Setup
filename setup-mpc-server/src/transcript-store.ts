import { createReadStream, mkdirSync } from 'fs';
import moment = require('moment');
import { Moment } from 'moment';
import { Readable } from 'stream';
import { Address } from 'web3x/address';
import {
  copyFileAsync,
  existsAsync,
  mkdirAsync,
  readdirAsync,
  renameAsync,
  rmdirAsync,
  statAsync,
  unlinkAsync,
} from './fs-async';

export interface TranscriptStore {
  save(address: Address, num: number, transcriptPath: string, signaturePath: string): Promise<void>;
  getUnverifiedTranscriptPath(address: Address, num: number): string;
  getUnverifiedSignaturePath(address: Address, num: number): string;
  makeLive(address: Address): Promise<void>;
  loadTranscript(address: Address, num: number): Readable;
  getTranscriptPath(address: Address, num: number): string;
  getVerifiedTranscriptPaths(address: Address): Promise<string[]>;
  getUnverifiedTranscriptPaths(address: Address): Promise<string[]>;
  getVerified(address: Address): Promise<{ size: number; num: number }[]>;
  getUnverified(address: Address): Promise<{ address: Address; num: number }[]>;
  eraseAll(address: Address): Promise<void>;
  eraseUnverified(address: Address, num?: number): Promise<void>;
  copyVerifiedTo(address: Address, path: string): Promise<void>;
  getSealingPath(): string;
}

export interface TranscriptStoreFactory {
  create(ceremonyStartTime: Moment): TranscriptStore;
}

export class DiskTranscriptStoreFactory implements TranscriptStoreFactory {
  constructor(private storePath: string) {}

  public create(ceremonyStartTime: Moment) {
    return new DiskTranscriptStore(`${this.storePath}/${ceremonyStartTime.format('YYYYMMDD_HHmmss')}`);
  }
}

export class DiskTranscriptStore implements TranscriptStore {
  private unverifiedPath: string;
  private verifiedPath: string;
  private sealingPath: string;
  private datFileRegex = /transcript(\d+).dat$/;

  constructor(storePath: string) {
    this.verifiedPath = storePath + '/verified';
    this.unverifiedPath = storePath + '/unverified';
    this.sealingPath = storePath + '/sealed';
    mkdirSync(this.verifiedPath, { recursive: true });
    mkdirSync(this.unverifiedPath, { recursive: true });
    mkdirSync(this.sealingPath, { recursive: true });
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
    return createReadStream(this.getTranscriptPath(address, num));
  }

  private getVerifiedBasePath(address: Address) {
    return `${this.verifiedPath}/${address.toString().toLowerCase()}`;
  }

  private getUnverifiedBasePath(address: Address) {
    return `${this.unverifiedPath}/${address.toString().toLowerCase()}`;
  }

  public getTranscriptPath(address: Address, num: number) {
    return `${this.getVerifiedBasePath(address)}/transcript${num}.dat`;
  }

  public getSignaturePath(address: Address, num: number) {
    return `${this.getVerifiedBasePath(address)}/transcript${num}.sig`;
  }

  public getUnverifiedTranscriptPath(address: Address, num: number) {
    return `${this.getUnverifiedBasePath(address)}/transcript${num}.dat`;
  }

  public getUnverifiedSignaturePath(address: Address, num: number) {
    return `${this.getUnverifiedBasePath(address)}/transcript${num}.sig`;
  }

  public async getVerifiedTranscriptPaths(address: Address) {
    let num = 0;
    const paths: string[] = [];
    while (await existsAsync(this.getTranscriptPath(address, num))) {
      paths.push(this.getTranscriptPath(address, num));
      ++num;
    }
    return paths;
  }

  public async getUnverifiedTranscriptPaths(address: Address) {
    let num = 0;
    const paths: string[] = [];
    while (await existsAsync(this.getUnverifiedTranscriptPath(address, num))) {
      paths.push(this.getUnverifiedTranscriptPath(address, num));
      ++num;
    }
    return paths;
  }

  public async getVerified(address: Address) {
    let num = 0;
    const transcripts: { size: number; num: number }[] = [];
    while (await existsAsync(this.getTranscriptPath(address, num))) {
      const stats = await statAsync(this.getTranscriptPath(address, num));
      transcripts.push({
        size: stats.size,
        num,
      });
      ++num;
    }
    return transcripts;
  }

  public async getUnverified(address: Address) {
    const files = await this.getUnverifiedTranscriptPaths(address);
    return files.map(f => {
      const [, num] = f.match(this.datFileRegex)!;
      return {
        address,
        num: +num,
      };
    });
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
    while (await existsAsync(this.getTranscriptPath(address, num))) {
      await copyFileAsync(this.getTranscriptPath(address, num), `${path}/transcript${num}.dat`);
      ++num;
    }
  }

  public getSealingPath() {
    return this.sealingPath;
  }
}
