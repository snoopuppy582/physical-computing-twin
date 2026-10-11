// Quaternion-only attitude state and transport. Euler angles are display-only.
export const RELEASE = '1011-q2';
export const PROTOCOL_VERSION = 2;
export const BROKERS = Object.freeze({
  emqx: { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' }
});
export const DISPLAY_RANGES = Object.freeze({ pitch: 90, yaw: 180, roll: 180 });
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const deg = value => value * Math.PI / 180;
export const rad = value => value * 180 / Math.PI;
export function normalizeRoom(value = '') {
  const room = String(value).replace(/[\s-]/g, '').toLowerCase();
  return /^[a-f0-9]{12}$/.test(room) ? room : null;
}
export function makeRoom() { return [...crypto.getRandomValues(new Uint8Array(6))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
export function formatRoom(room) { return room.toUpperCase().replace(/(.{6})(.{6})/, '$1-$2'); }
export function sessionFromHash(hash) {
  const p=new URLSearchParams(hash.replace(/^#/,''));
  return {room:normalizeRoom(p.get('room')||''),broker:Object.hasOwn(BROKERS,p.get('broker'))?p.get('broker'):'emqx'};
}
export function sessionHash(room,broker) { return new URLSearchParams({room,broker}).toString(); }
export function phoneURL(base,room,broker) { const u=new URL('phone.html',base);u.search=`?v=${RELEASE}`;u.hash=sessionHash(room,broker);return u.href; }
export function topics(room) {
  if(!normalizeRoom(room)) throw new Error('Invalid room');
  // Keep already-open angle-based clients off the new protocol's channels.
  const base=`khu/pcomp/flight-${room}/v${PROTOCOL_VERSION}`;
  return {pose:`${base}/pose`,ping:`${base}/ping`,pong:`${base}/pong`};
}
export function normalizeQuaternion(q) {
  if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite))return null;
  const length=Math.hypot(...q);
  if(!Number.isFinite(length)||length<1e-8||length>1e8)return null;
  return q.map(value=>value/length);
}
export function quaternionFields(q) {
  const unit=normalizeQuaternion(q);
  return unit?{qx:unit[0],qy:unit[1],qz:unit[2],qw:unit[3]}:null;
}
export function poseQuaternion(pose) {return normalizeQuaternion([pose?.qx,pose?.qy,pose?.qz,pose?.qw]);}
export function multiply(a,b) {
  return [a[0]*b[3]+a[3]*b[0]+a[1]*b[2]-a[2]*b[1],a[1]*b[3]+a[3]*b[1]+a[2]*b[0]-a[0]*b[2],a[2]*b[3]+a[3]*b[2]+a[0]*b[1]-a[1]*b[0],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
}
export function orientationQuaternion({alpha=0,beta,gamma},screenAngle=0) {
  if(![beta,gamma,screenAngle].every(Number.isFinite)) return null;
  const x=deg(beta)/2,y=deg(Number.isFinite(alpha)?alpha:0)/2,z=-deg(gamma)/2;
  const c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);
  const q=[s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3-s1*s2*c3,c1*c2*c3+s1*s2*s3];
  const a=-deg(screenAngle)/2;
  return normalizeQuaternion(multiply(q,[0,0,Math.sin(a),Math.cos(a)]));
}
export function relativeQuaternion(current,reference) {
  const c=normalizeQuaternion(current),r=normalizeQuaternion(reference);
  if(!c||!r)return null;
  return normalizeQuaternion(multiply([-r[0],-r[1],-r[2],r[3]],c));
}
// Integrate a local angular-velocity vector, not three absolute Euler angles.
export function integrateLocalRotation(current,degreesPerSecond,seconds) {
  const q=normalizeQuaternion(current);
  if(!q||!Array.isArray(degreesPerSecond)||degreesPerSecond.length!==3||!degreesPerSecond.every(Number.isFinite)||!Number.isFinite(seconds)||seconds<0)return null;
  const speed=Math.hypot(...degreesPerSecond);
  if(speed===0||seconds===0)return q;
  const half=deg(speed)*seconds/2,s=Math.sin(half)/speed;
  return normalizeQuaternion(multiply(q,[degreesPerSecond[0]*s,degreesPerSecond[1]*s,degreesPerSecond[2]*s,Math.cos(half)]));
}
// A read-only projection for gauges. Never feed these angles back into control.
export function displayAngles(quaternion) {
  const q=normalizeQuaternion(quaternion);if(!q)return null;
  const [x,y,z,w]=q;
  const m11=1-2*(y*y+z*z),m13=2*(x*z+y*w),m21=2*(x*y+z*w),m22=1-2*(x*x+z*z),m23=2*(y*z-x*w),m31=2*(x*z-y*w),m33=1-2*(x*x+y*y);
  const result={pitch:rad(Math.asin(-clamp(m23,-1,1))),yaw:rad(Math.abs(m23)<.9999999?Math.atan2(m13,m33):Math.atan2(-m31,m11)),roll:rad(Math.abs(m23)<.9999999?Math.atan2(m21,m22):0)};
  for(const k of Object.keys(result))result[k]=Math.round(result[k]*10)/10||0;
  return result;
}
export function parsePose(raw) {
  if(typeof raw!=='string'||raw.length>1600) return null;
  let d;try{d=JSON.parse(raw);}catch{return null;}
  if(!d||typeof d!=='object'||Array.isArray(d)||d.v!==PROTOCOL_VERSION||['rx','ry','rz'].some(k=>Object.hasOwn(d,k)))return null;
  const q=poseQuaternion(d);if(!q)return null;
  if(d.seq!==undefined&&(!Number.isSafeInteger(d.seq)||d.seq<0))return null;
  if(d.device!==undefined&&(typeof d.device!=='string'||!/^[a-z0-9-]{1,48}$/i.test(d.device)))return null;
  return {v:PROTOCOL_VERSION,...quaternionFields(q),source:d.source==='sensor'?'sensor':'manual',device:d.device||'external',seq:d.seq,t:Number.isFinite(d.t)?d.t:null};
}
export function makeReceiver() {
  const sequences=new Map();let previous=null;
  return {accept(raw){
    const d=parsePose(raw);if(!d)return null;
    if(d.seq!==undefined){if(sequences.has(d.device)&&d.seq<=sequences.get(d.device))return null;if(!sequences.has(d.device)&&sequences.size>=32)sequences.delete(sequences.keys().next().value);sequences.set(d.device,d.seq);}
    let q=poseQuaternion(d);
    // q and -q describe the same attitude. Keep consecutive samples on the
    // same hemisphere, including while crossing 180 degrees.
    if(previous&&q.reduce((dot,value,i)=>dot+value*previous[i],0)<0)q=q.map(value=>-value);
    previous=q;return {...d,...quaternionFields(q)};
  }};
}
