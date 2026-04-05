import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import JoltPhysics from 'jolt-physics/wasm';

const improvedNoise = new ImprovedNoise();
const Jolt = await JoltPhysics();

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let displayDebug = false;
let limitFps = true;
let maxObjects = 100;

let stats = new Stats();
stats.showPanel(displayDebug ? 0 : -1);
document.body.appendChild(stats.dom);

// Three.js stuff
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

const KILL_Y = -12; // anything below this Y is removed and respawned

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

  const floor = createMeshFloor(50, 0.5, 1, 0, -4, -1);
  scene.add(floor);

  // Kill floor — wide grid rendered with lines, sits below the terrain
  const killFloorGrid = new THREE.GridHelper(80, 40, 0xff2200, 0xff4400);
  killFloorGrid.position.set(0, KILL_Y, -1);
  scene.add(killFloorGrid);

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

  const toKill: Array<{ mesh: THREE.Mesh; body: any }> = [];
  for (const entry of dynamicBodies) {
    const pos = entry.body.GetPosition();
    const rot = entry.body.GetRotation();
    entry.mesh.position.set(pos.GetX(), pos.GetY(), pos.GetZ());
    entry.mesh.quaternion.set(rot.GetX(), rot.GetY(), rot.GetZ(), rot.GetW());
    if (pos.GetY() < KILL_Y) toKill.push(entry);
  }
  for (const { mesh, body } of toKill) {
    killMesh(mesh, body);
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
}

