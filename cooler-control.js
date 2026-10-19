import {roomFromURL, pageURL, STALE_MS} from './cooler-core.mjs';
import {connectCooler} from './cooler-mqtt.mjs';

const $ = id => document.getElementById(id);
const room = roomFromURL(location.href), viewerURL = pageURL(location.href, 'cooler.html', room);
$('viewer-link').href = viewerURL; $('brand-link').href = viewerURL; $('room-label').textContent = room;
history.replaceState(null, '', `${location.pathname}${location.search}#${new URLSearchParams({room})}`);
let transport = null, requested = 0, activated = false, lastStatusAt = 0, sent = 0, lastSentAt = 0;
let throttle = null, lastMessage = null;
const presets = [...document.querySelectorAll('[data-duty]')];
const stateLabels = {connecting: 'MQTT 연결 중', subscribing: '구독 준비 중', connected: 'MQTT 연결됨', reconnecting: 'MQTT 재연결 중', error: '연결 확인 필요'};

function send() {
  clearTimeout(throttle); throttle = null;
  const message = transport?.command(requested);
  if (!message) return;
  lastMessage = message; lastSentAt = performance.now(); sent++;
  $('sent-count').textContent = sent;
  $('send-state').textContent = '전송됨 · 수신 확인 중';
}
function request(duty) {
  requested = duty; activated = true;
  $('target-value').textContent = duty; $('duty-slider').value = duty;
  if (performance.now() - lastSentAt > 100) send();
  else { clearTimeout(throttle); throttle = setTimeout(send, 100); }
}
function connect() {
  transport?.close(); clearTimeout(throttle); throttle = null;
  activated = false; requested = 0; lastStatusAt = 0; lastMessage = null;
  $('target-value').textContent = '0'; $('duty-slider').value = '0';
  $('applied-value').textContent = '—'; $('latency-value').textContent = '—';
  $('viewer-state').textContent = '3D 장면의 연결을 기다립니다.';
  try {
    transport = connectCooler({room, role: 'control',
      onState(value) {
        const live = value === 'connected';
        $('connection-label').textContent = stateLabels[value];
        $('connection').classList.toggle('live', live); $('connection').classList.toggle('error', value === 'error');
        $('duty-slider').disabled = !live; for (const button of presets) button.disabled = !live;
        $('send-state').textContent = live ? '출력을 선택해 주세요' : '연결 준비 중';
        if (!live) {
          activated = false; lastStatusAt = 0; lastMessage = null;
          $('applied-value').textContent = '—';
          $('viewer-state').textContent = '브로커 연결을 기다립니다.';
        }
      },
      onStatus(message) {
        lastStatusAt = performance.now();
        $('applied-value').textContent = `${Math.round(message.duty)}%`;
        const matched = lastMessage && message.ack?.device === transport.device && message.ack.seq >= lastMessage.seq;
        if (matched) $('send-state').textContent = '3D 장면 수신 확인';
        $('viewer-state').textContent = message.signal === 'active' ?
          (message.duty ? '가상 팬에 반영되었습니다.' : '가상 팬이 정지했습니다.') :
          message.signal === 'stale' ? '입력 대기로 전환되어 가상 팬이 정지했습니다.' : '3D 장면이 연결되었습니다. 출력을 선택해 주세요.';
      },
      onLatency(ms) { $('latency-value').textContent = ms === null ? '—' : `${ms} ms`; }
    });
  } catch (error) { $('connection-label').textContent = '연결 확인 필요'; $('viewer-state').textContent = error.message; }
}
$('duty-slider').addEventListener('input', event => request(Number(event.target.value)));
$('duty-slider').addEventListener('change', () => { if (activated) send(); });
for (const button of presets) button.addEventListener('click', () => request(Number(button.dataset.duty)));
$('reconnect').addEventListener('click', connect);
// Refresh the selected output while this controller is open. Loss of this
// heartbeat makes the viewer stop after eight seconds, even at steady output.
setInterval(() => { if (activated && transport?.ready) send(); }, 2000);
setInterval(() => {
  if (lastStatusAt && performance.now() - lastStatusAt > STALE_MS) {
    $('applied-value').textContent = '—'; $('latency-value').textContent = '—';
    $('viewer-state').textContent = '3D 장면의 응답이 없습니다. 장면 페이지를 확인해 주세요.';
    $('send-state').textContent = '전송 중 · 장면 응답 대기';
  } else if (!lastStatusAt && activated) $('viewer-state').textContent = '3D 장면의 응답을 기다립니다. 장면 페이지도 열어 주세요.';
}, 500);
window.addEventListener('pagehide', () => { transport?.command(0); transport?.close(); });
window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
connect();
