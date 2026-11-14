const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../assets/industry-bubbles.js');
const dates=['2026-10-29','2026-10-30','2026-11-02'];
const sector=(code,values)=>({code,name:'族群'+code,stockCount:1,rows:dates.map((date,i)=>({date,sampleCount:1,foreignAmount:values[i],trustAmount:0,dealerAmount:0,foreignAmountCount:1,trustAmountCount:1,dealerAmountCount:1,financingAmount:0,financingAmountCount:1,financing:0,financingBalance:100}))});
const data={dates,latestDate:dates.at(-1),sectors:[sector('24',[100,100,-50]),sector('25',[-100,-100,50])]};
test('multiple sources recompute net, daily speed and mass without double counting',()=>{
 const combined=structuredClone(data);for(const s of combined.sectors)for(const row of s.rows){row.trustAmount=30;row.dealerAmount=-50;}
 const p=M.points(combined,3,dates.at(-1),['foreign','trust','foreign']).points[0];assert.equal(p.net,240);assert.equal(p.speed,-20);assert.equal(p.mass,340);
 const other=M.points(combined,3,dates.at(-1),['foreign','dealer']).points[0];assert.equal(other.net,0);assert.equal(other.speed,-100);assert.equal(other.mass,400);
 combined.sectors[0].rows[0].dealerAmount=null;assert.equal(M.points(combined,3,dates.at(-1),['foreign','trust']).points.length,2);assert.equal(M.points(combined,3,dates.at(-1),['dealer']).excluded,1);assert.equal(M.points(combined,3,dates.at(-1),[]).points.length,0);
});
test('daily industry trajectories cross four quadrants using only information available on each date',()=>{
 const ds=Array.from({length:6},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0'));
 const sample={dates:ds,sectors:[{code:'24',name:'半導體',rows:[100,100,-50,-200,100,200].map((n,i)=>({date:ds[i],sampleCount:1,foreignAmount:n,foreignAmountCount:1}))}]};
 const r=M.trajectory(sample,3,ds.at(-1),['foreign'],['24'],5);assert.equal(r.points.length,4);assert.equal(r.excluded,1);assert.deepEqual(r.points.map(p=>p.quadrant),[3,2,1,0]);assert.deepEqual(r.points.map(p=>p.date),ds.slice(2));assert.equal(r.points[0].startDate,ds[0]);assert.equal(r.points[0].net,150);
 const changed=structuredClone(sample);changed.sectors[0].rows.at(-1).foreignAmount=1e9;assert.deepEqual(M.trajectory(changed,3,ds.at(-1),['foreign'],['24'],5).points[0],r.points[0]);
 const l=M.layout(r.points);for(const p of l.points){assert(p.cx-p.r>=l.bounds.left);assert(p.cx+p.r<=l.bounds.right);assert(p.cy-p.r>=l.bounds.top);assert(p.cy+p.r<=l.bounds.bottom)}
 assert.throws(()=>M.trajectory(sample,1,ds.at(-1),['foreign'],['1','2','3','4','5'],5),/四/);
});
test('one bubble per industry tracks cumulative direction, latest daily speed and absolute flow size',()=>{
 assert.deepEqual(M.periods,[1,3,5,10,20,30,60,90]);
 const result=M.points(data,3,dates.at(-1));assert.equal(result.points.length,2);
 const p=result.points[0];assert.equal(p.net,150);assert.equal(p.speed,-50);assert.equal(p.mass,250);assert.equal(p.quadrant,3);assert.equal(result.points[1].quadrant,1);
 const single=M.points(data,1,dates[1],'foreign');assert.equal(single.points[0].net,100);assert.equal(single.points[0].speed,100);
 const missing=structuredClone(data);missing.sectors[0].rows[1].foreignAmount=null;assert.equal(M.points(missing,3,dates.at(-1)).excluded,1);
 assert.equal(M.points(data,90,dates.at(-1)).points.length,0);
});
test('bubble areas keep raw ratios, including tiny funds, and entire circles fit inside coordinates',()=>{
 const input=[{net:1e12,speed:-1e8,mass:1e12},{net:-1e12,speed:1e8,mass:1},{net:0,speed:0,mass:0}];
 const r=M.layout(input);assert(Math.abs((r.points[0].r/r.points[1].r)**2/1e12-1)<1e-10);assert.equal(r.points[2].r,0);
 for(const p of r.points){assert(p.cx-p.r>=r.bounds.left);assert(p.cx+p.r<=r.bounds.right);assert(p.cy-p.r>=r.bounds.top);assert(p.cy+p.r<=r.bounds.bottom)}
});

test('financing participates in coordinates, sizing and coverage as a selectable source',()=>{
 const sample=structuredClone(data);for(const s of sample.sectors)for(const row of s.rows){row.financingAmount=25;row.financingAmountCount=1;row.financing=2;row.financingBalance=80;}
 const p=M.points(sample,3,dates.at(-1),['financing']).points[0];assert.equal(p.net,75);assert.equal(p.speed,25);assert.equal(p.mass,75);assert.equal(p.financingChange,2);assert.equal(p.financingBalance,80);assert.equal(p.dominant,'financing');
 const mixed=M.points(sample,3,dates.at(-1),['foreign','financing']).points[0];assert.equal(mixed.net,225);assert.equal(mixed.speed,-25);assert.equal(mixed.mass,325);
 sample.sectors[0].rows[0].financingAmount=null;assert.equal(M.points(sample,3,dates.at(-1),['financing']).excluded,1);assert.equal(M.points(sample,3,dates.at(-1),['foreign']).excluded,0);
});

test('financing is unlimited, includes negative and positive balances and retains historical flows',()=>{
 const sample={dates,sectors:Array.from({length:24},(_,i)=>({code:String(i),name:'產業'+i,rows:dates.map((date,j)=>({date,sampleCount:1,financing:i%2===0?i+1:-(i+1),financingAmount:(i%2===0?1:-1)*(i+1)*1000*(j+1),financingAmountCount:1,financingBalance:10000,foreignAmount:500,foreignAmountCount:1}))}))};
 const r=M.points(sample,3,dates.at(-1),['financing']);assert.equal(r.points.length,24);assert(r.points.some(p=>p.net<0));assert(r.points.some(p=>p.net>0));assert.equal(r.points.find(p=>p.code==='23').net,-144000);
 const mixed=M.points(sample,3,dates.at(-1),['foreign','financing']);assert.equal(mixed.points.length,24);assert.equal(mixed.points.find(p=>p.code==='23').net,-142500);
 const t=M.trajectory(sample,1,dates.at(-1),['financing'],['23'],3);assert.equal(t.points.length,3);assert(t.points.every(p=>p.net<0));
 sample.sectors[23].rows[1].financingAmount=null;assert.equal(M.points(sample,3,dates.at(-1),['financing']).excluded,1);
});

test('plot bounds use the full viewport with only a millimeter inset at desktop and phone sizes',()=>{
 for(const [w,h] of [[1250,700],[316,650]]){const r=M.layout([{net:100,speed:-100,mass:100}],w,h);assert.deepEqual(r.bounds,{left:3,right:w-3,top:3,bottom:h-3});const p=r.points[0];assert(p.cx-p.r>=3&&p.cx+p.r<=w-3&&p.cy-p.r>=3&&p.cy+p.r<=h-3);}
});
