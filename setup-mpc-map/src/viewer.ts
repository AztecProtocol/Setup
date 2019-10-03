import Cesium from 'cesium/Cesium';
import { EventEmitter } from 'events';
import { Marker } from './marker';
import { ShootingStars } from './shooting-stars';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface CompleteMarker extends LatLon {
  height: number;
}

export class Viewer extends EventEmitter {
  private viewer: Cesium.Viewer;
  private marker?: Marker;
  private completeMarkers?: CompleteMarker[];
  private shootingStars?: ShootingStars;

  constructor() {
    super();

    const imageryProviderViewModels = [];

    imageryProviderViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Earth at Night',
        iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/earthAtNight.png'),
        tooltip: '',
        creationFunction: () => {
          return new Cesium.IonImageryProvider({ assetId: 3812 });
        },
      })
    );

    if (screen.width < screen.height) {
      Cesium.Camera.DEFAULT_VIEW_FACTOR = 0.7;
    }

    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3OWQ3MjYyNi00NDM1LTQzYzAtOWQwYS01ZjZhNWY0MDNjMGQiLCJpZCI6MTQ5MjUsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE1NjY3NTc2OTB9.fJWGzS1hGgjxUCY4jN7f7jKk4rIpRI6jF52lcues4Uc';

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
    this.viewer.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
    this.viewer.scene.screenSpaceCameraController.enableZoom = false;
    this.viewer.scene.highDynamicRange = false;
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
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
    this.viewer.scene.screenSpaceCameraController.enableRotate = true;
    this.viewer.entities.removeAll();
    this.marker = undefined;
    this.addCompleteMarkers();
    this.viewer.scene.camera.flyHome(2);
  }

  public async focus(lat: number, lon: number) {
    this.viewer.scene.screenSpaceCameraController.enableRotate = false;
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

  private addCompleteMarkers() {
    if (!this.completeMarkers) {
      return;
    }
    const heightScale = 100000;
    this.viewer.entities.suspendEvents();
    this.completeMarkers.forEach(({ lat, lon, height }, i) => {
      const color = Cesium.Color.fromHsl(0.3 - height * 0.02, 1.0, 0.5, 1);
      const surfacePosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
      const heightPosition = Cesium.Cartesian3.fromDegrees(lon, lat, height * heightScale);

      const polyline = new Cesium.PolylineGraphics();
      polyline.material = new Cesium.ColorMaterialProperty(color);
      polyline.width = new Cesium.ConstantProperty(2);
      polyline.arcType = new Cesium.ConstantProperty(Cesium.ArcType.NONE);
      polyline.positions = new Cesium.ConstantProperty([surfacePosition, heightPosition]);

      const entity = new Cesium.Entity({
        id: 'index ' + i.toString(),
        show: true,
        polyline,
      });

      this.viewer.entities.add(entity);
    });

    if (this.shootingStars) {
      this.shootingStars.getEntities().forEach(e => this.viewer.entities.add(e));
    }

    this.viewer.entities.resumeEvents();
  }

  public updateCompletedEntities(locations: LatLon[]) {
    this.completeMarkers = this.getCompletedMarkerEntityData(locations);
    this.shootingStars = new ShootingStars(locations, this.viewer);
  }

  private getCompletedMarkerEntityData(locations: LatLon[]) {
    const data = locations.reduce(
      (a, { lat, lon }) => {
        const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        if (a[key]) {
          a[key].height += 1;
        } else {
          a[key] = { lat, lon, height: 1 };
        }
        return a;
      },
      {} as { [key: string]: CompleteMarker }
    );
    return Object.values(data);
  }
}
