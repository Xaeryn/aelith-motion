export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function classifyHand(points,previous={},options={}){
  const palm=Math.max(distance(points[5],points[17]),options.forgiving?distance(points[0],points[9])*.75:0)||.001;
  const fingers=[8,12,16,20].map((tip)=>distance(points[tip],points[0])>distance(points[tip-2],points[0])*1.12);
  const openness=fingers.filter(Boolean).length/4;
  const rawRatio=distance(points[4],points[8])/palm;
  const pinchRatio=options.forgiving&&Number.isFinite(previous.pinchRatio)?rawRatio*.7+previous.pinchRatio*.3:rawRatio;
  const pinch=pinchRatio<(options.forgiving?(previous.pinch?.64:.42):(previous.pinch?.48:.32));
  return {openness,pinch,pinchRatio,fingers,closed:openness<=.25,label:pinch?'NIPISTYS':openness<=.25?'NYRKKI':openness>=.75?'AVOIN KÄSI':'SORMENPÄÄT'};
}
export function mapPoint(p,width,height,videoWidth,videoHeight,mirror){
  const scale=Math.max(width/videoWidth,height/videoHeight);
  const dw=videoWidth*scale,dh=videoHeight*scale;
  return {x:(mirror?1-p.x:p.x)*dw+(width-dw)/2,y:p.y*dh+(height-dh)/2,z:p.z||0};
}
