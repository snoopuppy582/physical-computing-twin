import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
const $=id=>document.getElementById(id),stage=$('stage');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x202923);
const camera=new THREE.PerspectiveCamera(55,1,.015,2000);camera.position.set(2.5,1.6,3.5);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.05;controls.maxDistance=1000;controls.target.set(0,0,0);
scene.add(new SparkRenderer({renderer}));
const grid=new THREE.GridHelper(10,20,0x66735f,0x445041);grid.visible=false;scene.add(grid);
let scan=null,focusBox=null,version=0;
const number=new Intl.NumberFormat('ko-KR');
function dimensions(box){const size=box.getSize(new THREE.Vector3());return [size.x,size.y,size.z].map(n=>n.toFixed(1)).join(' × ');}
// Camera framing only: no points are deleted and no file is rewritten.
function robustBounds(mesh){const axes=[[],[],[]],stride=Math.max(1,Math.floor(mesh.numSplats/60000));mesh.forEachSplat((i,center,scales,q,opacity)=>{if(i%stride||opacity<.1||!Number.isFinite(center.x+center.y+center.z))return;axes[0].push(center.x);axes[1].push(center.y);axes[2].push(center.z);});if(axes[0].length<10)return mesh.getBoundingBox();axes.forEach(a=>a.sort((a,b)=>a-b));const percentile=(a,p)=>a[Math.floor((a.length-1)*p)];return new THREE.Box3(new THREE.Vector3(...axes.map(a=>percentile(a,.05))),new THREE.Vector3(...axes.map(a=>percentile(a,.95))));}
function fit(){if(!scan||!focusBox)return;scan.updateMatrixWorld(true);const box=focusBox.clone().applyMatrix4(scan.matrixWorld),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const radius=Math.max(.3,size.length()/2),fov=THREE.MathUtils.degToRad(camera.fov),verticalDistance=radius/Math.sin(fov/2),aspectAdjustment=Math.max(1,1/camera.aspect);const distance=verticalDistance*aspectAdjustment*1.1;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.45,1).normalize().multiplyScalar(distance));camera.near=.015;camera.far=Math.max(200,distance*15);camera.updateProjectionMatrix();controls.update();}
function inside(){if(!scan)return;camera.position.set(0,.02,.04);controls.target.set(.15,-.05,-1.5);camera.near=.01;camera.far=2000;camera.updateProjectionMatrix();controls.update();}
async function loadSource(getBuffer,name,initialView='fit'){const id=++version;$('loading').hidden=false;$('loading').textContent='스캔을 불러오고 있습니다…';$('status').textContent='파일 읽기 / 스플랫 처리 중';$('status').classList.remove('error');let candidate=null;
 try{const buffer=await getBuffer();if(id!==version)return;candidate=new SplatMesh({fileBytes:new Uint8Array(buffer),fileName:name});await candidate.initialized;if(id!==version){candidate.dispose();return;}const bounds=candidate.getBoundingBox(),focus=robustBounds(candidate);candidate.quaternion.set(1,0,0,0);if(scan){scene.remove(scan);scan.dispose();}scan=candidate;scene.add(scan);focusBox=focus;initialView==='inside'?inside():fit();const mb=buffer.byteLength/1048576;$('scan-size').textContent=mb.toFixed(1)+' MB';$('scan-count').textContent=number.format(scan.numSplats);$('file-name').textContent=name;$('full-bounds').textContent=dimensions(bounds);$('focus-bounds').textContent=dimensions(focus);const full=bounds.getSize(new THREE.Vector3()).length(),main=focus.getSize(new THREE.Vector3()).length();$('bounds-note').textContent=full>main*3?'먼 배경점이 전체 범위를 크게 늘립니다. 주 영역 맞춤은 불투명도 0.1 이상인 점의 축별 5~95% 위치를 사용합니다. 좌표 범위는 실측 치수가 아닙니다.':'원본 스캔의 중심 영역을 기준으로 화면을 맞췄습니다. 좌표 범위는 실측 치수가 아닙니다.';$('status').textContent=`불러오기 완료 · ${mb<=100?'100MB 이하':'100MB 초과'} · ${scan.numSplats<=1500000?'150만 개 이하':'150만 개 초과'}`;$('loading').hidden=true;window.scanStudy={scene,camera,controls,renderer,scan,focusBox,fullBox:bounds,fit,inside};
 }catch(error){if(candidate&&candidate!==scan)candidate.dispose();if(id!==version)return;$('loading').hidden=false;$('loading').textContent='파일을 열지 못했습니다. SPZ 파일을 다시 선택해 주세요.';$('status').textContent=error.message;$('status').classList.add('error');console.error(error);}}
function loadFile(file){if(!file)return;const ext=file.name.split('.').pop().toLowerCase();if(!['spz','ply','splat','ksplat'].includes(ext)){$('status').textContent='SPZ 또는 지원되는 스플랫 파일을 선택해 주세요.';$('status').classList.add('error');return;}return loadSource(()=>file.arrayBuffer(),file.name);}
async function fetchBuffer(url){const response=await fetch(url);if(!response.ok)throw new Error(`파일 요청 실패 (${response.status})`);return response.arrayBuffer();}
function loadCafe(){return loadSource(()=>fetchBuffer('assets/cafe-test.spz'),'카페 테스트 · 영통구.spz','inside');}
$('file').addEventListener('change',e=>loadFile(e.target.files[0]));$('cafe-load').addEventListener('click',loadCafe);$('sample').addEventListener('click',()=>loadSource(()=>fetchBuffer('https://sparkjs.dev/assets/splats/butterfly.spz'),'butterfly.spz'));
for(const name of ['dragenter','dragover'])addEventListener(name,e=>{e.preventDefault();$('drop').style.borderColor='#366657';});
addEventListener('drop',e=>{e.preventDefault();$('drop').style.borderColor='';loadFile(e.dataTransfer.files[0]);});
$('fit').addEventListener('click',fit);$('inside').addEventListener('click',inside);$('flip').addEventListener('click',()=>{if(scan){scan.rotateX(Math.PI);fit();}});$('grid').addEventListener('click',()=>{grid.visible=!grid.visible;});
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}).observe(stage);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
loadCafe();
