/* ─────────────────────────────────────────────────────────────
   Pause — Blocked Page Logic
   Reads the blocked hostname from the URL query string and
   offers options to go back or unblock the site.
   ───────────────────────────────────────────────────────────── */

const params      = new URLSearchParams(window.location.search);
const blockedSite = params.get('site') || 'Unknown site';

document.getElementById('blocked-site').textContent = blockedSite;

chrome.storage.sync.get({ pause_theme: 'blue' }).then((data) => {
  document.body.setAttribute('data-theme', data.pause_theme || 'blue');
});

/* ── Go Back ── */
document.getElementById('btn-go-back').addEventListener('click', () => {
  // Try navigating back; if there's no history, close the tab
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
});

/* ── Unblock & proceed ── */
document.getElementById('btn-unblock').addEventListener('click', async () => {
  const data  = await chrome.storage.sync.get({ pause_blocked: [] });
  const sites = data.pause_blocked.filter((s) => s !== blockedSite);
  await chrome.storage.sync.set({ pause_blocked: sites });

  // Navigate to the now-unblocked site
  window.location.href = 'https://' + blockedSite;
});
