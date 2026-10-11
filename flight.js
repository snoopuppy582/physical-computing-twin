import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {BROKERS,makeRoom,formatRoom,sessionFromHash,sessionHash,phoneURL,poseQuaternion,displayAngles,DISPLAY_RANGES} from './flight-core.mjs?v=1011-q2';
import {connectFlight} from './flight-mqtt.mjs?v=1011-q2';

const $=id=>document.getElementById(id);
const stage=$('flight-stage'),loading=$('scene-loading');
let session=sessionFromHash(location.hash),transport=null,modelReady=false,lastPoseAt=0,received=0;
let lastSource='sensor',timer=null,toastTimeout;
try{if(!session.room)session.room=sessionFromHash(sessionStorage.getItem('flight-session')||'').room;}catch{}
if(!session.room)session.room=makeRoom();

function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,3500);}
function syncSession(){
  const hash=sessionHash(session.room,session.broker);
  history.replaceState(null,'',`${location.pathname}${location.search}#${hash}`);
  try{sessionStorage.setItem('flight-session',hash);}catch{}
  $('room-code').textContent=formatRoom(session.room);
  $('broker-name').textContent=`${BROKERS[session.broker].name} · 공개`;
  const link=phoneURL(location.href,session.room,session.broker);
  const manual=new URL(link);manual.searchParams.set('mode','manual');$('manual-link').href=manual.href;
  try{
    const qr=globalThis.qrcode(0,'M');qr.addData(link,'Byte');qr.make();
    $('pairing-qr').innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true,alt:'스마트폰 연결 QR'});
  }catch{$('pairing-qr').textContent='QR을 불러오지 못했습니다. 연결 링크를 복사해 주세요.';}
}
function updatePose(pose){
  const q=poseQuaternion(pose);if(!q)return;
  targetQuaternion.fromArray(q);
  const angles=displayAngles(q);
  lastSource=pose.source;lastPoseAt=performance.now();received++;
  $('received-count').textContent=String(received);
  for(const name of ['roll','pitch','yaw']){
    const value=angles[name];$(name+'-value').textContent=value.toFixed(1);
    const amount=value/DISPLAY_RANGES[name]*50;$(name+'-meter').style.left=`${50+Math.min(0,amount)}%`;$(name+'-meter').style.width=`${Math.abs(amount)}%`;
  }
  $('source-label').textContent=pose.source==='sensor'?'PHONE SENSOR / LIVE':'MQTT CONTROL / LIVE';
  $('input-name').textContent=pose.source==='sensor'?'휴대폰 센서':'제어판';
}
function connect(){
  transport?.close();transport=null;lastPoseAt=0;received=0;$('received-count').textContent='0';
  $('input-name').textContent='대기';$('source-label').textContent='입력 대기';
  abortTimer('다시 연결한 뒤 측정해 주세요.');syncSession();
  try{
    transport=connectFlight({...session,role:'viewer',onPose:updatePose,
      onState(state){
        const live=state==='connected';
        $('broker-pill').classList.toggle('is-live',live);$('broker-pill').classList.toggle('is-error',state==='error');
        $('broker-state').textContent=live?'MQTT 연결됨':state==='error'?'MQTT 연결 확인':state==='reconnecting'?'MQTT 재연결 중':'MQTT 연결 중';
      },
      onLatency(ms){$('latency-value').textContent=ms===null?'—':`${ms} ms`;}
    });
  }catch(e){$('broker-state').textContent='연결 오류';toast(e.message);}
}

