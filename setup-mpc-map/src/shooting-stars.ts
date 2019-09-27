import Cesium from 'cesium/Cesium';
import { LatLon } from './viewer';

export class ShootingStars {
  private entities: Cesium.Entity[] = [];

  constructor(locations: LatLon[], viewer: Cesium.Viewer) {
    const baseTime = viewer.clock.startTime;

    // Stick first location on the end, so we get a loop. Remove duplicate contiguous locations.
    locations = [...locations, locations[0]].filter(
      (el, i, a) => i === 0 || (el.lat !== a[i - 1].lat || el.lon !== a[i - 1].lon)
    );

    if (locations.length < 2) {
      return;
    }

    viewer.clock.stopTime = Cesium.JulianDate.addSeconds(baseTime, 3 * (locations.length - 1), new Cesium.JulianDate());

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
    const q1Time = Cesium.JulianDate.addSeconds(startTime, 0.25, new Cesium.JulianDate());
    const midTime = Cesium.JulianDate.addSeconds(startTime, 0.5, new Cesium.JulianDate());
    const q2Time = Cesium.JulianDate.addSeconds(startTime, 0.75, new Cesium.JulianDate());
    const endTime = Cesium.JulianDate.addSeconds(startTime, 1, new Cesium.JulianDate());

    const property = new Cesium.SampledPositionProperty();
    const startPoint = Cesium.Cartographic.fromDegrees(start.lon, start.lat, 0);
    const endPoint = Cesium.Cartographic.fromDegrees(end.lon, end.lat, 0);

    const geodesic = new Cesium.EllipsoidGeodesic(startPoint, endPoint);
    const q1Point = geodesic.interpolateUsingFraction(0.25, new Cesium.Cartographic());
    q1Point.height = 200000;
    const midPoint = geodesic.interpolateUsingFraction(0.5, new Cesium.Cartographic());
    midPoint.height = 300000;
    const q2Point = geodesic.interpolateUsingFraction(0.75, new Cesium.Cartographic());
    q2Point.height = 200000;

    property.addSample(startTime, ellipsoid.cartographicToCartesian(startPoint));
    property.addSample(q1Time, ellipsoid.cartographicToCartesian(q1Point));
    property.addSample(midTime, ellipsoid.cartographicToCartesian(midPoint));
    property.addSample(q2Time, ellipsoid.cartographicToCartesian(q2Point));
    property.addSample(endTime, ellipsoid.cartographicToCartesian(endPoint));
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
