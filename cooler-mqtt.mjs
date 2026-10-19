import {BROKER_URL, PROTOCOL, topics, makeReceiver} from './cooler-core.mjs';

// Both pages exchange messages through EMQX over WebSocket MQTT.
// This transport controls the virtual scene only; there is no hardware output.
export function connectCooler({room, role, onState = () => {}, onCommand = () => {},
  onStatus = () => {}, onLatency = () => {}, mqttLib = globalThis.mqtt}) {
  if (!['viewer', 'control'].includes(role)) throw new Error('페이지 역할이 올바르지 않습니다.');
  if (!mqttLib?.connect) throw new Error('MQTT를 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
  const channel = topics(room), device = `${role}-${crypto.randomUUID()}`;
  const receiver = makeReceiver(role === 'viewer' ? 'command' : 'status');
  let ready = false, ended = false, sequence = 0;
  const pending = new Map();
  const client = mqttLib.connect(BROKER_URL, {
    clientId: `cooler-${device}`, clean: true, keepalive: 20,
    reconnectPeriod: 2000, connectTimeout: 10000, queueQoSZero: false, resubscribe: false
  });
  function state(value) { ready = value === 'connected'; if (!ended) onState(value); }
  client.on('connect', () => {
    if (ended) return;
    state('subscribing');
    client.subscribe(role === 'viewer' ? channel.command : channel.status, {qos: 0}, (error, granted) => {
      if (ended || !client.connected) return;
      if (error || !granted?.length || granted.some(item => item.qos === 128)) { state('error'); return; }
      state('connected');
    });
  });
  client.on('message', (topic, bytes, packet) => {
    if (!ready || ended || packet?.retain || bytes.length > 1200 ||
        topic !== (role === 'viewer' ? channel.command : channel.status)) return;
    const message = receiver.accept(bytes.toString());
    if (!message) return;
    if (role === 'viewer') onCommand(message);
    else {
      const ack = message.ack;
      if (ack?.device === device && pending.has(ack.seq)) {
        onLatency(Math.round(performance.now() - pending.get(ack.seq)));
        for (const seq of pending.keys()) if (seq <= ack.seq) pending.delete(seq);
      }
      onStatus(message);
    }
  });
  for (const event of ['offline', 'close', 'reconnect']) client.on(event, () => {
    pending.clear(); onLatency(null); state('reconnecting');
  });
  client.on('error', () => state('error'));
  onState('connecting');
  function publish(kind, value) {
    if (!ready || ended || !client.connected) return false;
    const message = {v: PROTOCOL, kind, device, seq: ++sequence, t: Date.now(), ...value};
    if (kind === 'command') {
      pending.set(message.seq, performance.now());
      for (const [seq, time] of pending) if (performance.now() - time > 15000) pending.delete(seq);
    }
    client.publish(channel[kind], JSON.stringify(message), {qos: 0, retain: false});
    return message;
  }
  return {
    get ready() { return ready && !ended && client.connected; },
    get device() { return device; },
    command(duty) {
      if (role !== 'control' || typeof duty !== 'number' || !Number.isFinite(duty) || duty < 0 || duty > 100) return false;
      return publish('command', {duty});
    },
    status({duty, signal, ack = null}) {
      if (role !== 'viewer') return false;
      return publish('status', {duty, signal, ack, hardware: false});
    },
    close() { ended = true; ready = false; pending.clear(); client.end(true); }
  };
}
