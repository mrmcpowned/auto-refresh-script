# Feature Spec: Settings Layout Overhaul

## Overview

Restructure the settings modal using **progressive disclosure** combined with **grouped sub-pages** to reduce visual clutter. The default view shows only the most-used items (toggle, interval, watches), with less-used settings hidden behind a "More settings" toggle. Badge-related settings (position, font size, opacity) are merged into a single "Badge Style" sub-page.

---

## Problem Statement

The current settings modal lists 12+ items across 4 section headers in a single vertical scroll. On smaller viewports, the modal overflows without scrolling. Every setting—from frequently-changed Refresh Interval to rarely-touched Badge Opacity—has equal visual weight: Most users interact with 3–4 items but must visually parse all 12 each time they open settings.

---

## User Stories

- As a user opening settings, I want to see only the things I care about (interval, watches) so that the modal feels fast and focused.
- As a user who rarely changes badge appearance, I want those settings hidden until I need them so they don't clutter my primary workflow.
- As a user adjusting badge position, font size, or opacity, I want a single entry point ("Badge Style") that groups all three so I don't hunt through separate menu items.
- As a power user, I want the ability to expand all settings in one click so nothing is truly hidden from me.
- As a user on a small screen, I want the settings modal to fit without overflow.

---

## UX Design

### Default View (Collapsed)

The primary view shows the toggle, the interval picker, and the watches section. A "More settings" link at the bottom reveals the rest.

```
┌──────────────────────────────────────────┐
│  Auto Refresh Settings                   │
│                                          │
│  ● Inactive                              │
│  ┌────────────────────────────────────┐  │
│  │  Auto-Refresh               [OFF]  │  │
│  │  Reload the page on a timer        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ⏱ Refresh Interval          30 seconds  │
│    How often the page reloads            │
│                                          │
│  ─── WATCHES (1) ────────────────────    │
│                                          │
│  👁 Add Watch                            │
│    Pick an element to monitor            │
│  📋 Watch Overview                    2  │
│    All watches across pages              │
│  🔍 Inspect Watches                  1   │
│    View stored vs live content           │
│  🗑 Remove Watches                   1   │
│    Remove individual or all watches      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ⚙ More settings — badge, theme,   │  │
│  │   alerts, hotkey                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Press Alt+Shift+R · v2.1.0              │
└──────────────────────────────────────────┘
```

### Expanded View (More Settings)

Clicking "More settings" reveals the hidden sections inline, below the watches section. The link flips to "▲ Fewer settings".

```
┌──────────────────────────────────────────┐
│  ...toggle, interval, watches as above...│
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ▲ Fewer settings                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ─── BADGE & APPEARANCE ─────────────    │
│                                          │
│  🏷 Badge Style  Bottom Center·Med·100%  │
│    Position, size, and opacity           │
│  🎨 Theme                        Dark   │
│    Choose a visual style                 │
│                                          │
│  ─── GENERAL ────────────────────────    │
│                                          │
│  ⌨ Keyboard Shortcut       Alt+Shift+R  │
│    Hotkey to open this menu              │
│  🔔 Alert Mode                   Beep   │
│    How you are notified of changes       │
│  🌐 Webhook                      None   │
│    Send alerts to external services      │
│                                          │
│  Press Alt+Shift+R · v2.1.0              │
└──────────────────────────────────────────┘
```

### Badge Style Sub-Page

The new "Badge Style" button opens a sub-modal (via `ctx.push('badge-style')`) that groups the three badge appearance settings into a single page.

