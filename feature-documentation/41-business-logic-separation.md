# Feature Spec: Business Logic Separation

## Overview

Extract business logic from modal build functions into standalone service modules. Currently, modals like `webhook-edit` (~280 lines) and `watch-inspector` (~400 lines) blend UI rendering with validation, API calls (`GM_xmlhttpRequest`), and storage operations. Separating these concerns makes each layer independently testable and reduces modal complexity.

---

## Problem Statement

Modal `build()` functions contain inline business logic:
- `webhook-edit`: URL validation, payload construction, `GM_xmlhttpRequest` calls, config read/write
- `watch-inspector`: watch status computation, re-snapshot logic, remote watch removal, selector copying
- `settings`: toggle state management, auto-refresh start/stop coordination
- `watch-overview`: domain grouping, cross-page watch removal, data refresh

This coupling means:
- Business logic can only be tested through the UI
- Changes to storage format require editing modal code
- Similar operations (e.g., removing a watch) are duplicated across modals and context menus

---

## User Stories

- As a developer, I want webhook operations in a `WebhookService` so that webhook-edit modal only handles UI.
- As a developer, I want watch operations in a `WatchService` so that watch status, re-snapshot, and removal are centralized.
- As a developer, I want to add webhook validation tests to the test harness.

---

## UX Design

No user-facing UX changes.

---

## Technical Design

### WebhookService

Extract from webhook modals into a service object:

```javascript
const WebhookService = {
    getConfig: _getWebhookConfig,
    saveConfig: _saveWebhookConfig,
    getDisplayLabel: _webhookDisplayLabel,
    
    validateUrl(url) {
        if (!url) return { valid: false, reason: 'empty' };
        try { new URL(url); return { valid: true }; }
        catch { return { valid: false, reason: 'invalid' }; }
    },
    
    sendTest: sendTestWebhook,
    send: sendWebhook,
    formatPayload: formatWebhookPayload,
    
    addWebhook(config, { label, url, format, template }) {
        config.webhooks.push({
            id: generateId().replace('w_', 'wh_'),
            label, url, format, template,
            enabled: !!url
        });
        this.saveConfig(config);
    },
    
    updateWebhook(config, id, updates) {
        const idx = config.webhooks.findIndex(wh => wh.id === id);
        if (idx >= 0) Object.assign(config.webhooks[idx], updates);
        this.saveConfig(config);
    },
    
    deleteWebhook(config, id) {
        config.webhooks = config.webhooks.filter(wh => wh.id !== id);
        this.saveConfig(config);
    },
    
    toggleGlobal(config) {
        config.globalEnabled = !config.globalEnabled;
        this.saveConfig(config);
        return config.globalEnabled;
    },
    
    toggleWebhook(config, id) {
        const wh = config.webhooks.find(w => w.id === id);
        if (wh) { wh.enabled = !wh.enabled; this.saveConfig(config); }
        return wh?.enabled;
    },
};
```

### WatchService

Consolidate watch operations:

```javascript
const WatchService = {
    getAll: getAllWatches,
    getLocal: getWatches,
    setLocal: setWatches,
    add: addWatch,
    remove: removeWatch,
    removeRemote: removeRemoteWatch,
    reSnapshot: reSnapshotWatch,
    groupByDomain: groupWatchesByDomain,
    clearAll: clearAllWatches,
    getStatus: getWatchStatus,
    
    getLocalCount() { return getWatches().length; },
    getChangedCount() { return getWatches().filter(w => getWatchStatus(w) === 'changed').length; },
    getAllCount() { return getAllWatches().length; },
};
```

### RefreshService

Consolidate refresh control:

```javascript
const RefreshService = {
    start: startRefresh,
    stop: stopRefresh,
    pause: pauseRefresh,
    resume: resumeRefresh,
    isEnabled,
    getInterval,
};
```

### Placement

Services should be defined after the functions they wrap, right before the Modal Framework section. They are thin facades over existing functions — no logic duplication.

### Modal Simplification Example

```javascript
// BEFORE (webhook-edit save handler):
saveBtn.addEventListener('click', () => {
    if (!currentUrl) { showToast(t('toast.enterUrlShort')); return; }
    try { new URL(currentUrl); } catch { showToast(t('toast.invalidUrl')); return; }
    const freshConfig = _getWebhookConfig();
    if (isNew) {
        freshConfig.webhooks.push({ id: generateId().replace('w_', 'wh_'), ... });
    } else {
        const idx = freshConfig.webhooks.findIndex(wh => wh.id === webhookId);
        if (idx >= 0) { freshConfig.webhooks[idx].label = currentLabel; ... }
    }
    _saveWebhookConfig(freshConfig);
    showToast(isNew ? t('toast.webhookAdded') : t('toast.webhookSaved'));
    ...
});

// AFTER:
saveBtn.addEventListener('click', () => {
    const validation = WebhookService.validateUrl(currentUrl);
    if (!validation.valid) { showToast(t('toast.invalidUrl')); return; }
    const config = WebhookService.getConfig();
    if (isNew) WebhookService.addWebhook(config, { label: currentLabel, url: currentUrl, format: currentFormat, template: currentTemplate });
    else WebhookService.updateWebhook(config, webhookId, { label: currentLabel, url: currentUrl, format: currentFormat, template: currentTemplate });
    showToast(isNew ? t('toast.webhookAdded') : t('toast.webhookSaved'));
    ...
});
```

---

## Edge Cases & Error Handling

- Services are thin wrappers — they call existing functions, not replace them
- If a function is only used in one place, wrapping it in a service is optional
- Test harness can now test `WebhookService.validateUrl()` directly

---

## Scope & Non-Goals

### In Scope
- Creating `WebhookService`, `WatchService`, `RefreshService` facades
- Updating modal build functions to call service methods
- Adding `WebhookService.validateUrl()` tests to the test harness

### Out of Scope (Future)
- Removing the underlying standalone functions (services wrap them; removing is a future cleanup)
- Creating an `AlertService` (alert logic is simple enough as-is)
- Creating a `ModalService` (the Modal IIFE already serves this role)

---

## Risks & Open Questions

1. Services are intentionally thin facades to minimize risk. If deeper refactoring is desired, it can be done incrementally later.
2. The existing functions remain callable directly — services don't enforce exclusive access.
