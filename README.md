# CookieScripts

Chrome extension that auto-opens allowlisted links from Discord web channels.
See [BUILD.md](./BUILD.md) for architecture, phases, and upstream references.

**Repo:** [Quarks-1/CookieScripts](https://github.com/Quarks-1/CookieScripts)  
**Upstream desktop app:** [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen)

## Prerequisites

- Node.js 20+
- Google Chrome

## Development

```bash
npm install
npm run dev      # Extension HMR (reload on chrome://extensions for service worker changes)
npm run dev:ui   # Browser preview for popup with mocked chrome APIs
npm run build    # Production build → dist/
npm test         # Vitest unit tests (links, validate, process-links, handlers, content)
```

After changing the service worker or background handlers, reload the extension on `chrome://extensions`.

## Install (from release)

1. Open [GitHub Releases](https://github.com/Quarks-1/CookieScripts/releases)
2. Download `cookiescripts-X.Y.Z.zip` for the latest release
3. Unzip to a permanent folder (`manifest.json` must be at the root of that folder)
4. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select that folder
5. Pin the extension and open the popup on a Discord channel tab

If you installed from a dev build before releases existed, do this once to enable in-extension update checks (new `api.github.com` permission).

## Update

1. Download the latest `cookiescripts-X.Y.Z.zip` from [Releases](https://github.com/Quarks-1/CookieScripts/releases)
2. Unzip **into the same folder** already loaded in Chrome (replace all files)
3. On `chrome://extensions`, click **Reload** on the existing CookieScripts card — do **not** use **Load unpacked** again (that creates a duplicate extension and resets settings)

The popup shows an update banner when a newer release is available (checks GitHub at most every 6 hours).

## Load unpacked (development)

1. Run `npm run build` (or `npm run package` for a local zip)
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder
5. Pin the extension and open the popup on a Discord channel tab

Releases are created automatically on every push to `main` (patch version bump). Contributors should `git pull` after merging to stay in sync with version commits from CI.

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save per-channel domain allowlists, link history, dedup keys, and update-check cache locally on your device |
| `tabs` | Open matched product links and the GitHub release page when you choose to download an update |
| `host_permissions: discord.com` | Inject the content script on Discord channel pages to scan messages |
| `host_permissions: api.github.com` | Check the public GitHub Releases API for newer versions (anonymous GET; no Discord or settings data sent) |

## Known limitations

- **Thread URLs:** allowlists use the parent channel ID from `/channels/guild/parent/threadId` paths
- **Message edits:** links added by editing an existing message are not detected until v0.2
- **Selector fragility:** Discord UI changes may require updates to `extension/content/selectors.ts`
- **Masked links:** external URLs in visible message text are preferred over Discord redirect `href`s

## Privacy

- Data stays on your device; no Discord user token is collected or stored
- When the extension is enabled, open Discord channel tabs are scanned for links in new messages (link opening is still gated by your per-channel domain allowlist in the popup)
- `chrome.storage.local` holds per-channel domain allowlists, link history (last 200), recent dedup keys (last 500), and cached update-check metadata
- The popup may send an anonymous GET to `api.github.com` to compare your installed version with the latest GitHub release; no Discord messages, settings, or history are transmitted
- Extension packages are distributed via GitHub Releases over HTTPS; trust model is the Quarks-1 org and your browser’s download of the release zip

## Discord Terms of Service

Automating link-opening from Discord messages may conflict with Discord's Terms of Service.
This extension avoids storing a user token, which reduces risk but does not eliminate policy concerns.

## Icons

Toolbar icons are derived from [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen).

## Architecture rules

- The popup messages the service worker for extension logic; it opens the GitHub release page when you download an update
- Service worker validates message `sender` (content vs extension-page paths)
- Content script uses `textContent` (not `innerHTML`) for scraped Discord text
- Matched links open in new tabs with `active: false` so you stay on Discord
