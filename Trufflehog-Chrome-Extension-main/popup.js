// popup.js – Manifest V3‑safe
// ---------------------------------------------------------
// • Uses chrome.tabs.query (no getSelected)
// • chrome.action.* for badge updates
// • Clean htmlEntities helper (no duplicates)
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  //--------------------------------------------------
  // 0. Toggle switches
  //--------------------------------------------------
  const toggles = [
    'generics',
    'specifics',
    'aws',
    'checkEnv',
    'checkGit',
    'alerts',
  ];

  const toggleDefaults = {
    generics: true,
    specifics: true,
    aws: true,
    checkEnv: false,
    checkGit: false,
    alerts: true,
  };

  toggles.forEach((key) => {
    const el = document.getElementById(key);
    if (!el) return;

    chrome.storage.sync.get([key], (res) => {
      if (res[key] === undefined) {
        el.checked = toggleDefaults[key];
        chrome.storage.sync.set({ [key]: toggleDefaults[key] });
      } else {
        el.checked = Boolean(res[key]);
      }
    });

    el.addEventListener('click', () => chrome.storage.sync.set({ [key]: el.checked }));
  });

  //--------------------------------------------------
  // 1. Helpers
  //--------------------------------------------------
  const getActiveTab = () =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0] ?? null);
      });
    });

  const htmlEntities = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  //--------------------------------------------------
  // 2. Accordion – show findings & deny‑list
  //--------------------------------------------------
  Array.from(document.getElementsByClassName('accordion')).forEach((btn) => {
    btn.addEventListener('click', async function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;
      if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';

      // Fill deny‑list textarea
      chrome.storage.sync.get(['originDenyList'], ({ originDenyList }) => {
        document.getElementById('denyList').value = (originDenyList ?? []).join(',');
      });

      // Populate findings for origin
      const tab = await getActiveTab();
      if (!tab?.url) return;
      const origin = new URL(tab.url).origin;

      chrome.storage.local.get(['leakedKeys'], ({ leakedKeys }) => {
        const list = leakedKeys?.[origin] ?? [];
        const html = list
          .map((f) => {
            let txt = `${f.key}: ${f.match} found in ${f.src}`;
            if (f.encoded) txt += ` decoded from ${f.encoded.slice(0, 9)}...`;
            return `<li>${htmlEntities(txt)}</li>`;
          })
          .join('\n');
        document.getElementById('findingList').innerHTML = html;
      });
    });
  });

  //--------------------------------------------------
  // 3. Download as CSV
  //--------------------------------------------------
  document.getElementById('downloadAllFindings')?.addEventListener('click', () => {
    chrome.storage.sync.get(['leakedKeys'], ({ leakedKeys = {} }) => {
      const rows = [];
      for (const origin in leakedKeys) {
        (leakedKeys[origin] || []).forEach((f) => {
          rows.push([
            origin,
            f.src,
            f.parentUrl ?? '',
            f.key,
            f.match,
            f.encoded ?? '',
          ]);
        });
      }
      const csv = rows.map((r) => r.join(',')).join('\n');
      const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      window.open(uri);
    });
  });

  //--------------------------------------------------
  // 4. Clear findings (origin / all)
  //--------------------------------------------------
  const clearFindings = async (originOnly) => {
    chrome.storage.sync.get(['leakedKeys'], async ({ leakedKeys = {} }) => {
      const tab = await getActiveTab();
      if (!tab?.url) return;
      const origin = new URL(tab.url).origin;

      if (originOnly) delete leakedKeys[origin];
      else Object.keys(leakedKeys).forEach((k) => delete leakedKeys[k]);

      chrome.storage.sync.set({ leakedKeys }, () => {
        chrome.action.setBadgeText({ text: '' });
        document.getElementById('findingList').innerHTML = '';
      });
    });
  };

  document.getElementById('clearOriginFindings')?.addEventListener('click', () => clearFindings(true));
  document.getElementById('clearAllFindings')?.addEventListener('click', () => clearFindings(false));

  //--------------------------------------------------
  // 5. Open comma‑separated list of URLs
  //--------------------------------------------------
  document.getElementById('openTabs')?.addEventListener('click', () => {
    const raw = document.getElementById('tabList').value;
    const urls = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (urls.length) chrome.runtime.sendMessage({ openTabs: urls });
  });

  //--------------------------------------------------
  // 6. Deny‑list live sync
  //--------------------------------------------------
  const denyEl = document.getElementById('denyList');
  const syncDeny = () => {
    const list = denyEl.value.split(',').map((s) => s.trim()).filter(Boolean);
    chrome.storage.sync.set({ originDenyList: list });
  };
  denyEl.addEventListener('keyup', syncDeny);
  denyEl.addEventListener('paste', syncDeny);
});
