# Feature Spec: Smart Refresh Scheduling

## Overview

Add intelligent refresh scheduling beyond fixed intervals — time-of-day windows, adaptive intervals based on change frequency, and pause-on-idle to conserve resources when the user is away.

---

## Problem Statement

Fixed-interval refreshing is wasteful in several scenarios:
- A status page that only updates during business hours (9–5) gets refreshed pointlessly overnight
- A news page that updates frequently during breaking events but rarely otherwise uses the same interval for both
- A user who leaves a tab open overnight wastes CPU/network cycles refreshing a page nobody is watching
- A page that hasn't changed in 20 refreshes probably doesn't need to refresh every 10 seconds

---

## User Stories

- As a user monitoring a work dashboard, I want auto-refresh to only run during business hours.
- As a user tracking a rarely-changing page, I want the refresh interval to automatically slow down if nothing changes.
- As a user who leaves tabs open, I want auto-refresh to pause when I'm idle and resume when I return.
- As a user, I want to set different intervals for different times of day.

---

## UX Design

### Settings Enhancement

New sub-section under REFRESH:

```
REFRESH
⏱  Refresh Interval      10 seconds
📍 Badge Position         Top Center
🔤 Badge Font Size        Extra large

SCHEDULE
📅 Active Window          Always
   When auto-refresh runs
🧠 Adaptive Interval      Off
   Slow down when nothing changes
💤 Pause When Idle         Off
   Stop refreshing when you're away
```

### Active Window Picker

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Active Window                            │
│ When auto-refresh runs                   │
│                                          │
│  ┌── Always ✓ ───────────────────────┐   │
│  │  Refresh 24/7 (default)           │   │
│  └───────────────────────────────────┘   │
│  ┌── Business Hours ─────────────────┐   │
│  │  Mon–Fri, 9:00 AM – 5:00 PM      │   │
│  └───────────────────────────────────┘   │
│  ┌── Custom ─────────────────────────┐   │
│  │  Set your own days and times      │   │
│  └───────────────────────────────────┘   │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Custom Window Sub-Modal

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Custom Schedule                          │
│                                          │
│ DAYS                                     │
│  [✓] Mon  [✓] Tue  [✓] Wed              │
│  [✓] Thu  [✓] Fri  [ ] Sat  [ ] Sun     │
│                                          │
│ TIME                                     │
│  Start: [ 08:00 ▾ ]                      │
│  End:   [ 18:00 ▾ ]                      │
│                                          │
│  [ Save ]                                │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Adaptive Interval Toggle

When enabled, the badge shows a small `🧠` indicator. The interval automatically adjusts:

```
Base interval: 10s
After 5 unchanged refreshes: 20s
After 10 unchanged refreshes: 40s
After 20 unchanged refreshes: 60s
Maximum: 5× base interval

When a change IS detected: reset to base interval immediately
```

Badge tooltip shows: `Interval: 40s (adaptive — no changes in 10 cycles)`

### Pause When Idle

Detects user inactivity (no mouse/keyboard/scroll events). After the idle threshold, auto-refresh pauses with a badge indicator:

```
Badge: 💤 Idle
Tooltip: "Paused — no activity for 5 minutes. Move mouse to resume."
```

When the user moves the mouse or presses a key, auto-refresh resumes immediately with a toast: "Resuming auto-refresh."

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Outside active window, auto-refresh enabled | Badge shows `🕐 Waiting` with next active time; no refreshes fire |
| Active window starts | Auto-refresh begins automatically; toast: "Schedule active — auto-refresh started" |
| Active window ends | Auto-refresh pauses; toast: "Schedule ended — pausing until tomorrow 9:00 AM" |
| Adaptive: 5 unchanged cycles | Interval doubles (10s→20s); badge tooltip shows adaptive info |
| Adaptive: Change detected | Interval resets to base immediately; toast: "Change detected — resetting interval to 10s" |
| Adaptive: reaches max (5×) | Stays at max; doesn't increase further |
| User goes idle | After threshold (default 5m), badge shows `💤 Idle` |
| User returns from idle | Auto-refresh resumes instantly; toast: "Resuming auto-refresh" |
| User manually pauses during idle | Manual pause takes priority; user return doesn't auto-resume |
| Adaptive + Schedule combined | Both apply: adaptive timing within the active window |
| Schedule set to weekdays only, currently Saturday | Badge: `🕐 Mon 9:00 AM`; no refreshes |

