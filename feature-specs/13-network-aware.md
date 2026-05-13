# Feature Spec: Network-Aware Refresh

## Overview

Detect network connectivity status and automatically pause auto-refresh when offline, resume when back online, and optionally reduce refresh frequency on slow or metered connections.

---

## Problem Statement

Auto-refresh blindly attempts `location.reload()` regardless of network state:
- Offline: reload shows browser error page, destroying the last good page state
- Metered connections (mobile tethering): refreshes waste limited data
- Slow connections: refresh triggers before the previous page load completes
- No feedback to user about why a refresh "failed"

---

## User Stories

- As a user on spotty WiFi, I want auto-refresh to pause when I lose connection and resume when it returns.
- As a user tethering from my phone, I want auto-refresh to slow down to conserve data.
- As a user, I want to see a clear indicator when refreshes are paused due to network issues.

---

## UX Design

### Settings Integration

```
GENERAL
⌨  Keyboard Shortcut      Alt+Shift+R
🌐 Network Aware           On
   Pause when offline, adapt to connection
```

### Badge States

| State | Badge | Color |
|-------|-------|-------|
| Online, normal | `↻ 8s` | Green |
| Offline | `📡 Offline` | Red |
| Slow connection | `↻ 40s 🐢` | Yellow |
| Back online | `↻ 10s` | Green + toast |

### Connection Speed Adaptation

```
4G / WiFi (>= 10 Mbps):     Base interval (no change)
3G (1.5–10 Mbps):           2× base interval
2G / Slow (< 1.5 Mbps):     5× base interval
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Network drops | Badge: `📡 Offline`; timer paused; toast: "Offline — refresh paused" |
| Network returns | Timer resumes; toast: "Back online — resuming refresh" |
| Slow connection detected | Interval multiplied; badge shows turtle emoji |
| Connection speeds up | Interval returns to base |
| Network Aware disabled | Standard behavior; refreshes attempt regardless |
| Offline + user opens settings | Settings work normally (no network needed for UI) |

---

## Technical Notes

### Online/Offline Detection

```javascript
window.addEventListener('online', () => {
    if (GM_getValue('ar_network_aware', true)) {
        showToast('Back online — resuming refresh');
        resumeRefresh();
    }
});

window.addEventListener('offline', () => {
    if (GM_getValue('ar_network_aware', true)) {
        showToast('Offline — refresh paused');
        pauseRefresh();
        updateBadgeText('📡 Offline');
    }
});
```

### Connection Speed (Network Information API)

```javascript
function getConnectionMultiplier() {
    const conn = navigator.connection;
    if (!conn) return 1; // API not available
    const type = conn.effectiveType;
    if (type === '2g' || type === 'slow-2g') return 5;
    if (type === '3g') return 2;
    return 1;
}
```

### Storage

```javascript
GM_getValue('ar_network_aware', true)  // default enabled
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `navigator.connection` not available (Firefox) | Low | Graceful fallback; only online/offline detection used |
| False offline detection | Low | `navigator.onLine` + event listeners are reliable in modern browsers |
| Slow connection detection inaccurate | Low | Conservative multipliers; user can disable feature |
