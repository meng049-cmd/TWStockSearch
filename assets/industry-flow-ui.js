'use strict';
(function(root){
 const $=id=>document.getElementById(id),model=root.IndustryBubbles,ns='http://www.w3.org/2000/svg';
 const names={foreign:'外資',trust:'投信',dealer:'自營商',financing:'融資餘額'},sourceIds={foreign:'flowSourceForeign',trust:'flowSourceTrust',dealer:'flowSourceDealer',financing:'flowSourceFinancing'};
 const sourceColors={foreign:'#72a8ff',trust:'#51c6a6',dealer:'#d494ed',financing:'#efb45d'},sectorColors=['#72a8ff','#f0b35a','#d494ed','#51c6a6'];
 const quadrants=['累計流入・當日流入','累計流出・當日轉入','累計流出・當日流出','累計流入・當日轉出'];
 let snapshot=null,current=null,selectedCodes=[],inspection=null,lastAnimationKey=null,playing=false,playTimer=null;
 const pickerNodes=new Map();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
 const svg=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!=null)n.textContent=text;return n};
 const money=v=>Number.isFinite(v)?(v>0?'+':'')+(v/1e8).toLocaleString('zh-TW',{maximumFractionDigits:2}):'資料不足';
 const lots=v=>Number.isFinite(v)?(v>0?'+':'')+v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'資料不足';
 const sources=()=>Object.keys(names).filter(k=>$(sourceIds[k]).checked);
 const sourceText=()=>sources().map(k=>names[k]).join('＋')||'未選資金來源';
 const tracing=()=>$('flowMode').value==='trajectory';
 const sectorColor=code=>sectorColors[Math.max(0,selectedCodes.indexOf(code))%sectorColors.length];
 function details(p){return p.name+'｜觀察日 '+p.date+'｜計算區間 '+p.startDate+'～'+p.date+'｜來源 '+sourceText()+'｜累計估算淨額 '+money(p.net)+' 億元｜觀察日淨流速 '+money(p.speed)+' 億元／日｜區間流動規模 '+money(p.mass)+' 億元｜最低樣本覆蓋 '+Math.round(p.coverage*100)+'%｜所選來源明細：'+sources().map(k=>names[k]+' '+money(p.sums[k])+' 億元').join('；')+(sources().includes('financing')?'｜融資當日增減 '+lots(p.financingChange)+' 張／餘額 '+lots(p.financingBalance)+' 張':'')}
 function render(){
  if(!snapshot)return;
  const days=Number($('flowRange').value)||1,trailDays=Number($('flowTrail').value)||20,end=$('flowEndDate').value||snapshot.latestDate,metrics=sources(),isTrace=tracing();
  current=isTrace?model.trajectory(snapshot,days,end,metrics,selectedCodes,trailDays):model.points(snapshot,days,end,metrics);
  $('flowTrailControls').hidden=!isTrace;$('flowTraceControls').hidden=false;
  if(!current.dates.includes(inspection))inspection=current.dates.at(-1);
  const timeline=isTrace?current.dates:snapshot.dates;
  $('flowTraceStep').max=String(Math.max(0,timeline.length-1));$('flowTraceStep').value=String(Math.max(0,timeline.indexOf(isTrace?inspection:current.dates.at(-1))));$('flowTraceStep').disabled=!timeline.length;
  $('flowTraceCaption').textContent=(isTrace?'焦點交易日 ':'快照交易日 ')+(isTrace?inspection:current.dates.at(-1)||'無資料');
  const host=$('industryQuadrants');host.replaceChildren();
  const layout=model.layout(current.points),{bounds:b,cx,cy,xLimit,yLimit}=layout,w=b.right-b.left,h=b.bottom-b.top;
  const chart=svg('svg',{viewBox:'0 0 1100 620',class:'bubble-chart',role:'img','aria-label':isTrace?'產業連續交易日淡色氣泡，焦點日發亮，每顆圓點是一個產業的一個觀察日':'全市場族群資金流向四象限，每個產業一顆圓點'});
  chart.append(svg('rect',{x:b.left,y:b.top,width:w,height:h,fill:'none',stroke:'var(--line)'}));
  for(const f of [-1,-.5,0,.5,1]){
   const x=cx+f*w/2,y=cy-f*h/2;
   chart.append(svg('line',{x1:x,y1:b.top,x2:x,y2:b.bottom,stroke:f===0?'var(--accent)':'var(--line)'}),svg('line',{x1:b.left,y1:y,x2:b.right,y2:y,stroke:f===0?'var(--accent)':'var(--line)'}));
   chart.append(svg('text',{x,y:b.bottom+23,'text-anchor':'middle'},money(f*xLimit)),svg('text',{x:b.left-10,y:y+4,'text-anchor':'end'},money(f*yLimit)));
  }
  chart.append(svg('text',{x:cx,y:605,'text-anchor':'middle'},'← 區間淨流出　　估算資金淨額（億元）　　區間淨流入 →'),svg('text',{x:22,y:cy,transform:'rotate(-90 22 '+cy+')','text-anchor':'middle'},'各觀察日估算淨流速（億元／日）'));
  [[b.right-8,b.top+20,'end',0],[b.left+8,b.top+20,'start',1],[b.left+8,b.bottom-10,'start',2],[b.right-8,b.bottom-10,'end',3]].forEach(([x,y,anchor,i])=>chart.append(svg('text',{x,y,'text-anchor':anchor,class:'quadrant-caption'},quadrants[i])));
  const animationKey=JSON.stringify([isTrace,days,trailDays,end,metrics,selectedCodes,isTrace?inspection:null,current.points.map(p=>[p.code,p.date,p.net,p.speed,p.mass])]);
  const reducedMotion=!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const animateTrails=isTrace&&animationKey!==lastAnimationKey&&!reducedMotion;lastAnimationKey=animationKey;
  const groups=new Map();for(const p of layout.points){if(!groups.has(p.code))groups.set(p.code,[]);groups.get(p.code).push(p)}
  const ordered=[...layout.points].sort((a,b)=>(isTrace?Number(a.date===inspection)-Number(b.date===inspection):0)||b.mass-a.mass);
  for(const p of ordered){
   const color=isTrace?sectorColor(p.code):sourceColors[p.dominant],focus=isTrace&&p.date===inspection,group=groups.get(p.code),endpoint=p===group[0]||p===group.at(-1);
   const opacity=isTrace?(reducedMotion&&focus?1:0.02+0.03*p.sequence/Math.max(1,current.dates.length-1)):.45;
   const newest=isTrace&&p===group.at(-1);
   const circle=svg('circle',{cx:p.cx,cy:p.cy,r:p.r,fill:color,'fill-opacity':opacity,stroke:'none','stroke-width':0,tabindex:0,role:'button','data-sector':p.code,'data-date':p.date,'data-focus':String(focus),'data-newest':String(newest),'aria-label':details(p)});
   circle.append(svg('title',{},details(p)));
   if(animateTrails&&circle.animate){
    if(focus)circle.animate([{fillOpacity:1,offset:0},{fillOpacity:1,offset:1000/1450},{fillOpacity:opacity,offset:1}],{duration:1450,easing:'linear',fill:'none'});
    else circle.animate([{fillOpacity:0.08},{fillOpacity:opacity}],{duration:500,easing:'ease-out',fill:'none'});
   }
   const show=()=>$('industryFlowReadout').textContent=details(p);
   circle.addEventListener('click',show);circle.addEventListener('mouseenter',show);circle.addEventListener('focus',show);circle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show()}});chart.append(circle);
   if(p.mass>0&&(!isTrace||endpoint||focus))chart.append(svg('text',{x:Math.max(b.left+65,Math.min(b.right-65,p.cx)),y:Math.max(b.top+35,Math.min(b.bottom-28,p.cy+4)),'text-anchor':'middle',class:'bubble-name','fill-opacity':isTrace&&!focus?0.25:1},p.name+(isTrace?' '+p.date.slice(5):'')));
  }
  host.append(chart);renderLegend(isTrace);
  const dateText=current.dates.length?current.dates[0]+'～'+current.dates.at(-1):'無可用日期';
  $('industryFlowStatus').textContent=dateText+'｜來源 '+sourceText()+'｜每顆氣泡累計 '+days+' 個交易日｜'+(isTrace?selectedCodes.length+' 個產業、'+current.points.length+' 顆日氣泡、缺少區間資料 '+current.excluded+' 筆':current.points.length+' 個族群、缺少區間資料 '+current.excluded+' 個族群');
  $('flowStageSummary').textContent=(isTrace?'產業時間軌跡':'全市場族群快照')+'｜'+sourceText()+'｜每顆累計 '+days+' 日｜截止 '+(current.dates.at(-1)||'無資料');
  const index=snapshot.dates.indexOf(current.dates.at(-1));$('flowPrev').disabled=index<=0;$('flowNext').disabled=index>=snapshot.dates.length-1;$('exportIndustryFlows').disabled=!current.points.length;
  if(!metrics.length)host.append(el('p','請至少勾選一個資金來源；目前沒有計算資金合計。'));
  else if(isTrace&&!selectedCodes.length)host.append(el('p','請在「產業比較選單」勾選 1～4 個產業，或按「預設四產業」。'));
  else if(!current.points.length)host.append(el('p','所選日期缺少完整計算區間，請縮短累計天數或改選日期。'));
  const inspected=isTrace?current.points.filter(p=>p.date===inspection):current.points;
  renderTable(inspected,isTrace);updatePlayControl();
  $('industryFlowReadout').textContent=isTrace?(inspected.length?inspected.map(details).join('\n'):'焦點交易日無完整區間資料，缺值保留空白。'):'滑過、點選或以鍵盤聚焦圓點，查看族群資金規模與所選法人明細。';
 }
 function renderLegend(isTrace){const host=$('flowLegend');host.replaceChildren();for(const key of isTrace?selectedCodes:sources()){
  const span=el('span'),dot=el('i');dot.style.background=isTrace?sectorColor(key):sourceColors[key];span.append(dot,el('span',isTrace?snapshot.sectors.find(s=>s.code===key)?.name:names[key]));host.append(span);
 }host.append(el('span',isTrace?'同色＝同產業；每顆氣泡＝一個交易日；無邊框、無軌跡線；淡泡泡是歷史位置，播放焦點日發亮一秒後淡回。可用時間軸或自動播放觀察日期。':'顏色＝所選來源中，區間估算淨額絕對值最大的來源；勾選的來源合計成每產業一顆氣泡。'));host.append(el('span','圓面積＝區間來源規模；橫軸＝累計估算淨額；縱軸＝當日淨流速。'))}
 function renderTable(points,isTrace){$('flowTableTitle').textContent=isTrace?'焦點交易日 '+(inspection||'')+' 產業明細':'截止日族群資金明細';const host=$('industryLeaderboard');host.replaceChildren();const table=el('table');table.className='flow-table';const head=el('tr');['產業','觀察日','估算淨額（億元）','當日淨流速（億元／日）','流動規模（億元）'].forEach(t=>head.append(el('th',t)));table.append(head);for(const p of [...points].sort((a,b)=>b.mass-a.mass)){const tr=el('tr');[p.name,p.date,money(p.net),money(p.speed),money(p.mass)].forEach(t=>tr.append(el('td',t)));table.append(tr)}host.append(table)}
 function syncPicker(){for(const [code,{input}]of pickerNodes){input.checked=selectedCodes.includes(code);input.disabled=!input.checked&&selectedCodes.length>=4}$('industrySelectionLabel').textContent=selectedCodes.length?'已選 '+selectedCodes.length+'／4：'+selectedCodes.map(c=>snapshot.sectors.find(s=>s.code===c)?.name).join('、'):'產業比較選單：可複選 1～4 個';$('industrySelectionStatus').textContent='已選 '+selectedCodes.length+'／4 個產業。勾選一個看單一產業連續日軌跡；勾選四個可在同圖比較。'}
 function buildPicker(){const host=$('industryOptions');host.replaceChildren();pickerNodes.clear();for(const sector of [...snapshot.sectors].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'))){const label=el('label'),input=el('input');input.type='checkbox';input.value=sector.code;input.setAttribute('aria-label','比較產業 '+sector.name);label.append(input,el('span',sector.name));input.onchange=()=>{stopPlayback();if(input.checked&&!selectedCodes.includes(sector.code)&&selectedCodes.length<4)selectedCodes.push(sector.code);if(!input.checked)selectedCodes=selectedCodes.filter(c=>c!==sector.code);$('flowMode').value='trajectory';inspection=null;syncPicker();render()};pickerNodes.set(sector.code,{input,label,name:sector.name});host.append(label)}syncPicker()}
 function initialize(data){stopPlayback();const oldLast=snapshot?.latestDate,oldEnd=$('flowEndDate').value;snapshot=data;selectedCodes=selectedCodes.filter(code=>data.sectors.some(s=>s.code===code));buildPicker();$('flowEndDate').min=data.dates[0];$('flowEndDate').max=data.latestDate;$('flowEndDate').value=oldEnd&&oldEnd!==oldLast?oldEnd:data.latestDate;render()}
 function move(step){stopPlayback();if(!snapshot)return;const end=current?.dates.at(-1)||snapshot.latestDate,i=snapshot.dates.indexOf(end);$('flowEndDate').value=snapshot.dates[Math.max(0,Math.min(snapshot.dates.length-1,i+step))];inspection=null;render()}
 function updatePlayControl(){const button=$('flowPlay');button.textContent=playing?'暫停播放':'自動播放';button.setAttribute('aria-pressed',String(playing));button.title=tracing()?'由舊至新播放所選產業交易日':'選擇產業時間軌跡後可播放';button.disabled=!tracing()||!current?.points.length||current.dates.length<2;}
 function stopPlayback(){if(playTimer!==null){root.clearTimeout(playTimer);playTimer=null;}playing=false;updatePlayControl();}
 function schedulePlayback(){if(!playing)return;const value=Number($('flowPlaySpeed').value),delay=[1500,2000,3000,5000].includes(value)?value:2000;playTimer=root.setTimeout(()=>{playTimer=null;if(!playing||!tracing()||!current?.dates.length){stopPlayback();return}const i=current.dates.indexOf(inspection);if(i>=current.dates.length-1){stopPlayback();return}inspection=current.dates[i+1];render();if(i+1===current.dates.length-1)stopPlayback();else schedulePlayback();},delay);}
 $('flowPlay').onclick=()=>{if(playing){stopPlayback();return}if(!tracing()||!current?.points.length||current.dates.length<2)return;if(current.dates.indexOf(inspection)>=current.dates.length-1)inspection=current.dates[0];playing=true;render();schedulePlayback();};
 $('flowPlaySpeed').onchange=()=>{if(playing){if(playTimer!==null)root.clearTimeout(playTimer);playTimer=null;schedulePlayback();}};
 document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stopPlayback()});
 for(const id of ['flowRange','flowMode','flowTrail','flowEndDate'])$(id).onchange=()=>{stopPlayback();inspection=null;render()};for(const id of Object.values(sourceIds))$(id).onchange=()=>{stopPlayback();render()};
 $('flowSourcesAll').onclick=()=>{stopPlayback();for(const id of Object.values(sourceIds))$(id).checked=true;render()};$('flowSourcesNone').onclick=()=>{stopPlayback();for(const id of Object.values(sourceIds))$(id).checked=false;render()};
 $('flowPrev').onclick=()=>move(-1);$('flowNext').onclick=()=>move(1);$('flowLatest').onclick=()=>{stopPlayback();if(snapshot){$('flowEndDate').value=snapshot.latestDate;inspection=null;render()}};
 $('flowTraceStep').oninput=()=>{stopPlayback();if(!snapshot)return;const i=Number($('flowTraceStep').value);if(tracing())inspection=current?.dates[i];else{const date=snapshot.dates[i];if(!date)return;$('flowEndDate').value=date;inspection=null;}render()};
 const bringIntoView=id=>{const host=$(id);host.scrollIntoView({behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});host.focus?.({preventScroll:true})};
 $('flowConfirm').onclick=()=>bringIntoView('flowChartStage');$('flowReselect').onclick=()=>bringIntoView('flowSelectionTop');
 $('industryPresetFour').onclick=()=>{stopPlayback();if(!snapshot)return;const known=new Set(snapshot.sectors.map(s=>s.code));selectedCodes=['24','25','26','28'].filter(c=>known.has(c));for(const s of snapshot.sectors)if(selectedCodes.length<4&&!selectedCodes.includes(s.code))selectedCodes.push(s.code);$('flowMode').value='trajectory';inspection=null;syncPicker();render()};
 $('industryClear').onclick=()=>{stopPlayback();selectedCodes=[];syncPicker();render()};$('industrySearch').oninput=()=>{const q=$('industrySearch').value.trim().toLowerCase();for(const [code,item]of pickerNodes)item.label.hidden=!(item.name.toLowerCase().includes(q)||code.includes(q))};
 $('exportIndustryFlows').onclick=()=>{if(!current?.points.length)return;const rows=[['產業','資金來源','計算起日','觀察日','累計天數','估算淨額(元)','觀察日淨流速(元/日)','流動規模(元)','融資當日增減(張)','融資餘額(張)'],...current.points.map(p=>[p.name,sourceText(),p.startDate,p.date,$('flowRange').value,p.net,p.speed,p.mass,p.financingChange,p.financingBalance])],csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='industry-capital-flow-'+(tracing()?'trajectories':'snapshot')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 root.IndustryFlowUI={initialize};
})(globalThis);
