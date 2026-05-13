# Feature Spec: Multi-Element Watch (Selector Groups)

## Overview

Allow a single watch to target multiple elements via `querySelectorAll`, monitoring all matches and alerting when any one of them changes.

---

## Problem Statement

Currently, each watch tracks exactly one element via `querySelector` (first match). For pages with repeated structures (product grids, table rows, feed items), users must create individual watches for each element — tedious and unscalable.

---

## User Stories

- As a user monitoring a product listing page, I want one watch on all `.price` elements.
- As a user watching a table, I want to detect when any row's status cell changes.
- As a user, I want to see which of the N matched elements changed.

---

## UX Design

### Element Picker Enhancement

After picking an element, the mode selection modal shows a match count:

```
┌──────────────────────────────────────────┐
│ What to watch?                           │
│                                          │
│  .product-price                          │
│  Matches 12 elements on this page        │
│                                          │
│  SCOPE                                   │
│  (●) Watch all 12 matches               │
│  ( ) Watch only this element (#product-3)│
│                                          │
│  📝 Text Content                         │
│  🎨 Styling                              │
│  📝🎨 Both                               │
└──────────────────────────────────────────┘
```

### Watch Inspector

Multi-element watches show a summary:

```
┌───────────────────────────────────────┐
│  .product-price (12 elements)         │
│  📝 Text Content                      │
│  ⚠ 2 of 12 changed                   │
│                                       │
│  ▼ Changed Elements                   │
│    [3] $49.99 → $39.99               │
│    [8] $129.00 → $99.00              │
│                                       │
│  ▶ Unchanged (10)                     │
└───────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Selector matches 1 element | "Watch only this element" is preselected; single-element mode |
| Selector matches N elements | Shows count; user chooses scope |
| "Watch all" selected | Snapshots captured for all N elements |
| 2 of 12 change | Alert fires; inspector shows which 2 changed |
| Elements added to page (now 13) | New element has no snapshot; marked as "new" |
| Elements removed (now 11) | Missing element noted in inspector |
| All unchanged | Status green; "All 12 elements unchanged" |

---

## Technical Notes

### Data Model Change

```javascript
{
    selector: '.product-price',
    mode: 'content',
    multi: true,  // new: indicates querySelectorAll mode
    snapshots: [  // array instead of single snapshot
        { index: 0, content: '$49.99', timestamp: ... },
        { index: 1, content: '$59.99', timestamp: ... },
        // ...
    ]
}
```

### Change Detection

```javascript
function checkMultiWatch(watch) {
    const elements = document.querySelectorAll(watch.selector);
    const changes = [];

    elements.forEach((el, i) => {
        const snap = watch.snapshots[i];
        const current = el.innerText.trim();
        if (snap && snap.content !== current) {
            changes.push({ index: i, old: snap.content, new: current });
        }
    });

    return changes;
}
```

### Storage

No new keys. `multi` flag and `snapshots` array stored within watch object.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large number of matches (100+) bloats storage | Medium | Cap at 50 elements; warn if selector matches too many |
| Index-based matching breaks when DOM order changes | Medium | Track by content hash or nth-child refinement |
| Performance with many elements | Low | DOM queries are fast; compare only on refresh cycle |
