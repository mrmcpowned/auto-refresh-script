# Feature Spec: Watch Expressions (JavaScript Evaluation)

## Overview

Allow users to define custom JavaScript expressions that are evaluated against watched element content on each refresh. Enables conditional alerting based on computed logic — e.g., "alert when the number exceeds 500" or "alert when the text contains 'sold out'."

---

## Problem Statement

Current watch modes detect *any* change, but users often only care about *specific* changes: a price dropping below a threshold, a status becoming "available," or a number exceeding a limit. Without expression support, users get alert fatigue from irrelevant changes.

---

## User Stories

- As a shopper, I want to be alerted only when a product price drops below $50.
- As a DevOps engineer, I want notification only when an error count exceeds a threshold.
- As a job seeker, I want an alert when a listing contains "remote" in its text.

---

## UX Design

### Expression Field in Watch Config

When adding/editing a watch, a new optional field:

```
┌──────────────────────────────────────┐
│ Watch Expression (optional)          │
│ ┌──────────────────────────────────┐ │
│ │ parseFloat(value) < 50           │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Available variables:                 │
│   value  — current text content      │
│   prev   — previous text content     │
│   changed — boolean (content changed)│
│                                      │
│ Examples:                            │
│   value.includes('In Stock')         │
│   parseFloat(value) < prev           │
│   changed && value.length > 100      │
│                                      │
│ ⚠ Expression errors are silently     │
│   treated as false.                  │
└──────────────────────────────────────┘
```

### Inspector Display

```
┌──────────────────────────────────────┐
│ #price-display                       │
│ Status: Expression NOT met           │
│ Expression: parseFloat(value) < 50   │
│ Current value: $62.99                │
│ Last eval: false                     │
└──────────────────────────────────────┘
```

When expression evaluates to `true`:

```
│ Status: 🔔 Expression TRIGGERED      │
│ Expression: parseFloat(value) < 50   │
│ Current value: $42.50                │
│ Last eval: true                      │
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Enter valid expression | Evaluated on each refresh; alert only on `true` |
| Enter invalid expression | Treated as `false`; no crash; logged in console |
| Leave blank | Behaves like normal watch (any change triggers) |
| Expression returns truthy non-boolean | Treated as `true` |
| Expression accesses DOM or window | Blocked — only `value`, `prev`, `changed` in scope |
| Toggle expression on/off | Checkbox to bypass without deleting |

---

## Technical Notes

### Safe Evaluation

```javascript
function evaluateWatchExpression(expression, currentText, previousText, hasChanged) {
    if (!expression || !expression.trim()) return null; // no expression = normal mode

    try {
        // Create sandboxed function with only allowed variables
        const fn = new Function('value', 'prev', 'changed',
            `"use strict"; return (${expression});`
        );
        return !!fn(currentText, previousText, hasChanged);
    } catch (e) {
        console.warn('[Auto-Refresh] Watch expression error:', e.message);
        return false;
    }
}
```

### Integration with Watch Loop

```javascript
// In the existing change detection logic:
const hasChanged = currentContent !== watch.snapshot;
const exprResult = evaluateWatchExpression(
    watch.expression, currentContent, watch.snapshot, hasChanged
);

if (exprResult === null) {
    // No expression — use normal change detection
    if (hasChanged) triggerAlert(watch);
} else if (exprResult === true) {
    triggerAlert(watch);
}
```

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `watches[].expression` | `string` | JavaScript expression string |
| `watches[].expressionEnabled` | `boolean` | Whether expression is active |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Code injection via expression | Medium | Strict sandboxed `new Function` with fixed params only; no DOM/window access |
| Infinite loop in expression | Medium | Wrap in try/catch; expression is a single return statement |
| Performance with complex expressions | Low | Expressions run once per refresh (~seconds apart) |
| User confusion with syntax errors | Low | Show last eval result in inspector; log errors to console |
