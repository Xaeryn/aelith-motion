import assert from 'node:assert/strict';
import {classifyHand,mapPoint} from '../dist/gestures.mjs';

function hand(open=true){
  const p=Array.from({length:21},()=>({x:.5,y:.7}));
  p[0]={x:.5,y:.9};p[4]={x:.18,y:.53};
  for(let f=0;f<4;f++){
    const base=5+f*4,x=.35+f*.12;
    p[base]={x,y:.64};p[base+1]={x,y:.48};p[base+2]={x,y:open?.36:.65};p[base+3]={x,y:open?.24:.75};
  }
  return p;
}
const open=hand();
assert.equal(classifyHand(open).openness,1);
assert.equal(classifyHand(open).closed,false);
assert.equal(classifyHand(hand(false)).closed,true);
// Classification must survive camera scale and wrist rotation.
const rotated=open.map(p=>({x:250-p.y*400,y:100+p.x*400}));
assert.equal(classifyHand(rotated).openness,1);
const palm=.36,pinched=hand();pinched[4]={x:pinched[8].x+palm*.2,y:pinched[8].y};
assert.equal(classifyHand(pinched).pinch,true);
pinched[4].x=pinched[8].x+palm*.4;
assert.equal(classifyHand(pinched,{pinch:true}).pinch,true);
assert.equal(classifyHand(pinched,{pinch:false}).pinch,false);
pinched[4].x=pinched[8].x+palm*.55;
assert.equal(classifyHand(pinched,{pinch:true}).pinch,false);
// A 4:3 feed is center-cropped into 16:9. Landmarks must follow that crop.
assert.deepEqual(mapPoint({x:.5,y:.5},1280,720,640,480,true),{x:640,y:360,z:0});
assert.equal(mapPoint({x:0,y:0},1280,720,640,480,false).y,-120);
const a=mapPoint({x:.2,y:.3},1920,1080,640,480,false);
const b=mapPoint({x:.2,y:.3},1920,1080,640,480,true);
assert.equal(a.x+b.x,1920);assert.equal(a.y,b.y);
console.log('Gesture checks passed: open/fist, rotation, pinch hysteresis, crop and mirror.');
const forgiving={forgiving:true},relaxed=hand();
relaxed[4]={x:relaxed[8].x+palm*.4,y:relaxed[8].y};
assert.equal(classifyHand(relaxed,{},forgiving).pinch,true);
relaxed[4].x=relaxed[8].x+palm*.58;
assert.equal(classifyHand(relaxed,{pinch:true},forgiving).pinch,true);
relaxed[4].x=relaxed[8].x+palm*.9;
assert.equal(classifyHand(relaxed,{pinch:true,pinchRatio:.58},forgiving).pinch,false);
const side=hand();side[5].x=.49;side[17].x=.51;side[4]={x:side[8].x+.04,y:side[8].y};
assert.equal(classifyHand(side,{},forgiving).pinch,true);
assert.equal(classifyHand(side).pinch,false);
console.log('Cyber pinch: easier entry, hysteresis, explicit release and foreshortened palm passed.');
