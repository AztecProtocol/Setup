const serve = require('koa-static');
const mount = require('koa-mount');
const Koa = require('koa');

const { PORT = '8080' } = process.env;

const static = new Koa().use(serve('dist'));

new Koa().use(mount('/terminal', static)).listen(PORT);

console.log(`Server listening on port ${PORT}`);
