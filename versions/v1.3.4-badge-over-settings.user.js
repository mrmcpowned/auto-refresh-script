// ==UserScript==
// @name         Auto Refresh Page
// @namespace    http://chrisr.xyz/
// @version      1.3.4
// @description  Auto-refresh any webpage at a configurable interval
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '1.3.4';

    // --- Theme Constants ---
    const T = {
        // Backgrounds
        bg:        '#1e1e1e',  // modal panel background
        bgDark:    '#111',     // input fields, panels, status bar
        bgDarker:  '#000',     // rare, hotkey key background
        bgMid:     '#222',     // slightly lighter panels
        bgLight:   '#2a2a2a',  // hover states, toolbar bg
        bgLighter: '#3a3a3a',  // toolbar hover
        bgOverlay: 'rgba(0,0,0,0.5)',  // modal overlay
        bgBadge:   'rgba(30,30,30,0.92)',  // badge background

        // Borders
        border:       '#444',  // standard borders
        borderLight:  '#555',  // lighter borders, separators
        borderMid:    '#333',  // subtle borders

        // Text
        text:       '#eee',  // primary text
        textLight:  '#fff',  // bright/emphasis text
        textMuted:  '#aaa',  // secondary text, labels
        textDim:    '#888',  // tertiary text, hints
        textFaint:  '#666',  // disabled, placeholder text
        textSub:    '#ccc',  // sub-items

        // Accent
        accent:      '#0078d4',  // primary accent (Microsoft blue)
        accentHover: '#1a8ad4',  // accent hover state
        accentFaint: 'rgba(0,120,212,0.15)',  // accent highlight bg

        // Status colors
        ok:         '#0f0',    // success, active, good
        okBright:   '#0a0',    // brighter green
        okText:     '#8f8',    // green text on dark bg
        okBg:       '#1a3a1a', // green button bg
        okBgHover:  '#254a25', // green button hover
        okFaint:    'rgba(0,255,0,0.03)',  // subtle green bg

        warn:       '#fc0',    // warning, caution
        warnBg:     '#3a2a00', // warning box bg
        warnBorder: '#a86',    // warning box border

        err:        '#f44',    // error, destructive
        errLight:   '#f88',    // error hover/light
        errBg:      '#4a1c1c', // error button bg
        errBgHover: '#5a2525', // error button hover
        errBgDark:  '#6a2020', // darker error bg
        errPanel:   '#1a1a2e', // error detail panel

        // Shadows
        shadow:     'rgba(0,0,0,0.4)',
        shadowHeavy:'rgba(0,0,0,0.5)',

        // Special
        cyan:       '#0af',    // watch dot, info accent

        // Watch mode colors
        modeContent: '#4ec9b0',  // content watch (teal)
        modeStyle:   '#c586c0',  // style watch (purple)
        modeBoth:    '#569cd6',  // both mode (blue)
    };

    const MODE_COLORS = { content: T.modeContent, style: T.modeStyle, both: T.modeBoth };

    const STORAGE_KEY_INTERVAL = 'autoRefreshInterval';
    const STORAGE_KEY_ENABLED = 'autoRefreshEnabled_' + location.href;
    const STORAGE_KEY_CORNER = 'autoRefreshCorner';
    const STORAGE_KEY_FONT_SIZE = 'autoRefreshFontSize';
    const STORAGE_KEY_HOTKEY = 'autoRefreshHotkey';
    const STORAGE_KEY_WATCHES = 'autoRefreshWatches_' + location.href;
    const STORAGE_KEY_WATCH_ENABLED = 'autoRefreshWatchEnabled_' + location.href;

    // --- Watch Array Helpers ---
    // Each watch: { selector, mode, content, styles, snapshotTime }

    function getWatches() {
        try { return JSON.parse(GM_getValue(STORAGE_KEY_WATCHES, '[]')); }
        catch { return []; }
    }

    function setWatches(arr) {
        GM_setValue(STORAGE_KEY_WATCHES, JSON.stringify(arr));
    }

    function addWatch(watch) {
        const watches = getWatches();
        // Don't add duplicate selectors
        const existing = watches.findIndex(w => w.selector === watch.selector);
        if (existing >= 0) watches[existing] = watch;
        else watches.push(watch);
        setWatches(watches);
        GM_setValue(STORAGE_KEY_WATCH_ENABLED, true);
    }

    function removeWatch(index) {
        const watches = getWatches();
        watches.splice(index, 1);
        setWatches(watches);
        if (watches.length === 0) GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
    }

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
        WATCHED_STYLE_PROPS.forEach(prop => {
            snapshot[prop] = computed[prop];
        });
        return JSON.stringify(snapshot);
    }

    function diffStyles(oldJson, newJson) {
        try {
            const oldObj = JSON.parse(oldJson);
            const newObj = JSON.parse(newJson);
            const changes = [];
            for (const prop of WATCHED_STYLE_PROPS) {
                if (oldObj[prop] !== newObj[prop]) {
                    changes.push({ prop, from: oldObj[prop], to: newObj[prop] });
                }
            }
            return changes;
        } catch { return []; }
    }

    const FONT_SIZES = {
        'small': '11px',
        'medium': '13px',
        'large': '16px',
        'extra-large': '20px'
    };

    const CORNERS = {
        'bottom-right': { bottom: '12px', right: '12px', top: '', left: '', transform: '' },
        'bottom-left': { bottom: '12px', right: '', top: '', left: '12px', transform: '' },
        'bottom-center': { bottom: '12px', right: '', top: '', left: '50%', transform: 'translateX(-50%)' },
        'top-right': { bottom: '', right: '12px', top: '12px', left: '', transform: '' },
        'top-left': { bottom: '', right: '', top: '12px', left: '12px', transform: '' },
        'top-center': { bottom: '', right: '', top: '12px', left: '50%', transform: 'translateX(-50%)' }
    };

    let refreshTimerId = null;
    let countdownTimerId = null;
    let remaining = 0;
    let paused = false;

    // --- Countdown Badge ---

    const badge = document.createElement('div');
    badge.id = 'auto-refresh-badge';
    badge.style.cssText = [
        'position:fixed', 'z-index:2147483647',
        `background:${T.bgBadge}`, `color:${T.ok}`, 'font:bold 13px/1 monospace',
        'padding:0', 'border-radius:8px', 'cursor:pointer',
        'user-select:none', 'display:none', `box-shadow:0 2px 8px ${T.shadow}`,
        'backdrop-filter:blur(4px)', 'transition:opacity .2s, box-shadow .3s',
        'overflow:hidden'
    ].join(';');

    const badgeContent = document.createElement('div');
    badgeContent.style.cssText = 'padding:6px 10px;display:flex;align-items:center;gap:6px;white-space:nowrap;';
    badge.appendChild(badgeContent);

    const badgeText = document.createElement('span');
    badgeText.style.cssText = 'transition:color .3s;';
    badgeContent.appendChild(badgeText);

    const watchDot = document.createElement('span');
    watchDot.style.cssText = [
        'width:6px', 'height:6px', 'border-radius:50%', `background:${T.cyan}`,
        'display:none', 'flex-shrink:0'
    ].join(';');
    watchDot.title = 'Watches active';
    badgeContent.appendChild(watchDot);

    const progressBar = document.createElement('div');
    progressBar.style.cssText = [
        'height:3px', `background:${T.ok}`, 'transition:width .3s linear, background .3s',
        'width:100%', 'border-radius:0 0 8px 8px'
    ].join(';');
    badge.appendChild(progressBar);

    // Hover expand
    const hoverInfo = document.createElement('div');
    hoverInfo.style.cssText = [
        'max-height:0', 'overflow:hidden', 'transition:max-height .2s, padding .2s',
        'font-size:11px', `color:${T.textMuted}`, 'padding:0 10px',
        `border-top:0px solid ${T.borderMid}`
    ].join(';');
    badge.insertBefore(hoverInfo, progressBar);

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
    });
    badge.addEventListener('mouseleave', () => {
        hoverInfo.style.maxHeight = '0';
        hoverInfo.style.padding = '0 10px';
        hoverInfo.style.borderTop = `0px solid ${T.borderMid}`;
    });

    applyCorner();
    applyFontSize();
    badge.title = 'Click for options';
    badge.setAttribute('role', 'button');
    badge.setAttribute('aria-label', 'Auto-refresh countdown badge — click for options');
    badge.addEventListener('click', (e) => {
        e.stopPropagation();
        openBadgeMenu();
    });
    document.documentElement.appendChild(badge);

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

    function getUrgencyColor(fraction) {
        // fraction = remaining / total (1 = full, 0 = about to refresh)
        if (fraction > 0.25) return T.ok;
        if (fraction > 0.10) return T.warn;
        return T.err;
    }

    function formatCountdown(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
    }

    function updateBadge() {
        const total = getInterval();
        const fraction = total > 0 ? remaining / total : 1;
        const color = paused ? T.textDim : getUrgencyColor(fraction);

        const time = formatCountdown(remaining);
        badgeText.textContent = paused ? `⏸ ${time}` : `↻ ${time}`;
        badgeText.style.color = color;

        // Progress bar
        progressBar.style.width = `${fraction * 100}%`;
        progressBar.style.background = color;

        // Watch dot visibility
        const watchCount = getWatches().length;
        watchDot.style.display = watchCount > 0 ? 'inline-block' : 'none';

        // Pulse glow in last 10%
        if (!paused && fraction <= 0.10) {
            badge.style.boxShadow = `0 0 12px ${color}, 0 2px 8px ${T.shadow}`;
            badge.style.animation = 'none';
            // Trigger reflow for pulse effect
            void badge.offsetWidth;
        } else {
            badge.style.boxShadow = `0 2px 8px ${T.shadow}`;
        }
    }

    function showBadge() {
        badge.style.display = 'block';
    }

    function hideBadge() {
        badge.style.display = 'none';
    }

    // --- Core Logic ---

    function getInterval() {
        return GM_getValue(STORAGE_KEY_INTERVAL, 30);
    }

    function isEnabled() {
        return GM_getValue(STORAGE_KEY_ENABLED, false);
    }

    function startRefresh() {
        stopRefresh();
        const seconds = getInterval();
        remaining = seconds;
        updateBadge();
        showBadge();

        countdownTimerId = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                location.reload();
                return;
            }
            updateBadge();
        }, 1000);

        GM_setValue(STORAGE_KEY_ENABLED, true);
    }

    function stopRefresh() {
        if (countdownTimerId !== null) {
            clearInterval(countdownTimerId);
            countdownTimerId = null;
        }
        if (refreshTimerId !== null) {
            clearTimeout(refreshTimerId);
            refreshTimerId = null;
        }
        paused = false;
        hideBadge();
        GM_setValue(STORAGE_KEY_ENABLED, false);
    }

    function pauseRefresh() {
        if (countdownTimerId !== null) {
            clearInterval(countdownTimerId);
            countdownTimerId = null;
        }
        paused = true;
        updateBadge();
    }

    function resumeRefresh() {
        paused = false;
        if (!isEnabled() || remaining <= 0) return;
        if (countdownTimerId !== null) return;
        countdownTimerId = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                location.reload();
                return;
            }
            updateBadge();
        }, 1000);
        updateBadge();
    }

    function openBadgeMenu() {
        // Close settings modal if open so badge menu isn't overlaid
        const settings = document.getElementById('auto-refresh-settings');
        if (settings) { settings.remove(); modalOpen = false; }
        pauseRefresh();
        const watches = getWatches();
        const watchCount = watches.length;

        openModal('auto-refresh-badge-menu', 'Quick Actions', (panel, close) => {
            // Status context
            const statusBar = document.createElement('div');
            statusBar.style.cssText = [
                'display:flex', 'align-items:center', 'gap:8px',
                'padding:8px 12px', 'border-radius:6px', 'margin-bottom:10px',
                `background:${T.bgDark}`, `border:1px solid ${T.borderMid}`, 'font-size:13px', `color:${T.textMuted}`
            ].join(';');
            const timeStr = formatCountdown(remaining);
            const parts = [`⏸ Paused · ${timeStr} remaining`];
            if (watchCount > 0) parts[0] += ` · ${watchCount} watch${watchCount > 1 ? 'es' : ''}`;
            statusBar.textContent = parts[0];
            panel.appendChild(statusBar);

            // Resume
            if (paused) {
                panel.appendChild(makeOptionBtn('▶ Resume', false, () => {
                    close();
                }, { subtitle: 'Continue countdown', bg: T.okBg, hoverBg: T.okBgHover, color: T.okText }));
            }

            // Stop
            panel.appendChild(makeOptionBtn('⏹ Stop Refresh', false, () => {
                stopRefresh();
                close();
                showToast('Auto-refresh stopped');
            }, { subtitle: 'Stop and hide badge', bg: T.errBg, hoverBg: T.errBgHover, color: T.errLight }));

            // Inspect Watches (if any have changes)
            if (watchCount > 0) {
                const changedCount = watches.filter(w => getWatchStatus(w) === 'changed').length;
                const watchLabel = changedCount > 0
                    ? `🔍 Inspect Watches (${changedCount} changed)`
                    : `🔍 Inspect Watches`;
                panel.appendChild(makeOptionBtn(watchLabel, false, () => {
                    close(true);
                    openWatchInspector(() => { resumeRefresh(); });
                }, { subtitle: 'View stored vs live content for each watch' }));
            }

            // Settings
            panel.appendChild(makeOptionBtn('⚙ Settings', false, () => {
                close();
                openSettingsMenu();
            }, { subtitle: 'Open full settings panel' }));

            // Footer
            const footer = document.createElement('div');
            footer.textContent = 'Press Esc to dismiss';
            footer.style.cssText = `margin-top:12px;padding-top:8px;border-top:1px solid ${T.borderMid};text-align:center;font-size:11px;color:${T.borderLight};`;
            panel.appendChild(footer);
        }, resumeRefresh);
    }

    // --- Toast ---

    let toastCounter = 0;

    function showToast(message) {
        toastCounter++;
        const toastId = `auto-refresh-toast-${toastCounter}`;

        // Shift existing toasts down
        const existingToasts = document.querySelectorAll('[id^="auto-refresh-toast-"]');
        existingToasts.forEach(t => {
            const currentTop = parseInt(t.style.top) || 16;
            t.style.top = (currentTop + 48) + 'px';
        });

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.textContent = message;
        toast.style.cssText = [
            'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:2147483647', `background:${T.accent}`, `color:${T.textLight}`,
            'font:14px/1 system-ui,sans-serif', 'padding:10px 20px',
            'border-radius:8px', `box-shadow:0 4px 16px ${T.shadow}`,
            'opacity:0', 'transition:opacity .3s, top .3s',
            'pointer-events:none'
        ].join(';');
        document.documentElement.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Modal Helpers ---

    let modalOpen = false;

    function openModal(id, titleText, buildContent, onClose) {
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483646',
            'display:flex', 'align-items:center', 'justify-content:center',
            `background:${T.shadowHeavy}`
        ].join(';');

        const panel = document.createElement('div');
        panel.style.cssText = [
            `background:${T.bg}`, `color:${T.text}`, 'border-radius:10px',
            'padding:16px 20px', 'font:14px/1.6 system-ui,sans-serif',
            'min-width:220px', `box-shadow:0 8px 30px ${T.shadowHeavy}`,
            'opacity:0', 'transform:scale(0.97)',
            'transition:opacity 0.15s ease-out, transform 0.15s ease-out'
        ].join(';');

        const title = document.createElement('div');
        title.textContent = titleText;
        title.style.cssText = 'font-weight:bold;margin-bottom:10px;font-size:15px;';
        panel.appendChild(title);

        let focusIndex = -1;
        const cleanups = [];

        const close = (skipOnClose) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            modalOpen = false;
            cleanups.forEach(fn => fn());
            if (onClose && !skipOnClose) onClose();
        };

        function getFocusables() {
            return Array.from(panel.querySelectorAll('button, input'));
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

        const onKey = (e) => {
            if (e.key === 'Escape') { close(); return; }
            if (matchesHotkey(e)) { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
            const items = getFocusables();
            if (items.length === 0) return;

            const activeIsInput = items[focusIndex]?.tagName === 'INPUT';

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocus(focusIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocus(focusIndex === -1 ? -1 : focusIndex - 1);
            } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < items.length) {
                if (activeIsInput) return; // let input handle Enter natively
                e.preventDefault();
                items[focusIndex].click();
            }
        };
        document.addEventListener('keydown', onKey);
        buildContent(panel, close, cleanups);

        function clearFocusOutline() {
            focusIndex = -1;
            getFocusables().forEach(el => {
                el.style.outline = 'none';
                el.style.outlineOffset = '';
            });
        }

        panel.addEventListener('mousedown', clearFocusOutline);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.appendChild(panel);
        document.documentElement.appendChild(overlay);
        modalOpen = true;
        requestAnimationFrame(() => {
            panel.style.opacity = '1';
            panel.style.transform = 'scale(1)';
        });
    }

    function makeOptionBtn(label, isActive, onClick, opts) {
        const btn = document.createElement('button');
        btn.style.cssText = [
            'display:block', 'width:100%', 'padding:8px 12px',
            'margin:4px 0', 'border:none', 'border-radius:6px',
            'cursor:pointer', 'font:14px/1.4 system-ui,sans-serif',
            'text-align:left',
            isActive ? `background:${T.accent};color:${T.textLight}` : `background:${T.borderMid};color:${T.text}`
        ].join(';');

        if (opts && (opts.subtitle || opts.value)) {
            const top = document.createElement('div');
            top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;
            top.appendChild(labelSpan);
            if (opts.value) {
                const val = document.createElement('span');
                val.textContent = opts.value;
                val.style.cssText = `color:${T.textDim};font-size:12px;margin-left:12px;`;
                top.appendChild(val);
            }
            btn.appendChild(top);
            if (opts.subtitle) {
                const sub = document.createElement('div');
                sub.textContent = opts.subtitle;
                sub.style.cssText = `color:${T.textDim};font-size:11px;margin-top:2px;`;
                btn.appendChild(sub);
            }
        } else {
            if (isActive) {
                const labelSpan = document.createElement('span');
                labelSpan.textContent = label;
                btn.appendChild(labelSpan);
                const check = document.createElement('span');
                check.textContent = ' ✓';
                check.style.cssText = 'opacity:0.7;';
                btn.appendChild(check);
            } else {
                btn.textContent = label;
            }
        }

        const baseBg = isActive ? T.accent : (opts && opts.bg) || T.borderMid;
        const hoverBg = isActive ? T.accent : (opts && opts.hoverBg) || T.border;
        btn.style.background = baseBg;
        if (opts && opts.color) btn.style.color = opts.color;

        btn.addEventListener('mouseenter', () => {
            if (!isActive) btn.style.background = hoverBg;
        });
        btn.addEventListener('mouseleave', () => {
            if (!isActive) btn.style.background = baseBg;
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    function formatSeconds(s) {
        if (s < 60) return `${s} seconds`;
        if (s < 3600) return s % 60 === 0 ? `${s / 60} minute${s / 60 > 1 ? 's' : ''}` : `${Math.floor(s / 60)}m ${s % 60}s`;
        return `${s / 3600} hour${s / 3600 > 1 ? 's' : ''}`;
    }

    const CORNER_LABELS = {
        'top-left': '↖ Top Left',
        'top-center': '↑ Top Center',
        'top-right': '↗ Top Right',
        'bottom-left': '↙ Bottom Left',
        'bottom-center': '↓ Bottom Center',
        'bottom-right': '↘ Bottom Right'
    };

    // --- Sub-modal Chrome Helper ---

    function addSubModalChrome(panel, opts) {
        const titleEl = panel.firstElementChild;

        if (opts.onBack) {
            const backBtn = document.createElement('button');
            backBtn.textContent = '← Back';
            backBtn.style.cssText = [
                'background:none', 'border:none', `color:${T.textFaint}`, 'cursor:pointer',
                'font:12px system-ui,sans-serif', 'padding:0 0 4px 0', 'margin:0',
                'display:block'
            ].join(';');
            backBtn.addEventListener('mouseenter', () => { backBtn.style.color = T.textMuted; });
            backBtn.addEventListener('mouseleave', () => { backBtn.style.color = T.textFaint; });
            backBtn.addEventListener('click', opts.onBack);
            panel.insertBefore(backBtn, titleEl);
        }

        if (opts.subtitle) {
            const sub = document.createElement('div');
            sub.textContent = opts.subtitle;
            sub.style.cssText = `color:${T.textDim};font-size:12px;margin:-6px 0 10px 0;`;
            titleEl.insertAdjacentElement('afterend', sub);
        }

        return {
            addFooter: (text) => {
                const footer = document.createElement('div');
                footer.textContent = text || 'Press Esc to go back';
                footer.style.cssText = `margin-top:12px;padding-top:8px;border-top:1px solid ${T.borderMid};text-align:center;font-size:11px;color:${T.borderLight};`;
                panel.appendChild(footer);
            }
        };
    }

    // --- Menu Commands ---

    function openFontSizePicker(returnTo) {
        const current = GM_getValue(STORAGE_KEY_FONT_SIZE, 'medium');
        const options = [
            { key: 'small', label: 'Small' },
            { key: 'medium', label: 'Medium' },
            { key: 'large', label: 'Large' },
            { key: 'extra-large', label: 'Extra Large' }
        ];
        openModal('auto-refresh-fontsize-picker', 'Badge Font Size', (panel, close) => {
            const chrome = addSubModalChrome(panel, {
                subtitle: 'Size of the countdown badge text',
                onBack: () => { close(); }
            });
            options.forEach(({ key, label }) => {
                const btn = makeOptionBtn(label, key === current, () => {
                    GM_setValue(STORAGE_KEY_FONT_SIZE, key);
                    applyFontSize();
                    close();
                    showToast(`Font size set to ${label}`);
                });
                const preview = document.createElement('div');
                preview.textContent = '↻ 30s';
                preview.style.cssText = `font:bold ${FONT_SIZES[key]} monospace;color:${T.ok};margin-top:4px;opacity:0.6;`;
                btn.appendChild(preview);
                panel.appendChild(btn);
            });
            chrome.addFooter();
        }, returnTo);
    }

    function openPositionPicker(returnTo) {
        const current = GM_getValue(STORAGE_KEY_CORNER, 'bottom-right');
        const layout = [
            ['top-left', 'top-center', 'top-right'],
            ['bottom-left', 'bottom-center', 'bottom-right']
        ];
        openModal('auto-refresh-picker', 'Badge Position', (panel, close) => {
            const chrome = addSubModalChrome(panel, {
                subtitle: 'Where the countdown timer appears',
                onBack: () => { close(); }
            });
            const grid = document.createElement('div');
            grid.style.cssText = [
                'display:grid',
                'grid-template-columns:1fr 1fr 1fr',
                'gap:8px',
                'min-width:280px',
                `background:${T.bgDark}`,
                `border:1px solid ${T.border}`,
                'border-radius:8px',
                'padding:12px'
            ].join(';');

            layout.flat().forEach(choice => {
                const btn = makeOptionBtn(CORNER_LABELS[choice], choice === current, () => {
                    GM_setValue(STORAGE_KEY_CORNER, choice);
                    applyCorner();
                    close();
                    showToast(`Badge position set to ${CORNER_LABELS[choice]}`);
                });
                btn.style.cssText += ';text-align:center;display:flex;align-items:center;justify-content:center;font-size:12px;margin:0;';
                grid.appendChild(btn);
            });

            panel.appendChild(grid);
            chrome.addFooter();
        }, returnTo);
    }

    function openIntervalPicker(returnTo) {
        const current = getInterval();
        const quickPresets = [5, 10, 15, 30];
        const extendedPresets = [60, 120, 300, 600];

        openModal('auto-refresh-interval-picker', 'Refresh Interval', (panel, close) => {
            const chrome = addSubModalChrome(panel, {
                subtitle: 'How often the page reloads',
                onBack: () => { close(); }
            });

            function addGroup(label, presets) {
                const hdr = document.createElement('div');
                hdr.textContent = label;
                hdr.style.cssText = `font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${T.textFaint};margin:8px 0 4px 4px;`;
                panel.appendChild(hdr);
                presets.forEach(seconds => {
                    panel.appendChild(makeOptionBtn(
                        formatSeconds(seconds),
                        seconds === current,
                        () => {
                            GM_setValue(STORAGE_KEY_INTERVAL, seconds);
                            if (isEnabled()) startRefresh();
                            close();
                            showToast(`Refresh interval set to ${formatSeconds(seconds)}`);
                        }
                    ));
                });
            }

            addGroup('Seconds', quickPresets);
            addGroup('Minutes', extendedPresets);

            const customHdr = document.createElement('div');
            customHdr.textContent = 'Custom';
            customHdr.style.cssText = `font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${T.textFaint};margin:12px 0 4px 4px;`;
            panel.appendChild(customHdr);

            const customRow = document.createElement('div');
            customRow.style.cssText = 'display:flex;gap:6px;';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.max = '86400';
            input.placeholder = 'Seconds (1\u201386400)';
            input.value = [...quickPresets, ...extendedPresets].includes(current) ? '' : current;
            input.style.cssText = [
                'flex:1', 'padding:8px 10px', `border:1px solid ${T.borderLight}`, 'border-radius:6px',
                `background:${T.bgLight}`, `color:${T.text}`, 'font:14px system-ui,sans-serif',
                'outline:none', 'transition:border-color .2s'
            ].join(';');
            input.addEventListener('focus', () => { input.style.borderColor = T.accent; });
            input.addEventListener('blur', () => { input.style.borderColor = T.borderLight; });

            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Set';
            applyBtn.style.cssText = [
                'padding:8px 14px', 'border:none', 'border-radius:6px',
                `background:${T.accent}`, `color:${T.textLight}`, 'cursor:pointer',
                'font:14px system-ui,sans-serif', 'transition:background .15s'
            ].join(';');
            applyBtn.addEventListener('mouseenter', () => { applyBtn.style.background = T.accentHover; });
            applyBtn.addEventListener('mouseleave', () => { applyBtn.style.background = T.accent; });
            applyBtn.addEventListener('click', () => {
                const value = parseInt(input.value, 10);
                if (isNaN(value) || value < 1 || value > 86400) {
                    input.style.borderColor = T.err;
                    return;
                }
                GM_setValue(STORAGE_KEY_INTERVAL, value);
                if (isEnabled()) startRefresh();
                close();
                showToast(`Refresh interval set to ${formatSeconds(value)}`);
            });

            customRow.appendChild(input);
            customRow.appendChild(applyBtn);
            panel.appendChild(customRow);
            chrome.addFooter();
        }, returnTo);
    }

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

    const DEFAULT_HOTKEY = 'Alt+Shift+R';

    function openHotkeyPicker(returnTo) {
        openModal('auto-refresh-hotkey-picker', 'Keyboard Shortcut', (panel, close, cleanups) => {
            panel.style.minWidth = '320px';
            const chrome = addSubModalChrome(panel, {
                subtitle: 'Press a key combination with at least one modifier',
                onBack: () => { close(); }
            });

            const current = GM_getValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);

            // Current shortcut as styled kbd elements
            const currentRow = document.createElement('div');
            currentRow.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
            const currentLabel = document.createElement('span');
            currentLabel.textContent = 'Current:';
            currentLabel.style.cssText = `color:${T.textMuted};font-size:13px;`;
            currentRow.appendChild(currentLabel);
            current.split('+').forEach(key => {
                const kbd = document.createElement('kbd');
                kbd.textContent = key;
                kbd.style.cssText = [
                    'display:inline-block', 'padding:3px 8px',
                    `background:${T.bgMid}`, `border:1px solid ${T.borderLight}`,
                    'border-radius:5px', 'font:bold 13px monospace',
                    `color:${T.textLight}`, `box-shadow:0 2px 0 ${T.bgDarker}`
                ].join(';');
                currentRow.appendChild(kbd);
            });
            panel.appendChild(currentRow);

            // State label
            const stateLabel = document.createElement('div');
            stateLabel.style.cssText = `font-size:11px;color:${T.textFaint};margin-bottom:4px;text-align:center;min-height:16px;`;
            panel.appendChild(stateLabel);

            const display = document.createElement('div');
            display.style.cssText = [
                'padding:20px', `background:${T.bgDark}`, `border:2px dashed ${T.borderLight}`,
                'border-radius:8px', 'text-align:center',
                'font:bold 16px monospace', 'margin-bottom:8px',
                'min-height:60px', 'min-width:280px',
                'display:flex', 'align-items:center',
                'justify-content:center', 'gap:6px', 'flex-wrap:wrap',
                `color:${T.textDim}`, 'transition:border-color .2s, background .3s'
            ].join(';');
            display.textContent = 'Press your desired key combination...';
            panel.appendChild(display);

            function renderKeys(parts, state) {
                // state: 'live', 'confirmed', 'error'
                display.innerHTML = '';
                const isConfirmed = state === 'confirmed';
                const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
                parts.forEach(key => {
                    const isModifier = modifiers.includes(key);
                    const kbd = document.createElement('kbd');
                    kbd.textContent = key;
                    const color = isConfirmed ? T.ok
                        : isModifier ? T.textLight
                        : `${T.cyan}`;
                    const borderColor = isConfirmed ? T.okBright
                        : isModifier ? T.borderLight
                        : `${T.accent}`;
                    kbd.style.cssText = [
                        'display:inline-block', 'padding:4px 10px',
                        `background:${T.bgMid}`, `border:1px solid ${borderColor}`,
                        'border-radius:5px', 'font:bold 14px monospace',
                        `color:${color}`,
                        `box-shadow:0 2px 0 ${T.bgDarker}`,
                        'min-width:28px', 'text-align:center'
                    ].join(';');
                    display.appendChild(kbd);
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

                if (!hasModifier) {
                    renderError('At least one modifier key required');
                    return;
                }

                liveParts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                const combo = liveParts.join('+');

                if (BROWSER_RESERVED.has(combo)) {
                    renderError(`${combo} is reserved by the browser`);
                    return;
                }

                GM_setValue(STORAGE_KEY_HOTKEY, combo);
                document.removeEventListener('keydown', onCapture, true);
                document.removeEventListener('keyup', onKeyUp, true);

                // Confirmation state: checkmark + green
                stateLabel.textContent = '✓ Shortcut saved';
                stateLabel.style.color = T.ok;
                renderKeys(liveParts, 'confirmed');
                display.style.background = T.okFaint;
                showToast(`Shortcut set to ${combo}`);
                setTimeout(() => close(), 1200);
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

            cleanups.push(() => {
                document.removeEventListener('keydown', onCapture, true);
                document.removeEventListener('keyup', onKeyUp, true);
            });

            // Reset to default
            if (current !== DEFAULT_HOTKEY) {
                const resetBtn = document.createElement('button');
                resetBtn.textContent = 'Reset to default (Alt+Shift+R)';
                resetBtn.style.cssText = [
                    'background:none', 'border:none', `color:${T.textFaint}`,
                    'cursor:pointer', 'font:12px system-ui,sans-serif',
                    'padding:4px 0', 'margin:0', 'display:block',
                    'text-align:center', 'width:100%'
                ].join(';');
                resetBtn.addEventListener('mouseenter', () => { resetBtn.style.color = T.textMuted; });
                resetBtn.addEventListener('mouseleave', () => { resetBtn.style.color = T.textFaint; });
                resetBtn.addEventListener('click', () => {
                    GM_setValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);
                    document.removeEventListener('keydown', onCapture, true);
                    document.removeEventListener('keyup', onKeyUp, true);
                    stateLabel.textContent = '✓ Reset to default';
                    stateLabel.style.color = T.ok;
                    renderKeys(DEFAULT_HOTKEY.split('+'), 'confirmed');
                    display.style.background = T.okFaint;
                    showToast(`Shortcut reset to ${DEFAULT_HOTKEY}`);
                    setTimeout(() => close(), 1200);
                });
                panel.appendChild(resetBtn);
            }

            chrome.addFooter();
        }, returnTo);
    }

    // --- Watch for Changes ---

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
        stopAlert();
        playBeep();
        alertIntervalId = setInterval(playBeep, 2000);
    }

    function stopAlert() {
        if (alertIntervalId !== null) {
            clearInterval(alertIntervalId);
            alertIntervalId = null;
        }
    }

    function getUniqueSelector(el) {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        while (el && el !== document.documentElement) {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                parts.unshift(`#${CSS.escape(el.id)}`);
                break;
            }
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(Boolean).map(c => `.${CSS.escape(c)}`).join('');
                if (classes) selector += classes;
            }
            const parent = el.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
                if (siblings.length > 1) {
                    const index = siblings.indexOf(el) + 1;
                    selector += `:nth-of-type(${index})`;
                }
            }
            parts.unshift(selector);
            el = parent;
        }
        return parts.join(' > ');
    }

    function startElementPicker() {
        let highlight = document.createElement('div');
        highlight.style.cssText = [
            'position:absolute', 'z-index:2147483646', 'pointer-events:none',
            `border:2px solid ${T.accent}`, `background:${T.accentFaint}`,
            'border-radius:3px', 'transition:all .05s'
        ].join(';');
        document.documentElement.appendChild(highlight);

        const label = document.createElement('div');
        label.style.cssText = [
            'position:fixed', 'bottom:12px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:2147483647', `background:${T.bg}`, `color:${T.text}`,
            'font:13px/1 system-ui,sans-serif', 'padding:8px 16px',
            'border-radius:8px', `box-shadow:0 4px 16px ${T.shadowHeavy}`
        ].join(';');
        label.textContent = 'Click an element to watch for changes (Esc to cancel)';
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
            highlight.remove();
            label.remove();
        }

        function onClick(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
            const el = lastTarget || e.target;
            const selector = getUniqueSelector(el);

            openModal('auto-refresh-watch-mode', 'What to watch?', (panel, close) => {
                const chrome = addSubModalChrome(panel, {
                    subtitle: 'Choose what changes to monitor'
                });

                // Preview of selected element
                const preview = document.createElement('div');
                const shortSelector = selector.length > 45 ? selector.slice(0, 45) + '…' : selector;
                preview.style.cssText = [
                    `background:${T.bgDark}`, `border:1px solid ${T.border}`, 'border-radius:6px',
                    'padding:6px 10px', 'font:12px monospace', `color:${T.textMuted}`,
                    'margin-bottom:10px', 'overflow:hidden', 'text-overflow:ellipsis',
                    'white-space:nowrap'
                ].join(';');
                preview.textContent = shortSelector;
                preview.title = selector;
                panel.appendChild(preview);

                // Large element warning
                const contentLength = el.innerText.trim().length;
                if (contentLength > 1000) {
                    const warning = document.createElement('div');
                    warning.style.cssText = [
                        `background:${T.warnBg}`, `border:1px solid ${T.warnBorder}`, 'border-radius:6px',
                        'padding:6px 10px', 'font-size:11px', `color:${T.warn}`,
                        'margin-bottom:10px'
                    ].join(';');
                    warning.textContent = `\u26a0 This element has ${contentLength.toLocaleString()} chars of text. Consider picking a more specific child element for cleaner diffs.`;
                    panel.appendChild(warning);
                }

                const modeDescriptions = {
                    content: 'Alert when text inside the element changes',
                    style: 'Alert when CSS properties change',
                    both: 'Monitor both text and styling'
                };
                const modes = [
                    { key: 'content', label: '📝 Text Content' },
                    { key: 'style', label: '🎨 Styling' },
                    { key: 'both', label: '📝🎨 Both' }
                ];
                modes.forEach(({ key, label }) => {
                    const btn = makeOptionBtn(label, false, () => {
                        const watch = { selector, mode: key, content: '', styles: '', snapshotTime: Date.now() };
                        if (key === 'content' || key === 'both') {
                            watch.content = el.innerText.trim();
                        }
                        if (key === 'style' || key === 'both') {
                            watch.styles = captureStyles(el);
                        }
                        addWatch(watch);
                        close();
                        const count = getWatches().length;
                        showToast(`Watching ${key}: ${selector.length > 40 ? selector.slice(0, 40) + '…' : selector} (${count} total)`);
                    }, { subtitle: modeDescriptions[key] });
                    btn.style.borderLeft = `3px solid ${MODE_COLORS[key]}`;
                    panel.appendChild(btn);
                });

                // Re-pick option
                const repickBtn = document.createElement('button');
                repickBtn.textContent = '← Pick again';
                repickBtn.style.cssText = [
                    'background:none', 'border:none', `color:${T.textFaint}`, 'cursor:pointer',
                    'font:12px system-ui,sans-serif', 'padding:8px 0 0',
                    'margin:0', 'display:block'
                ].join(';');
                repickBtn.addEventListener('mouseenter', () => { repickBtn.style.color = T.textMuted; });
                repickBtn.addEventListener('mouseleave', () => { repickBtn.style.color = T.textFaint; });
                repickBtn.addEventListener('click', () => {
                    close(true);
                    startElementPicker();
                });
                panel.appendChild(repickBtn);

                chrome.addFooter('Press Esc to cancel');
            }, resumeRefresh);
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
    }

    function clearAllWatches() {
        setWatches([]);
        GM_setValue(STORAGE_KEY_WATCH_ENABLED, false);
        stopAlert();
        showToast('All watches cleared');
    }

    function openClearWatchPicker(returnTo) {
        const watches = getWatches();
        if (watches.length === 0) {
            showToast('No watches to clear');
            return;
        }
        const modeTextLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

        openModal('auto-refresh-clear-watch', 'Remove Watch', (panel, close) => {
            const chrome = addSubModalChrome(panel, {
                subtitle: 'Select a watch to remove',
                onBack: () => { close(); }
            });

            watches.forEach((w, i) => {
                const short = w.selector.length > 30 ? w.selector.slice(0, 30) + '…' : w.selector;
                const status = getWatchStatus(w);
                const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;

                const btn = document.createElement('button');
                btn.style.cssText = [
                    'display:flex', 'align-items:center', 'gap:8px',
                    'width:100%', 'padding:8px 12px', 'margin:4px 0',
                    'border:none', 'border-radius:6px', 'cursor:pointer',
                    'font:14px/1.4 system-ui,sans-serif', 'text-align:left',
                    `background:${T.borderMid}`, `color:${T.text}`, 'transition:background .15s'
                ].join(';');
                btn.addEventListener('mouseenter', () => { btn.style.background = T.border; });
                btn.addEventListener('mouseleave', () => { btn.style.background = T.borderMid; });

                const dot = document.createElement('span');
                dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;`;
                dot.title = status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes';
                btn.appendChild(dot);

                const info = document.createElement('div');
                info.style.cssText = 'flex:1;min-width:0;';
                const selectorLine = document.createElement('div');
                selectorLine.textContent = short;
                selectorLine.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                info.appendChild(selectorLine);
                const modeLine = document.createElement('div');
                modeLine.textContent = modeTextLabels[w.mode] || w.mode;
                modeLine.style.cssText = `font-size:11px;color:${T.textDim};margin-top:1px;`;
                info.appendChild(modeLine);
                btn.appendChild(info);

                btn.addEventListener('click', () => {
                    removeWatch(i);
                    const remaining = getWatches().length;
                    if (remaining === 0) {
                        close();
                        showToast('All watches removed');
                    } else {
                        close();
                        showToast(`Watch removed (${remaining} remaining)`);
                        if (returnTo) returnTo();
                    }
                });
                panel.appendChild(btn);
            });

            if (watches.length > 1) {
                const sep = document.createElement('div');
                sep.style.cssText = `border-top:1px solid ${T.borderMid};margin:10px 0 6px;`;
                panel.appendChild(sep);

                const clearBtn = document.createElement('button');
                clearBtn.style.cssText = [
                    'display:block', 'width:100%', 'padding:8px 12px',
                    'margin:4px 0', 'border:none', 'border-radius:6px',
                    'cursor:pointer', 'font:14px/1.4 system-ui,sans-serif',
                    'text-align:left', `background:${T.errBg}`, `color:${T.errLight}`,
                    'transition:background .15s'
                ].join(';');
                clearBtn.textContent = '❌ Clear All';
                clearBtn.addEventListener('mouseenter', () => { clearBtn.style.background = T.errBgHover; });
                clearBtn.addEventListener('mouseleave', () => { clearBtn.style.background = T.errBg; });

                let confirmPending = false;
                clearBtn.addEventListener('click', () => {
                    if (!confirmPending) {
                        confirmPending = true;
                        clearBtn.textContent = '❌ Click again to confirm';
                        clearBtn.style.background = T.errBgDark;
                        setTimeout(() => {
                            confirmPending = false;
                            clearBtn.textContent = '❌ Clear All';
                            clearBtn.style.background = T.errBg;
                        }, 3000);
                        return;
                    }
                    clearAllWatches();
                    close();
                });
                panel.appendChild(clearBtn);
            }

            chrome.addFooter();
        }, returnTo);
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
                if (w.content !== current) {
                    watches[i] = { ...w, content: current };
                    changes.push('content');
                }
            }

            if (w.mode === 'style' || w.mode === 'both') {
                const currentStyles = captureStyles(el);
                if (w.styles !== currentStyles) {
                    watches[i] = { ...w, styles: currentStyles };
                    changes.push('styling');
                }
            }

            if (changes.length > 0) {
                const short = w.selector.length > 25 ? w.selector.slice(0, 25) + '…' : w.selector;
                allChanges.push(`${short} (${changes.join(' & ')})`);
            }
        }

        setWatches(watches);

        if (missing.length > 0) {
            stopRefresh();
            startAlert();
            showToast(`${missing.length} watched element${missing.length > 1 ? 's' : ''} not found!`);
            return;
        }

        if (allChanges.length > 0) {
            stopRefresh();
            startAlert();
            showToast(`${allChanges.length} watch${allChanges.length > 1 ? 'es' : ''} changed!`);
        }
    }

    function getWatchStatus(w) {
        // Returns: 'ok', 'changed', 'missing'
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

    function timeAgo(ts) {
        if (!ts) return 'unknown';
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function openWatchInspector(returnTo, startIndex) {
        let watches = getWatches();
        let current = startIndex || 0;
        if (current >= watches.length) current = 0;

        openModal('auto-refresh-watch-inspector', `Watch Inspector`, (panel, close) => {
            const chrome = addSubModalChrome(panel, {
                subtitle: 'View stored vs live content for each watch',
                onBack: () => { close(); }
            });

            // Collapsible section helper
            function addCollapsible(container, labelText, defaultOpen) {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'margin-top:10px;';

                const toggle = document.createElement('button');
                let open = defaultOpen !== false;
                toggle.style.cssText = [
                    'background:none', 'border:none', `color:${T.textMuted}`, 'cursor:pointer',
                    'font-size:12px', 'padding:0', 'margin-bottom:4px', 'display:flex',
                    'align-items:center', 'gap:4px'
                ].join(';');
                const arrow = document.createElement('span');
                arrow.style.cssText = 'font-size:10px;transition:transform .15s;display:inline-block;';
                const label = document.createElement('span');
                label.textContent = labelText;
                toggle.appendChild(arrow);
                toggle.appendChild(label);

                const body = document.createElement('div');

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
                const box = document.createElement('div');
                box.style.cssText = [
                    `background:${T.bgDark}`, `border:1px solid ${T.border}`, 'border-radius:6px',
                    'padding:8px 10px', 'max-height:120px', 'overflow-y:auto',
                    'word-break:break-all', 'font-size:13px',
                    mono ? 'font-family:monospace' : '',
                    value ? `color:${T.text}` : `color:${T.textFaint}`
                ].join(';');
                box.textContent = value || '(empty)';
                container.appendChild(box);
                return box;
            }

            if (watches.length === 0) {
                const msg = document.createElement('div');
                msg.textContent = 'No watches configured';
                msg.style.cssText = `color:${T.textFaint};font-size:13px;padding:8px 0;`;
                panel.appendChild(msg);
                panel.style.minWidth = '340px';
                return;
            }

            const modeLabels = { content: '📝 Text Content', style: '🎨 Styling', both: '📝🎨 Both' };

            // Layout: sidebar + detail
            const layout = document.createElement('div');
            layout.style.cssText = 'display:flex;gap:12px;';

            // Sidebar
            const sidebar = document.createElement('div');
            sidebar.style.cssText = [
                'flex:0 0 25%', 'min-width:130px',
                `border-right:1px solid ${T.borderMid}`, 'padding-right:10px',
                'max-height:60vh', 'overflow-y:auto'
            ].join(';');

            const sidebarItems = [];

            function buildSidebar() {
                sidebar.innerHTML = '';
                sidebarItems.length = 0;
                watches.forEach((w, i) => {
                    const item = document.createElement('button');
                    item.style.cssText = [
                        'display:flex', 'align-items:center', 'gap:6px',
                        'width:100%', 'border:none',
                        'padding:6px 8px', 'border-radius:6px', 'cursor:pointer',
                        'font-size:12px', 'margin-bottom:4px',
                        'transition:background .1s', 'text-align:left'
                    ].join(';');

                    // Status dot
                    const status = getWatchStatus(w);
                    const dotColor = status === 'changed' ? T.err : status === 'missing' ? T.textFaint : T.ok;
                    const dot = document.createElement('span');
                    dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;`;
                    dot.title = status === 'changed' ? 'Changed' : status === 'missing' ? 'Not found' : 'No changes';
                    item.appendChild(dot);

                    const text = document.createElement('span');
                    text.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                    const short = w.selector.length > 18 ? w.selector.slice(-18) : w.selector;
                    text.textContent = short;
                    item.appendChild(text);

                    item.addEventListener('mouseenter', () => {
                        if (i !== current) item.style.background = T.bgLight;
                    });
                    item.addEventListener('mouseleave', () => {
                        if (i !== current) item.style.background = 'transparent';
                    });
                    item.addEventListener('click', () => {
                        current = i;
                        renderDetail();
                        updateSidebarSelection();
                    });
                    sidebar.appendChild(item);
                    sidebarItems.push(item);
                });
                updateSidebarSelection();
            }

            function updateSidebarSelection() {
                sidebarItems.forEach((el, i) => {
                    el.style.background = i === current ? T.accent : 'transparent';
                    el.style.color = i === current ? T.textLight : T.textSub;
                });
            }

            // Detail pane
            const detail = document.createElement('div');
            detail.style.cssText = [
                'flex:1', 'min-width:0',
                'max-height:60vh', 'overflow-y:auto'
            ].join(';');

            function renderDetail() {
                detail.innerHTML = '';
                const w = watches[current];

                // Header with mode badge
                const headerRow = document.createElement('div');
                headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

                const header = document.createElement('span');
                header.textContent = modeLabels[w.mode] || w.mode;
                header.style.cssText = `font-weight:bold;font-size:13px;color:${MODE_COLORS[w.mode] || T.cyan};`;
                headerRow.appendChild(header);

                // Toolbar strip
                const toolbar = document.createElement('div');
                toolbar.style.cssText = [
                    'display:flex', 'gap:0', `background:${T.bgLight}`,
                    'border-radius:6px', 'overflow:hidden', `border:1px solid ${T.border}`
                ].join(';');

                const refreshBtn = document.createElement('button');
                refreshBtn.innerHTML = '🔄 <span style="font-size:11px">Re-snapshot</span>';
                refreshBtn.title = 'Re-snapshot to current values';
                refreshBtn.style.cssText = [
                    'background:transparent', 'border:none', `border-right:1px solid ${T.border}`,
                    `color:${T.textSub}`, 'cursor:pointer', 'padding:4px 10px', 'font-size:13px',
                    'display:flex', 'align-items:center', 'gap:4px', 'transition:background .15s'
                ].join(';');
                refreshBtn.addEventListener('mouseenter', () => { refreshBtn.style.background = T.bgLighter; });
                refreshBtn.addEventListener('mouseleave', () => { refreshBtn.style.background = 'transparent'; });
                refreshBtn.addEventListener('click', () => {
                    const el = document.querySelector(w.selector);
                    if (!el) { showToast('Element not found'); return; }
                    if (w.mode === 'content' || w.mode === 'both') w.content = el.innerText.trim();
                    if (w.mode === 'style' || w.mode === 'both') w.styles = captureStyles(el);
                    w.snapshotTime = Date.now();
                    watches[current] = w;
                    setWatches(watches);
                    renderDetail();
                    buildSidebar();
                    showToast('Snapshot updated');
                });
                toolbar.appendChild(refreshBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '🗑 <span style="font-size:11px">Remove</span>';
                deleteBtn.title = 'Remove this watch';
                deleteBtn.style.cssText = [
                    'background:transparent', 'border:none',
                    `color:${T.err}`, 'cursor:pointer', 'padding:4px 10px', 'font-size:13px',
                    'display:flex', 'align-items:center', 'gap:4px', 'transition:background .15s, color .15s'
                ].join(';');
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = T.errBg;
                    deleteBtn.style.color = T.errLight;
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'transparent';
                    deleteBtn.style.color = T.err;
                });
                deleteBtn.addEventListener('click', () => {
                    removeWatch(current);
                    watches = getWatches();
                    if (watches.length === 0) {
                        close();
                        showToast('All watches removed');
                        return;
                    }
                    if (current >= watches.length) current = watches.length - 1;
                    buildSidebar();
                    renderDetail();
                    showToast('Watch removed');
                });
                toolbar.appendChild(deleteBtn);

                headerRow.appendChild(toolbar);
                detail.appendChild(headerRow);

                // Timestamp
                if (w.snapshotTime) {
                    const ts = document.createElement('div');
                    ts.textContent = `Snapshot: ${timeAgo(w.snapshotTime)}`;
                    ts.style.cssText = `color:${T.textFaint};font-size:11px;margin-bottom:6px;`;
                    detail.appendChild(ts);
                }

                // CSS Selector with copy button
                const selectorSection = addCollapsible(detail, 'CSS Selector', true);
                const selectorRow = document.createElement('div');
                selectorRow.style.cssText = 'display:flex;align-items:stretch;gap:0;';
                const selectorBox = document.createElement('div');
                selectorBox.textContent = w.selector;
                selectorBox.style.cssText = [
                    `background:${T.bgDark}`, `border:1px solid ${T.border}`, 'border-radius:6px 0 0 6px',
                    'padding:8px 10px', 'font:13px monospace', `color:${T.text}`,
                    'word-break:break-all', 'flex:1'
                ].join(';');
                selectorRow.appendChild(selectorBox);
                const copyBtn = document.createElement('button');
                copyBtn.textContent = '📋';
                copyBtn.title = 'Copy selector';
                copyBtn.style.cssText = [
                    `background:${T.bgMid}`, `border:1px solid ${T.border}`, 'border-left:none',
                    'border-radius:0 6px 6px 0', 'cursor:pointer', 'padding:8px 10px',
                    'font-size:13px', `color:${T.text}`
                ].join(';');
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(w.selector).then(
                        () => showToast('Selector copied'),
                        () => showToast('Copy failed')
                    );
                });
                selectorRow.appendChild(copyBtn);
                selectorSection.body.appendChild(selectorRow);

                const el = document.querySelector(w.selector);

                // Content section
                if (w.mode === 'content' || w.mode === 'both') {
                    const live = el ? el.innerText.trim() : null;
                    const changed = live !== null && live !== w.content;

                    const contentSection = addCollapsible(
                        detail,
                        'Content' + (changed ? ' ⚠ CHANGED' : live !== null ? ' ✓' : ''),
                        true
                    );
                    if (changed) {
                        contentSection.body.style.cssText = '';
                        const DIFF_LIMIT = 500;
                        const oldText = w.content || '(empty)';
                        const newText = live;
                        const isTruncated = oldText.length > DIFF_LIMIT || newText.length > DIFF_LIMIT;

                        // Inline diff view
                        const diffBox = document.createElement('div');
                        diffBox.style.cssText = [
                            `background:${T.bgDark}`, `border:1px solid ${T.err}`, 'border-radius:6px',
                            'padding:8px 10px', 'font-size:13px', 'word-break:break-all',
                            'max-height:200px', 'overflow-y:auto'
                        ].join(';');
                        const oldSpan = document.createElement('span');
                        oldSpan.textContent = isTruncated ? oldText.slice(0, DIFF_LIMIT) + '…' : oldText;
                        oldSpan.style.cssText = `color:${T.errLight};text-decoration:line-through;`;
                        const arrow = document.createElement('span');
                        arrow.textContent = ' → ';
                        arrow.style.cssText = `color:${T.textFaint};`;
                        const newSpan = document.createElement('span');
                        newSpan.textContent = isTruncated ? newText.slice(0, DIFF_LIMIT) + '…' : newText;
                        newSpan.style.cssText = `color:${T.okText};`;
                        diffBox.appendChild(oldSpan);
                        diffBox.appendChild(arrow);
                        diffBox.appendChild(newSpan);
                        contentSection.body.appendChild(diffBox);

                        if (isTruncated) {
                            const expandBtn = document.createElement('button');
                            expandBtn.textContent = `Show full diff (${oldText.length + newText.length} chars)`;
                            expandBtn.style.cssText = [
                                'background:none', 'border:none', `color:${T.cyan}`, 'cursor:pointer',
                                'font:11px system-ui,sans-serif', 'padding:4px 0', 'margin-top:4px'
                            ].join(';');
                            expandBtn.addEventListener('click', () => {
                                oldSpan.textContent = oldText;
                                newSpan.textContent = newText;
                                diffBox.style.maxHeight = 'none';
                                expandBtn.remove();
                            });
                            contentSection.body.appendChild(expandBtn);
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
                        const styleSection = addCollapsible(
                            detail,
                            changes.length > 0 ? `Style Changes (${changes.length}) ⚠` : 'Styling ✓',
                            true
                        );
                        if (changes.length > 0) {
                            // Compact chip layout
                            const chipContainer = document.createElement('div');
                            chipContainer.style.cssText = [
                                'display:flex', 'flex-wrap:wrap', 'gap:4px'
                            ].join(';');
                            changes.forEach(({ prop, from, to }) => {
                                const chip = document.createElement('span');
                                chip.style.cssText = [
                                    `background:${T.errPanel}`, `border:1px solid ${T.err}`, 'border-radius:4px',
                                    'padding:3px 8px', 'font:11px monospace', `color:${T.text}`,
                                    'white-space:nowrap'
                                ].join(';');
                                chip.innerHTML = `<span style="color:${T.textMuted}">${prop}:</span> <span style="color:${T.errLight};text-decoration:line-through">${from}</span> → <span style="color:${T.okText}">${to}</span>`;
                                chipContainer.appendChild(chip);
                            });
                            styleSection.body.appendChild(chipContainer);
                        } else {
                            const ok = document.createElement('div');
                            ok.textContent = 'No style changes detected';
                            ok.style.cssText = `color:${T.textFaint};font-size:12px;`;
                            styleSection.body.appendChild(ok);
                        }
                    } else if (w.styles) {
                        const styleSection = addCollapsible(detail, 'Stored Styles', false);
                        const info = document.createElement('div');
                        info.textContent = `${WATCHED_STYLE_PROPS.length} properties captured`;
                        info.style.cssText = `color:${T.textFaint};font-size:12px;`;
                        styleSection.body.appendChild(info);
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

            panel.style.minWidth = '500px';
            panel.style.maxWidth = '650px';
            chrome.addFooter();
        }, returnTo);
    }

    function openSettingsMenu() {
        const watches = getWatches();
        const watchCount = watches.length;
        const currentHotkey = GM_getValue(STORAGE_KEY_HOTKEY, DEFAULT_HOTKEY);

        openModal('auto-refresh-settings', 'Auto Refresh Settings', (panel, close) => {
            panel.style.minWidth = '320px';

            // --- Status indicator ---
            const statusBar = document.createElement('div');
            statusBar.style.cssText = [
                'display:flex', 'align-items:center', 'gap:8px',
                'padding:8px 12px', 'border-radius:6px', 'margin-bottom:10px',
                `background:${T.bgDark}`, `border:1px solid ${T.borderMid}`
            ].join(';');

            const dot = document.createElement('span');
            dot.style.cssText = [
                'width:8px', 'height:8px', 'border-radius:50%', 'display:inline-block',
                isEnabled() ? `background:${T.ok};box-shadow:0 0 6px ${T.ok}` : `background:${T.textFaint}`
            ].join(';');
            statusBar.appendChild(dot);

            const statusText = document.createElement('span');
            statusText.style.cssText = `font-size:13px;color:${T.textMuted};flex:1;`;
            statusText.textContent = isEnabled()
                ? `Active · refreshing every ${formatSeconds(getInterval())}` 
                : 'Inactive';
            statusBar.appendChild(statusText);

            panel.appendChild(statusBar);

            // --- Toggle: Auto-Refresh ---
            const toggleRow = document.createElement('button');
            toggleRow.style.cssText = [
                'display:flex', 'align-items:center', 'justify-content:space-between',
                'width:100%', 'padding:10px 12px', 'border:none', 'border-radius:6px',
                'margin-bottom:2px', `background:${T.borderMid}`, 'cursor:pointer',
                'font:inherit', 'color:inherit', 'text-align:left'
            ].join(';');

            const toggleLabel = document.createElement('div');
            const toggleTitle = document.createElement('div');
            toggleTitle.textContent = 'Auto-Refresh';
            toggleTitle.style.cssText = `font-size:14px;color:${T.text};`;
            const toggleSub = document.createElement('div');
            toggleSub.textContent = 'Reload the page on a timer';
            toggleSub.style.cssText = `font-size:11px;color:${T.textDim};margin-top:1px;`;
            toggleLabel.appendChild(toggleTitle);
            toggleLabel.appendChild(toggleSub);

            const toggle = document.createElement('div');
            const trackW = 40, trackH = 22, thumbSize = 18;
            toggle.style.cssText = [
                `width:${trackW}px`, `height:${trackH}px`, 'border-radius:11px',
                'position:relative', 'transition:background .2s', 'flex-shrink:0',
                isEnabled() ? `background:${T.accent}` : `background:${T.borderLight}`
            ].join(';');
            const thumb = document.createElement('div');
            thumb.style.cssText = [
                `width:${thumbSize}px`, `height:${thumbSize}px`, 'border-radius:50%',
                `background:${T.textLight}`, 'position:absolute', 'top:2px',
                'transition:left .2s', `box-shadow:0 1px 3px ${T.shadow}`,
                isEnabled() ? `left:${trackW - thumbSize - 2}px` : 'left:2px'
            ].join(';');
            toggle.appendChild(thumb);

            function setToggleState(on) {
                toggle.style.background = on ? T.accent : T.borderLight;
                thumb.style.left = on ? `${trackW - thumbSize - 2}px` : '2px';
                dot.style.background = on ? T.ok : T.textFaint;
                dot.style.boxShadow = on ? `0 0 6px ${T.ok}` : 'none';
                statusText.textContent = on
                    ? `Active · refreshing every ${formatSeconds(getInterval())}`
                    : 'Inactive';
            }

            toggleRow.addEventListener('click', () => {
                if (isEnabled()) {
                    stopRefresh();
                    setToggleState(false);
                    showToast('Auto-refresh stopped');
                } else {
                    startRefresh();
                    setToggleState(true);
                    showToast(`Auto-refresh started: every ${formatSeconds(getInterval())}`);
                }
            });

            toggleRow.appendChild(toggleLabel);
            toggleRow.appendChild(toggle);
            panel.appendChild(toggleRow);

            // --- Section helper ---
            function addSection(title) {
                const hdr = document.createElement('div');
                hdr.textContent = title;
                hdr.style.cssText = [
                    'font-size:11px', 'font-weight:bold', 'text-transform:uppercase',
                    'letter-spacing:0.5px', `color:${T.textFaint}`, 'margin:12px 0 4px 4px'
                ].join(';');
                panel.appendChild(hdr);
            }

            // --- Refresh Settings ---
            addSection('Refresh');

            const currentCorner = GM_getValue(STORAGE_KEY_CORNER, 'bottom-right');
            const currentFontSize = GM_getValue(STORAGE_KEY_FONT_SIZE, 'medium');
            const cornerName = (CORNER_LABELS[currentCorner] || currentCorner).replace(/[↖↗↙↘↑↓]\s*/, '');
            const fontLabel = currentFontSize.charAt(0).toUpperCase() + currentFontSize.slice(1).replace('-', ' ');

            panel.appendChild(makeOptionBtn('⏱ Refresh Interval', false, () => {
                close(true); openIntervalPicker(openSettingsMenu);
            }, { value: formatSeconds(getInterval()), subtitle: 'How often the page reloads' }));

            panel.appendChild(makeOptionBtn('📍 Badge Position', false, () => {
                close(true); openPositionPicker(openSettingsMenu);
            }, { value: cornerName, subtitle: 'Where the countdown timer appears' }));

            panel.appendChild(makeOptionBtn('🔤 Badge Font Size', false, () => {
                close(true); openFontSizePicker(openSettingsMenu);
            }, { value: fontLabel, subtitle: 'Size of the countdown badge text' }));

            // --- General ---
            addSection('General');

            panel.appendChild(makeOptionBtn('⌨ Keyboard Shortcut', false, () => {
                close(true); openHotkeyPicker(openSettingsMenu);
            }, { value: currentHotkey, subtitle: 'Hotkey to open this menu' }));

            // --- Watches ---
            addSection(`Watches${watchCount > 0 ? ` (${watchCount})` : ''}`);

            panel.appendChild(makeOptionBtn('👁 Add Watch', false, () => {
                close(true);
                startElementPicker();
            }, { subtitle: 'Pick an element to monitor for changes' }));

            if (alertIntervalId !== null) {
                panel.appendChild(makeOptionBtn('🔕 Stop Alert', false, () => {
                    stopAlert();
                    showToast('Alert silenced');
                    close(true); openSettingsMenu();
                }, { subtitle: 'Silence the current change alert', bg: T.errBg, hoverBg: T.errBgHover, color: T.errLight }));
            }

            if (watchCount > 0) {
                panel.appendChild(makeOptionBtn(`🔍 Inspect Watches`, false, () => {
                    close(true); openWatchInspector(openSettingsMenu);
                }, { value: `${watchCount}`, subtitle: 'View stored vs live content for each watch' }));

                panel.appendChild(makeOptionBtn(`🗑 Remove Watches`, false, () => {
                    close(true); openClearWatchPicker(openSettingsMenu);
                }, { value: `${watchCount}`, subtitle: 'Remove individual or all watches' }));
            } else {
                const emptyHint = document.createElement('div');
                emptyHint.textContent = 'No watches configured yet';
                emptyHint.style.cssText = `color:${T.borderLight};font-size:12px;padding:4px 4px 0;`;
                panel.appendChild(emptyHint);
            }

            // --- Footer: hotkey reminder ---
            const footer = document.createElement('div');
            footer.style.cssText = [
                'margin-top:14px', 'padding-top:8px', `border-top:1px solid ${T.borderMid}`,
                'text-align:center', 'font-size:11px', `color:${T.borderLight}`
            ].join(';');
            footer.textContent = `Press ${currentHotkey} to open this menu · v${VERSION}`;
            panel.appendChild(footer);

        }, resumeRefresh);
        pauseRefresh();
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
        return e.ctrlKey === needCtrl
            && e.altKey === needAlt
            && e.shiftKey === needShift
            && e.metaKey === needMeta
            && pressedKey === key;
    }

    document.addEventListener('keydown', (e) => {
        if (matchesHotkey(e)) {
            e.preventDefault();
            e.stopPropagation();
            if (!modalOpen) {
                openSettingsMenu();
            }
        }
    });

    GM_registerMenuCommand('Open settings', openSettingsMenu);
    GM_registerMenuCommand('Set badge font size', openFontSizePicker);
    GM_registerMenuCommand('Set badge position', openPositionPicker);
    GM_registerMenuCommand('Set refresh interval', openIntervalPicker);
    GM_registerMenuCommand('Set keyboard shortcut', openHotkeyPicker);
    GM_registerMenuCommand('Watch element for changes', startElementPicker);
    GM_registerMenuCommand('Clear watch', openClearWatchPicker);

    GM_registerMenuCommand('Start auto-refresh', () => {
        startRefresh();
        showToast(`Auto-refresh started: every ${formatSeconds(getInterval())}`);
    });

    GM_registerMenuCommand('Stop auto-refresh', () => {
        stopRefresh();
        showToast('Auto-refresh stopped');
    });

    // Start refresh and check watched element after the page fully loads
    function onPageReady() {
        if (isEnabled()) startRefresh();
        checkForChanges();
    }

    if (document.readyState === 'complete') {
        onPageReady();
    } else {
        window.addEventListener('load', onPageReady, { once: true });
    }
})();
