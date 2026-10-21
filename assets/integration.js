'use strict';
(function(){
 let researchLoaded=false,researchReady=false,pendingCode=null;
 const frame=$('researchFrame'),market=$('marketWorkspace'),research=$('research'),status=$('researchStatus');
 const theme=()=>document.documentElement.dataset.theme||'dark';
 function send(message){frame.contentWindow?.postMessage(message,location.origin);}
 function setWorkspace(mode,updateHash=true){const isResearch=mode==='research';market.hidden=isResearch;research.hidden=!isResearch;document.body.dataset.workspace=mode;$('marketTab').setAttribute('aria-selected',String(!isResearch));$('researchTab').setAttribute('aria-selected',String(isResearch));$('researchSideLink').classList.toggle('active',isResearch);if(isResearch){if(!researchLoaded){researchLoaded=true;frame.src='research/index.html?v=20261021-2';}if(updateHash)history.replaceState(null,'','#research');}else if(updateHash&&location.hash==='#research')history.replaceState(null,'','#overview');}
 function openResearch(code){if(code)pendingCode=code;setWorkspace('research');if(researchReady&&pendingCode){status.textContent='正在載入 '+pendingCode+'…';send({type:'research-select-stock',code:pendingCode});pendingCode=null;}window.scrollTo({top:0,behavior:'smooth'});}
 window.openStockResearch=openResearch;
 $('marketTab').onclick=()=>setWorkspace('market');$('researchTab').onclick=()=>openResearch(selectedStock);$('researchSideLink').onclick=e=>{e.preventDefault();openResearch(selectedStock);};
 $('researchCurrent').onclick=()=>openResearch(selectedStock||'2330');
 document.querySelectorAll('[data-open-research]').forEach(b=>b.onclick=()=>openResearch(selectedStock||b.dataset.openResearch||'2330'));
 document.querySelectorAll('.sidebar nav a:not(#researchSideLink)').forEach(a=>a.addEventListener('click',()=>{setWorkspace('market',false);if(a.hash==='#chart'&&selectedStock)drawChart(selectedStock);}));
 window.addEventListener('hashchange',()=>{if(quotes.stocks.length)renderTickers();
if(location.hash==='#research')openResearch();else if(researchLoaded&&location.hash)setWorkspace('market',false);});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const d=e.data;if(d?.type==='research-ready'){researchReady=true;status.textContent='研究工作區已就緒';send({type:'research-theme',theme:theme()});if(pendingCode){send({type:'research-select-stock',code:pendingCode});pendingCode=null;}}if(d?.type==='research-selected'){const s=quotes.stocks.find(s=>s.code===d.code);status.textContent=(s?s.code+' '+s.name:d.code)+' · 日資料研究';$('selectedResearchStock').textContent=s?s.code+' '+s.name:d.code;}if(d?.type==='research-error')status.textContent='研究資料：'+d.message;});
 frame.addEventListener('load',()=>send({type:'research-theme',theme:theme()}));
 const oldTheme=applyTheme;applyTheme=value=>{oldTheme(value);if(researchLoaded)send({type:'research-theme',theme:value});};
 const oldDraw=drawChart;drawChart=code=>{oldDraw(code);$('researchCurrent').disabled=false;$('researchCurrent').textContent='深入研究 '+code+' ↗';};
 const oldVisuals=renderVisuals;renderVisuals=()=>{oldVisuals();renderTickers();};
 function sparkline(rows,rising){const values=rows.map(r=>r.close).filter(Number.isFinite);if(values.length<2)return null;const low=Math.min(...values),high=Math.max(...values),span=high-low||1;const path=values.map((v,i)=>(i?'L':'M')+(i/(values.length-1)*104).toFixed(1)+' '+(33-(v-low)/span*29).toFixed(1)).join(' ');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 108 38');svg.setAttribute('aria-hidden','true');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);line.setAttribute('fill','none');line.setAttribute('stroke',rising?'var(--red)':'var(--green)');line.setAttribute('stroke-width','2');svg.append(line);return svg;}
 function renderTickers(){const root=$('marketTickers');root.replaceChildren();for(const code of ['2330','2317','2454','1326']){const stock=quotes.stocks.find(s=>s.code===code);if(!stock)continue;const s=metric(stock),b=node('button',null,'ticker-card');b.type='button';b.setAttribute('aria-label','研究 '+s.code+' '+s.name);const top=node('div',null,'ticker-name');top.append(node('strong',s.name),node('span',s.code));const values=node('div',null,'ticker-values');values.append(node('strong',fmt(s.close)),node('span',(s.change>0?'+':'')+fmt(s.change)+'%',s.change>0?'up':s.change<0?'down':''));b.append(top,values);const chart=sparkline(stock.history,s.change>=0);if(chart)b.append(chart);b.append(node('small',s.date+' · 近 '+stock.history.length+' 筆收盤走勢'));b.onclick=()=>openResearch(s.code);root.append(b);}}
 commands.unshift({label:'開啟轉折研究室',action:()=>openResearch(selectedStock),words:'KD MACD RSI 比較 CSV 筆記 技術指標',icon:'↗'});
 for(const c of commands)if(c.target){const target=c.target;c.action=()=>{setWorkspace('market',false);document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});};}
 if(quotes.stocks.length)renderTickers();
if(location.hash==='#research')openResearch();else setWorkspace('market',false);
})();
