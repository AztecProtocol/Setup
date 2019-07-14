import { terminal as term } from 'terminal-kit';
import { Wallet } from 'web3x/wallet';
import { Account } from 'web3x/account';
import { Address } from 'web3x/address';
import { leftPad } from 'web3x/utils';
import moment, { Moment } from 'moment';

const INVALIDATED_AFTER = 60;
const TEST_BAD_THINGS = false;

type ParticipantState = 'WAITING' | 'RUNNING' | 'COMPLETE' | 'INVALIDATED';

interface Participant {
  state: ParticipantState;
  position: number;
  progress: number;
  startedAt?: Moment;
  lastUpdate?: Moment;
  completedAt?: Moment;
  address: Address;
}

interface MpcServer {
  getParticipantsState(): Promise<Participant[]>;
}

class DemoServer implements MpcServer {
  private wallet: Wallet;
  private state: Participant[];

  constructor(numParticipants: number) {
    this.wallet = new Wallet(numParticipants);
    this.state = this.wallet.currentAddresses().map((address, i) => ({
      state: 'WAITING',
      position: i + 1,
      progress: 0,
      address,
    }));
  }

  private advanceState() {
    const currentIndex = this.state.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    const current = this.state[currentIndex];
    if (!current) {
      return;
    }
    if (current.state === 'WAITING') {
      current.startedAt = moment();
      current.state = 'RUNNING';
    } else {
      if (!TEST_BAD_THINGS || (currentIndex !== 1 && currentIndex !== 3)) {
        current.lastUpdate = moment();
        current.progress += Math.floor(3 + Math.random() * 5);
        if (current.progress >= 100) {
          current.completedAt = moment();
          current.state = 'COMPLETE';
          this.advanceState();
        }
      } else {
        if (
          currentIndex === 1 &&
          moment()
            .subtract(10, 's')
            .isAfter(current.startedAt!)
        ) {
          current.completedAt = moment();
          current.state = 'COMPLETE';
          this.advanceState();
        }
        if (
          currentIndex === 3 &&
          moment()
            .subtract(INVALIDATED_AFTER, 's')
            .isAfter(current.startedAt!)
        ) {
          current.state = 'INVALIDATED';
          this.advanceState();
        }
      }
    }
  }

  async getParticipantsState(): Promise<Participant[]> {
    const state = this.state.map(p => ({ ...p }));
    this.advanceState();
    return state;
  }

  getPrivateKeyAt(i: number) {
    return this.wallet.get(i)!.privateKey;
  }
}

class TerminalInterface {
  private listY!: number;
  private offset: number = 0;

  constructor(private state: Participant[], private myAccount: Account) {
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
    const myIndex = this.state.findIndex(p => p.address.equals(this.myAccount.address));
    const selectedIndex = this.state.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');

    term.clear();
    term.hideCursor();
    term.cyan('AZTEC Trusted Setup Multiparty Computation\n\n');

    if (selectedIndex === -1) {
      const completed = this.state.reduce((a, p) => a + (p.state === 'COMPLETE' ? 1 : 0), 0);
      const invalidated = this.state.reduce((a, p) => a + (p.state === 'INVALIDATED' ? 1 : 0), 0);
      term.white(
        `The ceremony is complete. ${completed} participants successfully contributed. ${invalidated} were skipped. Thank you.\n`
      );
    } else {
      if (myIndex === -1) {
        term.white(
          `The address ${
            this.myAccount.address
          } is not recognised as a participant in the MPC. You are only watching the ceremony progress.\n`
        );
      } else {
        term.white(`Thank you for participating. `);
        const myState = this.state[myIndex];
        switch (myState.state) {
          case 'WAITING':
            term.white(`You are number ${myIndex - selectedIndex} in the queue...\n`);
            break;
          case 'RUNNING':
            term.white(`You are currently processing your part of the the MPC...\n`);
            break;
          case 'COMPLETE':
            term.white(
              `Your part is complete and you can close the program, or continue to watch the ceremony progress.\n`
            );
            break;
        }
      }
    }

    term.nextLine(1);
    const { y } = await this.getCursorLocation();
    this.listY = y;
    const linesLeft = term.height - y;
    this.offset = this.getRenderOffset(linesLeft, selectedIndex);

    this.state.slice(this.offset, this.offset + linesLeft).forEach((p, i) => {
      this.renderLine(p, i);
      term.nextLine(1);
    });
  }

  private getRenderOffset(linesForList: number, selectedIndex: number) {
    const midLine = Math.floor(linesForList / 2);
    return Math.min(
      Math.max(0, (selectedIndex >= 0 ? selectedIndex : this.state.length - 1) - midLine),
      Math.max(0, this.state.length - linesForList)
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

    if (p.address.equals(this.myAccount.address)) {
      term.white(' (you)');
    }
  }

  private renderRunningLine(p: Participant) {
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.progress / 100);
    term.green(addrString.slice(0, progIndex)).grey(addrString.slice(progIndex));

    term.white(' <');
    if (p.lastUpdate) {
      term.white(` (${p.progress}%)`);
    }
    const lastInfo = p.lastUpdate || p.startedAt;
    if (
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

  updateState(state: Participant[]) {
    const currentSelectedIndex = this.state.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    const newSelectedIndex = state.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    this.state = state;
    if (currentSelectedIndex != newSelectedIndex) {
      this.render();
    }
  }

  updateProgress() {
    const selectedIndex = this.state.findIndex(p => p.state === 'RUNNING');
    if (selectedIndex === -1) {
      return;
    }
    this.renderLine(this.state[selectedIndex], selectedIndex - this.offset);
  }
}

async function main() {
  const server = new DemoServer(30);
  const myPrivateKey = server.getPrivateKeyAt(9);
  const myAccount = Account.fromPrivate(myPrivateKey);
  const state = await server.getParticipantsState();
  const terminalInterface = new TerminalInterface(state, myAccount);

  term.on('resize', () => terminalInterface.render());

  const i1 = setInterval(async () => {
    const state = await server.getParticipantsState();
    terminalInterface.updateState(state);
  }, 1000);

  const i2 = setInterval(async () => {
    terminalInterface.updateProgress();
  }, 100);

  const shutdown = () => {
    clearInterval(i1);
    clearInterval(i2);
    term.hideCursor(false);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
