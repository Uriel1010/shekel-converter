// Only the in-flight request is shared in memory. Durable rates live in storage,
// so a restarted worker can always recover without this promise.
let pending;
async function rates(force = false) {
  const { quote } = await chrome.storage.local.get('quote');
  if (!force && quote && Date.now() < quote.expires) return quote;
  if (pending) return await pending;
  pending = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/ILS', {
        signal: AbortSignal.timeout(15000), cache: 'no-store'
      });
      if (!response.ok) throw Error('Rate provider unavailable');
      const data = await response.json();
      if (data.result !== 'success' || data.base_code !== 'ILS' || data.rates?.ILS !== 1 ||
          !(data.rates.USD > 0) || !Number.isFinite(data.time_last_update_unix) ||
          !Number.isFinite(data.time_next_update_unix)) throw Error('Invalid rate response');
      const fresh = {
        rates: data.rates,
        date: data.time_last_update_unix * 1000,
        expires: Math.max(Date.now() + 3600000, data.time_next_update_unix * 1000)
      };
      await chrome.storage.local.set({ quote: fresh });
      return fresh;
    } catch {
      console.warn('[Shekel Converter] Rate refresh failed; cached rates will be used when available.');
      if (quote) return { ...quote, stale: true };
      throw Error('Rates unavailable');
    }
  })();
  try { return await pending; }
  finally { pending = null; }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'rates') return;
  (async () => {
    try { reply({ quote: await rates(Boolean(message.force)) }); }
    catch { reply({ error: 'לא ניתן לקבל שערים. בדקו חיבור לאינטרנט ונסו שוב.' }); }
  })();
  return true;
});

async function refreshRates() {
  try { await rates(); }
  catch { console.warn('[Shekel Converter] Scheduled rates are unavailable.'); }
}
async function initialize() {
  try {
    await chrome.alarms.create('refresh', { periodInMinutes: 60 });
    await refreshRates();
  } catch { console.warn('[Shekel Converter] Could not initialize rate refresh.'); }
}
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'refresh') await refreshRates();
});
