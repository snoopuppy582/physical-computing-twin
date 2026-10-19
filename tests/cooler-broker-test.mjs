// Live integration test. Run with MQTT_MODULE_PATH pointing to an installed
// MQTT.js package directory when it is not available in Node's module path.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {connectCooler} from '../cooler-mqtt.mjs';
const require = createRequire(import.meta.url);
const mqtt = require(process.env.MQTT_MODULE_PATH || 'mqtt');
const room = `qa-${crypto.randomUUID()}`;
const result = {room, broker: 'wss://broker.emqx.io:8084/mqtt', states: [], commands: [], statuses: [], roundTripMs: null};
let viewer, control, interval, deadline;
try {
  await new Promise((resolve, reject) => {
    deadline = setTimeout(() => reject(new Error('Live MQTT timed out after 30 seconds')), 30000);
    viewer = connectCooler({room, role: 'viewer', mqttLib: mqtt,
      onState: state => result.states.push({role: 'viewer', state}),
      onCommand: message => {
        result.commands.push(message.duty);
        viewer.status({duty: message.duty, signal: 'active', ack: {device: message.device, seq: message.seq}});
      }});
    control = connectCooler({room, role: 'control', mqttLib: mqtt,
      onState: state => result.states.push({role: 'control', state}),
      onLatency: ms => { if (ms !== null) result.roundTripMs = ms; },
      onStatus: message => {
        result.statuses.push(message.duty);
        assert.equal(message.hardware, false);
        if (result.statuses.length >= 3 && result.roundTripMs !== null) resolve();
      }});
    const values = [35, 80, 0]; let i = 0;
    interval = setInterval(() => {
      if (viewer.ready && control.ready && i < values.length) control.command(values[i++]);
    }, 500);
  });
  assert.deepEqual(result.commands, [35, 80, 0]);
  assert.deepEqual(result.statuses, [35, 80, 0]);
  result.pass = true;
} catch (error) { result.pass = false; result.error = error.message; process.exitCode = 1; }
finally { clearTimeout(deadline); clearInterval(interval); viewer?.close(); control?.close(); }
console.log(JSON.stringify(result, null, 2));
