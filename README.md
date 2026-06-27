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
npm run dev      # HMR for popup/options (load unpacked from dist/ after first build)
npm run build    # Production build → dist/
npm test         # Vitest smoke tests
```

## Load unpacked

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder
5. Pin the extension and open the popup or **Options**

## Privacy

- Data stays on your device; no Discord user token is collected or stored
- Future versions will use `chrome.storage.local` for watch targets and link history only
- Permissions (`storage`, `tabs`, `host_permissions` for discord.com) are added incrementally as features ship

## Discord Terms of Service

Automating link-opening from Discord messages may conflict with Discord's Terms of Service.
This extension avoids storing a user token, which reduces risk but does not eliminate policy concerns.

## Icons

Toolbar icons are derived from [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen).

## Architecture rules

- UI pages (popup, options) message the service worker; they never call `chrome.tabs.create` directly
- Phase 2+: validate message `sender` in the service worker; use `textContent` (not `innerHTML`) for scraped Discord text
