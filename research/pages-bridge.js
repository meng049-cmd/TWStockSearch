'use strict';
(function(){
 let readyResolve,readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
 function theme(value){document.documentElement.dataset.theme=value==='light'?'light':'dark';if(data.length)render();}
 try{theme(localStorage.getItem('twstocksearch-theme')||'dark');}catch{}
 const announce=(type,detail={})=>{if(window.parent!==window)window.parent.postMessage({type,...detail},location.origin);};
 window.addEventListener('DOMContentLoaded',async()=>{try{await window.researchBoot();readyResolve();announce('research-ready');const code=new URL(location.href).searchParams.get('stock');if(code)await openStock(code);}catch(e){readyReject(e);announce('research-error',{message:e.message});}});
 let selecting=Promise.resolve();
 function openStock(code){if(!/^\d{4,6}$/.test(code))return;selecting=selecting.catch(()=>{}).then(async()=>{await ready;$('notice').textContent='正在載入 '+code+' 的研究資料…';const id=await pages.selectStock(code);await loadState(id);window.scrollTo({top:0,behavior:'smooth'});announce('research-selected',{code});}).catch(e=>{toast(e.message);announce('research-error',{message:e.message});});return selecting;}
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent)return;if(e.data?.type==='research-select-stock')openStock(e.data.code);if(e.data?.type==='research-theme')theme(e.data.theme);});
 $('backupResearch').onclick=async()=>{try{const contents=await pages.backup(),blob=new Blob([JSON.stringify(contents,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='TWStockSearch-research-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出筆記與匯入資料備份');}catch(e){toast(e.message)}};
 $('restoreResearch').onclick=()=>$('backupFile').click();
 $('backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20000000)throw Error('備份檔上限為 20 MB');const count=await pages.restore(JSON.parse(await f.text()));await loadState();toast('已合併還原 '+count+' 個研究標的');}catch(e){toast('備份未還原：'+e.message);}finally{e.target.value='';}};
 document.querySelectorAll('.research-tabs a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.research-tabs a').forEach(b=>b.classList.toggle('active',a===b));}));
 const original=setCurrent;setCurrent=id=>{original(id);const i=instruments.find(x=>x.id===id);if(i?.kind==='stock')announce('research-selected',{code:i.code});};
})();
