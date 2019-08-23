import 'cesium/Widgets/widgets.css';
import './css/main.css';
import Cesium from 'cesium/Cesium';
import { HttpClient, MpcServer, MpcState, applyDelta, Participant, ParticipantLocation } from 'setup-mpc-common';
import { EventEmitter } from 'events';
import moment from 'moment';

class Marker {
  private markerClock = new Cesium.Clock();

  constructor(private position: Cesium.Cartesian3) {}

  tick() {
    this.markerClock.tick();
  }

  getEntity(): Partial<Cesium.Entity> {
    const start = Cesium.JulianDate.fromIso8601('2018-01-01T00:00:00.00Z');
    const stop = Cesium.JulianDate.addSeconds(start, 1, new Cesium.JulianDate());

    this.markerClock.startTime = start;
    this.markerClock.currentTime = start;
    this.markerClock.stopTime = stop;
    this.markerClock.clockRange = Cesium.ClockRange.LOOP_STOP;
    this.markerClock.shouldAnimate = true;

    const pulseProperty = new Cesium.SampledProperty(Number);
    pulseProperty.setInterpolationOptions({
      interpolationDegree: 3,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    });
    pulseProperty.addSample(start, 1);
    pulseProperty.addSample(stop, 60000);

    const alphaProperty = new Cesium.SampledProperty(Number);
    alphaProperty.setInterpolationOptions({
      interpolationDegree: 3,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    });
    alphaProperty.addSample(start, 0.9);
    alphaProperty.addSample(stop, 0);

    const pulsedSize = new Cesium.CallbackProperty(() => {
      return pulseProperty.getValue(this.markerClock.currentTime);
    }, false);

    const alphaColor = new Cesium.CallbackProperty(() => {
      return Cesium.Color.RED.withAlpha(alphaProperty.getValue(this.markerClock.currentTime));
    }, false);

    return {
      position: this.position,
      name: 'Red circle on surface with outline',
      ellipse: {
        semiMinorAxis: pulsedSize,
        semiMajorAxis: pulsedSize,
        material: new Cesium.ColorMaterialProperty(alphaColor),
        outline: true,
        outlineColor: Cesium.Color.RED,
      },
    };
  }
}

class AztecViewer extends EventEmitter {
  private viewer: Cesium.Viewer;
  private marker?: Marker;

  constructor() {
    super();

    const imageryProviderViewModels = [];

    imageryProviderViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Earth at Night',
        iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/blackMarble.png'),
        tooltip: '',
        creationFunction: function() {
          return new Cesium.IonImageryProvider({ assetId: 3812 });
        },
      })
    );

    this.viewer = new Cesium.Viewer('cesiumContainer', {
      imageryProviderViewModels,
      fullscreenButton: false,
      timeline: false,
      animation: false,
    });

    this.viewer.scene.screenSpaceCameraController.enableLook = false;
    this.viewer.scene.screenSpaceCameraController.enableRotate = false;
    this.viewer.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer.scene.screenSpaceCameraController.enableZoom = false;
    this.viewer.scene.highDynamicRange = false;
    this.viewer.clock.shouldAnimate = true;
    this.viewer.scene.moon = undefined;

    this.viewer.clock.onTick.addEventListener(clock => {
      this.emit('tick', Cesium.JulianDate.toDate(clock.currentTime));
      if (this.marker) {
        this.marker.tick();
      }
      this.viewer.camera.rotateRight(0.001);
    });
  }

  async standby() {
    this.viewer.entities.removeAll();
    this.marker = undefined;
    this.viewer.scene.camera.flyHome(2);
  }

  async focus(lat: number, lon: number) {
    this.viewer.entities.removeAll();
    const position = Cesium.Cartesian3.fromDegrees(lon, lat);
    const offset = new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR, 4000000);
    this.marker = new Marker(position);
    const redEllipse = this.viewer.entities.add(this.marker.getEntity());

    await this.viewer.flyTo(redEllipse, {
      duration: 2,
      offset,
    });

    this.viewer.camera.lookAt(position, offset);
  }
}

class Coordinator {
  private timer?: NodeJS.Timer;
  private state!: MpcState;
  private running?: Participant;

  constructor(private viewer: AztecViewer, private server: MpcServer) {
    viewer.on('tick', time => this.onTick(time));
  }

  start() {
    this.updateState();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.viewer.removeAllListeners();
  }

  private onTick(currentTime: Date) {
    document.getElementById('overlay-time')!.innerHTML = currentTime.toISOString();
  }

  private async updateState() {
    try {
      // Then get the latest state from the server.
      const remoteStateDelta = await this.server.getState(this.state ? this.state.sequence : undefined);

      let state: MpcState;
      if (!this.state) {
        state = remoteStateDelta;
      } else if (this.state.startSequence !== remoteStateDelta.startSequence) {
        state = await this.server.getState();
      } else {
        state = applyDelta(this.state, remoteStateDelta);
      }

      await this.processState(state);
    } finally {
      setTimeout(() => this.updateState(), 1000);
    }
  }

  private getLocationString(location: ParticipantLocation) {
    return [location.city, location.country, location.continent]
      .filter(x => x)
      .slice(0, 2)
      .join(', ');
  }

