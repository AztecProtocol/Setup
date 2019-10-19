import { HttpClient } from 'setup-mpc-common';
import { Account } from 'web3x/account';
import { hexToBuffer } from 'web3x/utils';
import { App } from './app';

async function main() {
  const {
    API_URL = 'https://ignition.aztecprotocol.com/api',
    PRIVATE_KEY = '',
    COMPUTE_OFFLINE = 0,
    EXIT_ON_COMPLETE = 0,
  } = process.env;

  if (!PRIVATE_KEY && !process.stdout.isTTY) {
    throw new Error('If spectating (no private key) you must run in interactive mode.');
  }

  const myAccount = PRIVATE_KEY ? Account.fromPrivate(hexToBuffer(PRIVATE_KEY)) : undefined;
  const server = new HttpClient(API_URL, myAccount);
  const app = new App(
    server,
    myAccount,
    process.stdout,
    process.stdout.rows!,
    process.stdout.columns!,
    +COMPUTE_OFFLINE > 0,
    +EXIT_ON_COMPLETE > 0 || !process.stdout.isTTY
  );

  app.start();

  process.stdout.on('resize', () => app.resize(process.stdout.columns!, process.stdout.rows!));

  const shutdown = () => {
    app.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(err => console.log(err.message));
