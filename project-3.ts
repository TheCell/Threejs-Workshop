import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';

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

const keysPressed = new Set<string>();
window.addEventListener('keydown', (e) => keysPressed.add(e.code));
window.addEventListener('keyup', (e) => keysPressed.delete(e.code));

const uniforms = {
  iTime: { value: 0 },
  iResolution: { value: new THREE.Vector3() },
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
#include <common>

uniform vec3 iResolution;
uniform float iTime;

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 uv = fragCoord/iResolution.xy;
  vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
  fragColor = vec4(col,1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const cameraSpeed = 0.05;
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

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

  const fov = 75;
  const aspect = 2;
  const near = 0.01;
  const far = 50;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.y = 1.8 ;
  camera.position.z = 3.5;
  camera.lookAt(0, -1, 0);

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

  updateCamera();

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
  
  if (rotateObjects) {
    for (const mesh of meshes) {
      mesh.rotation.x = time;
      mesh.rotation.y = time;
    }
  }

  uniforms.iResolution.value.set(renderer!.domElement.width, renderer!.domElement.height, 1);
  uniforms.iTime.value = time;
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

function addDirectionalLight(scene: THREE.Scene) {
  light = new THREE.DirectionalLight(lightColor, lightIntensity);
  light.position.set(Math.cos(lightAngle) * lightRadius, 10, Math.sin(lightAngle) * lightRadius);
  light.castShadow = true;
  scene.add(light);

  ambientLight = new THREE.AmbientLight(0xFFFFFF, 1);
  scene.add(ambientLight);
}

function addShapes(scene: THREE.Scene) {
  for (let i = 0; i < 3; i++) {
    let materialName: 'normalMaterial' | 'phongMaterial' | 'shaderMaterial';
    if (i === 0) {
      materialName = 'normalMaterial';
    } else if (i === 1) {
      materialName = 'shaderMaterial';
    } else {
      materialName = 'phongMaterial';
    }

    const material = getMeshByName(materialName, 0x4169e1);

    const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.08, 100, 16), material);
    torusKnot.position.set(-2 + i * 2, 0, 2 - 1 * 2);
    torusKnot.castShadow = true;
    scene.add(torusKnot);
    meshes.push(torusKnot);
  }

  const planeGeo = new THREE.PlaneGeometry(10, 10);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.5;
  plane.receiveShadow = true;
  scene.add(plane);
}

function getMeshByName(
  meshname:
    | 'normalMaterial'
    | 'phongMaterial'
    | 'shaderMaterial',
  color: THREE.ColorRepresentation
): THREE.MeshNormalMaterial | THREE.MeshPhongMaterial | THREE.MeshBasicMaterial | THREE.ShaderMaterial {
  switch (meshname) {
    case 'normalMaterial':
      return new THREE.MeshNormalMaterial();
    case 'phongMaterial':
      return new THREE.MeshPhongMaterial({ color });
    case 'shaderMaterial':
      return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      });
    default:
      console.warn(`Unknown mesh name: ${meshname}, using basic material as default.`);
      return new THREE.MeshBasicMaterial({ color });
  }
}

main();
