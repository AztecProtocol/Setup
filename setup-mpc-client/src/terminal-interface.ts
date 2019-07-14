import { terminal as term } from 'terminal-kit';
import { Account } from 'web3x/account';
import { leftPad } from 'web3x/utils';
import moment from 'moment';
import { MpcState, Participant, INVALIDATED_AFTER } from './mpc-server';

export class TerminalInterface {
  private ceremonyBegun = false;
  private listY!: number;
  private offset: number = 0;

  constructor(private state: MpcState, private myAccount?: Account, private computeOffline: boolean = false) {
    this.state = state;
    this.render();
  }

  private async getCursorLocation(): Promise<{ x: number; y: number }> {
    return new Promise((resolve, reject) => {
      term.getCursorLocation((err: any, x?: number, y?: number) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ x: x!, y: y! });
      });
    });
  }

  async render() {
    term.clear();
    term.hideCursor();
    term.cyan('AZTEC Trusted Setup Multi Party Computation\n\n');
    await this.renderStatus();
    this.renderList();
  }

  private async renderStatus() {
    const { startTime, completedAt, participants } = this.state;

    term.moveTo(0, 3);
    term.eraseLine();
    term.white();

    if (completedAt) {
      const completedStr = `${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
      const duration = completedAt.diff(startTime, 's');
      term(`The ceremony was completed at ${completedStr} taking a total of ${duration}s.\n\n`);
    } else if (startTime.isAfter()) {
      const startedStr = `${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
      term(`The ceremony will begin at ${startedStr} in T-${startTime.diff(moment(), 's')}s.\n\n`);
    } else {
      term(`The ceremony is in progress and started at ${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC.\n\n`);
    }

    if (!this.myAccount) {
      term('No account provided. You are currently spectating.\n');
      return;
    }

    term.eraseLine();

    const myIndex = participants.findIndex(p => p.address.equals(this.myAccount!.address));
    const selectedIndex = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    if (myIndex === -1) {
      term(
        `The address ${
          this.myAccount.address
        } is not recognised as a participant in the ceremony. You are currently spectating.\n`
      );
      return;
    }

    const myState = participants[myIndex];
    switch (myState.state) {
      case 'WAITING':
        term(`You are number ${myIndex - selectedIndex} in the queue.\n`);
        break;
      case 'RUNNING':
        if (myState.runningState === 'OFFLINE') {
          term(`It's your turn. You have opted to perform the computation externally. Please compute and upload.\n`);
        } else {
          term(`You are currently processing your part of the ceremony...\n`);
        }
        break;
      case 'COMPLETE':
        term(`Your part is complete and you can close the program at any time. Thank you for participating.\n`);
        break;
      case 'INVALIDATED':
        term(`You failed to compute your part of the ceremony within the time limit.\n`);
        break;
    }

    term.nextLine(1);

    const { y } = await this.getCursorLocation();
    this.listY = y;
  }

  private async renderList() {
    const { participants } = this.state;
    const selectedIndex = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');

    const linesLeft = term.height - this.listY;
    this.offset = this.getRenderOffset(linesLeft, selectedIndex);

    participants.slice(this.offset, this.offset + linesLeft).forEach((p, i) => {
      this.renderLine(p, i);
      term.nextLine(1);
    });

    term.eraseDisplayBelow();
  }

  private getRenderOffset(linesForList: number, selectedIndex: number) {
    const midLine = Math.floor(linesForList / 2);
    return Math.min(
      Math.max(0, (selectedIndex >= 0 ? selectedIndex : this.state.participants.length - 1) - midLine),
      Math.max(0, this.state.participants.length - linesForList)
    );
  }

  private renderLine(p: Participant, i: number) {
    term.moveTo(0, this.listY + i);
    term.eraseLine();
    term.bgDefaultColor.white(`${leftPad(p.position.toString(), 2)}. `);
    switch (p.state) {
      case 'WAITING':
        term.gray(p.address);
        break;
      case 'RUNNING':
        this.renderRunningLine(p);
        break;
      case 'COMPLETE':
        term.green(p.address);
        term.grey(` (${p.completedAt!.diff(p.startedAt!, 's')}s)`);
        break;
      case 'INVALIDATED':
        term.red(p.address);
        break;
    }

    if (this.myAccount && p.address.equals(this.myAccount.address)) {
      term.white(' (you)');
    }
  }

  private renderRunningLine(p: Participant) {
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.progress / 100);
    term.green(addrString.slice(0, progIndex)).grey(addrString.slice(progIndex));

    term.white(' <');
    if (p.lastUpdate || p.runningState === 'OFFLINE') {
      switch (p.runningState) {
        case 'OFFLINE':
          term
            .white(' (')
            .blue('computing offline')
            .white(')');
          break;
        case 'DOWNLOADING':
          term
            .white(' (')
            .blue('downloading')
            .white(')');
          break;
        case 'COMPUTING':
          term.white(` (${p.progress}%)`);
          break;
        case 'UPLOADING':
          term
            .white(' (')
            .blue('uploading')
            .white(')');
          break;
      }
    }
    const lastInfo = p.lastUpdate || p.startedAt;
    if (
      p.runningState != 'OFFLINE' &&
      lastInfo &&
      moment()
        .subtract(5, 's')
        .isAfter(lastInfo)
    ) {
      term
        .white(' (')
        .red('offline')
        .white(')');
    }
    term.white(
      ` (skipping in ${moment(p.startedAt!)
        .add(INVALIDATED_AFTER, 's')
        .diff(moment(), 's')}s)`
    );
  }

  async updateState(state: MpcState) {
    if (moment().isBefore(state.startTime)) {
      await this.renderStatus();
      return;
    }

    if (!this.ceremonyBegun) {
      this.ceremonyBegun = true;
      await this.renderStatus();
    }

    const currentSelectedIndex = this.state.participants.findIndex(
      p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED'
    );
    const newSelectedIndex = state.participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    this.state = state;
    if (currentSelectedIndex != newSelectedIndex) {
      await this.renderStatus();
      this.renderList();
    }
  }

  updateProgress() {
    const selectedIndex = this.state.participants.findIndex(p => p.state === 'RUNNING');
    if (selectedIndex === -1) {
      return;
    }
    this.renderLine(this.state.participants[selectedIndex], selectedIndex - this.offset);
  }
}
