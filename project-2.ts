import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import JoltPhysics from 'jolt-physics/wasm';
const Jolt = await JoltPhysics();

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
let axesHelper: THREE.AxesHelper | undefined;
let showAxes = false;

const spawnedMeshes: THREE.Mesh[] = [];
let spawnInterval: ReturnType<typeof setInterval> | undefined;

// Jolt physics (direct — no THREE.js addon wrapper)
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
// let Jolt: any = null;
let joltInterface: any = null;
let bodyInterface: any = null;
const dynamicBodies: Array<{ mesh: THREE.Mesh; body: any }> = [];

// const { default: initJolt } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jolt-physics@1.0.0/dist/jolt-physics.wasm-compat.js');
// Jolt = await initJolt();


const _joltSettings = new Jolt.JoltSettings();
const _objectFilter = new Jolt.ObjectLayerPairFilterTable(2);
_objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
_objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
const _bpNonMoving = new Jolt.BroadPhaseLayer(0);
const _bpMoving = new Jolt.BroadPhaseLayer(1);
const _bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(2, 2);
_bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, _bpNonMoving);
_bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, _bpMoving);
_joltSettings.mObjectLayerPairFilter = _objectFilter;
_joltSettings.mBroadPhaseLayerInterface = _bpInterface;
_joltSettings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
  _joltSettings.mBroadPhaseLayerInterface, 2, _joltSettings.mObjectLayerPairFilter, 2);
joltInterface = new Jolt.JoltInterface(_joltSettings);
Jolt.destroy(_joltSettings);
bodyInterface = joltInterface.GetPhysicsSystem().GetBodyInterface();
setInterval(() => { joltInterface.Step(1 / 60, 1); }, 1000 / 60);

