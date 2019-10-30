import { HttpClient } from 'setup-mpc-common';
import { App } from './app';

async function main() {
  const {
    API_URL = 'https://ignition.aztecprotocol.com/api',
    ALERT_TIME_LEFT = '600',
    SLACK_MPC_TOKEN = '',
  } = process.env;

  const server = new HttpClient(API_URL);
  const app = new App(server, +ALERT_TIME_LEFT, SLACK_MPC_TOKEN);

  app.start();

  const shutdown = () => {
    app.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(err => console.log(err.message));
