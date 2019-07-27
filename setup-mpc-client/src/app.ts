import { MpcServer, MpcState } from 'setup-mpc-common';
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
  private state!: MpcState;

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
      this.state = await this.server.getState();

      // If the ceremony hasn't started just use the server state. Necessary as the participant list
      // maybe changing. If the ceremony is running, state controlled by the client should not be
      // overwritten by the server. keepClientState() munges in the local client data to preserve it.
      // this.state = !this.state || serverState.startTime.isAfter() ? serverState : this.keepClientState(serverState);

      await this.terminalInterface.updateState(this.state);
      await this.processState();

      // If the ceremony isn't complete, schedule next update.
      if (!this.state.completedAt) {
        this.scheduleUpdate();
      }
    } catch (err) {
      this.scheduleUpdate();
      console.error(err);
    }
  };

  /*
  private keepClientState(serverState: MpcState) {
    const myServerState = serverState.participants.find(p => p.address.equals(this.account!.address));
    const myClientState = this.state.participants.find(p => p.address.equals(this.account!.address));
    if (!myServerState || !myClientState) {
      // We're an unknown participant.
      return serverState;
    }

    const { runningState, transcripts, computeProgress, lastUpdate } = myClientState;
    myState.
    return {
      ...serverState,
      participants: serverState.participants.map((p, i) => {
        return {
          ...p,
          runningState,
          transcripts: serverState.participants[i].transcripts.map((t, i) => {
            const { num, size, downloaded, uploaded } = transcripts[i];
            return {
              ...t,
              num,
              size,
              downloaded,
              uploaded,
            };
          }),
          computeProgress,
          lastUpdate,
        };
      }),
    };
  }
  */

  private scheduleUpdate = () => {
    this.i1 = setTimeout(this.updateState, 1000);
  };

  private async processState() {
    if (!this.account) {
      // We are in spectator mode.
      return;
    }

    const myState = this.state.participants.find(p => p.address.equals(this.account!.address));
    if (!myState) {
      // We're an unknown participant.
      return;
    }

    if (myState.state === 'RUNNING' && myState.runningState !== 'COMPLETE' && !this.compute) {
      this.compute = new Compute(this.state, myState, this.server, this.computeOffline);
      this.compute
        .start()
        .catch(err => {
          console.error(`Compute failed: `, err);
        })
        .finally(() => (this.compute = undefined));
      return;
    }

    if (myState.state !== 'RUNNING' && this.compute) {
      this.compute.cancel();
      this.compute = undefined;
      return;
    }
  }
}
