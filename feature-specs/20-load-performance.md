# Feature Spec: Page Load Performance Tracking

## Overview

Monitor page load times across refresh cycles, detect performance regressions, and optionally alert when page load exceeds a threshold — useful for site reliability monitoring.

---

## Problem Statement

Users monitoring critical pages care about more than content changes — they want to know if the page is getting slower. A dashboard that normally loads in 1 second but suddenly takes 8 seconds might indicate a server problem, even if the content hasn't changed.

---

## User Stories

- As a DevOps engineer, I want to know if page load time exceeds 5 seconds.
- As a user monitoring a dashboard, I want to see load time trends to detect degradation.
- As a user, I want an alert when the page is loading significantly slower than usual.

---

## UX Design

### Settings Integration

```
GENERAL
⌨  Keyboard Shortcut      Alt+Shift+R
📊 Refresh Stats           View
⏱  Load Time Alert         Off
   Alert when page load exceeds threshold
```

### Load Time Alert Picker

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Load Time Alert                          │
│ Alert when page load is slow             │
│                                          │
│  ( ) Off                                │
│  ( ) 3 seconds                          │
│  ( ) 5 seconds                          │
│  ( ) 10 seconds                         │
│  ( ) Custom: [ 8 ] seconds              │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Badge Indicator

When load time exceeds threshold: `⚠ Slow (4.2s)` shown briefly in badge after page load, then returns to countdown.

### Stats Dashboard Integration (with spec 09)

```
PERFORMANCE
┌───────────────────────────────────────┐
│  Last Load:        1.2s    ✅         │
│  Average:          1.4s              │
│  Slowest:          4.2s    ⚠         │
│  Fastest:          0.8s              │
│  Loads > threshold: 2               │
│                                       │
│  ▁▂▁▁▃▁▁▁█▁▁▂▁  ← sparkline        │
└───────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Page loads in 1.2s, threshold = 5s | No alert; load time recorded in stats |
| Page loads in 6.3s, threshold = 5s | Toast: "⚠ Slow page load: 6.3s"; badge flashes briefly |
| Threshold set to Off | Load times still tracked in stats; no alert |
| Page load measured | Uses Performance API; measured on each refresh |

---

## Technical Notes

### Performance Measurement

```javascript
function getPageLoadTime() {
    const perf = performance.getEntriesByType('navigation')[0];
    if (perf) return Math.round(perf.loadEventEnd - perf.startTime);
    // Fallback
    return performance.timing.loadEventEnd - performance.timing.navigationStart;
}

// After page load
window.addEventListener('load', () => {
    const loadTime = getPageLoadTime();
    const threshold = GM_getValue('ar_load_threshold', 0);
    if (threshold > 0 && loadTime > threshold * 1000) {
        showToast(`⚠ Slow page load: ${(loadTime/1000).toFixed(1)}s`);
    }
});
```

### Storage

```javascript
GM_getValue('ar_load_threshold', 0)  // 0 = off, else seconds
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance API not available | Very Low | Available in all modern browsers; fallback timing used |
| Load time includes network + render | Low | Expected behavior; matches user perception |
| Alert on every slow load is noisy | Low | Alert is a non-blocking toast; doesn't trigger audio/desktop notifications |
