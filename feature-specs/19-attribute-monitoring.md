# Feature Spec: Attribute & State Monitoring

## Overview

Extend the watch system to monitor HTML attributes (`data-*`, `class`, `src`, `href`, `disabled`, `checked`) and form element states (`value`, `selectedIndex`), beyond just text content and computed styles.

---

## Problem Statement

Many meaningful page changes don't affect visible text or computed CSS:
- A loading spinner hides via `class="hidden"` — no text change occurs
- An image `src` changes to show a different product photo
- A button becomes `disabled` when out of stock
- A `data-status` attribute changes from `"pending"` to `"complete"`
- A dropdown's selected option changes

The current content and style modes miss all of these changes.

---

## User Stories

- As a user, I want to be alerted when a button becomes disabled (stock sold out).
- As a user, I want to watch a `data-price` attribute for real-time price tracking.
- As a user, I want to detect when an image source changes (new product photo).

---

## UX Design

### Fourth Watch Mode

```
┌──────────────────────────────────────────┐
│ What to watch?                           │
│                                          │
│  📝 Text Content                         │
│  🎨 Styling                              │
│  📝🎨 Both                               │
│  🏷 Attributes           ← NEW          │
│     Monitor HTML attributes and state    │
└──────────────────────────────────────────┘
```

### Attribute Selection

After choosing Attributes mode:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Select Attributes to Watch               │
│ Choose which attributes to monitor       │
│                                          │
│  DETECTED ATTRIBUTES                     │
│  [✓] class = "product-card active"       │
│  [✓] data-price = "49.99"              │
│  [ ] data-sku = "ABC123"               │
│  [ ] id = "product-1"                  │
│                                          │
│  ELEMENT STATE                           │
│  [ ] disabled = false                   │
│  [ ] hidden = false                     │
│                                          │
│  [ Watch Selected (2) ]                  │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

Shows all current attributes on the selected element. User picks which ones to monitor.

### Watch Inspector for Attributes

```
Attributes ⚠ CHANGED
┌───────────────────────────────────┐
│  class: "active" → "active sold"  │
│  data-price: "49.99" → "39.99"   │
│  disabled: false → true  ← NEW   │
└───────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Select Attributes mode | Shows all current attributes on element for selection |
| Attribute changes between refreshes | Alert fires; inspector shows old → new value |
| Attribute removed | Shown as `data-price: "49.99" → (removed)` |
| New attribute added | Shown as `aria-busy: (new) → "true"` |
| Class attribute changes | Shows full class string diff |
| Element has no custom attributes | Only standard attributes (id, class, etc.) listed |
| Form element selected | Additional state properties shown (value, checked, disabled) |

---

## Technical Notes

### Attribute Snapshot

```javascript
function captureAttributes(el, watchedAttrs) {
    const attrs = {};
    for (const name of watchedAttrs) {
        if (name === 'disabled' || name === 'checked' || name === 'hidden') {
            attrs[name] = el[name]; // boolean properties
        } else if (name === 'value') {
            attrs[name] = el.value;
        } else {
            attrs[name] = el.getAttribute(name);
        }
    }
    return attrs;
}

function diffAttributes(oldAttrs, newAttrs) {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]);
    for (const key of allKeys) {
        const oldVal = oldAttrs[key] ?? '(missing)';
        const newVal = newAttrs[key] ?? '(removed)';
        if (String(oldVal) !== String(newVal)) {
            changes.push({ attr: key, old: oldVal, new: newVal });
        }
    }
    return changes;
}
```

### Data Model

```javascript
{
    selector: '#product-1',
    mode: 'attributes',
    watchedAttrs: ['class', 'data-price', 'disabled'],
    snapshot: {
        attributes: { class: 'product-card active', 'data-price': '49.99', disabled: false },
        timestamp: 1712793600000
    }
}
```

### Storage

No new storage keys. Mode `'attributes'` and `watchedAttrs` array stored in watch object.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rapid class changes (animations) cause false alerts | Medium | Option to ignore `class` attribute; or use class diff (added/removed classes only) |
| Too many attributes on complex elements | Low | User selects which to watch; not all-or-nothing |
| Form value tracking across page state | Low | Value captured at check time; works for static pages |
