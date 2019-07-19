import { TerminalKit } from './terminal-kit';
import { Account } from 'web3x/account';
import { TerminalInterface } from './terminal-interface';
import { MpcState, MpcServer } from 'setup-mpc-server';
import { Writable } from 'stream';

export { TerminalKit } from './terminal-kit';
export { DemoServer } from './demo-server';

export class App {
  private i1!: NodeJS.Timeout;
  private i2!: NodeJS.Timeout;
  private terminalInterface!: TerminalInterface;

  constructor(
    private server: MpcServer,
    private account: Account | undefined,
    stream: Writable,
    height: number,
    width: number
  ) {
    const termKit = new TerminalKit(stream, height, width);
    this.terminalInterface = new TerminalInterface(termKit, this.account);
  }

  async start() {
    const state = await this.server.getState();
    await this.terminalInterface.updateState(state);

    this.i1 = setInterval(async () => {
      let state = await this.server.getState();
      state = (await this.processState(state)) || state;
      await this.terminalInterface.updateState(state);
    }, 100);

    this.i2 = setInterval(async () => {
      this.terminalInterface.updateProgress();
    }, 100);
  }

  stop() {
    clearInterval(this.i1);
    clearInterval(this.i2);
    this.terminalInterface.hideCursor(false);
  }

  resize(width: number, height: number) {
    this.terminalInterface.resize(width, height);
  }

  private async processState(state: MpcState) {
    if (!this.account) {
      return;
    }
    const myIndex = state.participants.findIndex(p => p.address.equals(this.account!.address));
    const myState = state.participants[myIndex];
    if (!myState || myState.state !== 'RUNNING') {
      return;
    }
    if (myState.runningState === 'WAITING') {
      return await this.server.updateRunningState(myIndex, 'OFFLINE');
    }
  }
}
