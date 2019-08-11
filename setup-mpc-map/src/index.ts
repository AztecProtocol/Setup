import 'cesium/Widgets/widgets.css';
import './css/main.css';
import Cesium from 'cesium/Cesium';
import { HttpClient, MpcServer, MpcState } from 'setup-mpc-common';

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

class AztecViewer {
  private viewer: Cesium.Viewer;
  private marker?: Marker;

  constructor() {
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
      document.getElementById('overlay-time')!.innerHTML = Cesium.JulianDate.toDate(clock.currentTime).toISOString();
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
  constructor(private viewer: AztecViewer, private server: MpcServer) {}

  start() {
    this.updateState();
  }

  private async updateState() {
    const state = await this.server.getState();
    await this.processState(state);
    setTimeout(() => this.updateState(), 1000);
  }

  private async processState(state: MpcState) {}
}

async function main() {
  const av = new AztecViewer();
  //const httpClient = new HttpClient('http://localhost/api');
  //const coordinator = new Coordinator(av, httpClient);
  //coordinator.start();

  await new Promise(resolve => setTimeout(resolve, 5000));
  await av.focus(51.509865, -0.118092);
  await new Promise(resolve => setTimeout(resolve, 5000));
  await av.focus(40.6974034, -74.1197614);
  await new Promise(resolve => setTimeout(resolve, 5000));
  await av.focus(35.5079447, 139.2094269);
  await new Promise(resolve => setTimeout(resolve, 5000));
  await av.standby();
}

main().catch(console.error);
