import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';

let displayDebug = false;
let limitFps = true;

let stats = new Stats();
stats.showPanel(displayDebug ? 0 : -1);
document.body.appendChild(stats.dom);

// Three.js stuff
let cube: THREE.Mesh | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;

let lightColor = 0xFFFFFF;
let lightIntensity = 1;
let light: THREE.DirectionalLight | undefined;
let ambientLight: THREE.AmbientLight | undefined;
let axesHelper: THREE.AxesHelper | undefined;
let showAxes = false;

function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

  const fov = 75;
  const aspect = 2;
  const near = 0.1;
  const far = 10;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.y = 4 ;
  camera.position.z = 4;
  camera.lookAt(0, 0, 0);

  scene = new THREE.Scene();

  addShapes(scene);

  renderer.render(scene, camera);

  addDirectionalLight(scene);

  setupGui();
  requestAnimationFrame(render);
}

let lastRenderTime = 0;
let targetFps = 30;
let targetFrameDuration = 1000 / targetFps;
function render(time: number) {
  stats.begin();
  animate(time);

  if (resizeRendererToDisplaySize(renderer!)) {
    const canvas = renderer!.domElement;
    camera!.aspect = canvas.clientWidth / canvas.clientHeight;
    camera!.updateProjectionMatrix();
  }
  
  renderer!.render(scene!, camera!);
  if (!limitFps) {
    requestAnimationFrame(render);
  } else {
    const deltaTime = time - lastRenderTime;
    if (deltaTime >= targetFrameDuration) {
      lastRenderTime = time;
      requestAnimationFrame(render);
    } else {
      setTimeout(() => requestAnimationFrame(render), targetFrameDuration - deltaTime);
    }
  }
  stats.end();
}

function animate(time: number) {
  time *= 0.001;  // convert time to seconds
  
  if (cube) {
    cube.rotation.x = time;
    cube.rotation.y = time;
  }
}

function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
  const canvas = renderer.domElement;
  const pixelRatio = window.devicePixelRatio;
  const width  = Math.floor( canvas.clientWidth  * pixelRatio );
  const height = Math.floor( canvas.clientHeight * pixelRatio );
  const needResize = canvas.width !== width || canvas.height !== height;

  if (needResize) {
    renderer.setSize(width, height, false);
  }

  return needResize;
}

function setupGui() {
  const gui = new GUI();
  const displayFolder = gui.addFolder('Display');

  displayFolder.add({ displayDebug }, 'displayDebug')
    .name('Display Debug')
    .onChange((value: boolean) => {
      displayDebug = value;
      stats.showPanel(displayDebug ? 0 : -1); // 0: fps, 1: ms, 2: mb, 3+: custom
    });

  displayFolder.add({ limitFps }, 'limitFps')
    .name('Limit FPS')
    .onChange((value: boolean) => {
      limitFps = value;
    });

  displayFolder.add({ showAxes }, 'showAxes')
    .name('Axes Helper')
    .onChange((value: boolean) => {
      showAxes = value;
      if (showAxes) {
        axesHelper = new THREE.AxesHelper(1);
        scene!.add(axesHelper);
      } else if (axesHelper) {
        scene!.remove(axesHelper);
        axesHelper.dispose();
        axesHelper = undefined;
      }
    });
    
  // add  light parameters in a folder
  const lightFolder = gui.addFolder('Light');
  lightFolder.addColor({ color: lightColor }, 'color')
    .name('Color')
    .onChange((value: number) => {
      lightColor = value;
      if (light) {
        light.color.setHex(lightColor);
      }
      if (ambientLight) {
        ambientLight.color.setHex(lightColor);
      }
    });

  lightFolder.add({ intensity: lightIntensity }, 'intensity', 0, 4)
    .name('Intensity')
    .onChange((value: number) => {
      lightIntensity = value;
      if (light) {
        light.intensity = lightIntensity;
      }
    });

  const cubeFolder = gui.addFolder('Cube');
  cubeFolder.add(cube!.position, 'x', -2, 2);
  cubeFolder.add(cube!.position, 'y', -2, 2);
  cubeFolder.add(cube!.position, 'z', -2, 2);
  cubeFolder.open();
}

function addDirectionalLight(scene: THREE.Scene) {
  light = new THREE.DirectionalLight(lightColor, lightIntensity);
  light.position.set(10, 10, 1);
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function addShapes(scene: THREE.Scene) {
  const materialNames = [
    'basicMaterial',
    'normalMaterial',
    'phongMaterial',
  ] as const;
  const colors = [
    0x44aa88, 0xff6347, 0x4169e1, 0xffd700, 0x9400d3,
    0xff1493, 0x00ced1, 0xff8c00, 0x32cd32, 0x8b4513,
    0x00bfff, 0xff4500, 0xadff2f, 0xda70d6,
  ];
  const randomMaterial = (index: number) =>
    getMeshByName(materialNames[Math.floor(Math.random() * materialNames.length)], colors[index % colors.length]);

  // Box
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  cube = new THREE.Mesh(geometry, randomMaterial(0));
  scene.add(cube);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let materialName: 'basicMaterial' | 'normalMaterial' | 'phongMaterial';
      if (i === 1 && j === 1) {
        materialName = 'normalMaterial';
      } else if (i === 0) {
        materialName = 'basicMaterial';
      } else {
        materialName = 'phongMaterial';
      }
      const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.08, 100, 16), getMeshByName(materialName, colors[i * 3 + j + 1]));
      torusKnot.position.set(-2 + i * 2, 0, 2 - j * 2);
      scene.add(torusKnot);
    }
  }
}

function getMeshByName(
  meshname:
    | 'basicMaterial'
    | 'normalMaterial'
    | 'phongMaterial',
  color: THREE.ColorRepresentation
) {
  switch (meshname) {
    case 'basicMaterial':
      return new THREE.MeshBasicMaterial({ color });
    case 'normalMaterial':
      return new THREE.MeshNormalMaterial();
    case 'phongMaterial':
      return new THREE.MeshPhongMaterial({ color });
    default:
      console.warn(`Unknown mesh name: ${meshname}, using basic material as default.`);
      return new THREE.MeshBasicMaterial({ color });
  }
}

main();
