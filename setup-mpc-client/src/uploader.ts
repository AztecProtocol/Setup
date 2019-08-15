import { EventEmitter } from 'events';
import { unlink } from 'fs';
import { MemoryFifo, MpcServer } from 'setup-mpc-common';
import { promisify } from 'util';
import { Address } from 'web3x/address';

const unlinkAsync = promisify(unlink);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class Uploader extends EventEmitter {
  private cancelled = false;
  private queue: MemoryFifo<number> = new MemoryFifo();

  constructor(private server: MpcServer, private address: Address) {
    super();
  }

  public async run() {
    console.error('Uploader starting...');
    while (true) {
      const num = await this.queue.get();
      if (num === null) {
        break;
      }
      await this.uploadTranscriptWithRetry(num);
    }
    console.error('Uploader complete.');
  }

  public put(transcriptNum: number) {
    this.queue.put(transcriptNum);
  }

  public cancel() {
    this.cancelled = true;
    this.queue.cancel();
  }

  public end() {
    this.queue.end();
  }

  private async uploadTranscriptWithRetry(num: number) {
    const filename = `../setup_db/transcript${num}_out.dat`;
    while (!this.cancelled) {
      try {
        console.error(`Uploading: `, filename);
        await this.server.uploadData(this.address, num, filename, undefined, transferred => {
          this.emit('progress', num, transferred);
        });
        await unlinkAsync(filename);
        this.emit('uploaded', num);
        break;
      } catch (err) {
        console.error(`Failed to upload transcript ${num}: ${err.message}`);
        await sleep(1000);
      }
    }
  }
}
