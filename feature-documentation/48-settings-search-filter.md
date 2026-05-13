# Feature Spec: Settings Search / Filter

## Overview

Add a search input at the top of the settings modal that filters visible option buttons as the user types. Power users with many settings can jump directly to any option (e.g., typing "theme" shows only the Theme button) without scrolling through the progressive disclosure sections.

---

## Problem Statement

The settings modal uses progressive disclosure ("More settings") to reduce cognitive load for new users, but power users who know exactly which setting they want must click "More settings" first, then scroll to find it. With 12+ options across 3 sections, this is friction for frequent users.

---

## User Stories

- As a power user, I want to type "webhook" and immediately see the Webhook option without expanding "More settings".
- As a new user, I want the search box to be unobtrusive and not change the default experience if I don't use it.
- As a user switching themes frequently, I want to type "th" and have only the Theme option visible.

---

## UX Design

### Search Input

A compact text input at the top of the settings panel, below the status bar but above the toggle:

```
┌──────────────────────────────────┐
│ Auto Refresh Settings            │
│ ● Active · refreshing every 30s  │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Filter settings...       │ │
│ └──────────────────────────────┘ │
│ ⏱ Refresh Interval        30s   │
│ 🎨 Theme                  Dark   │
│ ...filtered results...           │
└──────────────────────────────────┘
```

### Behavior

- Empty input: normal settings layout (progressive disclosure, sections, toggle — unchanged)
- Non-empty input: hide section headers, hide progressive disclosure link, show ALL options that match, flat list
- Match against: button label text, subtitle text, and current value text
- Case-insensitive substring match
- Clear button (×) or Escape clears the filter and restores normal layout
- The auto-refresh toggle and status bar always remain visible (not filterable)

### Settings Integration

No new Config keys. The search is ephemeral — cleared on modal close.

---

## Technical Design

### Core Logic

In the settings modal `build()` function:
1. Create an `ar-input` search field after the status bar
2. Collect all option buttons into an array after building them
3. On `input` event, filter: hide buttons whose combined text (label + subtitle + value) doesn't contain the query
4. When filtering is active, force-show the `moreWrapper` and hide section headers + the moreLink
5. On clear/empty, restore original display states

### Integration Points

- Settings modal build function only — no changes to other modals or services
- Uses existing `ar-input` CSS class

---

## Edge Cases & Error Handling

- Empty search restores full layout including progressive disclosure state
- Search while "More settings" is collapsed should temporarily show all matches from hidden sections
- Special characters in search text should work (no regex, just substring)

---

## Scope & Non-Goals

### In Scope
- Search input in settings modal
- Substring matching on label/subtitle/value text
- Show/hide buttons based on filter

### Out of Scope (Future)
- Fuzzy matching or typo tolerance
- Search across sub-modals (only top-level settings)
- Persistent search history

---

## Implementation Details

**Version**: 4.2.0
**Date**: 2026-04-14
**Action Plan**: [action-plans/features-48-52.md](../action-plans/features-48-52.md)

### What Was Built
- Search input (r-input) at the top of the settings modal, below the status bar
- Real-time substring filtering on all option button text (label + subtitle + value)
- Section headers and progressive disclosure link are hidden during active search
- Escape in the search field clears the filter; empty input restores normal layout
- `No matching settings'' message when zero buttons match

### Deviations from Spec
- Search input is always visible (no hide/show toggle needed)
- Toggle and status bar are naturally excluded from filtering (never registered as filterable)

### Code Location
| Component | Location |
|-----------|----------|
| I18N keys (filter.*) | Line ~587 |
| Settings search input | Line ~3325 |
| Filter logic (input event) | Line ~3450 |
| CSS classes | Lines 1330-1339 |

### Testing Notes
- Verified: typing `theme'' filters to only Theme button
- Verified: Escape clears filter and restores layout
- Verified: no-results message shows when no matches
- Zero console errors after all interactions

### Screenshots
![Settings Search Filter](images/settings-search-filter.png)
