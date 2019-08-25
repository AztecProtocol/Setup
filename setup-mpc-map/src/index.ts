import 'cesium/Widgets/widgets.css';
import './css/main.css';
import { HttpClient } from 'setup-mpc-common';
import { Viewer } from './viewer';
import { Coordinator } from './coordinator';

async function main() {
  const shutdown = () => process.exit(0);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const viewer = new Viewer();
  const url = window.location;
  const apiUrl = `${url.protocol}//${url.hostname}/api`;
  const httpClient = new HttpClient(apiUrl);
  const coordinator = new Coordinator(viewer, httpClient);
  coordinator.start();
}

main().catch(console.error);
