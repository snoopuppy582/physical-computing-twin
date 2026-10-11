// Course phone-pose / mqtt-pose-twin conventions, with relative calibration.
export const BROKERS = Object.freeze({
  emqx: { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' }
});
export const LIMITS = Object.freeze({ rx: 35, ry: 55, rz: 55 });
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
export function phoneURL(base,room,broker) { const u=new URL('phone.html',base);u.search='';u.hash=sessionHash(room,broker);return u.href; }
export function topics(room) {
  if(!normalizeRoom(room)) throw new Error('Invalid room');
  const base=`khu/pcomp/flight-${room}`;
  return {pose:`${base}/pose`,ping:`${base}/ping`,pong:`${base}/pong`};
}
// Relative quaternions avoid jumps when the phone passes beta=90 degrees.
export function multiply(a,b) {
  return [a[0]*b[3]+a[3]*b[0]+a[1]*b[2]-a[2]*b[1],a[1]*b[3]+a[3]*b[1]+a[2]*b[0]-a[0]*b[2],a[2]*b[3]+a[3]*b[2]+a[0]*b[1]-a[1]*b[0],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
}
export function orientationQuaternion({alpha=0,beta,gamma},screenAngle=0) {
  if(![beta,gamma,screenAngle].every(Number.isFinite)) return null;
  const x=deg(beta)/2,y=deg(Number.isFinite(alpha)?alpha:0)/2,z=-deg(gamma)/2;
  const c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);
  const q=[s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3-s1*s2*c3,c1*c2*c3+s1*s2*s3];
  const a=-deg(screenAngle)/2;
  return multiply(q,[0,0,Math.sin(a),Math.cos(a)]);
}
export function relativePose(current,reference) {
  const [x,y,z,w]=multiply([-reference[0],-reference[1],-reference[2],reference[3]],current);
  const m11=1-2*(y*y+z*z),m13=2*(x*z+y*w),m21=2*(x*y+z*w),m22=1-2*(x*x+z*z),m23=2*(y*z-x*w),m31=2*(x*z-y*w),m33=1-2*(x*x+y*y);
  const result={rx:rad(Math.asin(-clamp(m23,-1,1))),ry:rad(Math.abs(m23)<.9999999?Math.atan2(m13,m33):Math.atan2(-m31,m11)),rz:rad(Math.abs(m23)<.9999999?Math.atan2(m21,m22):0)};
  for(const k of Object.keys(result)) result[k]=Math.abs(result[k])<.35?0:Math.round(clamp(result[k],-LIMITS[k],LIMITS[k])*10)/10;
  return result;
}
export function parsePose(raw) {
  if(typeof raw!=='string'||raw.length>1600) return null;
  let d;try{d=JSON.parse(raw);}catch{return null;}
  if(!d||typeof d!=='object'||Array.isArray(d)||!['rx','ry','rz'].some(k=>Object.hasOwn(d,k))) return null;
  const pose={};
  for(const k of ['rx','ry','rz']) {if(!Object.hasOwn(d,k))continue;if(!Number.isFinite(d[k]))return null;pose[k]=clamp(d[k],-LIMITS[k],LIMITS[k]);}
  if(d.seq!==undefined&&(!Number.isSafeInteger(d.seq)||d.seq<0))return null;
  if(d.device!==undefined&&(typeof d.device!=='string'||!/^[a-z0-9-]{1,48}$/i.test(d.device)))return null;
  return {...pose,source:d.source==='sensor'?'sensor':'manual',device:d.device||'external',seq:d.seq,t:Number.isFinite(d.t)?d.t:null};
}
export function makeReceiver() {
  const sequences=new Map();let pose={rx:0,ry:0,rz:0};
  return {accept(raw){const d=parsePose(raw);if(!d)return null;if(d.seq!==undefined){if(sequences.has(d.device)&&d.seq<=sequences.get(d.device))return null;if(!sequences.has(d.device)&&sequences.size>=32)sequences.delete(sequences.keys().next().value);sequences.set(d.device,d.seq);}pose={...pose,...d};return {...pose};}};
}
