import { unlink } from 'fs';
import Koa from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import moment = require('moment');
import { Address } from 'web3x/address';
import { bufferToHex, recover } from 'web3x/utils';
import { Server } from './demo-server';
import { hashFiles } from './setup-mpc-common';

const cors = require('@koa/cors');

export function app(server: Server) {
  const router = new Router();
  const adminAddress = Address.fromString('0x3a9b2101bff555793b85493b5171451fa00124c8');

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  router.post('/reset', async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    if (!adminAddress.equals(recover('SignMeWithYourPrivateKey', signature))) {
      ctx.status = 401;
      return;
    }
    server.resetState(moment().add(5, 's'));
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

  router.get('/data/:address', async (ctx: Koa.Context) => {
    ctx.body = await server.downloadData(Address.fromString(ctx.params.address));
  });

  router.post('/data/:address', koaBody({ multipart: true }), async (ctx: Koa.Context) => {
    const {
      transcript: { path: transcriptPath },
    } = ctx.request.files!;
    try {
      console.error(`Transcript uploaded to: ${transcriptPath}`);
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
      // unlink(transcriptPath, () => {});
    }
  });

  const app = new Koa();
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
