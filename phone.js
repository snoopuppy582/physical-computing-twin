import {BROKERS,normalizeRoom,formatRoom,sessionFromHash,sessionHash,orientationQuaternion,relativeQuaternion,integrateLocalRotation,displayAngles} from './flight-core.mjs?v=1011-q2';
import {connectFlight} from './flight-mqtt.mjs?v=1011-q2';

const $=id=>document.getElementById(id);
let session=sessionFromHash(location.hash),mode='sensor',transport=null,running=false,starting=false,generation=0;
let latest=null,reference=null,sent=0,timer=null,sensorTimeout=null,wakeLock=null;
let manualQuaternion=[0,0,0,1],manualAt=0;
const screenAngle=()=>screen.orientation?.angle||0;
const stateText={connecting:'MQTT 연결 중',subscribing:'연결 준비 중',connected:'전송 중',reconnecting:'MQTT 재연결 중',error:'연결 확인 필요'};
function notice(text=''){$('phone-notice').textContent=text;$('phone-notice').hidden=!text;}
function status(text,live=false){$('phone-state').textContent=text;$('phone-status').classList.toggle('is-live',live);$('phone-pill').classList.toggle('is-live',live);}
function updateSession(){
  $('phone-broker').textContent=BROKERS[session.broker].name;
  $('room-entry').hidden=Boolean(session.room);$('start-sensor').disabled=!session.room;
  $('phone-room').textContent=session.room?formatRoom(session.room):'QR로 연결해 주세요.';
  if(session.room)history.replaceState(null,'',`${location.pathname}${location.search}#${sessionHash(session.room,session.broker)}`);
}
function manualRates(){return [+$('manual-pitch').value,+$('manual-yaw').value,+$('manual-roll').value];}
function haltManual(){for(const name of ['roll','pitch','yaw']){$('manual-'+name).value='0';$('manual-'+name+'-value').textContent='0°/s';}}
function displayPose(quaternion){
  const angles=displayAngles(quaternion);if(!angles)return;
  $('phone-roll').textContent=angles.roll.toFixed(1);$('phone-pitch').textContent=angles.pitch.toFixed(1);$('phone-yaw').textContent=angles.yaw.toFixed(1);
  $('attitude-world').style.transform=`rotate(${-angles.roll}deg) translateY(${angles.pitch*1.1}px)`;
}
function onOrientation(event){
  if(!running||mode!=='sensor')return;
  const q=orientationQuaternion({alpha:event.alpha,beta:event.beta,gamma:event.gamma},screenAngle());
  if(!q)return;
  latest={q,at:performance.now()};
  if(!reference)reference=q;
  clearTimeout(sensorTimeout);$('calibrate').disabled=false;notice();
}
function recalibrate(){
  if(mode==='manual'){
    haltManual();manualQuaternion=[0,0,0,1];manualAt=performance.now();displayPose(manualQuaternion);
  }else if(latest){reference=latest.q;displayPose([0,0,0,1]);notice();}
}
function screenChanged(){reference=null;latest=null;if(running&&mode==='sensor'){notice('화면 방향이 바뀌어 기준 자세를 다시 맞춥니다.');$('calibrate').disabled=true;}}
function transmit(){
  if(!running)return;
  let quaternion;
  if(mode==='sensor'){
    // Some browsers emit orientation only when it changes. Keep publishing the
    // last measured attitude while this page is visible, including at rest.
    if(!latest||!reference){status('센서 신호 대기');$('calibrate').disabled=true;return;}
    quaternion=relativeQuaternion(latest.q,reference);
  }else{
    const now=performance.now(),dt=Math.min((now-manualAt)/1000,.25);manualAt=now;
    manualQuaternion=integrateLocalRotation(manualQuaternion,manualRates(),dt);quaternion=manualQuaternion;
  }
  if(!quaternion)return;
  displayPose(quaternion);
  if(transport?.send(quaternion,mode==='sensor'?'sensor':'manual')){sent++;$('sent-count').textContent=String(sent);status(mode==='sensor'?'센서 전송 중':'제어판 전송 중',true);}
}
async function keepAwake(){try{if(navigator.wakeLock&&!document.hidden)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
function stop(message='전송 중지'){
  generation++;running=false;starting=false;
  clearInterval(timer);timer=null;clearTimeout(sensorTimeout);
  window.removeEventListener('deviceorientation',onOrientation);
  screen.orientation?.removeEventListener('change',screenChanged);
  transport?.close();transport=null;
  wakeLock?.release().catch(()=>{});wakeLock=null;
  latest=null;reference=null;haltManual();
  $('start-sensor').hidden=false;$('start-sensor').disabled=!session.room;$('stop-sensor').hidden=true;$('calibrate').disabled=true;
  status(message);
}
async function start(){
  if(running||starting||!session.room)return;
  starting=true;const token=++generation;$('start-sensor').disabled=true;notice();
  if(mode==='sensor'){
    if(!window.isSecureContext){stop('HTTPS 접속 필요');notice('센서 화면은 GitHub Pages의 HTTPS 주소로 열어 주세요.');return;}
    if(typeof window.DeviceOrientationEvent==='undefined'){stop('센서 지원 확인');notice('휴대폰 Chrome으로 QR을 다시 열어 주세요. PC에서는 직접 조작을 사용할 수 있습니다.');return;}
    try{
      if(typeof window.DeviceOrientationEvent.requestPermission==='function'){
        const answer=await window.DeviceOrientationEvent.requestPermission();
        if(token!==generation)return;
        if(answer!=='granted'){stop('센서 권한 필요');notice('동작 및 방향 접근 권한을 허용한 뒤 다시 시작해 주세요.');return;}
      }
    }catch{if(token===generation){stop('센서 권한 확인');notice('브라우저의 동작·방향 센서 권한을 확인해 주세요.');}return;}
  }
  if(token!==generation)return;
  running=true;starting=false;latest=null;reference=null;sent=0;$('sent-count').textContent='0';
  manualAt=performance.now();
  $('start-sensor').hidden=true;$('stop-sensor').hidden=false;$('calibrate').disabled=mode!=='manual';
  if(mode==='sensor'){
    window.addEventListener('deviceorientation',onOrientation);
    screen.orientation?.addEventListener('change',screenChanged);
    sensorTimeout=setTimeout(()=>{if(!latest&&running){status('센서 값이 오지 않습니다');notice('Chrome 설정 → 사이트 설정 → 동작 센서를 허용하고, 화면을 켠 채 폰을 조금 움직여 주세요.');}},5000);
  }
  try{
    transport=connectFlight({...session,role:'sender',onState(state){
      if(token!==generation)return;
      const live=state==='connected';status(live&&mode==='sensor'&&!latest?'센서 신호 대기':stateText[state],live&&mode==='manual');
    }});
    timer=setInterval(transmit,100);keepAwake();
  }catch(error){stop('연결 오류');notice(error.message);}
}
function setMode(next){
  stop('시작 전');mode=next;notice();
  $('sensor-tab').setAttribute('aria-selected',String(mode==='sensor'));$('manual-tab').setAttribute('aria-selected',String(mode==='manual'));
  $('sensor-panel').hidden=mode!=='sensor';$('manual-panel').hidden=mode!=='manual';
  $('start-sensor').textContent=mode==='sensor'?'센서 시작':'제어판 연결';$('calibrate').textContent=mode==='sensor'?'기준 자세 설정':'수평으로';
}
$('start-sensor').addEventListener('click',start);$('stop-sensor').addEventListener('click',()=>stop());$('calibrate').addEventListener('click',recalibrate);
$('sensor-tab').addEventListener('click',()=>setMode('sensor'));$('manual-tab').addEventListener('click',()=>setMode('manual'));
for(const name of ['roll','pitch','yaw'])$('manual-'+name).addEventListener('input',()=>{$('manual-'+name+'-value').textContent=$('manual-'+name).value+'°/s';});
$('manual-halt').addEventListener('click',haltManual);
$('join-room').addEventListener('click',()=>{const room=normalizeRoom($('room-input').value);if(!room){notice('컴퓨터 화면의 연결 번호 12자리를 입력해 주세요.');return;}session.room=room;notice();updateSession();});
window.addEventListener('hashchange',()=>{stop();session=sessionFromHash(location.hash);updateSession();});
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&mode==='sensor'){stop('전송이 일시 중지되었습니다');notice('다시 센서 시작을 눌러 조종을 이어가세요.');}});
updateSession();
if(new URLSearchParams(location.search).get('mode')==='manual')setMode('manual');
