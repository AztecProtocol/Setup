import humanizeDuration from 'humanize-duration';
import moment from 'moment';
import { MpcState, Participant } from 'setup-mpc-common';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { leftPad } from 'web3x/utils';
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
      const duration = completedAt.diff(startTime);
      const durationText = humanizeDuration(duration, { largest: 2, round: true });
      this.term.white(`The ceremony was completed at ${completedStr} taking ${durationText}.\n\n`);
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
        this.term.white(`Private does not match an address. You are currently spectating.\n`);
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
    const { term } = this;
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.computeProgress / 100);
    term.yellow(addrString.slice(0, progIndex)).grey(addrString.slice(progIndex));

    term.red(' <');
    if (p.lastUpdate || p.runningState === 'OFFLINE') {
      switch (p.runningState) {
        case 'OFFLINE':
          term
            .white(' (')
            .blue('computing offline')
            .white(')');
          break;
        case 'RUNNING':
        case 'COMPLETE': {
          const totalData = p.transcripts.reduce((a, t) => a + t.size, 0);
          const totalDownloaded = p.transcripts.reduce((a, t) => a + t.downloaded, 0);
          const totalUploaded = p.transcripts.reduce((a, t) => a + t.uploaded, 0);
          const downloadProgress = (totalDownloaded / totalData) * 100;
          const uploadProgress = (totalUploaded / totalData) * 100;
          const computeProgress = p.computeProgress;
          const verifyProgress = p.verifyProgress;
          term
            .white(` (`)
            .blue('\u2b07')
            .white(` ${downloadProgress.toFixed(downloadProgress < 100 ? 2 : 0)}%`)
            .white(`)`);
          term
            .white(` (`)
            .blue('\u2699')
            .white(` ${computeProgress.toFixed(computeProgress < 100 ? 2 : 0)}%`)
            .white(`)`);
          term
            .white(` (`)
            .blue('\u2b06')
            .white(` ${uploadProgress.toFixed(uploadProgress < 100 ? 2 : 0)}%`)
            .white(`)`);
          term
            .white(` (`)
            .blue('\u2714')
            .white(` ${verifyProgress.toFixed(verifyProgress < 100 ? 2 : 0)}%`)
            .white(`)`);
          break;
        }
      }
    }

    this.term
      .white(` (`)
      .blue('\u25b6\u25b6')
      .white(
        ` ${Math.max(
          0,
          moment(p.startedAt!)
            .add(this.state!.invalidateAfter, 's')
            .diff(moment(), 's')
        )}s)`
      );

    const lastInfo = p.lastUpdate || p.startedAt;
    if (
      (p.runningState === 'WAITING' || p.runningState === 'RUNNING') &&
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
  }

  public async updateState(state: MpcState) {
    if (!this.state) {
      this.state = state;
      this.render();
      return;
    }

    if (this.state.participants.length !== state.participants.length) {
      this.state = state;
      this.render();
      return;
    }

    this.state = state;

    if (moment().isBefore(state.startTime)) {
      if (this.ceremonyBegun) {
        // Server has been reset, re-render everything.
        this.ceremonyBegun = false;
        this.currentlySelectedIndex = undefined;
        this.render();
        return;
      }
      // Updates just the countdown.
      await this.renderStatus();
      return;
    }

    if (!this.ceremonyBegun) {
      // Transitioning to running. Update the status.
      this.ceremonyBegun = true;
      await this.renderStatus();
    }

    const newSelectedIndex = state.participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    if (this.currentlySelectedIndex !== newSelectedIndex) {
      this.currentlySelectedIndex = newSelectedIndex;
      await this.renderStatus();
      this.renderList();
    } else {
      this.updateProgress();
    }
  }

  public updateParticipant(participant: Participant) {
    if (!this.state) {
      return;
    }
    const index = this.state.participants.findIndex(p => p.address.equals(participant.address));
    if (index >= 0 && this.state.participants[index].state === 'RUNNING') {
      this.state.participants[index] = participant;
      this.renderLine(this.state.participants[index], index - this.offset);
    }
  }

  public getParticipant(address: Address) {
    return this.state!.participants.find(p => p.address.equals(address))!;
  }

  private updateProgress() {
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
