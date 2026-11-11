const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const money = require('./money.js');
const rates = {USD: .25, EUR: .2, GBP: .18, CAD: .35, AUD: .4, JPY: 40, CNY: 2, ILS: 1};
for (const [text, amount, code] of [['USD 1,234.56',1234.56,'USD'],['1.234,56 EUR',1234.56,'EUR'],['€ 1 234,50',1234.5,'EUR'],['£25.99',25.99,'GBP'],['CA$ 20',20,'CAD'],['¥2,000',2000,'JPY']]) {
  const found = money.find(text, rates);
  assert.equal(found.length, 1, text); assert.equal(found[0].amount, amount, text); assert.equal(found[0].code, code, text);
}
assert.equal(money.find('$10', rates, {dollar:'CAD'})[0].code, 'CAD');
assert.equal(money.find('USD 10', rates)[0].value, 40);
assert.equal(money.find('ILS 20', rates).length, 0);
assert.equal(money.find('SKUUSD123', rates).length, 0);
assert.equal(money.contextCurrency([['AUD'],['USD']], 'shop.com', rates),'AUD');
assert.equal(money.contextCurrency([[],['AUD'],['USD']], 'shop.com', rates),'AUD');
assert.equal(money.contextCurrency([[],[],['AUD']], 'shop.com', rates),'AUD');
assert.equal(money.contextCurrency([[],[],[]], 'shop.com.au', rates),'AUD');
assert.equal(money.contextCurrency([['USD']], 'shop.com.au', rates),'USD');
assert.equal(money.contextCurrency([['AUD','USD']], 'shop.com.au', rates),null);
assert.equal(money.contextCurrency([[]], 'shop.com', rates),null);
assert.equal(money.find('$100',rates,money.contextualPrefs({dollar:'USD'},'AUD'))[0].value,250);
assert.equal(money.find('US$100',rates,money.contextualPrefs({},'AUD'))[0].code,'USD');
assert.equal(money.find('$100',rates,money.contextualPrefs({dollar:'CAD'},null))[0].code,'CAD');
const asosCurrency=money.contextCurrency([[],[],[]], 'www.asos.com', rates, '/au/men/ctas/hub-edit-2/cat/');
assert.equal(asosCurrency,'AUD','ASOS Australia uses /au/ on a .com domain');
assert.equal(money.find('$74.00',rates,money.contextualPrefs({dollar:'USD'},asosCurrency))[0].value,185);
assert.equal(money.contextCurrency([['USD']], 'www.asos.com', rates, '/au/men/'),'USD','explicit selected currency takes priority over regional URL');
assert.equal(money.contextCurrency([[]], 'www.asos.com', rates, '/us/men/'),'USD');
assert.equal(money.contextCurrency([[]], 'www.asos.com', rates, '/fr/men/'),'EUR');
assert.equal(money.contextCurrency([[]], 'unrelated.com', rates, '/au/men/'),null);
assert.equal(money.contextCurrency([[]], 'fakeasos.com', rates, '/au/men/'),null);
assert.equal(money.taxEstimate(money.find('USD 75',rates)[0].value,rates),null,'exactly US$75 has no warning');
assert.equal(money.taxEstimate(money.find('USD 74.99',rates)[0].value,rates),null);
assert.ok(money.taxEstimate(money.find('USD 75.01',rates)[0].value,rates));
assert.equal(money.taxEstimate(money.find('AUD 120',rates)[0].value,rates),null,'AUD threshold is converted to USD');
assert.ok(money.taxEstimate(money.find('AUD 120.01',rates)[0].value,rates));
assert.equal(money.taxEstimate(money.find('AUD 92',rates)[0].value,rates),null,'92 AUD is below US$75 in fixture');
assert.equal(money.taxEstimate(400,rates).extra,72);
assert.equal(money.taxEstimate(400,rates).total,472);
assert.equal(money.taxEstimate(400,{}),null);
assert.equal(money.taxEstimate(NaN,rates),null);
async function main() {
  // Exercise the real popup script: switching tax off must preserve conversion
  // and persist after the popup is reopened.
  let preferences={enabled:true,dollar:'AUD',yen:'JPY',customSetting:'preserved'}, storageFails=false;
  async function popup() {
    const elements=Object.fromEntries(['enabled','showTax','dollar','yen','refresh','status'].map(id=>[id,{listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}]));
    const chrome={storage:{local:{get:async()=>({prefs:preferences}),set:async data=>{if(storageFails)throw Error('storage failed');preferences=data.prefs;}}},runtime:{sendMessage:async()=>({quote:{date:Date.now()}})}};
    await vm.runInNewContext(fs.readFileSync(__dirname+'/popup.js','utf8'),{document:{getElementById:id=>elements[id]},chrome,Date});
    return elements;
  }
  const first=await popup();
  assert.equal(first.showTax.checked,true,'tax visibility defaults on');
  first.showTax.checked=false;
  await first.showTax.listeners.change();
  assert.equal(preferences.showTax,false);
  assert.equal(preferences.enabled,true,'disabling tax must not disable conversion');
  assert.equal(preferences.dollar,'AUD');
  assert.equal(preferences.customSetting,'preserved');
  const reopened=await popup();
  assert.equal(reopened.showTax.checked,false,'tax switch persists after reopening');
  reopened.showTax.checked=true;
  await reopened.showTax.listeners.change();
  assert.equal(preferences.showTax,true);
  storageFails=true;
  reopened.showTax.checked=false;
  await reopened.showTax.listeners.change();
  assert.equal(preferences.showTax,true,'failed storage writes must not change saved settings');
  assert.equal(reopened.showTax.checked,true,'failed writes restore the previous switch state');
  assert.match(reopened.status.textContent,/נכשלה/);
  assert.equal(reopened.showTax.disabled,false,'controls must recover after a storage error');
  let store={}, calls=0, fail=false, handler, startup, alarm, alarmCreations=0;
  const context={Date, AbortSignal, console:{warn(){}}, chrome:{storage:{local:{get:async()=>store,set:async data=>Object.assign(store,data)}},runtime:{onMessage:{addListener:fn=>handler=fn},onInstalled:{addListener(){}},onStartup:{addListener:fn=>startup=fn}},alarms:{create(){alarmCreations++;},onAlarm:{addListener:fn=>alarm=fn}}},fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>({result:'success',base_code:'ILS',rates,time_last_update_unix:Date.now()/1000,time_next_update_unix:Date.now()/1000+86400})};}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
  const get=force=>new Promise(resolve=>handler({type:'rates',force},{},resolve));
  assert.ok((await get()).quote.rates.USD);
  await get(); assert.equal(calls,1,'cache must avoid a second request');
  await Promise.all([get(true),get(true)]);
  assert.equal(calls,2,'simultaneous requests should share one network fetch');
  vm.runInNewContext(fs.readFileSync(__dirname+'/background.js','utf8'),{...context});
  await get();assert.equal(calls,2,'worker restart must recover persisted rates');
  await startup();assert.equal(alarmCreations,1,'browser startup must recreate the refresh alarm');
  await alarm({name:'unrelated'});assert.equal(calls,2);
  fail=true; assert.equal((await get(true)).quote.stale,true,'offline must mark cached rates stale');
  store={}; assert.ok((await get(true)).error,'offline without cache must show an error');
  console.log('PASS: parsing, currency selection, conversion, tax toggle persistence, cache, stale rates, offline errors');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
