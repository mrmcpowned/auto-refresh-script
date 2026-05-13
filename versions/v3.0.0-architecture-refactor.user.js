// ==UserScript==
// @name         Auto Refresh Page
// @namespace    http://chrisr.xyz/
// @version      3.0.0
// @description  Auto-refresh any webpage at a configurable interval
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '3.0.0';

    // --- Theme Constants ---
    const T = {
        bg:        '#1e1e1e',
        bgDark:    '#111',
        bgDarker:  '#000',
        bgMid:     '#222',
        bgLight:   '#2a2a2a',
        bgLighter: '#3a3a3a',
        bgOverlay: 'rgba(0,0,0,0.5)',
        bgBadge:   'rgba(30,30,30,0.92)',
        border:       '#444',
        borderLight:  '#555',
        borderMid:    '#333',
        text:       '#eee',
        textLight:  '#fff',
        textMuted:  '#aaa',
        textDim:    '#888',
        textFaint:  '#666',
        textSub:    '#ccc',
        accent:      '#0078d4',
        accentHover: '#1a8ad4',
        accentFaint: 'rgba(0,120,212,0.15)',
        ok:         '#0f0',
        okBright:   '#0a0',
        okText:     '#8f8',
        okBg:       '#1a3a1a',
        okBgHover:  '#254a25',
        okFaint:    'rgba(0,255,0,0.03)',
        warn:       '#fc0',
        warnBg:     '#3a2a00',
        warnBorder: '#a86',
        err:        '#f44',
        errLight:   '#f88',
        errBg:      '#4a1c1c',
        errBgHover: '#5a2525',
        errBgDark:  '#6a2020',
        errPanel:   '#1a1a2e',
        shadow:     'rgba(0,0,0,0.4)',
        shadowHeavy:'rgba(0,0,0,0.5)',
        cyan:       '#0af',
        modeContent: '#4ec9b0',
        modeStyle:   '#c586c0',
        modeBoth:    '#569cd6',
    };

    function getModeColor(mode) { return { content: T.modeContent, style: T.modeStyle, both: T.modeBoth }[mode]; }

    // --- Event Bus ---

    const EventBus = (() => {
        const listeners = new Map();
        return {
            on(event, fn) {
                if (!listeners.has(event)) listeners.set(event, new Set());
                listeners.get(event).add(fn);
                return () => listeners.get(event).delete(fn);
            },
            off(event, fn) { listeners.get(event)?.delete(fn); },
            emit(event, data) { listeners.get(event)?.forEach(fn => fn(data)); }
        };
    })();

    // --- Cleanup Helper ---

    function addDocListener(event, handler, capture = false) {
        document.addEventListener(event, handler, capture);
        return () => document.removeEventListener(event, handler, capture);
    }

    // --- Constants (hoisted) ---
    const DEFAULT_HOTKEY = 'Alt+Shift+R';

    const BROWSER_RESERVED = new Set([
        'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Shift+N', 'Ctrl+Shift+T',
        'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+Q', 'Ctrl+L', 'Ctrl+D',
        'Ctrl+H', 'Ctrl+J', 'Ctrl+K', 'Ctrl+P', 'Ctrl+S', 'Ctrl+O',
        'Ctrl+R', 'Ctrl+Shift+R', 'Ctrl+F', 'Ctrl+G', 'Ctrl+Shift+G',
        'Ctrl+U', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C',
        'Ctrl+Shift+Delete', 'Ctrl+F5', 'Ctrl+Shift+B',
        'Alt+F4', 'Alt+Left', 'Alt+Right', 'Alt+Home',
        'Meta+W', 'Meta+T', 'Meta+N', 'Meta+Q', 'Meta+R', 'Meta+L',
        'Meta+Shift+T', 'Meta+Shift+N'
    ]);

    const CORNER_LABELS = {
        'top-left': '↖ Top Left', 'top-center': '↑ Top Center', 'top-right': '↗ Top Right',
        'bottom-left': '↙ Bottom Left', 'bottom-center': '↓ Bottom Center', 'bottom-right': '↘ Bottom Right'
    };

    const FONT_SIZES = { 'small': '11px', 'medium': '13px', 'large': '16px', 'extra-large': '20px' };

    const THEME_LABELS = { dark: 'Dark', light: 'Light', minimal: 'Minimal', highContrast: 'High Contrast' };

    const THEMES = {
        dark: {
            bg:'#1e1e1e', bgDark:'#111', bgDarker:'#000', bgMid:'#222', bgLight:'#2a2a2a', bgLighter:'#3a3a3a',
            bgOverlay:'rgba(0,0,0,0.5)', bgBadge:'rgba(30,30,30,0.92)',
            border:'#444', borderLight:'#555', borderMid:'#333',
            text:'#eee', textLight:'#fff', textMuted:'#aaa', textDim:'#888', textFaint:'#666', textSub:'#ccc',
            accent:'#0078d4', accentHover:'#1a8ad4', accentFaint:'rgba(0,120,212,0.15)',
            ok:'#0f0', okBright:'#0a0', okText:'#8f8', okBg:'#1a3a1a', okBgHover:'#254a25', okFaint:'rgba(0,255,0,0.03)',
            warn:'#fc0', warnBg:'#3a2a00', warnBorder:'#a86',
            err:'#f44', errLight:'#f88', errBg:'#4a1c1c', errBgHover:'#5a2525', errBgDark:'#6a2020', errPanel:'#1a1a2e',
            shadow:'rgba(0,0,0,0.4)', shadowHeavy:'rgba(0,0,0,0.5)',
            cyan:'#0af', modeContent:'#4ec9b0', modeStyle:'#c586c0', modeBoth:'#569cd6'
        },
        light: {
            bg:'#fafafa', bgDark:'#f0f0f0', bgDarker:'#e0e0e0', bgMid:'#f5f5f5', bgLight:'#fff', bgLighter:'#eee',
            bgOverlay:'rgba(0,0,0,0.3)', bgBadge:'rgba(255,255,255,0.95)',
            border:'#ccc', borderLight:'#bbb', borderMid:'#ddd',
            text:'#333', textLight:'#111', textMuted:'#666', textDim:'#888', textFaint:'#aaa', textSub:'#555',
            accent:'#0078d4', accentHover:'#1a8ad4', accentFaint:'rgba(0,120,212,0.1)',
            ok:'#2e7d32', okBright:'#1b5e20', okText:'#2e7d32', okBg:'#e8f5e9', okBgHover:'#c8e6c9', okFaint:'rgba(46,125,50,0.05)',
            warn:'#e65100', warnBg:'#fff3e0', warnBorder:'#ffb74d',
            err:'#c62828', errLight:'#c62828', errBg:'#ffebee', errBgHover:'#ffcdd2', errBgDark:'#ef9a9a', errPanel:'#e8eaf6',
            shadow:'rgba(0,0,0,0.15)', shadowHeavy:'rgba(0,0,0,0.2)',
            cyan:'#0288d1', modeContent:'#2e7d32', modeStyle:'#7b1fa2', modeBoth:'#1565c0'
        },
        minimal: {
            bg:'#1e1e1e', bgDark:'#111', bgDarker:'#000', bgMid:'#222', bgLight:'#2a2a2a', bgLighter:'#3a3a3a',
            bgOverlay:'rgba(0,0,0,0.5)', bgBadge:'transparent',
            border:'#444', borderLight:'#555', borderMid:'#333',
            text:'#eee', textLight:'#fff', textMuted:'#aaa', textDim:'#888', textFaint:'#666', textSub:'#ccc',
            accent:'#0078d4', accentHover:'#1a8ad4', accentFaint:'rgba(0,120,212,0.15)',
            ok:'#0f0', okBright:'#0a0', okText:'#8f8', okBg:'#1a3a1a', okBgHover:'#254a25', okFaint:'rgba(0,255,0,0.03)',
            warn:'#fc0', warnBg:'#3a2a00', warnBorder:'#a86',
            err:'#f44', errLight:'#f88', errBg:'#4a1c1c', errBgHover:'#5a2525', errBgDark:'#6a2020', errPanel:'#1a1a2e',
            shadow:'rgba(0,0,0,0.4)', shadowHeavy:'rgba(0,0,0,0.5)',
            cyan:'#0af', modeContent:'#4ec9b0', modeStyle:'#c586c0', modeBoth:'#569cd6'
        },
        highContrast: {
            bg:'#000', bgDark:'#000', bgDarker:'#000', bgMid:'#111', bgLight:'#1a1a1a', bgLighter:'#222',
            bgOverlay:'rgba(0,0,0,0.7)', bgBadge:'rgba(0,0,0,0.95)',
            border:'#fff', borderLight:'#fff', borderMid:'#888',
            text:'#fff', textLight:'#fff', textMuted:'#ddd', textDim:'#ccc', textFaint:'#aaa', textSub:'#eee',
            accent:'#1aebff', accentHover:'#5ef0ff', accentFaint:'rgba(26,235,255,0.15)',
            ok:'#00ff00', okBright:'#00cc00', okText:'#00ff00', okBg:'#003300', okBgHover:'#004d00', okFaint:'rgba(0,255,0,0.05)',
            warn:'#ffff00', warnBg:'#333300', warnBorder:'#ffff00',
            err:'#ff0000', errLight:'#ff0000', errBg:'#330000', errBgHover:'#4d0000', errBgDark:'#660000', errPanel:'#000033',
            shadow:'rgba(0,0,0,0.6)', shadowHeavy:'rgba(0,0,0,0.8)',
            cyan:'#00ffff', modeContent:'#00ff00', modeStyle:'#ff00ff', modeBoth:'#00bfff'
        }
    };

    const CORNERS = {
        'bottom-right': { bottom: '12px', right: '12px', top: '', left: '', transform: '' },
        'bottom-left': { bottom: '12px', right: '', top: '', left: '12px', transform: '' },
        'bottom-center': { bottom: '12px', right: '', top: '', left: '50%', transform: 'translateX(-50%)' },
        'top-right': { bottom: '', right: '12px', top: '12px', left: '', transform: '' },
        'top-left': { bottom: '', right: '', top: '12px', left: '12px', transform: '' },
        'top-center': { bottom: '', right: '', top: '12px', left: '50%', transform: 'translateX(-50%)' }
    };

    // --- Storage Keys (fixed: origin+pathname instead of full href) ---
    const _urlKey = location.origin + location.pathname;
    const STORAGE_KEY_ENABLED = 'autoRefreshEnabled_' + _urlKey;
    const STORAGE_KEY_WATCHES = 'autoRefreshWatches_' + _urlKey;
    const STORAGE_KEY_WATCH_ENABLED = 'autoRefreshWatchEnabled_' + _urlKey;

    // --- Centralized Config ---

    const CONFIG_SCHEMA = {
        interval:         { key: 'autoRefreshInterval',         default: 30,             type: 'number' },
        corner:           { key: 'autoRefreshCorner',           default: 'bottom-right', type: 'string' },
        fontSize:         { key: 'autoRefreshFontSize',         default: 'medium',       type: 'string' },
        hotkey:           { key: 'autoRefreshHotkey',           default: DEFAULT_HOTKEY,  type: 'string' },
        theme:            { key: 'autoRefreshTheme',            default: 'dark',          type: 'string' },
        opacity:          { key: 'autoRefreshBadgeOpacity',     default: 1,               type: 'number' },
        alertMode:        { key: 'autoRefreshAlertMode',        default: 'beep',          type: 'string' },
        ttsVoice:         { key: 'autoRefreshTTSVoice',         default: '',              type: 'string' },
        ttsRate:          { key: 'autoRefreshTTSRate',          default: 1.0,             type: 'number' },
        ttsVolume:        { key: 'autoRefreshTTSVolume',        default: 1.0,             type: 'number' },
        webhook:          { key: 'autoRefreshWebhook',          default: null,            type: 'object' },
        settingsExpanded: { key: 'autoRefreshSettingsExpanded', default: false,           type: 'boolean' },
    };

    const Config = {
        schema: CONFIG_SCHEMA,
        get(name) {
            const s = CONFIG_SCHEMA[name];
            if (!s) throw new Error(`Unknown config: ${name}`);
            return GM_getValue(s.key, s.default);
        },
        set(name, value) {
            const s = CONFIG_SCHEMA[name];
            if (!s) throw new Error(`Unknown config: ${name}`);
            const oldValue = this.get(name);
            GM_setValue(s.key, value);
            EventBus.emit('config:changed', { name, value, oldValue });
        }
    };

    // --- Watch Array Helpers (with cache) ---

    let _watchCache = null;

    function getWatches() {
        if (_watchCache !== null) return _watchCache;
        try { _watchCache = JSON.parse(GM_getValue(STORAGE_KEY_WATCHES, '[]')); }
        catch { _watchCache = []; }
        // Migrate legacy watches without ids or urls
        let dirty = false;
        _watchCache.forEach(w => {
            if (!w.id) { w.id = generateId(); dirty = true; }
            if (!w.url) { w.url = _pageUrl(); dirty = true; }
        });
        if (dirty) GM_setValue(STORAGE_KEY_WATCHES, JSON.stringify(_watchCache));
        return _watchCache;
    }

    function setWatches(arr) {
        _watchCache = arr;
        GM_setValue(STORAGE_KEY_WATCHES, JSON.stringify(arr));
    }

    function generateId() {
        return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function addWatch(watch) {
        if (!watch.id) watch.id = generateId();
        if (!watch.url) watch.url = _pageUrl();
        const watches = getWatches();
        const existing = watches.findIndex(w => w.selector === watch.selector && w.url === watch.url);
        if (existing >= 0) { watch.id = watches[existing].id || watch.id; watches[existing] = watch; }
        else watches.push(watch);
        setWatches(watches);
        GM_setValue(STORAGE_KEY_WATCH_ENABLED, true);
        EventBus.emit('watch:added', { watch });
    }

    function removeWatch(id) {
        const watches = getWatches();
        const idx = watches.findIndex(w => w.id === id);
        if (idx >= 0) watches.splice(idx, 1);
        setWatches(watches);
        if (watches.length === 0) GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
        EventBus.emit('watch:removed', { id });
    }

    function getAllWatches() {
        const allKeys = GM_listValues();
        const watchKeys = allKeys.filter(k => k.startsWith('autoRefreshWatches_'));
        const result = [];
        for (const key of watchKeys) {
            try {
                const watches = JSON.parse(GM_getValue(key, '[]'));
                if (!Array.isArray(watches) || watches.length === 0) continue;
                const urlKey = key.slice(19);
                // Migrate legacy watches missing ids/urls
                let dirty = false;
                watches.forEach(w => {
                    if (!w.id) { w.id = generateId(); dirty = true; }
                    if (!w.url) { w.url = urlKey.startsWith('http') ? urlKey : 'https://' + urlKey; dirty = true; }
                });
                if (dirty) GM_setValue(key, JSON.stringify(watches));
                for (const w of watches) {
                    result.push({ ...w, _storageKey: key, _urlKey: urlKey });
                }
            } catch { /* skip corrupt entries */ }
        }
        return result;
    }

    function groupWatchesByDomain(watches) {
        const groups = {};
        for (const w of watches) {
            let origin, pathname;
            const raw = w.url || w._urlKey;
            try {
                const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
                origin = u.origin;
                pathname = u.pathname;
            } catch {
                origin = 'unknown';
                pathname = raw;
            }
            const domain = origin.replace(/^https?:\/\//, '');
            if (!groups[domain]) groups[domain] = { origin, pages: {} };
            if (!groups[domain].pages[pathname]) groups[domain].pages[pathname] = [];
            groups[domain].pages[pathname].push(w);
        }
        return groups;
    }

    function removeRemoteWatch(watch) {
        const key = watch._storageKey;
        if (!key) return;
        try {
            const watches = JSON.parse(GM_getValue(key, '[]'));
            const filtered = watches.filter(w => w.id !== watch.id);
            GM_setValue(key, JSON.stringify(filtered));
        } catch { /* skip */ }
        // Invalidate local cache if watch is on current page
        if (watch.url === _pageUrl()) _watchCache = null;
    }

    // --- Style Capture & Diff ---

    const WATCHED_STYLE_PROPS = [
        'background', 'backgroundColor', 'backgroundImage',
        'color', 'opacity', 'visibility', 'display',
        'fontSize', 'fontWeight', 'fontStyle', 'fontFamily', 'textDecoration',
        'border', 'borderColor', 'borderWidth', 'borderStyle', 'borderRadius',
        'padding', 'margin', 'width', 'height', 'maxWidth', 'maxHeight',
        'position', 'top', 'left', 'right', 'bottom',
        'transform', 'boxShadow', 'textShadow', 'outline',
        'overflow', 'zIndex'
    ];

    function captureStyles(el) {
        const computed = getComputedStyle(el);
        const snapshot = {};
        WATCHED_STYLE_PROPS.forEach(prop => { snapshot[prop] = computed[prop]; });
        return JSON.stringify(snapshot);
    }

    function diffStyles(oldJson, newJson) {
        try {
            const oldObj = JSON.parse(oldJson);
            const newObj = JSON.parse(newJson);
            const changes = [];
            for (const prop of WATCHED_STYLE_PROPS) {
                if (oldObj[prop] !== newObj[prop]) changes.push({ prop, from: oldObj[prop], to: newObj[prop] });
            }
            return changes;
        } catch { return []; }
    }

    // --- Shadow DOM Host ---
    // All UI is rendered inside a Shadow DOM to isolate from host page CSS.
    const _host = document.createElement('div');
    _host.id = 'auto-refresh-shadow-host';
    _host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none';
    const _shadow = _host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(_host);

    // --- Stylesheet (injected into shadow root) ---

    function _camelToVar(key) {
        return '--ar-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    function buildThemeVars(theme) {
        return ':host{' + Object.entries(theme).map(([k, v]) => `${_camelToVar(k)}:${v}`).join(';') + '}';
    }

    function v(token) { return `var(${_camelToVar(token)})`; }

    function buildCss() {
        return `
        .ar-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:${v('shadowHeavy')};pointer-events:auto}
        .ar-panel{background:${v('bg')};color:${v('text')};border-radius:10px;padding:16px 20px;font:14px/1.6 system-ui,sans-serif;min-width:220px;box-shadow:0 8px 30px ${v('shadowHeavy')};opacity:0;transform:scale(0.97);transition:opacity .15s ease-out,transform .15s ease-out}
        .ar-title{font-weight:bold;margin-bottom:10px;font-size:15px}
        .ar-subtitle{color:${v('textDim')};font-size:12px;margin:-6px 0 10px 0}
        .ar-btn{display:block;width:100%;padding:8px 12px;margin:4px 0;border:none;border-radius:6px;cursor:pointer;font:14px/1.4 system-ui,sans-serif;text-align:left;background:${v('borderMid')};color:${v('text')};transition:background .15s}
        .ar-btn:hover{background:${v('border')}}
        .ar-btn-active{background:${v('accent')};color:${v('textLight')}}
        .ar-btn-active:hover{background:${v('accent')}}
        .ar-btn-ok{background:${v('okBg')};color:${v('okText')}}
        .ar-btn-ok:hover{background:${v('okBgHover')}}
        .ar-btn-err{background:${v('errBg')};color:${v('errLight')}}
        .ar-btn-err:hover{background:${v('errBgHover')}}
        .ar-section-hdr{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:${v('textFaint')};margin:12px 0 4px 4px}
        .ar-status-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;margin-bottom:10px;background:${v('bgDark')};border:1px solid ${v('borderMid')}}
        .ar-footer{margin-top:12px;padding-top:8px;border-top:1px solid ${v('borderMid')};text-align:center;font-size:11px;color:${v('borderLight')}}
        .ar-field{background:${v('bgDark')};border:1px solid ${v('border')};border-radius:6px;padding:8px 10px;max-height:120px;overflow-y:auto;word-break:break-all;font-size:13px}
        .ar-input{padding:8px 10px;border:1px solid ${v('borderLight')};border-radius:6px;background:${v('bgLight')};color:${v('text')};font:14px system-ui,sans-serif;outline:none;transition:border-color .2s}
        .ar-input:focus{border-color:${v('accent')}}
        .ar-toolbar{display:flex;gap:0;background:${v('bgLight')};border-radius:6px;overflow:hidden;border:1px solid ${v('border')}}
        .ar-toolbar-btn{background:transparent;border:none;border-right:1px solid ${v('border')};color:${v('textSub')};cursor:pointer;padding:4px 10px;font-size:13px;display:flex;align-items:center;gap:4px;transition:background .15s}
        .ar-toolbar-btn:hover{background:${v('bgLighter')}}
        .ar-toolbar-btn:last-child{border-right:none}
        .ar-back-btn{background:none;border:none;color:${v('textFaint')};cursor:pointer;font:12px system-ui,sans-serif;padding:0 0 4px 0;margin:0;display:block}
        .ar-back-btn:hover{color:${v('textMuted')}}
        .ar-link-btn{background:none;border:none;color:${v('textFaint')};cursor:pointer;font:12px system-ui,sans-serif;padding:4px 0;margin:0;display:block}
        .ar-link-btn:hover{color:${v('textMuted')}}
        .ar-collapsible{background:none;border:none;color:${v('textMuted')};cursor:pointer;font-size:12px;padding:0;margin-bottom:4px;display:flex;align-items:center;gap:4px}
        .ar-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block}
        .ar-dot-lg{width:8px;height:8px;border-radius:50%;display:inline-block}
        .ar-kbd{display:inline-block;padding:3px 8px;background:${v('bgMid')};border:1px solid ${v('borderLight')};border-radius:5px;font:bold 13px monospace;color:${v('textLight')};box-shadow:0 2px 0 ${v('bgDarker')}}
        .ar-sidebar-item{display:flex;align-items:center;gap:6px;width:100%;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:4px;transition:background .1s;text-align:left;background:transparent;color:${v('textSub')}}
        .ar-sidebar-item:hover:not(.ar-active){background:${v('bgLight')}}
        .ar-sidebar-item.ar-active{background:${v('accent')};color:${v('textLight')}}
        .ar-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:${v('accent')};color:${v('textLight')};font:14px/1 system-ui,sans-serif;padding:10px 20px;border-radius:8px;box-shadow:0 4px 16px ${v('shadow')};opacity:0;transition:opacity .3s,top .3s;pointer-events:none}
        .ar-toggle-row{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border:none;border-radius:6px;margin-bottom:2px;background:${v('borderMid')};cursor:pointer;font:inherit;color:inherit;text-align:left}
        .ar-toggle-track{width:40px;height:22px;border-radius:11px;position:relative;transition:background .2s;flex-shrink:0}
        .ar-toggle-track-sm{width:34px;height:18px;border-radius:9px;position:relative;transition:background .2s;flex-shrink:0;border:none;padding:0;cursor:pointer}
        .ar-toggle-thumb{width:18px;height:18px;border-radius:50%;background:${v('textLight')};position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 3px ${v('shadow')}}
        .ar-toggle-thumb-sm{width:14px;height:14px;border-radius:50%;background:${v('textLight')};position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 2px ${v('shadow')}}
        .ar-preview{background:${v('bgDark')};border:1px solid ${v('border')};border-radius:6px;padding:6px 10px;font:12px monospace;color:${v('textMuted')};margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ar-warning{background:${v('warnBg')};border:1px solid ${v('warnBorder')};border-radius:6px;padding:6px 10px;font-size:11px;color:${v('warn')};margin-bottom:10px}
        .ar-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;min-width:280px;background:${v('bgDark')};border:1px solid ${v('border')};border-radius:8px;padding:12px}
        .ar-capture-box{padding:20px;background:${v('bgDark')};border:2px dashed ${v('borderLight')};border-radius:8px;text-align:center;font:bold 16px monospace;margin-bottom:8px;min-height:60px;min-width:280px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;color:${v('textDim')};transition:border-color .2s,background .3s}
        .ar-chip{background:${v('errPanel')};border:1px solid ${v('err')};border-radius:4px;padding:3px 8px;font:11px monospace;color:${v('text')};white-space:nowrap}
        .ar-ctx-menu{position:fixed;z-index:2147483647;background:${v('bg')};border:1px solid ${v('border')};border-radius:8px;padding:8px;min-width:220px;font:13px/1.6 system-ui,sans-serif;box-shadow:0 4px 16px ${v('shadowHeavy')};color:${v('text')};pointer-events:auto}
        .ar-ctx-header{margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${v('borderMid')}}
        .ar-ctx-title{font-weight:bold;font-size:13px;margin-bottom:2px}
        .ar-ctx-selector{font:11px monospace;color:${v('textMuted')};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
        .ar-opt-top{display:flex;justify-content:space-between;align-items:center}
        .ar-opt-value{color:${v('textDim')};font-size:12px;margin-left:12px}
        .ar-subtitle-sm{font-size:11px;color:${v('textDim')};margin-top:2px}
        .ar-btn-active .ar-subtitle-sm{color:inherit;opacity:0.85}
        .ar-empty-state{color:${v('textFaint')};font-size:13px;padding:8px 0}
        .ar-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ar-scroll-container{max-height:60vh;overflow-y:auto}
        .ar-section-hdr-sep{margin-top:16px;border-top:1px solid ${v('borderMid')};padding-top:12px}
        .ar-more-link{text-align:center;font-size:12px;color:${v('accent')};padding:10px 8px;cursor:pointer;border:1px dashed ${v('borderMid')};border-radius:6px;margin-top:8px;transition:background .15s;background:none;width:100%;display:block;font-family:system-ui,sans-serif}
        .ar-more-link:hover{background:${v('accentFaint')}}
        .ar-link-btn-center{text-align:center;width:100%}
        .ar-btn-accent{padding:8px 14px;border:none;border-radius:6px;background:${v('accent')};color:${v('textLight')};cursor:pointer;font:14px system-ui,sans-serif;transition:background .15s}
        .ar-btn-accent:hover{background:${v('accentHover')}}
        .ar-grid-btn.ar-btn{text-align:center;display:flex;align-items:center;justify-content:center;font-size:12px;margin:0}
        .ar-watch-row.ar-btn{display:flex;align-items:center;gap:8px}
        .ar-flex-fill{flex:1;min-width:0}
        .ar-divider{border:none;border-top:1px solid ${v('borderMid')};margin:10px 0 6px}
        .ar-split-layout{display:flex;gap:12px}
        .ar-inspector-sidebar{flex:0 0 25%;min-width:130px;border-right:1px solid ${v('borderMid')};padding-right:10px;max-height:60vh;overflow-y:auto}
        .ar-detail-pane{flex:1;min-width:0;max-height:60vh;overflow-y:auto}
        .ar-diff-box{background:${v('bgDark')};border:1px solid ${v('err')};border-radius:6px;padding:8px 10px;font-size:13px;word-break:break-all;max-height:200px;overflow-y:auto}
        .ar-diff-old{color:${v('errLight')};text-decoration:line-through}
        .ar-diff-new{color:${v('okText')}}
        .ar-input-group{display:flex;align-items:stretch;gap:0}
        .ar-input-group-field{background:${v('bgDark')};border:1px solid ${v('border')};border-radius:6px 0 0 6px;padding:8px 10px;font:13px monospace;color:${v('text')};word-break:break-all;flex:1}
        .ar-input-group-btn{background:${v('bgMid')};border:1px solid ${v('border')};border-left:none;border-radius:0 6px 6px 0;cursor:pointer;padding:8px 10px;font-size:13px;color:${v('text')}}
        .ar-textarea{width:100%;min-height:120px;padding:8px 10px;border:1px solid ${v('borderLight')};border-radius:6px;background:${v('bgLight')};color:${v('text')};font:13px monospace;outline:none;resize:vertical;transition:border-color .2s;box-sizing:border-box}
        .ar-textarea:focus{border-color:${v('accent')}}
        .ar-tag-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
        .ar-tag-chip{background:${v('bgLighter')};border:1px solid ${v('border')};border-radius:4px;padding:2px 8px;font:11px monospace;color:${v('textMuted')};cursor:pointer;transition:background .15s,border-color .15s}
        .ar-tag-chip:hover{background:${v('accent')};color:${v('textLight')};border-color:${v('accent')}}
        *{scrollbar-width:thin;scrollbar-color:${v('borderLight')} transparent}
        *::-webkit-scrollbar{width:6px}
        *::-webkit-scrollbar-track{background:transparent}
        *::-webkit-scrollbar-thumb{background:${v('borderLight')};border-radius:3px}
        *::-webkit-scrollbar-thumb:hover{background:${v('textFaint')}}
    `;
    }

    // Theme vars style element (updated on theme change, CSS stays static)
    const _themeVars = document.createElement('style');
    _themeVars.id = 'ar-theme-vars';
    _themeVars.textContent = buildThemeVars(T);
    _shadow.appendChild(_themeVars);

    const _css = document.createElement('style');
    _css.id = 'ar-css';
    _css.textContent = buildCss();
    _shadow.appendChild(_css);

    // --- DOM Builder ---

    function h(tag, props, ...children) {
        const e = document.createElement(tag);
        if (props) {
            for (const [k, v] of Object.entries(props)) {
                if (v == null) continue;
                if (k === 'class') e.className = v;
                else if (k === 'style') e.style.cssText = typeof v === 'string' ? v : '';
                else if (k === 'text') e.textContent = v;
                else if (k === 'html') e.innerHTML = v;
                else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
                else e.setAttribute(k, v);
            }
        }
        for (const child of children) {
            if (child == null) continue;
            if (typeof child === 'string') e.appendChild(document.createTextNode(child));
            else if (child instanceof Node) e.appendChild(child);
        }
        return e;
    }

    // --- UI Helpers ---

    function makeOptionBtn(label, isActive, onClick, opts = {}) {
        const cls = isActive ? 'ar-btn ar-btn-active'
            : opts.bg === T.okBg ? 'ar-btn ar-btn-ok'
            : opts.bg === T.errBg ? 'ar-btn ar-btn-err'
            : 'ar-btn';

        const btn = h('button', { class: cls });

        if (opts.subtitle || opts.value) {
            const top = h('div', { class: 'ar-opt-top' });
            top.appendChild(h('span', { text: isActive && !opts.value ? label + ' ✓' : label }));
            if (opts.value) top.appendChild(h('span', { text: opts.value, class: 'ar-opt-value' }));
            btn.appendChild(top);
            if (opts.subtitle) btn.appendChild(h('div', { text: opts.subtitle, class: 'ar-subtitle-sm' }));
        } else if (isActive) {
            btn.appendChild(h('span', { text: label }));
            btn.appendChild(h('span', { text: ' ✓', style: 'opacity:0.7' }));
        } else {
            btn.textContent = label;
        }

        if (opts.color) btn.style.color = opts.color;
        btn.addEventListener('click', onClick);
        return btn;
    }

    function addSection(panel, title) {
        panel.appendChild(h('div', { class: 'ar-section-hdr', text: title }));
    }

    function addCollapsible(container, labelText, defaultOpen) {
        const wrapper = h('div', { style: 'margin-top:10px' });
        let open = defaultOpen !== false;

        const arrow = h('span', { style: 'font-size:10px;transition:transform .15s;display:inline-block' });
        const label = h('span', { text: labelText });
        const toggle = h('button', { class: 'ar-collapsible' }, arrow, label);
        const body = h('div');

        function update() {
            arrow.textContent = '▶';
            arrow.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
            body.style.display = open ? 'block' : 'none';
        }
        toggle.addEventListener('click', () => { open = !open; update(); });
        update();

        wrapper.appendChild(toggle);
        wrapper.appendChild(body);
        container.appendChild(wrapper);
        return { body, setLabel: (t) => { label.textContent = t; } };
    }

    function addField(container, value, mono) {
        const box = h('div', {
            class: 'ar-field',
            text: value || '(empty)',
            style: [
                mono ? 'font-family:monospace' : '',
                value ? `color:${T.text}` : `color:${T.textFaint}`
            ].filter(Boolean).join(';')
        });
        container.appendChild(box);
        return box;
    }

    function formatSeconds(s) {
        if (s < 60) return `${s} seconds`;
        if (s < 3600) return s % 60 === 0 ? `${s / 60} minute${s / 60 > 1 ? 's' : ''}` : `${Math.floor(s / 60)}m ${s % 60}s`;
        if (s % 3600 === 0) return `${s / 3600} hour${s / 3600 > 1 ? 's' : ''}`;
        return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    }

    function formatCountdown(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
    }

    function timeAgo(ts) {
        if (!ts) return 'unknown';
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    // --- Timer State ---

    let countdownTimerId = null;
    let remaining = 0;
    let paused = false;

    // --- Badge ---

    const badge = h('div', {
        id: 'auto-refresh-badge',
        role: 'button',
        'aria-label': 'Auto-refresh countdown badge — click for options',
        title: 'Click for options',
        style: [
            'position:fixed', 'z-index:2147483647',
            `background:${T.bgBadge}`, `color:${T.ok}`, 'font:bold 13px/1 monospace',
            'padding:0', 'border-radius:8px', 'cursor:pointer',
            'user-select:none', 'display:none', `box-shadow:0 2px 8px ${T.shadow}`,
            'backdrop-filter:blur(4px)', 'transition:opacity .2s,box-shadow .3s',
            'overflow:hidden', 'pointer-events:auto'
        ].join(';')
    });

    const badgeContent = h('div', { style: 'padding:6px 10px;display:flex;align-items:center;gap:6px;white-space:nowrap' });
    const badgeText = h('span', { style: 'transition:color .3s' });
    const watchDot = h('span', {
        title: 'Watches active',
        style: `width:6px;height:6px;border-radius:50%;background:${T.cyan};display:none;flex-shrink:0`
    });
    badgeContent.appendChild(badgeText);
    badgeContent.appendChild(watchDot);
    badge.appendChild(badgeContent);

    const hoverInfo = h('div', { style: `max-height:0;overflow:hidden;transition:max-height .2s,padding .2s;font-size:11px;color:${T.textMuted};padding:0 10px;border-top:0px solid ${T.borderMid}` });
    badge.appendChild(hoverInfo);

    const progressBar = h('div', { style: `height:3px;background:${T.ok};transition:width .3s linear,background .3s;width:100%;border-radius:0 0 8px 8px` });
    badge.appendChild(progressBar);

    badge.addEventListener('mouseenter', () => {
        const interval = getInterval();
        const watches = getWatches();
        const lines = [`Interval: ${formatSeconds(interval)}`];
        if (watches.length > 0) lines.push(`Watches: ${watches.length}`);
        if (paused) lines.push('⏸ Paused');
        hoverInfo.textContent = lines.join(' · ');
        hoverInfo.style.maxHeight = '30px';
        hoverInfo.style.padding = '4px 10px';
        hoverInfo.style.borderTop = `1px solid ${T.borderMid}`;
        badge.style.opacity = '1';
    });
    badge.addEventListener('mouseleave', () => {
        hoverInfo.style.maxHeight = '0';
        hoverInfo.style.padding = '0 10px';
        hoverInfo.style.borderTop = `0px solid ${T.borderMid}`;
        const opacity = Config.get('opacity');
        badge.style.opacity = String(opacity);
    });

    badge.addEventListener('click', (e) => { e.stopPropagation(); openBadgeMenu(); });
    _shadow.appendChild(badge);

    function applyCorner() {
        const corner = Config.get('corner');
        const pos = CORNERS[corner] || CORNERS['bottom-right'];
        badge.style.top = pos.top;
        badge.style.bottom = pos.bottom;
        badge.style.left = pos.left;
        badge.style.right = pos.right;
        badge.style.transform = pos.transform;
    }

    function applyFontSize() {
        const size = Config.get('fontSize');
        badge.style.fontSize = FONT_SIZES[size] || FONT_SIZES['medium'];
    }

    applyCorner();
    applyFontSize();

    function applyTheme(themeName) {
        const theme = THEMES[themeName] || THEMES.dark;
        Object.assign(T, theme);
        Config.set('theme', themeName);
        EventBus.emit('theme:changed', { theme: themeName });
        // Update CSS custom properties — no need to recompile buildCss()
        _themeVars.textContent = buildThemeVars(T);
        // Refresh badge inline styles (outside CSS class control)
        const isMinimal = themeName === 'minimal';
        badge.style.background = T.bgBadge;
        badge.style.boxShadow = isMinimal ? 'none' : `0 2px 8px ${T.shadow}`;
        badge.style.backdropFilter = isMinimal ? 'none' : 'blur(4px)';
        badgeText.style.textShadow = isMinimal ? '0 1px 3px rgba(0,0,0,0.8)' : 'none';
        hoverInfo.style.color = T.textMuted;
        watchDot.style.background = T.cyan;
        progressBar.style.background = T.ok;
        updateBadge();
    }

    function applyBadgeOpacity(val) {
        const opacity = Math.max(0.2, Math.min(1, val));
        Config.set('opacity', opacity);
        badge.style.opacity = String(opacity);
    }

    (function initTheme() {
        const saved = Config.get('theme');
        if (saved !== 'dark') applyTheme(saved);
        const opacity = Config.get('opacity');
        if (opacity < 1) badge.style.opacity = String(opacity);
    })();

    function getUrgencyColor(fraction) {
        if (fraction > 0.25) return T.ok;
        if (fraction > 0.10) return T.warn;
        return T.err;
    }

    function updateBadge() {
        const total = getInterval();
        const fraction = total > 0 ? remaining / total : 1;
        const color = paused ? T.textDim : getUrgencyColor(fraction);

        badgeText.textContent = paused ? `⏸ ${formatCountdown(remaining)}` : `↻ ${formatCountdown(remaining)}`;
        badgeText.style.color = color;

        progressBar.style.width = `${fraction * 100}%`;
        progressBar.style.background = color;

        const watchCount = getWatches().length;
        watchDot.style.display = watchCount > 0 ? 'inline-block' : 'none';

        if (!paused && fraction <= 0.10) {
            badge.style.boxShadow = `0 0 12px ${color}, 0 2px 8px ${T.shadow}`;
        } else {
            badge.style.boxShadow = `0 2px 8px ${T.shadow}`;
        }
    }

    // --- Core Logic ---

    function getInterval() { return Config.get('interval'); }
    function isEnabled() { return GM_getValue(STORAGE_KEY_ENABLED, false); }

    function startRefresh() {
        stopRefresh();
        const seconds = getInterval();
        remaining = seconds;
        updateBadge();
        badge.style.display = 'block';

        countdownTimerId = setInterval(() => {
            remaining--;
            if (remaining <= 0) { location.reload(); return; }
            updateBadge();
        }, 1000);

        GM_setValue(STORAGE_KEY_ENABLED, true);
    }

    function stopRefresh() {
        if (countdownTimerId !== null) { clearInterval(countdownTimerId); countdownTimerId = null; }
        paused = false;
        badge.style.display = 'none';
        GM_setValue(STORAGE_KEY_ENABLED, false);
    }

    function pauseRefresh() {
        if (countdownTimerId !== null) { clearInterval(countdownTimerId); countdownTimerId = null; }
        paused = true;
        updateBadge();
    }

    function resumeRefresh() {
        paused = false;
        if (!isEnabled() || remaining <= 0) return;
        if (countdownTimerId !== null) return;
        countdownTimerId = setInterval(() => {
            remaining--;
            if (remaining <= 0) { location.reload(); return; }
            updateBadge();
        }, 1000);
        updateBadge();
    }

    function openBadgeMenu() {
        if (Modal.isOpen() && Modal.hasInStack('settings')) Modal.push('badge-menu');
        else Modal.open('badge-menu');
    }

    // --- Toast ---

    function showToast(message) {
        _shadow.querySelectorAll('.ar-toast').forEach(t => {
            t.style.top = (parseInt(t.style.top) || 16) + 48 + 'px';
        });

        const toast = h('div', { class: 'ar-toast', text: message });
        toast.style.top = '16px';
        _shadow.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Alert System ---

    let alertIntervalId = null;
    let audioCtx = null;

    function playBeep() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }

    function startAlert() {
        const mode = Config.get('alertMode');
        if (mode === 'speech') return; // speech-only mode doesn't beep
        stopAlert(); playBeep(); alertIntervalId = setInterval(playBeep, 2000);
    }
    function stopAlert() {
        if (alertIntervalId !== null) { clearInterval(alertIntervalId); alertIntervalId = null; }
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    }

    const _ttsAvailable = typeof speechSynthesis !== 'undefined';

    function speak(text) {
        if (!_ttsAvailable) return;
        const mode = Config.get('alertMode');
        if (mode === 'beep') return;
        speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = Config.get('ttsRate');
        utter.volume = Config.get('ttsVolume');
        const voiceName = Config.get('ttsVoice');
        if (voiceName) {
            const voice = speechSynthesis.getVoices().find(v => v.name === voiceName);
            if (voice) utter.voice = voice;
        }
        speechSynthesis.speak(utter);
    }

    function _truncate(str, max = 30) {
        return str.length > max ? str.slice(0, max) + '…' : str;
    }

    function _pageUrl() {
        return location.origin + location.pathname;
    }

    function _pageLabel() {
        return _truncate(document.title || location.hostname);
    }

    // --- Webhook Notifications ---

    let _lastWebhookTime = 0;
    const WEBHOOK_RATE_LIMIT_MS = 30000;
    const WEBHOOK_DEFAULT_TEMPLATE = '{\n  "event": "change_detected",\n  "url": "{{url}}",\n  "selector": "{{selector}}",\n  "summary": "{{summary}}",\n  "timestamp": "{{timestamp}}"\n}';
    const WEBHOOK_TAGS = ['url', 'selector', 'mode', 'summary', 'old_content', 'new_content', 'timestamp'];

    function _getWebhookConfig() {
        const raw = Config.get('webhook');
        if (!raw) return { globalEnabled: false, webhooks: [] };
        // Migrate legacy single-webhook format (v1.9.x)
        if (raw.url !== undefined) {
            const migrated = {
                globalEnabled: raw.enabled !== false && !!raw.url,
                webhooks: raw.url ? [{
                    id: generateId().replace('w_', 'wh_'),
                    label: '',
                    url: raw.url,
                    format: raw.format || 'generic',
                    template: raw.template || '',
                    enabled: raw.enabled !== false
                }] : []
            };
            Config.set('webhook', migrated);
            return migrated;
        }
        return raw;
    }

    function _saveWebhookConfig(config) {
        Config.set('webhook', config);
    }

    function _webhookDisplayLabel(wh) {
        if (wh.label) return wh.label;
        if (wh.url) return _truncate(wh.url);
        return '(no URL)';
    }

    function _replaceTemplateTags(template, details) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, tag) => {
            return Object.prototype.hasOwnProperty.call(details, tag) ? String(details[tag]) : match;
        });
    }

    function formatWebhookPayload(format, details, template) {
        const url = details.url || '';
        const selector = details.selector || '';
        const oldContent = details.old_content || '';
        const newContent = details.new_content || '';
        const timestamp = details.timestamp || new Date().toISOString();

        if (format === 'slack') {
            return {
                blocks: [{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `🔔 *Change Detected*\n>*URL:* ${url}\n>*Element:* \`${selector}\`\n>*Old:* ${oldContent}\n>*New:* ${newContent}`
                    }
                }]
            };
        }
        if (format === 'discord') {
            return {
                embeds: [{
                    title: '🔔 Change Detected',
                    color: 5814783,
                    fields: [
                        { name: 'URL', value: url, inline: false },
                        { name: 'Element', value: `\`${selector}\``, inline: true },
                        { name: 'Old', value: oldContent || '(empty)', inline: true },
                        { name: 'New', value: newContent || '(empty)', inline: true }
                    ],
                    timestamp
                }]
            };
        }
        if (format === 'teams') {
            return {
                type: 'message',
                attachments: [{
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                        type: 'AdaptiveCard',
                        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                        version: '1.4',
                        body: [
                            { type: 'TextBlock', text: '🔔 Change Detected', weight: 'Bolder', size: 'Medium' },
                            { type: 'FactSet', facts: [
                                { title: 'URL', value: url },
                                { title: 'Element', value: selector },
                                { title: 'Old', value: oldContent || '(empty)' },
                                { title: 'New', value: newContent || '(empty)' }
                            ]},
                            { type: 'TextBlock', text: timestamp, isSubtle: true, size: 'Small' }
                        ]
                    }
                }]
            };
        }
        // generic — use template
        const tmpl = template || WEBHOOK_DEFAULT_TEMPLATE;
        try {
            return JSON.parse(_replaceTemplateTags(tmpl, details));
        } catch {
            return { event: 'change_detected', ...details };
        }
    }

    function sendWebhook(changeDetails) {
        const config = _getWebhookConfig();
        if (!config.globalEnabled) return;

        const now = Date.now();
        if (now - _lastWebhookTime < WEBHOOK_RATE_LIMIT_MS) return;

        const activeWebhooks = config.webhooks.filter(wh => wh.enabled && wh.url);
        if (activeWebhooks.length === 0) return;

        _lastWebhookTime = now;

        for (const wh of activeWebhooks) {
            const payload = formatWebhookPayload(wh.format, changeDetails, wh.template);
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: wh.url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    onload: (res) => {
                        if (res.status >= 400) console.warn(`[AutoRefresh] Webhook "${wh.label || wh.url}" failed:`, res.status, res.responseText);
                    },
                    onerror: (err) => {
                        console.warn(`[AutoRefresh] Webhook "${wh.label || wh.url}" error:`, err);
                    }
                });
            } catch (err) {
                console.warn(`[AutoRefresh] Webhook "${wh.label || wh.url}" send error:`, err);
            }
        }
    }

    function sendTestWebhook(config) {
        const details = {
            url: location.href,
            selector: '#example',
            mode: 'content',
            summary: 'Test webhook from Auto Refresh',
            old_content: 'old value',
            new_content: 'new value',
            timestamp: new Date().toISOString()
        };
        const payload = formatWebhookPayload(config.format, details, config.template);

        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: config.url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    onload: (res) => {
                        resolve({ ok: res.status >= 200 && res.status < 400, status: res.status });
                    },
                    onerror: () => {
                        resolve({ ok: false, status: 0 });
                    }
                });
            } catch {
                resolve({ ok: false, status: 0 });
            }
        });
    }

    // --- Modal Framework ---

    const Modal = (() => {
        const defs = {};
        const stack = [];
        let _modalOpen = false;

        function _createOverlay(id) {
            const existing = _shadow.querySelector('#' + CSS.escape(id));
            if (existing) existing.remove();
            const overlay = h('div', { id, class: 'ar-overlay' });
            return overlay;
        }

        function _createPanel(def) {
            const panel = h('div', { class: 'ar-panel' });
            if (def.minWidth) panel.style.minWidth = def.minWidth;
            if (def.maxWidth) panel.style.maxWidth = def.maxWidth;
            panel.appendChild(h('div', { class: 'ar-title', text: def.title }));
            return panel;
        }

        function _addChrome(panel, def, isSubModal) {
            const titleEl = panel.firstElementChild;
            if (isSubModal) {
                const backBtn = h('button', { class: 'ar-back-btn', text: '← Back', onclick: () => pop() });
                panel.insertBefore(backBtn, titleEl);
            }
            if (def.subtitle) {
                titleEl.insertAdjacentElement('afterend', h('div', { class: 'ar-subtitle', text: def.subtitle }));
            }
        }

        function _setupKeyboard(panel, overlay, entry) {
            let focusIndex = -1;

            function getFocusables() { return Array.from(panel.querySelectorAll('button, input')).filter(el => el.offsetParent !== null); }

            function setFocus(index) {
                const items = getFocusables();
                if (items.length === 0) return;
                focusIndex = ((index % items.length) + items.length) % items.length;
                items.forEach((el, i) => {
                    el.style.outline = i === focusIndex ? `2px solid ${T.textLight}` : 'none';
                    el.style.outlineOffset = i === focusIndex ? '-2px' : '';
                });
                items[focusIndex].focus();
                items[focusIndex].scrollIntoView({ block: 'nearest' });
            }

            function clearFocusOutline() {
                focusIndex = -1;
                getFocusables().forEach(el => { el.style.outline = 'none'; el.style.outlineOffset = ''; });
            }

            const onKey = (e) => {
                if (e.key === 'Escape') { pop(); return; }
                if (matchesHotkey(e)) { e.preventDefault(); e.stopImmediatePropagation(); closeAll(); return; }
                const items = getFocusables();
                if (items.length === 0) return;
                const activeIsInput = items[focusIndex]?.tagName === 'INPUT';
                if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focusIndex + 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focusIndex === -1 ? -1 : focusIndex - 1); }
                else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < items.length) {
                    if (activeIsInput) return;
                    e.preventDefault();
                    items[focusIndex].click();
                }
            };

            document.addEventListener('keydown', onKey);
            panel.addEventListener('mousedown', clearFocusOutline);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) pop(); });
            entry.removeKeyboard = () => document.removeEventListener('keydown', onKey);
        }

        function _show(id, extra) {
            const def = defs[id];
            if (!def) throw new Error(`Modal "${id}" not defined`);
            const isSubModal = stack.length > 0;

            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                top.overlay.style.display = 'none';
                top.removeKeyboard();
            }

            if (stack.length === 0) pauseRefresh();

            const overlay = _createOverlay('auto-refresh-mf-' + id);
            const panel = _createPanel(def);
            _addChrome(panel, def, isSubModal);

            const cleanups = [];
            const entry = { id, overlay, panel, cleanups, removeKeyboard: null };

            const ctx = {
                push: (nextId, nextExtra) => _show(nextId, nextExtra),
                pop,
                close: () => pop(),
                closeAll,
                cleanups,
                extra: extra || {},
                addFooter: (text) => {
                    const f = h('div', { class: 'ar-footer', text: text || 'Press Esc to go back' });
                    panel.appendChild(f);
                },
            };

            def.build(panel, ctx);

            if (!def.noAutoFooter && !panel.querySelector('[data-modal-footer]')) {
                const footerText = isSubModal ? 'Press Esc to go back' : (def.footerText || null);
                if (footerText) {
                    const f = h('div', { class: 'ar-footer', 'data-modal-footer': '' });
                    f.textContent = footerText;
                    panel.appendChild(f);
                }
            }

            _setupKeyboard(panel, overlay, entry);
            stack.push(entry);

            overlay.appendChild(panel);
            _shadow.appendChild(overlay);
            _modalOpen = true;
            requestAnimationFrame(() => { panel.style.opacity = '1'; panel.style.transform = 'scale(1)'; });
        }

        function pop() {
            if (stack.length === 0) return;
            const entry = stack.pop();
            entry.removeKeyboard();
            entry.cleanups.forEach(fn => fn());
            entry.overlay.remove();

            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                top.overlay.style.display = 'flex';
                _setupKeyboard(top.panel, top.overlay, top);
            } else {
                _modalOpen = false;
                resumeRefresh();
            }
        }

        function closeAll() {
            while (stack.length > 0) {
                const entry = stack.pop();
                entry.removeKeyboard();
                entry.cleanups.forEach(fn => fn());
                entry.overlay.remove();
            }
            _modalOpen = false;
            resumeRefresh();
        }

        function open(id, extra) { closeAll(); _show(id, extra); }

        function define(id, def) {
            // Auto-generate build function for picker-type modals
            if (def.type === 'picker' && !def.build) {
                def.build = (panel) => {
                    const current = def.current();
                    def.options.forEach(({ key, label, subtitle: sub }) => {
                        panel.appendChild(makeOptionBtn(label, key === current, () => {
                            def.onSelect(key, label);
                            if (def.returnTo) Modal.open(def.returnTo);
                            if (def.toastTemplate) showToast(def.toastTemplate.replace('{label}', label));
                        }, sub ? { subtitle: sub } : {}));
                    });
                };
            }
            defs[id] = def;
        }
        function isOpen() { return _modalOpen; }
        function currentId() { return stack.length > 0 ? stack[stack.length - 1].id : null; }
        function hasInStack(id) { return stack.some(e => e.id === id); }

        return { define, open, push: _show, pop, closeAll, isOpen, currentId, hasInStack };
    })();

    // --- Modal Definitions ---

    Modal.define('fontsize-picker', {
        title: 'Badge Font Size',
        subtitle: 'Size of the countdown badge text',
        build: (panel) => {
            const current = Config.get('fontSize');
            [
                { key: 'small', label: 'Small' },
                { key: 'medium', label: 'Medium' },
                { key: 'large', label: 'Large' },
                { key: 'extra-large', label: 'Extra Large' }
            ].forEach(({ key, label }) => {
                const btn = makeOptionBtn(label, key === current, () => {
                    Config.set('fontSize', key);
                    applyFontSize();
                    Modal.open('settings');
                    showToast(`Font size set to ${label}`);
                });
                btn.appendChild(h('div', {
                    text: '↻ 30s',
                    style: `font:bold ${FONT_SIZES[key]} monospace;color:${T.ok};margin-top:4px;opacity:0.6`
                }));
                panel.appendChild(btn);
            });
        }
    });

    Modal.define('theme-picker', {
        title: 'Theme',
        subtitle: 'Choose a visual style',
        build: (panel) => {
            const current = Config.get('theme');
            [
                { key: 'dark', label: 'Dark', desc: 'Dark background, light text' },
                { key: 'light', label: 'Light', desc: 'Light background, dark text' },
                { key: 'minimal', label: 'Minimal', desc: 'Text only, transparent background' },
                { key: 'highContrast', label: 'High Contrast', desc: 'Maximum visibility' }
            ].forEach(({ key, label, desc }) => {
                const theme = THEMES[key];
                const btn = makeOptionBtn(label, key === current, () => {
                    applyTheme(key);
                    Modal.open('settings');
                    showToast(`Theme set to ${label}`);
                }, { subtitle: desc });
                // Live badge preview
                const isMin = key === 'minimal';
                const preview = h('div', {
                    style: [
                        `background:${theme.bgBadge}`,
                        `color:${theme.ok}`,
                        'font:bold 13px monospace',
                        'padding:4px 8px',
                        'border-radius:6px',
                        'margin-top:6px',
                        'display:inline-block',
                        isMin ? 'text-shadow:0 1px 3px rgba(0,0,0,0.8)' : '',
                        isMin ? '' : `box-shadow:0 1px 4px ${theme.shadow}`
                    ].filter(Boolean).join(';'),
                    text: '↻ 8s'
                });
                btn.appendChild(preview);
                panel.appendChild(btn);
            });
        }
    });

    Modal.define('opacity-picker', {
        title: 'Badge Opacity',
        subtitle: 'Transparency of the countdown badge',
        build: (panel) => {
            const current = Config.get('opacity');
            const pct = Math.round(current * 100);

            const previewWrap = h('div', { style: 'text-align:center;margin-bottom:12px' });
            const previewBadge = h('div', {
                style: [
                    `background:${T.bgBadge}`,
                    `color:${T.ok}`,
                    'font:bold 13px monospace',
                    'padding:6px 10px',
                    'border-radius:8px',
                    'display:inline-block',
                    `opacity:${current}`,
                    `box-shadow:0 2px 8px ${T.shadow}`,
                    Config.get('theme') === 'minimal' ? 'text-shadow:0 1px 3px rgba(0,0,0,0.8)' : ''
                ].filter(Boolean).join(';'),
                text: '↻ 30s'
            });
            previewWrap.appendChild(previewBadge);
            panel.appendChild(previewWrap);

            const label = h('div', { text: `${pct}%`, style: `text-align:center;font-size:13px;color:${T.textMuted};margin-bottom:8px` });
            panel.appendChild(label);

            const slider = h('input', {
                type: 'range', min: '20', max: '100', step: '10',
                style: 'width:100%;accent-color:' + T.accent
            });
            slider.value = String(pct);
            slider.addEventListener('input', () => {
                const val = parseInt(slider.value, 10) / 100;
                previewBadge.style.opacity = String(val);
                label.textContent = slider.value + '%';
            });
            slider.addEventListener('change', () => {
                const val = parseInt(slider.value, 10) / 100;
                applyBadgeOpacity(val);
                showToast(`Badge opacity set to ${slider.value}%`);
            });
            panel.appendChild(slider);

            const steps = h('div', { style: `display:flex;justify-content:space-between;font-size:10px;color:${T.textFaint};margin-top:2px` });
            steps.appendChild(h('span', { text: '20%' }));
            steps.appendChild(h('span', { text: '100%' }));
            panel.appendChild(steps);
        }
    });

    Modal.define('position-picker', {
        title: 'Badge Position',
        subtitle: 'Where the countdown timer appears',
        build: (panel) => {
            const current = Config.get('corner');
            const grid = h('div', { class: 'ar-grid' });

            ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].forEach(choice => {
                const btn = makeOptionBtn(CORNER_LABELS[choice], choice === current, () => {
                    Config.set('corner', choice);
                    applyCorner();
                    Modal.open('settings');
                    showToast(`Badge position set to ${CORNER_LABELS[choice]}`);
                });
                btn.classList.add('ar-grid-btn');
                grid.appendChild(btn);
            });
            panel.appendChild(grid);
        }
    });

    Modal.define('interval-picker', {
        title: 'Refresh Interval',
        subtitle: 'How often the page reloads',
        build: (panel) => {
            const current = getInterval();

            function addGroup(label, presets) {
                addSection(panel, label);
                presets.forEach(seconds => {
                    panel.appendChild(makeOptionBtn(formatSeconds(seconds), seconds === current, () => {
                        Config.set('interval', seconds);
                        if (isEnabled()) startRefresh();
                        Modal.open('settings');
                        showToast(`Refresh interval set to ${formatSeconds(seconds)}`);
                    }));
                });
            }

            addGroup('Seconds', [5, 10, 15, 30]);
            addGroup('Minutes', [60, 120, 300, 600]);

            addSection(panel, 'Custom');
            const customRow = h('div', { style: 'display:flex;gap:6px' });

            const input = h('input', {
                class: 'ar-input',
                type: 'number', min: '1', max: '86400',
                placeholder: 'Seconds (1\u201386400)',
                style: 'flex:1'
            });
            input.value = [5, 10, 15, 30, 60, 120, 300, 600].includes(current) ? '' : current;

            const applyBtn = h('button', {
                text: 'Set',
                class: 'ar-btn-accent',
                onclick: () => {
                    const value = parseInt(input.value, 10);
                    if (isNaN(value) || value < 1 || value > 86400) { input.style.borderColor = T.err; return; }
                    Config.set('interval', value);
                    if (isEnabled()) startRefresh();
                    Modal.open('settings');
                    showToast(`Refresh interval set to ${formatSeconds(value)}`);
                }
            });

            customRow.appendChild(input);
            customRow.appendChild(applyBtn);
            panel.appendChild(customRow);
        }
    });

    Modal.define('hotkey-picker', {
        title: 'Keyboard Shortcut',
        subtitle: 'Press a key combination with at least one modifier',
        minWidth: '320px',
        build: (panel, ctx) => {
            const current = Config.get('hotkey');
            const currentRow = h('div', { style: 'margin-bottom:10px;display:flex;align-items:center;gap:8px' });
            currentRow.appendChild(h('span', { text: 'Current:', style: `color:${T.textMuted};font-size:13px` }));
            current.split('+').forEach(key => {
                currentRow.appendChild(h('kbd', { class: 'ar-kbd', text: key }));
            });
            panel.appendChild(currentRow);

            const stateLabel = h('div', { style: `font-size:11px;color:${T.textFaint};margin-bottom:4px;text-align:center;min-height:16px` });
            panel.appendChild(stateLabel);

            const display = h('div', { class: 'ar-capture-box', text: 'Press your desired key combination...' });
            panel.appendChild(display);

            function renderKeys(parts, state) {
                display.innerHTML = '';
                const isConfirmed = state === 'confirmed';
                const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
                parts.forEach(key => {
                    const isModifier = modifiers.includes(key);
                    const color = isConfirmed ? T.ok : isModifier ? T.textLight : T.cyan;
                    const borderColor = isConfirmed ? T.okBright : isModifier ? T.borderLight : T.accent;
                    display.appendChild(h('kbd', {
                        text: key,
                        style: `display:inline-block;padding:4px 10px;background:${T.bgMid};border:1px solid ${borderColor};border-radius:5px;font:bold 14px monospace;color:${color};box-shadow:0 2px 0 ${T.bgDarker};min-width:28px;text-align:center`
                    }));
                });
                display.style.borderColor = isConfirmed ? T.ok : state === 'live' ? T.accent : T.borderLight;
            }

            let errorActive = false;

            function renderError(message) {
                errorActive = true;
                stateLabel.textContent = '';
                display.style.borderColor = T.err;
                display.innerHTML = '';
                display.textContent = message;
                display.style.color = T.err;
                setTimeout(() => {
                    errorActive = false;
                    stateLabel.textContent = '';
                    display.textContent = 'Press your desired key combination...';
                    display.style.borderColor = T.borderLight;
                    display.style.color = T.textDim;
                }, 3000);
            }

            const onCapture = (e) => {
                if (e.key === 'Escape') return;
                e.preventDefault();
                e.stopPropagation();

                const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
                const liveParts = [];
                if (e.ctrlKey) liveParts.push('Ctrl');
                if (e.altKey) liveParts.push('Alt');
                if (e.shiftKey) liveParts.push('Shift');
                if (e.metaKey) liveParts.push('Meta');

                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                    stateLabel.textContent = 'Recording... now press a key';
                    stateLabel.style.color = T.accent;
                    renderKeys(liveParts, 'live');
                    return;
                }

                if (!hasModifier) { renderError('At least one modifier key required'); return; }

                liveParts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                const combo = liveParts.join('+');

                if (BROWSER_RESERVED.has(combo)) { renderError(`${combo} is reserved by the browser`); return; }

                Config.set('hotkey', combo);
                document.removeEventListener('keydown', onCapture, true);
                document.removeEventListener('keyup', onKeyUp, true);
                stateLabel.textContent = '✓ Shortcut saved';
                stateLabel.style.color = T.ok;
                renderKeys(liveParts, 'confirmed');
                display.style.background = T.okFaint;
                showToast(`Shortcut set to ${combo}`);
                setTimeout(() => Modal.open('settings'), 1200);
            };

            const onKeyUp = (e) => {
                if (errorActive) return;
                const liveParts = [];
                if (e.ctrlKey) liveParts.push('Ctrl');
                if (e.altKey) liveParts.push('Alt');
                if (e.shiftKey) liveParts.push('Shift');
                if (e.metaKey) liveParts.push('Meta');
                if (liveParts.length > 0) {
                    stateLabel.textContent = 'Recording... now press a key';
                    stateLabel.style.color = T.accent;
                    renderKeys(liveParts, 'live');
                } else {
                    stateLabel.textContent = '';
                    display.innerHTML = '';
                    display.textContent = 'Press your desired key combination...';
                    display.style.color = T.textDim;
                    display.style.borderColor = T.borderLight;
                }
            };

            ctx.cleanups.push(
                addDocListener('keydown', onCapture, true),
                addDocListener('keyup', onKeyUp, true)
            );

            if (current !== DEFAULT_HOTKEY) {
                panel.appendChild(h('button', {
                    class: 'ar-link-btn ar-link-btn-center',
                    text: 'Reset to default (Alt+Shift+R)',
                    onclick: () => {
                        Config.set('hotkey', DEFAULT_HOTKEY);
                        document.removeEventListener('keydown', onCapture, true);
                        document.removeEventListener('keyup', onKeyUp, true);
                        stateLabel.textContent = '✓ Reset to default';
                        stateLabel.style.color = T.ok;
                        renderKeys(DEFAULT_HOTKEY.split('+'), 'confirmed');
                        display.style.background = T.okFaint;
                        showToast(`Shortcut reset to ${DEFAULT_HOTKEY}`);
                        setTimeout(() => Modal.open('settings'), 1200);
                    }
                }));
            }
        }
    });

    // --- TTS Alert Mode Pickers ---

    const ALERT_MODE_OPTIONS = [
        { key: 'beep', label: 'Beep Only', desc: 'Repeating tone (default)' },
        { key: 'speech', label: 'Speech Only', desc: 'Announce changes aloud' },
        { key: 'both', label: 'Beep + Speech', desc: 'Tone followed by announcement' }
    ];

    const ALERT_MODE_LABELS = { beep: 'Beep', speech: 'Speech', both: 'Both' };

    const TTS_RATE_OPTIONS = [
        { key: 0.7, label: 'Slow' },
        { key: 1.0, label: 'Normal' },
        { key: 1.3, label: 'Fast' },
        { key: 1.6, label: 'Very Fast' }
    ];

    const TTS_VOLUME_OPTIONS = [
        { key: 0.25, label: '25%' },
        { key: 0.5, label: '50%' },
        { key: 0.75, label: '75%' },
        { key: 1.0, label: '100%' }
    ];

    Modal.define('tts-speed-picker', {
        title: 'Speech Speed',
        subtitle: 'How fast the announcement is spoken',
        type: 'picker',
        current: () => Config.get('ttsRate'),
        options: TTS_RATE_OPTIONS.map(o => ({ key: o.key, label: o.label })),
        onSelect: (key) => {
            Config.set('ttsRate', key);
            Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
        },
        toastTemplate: 'Speech speed set to {label}',
    });

    Modal.define('tts-volume-picker', {
        title: 'Speech Volume',
        subtitle: 'Volume of the spoken announcement',
        type: 'picker',
        current: () => Config.get('ttsVolume'),
        options: TTS_VOLUME_OPTIONS.map(o => ({ key: o.key, label: o.label })),
        onSelect: (key) => {
            Config.set('ttsVolume', key);
            Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
        },
        toastTemplate: 'Speech volume set to {label}',
    });

    Modal.define('tts-voice-picker', {
        title: 'Speech Voice',
        subtitle: 'Choose a system voice for announcements',
        build: (panel) => {
            const current = Config.get('ttsVoice');
            const container = h('div', { class: 'ar-scroll-container' });
            panel.appendChild(container);

            function shortName(name) {
                return name.replace(/^Microsoft\s+/, '').replace(/\s+Online\b/, '');
            }

            // Strip language description when already shown via section header
            function voiceOnly(name) {
                return shortName(name).replace(/\s*-\s*.+$/, '');
            }

            function renderVoices(showAll) {
                container.innerHTML = '';
                const voices = speechSynthesis.getVoices();
                if (voices.length === 0) {
                    container.appendChild(h('div', { class: 'ar-empty-state', text: 'No voices available' }));
                    return;
                }

                // Default option
                container.appendChild(makeOptionBtn('Default', current === '', () => {
                    Config.set('ttsVoice', '');
                    Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
                    showToast('Voice set to Default');
                }, { subtitle: 'Browser default voice' }));

                // Group by language
                const byLang = {};
                voices.forEach(v => {
                    const lang = v.lang.split('-')[0];
                    if (!byLang[lang]) byLang[lang] = [];
                    byLang[lang].push(v);
                });

                const browserLang = (navigator.language || 'en').split('-')[0];
                const grouped = showAll || !byLang[browserLang];
                const langsToShow = showAll
                    ? Object.keys(byLang).sort((a, b) => {
                        if (a === browserLang) return -1;
                        if (b === browserLang) return 1;
                        return a.localeCompare(b);
                    })
                    : (byLang[browserLang] ? [browserLang] : Object.keys(byLang).slice(0, 1));

                langsToShow.forEach((lang, li) => {
                    if (langsToShow.length > 1) {
                        const hdr = h('div', { class: li > 0 ? 'ar-section-hdr ar-section-hdr-sep' : 'ar-section-hdr', text: lang.toUpperCase() });
                        container.appendChild(hdr);
                    }
                    byLang[lang].forEach(v => {
                        const label = grouped && langsToShow.length > 1 ? voiceOnly(v.name) : shortName(v.name);
                        container.appendChild(makeOptionBtn(label, v.name === current, () => {
                            Config.set('ttsVoice', v.name);
                            Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
                            showToast(`Voice set to ${shortName(v.name)}`);
                        }, { subtitle: v.lang }));
                    });
                });

                if (!showAll && Object.keys(byLang).length > 1) {
                    const otherCount = Object.keys(byLang).length - langsToShow.length;
                    container.appendChild(h('button', {
                        class: 'ar-link-btn ar-link-btn-center',
                        text: `Show all languages (${otherCount} more)`,
                        style: 'margin-top:6px',
                        onclick: () => renderVoices(true)
                    }));
                }
            }

            renderVoices(false);
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', () => renderVoices(false), { once: true });
            }
        }
    });

    Modal.define('alert-mode-picker', {
        title: 'Alert Mode',
        subtitle: 'How you are notified when a watch detects a change',
        build: (panel, ctx) => {
            const currentMode = Config.get('alertMode');

            ALERT_MODE_OPTIONS.forEach(({ key, label, desc }) => {
                panel.appendChild(makeOptionBtn(label, key === currentMode, () => {
                    Config.set('alertMode', key);
                    Modal.pop(); Modal.push('alert-mode-picker');
                    showToast(`Alert mode set to ${label}`);
                }, { subtitle: desc }));
            });

            if (_ttsAvailable) {
                const showSpeechSettings = currentMode === 'speech' || currentMode === 'both';
                if (showSpeechSettings) {
                    addSection(panel, 'Speech Settings');

                    const voiceName = Config.get('ttsVoice');
                    const voiceLabel = voiceName ? voiceName.replace(/^Microsoft\s+/, '').replace(/\s+Online\b/, '') : 'Default';
                    panel.appendChild(makeOptionBtn('🗣 Voice', false, () => ctx.push('tts-voice-picker'),
                        { value: voiceLabel, subtitle: 'System voice for announcements' }));

                    const rate = Config.get('ttsRate');
                    const rateLabel = (TTS_RATE_OPTIONS.find(o => o.key === rate) || { label: 'Normal' }).label;
                    panel.appendChild(makeOptionBtn('⏩ Speed', false, () => ctx.push('tts-speed-picker'),
                        { value: rateLabel, subtitle: 'How fast the announcement is spoken' }));

                    const vol = Config.get('ttsVolume');
                    const volLabel = Math.round(vol * 100) + '%';
                    panel.appendChild(makeOptionBtn('🔊 Volume', false, () => ctx.push('tts-volume-picker'),
                        { value: volLabel, subtitle: 'Volume of the spoken announcement' }));

                    panel.appendChild(makeOptionBtn('▶ Test Speech', false, () => {
                        speak('Watch changed: sample content updated.');
                    }, { subtitle: 'Preview the current speech settings' }));
                }
            } else {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: 'Speech synthesis is not available in this browser.' }));
            }
        }
    });

    // --- Webhook Modals ---

    const WEBHOOK_FORMAT_OPTIONS = [
        { key: 'slack', label: 'Slack', desc: 'Block Kit message' },
        { key: 'discord', label: 'Discord', desc: 'Embed message' },
        { key: 'teams', label: 'Teams', desc: 'Adaptive Card' },
        { key: 'generic', label: 'Generic JSON', desc: 'Custom template' }
    ];
    const WEBHOOK_FORMAT_LABELS = { slack: 'Slack', discord: 'Discord', teams: 'Teams', generic: 'Generic JSON' };

    Modal.define('webhook-list', {
        title: 'Webhook Notifications',
        subtitle: 'Send alerts to external services',
        minWidth: '380px',
        build: (panel, ctx) => {
            let config = _getWebhookConfig();

            // Global toggle
            const globalRow = h('button', { class: 'ar-toggle-row', style: 'margin-bottom:10px' });
            const globalLabel = h('div');
            globalLabel.appendChild(h('div', { text: 'Webhooks Enabled', style: `font-size:14px;color:${T.text}` }));
            globalLabel.appendChild(h('div', { class: 'ar-subtitle-sm', text: 'Global kill switch for all webhooks' }));

            const trackW = 40, thumbSize = 18;
            const gToggle = h('div', {
                class: 'ar-toggle-track',
                style: `background:${config.globalEnabled ? T.accent : T.borderLight}`
            });
            const gThumb = h('div', {
                class: 'ar-toggle-thumb',
                style: `left:${config.globalEnabled ? trackW - thumbSize - 2 + 'px' : '2px'}`
            });
            gToggle.appendChild(gThumb);

            const listContainer = h('div');

            function setGlobalToggle(on) {
                gToggle.style.background = on ? T.accent : T.borderLight;
                gThumb.style.left = on ? `${trackW - thumbSize - 2}px` : '2px';
                // Dim/undim webhook rows
                listContainer.style.opacity = on ? '1' : '0.5';
            }

            globalRow.addEventListener('click', () => {
                config.globalEnabled = !config.globalEnabled;
                setGlobalToggle(config.globalEnabled);
                _saveWebhookConfig(config);
                showToast(config.globalEnabled ? 'Webhooks enabled' : 'Webhooks disabled');
            });
            globalRow.appendChild(globalLabel);
            globalRow.appendChild(gToggle);
            panel.appendChild(globalRow);

            // Webhook list
            function renderList() {
                listContainer.innerHTML = '';
                config = _getWebhookConfig();

                const count = config.webhooks.length;
                addSection(listContainer, `Webhooks${count > 0 ? ` (${count})` : ''}`);

                if (count === 0) {
                    listContainer.appendChild(h('div', { class: 'ar-empty-state', text: 'No webhooks configured yet' }));
                } else {
                    config.webhooks.forEach((wh) => {
                        const row = h('button', { class: 'ar-btn', style: 'display:flex;align-items:center;gap:8px' });
                        const dotColor = wh.enabled ? T.ok : T.textFaint;
                        row.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}` }));

                        const info = h('div', { class: 'ar-flex-fill', style: 'min-width:0' });
                        info.appendChild(h('div', { class: 'ar-truncate', text: _webhookDisplayLabel(wh) }));
                        const formatLabel = WEBHOOK_FORMAT_LABELS[wh.format] || wh.format;
                        info.appendChild(h('div', { class: 'ar-subtitle-sm', text: formatLabel }));
                        row.appendChild(info);

                        // Inline toggle
                        const iTrack = h('button', {
                            class: 'ar-toggle-track-sm',
                            style: `background:${wh.enabled ? T.accent : T.borderLight}`
                        });
                        const iThumb = h('div', {
                            class: 'ar-toggle-thumb-sm',
                            style: `left:${wh.enabled ? '18px' : '2px'}`
                        });
                        iTrack.appendChild(iThumb);

                        iTrack.addEventListener('click', (e) => {
                            e.stopPropagation();
                            wh.enabled = !wh.enabled;
                            iTrack.style.background = wh.enabled ? T.accent : T.borderLight;
                            iThumb.style.left = wh.enabled ? '18px' : '2px';
                            row.querySelector('.ar-dot').style.background = wh.enabled ? T.ok : T.textFaint;
                            _saveWebhookConfig(config);
                        });
                        row.appendChild(iTrack);

                        row.addEventListener('click', () => {
                            ctx.push('webhook-edit', { webhookId: wh.id });
                        });

                        listContainer.appendChild(row);
                    });
                }

                listContainer.style.opacity = config.globalEnabled ? '1' : '0.5';
            }

            renderList();
            panel.appendChild(listContainer);

            // Add webhook button
            panel.appendChild(makeOptionBtn('➕ Add Webhook', false, () => {
                ctx.push('webhook-edit', { webhookId: null });
            }, { subtitle: 'Configure a new webhook endpoint' }));

            // Re-render settings when leaving webhook-list via Back/Escape
            // (but not when webhook-edit pops and re-pushes webhook-list)
            ctx.cleanups.push(() => {
                setTimeout(() => {
                    if (!Modal.hasInStack('webhook-list')) Modal.open('settings');
                }, 0);
            });
        }
    });

    Modal.define('webhook-edit', {
        title: 'Webhook',
        subtitle: 'Configure this webhook endpoint',
        minWidth: '380px',
        build: (panel, ctx) => {
            const config = _getWebhookConfig();
            const webhookId = ctx.extra && ctx.extra.webhookId;
            const existing = webhookId ? config.webhooks.find(wh => wh.id === webhookId) : null;
            const isNew = !existing;

            // Override title
            panel.querySelector('.ar-title').textContent = isNew ? 'Add Webhook' : 'Edit Webhook';

            let currentLabel = existing ? (existing.label || '') : '';
            let currentUrl = existing ? (existing.url || '') : '';
            let currentFormat = existing ? (existing.format || 'generic') : 'generic';
            let currentTemplate = existing ? (existing.template || WEBHOOK_DEFAULT_TEMPLATE) : WEBHOOK_DEFAULT_TEMPLATE;

            // Label input
            addSection(panel, 'Label (Optional)');
            const labelInput = h('input', {
                class: 'ar-input',
                type: 'text',
                placeholder: 'e.g., Team Slack, Logging Server',
                style: 'width:100%;box-sizing:border-box;margin-bottom:10px'
            });
            labelInput.value = currentLabel;
            labelInput.addEventListener('input', () => { currentLabel = labelInput.value.trim(); });
            panel.appendChild(labelInput);

            // URL input
            addSection(panel, 'Webhook URL');
            const urlInput = h('input', {
                class: 'ar-input',
                type: 'text',
                placeholder: 'https://hooks.slack.com/services/...',
                style: 'width:100%;box-sizing:border-box;margin-bottom:10px'
            });
            urlInput.value = currentUrl;
            urlInput.addEventListener('input', () => { currentUrl = urlInput.value.trim(); });
            panel.appendChild(urlInput);

            // Format picker
            addSection(panel, 'Format');
            const formatContainer = h('div');
            const templateSection = h('div');

            function renderFormatButtons() {
                formatContainer.innerHTML = '';
                WEBHOOK_FORMAT_OPTIONS.forEach(({ key, label, desc }) => {
                    formatContainer.appendChild(makeOptionBtn(label, key === currentFormat, () => {
                        currentFormat = key;
                        renderFormatButtons();
                        renderTemplateSection();
                    }, { subtitle: desc }));
                });
            }

            function renderTemplateSection() {
                templateSection.innerHTML = '';
                if (currentFormat !== 'generic') return;

                addSection(templateSection, 'Available Tags');
                const chips = h('div', { class: 'ar-tag-chips' });
                WEBHOOK_TAGS.forEach(tag => {
                    const chip = h('button', { class: 'ar-tag-chip', text: tag });
                    chip.addEventListener('click', () => {
                        const ta = templateSection.querySelector('textarea');
                        if (!ta) return;
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const insert = `{{${tag}}}`;
                        ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
                        currentTemplate = ta.value;
                        ta.focus();
                        ta.selectionStart = ta.selectionEnd = start + insert.length;
                    });
                    chips.appendChild(chip);
                });
                templateSection.appendChild(chips);

                addSection(templateSection, 'Message Template');
                const textarea = h('textarea', { class: 'ar-textarea' });
                textarea.value = currentTemplate;
                textarea.addEventListener('input', () => { currentTemplate = textarea.value; });
                templateSection.appendChild(textarea);
            }

            renderFormatButtons();
            panel.appendChild(formatContainer);
            renderTemplateSection();
            panel.appendChild(templateSection);

            // Action buttons
            const actions = h('div', { style: 'display:flex;gap:8px;margin-top:14px' });

            const testBtn = h('button', { text: '🧪 Send Test', class: 'ar-btn' });
            testBtn.addEventListener('click', async () => {
                if (!currentUrl) { showToast('Enter a webhook URL first'); urlInput.style.borderColor = T.err; return; }
                try { new URL(currentUrl); } catch { showToast('Invalid URL'); urlInput.style.borderColor = T.err; return; }
                urlInput.style.borderColor = '';
                testBtn.textContent = '⏳ Sending...';
                testBtn.disabled = true;
                const result = await sendTestWebhook({ url: currentUrl, format: currentFormat, template: currentTemplate });
                testBtn.textContent = '🧪 Send Test';
                testBtn.disabled = false;
                if (result.ok) {
                    showToast('✅ Test webhook sent successfully');
                } else {
                    showToast(`❌ Webhook failed (${result.status || 'network error'})`);
                }
            });

            const saveBtn = h('button', { text: '💾 Save', class: 'ar-btn-accent' });
            saveBtn.addEventListener('click', () => {
                if (!currentUrl) { showToast('Enter a webhook URL'); urlInput.style.borderColor = T.err; return; }
                try { new URL(currentUrl); } catch { showToast('Invalid URL'); urlInput.style.borderColor = T.err; return; }
                urlInput.style.borderColor = '';

                const freshConfig = _getWebhookConfig();
                if (isNew) {
                    freshConfig.webhooks.push({
                        id: generateId().replace('w_', 'wh_'),
                        label: currentLabel,
                        url: currentUrl,
                        format: currentFormat,
                        template: currentTemplate,
                        enabled: !!currentUrl
                    });
                } else {
                    const idx = freshConfig.webhooks.findIndex(wh => wh.id === webhookId);
                    if (idx >= 0) {
                        freshConfig.webhooks[idx].label = currentLabel;
                        freshConfig.webhooks[idx].url = currentUrl;
                        freshConfig.webhooks[idx].format = currentFormat;
                        freshConfig.webhooks[idx].template = currentTemplate;
                    }
                }
                _saveWebhookConfig(freshConfig);
                showToast(isNew ? 'Webhook added' : 'Webhook saved');
                // Pop back to webhook-list and force re-render
                Modal.pop();
                Modal.pop();
                Modal.push('webhook-list');
            });

            actions.appendChild(testBtn);
            actions.appendChild(saveBtn);
            panel.appendChild(actions);

            // Delete button (existing webhooks only)
            if (!isNew) {
                let confirmPending = false;
                const deleteBtn = h('button', {
                    class: 'ar-link-btn ar-link-btn-center',
                    text: '🗑 Delete Webhook',
                    style: `margin-top:8px;color:${T.err}`,
                });
                deleteBtn.addEventListener('click', () => {
                    if (!confirmPending) {
                        confirmPending = true;
                        deleteBtn.textContent = '🗑 Click again to confirm';
                        deleteBtn.style.fontWeight = 'bold';
                        setTimeout(() => {
                            confirmPending = false;
                            deleteBtn.textContent = '🗑 Delete Webhook';
                            deleteBtn.style.fontWeight = '';
                        }, 3000);
                        return;
                    }
                    const freshConfig = _getWebhookConfig();
                    freshConfig.webhooks = freshConfig.webhooks.filter(wh => wh.id !== webhookId);
                    _saveWebhookConfig(freshConfig);
                    showToast('Webhook deleted');
                    Modal.pop();
                    Modal.pop();
                    Modal.push('webhook-list');
                });
                panel.appendChild(deleteBtn);
            }
        }
    });

    Modal.define('clear-watch', {
        title: 'Remove Watch',
        subtitle: 'Select a watch to remove',
        build: (panel, ctx) => {
            const watches = getWatches();
            if (watches.length === 0) {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: 'No watches to clear' }));
                return;
            }
            const modeTextLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

            watches.forEach((w) => {
                const short = _truncate(w.selector);
                const status = getWatchStatus(w);
                const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;

                const btn = h('button', { class: 'ar-btn ar-watch-row' });

                btn.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes' }));

                const info = h('div', { class: 'ar-flex-fill' });
                info.appendChild(h('div', { class: 'ar-truncate', text: short }));
                info.appendChild(h('div', { class: 'ar-subtitle-sm', text: modeTextLabels[w.mode] || w.mode }));
                btn.appendChild(info);

                btn.addEventListener('click', () => {
                    removeWatch(w.id);
                    const remaining = getWatches().length;
                    if (remaining === 0) {
                        if (Modal.hasInStack('settings')) Modal.open('settings');
                        else ctx.closeAll();
                        showToast('All watches removed');
                    } else {
                        showToast(`Watch removed (${remaining} remaining)`);
                        if (Modal.hasInStack('settings')) Modal.open('settings');
                        else ctx.closeAll();
                    }
                });
                panel.appendChild(btn);
            });

            if (watches.length > 1) {
                panel.appendChild(h('div', { class: 'ar-divider' }));

                let confirmPending = false;
                const clearBtn = makeOptionBtn('❌ Clear All', false, () => {
                    if (!confirmPending) {
                        confirmPending = true;
                        clearBtn.querySelector('span')
                            ? clearBtn.querySelector('span').textContent = '❌ Click again to confirm'
                            : clearBtn.textContent = '❌ Click again to confirm';
                        clearBtn.style.background = T.errBgDark;
                        setTimeout(() => {
                            confirmPending = false;
                            clearBtn.querySelector('span')
                                ? clearBtn.querySelector('span').textContent = '❌ Clear All'
                                : clearBtn.textContent = '❌ Clear All';
                            clearBtn.style.background = T.errBg;
                        }, 3000);
                        return;
                    }
                    clearAllWatches();
                    if (Modal.hasInStack('settings')) Modal.open('settings');
                    else ctx.closeAll();
                }, { bg: T.errBg, color: T.errLight });
                panel.appendChild(clearBtn);
            }
        }
    });

    Modal.define('watch-mode', {
        title: 'What to watch?',
        subtitle: 'Choose what changes to monitor',
        build: (panel, ctx) => {
            const { selector, el: targetEl } = ctx.extra;

            const shortSelector = _truncate(selector, 45);
            const preview = h('div', { class: 'ar-preview', text: shortSelector, title: selector });
            panel.appendChild(preview);

            const contentLength = targetEl.innerText.trim().length;
            if (contentLength > 1000) {
                panel.appendChild(h('div', {
                    class: 'ar-warning',
                    text: `\u26a0 This element has ${contentLength.toLocaleString()} chars of text. Consider picking a more specific child element for cleaner diffs.`
                }));
            }

            const modeDescriptions = {
                content: 'Alert when text inside the element changes',
                style: 'Alert when CSS properties change',
                both: 'Monitor both text and styling'
            };

            [
                { key: 'content', label: '📝 Text Content' },
                { key: 'style', label: '🎨 Styling' },
                { key: 'both', label: '📝🎨 Both' }
            ].forEach(({ key, label }) => {
                const btn = makeOptionBtn(label, false, () => {
                    const watch = { selector, mode: key, content: '', styles: '', snapshotTime: Date.now() };
                    if (key === 'content' || key === 'both') watch.content = targetEl.innerText.trim();
                    if (key === 'style' || key === 'both') watch.styles = captureStyles(targetEl);
                    addWatch(watch);
                    ctx.closeAll();
                    const count = getWatches().length;
                    showToast(`Watching ${key}: ${_truncate(selector, 40)} (${count} total)`);
                }, { subtitle: modeDescriptions[key] });
                btn.style.borderLeft = `3px solid ${getModeColor(key)}`;
                panel.appendChild(btn);
            });

            panel.appendChild(h('button', {
                class: 'ar-link-btn',
                text: '← Pick again',
                style: 'padding:8px 0 0',
                onclick: () => { ctx.closeAll(); startElementPicker(); }
            }));

            ctx.addFooter('Press Esc to cancel');
        }
    });

    Modal.define('badge-menu', {
        title: 'Quick Actions',
        noAutoFooter: true,
        build: (panel, ctx) => {
            const watches = getWatches();
            const watchCount = watches.length;
            const isSubOfSettings = Modal.hasInStack('settings');

            const timeStr = formatCountdown(remaining);
            let statusText = `⏸ Paused · ${timeStr} remaining`;
            if (watchCount > 0) statusText += ` · ${watchCount} watch${watchCount > 1 ? 'es' : ''}`;
            panel.appendChild(h('div', { class: 'ar-status-bar', style: `font-size:13px;color:${T.textMuted}`, text: statusText }));

            if (paused) {
                panel.appendChild(makeOptionBtn('▶ Resume', false, () => ctx.closeAll(),
                    { subtitle: 'Continue countdown', bg: T.okBg, color: T.okText }));
            }

            panel.appendChild(makeOptionBtn('⏹ Stop Refresh', false, () => {
                stopRefresh(); ctx.closeAll(); showToast('Auto-refresh stopped');
            }, { subtitle: 'Stop and hide badge', bg: T.errBg, color: T.errLight }));

            if (watchCount > 0) {
                const changedCount = watches.filter(w => getWatchStatus(w) === 'changed').length;
                const watchLabel = changedCount > 0 ? `🔍 Inspect Watches (${changedCount} changed)` : '🔍 Inspect Watches';
                panel.appendChild(makeOptionBtn(watchLabel, false, () => ctx.push('watch-inspector'),
                    { subtitle: 'View stored vs live content for each watch' }));
            }

            if (!isSubOfSettings) {
                panel.appendChild(makeOptionBtn('⚙ Settings', false, () => Modal.open('settings'),
                    { subtitle: 'Open full settings panel' }));
            }

            panel.appendChild(h('div', { class: 'ar-footer', text: isSubOfSettings ? 'Press Esc to go back' : 'Press Esc to dismiss' }));
        }
    });

    function getBadgeLabels() {
        const corner = Config.get('corner');
        const fontSize = Config.get('fontSize');
        const opacity = Config.get('opacity');
        return {
            corner: (CORNER_LABELS[corner] || corner).replace(/[↖↗↙↘↑↓]\s*/, ''),
            font: fontSize.charAt(0).toUpperCase() + fontSize.slice(1).replace('-', ' '),
            opacity: Math.round(opacity * 100) + '%'
        };
    }

    Modal.define('badge-style', {
        title: 'Badge Style',
        subtitle: 'Customize the countdown badge',
        footerText: 'Press Esc to go back',
        build: (panel, ctx) => {
            const bl = getBadgeLabels();

            panel.appendChild(makeOptionBtn('📍 Badge Position', false, () => ctx.push('position-picker'),
                { value: bl.corner, subtitle: 'Where the countdown timer appears' }));
            panel.appendChild(makeOptionBtn('🔤 Badge Font Size', false, () => ctx.push('fontsize-picker'),
                { value: bl.font, subtitle: 'Size of the countdown badge text' }));
            panel.appendChild(makeOptionBtn('🔲 Badge Opacity', false, () => ctx.push('opacity-picker'),
                { value: bl.opacity, subtitle: 'Transparency of the countdown badge' }));
        }
    });

    Modal.define('settings', {
        title: 'Auto Refresh Settings',
        minWidth: '320px',
        noAutoFooter: true,
        build: (panel, ctx) => {
            const watches = getWatches();
            const watchCount = watches.length;
            const currentHotkey = Config.get('hotkey');

            // Status bar
            const statusBar = h('div', { class: 'ar-status-bar' });
            const dot = h('span', {
                class: 'ar-dot-lg',
                style: isEnabled()
                    ? `background:${T.ok};box-shadow:0 0 6px ${T.ok}`
                    : `background:${T.textFaint}`
            });
            statusBar.appendChild(dot);
            statusBar.appendChild(h('span', {
                style: `font-size:13px;color:${T.textMuted};flex:1`,
                text: isEnabled() ? `Active · refreshing every ${formatSeconds(getInterval())}` : 'Inactive'
            }));
            panel.appendChild(statusBar);

            // Toggle switch
            const toggleRow = h('button', { class: 'ar-toggle-row' });
            const toggleLabel = h('div');
            toggleLabel.appendChild(h('div', { text: 'Auto-Refresh', style: `font-size:14px;color:${T.text}` }));
            toggleLabel.appendChild(h('div', { class: 'ar-subtitle-sm', text: 'Reload the page on a timer' }));

            const trackW = 40, thumbSize = 18;
            const toggle = h('div', {
                class: 'ar-toggle-track',
                style: `background:${isEnabled() ? T.accent : T.borderLight}`
            });
            const thumb = h('div', {
                class: 'ar-toggle-thumb',
                style: `left:${isEnabled() ? trackW - thumbSize - 2 + 'px' : '2px'}`
            });
            toggle.appendChild(thumb);

            function setToggleState(on) {
                toggle.style.background = on ? T.accent : T.borderLight;
                thumb.style.left = on ? `${trackW - thumbSize - 2}px` : '2px';
                dot.style.background = on ? T.ok : T.textFaint;
                dot.style.boxShadow = on ? `0 0 6px ${T.ok}` : 'none';
                statusBar.querySelector('span:last-child').textContent = on
                    ? `Active · refreshing every ${formatSeconds(getInterval())}` : 'Inactive';
            }

            toggleRow.addEventListener('click', () => {
                if (isEnabled()) {
                    stopRefresh();
                    setToggleState(false);
                    showToast('Auto-refresh stopped');
                } else {
                    startRefresh();
                    if (Modal.isOpen()) pauseRefresh();
                    setToggleState(true);
                    showToast(`Auto-refresh started: every ${formatSeconds(getInterval())}`);
                }
            });

            toggleRow.appendChild(toggleLabel);
            toggleRow.appendChild(toggle);
            panel.appendChild(toggleRow);

            // Refresh Interval (top-level, no section header)
            panel.appendChild(makeOptionBtn('⏱ Refresh Interval', false, () => ctx.push('interval-picker'),
                { value: formatSeconds(getInterval()), subtitle: 'How often the page reloads' }));

            // Watches section
            addSection(panel, `Watches${watchCount > 0 ? ` (${watchCount})` : ''}`);

            panel.appendChild(makeOptionBtn('👁 Add Watch', false, () => { ctx.closeAll(); startElementPicker(); },
                { subtitle: 'Pick an element to monitor for changes' }));

            // Watch Overview — always visible, shows total across all pages
            const allWatchTotal = getAllWatches().length;
            panel.appendChild(makeOptionBtn('📋 Watch Overview', false, () => ctx.push('watch-overview'),
                { value: `${allWatchTotal}`, subtitle: 'All watches across pages' }));

            if (alertIntervalId !== null) {
                const alertBtn = makeOptionBtn('🔕 Stop Alert', false, () => {
                    stopAlert();
                    showToast('Alert silenced');
                    alertBtn.remove();
                }, { subtitle: 'Silence the current change alert', bg: T.errBg, color: T.errLight });
                panel.appendChild(alertBtn);
            }

            if (watchCount > 0) {
                panel.appendChild(makeOptionBtn('🔍 Inspect Watches', false, () => ctx.push('watch-inspector'),
                    { value: `${watchCount}`, subtitle: 'View stored vs live content for each watch' }));
                panel.appendChild(makeOptionBtn('🗑 Remove Watches', false, () => ctx.push('clear-watch'),
                    { value: `${watchCount}`, subtitle: 'Remove individual or all watches' }));
            } else {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: 'No watches configured yet' }));
            }

            // More settings — progressive disclosure
            let expanded = Config.get('settingsExpanded');
            const moreLink = h('button', { class: 'ar-more-link' });
            const moreWrapper = h('div');

            function updateExpanded() {
                moreWrapper.style.display = expanded ? 'block' : 'none';
                moreLink.textContent = expanded ? '▲ Fewer settings' : '';
                if (!expanded) {
                    moreLink.appendChild(h('span', { text: '⚙ More settings' }));
                    moreLink.appendChild(h('span', { text: ' — badge, theme, alerts, hotkey', style: `color:${T.textDim}` }));
                }
            }
            moreLink.addEventListener('click', () => {
                expanded = !expanded;
                Config.set('settingsExpanded', expanded);
                updateExpanded();
            });

            panel.appendChild(moreLink);

            // Hidden sections wrapper
            const bl = getBadgeLabels();
            const currentTheme = Config.get('theme');
            const themeLabel = THEME_LABELS[currentTheme] || 'Dark';
            const badgeStyleValue = `${bl.corner} · ${bl.font} · ${bl.opacity}`;

            // Badge & Appearance section
            moreWrapper.appendChild(h('div', { class: 'ar-section-hdr ar-section-hdr-sep', text: 'Badge & Appearance' }));
            moreWrapper.appendChild(makeOptionBtn('🏷 Badge Style', false, () => ctx.push('badge-style'),
                { value: badgeStyleValue, subtitle: 'Position, size, and opacity' }));
            moreWrapper.appendChild(makeOptionBtn('🎨 Theme', false, () => ctx.push('theme-picker'),
                { value: themeLabel, subtitle: 'Choose a visual style' }));

            // General section
            moreWrapper.appendChild(h('div', { class: 'ar-section-hdr ar-section-hdr-sep', text: 'General' }));
            moreWrapper.appendChild(makeOptionBtn('⌨ Keyboard Shortcut', false, () => ctx.push('hotkey-picker'),
                { value: currentHotkey, subtitle: 'Hotkey to open this menu' }));

            const alertModeVal = ALERT_MODE_LABELS[Config.get('alertMode')] || 'Beep';
            moreWrapper.appendChild(makeOptionBtn('🔔 Alert Mode', false, () => ctx.push('alert-mode-picker'),
                { value: alertModeVal, subtitle: 'How you are notified of changes' }));

            const webhookConfig = _getWebhookConfig();
            const whCount = webhookConfig.webhooks.length;
            const whEnabled = webhookConfig.webhooks.filter(wh => wh.enabled && wh.url).length;
            const webhookLabel = whCount === 0 ? 'None' : !webhookConfig.globalEnabled ? 'Off' : `${whEnabled} of ${whCount} on`;
            moreWrapper.appendChild(makeOptionBtn('🌐 Webhook', false, () => ctx.push('webhook-list'),
                { value: webhookLabel, subtitle: 'Send alerts to external services' }));

            panel.appendChild(moreWrapper);
            updateExpanded();

            // Footer
            panel.appendChild(h('div', {
                class: 'ar-footer',
                style: 'margin-top:14px',
                text: `Press ${currentHotkey} to open this menu · v${VERSION}`
            }));
        }
    });

    Modal.define('watch-inspector', {
        title: 'Watch Inspector',
        subtitle: 'View stored vs live content for each watch',
        minWidth: '500px',
        maxWidth: '650px',
        footerText: 'Press Esc to dismiss',
        build: (panel, ctx) => {
            const isRemote = ctx.extra && ctx.extra.pageUrl && ctx.extra.pageUrl !== _pageUrl();
            let watches = (ctx.extra && ctx.extra.watches) || getWatches();
            let currentId = (ctx.extra && ctx.extra.watchId) || (watches.length > 0 ? watches[0].id : null);
            if (currentId && !watches.some(w => w.id === currentId)) currentId = watches.length > 0 ? watches[0].id : null;

            const getIdx = () => watches.findIndex(w => w.id === currentId);
            const getCurrent = () => watches.find(w => w.id === currentId);

            if (watches.length === 0) {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: 'No watches configured' }));
                panel.style.minWidth = '340px';
                return;
            }

            const modeLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

            const layout = h('div', { class: 'ar-split-layout' });
            const sidebar = h('div', { class: 'ar-inspector-sidebar' });
            const detail = h('div', { class: 'ar-detail-pane' });
            const sidebarItems = [];

            function buildSidebar() {
                sidebar.innerHTML = '';
                sidebarItems.length = 0;
                watches.forEach((w) => {
                    const status = isRemote ? 'other-page' : getWatchStatus(w);
                    const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : status === 'other-page' ? T.textDim : T.ok;
                    const short = w.selector.length > 18 ? w.selector.slice(-18) : w.selector;

                    const item = h('button', { class: `ar-sidebar-item${w.id === currentId ? ' ar-active' : ''}` },
                        h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes' }),
                        h('span', { class: 'ar-truncate', text: short })
                    );
                    item.addEventListener('click', () => { currentId = w.id; renderDetail(); updateSidebarSelection(); });
                    sidebar.appendChild(item);
                    sidebarItems.push(item);
                });
            }

            function updateSidebarSelection() {
                watches.forEach((w, i) => {
                    if (i < sidebarItems.length) sidebarItems[i].className = `ar-sidebar-item${w.id === currentId ? ' ar-active' : ''}`;
                });
            }

            function renderDetail() {
                detail.innerHTML = '';
                const w = getCurrent();
                if (!w) return;

                // Header with toolbar
                const headerRow = h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px' });
                headerRow.appendChild(h('span', {
                    text: modeLabels[w.mode] || w.mode,
                    style: `font-weight:bold;font-size:13px;color:${getModeColor(w.mode) || T.cyan}`
                }));

                const toolbar = h('div', { class: 'ar-toolbar' });

                const refreshBtn = h('button', {
                    class: 'ar-toolbar-btn',
                    html: '🔄 <span style="font-size:11px">Re-snapshot</span>',
                    title: isRemote ? 'Navigate to this page to re-snapshot' : 'Re-snapshot to current values',
                    style: isRemote ? `opacity:0.4;cursor:default` : '',
                    onclick: () => {
                        if (isRemote) { showToast('Navigate to this page first'); return; }
                        const el = document.querySelector(w.selector);
                        if (!el) { showToast('Element not found'); return; }
                        if (w.mode === 'content' || w.mode === 'both') w.content = el.innerText.trim();
                        if (w.mode === 'style' || w.mode === 'both') w.styles = captureStyles(el);
                        w.snapshotTime = Date.now();
                        const idx = getIdx();
                        if (idx >= 0) watches[idx] = w;
                        setWatches(watches);
                        if (!watches.some(ww => getWatchStatus(ww) === 'changed')) stopAlert();
                        renderDetail();
                        buildSidebar();
                        showToast('Snapshot updated');
                    }
                });
                toolbar.appendChild(refreshBtn);

                const deleteBtn = h('button', {
                    class: 'ar-toolbar-btn',
                    html: '🗑 <span style="font-size:11px">Remove</span>',
                    title: 'Remove this watch',
                    style: `color:${T.err}`,
                    onclick: () => {
                        if (isRemote) {
                            removeRemoteWatch(w);
                            watches = watches.filter(ww => ww.id !== w.id);
                        } else {
                            removeWatch(w.id);
                            watches = getWatches();
                        }
                        if (watches.length === 0) {
                            showToast('All watches removed');
                            if (isRemote) {
                                // Pop inspector + stale overview, push fresh overview
                                Modal.pop(); Modal.pop(); Modal.push('watch-overview');
                            } else {
                                ctx.close();
                            }
                            return;
                        }
                        if (!watches.some(ww => ww.id === currentId)) currentId = watches[0].id;
                        buildSidebar();
                        renderDetail();
                        showToast('Watch removed');
                    }
                });
                toolbar.appendChild(deleteBtn);

                if (isRemote && w.url) {
                    const openBtn = h('button', {
                        class: 'ar-toolbar-btn',
                        html: '🔗 <span style="font-size:11px">Open Page</span>',
                        title: 'Open this page in a new tab',
                        onclick: () => { window.open(w.url, '_blank'); }
                    });
                    toolbar.appendChild(openBtn);
                }

                headerRow.appendChild(toolbar);
                detail.appendChild(headerRow);

                // Timestamp
                if (w.snapshotTime) {
                    detail.appendChild(h('div', { text: `Snapshot: ${timeAgo(w.snapshotTime)}`, style: `color:${T.textFaint};font-size:11px;margin-bottom:6px` }));
                }

                // CSS Selector
                const selectorSection = addCollapsible(detail, 'CSS Selector', true);
                const selectorRow = h('div', { class: 'ar-input-group' });
                selectorRow.appendChild(h('div', {
                    class: 'ar-input-group-field',
                    text: w.selector
                }));
                selectorRow.appendChild(h('button', {
                    class: 'ar-input-group-btn',
                    text: '📋', title: 'Copy selector',
                    onclick: () => navigator.clipboard.writeText(w.selector).then(() => showToast('Selector copied'), () => showToast('Copy failed'))
                }));
                selectorSection.body.appendChild(selectorRow);

                const el = isRemote ? null : document.querySelector(w.selector);

                // Content section
                if (w.mode === 'content' || w.mode === 'both') {
                    if (isRemote) {
                        const contentSection = addCollapsible(detail, 'Stored Content', true);
                        addField(contentSection.body, w.content || '(empty)', false);
                    } else {
                        const live = el ? el.innerText.trim() : null;
                        const changed = live !== null && live !== w.content;

                    const contentSection = addCollapsible(detail,
                        'Content' + (changed ? ' ⚠ CHANGED' : live !== null ? ' ✓' : ''), true);

                    if (changed) {
                        const DIFF_LIMIT = 500;
                        const oldText = w.content || '(empty)';
                        const newText = live;
                        const isTruncated = oldText.length > DIFF_LIMIT || newText.length > DIFF_LIMIT;

                        const diffBox = h('div', { class: 'ar-diff-box' });
                        const oldSpan = h('span', {
                            class: 'ar-diff-old',
                            text: isTruncated ? oldText.slice(0, DIFF_LIMIT) + '…' : oldText
                        });
                        const arrow = h('span', { text: ' → ', style: `color:${T.textFaint}` });
                        const newSpan = h('span', {
                            class: 'ar-diff-new',
                            text: isTruncated ? newText.slice(0, DIFF_LIMIT) + '…' : newText
                        });
                        diffBox.appendChild(oldSpan);
                        diffBox.appendChild(arrow);
                        diffBox.appendChild(newSpan);
                        contentSection.body.appendChild(diffBox);

                        if (isTruncated) {
                            contentSection.body.appendChild(h('button', {
                                class: 'ar-link-btn',
                                text: `Show full diff (${oldText.length + newText.length} chars)`,
                                style: `color:${T.cyan};font-size:11px;margin-top:4px`,
                                onclick: function() {
                                    oldSpan.textContent = oldText;
                                    newSpan.textContent = newText;
                                    diffBox.style.maxHeight = 'none';
                                    this.remove();
                                }
                            }));
                        }
                    } else {
                        addField(contentSection.body, w.content || '(empty)', false);
                    }
                    }
                }

                // Style section
                if (w.mode === 'style' || w.mode === 'both') {
                    if (isRemote) {
                        const styleSection = addCollapsible(detail, 'Stored Styles', true);
                        if (w.styles) {
                            try {
                                const parsed = JSON.parse(w.styles);
                                const entries = Object.entries(parsed);
                                const chipContainer = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' });
                                entries.forEach(([prop, val]) => {
                                    if (!val || val === 'none' || val === 'normal' || val === '0px') return;
                                    const chip = h('span', { class: 'ar-chip' });
                                    chip.appendChild(h('span', { class: 'ar-opt-value', text: `${prop}: ` }));
                                    chip.appendChild(h('span', { text: _truncate(String(val), 25) }));
                                    chipContainer.appendChild(chip);
                                });
                                styleSection.body.appendChild(chipContainer);
                            } catch {
                                styleSection.body.appendChild(h('div', { text: `${WATCHED_STYLE_PROPS.length} properties captured`, style: `color:${T.textFaint};font-size:12px` }));
                            }
                        } else {
                            styleSection.body.appendChild(h('div', { text: 'No styles stored', style: `color:${T.textFaint};font-size:12px` }));
                        }
                    } else if (el && w.styles) {
                        const liveStyles = captureStyles(el);
                        const changes = diffStyles(w.styles, liveStyles);
                        const styleSection = addCollapsible(detail,
                            changes.length > 0 ? `Style Changes (${changes.length}) ⚠` : 'Styling ✓', true);

                        if (changes.length > 0) {
                            const chipContainer = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' });
                            changes.forEach(({ prop, from, to }) => {
                                const chip = h('span', { class: 'ar-chip' });
                                chip.appendChild(h('span', { class: 'ar-opt-value', text: `${prop}: ` }));
                                chip.appendChild(h('span', { class: 'ar-diff-old', text: from }));
                                chip.appendChild(document.createTextNode(' → '));
                                chip.appendChild(h('span', { class: 'ar-diff-new', text: to }));
                                chipContainer.appendChild(chip);
                            });
                            styleSection.body.appendChild(chipContainer);
                        } else {
                            styleSection.body.appendChild(h('div', { text: 'No style changes detected', style: `color:${T.textFaint};font-size:12px` }));
                        }
                    } else if (w.styles) {
                        const styleSection = addCollapsible(detail, 'Stored Styles', false);
                        styleSection.body.appendChild(h('div', { text: `${WATCHED_STYLE_PROPS.length} properties captured`, style: `color:${T.textFaint};font-size:12px` }));
                    }
                }

                if (!el) {
                    if (isRemote) {
                        detail.appendChild(h('div', { class: 'ar-empty-state', text: 'Navigate to this page to see live content' }));
                    } else {
                        const box = addField(detail, '⚠ Element not found on page', false);
                        box.style.color = T.err;
                        box.style.borderColor = T.err;
                    }
                }
            }

            layout.appendChild(sidebar);
            layout.appendChild(detail);
            panel.appendChild(layout);

            buildSidebar();
            renderDetail();
        }
    });

    Modal.define('watch-overview', {
        title: 'Watch Overview',
        subtitle: 'All watches across pages',
        minWidth: '360px',
        build: (panel, ctx) => {
            let allWatches = getAllWatches();
            let groups = groupWatchesByDomain(allWatches);
            const currentDomain = location.hostname;

            let viewAll = false;

            function refreshData() {
                allWatches = getAllWatches();
                groups = groupWatchesByDomain(allWatches);
            }

            // Re-render when this modal is re-shown after a sub-modal pops
            const observer = new MutationObserver(() => {
                const overlay = panel.parentElement;
                if (overlay && overlay.style.display !== 'none') {
                    refreshData();
                    renderList();
                }
            });
            // Defer observer setup until panel is in the DOM
            requestAnimationFrame(() => {
                const overlay = panel.parentElement;
                if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });
            });
            ctx.cleanups.push(() => observer.disconnect());

            if (allWatches.length === 0) {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: 'No watches found on any page' }));
                return;
            }

            // Toggle: This Domain / All Domains
            const toggleRow = h('div', { style: 'display:flex;gap:4px;margin-bottom:10px' });
            const btnThis = h('button', { class: 'ar-btn ar-btn-active', style: 'flex:1;font-size:12px', text: 'This Domain' });
            const btnAll = h('button', { class: 'ar-btn', style: 'flex:1;font-size:12px', text: 'All Domains' });

            const listContainer = h('div');

            function setView(all) {
                viewAll = all;
                btnThis.className = all ? 'ar-btn' : 'ar-btn ar-btn-active';
                btnAll.className = all ? 'ar-btn ar-btn-active' : 'ar-btn';
                renderList();
            }

            btnThis.addEventListener('click', () => setView(false));
            btnAll.addEventListener('click', () => setView(true));
            toggleRow.appendChild(btnThis);
            toggleRow.appendChild(btnAll);
            panel.appendChild(toggleRow);

            function renderList() {
                listContainer.innerHTML = '';

                // Sort domains: current first, then alphabetical
                const domains = Object.keys(groups).sort((a, b) => {
                    if (a === currentDomain) return -1;
                    if (b === currentDomain) return 1;
                    return a.localeCompare(b);
                });

                const filteredDomains = viewAll ? domains : domains.filter(d => d === currentDomain);

                if (filteredDomains.length === 0) {
                    listContainer.appendChild(h('div', { class: 'ar-empty-state', text: 'No watches on this domain' }));
                    return;
                }

                let totalCount = 0;

                filteredDomains.forEach(domain => {
                    const group = groups[domain];
                    const pages = Object.keys(group.pages).sort();
                    const domainCount = pages.reduce((sum, p) => sum + group.pages[p].length, 0);
                    totalCount += domainCount;

                    addSection(listContainer, `${domain.toUpperCase()} (${domainCount})`);

                    pages.forEach(pathname => {
                        const pageWatches = group.pages[pathname];
                        const pageUrl = group.origin + pathname;
                        const isCurrentPage = pageUrl === _pageUrl();

                        const row = h('button', { class: 'ar-btn ar-watch-row' });

                        const dotColor = isCurrentPage ? T.ok : T.textDim;
                        row.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: isCurrentPage ? 'Current page' : 'Other page' }));

                        const info = h('div', { class: 'ar-flex-fill' });
                        info.appendChild(h('div', { class: 'ar-truncate', text: pathname || '/' }));
                        const modes = pageWatches.map(w => w.mode).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                        info.appendChild(h('div', { class: 'ar-subtitle-sm', text: modes }));
                        row.appendChild(info);

                        row.appendChild(h('span', { class: 'ar-opt-value', text: `${pageWatches.length}` }));

                        row.addEventListener('click', () => {
                            const inspectWatches = isCurrentPage ? getWatches() : pageWatches;
                            ctx.push('watch-inspector', { watches: inspectWatches, pageUrl });
                        });

                        listContainer.appendChild(row);
                    });

                    // Remove all for domain
                    if (domainCount > 1) {
                        const removeAllBtn = h('button', {
                            class: 'ar-btn',
                            style: `color:${T.err};font-size:12px;margin-top:4px`,
                            text: `🗑 Remove all ${domain} watches`
                        });
                        let confirmPending = false;
                        removeAllBtn.addEventListener('click', () => {
                            if (!confirmPending) {
                                confirmPending = true;
                                removeAllBtn.textContent = '🗑 Click again to confirm';
                                removeAllBtn.style.background = T.errBg;
                                setTimeout(() => {
                                    confirmPending = false;
                                    removeAllBtn.textContent = `🗑 Remove all ${domain} watches`;
                                    removeAllBtn.style.background = '';
                                }, 5000);
                                return;
                            }
                            // Remove all watches for this domain
                            pages.forEach(pathname => {
                                const pageWatches = group.pages[pathname];
                                pageWatches.forEach(w => removeRemoteWatch(w));
                            });
                            showToast(`Removed ${domainCount} watches from ${domain}`);
                            refreshData();
                            renderList();
                        });
                        listContainer.appendChild(removeAllBtn);
                    }
                });

                // Footer total
                listContainer.appendChild(h('div', {
                    style: `text-align:right;color:${T.textFaint};font-size:11px;margin-top:8px;padding-right:4px`,
                    text: `${totalCount} total`
                }));
            }

            panel.appendChild(listContainer);
            renderList();
        }
    });

    // --- Element Picker ---

    function getUniqueSelector(el) {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        while (el && el !== document.documentElement) {
            let selector = el.tagName.toLowerCase();
            if (el.id) { parts.unshift(`#${CSS.escape(el.id)}`); break; }
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(Boolean).map(c => `.${CSS.escape(c)}`).join('');
                if (classes) selector += classes;
            }
            const parent = el.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
                if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(el) + 1})`;
            }
            parts.unshift(selector);
            el = parent;
        }
        return parts.join(' > ');
    }

    function startElementPicker() {
        const highlight = h('div', {
            style: `position:absolute;z-index:2147483646;pointer-events:none;border:2px solid ${T.accent};background:${T.accentFaint};border-radius:3px;transition:all .05s`
        });
        document.documentElement.appendChild(highlight);

        const label = h('div', {
            text: 'Click an element to watch for changes (Esc to cancel)',
            style: `position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:${T.bg};color:${T.text};font:13px/1 system-ui,sans-serif;padding:8px 16px;border-radius:8px;box-shadow:0 4px 16px ${T.shadowHeavy}`
        });
        document.documentElement.appendChild(label);

        let lastTarget = null;

        function onMove(e) {
            const el = e.target;
            if (el === highlight || el === label) return;
            lastTarget = el;
            const rect = el.getBoundingClientRect();
            highlight.style.top = (rect.top + window.scrollY) + 'px';
            highlight.style.left = (rect.left + window.scrollX) + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
        }

        const cleanups = [
            addDocListener('mousemove', onMove, true),
            addDocListener('click', onClick, true),
            addDocListener('keydown', onEsc, true),
        ];
        window.addEventListener('beforeunload', cleanup);

        function cleanup() {
            cleanups.forEach(fn => fn());
            window.removeEventListener('beforeunload', cleanup);
            highlight.remove();
            label.remove();
        }

        function onClick(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
            const el = lastTarget || e.target;
            const selector = getUniqueSelector(el);
            Modal.open('watch-mode', { selector, el });
        }

        function onEsc(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resumeRefresh();
                showToast('Element picker cancelled');
            }
        }

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onEsc, true);
        window.addEventListener('beforeunload', cleanup);
    }

    // --- Quick Watch Context Menu ---

    let _activeCtxMenu = null;

    function dismissQuickWatch() {
        if (_activeCtxMenu) { _activeCtxMenu.remove(); _activeCtxMenu = null; }
    }

    function showQuickWatchMenu(x, y, targetEl, selector) {
        dismissQuickWatch();

        const menu = h('div', { class: 'ar-ctx-menu' });

        // Clamp to viewport
        const pad = 8;
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
            if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
            if (x < pad) x = pad;
            if (y < pad) y = pad;
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        });
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const watches = getWatches();
        const existingWatch = watches.find(w => w.selector === selector);
        const isWatched = !!existingWatch;

        const header = h('div', { class: 'ar-ctx-header' });
        header.appendChild(h('div', { class: 'ar-ctx-title', text: isWatched ? '👁 Already watching' : '🔍 Watch this element' }));
        header.appendChild(h('div', { class: 'ar-ctx-selector', text: selector, title: selector }));
        menu.appendChild(header);

        if (isWatched) {
            const w = existingWatch;
            const status = getWatchStatus(w);
            const modeLabel = w.mode === 'content' ? '📝 Text' : w.mode === 'style' ? '🎨 Style' : '📝🎨 Both';
            const statusLabel = status === 'changed' ? '⚠ Changed' : status === 'missing' ? '❌ Missing' : '✓ OK';

            menu.appendChild(h('div', {
                style: `font-size:11px;color:${T.textMuted};margin-bottom:6px;padding:0 4px`,
                text: `${modeLabel} · ${statusLabel}`
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: '🔄 Re-snapshot',
                onclick: () => {
                    const el = document.querySelector(w.selector);
                    if (!el) { showToast('Element not found'); dismissQuickWatch(); return; }
                    if (w.mode === 'content' || w.mode === 'both') w.content = el.innerText.trim();
                    if (w.mode === 'style' || w.mode === 'both') w.styles = captureStyles(el);
                    w.snapshotTime = Date.now();
                    const idx = watches.findIndex(ww => ww.id === w.id);
                    if (idx >= 0) watches[idx] = w;
                    setWatches(watches);
                    if (!watches.some(ww => getWatchStatus(ww) === 'changed')) stopAlert();
                    dismissQuickWatch();
                    showToast('Snapshot updated');
                }
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: '🗑 Remove watch',
                onclick: () => {
                    removeWatch(w.id);
                    dismissQuickWatch();
                    showToast(`Watch removed: ${_truncate(selector)}`);
                }
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: '🔍 Inspect',
                onclick: () => {
                    dismissQuickWatch();
                    Modal.open('watch-inspector', { watchId: w.id });
                }
            }));
        } else {
            const MODE_LABELS = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };
            const MODE_DESCS = { content: 'Alert when text changes', style: 'Alert when CSS changes', both: 'Monitor text and styling' };

            ['content', 'style', 'both'].forEach(mode => {
                const btn = h('button', {
                    class: 'ar-btn', text: MODE_LABELS[mode],
                    onclick: () => {
                        const watch = { selector, mode, content: '', styles: '', snapshotTime: Date.now() };
                        if (mode === 'content' || mode === 'both') watch.content = targetEl.innerText.trim();
                        if (mode === 'style' || mode === 'both') watch.styles = captureStyles(targetEl);
                        addWatch(watch);
                        dismissQuickWatch();
                        const count = getWatches().length;
                        showToast(`Watching ${mode}: ${_truncate(selector)} (${count} total)`);
                    }
                });
                const sub = h('div', { class: 'ar-subtitle-sm', text: MODE_DESCS[mode] });
                btn.appendChild(sub);
                menu.appendChild(btn);
            });

            menu.appendChild(h('button', {
                class: 'ar-link-btn', text: '⚙ Full options…',
                style: 'padding:6px 4px 0',
                onclick: () => {
                    dismissQuickWatch();
                    Modal.open('watch-mode', { selector, el: targetEl });
                }
            }));
        }

        _shadow.appendChild(menu);
        _activeCtxMenu = menu;

        // Click-away to dismiss (use composedPath to cross shadow DOM boundary)
        const onClickAway = (e) => {
            if (_activeCtxMenu && !e.composedPath().includes(_activeCtxMenu)) {
                dismissQuickWatch();
                cleanupCtx();
            }
        };
        const onEscDismiss = (e) => {
            if (e.key === 'Escape') {
                dismissQuickWatch();
                cleanupCtx();
            }
        };
        let cleanupCtx = () => {};
        setTimeout(() => {
            const removals = [
                addDocListener('click', onClickAway, true),
                addDocListener('keydown', onEscDismiss, true),
            ];
            cleanupCtx = () => removals.forEach(fn => fn());
        }, 0);
    }

    document.addEventListener('contextmenu', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const target = e.target;
        if (_host.contains(target)) return; // Don't watch our own UI
        const selector = getUniqueSelector(target);
        showQuickWatchMenu(e.clientX, e.clientY, target, selector);
    }, true);

    // --- Watch Checking ---

    function clearAllWatches() {
        setWatches([]);
        GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
        stopAlert();
        showToast('All watches cleared');
        EventBus.emit('watches:cleared', {});
    }

    function waitForElement(selector, timeout = 10000, interval = 300) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const start = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) { clearInterval(timer); resolve(el); }
                else if (Date.now() - start >= timeout) { clearInterval(timer); resolve(null); }
            }, interval);
        });
    }

    function _waitForStableContent(el, mode, retries = 3, interval = 500) {
        return new Promise((resolve) => {
            let prevContent = (mode === 'content' || mode === 'both') ? el.innerText.trim() : null;
            let prevStyles = (mode === 'style' || mode === 'both') ? captureStyles(el) : null;
            let count = 0;
            const timer = setInterval(() => {
                count++;
                const currContent = (mode === 'content' || mode === 'both') ? el.innerText.trim() : null;
                const currStyles = (mode === 'style' || mode === 'both') ? captureStyles(el) : null;
                const contentStable = prevContent === null || currContent === prevContent;
                const stylesStable = prevStyles === null || currStyles === prevStyles;
                if ((contentStable && stylesStable) || count >= retries) {
                    clearInterval(timer);
                    resolve({ content: currContent, styles: currStyles });
                } else {
                    prevContent = currContent;
                    prevStyles = currStyles;
                }
            }, interval);
        });
    }

    async function checkForChanges() {
        if (!GM_getValue(STORAGE_KEY_WATCH_ENABLED, false)) return;
        const watches = getWatches();
        if (watches.length === 0) return;

        const allChanges = [];
        const missing = [];
        const changeDetails = [];

        for (let i = 0; i < watches.length; i++) {
            const w = watches[i];
            // Skip watches scoped to a different page
            if (w.url !== _pageUrl()) continue;
            const el = await waitForElement(w.selector);
            if (!el) {
                missing.push(_truncate(w.selector));
                continue;
            }

            // Wait for dynamic content to stabilize before comparing
            const stable = await _waitForStableContent(el, w.mode);

            const changes = [];
            let newContent = '';

            if (w.mode === 'content' || w.mode === 'both') {
                newContent = stable.content;
                if (newContent !== w.content) changes.push('content');
            }

            if (w.mode === 'style' || w.mode === 'both') {
                if (w.styles && diffStyles(w.styles, stable.styles).length > 0) changes.push('styling');
            }

            if (changes.length > 0) {
                const short = _truncate(w.selector, 25);
                allChanges.push(`${short} (${changes.join(' & ')})`);
                changeDetails.push({
                    url: location.href,
                    selector: w.selector,
                    mode: w.mode,
                    old_content: w.content || '',
                    new_content: newContent || el.innerText.trim(),
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (missing.length > 0) {
            stopRefresh();
            speak(`Warning: ${missing.length} watched element${missing.length > 1 ? 's' : ''} not found on ${_pageLabel()}.`);
            startAlert();
            showToast(`${missing.length} watched element${missing.length > 1 ? 's' : ''} not found!`);
            return;
        }

        if (allChanges.length > 0) {
            stopRefresh();
            let summary;
            if (allChanges.length === 1) {
                summary = `Watch changed on ${_pageLabel()}. Content updated.`;
                speak(summary);
            } else {
                summary = `${allChanges.length} watches changed on ${_pageLabel()}.`;
                speak(summary);
            }
            startAlert();
            showToast(`${allChanges.length} watch${allChanges.length > 1 ? 'es' : ''} changed!`);

            // Fire webhook with first changed element's details + summary
            if (changeDetails.length > 0) {
                const whDetails = { ...changeDetails[0], summary };
                sendWebhook(whDetails);
            }
        }
    }

    function getWatchStatus(w) {
        // Watches scoped to a different page show as 'other-page'
        if (w.url !== _pageUrl()) return 'other-page';
        const el = document.querySelector(w.selector);
        if (!el) return 'missing';
        if (w.mode === 'content' || w.mode === 'both') {
            if (el.innerText.trim() !== w.content) return 'changed';
        }
        if (w.mode === 'style' || w.mode === 'both') {
            if (w.styles) {
                const changes = diffStyles(w.styles, captureStyles(el));
                if (changes.length > 0) return 'changed';
            }
        }
        return 'ok';
    }

    // --- Keyboard Shortcut ---

    function matchesHotkey(e) {
        const combo = Config.get('hotkey');
        const parts = combo.split('+');
        const key = parts[parts.length - 1];
        const needCtrl = parts.includes('Ctrl');
        const needAlt = parts.includes('Alt');
        const needShift = parts.includes('Shift');
        const needMeta = parts.includes('Meta');
        const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        return e.ctrlKey === needCtrl && e.altKey === needAlt && e.shiftKey === needShift && e.metaKey === needMeta && pressedKey === key;
    }

    function openSettingsMenu() { Modal.open('settings'); }

    document.addEventListener('keydown', (e) => {
        if (matchesHotkey(e)) {
            e.preventDefault();
            e.stopPropagation();
            if (!Modal.isOpen()) openSettingsMenu();
        }
    });

    // --- Menu Commands ---

    GM_registerMenuCommand('Open settings', openSettingsMenu);
    GM_registerMenuCommand('Set badge font size', () => Modal.open('fontsize-picker'));
    GM_registerMenuCommand('Set badge position', () => Modal.open('position-picker'));
    GM_registerMenuCommand('Set refresh interval', () => Modal.open('interval-picker'));
    GM_registerMenuCommand('Set keyboard shortcut', () => Modal.open('hotkey-picker'));
    GM_registerMenuCommand('Watch element for changes', startElementPicker);
    GM_registerMenuCommand('Clear watch', () => Modal.open('clear-watch'));
    GM_registerMenuCommand('Start auto-refresh', () => {
        startRefresh();
        showToast(`Auto-refresh started: every ${formatSeconds(getInterval())}`);
    });
    GM_registerMenuCommand('Stop auto-refresh', () => {
        stopRefresh();
        showToast('Auto-refresh stopped');
    });

    // --- Initialization ---

    function onPageReady() {
        if (isEnabled()) startRefresh();
        checkForChanges();
    }

    if (document.readyState === 'complete') onPageReady();
    else window.addEventListener('load', onPageReady, { once: true });
})();
