/* Pause — Background Service Worker */

const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'instagram.com',
  'twitter.com',
  'facebook.com',
];

const DEFAULTS_SYNC = {
  pause_blocked: DEFAULT_BLOCKED_SITES,
  pause_timer_minutes: 15,
  pause_theme: 'blue',
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(Object.keys(DEFAULTS_SYNC));
  await chrome.storage.sync.set({
    pause_blocked: Array.isArray(existing.pause_blocked)
      ? existing.pause_blocked
      : [...DEFAULT_BLOCKED_SITES],
    pause_timer_minutes: Number(existing.pause_timer_minutes) || 15,
    pause_theme: existing.pause_theme || 'blue',
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'PAUSE_CLOSE_TAB' && sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
  }
});
