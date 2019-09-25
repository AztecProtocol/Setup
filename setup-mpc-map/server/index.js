const serve = require('koa-static');
const Koa = require('koa');
const proxy = require('koa-proxy');

const { PORT = '80' } = process.env;

const shutdown = () => process.exit(0);
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

const app = new Koa();

// When running locally, calls to the api will hit this server rather
// than being handled by the ALB. We forward the api calls onto the server here.
if (process.env.NODE_ENV !== 'production') {
  app.use(
    proxy({
      host: 'http://setup-mpc-server',
      match: /^\/api\//,
    })
  );
}

app.use(serve('dist')).listen(PORT);

console.log(`Server listening on port ${PORT}`);
