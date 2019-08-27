import Cesium from 'cesium/Cesium';
import { LatLon } from './viewer';

export class ShootingStars {
  // private clock = new Cesium.Clock();
  private entities: Cesium.Entity[] = [];

  constructor(locations: LatLon[], viewer: Cesium.Viewer) {
    const baseTime = viewer.clock.startTime;

    if (locations.length > 1) {
      viewer.clock.stopTime = Cesium.JulianDate.addSeconds(
        baseTime,
        3 * (locations.length - 1),
        new Cesium.JulianDate()
      );
    }

    for (let i = 1; i < locations.length; ++i) {
      const currentTime = Cesium.JulianDate.addSeconds(baseTime, 3 * (i - 1), new Cesium.JulianDate());
      this.entities.push(
        this.createShootingStarPathEntity(locations[i - 1], locations[i], currentTime, viewer.scene.globe.ellipsoid)
      );
    }
  }

  private createShootingStarPathEntity(
    start: LatLon,
    end: LatLon,
    startTime: Cesium.JulianDate,
    ellipsoid: Cesium.Ellipsoid
  ) {
    const midTime = Cesium.JulianDate.addSeconds(startTime, 0.5, new Cesium.JulianDate());
    const stopTime = Cesium.JulianDate.addSeconds(startTime, 1, new Cesium.JulianDate());

    // Create a straight-line path.
    let property = new Cesium.SampledPositionProperty();
    const startPosition = Cesium.Cartesian3.fromDegrees(start.lon, start.lat, 0);
    property.addSample(startTime, startPosition);
    const stopPosition = Cesium.Cartesian3.fromDegrees(end.lon, end.lat, 0);
    property.addSample(stopTime, stopPosition);

    // Find the midpoint of the straight path, and raise its altitude.
    const midPoint = Cesium.Cartographic.fromCartesian(property.getValue(midTime));
    midPoint.height = 400000;
    const midPosition = ellipsoid.cartographicToCartesian(midPoint, new Cesium.Cartesian3());

    // Redo the path to be the new arc.
    property = new Cesium.SampledPositionProperty();
    property.addSample(startTime, startPosition);
    property.addSample(midTime, midPosition);
    property.addSample(stopTime, stopPosition);
    property.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
    });

    // Create an Entity to show the arc.
    const arcEntity = new Cesium.Entity({
      position: property,
      path: new Cesium.PathGraphics({
        resolution: 0.05,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.16,
          taperPower: 0.1,
          color: Cesium.Color.CORNFLOWERBLUE,
        }),
        width: 10,
        leadTime: 0,
        trailTime: 0.5,
      }),
    });

    return arcEntity;
  }

  public getEntities() {
    return this.entities;
  }
}