```
┌──────────────────────────────────────────┐
│  ← Back                                 │
│  Badge Style                             │
│  Customize the countdown badge           │
│                                          │
│  📍 Badge Position         Bottom Center │
│    Where the countdown timer appears     │
│  🔤 Badge Font Size             Medium   │
│    Size of the countdown badge text      │
│  🔲 Badge Opacity                 100%   │
│    Transparency of the countdown badge   │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

Each row in this sub-page opens its existing sub-modal (`position-picker`, `fontsize-picker`, `opacity-picker`) via `ctx.push()`.

### Settings Integration

- **New storage key**: `STORAGE_KEY_SETTINGS_EXPANDED` = `'autoRefreshSettingsExpanded'` — persists the expand/collapse state (boolean, default `false`)
- **No new settings exposed** — this is a layout reorganization of existing settings
- **New modal**: `badge-style` — a thin grouping sub-page, not a new feature

---

## Technical Design

### Data Model

One new storage key:

```javascript
const STORAGE_KEY_SETTINGS_EXPANDED = 'autoRefreshSettingsExpanded';
// Default: false (collapsed)
// Persisted so the user's preference survives page reloads
```

### Core Logic

The `settings` modal `build()` function is restructured:

1. **Always rendered**: Status bar, toggle row, Refresh Interval button, Watches section (with all watch action buttons)
2. **"More settings" link**: A clickable `div` (styled with `ar-more-link` class) toggles a wrapper `div` for the hidden sections
3. **Hidden sections wrapper**: Contains "Badge & Appearance" and "General" sections, initially `display:none` if collapsed
4. **State persistence**: On toggle click, flip the GM value and update `display`
5. **Link text**: `⚙ More settings — badge, theme, alerts, hotkey` when collapsed, `▲ Fewer settings` when expanded

#### Settings modal pseudo-structure:

```javascript
// 1. Status bar + toggle (unchanged)
// 2. Refresh Interval button (moved out of section, no section header)
// 3. Watches section (unchanged)
// 4. "More settings" toggle link
const moreLink = h('div', { class: 'ar-more-link' });
const moreWrapper = h('div');
let expanded = GM_getValue(STORAGE_KEY_SETTINGS_EXPANDED, false);

function updateExpanded() {
    moreWrapper.style.display = expanded ? 'block' : 'none';
    moreLink.textContent = expanded ? '▲ Fewer settings' : '⚙ More settings — badge, theme, alerts, hotkey';
}
moreLink.addEventListener('click', () => {
    expanded = !expanded;
    GM_setValue(STORAGE_KEY_SETTINGS_EXPANDED, expanded);
    updateExpanded();
});

