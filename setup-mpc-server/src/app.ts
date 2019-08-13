import { createWriteStream } from 'fs';
import Koa from 'koa';
import koaBody from 'koa-body';
import compress from 'koa-compress';
import Router from 'koa-router';
import { hashFiles, MpcServer } from 'setup-mpc-common';
import meter from 'stream-meter';
import { Address } from 'web3x/address';
import { bufferToHex, randomBuffer, recover } from 'web3x/utils';
import { defaultSettings } from './default-settings';
import { unlinkAsync, writeFileAsync } from './fs-async';

const cors = require('@koa/cors');

// 1GB
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024;

export function app(server: MpcServer, prefix?: string, maxUploadSize: number = MAX_UPLOAD_SIZE) {
  const router = new Router({ prefix });
  const adminAddress = Address.fromString('0x3a9b2101bff555793b85493b5171451fa00124c8');

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  router.post('/reset', koaBody(), async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    if (!adminAddress.equals(recover('SignMeWithYourPrivateKey', signature))) {
      ctx.status = 401;
      return;
    }
    const settings = {
      ...defaultSettings(),
      ...ctx.request.body,
    };
    const { startTime, numG1Points, numG2Points, invalidateAfter } = settings;
    await server.resetState(startTime, numG1Points, numG2Points, invalidateAfter);
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
    const signature = ctx.get('X-Signature');

    if (!signature) {
      ctx.body = {
        error: 'No X-Signature header.',
      };
      ctx.status = 401;
      return;
    }

    if (+ctx.params.num >= 30) {
      ctx.body = {
        error: 'Transcript number out of range (max 0-29).',
      };
      ctx.status = 401;
      return;
    }

    const nonce = randomBuffer(8).toString('hex');
    const transcriptPath = `/tmp/transcript_${ctx.params.address}_${ctx.params.num}_${nonce}.dat`;

    try {
      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(transcriptPath);
        const meterStream = meter(maxUploadSize);
        meterStream.on('error', (err: Error) => {
          ctx.status = 429;
          reject(err);
        });
        writeStream.on('close', resolve);
        ctx.req.on('error', (err: Error) => reject(err));
        ctx.req.pipe(meterStream).pipe(writeStream);
      });

      const address = Address.fromString(ctx.params.address);
      const hash = await hashFiles([transcriptPath]);
      if (!address.equals(recover(bufferToHex(hash), signature))) {
        ctx.status = 401;
        throw new Error('Body signature does not match X-Signature.');
      }

      const signaturePath = `/tmp/transcript_${ctx.params.address}_${ctx.params.num}_${nonce}.sig`;
      await writeFileAsync(signaturePath, signature);

      await server.uploadData(address, +ctx.params.num, transcriptPath, signaturePath);

      ctx.status = 200;
    } catch (err) {
      ctx.body = { error: err.message };
      ctx.status = ctx.status || 500;
      await unlinkAsync(transcriptPath);
      return;
    }
  });

  const app = new Koa();
  app.use(compress());
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
