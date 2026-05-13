# Feature Spec: Centralized Config System

## Overview

Replace the scattered `GM_getValue()`/`GM_setValue()` calls throughout the codebase with a single `Config` object that provides typed access, validated defaults, and change notification via the event bus.

---

## Problem Statement

Settings use ~20 different storage keys accessed via raw `GM_getValue()` calls with inconsistent defaults (e.g., interval defaults to `30` in one place). There is no validation, no schema, and no way for components to react when a setting changes. Adding a new setting requires knowing which storage key pattern to use and remembering to add the default everywhere it's read.

---

## User Stories

- As a developer, I want to add a new setting in one place with its default, type, and storage key.
- As a developer, I want components to be notified when a setting changes so they can react.
- As a developer, I want preventing default-drift bugs (same key, different default in two places).

---

## Technical Design

### Config Schema

```javascript
const CONFIG_SCHEMA = {
  interval:        { key: 'autoRefreshInterval',    default: 30,   type: 'number' },
  corner:          { key: 'autoRefreshCorner',       default: 'bottom-right', type: 'string' },
  fontSize:        { key: 'autoRefreshFontSize',     default: 'medium', type: 'string' },
  hotkey:          { key: 'autoRefreshHotkey',       default: 'Alt+Shift+R', type: 'string' },
  theme:           { key: 'autoRefreshTheme',        default: 'dark', type: 'string' },
  opacity:         { key: 'autoRefreshBadgeOpacity', default: 1,    type: 'number' },
  alertMode:       { key: 'autoRefreshAlertMode',    default: 'beep', type: 'string' },
  ttsVoice:        { key: 'autoRefreshTTSVoice',     default: '',   type: 'string' },
  ttsRate:         { key: 'autoRefreshTTSRate',       default: 1.0,  type: 'number' },
  ttsVolume:       { key: 'autoRefreshTTSVolume',     default: 1.0,  type: 'number' },
  settingsExpanded:{ key: 'autoRefreshSettingsExpanded', default: false, type: 'boolean' },
};
```

### Config API

```javascript
const Config = {
  get(name),           // Returns value with correct default
  set(name, value),    // Validates, stores, emits 'config:changed' event
  schema,              // Exposes schema for iteration
};
```

### Per-URL Keys

Per-URL keys (`enabled`, `watches`, `watchEnabled`) remain separate since they depend on `_urlKey` which is dynamic. They keep using direct `GM_getValue()`/`GM_setValue()` with their storage key constants. The Config system only manages global settings.

### Event Integration

`Config.set()` emits via the event bus: `EventBus.emit('config:changed', { name, value, oldValue })`.

---

## Scope & Non-Goals

### In Scope
- Schema with defaults and types for all global settings
- `Config.get()` / `Config.set()` API
- Replace all `GM_getValue(STORAGE_KEY_*, default)` for global keys with `Config.get()`
- Emit config change events

### Out of Scope
- Per-URL keys (watches, enabled) — these remain with direct GM_getValue/GM_setValue
- Import/export (deferred to spec #06)
- Undo/redo for settings
