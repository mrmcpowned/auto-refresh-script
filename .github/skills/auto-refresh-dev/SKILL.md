---
name: auto-refresh-dev
description: "Develop, test, and deploy the Auto Refresh Tampermonkey/Greasemonkey userscript. USE FOR: editing auto-refresh.user.js, fixing UI bugs, adding features, version bumping, browser QA testing, creating version snapshots. DO NOT USE FOR: unrelated projects."
argument-hint: "Describe the change or bug to fix"
---

# Auto Refresh Userscript — Development Skill

## Project Overview

A ~4200-line Tampermonkey/Greasemonkey userscript (`auto-refresh.user.js`) that auto-refreshes any webpage at a configurable interval with a rich modal UI system, element watching, keyboard navigation, and visual diff inspection.

### File Layout

| Path | Purpose |
|------|---------|
| `auto-refresh.user.js` | **Primary source file** — always edit this first |
| `versions/` | Version snapshots (e.g., `v1.2.1-fix-outline.user.js`) |
| `change-reports/` | Markdown change reports (only create when requested) |
| `feature-specs/` | Feature specification documents (pending implementation) |
| `feature-documentation/` | Completed feature specs enriched with implementation details |
| `action-plans/` | Implementation plans for features and refactors |
| `scripts/` | Utility scripts (e.g., `capture-browser.ps1` for browser screenshots) |
| `auto-refresh-qa.md` | QA test scenarios and results |

## Editing Workflow

1. **Edit `auto-refresh.user.js`** — this is the only source file to modify
2. **Save the file** — the user has file tracking configured so Tampermonkey picks up changes automatically on save
3. **Validate in browser** at the test URL

## Version Management

### Bumping Versions

Two locations must be updated in sync:

1. **UserScript metadata block** (line ~4): `// @version      X.Y.Z`
2. **VERSION constant** (line ~16): `const VERSION = 'X.Y.Z';`

Use `multi_replace_string_in_file` to update both in a single operation.

### Creating Snapshots

After deploying and verifying a change:
```powershell
Copy-Item "auto-refresh.user.js" "versions/vX.Y.Z-short-description.user.js" -Force
```

Naming convention: `v{version}-{kebab-case-description}.user.js`

## Browser Testing

### CRITICAL: Never Inject the Userscript

**Do NOT inject the userscript code into the browser via `page.evaluate()`, `page.addScriptTag()`, or any other code injection method.** The userscript must always run via Tampermonkey — navigate to a page and let Tampermonkey load it naturally. Injecting the script bypasses Tampermonkey's GM API context and creates a fundamentally different execution environment that produces misleading test results.

To test changes:
1. Save `auto-refresh.user.js` (file tracking syncs it to Tampermonkey automatically)
2. Navigate to the test URL (or any URL matching `@match`)
3. Wait for Tampermonkey to inject the script (~1-2 seconds)
4. Verify the shadow host exists: `document.getElementById('auto-refresh-shadow-host')`

### Test URL
```
https://emrepbu.github.io/RefreshCounter/
```

This is a simple counter page that increments on each refresh — ideal for testing refresh behavior, watch detection, and UI interactions.

### MCP Browser Limitations

- **Badge cannot be clicked** via MCP — the badge renders as a nested `document` in the accessibility tree and MCP cannot target it. Use the keyboard hotkey instead.
- **Default hotkey**: `Alt+Shift+KeyR` (note the `Key` prefix for MCP `press_key`).
- After opening settings via hotkey, all sub-modals and buttons are accessible via MCP click or keyboard navigation.

### Keyboard Navigation Testing

The modal system supports full keyboard navigation:
- `ArrowDown` / `ArrowUp` — move focus through `button` and `input` elements
- `Enter` — activate focused element (except inputs, which handle Enter natively)
- `Escape` — close current modal / go back
- Focus wraps around at list boundaries
- Focus outline uses `outline: 2px solid #fff` with `outlineOffset: -2px` (inset to avoid clipping by `overflow:hidden` containers)

## Code Architecture

### Structure

Single IIFE with `'use strict'`. No modules, no build step, no dependencies.

