---
name: code-quality
description: "Code quality audit and refactoring for Auto Refresh userscript. USE FOR: inline style extraction, dead code removal, security hardening, consistency fixes, CSS class refactoring, theme compliance checks. DO NOT USE FOR: feature implementation (use feature-implementation skill), unrelated projects."
argument-hint: "Describe the quality concern or area to audit"
---

# Code Quality Skill

## Purpose

Perform structured code quality audits and refactoring on `auto-refresh.user.js`. This skill ensures the codebase stays clean, consistent, secure, and maintainable as features are added.

## When to Use

- After implementing a new feature (integrated into feature-implementation Phase 4.5)
- When inline styles accumulate and need extraction to CSS classes
- When dead code or unused variables are suspected
- When security review is needed (innerHTML, user-controlled data)
- When consistency issues arise (duplicate patterns, mixed conventions)

## Audit Categories

Run through each category in order. For each finding, classify severity:

- **CRITICAL**: Bugs, data loss, security vulnerabilities — must fix immediately
- **IMPORTANT**: Dead code, accessibility gaps, consistency issues — should fix
- **MINOR**: Style nits, micro-optimizations — nice to have

### 1. Bugs & Logic Errors

- Off-by-one errors
- Race conditions (timer/interval interactions)
- Null/undefined access without guards
- Incorrect comparisons (=== vs ==, type coercion)
- Missing error handling at system boundaries (DOM queries, API calls)
- Leaked timers/event listeners
- State that becomes stale after user actions (e.g., snapshot overwritten before user can inspect)

### 2. Dead Code

- Variables declared but never read
- Functions defined but never called
- Unreachable code paths
- Unused function parameters (especially `i` in `.forEach((item, i)`)
- Properties passed to functions but never consumed (e.g., `opts.hoverBg`)

### 3. Security

- `innerHTML` or `html:` prop used with dynamic data — replace with `h()` + `text:` for defense-in-depth
- User-controlled strings inserted without escaping
- `eval()` or `Function()` usage
- Prototype pollution risks

### 4. Theme Compliance

- **NEVER hardcode colors** — all colors in `buildCss()` must use `var(--ar-*)` CSS custom properties. JS-side inline styles must use `T.*` tokens.
- New CSS classes should use `var(--ar-*)` variables (not `${T.*}` interpolation)
- The `T` object is still the source of truth for JS-side color references
- `applyTheme()` only updates CSS custom properties via `_themeVars` — it does NOT recompile `buildCss()`
- Active button subtitles: use CSS cascade (`.ar-btn-active .ar-subtitle-sm`) not conditional inline styles
- **Config compliance**: All global settings must use `Config.get()`/`Config.set()` — never raw `GM_getValue(STORAGE_KEY_*, default)` for global keys
- **Storage encapsulation**: All `GM_getValue`/`GM_setValue`/`GM_listValues` calls must be inside `Config`, `WatchStore`, or `RefreshService` internals — never in modal code, undo callbacks, or general functions. Run `scripts/lint-gm-calls.ps1` to verify.
- **Event bus compliance**: State mutations (watch add/remove, config changes) must emit events via `EventBus.emit()`
- **Cleanup compliance**: Document-level event listeners must use `addDocListener()` or push cleanup functions to `ctx.cleanups`

### 5. Inline Style Extraction

Since all UI runs inside Shadow DOM, prefer CSS classes over inline styles.

**Extract to CSS class when:**
- The same inline style appears 2+ times (pattern)
- The style uses theme tokens that must update on theme change (use `var(--ar-*)` in CSS)
- The style is purely layout (no dynamic/computed values)

**Keep inline when:**
- The value is computed at runtime (e.g., `left: ${position}px`)
- The style is toggled dynamically (e.g., `display: 'none'/'block'`)
- The element is outside the Shadow DOM (badge positioning)
- It's a one-off override on an existing CSS class (small tweak)

