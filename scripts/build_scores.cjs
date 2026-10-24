'use strict';
const fs=require('node:fs'),path=require('node:path');
const Model=require('../scoring/score-model.js'),{stockRows}=require('../research/pages-data.js');
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(fallback!==undefined)return fallback;throw error;}}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value)+'\n');fs.renameSync(temp,file);}
function build(root=path.resolve(__dirname,'..')){
 const market=read(path.join(root,'data/stocks.json')),themes=read(path.join(root,'data/themes-v2.json'),{}),status=read(path.join(root,'data/research-status.json'),{});
 if(!Array.isArray(market.stocks)||!market.stocks.length)throw Error('No published market universe');
 const quoteDate=market.stocks.flatMap(s=>(s.history||[]).map(r=>r.date)).filter(Boolean).sort().at(-1);if(!quoteDate)throw Error('No market observation date');
 const industries=new Map();for(const g of themes.groups||[])for(const code of g.codes||[])industries.set(code,g.name);
 const records=[],details=new Map(),warnings=[];
 for(const stock of market.stocks){const code=String(stock.code);if(!/^\d{4}$/.test(code))continue;let saved;
  try{saved=read(path.join(root,'data/history',code+'.json')).history;}catch(error){saved=stock.history||[];warnings.push(code+'：完整歷史未取得，使用市場短快照');}
  const result=Model.scoreStock(stockRows(saved,market.researchUpdatedAt||market.updatedAt),{quoteDate,marketDate:themes.quoteDate,market:themes.hotstocks?.[code]});
  if(market.mode!=='live'){result.score=null;result.eligible=false;result.grade='非正式行情';result.missing.push('正式行情快照');}
  const info={code,name:stock.name||code,industry:industries.get(code)||stock.group||'未分類'};
  const detail={...info,...result,quoteDate,marketDate:themes.quoteDate||null,sourceUpdatedAt:market.updatedAt,researchUpdatedAt:market.researchUpdatedAt||status.checkedAt||null};
  details.set(code,detail);records.push({...info,date:result.date,close:result.close??null,change:result.change??null,score:result.score,rank:null,grade:result.grade,coverage:result.coverage,knownPoints:result.knownPoints,availableMax:result.availableMax,fresh:result.fresh||false,ratio:result.ratio??null,researchTitle:result.research?.title||'資料不足',missingCount:result.missing.length,categories:result.categories.map(c=>({id:c.id,name:c.name,max:c.max,points:c.points,availableMax:c.availableMax})),detailUrl:'scores/'+code+'.json'});
 }
 Model.rank(records);records.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.code.localeCompare(b.code));
 for(const row of records){const detail=details.get(row.code);detail.rank=row.rank;atomic(path.join(root,'data/scores',row.code+'.json'),detail);}
 const snapshot={version:1,modelVersion:'1.1.0',generatedAt:new Date().toISOString(),quoteDate,marketDate:themes.quoteDate||null,sourceUpdatedAt:market.updatedAt,researchUpdatedAt:market.researchUpdatedAt||status.checkedAt||null,universe:'證交所上市盤後官方快照；不含上櫃與期貨',categories:Model.categories,eligibleCount:records.filter(r=>r.score!==null).length,totalCount:records.length,warnings:[...(themes.quoteDate!==quoteDate?['市場活躍度與行情日期不同，待同步後才可排名']:[]),...warnings],sourceWarnings:(status.warnings||[]).slice(0,10),stocks:records};
 atomic(path.join(root,'data/stock-scores.json'),snapshot);return snapshot;
}
if(require.main===module){const at=process.argv.indexOf('--root'),root=at>=0?path.resolve(process.argv[at+1]):undefined;const r=build(root);console.log(`Stock scores: ${r.eligibleCount}/${r.totalCount} eligible, quote date ${r.quoteDate}`);}
module.exports={build};
