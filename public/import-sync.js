'use strict';
let syncJob=null,lastSyncRequest=null;
function syncProgress(text){$('syncProgress').textContent=text;}
async function syncRequest(body){try{return await api('sync',body);}catch(e){if(!/逾時|timeout|failed to fetch|來源|回應 (429|50[0-9])/i.test(e.message))throw e;return api('sync',body);}}
async function syncSelectedInstrument(instrument){
 if(syncJob){toast('已有資料補抓正在執行，請稍候。');return;}
 validDates();const start=$('startDate').value,end=$('endDate').value,periods=TurningSyncPlan.parts(start,end,instrument.kind);const job={cancel:false};syncJob=job;lastSyncRequest={instrument,start,end};const controls=['searchBtn','applyDates','refreshBtn','startDate','endDate','syncCompared'];controls.forEach(id=>$(id).disabled=true);$('syncCancel').hidden=false;$('syncCancel').onclick=()=>{job.cancel=true;syncProgress('正在停止；已匯入資料會保留，完成目前批次後停止。');};
 const failures=[],warnings=[];let coverage=null;
 try{
  for(let k=0;k<periods.length&&!job.cancel;k++){const period=periods[k];syncProgress(`${instrument.name} ${instrument.code}｜價量 ${k+1}／${periods.length} 批：${period.start} ～ ${period.end}，取得後立即儲存。`);try{const r=await syncRequest({instrument,...period,phase:'price'});if(!r.count&&r.message)warnings.push(`${period.start}～${period.end}：${r.message}`);}catch(e){failures.push(`${period.start}～${period.end}：${e.message}`);if(instrument.kind==='future'&&failures.length>=2){failures.push('期貨歷史來源連續失敗；其餘區間尚未取得，請稍後重試。');break;}}}
  coverage=await api('sync',{instrument,start,end,phase:'status'});
  if(coverage.count){$('startDate').value=start;$('endDate').value=end;await loadState(instrument.id);}
  const groups=TurningSyncPlan.groups(coverage.missingChips||[],3);
  for(let k=0;k<groups.length&&!job.cancel;k++){syncProgress(`${instrument.name}｜整段日期籌碼補查 ${k+1}／${groups.length} 批：${groups[k].join('、')}。已存非空資料會保留。`);try{const result=await syncRequest({instrument,start,end,phase:'chips',dates:groups[k]});if(result.warnings?.length)failures.push(...result.warnings);}catch(e){failures.push(`${groups[k].join('、')}：${e.message}`);}}
  coverage=await api('sync',{instrument,start,end,phase:'status'});if(coverage.count)await loadState(instrument.id);
  const missing=instrument.kind==='stock'?(coverage.missingChips||[]).length:0;const complete=!job.cancel&&!failures.length&&coverage.count>0&&!missing;const state=job.cancel?'已停止，可續補':complete?'已匯入並完成可取得資料檢查':'已匯入可取得資料，仍有缺漏';
  $('syncProgress').innerHTML=`<strong>${esc(instrument.name)} ${esc(instrument.code)}｜${state}</strong><p>選定 ${start} ～ ${end}；已存 ${coverage.count} 筆價量${coverage.first?'，實際 '+coverage.first+' ～ '+coverage.last:''}。${instrument.kind==='stock'?`外資缺 ${coverage.missingForeign} 筆、融資缺 ${coverage.missingMargin} 筆。`:'期貨法人尚未接入；現股融資不適用，不會填成零。'}</p><p>${instrument.kind==='stock'?'已逐批嘗試補查整段已存交易日；來源尚未公布、不提供或不適用的欄位維持空白。':'未上市、到期後、休市及來源無資料的日期不造 K 棒。'}</p>${failures.length?'<details><summary>未完成批次 '+failures.length+' 筆</summary><p>'+failures.map(esc).join('<br>')+'</p></details>':''}${warnings.length?'<details><summary>來源無資料區間 '+warnings.length+' 筆</summary><p>'+warnings.map(esc).join('<br>')+'</p></details>':''}${!complete?'<button type="button" id="retrySync">重試未補齊資料</button>':''}`;
  if(!complete)$('retrySync').onclick=()=>{if(lastSyncRequest){$('startDate').value=lastSyncRequest.start;$('endDate').value=lastSyncRequest.end;syncSelectedInstrument(lastSyncRequest.instrument);}};toast(state);
 }catch(e){syncProgress(`${instrument.name}：同步未完成：${e.message}。已成功的批次會保留，可再次確認標的續補。`);toast(e.message);}finally{syncJob=null;controls.forEach(id=>$(id).disabled=false);$('syncCancel').hidden=true;}
 return coverage?{...coverage,cancelled:job.cancel}:null;
}
async function syncSavedTargets(targets){const preferred=currentId;for(const i of targets){const result=await syncSelectedInstrument(i);if(result?.cancelled)break;}if(instruments.some(i=>i.id===preferred))await loadState(preferred);}
$('applyDates').onclick=async()=>{try{validDates();applyRange();const targets=instruments.filter(i=>i.id===currentId||compareIds.has(i.id));await syncSavedTargets(targets);}catch(e){toast(e.message)}};
$('refreshBtn').onclick=async()=>{const targets=[...instruments];if(!targets.length){toast('請先搜尋並確認一個標的。');return;}await syncSavedTargets(targets);};

$('syncCompared').onclick=()=>syncSavedTargets(instruments.filter(i=>compareIds.has(i.id)));
