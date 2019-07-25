import { unlink } from 'fs';
import Koa from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import { Address } from 'web3x/address';
import { bufferToHex, recover } from 'web3x/utils';
import { hashFiles, MpcServer } from './setup-mpc-common';

const cors = require('@koa/cors');

export function app(server: MpcServer) {
  const router = new Router();

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  router.get('/state', async (ctx: Koa.Context) => {
    ctx.body = await server.getState();
  });

  router.patch('/participant/:address', koaBody(), async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    const address = Address.fromString(ctx.params.address);
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
      transcript: { path: transcriptPath },
    } = ctx.request.files!;
    try {
      const hash = await hashFiles([transcriptPath]);
      const signature = ctx.get('X-Signature');
      const address = Address.fromString(ctx.params.address);
      if (!address.equals(recover(bufferToHex(hash), signature))) {
        ctx.status = 401;
        return;
      }
      await server.uploadData(address, transcriptPath, signature);
      ctx.status = 200;
    } finally {
      unlink(transcriptPath, () => {});
    }
  });

  const app = new Koa();
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
