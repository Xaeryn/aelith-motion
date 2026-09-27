// A visual score generated from tracked gestures; these lines are not executed.
export class CyberHud {
  constructor(){this.reset()}
  reset(){this.lines=[];this.samples=new Map();this.tick=-Infinity;this.sequence=0;this.focus=null;this.matrices=[];this.anchors=new Map();this.releasedVectors=[];this.pair=null}
  release(x,y,color,now,height){this.matrices.push({x,y,color,born:now,unit:height/720});this.matrices=this.matrices.slice(-6)}
  circuit(ctx,h,now,u,color){
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.6*u;
    const nodes=h.closed?Array.from({length:5},(_,i)=>({x:h.palm.x+(i%3-1)*18*u,y:h.palm.y+(Math.floor(i/3)-.5)*18*u})):h.tips;
    for(let i=0;i<4;i++){
      const a=nodes[i],b=nodes[i+1],dx=b.x-a.x,dy=b.y-a.y;
      const diagonal=Math.min(Math.abs(dx),Math.abs(dy))*.65;
      const mid={x:b.x-Math.sign(dx)*diagonal,y:a.y};
      const end={x:b.x,y:a.y+Math.sign(dy)*diagonal};
      const path=[a,mid,end,b];
      ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of path.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
      const lengths=path.slice(1).map((p,j)=>Math.hypot(p.x-path[j].x,p.y-path[j].y));
      let d=((now*.0006+i*.23)%1)*lengths.reduce((sum,n)=>sum+n,0);
      for(let j=0;j<3;j++){
        if(d<=lengths[j]&&lengths[j]>0){const t=d/lengths[j],p=path[j],q=path[j+1];ctx.globalAlpha=1;ctx.fillRect(p.x+(q.x-p.x)*t-3*u,p.y+(q.y-p.y)*t-3*u,6*u,6*u);break}d-=lengths[j];
      }
    }
    if(h.closed){ctx.globalAlpha=.8;ctx.strokeRect(h.palm.x-28*u,h.palm.y-28*u,56*u,56*u);ctx.font=`${12*u}px monospace`;ctx.fillText('BUFFER',h.palm.x-24*u,h.palm.y+36*u)}
    ctx.restore();
  }
  updateVectors(hands,now,height){
    // Preserve the anchor through brief missed pinch detections or missing hands.
    for(const [id,v] of this.anchors){
      if(now-v.lastPinch>240){v.released=now;this.releasedVectors.push(v);this.anchors.delete(id)}
    }
    for(const h of hands){
      if(!h.pinch)continue;
      const p={x:(h.tips[0].x+h.tips[1].x)/2,y:(h.tips[0].y+h.tips[1].y)/2};
      let v=this.anchors.get(h.id);
      if(!v){v={start:{...p},end:{...p},lastPinch:now,colorIndex:h.colorIndex,trail:[],sampleAt:now,path:[{...p}],speed:0,fragments:new Map()};this.anchors.set(h.id,v)}
      const elapsed=Math.max(16,now-v.lastPinch);
      const speed=Math.min(1,Math.hypot(p.x-v.end.x,p.y-v.end.y)/elapsed*720/height/1.5);
      v.speed+=(speed-v.speed)*.22;
      const tail=v.path.at(-1);
      if(Math.hypot(p.x-tail.x,p.y-tail.y)>18*height/720){v.path.push({...p});if(v.path.length>40)v.path.splice(1,1)}
      v.end=p;v.lastPinch=now;
      const previous=v.trail.at(-1);
      if(now-v.sampleAt>=100&&(!previous||Math.hypot(p.x-previous.x,p.y-previous.y)>6*height/720)){
        v.trail.push({...p,born:now});v.trail=v.trail.slice(-10);v.sampleAt=now;
      }
    }
    this.releasedVectors=this.releasedVectors.filter(v=>now-v.released<1300).slice(-8);
    for(const v of [...this.anchors.values(),...this.releasedVectors])v.trail=v.trail.filter(p=>now-p.born<850);
  }
  drawVectors(ctx,hands,now,width,height,colors){
    this.updateVectors(hands,now,height);
    const u=height/720;
    for(const v of [...this.releasedVectors,...this.anchors.values()]){
      const alpha=v.released===undefined?1:Math.max(0,1-(now-v.released)/1300);
      const color=colors[(v.colorIndex||0)%colors.length];
      ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.globalAlpha=alpha;
      this.drawDataStream(ctx,v,now,u,alpha);
      ctx.restore();
    }
  }
  drawDataStream(ctx,v,now,u,alpha){
    const points=[...v.path,v.end],segments=[];let total=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
      if(length<.01)continue;
      segments.push({a,b,length,from:total});total+=length;
    }
    if(total<8*u)return;
    const releaseAge=v.released===undefined?null:now-v.released;
    const at=d=>{
      const seg=segments.find(s=>d<=s.from+s.length)||segments.at(-1),t=Math.max(0,Math.min(1,(d-seg.from)/seg.length));
      return{x:seg.a.x+(seg.b.x-seg.a.x)*t,y:seg.a.y+(seg.b.y-seg.a.y)*t,angle:Math.atan2(seg.b.y-seg.a.y,seg.b.x-seg.a.x)};
    };
    const snippets=['⟨ψ⟩ field.write();','[ 0xA7 → 0xF2 ]','∇ tensor.move(v)','Σ sync.commit();','{ Δx ⊗ Δy }','node.connect()'];
    ctx.save();ctx.lineWidth=1.3*u;
    // A short pull already opens a cluster; larger pulls add more fragments.
    // The former 110–158 px spacing could leave normal gestures with one item.
    const count=Math.min(18,Math.max(3,Math.ceil(total/(55*u))));
    for(let i=0;i<count;i++){
      const d=(i+.35)/count*total;
      const p=at(d),side=i%2?1:-1,offset=(i%3===0?22:68+(i%4)*21)*u*side;
      const along=((i%3)-1)*44*u;
      const x=p.x-Math.sin(p.angle)*offset+Math.cos(p.angle)*along,y=p.y+Math.cos(p.angle)*offset+Math.sin(p.angle)*along;
      const delay=d/Math.max(total,1)*650;
      const pulse=releaseAge===null ? .15+.15*Math.sin(now*.003+i*1.7):Math.max(0,1-Math.abs(releaseAge-delay-100)/130);
      const fade=releaseAge===null?Math.min(1,(total-8*u)/(20*u)):Math.max(0,1-Math.max(0,releaseAge-delay-160)/480);
      if(!v.fragments)v.fragments=new Map();
      let fragment=v.fragments.get(i);
      if(!fragment){fragment={x:p.x,y:p.y,born:now,last:now,history:[]};v.fragments.set(i,fragment)}
      const follow=1-Math.exp(-Math.max(0,now-fragment.last)/110);
      fragment.x+=(x-fragment.x)*follow;fragment.y+=(y-fragment.y)*follow;fragment.last=now;
      fragment.history=fragment.history.filter(h=>now-h.born<150);
      if(!fragment.history.length||now-fragment.history.at(-1).born>35)fragment.history.push({x:fragment.x,y:fragment.y,born:now});
      const appear=1-Math.exp(-Math.max(0,now-fragment.born)/130);
      const opacity=alpha*fade*appear;
      // Brief moving echoes share the glyph's shape, never a solid strip.
      ctx.save();ctx.font=`${(i%3===0?21:14)*u}px monospace`;
      fragment.history.forEach(h=>{ctx.globalAlpha=opacity*.12*(1-(now-h.born)/150);ctx.fillText(snippets[i%snippets.length],h.x-30*u,h.y-10*u)});ctx.restore();
      ctx.save();ctx.translate(fragment.x,fragment.y);
      // Detached, upright fragments: no filled band, center rail or arrow.
      const size=(i%3===0?21:14)*u;
      ctx.font=`${size}px monospace`;ctx.globalAlpha=opacity*(.75+pulse*.25);
      ctx.fillText(snippets[i%snippets.length],-30*u,-size/2);
      ctx.globalAlpha=opacity*(.35+pulse*.5);
      const w=(i%3===0?155:120)*u,h=(i%3===0?48:30)*u;
      ctx.beginPath();ctx.moveTo(-40*u+9*u,-h/2);ctx.lineTo(-40*u,-h/2);ctx.lineTo(-40*u,h/2);ctx.lineTo(-31*u,h/2);ctx.stroke();
      if(i%3===0){
        ctx.font=`${10*u}px monospace`;ctx.globalAlpha=opacity*.5;
        ctx.fillText(`op.${String(i).padStart(2,'0')} / ${(d/total).toFixed(2)}`,-27*u,22*u);
        ctx.beginPath();ctx.moveTo(w-48*u,-h/2);ctx.lineTo(w-40*u,-h/2);ctx.lineTo(w-40*u,-h/2+10*u);ctx.stroke();
      }
      // Short local branches, separated from neighboring fragments.
      if(i%3!==0){
        ctx.globalAlpha=opacity*.32;ctx.beginPath();ctx.moveTo(-44*u,0);ctx.lineTo(-60*u,0);ctx.lineTo(-70*u,-side*18*u);ctx.stroke();
        for(let j=0;j<3;j++){ctx.globalAlpha=opacity*(.4+pulse*.5);ctx.strokeRect((-73-j*9)*u,(-side*18+j*side*7-3)*u,5*u,5*u)}
      }
      if(pulse>.2){ctx.globalAlpha=opacity*pulse;ctx.fillRect(-43*u,-h/2-5*u,18*u,3*u)}
      ctx.restore();
    }
    ctx.restore();
  }
  drawPairNetwork(ctx,now,u,colors){
    const active=[...this.anchors.values()];
    const engaged=active.length===2;
    if(!this.pair&&!engaged)return;
    if(!this.pair)this.pair={alpha:0,last:now,x:0,y:0,span:0,angle:0,ready:false};
    const pair=this.pair,dt=Math.max(0,Math.min(100,now-pair.last));pair.last=now;
    const blend=1-Math.exp(-dt/100);
    pair.alpha+=((engaged?1:0)-pair.alpha)*(1-Math.exp(-dt/180));
    if(engaged){
      const [a,b]=active.map(v=>v.end),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const span=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
      if(!pair.ready){Object.assign(pair,{x,y,span,angle,ready:true})}
      else{pair.x+=(x-pair.x)*blend;pair.y+=(y-pair.y)*blend;pair.span+=(span-pair.span)*blend;pair.angle+=Math.atan2(Math.sin(angle-pair.angle),Math.cos(angle-pair.angle))*blend}
    }
    if(!engaged&&pair.alpha<.01){this.pair=null;return}
    const half=pair.span/2,depth=Math.min(100*u,Math.max(18*u,pair.span*.2));
    const nodes=[{x:-half,y:0},...Array.from({length:12},(_,i)=>({x:-half+(Math.floor(i/3)+1)*pair.span/5,y:((i%3)-1)*depth*(.65+.35*Math.sin((Math.floor(i/3)+1)*Math.PI/5))})),{x:half,y:0}];
    const edges=[];
    for(let i=1;i<=3;i++)edges.push([0,i],[i+9,13]);
    for(let c=0;c<4;c++){for(let r=0;r<2;r++)edges.push([1+c*3+r,2+c*3+r]);if(c<3)for(let r=0;r<3;r++){edges.push([1+c*3+r,4+c*3+r]);if(r<2)edges.push([1+c*3+r,5+c*3+r])}}
    ctx.save();ctx.translate(pair.x,pair.y);ctx.rotate(pair.angle);ctx.strokeStyle=colors[0];ctx.fillStyle=colors[0];ctx.shadowColor=colors[0];ctx.lineWidth=1.2*u;
    for(const [i,j] of edges){const a=nodes[i],b=nodes[j],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2+Math.sin(i*1.7+j)*depth*.35;
      ctx.globalAlpha=pair.alpha*.32;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(cx,cy,b.x,b.y);ctx.stroke();
      const t=(now*.0005+i*.17)%1,k=1-t,x=k*k*a.x+2*k*t*cx+t*t*b.x,y=k*k*a.y+2*k*t*cy+t*t*b.y;
      ctx.globalAlpha=pair.alpha*.85;ctx.beginPath();ctx.arc(x,y,2.5*u,0,Math.PI*2);ctx.fill()}
    nodes.forEach((p,i)=>{ctx.globalAlpha=pair.alpha*.9;ctx.beginPath();ctx.arc(p.x,p.y,5*u,0,Math.PI*2);ctx.stroke();if(i%4===0){ctx.font=`${14*u}px monospace`;ctx.fillText(['ψ','∇','Σ','⊗'][Math.floor(i/4)%4],p.x+9*u,p.y-17*u)}});
    ctx.restore();
  }
  numberMatrix(ctx,x,y,rows,cols,cw,ch,phase,alpha,color,label,u,seed,attention=false){
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.5*u;
    ctx.globalAlpha=alpha;ctx.font=`${11*u}px monospace`;ctx.fillText(label,x,y-21*u);
    const w=cols*cw,h=rows*ch,lip=7*u;
    for(const [edge,sign] of [[x-5*u,1],[x+w+5*u,-1]]){
      ctx.beginPath();ctx.moveTo(edge+sign*lip,y);ctx.lineTo(edge,y);ctx.lineTo(edge,y+h);ctx.lineTo(edge+sign*lip,y+h);ctx.stroke();
    }
    ctx.font=`${Math.min(12*u,cw/3.7,ch*.52)}px monospace`;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const raw=Math.sin((row+1)*12.9898+(col+1)*7.233+seed*3.71);
      const value=attention?Math.exp(-Math.abs(row-col)*.7)*(.6+.4*Math.abs(raw)):raw;
      const wave=Math.max(0,1-Math.abs((phase%2)*(rows+cols)-(row+col))/2.5);
      ctx.globalAlpha=alpha*(.025+Math.abs(value)*.15+wave*.3);
      ctx.fillRect(x+col*cw+1,y+row*ch+1,cw-2,ch-2);
      ctx.globalAlpha=alpha*(.42+.4*Math.abs(value)+wave*.18);
      const text=attention?value.toFixed(2):(value>=0?'+':'')+value.toFixed(2);
      ctx.fillText(text,x+col*cw+3*u,y+row*ch+ch*.25);
    }
    ctx.restore();
  }
  drawMatrices(ctx,now,width,height){
    this.matrices=this.matrices.filter(m=>now-m.born<3400);
    for(const m of this.matrices){
      const age=Math.max(0,now-m.born),u=m.unit;
      const opening=1-Math.pow(1-Math.min(1,age/550),3);
      const merge=Math.max(0,Math.min(1,(age-1000)/750));
      const fade=Math.min(1,(3400-age)/650);
      const cx=Math.max(235*u,Math.min(width-235*u,m.x));
      const cy=Math.max(150*u,Math.min(height-145*u,m.y));
      ctx.save();ctx.translate(cx,cy);ctx.scale(.3+.7*opening,.15+.85*opening);
      ctx.shadowColor=m.color;
      if(merge<1){
        for(let i=0;i<3;i++){
          const alpha=Math.min(1,Math.max(0,(age-i*110)/250))*(1-merge)*fade;
          this.numberMatrix(ctx,(-215+i*150)*u*(1-merge),-55*u,5,3,40*u,23*u,age/1200,alpha,m.color,['Q','K','V'][i],u,i+1);
        }
      }
      if(merge>0)this.numberMatrix(ctx,-160*u,-104*u,8,8,40*u,26*u,(age-1200)/1350,merge*fade,m.color,'ATTENTION / ACTIVATION',u,5,true);
      ctx.restore();
    }
  }
  update(hands,now,width,height){
    this.lines=this.lines.filter(l=>now-l.born<5000);
    if(now-this.tick<140)return;
    this.tick=now;
    const seen=new Set();
    for(const h of hands){
      seen.add(h.id);
      const old=this.samples.get(h.id),mode=h.pinch?'PINCH':h.closed?'CHARGE':'FLOW';
      const travel=old?h.tips.reduce((sum,p,i)=>sum+Math.hypot(p.x-old.tips[i].x,p.y-old.tips[i].y),0)/5:0;
      const changed=!old||old.mode!==mode;
      this.samples.set(h.id,{mode,tips:h.tips.map(p=>({...p}))});
      if(!changed&&travel<height/720*1.5)continue;
      const finger=this.sequence%5,p=h.tips[finger],x=(p.x/width).toFixed(3),y=(p.y/height).toFixed(3);
      let text;
      if(!old)text=`track.acquire(${JSON.stringify(h.id)});`;
      else if(changed)text=old.mode==='CHARGE'&&mode==='FLOW'?'field.release();':mode==='PINCH'?`field.bind(vec2(${x}, ${y}));`:mode==='CHARGE'?'field.gather(hand.palm);':'circuit.resume();';
      else text=[`finger[${finger}] -> vec2(${x}, ${y});`,`circuit.route(${finger}, ${x}, ${y});`,`field.spread(${h.openness.toFixed(2)});`,`hand.rotate(${h.angle.toFixed(3)});`,`field.${mode==='PINCH'?'pull':mode==='CHARGE'?'charge':'flow'}(${(travel/height).toFixed(4)});`][this.sequence%5];
      this.lines.push({text,born:now,number:++this.sequence,event:changed});
      this.focus={id:h.id,finger,born:now};
    }
    for(const id of this.samples.keys())if(!seen.has(id))this.samples.delete(id);
    this.lines=this.lines.slice(-8);
  }
  draw(ctx,hands,now,width,height,{glow,intensity,colors,live}){
    this.update(hands,now,width,height);
    const u=height/720,primary=colors[0],secondary=colors[1];
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineWidth=u;
    ctx.font=`${11*u}px monospace`;ctx.textBaseline='top';ctx.textAlign='left';
    // Fresh overlay: tracking boxes and text never enter the trail buffer.
    ctx.shadowColor=primary;ctx.shadowBlur=glow*10*u;
    this.drawMatrices(ctx,now,width,height);
    this.drawVectors(ctx,hands,now,width,height,colors);
    this.drawPairNetwork(ctx,now,u,colors);
    for(const h of hands){
      const color=colors[h.colorIndex%colors.length];
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;
      this.circuit(ctx,h,now,u,color);
      ctx.font=`${18*u}px monospace`;ctx.lineWidth=1.8*u;
      const xs=h.tips.map(p=>p.x),ys=h.tips.map(p=>p.y),pad=20*u;
      const left=Math.min(...xs,h.palm.x)-pad,right=Math.max(...xs,h.palm.x)+pad;
      const top=Math.min(...ys,h.palm.y)-pad,bottom=Math.max(...ys,h.palm.y)+pad;
      ctx.globalAlpha=.28;const arm=13*u;
      for(const [x,y,sx,sy] of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]]){
        ctx.beginPath();ctx.moveTo(x+arm*sx,y);ctx.lineTo(x,y);ctx.lineTo(x,y+arm*sy);ctx.stroke();
      }
      h.tips.forEach((p,i)=>{
        const selected=this.focus?.id===h.id&&this.focus.finger===i&&now-this.focus.born<280;
        const r=(14+intensity*6+(selected?3:0))*u;
        ctx.globalAlpha=selected?1:.75;
        ctx.strokeRect(p.x-r,p.y-r,2*r,2*r);
        ctx.fillRect(p.x-u,p.y-u,2*u,2*u);
        ctx.globalAlpha=.9;ctx.fillText(`0${i}`,p.x+r+5*u,p.y-r);
        if(h.pinch||h.closed){
          ctx.globalAlpha=.19;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(h.palm.x,p.y);ctx.lineTo(h.palm.x,h.palm.y);ctx.stroke();
        }
      });
      ctx.font=`${11*u}px monospace`;
      ctx.globalAlpha=.7;
      ctx.fillText(h.pinch?'FIELD / BOUND':h.closed?'FIELD / GATHER':'TRACK / LOCK',left,Math.max(18*u,top-16*u));
    }
    ctx.shadowColor=primary;ctx.shadowBlur=glow*7*u;
    ctx.font=`${11*u}px monospace`;ctx.lineWidth=u;
    const x=26*u,base=height-42*u,lineHeight=19*u;
    const headingY=base-9*lineHeight;
    const backing=ctx.createLinearGradient(x,0,x+390*u,0);
    backing.addColorStop(0,'#040a1280');backing.addColorStop(1,'#040a1200');
    ctx.globalAlpha=1;ctx.fillStyle=backing;ctx.fillRect(x-10*u,headingY-10*u,405*u,205*u);
    ctx.fillStyle=primary;ctx.globalAlpha=.8;
    ctx.fillText(`REALITY / ${!live?'SIMULATION':hands.length?'GESTURE STREAM':'AWAITING HANDS'}`,x,headingY);
    ctx.globalAlpha=.28;ctx.strokeStyle=primary;ctx.beginPath();ctx.moveTo(x,headingY+18*u);ctx.lineTo(x+310*u,headingY+18*u);ctx.stroke();
    ctx.font=`${12*u}px monospace`;
    this.lines.forEach((l,i)=>{
      const age=now-l.born,fade=Math.min(1,(5000-age)/1000),y=base-(this.lines.length-1-i)*lineHeight;
      const offset=age<100?Math.sin(age*.08)*1.5*u:0;
      ctx.globalAlpha=.32*fade;ctx.fillStyle=secondary;ctx.fillText(String(l.number).padStart(3,'0'),x,y);
      ctx.globalAlpha=(l.event ? .88 : .68)*fade;ctx.fillStyle=l.event?'#def9f4':primary;
      ctx.fillText(l.text,x+34*u+offset,y);
    });
    const h=hands[0];
    if(h){
      const mx=width-238*u,my=64*u;
      ctx.font=`${10*u}px monospace`;ctx.fillStyle=secondary;ctx.globalAlpha=.65;
      ctx.fillText('LANDMARKS / XY / SPREAD',mx,my);
      h.tips.forEach((p,i)=>{ctx.globalAlpha=.38;ctx.fillText(`0${i} [ ${(p.x/width).toFixed(3)} ${(p.y/height).toFixed(3)} ${h.openness.toFixed(2)} ]`,mx,my+(i+1)*17*u)});
    }
    ctx.restore();
  }
}
