import { EventEmitter } from 'events';
import { createWriteStream, existsSync, statSync } from 'fs';
import progress from 'progress-stream';
import { MemoryFifo, MpcServer, Transcript } from 'setup-mpc-common';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class Downloader extends EventEmitter {
  private queue: MemoryFifo<Transcript> = new MemoryFifo();

  constructor(private server: MpcServer) {
    super();
  }

  public async run() {
    console.error('Downloader starting...');
    while (true) {
      const transcript = await this.queue.get();
      if (!transcript) {
        break;
      }
      await this.downloadTranscriptWithRetry(transcript);
    }
    console.error('Downloader complete.');
  }

  public put(transcript: Transcript) {
    this.queue.put(transcript);
  }

  public end() {
    this.queue.end();
  }

  public cancel() {
    this.queue.cancel();
  }

  public isDownloaded(transcript: Transcript) {
    const filename = `../setup_db/transcript${transcript.num}.dat`;
    if (existsSync(filename)) {
      const stat = statSync(filename);
      if (stat.size === transcript.size && transcript.downloaded === transcript.size) {
        return true;
      }
    }
  }

  private async downloadTranscriptWithRetry(transcript: Transcript) {
    while (true) {
      try {
        console.error(`Downloading transcript ${transcript.num}`);
        await this.downloadTranscript(transcript);
        this.emit('downloaded', transcript);
        break;
      } catch (err) {
        console.error(`Failed to download transcript ${transcript.num}: ${err.message}`);
        await sleep(1000);
      }
    }
  }

  private async downloadTranscript(transcript: Transcript) {
    const filename = `../setup_db/transcript${transcript.num}.dat`;
    if (this.isDownloaded(transcript)) {
      return;
    }
    const readStream = await this.server.downloadData(transcript.fromAddress!, transcript.num);
    const progStream = progress({ length: transcript.size, time: 1000 });
    const writeStream = createWriteStream(filename);

    progStream.on('progress', progress => {
      this.emit('progress', transcript, progress.transferred);
    });

    return new Promise((resolve, reject) => {
      writeStream.on('close', () => resolve());
      readStream.on('error', (err: Error) => reject(err));
      readStream.pipe(progStream).pipe(writeStream);
    });
  }
}
