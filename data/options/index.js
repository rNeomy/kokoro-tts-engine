const toast = document.getElementById('toast');

const notify = message => {
  toast.textContent = message;
  clearTimeout(notify.id);
  notify.id = setTimeout(() => toast.textContent = '', 3000);
};

chrome.storage.local.get({
  'dtype': 'q8', // "fp32", "fp16", "q8", "q4", "q4f16"
  'device': 'webgpu' // "wasm", "webgpu", "cpu"
}).then(prefs => {
  document.getElementById('dtype').value = prefs.dtype;
  document.getElementById('device').value = prefs.device;
});

document.getElementById('save').onclick = () => chrome.storage.local.set({
  'dtype': document.getElementById('dtype').value,
  'device': document.getElementById('device').value
}).then(() => notify('Options saved.'));

// reset
document.getElementById('reset').onclick = async e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
  }
  else {
    localStorage.clear();

    await chrome.storage.local.clear();

    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        console.info('Deleting DB:', db.name);
        indexedDB.deleteDatabase(db.name);
      }
    }

    const names = await caches.keys();
    for (const name of names) {
      console.log('Deleting cache:', name);
      await caches.delete(name);
    }

    chrome.runtime.reload();
    window.close();
  }
};
// support
document.getElementById('support').onclick = () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
});
// Test
document.getElementById('test').onclick = () => chrome.tabs.create({
  url: '/data/test/index.html'
});
