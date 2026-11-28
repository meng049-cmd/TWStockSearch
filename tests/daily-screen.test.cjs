const test=require('node:test'),assert=require('node:assert/strict'),M=require('../assets/daily-screen.js');
const stock={code:'2330',name:'台積電',exchange:'TWSE'};
function fixture(){return Array.from({length:61},(_,i)=>{const close=100+i*.2;return {date:new Date(Date.UTC(2026,7,i+1)).toISOString().slice(0,10),open:close-.1,high:close+.2,low:close-.2,close,volume:1e6}})}
function entryRows(){const rows=fixture(),p=rows.at(-2),close=p.high+1;rows[60]={...rows[60],open:close-.4,close,high:close+.2,low:close-.6,volume:2e6};return rows;}
test('entry uses prior volume and highs, with no future information',()=>{
 const rows=entryRows(),date=rows.at(-1).date,r=M.evaluate(stock,rows,date);assert(r.entry);assert.equal(r.entry.ratio,2);assert.equal(r.entry.high20,rows.at(-2).high);assert.equal(r.exit,null);
 const future={...rows.at(-1),date:'2027-01-01',close:1,high:2,low:1,open:1};assert.deepEqual(M.evaluate(stock,[...rows,future],date),r);
 const noVolume=structuredClone(rows);noVolume.at(-1).volume=1e6;assert.equal(M.evaluate(stock,noVolume,date).entry,null);
 const chase=structuredClone(rows);chase.at(-1).close=rows.at(-2).close*1.08;chase.at(-1).high=chase.at(-1).close;assert.equal(M.evaluate(stock,chase,date).entry,null);
});
test('exit identifies actual high-volume downside breaks and excludes simultaneous entry',()=>{
 const rows=fixture(),date=rows.at(-1).date;Object.assign(rows.at(-1),{open:98,high:98,low:89,close:90,volume:2e6});const r=M.evaluate(stock,rows,date);
 assert(r.exit);assert.equal(r.exit.priority,3);assert.equal(r.entry,null);assert(r.exit.reason.includes('前20日低點'));
});
test('stale, thin, ETF and insufficient histories never become recommendations',()=>{
 const rows=entryRows(),date=rows.at(-1).date;assert.equal(M.evaluate(stock,rows,'2026-12-01'),null);assert.equal(M.evaluate({...stock,code:'0050'},rows,date),null);assert.equal(M.evaluate(stock,rows.slice(-20),date),null);
 const thin=structuredClone(rows);thin.forEach(r=>r.volume=1000);assert.equal(M.evaluate(stock,thin,date),null);
 const missing=structuredClone(rows);missing.at(-1).volume=null;assert.equal(M.evaluate(stock,missing,date),null);
});
test('futures filtering happens before top-five selection, with no padding or guessed membership',()=>{
 const now=Date.parse('2026-11-24T12:00:00Z'),f={status:'ok',source:'https://openapi.taifex.com.tw/v1/SSFLists',checkedAt:'2026-11-24T10:00:00Z',codes:['2006','2007']};
 const items=Array.from({length:7},(_,i)=>({code:String(2001+i),priority:1,ratio:10-i,change:1}));
 assert.deepEqual(M.shortlist(items,'entry','yes',f,now).map(s=>s.code),['2006','2007']);assert.equal(M.shortlist(items,'entry','all',f,now).length,5);assert.equal(M.shortlist(items,'entry','no',f,now).length,5);
 assert.equal(M.shortlist(items,'entry','no',null,now).length,0);assert.equal(M.shortlist(items,'entry','yes',{...f,checkedAt:'2025-01-01'},now).length,0);assert.deepEqual(M.shortlist([],'exit','all',f,now),[]);
});
