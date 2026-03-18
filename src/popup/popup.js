/* Pause — Popup Logic */

const STORAGE = {
  blocked: 'pause_blocked',
  log: 'pause_log',
  timer: 'pause_timer_minutes',
  theme: 'pause_theme',
};

const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'instagram.com',
  'twitter.com',
  'facebook.com',
];

const views = {
  blocked: document.getElementById('view-blocked'),
  journal: document.getElementById('view-journal'),
  timer: document.getElementById('view-timer'),
  instructions: document.getElementById('view-instructions'),
};

const tabs = {
  blocked: document.getElementById('tab-blocked'),
  journal: document.getElementById('tab-journal'),
  timer: document.getElementById('tab-timer'),
};

const btnTheme = document.getElementById('btn-theme');
const themeSelect = document.getElementById('theme-select');
const btnInstructions = document.getElementById('btn-instructions');

const addSiteInput = document.getElementById('add-site-input');
const btnAddSite = document.getElementById('btn-add-site');
const sitesList = document.getElementById('sites-list');

const currentSiteEl = document.getElementById('current-site');
const journalNote = document.getElementById('journal-note');
const reasonInput = document.getElementById('reason-input');
const btnSubmit = document.getElementById('btn-submit');
const btnViewLog = document.getElementById('btn-view-log');
const journalLogWrap = document.getElementById('journal-log-wrap');
const logList = document.getElementById('log-list');
const btnClearLog = document.getElementById('btn-clear-log');
const reasonCounter = document.getElementById('reason-counter');

const timerInput = document.getElementById('timer-minutes');
const btnSaveTimer = document.getElementById('btn-save-timer');
const timerStatus = document.getElementById('timer-status');

let currentSiteHostname = 'this page';
let isCurrentSiteBlocked = false;

async function getSync(defaults) {
  return chrome.storage.sync.get(defaults);
}

async function setSync(value) {
  return chrome.storage.sync.set(value);
}

async function getLocal(defaults) {
  return chrome.storage.local.get(defaults);
}

async function setLocal(value) {
  return chrome.storage.local.set(value);
}

function isBlockedHost(host, blocked) {
  return blocked.some((s) => host === s || host.endsWith('.' + s));
}

async function getCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      return new URL(tab.url).hostname;
    }
  } catch (_) {}
  return 'this page';
}

function showView(id) {
  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle('active', name === id);
  });
  Object.entries(tabs).forEach(([name, el]) => {
    el.classList.toggle('active', name === id);
  });
}

async function loadBlockedSites() {
  const data = await getSync({ [STORAGE.blocked]: DEFAULT_BLOCKED_SITES });
  return data[STORAGE.blocked];
}

async function saveBlockedSites(arr) {
  await setSync({ [STORAGE.blocked]: arr });
}

