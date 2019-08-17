import humanizeDuration from 'humanize-duration';
import moment from 'moment';
import { MpcState, Participant } from 'setup-mpc-common';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { leftPad } from 'web3x/utils';
import { TerminalKit } from './terminal-kit';

export class TerminalInterface {
  private banner = false;
  private bannerY!: number;
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

    const { startTime, completedAt } = this.state;

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

    this.bannerY = (await this.getCursorLocation()).y;
    this.renderBanner(true);

    this.term.nextLine(1);

    const { y } = await this.getCursorLocation();
    this.listY = y;
  }

  private renderBanner(force: boolean = false) {
    const banner = this.myAccount && new Date().getTime() % 20000 < 10000;

    if (banner && (!this.banner || force)) {
      this.term.moveTo(0, this.bannerY);
      this.term.eraseLine();
      this.banner = true;
      this.renderYourStatus();
    } else if (!banner && (this.banner || force)) {
      const { participants } = this.state!;
      this.term.moveTo(0, this.bannerY);
      this.term.eraseLine();
      this.banner = false;
      const online = participants.reduce((a, p) => a + (p.online ? 1 : 0), 0);
      const offline = participants.length - online;
      this.term
        .white(`Server status: (participants: ${participants.length}) (online: `)
        .green(`${online}`)
        .white(`) (offline: `)
        .red(`${offline}`)
        .white(')\n');
    }
  }

  private renderYourStatus() {
    const { participants } = this.state!;

    this.term.eraseLine();

    const myIndex = participants.findIndex(p => p.address.equals(this.myAccount!.address));
    const selectedIndex = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    if (myIndex === -1) {
      this.term.white(`Private key does not match an address. You are currently spectating.\n`);
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
    if (p.online) {
      this.term.green('\u25CF ');
    } else {
      this.term.red('\u25CF ');
    }
    this.term.white(`${leftPad(p.position.toString(), 2)}. `);
    switch (p.state) {
      case 'WAITING':
        this.term.grey(`${p.address.toString()} (${p.priority})`);
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
  }

  public async updateState(state: MpcState) {
    const oldState = this.state;
    this.state = state;

    if (!oldState) {
      // If first time render everything.
      this.render();
      return;
    }

    if (moment().isBefore(state.startTime) || state.statusSequence !== oldState.statusSequence) {
      // If the ceremony hasn't started, update the status line for the countdown.
      await this.renderStatus();
    } else {
      await this.renderBanner();
    }

    state.participants.forEach((p, i) => {
      // Update any new participants, participants that changed, and always the running participant (for the countdown).
      if (!oldState.participants[i] || p.sequence !== oldState.participants[i].sequence || p.state === 'RUNNING') {
        this.renderLine(p, i);
      }
    });
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
}