```
┌─ UserScript metadata block (@name, @version, @grant, etc.)
├─ Constants & theme definitions (THEMES, CORNERS, FONT_SIZES)
├─ Event Bus (EventBus: on/off/emit for component decoupling)
├─ Centralized State Store (State.get/set for runtime state: timers, audioCtx, etc.)
├─ Cleanup Helper (addDocListener: returns cleanup function)
├─ Centralized Config (Config.get/set with schema & defaults)
├─ Per-URL storage keys (enabled, watches, watchEnabled)
├─ I18N Dictionary (EN + ES translations, t() function with interpolation + plurals)
├─ WatchStore (IIFE encapsulating all watch CRUD, caching, migration, status checks)
├─ Style capture & diff utilities (WATCHED_STYLE_PROPS, captureStyles, diffStyles)
├─ CSS Variables & Stylesheet (buildThemeVars + static buildCss with var() refs)
├─ DOM builder utility h()
├─ UI Helpers (createFocusTrap, setToggleState, setInputError, makeOptionBtn, etc.)
├─ Badge system (CSS class-based, updateBadge, positioning)
├─ Toast notification system (showToast with stacking)
├─ Alert system (playBeep, startAlert, stopAlert, speak)
├─ Webhook notifications (sendWebhook, formatWebhookPayload, rate limiting)
├─ Service Facades (WebhookService, RefreshService — thin wrappers for external callers)
├─ Modal framework (Modal.define/open/push/pop/replace/closeAll with keyboard nav)
│   └─ Supports type:'picker' for declarative option list modals
│   └─ Supports renderOption/layout:'grid' for custom picker rendering
├─ Modal definitions (~15 modals, 4 declarative pickers)
├─ Element picker (highlight, label, click-to-select)
├─ Quick Watch context menu (Ctrl+right-click)
├─ Watch check pipeline (detectChanges → notifyChanges, parallel via Promise.all)
├─ Test harness (runTests: ~60 inline assertions covering all architectural layers)
└─ Initialization & refresh loop
```

### Key Patterns

