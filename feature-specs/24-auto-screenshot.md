# Feature Spec: Auto-Screenshot on Change Detection

## Overview

Automatically capture a screenshot of the page (or a specific element) when a watched element change is detected, creating a visual audit trail for later review.

---

## Problem Statement

Text-based diffs lose visual context — layout changes, color shifts, or full-page state at the moment of change are not captured. Users who monitor visual-heavy pages (dashboards, product listings, status boards) need a visual record of what the page looked like when a change occurred.

---

## User Stories

- As a price tracker, I want a screenshot of the product page every time the price changes.
- As a QA engineer, I want visual proof of unexpected text changes on a staging site.
- As a compliance analyst, I want a visual log of every page state change for audit purposes.

---

## UX Design

### Settings Toggle

In the Watch configuration sub-modal:

```
┌──────────────────────────────────────┐
│ Watch Options                        │
│                                      │
│ [x] Alert on change                  │
│ [x] Play sound                       │
│ [ ] Auto-screenshot on change  ←NEW  │
│     ( ) Full page                    │
│     (●) Watched element only         │
│                                      │
│ Screenshots saved: 3 / 20 (max)     │
└──────────────────────────────────────┘
```

### Screenshot Gallery (in Watch Inspector)

```
┌──────────────────────────────────────────┐
│ 📸 Screenshots (3)                       │
│ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ thumb1 │ │ thumb2 │ │ thumb3 │        │
│ │14:30:02│ │15:45:11│ │16:02:44│        │
│ └────────┘ └────────┘ └────────┘        │
│                                          │
│ Click to expand · Right-click to save    │
│ [Clear All Screenshots]                  │
└──────────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Enable auto-screenshot | Screenshots taken on next detected change |
| "Full page" mode | Captures entire viewport via `html2canvas` or Canvas API |
| "Element only" mode | Captures bounding rect of watched element |
| View screenshot gallery | Thumbnails in Watch Inspector detail pane |
| Click thumbnail | Full-size overlay with timestamp |
| Max screenshots reached | Oldest screenshot deleted; FIFO rotation |
| Download screenshot | Right-click → "Save image" or dedicated button |
| Clear all | Confirm dialog → removes all stored screenshots |

---

## Technical Notes

### Element Screenshot (Canvas-based)

```javascript
async function screenshotElement(el) {
    const rect = el.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    const ctx = canvas.getContext('2d');

    // Use html2canvas-lite approach or native API if available
    // Fallback: capture visible viewport region
    try {
        // For simple text elements, render to canvas manually
        ctx.scale(devicePixelRatio, devicePixelRatio);
        ctx.fillStyle = getComputedStyle(el).backgroundColor || '#fff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.font = getComputedStyle(el).font;
        ctx.fillStyle = getComputedStyle(el).color;
        ctx.fillText(el.innerText, 4, rect.height / 2 + 4);

        return canvas.toDataURL('image/png', 0.8);
    } catch (e) {
        console.warn('[Auto-Refresh] Screenshot failed:', e);
        return null;
    }
}
```

### Storage Strategy

```javascript
// Screenshots stored as data URIs in GM_setValue
// Max 20 per watch to avoid storage bloat
const MAX_SCREENSHOTS = 20;

function storeScreenshot(watchId, dataUri) {
    const key = `screenshots_${watchId}`;
    let shots = JSON.parse(GM_getValue(key, '[]'));
    shots.push({
        timestamp: Date.now(),
        data: dataUri
    });
    if (shots.length > MAX_SCREENSHOTS) {
        shots = shots.slice(-MAX_SCREENSHOTS);
    }
    GM_setValue(key, JSON.stringify(shots));
}
```

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `watches[].autoScreenshot` | `boolean` | Enable auto-screenshot |
| `watches[].screenshotMode` | `'page'\|'element'` | Capture scope |
| `screenshots_{watchId}` | `string (JSON)` | Array of `{timestamp, data}` objects |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Storage size with many screenshots | High | Max 20 per watch; PNG compression; FIFO rotation |
| GM_setValue size limits | Medium | Monitor size; warn at 80% capacity; offer export |
| Cross-origin content in canvas | Medium | Canvas taint detection; fallback to text-only render |
| Performance of screenshot capture | Low | Async capture; only on change detection (not every refresh) |
| Privacy — sensitive page content stored | Low | Clear all button; auto-expire option; user-initiated only |
