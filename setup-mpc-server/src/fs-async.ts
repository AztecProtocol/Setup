import { exists, promises } from 'fs';
import { promisify } from 'util';

export const accessAsync = promises.access;
export const existsAsync = promisify(exists);
export const renameAsync = promises.rename;
export const mkdirAsync = promises.mkdir;
export const unlinkAsync = promises.unlink;
export const writeFileAsync = promises.writeFile;
export const readFileAsync = promises.readFile;
export const readdirAsync = promises.readdir;
export const rmdirAsync = promises.rmdir;
