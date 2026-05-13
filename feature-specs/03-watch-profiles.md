# Feature Spec: Watch Profiles & Multi-Site Configuration

## Overview

Allow users to save, name, and switch between sets of watch configurations ("profiles") for different monitoring scenarios on the same or different sites.

---

## Problem Statement

Watches are currently stored per URL origin+pathname. Users who monitor the same page for different purposes (e.g., "check for new comments" vs "check for price drops") must manually add/remove watches each time. There's no way to:
- Save a set of watches for later reuse
- Quickly switch between monitoring different elements on the same page
- Share watch configurations across similar pages
- Back up or restore watch setups after accidental deletion

---

## User Stories

- As a user who monitors a dashboard for different KPIs at different times, I want to switch between "Sales" and "Inventory" watch profiles without re-picking elements each time.
- As a user who accidentally cleared all watches, I want to restore from a saved profile.
- As a user who monitors similar pages (e.g., product pages with the same layout), I want to apply the same watch profile across URLs.

---

## UX Design

### Settings Integration

New option in WATCHES section:

```
WATCHES (3)
👁  Add Watch          Pick an element to monitor
📂 Watch Profiles      3 saved
    Save and switch between watch configurations
🔍 Inspect Watches    3
🗑  Remove Watches    3
```

### Profile Manager Sub-Modal

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Watch Profiles                           │
│ Save and switch between configurations   │
│                                          │
│ ┌── Current ─────────────────────────┐   │
│ │  3 watches · unsaved changes       │   │
│ │  [ 💾 Save as New Profile ]        │   │
│ └────────────────────────────────────┘   │
│                                          │
│ SAVED PROFILES                           │
│                                          │
│ ┌── Sales Dashboard ─────────────────┐   │
│ │  5 watches · saved 2h ago          │   │
│ │  [ Load ]  [ 🗑 Delete ]           │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌── Price Monitor ───────────────────┐   │
│ │  2 watches · saved 1d ago          │   │
│ │  [ Load ]  [ 🗑 Delete ]           │   │
│ └────────────────────────────────────┘   │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Save Flow

1. User clicks "💾 Save as New Profile"
2. Text input appears: "Profile name:"
3. User types a name (e.g., "Sales Dashboard")
4. Press Enter or click Save
5. Toast: "Profile 'Sales Dashboard' saved (3 watches)"

### Load Flow

1. User clicks "Load" on a saved profile
2. Confirmation: "Replace current watches with 'Sales Dashboard'? (5 watches)"
   - Two buttons: "Replace" (destructive red) / "Merge" (neutral) / "Cancel"
3. **Replace**: Clears current watches, loads profile's watches, re-snapshots all
4. **Merge**: Adds profile's watches to current set (skips duplicates by selector)
5. Toast: "Loaded 'Sales Dashboard' (5 watches)"

### Delete Flow

1. User clicks 🗑 on a profile
2. Profile removed immediately with toast: "Profile 'Sales Dashboard' deleted"
3. No confirmation (profiles are easily re-created)

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Save with no watches active | Toast: "No watches to save" |
| Save with duplicate name | Overwrites existing profile with confirmation: "Update 'Sales Dashboard'?" |
| Load profile with missing elements | Watches added but marked as `missing` on next check; user sees status in inspector |
| Load profile on different URL | Works — selectors are applied to current page's DOM |
| Merge with duplicate selectors | Duplicates silently skipped; toast shows "Loaded N new watches (M skipped)" |
| Delete all profiles | Section shows "No saved profiles" message |
| Profile name empty | Validation: "Profile name required" |
| Profile name very long | Truncated to 30 characters |

---

## Technical Notes

### Data Model

```javascript
// Stored globally (not per-URL) so profiles can be used across sites
GM_getValue('ar_profiles', [])

// Profile structure:
{
    name: 'Sales Dashboard',
    watches: [
        { selector: '#revenue', mode: 'content' },
        { selector: '.kpi-card:nth-child(2)', mode: 'both' },
        // Note: snapshots NOT included — re-captured on load
    ],
    createdAt: 1712793600000,
    updatedAt: 1712793600000
}
```

### Key Design Decisions

1. **Profiles don't store snapshots** — Snapshots are page-specific and time-sensitive. When loading a profile, all watches are re-snapshotted against the current page. This means profiles are portable across URLs.

2. **Profiles are global, not per-URL** — This is the key differentiator from the existing per-URL watch storage. A "Price Monitor" profile created on one product page can be loaded on another.

3. **Load = Re-snapshot** — After loading, each watch's element is queried and snapshotted. Missing elements get `status: 'missing'` and show up as grey in the inspector.

### Storage Considerations

- Each profile stores only selectors and modes (~50 bytes per watch)
- 10 profiles × 10 watches = ~5KB — negligible
- Profiles stored under a separate key (`ar_profiles`) to avoid conflicts

### Implementation Points

1. **New sub-modal**: `openProfileManager()` — follows existing modal patterns
2. **Save**: Deep-clone current watches array, strip snapshots, add to profiles array
3. **Load (Replace)**: `setWatches([])`, then for each profile watch: `addWatch(selector, mode)`, trigger `checkForChanges()` to populate initial snapshots
4. **Load (Merge)**: Filter out watches whose selectors already exist, add remaining
5. **Profile CRUD**: Standard array operations on the `ar_profiles` GM value

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| User loads profile on wrong page (selectors don't match) | Low | Watches appear as `missing` — not destructive, easily removed |
| Profile storage grows large | Very Low | Profiles are tiny (~50 bytes/watch); no snapshots stored |
| Name collisions | Low | Simple duplicate detection and overwrite confirmation |
| Lost watches on Replace | Medium | Confirmation dialog with option to Merge instead; consider "auto-save current before replacing" |
