import { exists, mkdir, readdir, rename, unlink, writeFile } from 'fs';
import { promisify } from 'util';

export const existsAsync = promisify(exists);
export const renameAsync = promisify(rename);
export const mkdirAsync = promisify(mkdir);
export const unlinkAsync = promisify(unlink);
export const writeFileAsync = promisify(writeFile);
export const readdirAsync = promisify(readdir);
