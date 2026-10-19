import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import {DEFAULT_ROOM, roomFromURL, pageURL, topics, parseMessage, makeReceiver} from '../cooler-core.mjs';
import {connectCooler} from '../cooler-mqtt.mjs';

const command = (overrides = {}) => ({v: 1, kind: 'command', device: 'control-test', seq: 1, t: Date.now(), duty: 65, ...overrides});
test('Submission URLs share a default room; explicit room stays on the paired page', () => {
  assert.equal(roomFromURL('https://example.org/cooler.html'), DEFAULT_ROOM);
  assert.equal(roomFromURL('https://example.org/twin-control.html'), DEFAULT_ROOM);
  assert.equal(roomFromURL('https://example.org/?room=other-room#room=custom-room'), 'custom-room');
  assert.equal(roomFromURL('https://example.org/#room=../../x'), DEFAULT_ROOM);
  const target = pageURL('https://example.org/course/cooler.html?v=old#room=abcde', 'twin-control.html', 'custom-room');
  assert.equal(target, 'https://example.org/course/twin-control.html#room=custom-room');
  assert.throws(() => topics('../#'), /연결 번호/);
});
test('Reject invalid, non-finite, old and future messages instead of coercing values', () => {
  assert.equal(parseMessage(JSON.stringify(command()), 'command').duty, 65);
  for (const invalid of [null, [], {}, command({v: 2}), command({duty: '65'}), command({duty: 101}), command({duty: -1}), command({seq: .5}), command({device: 'a/#'}), command({t: Date.now() - 16000}), command({t: Date.now() + 16000})]) {
    assert.equal(parseMessage(JSON.stringify(invalid), 'command'), null);
  }
  assert.equal(parseMessage('{"v":1,"kind":"command","duty":1e999}', 'command'), null);
  assert.equal(parseMessage('x'.repeat(1201), 'command'), null);
});
test('Sequence filtering rejects duplicates and delayed messages per device', () => {
  const receiver = makeReceiver('command'), original = command();
  assert.ok(receiver.accept(JSON.stringify(original)));
  assert.equal(receiver.accept(JSON.stringify(original)), null);
  assert.equal(receiver.accept(JSON.stringify({...original, seq: 2, t: original.t - 1})), null);
  assert.ok(receiver.accept(JSON.stringify({...original, seq: 2})));
  assert.ok(receiver.accept(JSON.stringify({...original, device: 'new-controller'})));
});
test('Only virtual status, with a valid matching acknowledgment, is accepted', () => {
  const status = {v: 1, kind: 'status', device: 'viewer-test', seq: 1, t: Date.now(), duty: 65,
    signal: 'active', hardware: false, ack: {device: 'control-test', seq: 3}};
  assert.ok(parseMessage(JSON.stringify(status), 'status'));
  for (const bad of [{hardware: true}, {signal: 'invented'}, {ack: {}}, {duty: '65'}]) {
    assert.equal(parseMessage(JSON.stringify({...status, ...bad}), 'status'), null);
  }
});
function harness(role) {
  const client = new EventEmitter(), publications = [], states = [], received = [];
  client.connected = false;
  client.subscribe = (topic, options, callback) => callback(null, [{topic, qos: 0}]);
  client.publish = (topic, body, options) => publications.push({topic, body: JSON.parse(body), options});
  client.end = () => { client.connected = false; };
  const transport = connectCooler({room: 'test-room', role, mqttLib: {connect: () => client},
    onState: value => states.push(value), onCommand: value => received.push(value)});
  return {client, publications, states, received, transport,
    connect() { client.connected = true; client.emit('connect'); }};
}
test('Transport uses MQTT publication, never retains output and clears readiness on disconnect', () => {
  const h = harness('control');
  assert.equal(h.transport.command(65), false);
  h.connect(); assert.equal(h.transport.ready, true);
  assert.equal(h.transport.command(65).duty, 65);
  assert.equal(h.publications[0].options.retain, false);
  assert.equal(h.publications[0].topic, topics('test-room').command);
  assert.equal(h.transport.command(NaN), false);
  h.client.emit('offline'); assert.equal(h.transport.ready, false);
  assert.equal(h.transport.command(0), false);
  h.transport.close();
});
test('Retained payloads and wrong topics cannot animate the scene', () => {
  const h = harness('viewer'); h.connect();
  const bytes = Buffer.from(JSON.stringify(command()));
  h.client.emit('message', topics('test-room').command, bytes, {retain: true});
  h.client.emit('message', 'wrong-topic', bytes, {retain: false});
  assert.equal(h.received.length, 0);
  h.client.emit('message', topics('test-room').command, bytes, {retain: false});
  assert.equal(h.received.length, 1); h.transport.close();
});
