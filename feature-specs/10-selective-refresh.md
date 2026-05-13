# Feature Spec: Selective Page Refresh (Partial Reload)

## Overview

Instead of reloading the entire page, fetch the page in the background and surgically update only the watched elements, preserving scroll position, form inputs, and page state.

---

## Problem Statement

Full page reloads (`location.reload()`) are destructive:
- Scroll position lost — user must re-scroll to the content they're monitoring
- Form inputs cleared — any data entry in progress is destroyed
- Video/audio interrupted — media playback stops
- JavaScript state reset — counters, timers, dynamic content restart
- Flash of blank content — jarring visual experience
- Slower — the entire page re-renders when only a small element changed

---

## User Stories

- As a user scrolled to the bottom of a long page, I want the content to update without losing my scroll position.
- As a user filling out a form on a page with a live ticker, I want the ticker to update without clearing my form.
- As a user watching a video with a chat sidebar, I want the chat to update without restarting the video.

---

## UX Design

### Settings Integration

```
REFRESH
⏱  Refresh Interval      10 seconds
🔄 Refresh Mode           Full Reload
   How the page updates
📍 Badge Position         Top Center
🔤 Badge Font Size        Extra large
```

### Refresh Mode Picker

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Refresh Mode                             │
│ How the page updates                     │
│                                          │
│  ┌── Full Reload ✓ ──────────────────┐   │
│  │  Standard page refresh            │   │
│  │  Clears scroll, forms, and state  │   │
│  └───────────────────────────────────┘   │
│  ┌── Smart Update ───────────────────┐   │
│  │  Update watched elements only     │   │
│  │  Preserves scroll and page state  │   │
│  └───────────────────────────────────┘   │
│  ┌── Background Fetch ───────────────┐   │
│  │  Check for changes without reload │   │
│  │  Only reload when changes found   │   │
│  └───────────────────────────────────┘   │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Badge Indicators

- Full Reload: `↻ 8s` (current behavior)
- Smart Update: `⚡ 8s` (lightning bolt)
- Background Fetch: `🔍 8s` (magnifying glass)

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Smart Update fires | Background fetch, watched elements updated in-place; no visible reload |
| Smart Update: element changed | Element updates + highlight flash (green border 500ms) |
| Smart Update: selector not found in fetched page | Falls back to full reload |
| Background Fetch: no changes | Nothing happens; counter resets |
| Background Fetch: changes detected | Full page reload triggered |
| Smart Update: page requires auth | Background fetch may fail; falls back to full reload |
| User has no watches + Smart Update | Toast: "Smart Update requires at least one watch" — falls back |

---

## Technical Notes

### Smart Update Implementation

```javascript
async function smartUpdate() {
    try {
        const response = await fetch(location.href, {
            credentials: 'same-origin',
            cache: 'no-cache'
        });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const watches = getWatches();
        let anyChanged = false;

        for (const watch of watches) {
            const liveEl = document.querySelector(watch.selector);
            const fetchedEl = doc.querySelector(watch.selector);

            if (!liveEl || !fetchedEl) continue;

            const newContent = fetchedEl.innerText.trim();
            const oldContent = liveEl.innerText.trim();

            if (newContent !== oldContent) {
                // Surgically update the element
                liveEl.innerHTML = fetchedEl.innerHTML;
                flashElement(liveEl); // brief green border
                anyChanged = true;
            }
        }

        if (anyChanged) {
            // Update snapshots and check conditions
            checkForChanges();
        }
    } catch (err) {
        // Network error — fall back to full reload
        location.reload();
    }
}

function flashElement(el) {
    el.style.transition = 'outline-color 0.5s';
    el.style.outline = '2px solid #4caf50';
    setTimeout(() => { el.style.outline = ''; }, 1000);
}
```

### Background Fetch Implementation

```javascript
async function backgroundCheck() {
    const response = await fetch(location.href, {
        credentials: 'same-origin',
        cache: 'no-cache'
    });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const watches = getWatches();
    for (const watch of watches) {
        const fetchedEl = doc.querySelector(watch.selector);
        if (!fetchedEl) continue;
        const newContent = fetchedEl.innerText.trim();
        if (newContent !== watch.snapshot.content) {
            // Change detected — do full reload
            location.reload();
            return;
        }
    }
    // No changes — do nothing
}
```

### Storage Keys

```javascript
GM_getValue('ar_refresh_mode', 'full')  // 'full' | 'smart' | 'background'
```

### Security Considerations

- `fetch()` uses `same-origin` credentials to maintain auth
- `DOMParser` is safe — no script execution occurs
- `innerHTML` assignment from parsed doc is equivalent to page reload content
- CSP may block `fetch()` on some sites — falls back to full reload

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CORS/CSP blocks fetch | Medium | Graceful fallback to full reload |
| innerHTML injection from fetched page | Low | Content comes from same origin; same trust level as normal browse |
| Page JS depends on full reload events | Medium | Smart Update doesn't trigger `DOMContentLoaded`; some pages may break |
| Fetched content doesn't match rendered (JS-dependent pages) | Medium | Smart Update best for server-rendered content; disclaimer in UI |
| Double network request (fetch + eventual reload) | Low | Background Fetch skips reload when no changes found |
