import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id),stage=$('stage');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xeaece5);
const camera=new THREE.PerspectiveCamera(40,1,.015,40);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.2;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.94;controls.autoRotateSpeed=1.1;
scene.add(new THREE.HemisphereLight(0xffffff,0x888478,2.1));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-3,near:.1,far:15});key.shadow.normalBias=.025;scene.add(key);
const fill=new THREE.DirectionalLight(0xdde5fa,1.5);fill.position.set(3,2,-4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0xe3e5dc,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
let model,leaf,frame,targetAngle=0,wire=false;
function view(name){const positions={overview:[2.3,1.85,4],front:[0,1.1,4],back:[-1.7,1.6,-3.4],detail:[.85,1.18,.65]};const targets={detail:[.31,1.02,.02]};camera.position.fromArray(positions[name]||positions.overview);controls.target.fromArray(targets[name]||[0,1.03,0]);controls.update();}
view('overview');
function setAngle(angle){targetAngle=THREE.MathUtils.clamp(Number(angle),0,90);$('door-angle').value=targetAngle;$('angle-output').value=Math.round(targetAngle)+'°';$('door-toggle').textContent=targetAngle>45?'문 닫기':'문 열기';}
$('door-angle').addEventListener('input',e=>setAngle(e.target.value));$('door-toggle').addEventListener('click',()=>setAngle(targetAngle>45?0:80));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
$('auto-rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('auto-rotate').setAttribute('aria-pressed',String(controls.autoRotate));});
$('wireframe').addEventListener('click',()=>{wire=!wire;if(model)model.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=wire;}});$('wireframe').setAttribute('aria-pressed',String(wire));});
async function load(){try{const response=await fetch('assets/room-door.glb');if(!response.ok)throw new Error(`HTTP ${response.status}`);const buffer=await response.arrayBuffer();const gltf=await new GLTFLoader().parseAsync(buffer,'');model=gltf.scene;leaf=model.getObjectByName('Door_Hinge_Pivot');frame=model.getObjectByName('Door_Frame');if(!leaf||!frame)throw new Error('회전 문판과 고정 문틀 구조를 찾을 수 없습니다.');model.position.x=-.45;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(model);$('model-size').textContent=(buffer.byteLength/1024).toFixed(0)+' KB';$('part-count').textContent=`${frame.children.length} / ${leaf.children.length}개`;$('loading').hidden=true;$('status').textContent='GLB 불러오기 완료 · 문틀과 문판 분리 확인';$('door-angle').disabled=false;$('door-toggle').disabled=false;window.doorStudy={scene,camera,controls,model,leaf,frame,setAngle,view};}catch(e){$('loading').textContent='모델을 불러오지 못했습니다. 새로고침해 주세요.';$('status').textContent=e.message;$('status').classList.add('error');console.error(e);}}
load();
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}).observe(stage);
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);if(leaf)leaf.rotation.y=THREE.MathUtils.damp(leaf.rotation.y,THREE.MathUtils.degToRad(targetAngle),8,dt);controls.update();renderer.render(scene,camera);});
