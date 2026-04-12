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
  if (!camera) return;
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, up).normalize();

  if (keysPressed.has('KeyW')) {
    camera.position.addScaledVector(cameraForward, cameraSpeed);
  }

  if (keysPressed.has('KeyS')) {
    camera.position.addScaledVector(cameraForward, -cameraSpeed);
  }

  if (keysPressed.has('KeyA')) {
    camera.position.addScaledVector(cameraRight, -cameraSpeed);
  }

  if (keysPressed.has('KeyD')) {
    camera.position.addScaledVector(cameraRight, cameraSpeed);
  }

  if (keysPressed.has('KeyQ')) {
    camera.position.y -= cameraSpeed;
  }

  if (keysPressed.has('KeyE')) {
    camera.position.y += cameraSpeed;
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

  const fov = 75;
  const aspect = 2;
  const near = 0.01;
  const far = 50;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.y = 4 ;
  camera.position.z = 4;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  renderer.domElement.addEventListener( 'pointermove', onPointerMove );

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

const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1);
const dragIntersection = new THREE.Vector3();
let dragOffsetY = 0;

function handleInteraction() {
  raycaster.setFromCamera(normalizedPointerPosition, camera!);
  const intersects = raycaster.intersectObjects(meshes);
  const hitMesh = intersects[0]?.object as THREE.Mesh | undefined;
  const hitGroup = hitMesh ? meshToGroup.get(hitMesh) ?? hitMesh : undefined;

  if (isPointerDown && !draggedGroup && hitGroup) {
    draggedGroup = hitGroup;
    dragOffsetY = hitGroup.position.y;
  }

  if (isPointerDown && draggedGroup) {
    if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
      draggedGroup.position.x = dragIntersection.x;
      draggedGroup.position.z = dragIntersection.z;
      draggedGroup.position.y = dragOffsetY;
    }
  }

  const activeGroup = draggedGroup ?? hitGroup;
  const activeMeshes = activeGroup ? getMeshesInGroup(activeGroup) : [];

  for (const mesh of meshes) {
    if (activeMeshes.includes(mesh)) {
      if (!originalMaterials.has(mesh)) {
        originalMaterials.set(mesh, mesh.material);
      }
      mesh.material = isPointerDown ? pickMaterial : highlightMaterial;
    } else if (originalMaterials.has(mesh)) {
      mesh.material = originalMaterials.get(mesh)!;
      originalMaterials.delete(mesh);
    }
  }
}

let lastRenderTime = 0;
let targetFps = 30;
let targetFrameDuration = 1000 / targetFps;
function render(time: number) {
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
  time *= 0.001;  // convert time to seconds
  
  if (rotateObjects) {
    const groups = new Set(meshToGroup.values());
    for (let i = 0; i < groups.size; i++) {
      const group = Array.from(groups)[i];
      if (i === 0) {
        group.rotation.x = time;
      }
      group.rotation.y = time;
    }
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

const gltfLoader = new GLTFLoader();

function importModel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.glb,.gltf';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target!.result as ArrayBuffer;
      gltfLoader.parse(data, '/GLB format/', (gltf) => {
        const model = gltf.scene;
        
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            meshes.push(mesh);
            meshToGroup.set(mesh, model);
          }
        });
        scene!.add(model);
      });
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

function addLight(scene: THREE.Scene) {
  light = new THREE.DirectionalLight(lightColor, lightIntensity);
  light.position.set(Math.cos(lightAngle) * lightRadius, 10, Math.sin(lightAngle) * lightRadius);
  light.castShadow = true;
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function addFloor(scene: THREE.Scene) {
  const floorSize = 10;
  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -1;
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function addShape(scene: THREE.Scene) {
  const geometry = new THREE.TorusKnotGeometry(0.5, 0.2, 100, 16);
  const material = new THREE.MeshStandardMaterial({ color: basicColor });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  meshes.push(mesh);
  meshToGroup.set(mesh, mesh);
}


main();
