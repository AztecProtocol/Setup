import Cesium from 'cesium/Cesium';

export class Marker {
  private markerClock = new Cesium.Clock();

  constructor(private position: Cesium.Cartesian3) {}

  public tick() {
    this.markerClock.tick();
  }

  public getEntity(): Partial<Cesium.Entity> {
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
