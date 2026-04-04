import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { JoltPhysics } from 'three/addons/physics/JoltPhysics.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let displayDebug = false;
let limitFps = true;
let maxObjects = 100;

let stats = new Stats();
stats.showPanel(displayDebug ? 0 : -1);
document.body.appendChild(stats.dom);

// Three.js stuff
let cube: THREE.Mesh | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let controls: OrbitControls | undefined;

let lightColor = 0xFFFFFF;
let lightIntensity = 1;
let light: THREE.DirectionalLight | undefined;
let ambientLight: THREE.AmbientLight | undefined;

const physics = await JoltPhysics();

function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

  const fov = 75;
  const aspect = 2;
  const near = 0.01;
  const far = 10;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;

  scene = new THREE.Scene();
  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const material = new THREE.MeshPhongMaterial({ color: 0x44aa88 });
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  const axesHelper = new THREE.AxesHelper(1);
  console.log(axesHelper);
  
  scene.add( axesHelper );

  const floor = createMeshFloor(20, 0.5, 1, 0, -0.5, -1);
  scene.add(floor);

  addDirectionalLight(scene);
  
  controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set( 0, 4, 0 );
  controls.update();
  renderer.render(scene, camera);
  
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
  
  controls!.update();
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

  const maxObjectsController = gui.add({ maxObjects }, 'maxObjects', 1, 1000, 1)
    .name('Max Objects')
    .onChange((value: number) => {
      maxObjects = value;
    });

  // add  light parameters in a folder
  const lightFolder = gui.addFolder('Light');
  lightFolder.addColor({ color: lightColor }, 'color')
    .name('Color')
    .onChange((value: number) => {
      console.log(value);
      
      
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
  cubeFolder.open();
}

function addDirectionalLight(scene: THREE.Scene) {
  light = new THREE.DirectionalLight(lightColor, lightIntensity);
  light.position.set(10, 10, 1);
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function createMeshFloor(n: number, cellSize: number, maxHeight: number, posX: number, posY: number, posZ: number): THREE.Mesh {
  let height = function (x: number, y: number) { return Math.sin(x / 2) * Math.cos(y / 3); };

  const vertices: number[] = [];
  for (let x = 0; x < n; ++x) {
    for (let z = 0; z < n; ++z) {
      let center = n * cellSize / 2;

      let x1 = cellSize * x - center;
      let z1 = cellSize * z - center;
      let x2 = x1 + cellSize;
      let z2 = z1 + cellSize;

      // Triangle 1
      vertices.push(x1, height(x, z), z1);
      vertices.push(x1, height(x, z + 1), z2);
      vertices.push(x2, height(x + 1, z + 1), z2);

      // Triangle 2
      vertices.push(x1, height(x, z), z1);
      vertices.push(x2, height(x + 1, z + 1), z2);
      vertices.push(x2, height(x + 1, z), z1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({ color: 0xAAAAAA, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(posX, posY, posZ);
  // scene!.add(mesh);
  return mesh;
}

main();