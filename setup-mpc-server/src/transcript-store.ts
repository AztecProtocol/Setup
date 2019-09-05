import { createReadStream, mkdirSync } from 'fs';
import { Readable } from 'stream';
import { Address } from 'web3x/address';
import { existsAsync, mkdirAsync, readdirAsync, renameAsync, rmdirAsync, statAsync, unlinkAsync } from './fs-async';

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
  erase(address: Address): Promise<void>;
}

export class DiskTranscriptStore implements TranscriptStore {
  private unverified: string;
  private verifiedPath: string;
  private datFileRegex = /transcript(\d+).dat$/;

  constructor(storePath: string) {
    this.verifiedPath = storePath + '/verified';
    this.unverified = storePath + '/unverified';
    mkdirSync(this.unverified, { recursive: true });
  }

  public async save(address: Address, num: number, transcriptPath: string, signaturePath: string) {
    await mkdirAsync(`${this.unverified}/${address.toString().toLowerCase()}`, { recursive: true });
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
    return `${this.unverified}/${address.toString().toLowerCase()}`;
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

  public async erase(address: Address) {
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

  private async eraseUnverified(address: Address) {
    try {
      const dir = this.getUnverifiedBasePath(address);
      if (!(await existsAsync(dir))) {
        return;
      }
      const files = await readdirAsync(dir);
      for (const file of await files) {
        await unlinkAsync(`${dir}/${file}`);
      }
      await rmdirAsync(this.getUnverifiedBasePath(address));
    } catch (err) {
      console.error(err);
    }
  }
}
