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

  constructor(
    private store: TranscriptStore,
    private numG1Points: number,
    private numG2Points: number,
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

          await this.store.makeLive(address, num);

          await this.cb(address, num, true);
        } else {
          await this.cb(address, num, false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        await this.store.erase(address, num);
      }
    }
    console.log('Verifier complteted.');
  }

  public put(item: VerifyItem) {
    this.queue.put(item);
  }

  public cancel() {
    this.queue.cancel();
    if (this.proc) {
      this.proc.kill();
    }
  }

  private async verifyTranscript(address: Address, transcriptNumber: number, transcriptPath: string) {
    // Argument 0 is the transcript to verify.
    const args = [transcriptPath];

    // Argument 1 is the 0th transcript of the sequence.
    args.push(transcriptNumber === 0 ? transcriptPath : this.store.getTranscriptPath(address, 0));

    // Argument 3 is...
    if (transcriptNumber === 0) {
      // The previous participants 0th transcript, or nothing if no previous participant.
      if (this.lastCompleteAddress) {
        args.push(this.store.getTranscriptPath(this.lastCompleteAddress, 0));
      }
    } else {
      // The previous transcript in the sequence.
      args.push(this.store.getTranscriptPath(address, transcriptNumber - 1));
    }

    console.error(`Verifiying transcript ${transcriptNumber}...`);
    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify' } = process.env;
      const verify = spawn(VERIFY_PATH, args);
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

  public async verifyTranscriptSet(address: Address) {
    const transcriptPaths = await this.store.getTranscriptPaths(address);
    const args = [this.numG1Points.toString(), this.numG2Points.toString(), ...transcriptPaths];

    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify_set' } = process.env;
      const verify = spawn(VERIFY_PATH, args);

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        resolve(code === 0 ? true : false);
      });
    });
  }
}
