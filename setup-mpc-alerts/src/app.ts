import moment from 'moment';
import { applyDelta, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import fetch from 'node-fetch';

export class App {
  private interval!: NodeJS.Timeout;
  private state?: MpcState;
  private running?: Participant;
  private alerted = false;

  constructor(private server: MpcServer, private alertTimeLeft: number) {}

  public start() {
    this.alert('Alert application started.');
    this.updateState();
  }

  public stop() {
    clearTimeout(this.interval);
  }

  private updateState = async () => {
    try {
      // Then get the latest state from the server.
      const remoteStateDelta = await this.server.getState(this.state ? this.state.sequence : undefined);

      // this.state updates atomically in this code block, allowing the ui to update independently.
      if (!this.state) {
        this.state = remoteStateDelta;
      } else if (this.state.startSequence !== remoteStateDelta.startSequence) {
        this.state = await this.server.getState();
      } else {
        this.state = applyDelta(this.state, remoteStateDelta);
      }

      const running = this.state.participants.find(p => p.state === 'RUNNING');

      // No ones running, do nothing.
      if (!running && !this.running) {
        return;
      }

      if (running && this.running) {
        if (running.address.equals(this.running.address)) {
          // Nearing timeout.
          this.alertIfTimeout(running);
        } else {
          // We've advanced to a new participant.
          this.alertParticipantFinished(this.running);
          this.running = running;
          this.alerted = false;
        }
      } else if (this.running && !running) {
        // We've just finished but haven't started a new participant.
        this.alertParticipantFinished(this.running);
        this.running = running;
        this.alerted = false;
      }

      this.running = running;
    } catch (err) {
      console.error(err);
    } finally {
      this.scheduleUpdate();
    }
  };

  private alertParticipantFinished(running: Participant) {
    const previous = this.state!.participants.find(p => p.address.equals(running.address))!;
    this.alert(`Participant ${previous.address}: ${previous.state}`);
  }

  private alertIfTimeout(running: Participant) {
    const { invalidateAfter, numG1Points, numG2Points, pointsPerTranscript } = this.state!;
    const completeWithin = running.invalidateAfter || invalidateAfter;
    const verifyWithin = (2 * completeWithin) / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
    const verifyTimeout = Math.max(
      0,
      moment(running.lastVerified || running.startedAt!)
        .add(verifyWithin, 's')
        .diff(moment(), 's')
    );

    const totalSkip = Math.max(
      0,
      moment(running.startedAt!)
        .add(completeWithin, 's')
        .diff(moment(), 's')
    );

    if (totalSkip < this.alertTimeLeft || (running.tier > 1 && verifyTimeout < this.alertTimeLeft)) {
      if (!this.alerted) {
        this.alerted = true;
        this.alert(`Participant ${running.address} timeout in ${this.alertTimeLeft}s`);
      }
    } else {
      this.alerted = false;
    }
  }

  private alert(text: string) {
    console.log(text);
    const webhook = 'https://hooks.slack.com/services/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';
    fetch(webhook, {
      method: 'POST',
      body: JSON.stringify({
        text,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private scheduleUpdate = () => {
    this.interval = setTimeout(this.updateState, 1000);
  };
}
