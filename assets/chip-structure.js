'use strict';
(function(root){
 const finite=v=>typeof v==='number'&&Number.isFinite(v),formatters=new Map();
 const fmt=(v,d=1)=>{if(!finite(v))return '—';if(!formatters.has(d))formatters.set(d,new Intl.NumberFormat('zh-TW',{maximumFractionDigits:d}));return formatters.get(d).format(v);};
 const sum=(rows,key)=>rows.length===5&&rows.every(r=>finite(r[key]))?rows.reduce((s,r)=>s+r[key],0):null;
 const result=(state,conclusion,chipImpact,trendImpact,score=0)=>({state,conclusion,chipImpact,trendImpact,score,evidence:[]});
 function analyze(rows,index=rows.length-1,kind='stock'){
  const r=rows[index];if(!r)return null;
  const limits='洗盤與換手屬規則推估；日K、法人淨額與融資無法識別交易對手或確認主力意圖。目前未接入流通股數與歷史股權分散，故不計算換手率，也不宣稱籌碼已集中。';
  if(kind!=='stock')return {applicable:false,ready:false,date:r.date,score:0,summary:'期貨需未平倉量與期貨法人部位，現股洗盤／換手規則不適用。',limits};
  const prior=rows.slice(Math.max(0,index-20),index),prior5=prior.slice(-5),recent=rows.slice(Math.max(0,index-4),index+1),p=rows[index-1],p5=rows[index-5],p20=rows[index-20];
  const foreign5=sum(recent,'foreign'),trust5=sum(recent,'trust'),dealer5=sum(recent,'dealer'),margin5=sum(recent,'margin');
  const inst5=[foreign5,trust5,dealer5].every(finite)?foreign5+trust5+dealer5:null;
  const instToday=['foreign','trust','dealer'].every(k=>finite(r[k]))?r.foreign+r.trust+r.dealer:null;
  const avg5=prior5.length===5&&prior5.every(x=>finite(x.volume))?prior5.reduce((s,x)=>s+x.volume,0)/5:null;
  const ratio=finite(r.ratio)?r.ratio:avg5>0?r.volume/avg5:null;
  const priorLow=prior.length===20?Math.min(...prior.map(x=>x.low)):null,low5=prior5.length===5?Math.min(...prior5.map(x=>x.low)):null,high5=prior5.length===5?Math.max(...prior5.map(x=>x.high)):null;
  const support=finite(priorLow)?finite(p?.ma20)?Math.max(priorLow,p.ma20):priorLow:null;
  const range=r.high-r.low,position=range>0?(r.close-r.low)/range:.5,upperWick=range>0?(r.high-Math.max(r.open,r.close))/range:0;
  const change=finite(r.change)?r.change:p?.close>0?(r.close/p.close-1)*100:null;
  const priorTrend=!!(p5&&p20&&((finite(p5.ma20)&&finite(p5.ma5)&&p5.close>p5.ma20&&p5.ma5>=p5.ma20)||p5.close>=p20.close*1.03));
  const supportHeld=finite(support)&&r.close>=support*.99,breakdown=finite(support)&&r.close<support*.99;
  const pullback=finite(high5)&&r.close<=high5*.995&&r.close>=high5*.92&&change<=.5;
  const reclaim=finite(low5)&&r.low<low5&&r.close>=low5&&position>=.6;
  const missing=[];if(prior.length<20)missing.push('至少20筆先前行情');for(const [key,label]of [['foreign','外資'],['trust','投信'],['dealer','自營商'],['margin','融資']])if(sum(recent,key)===null)missing.push('近5日'+label);
  const priceReady=['open','high','low','close','volume'].every(k=>finite(r[k]))&&r.close>0&&range>=0&&r.high>=Math.max(r.open,r.close)&&r.low<=Math.min(r.open,r.close)&&r.volume>=0&&finite(ratio)&&ratio>=0&&finite(change)&&finite(support)&&finite(high5)&&prior.length===20;
  if(!priceReady&&!missing.includes('至少20筆先前行情'))missing.push('可用的量價與支撐資料');
  const ready=priceReady&&missing.length===0;
  const evidence=[`當日量／前5日均量 ${fmt(ratio,2)} 倍；漲跌 ${fmt(change,2)}%`,`收盤 ${fmt(r.close,2)}；參考支撐 ${fmt(support,2)}（前日月線與前20日低點較高者）`,`近5日外資 ${fmt(foreign5)} 張；三大法人合計 ${fmt(inst5)} 張`,`近5日融資增減 ${fmt(margin5)} 張；收盤位於當日振幅 ${fmt(position*100,0)}% 處`];
  let washout,turnover;
  if(!ready){
   washout=result('insufficient','資料不足，暫不判定洗盤或籌碼鬆動','缺少 '+missing.join('、')+'，無法完整核對承接與槓桿變化。','現有價格變化不足以證實洗盤；不因此上調走勢強度。');
   turnover=result('insufficient',ratio>=1.5?'有放量成交，換手方向資料不足':'換手結構資料不足','成交量只能顯示交易熱度，買賣承接方向仍待補齊。','暫不將成交放大解讀為轉強或出貨。');
  }else{
   if(breakdown&&ratio>=1.2&&change<0&&inst5<0){
    washout=result('risk','放量跌破支撐，偏向籌碼鬆動','法人近5日偏賣，支撐失守；'+(margin5>0?'價弱且融資增加，槓桿承接壓力升高。':'融資下降仍不足以抵銷賣壓。'),'短線偏弱，不能只因融資減少就當作洗盤。',-1);
   }else if(priorTrend&&supportHeld&&(pullback||reclaim)&&(ratio<=.85||reclaim)&&margin5<0&&(foreign5>=0||inst5>=0)){
    washout=result('watch','具洗盤／整理跡象，仍待轉強確認','回檔守住參考支撐、融資減少，且法人未同步全面撤出；有去槓桿與承接跡象。','上升結構尚未破壞；收復短均或整理高點後，才提高續強判斷。',.5);
   }else if(breakdown){
    washout=result('risk','支撐已失守，洗盤假設暫不成立','價格結構轉弱；'+(margin5>0?'融資仍增加，籌碼穩定度偏弱。':'即使融資下降，仍需觀察承接能否止跌。'),'先視為弱勢整理，重新站回支撐前不提高續強判斷。',-.5);
   }else{
    washout=result('neutral','洗盤證據未成形，先視為一般整理','目前未同時出現「先前轉強、回檔守支撐、去槓桿、法人承接」條件。','維持原有量價與趨勢判斷；單日下跌或融資減少均不足以確認洗盤。');
   }
   if(ratio>=1.5&&supportHeld&&change>0&&position>=.6&&(instToday>=0||inst5>=0)&&margin5<=0){
    turnover=result('strong','有放量承接型換手跡象','放量收高、法人承接與融資未擴張同時出現，籌碼承接條件較穩定；集中度仍未驗證。','量能有配合，短線偏強；需續守支撐並維持承接。',.5);
   }else if(ratio>=1.5&&(position<=.35||upperWick>=.45||change<0)&&inst5<0){
    turnover=result('risk','有賣壓型換手跡象，籌碼偏鬆動','成交放大但收盤承接不足，法人近5日偏賣；需留意高檔供給或退場壓力。','放量未有效轉強，'+(breakdown?'且支撐失守，走勢偏弱。':'短線強度降低，需防整理擴大。'),-.5);
   }else if(ratio>=1.5){
    turnover=result('watch','有活躍換手跡象，承接強弱待確認','成交顯著放大；'+(margin5>0?'融資同步增加，承接伴隨槓桿擴張。':'法人與價格未形成一致承接訊號。'),'放量本身不代表轉強，需看後續收盤位置與支撐是否延續。');
   }else if(ratio>=1.2&&finite(r.foreign)&&finite(r.trust)&&finite(r.dealer)&&r.foreign*(r.trust+r.dealer)<0){
    turnover=result('watch','法人流向分歧，有換手跡象待驗證','外資與內資法人方向相反、成交量增加；淨額不能識別實際交易對手。','能守支撐且續收高較有利；若放量收低，應降低強度判斷。');
   }else{
    turnover=result('neutral','未見明顯放量換手跡象','目前未達本模型的放量換手門檻；這不表示沒有持有人更替。','換手訊號暫不增減走勢強度，仍由價格、法人與融資方向主導。');
   }
  }
  washout.evidence=evidence;turnover.evidence=[`成交 ${fmt(r.volume)} 張；前5日量比 ${fmt(ratio,2)} 倍`,`當日法人淨額 ${fmt(instToday)} 張；淨額／成交量 ${r.volume>0&&finite(instToday)?fmt(instToday/r.volume*100,2):'—'}%（非換手率）`,`當日上影占振幅 ${fmt(upperWick*100,0)}%；收盤位置 ${fmt(position*100,0)}%`,`近5日融資 ${fmt(margin5)} 張；持股集中度尚未接入`];
  washout.confirmation=`守住參考支撐 ${fmt(support,2)}、收復 MA5 ${fmt(r.ma5,2)} 並放量至1.2倍以上，且近5日法人不轉淨賣。`;
  washout.invalidation=`收盤跌破參考支撐 ${fmt(finite(support)?support*.99:null,2)}，或法人近5日轉賣且價跌資增，洗盤假設重評。`;
  turnover.confirmation=`量比達1.5倍以上、收盤位於當日振幅上方60%，配合法人承接與融資未擴張，才列為承接型。`;
  turnover.invalidation=`收盤跌破參考支撐 ${fmt(finite(support)?support*.99:null,2)}，或放量收在當日振幅下方35%且法人偏賣，降低承接型判斷。`;
  if(!ready){washout.confirmation=turnover.confirmation='先補足 '+missing.join('、')+'，再交叉驗證。';washout.invalidation=turnover.invalidation='資料未齊時不建立洗盤或換手強弱假設。';}
  const score=ready?Math.max(-1,Math.min(1,washout.score+turnover.score)):null;
  return {applicable:true,ready,date:r.date,score,washout,turnover,summary:washout.conclusion+'；'+turnover.conclusion+'。',missing,metrics:{ratio,support,closePosition:position,institutional5:inst5,institutionalToday:instToday,margin5},limits,method:'規則門檻：量比≤0.85視為量縮、≥1.5視為顯著放量；支撐容許1%偏離。此組訊號重用量價與籌碼資料，只以合計±1分的低權重補充三日研判，並非獨立驗證的預測因子。'};
 }
 root.TurningChipStructure={analyze};if(typeof module!=='undefined')module.exports=root.TurningChipStructure;
})(globalThis);
