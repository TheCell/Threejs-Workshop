import * as THREE from 'three';
import GUI from 'lil-gui';


// Three.js stuff
let cube: THREE.Mesh | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;

function main() {
  const canvas = document.querySelector('#c');
  renderer = new THREE.WebGLRenderer({antialias: true, canvas});

  const fov = 75;
  const aspect = 2;  // the canvas default
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

function render(time) {
  time *= 0.001;  // convert time to seconds
  
  cube.rotation.x = time;
  cube.rotation.y = time;
  
  renderer.render(scene, camera);
  
  requestAnimationFrame(render);
}

main();
requestAnimationFrame(render);

// Debug GUI
const gui = new GUI();
const cubeFolder = gui.addFolder('Cube');
cubeFolder.add(cube?.position, 'x', -2, 2);
cubeFolder.add(cube?.position, 'y', -2, 2);
cubeFolder.open();