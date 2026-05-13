# Auto Refresh Page

A feature-rich Tampermonkey/Greasemonkey userscript that auto-refreshes any webpage at a configurable interval with powerful change detection, notifications, and a fully themed settings UI.

**Version:** 4.6.0 · **Platform:** Tampermonkey / Greasemonkey · **Scope:** All websites

---

## Features

### Core
- **Configurable auto-refresh** with adjustable interval and countdown badge
- **Element watch** — monitor specific DOM elements for changes using CSS selectors
- **Change detection** — diff-based comparison with content snapshots
- **Watch naming & labels** — assign custom names to monitored elements
- **Cross-domain watch overview** — manage all watches from a single panel

### Notifications & Alerts
- **Alert modes** — Beep (Web Audio API), Speech (Web Speech API), or Both
- **Text-to-speech** — announces which element changed, with configurable voice, rate, and volume
- **Webhook notifications** — send alerts to Slack, Discord, Teams, or any webhook endpoint
- **Multi-webhook support** — route alerts to multiple services with per-webhook configuration
- **Confirmation toasts with undo** — reversible actions with brief toast notifications

### UI & Theming
- **4 built-in themes** — Dark (default), Light, Minimal, High Contrast
- **CSS custom properties** (`--ar-*`) for instant theme switching
- **Badge customization** — opacity, position (6 corners), urgency colors
- **Shadow DOM isolation** — all UI rendered inside a shadow root, zero style conflicts
- **Smooth modal transitions** — animated push/pop/replace with `prefers-reduced-motion` support
- **Modal breadcrumb trail** — clickable navigation for nested settings panels
- **Keyboard shortcut cheat sheet** — quick-reference overlay

### Internationalization
- **Multi-language UI** — English and Spanish with auto-detect from browser locale
- **300+ translation keys** covering all settings, modals, alerts, and TTS messages

### Developer & QA
- **Inline test harness** — ~60 assertions covering services, state, helpers, and I18N
- **Declarative modal registry** — 20+ modals defined as data, rendered on demand
- **Event bus architecture** — decoupled pub/sub communication between components

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Firefox/Safari)
2. Open `auto-refresh.user.js` — Tampermonkey will prompt to install
3. Navigate to any page and press **Alt+Shift+R** to open settings

---

## Usage

| Action | How |
|---|---|
| Open settings | **Alt+Shift+R** (customizable) |
| Toggle refresh | Tampermonkey menu → *Toggle Auto Refresh* |
| Set interval | Settings → Refresh Interval |
| Add a watch | Right-click an element → *Watch this element* (or enter a CSS selector) |
| Manage watches | Settings → Watch Overview |
| Send webhook | Settings → Webhook → configure endpoint URL |
| Change theme | Settings → Theme |
| Change language | Settings → Language |
| Run tests | Tampermonkey menu → *Run Tests* |

---

## Architecture

The script is a single-file userscript (~4,600 lines) organized into singleton services:

| Component | Role |
|---|---|
| `Config` | Schema-driven settings with validation and defaults |
| `EventBus` | Pub/sub event hub (`config:changed`, `watch:added`, `theme:changed`, …) |
| `State` | Mutable runtime state (timers, DOM references) |
| `WatchStore` | Per-URL watch persistence via `GM_setValue` / `GM_getValue` |
| `RefreshService` | Countdown timer start/stop facade |
| `WebhookService` | Multi-webhook dispatch with rate limiting |
| `Modal` | Stack-based modal framework with push/pop/replace navigation |
| `Badge` | Countdown display with urgency color transitions |
| `I18N` | Translation dictionaries with pluralization |
| `h()` | JSX-like DOM builder — `h(tag, props, ...children)` |

**Bootstrap flow:** constants → singletons → Shadow DOM → CSS injection → badge → modal registration → event listeners → Tampermonkey menu commands → page-ready hooks.

---

## Project Structure

```
auto-refresh.user.js          # The userscript (single file)
feature-specs/                 # Planned feature specifications
feature-documentation/         # Completed feature documentation
action-plans/                  # Implementation action plans
change-reports/                # Version change reports
versions/                      # Version snapshots
scripts/
  lint-gm-calls.ps1            # Verify GM_* API usage rules
  capture-browser.ps1          # Browser QA testing utility
docs/
  architecture-map.html        # Interactive architecture diagram (live)
```

> **[View the live Architecture Map](https://mrmcpowned.github.io/auto-refresh-script/architecture-map.html)**

---

## GM_* API Usage

All Greasemonkey/Tampermonkey API calls are encapsulated in service objects (`Config`, `WatchStore`, `WebhookService`). Direct calls outside these services are prohibited — enforced by `scripts/lint-gm-calls.ps1`.

| API | Used By |
|---|---|
| `GM_getValue` / `GM_setValue` | `Config`, `WatchStore` |
| `GM_listValues` | `WatchStore` (cross-domain watch enumeration) |
| `GM_registerMenuCommand` | Bootstrap (9 menu items) |
| `GM_xmlhttpRequest` | `WebhookService` (CORS-bypassing POST) |
| `GM_notification` | Alert system |

---

## Development

```powershell
# Syntax check
node -c auto-refresh.user.js

# Lint GM_* API calls
.\scripts\lint-gm-calls.ps1

# Create a version snapshot
Copy-Item auto-refresh.user.js "versions/v4.6.0-snapshot.user.js"
```

Run the inline test harness from Tampermonkey menu → **Run Tests** and check the browser console for results.

---

## License

[MIT](LICENSE)
