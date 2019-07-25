import moment from 'moment';
import { Account } from 'web3x/account';
import { leftPad } from 'web3x/utils';
import { INVALIDATED_AFTER, MpcState, Participant } from './setup-mpc-common';
import { TerminalKit } from './terminal-kit';

const DISPLAY_AS_OFFLINE_AFTER = 10;

export class TerminalInterface {
  private ceremonyBegun = false;
  private currentlySelectedIndex?: number;
  private listY!: number;
  private offset: number = 0;
  private state?: MpcState;

  constructor(private term: TerminalKit, private myAccount?: Account) {}

  private async getCursorLocation(): Promise<{ x: number; y: number }> {
    return new Promise((resolve, reject) => {
      this.term.getCursorLocation((err: any, x?: number, y?: number) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ x: x!, y: y! });
      });
    });
  }

  public async render() {
    this.term.clear();
    this.term.hideCursor();
    this.term.cyan('AZTEC Trusted Setup Multi Party Computation\n\n');
    await this.renderStatus();
    this.renderList();
  }

  public resize(width: number, height: number) {
    this.term.width = width;
    this.term.height = height;
    this.render();
  }

  public hideCursor(hide: boolean = true) {
    this.term.hideCursor(hide);
  }

  private async renderStatus() {
    if (!this.state) {
      return;
    }

    const { startTime, completedAt, participants } = this.state;

    this.term.moveTo(0, 3);
    this.term.eraseLine();

    if (completedAt) {
      const completedStr = `${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
      const duration = completedAt.diff(startTime, 's');
      this.term.white(`The ceremony was completed at ${completedStr} taking a total of ${duration}s.\n\n`);
    } else if (startTime.isAfter()) {
      const startedStr = `${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
      this.term.white(`The ceremony will begin at ${startedStr} in T-${startTime.diff(moment(), 's')}s.\n\n`);
    } else {
      this.term.white(
        `The ceremony is in progress and started at ${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC.\n\n`
      );
    }

    this.term.eraseLine();

    if (!this.myAccount) {
      this.term.white('You are currently in spectator mode.\n');
    } else {
      const myIndex = participants.findIndex(p => p.address.equals(this.myAccount!.address));
      const selectedIndex = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
      if (myIndex === -1) {
        this.term.white(
          `The address ${
            this.myAccount.address
          } is not recognised as a participant in the ceremony. You are currently spectating.\n`
        );
      } else {
        const myState = participants[myIndex];
        switch (myState.state) {
          case 'WAITING':
            const position = myIndex - selectedIndex;
            this.term.white(`You are ${position ? `number ${myIndex - selectedIndex}` : 'first'} in the queue.\n`);
            break;
          case 'RUNNING':
            if (myState.runningState === 'OFFLINE') {
              this.term.white(
                `It's your turn. You have opted to perform the computation externally. Please compute and upload.\n`
              );
            } else {
              this.term.white(`You are currently processing your part of the ceremony...\n`);
            }
            break;
          case 'COMPLETE':
            this.term.white(
              `Your part is complete and you can close the program at any time. Thank you for participating.\n`
            );
            break;
          case 'INVALIDATED':
            this.term.white(`You failed to compute your part of the ceremony within the time limit.\n`);
            break;
        }
      }
    }

    this.term.nextLine(1);

    const { y } = await this.getCursorLocation();
    this.listY = y;
  }

  private async renderList() {
    if (!this.state) {
      return;
    }

    const { participants } = this.state;
    const selectedIndex = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');

    const linesLeft = this.term.height - this.listY;
    this.offset = this.getRenderOffset(linesLeft, selectedIndex);

    participants.slice(this.offset, this.offset + linesLeft).forEach((p, i) => {
      this.renderLine(p, i);
      this.term.nextLine(1);
    });

    this.term.eraseDisplayBelow();
  }

  private getRenderOffset(linesForList: number, selectedIndex: number) {
    const midLine = Math.floor(linesForList / 2);
    return Math.min(
      Math.max(0, (selectedIndex >= 0 ? selectedIndex : this.state!.participants.length - 1) - midLine),
      Math.max(0, this.state!.participants.length - linesForList)
    );
  }

  private renderLine(p: Participant, i: number) {
    this.term.moveTo(0, this.listY + i);
    this.term.eraseLine();
    this.term.white(`${leftPad(p.position.toString(), 2)}. `);
    switch (p.state) {
      case 'WAITING':
        this.term.grey(p.address.toString());
        break;
      case 'RUNNING':
        this.renderRunningLine(p);
        break;
      case 'COMPLETE':
        this.term.green(p.address.toString());
        this.term.grey(` (${p.completedAt!.diff(p.startedAt!, 's')}s)`);
        break;
      case 'INVALIDATED':
        this.term.red(p.address.toString());
        if (p.error) {
          this.term.grey(` (${p.error})`);
        }
        break;
    }

    if (this.myAccount && p.address.equals(this.myAccount.address)) {
      this.term.white(' (you)');
    }
  }

  private renderRunningLine(p: Participant) {
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.progress / 100);
    this.term.yellow(addrString.slice(0, progIndex)).grey(addrString.slice(progIndex));

    this.term.white(' <');
    if (p.lastUpdate || p.runningState === 'OFFLINE') {
      switch (p.runningState) {
        case 'OFFLINE':
          this.term
            .white(' (')
            .blue('computing offline')
            .white(')');
          break;
        case 'DOWNLOADING':
          this.term
            .white(' (')
            .blue('downloading')
            .white(')');
          break;
        case 'VERIFYING':
          this.term
            .white(' (')
            .blue('verifying')
            .white(')');
          break;
        case 'COMPUTING':
          this.term
            .white(' (')
            .blue('computing')
            .white(`) (${p.progress}%)`);
          break;
        case 'UPLOADING':
          this.term
            .white(' (')
            .blue('uploading')
            .white(')');
          break;
      }
    }
    const lastInfo = p.lastUpdate || p.startedAt;
    if (
      p.runningState !== 'OFFLINE' &&
      p.runningState !== 'VERIFYING' &&
      lastInfo &&
      moment()
        .subtract(DISPLAY_AS_OFFLINE_AFTER, 's')
        .isAfter(lastInfo)
    ) {
      this.term
        .white(' (')
        .red('offline')
        .white(')');
    }
    if (p.runningState !== 'VERIFYING') {
      this.term.white(
        ` (skipping in ${Math.max(
          0,
          moment(p.startedAt!)
            .add(INVALIDATED_AFTER, 's')
            .diff(moment(), 's')
        )}s)`
      );
    }
  }

  public async updateState(state: MpcState) {
    if (!this.state) {
      this.state = state;
      this.render();
      return;
    }

    this.state = state;

    if (moment().isBefore(state.startTime)) {
      if (this.ceremonyBegun) {
        this.ceremonyBegun = false;
        this.currentlySelectedIndex = 0;
        this.render();
        return;
      }
      await this.renderStatus();
      return;
    }

    if (!this.ceremonyBegun) {
      this.ceremonyBegun = true;
      await this.renderStatus();
    }

    const newSelectedIndex = state.participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    if (this.currentlySelectedIndex !== newSelectedIndex) {
      this.currentlySelectedIndex = newSelectedIndex;
      await this.renderStatus();
      this.renderList();
    }
  }

  public updateProgress() {
    if (!this.state) {
      return;
    }

    const selectedIndex = this.state.participants.findIndex(p => p.state === 'RUNNING');
    if (selectedIndex === -1) {
      return;
    }
    this.renderLine(this.state.participants[selectedIndex], selectedIndex - this.offset);
  }
}
