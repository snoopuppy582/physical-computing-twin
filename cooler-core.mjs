export const DEFAULT_ROOM = 'moon-2026-proposal';
export const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
export const STALE_MS = 8000;
export const PROTOCOL = 1;

export function normalizeRoom(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{3,47}$/.test(value) ? value : null;
}
export function roomFromURL(href) {
  const url = new URL(href);
  return normalizeRoom(new URLSearchParams(url.hash.slice(1)).get('room')) ||
    normalizeRoom(url.searchParams.get('room')) || DEFAULT_ROOM;
}
export function pageURL(href, page, room) {
  const url = new URL(page, href);
  url.search = '';
  url.hash = new URLSearchParams({room: normalizeRoom(room) || DEFAULT_ROOM}).toString();
  return url.href;
}
export function topics(room) {
  if (!normalizeRoom(room)) throw new Error('연결 번호를 확인해 주세요.');
  const base = `physical-computing-twin/snoopuppy582/cooler-v1/${room}`;
  return {command: `${base}/command`, status: `${base}/status`};
}
const isID = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);
const isDuty = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

export function parseMessage(raw, kind, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 1200) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || Array.isArray(value) || value.v !== PROTOCOL || value.kind !== kind ||
      !isID(value.device) || !Number.isSafeInteger(value.seq) || value.seq < 1 ||
      !Number.isSafeInteger(value.t) || Math.abs(now - value.t) > 15000) return null;
  if (kind === 'command') {
    if (!isDuty(value.duty)) return null;
    return {v: PROTOCOL, kind, device: value.device, seq: value.seq, t: value.t, duty: value.duty};
  }
  if (kind === 'status') {
    if (!isDuty(value.duty) || value.hardware !== false ||
        !['waiting', 'active', 'stale'].includes(value.signal)) return null;
    const ack = value.ack;
    if (ack !== null && (!ack || !isID(ack.device) || !Number.isSafeInteger(ack.seq) || ack.seq < 1)) return null;
    return {v: PROTOCOL, kind, device: value.device, seq: value.seq, t: value.t,
      duty: value.duty, hardware: false, signal: value.signal,
      ack: ack === null ? null : {device: ack.device, seq: ack.seq}};
  }
  return null;
}

export function makeReceiver(kind) {
  const seen = new Map();
  return {
    accept(raw, now = Date.now()) {
      const value = parseMessage(raw, kind, now);
      if (!value) return null;
      const old = seen.get(value.device);
      if (old && (value.seq <= old.seq || value.t < old.t)) return null;
      seen.delete(value.device);
      seen.set(value.device, {seq: value.seq, t: value.t});
      if (seen.size > 64) seen.delete(seen.keys().next().value);
      return value;
    }
  };
}
