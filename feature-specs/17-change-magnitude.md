# Feature Spec: Change Magnitude Scoring & Smart Filtering

## Overview

Score each detected change by its magnitude (how much changed), allowing users to set thresholds that filter out insignificant changes — like single-character timestamp updates or minor whitespace shifts.

---

## Problem Statement

Not all changes are equal. A price dropping $50 is significant; a timestamp ticking forward 1 second is noise. Currently, any change (even 1 character) triggers the same alert, leading to:
- Alert fatigue from trivial changes
- Users disabling watches that would otherwise be useful
- No way to express "alert me only if something substantial changed"

---

## User Stories

- As a user watching a page with timestamps, I want to ignore changes smaller than 10 characters.
- As a user monitoring a price, I want to see the percentage difference and only alert on big drops.
- As a user, I want to see a "significance" score in the Watch Inspector to understand change patterns.

---

## UX Design

### Watch Configuration Enhancement

New option when adding a watch:

```
┌──────────────────────────────────────────┐
│ Minimum Change Threshold (optional)      │
│                                          │
│  ( ) Any change (default)               │
│  ( ) At least 5 characters different    │
│  ( ) At least 10% different             │
│  ( ) Custom: [ 20 ] characters          │
│                                          │
│  [ Skip ]                                │
└──────────────────────────────────────────┘
```

### Watch Inspector Enhancement

Each change shows a magnitude indicator:

```
Content ⚠ CHANGED  (Score: 73%)
▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  73% different

$149.99 → $79.99
```

The score bar visually represents how much changed.

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| 1 char changes, threshold = 5 chars | No alert; snapshot updates silently |
| 50 chars change, threshold = 5 chars | Alert fires |
| Content 10% different, threshold = 10% | Alert fires (at boundary) |
| Content identical | Score 0%; no alert |
| Element missing | Always alerts regardless of threshold |
| Threshold set to "Any change" | Current behavior; all changes trigger |

---

## Technical Notes

### Magnitude Calculation

```javascript
function calculateMagnitude(oldText, newText) {
    // Character-level difference ratio
    const maxLen = Math.max(oldText.length, newText.length);
    if (maxLen === 0) return 0;

    // Simple Levenshtein-inspired character diff count
    let diffChars = 0;
    const minLen = Math.min(oldText.length, newText.length);
    for (let i = 0; i < minLen; i++) {
        if (oldText[i] !== newText[i]) diffChars++;
    }
    diffChars += Math.abs(oldText.length - newText.length);

    return {
        diffChars,
        diffPercent: Math.round((diffChars / maxLen) * 100),
        lengthDelta: newText.length - oldText.length
    };
}
```

### Threshold Evaluation

```javascript
function meetsThreshold(watch, magnitude) {
    const t = watch.threshold || { type: 'any' };
    if (t.type === 'any') return true;
    if (t.type === 'chars') return magnitude.diffChars >= t.value;
    if (t.type === 'percent') return magnitude.diffPercent >= t.value;
    return true;
}
```

### Data Model

```javascript
{
    selector: '#price',
    mode: 'content',
    threshold: { type: 'chars', value: 5 },  // or { type: 'percent', value: 10 }
    snapshot: { ... }
}
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Levenshtein is O(n²) for long strings | Low | Use simple char-by-char comparison (O(n)); exact Levenshtein not needed |
| Threshold too high → user misses important changes | Low | Clear threshold labeling; "Any change" remains default |
| Percentage misleading for very short strings | Low | Show both char count and percentage |
