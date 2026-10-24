'use strict';
(function(root){
 const finite=v=>typeof v==='number'&&Number.isFinite(v),round=v=>Math.round(v*100)/100,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const Indicators=root.TurningIndicators||(typeof require==='function'?require('../research/indicators.js'):null),Advanced=root.TurningAdvanced||(typeof require==='function'?require('../research/advanced-indicators.js'):null),Analysis=root.TurningAnalysis||(typeof require==='function'?require('../research/analysis-core.js'):null);
 const categories=[{id:'market',name:'市場活躍',max:10},{id:'trend',name:'趨勢轉折',max:25},{id:'momentum',name:'動能強弱',max:20},{id:'flow',name:'量價資金',max:15},{id:'chips',name:'法人籌碼',max:20},{id:'risk',name:'風險位置',max:10}];
 const names={adx:'ADX14 趨勢強度',plusDi:'+DI14',minusDi:'−DI14',cci:'CCI20',mfi:'MFI14',cmf:'CMF20',donchianHigh:'前20日通道上緣',donchianLow:'前20日通道下緣',williamsR:'Williams %R14',rsi:'RSI14',dif:'MACD DIF',macdHist:'MACD柱體',k:'KD K',d:'KD D',atrPct:'ATR14／收盤 %',bbWidth:'布林帶寬 %',roc:'ROC10 %',obv:'OBV（張）',ma5:'MA5',ma10:'MA10',ma20:'MA20',ma60:'MA60'};
 const formatter=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}),f=v=>finite(v)?formatter.format(v):'—';
 function prepare(input){const map=new Map();for(const r of input||[]){if(!r||typeof r.date!=='string'||!['open','high','low','close','volume'].every(k=>finite(r[k]))||r.close<=0||r.volume<0||r.high<Math.max(r.open,r.close,r.low)||r.low>Math.min(r.open,r.close))continue;map.set(r.date,{...r});}const rows=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));rows.forEach((r,i)=>{r.change=i?(r.close/rows[i-1].close-1)*100:null;const prior=rows.slice(Math.max(0,i-5),i),v=prior.reduce((s,x)=>s+x.volume,0);r.ratio=prior.length===5&&v>0?r.volume/(v/5):null;for(const n of [5,10,20])r['ma'+n]=i+1>=n?rows.slice(i+1-n,i+1).reduce((s,x)=>s+x.close,0)/n:null;});return Advanced.compute(Indicators.compute(rows));}
 function grade(score){return !finite(score)?'資料待補':score>=80?'多方條件較多':score>=65?'偏多觀察':score>=50?'訊號分歧':'偏弱觀察';}
 function scoreStock(input,context={}){const rows=prepare(input),i=rows.length-1,r=rows[i],p=rows[i-1],checks=[];const add=(category,id,label,max,points,evidence,rule)=>checks.push({category,id,label,max,points:finite(points)?round(clamp(points,0,max)):null,evidence,rule});
  if(!r)return {modelVersion:'1.0.0',score:null,knownPoints:0,availableMax:0,coverage:0,eligible:false,grade:'無有效行情',checks:[],categories:categories.map(c=>({...c,points:0,availableMax:0})),missing:['有效OHLCV行情'],metrics:{},names,date:null,close:null,change:null,ratio:null,fresh:false,priceTrend:[],sharesAsOf:null,research:{title:'資料不足',bias:'sideways',conclusion:'尚無可用行情，無法完成轉折研判。',washout:'資料不足',turnover:'資料不足'}};
  const report=Analysis.analyze(rows,i,'stock',[],{historical:false}),x=report.x,hot=context.market;
  const marketValid=finite(hot?.score)&&hot.score>=0&&hot.score<=100&&context.marketDate===r.date;
  add('market','activity','市場選股 V2 活躍度',10,marketValid?hot.score/10:null,marketValid?`原市場熱度 ${f(hot.score)}／100；相對量 ${f(hot.relativeVolume)} 倍；發行股數週轉率 ${f(hot.turnoverRate)}%`:'市場活躍度缺漏或行情日期未對齊','沿用市場選股V2分數×10%；描述活躍度，不代表買方方向。');
  const slope=rows[i-5]?.ma20;
  add('trend','ma','均線結構與月線斜率',8,[r.ma20,r.ma60,slope].every(finite)?(r.close>r.ma20?3:0)+(r.ma20>r.ma60?3:0)+(r.ma20>slope?2:0):null,`收盤 ${f(r.close)}；MA20 ${f(r.ma20)}；MA60 ${f(r.ma60)}；月線5日變化 ${f(finite(slope)?r.ma20-slope:null)}`,'收盤高於MA20＋3；MA20高於MA60＋3；MA20較5日前上升＋2。');
  let cross=false;for(let j=Math.max(1,i-4);j<=i;j++)for(const k of ['ma10','ma20'])if([rows[j-1].ma5,rows[j-1][k],rows[j].ma5,rows[j][k]].every(finite)&&rows[j-1].ma5<=rows[j-1][k]&&rows[j].ma5>rows[j][k])cross=true;
  const above=[r.ma5,r.ma10,r.ma20].every(finite);
  add('trend','turn','近一週短均轉折',5,above?cross&&r.close>r.ma10&&r.close>r.ma20?5:r.close>r.ma5&&r.ma5>r.ma10&&r.ma10>r.ma20?4:r.close>r.ma5&&r.close>r.ma20?3:r.close>r.ma20?2:0:null,`近5筆短均向上交叉 ${cross?'有':'未見'}；MA5／10／20 ${f(r.ma5)}／${f(r.ma10)}／${f(r.ma20)}`,'近5筆MA5上穿MA10或MA20且收盤站上兩線5分；多頭排列4；守短均及月線3；僅守月線2；其餘0。');
  add('trend','dmi','ADX／DMI方向與強度',7,[r.adx,r.plusDi,r.minusDi].every(finite)?r.plusDi>r.minusDi?r.adx>=25?7:r.adx>=20?4:2:r.plusDi===r.minusDi?2:0:null,`ADX ${f(r.adx)}；+DI ${f(r.plusDi)}；−DI ${f(r.minusDi)}`,'+DI較高且ADX≥25給7、≥20給4、其餘2；DI相同2；−DI較高0。ADX本身不代表方向。');
  const channel=[r.donchianHigh,r.donchianLow].every(finite),mid=channel?(r.donchianHigh+r.donchianLow)/2:null;
  add('trend','channel','Donchian前20日位置',5,channel?r.close>r.donchianHigh?5:r.close>=mid?3:r.close>=r.donchianLow?1:0:null,`收盤 ${f(r.close)}；前20日通道 ${f(r.donchianLow)}～${f(r.donchianHigh)}`,'收盤突破先前20筆高點5；位於通道上半3；下半1；跌破下緣0。通道不含當日，避免自我比較。');
  add('momentum','rsi','RSI強弱與過熱',5,finite(r.rsi)?r.rsi>=55&&r.rsi<=70?5:r.rsi>70&&r.rsi<=80?3:r.rsi>80?1:r.rsi>=45?3:r.rsi>=30?1:0:null,`RSI14 ${f(r.rsi)}`,'55～70給5；45～55或70～80給3；30～45或>80給1；<30給0。未把超賣直接視為轉強。');
  add('momentum','macd','MACD柱體方向',5,[r.macdHist,p?.macdHist].every(finite)?r.macdHist>0?r.macdHist>=p.macdHist?5:3:r.macdHist>p.macdHist?2:0:null,`柱體 ${f(r.macdHist)}；前日 ${f(p?.macdHist)}`,'零軸上且擴大5、零軸上縮小3、零軸下改善2、其餘0。');
  add('momentum','cci','CCI偏離與強度',5,finite(r.cci)?r.cci>100&&r.cci<=200?5:r.cci>=0&&r.cci<=100?4:r.cci>200?3:r.cci>=-100?2:r.cci>=-200?1:0:null,`CCI20 ${f(r.cci)}`,'100～200給5；0～100給4；>200給3；−100～0給2；−200～−100給1；更低0。');
  add('momentum','roc','ROC10動能延續',5,[r.roc,p?.roc].every(finite)?r.roc>0?r.roc>=p.roc?5:3:r.roc>p.roc?1:0:null,`ROC10 ${f(r.roc)}%；前日 ${f(p?.roc)}%`,'正值且較前日增加5；正值下降3；負值改善1；其餘0。');
  add('flow','pv','量價配合',5,[r.ratio,r.change].every(finite)?r.change>0?r.ratio>=1.2?5:r.ratio>=.8?3:2:r.change<0?r.ratio<.8?1:0:1.5:null,`漲跌 ${f(r.change)}%；前5日量比 ${f(r.ratio)} 倍`,'價漲且量比≥1.2給5、一般量3、量縮2；價跌量縮1、其他價跌0；平盤1.5。');
  add('flow','mfi','MFI量價壓力',5,finite(r.mfi)?r.mfi>50&&r.mfi<=80?5:r.mfi>80?3:r.mfi>=40?3:r.mfi>=20?1:0:null,`MFI14 ${f(r.mfi)}`,'大於50至80給5；40～50或>80給3；20～40給1；<20給0。MFI是量價指標，不是實際資金淨流入。');
  add('flow','cmf','CMF收盤承接',5,finite(r.cmf)?r.cmf>=.1?5:r.cmf>0?4:r.cmf===0?2.5:r.cmf>-.1?1:0:null,`CMF20 ${f(r.cmf)}`,'≥0.1給5；0～0.1給4；零2.5；−0.1～0給1；≤−0.1給0。反映量價收盤壓力，非銀行資金流。');
  const buys=rows.slice(-5).filter(t=>finite(t.foreign)&&t.foreign>0).length;
  add('chips','foreign','外資近5日淨額',8,finite(x.foreign5)?x.foreign5>0?buys>=3?8:5:x.foreign5===0?4:r.foreign>0?2:0:null,`近5日外資 ${f(x.foreign5)} 張；買超日數 ${buys}／5`,'5日淨買且至少3日買超8；淨買但連續性弱5；持平4；淨賣但當日轉買2；其餘0。');
  const domestic=[x.trust5,x.dealer5].every(finite)?x.trust5+x.dealer5:null;
  add('chips','domestic','投信與自營商合計',5,finite(domestic)?domestic>0?x.trust5>0?5:3.5:domestic===0?2.5:0:null,`近5日投信 ${f(x.trust5)} 張；自營商 ${f(x.dealer5)} 張`,'合計淨買且投信偏買5；僅合計偏買3.5；持平2.5；合計偏賣0。');
  add('chips','margin','融資與價格配合',5,[x.margin5,x.price5].every(finite)?x.price5>0?x.margin5<=0?5:3:x.price5<0?x.margin5<0?1:0:2.5:null,`近5日價格 ${f(x.price5)}%；融資 ${f(x.margin5)} 張`,'價漲資減或不增5；價漲資增3；價跌資減1；價跌且未去槓桿0；價格持平2.5。');
  const structure=report.structure;
  add('chips','structure','洗盤與換手結構',2,structure.ready?1+structure.score:null,structure.summary||'結構資料不足','沿用轉折研究的結構分數（−1～1），平移為0～2分；中性1分。與既有籌碼共用資料，限制低權重。');
  add('risk','atr','相對波動風險',4,finite(r.atrPct)?r.atrPct<=2?4:r.atrPct<=4?3:r.atrPct<=6?2:r.atrPct<=8?1:0:null,`ATR14／收盤 ${f(r.atrPct)}%`,'≤2%給4；≤4%給3；≤6%給2；≤8%給1；更高0。此為波動風險分，非上漲能力。');
  const extension=finite(r.ma20)&&r.ma20>0?(r.close/r.ma20-1)*100:null;
  add('risk','extension','相對月線乖離',3,finite(extension)?Math.abs(extension)<=5?3:Math.abs(extension)<=10?2:Math.abs(extension)<=15?1:0:null,`收盤相對MA20 ${f(extension)}%`,'絕對乖離≤5%給3；≤10%給2；≤15%給1；更大0。避免離均線過遠。');
  const support=structure.metrics?.support,dist=finite(support)&&r.close>0?(r.close-support)/r.close*100:null;
  add('risk','support','支撐與風險距離',3,finite(dist)?dist<0?0:dist<=3?3:dist<=6?2:dist<=10?1:0:null,`參考支撐 ${f(support)}；距離 ${f(dist)}%`,'守支撐且距離≤3%給3、≤6%給2、≤10%給1；失守或距離過大0。支撐不保證有效。');
  const availableMax=checks.filter(c=>finite(c.points)).reduce((s,c)=>s+c.max,0),knownPoints=round(checks.reduce((s,c)=>s+(c.points??0),0)),missing=checks.filter(c=>!finite(c.points)).map(c=>c.label),fresh=r.date===context.quoteDate;
  if(!fresh)missing.unshift('未取得市場最新交易日行情');
  const total=availableMax===100&&fresh?knownPoints:null;
  const parts=categories.map(c=>({...c,points:round(checks.filter(x=>x.category===c.id).reduce((s,x)=>s+(x.points??0),0)),availableMax:checks.filter(x=>x.category===c.id&&finite(x.points)).reduce((s,x)=>s+x.max,0)}));
  const metrics=Object.fromEntries(Object.keys(names).map(k=>[k,finite(r[k])?round(r[k]):null]));
  return {modelVersion:'1.0.0',date:r.date,close:r.close,change:finite(r.change)?round(r.change):null,ratio:finite(r.ratio)?round(r.ratio):null,score:total,knownPoints,availableMax,coverage:availableMax,eligible:total!==null,grade:grade(total),fresh,checks,categories:parts,missing,metrics,names,research:{bias:report.bias,title:report.title,conclusion:report.today,confirmation:report.confirmation,invalidation:report.invalidation,washout:structure.washout?.conclusion||'資料不足',turnover:structure.turnover?.conclusion||'資料不足'},priceTrend:rows.slice(-20).map(t=>({date:t.date,close:t.close})),sharesAsOf:hot?.sharesAsOf||null};
 }
 function rank(records){const eligible=records.filter(r=>finite(r.score)).sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code));let last=null,position=0;eligible.forEach((r,i)=>{if(last===null||r.score!==last)position=i+1;r.rank=position;last=r.score;});for(const r of records)if(!finite(r.score))r.rank=null;return records;}
 root.StockScore={prepare,scoreStock,rank,categories,names,grade};if(typeof module!=='undefined')module.exports=root.StockScore;
})(globalThis);
