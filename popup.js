const $ = id => document.getElementById(id);
const controlIds = ['enabled', 'showTax', 'dollar', 'yen'];
let savedPrefs = {};
function showPreferences(prefs) {
  $('enabled').checked = prefs.enabled !== false;
  $('showTax').checked = prefs.showTax !== false;
  $('dollar').value = prefs.dollar || 'USD';
  $('yen').value = prefs.yen || 'JPY';
}
async function status(force = false) {
  $('refresh').disabled = true;
  $('status').textContent = 'טוען שערים…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'rates', force });
    if (result?.error) throw Error(result.error);
    if (!result?.quote?.date) throw Error('העדכון נכשל. נסו שוב.');
    $('status').textContent = `השער האחרון: ${new Date(result.quote.date).toLocaleString('he-IL')}${result.quote.stale ? ' — העדכון נכשל, מוצג שער שמור' : ''}`;
  } catch (error) {
    $('status').textContent = error.message || 'העדכון נכשל. נסו שוב.';
  } finally { $('refresh').disabled = false; }
}
async function savePreferences() {
  for (const id of controlIds) $(id).disabled = true;
  const next = {
    ...savedPrefs,
    enabled: $('enabled').checked,
    showTax: $('showTax').checked,
    dollar: $('dollar').value,
    yen: $('yen').value
  };
  try {
    await chrome.storage.local.set({ prefs: next });
    savedPrefs = next;
    $('status').textContent = 'ההגדרות נשמרו.';
  } catch {
    showPreferences(savedPrefs);
    $('status').textContent = 'שמירת ההגדרות נכשלה. נסו שוב.';
  } finally { for (const id of controlIds) $(id).disabled = false; }
}
async function init() {
  try {
    const { prefs = {} } = await chrome.storage.local.get('prefs');
    savedPrefs = prefs;
    showPreferences(prefs);
    for (const id of controlIds) $(id).addEventListener('change', savePreferences);
    $('refresh').addEventListener('click', async () => { await status(true); });
    await status();
  } catch {
    for (const id of controlIds) $(id).disabled = true;
    $('status').textContent = 'טעינת ההגדרות נכשלה. סגרו ופתחו שוב את התוסף.';
  }
}
init();
