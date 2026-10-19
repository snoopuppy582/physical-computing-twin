import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {roomFromURL, pageURL, STALE_MS} from './cooler-core.mjs';
import {connectCooler} from './cooler-mqtt.mjs';
import {validateSceneManifest} from './cooler-scene.mjs';

const $ = id => document.getElementById(id);
const room = roomFromURL(location.href);
const controlURL = pageURL(location.href, 'twin-control.html', room);
for (const id of ['control-link', 'control-link-card']) $(id).href = controlURL;
$('room-label').textContent = room;
$('viewer-home').href = pageURL(location.href, 'cooler.html', room);
history.replaceState(null, '', `${location.pathname}${location.search}#${new URLSearchParams({room})}`);

let transport = null, targetDuty = 0, currentDuty = 0, lastCommandAt = 0, count = 0, ack = null;
let signal = 'waiting';
const stateLabels = {connecting: 'MQTT 연결 중', subscribing: '구독 준비 중', connected: 'MQTT 연결됨', reconnecting: 'MQTT 재연결 중', error: '연결 확인 필요'};

function displayOutput() {
  $('duty-value').textContent = Math.round(targetDuty);
  $('duty-bar').style.width = `${targetDuty}%`;
  $('signal-label').textContent = signal === 'active' ? (targetDuty ? '수신한 출력으로 가상 팬 회전 중' : '정지 명령 반영됨') :
    signal === 'stale' ? '입력이 끊겨 가상 팬을 정지했습니다.' : '제어판 입력 대기';
}

function report() { transport?.status({duty: targetDuty, signal, ack}); }
function connect() {
  transport?.close();
  targetDuty = 0; signal = 'waiting'; ack = null; lastCommandAt = 0;
  displayOutput();
  try {
    transport = connectCooler({room, role: 'viewer',
      onState(value) {
        $('connection-label').textContent = stateLabels[value];
        $('connection').classList.toggle('live', value === 'connected');
        $('connection').classList.toggle('error', value === 'error');
        if (value !== 'connected') {
          targetDuty = 0;
          if (lastCommandAt) signal = 'stale';
          displayOutput();
        } else report();
      },
      onCommand(message) {
        targetDuty = message.duty;
        lastCommandAt = performance.now(); signal = 'active'; count++;
        ack = {device: message.device, seq: message.seq};
        $('command-count').textContent = count;
        displayOutput(); report();
      }
    });
  } catch (error) {
    $('connection-label').textContent = '연결 확인 필요';
    $('signal-label').textContent = error.message;
  }
}


const stage = $('cooler-stage');
let renderer, scene, camera, controls, rotor, scan, screenCovers, equipment, manifest;
let sceneReady = false, contextLost = false, selectedView = 'overview', transitionCamera = false;
const cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
const viewNames = ['overview', 'fan', 'structure'];
let activeUntil = 0;

