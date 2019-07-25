import { Wallet } from 'web3x/wallet';
import { App } from './app';
import { HttpClient } from './setup-mpc-common';

async function main() {
  const { SERVER_HOST = 'localhost', ACCOUNT_INDEX = '0' } = process.env;
  const wallet = Wallet.fromMnemonic('face cook metal cost prevent term foam drive sure caught pet gentle', 50);
  const myAccount = wallet.get(+ACCOUNT_INDEX)!;
  const server = new HttpClient(SERVER_HOST, myAccount);
  const app = new App(server, myAccount, process.stdout, process.stdout.rows!, process.stdout.columns!);

  app.start();

  process.stdout.on('resize', () => app.resize(process.stdout.columns!, process.stdout.rows!));
  process.once('SIGINT', () => app.stop());
  process.once('SIGTERM', () => app.stop());
}

main().catch(console.error);
