# Feature Spec: Declarative Modal Definitions

## Overview

Reduce modal definition boilerplate by enhancing `Modal.define()` with declarative options for common patterns: option lists, navigation targets, toggle switches, and section groups. Simple modals that are currently 20-40 lines of imperative `h()` calls become 5-10 lines of config.

---

## Problem Statement

12 modal definitions account for ~1,400 lines. Many share identical patterns: list of options where one is active (interval-picker, position-picker, font-size-picker, theme-picker, alert-mode-picker). Each manually constructs buttons, handles click → set value → navigate back → show toast. Adding a new picker modal means copying ~30 lines of boilerplate.

---

## User Stories

- As a developer, I want to define a simple picker modal in 10 lines of config.
- As a developer, I want the modal framework to handle the set-value → toast → navigate-back pattern automatically.
- As a developer, I want complex modals (watch-inspector, webhook-edit) to remain fully custom.

---

## Technical Design

### Enhanced Modal.define() Options

```javascript
Modal.define('fontsize-picker', {
  title: 'Badge Font Size',
  subtitle: 'Size of the countdown badge text',
  type: 'picker',                    // NEW: enables declarative mode
  current: () => Config.get('fontSize'),
  options: [
    { key: 'small', label: 'Small' },
    { key: 'medium', label: 'Medium' },
    { key: 'large', label: 'Large' },
    { key: 'extra-large', label: 'Extra Large' },
  ],
  onSelect: (key, label) => {
    Config.set('fontSize', key);
    applyFontSize();
  },
  returnTo: 'settings',
  toastTemplate: 'Font size set to {label}',
});
```

### How `type: 'picker'` Works

When `type === 'picker'`, `Modal.define()` auto-generates a `build` function that:
1. Calls `current()` to get the active value
2. Renders each option as `makeOptionBtn()` with active state
3. On click: calls `onSelect(key, label)`, navigates to `returnTo`, shows toast

### Modals Eligible for Declarative Conversion

| Modal | Type | Savings |
|-------|------|---------|
| fontsize-picker | picker | ~20 lines |
| position-picker | picker (grid) | ~15 lines |
| interval-picker | grouped picker + custom | ~25 lines |  
| theme-picker | picker + preview | Partial (preview stays custom) |
| tts-speed-picker | picker | ~15 lines |
| tts-volume-picker | picker | ~15 lines |

### Modals That Stay Custom

- watch-inspector (split layout, sidebar, detail pane)
- webhook-edit (form with inputs, validation)
- webhook-list (dynamic list with toggles)
- hotkey-picker (capture-mode interaction)
- settings (hub with sections, progressive disclosure)
- badge-menu (context-dependent quick actions)
- watch-overview (dynamic list with domain grouping)
- watch-mode (depends on element picker context)
- alert-mode-picker (conditional TTS section)

---

## Scope & Non-Goals

### In Scope
- `type: 'picker'` in Modal.define() for simple option lists
- Auto-generated build function for picker modals
- Convert 4-6 simple picker modals to declarative format
- Complex modals remain unchanged

### Out of Scope
- Declarative form builders (for webhook-edit)
- Declarative list views (for watch-overview)
- Modal schema validation
