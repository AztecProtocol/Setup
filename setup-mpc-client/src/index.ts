import { App } from './app';
import { DemoServer } from 'setup-mpc-server';
import moment from 'moment';
import { Account } from 'web3x/account';

async function main() {
  const myIndex = 10;
  const server = new DemoServer(40, moment().add(10, 's'));
  const myPrivateKey = server.getPrivateKeyAt(myIndex);
  const myAccount = Account.fromPrivate(myPrivateKey);
  server.setYouIndex(myIndex);
  const app = new App(server, myAccount, process.stdout, process.stdout.rows!, process.stdout.columns!);

  await app.start();

  process.stdout.on('resize', () => app.resize(process.stdout.columns!, process.stdout.rows!));
  process.once('SIGINT', () => app.stop());
  process.once('SIGTERM', () => app.stop());
}

main().catch(console.error);
