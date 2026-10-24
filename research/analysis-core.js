'use strict';
(function(root){
 const ChipStructure=root.TurningChipStructure||(typeof require==='function'?require('./chip-structure.js'):null);
 const valid=v=>typeof v==='number'&&Number.isFinite(v),round=v=>Math.round(v*100)/100;
 const sum=a=>a.reduce((s,v)=>s+v,0),signed=v=>v>0?1:v<0?-1:0;
 const f=(v,d=1)=>valid(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:d}):'—';
 const metricNames={foreign5:'外資近5日淨買賣超（張）',trust5:'投信近5日淨買賣超（張）',dealer5:'自營商近5日淨買賣超（張）',margin5:'融資近5日增減（張）',ratio:'當日量／前5日均量',change:'當日漲跌幅（%）',closeVsMa20:'收盤相對月線（%）',rsi:'RSI14',macdHist:'MACD柱體'};
 function validateRules(rules){if(!Array.isArray(rules)||rules.length>8)throw Error('最多設定8條研究規則');return rules.map(r=>{if(!r||!Object.hasOwn(metricNames,r.metric)||!['>','>=','<','<='].includes(r.op)||!valid(r.threshold)||Math.abs(r.threshold)>1e12||!['bullish','bearish'].includes(r.bias)||![1,2,3].includes(r.weight)||typeof r.enabled!=='boolean')throw Error('研究規則格式不正確');return {id:String(r.id||'').slice(0,50),name:String(r.name||metricNames[r.metric]).slice(0,60),metric:r.metric,op:r.op,threshold:r.threshold,bias:r.bias,weight:r.weight,enabled:r.enabled};});}
 function total(rows,index,key,count=5){const slice=rows.slice(Math.max(0,index-count+1),index+1);return slice.length===count&&slice.every(r=>valid(r[key]))?sum(slice.map(r=>r[key])):null;}
 function features(rows,index){const r=rows[index],p=rows[index-1],p5=rows[index-5],window=rows.slice(Math.max(0,index-4),index+1),w20=rows.slice(Math.max(0,index-19),index+1);return {r,p,foreign5:total(rows,index,'foreign'),trust5:total(rows,index,'trust'),dealer5:total(rows,index,'dealer'),margin5:total(rows,index,'margin'),ratio:r.ratio,change:r.change,closeVsMa20:valid(r.ma20)?(r.close/r.ma20-1)*100:null,rsi:r.rsi,macdHist:r.macdHist,price5:p5?(r.close/p5.close-1)*100:null,ma20Slope:p5&&valid(p5.ma20)&&valid(r.ma20)?r.ma20-p5.ma20:null,support:window.length>=5?Math.min(...window.map(x=>x.low)):null,resistance:window.length>=5?Math.max(...window.map(x=>x.high)):null,support20:w20.length>=20?Math.min(...w20.map(x=>x.low)):null,resistance20:w20.length>=20?Math.max(...w20.map(x=>x.high)):null,volumeChange:p&&p.volume>0?(r.volume/p.volume-1)*100:null};}
 function compare(a,op,b){return op==='>'?a>b:op==='>='?a>=b:op==='<'?a<b:a<=b;}
 function signals(rows,index,kind,rules=[]){const x=features(rows,index),r=x.r,groups=[],add=(key,label,value,weight,verdict,detail)=>groups.push({key,label,available:valid(value),value:valid(value)?value:null,weight,verdict,detail});
  const trend=valid(r.ma5)&&valid(r.ma20)?signed(r.close-r.ma5)+signed(r.ma5-r.ma20)+(valid(x.ma20Slope)?signed(x.ma20Slope):0):null;
  add('trend','價格與趨勢',trend,3,trend==null?'趨勢暖機不足':r.close<r.ma5&&r.close<r.ma20?'收盤低於短期與月線，反彈尚未轉強':r.close>r.ma5&&r.close>r.ma20?'價格站上短期與月線，短線結構偏強':r.close>=r.ma5?'站回短均但未收復月線，屬弱勢修復':'跌破短均但仍守月線，短線整理中',`收盤 ${f(r.close,2)}；MA5 ${f(r.ma5,2)}；MA20 ${f(r.ma20,2)}`);
  const volume=valid(r.ratio)&&valid(r.change)?signed(r.change)*(r.ratio>=1.2?2:r.ratio<.8?.5:1):null;
  add('volume','量價配合',volume,2,volume==null?'缺少可比較的前日價量':volume>=1.5?'價漲量增，上攻有交易量配合':volume<=-1.5?'價跌放量，賣壓仍占上風':volume>0?'收高但量能未明顯擴張，追價力道待確認':volume<0?'收低且量能未擴張，止跌仍需價格確認':'價量暫無明確方向',`當日 ${f(r.change,2)}%；前5日量比 ${f(r.ratio,2)} 倍`);
  const momentum=valid(r.macdHist)&&valid(r.rsi)?signed(r.macdHist)+(r.rsi>55?1:r.rsi<45?-1:0):null;
  add('momentum','技術動能',momentum,2,momentum==null?'MACD／RSI資料不足':momentum>=2?'動能偏多，快慢線與強弱指標同向':momentum<=-2?'動能偏空，反彈力道尚未恢復':'動能分歧，尚未形成一致轉向',`MACD柱體 ${f(r.macdHist,2)}；RSI ${f(r.rsi,1)}`);
  if(kind==='stock'){
   const foreign=valid(x.foreign5)?signed(x.foreign5)*2:null;
   add('foreign','外資動向',foreign,2,foreign==null?'近5日外資資料未齊，暫不判方向':foreign>0?(x.price5<0?'外資近5日承接，但價格尚未轉強':'外資近5日淨買超，與上漲方向配合'):foreign<0?(x.price5>0?'外資近5日淨賣超，上漲與外資方向背離':'外資近5日撤出，對反彈形成壓力'):'外資近5日買賣接近平衡',`當日 ${f(r.foreign)} 張；近5日合計 ${f(x.foreign5)} 張`);
   const domestic=valid(x.trust5)&&valid(x.dealer5)?signed(x.trust5)+signed(x.dealer5)*.5:null;
   add('domestic','投信與自營商',domestic,1.5,domestic==null?'近5日內資法人資料未齊':domestic>=1?'內資法人整體偏買方':domestic<=-1?'內資法人整體偏賣方':'投信與自營商方向分歧',`近5日投信 ${f(x.trust5)} 張；自營商 ${f(x.dealer5)} 張`);
   const margin=valid(x.margin5)&&valid(x.price5)?x.price5>0?(x.margin5<=0?1.5:.25):x.price5<0?(x.margin5>0?-1.5:-.25):0:null;
   add('margin','融資與槓桿',margin,1.5,margin==null?'近5日融資資料未齊，無法判定槓桿變化':x.price5>0?(x.margin5<=0?'近5日價漲資減，上漲未伴隨槓桿擴張':'近5日價漲資增，行情伴隨槓桿擴張'):x.price5<0?(x.margin5>0?'近5日價跌資增，槓桿承接風險升高':'近5日價跌資減，正在去槓桿但尚未止跌'):'價格橫向，融資變化仍需觀察',`當日融資增減 ${f(r.margin)} 張；近5日合計 ${f(x.margin5)} 張`);
  }
  const structure=ChipStructure.analyze(rows,index,kind);
  if(kind==='stock')add('chipStructure','洗盤與換手',structure.ready?structure.score:null,1,structure.ready?structure.summary:'洗盤與換手資料未齊，暫不判定籌碼結構',structure.ready?'洗盤／換手為量價與法人交叉推估，合計最多影響±1分。':'缺少 '+structure.missing.join('、'));
  const custom=rules.filter(r=>r.enabled).map(rule=>{const value=x[rule.metric],available=valid(value),matched=available&&compare(value,rule.op,rule.threshold);return {...rule,available,matched,value:available?value:null,contribution:matched?(rule.bias==='bullish'?1:-1)*rule.weight:0};});
  const score=sum(groups.filter(g=>g.available).map(g=>g.value))+sum(custom.map(c=>c.contribution));
  const bias=score>=2?'bullish':score<=-2?'bearish':'sideways';const complete=groups.every(g=>g.available),available=groups.filter(g=>g.available).length;
  return {x,groups,structure,custom,score,bias,complete,available,total:groups.length,profile:groups.map(g=>g.available?'1':'0').join('')};
 }
 const label=bias=>bias==='bullish'?'偏多延續':bias==='bearish'?'偏弱整理':'區間震盪';
 function horizonScore(s,h){const weights=h===1?{trend:.6,volume:1.5,momentum:.8,foreign:1,domestic:.7,margin:.7,chipStructure:.3}:h===2?{trend:1,volume:.9,momentum:1,foreign:1,domestic:1,margin:1,chipStructure:.5}:{trend:1.2,volume:.5,momentum:1,foreign:1.2,domestic:1,margin:1.1,chipStructure:.6};return sum(s.groups.filter(g=>g.available).map(g=>g.value*weights[g.key]))+sum(s.custom.map(c=>c.contribution));}
 function horizonBias(s,h){const score=horizonScore(s,h);return score>=2?'bullish':score<=-2?'bearish':'sideways';}
 function validation(rows,index,current,kind,rules){const selected=[[],[],[]];for(let i=33;i+3<=index;i++){const s=signals(rows,i,kind,rules);if(s.profile!==current.profile)continue;for(const h of [1,2,3])if(horizonBias(s,h)===horizonBias(current,h))selected[h-1].push((rows[i+h].close/rows[i].close-1)*100);}return [1,2,3].map(h=>{const values=selected[h-1].sort((a,b)=>a-b),n=values.length;return {horizon:h,count:n,up:n?round(values.filter(x=>x>0).length/n*100):null,median:n?values[Math.floor(n/2)]:null,qualified:n>=30};});}
 function analyze(rows,index=rows.length-1,kind='stock',rules=[],options={}){if(index<0||!rows[index])return null;rules=validateRules(rules);const s=signals(rows,index,kind,rules),{x}=s,r=x.r;const weak=!valid(r.ma20)||!valid(r.change);const trend=s.groups.find(g=>g.key==='trend'),vol=s.groups.find(g=>g.key==='volume');
  const missing=s.groups.filter(g=>!g.available).map(g=>g.label),direction=weak?'資料不足，暫不形成完整三日研判':label(s.bias);
  const chips=kind==='future'?'本契約結論依價量與動能；現股融資不適用，期貨法人尚未接入。':s.complete?(s.bias==='bullish'?'量價、法人與槓桿訊號合看，買方條件較占優勢。':s.bias==='bearish'?'量價、法人與槓桿訊號合看，賣壓與轉弱條件較占優勢。':'量價、法人與槓桿方向未一致，目前以區間整理判讀。'):`${missing.join('、')}尚未齊備，目前結論只涵蓋已取得的面向。`;
  const flows=kind==='stock'&&s.complete?`外資近5日${x.foreign5>0?'整體偏買':x.foreign5<0?'整體偏賣':'買賣持平'}，投信${x.trust5>0?'偏買':x.trust5<0?'偏賣':'持平'}、自營商${x.dealer5>0?'偏買':x.dealer5<0?'偏賣':'持平'}；${s.groups.find(g=>g.key==='margin').verdict}。`:'';
  const today=`${r.change>0?'今日收高':r.change<0?'今日收低':'今日平盤'}${valid(x.volumeChange)?x.volumeChange>0?'量增':x.volumeChange<0?'量縮':'量平':''}；${trend.verdict}。${vol.verdict}。${flows}${s.structure.applicable&&s.structure.ready?s.structure.summary:''}${chips}`;
  const confirmation=s.bias==='bullish'?`維持 MA5 ${f(r.ma5,2)} 之上，且外資近5日仍為淨買超，偏多條件才能延續。`:s.bias==='bearish'?`需站回 MA5 ${f(r.ma5,2)}、量比至少1.2倍，並見外資近5日轉買，才構成轉強確認。`:`突破近5日高點 ${f(x.resistance,2)} 且量比至少1.2倍，才有向上脫離整理的證據。`;
  const invalidation=s.bias==='bullish'?`跌破近5日低點 ${f(x.support,2)}，或外資近5日轉為淨賣超，偏多假設失效。`:s.bias==='bearish'?`站回 MA20 ${f(r.ma20,2)} 且外資近5日轉為淨買超，偏弱假設需重評。`:`跌破近5日低點 ${f(x.support,2)} 並放量，區間整理假設轉為偏弱。`;
  const validationResult=weak||options.historical===false?[]:validation(rows,index,s,kind,rules),base=s.groups.filter(g=>g.available).map(g=>g.value),agree=base.length?Math.abs(sum(base))/Math.max(1,sum(base.map(Math.abs))):0;
  const agreement=!s.complete?'低（資料尚未完整）':agree>=.7?'高':agree>=.4?'中':'低';
  const outlook=[1,2,3].map(h=>({horizon:h,bias:horizonBias(s,h),score:horizonScore(s,h),direction:weak?'暫不判定':label(horizonBias(s,h)),condition:h===1?'先看價格能否守住／站回短期均線':h===2?'核對量能與法人方向是否延續':'以三日收盤檢查目前方向假設',historical:validationResult[h-1]||{count:0,qualified:false}}));
  for(const h of outlook){const hist=h.historical;h.ruleDirection=h.direction;if(hist.qualified&&((h.bias==='bullish'&&hist.median<0)||(h.bias==='bearish'&&hist.median>0)))h.direction='震盪觀察（規則與歷史分歧）';}
  return {...s,forecastTitle:outlook[2].direction,title:direction,today,classification:s.bias==='bullish'?'up':s.bias==='bearish'?'risk':'neutral',evidence:s.groups.map(g=>({...g,conclusion:g.verdict})),outlook,confirmation:weak?'先補齊至少20個交易日行情。':kind==='future'?`站上／守住 MA5 ${f(r.ma5,2)} 且量比至少1.2倍，檢查價量是否同向。`:confirmation,invalidation:weak?'資料不足，不設價格失效門檻。':kind==='future'?`失守近5日低點 ${f(x.support,2)} 視為偏弱；收復近5日高點 ${f(x.resistance,2)} 則重評原方向。`:invalidation,agreement,scope:kind==='future'?'價量與技術面':s.complete?'量價／籌碼／法人／外資完整交叉判讀':'部分資料研判',lookback:{foreignDays:rows.slice(Math.max(0,index-4),index+1).filter(x=>valid(x.foreign)).length,marginDays:rows.slice(Math.max(0,index-4),index+1).filter(x=>valid(x.margin)).length},method:'固定規則推演3個交易日：T+1較重視量價，T+3較重視趨勢與籌碼。同規則歷史比例為樣本內回看，未經樣本外回測，不是未來上漲機率。價格未還原權息，除權息可能影響訊號。'};
 }
 root.TurningAnalysis={analyze,signals,features,validateRules,metricNames};if(typeof module!=='undefined')module.exports=root.TurningAnalysis;
})(globalThis);

