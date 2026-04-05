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
  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const material = new THREE.MeshBasicMaterial({color: 0x44aa88});
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Sphere
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6347 })
  );
  sphere.position.set(2, 0, 0);
  scene.add(sphere);

  // Cylinder
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0x4169e1 })
  );
  cylinder.position.set(-2, 0, 0);
  scene.add(cylinder);

  // Cone
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd700 })
  );
  cone.position.set(0, 0, 2);
  scene.add(cone);

  // Torus
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.15, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0x9400d3 })
  );
  torus.position.set(2, 0, 2);
  scene.add(torus);

  // TorusKnot
  const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.4, 0.1, 100, 16),
    new THREE.MeshBasicMaterial({ color: 0xff1493 })
  );
  torusKnot.position.set(-2, 0, 2);
  scene.add(torusKnot);

  // Plane
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x00ced1, side: THREE.DoubleSide })
  );
  plane.position.set(0, 0, -2);
  scene.add(plane);

  // Circle
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8c00, side: THREE.DoubleSide })
  );
  circle.position.set(2, 0, -2);
  scene.add(circle);

  // Ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x32cd32, side: THREE.DoubleSide })
  );
  ring.position.set(-2, 0, -2);
  scene.add(ring);

  // Dodecahedron
  const dodecahedron = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.5),
    new THREE.MeshBasicMaterial({ color: 0x8b4513 })
  );
  dodecahedron.position.set(4, 0, 0);
  scene.add(dodecahedron);

  // Icosahedron
  const icosahedron = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5),
    new THREE.MeshBasicMaterial({ color: 0x00bfff })
  );
  icosahedron.position.set(-4, 0, 0);
  scene.add(icosahedron);

  // Octahedron
  const octahedron = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5),
    new THREE.MeshBasicMaterial({ color: 0xff4500 })
  );
  octahedron.position.set(4, 0, 2);
  scene.add(octahedron);

  // Tetrahedron
  const tetrahedron = new THREE.Mesh(
    new THREE.TetrahedronGeometry(0.5),
    new THREE.MeshBasicMaterial({ color: 0xadff2f })
  );
  tetrahedron.position.set(-4, 0, 2);
  scene.add(tetrahedron);

  // Capsule
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0xda70d6 })
  );
  capsule.position.set(4, 0, -2);
  scene.add(capsule);
}

main();
