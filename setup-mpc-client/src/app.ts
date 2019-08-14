import { cloneMpcState, cloneParticipant, MpcServer, MpcState, Participant } from 'setup-mpc-common';
import { Writable } from 'stream';
import { Account } from 'web3x/account';
import { Compute } from './compute';
import { TerminalInterface } from './terminal-interface';
import { TerminalKit } from './terminal-kit';

export class App {
  private i1!: NodeJS.Timeout;
  private i2!: NodeJS.Timeout;
  private terminalInterface!: TerminalInterface;
  private compute?: Compute;

  constructor(
    private server: MpcServer,
    private account: Account | undefined,
    stream: Writable,
    height: number,
    width: number,
    private computeOffline = false
  ) {
    const termKit = new TerminalKit(stream, height, width);
    this.terminalInterface = new TerminalInterface(termKit, this.account);
  }

  public start() {
    this.updateState();
    this.i2 = setInterval(async () => this.terminalInterface.updateProgress(), 1000);
  }

  public stop() {
    clearTimeout(this.i1);
    clearInterval(this.i2);
    this.terminalInterface.hideCursor(false);
  }

  public resize(width: number, height: number) {
    this.terminalInterface.resize(width, height);
  }

  private updateState = async () => {
    try {
      const remoteState = await this.server.getState();

      const localState = await this.processRemoteState(remoteState);

      await this.terminalInterface.updateState(localState);

      // If the ceremony isn't complete, schedule next update.
      if (!remoteState.completedAt) {
        this.scheduleUpdate();
      }
    } catch (err) {
      this.scheduleUpdate();
      console.error(err);
    }
  };

  private scheduleUpdate = () => {
    this.i1 = setTimeout(this.updateState, 1000);
  };

  /*
    Given a remote state, this function will trigger or destroy the compute pipeline.
    It will return a new local state, which may differ from the remote state as our local compute state takes priority
    over the servers view of our state.
  */
  private async processRemoteState(remoteState: MpcState) {
    if (!this.account) {
      // We are in spectator mode.
      return remoteState;
    }

    const myIndex = remoteState.participants.findIndex(p => p.address.equals(this.account!.address));
    if (myIndex < 0) {
      // We're an unknown participant.
      return remoteState;
    }
    const myRemoteState = remoteState.participants[myIndex];

    // Either launch or destroy the computation based on remote state.
    if (
      myRemoteState.state === 'RUNNING' &&
      myRemoteState.runningState !== 'COMPLETE' &&
      myRemoteState.runningState !== 'OFFLINE' &&
      !this.compute
    ) {
      // Compute takes a copy of the participants state. It can modify at will, and emits 'update' events as modified.
      this.compute = new Compute(remoteState, cloneParticipant(myRemoteState), this.server, this.computeOffline);

      this.compute.on('update', (myState: Participant) => {
        const myTerminalState = this.terminalInterface.getParticipant(myState.address);
        // Preserves the remote controlled state currently in the terminal.
        const newTerminalState = this.preserveRemoteParticipantState(myState, myTerminalState);
        this.terminalInterface.updateParticipant(newTerminalState);
      });

      this.compute
        .start()
        .catch(err => {
          console.error(`Compute failed: `, err);
        })
        .finally(() => {
          this.compute!.removeAllListeners();
          this.compute = undefined;
        });
    } else if (myRemoteState.state !== 'RUNNING' && this.compute) {
      this.compute.cancel();
      this.compute = undefined;
    }

    if (myRemoteState.state === 'RUNNING' && this.compute) {
      // Grab our local state from the Compute. Parts of it override our remote state.
      const newLocalState = cloneMpcState(remoteState);
      const myState = this.compute.getParticipant();
      newLocalState.participants[myIndex] = this.preserveRemoteParticipantState(myState, myRemoteState);
      return newLocalState;
    } else {
      return remoteState;
    }
  }

  private preserveRemoteParticipantState(local: Participant, remote: Participant): Participant {
    // Retain mutable fields controlled by server.
    return {
      ...cloneParticipant(local),
      state: remote.state,
      verifyProgress: remote.verifyProgress,
      completedAt: remote.completedAt,
      startedAt: remote.startedAt,
    };
  }
}
