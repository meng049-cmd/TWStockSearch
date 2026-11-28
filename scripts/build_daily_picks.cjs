'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('../assets/daily-screen.js');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function build(){
 const stocks=new Map();
 for(const [file,exchange,dir] of [['data/stocks.json','TWSE','history'],['data/otc-stocks.json','TPEX','otc-history']])for(const stock of read(file).stocks||[]){
  if(!/^[1-9]\d{3}$/.test(stock.code))continue;
  const filePath=path.join(root,'data',dir,stock.code+'.json');if(!fs.existsSync(filePath))continue;
  const history=JSON.parse(fs.readFileSync(filePath,'utf8')).history||[];
  stocks.set(stock.code,{stock:{code:stock.code,name:stock.name,exchange},history});
 }
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
 const dates=[...new Set([...stocks.values()].flatMap(s=>s.history.slice(-40).map(r=>r.date)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today))].sort().slice(-20);
 const sessions=dates.map(date=>{let eligible=0,withData=0;const entry=[],exit=[];
  for(const {stock,history} of stocks.values()){
   if(history.some(r=>r.date===date))withData++;
   const result=M.evaluate(stock,history.slice(-100),date);if(!result)continue;eligible++;if(result.entry)entry.push(result.entry);if(result.exit)exit.push(result.exit);
  }
  return {date,withData,eligible,universe:stocks.size,entry:M.rank(entry,'entry'),exit:M.rank(exit,'exit')};
 });
 const data={version:1,generatedAt:new Date().toISOString(),latestDate:dates.at(-1)||null,dates,sessions,rules:M.rules};
 const target=path.join(root,'data/daily-picks.json');fs.writeFileSync(target+'.tmp',JSON.stringify(data));fs.renameSync(target+'.tmp',target);
 console.log('Built daily picks:',dates.length,'sessions;',stocks.size,'stocks; latest',data.latestDate);
}
if(require.main===module)build();module.exports={build};