async function ensureBlockedSitesInitialized() {
  const data = await getSync({});
  if (!Array.isArray(data[STORAGE.blocked])) {
    await saveBlockedSites([...DEFAULT_BLOCKED_SITES]);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderBlockedSites() {
  const sites = await loadBlockedSites();
  sitesList.innerHTML = '';

  if (sites.length === 0) {
    sitesList.innerHTML = '<p class="empty-note">No blocked sites yet.</p>';
    return;
  }

  sites.forEach((site) => {
    const li = document.createElement('li');
    li.className = 'site-item';

    const span = document.createElement('span');
    span.textContent = site;

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.addEventListener('click', async () => {
      const current = await loadBlockedSites();
      const updated = current.filter((item) => item !== site);
      await saveBlockedSites(updated);
      await syncJournalVisibility();
      renderBlockedSites();
    });

    li.appendChild(span);
    li.appendChild(btn);
    sitesList.appendChild(li);
  });
}

async function addSite() {
  let val = addSiteInput.value.trim().toLowerCase();
  val = val.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!val) return;

  const sites = await loadBlockedSites();
  if (!sites.includes(val)) {
    sites.push(val);
    await saveBlockedSites(sites);
  }
  addSiteInput.value = '';
  await syncJournalVisibility();
  renderBlockedSites();
}

async function loadLog() {
  const data = await getLocal({ [STORAGE.log]: [] });
  return data[STORAGE.log];
}

async function saveLog(arr) {
  await setLocal({ [STORAGE.log]: arr });
}

async function renderLog() {
  const entries = await loadLog();
  logList.innerHTML = '';

  if (!entries.length) {
    logList.innerHTML = '<p class="empty-note">No reasons recorded yet.</p>';
    return;
  }

  [...entries].reverse().forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
      <div class="log-site">${escapeHtml(entry.site)}</div>
      <div class="log-reason">${escapeHtml(entry.reason)}</div>
      <div class="log-time">${escapeHtml(entry.time)}</div>
    `;
    logList.appendChild(li);
  });
}

async function saveJournalEntry() {
  if (!isCurrentSiteBlocked) return;

  const reason = reasonInput.value.trim();
  if (reason.length < 50) return;

  const entries = await loadLog();
  entries.push({
    site: currentSiteHostname,
    reason,
    time: new Date().toLocaleString(),
  });
  await saveLog(entries);

  reasonInput.value = '';
  reasonCounter.textContent = '0 / 50 minimum';
  journalNote.textContent = 'Saved.';
  setTimeout(() => { journalNote.textContent = ''; }, 1500);
  // Refresh log if it's already visible
  if (!journalLogWrap.classList.contains('hidden')) {
    await renderLog();
  }
}

async function loadTimer() {
  const data = await getSync({ [STORAGE.timer]: 15 });
  const minutes = Number(data[STORAGE.timer]);
  timerInput.value = Number.isFinite(minutes) && minutes > 0 ? String(minutes) : '15';
}

async function saveTimer() {
  const minutes = Math.max(1, Math.min(240, Number(timerInput.value) || 15));
  await setSync({ [STORAGE.timer]: minutes });
  timerInput.value = String(minutes);
  timerStatus.textContent = `Saved: ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  // Mark the active option in the custom dropdown
  themeSelect.querySelectorAll('.theme-option').forEach((el) => {
    el.setAttribute('aria-selected', el.dataset.value === theme ? 'true' : 'false');
  });
}

async function loadTheme() {
  const data = await getSync({ [STORAGE.theme]: 'blue' });
  const theme = ['blue', 'cream', 'black'].includes(data[STORAGE.theme])
    ? data[STORAGE.theme]
    : 'blue';
  applyTheme(theme);
}

async function syncJournalVisibility() {
  const blocked = await loadBlockedSites();
  isCurrentSiteBlocked = isBlockedHost(currentSiteHostname, blocked);

  // Journal tab is always visible; only new-entry controls are gated
  tabs.journal.classList.remove('hidden');
  currentSiteEl.textContent = `${currentSiteHostname}?`;

  reasonInput.disabled = !isCurrentSiteBlocked;
  btnSubmit.disabled = !isCurrentSiteBlocked;
  // Log is always readable
  btnViewLog.disabled = false;

  if (!isCurrentSiteBlocked) {
    journalNote.textContent = 'Open a blocked site to add a new entry.';
  } else {
    journalNote.textContent = '';
  }
}

tabs.blocked.addEventListener('click', () => showView('blocked'));
tabs.journal.addEventListener('click', async () => {
  showView('journal');
  // Always open the log panel and refresh it
  journalLogWrap.classList.remove('hidden');
  await renderLog();
});
tabs.timer.addEventListener('click', () => showView('timer'));
btnInstructions.addEventListener('click', () => showView('instructions'));

btnAddSite.addEventListener('click', addSite);
addSiteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite();
});

reasonInput.addEventListener('input', () => {
  const len = reasonInput.value.length;
  reasonCounter.textContent = len >= 50
    ? `${len} characters`
    : `${len} / 50 minimum`;
});

btnSubmit.addEventListener('click', saveJournalEntry);
btnViewLog.addEventListener('click', async () => {
  journalLogWrap.classList.toggle('hidden');
  if (!journalLogWrap.classList.contains('hidden')) {
    await renderLog();
  }
});

btnClearLog.addEventListener('click', async () => {
  if (!confirm('Clear all recorded reasons?')) return;
  await saveLog([]);
  renderLog();
});

btnSaveTimer.addEventListener('click', saveTimer);

btnTheme.addEventListener('click', () => {
  themeSelect.classList.toggle('hidden');
});

themeSelect.querySelectorAll('.theme-option').forEach((option) => {
  option.addEventListener('click', async () => {
    const theme = option.dataset.value;
    applyTheme(theme);
    await setSync({ [STORAGE.theme]: theme });
    themeSelect.classList.add('hidden');
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.theme-wrap')) {
    themeSelect.classList.add('hidden');
  }
});

(async function init() {
  currentSiteHostname = await getCurrentSite();
  await loadTheme();
  await ensureBlockedSitesInitialized();
  await renderBlockedSites();
  await loadTimer();
  await syncJournalVisibility();
  showView('blocked');
})();
