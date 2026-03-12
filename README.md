# Pause

**Break the trance. Ask yourself why before you scroll.**

A Chrome extension that prompts you to state your reason before visiting a site, and blocks sites you've flagged to help build intentional browsing habits.

## Install

1. Go to `chrome://extensions/`, enable **Developer mode**
2. Click **Load unpacked** and select the `pause-extension` folder

## How It Works

- **Popup** — asks *"Why are you opening this?"*, manages your block list, and shows your reason log
- **Background** — intercepts navigation to blocked sites and redirects to a pause page
- **Blocked page** — explains the site is paused; offers "Go Back" or "Unblock"

## Data & Storage

**What data does this tool need?** A list of blocked sites and a log of the reasons you've entered for visiting sites.

**Where is it stored?** In Chrome's `storage.sync`, which is local to the browser but syncs across Chrome devices tied to the same Google account.

**Is it temporary or persistent?** Persistent — data remains until you manually clear it or uninstall the extension.

**Does the system need memory between sessions?** Yes — the blocked-sites list and reason log must persist across browser sessions to be useful.

**Does the system require AI inference?** No — all logic is rule-based and runs entirely in the browser.

**How many API calls are realistically required?** Zero — the extension uses only the Chrome Extensions API (`storage`, `tabs`), with no external network requests.

**What happens if the API fails?** If `storage.sync` is unavailable, blocked sites won't load and reasons won't be saved; the extension degrades silently without crashing the browser.

## License

MIT
