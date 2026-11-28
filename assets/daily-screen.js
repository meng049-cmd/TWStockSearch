'use strict';
(function(root){
 const finite=Number.isFinite,mean=(rows,key)=>rows.reduce((s,r)=>s+r[key],0)/rows.length;
 const rules={entry:'收盤高於 MA20、MA5 高於 MA20、當日上漲未達7%、成交量至少為前20日均量1.2倍，並突破前20日／前5日高點或重新站回 MA5。',exit:'放量跌破前20日低點，或放量收低且失守 MA20，或成交量至少為前20日均量1.8倍、下跌且收盤落在當日振幅下方35%。',liquidity:'僅四碼普通股；至少21個有效交易日；前20日均量至少500張、估算均成交金額至少1,000萬元。前期均量與高低點均不含當日。',ranking:'先依突破／跌破20日高低點、5日高點／失守月線、站回短均／高量收低的規則順序，再依量比、當日漲跌幅、代號排序。僅列達標者，各最多五檔；不是報酬預測。'};
 function evaluate(stock,history,date){
  if(!/^[1-9]\d{3}$/.test(stock.code))return null;
  const rows=[...new Map(history.filter(r=>r.date<=date&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&['open','high','low','close','volume'].every(k=>finite(r[k]))&&r.close>0&&r.low>0&&r.volume>=0&&r.high>=Math.max(r.open,r.close,r.low)&&r.low<=Math.min(r.open,r.close)).map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(rows.at(-1)?.date!==date||rows.length<21)return null;
  const r=rows.at(-1),p=rows.at(-2),prior=rows.slice(-21,-1),v20=mean(prior,'volume'),turnover20=prior.reduce((s,r)=>s+r.close*r.volume,0)/20;
  if(v20<500000||turnover20<1e7)return null;
  const ma5=mean(rows.slice(-5),'close'),ma20=mean(rows.slice(-20),'close'),priorMa5=mean(rows.slice(-6,-1),'close'),ratio=r.volume/v20,change=(r.close/p.close-1)*100;
  const high20=Math.max(...prior.map(r=>r.high)),high5=Math.max(...prior.slice(-5).map(r=>r.high)),low20=Math.min(...prior.map(r=>r.low)),position=r.high>r.low?(r.close-r.low)/(r.high-r.low):.5;
  const breakout20=r.close>high20,breakout5=r.close>high5,reclaim=p.close<=priorMa5&&r.close>ma5;
  const entry=r.close>ma20&&ma5>ma20&&change>0&&change<7&&ratio>=1.2&&(breakout20||breakout5||reclaim);
  const breakdown=r.close<low20,below20=r.close<ma20,distribution=ratio>=1.8&&change<0&&position<=.35;
  const exit=ratio>=1.2&&change<0&&(breakdown||below20||distribution);
  const base={code:stock.code,name:stock.name,exchange:stock.exchange,date,close:r.close,change,ratio,volumeLots:r.volume/1000,ma5,ma20,high20,high5,low20};
  return {entry:entry?{...base,priority:breakout20?3:breakout5?2:1,reason:breakout20?'放量突破前20日高點':breakout5?'多頭排列、放量突破前5日高點':'趨勢偏多、放量重新站回 MA5'}:null,exit:exit?{...base,priority:breakdown?3:below20?2:1,reason:breakdown?'放量跌破前20日低點':below20?'放量下跌、失守 MA20':'高量下跌、收盤落在當日振幅下方35%'}:null};
 }
 function rank(items,side){return [...items].sort((a,b)=>b.priority-a.priority||b.ratio-a.ratio||(side==='entry'?b.change-a.change:a.change-b.change)||a.code.localeCompare(b.code));}
 function shortlist(items,side,mode,futures,now){
  const C=root.StockDesk||(typeof require==='function'?require('./core.js'):null);
  return rank(C.filterFutures(items,mode,futures,now),side).slice(0,5);
 }
 const api={evaluate,rank,shortlist,rules};root.DailyScreen=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
