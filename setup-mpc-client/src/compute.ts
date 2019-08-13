import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import moment = require('moment');
import readline from 'readline';
import { MemoryFifo, MpcServer, MpcState, Participant, Transcript } from 'setup-mpc-common';
import { Downloader } from './downloader';
import { Uploader } from './uploader';

export class Compute {
  private setupProc?: ChildProcessWithoutNullStreams;
  private computeQueue: MemoryFifo<string> = new MemoryFifo();
  private downloader: Downloader;
  private uploader: Uploader;

  constructor(
    private state: MpcState,
    private myState: Participant,
    private server: MpcServer,
    private computeOffline: boolean
  ) {
    this.downloader = new Downloader(server);
    this.uploader = new Uploader(server, myState.address);
  }

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

    // Push any state changes to server.
    await this.updateParticipant();

    await Promise.all([this.runDownloader(), this.compute(), this.runUploader()]).catch(err => {
      console.error(err);
      this.cancel();
      throw err;
    });

    this.myState.runningState = 'COMPLETE';
    await this.updateParticipant();
    console.error('Compute ran to completion.');
  }

  public cancel() {
    this.downloader.cancel();
    this.uploader.cancel();
    this.computeQueue.cancel();
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
        this.myState.transcripts.forEach(transcript => this.downloader.put(transcript));
      } else {
        this.myState.transcripts.forEach(transcript => {
          if (!this.downloader.isDownloaded(transcript)) {
            // If not fully downloaded, reset download and upload progress as we are starting over.
            transcript.downloaded = 0;
            transcript.uploaded = 0;
          }

          // Add to downloaded queue regardless of if already downloaded. Will shortcut later in the downloader.
          this.downloader.put(transcript);
        });
      }

      this.downloader.end();
    } else {
      console.error('We are the first participant.');
      this.downloader.end();
      this.computeQueue.put(`create ${this.state.numG1Points} ${this.state.numG2Points}`);
      this.computeQueue.end();
    }
  }

  private async runDownloader() {
    this.downloader.on('downloaded', (transcript: Transcript) => {
      this.computeQueue.put(`process ${transcript.num}`);
    });

    this.downloader.on('progress', (transcript: Transcript, transferred: number) => {
      transcript.downloaded = transferred;
      this.updateParticipant().catch(console.error);
    });

    await this.downloader.run();

    this.computeQueue.end();
  }

  private async runUploader() {
    this.uploader.on('progress', (num: number, transferred: number) => {
      this.myState.transcripts[num].uploaded = transferred;
      this.updateParticipant().catch(console.error);
    });

    await this.uploader.run();
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
        this.uploader.end();
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
        this.uploader.put(+params[0]);
        break;
      }
      case 'progress': {
        this.myState.computeProgress = +params[0];
        this.updateParticipant();
        break;
      }
    }
  };

  private async updateParticipant() {
    this.myState.lastUpdate = moment();
    await this.server.updateParticipant(this.myState);
  }
}
