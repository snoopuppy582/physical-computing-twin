// Browser-local pub/sub using the class sensor payload. No network broker is contacted.
export const SENSOR_TOPIC = 'khu/pcomp/cafe-door/sensor';

export function createSensorSimulation({ angleAt, onMessage }) {
  const bus = new EventTarget();
  let nextSample = 1;
  let received = 0;
  let latest = null;
  const receive = event => {
    if (event.detail.topic !== SENSOR_TOPIC) return;
    let payload;
    try { payload = JSON.parse(event.detail.message); } catch { return; }
    if (!Number.isFinite(payload.beta) || payload.simulated !== true) return;
    latest = payload;
    received += 1;
    onMessage(payload, received);
  };
  bus.addEventListener('message', receive);
  return {
    publishUntil(seconds) {
      const sample = Math.min(100, Math.floor((seconds + 1e-8) * 10));
      while (nextSample <= sample) {
        const elapsed = nextSample / 10;
        const payload = {
          device: 'cafe-door', simulated: true, seq: nextSample,
          beta: Number(angleAt(elapsed).toFixed(2)), gamma: 0,
          elapsed, t: Date.now()
        };
        nextSample += 1;
        bus.dispatchEvent(new CustomEvent('message', {
          detail: { topic: SENSOR_TOPIC, message: JSON.stringify(payload) }
        }));
      }
    },
    reset() { nextSample = 1; received = 0; latest = null; },
    get received() { return received; },
    get latest() { return latest; },
    dispose() { bus.removeEventListener('message', receive); }
  };
}
