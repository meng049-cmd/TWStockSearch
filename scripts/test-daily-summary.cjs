const assert=require('node:assert/strict');require('../public/daily-summary.js');const {conclude}=globalThis.TurningDaily;
for(const change of [-2,2])for(const foreign of [-100,100])for(const margin of [-20,20]){
 const row={close:100,change,foreign,margin,volume:1500,ratio:1.5};
 const v=conclude(row,{volume:1000});assert.equal(v.facts.length,4);assert(v.title.includes(change>0?'收高':'收低'));assert(v.title.includes('量增'));assert(v.facts[1].text.includes('50.00%'));assert(v.conclusion.includes(foreign*change>0?'方向一致':'背離'));assert(v.conclusion.includes(margin>0?'擴張':'收縮')||v.conclusion.includes('未伴隨融資擴張'));
}
const row={close:100,change:2,foreign:100,margin:-20,volume:500,ratio:0.5};assert(conclude(row,{volume:1000}).title.includes('量縮'));
const missing=conclude({...row,foreign:null,margin:null},null);assert(missing.conclusion.includes('資料不足'));assert.equal(missing.classification,'neutral');assert(missing.facts[2].text.includes('不當作零'));
assert(conclude({...row,change:null},null).conclusion.includes('缺少前一筆收盤'));
assert(conclude({...row,change:0,foreign:0,margin:0},{volume:500}).title.includes('平盤量持平'));
assert(conclude(row,{volume:0}).conclusion.includes('缺少有效前日量'));
const future=conclude({...row,foreign:null,margin:null}, {volume:1000},'future');assert(future.facts[3].text.includes('不適用'));assert(future.facts[1].text.includes('口'));assert.equal(future.classification,'neutral');
console.log('PASS: 8 price/foreign/margin combinations, volume comparisons, missing data, zero baseline, flat close and futures applicability');