// 5. Inside moreWrapper:
//    - addSection: "Badge & Appearance"
//      - Badge Style button → ctx.push('badge-style')
//      - Theme button → ctx.push('theme-picker')
//    - addSection: "General"
//      - Keyboard Shortcut → ctx.push('hotkey-picker')
//      - Alert Mode → ctx.push('alert-mode-picker')
//      - Webhook → ctx.push('webhook-list')
```

### New Modal: `badge-style`

```javascript
Modal.define('badge-style', {
    title: 'Badge Style',
    subtitle: 'Customize the countdown badge',
    footerText: 'Press Esc to go back',
    build: (panel, ctx) => {
        // Read current values
        // Render 3 buttons: Badge Position, Badge Font Size, Badge Opacity
        // Each pushes its existing sub-modal
    }
});
```

The Badge Style value label in the parent settings modal combines all three: `cornerName · fontLabel · opacityLabel` (e.g. "Bottom Center · Medium · 100%").

### CSS Changes

One new class:

```css
.ar-more-link {
    text-align: center;
    font-size: 12px;
    color: ${T.accent};
    padding: 10px 8px;
    cursor: pointer;
    border: 1px dashed ${T.borderMid};
    border-radius: 6px;
    margin-top: 8px;
    transition: background .15s;
}
.ar-more-link:hover {
    background: ${T.accentFaint};
}
```

### Integration Points

- **Modal framework**: Uses existing `Modal.define()`, `ctx.push()`, `ctx.pop()` — no framework changes needed
- **Existing sub-modals**: `position-picker`, `fontsize-picker`, `opacity-picker`, `theme-picker`, `hotkey-picker`, `alert-mode-picker`, `webhook-list` — all remain unchanged, just re-parented in the layout
- **`addSection()` helper**: Reused for "Badge & Appearance" and "General" section headers within the expanded area. The "Refresh" section header is removed (Interval stands alone below the toggle)
- **`makeOptionBtn()` helper**: Reused for all buttons — no changes needed

### Section Header Separators

Section headers in the expanded area should use the existing `.ar-section-hdr-sep` class (which adds a top border) to visually separate them from the watches section above.

---

## Edge Cases & Error Handling

- **No watches**: When `watchCount === 0`, the watches section shows "No watches configured yet" (unchanged). The "More settings" link still appears below it.
- **Stop Alert button**: The `🔕 Stop Alert` button (conditionally shown when `alertIntervalId !== null`) should remain in the always-visible area, inserted after the Watches section and before the "More settings" link, since it's an urgent action.
- **First-time users**: Default is collapsed. New users see a clean 6-item view. The "More settings" hint text lists what's hidden so nothing feels lost.
- **Persisted expansion**: If a user always expands, the state is saved — they don't need to re-expand every time. The modal always opens in their last-used state.

---

## Scope & Non-Goals

### In Scope
- Restructure settings modal with progressive disclosure (More/Fewer settings toggle)
- Group Badge Position, Font Size, and Opacity into a new `badge-style` sub-page
- Remove the "Refresh" section header (Interval moves to top-level, no header needed)
- Rename "Appearance" section to "Badge & Appearance" in the expanded area
- Add `.ar-more-link` CSS class
- Persist expand/collapse state via `GM_setValue`
- Add separator lines (`.ar-section-hdr-sep`) between expanded sections

### Out of Scope (Future)
- Scroll container for the settings modal (could be added independently)
- Tabbed navigation (different approach, not combined here)
- Inline editing of settings values (dropdowns/sliders replacing sub-modals)
- Two-column grid layout
- Any changes to sub-modal behavior or content
- Animated expand/collapse transitions (keep it simple with display toggle)

---

## Risks & Open Questions

1. **Item count reduction**: The collapsed view goes from 12 items to 6–7 (toggle + interval + 4 watch items + more link). Is that the right cut? Should Alert Mode stay in the primary view since it's watch-related?
2. **Badge Style compound label**: "Bottom Center · Medium · 100%" may be long on narrow modals. Could truncate or show only position.
3. **Section header for watches**: Currently uses `addSection(panel, 'Watches (N)')`. Should this keep the separator line, or should it be a softer visual break since it's always visible?

---

## Implementation Details

**Version**: 2.2.0
**Date**: 2026-04-12
**Action Plan**: [action-plans/settings-layout-overhaul.md](../action-plans/settings-layout-overhaul.md)

### What Was Built
- Progressive disclosure toggle ("More settings" / "Fewer settings") with persistent state via `STORAGE_KEY_SETTINGS_EXPANDED`
- `getBadgeLabels()` helper to deduplicate badge label formatting between `badge-style` modal and settings modal summary
- New `badge-style` sub-page modal grouping Badge Position, Font Size, and Opacity
- Restructured `settings` modal: Interval at top level (no section header), Watches section, "More settings" toggle, hidden wrapper with "Badge & Appearance" and "General" sections
- `.ar-more-link` CSS class with dashed border, accent color, and hover effect
- Section headers use `.ar-section-hdr-sep` for visual separation in the expanded area
- "More settings" link shows hint text ("badge, theme, alerts, hotkey") in dimmed color

### Deviations from Spec
- `updateExpanded()` uses two `<span>` elements for the collapsed link text (main text + dimmed hint) instead of a single text string, enabling per-segment color styling
- Added `getBadgeLabels()` helper (not in spec) during code quality audit to eliminate duplicated formatting logic

### Code Location
| Component | Location |
|-----------|----------|
| `STORAGE_KEY_SETTINGS_EXPANDED` | Line ~167 |
| `.ar-more-link` CSS | Line ~372-373 |
| `getBadgeLabels()` helper | Line ~2106 |
| `badge-style` modal | Line ~2117 |
| `settings` modal (restructured) | Line ~2133 |
| Progressive disclosure toggle | Line ~2234 |
| Hidden sections wrapper | Line ~2253 |

### Screenshots
- [Collapsed view](images/30-collapsed.png)
- [Expanded view](images/30-expanded.png)
- [Badge Style sub-page](images/30-badge-style.png)
