# Feature Spec: Watch Data Access Layer

## Overview

Encapsulate all watch storage operations (`getWatches`, `setWatches`, `addWatch`, `removeWatch`, `getAllWatches`, `groupWatchesByDomain`, `removeRemoteWatch`, `reSnapshotWatch`) into a `WatchStore` class that manages caching, migration, and persistence in one place. This eliminates manual `_watchCache = null` invalidation scattered across multiple functions.

---

## Problem Statement

Watch data operations have several issues:
- **Cache invalidation scattered**: `_watchCache` is set to `null` explicitly in `removeRemoteWatch()` and implicitly reset in `setWatches()`. Missing an invalidation site causes stale data bugs.
- **Migration logic inlined**: Watch migration (adding missing `id` and `url` fields) runs inside both `getWatches()` and `getAllWatches()` — duplicated in two places.
- **No clear data contract**: Watch objects have implicit shape (`{ id, selector, mode, content, styles, snapshotTime, url }`) with no documentation or validation.
- **Direct `GM_getValue`/`GM_setValue` calls**: Storage access is not abstracted, making it hard to change storage format.

---

## User Stories

- As a developer, I want watch caching to be automatic so I never need to manually invalidate.
- As a developer, I want watch migration logic in one place so format changes are single-point edits.
- As a developer, I want a clear watch data contract so I know what fields are expected.

---

## UX Design

No user-facing UX changes.

---

## Technical Design

### WatchStore Object

```javascript
const WatchStore = (() => {
    let _cache = null;
    
    function _migrate(watches, storageKey) {
        let dirty = false;
        watches.forEach(w => {
            if (!w.id) { w.id = generateId(); dirty = true; }
            if (!w.url) { w.url = _pageUrl(); dirty = true; }
        });
        if (dirty) GM_setValue(storageKey, JSON.stringify(watches));
        return watches;
    }
    
    function _invalidate() { _cache = null; }
    
    return {
        /** Get watches for the current page (cached) */
        getLocal() {
            if (_cache !== null) return _cache;
            try { _cache = JSON.parse(GM_getValue(STORAGE_KEY_WATCHES, '[]')); }
            catch { _cache = []; }
            _cache = _migrate(_cache, STORAGE_KEY_WATCHES);
            return _cache;
        },
        
        /** Set watches for the current page */
        setLocal(arr) {
            _cache = arr;
            GM_setValue(STORAGE_KEY_WATCHES, JSON.stringify(arr));
        },
        
        /** Add or update a watch on the current page */
        add(watch) {
            if (!watch.id) watch.id = generateId();
            if (!watch.url) watch.url = _pageUrl();
            const watches = this.getLocal();
            const existing = watches.findIndex(w => w.selector === watch.selector && w.url === watch.url);
            if (existing >= 0) { watch.id = watches[existing].id || watch.id; watches[existing] = watch; }
            else watches.push(watch);
            this.setLocal(watches);
            GM_setValue(STORAGE_KEY_WATCH_ENABLED, true);
            EventBus.emit('watch:added', { watch });
        },
        
        /** Remove a watch by ID from the current page */
        remove(id) {
            const watches = this.getLocal();
            const idx = watches.findIndex(w => w.id === id);
            if (idx >= 0) watches.splice(idx, 1);
            this.setLocal(watches);
            if (watches.length === 0) GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
            EventBus.emit('watch:removed', { id });
        },
        
        /** Re-snapshot a watch with current DOM values */
        reSnapshot(w) {
            const el = document.querySelector(w.selector);
            if (!el) return false;
            if (w.mode === 'content' || w.mode === 'both') w.content = el.innerText.trim();
            if (w.mode === 'style' || w.mode === 'both') w.styles = captureStyles(el);
            w.snapshotTime = Date.now();
            const watches = this.getLocal();
            const idx = watches.findIndex(ww => ww.id === w.id);
            if (idx >= 0) watches[idx] = w;
            this.setLocal(watches);
            if (!watches.some(ww => getWatchStatus(ww) === 'changed')) stopAlert();
            return true;
        },
        
        /** Get all watches across all pages */
        getAll() {
            const allKeys = GM_listValues();
            const watchKeys = allKeys.filter(k => k.startsWith('autoRefreshWatches_'));
            const result = [];
            for (const key of watchKeys) {
                try {
                    let watches = JSON.parse(GM_getValue(key, '[]'));
                    if (!Array.isArray(watches) || watches.length === 0) continue;
                    const urlKey = key.slice(19);
                    watches = _migrate(watches, key);
                    for (const w of watches) {
                        result.push({ ...w, _storageKey: key, _urlKey: urlKey });
                    }
                } catch { /* skip corrupt entries */ }
            }
            return result;
        },
        
        /** Remove a watch from a different page's storage */
        removeRemote(watch) {
            const key = watch._storageKey;
            if (!key) return;
            try {
                const watches = JSON.parse(GM_getValue(key, '[]'));
                const filtered = watches.filter(w => w.id !== watch.id);
                GM_setValue(key, JSON.stringify(filtered));
            } catch { /* skip */ }
            if (watch.url === _pageUrl()) _invalidate();
        },
        
        /** Group watches by domain */
        groupByDomain: groupWatchesByDomain,
        
        /** Clear all watches on the current page */
        clearAll() {
            this.setLocal([]);
            GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
            stopAlert();
            showToast(t('toast.allWatchesCleared'));
            EventBus.emit('watches:cleared', {});
        },
        
        /** Get local watch count */
        count() { return this.getLocal().length; },
    };
})();
```

### Migration of Callers

Replace all calls to standalone functions with `WatchStore.*`:

| Old Call | New Call |
|---|---|
| `getWatches()` | `WatchStore.getLocal()` |
| `setWatches(arr)` | `WatchStore.setLocal(arr)` |
| `addWatch(w)` | `WatchStore.add(w)` |
| `removeWatch(id)` | `WatchStore.remove(id)` |
| `reSnapshotWatch(w)` | `WatchStore.reSnapshot(w)` |
| `getAllWatches()` | `WatchStore.getAll()` |
| `removeRemoteWatch(w)` | `WatchStore.removeRemote(w)` |
| `clearAllWatches()` | `WatchStore.clearAll()` |

### Standalone Function Removal

After migration, remove the standalone `getWatches`, `setWatches`, `addWatch`, `removeWatch`, `reSnapshotWatch`, `getAllWatches`, `removeRemoteWatch`, `clearAllWatches` functions and the `_watchCache` variable.

---

## Edge Cases & Error Handling

- Corrupt JSON in storage is caught and defaults to `[]` (existing behavior preserved)
- Migration runs once per cache fill, not on every access
- `removeRemote` only invalidates local cache if the watch is on the current page

---

## Scope & Non-Goals

### In Scope
- Creating `WatchStore` with all watch operations
- Migrating all callers to use `WatchStore`
- Removing standalone watch functions
- Updating test harness to test via `WatchStore`

### Out of Scope (Future)
- Watch data validation (enforcing required fields)
- Storage format versioning
- Watch data compression

---

## Risks & Open Questions

1. `groupWatchesByDomain` is a pure function that doesn't need caching — it can stay as a passthrough.
2. The `WatchStore` should be defined after `generateId()`, `captureStyles()`, and `_pageUrl()` since it depends on them.
