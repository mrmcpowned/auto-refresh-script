# Feature Spec: Conditional Watch Rules

## Overview

Allow users to define conditions that filter when a watch triggers an alert, reducing noise from irrelevant changes and enabling monitoring for specific content states.

---

## Problem Statement

Currently, any change to a watched element triggers an alert. This creates false positives in several real-world scenarios:
- A timestamp element that updates every refresh (user only cares about the actual content, not the time)
- A price tracker where the user only wants alerts when the price drops below a threshold
- A status page where the user wants an alert only when status changes to "Down" (not "Maintenance" → "Operational")
- An element that has minor whitespace or formatting changes the user doesn't care about

---

## User Stories

- As a user monitoring a price, I want to be alerted only when the price is below $50.
- As a user watching a status indicator, I want to be alerted only when the text contains "error" or "down."
- As a user watching a dashboard, I want to ignore changes that are just timestamp updates.
- As a user watching a live feed, I want to be alerted only when new content contains a specific keyword.

---

## UX Design

### Element Picker Enhancement

After selecting an element and choosing a watch mode, a new optional step appears:

```
┌──────────────────────────────────────────┐
│ What to watch?                           │
│ Choose what changes to monitor           │
│                                          │
│  #price-display                          │
│                                          │
│  ┌── 📝 Text Content ───────────────┐   │
│  │  Alert when text changes          │   │
│  └───────────────────────────────────┘   │
│  ┌── 🎨 Styling ────────────────────┐   │
│  │  Alert when CSS properties change │   │
│  └───────────────────────────────────┘   │
│  ┌── 📝🎨 Both ─────────────────────┐   │
│  │  Monitor both text and styling    │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ← Pick again                            │
│  Press Esc to cancel                     │
└──────────────────────────────────────────┘
```

After clicking a mode, a new optional screen appears:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Alert Condition (optional)               │
│ Only alert when a condition is met       │
│                                          │
│  ┌── Always ✓ ───────────────────────┐   │
│  │  Alert on any change (default)    │   │
│  └───────────────────────────────────┘   │
│  ┌── Contains ───────────────────────┐   │
│  │  Alert when content includes...   │   │
│  │  [ keyword or phrase        ]     │   │
│  └───────────────────────────────────┘   │
│  ┌── Does Not Contain ───────────────┐   │
│  │  Alert when content stops having..│   │
│  │  [ keyword or phrase        ]     │   │
│  └───────────────────────────────────┘   │
│  ┌── Matches Pattern ────────────────┐   │
│  │  Alert when content matches regex │   │
│  │  [ /pattern/flags           ]     │   │
│  └───────────────────────────────────┘   │
│                                          │
│  [ Skip — watch all changes ]            │
│  Press Esc to cancel                     │
└──────────────────────────────────────────┘
```

### Watch Inspector Enhancement

Watches with conditions show a condition badge:

```
┌──────────────────────────────────────┐
│  #price-display                      │
│  📝 Text Content                     │
│  🔎 Contains: "out of stock"         │   ← condition badge
│  🔄 Re-snapshot  🗑 Remove           │
└──────────────────────────────────────┘
```

### Remove Watch Modal Enhancement

Watches with conditions show the condition inline:

```
● #price-display  📝 Text  🔎 "out of stock"
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| User selects "Always" | Standard behavior — any change triggers alert |
| User selects "Contains" + enters "error" | Alert fires ONLY when new content contains "error" (case-insensitive) |
| User selects "Does Not Contain" + enters "OK" | Alert fires when "OK" is no longer in the content |
| User selects "Matches Pattern" + enters invalid regex | Validation error shown inline: "Invalid pattern" |
| User clicks "Skip" | Same as selecting "Always" |
| Content changes but condition not met | Watch status shows `ok` (green); no alert; internal note: "Changed but condition unmet" |
| Content unchanged | Watch status shows `ok`; no evaluation needed |
| Element missing | Alert fires regardless of condition (missing is always critical) |
| Condition text is empty | Treated as "Always" (no filtering) |

---

## Technical Notes

### Data Model Change

```javascript
{
    selector: '#price-display',
    mode: 'content',
    condition: {
        type: 'contains',        // 'always' | 'contains' | 'not_contains' | 'regex'
        value: 'out of stock'    // string or regex pattern
    },
    snapshot: { content: '$49.99', styles: {}, timestamp: 1712793600000 }
}
```

Default: `condition: { type: 'always', value: '' }`

### Evaluation Logic

Modify `checkForChanges()`:

```javascript
function evaluateCondition(watch, newContent) {
    const cond = watch.condition || { type: 'always' };
    if (cond.type === 'always') return true;

    const content = newContent.toLowerCase();
    const value = (cond.value || '').toLowerCase();

    switch (cond.type) {
        case 'contains':
            return content.includes(value);
        case 'not_contains':
            return !content.includes(value);
        case 'regex':
            try {
                return new RegExp(cond.value, 'i').test(newContent);
            } catch {
                return true; // invalid regex = treat as always
            }
        default:
            return true;
    }
}

// In checkForChanges(), after detecting content changed:
if (contentChanged && evaluateCondition(watch, newContent)) {
    // trigger alert
} else if (contentChanged) {
    // content changed but condition not met — update snapshot silently
    watch.snapshot.content = newContent;
    watch.snapshot.timestamp = Date.now();
    setWatches(watches);
}
```

### Key Design Decisions

1. **Conditions apply to new content, not the diff.** "Contains 'error'" checks if the new content has "error", not whether "error" appeared in the diff. This is simpler and more intuitive.

2. **Silent snapshot update when condition unmet.** If content changes but the condition isn't met, the snapshot updates silently. This prevents the same change from being re-evaluated on every refresh cycle.

3. **Conditions only apply to content mode.** Style changes are binary (changed or not) and don't benefit from text-based conditions. For style watches, condition is always "always."

4. **Case-insensitive by default.** Contains/not-contains comparisons are case-insensitive. Regex gets its own flags.

### UI Implementation

The condition picker is a new modal in the Add Watch flow:
1. User picks element → mode picker modal
2. User picks mode → **condition picker modal** (new)
3. User picks condition (or skips) → watch added

The condition picker uses the same `openModal()` + `makeOptionBtn()` pattern. The "Contains" and "Does Not Contain" options expand to show an inline text input when selected.

### Regex Safety

```javascript
function isValidRegex(pattern) {
    try {
        new RegExp(pattern);
        return true;
    } catch {
        return false;
    }
}
```

User input is validated before saving. Invalid regex shows inline error. Regex is evaluated with a timeout guard isn't needed since `RegExp.test()` on short strings is effectively instant.

### Storage

No new storage keys. Condition is stored within the watch object in the existing `ar_watches_*` key.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| ReDoS from malicious regex | Low | Content is short (truncated to 10KB for matching); userscript runs locally |
| User confusion about condition scope | Medium | Clear labeling: "Alert when **new content** contains..." |
| Condition unmet → silent update loses change | Medium | History feature (spec 01) records changes even when condition unmet |
| Adding complexity to Add Watch flow | Medium | "Skip" button prominent; condition step entirely optional |

### Accessibility

- Condition badge in inspector uses descriptive text (not just icon)
- Input fields have placeholder text explaining expected format
- Regex validation errors are inline, not modal/toast (immediate feedback)
