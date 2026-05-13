# Feature Spec: Inline Style Extraction

## Overview

Move 200+ inline style strings throughout the codebase into CSS classes defined in `buildCss()`. The existing CSS variable system (`v()` helper, `buildThemeVars()`) provides a clean mechanism for theming, but many elements bypass it by using inline `style` attributes with hardcoded color values from `T`. This refactor moves those to `.ar-*` classes, making the codebase more maintainable and theme changes single-point edits.

---

## Problem Statement

Inline styles are used extensively for badge creation (~20 properties), hover info panel, progress bar, toast positioning, element picker overlay/label, context menu positioning, modal previews, and many button decorations. These inline styles:
- Bypass the CSS variable system, making theme changes require code edits
- Create visual inconsistencies when the theme object `T` is referenced instead of `v()` CSS variables
- Add code volume — each `style:` attribute can be 3-5 lines of template literals
- Make it impossible to override styles via the stylesheet

---

## User Stories

- As a developer, I want badge styling defined in CSS so that theme changes only require updating CSS variables.
- As a developer, I want element picker styling in CSS classes so I can adjust it without editing JavaScript strings.
- As a developer, I want consistent use of `v()` CSS variables across all components.

---

## UX Design

No user-facing UX changes. All visual styling should remain identical.

---

## Technical Design

### Categories of Inline Styles to Extract

#### 1. Badge Element (~20 inline properties → `.ar-badge` class)
Current:
```javascript
style: ['position:fixed', 'z-index:2147483647', `background:${T.bgBadge}`, ...].join(';')
```
Target: `class: 'ar-badge'` with CSS rule in `buildCss()`.

Properties that must remain inline (dynamic): `top`, `bottom`, `left`, `right`, `transform` (set by `applyCorner()`), `fontSize` (set by `applyFontSize()`), `display` (toggled), `opacity` (user-configurable), `width` (hover animation).

#### 2. Badge Sub-Elements
- `badgeContent` → `.ar-badge-content`
- `badgeText` → inherits from badge
- `watchDot` → `.ar-badge-watch-dot`
- `hoverInfo` → `.ar-badge-hover`
- `progressBar` → `.ar-badge-progress`

#### 3. Element Picker
- Highlight overlay → `.ar-picker-highlight`
- Instructions label → `.ar-picker-label`

#### 4. Preview Elements in Modals
- Theme preview badges in `theme-picker` → `.ar-theme-preview`
- Opacity preview badge → reuse `.ar-theme-preview` with overrides
- Font size preview → `.ar-font-preview`

#### 5. Miscellaneous
- Status bar dot styles → already use classes, but `box-shadow` is inline
- Inline `color` overrides → use CSS variable references via `v()`
- `style: 'margin-top:10px'` type layout tweaks → keep inline (layout-specific, not theme-related)

### Rules for What Stays Inline

Keep inline styles ONLY for:
1. **Dynamic values** set by JavaScript at runtime (position, display, width during animation)
2. **One-off layout tweaks** (margin adjustments specific to one element's context)
3. **User-configurable values** (opacity from Config)

### CSS Class Additions to `buildCss()`

```css
.ar-badge{position:fixed;z-index:2147483647;background:var(--ar-bg-badge);color:var(--ar-ok);
    font:bold 13px/1 monospace;padding:0;border-radius:8px;cursor:pointer;user-select:none;
    box-shadow:0 2px 8px var(--ar-shadow);backdrop-filter:blur(4px);
    transition:opacity .2s,box-shadow .3s,width .2s ease;overflow:hidden;pointer-events:auto}
.ar-badge-content{padding:6px 10px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.ar-badge-watch-dot{width:6px;height:6px;border-radius:50%;background:var(--ar-cyan);display:none;flex-shrink:0}
.ar-badge-hover{max-height:0;overflow:hidden;transition:max-height .2s,padding .2s;font-size:11px;
    color:var(--ar-text-muted);padding:0 10px;white-space:nowrap;text-align:center}
.ar-badge-progress{height:3px;background:var(--ar-ok);transition:width .3s linear,background .3s;
    width:100%;border-radius:0 0 8px 8px}
.ar-picker-highlight{position:absolute;z-index:2147483646;pointer-events:none;
    border:2px solid var(--ar-accent);background:var(--ar-accent-faint);border-radius:3px;transition:all .05s}
.ar-picker-label{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;
    background:var(--ar-bg);color:var(--ar-text);font:13px/1 system-ui,sans-serif;padding:8px 16px;
    border-radius:8px;box-shadow:0 4px 16px var(--ar-shadow-heavy)}
```

### Migration Strategy

For each inline style:
1. If it references `T.xxx` → replace with `v('xxx')` in a CSS class
2. If it's layout/spacing → keep inline
3. If it's dynamic (set at runtime) → keep inline, remove static parts to CSS class

### `applyTheme()` Simplification

After extraction, `applyTheme()` can remove lines that manually update badge inline styles since CSS variables handle it automatically:
```javascript
// BEFORE:
badge.style.background = T.bgBadge;
badge.style.boxShadow = isMinimal ? 'none' : `0 2px 8px ${T.shadow}`;
// ...

// AFTER (minimal theme exception handled by CSS class override):
// Only dynamic overrides remain (minimal theme text-shadow)
```

---

## Edge Cases & Error Handling

- The `minimal` theme sets `background: transparent` and disables `backdrop-filter` — this must be handled via a `.ar-theme-minimal` class or inline override in `applyTheme()`
- Badge hover animation modifies `width` inline — this must remain inline
- `applyCorner()` sets positional properties inline — these must remain inline

---

## Scope & Non-Goals

### In Scope
- Extracting badge element inline styles to `.ar-badge*` classes
- Extracting element picker styles to `.ar-picker-*` classes
- Replacing `T.xxx` references with `v('xxx')` in style strings that remain inline
- Simplifying `applyTheme()` to remove redundant inline style updates

### Out of Scope (Future)
- Extracting every last inline style (layout margins, one-off widths)
- Creating CSS custom properties for spacing/sizing tokens
- Dark/light mode via `prefers-color-scheme` media query

---

## Risks & Open Questions

1. Some badge inline styles are set conditionally in `applyTheme()` (e.g., minimal theme removes box-shadow). Need to ensure CSS class + inline override coexist correctly.
2. The badge `display:none` initial state must remain inline to prevent flash of content.
