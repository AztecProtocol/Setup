import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

export function app() {
  const router = new Router();

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  const app = new Koa();
  app.use(bodyParser({ enableTypes: ['text'] }));
  app.use(router.routes());

  return app;
}
