'use strict';
(function(){
 let timer=null;
 globalThis.showImportComplete=(title,message)=>{const d=document.getElementById('importComplete');clearTimeout(timer);document.getElementById('importCompleteTitle').textContent=title;document.getElementById('importCompleteText').textContent=message;if(!d.open)d.showModal();timer=setTimeout(()=>{d.close();timer=null;},5000);};
 document.getElementById('closeImportComplete').onclick=()=>{clearTimeout(timer);document.getElementById('importComplete').close();};
 const tip=document.createElement('aside');tip.className='crosshair-reference';tip.hidden=true;tip.setAttribute('role','status');document.body.append(tip);
 globalThis.ChartReference={hide(){tip.hidden=true},show(row,point,host,period){if(!row||!point){tip.hidden=true;return;}const review=dailyReview(row),rect=host.getBoundingClientRect();tip.replaceChildren();for(const [tag,cls,text]of [['small','',`${period||'當日'}盤後解讀 · ${row.date}`],['strong','reference-title',review.title],['p','reference-values',`開 ${fmt(row.open,2)}　高 ${fmt(row.high,2)}　低 ${fmt(row.low,2)}　收 ${fmt(row.close,2)}　量 ${fmt(row.volume)}`],['p','reference-copy',review.conclusion]]){const e=document.createElement(tag);e.className=cls;e.textContent=text;tip.append(e);}tip.hidden=false;const width=tip.offsetWidth||350,height=tip.offsetHeight||240,x=rect.left+point.x,y=rect.top+point.y;tip.style.left=Math.max(12,Math.min(x+18,window.innerWidth-width-12))+'px';tip.style.top=Math.max(12,Math.min(y+18,window.innerHeight-height-12))+'px';}};
})();
