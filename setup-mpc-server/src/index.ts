import http from 'http';
import { Address } from 'web3x/address';
import { appFactory } from './app';
import { defaultState } from './default-state';
import { mkdirAsync } from './fs-async';
import { ParticipantSelectorFactory } from './participant-selector';
import { Server } from './server';
import { DiskStateStore } from './state-store';
import { DiskTranscriptStore } from './transcript-store';

const { PORT = 80, STORE_PATH = './store' } = process.env;

async function main() {
  const shutdown = async () => process.exit(0);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const adminAddress = Address.fromString('0x3a9b2101bff555793b85493b5171451fa00124c8');
  const participantSelectorFactory = new ParticipantSelectorFactory('ropsten', adminAddress);
  const latestBlock = await participantSelectorFactory.getCurrentBlockHeight();
  const defaults = defaultState(latestBlock);
  const stateStore = new DiskStateStore(STORE_PATH + '/state', defaults);
  const transcriptStore = new DiskTranscriptStore(STORE_PATH);

  const server = new Server(transcriptStore, stateStore, participantSelectorFactory);
  await server.start();

  const tmpPath = STORE_PATH + '/tmp';
  await mkdirAsync(tmpPath, { recursive: true });
  const app = appFactory(server, adminAddress, participantSelectorFactory, '/api', tmpPath);

  const httpServer = http.createServer(app.callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);
}

main().catch(console.error);
