import http from 'http';
import { app } from './app';
import { DemoServer } from './demo-server';
import { mkdirAsync } from './fs-async';
import { DiskStateStore } from './state-store';
import { DiskTranscriptStore } from './transcript-store';

const { PORT = 80, YOU_INDICIES = '', STORE_PATH = './store', TMP_PATH = '/tmp' } = process.env;

async function main() {
  const stateStore = new DiskStateStore(STORE_PATH + '/state');
  const transcriptStore = new DiskTranscriptStore(STORE_PATH);
  const youIndicies = YOU_INDICIES.split(',').map(i => +i);

  const demoServer = new DemoServer(50, transcriptStore, stateStore, youIndicies);
  await demoServer.start();

  await demoServer.addParticipants();

  await mkdirAsync(TMP_PATH, { recursive: true });
  const httpServer = http.createServer(app(demoServer, '/api', TMP_PATH).callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => process.exit(0);

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
