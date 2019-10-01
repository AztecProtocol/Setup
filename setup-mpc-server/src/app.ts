import BN from 'bn.js';
import { createWriteStream, unlink } from 'fs';
import Koa from 'koa';
import koaBody from 'koa-body';
import compress from 'koa-compress';
import Router from 'koa-router';
import moment from 'moment';
import readline from 'readline';
import { hashFiles, MpcServer } from 'setup-mpc-common';
import { PassThrough, Readable } from 'stream';
import meter from 'stream-meter';
import { isNumber, isString } from 'util';
import { Address } from 'web3x/address';
import { bufferToHex, randomBuffer, recover } from 'web3x/utils';
import { writeFileAsync } from './fs-async';
import { ParticipantSelectorFactory } from './participant-selector';
import { defaultState } from './state/default-state';

const cors = require('@koa/cors');

// 1GB
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024;

function normaliseSettings(settings: any) {
  if (isString(settings.startTime)) {
    settings.startTime = moment(settings.startTime);
  } else if (isNumber(settings.startTime)) {
    settings.startTime = moment().add(settings.startTime, 's');
  }

  if (isString(settings.endTime)) {
    settings.endTime = moment(settings.endTime);
  } else if (isNumber(settings.endTime)) {
    settings.endTime = moment().add(settings.endTime, 's');
  }

  if (settings.selectBlock < 0) {
    // If select block is negative, use it as an offset from the latest block.
    settings.selectBlock = settings.latestBlock - settings.selectBlock;
  }
}

