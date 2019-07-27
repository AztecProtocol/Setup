import http from 'http';
import moment from 'moment';
import { app } from './app';
import { DemoServer } from './server';
import { DiskTranscriptStore } from './transcript-store';

const { PORT = 80, YOU_INDICIES = '', STORE_PATH = '../store' } = process.env;

async function main() {
  const transcriptStore = new DiskTranscriptStore(STORE_PATH);
  const youIndicies = YOU_INDICIES.split(',').map(i => +i);
  const demoServer = new DemoServer(50, transcriptStore, youIndicies);
  demoServer.resetState(moment().add(5, 's'), 250000);
  demoServer.start();

  const httpServer = http.createServer(app(demoServer).callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => process.exit(0);

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
