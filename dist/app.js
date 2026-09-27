import {classifyHand,mapPoint,clamp,distance} from './gestures.mjs';
import {clearQuantizedTail} from './trail-decay.mjs';
import {CyberHud} from './cyber-hud.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'),output=canvas.getContext('2d',{alpha:false});
const scene=document.createElement('canvas'),ctx=scene.getContext('2d',{alpha:false});
const backdrop=document.createElement('canvas'),backdropCtx=backdrop.getContext('2d',{alpha:false});
const trail=document.createElement('canvas'),tx=trail.getContext('2d');
const bloom=document.createElement('canvas'),bx=bloom.getContext('2d');
const video=$('cameraVideo');
const trackingFrame=document.createElement('canvas'),trackingCtx=trackingFrame.getContext('2d',{alpha:false});
const palettes={aurora:['#70ffe7','#d376ff','#71a4ff'],laurel:['#b894ff','#ffdb93','#d9caff'],ember:['#ff9978','#ff477c','#ffe4b4']};
const settings={palette:'aurora',effect:'ribbons',aspect:'wide',glow:.7,trails:.65,intensity:.7,cameraMix:.85,mirror:true,skeleton:false};
const state={live:false,starting:false,model:null,stream:null,hands:new Map(),particles:[],rings:[],vortices:[],last:0,lastDetect:0,lastVideo:-1,frame:0,fpsAt:0,fpsFrames:0,recording:false,recorder:null,recordStream:null,recordStarted:0,recordUrl:null,audioStream:null,audioContext:null,audioSource:null,analyser:null,audioData:null,volume:0,demoAt:performance.now(),pointer:null,pointerDown:false,lastUi:0,modelPromise:null};
let W=1280,H=720;
const cyberHud=new CyberHud();
let tailCleanupElapsed=0,tailEraseAlpha=1;
let backdropAt=-Infinity;
const sigilLight={current:[],history:[],lastSample:-Infinity};
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error)}
function resize(height){
  H=height;const square=settings.aspect==='square',portrait=settings.aspect==='portrait';W=square?H:Math.round(H*16/9);
  scene.width=W;scene.height=H;
  trail.width=Math.round(W/2);trail.height=Math.round(H/2);tx.setTransform(trail.width/W,0,0,trail.height/H,0,0);
  canvas.width=portrait?H:W;canvas.height=portrait?H*1.25:H;
  backdrop.width=Math.round(canvas.width/4);backdrop.height=Math.round(canvas.height/4);
  bloom.width=Math.round(W/2);bloom.height=Math.round(H/2);
  $('stage').style.aspectRatio=portrait?'4 / 5':square?'1 / 1':'16 / 9';
  $('size720').textContent=portrait?'720 × 900':square?'720 × 720':'HD · 1280 × 720';
  $('size1080').textContent=portrait?'1080 × 1350':square?'1080 × 1080':'Full HD · 1920 × 1080';
  clearEffects();state.hands.clear();
}
function presentFrame(now=performance.now()){
  const ow=canvas.width,oh=canvas.height;
  output.save();output.globalAlpha=1;output.globalCompositeOperation='source-over';
  if(settings.aspect==='portrait'){
    // Keep all effects on the original wide surface. Only the final composition
    // changes, so gestures and recording share the same untouched coordinates.
    const source=state.live&&video.readyState>=2?video:scene;
    const sw=source===video?video.videoWidth:W,sh=source===video?video.videoHeight:H;
    const bw=backdrop.width,bh=backdrop.height,scale=Math.max(bw/sw,bh/sh)*1.12;
    if(now-backdropAt>=1000/15){
    backdropAt=now;
    backdropCtx.save();backdropCtx.fillStyle='#04050a';backdropCtx.fillRect(0,0,bw,bh);
    backdropCtx.filter=`blur(${Math.max(5,bw*.035)}px) brightness(0.28)`;
    backdropCtx.globalAlpha=source===video?settings.cameraMix:1;
    if(source===video&&settings.mirror){backdropCtx.translate(bw,0);backdropCtx.scale(-1,1)}
    backdropCtx.drawImage(source,(bw-sw*scale)/2,(bh-sh*scale)/2,sw*scale,sh*scale);
    backdropCtx.restore();
    }
    output.imageSmoothingEnabled=true;output.imageSmoothingQuality='high';
    output.drawImage(backdrop,0,0,ow,oh);
    const height=ow*H/W;output.drawImage(scene,0,(oh-height)/2,ow,height);
  }else output.drawImage(scene,0,0);
  output.restore();
}
function clearEffects(){backdropAt=-Infinity;sigilLight.current=[];sigilLight.history=[];sigilLight.lastSample=-Infinity;tx.clearRect(0,0,W,H);tailCleanupElapsed=0;tailEraseAlpha=1;cyberHud.reset();state.particles=[];state.rings=[];state.vortices=[];state.hands.forEach(h=>{h.previousTips=null;h.beforeTips=null})}
function colorFor(index){return palettes[settings.palette][index%3]}
function line(target,a,b,color,width=1,alpha=1){target.globalAlpha=alpha;target.strokeStyle=color;target.lineWidth=width;target.beginPath();target.moveTo(a.x,a.y);target.lineTo(b.x,b.y);target.stroke();target.globalAlpha=1}
function burst(x,y,color,amount=70,trigger='burst'){
  if(settings.effect==='sigils'&&trigger==='fist'){state.vortices.push({x,y,color,born:state.last,unit:H/720});state.vortices=state.vortices.slice(-3);return}
  if(settings.effect==='cyber'){if(amount>=60)cyberHud.release(x,y,color,state.last,H);return}
  const count=Math.round(amount*(.45+settings.intensity));
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2,speed=(45+Math.random()*260)*(H/720);
    state.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.4+Math.random()*1.1,max:1.5,color,size:(.6+Math.random()*1.7)*H/720});
  }
  state.rings.push({x,y,r:10,life:1,color});
  if(state.particles.length>650)state.particles.splice(0,state.particles.length-650);
}
function drawRing(target,x,y,r,rotation,color,detail=1){
  target.save();target.translate(x,y);target.rotate(rotation);target.strokeStyle=color;target.lineWidth=H/900;target.globalAlpha=.75;
  target.beginPath();target.arc(0,0,r,0,Math.PI*2);target.stroke();
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;target.beginPath();target.arc(0,0,r*1.13,a,a+1.12);target.stroke()}
  if(detail){
    target.globalAlpha=.35;target.beginPath();
    for(let i=0;i<=6;i++){const a=i*Math.PI/3;target.lineTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82)}target.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;target.beginPath();target.moveTo(Math.cos(a)*r*.93,Math.sin(a)*r*.93);target.lineTo(Math.cos(a)*r*1.04,Math.sin(a)*r*1.04);target.stroke()}
  }
  target.restore();
}
// Sharp sigils belong to the current frame only. Their history is a soft,
// time-bounded halo, never accumulated copies of the polygon and tick marks.
function gestureRing(x,y,r,rotation,color,detail=1){
  if(settings.effect==='sigils')sigilLight.current.push({x,y,r,rotation,color,detail});
  else drawRing(tx,x,y,r,rotation,color,detail);
}
function drawSigilLight(now){
  const duration=140+settings.trails*760,unit=H/720;
  if(now-sigilLight.lastSample>=50){
    sigilLight.history.push(...sigilLight.current.map(r=>({...r,born:now})));
    sigilLight.lastSample=now;
  }
  sigilLight.history=sigilLight.history.filter(r=>now-r.born<duration).slice(-60);
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.filter=`blur(${(7+settings.glow*7)*unit}px)`;
  for(const r of sigilLight.history){
    const fade=Math.pow(1-(now-r.born)/duration,2);
    ctx.globalAlpha=fade*(.07+settings.glow*.055);
    ctx.strokeStyle=r.color;ctx.lineWidth=(9+settings.glow*9)*unit;
    ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke();
  }
  ctx.filter='none';ctx.globalAlpha=1;
  for(const r of sigilLight.current){
    ctx.shadowColor=r.color;ctx.shadowBlur=(5+settings.glow*15)*unit;
    drawRing(ctx,r.x,r.y,r.r,r.rotation,r.color,r.detail);
  }
  ctx.restore();
}
function drawStar(target,x,y,size,color){target.fillStyle=color;target.beginPath();target.moveTo(x,y-size*2.2);target.quadraticCurveTo(x+size*.2,y-size*.2,x+size*2.2,y);target.quadraticCurveTo(x+size*.2,y+size*.2,x,y+size*2.2);target.quadraticCurveTo(x-size*.2,y+size*.2,x-size*2.2,y);target.quadraticCurveTo(x-size*.2,y-size*.2,x,y-size*2.2);target.fill()}