export function appFactory(
  server: MpcServer,
  adminAddress: Address,
  participantSelectorFactory: ParticipantSelectorFactory,
  prefix?: string,
  tmpDir: string = '/tmp',
  maxUploadSize: number = MAX_UPLOAD_SIZE
) {
  let lockUpload = false;

  const adminAuth = async (ctx: Koa.Context, next: any) => {
    const signature = ctx.get('X-Signature');
    if (!adminAddress.equals(recover('SignMeWithYourPrivateKey', signature))) {
      ctx.status = 401;
      return;
    }
    await next(ctx);
  };

  const router = new Router({ prefix });

  router.get('/', async (ctx: Koa.Context) => {
    ctx.body = 'OK\n';
  });

  router.post('/reset', adminAuth, koaBody(), async (ctx: Koa.Context) => {
    const latestBlock = await participantSelectorFactory.getCurrentBlockHeight();
    const settings = {
      ...defaultState(latestBlock),
      ...ctx.request.body,
    };
    normaliseSettings(settings);

    try {
      await server.resetState(
        settings.name,
        settings.startTime,
        settings.endTime,
        settings.latestBlock,
        settings.selectBlock,
        settings.maxTier2,
        settings.minParticipants,
        settings.numG1Points,
        settings.numG2Points,
        settings.pointsPerTranscript,
        settings.rangeProofSize,
        settings.rangeProofsPerFile,
        settings.invalidateAfter,
        settings.participants0.map(Address.fromString),
        settings.participants1.map(Address.fromString)
      );
      ctx.status = 200;
    } catch (err) {
      ctx.body = { error: err.message };
      ctx.status = 400;
    }
  });

  router.get('/state', async (ctx: Koa.Context) => {
    ctx.body = await server.getState(ctx.query.sequence);
  });

  router.get('/state/load/:name', async (ctx: Koa.Context) => {
    ctx.body = await server.loadState(ctx.params.name);
  });

  router.patch('/state', adminAuth, koaBody(), async (ctx: Koa.Context) => {
    normaliseSettings(ctx.request.body);
    ctx.body = await server.patchState(ctx.request.body);
  });

  router.get('/ping/:address', koaBody(), async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    const address = Address.fromString(ctx.params.address.toLowerCase());
    if (!address.equals(recover('ping', signature))) {
      ctx.status = 401;
      return;
    }
    await server.ping(address, ctx.request.ip);
    ctx.status = 200;
  });

  router.put('/participant/:address', adminAuth, async (ctx: Koa.Context) => {
    const address = Address.fromString(ctx.params.address.toLowerCase());
    server.addParticipant(address, 2);
    ctx.status = 204;
  });

  router.patch('/participant/:address', koaBody(), async (ctx: Koa.Context) => {
    const signature = ctx.get('X-Signature');
    const address = Address.fromString(ctx.params.address.toLowerCase());
    if (!address.equals(recover(JSON.stringify(ctx.request.body), signature))) {
      ctx.status = 401;
      return;
    }
    try {
      await server.updateParticipant({
        ...ctx.request.body,
        address,
      });
    } catch (err) {
      // This is a "not running" error. Just swallow it as the client need not be concerned with this.
    }
    ctx.status = 200;
  });

  router.get('/signature/:address/:num', async (ctx: Koa.Context) => {
    const { address, num } = ctx.params;
    ctx.body = await server.downloadSignature(Address.fromString(address.toLowerCase()), num);
  });

  router.get('/data/:address/:num', async (ctx: Koa.Context) => {
    const { address, num } = ctx.params;
    ctx.body = await server.downloadData(Address.fromString(address.toLowerCase()), num);
  });

  router.put('/data/:address/:num', async (ctx: Koa.Context) => {
    const address = Address.fromString(ctx.params.address.toLowerCase());
    const [pingSig, dataSig] = ctx.get('X-Signature').split(',');

    // 500, unless we explicitly set it to 200 or something else.
    ctx.status = 500;

    if (lockUpload) {
      ctx.body = {
        error: 'Can only upload 1 file at a time.',
      };
      ctx.status = 401;
      return;
    }

    if (!pingSig || !dataSig) {
      ctx.body = {
        error: 'X-Signature header incomplete.',
      };
      ctx.status = 401;
      return;
    }

    // Before reading body, pre-authenticate user.
    if (!address.equals(recover('ping', pingSig))) {
      ctx.status = 401;
      return;
    }

    const { participants } = await server.getState();
    const participant = participants.find(p => p.address.equals(address));
    if (!participant || participant.state !== 'RUNNING') {
      ctx.body = {
        error: 'Can only upload to currently running participant.',
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
    const transcriptPath = `${tmpDir}/transcript_${ctx.params.address}_${ctx.params.num}_${nonce}.dat`;
    const signaturePath = `${tmpDir}/transcript_${ctx.params.address}_${ctx.params.num}_${nonce}.sig`;

    try {
      lockUpload = true;

      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(transcriptPath);
        const meterStream = meter(maxUploadSize);
        ctx.req
          .on('error', reject)
          .pipe(meterStream)
          .on('error', (err: Error) => {
            ctx.status = 429;
            reject(err);
          })
          .pipe(writeStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      const hash = await hashFiles([transcriptPath]);
      if (!address.equals(recover(bufferToHex(hash), dataSig))) {
        ctx.status = 401;
        throw new Error('Body signature does not match X-Signature.');
      }

      await writeFileAsync(signaturePath, dataSig);

      await server.uploadData(address, +ctx.params.num, transcriptPath, signaturePath);

      ctx.status = 200;
    } catch (err) {
      ctx.body = { error: err.message };
      unlink(transcriptPath, () => {});
      unlink(signaturePath, () => {});
      return;
    } finally {
      lockUpload = false;
    }
  });

  router.get('/bb-sigs', async (ctx: Koa.Context) => {
    const { from = 0, num = 1024 } = ctx.query;
    const response = await fetch(`http://job-server/result?from=${from}&num=${num}`);
    if (response.status === 404) {
      ctx.status = 404;
      return;
    }
    if (response.status !== 200 || response.body == null) {
      throw new Error('Error from job server.');
    }
    const compressionMask = new BN('8000000000000000000000000000000000000000000000000000000000000000', 16);
    const responseStream = new PassThrough();

    readline
      .createInterface({
        input: response.body as any,
        terminal: false,
      })
      .on('line', line => {
        const [, xstr, ystr] = line.match(/\((\d+) , (\d+)\)/)!;
        const x = new BN(xstr);
        const y = new BN(ystr);
        let compressed = x;
        if (y.testn(0)) {
          compressed = compressed.or(compressionMask);
        }
        const buf = compressed.toBuffer('be', 32);
        responseStream.write(buf);
      })
      .on('close', () => {
        responseStream.end();
      });

    ctx.body = responseStream;
  });

  const app = new Koa();
  app.proxy = true;
  app.use(compress());
  app.use(cors());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