function material(color, metalness = 0, roughness = .55) {
  return new THREE.MeshStandardMaterial({color, metalness, roughness});
}
function box(parent, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position); parent.add(mesh); return mesh;
}
function rod(parent, start, end, radius, mat) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  parent.add(mesh); return mesh;
}
function applyTransform(object, data) {
  object.position.fromArray(data.position); object.quaternion.fromArray(data.quaternion).normalize();
  object.scale.setScalar(data.scale ?? 1);
}
function createFan() {
  equipment = new THREE.Group(); equipment.name = 'fan-and-mount'; scene.add(equipment);
  applyTransform(equipment, manifest.fan);
  equipment.scale.multiplyScalar(manifest.fan.size / .12);
  const frame = material('#344f48', .22, .44), hub = material('#1c392f', .3, .4);
  const blade = material('#71b294', .12, .52), fastener = material('#b0bfb2', .65, .35);
  box(equipment, [.12, .023, .009], [0, 0, -.0555], frame);
  box(equipment, [.12, .023, .009], [0, 0, .0555], frame);
  box(equipment, [.009, .023, .102], [-.0555, 0, 0], frame);
  box(equipment, [.009, .023, .102], [.0555, 0, 0], frame);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.052, .0035, 10, 56), frame);
  ring.rotation.x = Math.PI / 2; equipment.add(ring);
  for (const x of [-.051, .051]) for (const z of [-.051, .051]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, .024, 10), fastener);
    screw.position.set(x, .001, z); equipment.add(screw);
  }
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + .5;
    rod(equipment, [0, -.009, 0], [.051 * Math.cos(angle), -.009, .051 * Math.sin(angle)], .0017, frame);
  }
  rotor = new THREE.Group(); rotor.name = 'virtual-fan-rotor'; equipment.add(rotor);
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .018, 32), hub));
  const shape = new THREE.Shape(); shape.moveTo(.011, -.006);
  shape.bezierCurveTo(.03, -.006, .052, -.005, .049, .014);
  shape.bezierCurveTo(.04, .019, .019, .009, .011, .006); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: .0018, bevelEnabled: false, curveSegments: 8});
  geometry.rotateX(-Math.PI / 2);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(geometry, blade); leaf.rotation.y = i * Math.PI * 2 / 7; rotor.add(leaf);
  }
  // Removable mounting straps, drawn only as an installation concept. The
  // scanned stand and laptop are not duplicated with fabricated mesh bodies.
  const strap = material('#789587', .35, .5);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    rod(equipment, [x * .051, 0, z * .048], [x * .095, .018, z * .048], .0025, strap);
    box(equipment, [.024, .004, .016], [x * .096, .019, z * .048], strap);
    rod(equipment, [x * .104, .018, z * .048], [x * .104, .032, z * .048], .0025, strap);
  }
}
function setView(name, instant = false) {
  if (!manifest || !scan) return;
  selectedView = name;
  for (const id of viewNames) {
    $(`view-${id}`).classList.toggle('selected', id === name);
    $(`view-${id}`).setAttribute('aria-pressed', String(id === name));
  }
  const isolated = name === 'structure';
  scan.visible = !isolated; screenCovers.visible = !isolated;
  // The fan view is a transparent installation study. Spark propagates the
  // public opacity property to its render context on the next update.
  scan.opacity = name === 'fan' ? .4 : 1;
  scene.background.set(isolated ? '#e7ebe4' : '#242b2b');
  const view = manifest.views[name];
  cameraPosition.fromArray(view.position); cameraTarget.fromArray(view.target);
  if (camera.aspect < 1) cameraPosition.sub(cameraTarget).multiplyScalar(Math.min(1.5, 1 / Math.sqrt(camera.aspect))).add(cameraTarget);
  if (instant) {
    camera.position.copy(cameraPosition); controls.target.copy(cameraTarget); controls.update(); transitionCamera = false;
  } else transitionCamera = true;
  $('view-note').textContent = isolated ? '배경을 숨긴 팬·고정부 설치 구상' : name === 'fan' ? '배경을 흐리게 표시한 설치 구상' : '드래그로 회전 · 휠로 확대';
  activeUntil = performance.now() + 2000;
  stage.dataset.view = name;
}
function loading(label, progress = null, detail = '') {
  $('scene-loading').hidden = false; $('loading-label').textContent = label;
  if (progress === null) $('loading-progress').removeAttribute('value');
  else $('loading-progress').value = Math.max(0, Math.min(100, progress));
  if (detail) $('loading-detail').textContent = detail;
}
function failScene(message) {
  sceneReady = false; targetDuty = 0; transport?.close();
  renderer?.setAnimationLoop(null);
  stage.dataset.ready = 'false';
  loading('책상 스캔을 열지 못했습니다.', 0, message);
  $('loading-progress').hidden = true; $('reload-scene').hidden = false;
  $('connection-label').textContent = '장면 연결 대기'; $('connection').classList.remove('live');
  for (const name of viewNames) $(`view-${name}`).disabled = true;
}
async function downloadScan(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`스캔 파일 요청 실패 (${response.status}). 새로고침 후 다시 시도해 주세요.`);
  const total = Number(response.headers.get('content-length')) || manifest.asset.bytes || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader(), chunks = []; let received = 0;
  for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    chunks.push(value); received += value.byteLength;
    loading('책상 스캔을 불러오고 있습니다.', total ? received / total * 85 : null,
      `${(received / 1048576).toFixed(1)} MB${total ? ` / ${(total / 1048576).toFixed(1)} MB` : ''}`);
  }
  const bytes = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function createRenderer() {
  renderer = new THREE.WebGLRenderer({antialias: false, powerPreference: 'default'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.setAttribute('aria-label', '직접 스캔한 책상과 추가 냉각팬의 3D 설치 구상');
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#242b2b');
  camera = new THREE.PerspectiveCamera(manifest.camera.fov, 1, .005, 100);
  camera.up.fromArray(manifest.camera.up).normalize();
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  controls.minDistance = manifest.camera.minDistance ?? .08;
  controls.maxDistance = manifest.camera.maxDistance ?? 8;
  controls.minPolarAngle = .05; controls.maxPolarAngle = Math.PI * .93; controls.enablePan = false;
  controls.addEventListener('start', () => { transitionCamera = false; activeUntil = performance.now() + 2000; });
  controls.addEventListener('change', () => { activeUntil = performance.now() + 1000; });
  scene.add(new THREE.HemisphereLight('#edf7ef', '#7a8b7d', 2));
  const light = new THREE.DirectionalLight('#fff3dc', 2.2); light.position.set(1, 3, 2); scene.add(light);
  const fill = new THREE.DirectionalLight('#d6f1eb', .9); fill.position.set(-2, 1, -2); scene.add(fill);
  const resize = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    // Limit both DPR and total pixels on a laptop already affected by heat.
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35, Math.sqrt(1600000 / (width * height))));
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    activeUntil = performance.now() + 1500;
  };
  new ResizeObserver(resize).observe(stage); resize();
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true;
    failScene('3D 표시가 중단되었습니다. 페이지를 다시 불러와 주세요.');
  });
  let lastRender = 0;
  renderer.setAnimationLoop(now => {
    if (contextLost || document.hidden) return;
    const fps = targetDuty > 0 || currentDuty > .1 || transitionCamera || now < activeUntil || !sceneReady ? 30 : 10;
    if (now - lastRender < 1000 / fps) return;
    const dt = Math.min((now - lastRender) / 1000, .15); lastRender = now;
    currentDuty += (targetDuty - currentDuty) * (1 - Math.exp(-7 * dt));
    // The mesh's visual rotation is not a measured physical RPM.
    if (rotor) rotor.rotation.y += currentDuty / 100 * 14 * dt;
    if (transitionCamera) {
      camera.position.lerp(cameraPosition, 1 - Math.exp(-8 * dt));
      controls.target.lerp(cameraTarget, 1 - Math.exp(-8 * dt));
      if (camera.position.distanceTo(cameraPosition) < .001) transitionCamera = false;
    }
    controls.update(); renderer.render(scene, camera);
    if (equipment && sceneReady) {
      const anchor = equipment.position.clone().project(camera);
      const marker = $('fan-marker');
      marker.hidden = selectedView === 'structure' || Math.abs(anchor.x) > .9 || Math.abs(anchor.y) > .85 || anchor.z > 1;
      marker.style.left = `${(anchor.x + 1) * 50}%`; marker.style.top = `${(1 - anchor.y) * 50}%`;
    }
  });
}
async function buildScene() {
  loading('장면 설정을 확인하고 있습니다.', 0);
  const manifestURL = new URL('assets/desk/scene.json', location.href);
  const response = await fetch(manifestURL, {cache: 'no-cache', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`장면 설정 요청 실패 (${response.status}). 잠시 후 다시 열어 주세요.`);
  manifest = validateSceneManifest(await response.json(), manifestURL);
  loading('3D 표시를 준비하고 있습니다.');
  const {SparkRenderer, SplatMesh} = await import('@sparkjsdev/spark');
  createRenderer(); scene.add(new SparkRenderer({renderer}));
  const bytes = await downloadScan(manifest.asset.resolvedURL);
  loading('스캔 데이터를 3D 장면으로 준비하고 있습니다.', 90, '잠시 기다려 주세요.');
  scan = new SplatMesh({fileBytes: bytes, fileName: manifest.asset.url.split('/').pop(), editable: false, raycastable: false});
  await scan.initialized;
  if (!scan.numSplats) throw new Error('스캔에 표시할 데이터가 없습니다.');
  applyTransform(scan, manifest.scan); scan.name = 'sanitized-desk-scan'; scene.add(scan);
  screenCovers = new THREE.Group(); screenCovers.name = 'blank-screen-surfaces'; scene.add(screenCovers);
  // Screen splats are already removed from the distributed asset. These blank
  // faces only fill the resulting holes; privacy does not depend on a cover.
  for (const data of manifest.screenCovers || []) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...data.size), new THREE.MeshBasicMaterial({color: '#17211f', side: THREE.DoubleSide}));
    applyTransform(mesh, data); screenCovers.add(mesh);
  }
  createFan(); setView('overview', true);
  sceneReady = true; stage.dataset.ready = 'true';
  for (const name of viewNames) $(`view-${name}`).disabled = false;
  $('scene-loading').hidden = true;
  window.coolerScene = {scene, camera, controls, renderer, scan, equipment, rotor, manifest, setView};
  connect();
}

for (const name of viewNames) $(`view-${name}`).addEventListener('click', () => setView(name));
$('reset-view').addEventListener('click', () => setView(selectedView));
$('reload-scene').addEventListener('click', () => location.reload());
$('reconnect').addEventListener('click', () => { if (sceneReady) connect(); });
setInterval(() => {
  if (lastCommandAt && performance.now() - lastCommandAt > STALE_MS && signal !== 'stale') {
    targetDuty = 0; signal = 'stale'; displayOutput(); report();
  }
  $('last-command').textContent = lastCommandAt ? `${Math.floor((performance.now() - lastCommandAt) / 1000)}초 전` : '—';
}, 250);
setInterval(report, 2000);
window.addEventListener('pagehide', () => transport?.close());
window.addEventListener('pageshow', event => { if (event.persisted && sceneReady) connect(); });
buildScene().catch(error => { console.error(error); failScene(error.message); });