function addDirectionalLight(scene: THREE.Scene) {
  light = new THREE.DirectionalLight(lightColor, lightIntensity);
  light.position.set(10, 10, 1);
  light.castShadow = true;
  light.shadow.camera.left = -12;
  light.shadow.camera.right = 12;
  light.shadow.camera.top = 12;
  light.shadow.camera.bottom = -12;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 40;
  light.shadow.mapSize.set(2048, 2048);
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function createMeshFloor(n: number, cellSize: number, maxHeight: number, posX: number, posY: number, posZ: number): THREE.Mesh {
  const heightFn = (x: number, y: number) => improvedNoise.noise(x / 5, maxHeight, y / 5);

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
  mesh.receiveShadow = true;
  return mesh;
}

const SPAWN_COLORS = [
  0xff4444, 0x44cc44, 0x4488ff, 0xffcc00, 0xff44ff, 0x44ffff,
  0xff8844, 0x88ff44, 0x4488cc, 0xff4488, 0x44ff88, 0xaa44ff,
];

/** Extract a Three.js BufferGeometry from any Jolt shape via ShapeGetTriangles. */
function getThreeGeometryFromShape(shape: any): THREE.BufferGeometry {
  const scale = new Jolt.Vec3(1, 1, 1);
  const triCtx = new Jolt.ShapeGetTriangles(
    shape, Jolt.AABox.prototype.sBiggest(),
    shape.GetCenterOfMass(), Jolt.Quat.prototype.sIdentity(), scale
  );
  Jolt.destroy(scale);
  const vertexData = new Float32Array(
    Jolt.HEAPF32.buffer,
    triCtx.GetVerticesData(),
    triCtx.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
  );
  const buffer = new THREE.BufferAttribute(vertexData, 3).clone();
  Jolt.destroy(triCtx);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', buffer);
  geo.computeVertexNormals();
  return geo;
}

function spawnMesh() {
  if (spawnedMeshes.length >= maxObjects) {
    clearInterval(spawnInterval);
    spawnInterval = undefined;
    return;
  }

  const size = 0.15 + Math.random() * 0.35;
  const color = SPAWN_COLORS[Math.floor(Math.random() * SPAWN_COLORS.length)];
  const objectType = Math.floor(Math.random() * 7);

  let shape: JoltPhysics.Shape;
  let geometry: THREE.BufferGeometry;

  switch (objectType) {
    case 0: { // Sphere
      const radius = size / 2;
      shape = new Jolt.SphereShape(radius);
      geometry = new THREE.SphereGeometry(radius, 16, 12);
      break;
    }
    case 1: { // Box
      const h = size / 2;
      shape = new Jolt.BoxShape(new Jolt.Vec3(h, h, h), 0.05 * h);
      geometry = new THREE.BoxGeometry(size, size, size);
      break;
    }
    case 2: { // Cylinder
      const radius = size / 2;
      const halfH = size / 2;
      shape = new Jolt.CylinderShape(halfH, radius, 0.05);
      geometry = new THREE.CylinderGeometry(radius, radius, size, 16);
      break;
    }
    case 3: { // Capsule
      const radius = size / 3;
      const halfH = size / 3;
      shape = new Jolt.CapsuleShape(halfH, radius);
      geometry = new THREE.CapsuleGeometry(radius, halfH * 2, 8, 16);
      break;
    }
    case 4: { // Convex hull — random point cloud
      const hullSettings = new Jolt.ConvexHullShapeSettings();
      for (let p = 0; p < 10; ++p) {
        hullSettings.mPoints.push_back(new Jolt.Vec3(
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
        ));
      }
      shape = hullSettings.Create().Get();
      Jolt.destroy(hullSettings);
      geometry = getThreeGeometryFromShape(shape);
      break;
    }
    case 5: { // Tapered cylinder (cone-like)
      const topRadius = size * 0.05;
      const bottomRadius = size * 0.4;
      const halfH = size * 0.35;
      shape = new Jolt.TaperedCylinderShapeSettings(halfH, topRadius, bottomRadius).Create().Get();
      geometry = getThreeGeometryFromShape(shape);
      break;
    }
    case 6: { // Compound dumbbell (two spheres + capsule bar)
      const r2 = size * 0.25;
      const r1 = r2 * 0.4;
      const l = size * 0.35;
      const compoundSettings = new Jolt.StaticCompoundShapeSettings();
      const barRot = Jolt.Quat.prototype.sRotation(new Jolt.Vec3(0, 0, 1), 0.5 * Math.PI);
      compoundSettings.AddShape(new Jolt.Vec3(-l, 0, 0), Jolt.Quat.prototype.sIdentity(), new Jolt.SphereShapeSettings(r2), 1);
      compoundSettings.AddShape(new Jolt.Vec3( l, 0, 0), Jolt.Quat.prototype.sIdentity(), new Jolt.SphereShapeSettings(r2), 2);
      compoundSettings.AddShape(new Jolt.Vec3( 0, 0, 0), barRot, new Jolt.CapsuleShapeSettings(l, r1), 3);
      shape = compoundSettings.Create().Get();
      Jolt.destroy(compoundSettings);
      geometry = getThreeGeometryFromShape(shape);
      break;
    }
    default: {
      const h = size / 2;
      shape = new Jolt.BoxShape(new Jolt.Vec3(h, h, h), 0.05 * h);
      geometry = new THREE.BoxGeometry(size, size, size);
    }
  }

  const pos = new THREE.Vector3(
    (Math.random() - 0.5) * 8,
    -2,
    -1 + (Math.random() - 0.5) * 8
  );
  const RandomQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
  );

  const material = new THREE.MeshPhongMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.copy(pos);
  mesh.quaternion.copy(RandomQuaternion);
  scene!.add(mesh);
  spawnedMeshes.push(mesh);

  const creationSettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(pos.x, pos.y, pos.z),
    new Jolt.Quat(RandomQuaternion.x, RandomQuaternion.y, RandomQuaternion.z, RandomQuaternion.w),
    Jolt.EMotionType_Dynamic, LAYER_MOVING
  );
  creationSettings.mRestitution = 0.3;
  const body = bodyInterface.CreateBody(creationSettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
  Jolt.destroy(creationSettings);
  dynamicBodies.push({ mesh, body });
}

function killMesh(mesh: THREE.Mesh, body: any) {
  scene!.remove(mesh);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();

  const si = spawnedMeshes.indexOf(mesh);
  if (si !== -1) {
    spawnedMeshes.splice(si, 1);
  }

  const di = dynamicBodies.findIndex(e => e.mesh === mesh);
  if (di !== -1) {
    dynamicBodies.splice(di, 1);
  }

  bodyInterface.RemoveBody(body.GetID());
  bodyInterface.DestroyBody(body.GetID());

  // Resume spawning now that count dropped below max
  startSpawning();
}

function startSpawning() {
  if (spawnInterval !== undefined) {
    return;
  }
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

main();