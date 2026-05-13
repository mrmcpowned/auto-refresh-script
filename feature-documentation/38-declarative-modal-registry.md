# Feature Spec: Declarative Modal Registry

## Overview

Convert the remaining imperative modal definitions to use the existing `type:'picker'` declarative pattern, and introduce a new `type:'form'` declarative pattern for complex modals. The modal definitions section (~1,600 lines) is the single largest section in the codebase; converting repetitive picker-style modals to declarative definitions will eliminate significant boilerplate.

---

## Problem Statement

Only 2 of 15+ modals (`tts-speed-picker`, `tts-volume-picker`) use the declarative `type:'picker'` pattern. The remaining modals use imperative `build()` functions with repeated patterns: iterating over options arrays, calling `makeOptionBtn()`, handling `Config.set()`, calling `Modal.open()` or `Modal.pop()`, and showing toasts. This repetition increases maintenance burden and makes it easy to introduce inconsistencies.

---

## User Stories

- As a developer maintaining the codebase, I want picker modals to be defined as data so that adding a new picker requires minimal code.
- As a developer, I want a consistent pattern for all option-selection modals so that behavior is predictable.
- As a developer, I want to reduce the modal definitions section from ~1,600 lines to ~800 lines.

---

## UX Design

No user-facing UX changes. All modals should behave identically to their current imperative versions.

---

## Technical Design

### Modals to Convert to `type:'picker'`

These modals follow the exact same pattern — iterate options, show active state, select → config set → navigate → toast:

1. **`fontsize-picker`** — 4 options, includes a badge preview per option
2. **`theme-picker`** — 4 options, includes a live badge preview per option  
3. **`position-picker`** — 6 options in a grid layout
4. **`interval-picker`** — grouped presets + custom input
5. **`alert-mode-picker`** — 3 options + conditional speech settings section
6. **`language-picker`** — dynamic list from LANGUAGE_OPTIONS

### Picker Enhancement: Support for `renderOption` Override

For modals like `fontsize-picker` and `theme-picker` that add custom preview elements to each button, extend the picker auto-build to accept an optional `renderOption(btn, option)` callback that can append extra content to each button.

### Picker Enhancement: Support for `layout:'grid'`

For `position-picker`, add a `layout:'grid'` option to the picker type that wraps options in an `ar-grid` container and adds the `ar-grid-btn` class.

### Modals That Stay Imperative

These are too complex for a simple picker pattern and should remain imperative:
- `hotkey-picker` — custom key capture UI
- `tts-voice-picker` — dynamic voice list with language grouping
- `webhook-list` — list with inline toggles
- `webhook-edit` — multi-field form
- `watch-inspector` — split-pane layout
- `watch-overview` — domain grouping with toggle
- `watch-mode` — selector preview + mode selection
- `badge-menu` — status bar + conditional actions
- `settings` — complex hub with progressive disclosure
- `clear-watch` — dynamic list with remove actions

### Implementation

Extend `Modal.define()` auto-build to handle:

```javascript
// Enhanced picker with renderOption
Modal.define('fontsize-picker', {
    type: 'picker',
    title: () => t('fontSize.title'),
    subtitle: () => t('fontSize.subtitle'),
    current: () => Config.get('fontSize'),
    options: () => [
        { key: 'small', label: t('fontSize.small') },
        { key: 'medium', label: t('fontSize.medium') },
        { key: 'large', label: t('fontSize.large') },
        { key: 'extra-large', label: t('fontSize.extraLarge') }
    ],
    onSelect: (key, label) => {
        Config.set('fontSize', key);
        applyFontSize();
    },
    returnTo: 'settings',
    toastTemplate: () => t('toast.fontSizeSet', { label: '{label}' }),
    renderOption: (btn, { key }) => {
        btn.appendChild(h('div', {
            text: '↻ 30s',
            style: `font:bold ${FONT_SIZES[key]} monospace;color:${v('ok')};margin-top:4px;opacity:0.6`
        }));
    }
});
```

### Auto-Build Enhancements

```javascript
if (def.type === 'picker' && !def.build) {
    def.build = (panel) => {
        const current = def.current();
        const options = typeof def.options === 'function' ? def.options() : def.options;
        const toast = typeof def.toastTemplate === 'function' ? def.toastTemplate() : def.toastTemplate;
        const container = def.layout === 'grid' ? h('div', { class: 'ar-grid' }) : panel;

        options.forEach(({ key, label, subtitle: sub }) => {
            const btn = makeOptionBtn(label, key === current, () => {
                def.onSelect(key, label);
                if (def.returnTo) Modal.open(def.returnTo);
                if (toast) showToast(toast.replace('{label}', label));
            }, sub ? { subtitle: sub } : {});
            if (def.layout === 'grid') btn.classList.add('ar-grid-btn');
            if (def.renderOption) def.renderOption(btn, { key, label });
            container.appendChild(btn);
        });

        if (def.layout === 'grid') panel.appendChild(container);
    };
}
```

---

## Edge Cases & Error Handling

- `renderOption` is optional; omitting it preserves default behavior
- `layout:'grid'` only affects container wrapping; individual button behavior unchanged
- Existing `type:'picker'` modals (tts-speed, tts-volume) continue to work unchanged

---

## Scope & Non-Goals

### In Scope
- Extending picker auto-build with `renderOption` and `layout:'grid'`
- Converting `fontsize-picker`, `theme-picker`, `position-picker`, `language-picker` to declarative
- Verifying all converted modals behave identically

### Out of Scope (Future)
- Creating a `type:'form'` pattern for complex modals like webhook-edit
- Converting imperative modals that require custom layouts
- `interval-picker` conversion (has grouped sections + custom input — too complex for simple picker)
- `alert-mode-picker` conversion (has conditional speech settings section)

---

## Risks & Open Questions

1. `theme-picker` has complex per-option preview logic — may need verification that `renderOption` is flexible enough
2. `position-picker` uses a 3-column grid — verify `ar-grid` class works correctly with declarative layout
