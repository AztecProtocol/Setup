import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createWriteStream } from 'fs';
import moment = require('moment');
import progress from 'progress-stream';
import readline from 'readline';
import { MemoryFifo, MpcServer, MpcState, Participant, Transcript } from 'setup-mpc-common';
import { Address } from 'web3x/address';

export class Compute {
  private setupProc?: ChildProcessWithoutNullStreams;
  private downloadQueue: MemoryFifo<{ address: Address; transcript: Transcript }> = new MemoryFifo();
  private computeQueue: MemoryFifo<string> = new MemoryFifo();
  private uploadQueue: MemoryFifo<{ num: number; filename: string }> = new MemoryFifo();

  constructor(
    private state: MpcState,
    private myState: Participant,
    private server: MpcServer,
    private computeOffline: boolean
  ) {}

  public async start() {
    if (this.computeOffline) {
      this.myState.runningState = 'OFFLINE';
      await this.updateParticipant();
      return;
    }

    if (this.myState.runningState === 'WAITING') {
      this.myState.runningState = 'RUNNING';
      await this.updateParticipant();
    }

    this.populateQueues();

    await Promise.all([this.downloader(), this.compute(), this.uploader()]).catch(err => {
      console.error(err);
      this.cancel();
    });

    this.myState.runningState = 'COMPLETE';
    await this.updateParticipant();
    console.error('Compute ran to completion.');
  }

  public cancel() {
    this.computeQueue.cancel();
    this.uploadQueue.cancel();
    if (this.setupProc) {
      this.setupProc.kill('SIGINT');
    }
  }

  private populateQueues() {
    const previousParticipant = this.state.participants
      .slice()
      .reverse()
      .find(p => p.state === 'COMPLETE');

    if (previousParticipant) {
      console.error('Previous participant found.');
      const { address, transcripts } = previousParticipant;
      // Download incomplete transcripts.
      transcripts.filter(t => !t.complete).forEach(transcript => this.downloadQueue.put({ address, transcript }));
      this.downloadQueue.end();
    } else {
      console.error('We are the first participant.');
      this.downloadQueue.end();
      this.computeQueue.put(`c ../setup_db ${this.state.polynomials}`);
      this.computeQueue.end();
    }
  }

  private async downloader() {
    console.error('Downloader starting...');
    while (true) {
      const item = await this.downloadQueue.get();
      if (!item) {
        break;
      }
      console.error(`Downloader dequeued: `, item);
      const filename = await this.downloadTranscript(item.address, item.transcript);
      this.computeQueue.put(`r ${filename}`);
    }
    this.computeQueue.end();
    console.error('Downloader complete.');
  }

  private async downloadTranscript(address: Address, transcript: Transcript): Promise<string> {
    const filename = `../setup_db/transcript${transcript.num}.dat`;
    const readStream = await this.server.downloadData(address, transcript.num);
    const progStream = progress({ length: transcript.size, time: 1000 });
    const writeStream = createWriteStream(filename);

    progStream.on('progress', progress => {
      transcript.downloaded = progress.transferred;
      this.updateParticipant().catch(console.error);
    });

    return new Promise((resolve, reject) => {
      writeStream.on('close', () => resolve(filename));
      readStream.on('error', (err: Error) => reject(err));
      readStream.pipe(progStream).pipe(writeStream);
    });
  }

  private async compute() {
    return new Promise(async (resolve, reject) => {
      const { SETUP_PATH = '../setup-tools/setup' } = process.env;
      const setup = spawn(SETUP_PATH, ['-']);
      this.setupProc = setup;

      readline
        .createInterface({
          input: setup.stdout,
          terminal: false,
        })
        .on('line', this.handleSetupOutput);

      setup.stderr.on('data', data => {
        console.error(data.toString());
      });

      setup.on('close', code => {
        this.setupProc = undefined;
        this.uploadQueue.end();
        if (code === 0) {
          console.error(`Compute complete.`);
          resolve();
        } else {
          reject(new Error(`setup exited with code ${code}`));
        }
      });

      setup.on('error', reject);

      console.error(`Compute starting...`);
      while (true) {
        const cmd = await this.computeQueue.get();
        if (!cmd) {
          setup.stdin.end();
          break;
        }
        console.error(`Compute dequeued command: ${cmd}`);
        setup.stdin.write(`${cmd}\n`);
      }
    });
  }

  private handleSetupOutput = (data: Buffer) => {
    console.error('From setup: ', data.toString());
    const params = data
      .toString()
      .replace('\n', '')
      .split(' ');
    switch (params[0]) {
      case 'c': {
        const [, num, size] = params;
        this.myState.transcripts.push({
          num: +num,
          size: +size,
          uploaded: 0,
          downloaded: 0,
          complete: false,
        });
        this.updateParticipant();
        break;
      }
      case 'w': {
        const [, num, filename] = params;
        this.uploadQueue.put({ num: +num, filename });
        break;
      }
      case 'p': {
        this.myState.computeProgress = +params[1];
        this.updateParticipant();
        break;
      }
    }
  };

  private async uploader() {
    while (true) {
      const item = await this.uploadQueue.get();
      if (!item) {
        break;
      }
      console.error(`Uploader dequeued: `, item);
      await this.server.uploadData(this.myState.address, item.num, item.filename);
    }
  }

  private async updateParticipant() {
    this.myState.lastUpdate = moment();
    await this.server.updateParticipant(this.myState);
  }
}
