# Feature Spec: Desktop Notifications & Alert Modes

## Overview

Replace the single audio-beep alert with a configurable multi-channel notification system supporting desktop notifications, visual page effects, and customizable audio patterns.

---

## Problem Statement

The current alert system plays a 660Hz sine wave beep every 2 seconds indefinitely. This is effective but inflexible:
- Users in noisy environments may miss audio alerts
- Users in quiet environments (office, library) need silent alerts
- No desktop notification means users must keep the tab visible
- The beep pattern is monotonous and can't convey urgency or context
- No way to distinguish between "element changed" and "element missing" alerts

---

## User Stories

- As a user monitoring a page in a background tab, I want a desktop notification so I know to switch back.
- As a user in a meeting, I want to silently detect changes (visual-only mode) without audio.
- As a user watching multiple elements, I want different alert sounds for different watches.
- As a user, I want the alert to auto-dismiss after a configurable time instead of beeping forever.

---

## UX Design

### New Settings Section: ALERTS

Appears in the Settings menu between GENERAL and WATCHES:

```
ALERTS
🔔 Alert Mode             Audio + Desktop
   How you're notified of changes

🔊 Alert Sound            Beacon
   Which sound plays on change detection

⏱ Auto-Dismiss            Off
   Automatically silence after a duration
```

### Alert Mode Picker

Sub-modal with multi-select toggle buttons:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Alert Mode                               │
│ Choose how you're notified               │
│                                          │
│  [✓] 🔊 Audio                           │
│      Play a repeating alert sound        │
│                                          │
│  [✓] 🖥 Desktop Notification             │
│      Show a system notification popup    │
│                                          │
│  [ ] 📑 Title Flash                      │
│      Flash the page title with ⚠         │
│                                          │
│  [ ] 🔴 Tab Badge                        │
│      Show a red indicator on the tab     │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

At least one mode must remain active. Attempting to deselect the last active mode shows a toast: "At least one alert mode required."

### Alert Sound Picker

Sub-modal with preview buttons:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Alert Sound                              │
│ Tap to preview                           │
│                                          │
│  [▶] Beacon (default)          ✓         │
│  [▶] Chime                              │
│  [▶] Urgent                             │
│  [▶] Subtle                             │
│  [▶] Silent                              │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

Each option has a play button that previews the sound for 1 cycle without triggering an actual alert.

### Auto-Dismiss Picker

```
Off | 30s | 1m | 5m | 10m
```

When auto-dismiss is set, the alert automatically silences after the specified duration. A toast shows: "Alert auto-dismissed after 1 minute."

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Change detected, Audio enabled | Repeating sound plays (current behavior) |
| Change detected, Desktop enabled | `Notification` API shows popup with watch selector and change summary |
| Change detected, Title Flash enabled | Document title alternates between original and `⚠ Change Detected` every 1s |
| Change detected, Tab Badge enabled | Favicon replaced with red-dot overlay version |
| User clicks desktop notification | Browser focuses the tab |
| User hasn't granted notification permission | Toast: "Enable notifications in browser settings"; Desktop mode auto-disabled |
| Auto-dismiss timer fires | Alert silenced, toast shown, auto-refresh does NOT resume |
| All modes disabled attempt | Last mode can't be toggled off; toast warning |
| User in Settings when alert fires | Stop Alert button appears as before; all active alert channels activate |

---

## Technical Notes

### Desktop Notifications

```javascript
// Permission check on first enable
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

// On change detected
if (Notification.permission === 'granted') {
    const n = new Notification('Auto-Refresh: Change Detected', {
        body: `${selector} content changed`,
        icon: '🔍', // or a data URI
        tag: 'auto-refresh-alert', // replaces previous notification
        requireInteraction: true
    });
    n.onclick = () => { window.focus(); n.close(); };
}
```

Note: `Notification` API works in userscripts because they run in the page context. `GM_notification` is also available but less controllable.

### Title Flash

```javascript
let titleInterval;
const originalTitle = document.title;
function startTitleFlash() {
    let flash = false;
    titleInterval = setInterval(() => {
        document.title = (flash = !flash)
            ? `⚠ Change Detected — ${originalTitle}`
            : originalTitle;
    }, 1000);
}
function stopTitleFlash() {
    clearInterval(titleInterval);
    document.title = originalTitle;
}
```

### Audio Patterns (Web Audio API)

```javascript
const SOUNDS = {
    beacon:  { freq: 660,  type: 'sine',     duration: 200, gap: 2000 },
    chime:   { freq: 880,  type: 'sine',     duration: 300, gap: 3000 },
    urgent:  { freq: 1000, type: 'square',   duration: 100, gap: 500  },
    subtle:  { freq: 440,  type: 'triangle', duration: 150, gap: 4000 },
    silent:  null
};
```

### Storage Keys

```javascript
GM_getValue('ar_alert_modes', ['audio'])          // Array of active modes
GM_getValue('ar_alert_sound', 'beacon')           // Sound preset name
GM_getValue('ar_auto_dismiss', 0)                 // 0 = off, else milliseconds
```

### Data Model

No watch structure changes needed. Alert configuration is global (not per-watch), stored as separate GM values.

### Favicon Badge (Tab Badge mode)

```javascript
function setFaviconBadge() {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    // Draw existing favicon, then overlay red dot
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#e00';
    ctx.fill();
    link.href = canvas.toDataURL();
    link.rel = 'icon';
    document.head.appendChild(link);
}
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Notification permission denied | Low | Graceful fallback to other modes; toast explaining how to enable |
| Browser blocks notification from userscript | Medium | Some browsers restrict Notification API in injected scripts; test across Chrome/Firefox/Edge |
| Title flash conflicts with page's own title updates | Low | Store and restore original title; use MutationObserver if needed |
| Favicon badge fails on sites with CSP restrictions | Low | Favicon is optional; silent failure acceptable |
| Auto-dismiss confuses users who expect persistent alerts | Low | Clear toast message; consider "alert was auto-dismissed" indicator in settings |

### Accessibility Considerations

- Desktop notifications use OS-level accessibility (screen reader support built-in)
- Title flash provides visual-only cue — pair with at least one other mode
- Audio remains the default and most accessible mode
- All alert modes respect user's OS notification settings
