import http from 'http';
import { app } from './app';
import { DemoServer } from './demo-server';
import moment from 'moment';

const { PORT = 80, YOU_INDICIES = '' } = process.env;

async function main() {
  const demoServer = new DemoServer(50, moment().add(5, 's'), YOU_INDICIES.split(',').map(i => +i));
  demoServer.start();

  const httpServer = http.createServer(app(demoServer).callback());
  httpServer.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => {
    console.log('Shutting down.');
    demoServer.stop();
    await new Promise(resolve => httpServer.close(resolve));
    console.log('Shutdown complete.');
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
