// Unit-level simulations only. These do not exercise a browser or physical camera.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as gestureUtils from '../dist/gestures.mjs';
import {clearQuantizedTail} from '../dist/trail-decay.mjs';
import {CyberHud} from '../dist/cyber-hud.mjs';
const elements=new Map(),frameQueue=[];
let calls=0;
let tailReads=0,tailWrites=0;
const paint=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData(){tailReads++;return{data:new Uint8ClampedArray([90,30,180,1,90,30,180,255])}},putImageData(pixels){tailWrites++;assert.equal(pixels.data[3],0);assert.equal(pixels.data[7],255)}},{get(t,k){return k in t?t[k]:(...args)=>{calls++;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n),`${String(k)} got nonfinite number`)}}});
function track(kind='video'){return{kind,stop(){this.stopped=true},clone(){return track(kind)},getSettings(){return{deviceId:'test-camera'}},addEventListener(){}}}
function stream(){const tracks=[track()];return{getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(t=>t.kind==='video'),getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),addTrack:t=>tracks.push(t)}}
function element(id){return {id,hidden:false,disabled:false,checked:false,value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>paint,replaceChildren(){},append(){},captureStream:stream,play:async()=>{},videoWidth:1280,videoHeight:720,readyState:3,currentTime:0,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})}}
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const [,id] of html.matchAll(/id="([^"]+)"/g))elements.set(id,element(id));
class Recorder {static isTypeSupported(){return true}constructor(s,o){this.stream=s;this.mimeType=o.mimeType;this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['video'])});queueMicrotask(()=>this.onstop())}}
const sandbox={gestureUtils,console,Math,Map,Set,Uint8Array,performance,Blob,MediaRecorder:Recorder,URL,location:{href:'https://example.test/'},requestAnimationFrame:fn=>frameQueue.push(fn),navigator:{mediaDevices:{getUserMedia:async()=>stream(),enumerateDevices:async()=>[{kind:'videoinput',deviceId:'test-camera',label:'Test camera'}]}},document:{getElementById:id=>elements.get(id),createElement:tag=>element(tag),querySelectorAll:()=>[],addEventListener(){},body:element('body'),hidden:false},window:{MediaRecorder:Recorder,addEventListener(){}}};
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*?;\n/,'const {classifyHand,mapPoint,clamp,distance}=gestureUtils;\n').replace("import {clearQuantizedTail} from './trail-decay.mjs';",'const clearQuantizedTail=globalThis.tailCorrection;').replace("import {CyberHud} from './cyber-hud.mjs';",'const CyberHud=globalThis.CyberHud;');
sandbox.tailCorrection=clearQuantizedTail;sandbox.CyberHud=CyberHud;
vm.createContext(sandbox);vm.runInContext(source+'\nglobalThis.api={processHands,detectHands,trackingFrame,scene,presentFrame,pointerPosition,sigilLight,gestureRing,drawSigilLight,state,settings,cyberHud,burst,drawVortices,clearEffects,render,startCamera,stopCamera,startRecording,stopRecording,resize};',sandbox);
const {api}=sandbox;
for(const height of [720,1080]){
 api.settings.effect=height===1080?'cyber':'ribbons';
 api.resize(height);
 for(let i=0;i<240;i++){api.render(performance.now()+i*16.67);frameQueue.length=0}
}
api.clearEffects();api.settings.effect='sigils';for(let i=0;i<12;i++)api.render(api.state.last+16.67);
api.clearEffects();api.settings.effect='cyber';api.burst(500,300,'#70ffe7',110);
assert.equal(api.state.particles.length,0);assert.equal(api.state.rings.length,0);assert.equal(api.cyberHud.matrices.length,1);
api.clearEffects();assert.equal(api.cyberHud.matrices.length,0);
api.state.model={detectForVideo:()=>({landmarks:[],handedness:[]})};
assert(tailReads>0&&tailReads<40,'tail correction runs periodically, not every frame');
assert.equal(tailWrites,tailReads);
await api.startCamera();assert.equal(api.state.live,true);assert.equal(elements.get('record').disabled,false);assert.equal(elements.get('demoCaption').hidden,true);
api.render(performance.now()+10000);assert.equal(elements.get('handStatus').textContent,'ETSITÄÄN KÄSIÄ');
api.startRecording();assert.equal(api.state.recording,true);assert.equal(elements.get('camera').disabled,true);
api.stopRecording();assert.equal(api.state.finalizing,true);api.startRecording();assert.equal(api.state.recording,false);
await new Promise(resolve=>setImmediate(resolve));assert.equal(api.state.finalizing,false);assert.equal(elements.get('download').hidden,false);assert(elements.get('download').download.endsWith('.mp4'));
api.stopCamera();assert.equal(api.state.live,false);assert.equal(elements.get('record').disabled,true);assert.equal(elements.get('demoCaption').hidden,false);
sandbox.navigator.mediaDevices.getUserMedia=async()=>{const e=new Error();e.name='NotAllowedError';throw e};
await api.startCamera();assert.equal(api.state.live,false);assert.equal(elements.get('camera').disabled,false);assert(elements.get('status').textContent.includes('estettiin'));
URL.revokeObjectURL(api.state.recordUrl);
console.log(`Runtime simulations passed: ${calls} drawing calls, HD/Full HD, camera success/denial, no-hands state, recording, download, stop.`);