---

## Technical Notes

### Active Window Evaluation

```javascript
function isInActiveWindow() {
    const schedule = GM_getValue('ar_schedule', { type: 'always' });
    if (schedule.type === 'always') return true;

    const now = new Date();
    const day = now.getDay(); // 0=Sun, 6=Sat
    const time = now.getHours() * 60 + now.getMinutes();

    const days = schedule.type === 'business'
        ? [1, 2, 3, 4, 5]
        : schedule.days; // custom: array of day numbers

    const start = schedule.type === 'business' ? 540 : schedule.start; // minutes from midnight
    const end = schedule.type === 'business' ? 1020 : schedule.end;

    return days.includes(day) && time >= start && time < end;
}
```

Called at the start of each refresh cycle. If outside window, the timer pauses and the badge updates.

### Adaptive Interval

```javascript
let unchangedCycles = 0;
const ADAPTIVE_MULTIPLIERS = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5];
// Index 0-4: 1x, Index 5-9: 2x, Index 10-19: 4x, Index 20+: 5x

function getEffectiveInterval() {
    if (!GM_getValue('ar_adaptive', false)) return getInterval();
    const base = getInterval();
    const idx = Math.min(unchangedCycles, ADAPTIVE_MULTIPLIERS.length - 1);
    return base * ADAPTIVE_MULTIPLIERS[idx];
}

// In checkForChanges(), after comparison:
if (anyChanged) {
    unchangedCycles = 0;
} else {
    unchangedCycles++;
}
```

### Idle Detection

```javascript
let lastActivity = Date.now();
const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
let isIdle = false;

['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, () => {
        lastActivity = Date.now();
        if (isIdle) {
            isIdle = false;
            resumeRefresh();
            showToast('Resuming auto-refresh');
        }
    }, { passive: true });
});

// Check in refresh cycle:
function checkIdle() {
    if (!GM_getValue('ar_pause_idle', false)) return false;
    if (Date.now() - lastActivity > IDLE_THRESHOLD) {
        isIdle = true;
        return true;
    }
    return false;
}
```

### Storage Keys

```javascript
GM_getValue('ar_schedule', { type: 'always' })
// { type: 'always' } | { type: 'business' } | { type: 'custom', days: [1,2,3,4,5], start: 480, end: 1080 }

GM_getValue('ar_adaptive', false)       // boolean
GM_getValue('ar_pause_idle', false)     // boolean
GM_getValue('ar_idle_threshold', 300000) // milliseconds (5 min default)
```

### Badge States

| State | Badge Display | Color |
|-------|---------------|-------|
| Normal countdown | `↻ 8s` | Green→Yellow→Red |
| Paused (manual) | `⏸ 8s` | Grey |
| Outside schedule | `🕐 Mon 9:00` | Grey |
| User idle | `💤 Idle` | Grey |
| Adaptive (slower) | `↻ 35s 🧠` | Normal colors + brain emoji |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Timezone confusion | Medium | Use browser local time; show "Local time" label in schedule picker |
| Idle detection false positives (keyboard-focused workflows) | Low | Keyboard events included in activity detection |
| Adaptive interval too aggressive | Low | Max 5× multiplier, not exponential; resets immediately on change |
| Schedule + manual toggle conflict | Low | Manual toggle always overrides; schedule only controls automatic start/stop |
| Battery drain from idle detection listeners | Very Low | Passive listeners; no timers for idle check (checked only in refresh cycle) |

### Performance Considerations

- Idle detection uses passive event listeners — no performance impact
- Schedule check is a simple date comparison — negligible cost
- Adaptive interval reuses existing timer mechanism — no additional timers
- No polling for idle state; checked only when the refresh cycle ticks
