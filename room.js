import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id),stage=$('stage');
if(new URLSearchParams(location.search).has('embed'))document.body.classList.add('embedded');
// Source dimensions are estimates. All modeled pieces below use BoxGeometry.
const ROOM={width:4.2,depth:5.5,height:2.4};
const scene=new THREE.Scene();scene.background=new THREE.Color(0xebece5);
const camera=new THREE.PerspectiveCamera(45,1,.05,50);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*.48;
scene.add(new THREE.HemisphereLight(0xffffff,0x999483,2.2));const sun=new THREE.DirectionalLight(0xfff4de,2.8);sun.position.set(-3,9,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});sun.shadow.normalBias=.035;scene.add(sun);
const walls=new THREE.Group();scene.add(walls);const pickables=[],objects={},tags=[];
function box(parent,name,size,pos,color,opts={}){const mat=new THREE.MeshStandardMaterial({color,roughness:.8,...opts});const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...pos);mesh.castShadow=!opts.transparent;mesh.receiveShadow=true;mesh.userData.name=name;parent.add(mesh);return mesh;}
function group(name,size,pos,color,role){const g=new THREE.Group();g.position.set(...pos);g.userData={name,size,color,role};scene.add(g);objects[name]=g;return g;}
function tag(text,position,kind=''){const el=document.createElement('span');el.className='scene-tag '+kind;el.textContent=text;$('labels').appendChild(el);tags.push({el,position:new THREE.Vector3(...position)});}
const floor=box(scene,'바닥',[4.2,.09,5.5],[0,-.045,0],0xd1c8b6);
// Narrow, slightly contrasting boxes suggest flooring without photographic textures.
for(let x=-1.8;x<2.1;x+=.3)box(scene,'바닥 이음',[.006,.001,5.5],[x,.001,0],0xbeb4a2);
const wallMat={transparent:true,opacity:.2,depthWrite:false};
box(walls,'뒤벽',[4.2,2.4,.08],[0,1.2,-2.75],0xf4f2e7,wallMat);
box(walls,'왼벽',[.08,2.4,5.5],[-2.1,1.2,0],0xf4f2e7,wallMat);
box(walls,'오른벽',[.08,2.4,5.5],[2.1,1.2,0],0xf4f2e7,wallMat);
for(const x of [-1.275,1.275])box(walls,'앞벽',[1.65,2.4,.08],[x,1.2,2.75],0xf4f2e7,wallMat);
box(walls,'문 위 벽',[.9,.4,.08],[0,2.2,2.75],0xf4f2e7,wallMat);
for(const x of [-2.05,2.05])box(scene,'걸레받이',[.035,.08,5.42],[x,.04,0],0xe2ddd2);
box(scene,'걸레받이',[4.12,.08,.035],[0,.04,-2.70],0xe2ddd2);

