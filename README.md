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

## Load unpacked

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder
5. Pin the extension and open the popup on a Discord channel tab

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save per-channel domain allowlists, link history, and dedup keys locally on your device |
| `tabs` | Open matched product links in new background tabs; read active tab URL for status |
| `host_permissions: discord.com` | Inject the content script on Discord channel pages to scan messages |

## Known limitations

- **Thread URLs:** allowlists use the parent channel ID from `/channels/guild/parent/threadId` paths
- **Message edits:** links added by editing an existing message are not detected until v0.2
- **Selector fragility:** Discord UI changes may require updates to `extension/content/selectors.ts`
- **Masked links:** external URLs in visible message text are preferred over Discord redirect `href`s

## Privacy

- Data stays on your device; no Discord user token is collected or stored
- When the extension is enabled, open Discord channel tabs are scanned for links in new messages (link opening is still gated by your per-channel domain allowlist in the popup)
- `chrome.storage.local` holds per-channel domain allowlists, link history (last 200), and recent dedup keys (last 500)
- No data is sent to external servers

## Discord Terms of Service

Automating link-opening from Discord messages may conflict with Discord's Terms of Service.
This extension avoids storing a user token, which reduces risk but does not eliminate policy concerns.

## Icons

Toolbar icons are derived from [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen).

## Architecture rules

- The popup messages the service worker; it never calls `chrome.tabs.create` directly
- Service worker validates message `sender` (content vs extension-page paths)
- Content script uses `textContent` (not `innerHTML`) for scraped Discord text
- Matched links open in new tabs with `active: false` so you stay on Discord