- **Config access**: Use `Config.get('name')` and `Config.set('name', value)` for all global settings. Never call `GM_getValue`/`GM_setValue` directly for global keys — use Config. Per-URL keys (enabled, watches, watchEnabled) still use direct GM_getValue/GM_setValue.
- **State store**: Use `State.get('key')` / `State.set('key', value)` for all mutable runtime state (timer IDs, audioCtx, lastWebhookTime, activeCtxMenu, badgeHoverEndHandler). The `remaining` and `paused` variables are intentionally kept as local `let` for performance in the countdown hot path.
- **Event Bus**: Use `EventBus.emit('event', data)` to notify other components. Subscribe with `EventBus.on('event', handler)`. Core events: `config:changed`, `watch:added`, `watch:removed`, `watches:cleared`, `theme:changed`.
- **WatchStore**: All watch CRUD goes through `WatchStore.getLocal()`, `.add()`, `.remove()`, `.reSnapshot()`, `.getAll()`, `.removeRemote()`, `.groupByDomain()`, `.clearAll()`, `.getStatus()`. Never use standalone watch functions — they've been consolidated into WatchStore.
- **Service facades**: External callers (modals, menu commands, init) use `RefreshService.start()`/`.stop()` and `WebhookService.getConfig()`/`.saveConfig()`/`.validateUrl()` etc. Internal core logic (startRefresh calling stopRefresh) uses the raw functions directly.
- **Cleanup helpers**: Use `addDocListener(event, handler, capture)` which returns a cleanup function. Push cleanup functions to `ctx.cleanups` in modal build functions.
- **CSS theming**: All CSS classes use `var(--ar-*)` CSS custom properties for colors. The `T` object is still the runtime source of truth for JS-side color references (inline styles, dynamic logic). Theme switches update CSS variables via `_themeVars` style element — no CSS recompilation needed. Badge and picker use `.ar-badge`, `.ar-picker-highlight`, `.ar-picker-label` CSS classes.
- **Declarative modals**: Simple picker modals can use `type: 'picker'` in `Modal.define()` with `current`, `options`, `onSelect`, `toastTemplate`, and optionally `renderOption` (custom per-option DOM) and `layout: 'grid'` — the framework auto-generates the `build` function.
- **Modal navigation**: Use `Modal.replace('id', extra, depth)` instead of `Modal.pop(); Modal.push()` chains. `depth` defaults to 1; use 2 for double-pops (e.g., returning from a sub-sub-modal).
- **UI helpers**: Use `setToggleState(track, thumb, isOn, trackW?, thumbSize?)` for toggle updates. Use `setInputError(input, hasError)` for validation borders. Use `createFocusTrap(container)` for keyboard navigation in any container.
- **Watch change detection**: `detectChanges()` runs all watches in parallel via `Promise.all` (each watch's `waitForElement` + `_waitForStableContent` runs concurrently). Results are aggregated into `{ changes, missing, details }` then passed to `notifyChanges()`.
- **Text content**: Always use `el.innerText.trim()` — never `textContent` — because `innerText` reflects visual rendering and excludes hidden elements.
- **Badge time format**: Uses `Xm XXs` for times ≥ 60s. This format appears in TWO places: the `updateBadge` function AND the Quick Actions status bar in settings. Both must stay in sync.
- **Toast stacking**: Toasts use unique IDs and shift down by 48px to avoid overlap.
- **Diff truncation**: Long diffs are truncated to 500 chars with an expand button.
- **Large element warning**: Elements with >1000 chars of content show an amber warning box.
- **Collapsible sections**: Watch Inspector uses `addCollapsible()` for CSS Selector, Content, and Style Changes sections.

### Greasemonkey APIs Used

| API | Purpose |
|-----|---------|
| `GM_getValue` / `GM_setValue` | Per-URL settings and watch data (wrapped by `Config` for global keys) |
| `GM_registerMenuCommand` | Browser extension menu entry |
| `GM_notification` | Granted but currently unused |
| `GM_xmlhttpRequest` | Webhook notifications |
| `GM_listValues` | Watch overview (list all storage keys) |

### Storage Keys

Per-URL keys (use `_urlKey = location.origin + location.pathname`):
- `autoRefreshEnabled_{url}` — whether auto-refresh is active
- `autoRefreshWatches_{url}` — JSON array of watch objects
- `autoRefreshWatchEnabled_{url}` — whether watching is enabled

Global keys (managed via `Config.get()`/`Config.set()` — see `CONFIG_SCHEMA`):
- `interval`, `corner`, `fontSize`, `hotkey`, `theme`, `opacity`
- `alertMode`, `ttsVoice`, `ttsRate`, `ttsVolume`
- `webhook`, `settingsExpanded`, `language`

## Common Pitfalls

1. **Version mismatch** — the `@version` metadata and `VERSION` constant must always match.
2. **Outline clipping** — any parent with `overflow:hidden` (like the inspector toolbar) clips outward outlines. Always use negative `outlineOffset` for focus indicators.
3. **Do NOT create markdown docs** unless the user explicitly requests them.
4. **Never hardcode colors** — always use `T.*` theme tokens for JS-side inline styles, or `var(--ar-*)` CSS custom properties in `buildCss()`. The app supports 4 themes (dark, light, minimal, highContrast). Hardcoded hex values or `rgba()` colors will break on non-dark themes. If a suitable token doesn't exist, use CSS inheritance or opacity on an existing token. Key tokens: `T.text`, `T.textLight`, `T.textMuted`, `T.textDim`, `T.textFaint`, `T.textSub`, `T.accent`, `T.bg`, `T.bgLight`.
5. **Active button subtitles** — `makeOptionBtn` with `isActive` + subtitle: the subtitle inherits button's `color` (set by `ar-btn-active` CSS class). Don't override its color inline when active — use opacity for visual hierarchy instead.
7. **Test harness** — When adding a new pure function (formatting, diffing, data transformation), add test cases to `runTests()`. Run via Tampermonkey menu → `Run tests`. Results appear in console + toast. ~60 assertions cover: formatSeconds, formatCountdown, _truncate, getModeColor, _camelToVar, v(), buildThemeVars, _replaceTemplateTags, diffStyles, formatWebhookPayload, EventBus, WatchStore.groupByDomain, WatchStore.getStatus, Config schema, WebhookService.validateUrl, service facade consistency, State round-trip, Modal.replace, createFocusTrap, setToggleState, setInputError, and I18N.
8. **Watch operations** — always use `WatchStore.*` methods. Never call standalone `getWatches()`, `addWatch()` etc. — they no longer exist. The WatchStore encapsulates caching, migration, and event emission.
9. **Refresh/Webhook operations from UI** — always use `RefreshService.start()`/`.stop()` and `WebhookService.getConfig()`/`.saveConfig()` from modals and menu commands. The raw functions (`startRefresh`, `_getWebhookConfig`) are for internal core logic only.
10. **Modal stack navigation** — use `Modal.replace('id', extra, depth)` instead of chaining `Modal.pop(); Modal.push()`. This is cleaner and handles the pop+push atomically.
11. **Toggle state updates** — use `setToggleState(track, thumb, isOn)` helper for all toggle visual updates to avoid duplicating the track/thumb style logic.
12. **Input validation feedback** — use `setInputError(input, hasError)` instead of inline `input.style.borderColor = T.err`.
