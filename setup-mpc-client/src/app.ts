import { TerminalKit } from './terminal-kit';
import { Account } from 'web3x/account';
import { TerminalInterface } from './terminal-interface';
import { Compute } from './compute';
import { MpcState, MpcServer } from 'setup-mpc-server';
import { Writable } from 'stream';

export { TerminalKit } from './terminal-kit';

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

  async start() {
    this.updateState();
    this.i2 = setInterval(async () => this.terminalInterface.updateProgress(), 1000);
  }

  stop() {
    clearTimeout(this.i1);
    clearInterval(this.i2);
    this.terminalInterface.hideCursor(false);
  }

  resize(width: number, height: number) {
    this.terminalInterface.resize(width, height);
  }

  private updateState = async () => {
    try {
      const state = await this.server.getState();
      await this.terminalInterface.updateState(state);
      await this.processState(state);
    } catch (err) {
      console.error(err);
    }

    this.scheduleUpdate();
  };

  private scheduleUpdate = () => {
    this.i1 = setTimeout(this.updateState, 1000);
  };

  private async processState(state: MpcState) {
    if (!this.account) {
      // We are in spectator mode.
      return;
    }

    const myState = state.participants.find(p => p.address.equals(this.account!.address));
    if (!myState) {
      // We're an unknown participant.
      return;
    }

    if (myState.state === 'RUNNING' && !this.compute) {
      this.compute = new Compute(this.server, this.computeOffline);
      this.compute.start(myState).catch(() => (this.compute = undefined));
      return;
    }

    if (myState.state === 'INVALIDATED' && this.compute) {
      this.compute.cancel();
      this.compute = undefined;
      return;
    }
  }
}