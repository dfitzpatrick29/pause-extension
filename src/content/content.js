/* Pause — Content Script */

(function pauseContentScript() {
  'use strict';

  const STORAGE = {
    blocked: 'pause_blocked',
    log: 'pause_log',
    timer: 'pause_timer_minutes',
  };

  const hostname = window.location.hostname;
  if (!hostname) return;

  function isBlockedHost(host, blocked) {
    return blocked.some((s) => host === s || host.endsWith('.' + s));
  }

  async function getLastReasonForSite(site) {
    const data = await chrome.storage.local.get({ [STORAGE.log]: [] });
    const entries = data[STORAGE.log] || [];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].site === site) {
        return entries[i].reason;
      }
    }
    return 'No previous journal entry found.';
  }

  async function saveReasonForSite(site, reason) {
    const data = await chrome.storage.local.get({ [STORAGE.log]: [] });
    const entries = data[STORAGE.log] || [];
    entries.push({
      site,
      reason,
      time: new Date().toLocaleString(),
    });
    await chrome.storage.local.set({ [STORAGE.log]: entries });
  }

  let timeoutId = null;
  let overlayEl = null;
  let timerMinutes = 15;
  let isSiteBlocked = false;
  let currentTheme = 'blue';

  function getThemeVars(theme) {
    const t = {
      blue: {
        bg: '#eef2f7', card: '#e5ebf4', border: '#c8d3e4',
        text: '#1f2d42', muted: '#7283a0', sub: '#4d607d',
        inputBg: '#dbe2ed', btnBg: '#294266', btnText: '#f7f9fc',
        btnBorder: '#294266', btnHover: '#1e3255',
        font: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
      },
      cream: {
        bg: '#f7f3ea', card: '#efe7d8', border: '#d9ccb6',
        text: '#3b3226', muted: '#7b6f5c', sub: '#5b4f3e',
        inputBg: '#e7dcc9', btnBg: '#7a5d3a', btnText: '#fcfaf5',
        btnBorder: '#7a5d3a', btnHover: '#5e4528',
        font: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
      },
      black: {
        bg: '#111111', card: '#0f0f0f', border: '#333333',
        text: '#f4f4f4', muted: '#a8a8a8', sub: '#d6d6d6',
        inputBg: '#161616', btnBg: '#1e1e1e', btnText: '#ffffff',
        btnBorder: '#555555', btnHover: '#292929',
        font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      },
    };
    return t[theme] || t.black;
  }

  function destroyOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    document.getElementById('__pause_overlay_style__')?.remove();
  }

  function ensureOverlayStyle(theme) {
    document.getElementById('__pause_overlay_style__')?.remove();
    const v = getThemeVars(theme || currentTheme);
    const uiFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    const style = document.createElement('style');
    style.id = '__pause_overlay_style__';
    style.textContent = `
      #__pause_overlay__ {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: ${v.bg};
        color: ${v.text};
        font-family: ${v.font};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      #__pause_overlay__ .pause-card {
        max-width: 560px;
        width: 100%;
        border: 1px solid ${v.border};
        background: ${v.card};
        border-radius: 8px;
        padding: 2rem;
      }
      #__pause_overlay__ h2 {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: ${v.muted};
        font-family: ${uiFont};
        font-weight: 400;
      }
      #__pause_overlay__ .pause-divider {
        width: 2rem;
        height: 1px;
        background: ${v.border};
        margin: 0.75rem 0 1.5rem;
      }
      #__pause_overlay__ .pause-question {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
        font-style: italic;
        font-weight: 400;
        color: ${v.text};
        line-height: 1.5;
      }
      #__pause_overlay__ .pause-site {
        font-family: ${uiFont};
        font-size: 0.95rem;
        color: ${v.sub};
        margin: 0 0 1.5rem;
      }
      #__pause_overlay__ .pause-last-label {
        margin: 0;
        font-size: 0.75rem;
        font-family: ${uiFont};
        color: ${v.muted};
        margin-bottom: 0.3rem;
      }
      #__pause_overlay__ .pause-last-message {
        margin: 0 0 1.5rem;
        font-size: 0.95rem;
        line-height: 1.5;
        color: ${v.text};
        white-space: pre-wrap;
      }
      #__pause_overlay__ .pause-help {
        margin: 0 0 0.5rem;
        font-size: 0.82rem;
        font-family: ${uiFont};
        color: ${v.sub};
      }
      #__pause_overlay__ .pause-input {
        width: 100%;
        min-height: 90px;
        background: ${v.inputBg};
        border: 1px solid ${v.border};
        color: ${v.text};
        border-radius: 3px;
        padding: 0.85rem 1rem;
        font-size: 1rem;
        font-family: ${v.font};
        margin: 0 0 0.25rem;
        resize: vertical;
        outline: none;
        line-height: 1.5;
      }
      #__pause_overlay__ .pause-counter {
        font-family: ${uiFont};
        font-size: 0.72rem;
        color: ${v.muted};
        text-align: right;
        margin: 0 0 1rem;
      }
      #__pause_overlay__ .pause-buttons {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }
      #__pause_overlay__ button {
        border: 1px solid ${v.btnBorder};
        background: ${v.btnBg};
        color: ${v.btnText};
        padding: 0.65rem 1.8rem;
        border-radius: 3px;
        cursor: pointer;
        font-size: 0.85rem;
        font-family: ${uiFont};
        letter-spacing: 0.06em;
        transition: opacity 200ms ease;
      }
      #__pause_overlay__ button:hover { opacity: 0.82; }
      #__pause_overlay__ #pause-close {
        background: transparent;
        color: ${v.sub};
        border-color: ${v.border};
      }
      #__pause_overlay__ button[disabled] {
        opacity: 0.4;
        cursor: default;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function clearTimer() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function scheduleCheckIn() {
    clearTimer();
    if (!isSiteBlocked) return;
    timeoutId = window.setTimeout(showCheckInOverlay, timerMinutes * 60_000);
  }

  async function showEntryOverlay() {
    destroyOverlay();
    ensureOverlayStyle();

    overlayEl = document.createElement('div');
    overlayEl.id = '__pause_overlay__';
    overlayEl.innerHTML = `
      <div class="pause-card">
        <h2>Pause</h2>
        <div class="pause-divider"></div>
        <p class="pause-question">Why are you using</p>
        <p class="pause-site">${hostname}?</p>
        <p class="pause-help">Write a short journal entry to continue.</p>
        <textarea id="pause-entry" class="pause-input" placeholder="Write your reason here…"></textarea>
        <p class="pause-counter" id="pause-entry-counter">0 / 50 minimum</p>
        <div class="pause-buttons">
          <button id="pause-continue" type="button">Continue</button>
          <button id="pause-close" type="button">Close site</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlayEl);

    const entryEl = overlayEl.querySelector('#pause-entry');
    const counterEl = overlayEl.querySelector('#pause-entry-counter');
    const continueBtn = overlayEl.querySelector('#pause-continue');
    continueBtn.disabled = true;

    entryEl.addEventListener('input', () => {
      const len = entryEl.value.length;
      counterEl.textContent = len >= 50 ? `${len} characters` : `${len} / 50 minimum`;
      continueBtn.disabled = entryEl.value.trim().length < 50;
    });

    continueBtn.addEventListener('click', async () => {
      const reason = entryEl.value.trim();
      if (reason.length < 50) return;
      await saveReasonForSite(hostname, reason);
      destroyOverlay();
      scheduleCheckIn();
    });

    overlayEl.querySelector('#pause-close').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'PAUSE_CLOSE_TAB' });
    });

    entryEl.focus();
  }

  async function showCheckInOverlay() {
    destroyOverlay();
    ensureOverlayStyle();

    const lastReason = await getLastReasonForSite(hostname);

    overlayEl = document.createElement('div');
    overlayEl.id = '__pause_overlay__';
    overlayEl.innerHTML = `
      <div class="pause-card">
        <h2>Pause</h2>
        <div class="pause-divider"></div>
        <p class="pause-question">Why are you using</p>
        <p class="pause-site">${hostname}?</p>
        <p class="pause-last-label">Last written message:</p>
        <p class="pause-last-message"></p>
        <p class="pause-question" style="font-size:0.95rem">Are you here intentionally?</p>
        <div class="pause-buttons">
          <button id="pause-continue" type="button">Continue</button>
          <button id="pause-close" type="button">Close site</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlayEl);
    overlayEl.querySelector('.pause-last-message').textContent = lastReason;

    overlayEl.querySelector('#pause-continue').addEventListener('click', () => {
      destroyOverlay();
      scheduleCheckIn();
    });

    overlayEl.querySelector('#pause-close').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'PAUSE_CLOSE_TAB' });
    });
  }

  async function init() {
    const syncData = await chrome.storage.sync.get({
      [STORAGE.blocked]: [],
      [STORAGE.timer]: 15,
      pause_theme: 'blue',
    });

    const blocked = syncData[STORAGE.blocked] || [];
    timerMinutes = Number(syncData[STORAGE.timer]) || 15;
    currentTheme = syncData.pause_theme || 'blue';
    isSiteBlocked = isBlockedHost(hostname, blocked);

    if (!isSiteBlocked) {
      clearTimer();
      destroyOverlay();
      return;
    }

    clearTimer();
    showEntryOverlay();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (changes.pause_theme) {
      currentTheme = changes.pause_theme.newValue || 'blue';
    }
    if (changes[STORAGE.blocked] || changes[STORAGE.timer]) {
      init();
    }
  });

  init();
})();

