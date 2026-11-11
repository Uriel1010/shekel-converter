(() => {
  let quote, prefs={}, busy=false, timer, lastCurrency, revision=0, rerun=false;
  const tagged=new Map();
  const format=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'});
  const blocked='script,style,noscript,textarea,input,select,option,code,pre,svg,canvas,[contenteditable]:not([contenteditable="false"]),.shekel-value,#shekel-credit';
  function clear() { for(const entry of tagged.values()) entry.badge.remove(); tagged.clear(); document.getElementById('shekel-credit')?.remove(); }
  async function yieldToPage() {
    if(typeof globalThis.scheduler?.yield==='function') await globalThis.scheduler.yield();
    else await new Promise(resolve=>setTimeout(resolve,0));
  }
  async function nextPaint() {
    if(document.hidden) { await yieldToPage(); return; }
    await new Promise(resolve=>{
      let frame;
      const fallback=setTimeout(()=>{cancelAnimationFrame(frame);resolve();},100);
      frame=requestAnimationFrame(()=>{clearTimeout(fallback);resolve();});
    });
  }
  const observerOptions={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['content','data-currency','data-currency-code','data-selected-currency','value','selected','aria-label']};
  function observe() { observer.observe(document.documentElement,observerOptions); }
  function mutate(write) {
    // Preserve page changes queued before our own synchronous DOM writes.
    if(observer.takeRecords().length)rerun=true;
    observer.disconnect();
    try { write(); } finally { observe(); }
  }
  function invalidate() { revision++;mutate(clear);schedule(); }
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
  async function scan() {
    if(busy) {rerun=true;return;}
    if(!quote || prefs.enabled===false || !document.body) return;
    busy=true;
    const current=revision;
    const active=()=>current===revision && prefs.enabled!==false;
    try {
      const currency=siteCurrency();
      mutate(()=>{
        if(currency!==lastCurrency){clear();lastCurrency=currency;}
        for(const [node,entry] of tagged) if(!node.isConnected || node.textContent!==entry.text || !entry.badge.isConnected) {entry.badge.remove();tagged.delete(node);}
      });
      // Count all text nodes, including rejected ones, so large non-price pages yield too.
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const nodes=[];
      let visited=0, deadline=performance.now()+8;
      while(walker.nextNode()) {
        const node=walker.currentNode;
        if(!node.parentElement?.closest(blocked) && /[0-9٠-٩]/.test(node.data) && node.data.length<3000 && !tagged.has(node))nodes.push(node);
        if(++visited%200===0 || performance.now()>=deadline) {
          await yieldToPage();if(!active())return;deadline=performance.now()+8;
        }
      }
      for(let offset=0;offset<nodes.length;offset+=20) {
        await nextPaint();if(!active())return;
        mutate(()=>{for(const node of nodes.slice(offset,offset+20)) {
        if(!node.isConnected || tagged.has(node) || node.parentElement?.closest(blocked))continue;
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
        }});
        await yieldToPage();if(!active())return;
      }
      mutate(()=>{if(tagged.size && window===window.top && !document.getElementById('shekel-credit')) {const a=document.createElement('a');a.id='shekel-credit';a.href='https://www.exchangerate-api.com';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Rates By Exchange Rate API';document.body.append(a);}});
    } catch {
      console.warn('[Shekel Converter] Page conversion failed; another page update can retry.');
    } finally {busy=false;if(rerun){rerun=false;schedule();}}
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,350);};
  const observer=new MutationObserver(schedule);
  document.addEventListener('change',invalidate,true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local' || (!changes.prefs && !changes.quote))return;if(changes.prefs)prefs=changes.prefs.newValue||{};if(changes.quote)quote=changes.quote.newValue;invalidate();});
  async function load(){
    try {
      const current=revision;
      const stored=await chrome.storage.local.get('prefs');
      if(current===revision)prefs=stored.prefs||{};
      const result=await chrome.runtime.sendMessage({type:'rates'});
      if(!result?.quote)throw Error('Rates unavailable');
      quote=result.quote;revision++;mutate(clear);await scan();
    } catch {console.warn('[Shekel Converter] Could not load rates or preferences; retry from the extension popup.');}
  }
  observe();
  load();setInterval(load,3600000);
})();