function demoHands(now){
  const t=(now-state.demoAt)/1000,scale=H/720;
  const hands=[];
  for(let k=0;k<(state.pointer?1:2);k++){
    const phase=t*.56+k*Math.PI;
    const x=state.pointer?state.pointer.x:W*.56+Math.cos(phase)*W*.19;
    const y=state.pointer?state.pointer.y:H*.43+Math.sin(phase*1.6)*H*.18;
    const open=state.pointer?(state.pointerDown?0:1):(.5+.5*Math.sin(t*.65+k));
    const points=Array.from({length:5},(_,j)=>{const a=-Math.PI*.87+j*.43+Math.sin(t*.25+k)*.8;const r=(25+open*65)*scale;return{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r}});
    const id='demo'+k,old=state.hands.get(id);
    const hand={id,palm:{x,y},tips:points,openness:open,pinch:state.pointerDown,closed:open<.3,label:'DEMO',angle:phase*.3,colorIndex:k,previousTips:old?.previousTips,beforeTips:old?.beforeTips,lastSeen:now,charge:old?.charge||0};
    if(old&&old.closed&&!hand.closed)burst(x,y,colorFor(k),60,'fist');
    state.hands.set(id,hand);hands.push(hand);
  }
  return hands;
}
function processHands(result,now){
  const seen=new Set();
  result.landmarks.forEach((raw,index)=>{
    let id=result.handedness[index]?.[0]?.categoryName||String(index);if(seen.has(id))id+=index;seen.add(id);
    const old=state.hands.get(id),fresh=!old||now-old.lastSeen>240;
    const targets=raw.map(p=>mapPoint(p,W,H,video.videoWidth,video.videoHeight,settings.mirror));
    const points=targets.map((p,i)=>{const before=fresh?null:old.points[i];return before?{x:before.x+(p.x-before.x)*.8,y:before.y+(p.y-before.y)*.8,z:p.z}:p});
    // Use aspect-correct camera coordinates for gesture distances.
    const metric=raw.map(p=>({x:p.x*video.videoWidth,y:p.y*video.videoHeight}));
    const gesture=classifyHand(metric,fresh?{}:old,{forgiving:settings.effect==='cyber'});
    const palm={x:(points[0].x+points[5].x+points[9].x+points[17].x)/4,y:(points[0].y+points[5].y+points[9].y+points[17].y)/4};
    const hand={id,points,palm,tips:[4,8,12,16,20].map(i=>points[i]),...gesture,angle:Math.atan2(points[5].y-points[17].y,points[5].x-points[17].x),colorIndex:id.startsWith('Left')?0:1,previousTips:fresh?null:old.previousTips,beforeTips:fresh?null:old.beforeTips,lastSeen:now,charge:old?.charge||0,closedAt:old?.closedAt||0,wasClosed:old?.wasClosed||false,pinchAt:old?.pinchAt||0};
    // An opening sample can confirm a held fist even when no intermediate
    // closed sample arrived during the detection interval.
    if(!fresh&&old.closed&&now-old.closedAt>=140)hand.wasClosed=true;
    if(gesture.closed){if(!hand.closedAt)hand.closedAt=now;if(now-hand.closedAt>=140)hand.wasClosed=true}else hand.closedAt=0;
    if(!fresh&&hand.wasClosed&&gesture.openness>=.75){burst(palm.x,palm.y,colorFor(hand.colorIndex),110,'fist');hand.wasClosed=false}
    if(!fresh&&old.pinch&&!hand.pinch&&now-old.pinchAt>100)burst(points[8].x,points[8].y,colorFor(hand.colorIndex),35);
    if(hand.pinch&&!old?.pinch)hand.pinchAt=now;
    state.hands.set(id,hand);
  });
  for(const [id,h] of state.hands)if(!seen.has(id)&&now-h.lastSeen>240)state.hands.delete(id);
}
function detectHands(now){
  if(!state.model)return;
  // Use the current frame directly, without bitmap transfer or stale results.
  // A compact input keeps inference upload cost separate from recording quality.
  const height=Math.max(1,Math.round(640*video.videoHeight/video.videoWidth));
  if(trackingFrame.width!==640||trackingFrame.height!==height){trackingFrame.width=640;trackingFrame.height=height}
  trackingCtx.drawImage(video,0,0,640,height);
  processHands(state.model.detectForVideo(trackingFrame,now),now);
}
async function loadModel(){
  if(state.model)return state.model;
  if(state.modelPromise)return state.modelPromise;
  state.modelPromise=(async()=>{
    const {HandLandmarker,FilesetResolver}=await import('./vendor/vision_bundle.mjs');
    const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',location.href).href);
    const base={modelAssetPath:new URL('./vendor/hand_landmarker.task',location.href).href};
    const options={baseOptions:{...base,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55};
    try{state.model=await HandLandmarker.createFromOptions(files,options)}catch{state.model=await HandLandmarker.createFromOptions(files,{...options,baseOptions:{...base,delegate:'CPU'}})}
    return state.model;
  })().finally(()=>{state.modelPromise=null});
  return state.modelPromise;
}
function cameraError(error){
  const messages={NotAllowedError:'Kameran käyttö estettiin. Salli kamera tämän sivun selainasetuksista ja kokeile uudelleen.',NotFoundError:'Kameraa ei löytynyt. Liitä kamera ja kokeile uudelleen.',NotReadableError:'Kamera on toisen sovelluksen käytössä. Sulje sitä käyttävä sovellus ja yritä uudelleen.',OverconstrainedError:'Valittu kamera ei tue näitä asetuksia. Valitse toinen kamera.'};
  return messages[error.name]||'Käsienseuranta ei käynnistynyt. Tarkista verkkoyhteys ja kokeile uudelleen. Kokeilutila toimii edelleen.';
}
async function startCamera(deviceId){
  if(state.starting||state.recording)return;
  if(!navigator.mediaDevices?.getUserMedia){setStatus('Kamera tarvitsee suojatun selainyhteyden. Avaa sivu omassa selaimessasi.',true);return}
  state.starting=true;$('camera').disabled=true;$('cameraSelect').disabled=true;
  let acquired=null;
  try{
    if(state.stream)stopCamera();
    setStatus('Salli kamera selaimen kysyessä. Valmistellaan käsienseurantaa…');
    acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})},audio:false});
    video.srcObject=acquired;await video.play();
    setStatus('Kamera on valmis. Ladataan käsienseuranta ensimmäistä käyttökertaa varten…');
    await loadModel();
    state.stream=acquired;state.live=true;state.lastVideo=-1;state.hands.clear();clearEffects();
    $('demoCaption').hidden=true;$('modeBadge').textContent='KAMERA PÄÄLLÄ';$('camera').innerHTML='<span aria-hidden="true">◉</span> Sulje kamera';
    $('record').disabled=!('MediaRecorder' in window)||!canvas.captureStream;
    const devices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);
    const cameras=devices.filter(d=>d.kind==='videoinput');$('cameraSelect').replaceChildren();
    cameras.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`Kamera ${i+1}`;$('cameraSelect').append(o)});
    $('cameraSelect').value=acquired.getVideoTracks()[0].getSettings().deviceId||'';
    $('cameraSelectGroup').hidden=cameras.length<2;
    acquired.getVideoTracks()[0].addEventListener('ended',()=>{if(state.live){stopCamera();setStatus('Kamerayhteys katkesi. Voit avata kameran uudelleen.',true)}});
    setStatus($('record').disabled?'Käsienseuranta on päällä. Tämä selain ei tue videon tallennusta; kokeile toista ajantasaista selainta.':'Näytä kädet kameralle. Sulje nyrkki hetkeksi ja avaa se vapauttaaksesi valon.');
  }catch(error){acquired?.getTracks().forEach(t=>t.stop());video.srcObject=null;state.live=false;state.stream=null;setStatus(cameraError(error),true)}
  finally{state.starting=false;$('camera').disabled=false;$('cameraSelect').disabled=false}
}
function stopCamera(){
  if(state.recording)stopRecording();
  state.live=false;state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;video.srcObject=null;state.hands.clear();clearEffects();
  $('camera').innerHTML='<span aria-hidden="true">◉</span> Avaa kamera';$('record').disabled=true;$('demoCaption').hidden=false;$('modeBadge').textContent='KOKEILUTILA';$('handStatus').textContent='Liikuta osoitinta';$('gestureReadout').textContent='ESIKATSELU · EI KAMERAKUVAA';
  setStatus('Kamera on suljettu. Voit kokeilla valoa hiirellä tai kosketuksella.');
}
async function toggleAudio(){
  if(!$('audio').checked){stopAudio();return}
  $('audio').disabled=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone unavailable');
    state.audioStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    state.audioContext=new(window.AudioContext||window.webkitAudioContext)();await state.audioContext.resume();
    state.audioSource=state.audioContext.createMediaStreamSource(state.audioStream);state.analyser=state.audioContext.createAnalyser();state.analyser.fftSize=512;state.audioSource.connect(state.analyser);state.audioData=new Uint8Array(state.analyser.frequencyBinCount);
    setStatus('Äänireaktio on päällä. Mikrofoni vahvistaa hehkua ja kuuluu seuraavaan videotallenteeseen.');
  }catch{stopAudio();setStatus('Mikrofonia ei saatu käyttöön. Tarkista selaimen mikrofonilupa. Liike-efektit toimivat ilman ääntä.',true)}
  finally{$('audio').disabled=state.recording}
}
function stopAudio(){state.audioStream?.getTracks().forEach(t=>t.stop());state.audioSource?.disconnect();state.audioContext?.close().catch(()=>{});state.audioStream=null;state.audioContext=null;state.audioSource=null;state.analyser=null;state.volume=0;$('audio').checked=false;$('audioLevel').style.width='0%'}
function lockRecording(locked){['camera','cameraSelect','resolution','aspect','audio'].forEach(id=>$(id).disabled=locked)}
function startRecording(){
  if(!state.live||state.recording||state.finalizing)return;
  try{
    const audio=Boolean(state.audioStream?.getAudioTracks().length);
    const formats=[audio?'video/mp4;codecs=avc1.42002a,mp4a.40.2':'video/mp4;codecs=avc1.42002a','video/mp4',audio?'video/webm;codecs=vp8,opus':'video/webm;codecs=vp8','video/webm'];
    const stream=canvas.captureStream(30);state.recordStream=stream;
    state.audioStream?.getAudioTracks().forEach(t=>stream.addTrack(t.clone()));
    let recorder,mime;
    for(const format of formats){
      if(!MediaRecorder.isTypeSupported(format))continue;
      try{recorder=new MediaRecorder(stream,{mimeType:format,videoBitsPerSecond:H>=1080?28000000:12000000});mime=format;break}catch{}
    }
    if(!recorder)throw Error('No supported codec');
    state.recorder=recorder;
    const chunks=[];let byteCount=0;
    recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);byteCount+=e.data.size;if(byteCount>250*1024*1024&&state.recording){stopRecording();setStatus('Tallenne saavutti 250 Mt. Lataa video ennen seuraavaa ottoa.')}}};
    recorder.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());state.recordStream=null;
      if(chunks.length){if(state.recordUrl)URL.revokeObjectURL(state.recordUrl);state.recordUrl=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType||mime}));const a=$('download');a.href=state.recordUrl;a.download=`aelith-${new Date().toISOString().replace(/[:.]/g,'-')}.${mime.includes('mp4')?'mp4':'webm'}`;a.hidden=false;setStatus('Video on valmis. Lataa se talteen ennen sivun sulkemista tai seuraavaa ottoa.');}
      else setStatus('Tallenteeseen ei syntynyt videota. Kokeile uutta ottoa.',true);
      state.recorder=null;state.finalizing=false;lockRecording(false);$('record').disabled=!state.live;
    };
    recorder.onerror=()=>{stopRecording();setStatus('Videon tallennus keskeytyi. Jos osa tallentui, latauspainike ilmestyy näkyviin.',true)};
    recorder.start(1000);state.recording=true;state.recordStarted=performance.now();lockRecording(true);$('record').classList.add('recording');$('record').innerHTML='<span class="record-dot"></span> Lopeta tallennus';$('timer').hidden=false;$('download').hidden=true;setStatus(state.audioStream?'Tallennetaan kuva, efektit ja mikrofonin ääni.':'Tallennetaan kuva ja efektit ilman ääntä. Voit lisätä biisin videon editoinnissa.');
  }catch{state.recordStream?.getTracks().forEach(t=>t.stop());state.recordStream=null;state.recording=false;lockRecording(false);setStatus('Tallennus ei käynnistynyt tässä selaimessa. Kokeile ajantasaista Chromea tai Safaria.',true)}
}
function stopRecording(){
  if(!state.recording)return;state.recording=false;
  state.finalizing=true;$('record').disabled=true;
  if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop();
  $('record').classList.remove('recording');$('record').innerHTML='<span class="record-dot"></span> Tallenna video';$('timer').hidden=true;
}
function drawHand(h,dt,now){
  if(settings.effect==='cyber')return;
  const color=colorFor(h.colorIndex),color2=colorFor(h.colorIndex+1),unit=H/720,energy=(.35+settings.intensity)*(1+state.volume*1.4);
  h.charge=clamp(h.charge+(h.closed||h.pinch?dt*.8:-dt*1.7));
  const previous=h.previousTips;
  tx.lineCap='round';tx.lineJoin='round';tx.globalCompositeOperation='lighter';
  h.tips.forEach((tip,i)=>{
    if(previous&&distance(tip,previous[i])<W*.25&&!h.closed){
      const last=previous[i],c=i%2?color:color2;
      if(settings.effect==='ribbons'){
        // Join midpoint-to-midpoint quadratics with a shared tangent, so the
        // path remains smooth even at the camera's lower detection rate.
        const older=h.beforeTips?.[i]||last;
        const start={x:(older.x+last.x)/2,y:(older.y+last.y)/2};
        const end={x:(last.x+tip.x)/2,y:(last.y+tip.y)/2};
        if(distance(start,end)>.12*unit){
          tx.save();
          for(const [width,alpha,tint] of [[14+settings.glow*10,.035*energy,c],[5+settings.intensity*3,.16*energy,c],[1.6+settings.intensity,.72,'#e8ffff']]){
            tx.strokeStyle=tint;tx.lineWidth=width*unit;tx.globalAlpha=alpha;
            tx.beginPath();tx.moveTo(start.x,start.y);tx.quadraticCurveTo(last.x,last.y,end.x,end.y);tx.stroke();
          }
          tx.restore();
        }
      }else{
        line(tx,last,tip,c,(2.5+settings.intensity*2)*unit,.28*energy);
        line(tx,last,tip,'#e8ffff',.8*unit,.8);
        if(Math.random()<dt*26*settings.intensity){state.particles.push({x:tip.x,y:tip.y,vx:(Math.random()-.5)*40*unit,vy:(Math.random()-.5)*40*unit,life:.5+Math.random()*.7,max:1.2,color:c,size:Math.random()*1.5*unit+.5})}
      }
    }
    if(!h.closed&&settings.effect!=='ribbons')drawStar(tx,tip.x,tip.y,(1.3+state.volume)*unit,'#f2fffa');
  });
  h.beforeTips=h.closed?null:previous;
  h.previousTips=h.closed?null:h.tips.map(p=>({...p}));
  if(h.closed||h.pinch){
    const p=h.pinch?{x:(h.tips[0].x+h.tips[1].x)/2,y:(h.tips[0].y+h.tips[1].y)/2}:h.palm;
    const r=(12+h.charge*30+Math.sin(now*.012)*2)*unit;
    const g=tx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#ffffffc0');g.addColorStop(.15,color+'b0');g.addColorStop(1,color+'00');tx.fillStyle=g;tx.fillRect(p.x-r,p.y-r,r*2,r*2);
    gestureRing(p.x,p.y,r*1.4,h.angle+now*.0005,color,settings.effect!=='ribbons');
  }
  if(!h.closed&&h.openness>=.5){
    const span=distance(h.tips[1],h.tips[4]);
    if(settings.effect==='sigils')gestureRing(h.palm.x,h.palm.y,Math.max(25*unit,span*.62),-h.angle+now*.0002,color,1);
    if(settings.effect==='prism'){
      tx.globalAlpha=.16*energy;tx.fillStyle=color;tx.beginPath();h.tips.forEach(p=>tx.lineTo(p.x,p.y));tx.closePath();tx.fill();tx.globalAlpha=1;
      for(let i=0;i<5;i++){line(tx,h.tips[i],h.tips[(i+2)%5],i%2?color:color2,.7*unit,.36);line(tx,h.palm,h.tips[i],color,.7*unit,.2)}
    }else if(settings.effect!=='ribbons'){
      for(let i=1;i<4;i++){const a=h.tips[i],b=h.tips[i+1];tx.strokeStyle=color2;tx.globalAlpha=.17*h.openness;tx.lineWidth=.8*unit;tx.beginPath();tx.moveTo(a.x,a.y);tx.quadraticCurveTo(h.palm.x,h.palm.y,b.x,b.y);tx.stroke();tx.globalAlpha=1}
    }
  }
  tx.globalCompositeOperation='source-over';
}
function drawRibbonTips(h){
  if(h.closed)return;
  const u=H/720;
  ctx.save();ctx.globalCompositeOperation='screen';
  h.tips.forEach((tip,i)=>{
    const previous=h.previousTips?.[i],older=h.beforeTips?.[i];
    const p=previous&&older?{x:(previous.x+older.x)/2,y:(previous.y+older.y)/2}:tip;
    const color=colorFor(h.colorIndex+(i%2?0:1)),r=(6+settings.glow*9)*u;
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
    g.addColorStop(0,'#e8ffffcc');g.addColorStop(.18,color+'88');g.addColorStop(1,color+'00');
    ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
  });
  ctx.restore();
}
function drawSigilGlyphs(h,now){
  if(h.closed||h.openness<.5)return;
  const u=H/720,r=Math.max(25*u,distance(h.tips[1],h.tips[4])*.62),color=colorFor(h.colorIndex);
  ctx.save();ctx.translate(h.palm.x,h.palm.y);ctx.rotate(-h.angle+now*.0002);
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=settings.glow*14*u;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(32*u,Math.min(48*u,r*.4))}px serif`;
  const glyphs=['∞','⟁','∴','⨀','🜂','∇'];
  glyphs.forEach((glyph,i)=>{const angle=i*Math.PI/3;ctx.save();ctx.translate(Math.cos(angle)*r*1.52,Math.sin(angle)*r*1.52);ctx.rotate(angle+Math.PI/2);ctx.globalAlpha=.85;ctx.fillText(glyph,0,0);ctx.restore()});
  ctx.restore();
}
function drawVortices(now){
  state.vortices=state.vortices.filter(v=>now-v.born<3800);
  for(const v of state.vortices){
    const age=Math.max(0,(now-v.born)/1000),u=v.unit;
    const opening=1-Math.exp(-age*7),collapse=clamp((age-3.05)/.65);
    const radius=(145+settings.intensity*75)*u*opening*(1-collapse)**1.4;
    const opacity=clamp(age*4)*clamp((3.8-age)/.35);
    ctx.save();ctx.translate(v.x,v.y);ctx.globalCompositeOperation='source-over';
    ctx.shadowColor=v.color;ctx.shadowBlur=(14+settings.glow*26)*u;
    // Uneven wisps share the inward flow without forming a uniform wheel.
    for(let i=0;i<11;i++){
      const q=(age*(.19+(i%3)*.027)+i*.381)%1,a=i*2.399+q*9.5;
      const rr=radius*(1-q)**.8,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.9;
      const size=Math.max(1*u,radius*(.12+.07*Math.sin(i*2.1)**2));
      const mist=ctx.createRadialGradient(x,y,0,x,y,size);
      mist.addColorStop(0,v.color+'45');mist.addColorStop(.35,v.color+'20');mist.addColorStop(1,v.color+'00');
      ctx.globalAlpha=opacity*Math.sin(q*Math.PI)*.7;ctx.fillStyle=mist;ctx.shadowBlur=0;ctx.fillRect(x-size,y-size,size*2,size*2);
    }
    ctx.shadowBlur=(10+settings.glow*20)*u;
    for(let arm=0;arm<7;arm++){
      const seed=arm*2.399,head=(age*(.28+(arm%3)*.038)+arm*.371)%1;
      const span=.38+.2*Math.sin(seed+1)**2;
      const drawFlame=(width,fill,alpha)=>{
        const left=[],right=[];
        for(let j=0;j<=64;j++){
          const t=j/64,q=head-span+t*span;if(q<0)continue;
          const ripple=Math.sin(q*39+seed)*.022+Math.sin(q*83-seed)*.009;
          const r=radius*((1-q)**.9+ripple*(1-q)),a=seed+q*Math.PI*(3.1+arm*.11)+age*.09;
          const torn=.32+.68*Math.sin(t*19+seed+age*.3)**2;
          const thickness=width*u*Math.sin(t*Math.PI)**.7*(1-q)**.45*torn*(1+.25*Math.sin(seed));
          const x=Math.cos(a)*r,y=Math.sin(a)*r*(.87+.07*Math.sin(seed));
          left.push({x:x+Math.cos(a)*thickness,y:y+Math.sin(a)*thickness});right.push({x:x-Math.cos(a)*thickness,y:y-Math.sin(a)*thickness});
        }
        if(left.length<2)return;
        const first=left[0],last=left.at(-1),light=ctx.createLinearGradient(first.x,first.y,last.x+.01,last.y);
        light.addColorStop(0,fill+'00');light.addColorStop(.18,fill+'80');light.addColorStop(.43,fill+'28');light.addColorStop(.69,fill+'ff');light.addColorStop(1,fill+'00');
        ctx.globalAlpha=opacity*alpha;ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(first.x,first.y);left.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));right.reverse().forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();
      };
      drawFlame(24,v.color,.2);drawFlame(11,v.color,.78);drawFlame(2.5,'#e9fff8',.65);
    }
    // The core occludes the inner wisps; its rim is deliberately incomplete.
    const core=Math.max(1*u,radius*.19);
    ctx.shadowBlur=0;const darkness=ctx.createRadialGradient(-core*.12,core*.08,0,0,0,core*1.55);
    darkness.addColorStop(0,'#01030afa');darkness.addColorStop(.52,'#02040bef');darkness.addColorStop(.78,'#03061190');darkness.addColorStop(1,'#03061100');
    ctx.globalAlpha=opacity;ctx.fillStyle=darkness;ctx.beginPath();ctx.arc(0,0,core*1.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=v.color;ctx.shadowColor=v.color;ctx.shadowBlur=settings.glow*18*u;ctx.lineWidth=1.5*u;
    for(let i=0;i<3;i++){const a=i*2.2+age*.36;ctx.globalAlpha=opacity*(.25+i*.12);ctx.beginPath();ctx.arc(0,0,core*(1+i*.05),a,a+.45+i*.2);ctx.stroke()}
    const glyphs=['∞','⟁','∴','⨀','🜂','∇'];ctx.fillStyle=v.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${34*u*(1-collapse*.7)}px serif`;
    glyphs.forEach((g,i)=>{const a=i*Math.PI/3-age*.15;ctx.globalAlpha=opacity*.8*(1-collapse);ctx.fillText(g,Math.cos(a)*radius*1.14,Math.sin(a)*radius*1.14)});
    if(collapse>.6){const spark=Math.sin(clamp((age-3.4)/.4)*Math.PI);ctx.globalAlpha=spark;ctx.shadowBlur=30*u;ctx.fillStyle='#efffff';ctx.beginPath();ctx.arc(0,0,(2+spark*4)*u,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
}
function drawSkeleton(h){
  if(!h.points)return;
  ctx.save();ctx.strokeStyle='#d8fff5';ctx.globalAlpha=.5;ctx.lineWidth=H/900;
  for(const chain of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]]){ctx.beginPath();chain.forEach(i=>ctx.lineTo(h.points[i].x,h.points[i].y));ctx.stroke()}
  ctx.fillStyle='#fff';h.points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,H/500,0,Math.PI*2);ctx.fill()});ctx.restore();
}
function render(now){
  requestAnimationFrame(render);
  const dt=Math.min((now-(state.last||now))/1000,.05)||1/60;state.last=now;
  if(document.hidden&&!state.recording)return;
  if(state.live&&video.readyState>=2&&now-state.lastDetect>50&&state.lastVideo!==video.currentTime){
    state.lastDetect=now;state.lastVideo=video.currentTime;
    try{detectHands(now)}catch{stopCamera();setStatus('Käsienseuranta keskeytyi. Avaa kamera uudelleen; kokeile tarvittaessa toista selainta.',true)}
  }
  if(state.analyser){state.analyser.getByteFrequencyData(state.audioData);const raw=state.audioData.reduce((a,b)=>a+b,0)/state.audioData.length/150;state.volume+=(clamp(raw)-state.volume)*.24}
  const hands=state.live?[...state.hands.values()].filter(h=>now-h.lastSeen<240):demoHands(now);
  const eraseAlpha=1-Math.exp(-dt/(.07+settings.trails*1.15));
  tx.globalCompositeOperation='destination-out';tx.fillStyle=`rgba(0,0,0,${eraseAlpha})`;tx.fillRect(0,0,W,H);tx.globalCompositeOperation='source-over';
  tailCleanupElapsed+=dt;tailEraseAlpha=Math.min(tailEraseAlpha,eraseAlpha);
  // Four small tail corrections per second, rather than reading pixels every
  // frame. Keep v1's accumulation, glow, and all fresh gesture drawing intact.
  if(tailCleanupElapsed>=.25){
    const pixels=tx.getImageData(0,0,trail.width,trail.height);
    if(clearQuantizedTail(pixels.data,tailEraseAlpha))tx.putImageData(pixels,0,0);
    tailCleanupElapsed=0;tailEraseAlpha=1;
  }
  sigilLight.current=[];
  for(const h of hands)drawHand(h,dt,now);
  if(settings.effect!=='cyber'&&hands.length===2&&hands.every(h=>h.pinch)){
    const a=hands[0].tips[1],b=hands[1].tips[1];tx.globalCompositeOperation='lighter';line(tx,a,b,colorFor(0),2*H/720,.5);gestureRing((a.x+b.x)/2,(a.y+b.y)/2,distance(a,b)*.35,now*.0004,colorFor(1));tx.globalCompositeOperation='source-over';
  }
  state.particles=state.particles.filter(p=>p.life>0).slice(-650);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*.8);p.vy*=Math.exp(-dt*.8);tx.globalAlpha=clamp(p.life/p.max);tx.fillStyle=p.color;tx.beginPath();tx.arc(p.x,p.y,p.size,0,Math.PI*2);tx.fill()}
  tx.globalAlpha=1;
  state.rings=state.rings.filter(r=>r.life>0);for(const r of state.rings){r.life-=dt;r.r+=dt*230*H/720;tx.globalAlpha=clamp(r.life)*.65;tx.strokeStyle=r.color;tx.lineWidth=1.1*H/720;tx.beginPath();tx.arc(r.x,r.y,r.r,0,Math.PI*2);tx.stroke()}tx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#04050a';ctx.fillRect(0,0,W,H);
  if(state.live&&video.readyState>=2){
    const scale=Math.max(W/video.videoWidth,H/video.videoHeight),dw=video.videoWidth*scale,dh=video.videoHeight*scale;
    ctx.save();ctx.globalAlpha=settings.cameraMix;if(settings.mirror){ctx.translate(W,0);ctx.scale(-1,1)}ctx.drawImage(video,(W-dw)/2,(H-dh)/2,dw,dh);ctx.restore();
  }else{
    const g=ctx.createRadialGradient(W*.55,H*.4,0,W*.55,H*.4,W*.5);g.addColorStop(0,settings.palette==='ember'?'#261014':'#141229');g.addColorStop(1,'#04060b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#babddc';for(let i=0;i<65;i++){const x=((i*7919)%997)/997*W,y=((i*3571)%991)/991*H;ctx.globalAlpha=.08+.13*(1+Math.sin(now*.0005+i))/2;ctx.fillRect(x,y,H/700,H/700)}ctx.globalAlpha=1;
  }
  ctx.globalCompositeOperation='screen';
  if(settings.glow>.01){
    bx.clearRect(0,0,bloom.width,bloom.height);bx.filter=`blur(${3+settings.glow*8}px)`;bx.drawImage(trail,0,0,bloom.width,bloom.height);bx.filter='none';ctx.globalAlpha=settings.glow;ctx.drawImage(bloom,0,0,W,H);
  }
  ctx.globalAlpha=.65+settings.intensity*.35;ctx.drawImage(trail,0,0,W,H);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(settings.effect==='ribbons')hands.forEach(drawRibbonTips);
  if(settings.effect==='cyber')cyberHud.draw(ctx,hands,now,W,H,{glow:settings.glow,intensity:settings.intensity,colors:palettes[settings.palette],live:state.live});
  if(settings.effect==='sigils'){drawSigilLight(now);hands.forEach(h=>{if(!state.vortices.some(v=>now-v.born<3800&&distance(v,h.palm)<220*H/720))drawSigilGlyphs(h,now)});drawVortices(now)}
  if(settings.skeleton&&state.live)hands.forEach(drawSkeleton);
  presentFrame(now);
  state.fpsFrames++;if(now-state.fpsAt>1000){$('fps').textContent=`${Math.round(state.fpsFrames*1000/(now-state.fpsAt))} FPS`;state.fpsAt=now;state.fpsFrames=0}
  if(now-state.lastUi>150){
    state.lastUi=now;$('audioLevel').style.width=`${state.volume*100}%`;
    if(state.live){$('handStatus').textContent=hands.length?`${hands.length} ${hands.length===1?'KÄSI':'KÄTTÄ'}`:'ETSITÄÄN KÄSIÄ';$('gestureReadout').textContent=hands.length?hands.map(h=>h.label).join(' / '):'NÄYTÄ KÄDET KAMERALLE'}
    if(state.recording){const sec=Math.floor((now-state.recordStarted)/1000);$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  }
}

$('camera').onclick=()=>state.live?stopCamera():startCamera();
$('cameraSelect').onchange=()=>startCamera($('cameraSelect').value);
$('record').onclick=()=>state.recording?stopRecording():startRecording();
$('audio').onchange=toggleAudio;
document.querySelectorAll('input[name=palette]').forEach(r=>r.onchange=()=>{settings.palette=r.value;clearEffects()});
['glow','trails','intensity','cameraMix'].forEach(id=>$(id).oninput=()=>{settings[id]=Number($(id).value)/100;$(id+'Value').textContent=$(id).value+'%'});
['mirror','skeleton'].forEach(id=>$(id).onchange=()=>{settings[id]=$(id).checked;if(id==='mirror'){state.hands.clear();clearEffects()}});
$('effect').onchange=()=>{settings.effect=$('effect').value;clearEffects()};
$('aspect').onchange=()=>{if(state.recording||state.finalizing)return;settings.aspect=$('aspect').value;resize(H)};
$('resolution').onchange=()=>{resize(Number($('resolution').value));state.hands.clear()};
$('clear').onclick=clearEffects;
function film(active){document.body.classList.toggle('film',active);$('exitFilm').hidden=!active}
$('film').onclick=()=>film(true);$('exitFilm').onclick=()=>film(false);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else film(true)}catch{film(true)}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')film(false);if(e.target.closest('input,select,button,a'))return;if(e.key.toLowerCase()==='f')film(!document.body.classList.contains('film'));if(e.key.toLowerCase()==='c')clearEffects()});
function pointerPosition(e){const r=canvas.getBoundingClientRect();const scale=Math.min(r.width/W,r.height/H),ox=(r.width-W*scale)/2,oy=(r.height-H*scale)/2;return{x:clamp((e.clientX-r.left-ox)/scale,0,W),y:clamp((e.clientY-r.top-oy)/scale,0,H)}}
canvas.addEventListener('pointermove',e=>{if(!state.live){state.pointer=pointerPosition(e);$('demoCaption').hidden=true}});
canvas.addEventListener('pointerdown',e=>{if(!state.live){canvas.setPointerCapture(e.pointerId);state.pointer=pointerPosition(e);state.pointerDown=true;$('demoCaption').hidden=true}});
canvas.addEventListener('pointerup',()=>{if(!state.live){state.pointerDown=false;if(state.pointer)burst(state.pointer.x,state.pointer.y,colorFor(0),90)}});
canvas.addEventListener('pointercancel',()=>{state.pointerDown=false;state.pointer=null;state.hands.clear()});
canvas.addEventListener('pointerleave',()=>{if(!state.live&&!state.pointerDown){state.pointer=null;state.hands.clear()}});
window.addEventListener('beforeunload',e=>{if(state.recording){e.preventDefault();e.returnValue=''}});
window.addEventListener('pagehide',()=>{if(state.recording)stopRecording();state.stream?.getTracks().forEach(t=>t.stop());stopAudio();state.model?.close()});
resize(720);requestAnimationFrame(render);
