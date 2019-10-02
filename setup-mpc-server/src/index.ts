import http from 'http';
import { Address } from 'web3x/address';
import { appFactory } from './app';
import { mkdirAsync } from './fs-async';
import { ParticipantSelectorFactory } from './participant-selector';
import { RangeProofPublisherFactory } from './range-proof-publisher';
import { Server } from './server';
import { DiskStateStore } from './state-store';
import { defaultState } from './state/default-state';
import { DiskTranscriptStoreFactory } from './transcript-store';

const { PORT = 80, STORE_PATH = './store', INFURA_API_KEY = '', JOB_SERVER_HOST = 'job-server' } = process.env;

async function main() {
  const shutdown = async () => process.exit(0);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const adminAddress = Address.fromString('0x3a9b2101bff555793b85493b5171451fa00124c8');
  const participantSelectorFactory = new ParticipantSelectorFactory(adminAddress, INFURA_API_KEY);
  const latestBlock = await participantSelectorFactory.getCurrentBlockHeight('ropsten');
  const defaults = defaultState(latestBlock);
  const stateStore = new DiskStateStore(STORE_PATH + '/state', defaults);
  const transcriptStoreFactory = new DiskTranscriptStoreFactory(STORE_PATH);
  const rangeProofPublisherFactory = new RangeProofPublisherFactory(JOB_SERVER_HOST);

  const server = new Server(transcriptStoreFactory, stateStore, participantSelectorFactory, rangeProofPublisherFactory);
  await server.start();

  const tmpPath = STORE_PATH + '/tmp';
  await mkdirAsync(tmpPath, { recursive: true });
  const app = appFactory(server, adminAddress, participantSelectorFactory, '/api', tmpPath);

  const httpServer = http.createServer(app.callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);
}

main().catch(console.error);