const bed=group('침대',[1,.65,2],[-1.5,0,-.35],0xd5c9b2,'벽 쪽에 붙여 중앙의 이동 공간을 남겼습니다.');
box(bed,'침대 프레임',[1,.22,2],[0,.15,0],0xb59e80);box(bed,'매트리스',[.97,.17,1.96],[0,.345,0],0xf0eadb);box(bed,'이불',[.98,.075,1.40],[0,.47,.24],0xd5c9b2);box(bed,'베개',[.62,.12,.32],[0,.49,-.7],0xf8f4e9);box(bed,'헤드보드',[1,.65,.07],[0,.325,-.96],0xb59e80);
const desk=group('책상',[1.2,.75,.6],[1.3,0,-2.35],0xb8956b,'침대와 분리한 1인용 작업 공간입니다.');
box(desk,'책상 상판',[1.2,.045,.6],[0,.7275,0],0xb8956b);for(const x of [-.53,.53])for(const z of [-.23,.23])box(desk,'책상 다리',[.045,.705,.045],[x,.3525,z],0x5d665b);box(desk,'노트북',[.33,.016,.22],[.05,.758,0],0x818e8d);box(desk,'노트북 화면',[.33,.20,.015],[.05,.866,-.10],0x374a46);box(desk,'노트',[.16,.023,.21],[-.39,.769,.03],0xd6d1b6);
const chair=group('의자',[.45,.85,.45],[1.3,0,-1.65],0x7b8f86,'책상과 통로 사이에 배치한 의자입니다.');
box(chair,'의자 좌판',[.45,.06,.45],[0,.43,0],0x7b8f86);box(chair,'의자 등받이',[.45,.39,.055],[0,.65,.19],0x7b8f86);for(const x of [-.17,.17])for(const z of [-.17,.17])box(chair,'의자 다리',[.035,.4,.035],[x,.2,z],0x626b61);
const wardrobe=group('옷장',[1,2,.6],[-1.5,0,2.35],0x798779,'입구 왼쪽 벽에 붙인 수납 가구입니다.');
box(wardrobe,'옷장 몸체',[1,2,.6],[0,1,0],0x798779);for(const x of [-.246,.246])box(wardrobe,'옷장 문',[.485,1.94,.02],[x,1,-.31],0x889586);for(const x of [-.045,.045])box(wardrobe,'옷장 손잡이',[.015,.17,.02],[x,1.1,-.334],0x495849);
const kitchen=group('주방 수납대',[.6,.87,1.2],[1.8,0,0],0x93aa9a,'상판과 하부 수납으로 구성한 주방입니다.');
box(kitchen,'주방 하부장',[.6,.82,1.2],[0,.41,0],0x93aa9a);box(kitchen,'주방 상판',[.64,.05,1.24],[-.01,.845,0],0xe7e6dc);box(kitchen,'싱크 영역',[.37,.007,.38],[-.02,.876,-.28],0x879b98);box(kitchen,'가열 영역',[.38,.007,.35],[-.02,.876,.3],0x4a5751);for(const z of [-.3,.3])box(kitchen,'수납장 손잡이',[.017,.025,.17],[-.317,.68,z],0x50675b);
const fridge=group('냉장고',[.6,1.5,.6],[1.8,0,.95],0xbcc7c4,'주방과 가까운 위치에 둔 냉장고입니다.');
box(fridge,'냉장고 몸체',[.6,1.5,.6],[0,.75,0],0xbcc7c4);box(fridge,'냉장고 문 이음',[.008,.012,.58],[-.304,1.02,0],0x758781);box(fridge,'냉장고 손잡이',[.025,.20,.025],[-.319,.84,-.23],0x647a72);
const bath=group('욕실 영역',[1.35,2.1,1.35],[1.425,0,2.075],0xc4b5ae,'욕실은 내부 설비 대신 공간의 부피로 표현했습니다.');
box(bath,'욕실 영역',[1.35,2.1,1.35],[0,1.05,0],0xc4b5ae,{transparent:true,opacity:.45,depthWrite:false});box(bath,'욕실 바닥',[1.30,.025,1.30],[0,.016,0],0xc4b5ae);
const windowGroup=group('창문',[1.1,1,.06],[-.7,1.35,-2.7],0x9cb5b7,'뒤쪽 벽에 배치한 창문입니다.');
box(windowGroup,'창 유리',[1.1,1,.02],[0,0,0],0x9cb5b7,{transparent:true,opacity:.6,depthWrite:false});for(const x of [-.56,0,.56])box(windowGroup,'창 세로틀',[.025,1.04,.055],[x,0,0],0xecede5);for(const y of [-.515,.515])box(windowGroup,'창 가로틀',[1.14,.025,.055],[0,y,0],0xecede5);

