import http from 'http';
import { app } from './app';

export * from './mpc-server';
export * from './demo-server';

const { PORT = 80 } = process.env;

async function main() {
  const server = http.createServer(app().callback());
  server.listen(PORT);
  console.log(`Server listening on port ${PORT}.`);

  const shutdown = async () => {
    console.log('Shutting down.');
    await new Promise(resolve => server.close(resolve));
    console.log('Shutdown complete.');
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(console.error);
