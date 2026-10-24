'use strict';
(function(root){
 const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
 function compute(rows){let trSum=0,plusSum=0,minusSum=0,adx=null;const dxs=[],typical=[],positive=[],negative=[];
  for(let i=0;i<rows.length;i++){
   const r=rows[i],p=rows[i-1],tp=(r.high+r.low+r.close)/3;typical.push(tp);
   r.adx=r.plusDi=r.minusDi=r.cci=r.mfi=r.cmf=r.donchianHigh=r.donchianLow=r.williamsR=null;
   const raw=tp*r.volume;positive.push(i&&tp>typical[i-1]?raw:0);negative.push(i&&tp<typical[i-1]?raw:0);
   if(i>=14){const pos=positive.slice(i-13,i+1).reduce((s,v)=>s+v,0),neg=negative.slice(i-13,i+1).reduce((s,v)=>s+v,0);r.mfi=pos===0&&neg===0?50:neg===0?100:100-100/(1+pos/neg);}
   if(i>=13){const w=rows.slice(i-13,i+1),high=Math.max(...w.map(x=>x.high)),low=Math.min(...w.map(x=>x.low));r.williamsR=high===low?-50:-100*(high-r.close)/(high-low);}
   if(i>=19){const t=typical.slice(i-19,i+1),mean=avg(t),deviation=avg(t.map(x=>Math.abs(x-mean)));r.cci=deviation===0?0:(tp-mean)/(.015*deviation);const w=rows.slice(i-19,i+1),volume=w.reduce((s,x)=>s+x.volume,0);r.cmf=volume>0?w.reduce((s,x)=>s+(x.high===x.low?0:(2*x.close-x.high-x.low)/(x.high-x.low))*x.volume,0)/volume:null;}
   if(i>=20){const prior=rows.slice(i-20,i);r.donchianHigh=Math.max(...prior.map(x=>x.high));r.donchianLow=Math.min(...prior.map(x=>x.low));}
   if(p){const up=r.high-p.high,down=p.low-r.low,plus=up>down&&up>0?up:0,minus=down>up&&down>0?down:0,tr=Math.max(r.high-r.low,Math.abs(r.high-p.close),Math.abs(r.low-p.close));
    if(i<=14){trSum+=tr;plusSum+=plus;minusSum+=minus;}else{trSum=trSum-trSum/14+tr;plusSum=plusSum-plusSum/14+plus;minusSum=minusSum-minusSum/14+minus;}
    if(i>=14){r.plusDi=trSum>0?100*plusSum/trSum:0;r.minusDi=trSum>0?100*minusSum/trSum:0;const total=r.plusDi+r.minusDi,dx=total>0?100*Math.abs(r.plusDi-r.minusDi)/total:0;dxs.push(dx);if(dxs.length===14)adx=avg(dxs);else if(dxs.length>14)adx=(adx*13+dx)/14;r.adx=adx;}
   }
  }return rows;
 }
 root.TurningAdvanced={compute};if(typeof module!=='undefined')module.exports=root.TurningAdvanced;
})(globalThis);