  private setAddress(p: Participant) {
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.computeProgress / 100);
    document.getElementById('overlay-address-done')!.innerHTML = addrString.slice(0, progIndex);
    document.getElementById('overlay-address-not-done')!.innerHTML = addrString.slice(progIndex);
    document.getElementById('overlay-address-not-done')!.className = 'grey';

    if (p.computeProgress < 100) {
      document.getElementById('overlay-address-done')!.className = 'yellow';
    } else {
      document.getElementById('overlay-address-done')!.className = 'green';
    }
  }

  private setProgress(p: Participant, invalidateAfter: number) {
    const totalData = p.transcripts.reduce((a, t) => a + t.size, 0);
    const totalDownloaded = p.transcripts.reduce((a, t) => a + t.downloaded, 0);
    const totalUploaded = p.transcripts.reduce((a, t) => a + t.uploaded, 0);
    const downloadProgress = totalData ? (totalDownloaded / totalData) * 100 : 100;
    const uploadProgress = totalData ? (totalUploaded / totalData) * 100 : 0;
    const computeProgress = p.computeProgress;
    const verifyProgress = p.verifyProgress;

    const totalSkip = Math.max(
      0,
      moment(p.startedAt!)
        .add(invalidateAfter, 's')
        .diff(moment(), 's')
    );

    document.getElementById('overlay-progress-download')!.innerHTML = `${downloadProgress.toFixed(2)}%`;
    document.getElementById('overlay-progress-compute')!.innerHTML = `${computeProgress.toFixed(2)}%`;
    document.getElementById('overlay-progress-upload')!.innerHTML = `${uploadProgress.toFixed(2)}%`;
    document.getElementById('overlay-progress-verify')!.innerHTML = `${verifyProgress.toFixed(2)}%`;
    document.getElementById('overlay-progress-skip')!.innerHTML = `${totalSkip}s`;
  }

  private updateOverlay(p: Participant, invalidateAfter: number) {
    document.getElementById('overlay')!.style.display = 'block';
    document.getElementById('overlay-location')!.innerHTML = p.location
      ? this.getLocationString(p.location)
      : 'Unknown';

    this.setAddress(p);

    if (p.online) {
      document.getElementById('overlay-status')!.innerHTML = 'ONLINE';
      document.getElementById('overlay-status')!.className = 'green';
    } else {
      document.getElementById('overlay-status')!.innerHTML = 'OFFLINE';
      document.getElementById('overlay-status')!.className = 'red';
    }

    this.setProgress(p, invalidateAfter);
  }

  private updateStatusOverlay(state: MpcState) {
    document.getElementById('overlay-started-at')!.innerHTML = state.startTime.toISOString();
    document.getElementById('overlay-participants')!.innerHTML = `${state.participants.length}`;
    const online = state.participants.reduce((a, p) => (p.online ? a + 1 : a), 0);
    const offline = state.participants.reduce((a, p) => (!p.online ? a + 1 : a), 0);
    const complete = state.participants.reduce((a, p) => (p.state === 'COMPLETE' ? a + 1 : a), 0);
    const invalidated = state.participants.reduce((a, p) => (p.state === 'INVALIDATED' ? a + 1 : a), 0);
    document.getElementById('overlay-online')!.innerHTML = `${online}`;
    document.getElementById('overlay-offline')!.innerHTML = `${offline}`;
    document.getElementById('overlay-complete')!.innerHTML = `${complete}`;
    document.getElementById('overlay-invalidated')!.innerHTML = `${invalidated}`;
    document.getElementById('overlay-ceremony-status')!.innerHTML = `${state.ceremonyState}`;
    switch (state.ceremonyState) {
      case 'PRESELECTION':
      case 'SELECTED':
        document.getElementById('overlay-ceremony-status')!.className = 'yellow';
        break;
      case 'COMPLETE':
        document.getElementById('status-overlay-time')!.style.display = 'none';
        document.getElementById('status-overlay-completed-at')!.style.display = 'block';
        document.getElementById('overlay-completed-at')!.innerHTML = state.completedAt!.toISOString();
      default:
        document.getElementById('overlay-ceremony-status')!.className = 'green';
    }
  }

  private async processState(state: MpcState) {
    this.updateStatusOverlay(state);

    if (this.running) {
      this.running = state.participants.find(p => this.running!.address.equals(p.address));
    }

    const running = state.participants.find(p => p.state === 'RUNNING');

    if (this.running && (!running || !running.address.equals(this.running.address))) {
      // We are shifting to standby, or a new participant. First wait a few seconds so we can see why.
      this.updateOverlay(this.running, state.invalidateAfter);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (running && (!this.running || !this.running.address.equals(running.address))) {
      // We are shifting from standby, or to a new participant.
      this.running = running;
      if (running.location) {
        await this.viewer.focus(running.location.latitude!, running.location.longitude!);
      } else {
        await this.viewer.standby();
      }
    } else if (!running && this.running) {
      // We are shifting to standby.
      await this.viewer.standby();
      this.running = undefined;
    }

    if (running) {
      this.updateOverlay(running, state.invalidateAfter);
    } else {
      document.getElementById('overlay')!.style.display = 'none';
    }

    this.state = state;
  }
}

async function main() {
  const viewer = new AztecViewer();
  const httpClient = new HttpClient('http://localhost/api');
  const coordinator = new Coordinator(viewer, httpClient);
  coordinator.start();
}

main().catch(console.error);
