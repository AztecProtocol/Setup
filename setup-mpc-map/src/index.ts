import 'cesium/Widgets/widgets.css';
import './css/main.css';
import { HttpClient } from 'setup-mpc-common';
import { Viewer } from './viewer';
import { Coordinator } from './coordinator';

async function main() {
  const viewer = new Viewer();
  const httpClient = new HttpClient('http://localhost/api');
  const coordinator = new Coordinator(viewer, httpClient);
  coordinator.start();
}

main().catch(console.error);