const door=group('방문',[.9,2,.04],[-.45,0,2.75],0x587f9d,'왼쪽 경첩을 축으로 열리는 방문입니다.');
box(door,'문판',[.9,2,.04],[.45,1,0],0x587f9d);box(door,'문 손잡이',[.12,.028,.05],[.77,1,-.05],0xb8c0bf);
for(const x of [-.482,.482])box(scene,'고정 문틀',[.05,2.04,.07],[x,1.02,2.75],0xe4e0d5);box(scene,'고정 문틀',[1.014,.055,.07],[0,2.0275,2.75],0xe4e0d5);
for(const g of Object.values(objects)){g.traverse(o=>{if(o.isMesh){o.userData.owner=g;pickables.push(o);}});}
for(const name of ['침대','책상','옷장','욕실 영역']){const g=objects[name];tag(name,[g.position.x,g.userData.size[1]+g.position.y+.14,g.position.z]);}
tag('4.20 m',[0,.02,3.12],'dimension');tag('5.50 m',[-2.5,.02,0],'dimension');
const lineMat=new THREE.LineBasicMaterial({color:0x84907e});
function line(points){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),lineMat);scene.add(l);}
line([[-2.1,.01,3.02],[2.1,.01,3.02]]);line([[-2.4,.01,-2.75],[-2.4,.01,2.75]]);
for(const x of [-2.1,2.1])line([[x,.01,2.94],[x,.01,3.10]]);for(const z of [-2.75,2.75])line([[-2.48,.01,z],[-2.32,.01,z]]);
const arcPoints=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI/2;return new THREE.Vector3(-.45+Math.cos(a)*.9,.012,2.75-Math.sin(a)*.9);});
const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints),new THREE.LineDashedMaterial({color:0x6a899f,dashSize:.07,gapSize:.045}));arc.computeLineDistances();scene.add(arc);
let targetAngle=0,labelsVisible=true;
function setDoorAngle(angle){targetAngle=THREE.MathUtils.clamp(Number(angle),0,90);$('door-angle').value=targetAngle;$('angle-output').value=Math.round(targetAngle)+'°';$('door-toggle').textContent=targetAngle>45?'문 닫기':'문 열기';return targetAngle;}
$('door-angle').addEventListener('input',e=>setDoorAngle(e.target.value));$('door-toggle').addEventListener('click',()=>setDoorAngle(targetAngle>45?0:80));
let currentView='overview';
function view(name){currentView=name;if(name==='plan'){camera.position.set(0,10*Math.max(1,1/camera.aspect),.001);controls.target.set(0,0,0);}else{controls.target.set(0,.4,0);camera.position.set(4.4,7.6,6.3).sub(controls.target).multiplyScalar(Math.max(1,1.2/camera.aspect)).add(controls.target);}controls.update();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));view('overview');
$('labels-toggle').addEventListener('click',()=>{labelsVisible=!labelsVisible;$('labels').hidden=!labelsVisible;$('labels-toggle').setAttribute('aria-pressed',String(labelsVisible));});
$('walls-toggle').addEventListener('click',()=>{walls.visible=!walls.visible;$('walls-toggle').setAttribute('aria-pressed',String(walls.visible));});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let selected=door,down=null;
function select(g){if(selected)selected.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(0);});selected=g;g.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(0x080e09);});$('object-name').textContent=g.userData.name;$('object-size').textContent=g.userData.size.map(n=>n.toFixed(2)).join(' × ')+'m';$('object-role').textContent=g.userData.role;}
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables,false)[0];if(hit)select(hit.object.userData.owner);});
new ResizeObserver(()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();view(currentView);}).observe(stage);
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{door.rotation.y=THREE.MathUtils.damp(door.rotation.y,THREE.MathUtils.degToRad(targetAngle),8,Math.min(clock.getDelta(),.05));controls.update();renderer.render(scene,camera);if(labelsVisible){const r=stage.getBoundingClientRect();for(const t of tags){const p=t.position.clone().project(camera);t.el.style.left=((p.x+1)*.5*r.width)+'px';t.el.style.top=((-p.y+1)*.5*r.height)+'px';t.el.style.display=p.z<1&&p.z>-1?'':'none';}}});
window.twin={scene,camera,renderer,controls,objects,door,walls,setDoorAngle,select,view};
