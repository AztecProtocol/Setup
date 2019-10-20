import humanizeDuration from 'humanize-duration';
import moment, { Moment } from 'moment';
import { cloneMpcState, MpcState, Participant } from 'setup-mpc-common';
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
  public lastUpdate?: Moment;

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
    this.term.moveTo(0, 3);
    this.term.eraseLine();

    if (!this.state) {
      this.term.white('Awaiting update from server...');
      return;
    }

    const { startTime, completedAt } = this.state;

    const { ceremonyState, sealingProgress, publishProgress, rangeProofProgress, rangeProofSize } = this.state;
    switch (ceremonyState) {
      case 'PRESELECTION':
      case 'SELECTED': {
        const startedStr = `${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
        this.term.white(`The ceremony will begin at ${startedStr} in T-${startTime.diff(moment(), 's')}s.\n\n`);
        break;
      }
      case 'RUNNING':
        this.term.white(
          `The ceremony is in progress and started at ${startTime.utc().format('MMM Do YYYY HH:mm:ss')} UTC.\n\n`
        );
      case 'SEALING':
        if (sealingProgress < 100) {
          this.term.white(`Sealing final transcripts: ${sealingProgress.toFixed(2)}%\n\n`);
        } else {
          this.term.white('Computing H parameter...\n\n');
        }
        break;
      case 'PUBLISHING':
        this.term.white(`Publishing transcripts to S3: ${publishProgress.toFixed(2)}%\n\n`);
        break;
      case 'RANGE_PROOFS':
        this.term.white(`Computing range proofs: ${((rangeProofProgress * 100) / rangeProofSize).toFixed(2)}%\n\n`);
        break;
      case 'COMPLETE': {
        const completedStr = `${completedAt!.utc().format('MMM Do YYYY HH:mm:ss')} UTC`;
        const duration = completedAt!.diff(startTime);
        const durationText = humanizeDuration(duration, { largest: 2, round: true });
        this.term.white(`The ceremony was completed at ${completedStr} taking ${durationText}.\n\n`);
        break;
      }
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
      this.term.white(`Server status: `);
      if (!this.lastUpdate || this.lastUpdate.isBefore(moment().subtract(10, 's'))) {
        this.term.red('DISCONNECTED');
      } else {
        this.term
          .white(`(participants: ${participants.length}) (online: `)
          .green(`${online}`)
          .white(`) (offline: `)
          .red(`${offline}`)
          .white(`)\n`);
      }
    }
  }

  private renderYourStatus() {
    const { participants, selectBlock, ceremonyState, latestBlock } = this.state!;

    this.term.eraseLine();

    const myIndex = participants.findIndex(p => p.address.equals(this.myAccount!.address));
    if (myIndex === -1) {
      this.term.white(`Private key does not match an address. You are currently spectating.\n`);
    } else {
      const myState = participants[myIndex];
      switch (myState.state) {
        case 'WAITING':
          if (ceremonyState === 'PRESELECTION') {
            const selectCountdown = selectBlock - latestBlock;
            this.term.white(
              `Your position in the queue will determined at block number ${selectBlock} (B-${selectCountdown}).\n`
            );
          }
          if (ceremonyState !== 'RUNNING') {
            this.term.white('Participants are no longer being selected.\n');
          } else {
            const first = participants.find(p => p.state === 'WAITING' || p.state === 'RUNNING')!;
            const inFront = myState.position - first.position;
            this.term.white(
              `You are in position ${myState.position} (${inFront ? inFront + ' in front' : "you're next"}).\n`
            );
          }
          break;
        case 'RUNNING':
          if (myState.runningState === 'OFFLINE') {
            this.term.white(`It's your turn. You have opted to perform the computation externally.\n`);
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
          this.term.white(`You failed to compute your part of the ceremony.\n`);
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
    if (this.listY + i > this.term.height) {
      return;
    }
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
        this.term.grey(`${p.address.toString()}`);
        if (this.state!.ceremonyState !== 'PRESELECTION') {
          this.term.grey(` (${p.priority})`);
        }
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
    const progIndex = addrString.length * ((p.runningState === 'OFFLINE' ? p.verifyProgress : p.computeProgress) / 100);
    term.yellow(addrString.slice(0, progIndex)).grey(addrString.slice(progIndex));

    term.red(' <');
    if (p.lastUpdate || p.runningState === 'OFFLINE') {
      switch (p.runningState) {
        case 'OFFLINE':
          term
            .white(' (')
            .blue('computing offline')
            .white(') (')
            .blue('\u2714')
            .white(` ${p.verifyProgress.toFixed(p.verifyProgress < 100 ? 2 : 0)}%`)
            .white(`)`);
          break;
        case 'RUNNING':
        case 'COMPLETE': {
          const totalData = p.transcripts.reduce((a, t) => a + t.size, 0);
          const totalDownloaded = p.transcripts.reduce((a, t) => a + t.downloaded, 0);
          const totalUploaded = p.transcripts.reduce((a, t) => a + t.uploaded, 0);
          const downloadProgress = totalData ? (totalDownloaded / totalData) * 100 : 0;
          const uploadProgress = totalData ? (totalUploaded / totalData) * 100 : 0;
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

    const { invalidateAfter, numG1Points, numG2Points, pointsPerTranscript } = this.state!;
    const verifyWithin = invalidateAfter / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
    const verifyTimeout = Math.max(
      0,
      moment(p.lastVerified || p.startedAt!)
        .add(verifyWithin, 's')
        .diff(moment(), 's')
    );
    const timeout = Math.max(
      0,
      moment(p.startedAt!)
        .add(this.state!.invalidateAfter, 's')
        .diff(moment(), 's')
    );

    term.white(` (`).blue('\u25b6\u25b6 ');

    if (p.tier > 1) {
      term.white(`${verifyTimeout}/`);
    }
    term.white(`${timeout}s)`);
  }

  public async updateState(state?: MpcState) {
    const oldState = this.state;
    this.state = state ? cloneMpcState(state) : undefined;

    if (!oldState || !this.state || oldState.startSequence !== this.state.startSequence) {
      // If first time or reset render everything.
      this.render();
      return;
    }

    if (
      this.state.ceremonyState === 'PRESELECTION' ||
      this.state.ceremonyState === 'SELECTED' ||
      this.state.statusSequence !== oldState.statusSequence
    ) {
      // If the ceremony hasn't started, update the status line for the countdown.
      await this.renderStatus();
    } else {
      await this.renderBanner();
    }

    this.state.participants.forEach((p, i) => {
      // Update any new participants, participants that changed, and always the running participant (for the countdown).
      if (!oldState.participants[i] || p.sequence !== oldState.participants[i].sequence || p.state === 'RUNNING') {
        this.renderLine(p, i);
      }
    });
  }

  public getParticipant(address: Address) {
    return this.state!.participants.find(p => p.address.equals(address))!;
  }
}
