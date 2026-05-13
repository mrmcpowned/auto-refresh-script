# Feature Spec: CSS Variables Theming

## Overview

Replace the current theme system — which substitutes `T.*` color values directly into CSS strings and inline styles — with CSS custom properties (`--ar-*`) on the Shadow DOM host. This eliminates the need to recompile `buildCss()` on every theme switch and makes all styled elements automatically theme-aware.

---

## Problem Statement

Currently, `buildCss()` returns a ~100-line CSS string with `T.*` values baked in. Every theme switch calls `applyTheme()` which re-runs `buildCss()` and replaces the entire `<style>` content. Inline styles on the badge also need manual updating. Adding a new color token requires threading it through every usage site. This is fragile, slow, and makes future features harder to build.

---

## User Stories

- As a developer, I want to add a new theme color without updating 50+ CSS rules manually.
- As a developer, I want theme switching to be instant without recompiling all CSS.
- As a user, I want smooth theme transitions.

---

## Technical Design

### Phase 1: Define CSS Custom Properties

Add a `buildThemeVars(theme)` function that returns CSS custom property declarations:

```css
:host {
  --ar-bg: #1e1e1e;
  --ar-text: #eee;
  --ar-accent: #0078d4;
  /* ... all T.* tokens as --ar-* variables */
}
```

### Phase 2: Replace T.* in buildCss()

Change all `${T.xyz}` references in `buildCss()` to `var(--ar-xyz)`. The CSS string becomes static (only built once at init).

### Phase 3: Update applyTheme()

Instead of recompiling CSS, `applyTheme()` only updates the CSS custom properties on the shadow host container.

### Phase 4: Handle Badge Inline Styles

The badge uses inline styles with `T.*` values. Convert badge colors to use CSS variables where possible, or update inline styles in `applyTheme()` as before for elements outside CSS class control.

---

## Edge Cases & Error Handling

- Badge is positioned via inline styles (computed values) — keep those inline.
- Elements outside Shadow DOM (element picker highlight/label) use inline styles — these continue to reference `T.*` directly.
- The `T` object remains as the runtime source of truth for JavaScript code that needs color values (e.g., `getModeColor()`).

---

## Scope & Non-Goals

### In Scope
- CSS custom properties for all theme tokens
- Static `buildCss()` (built once, not per theme switch)
- `applyTheme()` updates variables only
- Transition on `color`/`background` for smooth switching

### Out of Scope
- Removing the `T` object entirely (still needed for JS-side color references)
- User-created custom themes
