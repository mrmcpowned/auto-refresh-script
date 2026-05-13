// ==UserScript==
// @name         Auto Refresh Page
// @namespace    http://chrisr.xyz/
// @version      1.8.1
// @description  Auto-refresh any webpage at a configurable interval
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '1.8.1';

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
    const STORAGE_KEY_INTERVAL = 'autoRefreshInterval';
    const STORAGE_KEY_ENABLED = 'autoRefreshEnabled_' + _urlKey;
    const STORAGE_KEY_CORNER = 'autoRefreshCorner';
    const STORAGE_KEY_FONT_SIZE = 'autoRefreshFontSize';
    const STORAGE_KEY_HOTKEY = 'autoRefreshHotkey';
    const STORAGE_KEY_WATCHES = 'autoRefreshWatches_' + _urlKey;
    const STORAGE_KEY_WATCH_ENABLED = 'autoRefreshWatchEnabled_' + _urlKey;
    const STORAGE_KEY_THEME = 'autoRefreshTheme';
    const STORAGE_KEY_OPACITY = 'autoRefreshBadgeOpacity';
    const STORAGE_KEY_ALERT_MODE = 'autoRefreshAlertMode';
    const STORAGE_KEY_TTS_VOICE = 'autoRefreshTTSVoice';
    const STORAGE_KEY_TTS_RATE = 'autoRefreshTTSRate';
    const STORAGE_KEY_TTS_VOLUME = 'autoRefreshTTSVolume';

    // --- Watch Array Helpers (with cache) ---

    let _watchCache = null;

    function getWatches() {
        if (_watchCache !== null) return _watchCache;
        try { _watchCache = JSON.parse(GM_getValue(STORAGE_KEY_WATCHES, '[]')); }
        catch { _watchCache = []; }
        // Migrate legacy watches without ids
        let dirty = false;
        _watchCache.forEach(w => { if (!w.id) { w.id = generateId(); dirty = true; } });
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
        const watches = getWatches();
        const existing = watches.findIndex(w => w.selector === watch.selector);
        if (existing >= 0) { watch.id = watches[existing].id || watch.id; watches[existing] = watch; }
        else watches.push(watch);
        setWatches(watches);
        GM_setValue(STORAGE_KEY_WATCH_ENABLED, true);
    }

    function removeWatch(id) {
        const watches = getWatches();
        const idx = watches.findIndex(w => w.id === id);
        if (idx >= 0) watches.splice(idx, 1);
        setWatches(watches);
        if (watches.length === 0) GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
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

    function buildCss() {
        return `
        .ar-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:${T.shadowHeavy};pointer-events:auto}
        .ar-panel{background:${T.bg};color:${T.text};border-radius:10px;padding:16px 20px;font:14px/1.6 system-ui,sans-serif;min-width:220px;box-shadow:0 8px 30px ${T.shadowHeavy};opacity:0;transform:scale(0.97);transition:opacity .15s ease-out,transform .15s ease-out}
        .ar-title{font-weight:bold;margin-bottom:10px;font-size:15px}
        .ar-subtitle{color:${T.textDim};font-size:12px;margin:-6px 0 10px 0}
        .ar-btn{display:block;width:100%;padding:8px 12px;margin:4px 0;border:none;border-radius:6px;cursor:pointer;font:14px/1.4 system-ui,sans-serif;text-align:left;background:${T.borderMid};color:${T.text};transition:background .15s}
        .ar-btn:hover{background:${T.border}}
        .ar-btn-active{background:${T.accent};color:${T.textLight}}
        .ar-btn-active:hover{background:${T.accent}}
        .ar-btn-ok{background:${T.okBg};color:${T.okText}}
        .ar-btn-ok:hover{background:${T.okBgHover}}
        .ar-btn-err{background:${T.errBg};color:${T.errLight}}
        .ar-btn-err:hover{background:${T.errBgHover}}
        .ar-section-hdr{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:${T.textFaint};margin:12px 0 4px 4px}
        .ar-status-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;margin-bottom:10px;background:${T.bgDark};border:1px solid ${T.borderMid}}
        .ar-footer{margin-top:12px;padding-top:8px;border-top:1px solid ${T.borderMid};text-align:center;font-size:11px;color:${T.borderLight}}
        .ar-field{background:${T.bgDark};border:1px solid ${T.border};border-radius:6px;padding:8px 10px;max-height:120px;overflow-y:auto;word-break:break-all;font-size:13px}
        .ar-input{padding:8px 10px;border:1px solid ${T.borderLight};border-radius:6px;background:${T.bgLight};color:${T.text};font:14px system-ui,sans-serif;outline:none;transition:border-color .2s}
        .ar-input:focus{border-color:${T.accent}}
        .ar-toolbar{display:flex;gap:0;background:${T.bgLight};border-radius:6px;overflow:hidden;border:1px solid ${T.border}}
        .ar-toolbar-btn{background:transparent;border:none;border-right:1px solid ${T.border};color:${T.textSub};cursor:pointer;padding:4px 10px;font-size:13px;display:flex;align-items:center;gap:4px;transition:background .15s}
        .ar-toolbar-btn:hover{background:${T.bgLighter}}
        .ar-toolbar-btn:last-child{border-right:none}
        .ar-back-btn{background:none;border:none;color:${T.textFaint};cursor:pointer;font:12px system-ui,sans-serif;padding:0 0 4px 0;margin:0;display:block}
        .ar-back-btn:hover{color:${T.textMuted}}
        .ar-link-btn{background:none;border:none;color:${T.textFaint};cursor:pointer;font:12px system-ui,sans-serif;padding:4px 0;margin:0;display:block}
        .ar-link-btn:hover{color:${T.textMuted}}
        .ar-collapsible{background:none;border:none;color:${T.textMuted};cursor:pointer;font-size:12px;padding:0;margin-bottom:4px;display:flex;align-items:center;gap:4px}
        .ar-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block}
        .ar-dot-lg{width:8px;height:8px;border-radius:50%;display:inline-block}
        .ar-kbd{display:inline-block;padding:3px 8px;background:${T.bgMid};border:1px solid ${T.borderLight};border-radius:5px;font:bold 13px monospace;color:${T.textLight};box-shadow:0 2px 0 ${T.bgDarker}}
        .ar-sidebar-item{display:flex;align-items:center;gap:6px;width:100%;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:4px;transition:background .1s;text-align:left;background:transparent;color:${T.textSub}}
        .ar-sidebar-item:hover:not(.ar-active){background:${T.bgLight}}
        .ar-sidebar-item.ar-active{background:${T.accent};color:${T.textLight}}
        .ar-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:${T.accent};color:${T.textLight};font:14px/1 system-ui,sans-serif;padding:10px 20px;border-radius:8px;box-shadow:0 4px 16px ${T.shadow};opacity:0;transition:opacity .3s,top .3s;pointer-events:none}
        .ar-toggle-row{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border:none;border-radius:6px;margin-bottom:2px;background:${T.borderMid};cursor:pointer;font:inherit;color:inherit;text-align:left}
        .ar-preview{background:${T.bgDark};border:1px solid ${T.border};border-radius:6px;padding:6px 10px;font:12px monospace;color:${T.textMuted};margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ar-warning{background:${T.warnBg};border:1px solid ${T.warnBorder};border-radius:6px;padding:6px 10px;font-size:11px;color:${T.warn};margin-bottom:10px}
        .ar-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;min-width:280px;background:${T.bgDark};border:1px solid ${T.border};border-radius:8px;padding:12px}
        .ar-capture-box{padding:20px;background:${T.bgDark};border:2px dashed ${T.borderLight};border-radius:8px;text-align:center;font:bold 16px monospace;margin-bottom:8px;min-height:60px;min-width:280px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;color:${T.textDim};transition:border-color .2s,background .3s}
        .ar-chip{background:${T.errPanel};border:1px solid ${T.err};border-radius:4px;padding:3px 8px;font:11px monospace;color:${T.text};white-space:nowrap}
        .ar-ctx-menu{position:fixed;z-index:2147483647;background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:8px;min-width:220px;font:13px/1.6 system-ui,sans-serif;box-shadow:0 4px 16px ${T.shadowHeavy};color:${T.text};pointer-events:auto}
        .ar-ctx-header{margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${T.borderMid}}
        .ar-ctx-title{font-weight:bold;font-size:13px;margin-bottom:2px}
        .ar-ctx-selector{font:11px monospace;color:${T.textMuted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
    `;
    }

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
            const top = h('div', { style: 'display:flex;justify-content:space-between;align-items:center' });
            top.appendChild(h('span', { text: isActive && !opts.value ? label + ' ✓' : label }));
            if (opts.value) top.appendChild(h('span', { text: opts.value, style: `color:${T.textDim};font-size:12px;margin-left:12px` }));
            btn.appendChild(top);
            if (opts.subtitle) btn.appendChild(h('div', { text: opts.subtitle, style: `color:${T.textDim};font-size:11px;margin-top:2px` }));
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
        return `${s / 3600} hour${s / 3600 > 1 ? 's' : ''}`;
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

    let refreshTimerId = null;
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
        const opacity = GM_getValue(STORAGE_KEY_OPACITY, 1);
        badge.style.opacity = String(opacity);
    });

    badge.addEventListener('click', (e) => { e.stopPropagation(); openBadgeMenu(); });
    _shadow.appendChild(badge);

    function applyCorner() {
        const corner = GM_getValue(STORAGE_KEY_CORNER, 'bottom-right');
        const pos = CORNERS[corner] || CORNERS['bottom-right'];
        badge.style.top = pos.top;
        badge.style.bottom = pos.bottom;
        badge.style.left = pos.left;
        badge.style.right = pos.right;
        badge.style.transform = pos.transform;
    }

    function applyFontSize() {
        const size = GM_getValue(STORAGE_KEY_FONT_SIZE, 'medium');
        badge.style.fontSize = FONT_SIZES[size] || FONT_SIZES['medium'];
    }

    applyCorner();
    applyFontSize();

    function applyTheme(themeName) {
        const theme = THEMES[themeName] || THEMES.dark;
        Object.assign(T, theme);
        GM_setValue(STORAGE_KEY_THEME, themeName);
        _css.textContent = buildCss();
        // Refresh badge inline styles
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
        GM_setValue(STORAGE_KEY_OPACITY, opacity);
        badge.style.opacity = String(opacity);
    }

    (function initTheme() {
        const saved = GM_getValue(STORAGE_KEY_THEME, 'dark');
        if (saved !== 'dark') applyTheme(saved);
        const opacity = GM_getValue(STORAGE_KEY_OPACITY, 1);
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
            badge.style.animation = 'none';
            void badge.offsetWidth;
        } else {
            badge.style.boxShadow = `0 2px 8px ${T.shadow}`;
        }
    }

    // --- Core Logic ---

    function getInterval() { return GM_getValue(STORAGE_KEY_INTERVAL, 30); }
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
        if (refreshTimerId !== null) { clearTimeout(refreshTimerId); refreshTimerId = null; }
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

    let toastCounter = 0;

    function showToast(message) {
        toastCounter++;
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
        const mode = GM_getValue(STORAGE_KEY_ALERT_MODE, 'beep');
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
        const mode = GM_getValue(STORAGE_KEY_ALERT_MODE, 'beep');
        if (mode === 'beep') return;
        speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = GM_getValue(STORAGE_KEY_TTS_RATE, 1.0);
        utter.volume = GM_getValue(STORAGE_KEY_TTS_VOLUME, 1.0);
        const voiceName = GM_getValue(STORAGE_KEY_TTS_VOICE, '');
        if (voiceName) {
            const voice = speechSynthesis.getVoices().find(v => v.name === voiceName);
            if (voice) utter.voice = voice;
        }
        speechSynthesis.speak(utter);
    }

    function _pageLabel() {
        const t = document.title || location.hostname;
        return t.length > 30 ? t.slice(0, 30) + '…' : t;
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

            function getFocusables() { return Array.from(panel.querySelectorAll('button, input')); }

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
        function define(id, def) { defs[id] = def; }
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
            const current = GM_getValue(STORAGE_KEY_FONT_SIZE, 'medium');
            [
                { key: 'small', label: 'Small' },
                { key: 'medium', label: 'Medium' },
                { key: 'large', label: 'Large' },
                { key: 'extra-large', label: 'Extra Large' }
            ].forEach(({ key, label }) => {
                const btn = makeOptionBtn(label, key === current, () => {
                    GM_setValue(STORAGE_KEY_FONT_SIZE, key);
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
            const current = GM_getValue(STORAGE_KEY_THEME, 'dark');
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
            const current = GM_getValue(STORAGE_KEY_OPACITY, 1);
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
                    GM_getValue(STORAGE_KEY_THEME, 'dark') === 'minimal' ? 'text-shadow:0 1px 3px rgba(0,0,0,0.8)' : ''
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
            const current = GM_getValue(STORAGE_KEY_CORNER, 'bottom-right');
            const grid = h('div', { class: 'ar-grid' });

            ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].forEach(choice => {
                const btn = makeOptionBtn(CORNER_LABELS[choice], choice === current, () => {
                    GM_setValue(STORAGE_KEY_CORNER, choice);
                    applyCorner();
                    Modal.open('settings');
                    showToast(`Badge position set to ${CORNER_LABELS[choice]}`);
                });
                btn.style.cssText += ';text-align:center;display:flex;align-items:center;justify-content:center;font-size:12px;margin:0';
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
                        GM_setValue(STORAGE_KEY_INTERVAL, seconds);
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
                style: `padding:8px 14px;border:none;border-radius:6px;background:${T.accent};color:${T.textLight};cursor:pointer;font:14px system-ui,sans-serif;transition:background .15s`,
                onmouseenter: (e) => { e.target.style.background = T.accentHover; },
                onmouseleave: (e) => { e.target.style.background = T.accent; },
                onclick: () => {
                    const value = parseInt(input.value, 10);
                    if (isNaN(value) || value < 1 || value > 86400) { input.style.borderColor = T.err; return; }
                    GM_setValue(STORAGE_KEY_INTERVAL, value);
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
            const current = GM_getValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);

            // Current hotkey display
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

                GM_setValue(STORAGE_KEY_HOTKEY, combo);
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

            document.addEventListener('keydown', onCapture, true);
            document.addEventListener('keyup', onKeyUp, true);
            ctx.cleanups.push(() => {
                document.removeEventListener('keydown', onCapture, true);
                document.removeEventListener('keyup', onKeyUp, true);
            });

            if (current !== DEFAULT_HOTKEY) {
                panel.appendChild(h('button', {
                    class: 'ar-link-btn',
                    text: 'Reset to default (Alt+Shift+R)',
                    style: 'text-align:center;width:100%',
                    onclick: () => {
                        GM_setValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);
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
        build: (panel) => {
            const current = GM_getValue(STORAGE_KEY_TTS_RATE, 1.0);
            TTS_RATE_OPTIONS.forEach(({ key, label }) => {
                panel.appendChild(makeOptionBtn(label, key === current, () => {
                    GM_setValue(STORAGE_KEY_TTS_RATE, key);
                    Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
                    showToast(`Speech speed set to ${label}`);
                }));
            });
        }
    });

    Modal.define('tts-volume-picker', {
        title: 'Speech Volume',
        subtitle: 'Volume of the spoken announcement',
        build: (panel) => {
            const current = GM_getValue(STORAGE_KEY_TTS_VOLUME, 1.0);
            TTS_VOLUME_OPTIONS.forEach(({ key, label }) => {
                panel.appendChild(makeOptionBtn(label, key === current, () => {
                    GM_setValue(STORAGE_KEY_TTS_VOLUME, key);
                    Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
                    showToast(`Speech volume set to ${label}`);
                }));
            });
        }
    });

    Modal.define('tts-voice-picker', {
        title: 'Speech Voice',
        subtitle: 'Choose a system voice for announcements',
        build: (panel) => {
            const current = GM_getValue(STORAGE_KEY_TTS_VOICE, '');

            function renderVoices() {
                panel.innerHTML = '';
                const voices = speechSynthesis.getVoices();
                if (voices.length === 0) {
                    panel.appendChild(h('div', { text: 'No voices available', style: `color:${T.textFaint};font-size:13px;padding:8px 0` }));
                    return;
                }

                // Default option
                panel.appendChild(makeOptionBtn('Default', current === '', () => {
                    GM_setValue(STORAGE_KEY_TTS_VOICE, '');
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

                // Show browser language voices first
                const browserLang = (navigator.language || 'en').split('-')[0];
                const sortedLangs = Object.keys(byLang).sort((a, b) => {
                    if (a === browserLang) return -1;
                    if (b === browserLang) return 1;
                    return a.localeCompare(b);
                });

                sortedLangs.forEach(lang => {
                    addSection(panel, lang.toUpperCase());
                    byLang[lang].forEach(v => {
                        panel.appendChild(makeOptionBtn(v.name, v.name === current, () => {
                            GM_setValue(STORAGE_KEY_TTS_VOICE, v.name);
                            Modal.pop(); Modal.pop(); Modal.push('alert-mode-picker');
                            showToast(`Voice set to ${v.name}`);
                        }, { subtitle: v.lang }));
                    });
                });
            }

            renderVoices();
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', renderVoices, { once: true });
            }
        }
    });

    Modal.define('alert-mode-picker', {
        title: 'Alert Mode',
        subtitle: 'How you are notified when a watch detects a change',
        build: (panel, ctx) => {
            const currentMode = GM_getValue(STORAGE_KEY_ALERT_MODE, 'beep');

            ALERT_MODE_OPTIONS.forEach(({ key, label, desc }) => {
                panel.appendChild(makeOptionBtn(label, key === currentMode, () => {
                    GM_setValue(STORAGE_KEY_ALERT_MODE, key);
                    Modal.pop(); Modal.push('alert-mode-picker');
                    showToast(`Alert mode set to ${label}`);
                }, { subtitle: desc }));
            });

            if (_ttsAvailable) {
                const showSpeechSettings = currentMode === 'speech' || currentMode === 'both';
                if (showSpeechSettings) {
                    addSection(panel, 'Speech Settings');

                    const voiceName = GM_getValue(STORAGE_KEY_TTS_VOICE, '');
                    const voiceLabel = voiceName || 'Default';
                    panel.appendChild(makeOptionBtn('🗣 Voice', false, () => ctx.push('tts-voice-picker'),
                        { value: voiceLabel, subtitle: 'System voice for announcements' }));

                    const rate = GM_getValue(STORAGE_KEY_TTS_RATE, 1.0);
                    const rateLabel = (TTS_RATE_OPTIONS.find(o => o.key === rate) || { label: 'Normal' }).label;
                    panel.appendChild(makeOptionBtn('⏩ Speed', false, () => ctx.push('tts-speed-picker'),
                        { value: rateLabel, subtitle: 'How fast the announcement is spoken' }));

                    const vol = GM_getValue(STORAGE_KEY_TTS_VOLUME, 1.0);
                    const volLabel = Math.round(vol * 100) + '%';
                    panel.appendChild(makeOptionBtn('🔊 Volume', false, () => ctx.push('tts-volume-picker'),
                        { value: volLabel, subtitle: 'Volume of the spoken announcement' }));

                    panel.appendChild(makeOptionBtn('� Test Speech', false, () => {
                        speak('Watch changed: sample content updated.');
                    }, { subtitle: 'Preview the current speech settings' }));
                }
            } else {
                panel.appendChild(h('div', {
                    text: 'Speech synthesis is not available in this browser.',
                    style: `color:${T.textFaint};font-size:12px;padding:8px 0`
                }));
            }
        }
    });

    Modal.define('clear-watch', {
        title: 'Remove Watch',
        subtitle: 'Select a watch to remove',
        build: (panel, ctx) => {
            const watches = getWatches();
            if (watches.length === 0) {
                panel.appendChild(h('div', { text: 'No watches to clear', style: `color:${T.textFaint};font-size:13px;padding:8px 0` }));
                return;
            }
            const modeTextLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

            watches.forEach((w, i) => {
                const short = w.selector.length > 30 ? w.selector.slice(0, 30) + '…' : w.selector;
                const status = getWatchStatus(w);
                const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;

                const btn = h('button', {
                    class: 'ar-btn',
                    style: 'display:flex;align-items:center;gap:8px'
                });

                btn.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes' }));

                const info = h('div', { style: 'flex:1;min-width:0' });
                info.appendChild(h('div', { text: short, style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }));
                info.appendChild(h('div', { text: modeTextLabels[w.mode] || w.mode, style: `font-size:11px;color:${T.textDim};margin-top:1px` }));
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
                panel.appendChild(h('div', { style: `border-top:1px solid ${T.borderMid};margin:10px 0 6px` }));

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
                }, { bg: T.errBg, hoverBg: T.errBgHover, color: T.errLight });
                panel.appendChild(clearBtn);
            }
        }
    });

    Modal.define('watch-mode', {
        title: 'What to watch?',
        subtitle: 'Choose what changes to monitor',
        build: (panel, ctx) => {
            const { selector, el: targetEl } = ctx.extra;

            const shortSelector = selector.length > 45 ? selector.slice(0, 45) + '…' : selector;
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
                    showToast(`Watching ${key}: ${selector.length > 40 ? selector.slice(0, 40) + '…' : selector} (${count} total)`);
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
                    { subtitle: 'Continue countdown', bg: T.okBg, hoverBg: T.okBgHover, color: T.okText }));
            }

            panel.appendChild(makeOptionBtn('⏹ Stop Refresh', false, () => {
                stopRefresh(); ctx.closeAll(); showToast('Auto-refresh stopped');
            }, { subtitle: 'Stop and hide badge', bg: T.errBg, hoverBg: T.errBgHover, color: T.errLight }));

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

    Modal.define('settings', {
        title: 'Auto Refresh Settings',
        minWidth: '320px',
        noAutoFooter: true,
        build: (panel, ctx) => {
            const watches = getWatches();
            const watchCount = watches.length;
            const currentHotkey = GM_getValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);

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
            toggleLabel.appendChild(h('div', { text: 'Reload the page on a timer', style: `font-size:11px;color:${T.textDim};margin-top:1px` }));

            const trackW = 40, trackH = 22, thumbSize = 18;
            const toggle = h('div', {
                style: `width:${trackW}px;height:${trackH}px;border-radius:11px;position:relative;transition:background .2s;flex-shrink:0;background:${isEnabled() ? T.accent : T.borderLight}`
            });
            const thumb = h('div', {
                style: `width:${thumbSize}px;height:${thumbSize}px;border-radius:50%;background:${T.textLight};position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 3px ${T.shadow};left:${isEnabled() ? trackW - thumbSize - 2 + 'px' : '2px'}`
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

            // Refresh section
            addSection(panel, 'Refresh');

            const currentCorner = GM_getValue(STORAGE_KEY_CORNER, 'bottom-right');
            const currentFontSize = GM_getValue(STORAGE_KEY_FONT_SIZE, 'medium');
            const currentTheme = GM_getValue(STORAGE_KEY_THEME, 'dark');
            const currentOpacity = GM_getValue(STORAGE_KEY_OPACITY, 1);
            const cornerName = (CORNER_LABELS[currentCorner] || currentCorner).replace(/[↖↗↙↘↑↓]\s*/, '');
            const fontLabel = currentFontSize.charAt(0).toUpperCase() + currentFontSize.slice(1).replace('-', ' ');
            const themeLabel = THEME_LABELS[currentTheme] || 'Dark';
            const opacityLabel = Math.round(currentOpacity * 100) + '%';

            panel.appendChild(makeOptionBtn('⏱ Refresh Interval', false, () => ctx.push('interval-picker'),
                { value: formatSeconds(getInterval()), subtitle: 'How often the page reloads' }));
            panel.appendChild(makeOptionBtn('📍 Badge Position', false, () => ctx.push('position-picker'),
                { value: cornerName, subtitle: 'Where the countdown timer appears' }));
            panel.appendChild(makeOptionBtn('🔤 Badge Font Size', false, () => ctx.push('fontsize-picker'),
                { value: fontLabel, subtitle: 'Size of the countdown badge text' }));

            // Appearance section
            addSection(panel, 'Appearance');
            panel.appendChild(makeOptionBtn('🎨 Theme', false, () => ctx.push('theme-picker'),
                { value: themeLabel, subtitle: 'Choose a visual style' }));
            panel.appendChild(makeOptionBtn('🔲 Badge Opacity', false, () => ctx.push('opacity-picker'),
                { value: opacityLabel, subtitle: 'Transparency of the countdown badge' }));

            // General section
            addSection(panel, 'General');
            panel.appendChild(makeOptionBtn('⌨ Keyboard Shortcut', false, () => ctx.push('hotkey-picker'),
                { value: currentHotkey, subtitle: 'Hotkey to open this menu' }));

            const alertModeVal = ALERT_MODE_LABELS[GM_getValue(STORAGE_KEY_ALERT_MODE, 'beep')] || 'Beep';
            panel.appendChild(makeOptionBtn('🔔 Alert Mode', false, () => ctx.push('alert-mode-picker'),
                { value: alertModeVal, subtitle: 'How you are notified of changes' }));

            // Watches section
            addSection(panel, `Watches${watchCount > 0 ? ` (${watchCount})` : ''}`);

            panel.appendChild(makeOptionBtn('👁 Add Watch', false, () => { ctx.closeAll(); startElementPicker(); },
                { subtitle: 'Pick an element to monitor for changes' }));

            if (alertIntervalId !== null) {
                const alertBtn = makeOptionBtn('🔕 Stop Alert', false, () => {
                    stopAlert();
                    showToast('Alert silenced');
                    alertBtn.remove();
                }, { subtitle: 'Silence the current change alert', bg: T.errBg, hoverBg: T.errBgHover, color: T.errLight });
                panel.appendChild(alertBtn);
            }

            if (watchCount > 0) {
                panel.appendChild(makeOptionBtn('🔍 Inspect Watches', false, () => ctx.push('watch-inspector'),
                    { value: `${watchCount}`, subtitle: 'View stored vs live content for each watch' }));
                panel.appendChild(makeOptionBtn('🗑 Remove Watches', false, () => ctx.push('clear-watch'),
                    { value: `${watchCount}`, subtitle: 'Remove individual or all watches' }));
            } else {
                panel.appendChild(h('div', { text: 'No watches configured yet', style: `color:${T.borderLight};font-size:12px;padding:4px 4px 0` }));
            }

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
            let watches = getWatches();
            let currentId = (ctx.extra && ctx.extra.watchId) || (watches.length > 0 ? watches[0].id : null);
            if (currentId && !watches.some(w => w.id === currentId)) currentId = watches.length > 0 ? watches[0].id : null;

            const getIdx = () => watches.findIndex(w => w.id === currentId);
            const getCurrent = () => watches.find(w => w.id === currentId);

            if (watches.length === 0) {
                panel.appendChild(h('div', { text: 'No watches configured', style: `color:${T.textFaint};font-size:13px;padding:8px 0` }));
                panel.style.minWidth = '340px';
                return;
            }

            const modeLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

            const layout = h('div', { style: 'display:flex;gap:12px' });
            const sidebar = h('div', { style: `flex:0 0 25%;min-width:130px;border-right:1px solid ${T.borderMid};padding-right:10px;max-height:60vh;overflow-y:auto` });
            const detail = h('div', { style: 'flex:1;min-width:0;max-height:60vh;overflow-y:auto' });
            const sidebarItems = [];

            function buildSidebar() {
                sidebar.innerHTML = '';
                sidebarItems.length = 0;
                watches.forEach((w) => {
                    const status = getWatchStatus(w);
                    const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;
                    const short = w.selector.length > 18 ? w.selector.slice(-18) : w.selector;

                    const item = h('button', { class: `ar-sidebar-item${w.id === currentId ? ' ar-active' : ''}` },
                        h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes' }),
                        h('span', { text: short, style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' })
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
                    title: 'Re-snapshot to current values',
                    onclick: () => {
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
                        removeWatch(w.id);
                        watches = getWatches();
                        if (watches.length === 0) { ctx.close(); showToast('All watches removed'); return; }
                        if (!watches.some(ww => ww.id === currentId)) currentId = watches[0].id;
                        buildSidebar();
                        renderDetail();
                        showToast('Watch removed');
                    }
                });
                toolbar.appendChild(deleteBtn);
                headerRow.appendChild(toolbar);
                detail.appendChild(headerRow);

                // Timestamp
                if (w.snapshotTime) {
                    detail.appendChild(h('div', { text: `Snapshot: ${timeAgo(w.snapshotTime)}`, style: `color:${T.textFaint};font-size:11px;margin-bottom:6px` }));
                }

                // CSS Selector
                const selectorSection = addCollapsible(detail, 'CSS Selector', true);
                const selectorRow = h('div', { style: 'display:flex;align-items:stretch;gap:0' });
                selectorRow.appendChild(h('div', {
                    text: w.selector,
                    style: `background:${T.bgDark};border:1px solid ${T.border};border-radius:6px 0 0 6px;padding:8px 10px;font:13px monospace;color:${T.text};word-break:break-all;flex:1`
                }));
                selectorRow.appendChild(h('button', {
                    text: '📋', title: 'Copy selector',
                    style: `background:${T.bgMid};border:1px solid ${T.border};border-left:none;border-radius:0 6px 6px 0;cursor:pointer;padding:8px 10px;font-size:13px;color:${T.text}`,
                    onclick: () => navigator.clipboard.writeText(w.selector).then(() => showToast('Selector copied'), () => showToast('Copy failed'))
                }));
                selectorSection.body.appendChild(selectorRow);

                const el = document.querySelector(w.selector);

                // Content section
                if (w.mode === 'content' || w.mode === 'both') {
                    const live = el ? el.innerText.trim() : null;
                    const changed = live !== null && live !== w.content;

                    const contentSection = addCollapsible(detail,
                        'Content' + (changed ? ' ⚠ CHANGED' : live !== null ? ' ✓' : ''), true);

                    if (changed) {
                        const DIFF_LIMIT = 500;
                        const oldText = w.content || '(empty)';
                        const newText = live;
                        const isTruncated = oldText.length > DIFF_LIMIT || newText.length > DIFF_LIMIT;

                        const diffBox = h('div', {
                            style: `background:${T.bgDark};border:1px solid ${T.err};border-radius:6px;padding:8px 10px;font-size:13px;word-break:break-all;max-height:200px;overflow-y:auto`
                        });
                        const oldSpan = h('span', {
                            text: isTruncated ? oldText.slice(0, DIFF_LIMIT) + '…' : oldText,
                            style: `color:${T.errLight};text-decoration:line-through`
                        });
                        const arrow = h('span', { text: ' → ', style: `color:${T.textFaint}` });
                        const newSpan = h('span', {
                            text: isTruncated ? newText.slice(0, DIFF_LIMIT) + '…' : newText,
                            style: `color:${T.okText}`
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

                // Style section
                if (w.mode === 'style' || w.mode === 'both') {
                    if (el && w.styles) {
                        const liveStyles = captureStyles(el);
                        const changes = diffStyles(w.styles, liveStyles);
                        const styleSection = addCollapsible(detail,
                            changes.length > 0 ? `Style Changes (${changes.length}) ⚠` : 'Styling ✓', true);

                        if (changes.length > 0) {
                            const chipContainer = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' });
                            changes.forEach(({ prop, from, to }) => {
                                chipContainer.appendChild(h('span', {
                                    class: 'ar-chip',
                                    html: `<span style="color:${T.textMuted}">${prop}:</span> <span style="color:${T.errLight};text-decoration:line-through">${from}</span> → <span style="color:${T.okText}">${to}</span>`
                                }));
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
                    const box = addField(detail, '⚠ Element not found on page', false);
                    box.style.color = T.err;
                    box.style.borderColor = T.err;
                }
            }

            layout.appendChild(sidebar);
            layout.appendChild(detail);
            panel.appendChild(layout);

            buildSidebar();
            renderDetail();
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

        function cleanup() {
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onEsc, true);
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
                    showToast(`Watch removed: ${selector.length > 30 ? selector.slice(0, 30) + '…' : selector}`);
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
                        showToast(`Watching ${mode}: ${selector.length > 30 ? selector.slice(0, 30) + '…' : selector} (${count} total)`);
                    }
                });
                const sub = h('div', { style: `font-size:11px;color:${T.textDim};margin-top:1px`, text: MODE_DESCS[mode] });
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
                document.removeEventListener('click', onClickAway, true);
                document.removeEventListener('keydown', onEscDismiss, true);
            }
        };
        const onEscDismiss = (e) => {
            if (e.key === 'Escape') {
                dismissQuickWatch();
                document.removeEventListener('click', onClickAway, true);
                document.removeEventListener('keydown', onEscDismiss, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', onClickAway, true);
            document.addEventListener('keydown', onEscDismiss, true);
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

    async function checkForChanges() {
        if (!GM_getValue(STORAGE_KEY_WATCH_ENABLED, false)) return;
        const watches = getWatches();
        if (watches.length === 0) return;

        const allChanges = [];
        const missing = [];

        for (let i = 0; i < watches.length; i++) {
            const w = watches[i];
            const el = await waitForElement(w.selector);
            if (!el) {
                missing.push(w.selector.length > 30 ? w.selector.slice(0, 30) + '…' : w.selector);
                continue;
            }

            const changes = [];

            if (w.mode === 'content' || w.mode === 'both') {
                const current = el.innerText.trim();
                if (w.content !== current) { watches[i] = { ...w, content: current }; changes.push('content'); }
            }

            if (w.mode === 'style' || w.mode === 'both') {
                const currentStyles = captureStyles(el);
                if (w.styles !== currentStyles) { watches[i] = { ...w, styles: currentStyles }; changes.push('styling'); }
            }

            if (changes.length > 0) {
                const short = w.selector.length > 25 ? w.selector.slice(0, 25) + '…' : w.selector;
                allChanges.push(`${short} (${changes.join(' & ')})`);
            }
        }

        setWatches(watches);

        if (missing.length > 0) {
            stopRefresh();
            speak(`Warning: ${missing.length} watched element${missing.length > 1 ? 's' : ''} not found on ${_pageLabel()}.`);
            startAlert();
            showToast(`${missing.length} watched element${missing.length > 1 ? 's' : ''} not found!`);
            return;
        }

        if (allChanges.length > 0) {
            stopRefresh();
            if (allChanges.length === 1) {
                speak(`Watch changed on ${_pageLabel()}. Content updated.`);
            } else {
                speak(`${allChanges.length} watches changed on ${_pageLabel()}.`);
            }
            startAlert();
            showToast(`${allChanges.length} watch${allChanges.length > 1 ? 'es' : ''} changed!`);
        }
    }

    function getWatchStatus(w) {
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
        const combo = GM_getValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);
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
