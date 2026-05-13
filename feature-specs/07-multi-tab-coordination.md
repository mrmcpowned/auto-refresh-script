# Feature Spec: Multi-Tab Coordination

## Overview

Prevent redundant refreshes when the same URL is open in multiple tabs. Elect a "leader" tab that performs the refresh and broadcasts results to follower tabs, reducing server load and avoiding race conditions.

---

## Problem Statement

Users frequently open the same URL in multiple tabs (e.g., a dashboard pinned in several windows). Each tab runs its own independent auto-refresh timer, causing:
- Duplicate network requests (N tabs = N times the server load)
- Inconsistent state — tabs refresh at different offsets, showing different data
- Alert fatigue — every tab triggers its own change alert independently
- Wasted CPU/battery on redundant DOM comparisons

---

## User Stories

- As a user with 5 dashboard tabs, I want only one to actively refresh so my server doesn't get hammered.
- As a user with multiple monitors, I want all tabs showing the same page to stay in sync.
- As a user, I want a change alert to fire only once, not once per tab.

---

## UX Design

### Settings Integration

New option under GENERAL:

```
GENERAL
⌨  Keyboard Shortcut      Alt+Shift+R
🔗 Multi-Tab Sync          Off
   Coordinate with other tabs on this page
```

### Badge Indicator

Leader tab badge: normal `↻ 8s`  
Follower tab badge: `👥 Synced` (grey, no countdown)

Follower badge tooltip: "Another tab is refreshing this page. This tab will update when it does."

### Tab State Toast

When a tab becomes leader: "This tab is now the refresh leader"  
When a tab becomes follower: "Synced — another tab is refreshing this page"  
When leader tab closes: "Taking over as refresh leader" (next follower promotes)

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Enable sync on 3 tabs | First tab becomes leader; others show `👥 Synced` |
| Leader tab closes | Oldest follower promotes to leader; toast shown |
| Leader tab detects change | Alert fires on leader; followers get notified via BroadcastChannel |
| User disables sync | Tab becomes independent; own timer starts |
| Only one tab open | Behaves normally (no coordination needed) |
| Tabs on different URLs | Each URL group has its own leader/follower set |
| User manually pauses leader | Leader broadcasts pause; followers show paused |

---

## Technical Notes

### BroadcastChannel API

```javascript
const channel = new BroadcastChannel('auto-refresh-sync');
const tabId = crypto.randomUUID();

// Leader election: lowest tabId wins (or first to claim)
channel.postMessage({ type: 'heartbeat', tabId, timestamp: Date.now() });

channel.onmessage = (e) => {
    if (e.data.type === 'heartbeat' && e.data.tabId < tabId) {
        // Another tab has priority — become follower
        becomeFollower();
    }
    if (e.data.type === 'refresh-complete') {
        // Leader refreshed — reload this tab too
        location.reload();
    }
    if (e.data.type === 'change-detected') {
        // Leader detected a change — show alert here too
        triggerAlert(e.data.details);
    }
};
```

### Leader Election Protocol

1. On enable, tab broadcasts `{ type: 'claim', tabId }` 
2. All existing tabs respond with their tabIds
3. Lowest tabId becomes leader (deterministic, no race conditions)
4. Leader sends heartbeats every 5 seconds
5. If no heartbeat for 10 seconds, followers re-elect

### Storage Keys

```javascript
GM_getValue('ar_multi_tab', false)  // boolean
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| BroadcastChannel not available | Low | Feature auto-disables; works in all modern browsers |
| Leader crashes without closing | Medium | 10-second heartbeat timeout triggers re-election |
| Timing drift between tabs | Low | Followers don't maintain timers; they react to leader events |
| Cross-origin tabs | N/A | BroadcastChannel is same-origin only (correct behavior) |
