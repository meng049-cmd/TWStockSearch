import {searchCatalog} from '@/lib/search';
import {backfillReference,db,state,save,validateInstrument,catalog,refresh,fetchInstrument,fetchRows,validBar} from '@/lib/market';
import seeds from '@/lib/seed.json';
export const dynamic='force-dynamic';
const json=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
// This shared database is protected by Sites owner-only dispatch for browser and service callers.
// Do not make this Site public without adding application-level authorization.
export async function GET(req:Request){try{let u=new URL(req.url),p=u.pathname;
 if(p==='/api/state'){const s=await state();const sched:any=await db().prepare("SELECT detail FROM jobs WHERE status='schedule' ORDER BY at DESC LIMIT 1").first();return json({...s,jobs:s.jobs.filter((j:any)=>j.status!=='schedule'),schedule:sched?JSON.parse(sched.detail):null});}
 if(p==='/api/catalog'){const c=await catalog();const matches=searchCatalog(c.items,u.searchParams.get('q')||'',u.searchParams.get('kind'));return json({...c,...matches})}
 if(p==='/api/note')return json(await db().prepare('SELECT body FROM notes WHERE instrument=?').bind(u.searchParams.get('id')).first()||{body:''});
 if(p==='/api/health')return json({ok:true,database:!!await db().prepare('SELECT 1 AS ok').first()});
 return json({error:'找不到此操作'},404);
 }catch(e:any){return json({error:e.message},502)}}
export async function POST(req:Request){try{const u=new URL(req.url);const origin=req.headers.get('origin');if(origin&&origin!==u.origin)return json({error:'不允許跨來源寫入'},403);if(Number(req.headers.get('content-length'))>2500000)return json({error:'檔案太大'},413);const p=u.pathname;const text=await req.text();if(text.length>2500000)return json({error:'檔案太大'},413);const body=text?JSON.parse(text):{};
 if(p==='/api/history')return json(await backfillReference(body));
 if(p==='/api/bootstrap'){let result=[];for(const i of seeds)result.push(await save(i,i.rows,'TWSE seed',null,'ignore'));return json({result})}
 if(p==='/api/preview'){const i=validateInstrument(body.instrument);if(!Array.isArray(body.rows)||body.rows.length>5000||body.rows.some((r:any)=>!validBar(r)))throw Error('資料欄位無效');const old=await db().prepare('SELECT date FROM bars WHERE instrument=?').bind(i.id).all<any>();const dates=new Set(old.results.map((r:any)=>r.date));return json({added:body.rows.filter((r:any)=>!dates.has(r.date)).length,overlap:body.rows.filter((r:any)=>dates.has(r.date)).length})}
 if(p==='/api/import')return json(await save(body.instrument,body.rows,'CSV import',typeof body.csv==='string'?body.csv:null));
 if(p==='/api/note'){if(typeof body.body!=='string'||body.body.length>20000)throw Error('筆記超過長度限制');if(!await db().prepare('SELECT id FROM instruments WHERE id=?').bind(body.id).first())throw Error('標的不存在');await db().prepare('INSERT INTO notes(instrument,body,updated_at) VALUES(?,?,?) ON CONFLICT(instrument) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').bind(body.id,body.body,new Date().toISOString()).run();return json({ok:true})}
 if(p==='/api/schedule'){if(typeof body.id!=='string'||body.time!=='14:00'||body.timezone!=='Asia/Taipei'||typeof body.enabled!=='boolean')throw Error('排程狀態格式錯誤');await db().prepare('INSERT INTO jobs(id,at,status,detail) VALUES(?,?,?,?)').bind(crypto.randomUUID(),new Date().toISOString(),'schedule',JSON.stringify(body)).run();return json({ok:true})}
 if(p==='/api/refresh')return json(await refresh());
 if(p==='/api/quote')return json(await fetchRows(body));
 if(p==='/api/fetch')return json(await fetchInstrument(body));
 return json({error:'找不到此操作'},404);
 }catch(e:any){return json({error:e.message},400)}}
