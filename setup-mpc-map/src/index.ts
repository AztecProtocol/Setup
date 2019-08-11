import 'cesium/Widgets/widgets.css';
import './css/main.css';
import Cesium from 'cesium/Cesium';

var imageryProviderViewModels = [];

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

const viewer = new Cesium.Viewer('cesiumContainer', {
  imageryProviderViewModels,
  fullscreenButton: false,
  timeline: false,
  animation: false,
});

viewer.scene.highDynamicRange = false;
viewer.scene.screenSpaceCameraController.enableInputs = false;

const center = Cesium.Cartesian3.fromDegrees(-0.118092, 51.509865);
viewer.camera.lookAt(center, new Cesium.Cartesian3(0.0, -2500000.0, 2000000.0));

function updateAndRender() {
  viewer.camera.rotateRight(0.001);
  Cesium.requestAnimationFrame(updateAndRender);
}
Cesium.requestAnimationFrame(updateAndRender);