let renderer,scene,camera,controls,aircraft;
const targetQuaternion=new THREE.Quaternion();
function resetCamera(){
  if(!camera||!controls)return;
  const distance=8.7/Math.min(1,camera.aspect);
  camera.position.copy(new THREE.Vector3(.52,.28,1).normalize().multiplyScalar(distance));
  controls.target.set(0,0,0);controls.update();
}
async function buildScene(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.domElement.setAttribute('aria-label','MQTT 메시지에 따라 자세가 변하는 3D 비행기');stage.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#94c1e1');
  camera=new THREE.PerspectiveCamera(40,1,.1,100);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=5;controls.maxDistance=20;
  controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI*.72;
  scene.add(new THREE.HemisphereLight(0xe5f4ff,0x53718c,1.4));
  const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(4,8,5);scene.add(sun);
  aircraft=new THREE.Group();scene.add(aircraft);
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(stage);resize();resetCamera();
  const skyPromise=new HDRLoader().loadAsync('assets/flight/sky.hdr').then(texture=>{
    texture.mapping=THREE.EquirectangularReflectionMapping;
    scene.background=texture;scene.environment=texture;
    scene.backgroundRotation.y=1.15;scene.environmentRotation.y=1.15;scene.environmentIntensity=.55;
  }).catch(()=>toast('하늘 배경을 불러오지 못해 기본 하늘로 표시합니다.'));
  const gltf=await new GLTFLoader().loadAsync('assets/flight/airplane.glb');
  const model=gltf.scene;
  model.traverse(node=>{if(/^Wheel/.test(node.name))node.visible=false;});
  const body=model.getObjectByName('Airplane1')||model;
  const box=new THREE.Box3().setFromObject(body),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const normalized=new THREE.Group();normalized.add(model);normalized.scale.setScalar(4.7/Math.max(size.x,size.y,size.z));
  normalized.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI); // +Z nose → -Z.
  aircraft.add(normalized);await skyPromise;
  modelReady=true;loading.hidden=true;
  let last=performance.now();
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.1);last=now;
    aircraft.quaternion.slerp(targetQuaternion,1-Math.exp(-14*dt));
    controls.update();renderer.render(scene,camera);
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();modelReady=false;loading.hidden=false;loading.textContent='3D 화면이 중단되었습니다. 페이지를 새로고침해 주세요.';});
}

function abortTimer(message){if(!timer)return;clearInterval(timer.interval);timer=null;$('timer-note').textContent=message;$('timer-start').textContent='다시 측정';}
$('timer-start').addEventListener('click',()=>{
  if(timer||!transport?.ready||performance.now()-lastPoseAt>1800)return;
  const started=performance.now(),firstCount=received;
  $('timer-start').textContent='측정 중';$('timer-note').textContent='폰을 좌우·앞뒤로 천천히 기울여 주세요.';
  timer={interval:setInterval(()=>{
    const elapsed=Math.min(10,(performance.now()-started)/1000);
    $('timer-value').textContent=`${elapsed.toFixed(1).padStart(4,'0')} s`;$('timer-progress').value=elapsed;
    if(!transport?.ready||performance.now()-lastPoseAt>1800){abortTimer('신호가 끊겼습니다. 연결 후 다시 측정해 주세요.');return;}
    if(elapsed>=10){abortTimer(`10초 완료 · 메시지 ${received-firstCount}회 수신`);}
  },50)};
});
setInterval(()=>{
  const active=lastPoseAt>0&&performance.now()-lastPoseAt<1800&&transport?.ready;
  $('signal-state').classList.toggle('is-live',Boolean(active));
  $('signal-label').textContent=active?(lastSource==='sensor'?'휴대폰 센서 수신 중':'제어판 메시지 수신 중'):lastPoseAt?'입력 신호 없음 · 마지막 자세 유지':'스마트폰을 연결해 주세요.';
  if(!active){$('latency-value').textContent='—';if(lastPoseAt)$('source-label').textContent='INPUT / PAUSED';}
  $('timer-start').disabled=!active||!modelReady||Boolean(timer);
},250);
$('new-session').addEventListener('click',()=>{session.room=makeRoom();connect();toast('새 QR을 휴대폰으로 찍어 주세요.');});
$('reconnect').addEventListener('click',connect);
$('copy-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(phoneURL(location.href,session.room,session.broker));toast('휴대폰 연결 링크를 복사했습니다.');}
  catch{toast('복사 권한이 없습니다. QR 또는 연결 번호를 사용해 주세요.');}
});
$('reset-camera').addEventListener('click',resetCamera);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('브라우저에서 F11을 눌러 전체 화면으로 볼 수 있습니다.');}});
window.addEventListener('hashchange',()=>{const next=sessionFromHash(location.hash);if(next.room&&(next.room!==session.room||next.broker!==session.broker)){session=next;connect();}});
window.addEventListener('pagehide',()=>transport?.close());
window.addEventListener('pageshow',event=>{if(event.persisted)connect();});
connect();
buildScene().catch(error=>{loading.hidden=false;loading.textContent='3D 장면을 불러오지 못했습니다. 새로고침하거나 Chrome의 그래픽 가속 설정을 확인해 주세요.';console.error('Flight scene:',error);});
