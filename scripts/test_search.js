const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('function normalizeSearch(');
const end = html.indexOf('function renderStocks(){', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
const stock = {code:'2330', name:'台積電'};
const cases = [
 ['',true,true],['  ',false,true],['台積電',true,true],['積電',true,true],
 ['臺積',true,true],['２３３０',true,true],['233',true,true],
 ['台 積 電',true,true],['2330 台積',true,true],['台積 2330',true,true],
 ['台積電期貨',true,true],['臺積電股票期貨',true,true],['台積股期',true,true],
 ['台積期',true,true],['2330 期貨',true,true],['期貨',true,true],
 ['台積電期貨',false,false],['期貨',false,false],['聯發科',true,false],
 ['2330 聯發科',true,false],['TX',true,false],['<script>',true,false],
 ['台積電期貨不存在',true,false],['電積台',true,false]
];
for(let run=0;run<100;run++) for(const [query,future,expected] of cases)
 assert.equal(context.matchesSearch(stock,query,future),expected,query);
assert.equal(context.matchesSearch({code:'9999',name:'ABC-KY'},'ａｂｃ',false),true);
const data = JSON.parse(fs.readFileSync(path.join(root,'data/stocks.json')));
const futures = new Set(JSON.parse(fs.readFileSync(path.join(root,'data/stock-futures.json'))).codes);
let verified = 0;
for(const s of data.stocks){
 const has = futures.has(s.code);
 assert.equal(context.matchesSearch(s,s.code,has),true);
 assert.equal(context.matchesSearch(s,s.name,has),true);
 assert.equal(context.matchesSearch(s,s.name+'期貨',has),has);
 verified++;
}
assert.ok(html.includes("matchesSearch(s,q,futures.status==='ok'&&futuresCodes.has(s.code))"));
assert.equal(html,fs.readFileSync(path.join(root,'standalone.html'),'utf8'));
console.log(`${cases.length} cases × 100 repetitions passed; ${verified} real stocks verified; HTML copies identical.`);