**Naming convention for new classes:**
- Prefix: `ar-` (auto-refresh namespace)
- Layout utilities: `ar-truncate`, `ar-flex-fill`, `ar-split-layout`
- Component parts: `ar-opt-top`, `ar-opt-value`, `ar-subtitle-sm`
- Modifiers: `ar-section-hdr-sep`, `ar-link-btn-center`, `ar-grid-btn`
- For specificity with existing classes: `.ar-grid-btn.ar-btn{...}`

### 6. Consistency

- Modal navigation: use `Modal.replace('id', extra, depth)` instead of chaining `Modal.pop(); Modal.push()` — the `replace` method handles pop+push atomically
- String truncation: use the shared `_truncate(str, max)` helper
- Toggle visual updates: use `setToggleState(track, thumb, isOn, trackW?, thumbSize?)` — never inline the track/thumb style logic
- Input validation borders: use `setInputError(input, hasError)` — never inline `input.style.borderColor = T.err`
- Watch operations: always use `WatchStore.*` methods (`.getLocal()`, `.add()`, `.remove()`, `.reSnapshot()`, `.getAll()`, `.removeRemote()`, `.groupByDomain()`, `.clearAll()`, `.getStatus()`). Standalone watch functions no longer exist.
- Refresh/Webhook from UI: use `RefreshService.start()`/`.stop()` and `WebhookService.getConfig()`/`.saveConfig()` from modals and menu commands. Raw functions are for internal core logic only.
- Runtime state: use `State.get()`/`State.set()` for timer IDs, audioCtx, lastWebhookTime, activeCtxMenu, badgeHoverEndHandler. Never use standalone `let` variables for these.
- Settings access: always use `Config.get()`/`Config.set()` for global settings, never raw `GM_getValue()`
- Event listeners: always use `addDocListener()` for document-level listeners that need cleanup
- Simple picker modals: prefer `type: 'picker'` declarative format when possible, with optional `renderOption` and `layout: 'grid'`
- Duplicate constant definitions: consolidate (e.g., mode labels defined in multiple places)
- Duplicate logic blocks: extract to helper functions

### 7. Accessibility (Optional)

- `role="dialog"` and `aria-modal="true"` on modal overlays
- `role="switch"` and `aria-checked` on toggle controls
- `aria-label` on inputs without visible labels
- Focus trapping within modals (Tab/Shift+Tab)
- `role="menu"` / `role="menuitem"` on context menus

### 8. Performance

- Avoid forced reflows (`void el.offsetWidth`) unless actually needed for animation reset
- Minimize DOM queries in hot paths (countdown timer runs every second)
- Use event delegation for large lists

## Workflow

### Quick Audit (after feature implementation)

1. Read the changed code sections
2. Check categories 1-5 (bugs, dead code, security, theme, inline styles)
3. Fix CRITICAL and IMPORTANT findings
4. Run syntax check: `node -c auto-refresh.user.js`
5. Report findings and fixes

### Full Audit (periodic deep review)

1. Use a subagent to read the entire file and audit all 8 categories
2. Prioritize findings by severity
3. Fix CRITICAL issues immediately
4. Batch IMPORTANT fixes
5. Log MINOR findings for future cleanup
6. Run syntax check
7. Browser-verify any visual changes

## Pitfalls

1. **Don't extract dynamic styles to CSS** — if a value depends on runtime state (e.g., `isEnabled() ? T.accent : T.borderLight`), it must stay inline since the class can't capture the conditional.

2. **CSS specificity with compound classes** — when adding a modifier class to an element that already has `ar-btn`, use `.ar-modifier.ar-btn{...}` to ensure the modifier wins over `.ar-btn{...}`.

3. **Theme tokens in `buildCss()` are re-evaluated** — `buildCss()` runs on every theme change. CSS classes defined there automatically get new theme colors. Inline styles with `T.*` tokens do NOT update.

4. **Don't over-abstract** — if a pattern appears only once, keep it inline. Extract only when there's clear repetition (2+) or when it uses theme tokens that must be reactive.

5. **`innerHTML` is a security surface** — even if current data is safe (computed styles, etc.), prefer `textContent`/`h()` for defense-in-depth. HTML injection through CSS values is unlikely but possible.