function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const fov = 75;
  const aspect = 2;
  const near = 0.01;
  const far = 50;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;

  scene = new THREE.Scene();
  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const material = new THREE.MeshPhongMaterial({ color: 0x44aa88 });
  cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, -2, 0);
  scene.add(cube);

  const floor = createMeshFloor(20, 0.5, 1, 0, -4, -1);
  scene.add(floor);

  // JoltPhysics only supports primitive geometries (BoxGeometry, SphereGeometry).
  // Use an invisible flat box collider to represent the floor in the physics simulation.
  // The box spans the same 10x10 footprint as the visual terrain mesh (n=20, cellSize=0.5).
  const floorCollider = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.1, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floorCollider.position.set(0, -4, -1);
  scene.add(floorCollider);
  // physics.addMesh(floorCollider, 0);

  addDirectionalLight(scene);
  
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -4, -1);
  camera.position.set(0, 2, 9);
  controls.update();
  renderer.render(scene, camera);
  
  setupGui();
  startSpawning();
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

  for (const { mesh, body } of dynamicBodies) {
    const pos = body.GetPosition();
    const rot = body.GetRotation();
    mesh.position.set(pos.GetX(), pos.GetY(), pos.GetZ());
    mesh.quaternion.set(rot.GetX(), rot.GetY(), rot.GetZ(), rot.GetW());
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

  gui.add({ maxObjects }, 'maxObjects', 1, 1000, 1)
    .name('Max Objects')
    .onChange((value: number) => {
      maxObjects = value;
      clearSpawnedMeshes();
      startSpawning();
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
  light.castShadow = true;
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function createMeshFloor(n: number, cellSize: number, maxHeight: number, posX: number, posY: number, posZ: number): THREE.Mesh {
  const heightFn = (x: number, y: number) => Math.sin(x / 2) * Math.cos(y / 3);

  // Build Jolt triangle list
  const triangles = new Jolt.TriangleList();
  triangles.resize(n * n * 2);
  for (let x = 0; x < n; ++x) {
    for (let z = 0; z < n; ++z) {
      const center = n * cellSize / 2;
      const x1 = cellSize * x - center;
      const z1 = cellSize * z - center;
      const x2 = x1 + cellSize;
      const z2 = z1 + cellSize;

      const t1 = triangles.at((x * n + z) * 2);
      const v1 = t1.get_mV(0); v1.x = x1; v1.y = heightFn(x,     z);     v1.z = z1;
      const v2 = t1.get_mV(1); v2.x = x1; v2.y = heightFn(x,     z + 1); v2.z = z2;
      const v3 = t1.get_mV(2); v3.x = x2; v3.y = heightFn(x + 1, z + 1); v3.z = z2;

      const t2 = triangles.at((x * n + z) * 2 + 1);
      const u1 = t2.get_mV(0); u1.x = x1; u1.y = heightFn(x,     z);     u1.z = z1;
      const u2 = t2.get_mV(1); u2.x = x2; u2.y = heightFn(x + 1, z + 1); u2.z = z2;
      const u3 = t2.get_mV(2); u3.x = x2; u3.y = heightFn(x + 1, z);     u3.z = z1;
    }
  }
  const mats = new Jolt.PhysicsMaterialList();
  const shape = new Jolt.MeshShapeSettings(triangles, mats).Create().Get();
  Jolt.destroy(triangles);
  Jolt.destroy(mats);

  // Create static physics body
  const creationSettings = new Jolt.BodyCreationSettings(
    shape, new Jolt.RVec3(posX, posY, posZ), new Jolt.Quat(0, 0, 0, 1),
    Jolt.EMotionType_Static, LAYER_NON_MOVING
  );
  const body = bodyInterface.CreateBody(creationSettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(creationSettings);

  // Extract THREE.js geometry from the Jolt shape triangles
  const scale = new Jolt.Vec3(1, 1, 1);
  const triContext = new Jolt.ShapeGetTriangles(
    shape, Jolt.AABox.prototype.sBiggest(),
    shape.GetCenterOfMass(), Jolt.Quat.prototype.sIdentity(), scale
  );
  Jolt.destroy(scale);
  const vertexData = new Float32Array(
    Jolt.HEAPF32.buffer,
    triContext.GetVerticesData(),
    triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
  );
  const buffer = new THREE.BufferAttribute(vertexData, 3).clone();
  Jolt.destroy(triContext);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', buffer);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({ color: 0xAAAAAA, side: THREE.DoubleSide });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(posX, posY, posZ);
  return mesh;
}

function spawnMesh() {
  if (spawnedMeshes.length >= maxObjects) {
    clearInterval(spawnInterval);
    spawnInterval = undefined;
    return;
  }

  const size = 0.15 + Math.random() * 0.3;
  // Only BoxGeometry and SphereGeometry are supported by JoltPhysics getShape()
  const geometries = [
    new THREE.BoxGeometry(size, size, size),
    new THREE.SphereGeometry(size / 2, 16, 12),
  ];
  const geometry = geometries[Math.floor(Math.random() * geometries.length)];
  const material = new THREE.MeshPhongMaterial({ color: 0xc7c7c7 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;

  mesh.position.set(
    (Math.random() - 0.5) * 8,
    2 + Math.random() * 3,
    -1 + (Math.random() - 0.5) * 8
  );
  scene!.add(mesh);
  spawnedMeshes.push(mesh);
  addDynamicBody(mesh, 1, 0.4);
}

function startSpawning() {
  if (spawnInterval !== undefined) return;
  spawnInterval = setInterval(spawnMesh, 1000);
}

function clearSpawnedMeshes() {
  for (const mesh of spawnedMeshes) {
    scene!.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    const idx = dynamicBodies.findIndex(e => e.mesh === mesh);
    if (idx !== -1) {
      const { body } = dynamicBodies[idx];
      bodyInterface.RemoveBody(body.GetID());
      bodyInterface.DestroyBody(body.GetID());
      dynamicBodies.splice(idx, 1);
    }
  }
  spawnedMeshes.length = 0;
  clearInterval(spawnInterval);
  spawnInterval = undefined;
}

function addDynamicBody(mesh: THREE.Mesh, mass: number, restitution: number = 0) {
  const params = (mesh.geometry as any).parameters;
  let shape: any;
  if (mesh.geometry.type === 'BoxGeometry') {
    const sx = (params.width  ?? 1) / 2;
    const sy = (params.height ?? 1) / 2;
    const sz = (params.depth  ?? 1) / 2;
    shape = new Jolt.BoxShape(new Jolt.Vec3(sx, sy, sz), 0.05 * Math.min(sx, sy, sz));
  } else if (mesh.geometry.type === 'SphereGeometry') {
    shape = new Jolt.SphereShape(params.radius ?? 0.5);
  } else {
    return;
  }
  const creationSettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(mesh.position.x, mesh.position.y, mesh.position.z),
    new Jolt.Quat(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w),
    Jolt.EMotionType_Dynamic, LAYER_MOVING
  );
  creationSettings.mRestitution = restitution;
  const body = bodyInterface.CreateBody(creationSettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
  Jolt.destroy(creationSettings);
  dynamicBodies.push({ mesh, body });
}

main();