import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const $ = id => document.getElementById(id);
const stage = $('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202923);
const camera = new THREE.PerspectiveCamera(58, 1, 0.015, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = .15;
controls.maxDistance = 20;
const spark = new SparkRenderer({ renderer });
scene.add(spark);
scene.add(new THREE.HemisphereLight(0xfff8ea, 0x5e665b, 2));
const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
key.position.set(-1, 4, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xe0e9ee, 1.1);
fill.position.set(3, 2, -3);
scene.add(fill);

let config, scan, model, leaf, frame;
let ready = false, running = false, elapsed = 0, startedAt = 0, currentAngle = 0;
let destroyed = false, initialWorldMatrix;
const number = new Intl.NumberFormat('ko-KR');
const smoothstep = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// One ten-second cycle: closed, opening, hold, closing, closed.
function angleAt(seconds) {
  if (seconds < 1) return 0;
  if (seconds < 4) return config.maxAngle * smoothstep((seconds - 1) / 3);
  if (seconds < 6) return config.maxAngle;
  if (seconds < 9) return config.maxAngle * (1 - smoothstep((seconds - 6) / 3));
  return 0;
}
function phaseAt(seconds) {
  if (seconds >= config.duration) return '완료';
  if (seconds < 1) return '닫힘';
  if (seconds < 4) return '열리는 중';
  if (seconds < 6) return '열림';
  if (seconds < 9) return '닫히는 중';
  return '닫힘';
}
function setAngle(degrees) {
  if (!leaf) return;
  currentAngle = THREE.MathUtils.clamp(degrees, 0, 90);
  leaf.rotation.y = config.openSign * THREE.MathUtils.degToRad(currentAngle);
  $('door-angle').value = currentAngle;
  $('angle-output').value = Math.round(currentAngle) + '°';
  $('scene-angle').textContent = Math.round(currentAngle) + '°';
}
function updatePlayback() {
  $('timeline').value = elapsed;
  $('elapsed').textContent = elapsed.toFixed(1) + ' / 10.0초';
  $('phase').textContent = phaseAt(elapsed);
}
function setRunning(value) {
  running = value;
  $('simulate').textContent = value ? '일시정지' : elapsed >= config.duration ? '다시 시뮬레이션' : elapsed > 0 ? '계속 재생' : '시뮬레이션 · 10초';
  $('simulate').setAttribute('aria-pressed', String(value));
  $('door-angle').disabled = value;
}
function play() {
  if (!ready) return;
  if (running) { pause(); return; }
  if (elapsed >= config.duration) elapsed = 0;
  setAngle(angleAt(elapsed));
  startedAt = performance.now() - elapsed * 1000;
  setRunning(true);
  updatePlayback();
}
function pause() {
  if (running) elapsed = Math.min(config.duration, (performance.now() - startedAt) / 1000);
  if (leaf) setAngle(angleAt(elapsed));
  setRunning(false);
  updatePlayback();
}
function reset() {
  if (!ready) return;
  elapsed = 0;
  setRunning(false);
  setAngle(0);
  updatePlayback();
}
function view(name = 'default') {
  if (!config) return;
  const position = name === 'detail' ? config.detailCamera : config.camera;
  const target = name === 'detail' ? config.detailTarget : config.target;
  camera.position.fromArray(position);
  controls.target.fromArray(target);
  // Portrait uses a wider field of view while keeping the scan's capture vicinity.
  camera.fov = camera.aspect < 1 ? 76 : 58;
  camera.updateProjectionMatrix();
  controls.update();
}
async function checkedFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`파일을 불러오지 못했습니다 (${response.status}).`);
  return response;
}
async function load() {
  try {
    config = await (await checkedFetch('twin-config.json?v=0920-1')).json();
    view();
    const [scanBytes, modelBytes] = await Promise.all([
      checkedFetch(config.scanUrl).then(r => r.arrayBuffer()),
      checkedFetch(config.modelUrl).then(r => r.arrayBuffer())
    ]);
    if (destroyed) return;
    scan = new SplatMesh({ fileBytes: new Uint8Array(scanBytes), fileName: 'cafe-clean.spz' });
    await scan.initialized;
    const gltf = await new GLTFLoader().parseAsync(modelBytes, '');
    if (destroyed) { scan.dispose(); return; }
    scan.position.fromArray(config.scanPosition);
    scan.rotation.fromArray(config.scanRotation);
    scan.scale.setScalar(config.scanScale);
    scene.add(scan);
    model = gltf.scene;
    leaf = model.getObjectByName('Door_Hinge_Pivot');
    frame = model.getObjectByName('Door_Frame');
    if (!leaf || !frame) throw new Error('방문의 회전 구조를 찾을 수 없습니다.');
    model.position.fromArray(config.doorPosition);
    model.rotation.y = config.doorRotationY;
    scene.add(model);
    model.updateMatrixWorld(true);
    initialWorldMatrix = frame.matrixWorld.toArray();
    $('splat-count').textContent = number.format(scan.numSplats);
    $('scan-size').textContent = (scanBytes.byteLength / 1048576).toFixed(1) + ' MB';
    $('scan-download').href = config.scanUrl;
    ready = true;
    $('simulate').disabled = false;
    $('reset').disabled = false;
    $('door-angle').disabled = false;
    $('loading').hidden = true;
    $('load-status').textContent = '장면 준비 완료';
    reset();
  } catch (error) {
    $('loading').textContent = '장면을 열지 못했습니다. 새로고침해 주세요.';
    $('load-status').textContent = error.message;
    $('load-status').classList.add('error');
    console.error(error);
  }
}
$('simulate').addEventListener('click', play);
$('reset').addEventListener('click', reset);
$('door-angle').addEventListener('input', event => {
  elapsed = 0;
  setRunning(false);
  setAngle(Number(event.target.value));
  updatePlayback();
  $('phase').textContent = '직접 조작';
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
document.addEventListener('visibilitychange', () => { if (document.hidden && ready && running) pause(); });
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = camera.aspect < 1 ? 76 : 58;
  camera.updateProjectionMatrix();
});
resizeObserver.observe(stage);
renderer.setAnimationLoop(now => {
  if (running) {
    elapsed = Math.min(config.duration, (performance.now() - startedAt) / 1000);
    setAngle(angleAt(elapsed));
    updatePlayback();
    if (elapsed >= config.duration) setRunning(false);
  }
  controls.update();
  renderer.render(scene, camera);
});
// Expose scene state for verification and deliberate capture; nothing is sent remotely.
window.twinScene = {
  scene, camera, renderer, controls, spark, play, pause, reset, view, setAngle, angleAt,
  get ready() { return ready; }, get running() { return running; }, get elapsed() { return elapsed; },
  get config() { return config; }, get scan() { return scan; }, get model() { return model; },
  get leaf() { return leaf; }, get frame() { return frame; }, get initialFrameMatrix() { return initialWorldMatrix; }
};
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  destroyed = true;
  resizeObserver.disconnect();
  renderer.setAnimationLoop(null);
  controls.dispose();
  scan?.dispose();
  spark.dispose();
  renderer.dispose();
});
load();
