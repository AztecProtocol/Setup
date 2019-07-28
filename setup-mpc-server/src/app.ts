import { createWriteStream } from 'fs';
import Koa from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import moment = require('moment');
import { hashFiles } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { bufferToHex, recover } from 'web3x/utils';
import { Server } from './server';

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
    server.resetState(moment().add(5, 's'), 250000);
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

  router.get('/data/:address/:num', async (ctx: Koa.Context) => {
    const { address, num } = ctx.params;
    ctx.body = await server.downloadData(Address.fromString(address), num);
  });

  router.put('/data/:address/:num', async (ctx: Koa.Context) => {
    const transcriptPath = `/tmp/transcript_${ctx.params.address}_${ctx.params.num}.dat`;
    await new Promise((resolve, reject) => {
      const writeStream = createWriteStream(transcriptPath);
      writeStream.on('close', resolve);
      ctx.req.on('error', (err: Error) => reject(err));
      ctx.req.pipe(writeStream);
    });

    console.error(`Transcript uploaded to: ${transcriptPath}`);
    const hash = await hashFiles([transcriptPath]);
    const signature = ctx.get('X-Signature');
    const address = Address.fromString(ctx.params.address);
    if (!address.equals(recover(bufferToHex(hash), signature))) {
      ctx.status = 401;
      return;
    }
    await server.uploadData(address, ctx.params.num, transcriptPath, signature);
    ctx.status = 200;
  });

  const app = new Koa();
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
