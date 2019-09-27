import 'cesium/Widgets/widgets.css';
import { HttpClient } from 'setup-mpc-common';
import { Coordinator } from './coordinator';
import './css/main.css';
import { Viewer } from './viewer';

async function main() {
  const shutdown = () => process.exit(0);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const viewer = new Viewer();
  const url = window.location;
  const apiUrl = `${url.protocol}//${url.hostname}:${url.port}/api`;
  const httpClient = new HttpClient(apiUrl);
  const coordinator = new Coordinator(viewer, httpClient);
  coordinator.start();
}

main().catch(console.error);
