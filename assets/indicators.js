/* Daily technical indicators. Uses stored history only; no look-ahead or null-to-zero filling. */
(function(root){
function compute(rows){let k=50,d=50,ema12=null,ema26=null,signal=null,difs=[],gain=0,loss=0,atr=null,obv=0;const closes=[],trs=[];
for(let i=0;i<rows.length;i++){const r=rows[i],prev=i?rows[i-1]:null,c=r.close;closes.push(c);r.ma60=closes.length>=60?avg(closes.slice(-60)):null;
const delta=prev?c-prev.close:0;if(prev){if(i<=14){gain+=Math.max(delta,0)/14;loss+=Math.max(-delta,0)/14}else{gain=(gain*13+Math.max(delta,0))/14;loss=(loss*13+Math.max(-delta,0))/14}}r.rsi=i>=14?(gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss)):null;
const tr=prev?Math.max(r.high-r.low,Math.abs(r.high-prev.close),Math.abs(r.low-prev.close)):r.high-r.low;trs.push(tr);if(i===13)atr=avg(trs);else if(i>13)atr=(atr*13+tr)/14;r.atr=atr;r.atrPct=atr===null?null:atr/c*100;
r.k=null;r.d=null;if(i>=8){const w=rows.slice(i-8,i+1),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low));const rsv=hi===lo?50:(c-lo)/(hi-lo)*100;k=k*2/3+rsv/3;d=d*2/3+k/3;r.k=k;r.d=d;}
if(i===11)ema12=avg(closes.slice(-12));else if(i>11)ema12=ema12+(c-ema12)*2/13;if(i===25)ema26=avg(closes.slice(-26));else if(i>25)ema26=ema26+(c-ema26)*2/27;r.dif=ema12!==null&&ema26!==null?ema12-ema26:null;r.macdSignal=null;r.macdHist=null;if(r.dif!==null){difs.push(r.dif);if(difs.length===9)signal=avg(difs);else if(difs.length>9)signal=signal+(r.dif-signal)*2/10;r.macdSignal=signal;r.macdHist=signal===null?null:r.dif-signal;}
if(prev&&c!==prev.close)obv+=(c>prev.close?1:-1)*r.volume;r.obv=obv;r.obvChange=prev?obv-prev.obv:null;r.roc=i>=10?(c/rows[i-10].close-1)*100:null;
r.bbMid=null;r.bbUpper=null;r.bbLower=null;r.bbWidth=null;if(i>=19){const w=closes.slice(-20),mid=avg(w),sd=Math.sqrt(avg(w.map(v=>(v-mid)**2)));r.bbMid=mid;r.bbUpper=mid+2*sd;r.bbLower=mid-2*sd;r.bbWidth=mid===0?null:4*sd/mid*100;}
r.index=i+1;
}return rows;}
function avg(a){return a.reduce((s,v)=>s+v,0)/a.length}
root.TurningIndicators={compute};if(typeof module!=='undefined')module.exports={compute};
})(typeof globalThis!=='undefined'?globalThis:this);
