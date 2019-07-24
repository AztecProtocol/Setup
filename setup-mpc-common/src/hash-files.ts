import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export function hashFiles(paths: string[]) {
  return hashStreams(paths.map(p => createReadStream(p)));
}

export function hashStreams(streams: Readable[]) {
  return new Promise<Buffer>(resolve => {
    const hash = createHash('sha256');

    hash.on('readable', () => {
      resolve(hash.read() as Buffer);
    });

    const pipeNext = () => {
      const s = streams.shift();
      if (!s) {
        hash.end();
      } else {
        s.pipe(
          hash,
          { end: false }
        );
        s.on('end', pipeNext);
      }
    };

    pipeNext();
  });
}
