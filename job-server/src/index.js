import { readdirSync, readFileSync } from 'fs';
import redis from 'redis';
import bluebird from 'bluebird';
import http from 'http';
import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import { Readable } from 'stream';

bluebird.promisifyAll(redis);

const { PORT = 80, REDIS_URL = 'redis://localhost:6379' } = process.env;
const SCRIPT_DIR = './redis-scripts';

async function loadScripts(redisClient) {
  console.log('Loading scripts...');
  const files = readdirSync(SCRIPT_DIR);
  const shas = await Promise.all(
    files.map(file => redisClient.scriptAsync('load', readFileSync(`${SCRIPT_DIR}/${file}`)))
  );

  return files.reduce((a, file, i) => ({ ...a, [file]: shas[i] }), {});
}

function app(redisClient, scripts) {
  const router = new Router();

  router.get('/', async ctx => {
    ctx.body = 'OK';
  });

  router.get('/create-jobs', async ctx => {
    const { from = 0, num = 100 } = ctx.query;
    ctx.body = await redisClient.evalshaAsync(scripts['setup.lua'], 0, from, num);
  });

  router.get('/job', async ctx => {
    const numJobs = ctx.query.num || 1;
    ctx.body = await redisClient.evalshaAsync(scripts['get_job.lua'], 0, numJobs);
  });

  router.put('/complete/:id', async ctx => {
    await redisClient.evalshaAsync(scripts['complete_job.lua'], 0, ctx.params.id, ctx.request.body);
    ctx.body = `${ctx.params.id}: ${ctx.request.body}\n`;
  });

  router.get('/result', async ctx => {
    const to = Number(await redisClient.getAsync('to'));
    let { from = 0, num = to - from } = ctx.query;

    ctx.body = new Readable({
      async read() {
        if (!num) {
          this.push(null);
          return;
        }

        const batch = Math.min(num, 100);
        const keys = Array(batch)
          .fill()
          .map((_, idx) => `complete:${from + idx}`);
        const results = await redisClient.mgetAsync(...keys);
        const nullIndex = results.indexOf(null);
        const toSend = nullIndex === -1 ? batch : nullIndex;

        from += toSend;
        num -= toSend;

        if (toSend === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const chunk = results
          .slice(0, toSend)
          .map(r => `${r}\n`)
          .join('');

        this.push(chunk);
      },
    });
  });

  const app = new Koa();
  app.use(bodyParser({ enableTypes: ['text'] }));
  app.use(router.routes());

  return app;
}

async function main() {
  const redisClient = redis.createClient(REDIS_URL);
  const scripts = await loadScripts(redisClient);
  console.log('Scripts loaded: ', scripts);

  const server = http.createServer(app(redisClient, scripts).callback());
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

main().catch(console.err);
