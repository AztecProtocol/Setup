import { ChildProcess, spawn } from 'child_process';
import { MemoryFifo } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { TranscriptStore } from './transcript-store';

export interface VerifyItem {
  address: Address;
  num: number;
}

export class Verifier {
  private queue: MemoryFifo<VerifyItem> = new MemoryFifo();
  public lastCompleteAddress?: Address;
  public runningAddress?: Address;
  private proc?: ChildProcess;
  private cancelled = false;

  constructor(
    private store: TranscriptStore,
    private numG1Points: number,
    private numG2Points: number,
    private pointsPerTranscript: number,
    private cb: (address: Address, num: number, verified: boolean) => Promise<void>
  ) {}

  public async run() {
    console.log('Verifier started...');
    while (true) {
      const item = await this.queue.get();
      if (!item) {
        break;
      }
      const { address, num } = item;
      const transcriptPath = this.store.getUnverifiedTranscriptPath(address, num);

      try {
        if (!this.runningAddress) {
          // If we dequeued an item, someone should be running.
          throw new Error('No running address set.');
        }

        if (!this.runningAddress.equals(address)) {
          // This address is no longer running. Just skip.
          continue;
        }

        if (await this.verifyTranscript(address, num, transcriptPath)) {
          console.error(`Verification succeeded: ${transcriptPath}...`);

          await this.cb(address, num, true);
        } else {
          await this.store.eraseUnverified(address, num);
          if (!this.cancelled) {
            await this.cb(address, num, false);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    console.log('Verifier completed.');
  }

  public put(item: VerifyItem) {
    this.queue.put(item);
  }

  public cancel() {
    this.cancelled = true;
    this.queue.cancel();
    if (this.proc) {
      this.proc.kill();
    }
  }

  private async verifyTranscript(address: Address, transcriptNumber: number, transcriptPath: string) {
    // Argument 0 is total number of G1 points in all transcripts.
    // Argument 1 is total number of G2 points in all transcripts.
    // Argument 2 is the total points per transcript.
    // Argument 3 is the expected transcript number.
    // Argument 4 is the transcript to verify.
    // Argument 5 is the 0th transcript of the sequence.
    const args = [
      this.numG1Points.toString(),
      this.numG2Points.toString(),
      this.pointsPerTranscript.toString(),
      transcriptNumber.toString(),
      transcriptPath,
      this.store.getUnverifiedTranscriptPath(address, 0),
    ];

    // Argument 6 is...
    if (transcriptNumber === 0) {
      // The previous participants 0th transcript, or nothing if no previous participant.
      if (this.lastCompleteAddress) {
        args.push(this.store.getVerifiedTranscriptPath(this.lastCompleteAddress, 0));
      }
    } else {
      // The previous transcript in the sequence.
      args.push(this.store.getUnverifiedTranscriptPath(address, transcriptNumber - 1));
    }

    console.error(`Verifiying transcript ${transcriptNumber}...`);
    return new Promise<boolean>(resolve => {
      const binPath = '../setup-tools/verify';
      const verify = spawn(binPath, args);
      this.proc = verify;

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        this.proc = undefined;
        resolve(code === 0);
      });
    });
  }
}
