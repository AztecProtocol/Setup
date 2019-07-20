import { App } from './app';
import { HttpClient } from 'setup-mpc-server';
import { Wallet } from 'web3x/wallet';

async function main() {
  const wallet = Wallet.fromMnemonic('face cook metal cost prevent term foam drive sure caught pet gentle', 50);
  const myAccount = wallet.get(0)!;
  const server = new HttpClient('localhost', myAccount);
  const app = new App(server, myAccount, process.stdout, process.stdout.rows!, process.stdout.columns!);

  await app.start();

  process.stdout.on('resize', () => app.resize(process.stdout.columns!, process.stdout.rows!));
  process.once('SIGINT', () => app.stop());
  process.once('SIGTERM', () => app.stop());
}

main().catch(console.error);
