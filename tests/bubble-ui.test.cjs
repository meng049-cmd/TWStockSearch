const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app({reducedMotion=false}={}){
 const elements=new Map(),timers=new Map(),handlers=new Map(),defaults={flowRange:'1',flowMode:'snapshot',flowTrail:'3',flowPlaySpeed:'2000'};let timerId=0;
 function node(tag){return {tag,children:[],attrs:{},style:{},value:'',checked:false,append(...v){this.children.push(...v)},replaceChildren(...v){this.children=v},setAttribute(k,v){this.attrs[k]=String(v)},addEventListener(){},animate(frames,options){this.animation={frames,options};return {}},scrollIntoView(options){this.scrollOptions=options},focus(options){this.focusOptions=options}}}
 function get(id){if(!elements.has(id)){const n=node('div');n.value=defaults[id]||'';n.checked=['flowSourceForeign','flowSourceTrust','flowSourceDealer'].includes(id);elements.set(id,n)}return elements.get(id)}
 const document={getElementById:get,createElement:node,createElementNS:(_,tag)=>node(tag),addEventListener:(name,fn)=>handlers.set(name,fn),hidden:false};
 const context={document,console,URL,Blob,setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:reducedMotion})};
 vm.createContext(context);for(const file of ['industry-bubbles.js','industry-flow-ui.js'])vm.runInContext(fs.readFileSync('assets/'+file,'utf8'),context);
 const dates=['2026-10-29','2026-10-30','2026-11-02'],data={dates,latestDate:dates.at(-1),sectors:[1,2,3,4,5].map(i=>({code:String(i),name:'族群'+i,rows:dates.map((date,j)=>({date,sampleCount:1,foreignAmount:i*(j+1)*1e8,trustAmount:i*1e8,dealerAmount:-i*1e8,foreignAmountCount:1,trustAmountCount:1,dealerAmountCount:1,financing:i%2?i:-i,financingAmount:(i%2?1:-1)*i*2e8,financingAmountCount:1,financingBalance:1000-i}))}))};
 context.IndustryFlowUI.initialize(data);
 const chart=()=>get('industryQuadrants').children[0],circles=()=>chart().children.filter(n=>n.tag==='circle');
 const select=(n=1)=>{const inputs=get('industryOptions').children.map(label=>label.children[0]);for(let i=0;i<n;i++){inputs[i].checked=true;inputs[i].onchange()}};
 const tick=()=>{const first=timers.entries().next().value;assert(first,'expected a queued playback step');timers.delete(first[0]);first[1].fn();return first[1].delay};
 return {get,dates,data,chart,circles,select,timers,tick,document,handlers};
}
test('source combinations update immediately and financing includes both increase and decrease',()=>{
 const {get,circles}=app();assert.equal(circles().length,5);get('flowSourceDealer').checked=false;get('flowSourceDealer').onchange();assert(circles()[0].attrs['aria-label'].includes('來源 外資＋投信'));
 get('flowSourcesNone').onclick();assert.equal(circles().length,0);get('flowSourceFinancing').checked=true;get('flowSourceFinancing').onchange();assert.equal(circles().length,5);assert(circles().every(p=>p.attrs['aria-label'].includes('來源 融資餘額')));
 get('flowSourcesAll').onclick();assert.equal(circles().length,5);get('flowPrev').onclick();assert.equal(get('flowEndDate').value,'2026-10-30');
});
test('one to four industries repeat by date without any circle border or connecting line',()=>{
 const {get,circles,chart,select}=app();select(4);assert.equal(circles().length,12);assert(get('industryOptions').children[4].children[0].disabled);
 assert.equal(chart().children.filter(n=>['polyline','path','defs'].includes(n.tag)).length,0);assert(circles().every(n=>n.attrs.stroke==='none'&&n.attrs['stroke-width']==='0'));
 get('flowTraceStep').value='0';get('flowTraceStep').oninput();assert.equal(circles().filter(n=>n.attrs['data-focus']==='true').length,4);
 const before=chart();get('flowConfirm').onclick();get('flowReselect').onclick();assert.strictEqual(chart(),before);
});
test('background bubbles are very faint while the active date shines for a second then fades',()=>{
 const {get,circles,select}=app();select(4);const active=circles().filter(p=>p.attrs['data-focus']==='true');assert.equal(active.length,4);
 for(const p of circles()){assert(Number(p.attrs['fill-opacity'])<=.05);assert.equal(p.attrs.stroke,'none')}
 for(const p of active){const {frames,options}=p.animation;assert(Math.abs(options.duration*frames[1].offset-1000)<1e-8);assert.equal(frames[0].fillOpacity,1);assert.equal(frames[1].fillOpacity,1);assert.equal(frames.at(-1).fillOpacity,Number(p.attrs['fill-opacity']));assert.equal(options.fill,'none')}
 assert(circles().filter(p=>p.attrs['data-focus']!=='true').every(p=>p.animation.frames[0].fillOpacity<=.08));
 get('flowTraceStep').value='0';get('flowTraceStep').oninput();assert(circles().filter(p=>p.attrs['data-focus']==='true').every(p=>p.attrs['data-date']==='2026-10-29'&&p.animation.frames[0].fillOpacity===1));
});
test('autoplay advances synchronously across industries, allows speed changes, and stops at the end',()=>{
 const {get,circles,select,timers,tick,dates}=app();select(4);get('flowPlay').onclick();assert.equal(get('flowPlay').attrs['aria-pressed'],'true');assert.equal(timers.size,1);assert(circles().filter(p=>p.attrs['data-focus']==='true').every(p=>p.attrs['data-date']===dates[0]));
 get('flowPlaySpeed').value='1500';get('flowPlaySpeed').onchange();assert.equal(timers.size,1);assert.equal(tick(),1500);assert(circles().filter(p=>p.attrs['data-focus']==='true').every(p=>p.attrs['data-date']===dates[1]));
 assert.equal(tick(),1500);assert.equal(timers.size,0);assert.equal(get('flowPlay').attrs['aria-pressed'],'false');assert(circles().filter(p=>p.attrs['data-focus']==='true').every(p=>p.attrs['data-date']===dates[2]));
});
test('pause and manual edits cancel timers, while confirm/reselect preserve playback',()=>{
 const {get,select,timers,chart}=app();select();get('flowPlay').onclick();const before=chart();get('flowConfirm').onclick();get('flowReselect').onclick();assert.strictEqual(chart(),before);assert.equal(timers.size,1);
 get('flowPlay').onclick();assert.equal(timers.size,0);get('flowPlay').onclick();assert.equal(timers.size,1);get('flowTraceStep').value='1';get('flowTraceStep').oninput();assert.equal(timers.size,0);
 get('flowPlay').onclick();assert.equal(timers.size,1);get('flowSourceTrust').checked=false;get('flowSourceTrust').onchange();assert.equal(timers.size,0);
});
test('leaving the page pauses autoplay, and reduced motion keeps a static active-date highlight',()=>{
 const {get,select,timers,document,handlers,circles}=app({reducedMotion:true});select();get('flowPlay').onclick();assert(circles().every(p=>p.animation===undefined));assert(circles().some(p=>p.attrs['data-focus']==='true'&&p.attrs['fill-opacity']==='1'));document.hidden=true;handlers.get('visibilitychange')();assert.equal(timers.size,0);
});
test('snapshots retain the timeline but do not start trajectory playback',()=>{
 const {get,circles,timers,dates}=app();assert(get('flowPlay').disabled);get('flowPlay').onclick();assert.equal(timers.size,0);get('flowTraceStep').value='0';get('flowTraceStep').oninput();assert.equal(get('flowEndDate').value,dates[0]);assert(circles().every(p=>p.attrs['data-date']===dates[0]));
});
test('ranking controls are removed, financing is plain and playback controls are present',()=>{
 const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('assets/desk.css','utf8');assert(!html.includes('flowRankPreset'));assert(!html.includes('今日買賣超前十大'));assert(!html.includes('flowRankings'));assert(html.includes('id="flowSourceFinancing" type="checkbox">融資餘額'));assert(html.includes('id="flowPlaySpeed"'));assert(css.includes('stroke:none!important;stroke-width:0!important'));
});
