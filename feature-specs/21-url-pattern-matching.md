# Feature Spec: URL Pattern Matching & Site Groups

## Overview

Apply auto-refresh configurations automatically based on URL patterns, so the same settings, interval, and watches activate across matching pages without manual setup.

---

## Problem Statement

Settings and watches are stored per exact URL. Users monitoring multiple similar pages (e.g., `/product/1`, `/product/2`, `/product/N`) must configure each page independently. There's no way to say "use these settings for any page matching `/product/*`."

---

## User Stories

- As a user monitoring product pages, I want the same watch configuration to apply to all `/product/*` URLs.
- As a user, I want different intervals for different site sections (fast for dashboards, slow for docs).
- As a user visiting a new product page, I want auto-refresh to start automatically with my saved configuration.

---

## UX Design

### Settings Integration

```
DATA
💾 Export Config
📥 Import Config
🌍 URL Rules               2 rules
   Auto-apply settings by URL pattern
```

### URL Rules Manager

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ URL Rules                                │
│ Auto-apply settings by URL pattern       │
│                                          │
│  ┌── Rule 1 ─────────────────────────┐   │
│  │  Pattern: */product/*             │   │
│  │  Interval: 30s  Auto-start: Yes   │   │
│  │  Profile: Price Monitor           │   │
│  │  [ Edit ]  [ 🗑 Delete ]          │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌── Rule 2 ─────────────────────────┐   │
│  │  Pattern: */dashboard*            │   │
│  │  Interval: 10s  Auto-start: Yes   │   │
│  │  Profile: —                       │   │
│  │  [ Edit ]  [ 🗑 Delete ]          │   │
│  └───────────────────────────────────┘   │
│                                          │
│  [ + Add Rule ]                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Rule Editor

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Edit URL Rule                            │
│                                          │
│  URL Pattern (glob)                      │
│  [ */product/*              ]            │
│                                          │
│  Refresh Interval                        │
│  [ 30 seconds ▾ ]                        │
│                                          │
│  Auto-Start                              │
│  [✓] Start refreshing on page load      │
│                                          │
│  Load Profile                            │
│  [ Price Monitor ▾ ]  (optional)         │
│                                          │
│  [ Save ]                                │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Visit URL matching a rule | Settings applied; auto-start if enabled; profile loaded if set |
| Visit URL matching multiple rules | First matching rule wins (order matters) |
| Rule has a profile | Profile's watches loaded and snapshotted |
| Rule has no profile | Only interval/auto-start applied |
| Delete a rule | Rule removed; pages no longer auto-configured |
| Pattern invalid | Validation: "Invalid pattern" |

---

## Technical Notes

### Pattern Matching

```javascript
function matchesUrlPattern(pattern, url) {
    // Convert glob to regex: * → [^/]*, ** → .*
    const regex = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<DOUBLESTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<DOUBLESTAR>>/g, '.*');
    return new RegExp(`^${regex}$`).test(url);
}
```

### Page Load Hook

```javascript
// On page load, check URL rules
const rules = GM_getValue('ar_url_rules', []);
for (const rule of rules) {
    if (matchesUrlPattern(rule.pattern, location.href)) {
        GM_setValue(STORAGE_KEY_INTERVAL, rule.interval);
        if (rule.profileName) loadProfile(rule.profileName);
        if (rule.autoStart) startRefresh();
        break;
    }
}
```

### Storage

```javascript
GM_getValue('ar_url_rules', [])
// Array of { pattern, interval, autoStart, profileName }
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overwriting manual settings | Medium | Rules only apply to matching URLs; manual changes override until next page load |
| Regex injection via pattern | Low | Glob-to-regex conversion escapes special chars |
| Too many rules slow page load | Very Low | Simple loop; even 100 rules would take <1ms |
