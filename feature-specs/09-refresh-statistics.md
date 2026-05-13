# Feature Spec: Refresh Statistics Dashboard

## Overview

Track and display metrics about auto-refresh activity — total refreshes, uptime, change frequency, average page load time — giving users insight into their monitoring patterns and page behavior.

---

## Problem Statement

Users have no visibility into how their auto-refresh is performing over time. Questions like "How many times did the page refresh today?", "How often does this page actually change?", and "Is the page getting slower?" are unanswerable without external tools.

---

## User Stories

- As a user, I want to know how many times my page refreshed in the last hour.
- As a user, I want to see the change frequency to decide if my interval is too fast or too slow.
- As a user monitoring a critical page, I want to know uptime statistics.

---

## UX Design

### Settings Integration

```
GENERAL
⌨  Keyboard Shortcut      Alt+Shift+R
📊 Refresh Stats           View
   Track refresh activity and changes
```

### Stats Dashboard Sub-Modal

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Refresh Statistics                       │
│ Activity since page load                 │
│                                          │
│  SESSION                                 │
│  ┌───────────────────────────────────┐   │
│  │  Refreshes:        47            │   │
│  │  Session Duration:  2h 14m       │   │
│  │  Changes Detected:  3            │   │
│  │  Change Rate:       1 per 45m    │   │
│  └───────────────────────────────────┘   │
│                                          │
│  TIMING                                  │
│  ┌───────────────────────────────────┐   │
│  │  Current Interval:  10s          │   │
│  │  Avg Page Load:     1.2s         │   │
│  │  Slowest Load:      3.8s         │   │
│  │  Fastest Load:      0.4s         │   │
│  └───────────────────────────────────┘   │
│                                          │
│  WATCHES                                 │
│  ┌───────────────────────────────────┐   │
│  │  Active Watches:    3            │   │
│  │  Total Alerts:      3            │   │
│  │  Last Change:       12m ago      │   │
│  └───────────────────────────────────┘   │
│                                          │
│  [ Reset Stats ]                         │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Open stats with no refreshes | All counters at 0; duration shows time since page load |
| Page refreshes | Refresh counter increments; load time recorded |
| Change detected | Changes counter increments; last change timestamp updated |
| Click Reset Stats | All counters reset; toast: "Stats reset" |
| Adaptive interval active | Shows effective interval, not base interval |
| Page reload | Session stats reset (in-memory only) |

---

## Technical Notes

### Data Model (In-Memory Only)

```javascript
const stats = {
    refreshCount: 0,
    sessionStart: Date.now(),
    changesDetected: 0,
    lastChangeAt: null,
    loadTimes: [],  // array of ms values, last 100
};
```

Stats are **not persisted** — they reset on page reload. This keeps them lightweight and avoids storage bloat.

### Page Load Time

```javascript
// Measured via Performance API
const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
stats.loadTimes.push(loadTime);
if (stats.loadTimes.length > 100) stats.loadTimes.shift();
```

### Change Rate Calculation

```javascript
const sessionMinutes = (Date.now() - stats.sessionStart) / 60000;
const changeRate = stats.changesDetected > 0
    ? Math.round(sessionMinutes / stats.changesDetected)
    : null; // "No changes yet"
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stats lost on refresh | Low | By design — session-scoped; persistent stats would require storage |
| Performance overhead | Very Low | Counter increments only; no continuous tracking |
| Load time inaccurate for SPAs | Low | Performance API gives best available data |
