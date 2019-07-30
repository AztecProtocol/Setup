import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createWriteStream, existsSync, statSync, unlink } from 'fs';
import moment = require('moment');
import progress from 'progress-stream';
import readline from 'readline';
import { MemoryFifo, MpcServer, MpcState, Participant, Transcript } from 'setup-mpc-common';

export class Compute {
  private setupProc?: ChildProcessWithoutNullStreams;
  private downloadQueue: MemoryFifo<Transcript> = new MemoryFifo();
  private computeQueue: MemoryFifo<string> = new MemoryFifo();
  private uploadQueue: MemoryFifo<number> = new MemoryFifo();

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
    }

    await this.populateQueues();
    await this.updateParticipant();

    await Promise.all([this.downloader(), this.compute(), this.uploader()]).catch(err => {
      console.error(err);
      this.cancel();
      throw err;
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

  private async populateQueues() {
    this.myState.computeProgress = 0;

    const previousParticipant = this.state.participants
      .slice()
      .reverse()
      .find(p => p.state === 'COMPLETE');

    if (previousParticipant) {
      console.error('Previous participant found.');

      if (this.myState.transcripts.length === 0) {
        // We haven't yet defined our transcripts. Base them off the previous participants.
        this.myState.transcripts = previousParticipant.transcripts.map(t => ({
          ...t,
          fromAddress: previousParticipant.address,
          uploaded: 0,
          downloaded: 0,
          complete: false,
        }));
        this.myState.transcripts.forEach(transcript => this.downloadQueue.put(transcript));
      } else {
        this.myState.transcripts.forEach(transcript => {
          const filename = `../setup_db/transcript${transcript.num}.dat`;
          if (existsSync(filename)) {
            const stat = statSync(filename);
            if (stat.size === transcript.size && transcript.downloaded === transcript.size) {
              return;
            }
          }
          transcript.downloaded = 0;
          transcript.uploaded = 0;
          this.downloadQueue.put(transcript);
        });
      }

      this.downloadQueue.end();
    } else {
      console.error('We are the first participant.');
      this.downloadQueue.end();
      this.computeQueue.put(`create ${this.state.numG1Points} ${this.state.numG2Points}`);
      this.computeQueue.end();
    }
  }

  private async downloader() {
    console.error('Downloader starting...');
    while (true) {
      const transcript = await this.downloadQueue.get();
      if (!transcript) {
        break;
      }
      console.error(`Downloading transcript ${transcript.num}`);
      await this.downloadTranscript(transcript);
      this.computeQueue.put(`process ${transcript.num}`);
    }
    this.computeQueue.end();
    console.error('Downloader complete.');
  }

  private async downloadTranscript(transcript: Transcript): Promise<string> {
    const filename = `../setup_db/transcript${transcript.num}.dat`;
    if (existsSync(filename)) {
      const stat = statSync(filename);
      if (stat.size === transcript.size && transcript.downloaded === transcript.size) {
        return filename;
      }
    }
    const readStream = await this.server.downloadData(transcript.fromAddress!, transcript.num);
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
      const setup = spawn(SETUP_PATH, ['../setup_db']);
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
        console.error(`Setup command: ${cmd}`);
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
    const cmd = params.shift()!;
    switch (cmd) {
      case 'creating': {
        for (const transcriptDef of params) {
          const [num, size] = transcriptDef.split(':');
          this.myState.transcripts[+num] = {
            num: +num,
            size: +size,
            uploaded: 0,
            downloaded: +size,
            complete: false,
          };
        }
        this.updateParticipant();
        break;
      }
      case 'wrote': {
        this.uploadQueue.put(+params[0]);
        break;
      }
      case 'progress': {
        this.myState.computeProgress = +params[0];
        this.updateParticipant();
        break;
      }
    }
  };

  private async uploader() {
    console.error('Uploader starting...');
    while (true) {
      const num = await this.uploadQueue.get();
      if (num === null) {
        break;
      }
      const filename = `../setup_db/transcript${num}_out.dat`;
      console.error(`Uploading: `, filename);
      await this.server.uploadData(this.myState.address, num, filename, undefined, progress => {
        this.myState.transcripts[num].uploaded = progress.transferred;
        this.updateParticipant();
      });
      unlink(filename, () => {});
    }
  }

  private async updateParticipant() {
    this.myState.lastUpdate = moment();
    await this.server.updateParticipant(this.myState);
  }
}
