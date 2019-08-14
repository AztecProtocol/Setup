import { S3 } from 'aws-sdk';
import { createReadStream, mkdirSync } from 'fs';
import { Readable } from 'stream';
import { Address } from 'web3x/address';
import { existsAsync, mkdirAsync, readdirAsync, renameAsync, unlinkAsync } from './fs-async';

export interface TranscriptStore {
  saveTranscript(address: Address, num: number, path: string): Promise<void>;
  saveSignature(address: Address, num: number, path: string): Promise<void>;
  getUnverifiedTranscriptPath(address: Address, num: number): string;
  getUnverifiedSignaturePath(address: Address, num: number): string;
  makeLive(address: Address, num: number): Promise<void>;
  loadTranscript(address: Address, num: number): Readable;
  getTranscriptPath(address: Address, num: number): string;
  getTranscriptPaths(address: Address): Promise<string[]>;
  getUnverified(): Promise<{ address: Address; num: number }[]>;
  eraseVerified(address: Address): Promise<void>;
  eraseUnverified(address: Address, num: number): Promise<void>;
}

export class DiskTranscriptStore implements TranscriptStore {
  private toVerifyPath: string;
  private verifiedPath: string;
  private datFileRegex = /transcript_(.+?)_(\d+).dat$/;

  constructor(storePath: string) {
    this.verifiedPath = storePath + '/verified';
    this.toVerifyPath = storePath + '/to_verify';
    mkdirSync(this.toVerifyPath, { recursive: true });
  }

  public async saveTranscript(address: Address, num: number, path: string) {
    await renameAsync(path, this.getUnverifiedTranscriptPath(address, num));
  }

  public async saveSignature(address: Address, num: number, path: string) {
    await renameAsync(path, this.getUnverifiedSignaturePath(address, num));
  }

  public async makeLive(address: Address, num: number) {
    await mkdirAsync(`${this.verifiedPath}/${address.toString().toLowerCase()}`, { recursive: true });
    await renameAsync(this.getUnverifiedTranscriptPath(address, num), this.getTranscriptPath(address, num));
    await renameAsync(this.getUnverifiedSignaturePath(address, num), this.getSignaturePath(address, num));
  }

  public loadTranscript(address: Address, num: number) {
    return createReadStream(this.getTranscriptPath(address, num));
  }

  public getTranscriptPath(address: Address, num: number) {
    return `${this.verifiedPath}/${address.toString().toLowerCase()}/transcript${num}.dat`;
  }

  public getSignaturePath(address: Address, num: number) {
    return `${this.verifiedPath}/${address.toString().toLowerCase()}/transcript${num}.sig`;
  }

  public getUnverifiedTranscriptPath(address: Address, num: number) {
    return `${this.toVerifyPath}/transcript_${address.toString().toLowerCase()}_${num}.dat`;
  }

  public getUnverifiedSignaturePath(address: Address, num: number) {
    return `${this.toVerifyPath}/transcript_${address.toString().toLowerCase()}_${num}.sig`;
  }

  public async getTranscriptPaths(address: Address) {
    let num = 0;
    const paths: string[] = [];
    while (await existsAsync(this.getTranscriptPath(address, num))) {
      paths.push(this.getTranscriptPath(address, num));
      ++num;
    }
    return paths;
  }

  public async getUnverified() {
    const files = await readdirAsync(this.toVerifyPath);
    return files
      .filter(f => this.datFileRegex.test(f))
      .map(f => {
        const [, address, num] = f.match(this.datFileRegex)!;
        return {
          address: Address.fromString(address),
          num: +num,
        };
      });
  }

  public async eraseVerified(address: Address) {
    try {
      const files = await readdirAsync(`${this.verifiedPath}/${address}`);
      for (const file of files) {
        await unlinkAsync(`${this.verifiedPath}/${address}/${file}`);
      }
    } catch (err) {
      // Swallow
    }
  }

  public async eraseUnverified(address: Address, num: number) {
    try {
      await unlinkAsync(this.getUnverifiedTranscriptPath(address, num));
      await unlinkAsync(this.getUnverifiedSignaturePath(address, num));
    } catch (err) {
      // Swallow
    }
  }
}

export class S3TranscriptStore extends DiskTranscriptStore {
  private s3 = new S3();

  constructor(storePath: string) {
    super(storePath);
  }
}
