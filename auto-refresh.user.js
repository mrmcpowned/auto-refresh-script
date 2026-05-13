// ==UserScript==
// @name         Auto Refresh Page
// @namespace    http://chrisr.xyz/
// @version      4.6.0
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

    const VERSION = '4.6.0';

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

    const State = (() => {
        const _s = {
            countdownTimerId: null,
            alertIntervalId: null,
            audioCtx: null,
            lastWebhookTime: 0,
            activeCtxMenu: null,
            badgeHoverEndHandler: null,
        };
        return {
            get(k) { return _s[k]; },
            set(k, v) { _s[k] = v; },
        };
    })();

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

    function getCornerLabels() {
        return {
            'top-left': t('position.topLeft'), 'top-center': t('position.topCenter'), 'top-right': t('position.topRight'),
            'bottom-left': t('position.bottomLeft'), 'bottom-center': t('position.bottomCenter'), 'bottom-right': t('position.bottomRight')
        };
    }

    const FONT_SIZES = { 'small': '11px', 'medium': '13px', 'large': '16px', 'extra-large': '20px' };

    function getThemeLabels() { return { dark: t('theme.dark'), light: t('theme.light'), minimal: t('theme.minimal'), highContrast: t('theme.highContrast') }; }

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
        language:         { key: 'autoRefreshLanguage',         default: 'auto',          type: 'string' },
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

    // --- Language Options ---

    const LANGUAGE_OPTIONS = [
        { code: 'auto', label: 'Auto (Browser)', desc: 'Detect from browser settings' },
        { code: 'en',   label: 'English',         desc: 'Default' },
        { code: 'es',   label: 'Español',         desc: 'Spanish' },
    ];

    // --- I18N Dictionary ---

    const I18N = {
      en: {
        // Modal titles & subtitles
        'settings.title':           'Auto Refresh Settings',
        'theme.title':              'Theme',
        'theme.subtitle':           'Choose a visual style',
        'fontSize.title':           'Badge Font Size',
        'fontSize.subtitle':        'Size of the countdown badge text',
        'opacity.title':            'Badge Opacity',
        'opacity.subtitle':         'Transparency of the countdown badge',
        'position.title':           'Badge Position',
        'position.subtitle':        'Where the countdown timer appears',
        'interval.title':           'Refresh Interval',
        'interval.subtitle':        'How often the page reloads',
        'hotkey.title':             'Keyboard Shortcut',
        'hotkey.subtitle':          'Press a key combination with at least one modifier',
        'alertMode.title':          'Alert Mode',
        'alertMode.subtitle':       'How you are notified when a watch detects a change',
        'ttsSpeed.title':           'Speech Speed',
        'ttsSpeed.subtitle':        'How fast the announcement is spoken',
        'ttsVolume.title':          'Speech Volume',
        'ttsVolume.subtitle':       'Volume of the spoken announcement',
        'ttsVoice.title':           'Speech Voice',
        'ttsVoice.subtitle':        'Choose a system voice for announcements',
        'webhook.title':            'Webhook Notifications',
        'webhook.subtitle':         'Send alerts to external services',
        'webhookEdit.title':        'Webhook',
        'webhookEdit.subtitle':     'Configure this webhook endpoint',
        'webhookAdd.title':         'Add Webhook',
        'webhookEdit.editTitle':    'Edit Webhook',
        'clearWatch.title':         'Remove Watch',
        'clearWatch.subtitle':      'Select a watch to remove',
        'watchMode.title':          'What to watch?',
        'watchMode.subtitle':       'Choose what changes to monitor',
        'badgeMenu.title':          'Quick Actions',
        'badgeStyle.title':         'Badge Style',
        'badgeStyle.subtitle':      'Customize the countdown badge',
        'language.title':           'Language',
        'language.subtitle':        'Display language for all UI elements',

        // Setting labels
        'setting.interval':         '⏱ Refresh Interval',
        'setting.addWatch':         '👁 Add Watch',
        'setting.watchOverview':    '📋 Watch Overview',
        'setting.stopAlert':        '🔕 Stop Alert',
        'setting.inspectWatches':   '🔍 Inspect Watches',
        'setting.removeWatches':    '🗑 Remove Watches',
        'setting.badgeStyle':       '🏷 Badge Style',
        'setting.theme':            '🎨 Theme',
        'setting.hotkey':           '⌨ Keyboard Shortcut',
        'setting.alertMode':        '🔔 Alert Mode',
        'setting.language':         '🌐 Language',
        'setting.webhook':          '🌐 Webhook',

        // Setting subtitles
        'setting.interval.sub':     'How often the page reloads',
        'setting.addWatch.sub':     'Pick an element to monitor for changes',
        'setting.watchOverview.sub':'All watches across pages',
        'setting.stopAlert.sub':    'Silence the current change alert',
        'setting.inspect.sub':      'View stored vs live content for each watch',
        'setting.remove.sub':       'Remove individual or all watches',
        'setting.badgeStyle.sub':   'Position, size, and opacity',
        'setting.theme.sub':        'Choose a visual style',
        'setting.hotkey.sub':       'Hotkey to open this menu',
        'setting.alertMode.sub':    'How you are notified of changes',
        'setting.webhook.sub':      'Send alerts to external services',

        // Sections
        'section.watches':          'Watches',
        'section.badge':            'Badge & Appearance',
        'section.general':          'General',
        'section.speech':           'Speech Settings',
        'section.custom':           'Custom',
        'section.seconds':          'Seconds',
        'section.minutes':          'Minutes',
        'section.webhooks':         'Webhooks',
        'section.labelOptional':    'Label (Optional)',
        'section.webhookUrl':       'Webhook URL',
        'section.format':           'Format',
        'section.availableTags':    'Available Tags',
        'section.messageTemplate':  'Message Template',

        // Toggle & status
        'toggle.autoRefresh':       'Auto-Refresh',
        'toggle.autoRefresh.sub':   'Reload the page on a timer',
        'toggle.webhooksEnabled':   'Webhooks Enabled',
        'toggle.webhooks.sub':      'Global kill switch for all webhooks',
        'status.active':            'Active · refreshing every {interval}',
        'status.inactive':          'Inactive',
        'status.paused':            '⏸ Paused · {time} remaining',
        'status.changed':           'Changed',
        'status.notFound':          'Not found',
        'status.noChanges':         'No changes',
        'status.currentPage':       'Current page',
        'status.otherPage':         'Other page',

        // Buttons & actions
        'btn.set':                  'Set',
        'btn.save':                 '💾 Save',
        'btn.sendTest':             '🧪 Send Test',
        'btn.sending':              '⏳ Sending...',
        'btn.deleteWebhook':        '🗑 Delete Webhook',
        'btn.confirmDelete':        '🗑 Click again to confirm',
        'btn.resume':               '▶ Resume',
        'btn.resume.sub':           'Continue countdown',
        'btn.stop':                 '⏹ Stop Refresh',
        'btn.stop.sub':             'Stop and hide badge',
        'btn.settings':             '⚙ Settings',
        'btn.settings.sub':         'Open full settings panel',
        'btn.addWebhook':           '➕ Add Webhook',
        'btn.addWebhook.sub':       'Configure a new webhook endpoint',
        'btn.clearAll':             '❌ Clear All',
        'btn.clearAllConfirm':      '❌ Click again to confirm',
        'btn.pickAgain':            '← Pick again',
        'btn.preview':              'Preview',
        'btn.preview.stop':         'Stop preview',
        'btn.testSpeech':           '▶ Test Speech',
        'btn.testSpeech.sub':       'Preview the current speech settings',
        'btn.resetDefault':         'Reset to default (Alt+Shift+R)',
        'btn.fullOptions':          '⚙ Full options…',
        'btn.showAllLangs':         'Show all languages ({count} more)',

        // More settings
        'more.fewer':               '▲ Fewer settings',
        'more.expand':              '⚙ More settings',
        'more.expandHint':          ' — badge, theme, alerts, hotkey',

        // Theme options
        'theme.dark':               'Dark',
        'theme.dark.desc':          'Dark background, light text',
        'theme.light':              'Light',
        'theme.light.desc':         'Light background, dark text',
        'theme.minimal':            'Minimal',
        'theme.minimal.desc':       'Text only, transparent background',
        'theme.highContrast':       'High Contrast',
        'theme.highContrast.desc':  'Maximum visibility',

        // Font size options
        'fontSize.small':           'Small',
        'fontSize.medium':          'Medium',
        'fontSize.large':           'Large',
        'fontSize.extraLarge':      'Extra Large',

        // Position labels
        'position.topLeft':         '↖ Top Left',
        'position.topCenter':       '↑ Top Center',
        'position.topRight':        '↗ Top Right',
        'position.bottomLeft':      '↙ Bottom Left',
        'position.bottomCenter':    '↓ Bottom Center',
        'position.bottomRight':     '↘ Bottom Right',

        // Time formatting
        'time.seconds':             '{n} seconds',
        'time.minute':              '{n} minute',
        'time.minutes':             '{n} minutes',
        'time.hour':                '{n} hour',
        'time.hours':               '{n} hours',
        'time.shortMinSec':         '{m}m {s}s',
        'time.shortHourMin':        '{h}h {m}m',

        // Webhook count
        'webhook.countOn':          '{enabled} of {total} on',

        // Alert mode options
        'alertMode.beep':           'Beep Only',
        'alertMode.beep.desc':      'Repeating tone (default)',
        'alertMode.speech':         'Speech Only',
        'alertMode.speech.desc':    'Announce changes aloud',
        'alertMode.both':           'Beep + Speech',
        'alertMode.both.desc':      'Tone followed by announcement',
        'alertModeLabel.beep':      'Beep',
        'alertModeLabel.speech':    'Speech',
        'alertModeLabel.both':      'Both',

        // TTS rate labels
        'ttsRate.slow':             'Slow',
        'ttsRate.normal':           'Normal',
        'ttsRate.fast':             'Fast',
        'ttsRate.veryFast':         'Very Fast',

        // TTS
        'tts.voice':                '🗣 Voice',
        'tts.voice.sub':            'System voice for announcements',
        'tts.speed':                '⏩ Speed',
        'tts.speed.sub':            'How fast the announcement is spoken',
        'tts.volume':               '🔊 Volume',
        'tts.volume.sub':           'Volume of the spoken announcement',
        'tts.default':              'Default',
        'tts.default.sub':          'Browser default voice',
        'tts.noVoices':             'No voices available',
        'tts.noMatch':              'No matching voices',
        'tts.previewFailed':        'Voice unavailable — try a local voice',
        'tts.searchPlaceholder':    'Search voices\u2026',
        'tts.unavailable':          'Speech synthesis is not available in this browser.',
        'tts.testText':             'Watch changed: sample content updated.',

        // Badge
        'badge.ariaLabel':          'Auto-refresh countdown badge — click for options',
        'badge.clickOptions':       'Click for options',
        'badge.position':           '📍 Badge Position',
        'badge.position.sub':       'Where the countdown timer appears',
        'badge.fontSize':           '🔤 Badge Font Size',
        'badge.fontSize.sub':       'Size of the countdown badge text',
        'badge.opacity':            '🔲 Badge Opacity',
        'badge.opacity.sub':        'Transparency of the countdown badge',
        'badge.watchesActive':      'Watches active',
        'badge.hoverInterval':      'Interval: {interval}',
        'badge.hoverWatches':       'Watches: {count}',
        'badge.hoverPaused':        '⏸ Paused',

        // Watch modes
        'watchMode.content':        '📝 Text Content',
        'watchMode.style':          '🎨 Styling',
        'watchMode.both':           '📝🎨 Both',
        'watchMode.content.desc':   'Alert when text inside the element changes',
        'watchMode.style.desc':     'Alert when CSS properties change',
        'watchMode.both.desc':      'Monitor both text and styling',

        // Context menu
        'ctx.alreadyWatching':      '👁 Already watching',
        'ctx.watchThis':            '🔍 Watch this element',
        'ctx.modeText':             '📝 Text',
        'ctx.modeStyle':            '🎨 Style',
        'ctx.modeBoth':             '📝🎨 Both',
        'ctx.statusChanged':        '⚠ Changed',
        'ctx.statusMissing':        '❌ Missing',
        'ctx.statusOk':             '✓ OK',
        'ctx.resnap':               '🔄 Re-snapshot',
        'ctx.removeWatch':          '🗑 Remove watch',
        'ctx.inspect':              '🔍 Inspect',
        'ctx.descContent':          'Alert when text changes',
        'ctx.descStyle':            'Alert when CSS changes',
        'ctx.descBoth':             'Monitor text and styling',
        'ctx.fullOptions':          '⚙ Full options…',
        'ctx.watchingToast':        'Watching {mode}: {selector} ({count} total)',

        // Watch inspector
        'inspector.title':          'Watch Inspector',
        'inspector.subtitle':       'View stored vs live content for each watch',
        'inspector.noWatches':      'No watches configured',
        'inspector.cssSelector':    'CSS Selector',
        'inspector.copySelector':   'Copy selector',
        'inspector.storedContent':  'Stored Content',
        'inspector.content':        'Content',
        'inspector.contentChanged': 'Content ⚠ CHANGED',
        'inspector.contentOk':      'Content ✓',
        'inspector.storedStyles':   'Stored Styles',
        'inspector.styling':        'Styling',
        'inspector.styleChanges':   'Style Changes ({count})',
        'inspector.stylingOk':      'Styling ✓',
        'inspector.noStyleChanges': 'No style changes detected',
        'inspector.noStyles':       'No styles stored',
        'inspector.propsCaptured':  '{count} properties captured',
        'inspector.navigateFirst':  'Navigate to this page first',
        'inspector.navigateToSee':  'Navigate to this page to see live content',
        'inspector.navigateToResnap':'Navigate to this page to re-snapshot',
        'inspector.resnapTitle':    'Re-snapshot to current values',
        'inspector.resnap':         '🔄 Re-snapshot',
        'inspector.removeTitle':    'Remove this watch',
        'inspector.remove':         'Remove',
        'inspector.openPageTitle':  'Open this page in a new tab',
        'inspector.openPage':       'Open Page',
        'inspector.elementNotFound':'⚠ Element not found on page',
        'inspector.snapshot':       'Snapshot',
        'inspector.showFullDiff':   'Show full diff ({chars} chars)',

        // Watch overview
        'overview.title':           'Watch Overview',
        'overview.subtitle':        'All watches across pages',
        'overview.noWatches':       'No watches found on any page',
        'overview.noWatchesDomain': 'No watches on this domain',
        'overview.thisDomain':      'This Domain',
        'overview.allDomains':      'All Domains',
        'overview.currentPage':     'Current page',
        'overview.otherPage':       'Other page',
        'overview.removeAll':       '🗑 Remove all {domain} watches',
        'overview.confirmRemove':   '🗑 Click again to confirm',
        'overview.removedToast':    'Removed {count} watches from {domain}',
        'overview.total':           '{count} total',

        // Hotkey picker
        'hotkey.current':           'Current:',
        'hotkey.prompt':            'Press your desired key combination...',
        'hotkey.recording':         'Recording... now press a key',
        'hotkey.saved':             '✓ Shortcut saved',
        'hotkey.resetDone':         '✓ Reset to default',

        // Webhook
        'webhook.none':             'None',
        'webhook.off':              'Off',
        'webhook.noWebhooks':       'No webhooks configured yet',
        'webhook.noUrl':            '(no URL)',

        // Time ago
        'timeAgo.unknown':          'unknown',
        'timeAgo.seconds':          '{n}s ago',
        'timeAgo.minutes':          '{n}m ago',
        'timeAgo.hours':            '{n}h ago',
        'timeAgo.days':             '{n}d ago',

        // Element picker
        'picker.instructions':      'Click an element to watch for changes (Esc to cancel)',
        'picker.largeElement':      '⚠ This element has {count} chars of text. Consider picking a more specific child element for cleaner diffs.',

        // Toast messages
        'toast.fontSizeSet':        'Font size set to {label}',
        'toast.themeSet':           'Theme set to {label}',
        'toast.opacitySet':         'Badge opacity set to {value}%',
        'toast.positionSet':        'Badge position set to {label}',
        'toast.intervalSet':        'Refresh interval set to {interval}',
        'toast.shortcutSet':        'Shortcut set to {combo}',
        'toast.shortcutReset':      'Shortcut reset to {combo}',
        'toast.voiceSetDefault':    'Voice set to Default',
        'toast.voiceSet':           'Voice set to {name}',
        'toast.alertModeSet':       'Alert mode set to {label}',
        'toast.webhooksEnabled':    'Webhooks enabled',
        'toast.webhooksDisabled':   'Webhooks disabled',
        'toast.enterUrl':           'Enter a webhook URL first',
        'toast.invalidUrl':         'Invalid URL',
        'toast.enterUrlShort':      'Enter a webhook URL',
        'toast.testSuccess':        '✅ Test webhook sent successfully',
        'toast.testFail':           '❌ Webhook failed ({reason})',
        'toast.webhookAdded':       'Webhook added',
        'toast.webhookSaved':       'Webhook saved',
        'toast.webhookDeleted':     'Webhook deleted',
        'toast.allWatchesRemoved':  'All watches removed',
        'toast.watchRemoved':       'Watch removed ({count} remaining)',
        'toast.watchRemovedSimple': 'Watch removed',
        'toast.watching':           'Watching {mode}: {selector} ({count} total)',
        'toast.refreshStopped':     'Auto-refresh stopped',
        'toast.refreshStarted':     'Auto-refresh started: every {interval}',
        'toast.alertSilenced':      'Alert silenced',
        'toast.navigateFirst':      'Navigate to this page first',
        'toast.elementNotFound':    'Element not found',
        'toast.snapshotUpdated':    'Snapshot updated',
        'toast.selectorCopied':     'Selector copied',
        'toast.copyFailed':         'Copy failed',
        'toast.removedDomain':      'Removed {count} watches from {domain}',
        'toast.pickerCancelled':    'Element picker cancelled',
        'toast.watchRemovedName':   'Watch removed: {name}',
        'toast.allWatchesCleared':  'All watches cleared',
        'toast.missingElements':    '{count} watched element not found!|{count} watched elements not found!',
        'toast.watchesChanged':     '{count} watch changed!|{count} watches changed!',
        'toast.watchRemovedSel':    'Watch removed: {selector}',
        'toast.languageSet':        'Language set to {label}',
        'toast.speedSet':           'Speech speed set to {label}',
        'toast.volumeSet':          'Speech volume set to {label}',
        'toast.undo':               'Undo',
        'toast.watchRestored':      'Watch restored',
        'toast.watchesRestored':    'Watches restored',
        'toast.settingsReset':      'All settings reset to defaults',
        'toast.settingsRestored':   'Settings restored',

        // Settings reset
        'setting.resetDefaults':    '♻ Reset to Defaults',
        'setting.resetDefaults.sub':'Restore all settings to factory defaults',
        'btn.resetConfirm':         '♻ Click again to confirm',

        // Settings search
        'filter.placeholder':       'Filter settings…',
        'filter.noResults':         'No matching settings',

        // Keyboard shortcuts cheat sheet
        'shortcuts.title':          'Keyboard Shortcuts',
        'shortcuts.openSettings':   'Open settings',
        'shortcuts.escape':         'Close / go back',
        'shortcuts.navigate':       'Navigate options',
        'shortcuts.select':         'Select option',
        'shortcuts.contextMenu':    'Quick watch menu',
        'shortcuts.dismiss':        'Press any key to dismiss',

        // Watch naming
        'watch.nameOptional':       'Name (optional)',
        'watch.namePlaceholder':    'e.g., Amazon Price',

        // TTS speech
        'speak.missingWarning':     'Warning: {count} watched element not found on {page}.|Warning: {count} watched elements not found on {page}.',
        'speak.watchChanged':       'Watch changed on {page}. Content updated.',
        'speak.watchesChanged':     '{count} watches changed on {page}.',

        // Errors
        'error.modifierRequired':   'At least one modifier key required',
        'error.reservedKey':        '{combo} is reserved by the browser',

        // Navigation
        'nav.back':                 '← Back',
        'nav.escBack':              'Press Esc to go back',
        'nav.escDismiss':           'Press Esc to dismiss',
        'nav.escCancel':            'Press Esc to cancel',

        // Footer
        'footer.hotkeyVersion':     'Press {hotkey} to open this menu · v{version}',

        // Menu commands
        'menu.openSettings':        'Open settings',
        'menu.fontSize':            'Set badge font size',
        'menu.position':            'Set badge position',
        'menu.interval':            'Set refresh interval',
        'menu.hotkey':              'Set keyboard shortcut',
        'menu.watchElement':        'Watch element for changes',
        'menu.clearWatch':          'Clear watch',
        'menu.startRefresh':        'Start auto-refresh',
        'menu.stopRefresh':         'Stop auto-refresh',
        'menu.runTests':            'Run tests',

        // Test results
        'test.allPassed':           '✅ All {count} tests passed',
        'test.someFailed':          '❌ {failed} failed, {passed} passed',
      },

      es: {
        'settings.title':           'Configuración de Auto Refresh',
        'theme.title':              'Tema',
        'theme.subtitle':           'Elige un estilo visual',
        'fontSize.title':           'Tamaño de Fuente',
        'fontSize.subtitle':        'Tamaño del texto del contador',
        'opacity.title':            'Opacidad del Badge',
        'opacity.subtitle':         'Transparencia del contador',
        'position.title':           'Posición del Badge',
        'position.subtitle':        'Dónde aparece el temporizador',
        'interval.title':           'Intervalo de Actualización',
        'interval.subtitle':        'Cada cuánto se recarga la página',
        'hotkey.title':             'Atajo de Teclado',
        'hotkey.subtitle':          'Presiona una combinación de teclas con al menos un modificador',
        'alertMode.title':          'Modo de Alerta',
        'alertMode.subtitle':       'Cómo se te notifica cuando un watch detecta un cambio',
        'ttsSpeed.title':           'Velocidad del Habla',
        'ttsSpeed.subtitle':        'Qué tan rápido se habla el anuncio',
        'ttsVolume.title':          'Volumen del Habla',
        'ttsVolume.subtitle':       'Volumen del anuncio hablado',
        'ttsVoice.title':           'Voz del Habla',
        'ttsVoice.subtitle':        'Elige una voz del sistema para anuncios',
        'webhook.title':            'Notificaciones Webhook',
        'webhook.subtitle':         'Enviar alertas a servicios externos',
        'webhookEdit.title':        'Webhook',
        'webhookEdit.subtitle':     'Configura este endpoint webhook',
        'webhookAdd.title':         'Agregar Webhook',
        'webhookEdit.editTitle':    'Editar Webhook',
        'clearWatch.title':         'Eliminar Watch',
        'clearWatch.subtitle':      'Selecciona un watch para eliminar',
        'watchMode.title':          '¿Qué monitorizar?',
        'watchMode.subtitle':       'Elige qué cambios monitorizar',
        'badgeMenu.title':          'Acciones Rápidas',
        'badgeStyle.title':         'Estilo del Badge',
        'badgeStyle.subtitle':      'Personaliza el contador',
        'language.title':           'Idioma',
        'language.subtitle':        'Idioma de visualización para todos los elementos de la UI',

        'setting.interval':         '⏱ Intervalo de Actualización',
        'setting.addWatch':         '👁 Agregar Watch',
        'setting.watchOverview':    '📋 Resumen de Watches',
        'setting.stopAlert':        '🔕 Silenciar Alerta',
        'setting.inspectWatches':   '🔍 Inspeccionar Watches',
        'setting.removeWatches':    '🗑 Eliminar Watches',
        'setting.badgeStyle':       '🏷 Estilo del Badge',
        'setting.theme':            '🎨 Tema',
        'setting.hotkey':           '⌨ Atajo de Teclado',
        'setting.alertMode':        '🔔 Modo de Alerta',
        'setting.language':         '🌐 Idioma',
        'setting.webhook':          '🌐 Webhook',

        'setting.interval.sub':     'Cada cuánto se recarga la página',
        'setting.addWatch.sub':     'Elige un elemento para monitorizar cambios',
        'setting.watchOverview.sub':'Todos los watches en todas las páginas',
        'setting.stopAlert.sub':    'Silenciar la alerta de cambio actual',
        'setting.inspect.sub':      'Ver contenido almacenado vs actual para cada watch',
        'setting.remove.sub':       'Eliminar watches individuales o todos',
        'setting.badgeStyle.sub':   'Posición, tamaño y opacidad',
        'setting.theme.sub':        'Elige un estilo visual',
        'setting.hotkey.sub':       'Atajo para abrir este menú',
        'setting.alertMode.sub':    'Cómo se te notifica de cambios',
        'setting.webhook.sub':      'Enviar alertas a servicios externos',

        'section.watches':          'Watches',
        'section.badge':            'Badge y Apariencia',
        'section.general':          'General',
        'section.speech':           'Configuración de Habla',
        'section.custom':           'Personalizado',
        'section.seconds':          'Segundos',
        'section.minutes':          'Minutos',
        'section.webhooks':         'Webhooks',
        'section.labelOptional':    'Etiqueta (Opcional)',
        'section.webhookUrl':       'URL del Webhook',
        'section.format':           'Formato',
        'section.availableTags':    'Etiquetas Disponibles',
        'section.messageTemplate':  'Plantilla de Mensaje',

        'toggle.autoRefresh':       'Auto-Refresh',
        'toggle.autoRefresh.sub':   'Recargar la página con un temporizador',
        'toggle.webhooksEnabled':   'Webhooks Habilitados',
        'toggle.webhooks.sub':      'Interruptor global para todos los webhooks',
        'status.active':            'Activo · recargando cada {interval}',
        'status.inactive':          'Inactivo',
        'status.paused':            '⏸ Pausado · {time} restante',
        'status.changed':           'Cambió',
        'status.notFound':          'No encontrado',
        'status.noChanges':         'Sin cambios',
        'status.currentPage':       'Página actual',
        'status.otherPage':         'Otra página',

        'btn.set':                  'Establecer',
        'btn.save':                 '💾 Guardar',
        'btn.sendTest':             '🧪 Enviar Prueba',
        'btn.sending':              '⏳ Enviando...',
        'btn.deleteWebhook':        '🗑 Eliminar Webhook',
        'btn.confirmDelete':        '🗑 Haz clic de nuevo para confirmar',
        'btn.resume':               '▶ Reanudar',
        'btn.resume.sub':           'Continuar cuenta regresiva',
        'btn.stop':                 '⏹ Detener Actualización',
        'btn.stop.sub':             'Detener y ocultar badge',
        'btn.settings':             '⚙ Configuración',
        'btn.settings.sub':         'Abrir panel de configuración completo',
        'btn.addWebhook':           '➕ Agregar Webhook',
        'btn.addWebhook.sub':       'Configurar un nuevo endpoint webhook',
        'btn.clearAll':             '❌ Eliminar Todos',
        'btn.clearAllConfirm':      '❌ Haz clic de nuevo para confirmar',
        'btn.pickAgain':            '← Elegir de nuevo',
        'btn.preview':              'Vista previa',
        'btn.preview.stop':         'Detener vista previa',
        'btn.testSpeech':           '▶ Probar Habla',
        'btn.testSpeech.sub':       'Vista previa de la configuración de habla actual',
        'btn.resetDefault':         'Restablecer por defecto (Alt+Shift+R)',
        'btn.fullOptions':          '⚙ Todas las opciones…',
        'btn.showAllLangs':         'Mostrar todos los idiomas ({count} más)',

        'more.fewer':               '▲ Menos configuraciones',
        'more.expand':              '⚙ Más configuraciones',
        'more.expandHint':          ' — badge, tema, alertas, atajo',

        'theme.dark':               'Oscuro',
        'theme.dark.desc':          'Fondo oscuro, texto claro',
        'theme.light':              'Claro',
        'theme.light.desc':         'Fondo claro, texto oscuro',
        'theme.minimal':            'Mínimo',
        'theme.minimal.desc':       'Solo texto, fondo transparente',
        'theme.highContrast':       'Alto Contraste',
        'theme.highContrast.desc':  'Máxima visibilidad',

        'fontSize.small':           'Pequeño',
        'fontSize.medium':          'Mediano',
        'fontSize.large':           'Grande',
        'fontSize.extraLarge':      'Extra Grande',

        'position.topLeft':         '↖ Arriba Izq.',
        'position.topCenter':       '↑ Arriba Centro',
        'position.topRight':        '↗ Arriba Der.',
        'position.bottomLeft':      '↙ Abajo Izq.',
        'position.bottomCenter':    '↓ Abajo Centro',
        'position.bottomRight':     '↘ Abajo Der.',

        'time.seconds':             '{n} segundos',
        'time.minute':              '{n} minuto',
        'time.minutes':             '{n} minutos',
        'time.hour':                '{n} hora',
        'time.hours':               '{n} horas',
        'time.shortMinSec':         '{m}m {s}s',
        'time.shortHourMin':        '{h}h {m}m',

        'webhook.countOn':          '{enabled} de {total} activos',

        'alertMode.beep':           'Solo Tono',
        'alertMode.beep.desc':      'Tono repetitivo (predeterminado)',
        'alertMode.speech':         'Solo Habla',
        'alertMode.speech.desc':    'Anunciar cambios en voz alta',
        'alertMode.both':           'Tono + Habla',
        'alertMode.both.desc':      'Tono seguido de anuncio',
        'alertModeLabel.beep':      'Tono',
        'alertModeLabel.speech':    'Habla',
        'alertModeLabel.both':      'Ambos',

        'ttsRate.slow':             'Lento',
        'ttsRate.normal':           'Normal',
        'ttsRate.fast':             'Rápido',
        'ttsRate.veryFast':         'Muy Rápido',

        'tts.voice':                '🗣 Voz',
        'tts.voice.sub':            'Voz del sistema para anuncios',
        'tts.speed':                '⏩ Velocidad',
        'tts.speed.sub':            'Qué tan rápido se habla el anuncio',
        'tts.volume':               '🔊 Volumen',
        'tts.volume.sub':           'Volumen del anuncio hablado',
        'tts.default':              'Predeterminado',
        'tts.default.sub':          'Voz predeterminada del navegador',
        'tts.noVoices':             'No hay voces disponibles',
        'tts.noMatch':              'No se encontraron voces',
        'tts.previewFailed':        'Voz no disponible — prueba una voz local',
        'tts.searchPlaceholder':    'Buscar voces\u2026',
        'tts.unavailable':          'La síntesis de voz no está disponible en este navegador.',
        'tts.testText':             'Watch cambiado: contenido de ejemplo actualizado.',

        'badge.ariaLabel':          'Contador de auto-refresh — haz clic para opciones',
        'badge.clickOptions':       'Haz clic para opciones',
        'badge.position':           '📍 Posición del Badge',
        'badge.position.sub':       'Dónde aparece el temporizador',
        'badge.fontSize':           '🔤 Tamaño de Fuente del Badge',
        'badge.fontSize.sub':       'Tamaño del texto del contador',
        'badge.opacity':            '🔲 Opacidad del Badge',
        'badge.opacity.sub':        'Transparencia del contador',
        'badge.watchesActive':      'Watches activos',
        'badge.hoverInterval':      'Intervalo: {interval}',
        'badge.hoverWatches':       'Watches: {count}',
        'badge.hoverPaused':        '⏸ Pausado',

        'watchMode.content':        '📝 Contenido de Texto',
        'watchMode.style':          '🎨 Estilo',
        'watchMode.both':           '📝🎨 Ambos',
        'watchMode.content.desc':   'Alertar cuando el texto del elemento cambie',
        'watchMode.style.desc':     'Alertar cuando las propiedades CSS cambien',
        'watchMode.both.desc':      'Monitorizar texto y estilo',

        'ctx.alreadyWatching':      '👁 Ya monitorizando',
        'ctx.watchThis':            '🔍 Monitorizar este elemento',
        'ctx.modeText':             '📝 Texto',
        'ctx.modeStyle':            '🎨 Estilo',
        'ctx.modeBoth':             '📝🎨 Ambos',
        'ctx.statusChanged':        '⚠ Cambió',
        'ctx.statusMissing':        '❌ Faltante',
        'ctx.statusOk':             '✓ OK',
        'ctx.resnap':               '🔄 Re-capturar',
        'ctx.removeWatch':          '🗑 Eliminar watch',
        'ctx.inspect':              '🔍 Inspeccionar',
        'ctx.descContent':          'Alertar cuando el texto cambie',
        'ctx.descStyle':            'Alertar cuando el CSS cambie',
        'ctx.descBoth':             'Monitorizar texto y estilo',
        'ctx.fullOptions':          '⚙ Todas las opciones…',
        'ctx.watchingToast':        'Monitorizando {mode}: {selector} ({count} total)',

        'inspector.title':          'Inspector de Watches',
        'inspector.subtitle':       'Ver contenido almacenado vs actual para cada watch',
        'inspector.noWatches':      'No hay watches configurados',
        'inspector.cssSelector':    'Selector CSS',
        'inspector.copySelector':   'Copiar selector',
        'inspector.storedContent':  'Contenido Almacenado',
        'inspector.content':        'Contenido',
        'inspector.contentChanged': 'Contenido ⚠ CAMBIÓ',
        'inspector.contentOk':      'Contenido ✓',
        'inspector.storedStyles':   'Estilos Almacenados',
        'inspector.styling':        'Estilo',
        'inspector.styleChanges':   'Cambios de Estilo ({count})',
        'inspector.stylingOk':      'Estilo ✓',
        'inspector.noStyleChanges': 'No se detectaron cambios de estilo',
        'inspector.noStyles':       'No hay estilos almacenados',
        'inspector.propsCaptured':  '{count} propiedades capturadas',
        'inspector.navigateFirst':  'Navega a esta página primero',
        'inspector.navigateToSee':  'Navega a esta página para ver el contenido actual',
        'inspector.navigateToResnap':'Navega a esta página para re-capturar',
        'inspector.resnapTitle':    'Re-capturar a los valores actuales',
        'inspector.resnap':         '🔄 Re-capturar',
        'inspector.removeTitle':    'Eliminar este watch',
        'inspector.remove':         'Eliminar',
        'inspector.openPageTitle':  'Abrir esta página en una nueva pestaña',
        'inspector.openPage':       'Abrir Página',
        'inspector.elementNotFound':'⚠ Elemento no encontrado en la página',
        'inspector.snapshot':       'Captura',
        'inspector.showFullDiff':   'Mostrar diff completo ({chars} caracteres)',

        'overview.title':           'Resumen de Watches',
        'overview.subtitle':        'Todos los watches en todas las páginas',
        'overview.noWatches':       'No se encontraron watches en ninguna página',
        'overview.noWatchesDomain': 'No hay watches en este dominio',
        'overview.thisDomain':      'Este Dominio',
        'overview.allDomains':      'Todos los Dominios',
        'overview.currentPage':     'Página actual',
        'overview.otherPage':       'Otra página',
        'overview.removeAll':       '🗑 Eliminar todos los watches de {domain}',
        'overview.confirmRemove':   '🗑 Haz clic de nuevo para confirmar',
        'overview.removedToast':    'Eliminados {count} watches de {domain}',
        'overview.total':           '{count} total',

        'hotkey.current':           'Actual:',
        'hotkey.prompt':            'Presiona la combinación de teclas deseada...',
        'hotkey.recording':         'Grabando... ahora presiona una tecla',
        'hotkey.saved':             '✓ Atajo guardado',
        'hotkey.resetDone':         '✓ Restablecido por defecto',

        'webhook.none':             'Ninguno',
        'webhook.off':              'Desactivado',
        'webhook.noWebhooks':       'No hay webhooks configurados todavía',
        'webhook.noUrl':            '(sin URL)',

        'timeAgo.unknown':          'desconocido',
        'timeAgo.seconds':          'hace {n}s',
        'timeAgo.minutes':          'hace {n}m',
        'timeAgo.hours':            'hace {n}h',
        'timeAgo.days':             'hace {n}d',

        'picker.instructions':      'Haz clic en un elemento para monitorizar cambios (Esc para cancelar)',
        'picker.largeElement':      '⚠ Este elemento tiene {count} caracteres de texto. Considera elegir un elemento hijo más específico para diffs más limpios.',

        'toast.fontSizeSet':        'Tamaño de fuente: {label}',
        'toast.themeSet':           'Tema: {label}',
        'toast.opacitySet':         'Opacidad del badge: {value}%',
        'toast.positionSet':        'Posición del badge: {label}',
        'toast.intervalSet':        'Intervalo: {interval}',
        'toast.shortcutSet':        'Atajo: {combo}',
        'toast.shortcutReset':      'Atajo restablecido a {combo}',
        'toast.voiceSetDefault':    'Voz establecida: Predeterminada',
        'toast.voiceSet':           'Voz: {name}',
        'toast.alertModeSet':       'Modo de alerta: {label}',
        'toast.webhooksEnabled':    'Webhooks habilitados',
        'toast.webhooksDisabled':   'Webhooks deshabilitados',
        'toast.enterUrl':           'Ingresa una URL de webhook primero',
        'toast.invalidUrl':         'URL inválida',
        'toast.enterUrlShort':      'Ingresa una URL de webhook',
        'toast.testSuccess':        '✅ Webhook de prueba enviado exitosamente',
        'toast.testFail':           '❌ Webhook falló ({reason})',
        'toast.webhookAdded':       'Webhook agregado',
        'toast.webhookSaved':       'Webhook guardado',
        'toast.webhookDeleted':     'Webhook eliminado',
        'toast.allWatchesRemoved':  'Todos los watches eliminados',
        'toast.watchRemoved':       'Watch eliminado ({count} restantes)',
        'toast.watchRemovedSimple': 'Watch eliminado',
        'toast.watching':           'Monitorizando {mode}: {selector} ({count} total)',
        'toast.refreshStopped':     'Auto-refresh detenido',
        'toast.refreshStarted':     'Auto-refresh iniciado: cada {interval}',
        'toast.alertSilenced':      'Alerta silenciada',
        'toast.navigateFirst':      'Navega a esta página primero',
        'toast.elementNotFound':    'Elemento no encontrado',
        'toast.snapshotUpdated':    'Captura actualizada',
        'toast.selectorCopied':     'Selector copiado',
        'toast.copyFailed':         'Error al copiar',
        'toast.removedDomain':      'Eliminados {count} watches de {domain}',
        'toast.pickerCancelled':    'Selector de elementos cancelado',
        'toast.watchRemovedName':   'Watch eliminado: {name}',
        'toast.allWatchesCleared':  'Todos los watches eliminados',
        'toast.missingElements':    '¡{count} elemento monitoreado no encontrado!|¡{count} elementos monitoreados no encontrados!',
        'toast.watchesChanged':     '¡{count} watch cambió!|¡{count} watches cambiaron!',
        'toast.watchRemovedSel':    'Watch eliminado: {selector}',
        'toast.languageSet':        'Idioma: {label}',
        'toast.speedSet':           'Velocidad del habla: {label}',
        'toast.volumeSet':          'Volumen del habla: {label}',
        'toast.undo':               'Deshacer',
        'toast.watchRestored':      'Watch restaurado',
        'toast.watchesRestored':    'Watches restaurados',
        'toast.settingsReset':      'Todos los ajustes restablecidos',
        'toast.settingsRestored':   'Ajustes restaurados',

        'setting.resetDefaults':    '♻ Restablecer valores predeterminados',
        'setting.resetDefaults.sub':'Restaurar todos los ajustes de fábrica',
        'btn.resetConfirm':         '♻ Haz clic de nuevo para confirmar',

        'filter.placeholder':       'Filtrar configuraciones…',
        'filter.noResults':         'No hay configuraciones que coincidan',

        'shortcuts.title':          'Atajos de Teclado',
        'shortcuts.openSettings':   'Abrir configuración',
        'shortcuts.escape':         'Cerrar / volver',
        'shortcuts.navigate':       'Navegar opciones',
        'shortcuts.select':         'Seleccionar opción',
        'shortcuts.contextMenu':    'Menú rápido de watch',
        'shortcuts.dismiss':        'Presiona cualquier tecla para cerrar',

        'watch.nameOptional':       'Nombre (opcional)',
        'watch.namePlaceholder':    'ej., Precio Amazon',

        'speak.missingWarning':     'Advertencia: {count} elemento monitoreado no encontrado en {page}.|Advertencia: {count} elementos monitoreados no encontrados en {page}.',
        'speak.watchChanged':       'Watch cambiado en {page}. Contenido actualizado.',
        'speak.watchesChanged':     '{count} watches cambiaron en {page}.',

        'error.modifierRequired':   'Se requiere al menos una tecla modificadora',
        'error.reservedKey':        '{combo} está reservado por el navegador',

        'nav.back':                 '← Volver',
        'nav.escBack':              'Presiona Esc para volver',
        'nav.escDismiss':           'Presiona Esc para cerrar',
        'nav.escCancel':            'Presiona Esc para cancelar',

        'footer.hotkeyVersion':     'Presiona {hotkey} para abrir este menú · v{version}',

        'menu.openSettings':        'Abrir configuración',
        'menu.fontSize':            'Configurar tamaño de fuente',
        'menu.position':            'Configurar posición del badge',
        'menu.interval':            'Configurar intervalo de actualización',
        'menu.hotkey':              'Configurar atajo de teclado',
        'menu.watchElement':        'Monitorizar elemento para cambios',
        'menu.clearWatch':          'Eliminar watch',
        'menu.startRefresh':        'Iniciar auto-refresh',
        'menu.stopRefresh':         'Detener auto-refresh',
        'menu.runTests':            'Ejecutar pruebas',

        'test.allPassed':           '✅ Todas las {count} pruebas pasaron',
        'test.someFailed':          '❌ {failed} fallaron, {passed} pasaron',
      },
    };

    const _missingKeyWarned = new Set();

    function _resolveLanguage() {
        const setting = Config.get('language');
        if (setting !== 'auto') return setting;
        const browser = (navigator.language || 'en').split('-')[0];
        return I18N[browser] ? browser : 'en';
    }

    function t(key, params = {}) {
        const lang = _resolveLanguage();
        let str = I18N[lang] && I18N[lang][key];

        if (str == null) {
            if (lang !== 'en' && !_missingKeyWarned.has(`${lang}:${key}`)) {
                _missingKeyWarned.add(`${lang}:${key}`);
                console.warn(`[Auto Refresh i18n] Missing ${lang} translation for "${key}"`);
            }
            str = I18N.en[key] || key;
        }

        // Handle plurals: "singular|plural" with {count}
        if (str.includes('|') && 'count' in params) {
            const [singular, plural] = str.split('|');
            str = params.count === 1 ? singular : plural;
        }

        // Interpolate {param} placeholders
        for (const [k, v] of Object.entries(params)) {
            str = str.replaceAll(`{${k}}`, v);
        }

        return str;
    }

    function _getLanguageLabel(code) {
        const opt = LANGUAGE_OPTIONS.find(o => o.code === code);
        if (opt) return opt.label;
        return code === 'auto' ? LANGUAGE_OPTIONS[0].label : code;
    }

    // --- Watch Store ---

    function generateId() {
        return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

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

        return {
            getLocal() {
                if (_cache !== null) return _cache;
                try { _cache = JSON.parse(GM_getValue(STORAGE_KEY_WATCHES, '[]')); }
                catch { _cache = []; }
                _cache = _migrate(_cache, STORAGE_KEY_WATCHES);
                return _cache;
            },

            setLocal(arr) {
                _cache = arr;
                GM_setValue(STORAGE_KEY_WATCHES, JSON.stringify(arr));
                EventBus.emit('watches:local-updated', { count: arr.length });
            },

            add(watch) {
                if (!watch.id) watch.id = generateId();
                if (!watch.url) watch.url = _pageUrl();
                const watches = this.getLocal();
                const existing = watches.findIndex(w => w.selector === watch.selector && w.url === watch.url);
                if (existing >= 0) { watch.id = watches[existing].id || watch.id; watches[existing] = watch; }
                else watches.push(watch);
                this.setLocal(watches);
                this.setWatchEnabled(true);
                EventBus.emit('watch:added', { watch });
            },

            remove(id) {
                const watches = this.getLocal();
                const idx = watches.findIndex(w => w.id === id);
                if (idx >= 0) watches.splice(idx, 1);
                this.setLocal(watches);
                if (watches.length === 0) this.setWatchEnabled(false);
                EventBus.emit('watch:removed', { id });
            },

            reSnapshot(w) {
                const el = document.querySelector(w.selector);
                if (!el) return false;
                if (w.mode === 'content' || w.mode === 'both') w.content = _elText(el);
                if (w.mode === 'style' || w.mode === 'both') w.styles = captureStyles(el);
                w.snapshotTime = Date.now();
                const watches = this.getLocal();
                const idx = watches.findIndex(ww => ww.id === w.id);
                if (idx >= 0) watches[idx] = w;
                this.setLocal(watches);
                if (!watches.some(ww => this.getStatus(ww) === 'changed')) stopAlert();
                return true;
            },

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

            removeRemote(watch) {
                const key = watch._storageKey;
                if (!key) return;
                try {
                    const watches = JSON.parse(GM_getValue(key, '[]'));
                    const filtered = watches.filter(w => w.id !== watch.id);
                    GM_setValue(key, JSON.stringify(filtered));
                } catch { /* skip */ }
                if (watch.url === _pageUrl()) _cache = null;
                EventBus.emit('watch:removed', { id: watch.id });
            },

            addRemote(watch) {
                const key = watch._storageKey;
                if (!key) return;
                try {
                    const arr = JSON.parse(GM_getValue(key, '[]'));
                    arr.push(watch);
                    GM_setValue(key, JSON.stringify(arr));
                } catch { /* skip */ }
                if (watch.url === _pageUrl()) _cache = null;
                EventBus.emit('watch:added', { watch });
            },

            restoreRemoteBatch(entries) {
                const byKey = {};
                entries.forEach(({ watch, storageKey }) => {
                    if (!byKey[storageKey]) {
                        try { byKey[storageKey] = JSON.parse(GM_getValue(storageKey, '[]')); } catch { byKey[storageKey] = []; }
                    }
                    byKey[storageKey].push(watch);
                });
                for (const [key, arr] of Object.entries(byKey)) {
                    GM_setValue(key, JSON.stringify(arr));
                }
                _cache = null;
                EventBus.emit('watch:added', {});
            },

            isWatchEnabled() {
                return GM_getValue(STORAGE_KEY_WATCH_ENABLED, false);
            },

            setWatchEnabled(val) {
                GM_setValue(STORAGE_KEY_WATCH_ENABLED, val);
            },

            groupByDomain(watches) {
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
            },

            clearAll() {
                this.setLocal([]);
                this.setWatchEnabled(false);
                stopAlert();
                EventBus.emit('watches:cleared', {});
            },

            getStatus(w) {
                if (w.url !== _pageUrl()) return 'other-page';
                const el = document.querySelector(w.selector);
                if (!el) return 'missing';
                if (w.mode === 'content' || w.mode === 'both') {
                    if (_elText(el) !== w.content) return 'changed';
                }
                if (w.mode === 'style' || w.mode === 'both') {
                    if (w.styles && diffStyles(w.styles, captureStyles(el)).length > 0) return 'changed';
                }
                return 'ok';
            },
        };
    })();

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
        .ar-backdrop{position:fixed;inset:0;z-index:2147483645;background:${v('shadowHeavy')};opacity:0;transition:opacity .18s ease-out;pointer-events:none}
        .ar-backdrop-visible{opacity:1}
        .ar-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:transparent;pointer-events:auto;outline:none}
        .ar-panel{background:${v('bg')};color:${v('text')};border-radius:10px;padding:16px 20px;font:14px/1.6 system-ui,sans-serif;min-width:220px;box-shadow:0 8px 30px ${v('shadowHeavy')};opacity:0;transform:scale(0.97);transition:opacity .18s ease-out,transform .18s ease-out}
        @media(prefers-reduced-motion:reduce){.ar-backdrop,.ar-panel{transition-duration:0ms!important}}
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
        .ar-preview-btn{background:none;border:1px solid ${v('border')};border-radius:4px;color:${v('textDim')};cursor:pointer;font-size:12px;width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:color .15s,border-color .15s;padding:0;margin-left:auto}
        .ar-preview-btn:hover{border-color:${v('accent')};color:${v('accent')}}
        .ar-preview-playing{color:${v('accent')};border-color:${v('accent')}}
        .ar-btn-active .ar-preview-btn{color:${v('textLight')};border-color:${v('textLight')}}
        .ar-btn-active .ar-preview-btn:hover{color:${v('textLight')};border-color:${v('textLight')};opacity:0.8}
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
        .ar-badge{position:fixed;z-index:2147483647;background:${v('bgBadge')};color:${v('ok')};font:bold 13px/1 monospace;padding:0;border-radius:8px;cursor:pointer;user-select:none;display:none;box-shadow:0 2px 8px ${v('shadow')};backdrop-filter:blur(4px);transition:opacity .2s,box-shadow .3s,width .2s ease;overflow:hidden;pointer-events:auto}
        .ar-badge-content{padding:6px 10px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
        .ar-badge-watch-dot{width:6px;height:6px;border-radius:50%;background:${v('cyan')};display:none;flex-shrink:0}
        .ar-badge-hover{max-height:0;overflow:hidden;transition:max-height .2s,padding .2s;font-size:11px;color:${v('textMuted')};padding:0 10px;white-space:nowrap;text-align:center}
        .ar-badge-progress{height:3px;background:${v('ok')};transition:width .3s linear,background .3s;width:100%;border-radius:0 0 8px 8px}
        .ar-toast-undo{pointer-events:auto;display:flex;flex-direction:column;padding:0;overflow:hidden}
        .ar-toast-undo-content{display:flex;align-items:center;gap:12px;padding:10px 14px}
        .ar-toast-undo-btn{background:rgba(255,255,255,.2);border:none;color:inherit;font:bold 13px system-ui,sans-serif;padding:4px 12px;border-radius:4px;cursor:pointer;white-space:nowrap;transition:background .15s}
        .ar-toast-undo-btn:hover{background:rgba(255,255,255,.35)}
        .ar-toast-progress{height:3px;background:rgba(255,255,255,.5);border-radius:0 0 8px 8px;transition:width linear}
        .ar-shortcut-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:${v('shadowHeavy')};pointer-events:auto}
        .ar-shortcut-panel{background:${v('bg')};border-radius:10px;padding:20px 28px;font:14px/1.6 system-ui,sans-serif;min-width:280px;box-shadow:0 8px 30px ${v('shadowHeavy')};color:${v('text')}}
        .ar-shortcut-title{font-weight:bold;font-size:15px;margin-bottom:12px}
        .ar-shortcut-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;gap:24px}
        .ar-shortcut-desc{color:${v('textMuted')};font-size:13px}
        .ar-breadcrumb{display:flex;align-items:center;gap:0;flex-wrap:wrap;margin-bottom:4px}
        .ar-breadcrumb-link{background:none;border:none;color:${v('textFaint')};cursor:pointer;font:12px system-ui,sans-serif;padding:0;margin:0}
        .ar-breadcrumb-link:hover{color:${v('textMuted')};text-decoration:underline}
        .ar-breadcrumb-sep{color:${v('textFaint')};font-size:12px;margin:0 4px}
        .ar-breadcrumb-current{color:${v('textDim')};font-size:12px}
        @media(prefers-reduced-motion:reduce){.ar-panel{transition-duration:0ms!important}}
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

    function createFocusTrap(container) {
        let focusIndex = -1;

        function getFocusables() {
            return Array.from(container.querySelectorAll('button, input'))
                .filter(el => el.offsetParent !== null);
        }

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

        function clearOutlines() {
            focusIndex = -1;
            getFocusables().forEach(el => { el.style.outline = 'none'; el.style.outlineOffset = ''; });
        }

        function handleKeyDown(e) {
            const items = getFocusables();
            if (items.length === 0) return false;
            if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focusIndex + 1); return true; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focusIndex === -1 ? -1 : focusIndex - 1); return true; }
            if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < items.length) {
                if (items[focusIndex]?.tagName === 'INPUT') return false;
                e.preventDefault();
                items[focusIndex].click();
                return true;
            }
            return false;
        }

        container.addEventListener('mousedown', clearOutlines);

        return {
            handleKeyDown,
            clearOutlines,
            destroy() {
                clearOutlines();
                container.removeEventListener('mousedown', clearOutlines);
            }
        };
    }

    function setToggleState(trackEl, thumbEl, isOn, trackW = 40, thumbSize = 18) {
        trackEl.style.background = isOn ? T.accent : T.borderLight;
        thumbEl.style.left = isOn ? `${trackW - thumbSize - 2}px` : '2px';
    }

    function setInputError(inputEl, hasError) {
        inputEl.style.borderColor = hasError ? T.err : '';
    }

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
        if (s < 60) return t('time.seconds', { n: s });
        if (s < 3600) {
            if (s % 60 === 0) {
                const m = s / 60;
                return m > 1 ? t('time.minutes', { n: m }) : t('time.minute', { n: m });
            }
            return t('time.shortMinSec', { m: Math.floor(s / 60), s: s % 60 });
        }
        if (s % 3600 === 0) {
            const h = s / 3600;
            return h > 1 ? t('time.hours', { n: h }) : t('time.hour', { n: h });
        }
        return t('time.shortHourMin', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
    }

    function formatCountdown(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
    }

    function timeAgo(ts) {
        if (!ts) return t('timeAgo.unknown');
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return t('timeAgo.seconds', { n: diff });
        if (diff < 3600) return t('timeAgo.minutes', { n: Math.floor(diff / 60) });
        if (diff < 86400) return t('timeAgo.hours', { n: Math.floor(diff / 3600) });
        return t('timeAgo.days', { n: Math.floor(diff / 86400) });
    }

    // --- Timer State ---
    let remaining = 0;
    let paused = false;

    // --- Badge ---

    const badge = h('div', {
        id: 'auto-refresh-badge',
        class: 'ar-badge',
        role: 'button',
        'aria-label': t('badge.ariaLabel'),
        title: t('badge.clickOptions'),
    });

    const badgeContent = h('div', { class: 'ar-badge-content' });
    const badgeText = h('span', { style: 'transition:color .3s' });
    const watchDot = h('span', {
        class: 'ar-badge-watch-dot',
        title: t('badge.watchesActive'),
    });
    badgeContent.appendChild(badgeText);
    badgeContent.appendChild(watchDot);
    badge.appendChild(badgeContent);

    const hoverInfo = h('div', { class: 'ar-badge-hover' });
    badge.appendChild(hoverInfo);

    const progressBar = h('div', { class: 'ar-badge-progress' });
    badge.appendChild(progressBar);

    badge.addEventListener('mouseenter', () => {
        // Remove any pending transitionend handler from a previous mouseleave
        if (State.get('badgeHoverEndHandler')) {
            badge.removeEventListener('transitionend', State.get('badgeHoverEndHandler'));
            State.set('badgeHoverEndHandler', null);
        }

        const interval = getInterval();
        const watches = WatchStore.getLocal();
        const lines = [t('badge.hoverInterval', { interval: formatSeconds(interval) })];
        if (watches.length > 0) lines.push(t('badge.hoverWatches', { count: watches.length }));
        if (paused) lines.push(t('badge.hoverPaused'));

        // Lock current width to prevent jump
        const currentWidth = badge.offsetWidth;
        badge.style.width = currentWidth + 'px';

        hoverInfo.textContent = lines.join(' · ');
        hoverInfo.style.maxHeight = '30px';
        hoverInfo.style.padding = '4px 10px';
        hoverInfo.style.borderTop = `1px solid ${T.borderMid}`;
        badge.style.opacity = '1';

        // Measure natural width with content, then animate to it
        badge.style.width = 'auto';
        const targetWidth = badge.offsetWidth;
        if (targetWidth === currentWidth) {
            // No width change needed — leave as auto
            return;
        }
        badge.style.width = currentWidth + 'px';
        requestAnimationFrame(() => { badge.style.width = targetWidth + 'px'; });
    });
    badge.addEventListener('mouseleave', () => {
        // Clear hover content immediately so it doesn't affect width measurement
        hoverInfo.textContent = '';
        hoverInfo.style.maxHeight = '0';
        hoverInfo.style.padding = '0 10px';
        hoverInfo.style.borderTop = `0px solid ${T.borderMid}`;
        const opacity = Config.get('opacity');
        badge.style.opacity = String(opacity);

        // Measure natural content-only width
        const hoverWidth = badge.offsetWidth;
        badge.style.width = 'auto';
        const contentWidth = badge.offsetWidth;

        // If width hasn't changed, just clear inline width immediately
        if (hoverWidth === contentWidth) {
            badge.style.width = '';
            return;
        }

        badge.style.width = hoverWidth + 'px';

        // Animate width back to content width
        requestAnimationFrame(() => { badge.style.width = contentWidth + 'px'; });

        State.set('badgeHoverEndHandler', (e) => {
            if (e.propertyName === 'width') {
                badge.style.width = '';
                badge.removeEventListener('transitionend', State.get('badgeHoverEndHandler'));
                State.set('badgeHoverEndHandler', null);
            }
        });
        badge.addEventListener('transitionend', State.get('badgeHoverEndHandler'));
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
        // Update CSS custom properties — all CSS-class-based elements update automatically
        _themeVars.textContent = buildThemeVars(T);
        // Minimal theme overrides that can't be expressed in CSS classes
        const isMinimal = themeName === 'minimal';
        badge.style.boxShadow = isMinimal ? 'none' : '';
        badge.style.backdropFilter = isMinimal ? 'none' : '';
        badgeText.style.textShadow = isMinimal ? '0 1px 3px rgba(0,0,0,0.8)' : '';
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

        const watchCount = WatchStore.getLocal().length;
        watchDot.style.display = watchCount > 0 ? 'inline-block' : 'none';
        watchDot.title = t('badge.watchesActive');
        badge.title = t('badge.clickOptions');
        badge.setAttribute('aria-label', t('badge.ariaLabel'));

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

        State.set('countdownTimerId', setInterval(() => {
            remaining--;
            if (remaining <= 0) { location.reload(); return; }
            updateBadge();
        }, 1000));

        GM_setValue(STORAGE_KEY_ENABLED, true);
    }

    function stopRefresh() {
        if (State.get('countdownTimerId') !== null) { clearInterval(State.get('countdownTimerId')); State.set('countdownTimerId', null); }
        paused = false;
        badge.style.display = 'none';
        GM_setValue(STORAGE_KEY_ENABLED, false);
    }

    function pauseRefresh() {
        if (State.get('countdownTimerId') !== null) { clearInterval(State.get('countdownTimerId')); State.set('countdownTimerId', null); }
        paused = true;
        updateBadge();
    }

    function resumeRefresh() {
        paused = false;
        if (!isEnabled() || remaining <= 0) return;
        if (State.get('countdownTimerId') !== null) return;
        State.set('countdownTimerId', setInterval(() => {
            remaining--;
            if (remaining <= 0) { location.reload(); return; }
            updateBadge();
        }, 1000));
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

    function showUndoToast(message, undoFn, timeout = 5000) {
        _shadow.querySelectorAll('.ar-toast').forEach(t => {
            t.style.top = (parseInt(t.style.top) || 16) + 48 + 'px';
        });

        const toast = h('div', { class: 'ar-toast ar-toast-undo' });
        const content = h('div', { class: 'ar-toast-undo-content' });
        content.appendChild(h('span', { text: message, style: 'flex:1' }));
        const undoBtn = h('button', { class: 'ar-toast-undo-btn', text: t('toast.undo') });
        content.appendChild(undoBtn);
        toast.appendChild(content);
        const progress = h('div', { class: 'ar-toast-progress', style: 'width:100%' });
        toast.appendChild(progress);
        toast.style.top = '16px';
        _shadow.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            progress.style.width = '0%';
            progress.style.transitionDuration = timeout + 'ms';
        });

        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, timeout);

        undoBtn.addEventListener('click', () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            toast.remove();
            undoFn();
            Modal.refresh();
        });
    }

    // --- Alert System ---

    function playBeep() {
        if (!State.get('audioCtx')) State.set('audioCtx', new (window.AudioContext || window.webkitAudioContext)());
        const ctx = State.get('audioCtx');
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    }

    function startAlert() {
        const mode = Config.get('alertMode');
        if (mode === 'speech') return; // speech-only mode doesn't beep
        stopAlert(); playBeep(); State.set('alertIntervalId', setInterval(playBeep, 2000));
    }
    function stopAlert() {
        if (State.get('alertIntervalId') !== null) { clearInterval(State.get('alertIntervalId')); State.set('alertIntervalId', null); }
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

    let _previewSpeakTimer = null;

    function previewSpeak({ voice, rate, volume } = {}) {
        if (!_ttsAvailable) return null;
        if (_previewSpeakTimer) { clearTimeout(_previewSpeakTimer); _previewSpeakTimer = null; }
        speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(t('tts.testText'));
        utter.rate = rate ?? Config.get('ttsRate');
        utter.volume = volume ?? Config.get('ttsVolume');
        const vName = voice ?? Config.get('ttsVoice');
        if (vName) {
            const found = speechSynthesis.getVoices().find(v => v.name === vName);
            if (found) utter.voice = found;
        }
        // Delay speak() after cancel() — Chrome/Edge silently drop utterances
        // when speak() is called immediately after cancel(). resume() unsticks
        // Chrome's paused state. No retry — cloud voices need time to load and
        // retrying cancels the loading voice then fails on the reused utterance.
        _previewSpeakTimer = setTimeout(() => {
            _previewSpeakTimer = null;
            speechSynthesis.resume();
            speechSynthesis.speak(utter);
        }, 100);
        return utter;
    }

    // Active preview buttons tracked so cancelling one resets its icon
    let _activePreviewBtn = null;
    let _previewGeneration = 0;

    function _resetActivePreview() {
        if (_activePreviewBtn) {
            _activePreviewBtn.textContent = '▶';
            _activePreviewBtn.classList.remove('ar-preview-playing');
            _activePreviewBtn.setAttribute('aria-label', t('btn.preview'));
            _activePreviewBtn = null;
        }
    }

    function makePreviewBtn(overrides, opts = {}) {
        const btn = h('button', {
            class: 'ar-preview-btn',
            text: '▶',
            'aria-label': t('btn.preview'),
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // If this button is already playing, stop it
            if (_activePreviewBtn === btn) {
                if (_previewSpeakTimer) { clearTimeout(_previewSpeakTimer); _previewSpeakTimer = null; }
                speechSynthesis.cancel();
                _resetActivePreview();
                return;
            }
            // Reset any other active preview visual; cancel is deferred to previewSpeak
            _resetActivePreview();

            if (opts.onPreview) {
                opts.onPreview();
                return;
            }

            _activePreviewBtn = btn;
            _previewGeneration++;
            const gen = _previewGeneration;
            btn.textContent = '■';
            btn.classList.add('ar-preview-playing');
            btn.setAttribute('aria-label', t('btn.preview.stop'));
            const utter = previewSpeak(overrides);
            if (utter) {
                utter.onend = () => { if (gen === _previewGeneration) _resetActivePreview(); };
                utter.onerror = () => {
                    if (gen === _previewGeneration) {
                        _resetActivePreview();
                        showToast(t('tts.previewFailed'));
                    }
                };
            } else {
                _resetActivePreview();
            }
        });
        return btn;
    }

    function _truncate(str, max = 30) {
        return str.length > max ? str.slice(0, max) + '…' : str;
    }

    function _elText(el) {
        return (el.innerText ?? el.textContent ?? '').trim();
    }

    function watchDisplayName(w, max) {
        return w.label ? _truncate(w.label, max || 30) : _truncate(w.selector, max || 30);
    }

    function _pageUrl() {
        return location.origin + location.pathname;
    }

    function _pageLabel() {
        return _truncate(document.title || location.hostname);
    }

    // --- Webhook Notifications ---

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
        return t('webhook.noUrl');
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
        const config = WebhookService.getConfig();
        if (!config.globalEnabled) return;

        const now = Date.now();
        if (now - State.get('lastWebhookTime') < WEBHOOK_RATE_LIMIT_MS) return;

        const activeWebhooks = config.webhooks.filter(wh => wh.enabled && wh.url);
        if (activeWebhooks.length === 0) return;

        State.set('lastWebhookTime', now);

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

    // --- Service Facades ---

    const WebhookService = {
        getConfig: _getWebhookConfig,
        saveConfig: _saveWebhookConfig,
        getDisplayLabel: _webhookDisplayLabel,
        formatPayload: formatWebhookPayload,
        send: sendWebhook,
        sendTest: sendTestWebhook,

        validateUrl(url) {
            if (!url) return { valid: false, reason: 'empty' };
            try { new URL(url); return { valid: true }; }
            catch { return { valid: false, reason: 'invalid' }; }
        },

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
    };

    const RefreshService = {
        start: startRefresh,
        stop: stopRefresh,
        pause: pauseRefresh,
        resume: resumeRefresh,
        isEnabled,
        getInterval,
    };

    // --- Modal Framework ---

    const Modal = (() => {
        const defs = {};
        const stack = [];
        let _modalOpen = false;
        let _rebuilding = false;
        const TRANSITION_MS = 180;
        const CLOSE_TRANSITION_MS = 120;
        let _transitioning = false;
        const _prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Single shared backdrop for the dark overlay
        const _backdrop = h('div', { class: 'ar-backdrop' });
        _shadow.appendChild(_backdrop);

        function _showBackdrop() {
            requestAnimationFrame(() => _backdrop.classList.add('ar-backdrop-visible'));
        }
        function _hideBackdrop() {
            _backdrop.classList.remove('ar-backdrop-visible');
        }

        function _createOverlay(id) {
            const existing = _shadow.querySelector('#' + CSS.escape(id));
            if (existing) existing.remove();
            const overlay = h('div', { id, class: 'ar-overlay', tabindex: '-1' });
            return overlay;
        }

        function _createPanel(def) {
            const panel = h('div', { class: 'ar-panel' });
            if (def.minWidth) panel.style.minWidth = def.minWidth;
            if (def.maxWidth) panel.style.maxWidth = def.maxWidth;
            const title = typeof def.title === 'function' ? def.title() : def.title;
            panel.appendChild(h('div', { class: 'ar-title', text: title }));
            return panel;
        }

        function _addChrome(panel, def, isSubModal) {
            const titleEl = panel.firstElementChild;
            if (isSubModal) {
                if (stack.length >= 2) {
                    // Breadcrumb trail for depth >= 2
                    const crumb = h('div', { class: 'ar-breadcrumb' });
                    stack.forEach((entry, i) => {
                        const entryDef = defs[entry.id];
                        const entryTitle = typeof entryDef.title === 'function' ? entryDef.title() : entryDef.title;
                        const targetIndex = i; // stack index this ancestor lives at
                        const link = h('button', { class: 'ar-breadcrumb-link', text: entryTitle, onclick: () => {
                            // Pop from current back to reveal the ancestor at targetIndex
                            // Remove intermediates without animation, then animate only the final pop
                            const popCount = stack.length - targetIndex - 1;
                            for (let j = 0; j < popCount - 1; j++) {
                                const intermediate = stack.pop();
                                intermediate.removeKeyboard();
                                intermediate.cleanups.forEach(fn => fn());
                                intermediate.overlay.remove();
                            }
                            // Final pop with animation
                            pop();
                        }});
                        crumb.appendChild(link);
                        crumb.appendChild(h('span', { class: 'ar-breadcrumb-sep', text: ' \u203A ' }));
                    });
                    const currentTitle = typeof def.title === 'function' ? def.title() : def.title;
                    crumb.appendChild(h('span', { class: 'ar-breadcrumb-current', text: currentTitle }));
                    panel.insertBefore(crumb, titleEl);
                } else {
                    const backBtn = h('button', { class: 'ar-back-btn', text: t('nav.back'), onclick: () => pop() });
                    panel.insertBefore(backBtn, titleEl);
                }
            }
            if (def.subtitle) {
                const subtitle = typeof def.subtitle === 'function' ? def.subtitle() : def.subtitle;
                titleEl.insertAdjacentElement('afterend', h('div', { class: 'ar-subtitle', text: subtitle }));
            }
        }

        function _setupKeyboard(panel, overlay, entry) {
            const trap = createFocusTrap(panel);

            // Primary handler on overlay: stops keyboard events at the shadow DOM boundary
            const onOverlayKey = (e) => {
                e.stopPropagation();
                if (e.key === 'Escape') { pop(); return; }
                if (matchesHotkey(e)) { e.preventDefault(); closeAll(); return; }
                trap.handleKeyDown(e);
            };
            const stopProp = (e) => e.stopPropagation();

            // Minimal document-level fallback (capture): handles Escape/hotkey when focus is outside shadow DOM
            const onDocKey = (e) => {
                if (e.key === 'Escape') { e.stopPropagation(); pop(); return; }
                if (matchesHotkey(e)) { e.preventDefault(); e.stopImmediatePropagation(); closeAll(); return; }
            };

            const onOverlayClick = (e) => { if (e.target === overlay) pop(); };

            overlay.addEventListener('keydown', onOverlayKey);
            overlay.addEventListener('keyup', stopProp);
            overlay.addEventListener('keypress', stopProp);
            document.addEventListener('keydown', onDocKey, true);
            // Only attach overlay click if not already attached (prevents accumulation on pop/re-setup)
            if (!entry._overlayClickAttached) {
                overlay.addEventListener('click', onOverlayClick);
                entry._overlayClickAttached = true;
            }
            entry.removeKeyboard = () => {
                overlay.removeEventListener('keydown', onOverlayKey);
                overlay.removeEventListener('keyup', stopProp);
                overlay.removeEventListener('keypress', stopProp);
                document.removeEventListener('keydown', onDocKey, true);
                trap.destroy();
            };
        }

        function _rebuild(entry) {
            if (_rebuilding) return;
            _rebuilding = true;
            try {
                const def = defs[entry.id];
                const panel = entry.panel;
                const idx = stack.indexOf(entry);
                const isSubModal = idx > 0;

                // Run and clear build cleanups
                entry.cleanups.forEach(fn => fn());
                entry.cleanups.length = 0;

                // Remove old keyboard handler
                entry.removeKeyboard();

                // Clear panel contents
                while (panel.firstChild) panel.removeChild(panel.firstChild);

                // Rebuild title
                const title = typeof def.title === 'function' ? def.title() : def.title;
                panel.appendChild(h('div', { class: 'ar-title', text: title }));

                // Temporarily remove self from stack so _addChrome sees only ancestors
                // (_addChrome reads the stack for breadcrumb — during _show, entry isn't pushed yet)
                stack.splice(idx, 1);
                _addChrome(panel, def, isSubModal);
                stack.splice(idx, 0, entry);

                // Build context
                const ctx = {
                    push: (nextId, nextExtra) => _show(nextId, nextExtra),
                    pop,
                    close: () => pop(),
                    closeAll,
                    cleanups: entry.cleanups,
                    extra: entry.extra,
                    addFooter: (text) => {
                        const f = h('div', { class: 'ar-footer', text: text || 'Press Esc to go back' });
                        panel.appendChild(f);
                    },
                };

                def.build(panel, ctx);

                // Footer
                if (!def.noAutoFooter && !panel.querySelector('[data-modal-footer]')) {
                    const footerText = isSubModal ? t('nav.escBack') : (typeof def.footerText === 'function' ? def.footerText() : def.footerText || null);
                    if (footerText) {
                        const f = h('div', { class: 'ar-footer', 'data-modal-footer': '' });
                        f.textContent = footerText;
                        panel.appendChild(f);
                    }
                }

                // Re-setup keyboard
                _setupKeyboard(panel, entry.overlay, entry);
            } finally {
                _rebuilding = false;
            }
        }

        function refresh() {
            if (stack.length > 0) _rebuild(stack[stack.length - 1]);
        }

        function _show(id, extra) {
            const def = defs[id];
            if (!def) throw new Error(`Modal "${id}" not defined`);
            const isSubModal = stack.length > 0;
            const reducedMotion = _prefersReducedMotion();
            const duration = reducedMotion ? 0 : TRANSITION_MS;

            if (isSubModal) {
                const top = stack[stack.length - 1];
                const prevPanel = top.overlay.querySelector('.ar-panel');
                top.removeKeyboard();
                _transitioning = true;
                if (prevPanel && duration > 0) {
                    prevPanel.style.opacity = '0';
                    prevPanel.style.transform = 'translateX(-30px)';
                }
                setTimeout(() => {
                    if (!top.overlay.isConnected) return;
                    top.overlay.style.display = 'none';
                    if (prevPanel) {
                        prevPanel.style.opacity = '1';
                        prevPanel.style.transform = 'scale(1)';
                    }
                    _transitioning = false;
                }, duration);
            }

            if (stack.length === 0) pauseRefresh();

            const overlay = _createOverlay('auto-refresh-mf-' + id);
            const panel = _createPanel(def);
            _addChrome(panel, def, isSubModal);

            const cleanups = [];
            const entry = { id, overlay, panel, cleanups, extra: extra || {}, removeKeyboard: null };

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
                const footerText = isSubModal ? t('nav.escBack') : (typeof def.footerText === 'function' ? def.footerText() : def.footerText || null);
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

            if (isSubModal && duration > 0) {
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(30px)';
                requestAnimationFrame(() => {
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateX(0) scale(1)';
                    if (!panel.contains(_shadow.activeElement)) overlay.focus();
                });
            } else {
                if (!isSubModal) _showBackdrop();
                requestAnimationFrame(() => {
                    panel.style.opacity = '1'; panel.style.transform = 'scale(1)';
                    if (!panel.contains(_shadow.activeElement)) overlay.focus();
                });
            }
        }

        function pop() {
            if (stack.length === 0) return;
            if (_transitioning) return;
            const reducedMotion = _prefersReducedMotion();
            const entry = stack.pop();
            const exitPanel = entry.overlay.querySelector('.ar-panel');
            entry.removeKeyboard();
            entry.cleanups.forEach(fn => fn());

            if (stack.length > 0) {
                // Pop to parent — animate current out right, parent in from left
                const duration = reducedMotion ? 0 : TRANSITION_MS;
                if (exitPanel && duration > 0) {
                    _transitioning = true;
                    exitPanel.style.opacity = '0';
                    exitPanel.style.transform = 'translateX(30px)';
                    setTimeout(() => {
                        if (entry.overlay.isConnected) entry.overlay.remove();
                        _transitioning = false;
                    }, duration);
                } else {
                    entry.overlay.remove();
                }

                const prev = stack[stack.length - 1];
                prev.overlay.style.display = 'flex';
                const prevPanel = prev.overlay.querySelector('.ar-panel');
                if (prevPanel && duration > 0) {
                    prevPanel.style.opacity = '0';
                    prevPanel.style.transform = 'translateX(-30px)';
                    requestAnimationFrame(() => {
                        prevPanel.style.opacity = '1';
                        prevPanel.style.transform = 'scale(1)';
                    });
                }
                _setupKeyboard(prev.panel, prev.overlay, prev);
                prev.overlay.focus();
            } else {
                // Close last modal — animate scale-down + fade-out
                const duration = reducedMotion ? 0 : CLOSE_TRANSITION_MS;
                _hideBackdrop();
                if (exitPanel && duration > 0) {
                    _transitioning = true;
                    exitPanel.style.opacity = '0';
                    exitPanel.style.transform = 'scale(0.97)';
                    setTimeout(() => {
                        if (entry.overlay.isConnected) entry.overlay.remove();
                        _transitioning = false;
                    }, duration);
                } else {
                    entry.overlay.remove();
                }
                _modalOpen = false;
                resumeRefresh();
            }
        }

        function closeAll() {
            if (stack.length === 0) return;
            const reducedMotion = _prefersReducedMotion();
            const duration = reducedMotion ? 0 : CLOSE_TRANSITION_MS;
            const topEntry = stack[stack.length - 1];
            const topPanel = topEntry.overlay.querySelector('.ar-panel');

            // Immediately clean up keyboard/cleanups for all entries
            stack.forEach(entry => {
                entry.removeKeyboard();
                entry.cleanups.forEach(fn => fn());
            });

            // Remove all non-top overlays immediately
            for (let i = 0; i < stack.length - 1; i++) {
                stack[i].overlay.remove();
            }

            if (topPanel && duration > 0) {
                _transitioning = true;
                _hideBackdrop();
                topPanel.style.opacity = '0';
                topPanel.style.transform = 'scale(0.97)';
                setTimeout(() => {
                    if (topEntry.overlay.isConnected) topEntry.overlay.remove();
                    _transitioning = false;
                }, duration);
            } else {
                _hideBackdrop();
                topEntry.overlay.remove();
            }

            stack.length = 0;
            _modalOpen = false;
            resumeRefresh();
        }

        function open(id, extra) { closeAll(); _show(id, extra); }

        function define(id, def) {
            // Auto-generate build function for picker-type modals
            if (def.type === 'picker' && !def.build) {
                def.build = (panel, ctx) => {
                    const current = def.current();
                    const options = typeof def.options === 'function' ? def.options() : def.options;
                    const toast = typeof def.toastTemplate === 'function' ? def.toastTemplate() : def.toastTemplate;
                    const container = def.layout === 'grid' ? h('div', { class: 'ar-grid' }) : panel;

                    options.forEach(({ key, label, subtitle: sub }) => {
                        const btn = makeOptionBtn(label, key === current, () => {
                            def.onSelect(key, label);
                            if (def.returnTo) Modal.open(def.returnTo);
                            if (toast) showToast(toast.replace('{label}', label));
                        }, sub ? { subtitle: sub } : {});
                        if (def.layout === 'grid') btn.classList.add('ar-grid-btn');
                        if (def.renderOption) def.renderOption(btn, { key, label });
                        container.appendChild(btn);
                    });

                    if (def.layout === 'grid') panel.appendChild(container);
                    if (def.onBuild) def.onBuild(ctx);
                };
            }
            defs[id] = def;
        }
        function replace(id, extra, depth = 1) {
            for (let i = 0; i < depth; i++) pop();
            _show(id, extra);
        }
        function isOpen() { return _modalOpen; }
        function currentId() { return stack.length > 0 ? stack[stack.length - 1].id : null; }
        function hasInStack(id) { return stack.some(e => e.id === id); }

        return { define, open, push: _show, pop, replace, closeAll, refresh, isOpen, currentId, hasInStack };
    })();

    // --- Modal Definitions ---

    Modal.define('fontsize-picker', {
        title: () => t('fontSize.title'),
        subtitle: () => t('fontSize.subtitle'),
        type: 'picker',
        current: () => Config.get('fontSize'),
        options: () => [
            { key: 'small', label: t('fontSize.small') },
            { key: 'medium', label: t('fontSize.medium') },
            { key: 'large', label: t('fontSize.large') },
            { key: 'extra-large', label: t('fontSize.extraLarge') }
        ],
        onSelect: (key) => { Config.set('fontSize', key); applyFontSize(); },
        returnTo: 'settings',
        toastTemplate: () => t('toast.fontSizeSet', { label: '{label}' }),
        renderOption: (btn, { key }) => {
            btn.appendChild(h('div', {
                text: '↻ 30s',
                style: `font:bold ${FONT_SIZES[key]} monospace;color:${T.ok};margin-top:4px;opacity:0.6`
            }));
        }
    });

    Modal.define('theme-picker', {
        title: () => t('theme.title'),
        subtitle: () => t('theme.subtitle'),
        type: 'picker',
        current: () => Config.get('theme'),
        options: () => [
            { key: 'dark', label: t('theme.dark'), subtitle: t('theme.dark.desc') },
            { key: 'light', label: t('theme.light'), subtitle: t('theme.light.desc') },
            { key: 'minimal', label: t('theme.minimal'), subtitle: t('theme.minimal.desc') },
            { key: 'highContrast', label: t('theme.highContrast'), subtitle: t('theme.highContrast.desc') }
        ],
        onSelect: (key) => applyTheme(key),
        returnTo: 'settings',
        toastTemplate: () => t('toast.themeSet', { label: '{label}' }),
        renderOption: (btn, { key }) => {
            const theme = THEMES[key];
            const isMin = key === 'minimal';
            btn.appendChild(h('div', {
                style: [
                    `background:${theme.bgBadge}`, `color:${theme.ok}`,
                    'font:bold 13px monospace', 'padding:4px 8px', 'border-radius:6px',
                    'margin-top:6px', 'display:inline-block',
                    isMin ? 'text-shadow:0 1px 3px rgba(0,0,0,0.8)' : '',
                    isMin ? '' : `box-shadow:0 1px 4px ${theme.shadow}`
                ].filter(Boolean).join(';'),
                text: '↻ 8s'
            }));
        }
    });

    Modal.define('opacity-picker', {
        title: () => t('opacity.title'),
        subtitle: () => t('opacity.subtitle'),
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
                showToast(t('toast.opacitySet', { value: slider.value }));
            });
            panel.appendChild(slider);

            const steps = h('div', { style: `display:flex;justify-content:space-between;font-size:10px;color:${T.textFaint};margin-top:2px` });
            steps.appendChild(h('span', { text: '20%' }));
            steps.appendChild(h('span', { text: '100%' }));
            panel.appendChild(steps);
        }
    });

    Modal.define('position-picker', {
        title: () => t('position.title'),
        subtitle: () => t('position.subtitle'),
        type: 'picker',
        layout: 'grid',
        current: () => Config.get('corner'),
        options: () => ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
            .map(choice => ({ key: choice, label: getCornerLabels()[choice] })),
        onSelect: (key) => { Config.set('corner', key); applyCorner(); },
        returnTo: 'settings',
        toastTemplate: () => t('toast.positionSet', { label: '{label}' }),
    });

    Modal.define('interval-picker', {
        title: () => t('interval.title'),
        subtitle: () => t('interval.subtitle'),
        build: (panel) => {
            const current = getInterval();

            function addGroup(label, presets) {
                addSection(panel, label);
                presets.forEach(seconds => {
                    panel.appendChild(makeOptionBtn(formatSeconds(seconds), seconds === current, () => {
                        Config.set('interval', seconds);
                        if (isEnabled()) RefreshService.start();
                        Modal.open('settings');
                        showToast(t('toast.intervalSet', { interval: formatSeconds(seconds) }));
                    }));
                });
            }

            addGroup(t('section.seconds'), [5, 10, 15, 30]);
            addGroup(t('section.minutes'), [60, 120, 300, 600]);

            addSection(panel, t('section.custom'));
            const customRow = h('div', { style: 'display:flex;gap:6px' });

            const input = h('input', {
                class: 'ar-input',
                type: 'number', min: '1', max: '86400',
                placeholder: 'Seconds (1\u201386400)',
                style: 'flex:1'
            });
            input.value = [5, 10, 15, 30, 60, 120, 300, 600].includes(current) ? '' : current;

            const applyBtn = h('button', {
                text: t('btn.set'),
                class: 'ar-btn-accent',
                onclick: () => {
                    const value = parseInt(input.value, 10);
                    if (isNaN(value) || value < 1 || value > 86400) { setInputError(input, true); return; }
                    Config.set('interval', value);
                    if (isEnabled()) RefreshService.start();
                    Modal.open('settings');
                    showToast(t('toast.intervalSet', { interval: formatSeconds(value) }));
                }
            });

            customRow.appendChild(input);
            customRow.appendChild(applyBtn);
            panel.appendChild(customRow);
        }
    });

    Modal.define('hotkey-picker', {
        title: () => t('hotkey.title'),
        subtitle: () => t('hotkey.subtitle'),
        minWidth: '320px',
        build: (panel, ctx) => {
            const current = Config.get('hotkey');
            const currentRow = h('div', { style: 'margin-bottom:10px;display:flex;align-items:center;gap:8px' });
            currentRow.appendChild(h('span', { text: t('hotkey.current'), style: `color:${T.textMuted};font-size:13px` }));
            current.split('+').forEach(key => {
                currentRow.appendChild(h('kbd', { class: 'ar-kbd', text: key }));
            });
            panel.appendChild(currentRow);

            const stateLabel = h('div', { style: `font-size:11px;color:${T.textFaint};margin-bottom:4px;text-align:center;min-height:16px` });
            panel.appendChild(stateLabel);

            const display = h('div', { class: 'ar-capture-box', text: t('hotkey.prompt') });
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
                    display.textContent = t('hotkey.prompt');
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
                    stateLabel.textContent = t('hotkey.recording');
                    stateLabel.style.color = T.accent;
                    renderKeys(liveParts, 'live');
                    return;
                }

                if (!hasModifier) { renderError(t('error.modifierRequired')); return; }

                liveParts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                const combo = liveParts.join('+');

                if (BROWSER_RESERVED.has(combo)) { renderError(t('error.reservedKey', { combo })); return; }

                Config.set('hotkey', combo);
                stateLabel.textContent = '✓ Shortcut saved';
                stateLabel.style.color = T.ok;
                renderKeys(liveParts, 'confirmed');
                display.style.background = T.okFaint;
                showToast(t('toast.shortcutSet', { combo }));
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
                    stateLabel.textContent = t('hotkey.recording');
                    stateLabel.style.color = T.accent;
                    renderKeys(liveParts, 'live');
                } else {
                    stateLabel.textContent = '';
                    display.innerHTML = '';
                    display.textContent = t('hotkey.prompt');
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
                    text: t('btn.resetDefault'),
                    onclick: () => {
                        Config.set('hotkey', DEFAULT_HOTKEY);
                        stateLabel.textContent = t('hotkey.resetDone');
                        stateLabel.style.color = T.ok;
                        renderKeys(DEFAULT_HOTKEY.split('+'), 'confirmed');
                        display.style.background = T.okFaint;
                        showToast(t('toast.shortcutReset', { combo: DEFAULT_HOTKEY }));
                        setTimeout(() => Modal.open('settings'), 1200);
                    }
                }));
            }
        }
    });

    // --- Watch Mode Constants ---

    function getWatchModeLabels() { return { content: t('watchMode.content'), style: t('watchMode.style'), both: t('watchMode.both') }; }
    function getWatchModeDescs() {
        return {
            content: t('watchMode.content.desc'),
            style: t('watchMode.style.desc'),
            both: t('watchMode.both.desc')
        };
    }

    // --- TTS Alert Mode Pickers ---

    function getAlertModeOptions() {
        return [
            { key: 'beep', label: t('alertMode.beep'), desc: t('alertMode.beep.desc') },
            { key: 'speech', label: t('alertMode.speech'), desc: t('alertMode.speech.desc') },
            { key: 'both', label: t('alertMode.both'), desc: t('alertMode.both.desc') }
        ];
    }

    function getAlertModeLabels() { return { beep: t('alertModeLabel.beep'), speech: t('alertModeLabel.speech'), both: t('alertModeLabel.both') }; }

    function getTtsRateOptions() {
        return [
            { key: 0.7, label: t('ttsRate.slow') },
            { key: 1.0, label: t('ttsRate.normal') },
            { key: 1.3, label: t('ttsRate.fast') },
            { key: 1.6, label: t('ttsRate.veryFast') }
        ];
    }

    const TTS_VOLUME_OPTIONS = [
        { key: 0.25, label: '25%' },
        { key: 0.5, label: '50%' },
        { key: 0.75, label: '75%' },
        { key: 1.0, label: '100%' }
    ];

    Modal.define('tts-speed-picker', {
        title: () => t('ttsSpeed.title'),
        subtitle: () => t('ttsSpeed.subtitle'),
        type: 'picker',
        current: () => Config.get('ttsRate'),
        options: () => getTtsRateOptions().map(o => ({ key: o.key, label: o.label })),
        onSelect: (key) => {
            Config.set('ttsRate', key);
            Modal.replace('alert-mode-picker', null, 2);
        },
        toastTemplate: () => t('toast.speedSet', { label: '{label}' }),
        renderOption: (btn, { key }) => {
            // Ensure flex layout for preview button alignment
            if (!btn.querySelector('.ar-opt-top')) {
                const text = btn.textContent;
                btn.textContent = '';
                const top = h('div', { class: 'ar-opt-top' });
                top.appendChild(h('span', { text }));
                btn.appendChild(top);
            }
            btn.querySelector('.ar-opt-top').appendChild(makePreviewBtn({ rate: parseFloat(key) }));
        },
        onBuild: (ctx) => { ctx.cleanups.push(() => { speechSynthesis.cancel(); _resetActivePreview(); }); },
    });

    Modal.define('tts-volume-picker', {
        title: () => t('ttsVolume.title'),
        subtitle: () => t('ttsVolume.subtitle'),
        type: 'picker',
        current: () => Config.get('ttsVolume'),
        options: TTS_VOLUME_OPTIONS.map(o => ({ key: o.key, label: o.label })),
        onSelect: (key) => {
            Config.set('ttsVolume', key);
            Modal.replace('alert-mode-picker', null, 2);
        },
        toastTemplate: () => t('toast.volumeSet', { label: '{label}' }),
        renderOption: (btn, { key }) => {
            if (!btn.querySelector('.ar-opt-top')) {
                const text = btn.textContent;
                btn.textContent = '';
                const top = h('div', { class: 'ar-opt-top' });
                top.appendChild(h('span', { text }));
                btn.appendChild(top);
            }
            btn.querySelector('.ar-opt-top').appendChild(makePreviewBtn({ volume: parseFloat(key) }));
        },
        onBuild: (ctx) => { ctx.cleanups.push(() => { speechSynthesis.cancel(); _resetActivePreview(); }); },
    });

    Modal.define('tts-voice-picker', {
        title: () => t('ttsVoice.title'),
        subtitle: () => t('ttsVoice.subtitle'),
        build: (panel, ctx) => {
            const current = Config.get('ttsVoice');
            let showingAll = false;
            let autoPreviewTimer = null;

            // Search input
            const searchInput = h('input', {
                class: 'ar-input',
                type: 'text',
                placeholder: t('tts.searchPlaceholder'),
                style: 'width:100%;box-sizing:border-box;margin-bottom:8px',
            });
            panel.appendChild(searchInput);

            const container = h('div', { class: 'ar-scroll-container' });
            panel.appendChild(container);

            // Cleanup
            ctx.cleanups.push(() => {
                speechSynthesis.cancel();
                _resetActivePreview();
                if (autoPreviewTimer) clearTimeout(autoPreviewTimer);
            });

            function shortName(name) {
                return name.replace(/^Microsoft\s+/, '').replace(/\s+Online\b/, '');
            }
            function voiceOnly(name) {
                return shortName(name).replace(/\s*-\s*.+$/, '');
            }
            function isNatural(v) {
                return /natural|neural/i.test(v.name);
            }

            function renderVoices(showAll, filter) {
                showingAll = showAll;
                container.innerHTML = '';
                const voices = speechSynthesis.getVoices();
                if (voices.length === 0) {
                    container.appendChild(h('div', { class: 'ar-empty-state', text: t('tts.noVoices') }));
                    return;
                }

                const term = (filter || '').trim().toLowerCase();
                const isSearching = term.length > 0;

                // Default option (hidden if search doesn't match)
                if (!isSearching || 'default'.includes(term)) {
                    const defaultBtn = makeOptionBtn('Default', current === '', () => {
                        Config.set('ttsVoice', '');
                        Modal.replace('alert-mode-picker', null, 2);
                        showToast(t('toast.voiceSetDefault'));
                    }, { subtitle: t('tts.default.sub') });
                    defaultBtn.setAttribute('data-voice', '');
                    (defaultBtn.querySelector('.ar-opt-top') || defaultBtn).appendChild(makePreviewBtn({ voice: '' }));
                    container.appendChild(defaultBtn);
                }

                // Filter voices
                const filtered = isSearching
                    ? voices.filter(v => v.name.toLowerCase().includes(term) || v.lang.toLowerCase().includes(term))
                    : voices;

                // Group by language
                const byLang = {};
                filtered.forEach(v => {
                    const lang = v.lang.split('-')[0];
                    if (!byLang[lang]) byLang[lang] = [];
                    byLang[lang].push(v);
                });

                const browserLang = (navigator.language || 'en').split('-')[0];
                const useAll = showAll || isSearching;
                const grouped = useAll || !byLang[browserLang];
                const langsToShow = useAll
                    ? Object.keys(byLang).sort((a, b) => {
                        if (a === browserLang) return -1;
                        if (b === browserLang) return 1;
                        return a.localeCompare(b);
                    })
                    : (byLang[browserLang] ? [browserLang] : Object.keys(byLang).slice(0, 1));

                if (isSearching && langsToShow.length === 0 && !('default'.includes(term))) {
                    container.appendChild(h('div', { class: 'ar-empty-state', text: t('tts.noMatch') }));
                    return;
                }

                langsToShow.forEach((lang, li) => {
                    if (langsToShow.length > 1) {
                        const hdr = h('div', { class: li > 0 ? 'ar-section-hdr ar-section-hdr-sep' : 'ar-section-hdr', text: lang.toUpperCase() });
                        container.appendChild(hdr);
                    }
                    byLang[lang].forEach(v => {
                        const label = grouped && langsToShow.length > 1 ? voiceOnly(v.name) : shortName(v.name);
                        const natural = isNatural(v);
                        const sub = natural ? v.lang + ' ★' : v.lang;
                        const voiceBtn = makeOptionBtn(label, v.name === current, () => {
                            Config.set('ttsVoice', v.name);
                            Modal.replace('alert-mode-picker', null, 2);
                            showToast(t('toast.voiceSet', { name: shortName(v.name) }));
                        }, { subtitle: sub });
                        voiceBtn.setAttribute('data-voice', v.name);
                        (voiceBtn.querySelector('.ar-opt-top') || voiceBtn).appendChild(makePreviewBtn({ voice: v.name }));
                        container.appendChild(voiceBtn);
                    });
                });

                if (!isSearching && !showAll && Object.keys(byLang).length > 1) {
                    const allLangs = {};
                    voices.forEach(v => { const l = v.lang.split('-')[0]; allLangs[l] = true; });
                    const otherCount = Object.keys(allLangs).length - langsToShow.length;
                    if (otherCount > 0) {
                        container.appendChild(h('button', {
                            class: 'ar-link-btn ar-link-btn-center',
                            text: t('btn.showAllLangs', { count: otherCount }),
                            style: 'margin-top:6px',
                            onclick: () => { renderVoices(true, ''); panel.closest('.ar-overlay')?.focus(); }
                        }));
                    }
                }
            }

            // Debounced search
            let searchTimer = null;
            searchInput.addEventListener('input', () => {
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    renderVoices(showingAll, searchInput.value);
                }, 150);
            });

            // Auto-preview on keyboard focus (800ms debounce)
            panel.addEventListener('focusin', (e) => {
                if (autoPreviewTimer) { clearTimeout(autoPreviewTimer); autoPreviewTimer = null; }
                const btn = e.target.closest('[data-voice]');
                if (!btn || e.target.classList.contains('ar-preview-btn')) return;
                const voiceName = btn.getAttribute('data-voice');
                autoPreviewTimer = setTimeout(() => {
                    if (_previewSpeakTimer) { clearTimeout(_previewSpeakTimer); _previewSpeakTimer = null; }
                    speechSynthesis.cancel();
                    _resetActivePreview();
                    _previewGeneration++;
                    const gen = _previewGeneration;
                    const pvBtn = btn.querySelector('.ar-preview-btn');
                    const utter = previewSpeak({ voice: voiceName || undefined });
                    if (utter && pvBtn) {
                        _activePreviewBtn = pvBtn;
                        pvBtn.textContent = '■';
                        pvBtn.classList.add('ar-preview-playing');
                        pvBtn.setAttribute('aria-label', t('btn.preview.stop'));
                        const done = () => { if (gen === _previewGeneration) _resetActivePreview(); };
                        utter.onend = () => { if (gen === _previewGeneration) _resetActivePreview(); };
                        utter.onerror = () => {
                            if (gen === _previewGeneration) {
                                _resetActivePreview();
                                showToast(t('tts.previewFailed'));
                            }
                        };
                    }
                    autoPreviewTimer = null;
                }, 800);
            });

            renderVoices(false, '');
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', () => renderVoices(false, ''), { once: true });
            }

            // Auto-focus search input
            requestAnimationFrame(() => searchInput.focus());
        }
    });

    Modal.define('alert-mode-picker', {
        title: () => t('alertMode.title'),
        subtitle: () => t('alertMode.subtitle'),
        build: (panel, ctx) => {
            const currentMode = Config.get('alertMode');
            ctx.cleanups.push(() => { speechSynthesis.cancel(); _resetActivePreview(); });

            getAlertModeOptions().forEach(({ key, label, desc }) => {
                const modeBtn = makeOptionBtn(label, key === currentMode, () => {
                    Config.set('alertMode', key);
                    Modal.replace('alert-mode-picker');
                    showToast(t('toast.alertModeSet', { label }));
                }, { subtitle: desc });

                // Add inline preview button for each alert mode
                if (key === 'beep') {
                    const pvBtn = makePreviewBtn({}, { onPreview: () => { playBeep(); } });
                    (modeBtn.querySelector('.ar-opt-top') || modeBtn).appendChild(pvBtn);
                } else if (key === 'both') {
                    const pvBtn = makePreviewBtn({}, { onPreview: () => {
                        playBeep();
                        _activePreviewBtn = pvBtn;
                        pvBtn.textContent = '■';
                        pvBtn.classList.add('ar-preview-playing');
                        setTimeout(() => {
                            const utter = previewSpeak();
                            if (utter) {
                                const done = () => { if (_activePreviewBtn === pvBtn) _resetActivePreview(); };
                                utter.onend = done;
                                utter.onerror = done;
                            } else { _resetActivePreview(); }
                        }, 400);
                    }});
                    (modeBtn.querySelector('.ar-opt-top') || modeBtn).appendChild(pvBtn);
                } else {
                    // speech — use standard preview with saved settings
                    const pvBtn = makePreviewBtn({});
                    (modeBtn.querySelector('.ar-opt-top') || modeBtn).appendChild(pvBtn);
                }
                panel.appendChild(modeBtn);
            });

            if (_ttsAvailable) {
                const showSpeechSettings = currentMode === 'speech' || currentMode === 'both';
                if (showSpeechSettings) {
                    addSection(panel, t('section.speech'));

                    const voiceName = Config.get('ttsVoice');
                    const voiceLabel = voiceName ? voiceName.replace(/^Microsoft\s+/, '').replace(/\s+Online\b/, '') : t('tts.default');
                    panel.appendChild(makeOptionBtn(t('tts.voice'), false, () => ctx.push('tts-voice-picker'),
                        { value: voiceLabel, subtitle: t('tts.voice.sub') }));

                    const rate = Config.get('ttsRate');
                    const rateLabel = (getTtsRateOptions().find(o => o.key === rate) || { label: t('ttsRate.normal') }).label;
                    panel.appendChild(makeOptionBtn(t('tts.speed'), false, () => ctx.push('tts-speed-picker'),
                        { value: rateLabel, subtitle: t('tts.speed.sub') }));

                    const vol = Config.get('ttsVolume');
                    const volLabel = Math.round(vol * 100) + '%';
                    panel.appendChild(makeOptionBtn(t('tts.volume'), false, () => ctx.push('tts-volume-picker'),
                        { value: volLabel, subtitle: t('tts.volume.sub') }));

                    panel.appendChild(makeOptionBtn(t('btn.testSpeech'), false, () => {
                        speak(t('tts.testText'));
                    }, { subtitle: t('btn.testSpeech.sub') }));
                }
            } else {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: t('tts.unavailable') }));
            }
        }
    });

    // --- Language Picker Modal ---

    Modal.define('language-picker', {
        title: () => t('language.title'),
        subtitle: () => t('language.subtitle'),
        type: 'picker',
        current: () => Config.get('language'),
        options: () => LANGUAGE_OPTIONS.map(({ code, label, desc }) => ({ key: code, label, subtitle: desc })),
        onSelect: (key) => { Config.set('language', key); Modal.closeAll(); },
        toastTemplate: () => t('toast.languageSet', { label: '{label}' }),
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
        title: () => t('webhook.title'),
        subtitle: () => t('webhook.subtitle'),
        minWidth: '380px',
        build: (panel, ctx) => {
            let config = WebhookService.getConfig();

            // Global toggle
            const globalRow = h('button', { class: 'ar-toggle-row', style: 'margin-bottom:10px' });
            const globalLabel = h('div');
            globalLabel.appendChild(h('div', { text: t('toggle.webhooksEnabled'), style: `font-size:14px;color:${T.text}` }));
            globalLabel.appendChild(h('div', { class: 'ar-subtitle-sm', text: t('toggle.webhooks.sub') }));

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
                setToggleState(gToggle, gThumb, on);
                // Dim/undim webhook rows
                listContainer.style.opacity = on ? '1' : '0.5';
            }

            globalRow.addEventListener('click', () => {
                config.globalEnabled = !config.globalEnabled;
                setGlobalToggle(config.globalEnabled);
                WebhookService.saveConfig(config);
                showToast(config.globalEnabled ? t('toast.webhooksEnabled') : t('toast.webhooksDisabled'));
            });
            globalRow.appendChild(globalLabel);
            globalRow.appendChild(gToggle);
            panel.appendChild(globalRow);

            // Webhook list
            function renderList() {
                listContainer.innerHTML = '';
                config = WebhookService.getConfig();

                const count = config.webhooks.length;
                addSection(listContainer, `${t('section.webhooks')}${count > 0 ? ` (${count})` : ''}`);

                if (count === 0) {
                    listContainer.appendChild(h('div', { class: 'ar-empty-state', text: t('webhook.noWebhooks') }));
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
                            setToggleState(iTrack, iThumb, wh.enabled, 34, 14);
                            row.querySelector('.ar-dot').style.background = wh.enabled ? T.ok : T.textFaint;
                            WebhookService.saveConfig(config);
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
            panel.appendChild(makeOptionBtn(t('btn.addWebhook'), false, () => {
                ctx.push('webhook-edit', { webhookId: null });
            }, { subtitle: t('btn.addWebhook.sub') }));

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
        title: () => t('webhookEdit.title'),
        subtitle: () => t('webhookEdit.subtitle'),
        minWidth: '380px',
        build: (panel, ctx) => {
            const config = WebhookService.getConfig();
            const webhookId = ctx.extra && ctx.extra.webhookId;
            const existing = webhookId ? config.webhooks.find(wh => wh.id === webhookId) : null;
            const isNew = !existing;

            // Override title
            panel.querySelector('.ar-title').textContent = isNew ? t('webhookAdd.title') : t('webhookEdit.editTitle');

            let currentLabel = existing ? (existing.label || '') : '';
            let currentUrl = existing ? (existing.url || '') : '';
            let currentFormat = existing ? (existing.format || 'generic') : 'generic';
            let currentTemplate = existing ? (existing.template || WEBHOOK_DEFAULT_TEMPLATE) : WEBHOOK_DEFAULT_TEMPLATE;

            // Label input
            addSection(panel, t('section.labelOptional'));
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
            addSection(panel, t('section.webhookUrl'));
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
            addSection(panel, t('section.format'));
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

                addSection(templateSection, t('section.availableTags'));
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

                addSection(templateSection, t('section.messageTemplate'));
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

            const testBtn = h('button', { text: t('btn.sendTest'), class: 'ar-btn' });
            testBtn.addEventListener('click', async () => {
                if (!currentUrl) { showToast(t('toast.enterUrl')); setInputError(urlInput, true); return; }
                try { new URL(currentUrl); } catch { showToast(t('toast.invalidUrl')); setInputError(urlInput, true); return; }
                setInputError(urlInput, false);
                testBtn.textContent = t('btn.sending');
                testBtn.disabled = true;
                const result = await sendTestWebhook({ url: currentUrl, format: currentFormat, template: currentTemplate });
                testBtn.textContent = t('btn.sendTest');
                testBtn.disabled = false;
                if (result.ok) {
                    showToast(t('toast.testSuccess'));
                } else {
                    showToast(t('toast.testFail', { reason: result.status || 'network error' }));
                }
            });

            const saveBtn = h('button', { text: t('btn.save'), class: 'ar-btn-accent' });
            saveBtn.addEventListener('click', () => {
                const validation = WebhookService.validateUrl(currentUrl);
                if (!validation.valid) {
                    showToast(validation.reason === 'empty' ? t('toast.enterUrlShort') : t('toast.invalidUrl'));
                    setInputError(urlInput, true);
                    return;
                }
                setInputError(urlInput, false);

                const freshConfig = WebhookService.getConfig();
                if (isNew) {
                    WebhookService.addWebhook(freshConfig, { label: currentLabel, url: currentUrl, format: currentFormat, template: currentTemplate });
                } else {
                    WebhookService.updateWebhook(freshConfig, webhookId, { label: currentLabel, url: currentUrl, format: currentFormat, template: currentTemplate });
                }
                showToast(isNew ? t('toast.webhookAdded') : t('toast.webhookSaved'));
                Modal.replace('webhook-list', null, 2);
            });

            actions.appendChild(testBtn);
            actions.appendChild(saveBtn);
            panel.appendChild(actions);

            // Delete button (existing webhooks only)
            if (!isNew) {
                let confirmPending = false;
                const deleteBtn = h('button', {
                    class: 'ar-link-btn ar-link-btn-center',
                    text: t('btn.deleteWebhook'),
                    style: `margin-top:8px;color:${T.err}`,
                });
                deleteBtn.addEventListener('click', () => {
                    if (!confirmPending) {
                        confirmPending = true;
                        deleteBtn.textContent = t('btn.confirmDelete');
                        deleteBtn.style.fontWeight = 'bold';
                        setTimeout(() => {
                            confirmPending = false;
                            deleteBtn.textContent = t('btn.deleteWebhook');
                            deleteBtn.style.fontWeight = '';
                        }, 3000);
                        return;
                    }
                    const freshConfig = WebhookService.getConfig();
                    WebhookService.deleteWebhook(freshConfig, webhookId);
                    showToast(t('toast.webhookDeleted'));
                    Modal.replace('webhook-list', null, 2);
                });
                panel.appendChild(deleteBtn);
            }
        }
    });

    Modal.define('clear-watch', {
        title: () => t('clearWatch.title'),
        subtitle: () => t('clearWatch.subtitle'),
        reactsTo: ['watch:added', 'watch:removed', 'watches:cleared', 'watches:local-updated'],
        build: (panel, ctx) => {
            const watches = WatchStore.getLocal();
            if (watches.length === 0) {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: t('inspector.noWatches') }));
                return;
            }
            const modeTextLabels = getWatchModeLabels();

            watches.forEach((w) => {
                const short = watchDisplayName(w);
                const status = WatchStore.getStatus(w);
                const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;

                const btn = h('button', { class: 'ar-btn ar-watch-row' });

                btn.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? t('status.changed') : status === 'missing' ? t('status.notFound') : t('status.noChanges') }));

                const info = h('div', { class: 'ar-flex-fill' });
                info.appendChild(h('div', { class: 'ar-truncate', text: short }));
                info.appendChild(h('div', { class: 'ar-subtitle-sm', text: modeTextLabels[w.mode] || w.mode }));
                btn.appendChild(info);

                btn.addEventListener('click', () => {
                    const snapshot = JSON.parse(JSON.stringify(w));
                    WatchStore.remove(w.id);
                    const remaining = WatchStore.getLocal().length;
                    if (remaining === 0) {
                        if (Modal.hasInStack('settings')) Modal.open('settings');
                        else ctx.closeAll();
                    } else {
                        if (Modal.hasInStack('settings')) Modal.open('settings');
                        else ctx.closeAll();
                    }
                    showUndoToast(t('toast.watchRemoved', { count: remaining }), () => {
                        WatchStore.add(snapshot);
                        showToast(t('toast.watchRestored'));
                    });
                });
                panel.appendChild(btn);
            });

            if (watches.length > 1) {
                panel.appendChild(h('div', { class: 'ar-divider' }));

                let confirmPending = false;
                const clearBtn = makeOptionBtn(t('btn.clearAll'), false, () => {
                    if (!confirmPending) {
                        confirmPending = true;
                        const span = clearBtn.querySelector('span');
                        if (span) span.textContent = t('btn.clearAllConfirm');
                        else clearBtn.textContent = t('btn.clearAllConfirm');
                        clearBtn.style.background = T.errBgDark;
                        setTimeout(() => {
                            confirmPending = false;
                            const s = clearBtn.querySelector('span');
                            if (s) s.textContent = t('btn.clearAll');
                            else clearBtn.textContent = t('btn.clearAll');
                            clearBtn.style.background = T.errBg;
                        }, 3000);
                        return;
                    }
                    const snapshot = JSON.parse(JSON.stringify(WatchStore.getLocal()));
                    WatchStore.clearAll();
                    if (Modal.hasInStack('settings')) Modal.open('settings');
                    else ctx.closeAll();
                    showUndoToast(t('toast.allWatchesRemoved'), () => {
                        WatchStore.setLocal(snapshot);
                        WatchStore.setWatchEnabled(true);
                        showToast(t('toast.watchesRestored'));
                    });
                }, { bg: T.errBg, color: T.errLight });
                panel.appendChild(clearBtn);
            }
        }
    });

    Modal.define('watch-mode', {
        title: () => t('watchMode.title'),
        subtitle: () => t('watchMode.subtitle'),
        build: (panel, ctx) => {
            const { selector, el: targetEl } = ctx.extra;

            const shortSelector = _truncate(selector, 45);
            const preview = h('div', { class: 'ar-preview', text: shortSelector, title: selector });
            panel.appendChild(preview);

            // Optional name input
            const nameInput = h('input', {
                class: 'ar-input',
                type: 'text',
                placeholder: t('watch.namePlaceholder'),
                style: 'width:100%;margin-bottom:10px;box-sizing:border-box'
            });
            const nameLabel = h('div', { class: 'ar-subtitle-sm', text: t('watch.nameOptional'), style: 'margin-bottom:4px' });
            panel.appendChild(nameLabel);
            panel.appendChild(nameInput);

            const contentLength = _elText(targetEl).length;
            if (contentLength > 1000) {
                panel.appendChild(h('div', {
                    class: 'ar-warning',
                    text: t('picker.largeElement', { count: contentLength.toLocaleString() })
                }));
            }

            const modeDescriptions = getWatchModeDescs();

            [
                { key: 'content', label: t('watchMode.content') },
                { key: 'style', label: t('watchMode.style') },
                { key: 'both', label: t('watchMode.both') }
            ].forEach(({ key, label }) => {
                const btn = makeOptionBtn(label, false, () => {
                    const watch = { selector, mode: key, content: '', styles: '', snapshotTime: Date.now(), label: nameInput.value.trim() };
                    if (key === 'content' || key === 'both') watch.content = _elText(targetEl);
                    if (key === 'style' || key === 'both') watch.styles = captureStyles(targetEl);
                    WatchStore.add(watch);
                    ctx.closeAll();
                    const count = WatchStore.getLocal().length;
                    const displayName = watch.label || _truncate(selector, 40);
                    showToast(t('toast.watching', { mode: key, selector: displayName, count }));
                }, { subtitle: modeDescriptions[key] });
                btn.style.borderLeft = `3px solid ${getModeColor(key)}`;
                panel.appendChild(btn);
            });

            panel.appendChild(h('button', {
                class: 'ar-link-btn',
                text: t('btn.pickAgain'),
                style: 'padding:8px 0 0',
                onclick: () => { ctx.closeAll(); startElementPicker(); }
            }));

            ctx.addFooter(t('nav.escCancel'));
        }
    });

    Modal.define('badge-menu', {
        title: () => t('badgeMenu.title'),
        noAutoFooter: true,
        build: (panel, ctx) => {
            const watches = WatchStore.getLocal();
            const watchCount = watches.length;
            const isSubOfSettings = Modal.hasInStack('settings');

            const timeStr = formatCountdown(remaining);
            let statusText = t('status.paused', { time: timeStr });
            if (watchCount > 0) statusText += ` · ${watchCount} watch${watchCount > 1 ? 'es' : ''}`;
            panel.appendChild(h('div', { class: 'ar-status-bar', style: `font-size:13px;color:${T.textMuted}`, text: statusText }));

            if (paused) {
                panel.appendChild(makeOptionBtn(t('btn.resume'), false, () => ctx.closeAll(),
                    { subtitle: t('btn.resume.sub'), bg: T.okBg, color: T.okText }));
            }

            panel.appendChild(makeOptionBtn(t('btn.stop'), false, () => {
                RefreshService.stop(); ctx.closeAll(); showToast(t('toast.refreshStopped'));
            }, { subtitle: t('btn.stop.sub'), bg: T.errBg, color: T.errLight }));

            if (watchCount > 0) {
                const changedCount = watches.filter(w => WatchStore.getStatus(w) === 'changed').length;
                const watchLabel = changedCount > 0 ? `${t('setting.inspectWatches')} (${changedCount})` : t('setting.inspectWatches');
                panel.appendChild(makeOptionBtn(watchLabel, false, () => ctx.push('watch-inspector'),
                    { subtitle: t('setting.inspect.sub') }));
            }

            if (!isSubOfSettings) {
                panel.appendChild(makeOptionBtn(t('btn.settings'), false, () => Modal.open('settings'),
                    { subtitle: t('btn.settings.sub') }));
            }

            panel.appendChild(h('div', { class: 'ar-footer', text: isSubOfSettings ? t('nav.escBack') : t('nav.escDismiss') }));
        }
    });

    const FONT_SIZE_KEYS = { 'small': 'fontSize.small', 'medium': 'fontSize.medium', 'large': 'fontSize.large', 'extra-large': 'fontSize.extraLarge' };

    function getBadgeLabels() {
        const corner = Config.get('corner');
        const fontSize = Config.get('fontSize');
        const opacity = Config.get('opacity');
        return {
            corner: (getCornerLabels()[corner] || corner).replace(/[\u2196\u2197\u2199\u2198\u2191\u2193]\s*/u, ''),
            font: t(FONT_SIZE_KEYS[fontSize] || 'fontSize.medium'),
            opacity: Math.round(opacity * 100) + '%'
        };
    }

    Modal.define('badge-style', {
        title: () => t('badgeStyle.title'),
        subtitle: () => t('badgeStyle.subtitle'),
        footerText: () => t('nav.escBack'),
        build: (panel, ctx) => {
            const bl = getBadgeLabels();

            panel.appendChild(makeOptionBtn(t('badge.position'), false, () => ctx.push('position-picker'),
                { value: bl.corner, subtitle: t('badge.position.sub') }));
            panel.appendChild(makeOptionBtn(t('badge.fontSize'), false, () => ctx.push('fontsize-picker'),
                { value: bl.font, subtitle: t('badge.fontSize.sub') }));
            panel.appendChild(makeOptionBtn(t('badge.opacity'), false, () => ctx.push('opacity-picker'),
                { value: bl.opacity, subtitle: t('badge.opacity.sub') }));
        }
    });

    Modal.define('settings', {
        title: () => t('settings.title'),
        minWidth: '320px',
        noAutoFooter: true,
        reactsTo: ['watch:added', 'watch:removed', 'watches:cleared', 'watches:local-updated'],
        build: (panel, ctx) => {
            const watches = WatchStore.getLocal();
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
                text: isEnabled() ? t('status.active', { interval: formatSeconds(getInterval()) }) : t('status.inactive')
            }));
            panel.appendChild(statusBar);

            // Search/filter input
            const searchInput = h('input', {
                class: 'ar-input',
                type: 'text',
                placeholder: t('filter.placeholder'),
                style: 'width:100%;margin-bottom:8px;box-sizing:border-box'
            });
            panel.appendChild(searchInput);
            requestAnimationFrame(() => searchInput.focus());

            // Toggle switch
            const toggleRow = h('button', { class: 'ar-toggle-row' });
            const toggleLabel = h('div');
            toggleLabel.appendChild(h('div', { text: t('toggle.autoRefresh'), style: `font-size:14px;color:${T.text}` }));
            toggleLabel.appendChild(h('div', { class: 'ar-subtitle-sm', text: t('toggle.autoRefresh.sub') }));

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

            function updateSettingsToggle(on) {
                setToggleState(toggle, thumb, on);
                dot.style.background = on ? T.ok : T.textFaint;
                dot.style.boxShadow = on ? `0 0 6px ${T.ok}` : 'none';
                statusBar.querySelector('span:last-child').textContent = on
                    ? t('status.active', { interval: formatSeconds(getInterval()) }) : t('status.inactive');
            }

            toggleRow.addEventListener('click', () => {
                if (isEnabled()) {
                    RefreshService.stop();
                    updateSettingsToggle(false);
                    showToast(t('toast.refreshStopped'));
                } else {
                    RefreshService.start();
                    if (Modal.isOpen()) pauseRefresh();
                    updateSettingsToggle(true);
                    showToast(t('toast.refreshStarted', { interval: formatSeconds(getInterval()) }));
                }
            });

            toggleRow.appendChild(toggleLabel);
            toggleRow.appendChild(toggle);
            panel.appendChild(toggleRow);

            // Track filterable items: { el, searchText }
            const filterables = [];
            const sectionHeaders = [];

            // Refresh Interval (top-level, no section header)
            const intervalBtn = makeOptionBtn(t('setting.interval'), false, () => ctx.push('interval-picker'),
                { value: formatSeconds(getInterval()), subtitle: t('setting.interval.sub') });
            panel.appendChild(intervalBtn);
            filterables.push({ el: intervalBtn, searchText: intervalBtn.textContent.toLowerCase() });

            // Watches section
            const watchesHdr = h('div', { class: 'ar-section-hdr', text: `${t('section.watches')}${watchCount > 0 ? ` (${watchCount})` : ''}` });
            panel.appendChild(watchesHdr);
            sectionHeaders.push(watchesHdr);

            const addWatchBtn = makeOptionBtn(t('setting.addWatch'), false, () => { ctx.closeAll(); startElementPicker(); },
                { subtitle: t('setting.addWatch.sub') });
            panel.appendChild(addWatchBtn);
            filterables.push({ el: addWatchBtn, searchText: addWatchBtn.textContent.toLowerCase() });

            // Watch Overview — always visible, shows total across all pages
            const allWatchTotal = WatchStore.getAll().length;
            const overviewBtn = makeOptionBtn(t('setting.watchOverview'), false, () => ctx.push('watch-overview'),
                { value: `${allWatchTotal}`, subtitle: t('setting.watchOverview.sub') });
            panel.appendChild(overviewBtn);
            filterables.push({ el: overviewBtn, searchText: overviewBtn.textContent.toLowerCase() });

            if (State.get('alertIntervalId') !== null) {
                const alertBtn = makeOptionBtn(t('setting.stopAlert'), false, () => {
                    stopAlert();
                    showToast(t('toast.alertSilenced'));
                    alertBtn.remove();
                }, { subtitle: t('setting.stopAlert.sub'), bg: T.errBg, color: T.errLight });
                panel.appendChild(alertBtn);
                filterables.push({ el: alertBtn, searchText: alertBtn.textContent.toLowerCase() });
            }

            let inspectBtn, removeBtn, emptyState;
            if (watchCount > 0) {
                inspectBtn = makeOptionBtn(t('setting.inspectWatches'), false, () => ctx.push('watch-inspector'),
                    { value: `${watchCount}`, subtitle: t('setting.inspect.sub') });
                panel.appendChild(inspectBtn);
                filterables.push({ el: inspectBtn, searchText: inspectBtn.textContent.toLowerCase() });
                removeBtn = makeOptionBtn(t('setting.removeWatches'), false, () => ctx.push('clear-watch'),
                    { value: `${watchCount}`, subtitle: t('setting.remove.sub') });
                panel.appendChild(removeBtn);
                filterables.push({ el: removeBtn, searchText: removeBtn.textContent.toLowerCase() });
            } else {
                emptyState = h('div', { class: 'ar-empty-state', text: t('inspector.noWatches') });
                panel.appendChild(emptyState);
            }

            // More settings — progressive disclosure
            let expanded = Config.get('settingsExpanded');
            const moreLink = h('button', { class: 'ar-more-link' });
            const moreWrapper = h('div');

            function updateExpanded() {
                moreWrapper.style.display = expanded ? 'block' : 'none';
                moreLink.textContent = expanded ? t('more.fewer') : '';
                if (!expanded) {
                    moreLink.appendChild(h('span', { text: t('more.expand') }));
                    moreLink.appendChild(h('span', { text: t('more.expandHint'), style: `color:${T.textDim}` }));
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
            const themeLabel = getThemeLabels()[currentTheme] || t('theme.dark');
            const badgeStyleValue = `${bl.corner} · ${bl.font} · ${bl.opacity}`;

            // Badge & Appearance section
            const badgeHdr = h('div', { class: 'ar-section-hdr ar-section-hdr-sep', text: t('section.badge') });
            moreWrapper.appendChild(badgeHdr);
            sectionHeaders.push(badgeHdr);
            const badgeStyleBtn = makeOptionBtn(t('setting.badgeStyle'), false, () => ctx.push('badge-style'),
                { value: badgeStyleValue, subtitle: t('setting.badgeStyle.sub') });
            moreWrapper.appendChild(badgeStyleBtn);
            filterables.push({ el: badgeStyleBtn, searchText: badgeStyleBtn.textContent.toLowerCase(), inMore: true });
            const themeBtn = makeOptionBtn(t('setting.theme'), false, () => ctx.push('theme-picker'),
                { value: themeLabel, subtitle: t('setting.theme.sub') });
            moreWrapper.appendChild(themeBtn);
            filterables.push({ el: themeBtn, searchText: themeBtn.textContent.toLowerCase(), inMore: true });

            // General section
            const generalHdr = h('div', { class: 'ar-section-hdr ar-section-hdr-sep', text: t('section.general') });
            moreWrapper.appendChild(generalHdr);
            sectionHeaders.push(generalHdr);
            const hotkeyBtn = makeOptionBtn(t('setting.hotkey'), false, () => ctx.push('hotkey-picker'),
                { value: currentHotkey, subtitle: t('setting.hotkey.sub') });
            moreWrapper.appendChild(hotkeyBtn);
            filterables.push({ el: hotkeyBtn, searchText: hotkeyBtn.textContent.toLowerCase(), inMore: true });

            const alertModeVal = getAlertModeLabels()[Config.get('alertMode')] || t('alertModeLabel.beep');
            const alertModeBtn = makeOptionBtn(t('setting.alertMode'), false, () => ctx.push('alert-mode-picker'),
                { value: alertModeVal, subtitle: t('setting.alertMode.sub') });
            moreWrapper.appendChild(alertModeBtn);
            filterables.push({ el: alertModeBtn, searchText: alertModeBtn.textContent.toLowerCase(), inMore: true });

            // Language picker
            const langCode = Config.get('language');
            const langLabel = _getLanguageLabel(langCode === 'auto' ? 'auto' : langCode);
            const langBtn = makeOptionBtn(t('setting.language'), false, () => ctx.push('language-picker'),
                { value: langLabel, subtitle: t('language.subtitle') });
            moreWrapper.appendChild(langBtn);
            filterables.push({ el: langBtn, searchText: langBtn.textContent.toLowerCase(), inMore: true });

            const webhookConfig = WebhookService.getConfig();
            const whCount = webhookConfig.webhooks.length;
            const whEnabled = webhookConfig.webhooks.filter(wh => wh.enabled && wh.url).length;
            const webhookLabel = whCount === 0 ? t('webhook.none') : !webhookConfig.globalEnabled ? t('webhook.off') : t('webhook.countOn', { enabled: whEnabled, total: whCount });
            const webhookBtn = makeOptionBtn(t('setting.webhook'), false, () => ctx.push('webhook-list'),
                { value: webhookLabel, subtitle: t('setting.webhook.sub') });
            moreWrapper.appendChild(webhookBtn);
            filterables.push({ el: webhookBtn, searchText: webhookBtn.textContent.toLowerCase(), inMore: true });

            // Reset to Defaults
            moreWrapper.appendChild(h('div', { class: 'ar-divider' }));
            let resetConfirmPending = false;
            const resetBtn = makeOptionBtn(t('setting.resetDefaults'), false, () => {
                if (!resetConfirmPending) {
                    resetConfirmPending = true;
                    const span = resetBtn.querySelector('span');
                    if (span) span.textContent = t('btn.resetConfirm');
                    else resetBtn.textContent = t('btn.resetConfirm');
                    resetBtn.style.background = T.errBgDark;
                    setTimeout(() => {
                        resetConfirmPending = false;
                        const s = resetBtn.querySelector('span');
                        if (s) s.textContent = t('setting.resetDefaults');
                        else resetBtn.textContent = t('setting.resetDefaults');
                        resetBtn.style.background = T.errBg;
                    }, 3000);
                    return;
                }
                // Snapshot current values for undo
                const snapshot = {};
                for (const [name] of Object.entries(CONFIG_SCHEMA)) {
                    snapshot[name] = Config.get(name);
                }
                // Reset all config values to defaults
                for (const [name, schema] of Object.entries(CONFIG_SCHEMA)) {
                    if (name === 'settingsExpanded') continue;
                    Config.set(name, schema.default);
                }
                // Stop active refresh
                RefreshService.stop();
                // Reopen settings to reflect new values
                Modal.open('settings');
                // Show undo toast
                showUndoToast(t('toast.settingsReset'), () => {
                    for (const [name, value] of Object.entries(snapshot)) {
                        if (name === 'settingsExpanded') continue;
                        Config.set(name, value);
                    }
                    showToast(t('toast.settingsRestored'));
                });
            }, { bg: T.errBg, color: T.errLight, subtitle: t('setting.resetDefaults.sub') });
            moreWrapper.appendChild(resetBtn);
            filterables.push({ el: resetBtn, searchText: resetBtn.textContent.toLowerCase(), inMore: true });

            panel.appendChild(moreWrapper);
            updateExpanded();

            // No-results message (hidden by default)
            const noResults = h('div', { class: 'ar-empty-state', text: t('filter.noResults'), style: 'display:none' });
            panel.appendChild(noResults);

            // Search/filter logic
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                if (!query) {
                    // Restore normal layout
                    filterables.forEach(f => f.el.style.display = '');
                    sectionHeaders.forEach(hdr => hdr.style.display = '');
                    moreLink.style.display = '';
                    if (emptyState) emptyState.style.display = '';
                    noResults.style.display = 'none';
                    updateExpanded();
                    return;
                }
                // Filter mode: hide sections, show moreWrapper, show matching buttons
                sectionHeaders.forEach(hdr => hdr.style.display = 'none');
                moreLink.style.display = 'none';
                moreWrapper.style.display = 'block';
                if (emptyState) emptyState.style.display = 'none';
                let matchCount = 0;
                filterables.forEach(f => {
                    const match = f.searchText.includes(query);
                    f.el.style.display = match ? '' : 'none';
                    if (match) matchCount++;
                });
                noResults.style.display = matchCount === 0 ? '' : 'none';
            });

            // Escape in search clears filter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && searchInput.value) {
                    e.stopPropagation();
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                }
            });

            // Footer
            panel.appendChild(h('div', {
                class: 'ar-footer',
                style: 'margin-top:14px',
                text: t('footer.hotkeyVersion', { hotkey: currentHotkey, version: VERSION })
            }));
        }
    });

    Modal.define('watch-inspector', {
        reactsTo: ['watch:added', 'watch:removed', 'watches:cleared', 'watches:local-updated'],
        title: () => t('inspector.title'),
        subtitle: () => t('inspector.subtitle'),
        minWidth: '500px',
        maxWidth: '650px',
        footerText: () => t('nav.escDismiss'),
        build: (panel, ctx) => {
            const isRemote = ctx.extra && ctx.extra.pageUrl && ctx.extra.pageUrl !== _pageUrl();
            let watches = (ctx.extra && ctx.extra.watches) || WatchStore.getLocal();
            let currentId = (ctx.extra && ctx.extra.watchId) || (watches.length > 0 ? watches[0].id : null);
            if (currentId && !watches.some(w => w.id === currentId)) currentId = watches.length > 0 ? watches[0].id : null;

            const getIdx = () => watches.findIndex(w => w.id === currentId);
            const getCurrent = () => watches.find(w => w.id === currentId);

            if (watches.length === 0) {
                panel.appendChild(h('div', { class: 'ar-empty-state', text: t('inspector.noWatches') }));
                panel.style.minWidth = '340px';
                return;
            }

            const modeLabels = getWatchModeLabels();

            const layout = h('div', { class: 'ar-split-layout' });
            const sidebar = h('div', { class: 'ar-inspector-sidebar' });
            const detail = h('div', { class: 'ar-detail-pane' });
            const sidebarItems = [];

            function buildSidebar() {
                sidebar.innerHTML = '';
                sidebarItems.length = 0;
                watches.forEach((w) => {
                    const status = isRemote ? 'other-page' : WatchStore.getStatus(w);
                    const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : status === 'other-page' ? T.textDim : T.ok;
                    const short = w.label || (w.selector.length > 18 ? w.selector.slice(-18) : w.selector);

                    const item = h('button', { class: `ar-sidebar-item${w.id === currentId ? ' ar-active' : ''}` },
                        h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: status === 'changed' ? t('status.changed') : status === 'missing' ? t('status.notFound') : t('status.noChanges') }),
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
                    title: isRemote ? t('inspector.navigateToResnap') : t('inspector.resnapTitle'),
                    style: isRemote ? `opacity:0.4;cursor:default` : '',
                    onclick: () => {
                        if (isRemote) { showToast(t('inspector.navigateFirst')); return; }
                        if (!WatchStore.reSnapshot(w)) { showToast(t('toast.elementNotFound')); return; }
                        watches = WatchStore.getLocal();
                        renderDetail();
                        buildSidebar();
                        showToast(t('toast.snapshotUpdated'));
                    }
                }, h('span', { text: '🔄 ' }), h('span', { text: t('inspector.resnap'), style: 'font-size:11px' }));
                toolbar.appendChild(refreshBtn);

                const deleteBtn = h('button', {
                    class: 'ar-toolbar-btn',
                    title: t('inspector.removeTitle'),
                    style: `color:${T.err}`,
                    onclick: () => {
                        const snapshot = JSON.parse(JSON.stringify(w));
                        const wasRemote = isRemote;
                        if (isRemote) {
                            WatchStore.removeRemote(w);
                            watches = watches.filter(ww => ww.id !== w.id);
                        } else {
                            WatchStore.remove(w.id);
                            watches = WatchStore.getLocal();
                        }
                        if (watches.length === 0) {
                            if (isRemote) {
                                Modal.replace('watch-overview', null, 2);
                            } else {
                                ctx.close();
                            }
                            showUndoToast(t('toast.watchRemovedSel', { selector: watchDisplayName(snapshot) }), () => {
                                if (wasRemote && snapshot._storageKey) {
                                    WatchStore.addRemote(snapshot);
                                } else {
                                    WatchStore.add(snapshot);
                                }
                                showToast(t('toast.watchRestored'));
                            });
                            return;
                        }
                        if (!watches.some(ww => ww.id === currentId)) currentId = watches[0].id;
                        buildSidebar();
                        renderDetail();
                        showUndoToast(t('toast.watchRemovedSel', { selector: watchDisplayName(snapshot) }), () => {
                            if (wasRemote && snapshot._storageKey) {
                                WatchStore.addRemote(snapshot);
                            } else {
                                WatchStore.add(snapshot);
                            }
                            showToast(t('toast.watchRestored'));
                        });
                    }
                }, h('span', { text: '🗑 ' }), h('span', { text: t('inspector.remove'), style: 'font-size:11px' }));
                toolbar.appendChild(deleteBtn);

                if (isRemote && w.url) {
                    const openBtn = h('button', {
                        class: 'ar-toolbar-btn',
                        title: t('inspector.openPageTitle'),
                        onclick: () => { window.open(w.url, '_blank'); }
                    }, h('span', { text: '🔗 ' }), h('span', { text: t('inspector.openPage'), style: 'font-size:11px' }));
                    toolbar.appendChild(openBtn);
                }

                headerRow.appendChild(toolbar);
                detail.appendChild(headerRow);

                // Timestamp
                if (w.snapshotTime) {
                    detail.appendChild(h('div', { text: `${t('inspector.snapshot')}: ${timeAgo(w.snapshotTime)}`, style: `color:${T.textFaint};font-size:11px;margin-bottom:6px` }));
                }

                // CSS Selector
                const selectorSection = addCollapsible(detail, t('inspector.cssSelector'), true);
                const selectorRow = h('div', { class: 'ar-input-group' });
                selectorRow.appendChild(h('div', {
                    class: 'ar-input-group-field',
                    text: w.selector
                }));
                selectorRow.appendChild(h('button', {
                    class: 'ar-input-group-btn',
                    text: '📋', title: t('inspector.copySelector'),
                    onclick: () => navigator.clipboard.writeText(w.selector).then(() => showToast(t('toast.selectorCopied')), () => showToast(t('toast.copyFailed')))
                }));
                selectorSection.body.appendChild(selectorRow);

                const el = isRemote ? null : document.querySelector(w.selector);

                // Content section
                if (w.mode === 'content' || w.mode === 'both') {
                    if (isRemote) {
                        const contentSection = addCollapsible(detail, t('inspector.storedContent'), true);
                        addField(contentSection.body, w.content || '(empty)', false);
                    } else {
                        const live = el ? _elText(el) : null;
                        const changed = live !== null && live !== w.content;

                    const contentSection = addCollapsible(detail,
                        t('inspector.content') + (changed ? ' ⚠ CHANGED' : live !== null ? ' ✓' : ''), true);

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
                                text: t('inspector.showFullDiff', { chars: oldText.length + newText.length }),
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
                        const styleSection = addCollapsible(detail, t('inspector.storedStyles'), true);
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
                                styleSection.body.appendChild(h('div', { text: t('inspector.propsCaptured', { count: WATCHED_STYLE_PROPS.length }), style: `color:${T.textFaint};font-size:12px` }));
                            }
                        } else {
                            styleSection.body.appendChild(h('div', { text: t('inspector.noStyles'), style: `color:${T.textFaint};font-size:12px` }));
                        }
                    } else if (el && w.styles) {
                        const liveStyles = captureStyles(el);
                        const changes = diffStyles(w.styles, liveStyles);
                        const styleSection = addCollapsible(detail,
                            changes.length > 0 ? t('inspector.styleChanges', { count: changes.length }) + ' ⚠' : t('inspector.styling') + ' ✓', true);

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
                            styleSection.body.appendChild(h('div', { text: t('inspector.noStyleChanges'), style: `color:${T.textFaint};font-size:12px` }));
                        }
                    } else if (w.styles) {
                        const styleSection = addCollapsible(detail, t('inspector.storedStyles'), false);
                        styleSection.body.appendChild(h('div', { text: t('inspector.propsCaptured', { count: WATCHED_STYLE_PROPS.length }), style: `color:${T.textFaint};font-size:12px` }));
                    }
                }

                if (!el) {
                    if (isRemote) {
                        detail.appendChild(h('div', { class: 'ar-empty-state', text: t('inspector.navigateToSee') }));
                    } else {
                        const box = addField(detail, t('inspector.elementNotFound'), false);
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
        reactsTo: ['watch:added', 'watch:removed', 'watches:cleared', 'watches:local-updated'],
        title: () => t('overview.title'),
        subtitle: () => t('overview.subtitle'),
        minWidth: '360px',
        build: (panel, ctx) => {
            let allWatches = WatchStore.getAll();
            let groups = WatchStore.groupByDomain(allWatches);
            const currentDomain = location.hostname;

            let viewAll = false;

            function refreshData() {
                allWatches = WatchStore.getAll();
                groups = WatchStore.groupByDomain(allWatches);
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
                panel.appendChild(h('div', { class: 'ar-empty-state', text: t('overview.noWatches') }));
                return;
            }

            // Toggle: This Domain / All Domains
            const toggleRow = h('div', { style: 'display:flex;gap:4px;margin-bottom:10px' });
            const btnThis = h('button', { class: 'ar-btn ar-btn-active', style: 'flex:1;font-size:12px', text: t('overview.thisDomain') });
            const btnAll = h('button', { class: 'ar-btn', style: 'flex:1;font-size:12px', text: t('overview.allDomains') });

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
                    listContainer.appendChild(h('div', { class: 'ar-empty-state', text: t('overview.noWatchesDomain') }));
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
                        row.appendChild(h('span', { class: 'ar-dot', style: `background:${dotColor}`, title: isCurrentPage ? t('overview.currentPage') : t('overview.otherPage') }));

                        const info = h('div', { class: 'ar-flex-fill' });
                        info.appendChild(h('div', { class: 'ar-truncate', text: pathname || '/' }));
                        const labels = pageWatches.filter(w => w.label).map(w => w.label);
                        const modes = pageWatches.map(w => w.mode).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                        info.appendChild(h('div', { class: 'ar-subtitle-sm', text: labels.length > 0 ? labels.join(', ') : modes }));
                        row.appendChild(info);

                        row.appendChild(h('span', { class: 'ar-opt-value', text: `${pageWatches.length}` }));

                        row.addEventListener('click', () => {
                            const inspectWatches = isCurrentPage ? WatchStore.getLocal() : pageWatches;
                            ctx.push('watch-inspector', { watches: inspectWatches, pageUrl });
                        });

                        listContainer.appendChild(row);
                    });

                    // Remove all for domain
                    if (domainCount > 1) {
                        const removeAllBtn = h('button', {
                            class: 'ar-btn',
                            style: `color:${T.err};font-size:12px;margin-top:4px`,
                            text: t('overview.removeAll', { domain })
                        });
                        let confirmPending = false;
                        removeAllBtn.addEventListener('click', () => {
                            if (!confirmPending) {
                                confirmPending = true;
                                removeAllBtn.textContent = t('overview.confirmRemove');
                                removeAllBtn.style.background = T.errBg;
                                setTimeout(() => {
                                    confirmPending = false;
                                    removeAllBtn.textContent = t('overview.removeAll', { domain });
                                    removeAllBtn.style.background = '';
                                }, 5000);
                                return;
                            }
                            // Remove all watches for this domain
                            const removedWatches = [];
                            pages.forEach(pathname => {
                                const pageWatches = group.pages[pathname];
                                pageWatches.forEach(w => {
                                    removedWatches.push({ watch: JSON.parse(JSON.stringify(w)), storageKey: w._storageKey });
                                    WatchStore.removeRemote(w);
                                });
                            });
                            refreshData();
                            renderList();
                            showUndoToast(t('overview.removedToast', { count: domainCount, domain }), () => {
                                WatchStore.restoreRemoteBatch(removedWatches);
                                showToast(t('toast.watchesRestored'));
                            });
                        });
                        listContainer.appendChild(removeAllBtn);
                    }
                });

                // Footer total
                listContainer.appendChild(h('div', {
                    style: `text-align:right;color:${T.textFaint};font-size:11px;margin-top:8px;padding-right:4px`,
                    text: t('overview.total', { count: totalCount })
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
            text: t('picker.instructions'),
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

        function onMouseDown(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }

        const cleanups = [
            addDocListener('mousemove', onMove, true),
            addDocListener('mousedown', onMouseDown, true),
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
            e.stopImmediatePropagation();
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
                showToast(t('toast.pickerCancelled'));
            }
        }

    }

    // --- Quick Watch Context Menu ---

    function dismissQuickWatch() {
        if (State.get('activeCtxMenu')) { State.get('activeCtxMenu').remove(); State.set('activeCtxMenu', null); }
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

        const watches = WatchStore.getLocal();
        const existingWatch = watches.find(w => w.selector === selector);
        const isWatched = !!existingWatch;

        const header = h('div', { class: 'ar-ctx-header' });
        const headerTitle = isWatched
            ? (existingWatch.label ? `👁 ${_truncate(existingWatch.label, 25)}` : t('ctx.alreadyWatching'))
            : t('ctx.watchThis');
        header.appendChild(h('div', { class: 'ar-ctx-title', text: headerTitle }));
        header.appendChild(h('div', { class: 'ar-ctx-selector', text: selector, title: selector }));
        menu.appendChild(header);

        if (isWatched) {
            const w = existingWatch;
            const status = WatchStore.getStatus(w);
            const modeLabel = w.mode === 'content' ? t('ctx.modeText') : w.mode === 'style' ? t('ctx.modeStyle') : t('ctx.modeBoth');
            const statusLabel = status === 'changed' ? t('ctx.statusChanged') : status === 'missing' ? t('ctx.statusMissing') : t('ctx.statusOk');

            menu.appendChild(h('div', {
                style: `font-size:11px;color:${T.textMuted};margin-bottom:6px;padding:0 4px`,
                text: `${modeLabel} · ${statusLabel}`
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: t('ctx.resnap'),
                onclick: () => {
                    if (!WatchStore.reSnapshot(w)) { showToast(t('toast.elementNotFound')); dismissQuickWatch(); return; }
                    dismissQuickWatch();
                    showToast(t('toast.snapshotUpdated'));
                }
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: t('ctx.removeWatch'),
                onclick: () => {
                    const snapshot = JSON.parse(JSON.stringify(w));
                    WatchStore.remove(w.id);
                    dismissQuickWatch();
                    const remaining = WatchStore.getLocal().length;
                    showUndoToast(t('toast.watchRemovedSel', { selector: watchDisplayName(w) }), () => {
                        WatchStore.add(snapshot);
                        showToast(t('toast.watchRestored'));
                    });
                }
            }));

            menu.appendChild(h('button', {
                class: 'ar-btn', text: t('ctx.inspect'),
                onclick: () => {
                    dismissQuickWatch();
                    Modal.open('watch-inspector', { watchId: w.id });
                }
            }));
        } else {
            const MODE_DESCS = { content: t('ctx.descContent'), style: t('ctx.descStyle'), both: t('ctx.descBoth') };

            ['content', 'style', 'both'].forEach(mode => {
                const btn = h('button', {
                    class: 'ar-btn', text: getWatchModeLabels()[mode],
                    onclick: () => {
                        const watch = { selector, mode, content: '', styles: '', snapshotTime: Date.now() };
                        if (mode === 'content' || mode === 'both') watch.content = _elText(targetEl);
                        if (mode === 'style' || mode === 'both') watch.styles = captureStyles(targetEl);
                        WatchStore.add(watch);
                        dismissQuickWatch();
                        const count = WatchStore.getLocal().length;
                        showToast(t('ctx.watchingToast', { mode, selector: _truncate(selector), count }));
                    }
                });
                const sub = h('div', { class: 'ar-subtitle-sm', text: MODE_DESCS[mode] });
                btn.appendChild(sub);
                menu.appendChild(btn);
            });

            menu.appendChild(h('button', {
                class: 'ar-link-btn', text: t('ctx.fullOptions'),
                style: 'padding:6px 4px 0',
                onclick: () => {
                    dismissQuickWatch();
                    Modal.open('watch-mode', { selector, el: targetEl });
                }
            }));
        }

        _shadow.appendChild(menu);
        State.set('activeCtxMenu', menu);

        // Click-away to dismiss (use composedPath to cross shadow DOM boundary)
        const onClickAway = (e) => {
            if (State.get('activeCtxMenu') && !e.composedPath().includes(State.get('activeCtxMenu'))) {
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
            let prevContent = (mode === 'content' || mode === 'both') ? _elText(el) : null;
            let prevStyles = (mode === 'style' || mode === 'both') ? captureStyles(el) : null;
            let count = 0;
            const timer = setInterval(() => {
                count++;
                const currContent = (mode === 'content' || mode === 'both') ? _elText(el) : null;
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

    async function detectChanges(watches) {
        const results = { changes: [], missing: [], details: [] };
        const localWatches = watches.filter(w => w.url === _pageUrl());

        const checks = await Promise.all(localWatches.map(async (w) => {
            const el = await waitForElement(w.selector);
            if (!el) return { type: 'missing', selector: w.selector };

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
                return {
                    type: 'changed', selector: w.selector, mode: w.mode, changes,
                    old_content: w.content || '', new_content: newContent || _elText(el)
                };
            }
            return { type: 'ok' };
        }));

        for (const result of checks) {
            if (result.type === 'missing') {
                results.missing.push(_truncate(result.selector));
            } else if (result.type === 'changed') {
                results.changes.push(`${_truncate(result.selector, 25)} (${result.changes.join(' & ')})`);
                results.details.push({
                    url: location.href, selector: result.selector, mode: result.mode,
                    old_content: result.old_content, new_content: result.new_content,
                    timestamp: new Date().toISOString()
                });
            }
        }
        return results;
    }

    function notifyChanges(results) {
        if (results.missing.length > 0) {
            stopRefresh();
            speak(t('speak.missingWarning', { count: results.missing.length, page: _pageLabel() }));
            startAlert();
            showToast(t('toast.missingElements', { count: results.missing.length }));
            return;
        }

        if (results.changes.length > 0) {
            stopRefresh();
            const summary = results.changes.length === 1
                ? t('speak.watchChanged', { page: _pageLabel() })
                : t('speak.watchesChanged', { count: results.changes.length, page: _pageLabel() });
            speak(summary);
            startAlert();
            showToast(t('toast.watchesChanged', { count: results.changes.length }));

            if (results.details.length > 0) {
                sendWebhook({ ...results.details[0], summary });
            }
        }
    }

    async function checkForChanges() {
        if (!WatchStore.isWatchEnabled()) return;
        const watches = WatchStore.getLocal();
        if (watches.length === 0) return;

        const results = await detectChanges(watches);
        notifyChanges(results);
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

    // --- Keyboard Shortcut Cheat Sheet ---

    (function initShortcutCheatSheet() {
        let overlay = null;

        function dismiss() {
            if (overlay) { overlay.remove(); overlay = null; }
        }

        function show() {
            dismiss();
            const currentHotkey = Config.get('hotkey');
            const shortcuts = [
                { key: currentHotkey, desc: t('shortcuts.openSettings') },
                { key: 'Escape', desc: t('shortcuts.escape') },
                { key: '\u2191 / \u2193', desc: t('shortcuts.navigate') },
                { key: 'Enter', desc: t('shortcuts.select') },
                { key: 'Ctrl+Right-click', desc: t('shortcuts.contextMenu') },
            ];

            overlay = h('div', { class: 'ar-shortcut-overlay' });
            const panel = h('div', { class: 'ar-shortcut-panel' });
            panel.appendChild(h('div', { class: 'ar-shortcut-title', text: '\u2328 ' + t('shortcuts.title') }));

            shortcuts.forEach(({ key, desc }) => {
                const row = h('div', { class: 'ar-shortcut-row' });
                row.appendChild(h('span', { class: 'ar-kbd', text: key }));
                row.appendChild(h('span', { class: 'ar-shortcut-desc', text: desc }));
                panel.appendChild(row);
            });

            panel.appendChild(h('div', {
                style: `text-align:center;color:${T.textFaint};font-size:11px;margin-top:12px`,
                text: t('shortcuts.dismiss')
            }));

            overlay.appendChild(panel);
            _shadow.appendChild(overlay);

            function dismissAndCleanup() {
                dismiss();
                document.removeEventListener('keydown', onDismissKey, true);
                document.removeEventListener('click', onDismissClick, true);
            }
            const onDismissKey = () => dismissAndCleanup();
            const onDismissClick = () => dismissAndCleanup();
            // Delay attaching to avoid the triggering keydown immediately dismissing
            requestAnimationFrame(() => {
                document.addEventListener('keydown', onDismissKey, true);
                document.addEventListener('click', onDismissClick, true);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== '?') return;
            if (Modal.isOpen()) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
            e.preventDefault();
            show();
        });
    })();

    // --- Test Harness ---

    function runTests() {
        let passed = 0, failed = 0;
        const failures = [];

        function assertEq(actual, expected, label) {
            const a = JSON.stringify(actual);
            const e = JSON.stringify(expected);
            if (a === e) { passed++; }
            else { failed++; failures.push(`${label}: expected ${e}, got ${a}`); }
        }

        function assert(condition, label) {
            if (condition) { passed++; }
            else { failed++; failures.push(label); }
        }

        // --- formatSeconds ---
        assertEq(formatSeconds(5), '5 seconds', 'formatSeconds(5)');
        assertEq(formatSeconds(30), '30 seconds', 'formatSeconds(30)');
        assertEq(formatSeconds(59), '59 seconds', 'formatSeconds(59)');
        assertEq(formatSeconds(60), '1 minute', 'formatSeconds(60)');
        assertEq(formatSeconds(90), '1m 30s', 'formatSeconds(90)');
        assertEq(formatSeconds(120), '2 minutes', 'formatSeconds(120)');
        assertEq(formatSeconds(300), '5 minutes', 'formatSeconds(300)');
        assertEq(formatSeconds(3600), '1 hour', 'formatSeconds(3600)');
        assertEq(formatSeconds(7200), '2 hours', 'formatSeconds(7200)');
        assertEq(formatSeconds(3661), '1h 1m', 'formatSeconds(3661)');

        // --- formatCountdown ---
        assertEq(formatCountdown(0), '0s', 'formatCountdown(0)');
        assertEq(formatCountdown(30), '30s', 'formatCountdown(30)');
        assertEq(formatCountdown(59), '59s', 'formatCountdown(59)');
        assertEq(formatCountdown(60), '1m 00s', 'formatCountdown(60)');
        assertEq(formatCountdown(61), '1m 01s', 'formatCountdown(61)');
        assertEq(formatCountdown(150), '2m 30s', 'formatCountdown(150)');

        // --- _truncate ---
        assertEq(_truncate('hello', 10), 'hello', 'truncate short');
        assertEq(_truncate('hello world this is long', 10), 'hello worl…', 'truncate long');
        assertEq(_truncate('exact', 5), 'exact', 'truncate exact');
        assertEq(_truncate('', 5), '', 'truncate empty');

        // --- getModeColor ---
        assertEq(getModeColor('content'), T.modeContent, 'getModeColor content');
        assertEq(getModeColor('style'), T.modeStyle, 'getModeColor style');
        assertEq(getModeColor('both'), T.modeBoth, 'getModeColor both');
        assertEq(getModeColor('unknown'), undefined, 'getModeColor unknown');

        // --- _camelToVar ---
        assertEq(_camelToVar('bg'), '--ar-bg', 'camelToVar simple');
        assertEq(_camelToVar('bgDark'), '--ar-bg-dark', 'camelToVar camelCase');
        assertEq(_camelToVar('errBgHover'), '--ar-err-bg-hover', 'camelToVar multi');
        assertEq(_camelToVar('textLight'), '--ar-text-light', 'camelToVar two parts');

        // --- v() ---
        assertEq(v('bg'), 'var(--ar-bg)', 'v() basic');
        assertEq(v('textMuted'), 'var(--ar-text-muted)', 'v() camelCase');

        // --- buildThemeVars ---
        const miniTheme = { bg: '#000', text: '#fff' };
        const vars = buildThemeVars(miniTheme);
        assert(vars.startsWith(':host{'), 'buildThemeVars starts with :host{');
        assert(vars.includes('--ar-bg:#000'), 'buildThemeVars has --ar-bg');
        assert(vars.includes('--ar-text:#fff'), 'buildThemeVars has --ar-text');
        assert(vars.endsWith('}'), 'buildThemeVars ends with }');

        // --- _replaceTemplateTags ---
        assertEq(_replaceTemplateTags('{{url}}', { url: 'http://example.com' }), 'http://example.com', 'template single tag');
        assertEq(_replaceTemplateTags('{{a}} and {{b}}', { a: '1', b: '2' }), '1 and 2', 'template multiple tags');
        assertEq(_replaceTemplateTags('{{missing}}', {}), '{{missing}}', 'template missing tag');
        assertEq(_replaceTemplateTags('no tags', { url: 'x' }), 'no tags', 'template no tags');
        assertEq(_replaceTemplateTags('{{a}}', { a: 0 }), '0', 'template falsy value');

        // --- diffStyles ---
        const oldS = JSON.stringify({ color: 'red', opacity: '1', display: 'block' });
        const newS = JSON.stringify({ color: 'blue', opacity: '1', display: 'block' });
        const diff1 = diffStyles(oldS, newS);
        assertEq(diff1.length, 1, 'diffStyles one change count');
        assertEq(diff1[0].prop, 'color', 'diffStyles changed prop');
        assertEq(diff1[0].from, 'red', 'diffStyles from value');
        assertEq(diff1[0].to, 'blue', 'diffStyles to value');

        const noChange = diffStyles(oldS, oldS);
        assertEq(noChange.length, 0, 'diffStyles no changes');

        const invalidDiff = diffStyles('not json', 'also not');
        assertEq(invalidDiff.length, 0, 'diffStyles invalid JSON');

        // --- formatWebhookPayload ---
        const whDetails = { url: 'http://ex.com', selector: '#el', old_content: 'old', new_content: 'new', timestamp: '2025-01-01T00:00:00Z' };

        const slack = formatWebhookPayload('slack', whDetails);
        assert(slack.blocks && slack.blocks[0].type === 'section', 'webhook slack has blocks');
        assert(slack.blocks[0].text.text.includes('#el'), 'webhook slack includes selector');

        const discord = formatWebhookPayload('discord', whDetails);
        assert(discord.embeds && discord.embeds[0].title.includes('Change'), 'webhook discord has embed');
        assertEq(discord.embeds[0].fields.length, 4, 'webhook discord field count');

        const teams = formatWebhookPayload('teams', whDetails);
        assert(teams.type === 'message', 'webhook teams is message');
        assert(teams.attachments[0].content.body.length === 3, 'webhook teams body count');

        const generic = formatWebhookPayload('generic', whDetails, '{"event":"{{url}}"}');
        assertEq(generic.event, 'http://ex.com', 'webhook generic template');

        const genericBad = formatWebhookPayload('generic', whDetails, 'not json {{url}}');
        assert(genericBad.event === 'change_detected', 'webhook generic fallback');

        // --- EventBus ---
        let ebResult = null;
        const unsub = EventBus.on('test:event', (data) => { ebResult = data; });
        EventBus.emit('test:event', { val: 42 });
        assertEq(ebResult, { val: 42 }, 'EventBus on+emit');

        unsub();
        ebResult = null;
        EventBus.emit('test:event', { val: 99 });
        assertEq(ebResult, null, 'EventBus unsubscribe');

        let ebCount = 0;
        const fn1 = () => ebCount++;
        const fn2 = () => ebCount++;
        EventBus.on('test:multi', fn1);
        EventBus.on('test:multi', fn2);
        EventBus.emit('test:multi');
        assertEq(ebCount, 2, 'EventBus multiple listeners');
        EventBus.off('test:multi', fn1);
        EventBus.off('test:multi', fn2);

        let crossResult = null;
        const unsubA = EventBus.on('test:a', () => { crossResult = 'a'; });
        EventBus.emit('test:b');
        assertEq(crossResult, null, 'EventBus no cross-talk');
        // Cleanup
        unsubA();

        // --- groupWatchesByDomain ---
        const testWatches = [
            { selector: '.a', url: 'https://example.com/page1' },
            { selector: '.b', url: 'https://example.com/page2' },
            { selector: '.c', url: 'https://other.com/page' }
        ];
        const grouped = WatchStore.groupByDomain(testWatches);
        assert('example.com' in grouped, 'groupWatches has example.com');
        assert('other.com' in grouped, 'groupWatches has other.com');
        assertEq(Object.keys(grouped['example.com'].pages).length, 2, 'groupWatches 2 pages for example.com');
        assertEq(grouped['other.com'].pages['/page'].length, 1, 'groupWatches 1 watch for other.com');

        const malformed = WatchStore.groupByDomain([{ selector: '.x', _urlKey: 'not-a-url' }]);
        assert(Object.keys(malformed).length > 0, 'groupWatches handles malformed URL');

        // --- Config schema ---
        assert(Config.schema.interval.default === 30, 'Config schema interval default');
        assert(Config.schema.theme.default === 'dark', 'Config schema theme default');
        assert(typeof Config.schema.opacity.default === 'number', 'Config schema opacity type');

        // --- WebhookService ---
        assertEq(WebhookService.validateUrl('https://example.com').valid, true, 'validateUrl valid');
        assertEq(WebhookService.validateUrl('').valid, false, 'validateUrl empty');
        assertEq(WebhookService.validateUrl('not-a-url').valid, false, 'validateUrl invalid');
        assertEq(WebhookService.validateUrl('').reason, 'empty', 'validateUrl empty reason');
        assertEq(WebhookService.validateUrl('bad').reason, 'invalid', 'validateUrl invalid reason');

        // --- Service facade consistency ---
        assert(typeof WebhookService.getConfig === 'function', 'WebhookService.getConfig exists');
        assert(typeof WebhookService.saveConfig === 'function', 'WebhookService.saveConfig exists');
        assert(typeof WebhookService.validateUrl === 'function', 'WebhookService.validateUrl exists');
        assert(typeof WebhookService.addWebhook === 'function', 'WebhookService.addWebhook exists');
        assert(typeof WebhookService.updateWebhook === 'function', 'WebhookService.updateWebhook exists');
        assert(typeof WebhookService.deleteWebhook === 'function', 'WebhookService.deleteWebhook exists');
        assert(typeof RefreshService.start === 'function', 'RefreshService.start exists');
        assert(typeof RefreshService.stop === 'function', 'RefreshService.stop exists');
        assert(typeof RefreshService.pause === 'function', 'RefreshService.pause exists');
        assert(typeof RefreshService.resume === 'function', 'RefreshService.resume exists');
        assert(typeof RefreshService.isEnabled === 'function', 'RefreshService.isEnabled exists');
        assert(typeof RefreshService.getInterval === 'function', 'RefreshService.getInterval exists');

        // --- State store ---
        State.set('lastWebhookTime', 12345);
        assertEq(State.get('lastWebhookTime'), 12345, 'State round-trip');
        State.set('lastWebhookTime', 0); // reset

        // --- Modal.replace ---
        assert(typeof Modal.replace === 'function', 'Modal.replace exists');

        // --- createFocusTrap ---
        const fakeContainer = h('div');
        const trap = createFocusTrap(fakeContainer);
        assert(typeof trap.handleKeyDown === 'function', 'FocusTrap.handleKeyDown exists');
        assert(typeof trap.clearOutlines === 'function', 'FocusTrap.clearOutlines exists');
        assert(typeof trap.destroy === 'function', 'FocusTrap.destroy exists');
        trap.destroy();

        // --- WatchStore.getStatus ---
        const fakeWatch = { url: 'https://other.example.com/page', selector: '#x', mode: 'content', content: '' };
        assertEq(WatchStore.getStatus(fakeWatch), 'other-page', 'WatchStore.getStatus other-page');

        // --- WatchStore.groupByDomain edge cases ---
        const emptyGrouped = WatchStore.groupByDomain([]);
        assertEq(Object.keys(emptyGrouped).length, 0, 'groupByDomain empty input');
        const singleGrouped = WatchStore.groupByDomain([{ selector: '.a', url: 'https://example.com/' }]);
        assertEq(Object.keys(singleGrouped).length, 1, 'groupByDomain single watch');

        // --- Helper functions ---
        assert(typeof setToggleState === 'function', 'setToggleState exists');
        assert(typeof setInputError === 'function', 'setInputError exists');

        // --- I18N ---
        // t() returns correct value for known key
        assertEq(t('settings.title'), I18N.en['settings.title'] || 'Auto Refresh Settings', 'i18n t() returns en value');
        // t() returns key itself for unknown key
        const unknownResult = t('nonexistent.key.xyz');
        assertEq(unknownResult, 'nonexistent.key.xyz', 'i18n t() unknown key fallback');
        // t() interpolation
        assertEq(t('toast.refreshStarted', { interval: '30s' }), I18N.en['toast.refreshStarted'].replace('{interval}', '30s'), 'i18n t() interpolation');
        // Plural support
        const pluralKey = 'speak.missingWarning';
        const singResult = t(pluralKey, { count: 1, page: 'test' });
        assert(!singResult.includes('|'), 'i18n plural resolves singular');
        const plurResult = t(pluralKey, { count: 3, page: 'test' });
        assert(!plurResult.includes('|'), 'i18n plural resolves plural');
        // Spanish dictionary parity
        const enKeys = Object.keys(I18N.en);
        const esKeys = Object.keys(I18N.es);
        const missingInEs = enKeys.filter(k => !(k in I18N.es));
        assertEq(missingInEs.length, 0, `i18n es missing ${missingInEs.length} keys: ${missingInEs.slice(0, 3).join(', ')}`);
        // Language config exists
        assert(Config.schema.language !== undefined, 'Config schema has language');
        assertEq(Config.schema.language.default, 'auto', 'Config language default is auto');

        // --- watchDisplayName ---
        assertEq(watchDisplayName({ selector: 'div.price', label: 'Amazon Price' }), 'Amazon Price', 'watchDisplayName with label');
        assertEq(watchDisplayName({ selector: 'div.price', label: '' }), 'div.price', 'watchDisplayName empty label');
        assertEq(watchDisplayName({ selector: 'div.price' }), 'div.price', 'watchDisplayName no label');
        assertEq(watchDisplayName({ selector: 'a'.repeat(50), label: '' }, 20), 'a'.repeat(20) + '\u2026', 'watchDisplayName truncates selector');
        assertEq(watchDisplayName({ selector: 'div', label: 'b'.repeat(50) }, 20), 'b'.repeat(20) + '\u2026', 'watchDisplayName truncates label');

        // --- showUndoToast ---
        assert(typeof showUndoToast === 'function', 'showUndoToast exists');

        // --- Reactive Modal Rebuild ---
        assert(typeof Modal.define === 'function', 'Modal.define exists');
        // Verify reactsTo is declared on key modals
        // (tested indirectly via EventBus subscriptions — events mark dirty flags)
        let reactiveTestPassed = false;
        const unsubReactive = EventBus.on('watch:added', () => { reactiveTestPassed = true; });
        EventBus.emit('watch:added', {});
        assert(reactiveTestPassed, 'EventBus watch:added fires and is received');
        unsubReactive();

        // --- I18N new keys ---
        assert(I18N.en['toast.undo'] !== undefined, 'i18n toast.undo exists');
        assert(I18N.en['filter.placeholder'] !== undefined, 'i18n filter.placeholder exists');
        assert(I18N.en['shortcuts.title'] !== undefined, 'i18n shortcuts.title exists');
        assert(I18N.en['watch.nameOptional'] !== undefined, 'i18n watch.nameOptional exists');
        assert(I18N.es['toast.undo'] !== undefined, 'i18n es toast.undo exists');
        assert(I18N.es['filter.placeholder'] !== undefined, 'i18n es filter.placeholder exists');
        assert(I18N.es['shortcuts.title'] !== undefined, 'i18n es shortcuts.title exists');
        assert(I18N.es['watch.nameOptional'] !== undefined, 'i18n es watch.nameOptional exists');

        // --- Results ---
        console.log(`[AutoRefresh Tests] ${passed} passed, ${failed} failed`);
        if (failures.length > 0) {
            failures.forEach(f => console.error(`  FAIL: ${f}`));
        }
        showToast(failed === 0 ? `\u2705 All ${passed} tests passed` : `\u274c ${failed} failed, ${passed} passed`);
    }

    // --- Menu Commands ---

    GM_registerMenuCommand(t('menu.openSettings'), openSettingsMenu);
    GM_registerMenuCommand(t('menu.fontSize'), () => Modal.open('fontsize-picker'));
    GM_registerMenuCommand(t('menu.position'), () => Modal.open('position-picker'));
    GM_registerMenuCommand(t('menu.interval'), () => Modal.open('interval-picker'));
    GM_registerMenuCommand(t('menu.hotkey'), () => Modal.open('hotkey-picker'));
    GM_registerMenuCommand(t('menu.watchElement'), startElementPicker);
    GM_registerMenuCommand(t('menu.clearWatch'), () => Modal.open('clear-watch'));
    GM_registerMenuCommand(t('menu.startRefresh'), () => {
        RefreshService.start();
        showToast(t('toast.refreshStarted', { interval: formatSeconds(getInterval()) }));
    });
    GM_registerMenuCommand(t('menu.stopRefresh'), () => {
        RefreshService.stop();
        showToast(t('toast.refreshStopped'));
    });
    GM_registerMenuCommand(t('menu.runTests'), runTests);

    // --- Initialization ---

    function onPageReady() {
        if (isEnabled()) RefreshService.start();
        checkForChanges();
    }

    if (document.readyState === 'complete') onPageReady();
    else window.addEventListener('load', onPageReady, { once: true });
})();
