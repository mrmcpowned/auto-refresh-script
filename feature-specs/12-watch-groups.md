# Feature Spec: Watch Groups & Tagging

## Overview

Organize watches into named groups (e.g., "Prices", "Status", "Content") with the ability to enable/disable, alert, and inspect groups independently.

---

## Problem Statement

Users monitoring complex pages may have 10+ watches covering different concerns. Currently, all watches are a flat list with no organization. This makes it hard to:
- Quickly find a specific watch among many
- Disable a set of related watches without removing them
- See at a glance which *category* of content changed
- Apply different alert settings to different sets of watches

---

## User Stories

- As a user monitoring a store page, I want to group watches into "Prices", "Availability", and "Reviews."
- As a user, I want to temporarily disable all "Layout" watches without removing them.
- As a user with many watches, I want the inspector organized by group.

---

## UX Design

### Watch Mode Selection Enhancement

After selecting an element and mode, optional group assignment:

```
┌──────────────────────────────────────────┐
│ Assign to Group (optional)               │
│                                          │
│  [ Prices     ]  [+ New Group ]          │
│  [ Status     ]                          │
│  [ Ungrouped  ]  ← default              │
│                                          │
│  [ Skip ]                                │
└──────────────────────────────────────────┘
```

### Watch Inspector Enhancement

Groups appear as collapsible headers in the sidebar:

```
┌──────────────────────────┐
│  ▼ Prices (3)        🟢  │   ← green = no changes
│    #price-main           │
│    #price-sale           │
│    .shipping-cost        │
│  ▼ Status (2)        🔴  │   ← red = has changes
│    .status-badge         │
│    #uptime               │
│  ▶ Ungrouped (1)     🟢  │
└──────────────────────────┘
```

### Group Context Menu (Long-Press or Right-Click)

```
Disable Group     → all watches in group paused
Enable Group      → all watches in group active
Re-snapshot Group  → all watches re-snapshotted
Remove Group       → removes group and all watches in it
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Add watch without group | Assigned to "Ungrouped" |
| Create new group | Text input; group created with the new watch |
| Disable a group | Watches remain but stop being checked; grey in inspector |
| Enable a group | Watches resume checking on next cycle |
| Remove a group | Confirmation: "Remove group 'Prices' and 3 watches?" |
| Rename a group | Double-click group header → inline text edit |
| Group has changes | Group header shows red dot; expanding shows which watches changed |
| All groups disabled | No watches checked; badge shows no watch dot |

---

## Technical Notes

### Data Model Change

```javascript
{
    selector: '#price-main',
    mode: 'content',
    group: 'Prices',     // new field; default: 'Ungrouped'
    disabled: false,      // new field; group-level disable sets this on all members
    snapshot: { ... }
}
```

### Group Operations

```javascript
function disableGroup(groupName) {
    const watches = getWatches();
    watches.filter(w => w.group === groupName).forEach(w => w.disabled = true);
    setWatches(watches);
}

function getGroups() {
    const watches = getWatches();
    const groups = {};
    watches.forEach(w => {
        const g = w.group || 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(w);
    });
    return groups;
}
```

### Storage

No new storage keys. Group name stored within each watch object.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Too many groups clutters UI | Low | Collapsible headers; groups only shown if >1 watch or >1 group |
| Group name conflicts | Low | Case-insensitive matching; trim whitespace |
| Disabled watches still consume storage | Very Low | Disabled flag is a boolean; negligible |
