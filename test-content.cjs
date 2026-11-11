// A small deterministic DOM/Chrome harness exercises scanner scheduling, not
// browser rendering. It runs the actual content script without dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const money = require('./money.js');
const {setImmediate: nextTurn} = require('node:timers/promises');

async function page({count=450, scheduler=true, failOnce=false, onYield}={}) {
  const badges=new Set(), timers=new Map();
  const stats={yields:0,frames:0,maxWrites:0,writes:0,warnings:0};
  let id=0, changed, mutation, clock=0, shouldFail=failOnce;
  const parent={closest:()=>false,getAttribute:()=>null,matches:()=>false};
  const nodes=Array.from({length:count},()=>({
    data:'USD 100',textContent:'USD 100',parentElement:parent,isConnected:true,
    after(badge) {badge.isConnected=true;badges.add(badge);stats.writes++;stats.maxWrites=Math.max(stats.maxWrites,stats.writes);}
  }));
  function element() {return {children:[],isConnected:false,append(child){this.children.push(child);},remove(){badges.delete(this);this.isConnected=false;}};}
  const document={hidden:false,body:{},documentElement:{},querySelectorAll:()=>[],getElementById:()=>null,
    addEventListener(){},createElement:element,createTextNode:text=>({textContent:text}),
    createTreeWalker(){if(shouldFail){shouldFail=false;throw Error('simulated DOM error');}let index=-1;return {nextNode(){this.currentNode=nodes[++index];return this.currentNode||null;}};}};
  function setTimer(fn,delay=0){timers.set(++id,{fn,delay});return id;}
  const context={ShekelMoney:money,document,location:{hostname:'example.com',pathname:'/'},window:{top:{}},
    NodeFilter:{SHOW_TEXT:4},Intl,Date,performance:{now:()=>clock+=.1},
    setTimeout:setTimer,clearTimeout:key=>timers.delete(key),setInterval(){},
    requestAnimationFrame:fn=>setTimer(()=>{stats.frames++;stats.writes=0;fn();},1),
    cancelAnimationFrame:key=>timers.delete(key),
    MutationObserver:class {constructor(fn){mutation=fn;}observe(){}disconnect(){}takeRecords(){return [];}},
    console:{warn(){stats.warnings++;}},
    chrome:{storage:{local:{get:async()=>({prefs:{}})},onChanged:{addListener:fn=>changed=fn}},runtime:{sendMessage:async()=>({quote:{rates:{USD:.25,ILS:1},date:Date.now(),expires:Date.now()+86400000}})}}};
  if(scheduler)context.scheduler={async yield(){stats.yields++;onYield?.({stats,changed});}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/content.js','utf8'),context);
  async function settle(){
    for(let step=0;step<3000;step++) {
      await nextTurn();
      if(!timers.size)return;
      const [key,task]=[...timers].sort((a,b)=>a[1].delay-b[1].delay)[0];
      timers.delete(key);task.fn();
    }
    throw Error('Scanner did not settle');
  }
  await settle();
  return {badges,stats,settle,changed:changes=>changed(changes,'local'),mutation:()=>mutation([])};
}
function hasTax(badge){return badge.children.some(child=>child.className==='shekel-tax');}

async function main(){
  const large=await page();
  assert.equal(large.badges.size,450);
  assert.ok(large.stats.yields>0,'long scans must yield');
  assert.ok(large.stats.frames>=23,'DOM updates must be spread across animation frames');
  assert.ok(large.stats.maxWrites<=20,'a write batch must contain at most 20 prices');
  large.mutation();await large.settle();
  assert.equal(large.badges.size,450,'a rescan must not duplicate badges');
  large.changed({prefs:{newValue:{showTax:false}}});await large.settle();
  assert.equal(large.badges.size,450);
  assert.ok([...large.badges].every(badge=>!hasTax(badge)),'tax off keeps conversion badges');
  large.changed({prefs:{newValue:{showTax:true}}});await large.settle();
  assert.ok([...large.badges].every(hasTax),'tax can be restored');
  const fallback=await page({count:225,scheduler:false});
  assert.equal(fallback.badges.size,225,'timer fallback works without Scheduler API');
  let disabled=false;
  const cancelled=await page({onYield({stats,changed}){if(stats.frames && !disabled){disabled=true;changed({prefs:{newValue:{enabled:false}}},'local');}}});
  assert.ok(disabled);
  assert.equal(cancelled.badges.size,0,'disabling mid-scan must not allow stale writes');
  const recovered=await page({count:25,failOnce:true});
  assert.equal(recovered.stats.warnings,1,'unexpected DOM errors must be reported');
  recovered.mutation();await recovered.settle();
  assert.equal(recovered.badges.size,25,'a failed scan must release its lock and allow retry');
  console.log('PASS: content batching, scheduler fallback, cancellation, tax toggles, deduplication, error recovery');
}
try { main().catch(error=>{console.error(error);process.exitCode=1;}); }
catch(error){console.error(error);process.exitCode=1;}
