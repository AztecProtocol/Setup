import { Readable } from 'stream';
import { hashStreams } from './hash-files';
import { createReadStream } from 'fs';

describe('hash-files', () => {
  it('should create create hash', async () => {
    const file1 = new Readable();
    const file2 = new Readable();

    file1.push('somejunk1');
    file1.push(null);

    file2.push('somejunk2');
    file2.push(null);

    const hash = await hashStreams([file1, file2]);
    expect(hash.toString('hex')).toBe('227a2c8dc5f3e429ce95820c613385e9bf8b9e44092b5f89b887419198c50efa');
  });
});
