import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {roomFromURL, pageURL, STALE_MS} from './cooler-core.mjs';
import {connectCooler} from './cooler-mqtt.mjs';

const $ = id => document.getElementById(id);
const room = roomFromURL(location.href);
const controlURL = pageURL(location.href, 'twin-control.html', room);
for (const id of ['control-link', 'control-link-card']) $(id).href = controlURL;
$('room-label').textContent = room;
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
let renderer, scene, camera, controls, rotor, laptop, fan, selectedView = 'overview';
const laptopMaterials = [];
const cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
let transitionCamera = false;

function material(color, metalness = 0, roughness = .55) {
  return new THREE.MeshStandardMaterial({color, metalness, roughness});
}
function box(parent, size, position, mat, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = name; parent.add(mesh); return mesh;
}
function rod(parent, start, end, thickness, mat) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, delta.length(), 12), mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
function addLaptop(parent) {
  laptop = new THREE.Group(); laptop.name = 'laptop'; parent.add(laptop);
  const chassis = material('#555d61', .65, .36), black = material('#242c2e', .25), keys = material('#394548', .3);
  const screen = material('#123b3a', .05, .43), graphic = material('#64a494', .05);
  laptopMaterials.push(chassis, black, keys, screen, graphic);
  box(laptop, [.326, .016, .23], [0, .009, 0], chassis, 'laptop-base');
  box(laptop, [.288, .002, .097], [0, .018, -.035], black);
  for (let row = 0; row < 5; row++) for (let col = 0; col < 14; col++) {
    box(laptop, [.0164, .0018, .0125], [-.13 + col * .02, .0198, -.073 + row * .018], keys);
  }
  box(laptop, [.102, .0015, .046], [0, .018, .064], black);
  // A row of shallow vents identifies the underside; this is a layout study,
  // not a measurement of this laptop's exact ventilation pattern.
  for (let i = 0; i < 13; i++) box(laptop, [.009, .001, .066], [-.115 + i * .019, .0002, -.022], black);
  const hinge = new THREE.Group(); hinge.position.set(0, .019, -.109); hinge.rotation.x = -.24; laptop.add(hinge);
  box(hinge, [.326, .205, .009], [0, .102, 0], chassis);
  box(hinge, [.307, .181, .001], [0, .103, .0051], black);
  box(hinge, [.295, .167, .001], [0, .104, .006], screen);
  // Minimal screen marks are geometry rather than a screenshot of unrelated work.
  for (let i = 0; i < 5; i++) box(hinge, [.11 - i * .014, .003, .001], [-.062, .15 - i * .012, .0067], graphic);
  for (let i = 0; i < 14; i++) box(hinge, [.008, .015 + Math.sin(i * .45) * .01, .001], [-.122 + i * .019, .057, .0067], graphic);
}
function addFan(parent) {
  fan = new THREE.Group(); fan.name = 'additional-fan'; fan.position.set(0, -.058, .002); parent.add(fan);
  const frame = material('#354a46', .24, .42), hub = material('#233c35', .35, .38);
  const blade = material('#5f8d79', .2, .43), fastener = material('#a7b9ac', .7, .3);
  box(fan, [.12, .023, .009], [0, 0, -.0555], frame);
  box(fan, [.12, .023, .009], [0, 0, .0555], frame);
  box(fan, [.009, .023, .102], [-.0555, 0, 0], frame);
  box(fan, [.009, .023, .102], [.0555, 0, 0], frame);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.052, .0035, 10, 56), frame);
  ring.rotation.x = Math.PI / 2; fan.add(ring);
  for (const x of [-.051, .051]) for (const z of [-.051, .051]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, .024, 10), fastener);
    screw.position.set(x, .001, z); fan.add(screw);
  }
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + .5;
    rod(fan, [0, -.009, 0], [.051 * Math.cos(angle), -.009, .051 * Math.sin(angle)], .0017, frame);
  }
  rotor = new THREE.Group(); rotor.name = 'virtual-fan-rotor'; fan.add(rotor);
  const center = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .018, 32), hub);
  rotor.add(center);
  const shape = new THREE.Shape(); shape.moveTo(.011, -.006);
  shape.bezierCurveTo(.03, -.006, .052, -.005, .049, .014);
  shape.bezierCurveTo(.04, .019, .019, .009, .011, .006); shape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(shape, {depth: .0018, bevelEnabled: false, curveSegments: 8});
  bladeGeometry.rotateX(-Math.PI / 2);
  for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(bladeGeometry, blade); leaf.rotation.y = i * Math.PI * 2 / 7; leaf.castShadow = true; rotor.add(leaf); }
  // Four slim removable straps communicate the planned mounting arrangement.
  const strap = material('#263e38', .05, .8);
  for (const x of [-.052, .052]) rod(parent, [x, -.06, -.048], [Math.sign(x) * .113, -.034, -.05], .002, strap);
  for (const x of [-.052, .052]) rod(parent, [x, -.06, .048], [Math.sign(x) * .113, -.034, .067], .002, strap);
}
function setView(view, instant = false) {
  selectedView = view;
  for (const name of ['overview', 'bottom', 'fan']) {
    $(`view-${name}`).classList.toggle('selected', name === view);
    $(`view-${name}`).setAttribute('aria-pressed', String(name === view));
  }
  const seeThrough = view !== 'overview';
  for (const mat of laptopMaterials) { mat.transparent = seeThrough; mat.opacity = seeThrough ? .13 : 1; mat.depthWrite = !seeThrough; mat.needsUpdate = true; }
  laptop.traverse(node => { if (node.isMesh) node.castShadow = !seeThrough; });
  const views = {
    overview: {position: [.57, 1.22, .7], target: [0, .89, 0]},
    bottom: {position: [.31, 1.08, .39], target: [0, .835, 0]},
    fan: {position: [.17, .99, .2], target: [0, .809, .005]}
  };
  const chosen = views[view]; cameraPosition.fromArray(chosen.position); cameraTarget.fromArray(chosen.target);
  if (camera.aspect < 1) cameraPosition.sub(cameraTarget).multiplyScalar(1.16).add(cameraTarget);
  if (instant) { camera.position.copy(cameraPosition); controls.target.copy(cameraTarget); controls.update(); transitionCamera = false; }
  else transitionCamera = true;
  $('view-note').textContent = seeThrough ? '노트북을 반투명으로 표시한 설치 구상' : '드래그로 회전 · 휠로 확대';
}
function buildScene() {
  renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '책상 위 노트북과 거치대 아래에 설치할 냉각팬의 3D 구상');
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#e7ebe4');
  scene.fog = new THREE.Fog('#e7ebe4', 2.2, 5);
  camera = new THREE.PerspectiveCamera(34, 1, .005, 20);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  controls.minDistance = .18; controls.maxDistance = 2; controls.maxPolarAngle = Math.PI * .49;
  controls.enablePan = false; controls.addEventListener('start', () => { transitionCamera = false; });
  scene.add(new THREE.HemisphereLight('#e9f4ee', '#7e8e7f', 2.4));
  const light = new THREE.DirectionalLight('#fff5df', 3.4); light.position.set(-1.2, 2.3, 1.2);
  light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {left: -1, right: 1, top: 1, bottom: -1, near: .1, far: 5});
  light.shadow.bias = -.0002; light.shadow.normalBias = .002; scene.add(light);
  const fill = new THREE.DirectionalLight('#def2eb', 1.1); fill.position.set(1, 1.1, -1); scene.add(fill);

  // Keep the workspace and equipment separate so a later desk SPZ can replace
  // the simple context without changing the MQTT-controlled equipment group.
  const workspace = new THREE.Group(); workspace.name = 'workspace-context'; scene.add(workspace);
  const equipment = new THREE.Group(); equipment.name = 'equipment-root'; scene.add(equipment);
  const oak = material('#c6b79a', .02, .8), silver = material('#aab5b0', .75, .32), rubber = material('#34443f', .05, .9);
  box(workspace, [1.15, .034, .64], [0, .715, 0], oak, 'desk');
  box(workspace, [.75, .003, .38], [0, .734, .02], material('#abb8a8', .05, .85), 'desk-mat');
  for (const x of [-.48, .48]) for (const z of [-.23, .23]) box(workspace, [.035, .7, .035], [x, .35, z], silver);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), material('#e7ebe4', 0, 1)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; workspace.add(floor);
  // Foldable stand, interpreted from the user's product type. Final dimensions
  // and mounting points remain subject to photos and measurement.
  const angle = .26, assemblyY = .881;
  function supportY(z) { return assemblyY - Math.sin(angle) * z - .014; }
  for (const x of [-.117, .117]) {
    box(equipment, [.028, .012, .242], [x, .746, .004], silver);
    for (const z of [-.089, .092]) box(equipment, [.03, .004, .04], [x, .739, z], rubber);
    rod(equipment, [x, .755, .095], [x, supportY(-.094), -.094], .006, silver);
    rod(equipment, [x, .755, -.094], [x, supportY(.094), .094], .005, silver);
    rod(equipment, [x, supportY(-.112), -.112], [x, supportY(.11), .11], .0065, silver);
    box(equipment, [.032, .025, .008], [x, supportY(.113) + .01, .113], silver);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .021, 18), silver);
    hinge.rotation.z = Math.PI / 2; hinge.position.set(x, .804, 0); equipment.add(hinge);
  }
  rod(equipment, [-.117, .75, -.066], [.117, .75, -.066], .004, silver);
  const assembly = new THREE.Group(); assembly.name = 'laptop-fan-assembly'; assembly.position.y = assemblyY; assembly.rotation.x = angle; equipment.add(assembly);
  addLaptop(assembly); addFan(assembly);

  const resize = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage); resize(); setView('overview', true);
  for (const name of ['overview', 'bottom', 'fan']) $(`view-${name}`).addEventListener('click', () => setView(name));
  $('reset-view').addEventListener('click', () => setView(selectedView));
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); targetDuty = 0; transport?.close();
    $('scene-loading').textContent = '3D 표시가 중단되었습니다. 페이지를 새로고침해 주세요.'; $('scene-loading').hidden = false;
    $('connection-label').textContent = '3D 표시 중단'; $('connection').classList.remove('live');
  });
  $('scene-loading').hidden = true;
  let lastFrame = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - lastFrame) / 1000, .1); lastFrame = now;
    currentDuty += (targetDuty - currentDuty) * (1 - Math.exp(-7 * dt));
    // Illustrative rotation speed is deliberately not reported as measured RPM.
    rotor.rotation.y += currentDuty / 100 * 14 * dt;
    if (transitionCamera) {
      camera.position.lerp(cameraPosition, 1 - Math.exp(-8 * dt));
      controls.target.lerp(cameraTarget, 1 - Math.exp(-8 * dt));
      if (camera.position.distanceTo(cameraPosition) < .001) transitionCamera = false;
    }
    controls.update(); renderer.render(scene, camera);
  });
}

try { buildScene(); connect(); }
catch (error) { $('scene-loading').textContent = `3D 장면을 열지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요. (${error.message})`; }
$('reconnect').addEventListener('click', () => { if (renderer && rotor) connect(); });
setInterval(() => {
  if (lastCommandAt && performance.now() - lastCommandAt > STALE_MS && signal !== 'stale') {
    targetDuty = 0; signal = 'stale'; displayOutput(); report();
  }
  $('last-command').textContent = lastCommandAt ? `${Math.floor((performance.now() - lastCommandAt) / 1000)}초 전` : '—';
}, 250);
setInterval(report, 2000);
window.addEventListener('pagehide', () => transport?.close());
window.addEventListener('pageshow', event => { if (event.persisted && renderer && rotor) connect(); });
