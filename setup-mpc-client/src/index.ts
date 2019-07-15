import { terminal as term } from 'terminal-kit';
import { Account } from 'web3x/account';
import moment from 'moment';
import { MpcState, MpcServer } from './mpc-server';
import { DemoServer } from './demo-server';
import { TerminalInterface } from './terminal-interface';

async function main() {
  const server = new DemoServer(40, moment().add(10, 's'));
  const myIndex = 10;
  server.setYouIndex(myIndex);
  const myPrivateKey = server.getPrivateKeyAt(myIndex);
  const myAccount = Account.fromPrivate(myPrivateKey);
  const state = await server.getState();
  const terminalInterface = new TerminalInterface(state, myAccount);

  term.on('resize', () => terminalInterface.render());

  const i1 = setInterval(async () => {
    let state = await server.getState();
    state = (await processState(state, myAccount, server)) || state;
    await terminalInterface.updateState(state);
  }, 100);

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

async function processState(state: MpcState, myAccount: Account, server: MpcServer) {
  const myIndex = state.participants.findIndex(p => p.address.equals(myAccount.address));
  const myState = state.participants[myIndex];
  if (!myState || myState.state !== 'RUNNING') {
    return;
  }
  if (myState.runningState === 'WAITING') {
    return await server.updateRunningState(myIndex, 'OFFLINE');
  }
}

main().catch(console.error);
