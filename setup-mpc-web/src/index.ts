import { App } from 'setup-mpc-client';
import { HttpClient } from 'setup-mpc-common';
import { Terminal } from 'xterm';
import 'xterm/dist/xterm.css';

import * as fit from 'xterm/lib/addons/fit/fit';

Terminal.applyAddon(fit);

async function main() {
  const term = new Terminal();
  term.setOption('theme', {
    background: '#000000',
    foreground: '#c7c7c7',
    ansiBlack: '#000000',
    red: '#ff8272',
    green: '#64fa72',
    yellow: '#fefdc2',
    blue: '#a5d5fe',
    magenta: '#ff8ffd',
    cyan: '#d0d1fe',
    white: '#f1f1f1',
    brightBlack: '#8e8e8e',
    brightRed: '#ffc4bd',
    brightGreen: '#d6fcb9',
    brightYellow: '#fefdd5',
    brightBlue: '#c1e3fe',
    brightMagenta: '#ffb1fe',
    brightCyan: '#e5e6fe',
    brightWhite: '#feffff',
  });
  term.setOption('fontFamily', 'menlo');
  term.setOption('fontSize', 12);
  term.open(document.getElementById('terminal') as HTMLElement);

  const API_URL = process.env.API_URL || 'http://localhost:8081/api';
  const server = new HttpClient(API_URL);
  const app = new App(server, undefined, term as any, term.rows, term.cols);

  term.on('resize', ({ cols, rows }) => app.resize(cols, rows));
  (term as any).fit();

  window.onresize = () => (term as any).fit();

  await app.start();
}

// tslint:disable-next-line:no-console
main().catch(console.error);
