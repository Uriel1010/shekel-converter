(() => {
  let quote, prefs={}, busy=false, timer, lastCurrency;
  const tagged=new Map();
  const format=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'});
  const blocked='script,style,noscript,textarea,input,select,option,code,pre,svg,canvas,[contenteditable]:not([contenteditable="false"]),.shekel-value,#shekel-credit';
  function clear() { for(const entry of tagged.values()) entry.badge.remove(); tagged.clear(); document.getElementById('shekel-credit')?.remove(); }
  function siteCurrency() {
    const selected=[];
    for(const select of document.querySelectorAll('select')) {
      if(/currency|מטבע/i.test([select.name,select.id,select.getAttribute('aria-label')].join(' '))) {
        const option=select.selectedOptions[0];if(option)selected.push(option.value+' '+option.textContent);
      }
    }
    for(const el of document.querySelectorAll('[aria-label*="currency" i], [data-testid*="currency" i], button[id*="currency" i], [data-selected-currency]')) {
      if(el.getClientRects().length && el.textContent.length<150)selected.push(el.getAttribute('data-selected-currency')||el.textContent);
    }
    const metas=[...document.querySelectorAll('meta[property="product:price:currency"],meta[property="og:price:currency"],meta[itemprop="priceCurrency"],meta[name="currency"]')].map(el=>el.content);
    const structured=[...document.querySelectorAll('[itemprop="priceCurrency"]')].map(el=>el.getAttribute('content')||el.textContent);
    for(const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const walk=value=>{if(!value||typeof value!=='object')return;if(typeof value.priceCurrency==='string')structured.push(value.priceCurrency);for(const child of Object.values(value))if(typeof child==='object')walk(child);};
        walk(JSON.parse(script.textContent));
      } catch {}
    }
    return ShekelMoney.contextCurrency([selected,metas,structured],location.hostname,quote.rates,location.pathname);
  }
  function pricePrefs(node, currency) {
    // Product-level metadata takes priority on pages containing mixed currencies.
    for(let el=node.parentElement, depth=0;el && depth<4;el=el.parentElement,depth++) {
      const values=[el.getAttribute('data-currency'),el.getAttribute('data-currency-code')].filter(Boolean);
      if(el.matches('[itemscope]'))for(const meta of el.querySelectorAll('[itemprop="priceCurrency"]'))values.push(meta.getAttribute('content')||meta.textContent);
      const local=ShekelMoney.contextCurrency([values],'',quote.rates);
      if(local)return ShekelMoney.contextualPrefs(prefs,local);
    }
    return ShekelMoney.contextualPrefs(prefs,currency);
  }
  function scan() {
    if(busy || !quote || prefs.enabled===false || !document.body) return;
    busy=true; observer.disconnect();
    try {
      const currency=siteCurrency();
      if(currency!==lastCurrency){clear();lastCurrency=currency;}
      for(const [node,entry] of tagged) if(!node.isConnected || node.textContent!==entry.text || !entry.badge.isConnected) {entry.badge.remove();tagged.delete(node);}
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){return !node.parentElement?.closest(blocked) && /[0-9٠-٩]/.test(node.data) && node.data.length<3000 && !tagged.has(node)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
      const nodes=[];while(walker.nextNode()) nodes.push(walker.currentNode);
      for(const node of nodes) {
        const matches=ShekelMoney.find(node.data,quote.rates,pricePrefs(node,currency)); if(!matches.length) continue;
        const badge=document.createElement('span');badge.className='shekel-value';
        for(const [index,match] of matches.entries()) {
          if(index)badge.append(document.createTextNode(' · '));
          badge.append(document.createTextNode('≈ '+format.format(match.value)));
          const tax=prefs.showTax===false?null:ShekelMoney.taxEstimate(match.value,quote.rates);
          if(tax) {
            const warning=document.createElement('span');warning.className='shekel-tax';warning.dir='rtl';
            warning.textContent=`מעל US$75 · מע״מ משוער +18% (${format.format(tax.extra)}) · סה״כ ${format.format(tax.total)}`;
            warning.title=`שווי המחיר בדולר אמריקאי: ${tax.usd.toFixed(2)} USD. אומדן של 18% על המחיר המוצג בלבד. הסף נבחן לפי סך המוצרים במשלוח; המס בפועל עשוי לכלול משלוח וביטוח, מסים נוספים או מס שכבר נגבה באתר.`;
            badge.append(warning);
          }
        }
        const stale=quote.stale || Date.now()>quote.expires;
        badge.title=matches.map(m=>`${m.amount} ${m.code}`).join(' | ')+` — שער מתאריך ${new Date(quote.date).toLocaleString('he-IL')}${stale?' (שער שמור; העדכון נכשל)':''}. ללא עמלות אשראי.`;
        node.after(badge);tagged.set(node,{badge,text:node.textContent});
      }
      if(tagged.size && window===window.top && !document.getElementById('shekel-credit')) {const a=document.createElement('a');a.id='shekel-credit';a.href='https://www.exchangerate-api.com';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Rates By Exchange Rate API';document.body.append(a);}
    } finally {busy=false; observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['content','data-currency','data-currency-code','data-selected-currency','value','selected','aria-label']});}
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,350);};
  const observer=new MutationObserver(schedule);
  document.addEventListener('change',()=>{observer.disconnect();clear();schedule();},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.prefs)prefs=changes.prefs.newValue||{};if(changes.quote)quote=changes.quote.newValue;observer.disconnect();clear();schedule();});
  async function load(){try {prefs=(await chrome.storage.local.get('prefs')).prefs||{};const result=await chrome.runtime.sendMessage({type:'rates'});if(result?.quote)quote=result.quote;scan();}catch{}}
  load();setInterval(load,3600000);
})();
