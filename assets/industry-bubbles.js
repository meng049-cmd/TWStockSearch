'use strict';
(function(root){
 const periods=[1,3,5,10,20,30,60,90],keys=['foreign','trust','dealer','financing'];
 const finite=Number.isFinite;
 function sources(metric){
  const selected=metric==='all'?keys:Array.isArray(metric)?metric:[metric];
  if(selected.some(k=>!keys.includes(k)))throw Error('不支援的資金來源');
  return [...new Set(selected)];
 }
 function points(snapshot,days,end,metric='all'){
  days=Number(days);if(!periods.includes(days))throw Error('不支援的天數');
  const dates=snapshot.dates.filter(d=>d<=end).slice(-days),selected=sources(metric),result=[];
  if(!selected.length)return {points:[],dates,excluded:0};
  for(const sector of snapshot.sectors){
   const byDate=new Map(sector.rows.map(r=>[r.date,r])),rows=dates.map(d=>byDate.get(d));
   if(dates.length!==days||rows.some(r=>!r||selected.some(k=>!finite(r[k+'Amount']))))continue;
   const sums=Object.fromEntries(keys.map(k=>[k,rows.every(r=>finite(r[k+'Amount']))?rows.reduce((s,r)=>s+r[k+'Amount'],0):null]));
   const net=selected.reduce((s,k)=>s+sums[k],0),speed=selected.reduce((s,k)=>s+rows.at(-1)[k+'Amount'],0);
   const mass=rows.reduce((s,r)=>s+selected.reduce((a,k)=>a+Math.abs(r[k+'Amount']),0),0);
   const dominant=[...selected].sort((a,b)=>Math.abs(sums[b]||0)-Math.abs(sums[a]||0))[0];
   result.push({code:sector.code,name:sector.name,date:dates.at(-1),startDate:dates[0],net,speed,mass,sums,dominant,financingChange:rows.at(-1).financing??null,financingBalance:rows.at(-1).financingBalance??null,quadrant:speed>=0?(net>=0?0:1):(net<0?2:3),coverage:Math.min(...rows.flatMap(r=>selected.map(k=>r[k+'AmountCount']/r.sampleCount)))});
  }
  return {points:result,dates,excluded:snapshot.sectors.length-result.length};
 }
 function trajectory(snapshot,days,end,metric,codes,trailDays){
  const selected=[...new Set(codes)];
  if(selected.length>4)throw Error('最多同時比較四個產業');
  trailDays=Number(trailDays);if(!periods.includes(trailDays))throw Error('不支援的觀察日數');
  const sectors=snapshot.sectors.filter(s=>selected.includes(s.code)),dates=snapshot.dates.filter(d=>d<=end).slice(-trailDays),result=[];let excluded=0;
  dates.forEach((date,sequence)=>{const day=points({...snapshot,sectors},days,date,metric);excluded+=day.excluded;for(const p of day.points)result.push({...p,sequence})});
  return {points:result,dates,excluded};
 }
 function layout(points,width=1100,height=620){
  const bounds={left:100,right:width-35,top:40,bottom:height-75},w=bounds.right-bounds.left,h=bounds.bottom-bounds.top;
  const mass=points.reduce((s,p)=>s+p.mass,0),factor=mass>0?Math.sqrt(w*h*.10/(Math.PI*mass)):0;
  let radii=points.map(p=>Math.sqrt(p.mass)*factor),largest=Math.max(0,...radii);
  if(largest>Math.min(w,h)/3){const shrink=Math.min(w,h)/3/largest;radii=radii.map(r=>r*shrink);largest*=shrink;}
  const xPeak=Math.max(1,...points.map(p=>Math.abs(p.net))),yPeak=Math.max(1,...points.map(p=>Math.abs(p.speed)));
  const xLimit=xPeak*w/2/(w/2-largest-5),yLimit=yPeak*h/2/(h/2-largest-5),cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2;
  return {bounds,xLimit,yLimit,cx,cy,points:points.map((p,i)=>({...p,r:radii[i],cx:cx+p.net/xLimit*w/2,cy:cy-p.speed/yLimit*h/2}))};
 }
 root.IndustryBubbles={periods,points,trajectory,layout};if(typeof module!=='undefined')module.exports=root.IndustryBubbles;
})(globalThis);
