import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let displayDebug = false;
let limitFps = true;

let stats = new Stats();
stats.showPanel(displayDebug ? 0 : -1);
document.body.appendChild(stats.dom);

// Three.js stuff
let meshes: THREE.Mesh[] = [];
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;

let lightColor = 0xFFFFFF;
let lightIntensity = 1;
let lightAngle = 0;
const lightRadius = 10;
let light: THREE.DirectionalLight | undefined;
let ambientLight: THREE.AmbientLight | undefined;
let axesHelper: THREE.AxesHelper | undefined;
let showAxes = false;
let rotateObjects = true;
let basicColor = 0x7492b1;
let highlightColor = 0xf4b61a;
let pickColor = 0xf4231f;

const keysPressed = new Set<string>();
window.addEventListener('keydown', (e) => keysPressed.add(e.code));
window.addEventListener('keyup', (e) => keysPressed.delete(e.code));
let isPointerDown = false;
let draggedGroup: THREE.Object3D | null = null;
window.addEventListener('pointerdown', (e) => {
  isPointerDown = true;
});
window.addEventListener('pointerup', (e) => {
  isPointerDown = false;
  draggedGroup = null;
});

const cameraSpeed = 0.05;
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const highlightMaterial = new THREE.MeshStandardMaterial({ color: highlightColor });
const pickMaterial = new THREE.MeshStandardMaterial({ color: pickColor });
const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const meshToGroup = new Map<THREE.Mesh, THREE.Object3D>();

function updateCamera() {
  if (!camera)
  {
    return;
  }
}

function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();

  addLight(scene);
  addFloor(scene);
  addShape(scene);

  setupGui();
  requestAnimationFrame(render);
}

let normalizedPointerPosition = new THREE.Vector2();
function onPointerMove(event: PointerEvent) {
  const canvas = renderer!.domElement;
  const x = (event.offsetX / canvas.clientWidth) * 2 - 1;
  const y = (event.offsetY / canvas.clientHeight) * 2 - 1;
  normalizedPointerPosition.set(x, -y);
}

function handleInteraction() {
}

let lastRenderTime = 0;
let targetFps = 30;
let targetFrameDuration = 1000 / targetFps;
function render(time: number) {
  if (!camera) {
    return;
  }
  
  stats.begin();
  animate(time);

  updateCamera();

  if (resizeRendererToDisplaySize(renderer!)) {
    const canvas = renderer!.domElement;
    camera!.aspect = canvas.clientWidth / canvas.clientHeight;
    camera!.updateProjectionMatrix();
  }

  handleInteraction();
  
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

  displayFolder.add({ rotateObjects }, 'rotateObjects')
    .name('Rotate Objects')
    .onChange((value: boolean) => {
      rotateObjects = value;
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
    
  const materialFolder = gui.addFolder('Material');
  materialFolder.addColor({ basicColor }, 'basicColor')
    .name('Basic Color')
    .onChange((value: number) => {
      basicColor = value;
    });

  materialFolder.addColor({ highlightColor }, 'highlightColor')
    .name('Highlight Color')
    .onChange((value: number) => {
      highlightColor = value;
    });

  materialFolder.addColor({ pickColor }, 'pickColor')
    .name('Pick Color')
    .onChange((value: number) => {
      pickColor = value;
    });

  const importFolder = gui.addFolder('Import');
  importFolder.add({ loadModel: () => importModel() }, 'loadModel').name('Load GLTF/GLB');

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

  lightFolder.add({ angle: lightAngle }, 'angle', 0, 2 * Math.PI)
    .name('Angle')
    .onChange((value: number) => {
      lightAngle = value;
      if (light) {
        light.position.set(Math.cos(lightAngle) * lightRadius, 10, Math.sin(lightAngle) * lightRadius);
      }
    });
}

function getMeshesInGroup(group: THREE.Object3D): THREE.Mesh[] {
  return meshes.filter((m) => meshToGroup.get(m) === group);
}

function importModel() {
}

function addLight(scene: THREE.Scene) {
}

function addFloor(scene: THREE.Scene) {
}


function addShape(scene: THREE.Scene) {
}


main();
