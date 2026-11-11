let pending;
async function rates(force = false) {
  const { quote } = await chrome.storage.local.get('quote');
  if (!force && quote && Date.now() < quote.expires) return quote;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/ILS', {signal: AbortSignal.timeout(15000), cache: 'no-store'});
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.result !== 'success' || data.base_code !== 'ILS' || data.rates?.ILS !== 1 || !data.rates.USD) throw Error('Invalid rates');
      const fresh = {rates: data.rates, date: data.time_last_update_unix * 1000, expires: Math.max(Date.now() + 3600000, data.time_next_update_unix * 1000)};
      await chrome.storage.local.set({quote: fresh});
      return fresh;
    } catch (error) {
      if (quote) return {...quote, stale: true};
      throw error;
    } finally { pending = null; }
  })();
  return pending;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type !== 'rates') return;
  rates(Boolean(message.force)).then(quote => reply({quote})).catch(() => reply({error: 'לא ניתן לקבל שערים. בדקו חיבור לאינטרנט ונסו שוב.'}));
  return true;
});
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('refresh', {periodInMinutes: 60}); rates().catch(() => {}); });
chrome.alarms.onAlarm.addListener(() => rates().catch(() => {}));
