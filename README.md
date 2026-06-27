# CookieScripts

Chrome extension that auto-opens allowlisted links from Discord web channels you watch.
See [BUILD.md](./BUILD.md) for architecture, phases, and upstream references.

**Repo:** [Quarks-1/CookieScripts](https://github.com/Quarks-1/CookieScripts)  
**Upstream desktop app:** [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen)

## Prerequisites

- Node.js 20+
- Google Chrome

## Development

```bash
npm install
npm run dev      # HMR for popup/options (reload extension for service worker changes)
npm run build    # Production build → dist/
npm test         # Vitest unit tests (links, validate, process-links, handlers, content)
```

After changing the service worker or background handlers, reload the extension on `chrome://extensions`.

## Load unpacked

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder
5. Pin the extension and open the popup or **Options**

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save watch targets, link history, and dedup keys locally on your device |
| `tabs` | Open matched product links in new background tabs; read active tab URL for status |
| `host_permissions: discord.com` | Inject the content script on Discord channel pages to watch messages |

## Known limitations

- **Thread URLs:** watch targets use the parent channel ID from `/channels/guild/parent/threadId` paths
- **Message edits:** links added by editing an existing message are not detected until v0.2
- **Selector fragility:** Discord UI changes may require updates to `extension/content/selectors.ts`
- **Masked links:** external URLs in visible message text are preferred over Discord redirect `href`s

## Privacy

- Data stays on your device; no Discord user token is collected or stored
- `chrome.storage.local` holds watch targets, link history (last 200), and recent dedup keys (last 500)
- No data is sent to external servers

## Discord Terms of Service

Automating link-opening from Discord messages may conflict with Discord's Terms of Service.
This extension avoids storing a user token, which reduces risk but does not eliminate policy concerns.

## Icons

Toolbar icons are derived from [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen).

## Architecture rules

- UI pages (popup, options) message the service worker; they never call `chrome.tabs.create` directly
- Service worker validates message `sender` (content vs extension-page paths)
- Content script (Phase 3) uses `textContent` (not `innerHTML`) for scraped Discord text
- Matched links open in new tabs with `active: false` so you stay on Discord
