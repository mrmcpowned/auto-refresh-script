# Feature Spec: MutationObserver Real-Time Detection

## Overview

Offer a secondary watch mode that uses `MutationObserver` to detect DOM changes in real time *between* page refreshes. This catches AJAX-driven updates, SPA route changes, and dynamic content injection without waiting for the next full-page reload.

---

## Problem Statement

Many modern pages update content via JavaScript (AJAX, WebSocket, SPA frameworks) without full reloads. The current watch system only compares snapshots at refresh time, missing in-between changes. Users monitoring live dashboards, chat feeds, or real-time data need instantaneous change alerts.

---

## User Stories

- As a trader, I want instant alerts when a price ticker updates without waiting for the page to reload.
- As a support agent, I want to know immediately when a new ticket appears in a live queue.
- As a developer, I want to detect SPA route changes that modify a dashboard widget.

---

## UX Design

### Watch Mode Selector Enhancement

When adding a watch, a new detection mode option:

```
┌──────────────────────────────────────┐
│ Detection Mode                       │
│                                      │
│ ( ) On Refresh                       │
│     Compare snapshot after reload    │
│                                      │
│ (●) Real-Time (MutationObserver)     │
│     Detect changes as they happen    │
│                                      │
│ [ ] Also compare on refresh          │
│                                      │
│ Observe:                             │
│ [x] Text content changes             │
│ [x] Child element additions          │
│ [ ] Attribute changes                │
│ [ ] Style/class changes              │
└──────────────────────────────────────┘
```

### Inspector Status for Real-Time Watch

```
┌──────────────────────────────────────┐
│ #live-feed                           │
│ Mode: Real-Time 🟢 observing         │
│ Changes detected: 14                 │
│ Last change: 3s ago                  │
│ Throttle: 1 alert per 5s            │
│                                      │
│ Recent mutations:                    │
│  · childList +1 node (2s ago)        │
│  · characterData changed (5s ago)    │
│  · childList +3 nodes (12s ago)      │
└──────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Enable real-time mode | MutationObserver attached to element; badge shows 🟢 |
| DOM change detected | Immediate toast/alert (throttled) |
| Page refreshes | Observer re-attached after DOM ready |
| Element removed from DOM | Observer disconnected; status → "🔴 element lost" |
| Rapid mutations (e.g., animation) | Throttled to 1 alert per N seconds (configurable) |
| Disable real-time mode | Observer disconnected; returns to refresh-only |
| Multiple real-time watches | One observer per watch; independent throttles |

---

## Technical Notes

### Observer Setup

```javascript
function attachRealtimeWatch(watch) {
    const el = document.querySelector(watch.selector);
    if (!el) {
        updateWatchStatus(watch.id, 'element-lost');
        return;
    }

    const config = {
        childList: watch.observeChildren !== false,
        characterData: watch.observeText !== false,
        subtree: true,
        attributes: watch.observeAttributes || false,
        attributeFilter: watch.attributeFilter || undefined
    };

    let lastAlertTime = 0;
    const throttleMs = (watch.throttleSeconds || 5) * 1000;

    const observer = new MutationObserver((mutations) => {
        const now = Date.now();
        if (now - lastAlertTime < throttleMs) return;
        lastAlertTime = now;

        const summary = summarizeMutations(mutations);
        watch.mutationCount = (watch.mutationCount || 0) + mutations.length;
        watch.lastMutationTime = now;

        triggerRealtimeAlert(watch, summary);
        updateInspectorMutationLog(watch.id, summary);
    });

    observer.observe(el, config);
    watch._observer = observer;
    updateWatchStatus(watch.id, 'observing');
}

function summarizeMutations(mutations) {
    const added = mutations.filter(m => m.type === 'childList')
        .reduce((n, m) => n + m.addedNodes.length, 0);
    const removed = mutations.filter(m => m.type === 'childList')
        .reduce((n, m) => n + m.removedNodes.length, 0);
    const textChanges = mutations.filter(m => m.type === 'characterData').length;
    const attrChanges = mutations.filter(m => m.type === 'attributes').length;

    return { added, removed, textChanges, attrChanges, total: mutations.length };
}
```

### Re-attachment After Refresh

```javascript
// In the existing post-refresh hook:
function onPageReady() {
    getWatches()
        .filter(w => w.detectionMode === 'realtime')
        .forEach(w => {
            if (w._observer) w._observer.disconnect();
            attachRealtimeWatch(w);
        });
}
```

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `watches[].detectionMode` | `'refresh'\|'realtime'` | Detection strategy |
| `watches[].observeChildren` | `boolean` | Watch for child node changes |
| `watches[].observeText` | `boolean` | Watch for text content changes |
| `watches[].observeAttributes` | `boolean` | Watch for attribute changes |
| `watches[].throttleSeconds` | `number` | Min seconds between alerts |
| `watches[].mutationCount` | `number` | Total mutations detected (runtime) |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Alert storm from rapid DOM changes | High | Throttle with configurable interval; default 5s |
| Memory leaks from orphaned observers | Medium | Disconnect on page unload; track references |
| Conflict with page's own MutationObservers | Low | Read-only observation; no DOM modifications |
| Performance impact on complex DOM trees | Medium | Limit subtree depth; warn for very large elements |
| Observer lost after SPA navigation | Medium | Re-attach on URL change detection (popstate/hashchange) |