api.clearEffects();api.settings.effect='sigils';api.state.last=1000;
api.burst(500,300,'#70ffe7',110,'fist');
assert.equal(api.state.vortices.length,1);assert.equal(api.state.particles.length,0);assert.equal(api.state.rings.length,0);
for(const time of [1000,1100,1700,2600,4050,4450,4700])api.drawVortices(time);
api.drawVortices(4800);assert.equal(api.state.vortices.length,0);
api.burst(500,300,'#70ffe7',35);assert.equal(api.state.vortices.length,0);
api.burst(500,300,'#70ffe7',110,'fist');api.clearEffects();assert.equal(api.state.vortices.length,0);
console.log('Sigil vortex: fist-only trigger, no fireworks, finite drawing through collapse, expiry and clear passed.');

api.clearEffects();api.settings.effect='sigils';
api.gestureRing(400,300,90,0,'#70ffe7');
assert.equal(api.sigilLight.current.length,1);
api.drawSigilLight(1000);assert.equal(api.sigilLight.history.length,1);
api.drawSigilLight(1016);assert.equal(api.sigilLight.history.length,1,'history sampled independently of frame rate');
api.sigilLight.current=[];api.drawSigilLight(2000);
assert.equal(api.sigilLight.history.length,0,'ghost disappears completely after its lifetime');
api.gestureRing(400,300,90,0,'#70ffe7');api.drawSigilLight(2100);
api.clearEffects();assert.equal(api.sigilLight.history.length,0);assert.equal(api.sigilLight.current.length,0);
api.settings.effect='ribbons';api.gestureRing(400,300,90,0,'#70ffe7');
assert.equal(api.sigilLight.current.length,0,'other modes retain their original drawing path');
console.log('Sigil light ghosts: current-frame routing, bounded sampling, expiry, clear and mode isolation passed.');

api.settings.aspect='square';
for(const height of [720,1080]){
 api.resize(height);
 assert.equal(elements.get('scene').width,height);assert.equal(elements.get('scene').height,height);
 assert.equal(elements.get('stage').style.aspectRatio,'1 / 1');
 for(const effect of ['ribbons','sigils','prism','cyber']){api.settings.effect=effect;api.clearEffects();api.render(api.state.last+16.67)}
 const center=gestureUtils.mapPoint({x:.5,y:.5},height,height,1280,720,true);
 assert.equal(center.x,height/2);assert.equal(center.y,height/2);
}
api.state.live=true;api.startRecording();assert.equal(elements.get('aspect').disabled,true);
api.stopRecording();await new Promise(resolve=>setImmediate(resolve));assert.equal(elements.get('aspect').disabled,false);
api.settings.aspect='wide';api.resize(720);assert.equal(elements.get('scene').width,1280);
console.log('Square framing: both sizes, four modes, centered tracking, recording lock and landscape restoration passed.');

api.settings.aspect='portrait';
for(const size of [720,1080]){
 api.resize(size);
 assert.equal(elements.get('scene').width,size);assert.equal(elements.get('scene').height,size*1.25);
 assert.equal(api.scene.width,Math.round(size*16/9));assert.equal(api.scene.height,size);
 assert.equal(elements.get('stage').style.aspectRatio,'4 / 5');
 for(const live of [true,false]){api.state.live=live;for(const effect of ['ribbons','sigils','prism','cyber']){api.settings.effect=effect;api.clearEffects();api.render(api.state.last+16.67)}}
}
elements.get('scene').getBoundingClientRect=()=>({left:0,top:0,width:720,height:900});
const center=api.pointerPosition({clientX:360,clientY:450});
assert.equal(center.x,960);assert.equal(center.y,540);
api.settings.aspect='wide';api.resize(720);assert.equal(elements.get('scene').width,1280);assert.equal(elements.get('scene').height,720);
console.log('4:5 composition: output dimensions, wide effect surface, live/demo modes, pointer alignment and landscape restoration passed.');

api.state.live=true;Recorder.isTypeSupported=t=>t.startsWith('video/webm');
api.startRecording();assert(api.state.recorder.mimeType.includes('vp8'));
api.stopRecording();await new Promise(resolve=>setImmediate(resolve));
assert(elements.get('download').download.endsWith('.webm'));
console.log('Recording formats: MP4 preferred and WebM fallback passed.');

function trackedHand(open=true,offset=0){
 const p=Array.from({length:21},()=>({x:.5+offset,y:.7}));p[0]={x:.5+offset,y:.9};p[4]={x:.18+offset,y:.53};
 for(let f=0;f<4;f++){const base=5+f*4,x=.35+f*.12+offset;p[base]={x,y:.64};p[base+1]={x,y:.48};p[base+2]={x,y:open?.36:.65};p[base+3]={x,y:open?.24:.75}}
 return {landmarks:[p],handedness:[[{categoryName:'Left'}]]};
}
api.clearEffects();api.state.hands.clear();api.settings.effect='cyber';
api.processHands(trackedHand(false),1000);
api.processHands(trackedHand(true,.1),1200);
assert.equal(api.cyberHud.matrices.length,1,'opening after a sparse held-fist sample releases the matrix');
const moving=api.state.hands.get('Left');
assert(Number.isFinite(moving.points[8].x));
api.processHands({landmarks:[],handedness:[]},1400);assert(api.state.hands.has('Left'),'brief tracking gap retains gesture');
api.processHands({landmarks:[],handedness:[]},1800);assert.equal(api.state.hands.size,0,'lost hand still expires');
console.log('Sparse gesture updates: charged fist release, continuous movement, brief loss tolerance and expiry passed.');

let inputFrame;
api.state.model={detectForVideo(frame){inputFrame=frame;return{landmarks:[],handedness:[]}}};
api.detectHands(2000);
assert.equal(inputFrame,api.trackingFrame);assert.equal(inputFrame.width,640);assert.equal(inputFrame.height,360);
console.log('Direct tracking uses a compact current frame without an asynchronous result queue.');
