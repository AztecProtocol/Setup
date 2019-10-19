import moment from 'moment';
import { applyDelta, cloneParticipant, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Writable } from 'stream';
import { Account } from 'web3x/account';
import { Compute } from './compute';
import { TerminalInterface } from './terminal-interface';
import { TerminalKit } from './terminal-kit';

export class App {
  private interval!: NodeJS.Timeout;
  private uiInterval!: NodeJS.Timeout;
  private terminalInterface!: TerminalInterface;
  private compute?: Compute;
  private state?: MpcState;

  constructor(
    private server: MpcServer,
    private account: Account | undefined,
    stream: Writable,
    height: number,
    width: number,
    private computeOffline = false,
    private exitOnComplete = false
  ) {
    const termKit = new TerminalKit(stream, height, width);
    this.terminalInterface = new TerminalInterface(termKit, this.account);
  }

  public start() {
    this.updateState();
    this.updateUi();
  }

  public stop() {
    clearTimeout(this.interval);
    clearTimeout(this.uiInterval);
    this.terminalInterface.hideCursor(false);
  }

  public resize(width: number, height: number) {
    this.terminalInterface.resize(width, height);
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

      this.terminalInterface.lastUpdate = moment();

      // Start or stop computation.
      await this.processRemoteState(this.state);

      // Send any local state changes to the server.
      await this.updateRemoteState();
    } catch (err) {
      console.error(err);
    } finally {
      this.scheduleUpdate();
    }
  };

  private updateUi = () => {
    if (this.compute && this.state) {
      const local = this.compute.getParticipant();
      const remote = this.state.participants.find(p => p.address.equals(local.address))!;
      remote.runningState = local.runningState;
      remote.transcripts = local.transcripts;
      remote.computeProgress = local.computeProgress;
    }
    this.terminalInterface.updateState(this.state);
    this.uiInterval = setTimeout(this.updateUi, 1000);
  };

  private scheduleUpdate = () => {
    if (this.exitOnComplete && this.account) {
      const p = this.state!.participants.find(p => p.address.equals(this.account!.address));
      if (p && p.state === 'COMPLETE') {
        this.stop();
        return;
      }
    }
    this.interval = setTimeout(this.updateState, 1000);
  };

  /*
    Given a remote state, this function will trigger or destroy the compute pipeline.
    It will return a new local state, which may differ from the remote state as our local compute state takes priority
    over the servers view of our state.
  */
  private async processRemoteState(remoteState: MpcState) {
    if (!this.account) {
      // We are in spectator mode.
      return;
    }

    const myIndex = remoteState.participants.findIndex(p => p.address.equals(this.account!.address));
    if (myIndex < 0) {
      // We're an unknown participant.
      return;
    }
    const myRemoteState = remoteState.participants[myIndex];

    // Either launch or destroy the computation based on remote state.
    if (myRemoteState.state === 'RUNNING' && !this.compute) {
      // Compute takes a copy of the participants state and modifies it with local telemetry.
      this.compute = new Compute(
        remoteState,
        cloneParticipant(myRemoteState),
        this.server,
        this.computeOffline && myRemoteState.tier < 2
      );

      this.compute.start().catch(err => {
        console.error(`Compute failed: `, err);
        this.compute = undefined;
      });
    } else if (myRemoteState.state !== 'RUNNING' && this.compute) {
      this.compute.cancel();
      this.compute = undefined;
    }
  }

  private updateRemoteState = async () => {
    if (!this.account || !this.state!.participants.find(p => p.address.equals(this.account!.address))) {
      return;
    }

    if (this.compute) {
      const myState = this.compute.getParticipant();
      await this.server.updateParticipant(myState);
    } else {
      await this.server.ping(this.account.address);
    }
  };
}
