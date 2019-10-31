import moment from 'moment';
import { applyDelta, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { IncomingWebhook } from '@slack/webhook';
import { calculateMetrics } from './calculate-metrics';

export class App {
  private interval!: NodeJS.Timeout;
  private state?: MpcState;
  private running?: Participant;
  private alerted = false;
  private slack: IncomingWebhook;

  constructor(private server: MpcServer, private alertTimeLeft: number, private token: string) {
    const webhook = `https://hooks.slack.com/services/T8P21L9SL/BPZNB6448/${token}`;
    this.slack = new IncomingWebhook(webhook);
  }

  public start() {
    this.send(':unicorn_face: Alert application started.');
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
    if (previous.state === 'COMPLETE') {
      this.send(`:tada: Participant complete: \`${previous.address}\``);
    } else {
      this.send(`:boom: Participant failed \`${previous.address}\`: ${previous.error}.`);
    }
  }

  private alertIfTimeout(p: Participant) {
    const {
      downloadProgress,
      computeProgress,
      uploadProgress,
      verifyProgress,
      verifyTimeout,
      totalTimeout,
    } = calculateMetrics(this.state!, p);

    if (totalTimeout < this.alertTimeLeft || (p.tier > 1 && verifyTimeout < this.alertTimeLeft)) {
      if (!this.alerted) {
        this.alerted = true;
        this.send(
          `:exclamation: Participant \`${p.address}\` will timeout in ${this.alertTimeLeft}s.\n` +
            `\`\`\`download: ${downloadProgress.toFixed(2)}\n` +
            `compute: ${computeProgress.toFixed(2)}\n` +
            `upload: ${uploadProgress.toFixed(2)}\n` +
            `verify: ${verifyProgress.toFixed(2)}\`\`\``
        );
      }
    } else {
      this.alerted = false;
    }
  }

  private send(text: string) {
    console.log(text);
    if (this.token) {
      this.slack.send(text);
    }
  }

  private scheduleUpdate = () => {
    this.interval = setTimeout(this.updateState, 1000);
  };
}
