(function(root) {
  const symbols = {'US$':'USD','CA$':'CAD','C$':'CAD','AU$':'AUD','A$':'AUD','NZ$':'NZD','HK$':'HKD','SG$':'SGD','S$':'SGD','R$':'BRL','NT$':'TWD','€':'EUR','£':'GBP','₹':'INR','₩':'KRW','₽':'RUB','₺':'TRY','฿':'THB','₫':'VND','₱':'PHP','zł':'PLN','Kč':'CZK','د.إ':'AED','ر.س':'SAR'};
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function number(raw) {
    let s = raw.replace(/[\s\u00a0\u202f'’]/g, '').replace(/[٠-٩]/g, c => c.charCodeAt(0)-1632).replace(/٫/g,'.').replace(/٬/g,',');
    const dot=s.lastIndexOf('.'), comma=s.lastIndexOf(',');
    if (dot>=0 && comma>=0) { const decimal=dot>comma?'.':','; s=s.replace(decimal==='.'?/,/g:/\./g,'').replace(decimal,'.'); }
    else if (comma>=0 || dot>=0) { const sep=comma>=0?',':'.'; const parts=s.split(sep); if(parts.length>2 || parts.at(-1).length===3) s=parts.join(''); else s=s.replace(sep,'.'); }
    return Number(s);
  }
  function find(text, rates, prefs={}) {
    const codes=Object.keys(rates).filter(c=>c!=='ILS' && /^[A-Z]{3}$/.test(c));
    const tokens=[...Object.keys(symbols),...codes,'$','¥','￥'].sort((a,b)=>b.length-a.length).map(escape).join('|');
    const num="[0-9٠-٩]+(?:(?:[.,٫٬'’]|[ \\u00a0\\u202f](?=[0-9٠-٩]{3}(?:\\D|$)))[0-9٠-٩]+)*";
    const re=new RegExp('(?<![A-Za-z0-9])(?:('+tokens+')\\s*('+num+')|('+num+')\\s*('+tokens+'))(?![A-Za-z0-9])','gu');
    return [...text.matchAll(re)].flatMap(m=>{
      const token=m[1]||m[4];
      const code=token==='$'?(prefs.dollar||'USD'):/^[¥￥]$/.test(token)?(prefs.yen||'JPY'):(symbols[token]||token);
      const amount=number(m[2]||m[3]);
      return rates[code]>0 && Number.isFinite(amount)?[{start:m.index,end:m.index+m[0].length,code,amount,value:amount/rates[code]}]:[];
    });
  }
  // Only accept a unique supported code at each evidence level.
  function contextCurrency(signals, hostname, rates, pathname='') {
    for (const level of signals) {
      const codes=[...new Set(level.flatMap(value => String(value).toUpperCase().match(/\b[A-Z]{3}\b/g)||[]).filter(code=>rates[code]>0))];
      if(codes.length===1) return codes[0];
      if(codes.length>1) return null;
    }
    // ASOS regional stores live under .com/au/, not an .au domain.
    // Apply only to ASOS: /au/ on an unrelated site need not mean AUD.
    if(hostname==='asos.com' || hostname.endsWith('.asos.com')) {
      const region=pathname.split('/')[1].toLowerCase();
      const stores={au:'AUD',us:'USD',fr:'EUR',de:'EUR',it:'EUR',es:'EUR',nl:'EUR',se:'SEK',dk:'DKK',pl:'PLN'};
      const currency=stores[region];
      if(rates[currency]>0)return currency;
    }
    const countries={au:'AUD',nz:'NZD',ca:'CAD',us:'USD',hk:'HKD',sg:'SGD',tw:'TWD',jp:'JPY',cn:'CNY',uk:'GBP'};
    const code=countries[hostname.split('.').at(-1)];
    return rates[code]>0?code:null;
  }
  function contextualPrefs(prefs, currency) {
    const next={...prefs};
    if(['USD','AUD','CAD','NZD','HKD','SGD','TWD','MXN','ARS','CLP','COP','BSD','BBD','BZD','BMD','FJD','GYD','JMD','LRD','NAD','SBD','SRD','TTD','XCD'].includes(currency))next.dollar=currency;
    if(['JPY','CNY'].includes(currency))next.yen=currency;
    return next;
  }
  function taxEstimate(valueILS, rates) {
    if(!Number.isFinite(valueILS) || valueILS<0 || !(rates.USD>0))return null;
    const usd=valueILS*rates.USD;
    if(usd<=75+1e-9)return null;
    return {usd,extra:valueILS*.18,total:valueILS*1.18};
  }
  root.ShekelMoney={find,number,contextCurrency,contextualPrefs,taxEstimate};
  if(typeof module!=='undefined') module.exports=root.ShekelMoney;
})(globalThis);
