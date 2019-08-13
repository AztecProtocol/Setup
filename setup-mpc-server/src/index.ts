import http from 'http';
import { app } from './app';
import { defaultSettings } from './default-settings';
import { DemoServer } from './demo-server';
import { DiskTranscriptStore } from './transcript-store';

const { PORT = 80, YOU_INDICIES = '', STORE_PATH = '../store' } = process.env;

async function main() {
  const transcriptStore = new DiskTranscriptStore(STORE_PATH);
  const youIndicies = YOU_INDICIES.split(',').map(i => +i);
  const { startTime, numG1Points, numG2Points, invalidateAfter } = defaultSettings();
  const demoServer = new DemoServer(50, transcriptStore, youIndicies);
  await demoServer.resetState(startTime, numG1Points, numG2Points, invalidateAfter);
  demoServer.start();

  const httpServer = http.createServer(app(demoServer, '/api').callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => process.exit(0);

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
