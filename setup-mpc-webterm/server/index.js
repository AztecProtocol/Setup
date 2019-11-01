const serve = require('koa-static');
const mount = require('koa-mount');
const Koa = require('koa');
const proxy = require('koa-proxy');

const { PORT = '8080' } = process.env;

const static = new Koa().use(serve('dist'));

const app = new Koa();

// When running locally, calls to the api will hit this server rather
// than being handled by the ALB. We forward the api calls onto the server here.
if (process.env.NODE_ENV !== 'production') {
  app.use(
    proxy({
      host: 'https://ignition.aztecprotocol.com',
      match: /^\/api\//,
    })
  );
}

app.use(mount('/terminal', static)).listen(PORT);

console.log(`Server listening on port ${PORT}`);
