import assert from 'node:assert/strict';
import {clearQuantizedTail} from '../dist/trail-decay.mjs';

// Quantized destination-out simulation, not a browser/GPU test. Exercise both
// nearest rounding and upward rounding as a conservative residue case.
for(const fps of [15,30,60,120,144,240])for(const trails of [0,.09,.65,1])for(const round of [Math.round,Math.ceil]){
  const dt=Math.min(1/fps,.05),tau=.07+trails*1.15,erase=1-Math.exp(-dt/tau);
  const pixels=new Uint8ClampedArray(256*4);
  for(let a=1;a<=255;a++)pixels.set([100,170,240,a],a*4);
  let elapsed=0;
  for(let frame=0;frame<Math.ceil((8*tau+3)/dt);frame++){
    for(let i=3;i<pixels.length;i+=4)pixels[i]=round(pixels[i]*(1-erase));
    elapsed+=dt;
    if(elapsed>=.25){clearQuantizedTail(pixels,erase);elapsed=0}
  }
  assert(pixels.every((value,index)=>index%4!==3||value===0),`all residues must vanish: ${fps} FPS, trails ${trails}, ${round.name}`);
  let original=255;
  for(let i=0;i<10000;i++)original=round(original*(1-erase));
  if(fps>=30)assert(original>0,'regression fixture must reproduce the original stuck alpha');
}
const data=new Uint8ClampedArray([12,34,56,255,78,90,12,128,150,100,50,1]);
clearQuantizedTail(data,.02);
assert.deepEqual([...data],[12,34,56,255,78,90,12,128,0,0,0,0]);
assert.equal(clearQuantizedTail(new Uint8ClampedArray(16),.02),false);
console.log('Trail regression passed: finite fade for every alpha, six frame rates, all trail settings; bright pixels unchanged.');
