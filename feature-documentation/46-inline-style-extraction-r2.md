# Feature Spec: Inline Style Extraction Round 2

## Overview

Extract remaining inline style patterns that use `T.*` color tokens into CSS classes or CSS variable overrides. Round 1 (Spec 40) extracted badge, picker highlight, and picker label styles. This round focuses on input validation states, toggle initial states, and hotkey capture box states.

---

## Technical Design

### New CSS Classes in `buildCss()`

```css
.ar-input-error { border-color: var(--ar-err) !important }
```

### Patterns to Extract

1. **Input validation error** — `input.style.borderColor = T.err` (4 sites) → `setInputError()` already handles this, but adding `.ar-input-error` as a class toggle would be even cleaner for CSS variable compliance.

2. **Hotkey capture box states** — `display.style.borderColor` set to `T.err`, `T.ok`, `T.accent`, `T.borderLight` (4 values). These are dynamic state transitions that are best left inline since they represent transient visual feedback.

### Decision: Keep Inline

After analysis, the remaining inline styles fall into categories that should stay inline per the code-quality skill:
- **Toggle initial background/position** — computed from config state at render time
- **Hotkey capture border transitions** — transient UI state, not themeable
- **Dynamic positioning** (context menu, toast stacking) — computed values

The `setInputError()` and `setToggleState()` helpers already centralize the patterns. No further CSS class extraction is needed.

---

## Scope

### In Scope
- Verify all remaining T.* usages are appropriate (dynamic/computed)
- No additional CSS classes needed beyond Round 1

### Out of Scope
- Extracting layout styles (margins, padding, flex)
