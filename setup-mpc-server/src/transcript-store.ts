import { S3 } from 'aws-sdk';
import { createReadStream, mkdirSync } from 'fs';
import { Readable } from 'stream';
import { Address } from 'web3x/address';
import { existsAsync, readdirAsync, renameAsync } from './fs-async';

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
}

export class DiskTranscriptStore implements TranscriptStore {
  private toVerifyPath: string;
  private datFileRegex = /transcript_(.+?)_(\d+).dat$/;

  constructor(private storePath: string) {
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
    await renameAsync(this.getUnverifiedTranscriptPath(address, num), this.getTranscriptPath(address, num));
    await renameAsync(this.getUnverifiedSignaturePath(address, num), this.getSignaturePath(address, num));
  }

  public loadTranscript(address: Address, num: number) {
    return createReadStream(this.getTranscriptPath(address, num));
  }

  public getTranscriptPath(address: Address, num: number) {
    return `${this.storePath}/transcript_${address.toString().toLowerCase()}_${num}.dat`;
  }

  public getSignaturePath(address: Address, num: number) {
    return `${this.storePath}/transcript_${address.toString().toLowerCase()}_${num}.sig`;
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
}

export class S3TranscriptStore extends DiskTranscriptStore {
  private s3 = new S3();

  constructor(storePath: string) {
    super(storePath);
  }
}
