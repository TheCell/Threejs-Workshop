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



function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

  const fov = 75;
  const aspect = 2;
  const near = 0.1;
  const far = 5;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;

  scene = new THREE.Scene();
  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const material = new THREE.MeshBasicMaterial({color: 0x44aa88});
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  renderer.render(scene, camera);
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


main();
setupGui();
requestAnimationFrame(render);

function setupGui() {
  const gui = new GUI();
  
  const displayDebugController = gui.add({ displayDebug }, 'displayDebug')
    .name('Display Debug')
    .onChange((value: boolean) => {
      displayDebug = value;
      stats.showPanel(displayDebug ? 0 : -1); // 0: fps, 1: ms, 2: mb, 3+: custom
    });

  const limitFpsController = gui.add({ limitFps }, 'limitFps')
    .name('Limit FPS')
    .onChange((value: boolean) => {
      limitFps = value;
    });

  const cubeFolder = gui.addFolder('Cube');
  cubeFolder.add(cube!.position, 'x', -2, 2);
  cubeFolder.add(cube!.position, 'y', -2, 2);
  cubeFolder.open();
}