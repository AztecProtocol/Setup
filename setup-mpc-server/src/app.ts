import Koa from 'koa';
import Router from 'koa-router';
import koaBody from 'koa-body';
import { DemoServer } from './demo-server';
import moment from 'moment';
import { Address } from 'web3x/address';
import { recover, bufferToHex } from 'web3x/utils';
import { unlink } from 'fs';
import { hashFiles } from './hash-files';

const cors = require('@koa/cors');

export function app() {
  const server = new DemoServer(50, moment().add(5, 's'), 0);
  server.start();

  const router = new Router();

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  router.get('/state', async (ctx: Koa.Context) => {
    ctx.body = await server.getState();
  });

  router.patch('/participant/:address', koaBody(), async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    const address = Address.fromString(ctx.params['address']);
    if (!address.equals(recover(JSON.stringify(ctx.request.body), signature))) {
      ctx.status = 401;
      return;
    }
    await server.updateParticipant({
      ...ctx.request.body,
      address,
    });
    ctx.status = 200;
  });

  router.post('/data/:address', koaBody({ multipart: true }), async (ctx: Koa.Context) => {
    const {
      g1: { path: g1Path },
      g2: { path: g2Path },
    } = ctx.request.files!;
    try {
      const hash = await hashFiles([g1Path, g2Path]);
      const signature = ctx.get('X-Signature');
      const address = Address.fromString(ctx.params['address']);
      if (!address.equals(recover(bufferToHex(hash), signature))) {
        ctx.status = 401;
        return;
      }
      await server.uploadData(address, g1Path, g2Path);
      ctx.status = 200;
    } finally {
      unlink(g1Path, () => {});
      unlink(g2Path, () => {});
    }
  });

  const app = new Koa();
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
