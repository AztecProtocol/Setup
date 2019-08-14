import http from 'http';
import { app } from './app';
import { mkdirAsync } from './fs-async';
import { Server } from './server';
import { DiskStateStore } from './state-store';
import { DiskTranscriptStore } from './transcript-store';

const { PORT = 80, STORE_PATH = './store', TMP_PATH = '/tmp' } = process.env;

async function main() {
  const stateStore = new DiskStateStore(STORE_PATH + '/state');
  const transcriptStore = new DiskTranscriptStore(STORE_PATH);

  const server = new Server(transcriptStore, stateStore);
  await server.start();

  await mkdirAsync(TMP_PATH, { recursive: true });
  const httpServer = http.createServer(app(server, '/api', TMP_PATH).callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => process.exit(0);

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
