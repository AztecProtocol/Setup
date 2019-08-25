import Cesium from 'cesium/Cesium';
import { EventEmitter } from 'events';
import { Marker } from './marker';

export class Viewer extends EventEmitter {
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
        creationFunction: () => {
          return new Cesium.IonImageryProvider({ assetId: 3812 });
        },
      })
    );

    this.viewer = new Cesium.Viewer('cesiumContainer', {
      imageryProviderViewModels,
      fullscreenButton: false,
      timeline: false,
      animation: false,
      terrainProvider: Cesium.createWorldTerrain({
        requestWaterMask: true,
      }),
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

  public async standby() {
    this.viewer.entities.removeAll();
    this.marker = undefined;
    this.viewer.scene.camera.flyHome(2);
  }

  public async focus(lat: number, lon: number) {
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
