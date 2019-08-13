class Verifier {
  private async verifier() {
    while (true) {
      const item = await this.verifyQueue.get();
      if (!item) {
        return;
      }
      const { participant, transcriptNumber, transcriptPath, signature } = item;
      const { address } = participant;

      try {
        const p = this.getAndAssertRunningParticipant(address);

        if (!p.transcripts[transcriptNumber]) {
          throw new Error(`Unknown transcript number: ${transcriptNumber}`);
        }

        if (await this.verifyTranscript(participant, transcriptNumber, transcriptPath)) {
          console.error(`Verification succeeded: ${transcriptPath}...`);

          await this.store.saveTranscript(address, transcriptNumber, transcriptPath);
          await this.store.saveSignature(address, transcriptNumber, signature);

          p.transcripts[transcriptNumber].complete = true;
          p.lastUpdate = moment();

          if (p.transcripts.every(t => t.complete)) {
            // Every transcript in clients transcript list is verified. We still need to verify the set
            // as a whole. This just checks the total number of G1 and G2 points is as expected.
            if (await this.verifyTranscriptSet(p)) {
              p.state = 'COMPLETE';
              p.runningState = 'COMPLETE';
              p.completedAt = moment();
            } else {
              console.error(`Verification of set failed for ${p.address}...`);
              p.state = 'INVALIDATED';
              p.runningState = 'COMPLETE';
              p.error = 'verify failed';
            }
          }
        } else {
          console.error(`Verification failed: ${transcriptPath}...`);
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
        }
      } catch (err) {
        console.error(err);
      } finally {
        unlink(transcriptPath, () => {});
      }
    }
  }

  private async verifyTranscript(participant: Participant, transcriptNumber: number, transcriptPath: string) {
    const args = [transcriptPath];
    args.push(transcriptNumber === 0 ? transcriptPath : this.store.getTranscriptPath(participant.address, 0));
    if (transcriptNumber === 0) {
      const lastCompleteParticipant = this.getLastCompleteParticipant();
      if (lastCompleteParticipant) {
        args.push(this.store.getTranscriptPath(lastCompleteParticipant.address, 0));
      }
    } else {
      args.push(this.store.getTranscriptPath(participant.address, transcriptNumber - 1));
    }

    console.error(`Verifiying transcript ${transcriptNumber}...`);
    return new Promise<boolean>(resolve => {
      const { VERIFY_PATH = '../setup-tools/verify' } = process.env;
      const verify = spawn(VERIFY_PATH, args);

      verify.stdout.on('data', data => {
        console.error(data.toString());
      });

      verify.stderr.on('data', data => {
        console.error(data.toString());
      });

      verify.on('close', code => {
        if (code === 0) {
          participant.verifyProgress = ((transcriptNumber + 1) / participant.transcripts.length) * 100;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private async verifyTranscriptSet(participant: Participant) {
    const { numG1Points, numG2Points } = this.state;
    const args = [
      numG1Points.toString(),
      numG2Points.toString(),
      ...this.store.getTranscriptPaths(participant.address),
    ];

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
