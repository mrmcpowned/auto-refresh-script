# Feature Spec: Text-to-Speech Alerts

## Overview

Add an optional text-to-speech (TTS) alert mode that reads change notifications aloud using the Web Speech API. When a watched element changes, the system announces what changed in a synthesized voice instead of (or in addition to) the existing beep alert. This enables hands-free monitoring and improves accessibility for visually impaired users.

---

## Problem Statement

Currently, the only audible alert is a repeating 660Hz beep via `playBeep()`. This tells the user *something* changed but not *what* changed — they must look at the screen to see the toast or inspect watches. Users who are multitasking, have the browser minimized, or have visual impairments cannot determine the nature of the change without switching focus to the page. A spoken announcement like "Price changed from $299 to $275" would convey meaningful information without requiring visual attention.

---

## User Stories

- As a user monitoring prices while doing other work, I want the browser to announce "Price changed" so I know what happened without switching tabs.
- As a visually impaired user, I want change alerts spoken aloud so I can use the tool without relying on visual toasts.
- As a user with multiple watches, I want the speech to identify *which* element changed so I can prioritize which to check first.
- As a user in a shared workspace, I want to control TTS volume and rate so announcements aren't disruptive.
- As a user who prefers beeps, I want TTS to be optional and off by default so my existing workflow isn't affected.

---

## UX Design

### Settings Integration

A new **"Alert Mode"** option appears in the **General** section of the Settings modal (after Keyboard Shortcut):

```
┌──────────────────────────────────────────┐
│  ⚙ Settings                             │
│                                          │
│  ─── General ───                         │
│  Keyboard Shortcut        Shift+A    ▸   │
│  Alert Mode               Beep       ▸   │
│                                          │
│  ─── Watches ───                         │
│  ...                                     │
└──────────────────────────────────────────┘
```

The value label shows the current mode: `Beep`, `Speech`, or `Both`.

### Alert Mode Picker Sub-Modal

Tapping "Alert Mode" opens a picker:

```
┌──────────────────────────────────────────┐
│  ◀ Alert Mode                            │
│                                          │
│  ● Beep Only                             │
│    Repeating tone (default)              │
│                                          │
│  ○ Speech Only                           │
│    Announce changes aloud                │
│                                          │
│  ○ Beep + Speech                         │
│    Tone followed by announcement         │
│                                          │
│  ─── Speech Settings ───                 │
│    Voice            Default          ▸   │
│    Speed            Normal           ▸   │
│    Volume           100%             ▸   │
│    Preview  [ 🔊 Test Speech ]           │
└──────────────────────────────────────────┘
```

- **Voice picker**: Lists available voices from `speechSynthesis.getVoices()`, grouped by language. Shows only voices matching the browser's `navigator.language` by default, with a "Show All" toggle.
- **Speed picker**: `Slow` (0.7), `Normal` (1.0), `Fast` (1.3), `Very Fast` (1.6).
- **Volume picker**: Slider or preset buttons — `25%`, `50%`, `75%`, `100%`.
- **Test Speech**: Speaks a sample phrase: "Watch changed: sample content updated" using current settings.

### Speech Content Format

When a change is detected, the TTS announcement follows this template:

| Scenario | Spoken Text |
|----------|-------------|
| Single content change | "Watch changed on [page title]. Content updated." |
| Multiple changes | "[N] watches changed on [page title]." |
| Element not found | "Warning: [N] watched elements not found." |

The page title is truncated to 30 characters for brevity. If the page title is unavailable, the domain is used instead.

### Interaction with Existing Alerts

- **Beep Only** (default): Current behavior — `startAlert()` beeps every 2 seconds.
- **Speech Only**: No beep. Speaks the announcement once (no repeat). Does not set `alertIntervalId`.
- **Beep + Speech**: Speaks the announcement once, *then* starts the repeating beep via `startAlert()`.
- The `stopAlert()` function also cancels any in-progress speech via `speechSynthesis.cancel()`.

---

## Technical Design

### Data Model

**New Storage Keys** (added alongside existing constants at ~line 159):

```javascript
const STORAGE_KEY_ALERT_MODE = 'autoRefreshAlertMode';       // 'beep' | 'speech' | 'both'
const STORAGE_KEY_TTS_VOICE = 'autoRefreshTTSVoice';         // voice.name string or ''
const STORAGE_KEY_TTS_RATE = 'autoRefreshTTSRate';           // 0.7 | 1.0 | 1.3 | 1.6
const STORAGE_KEY_TTS_VOLUME = 'autoRefreshTTSVolume';       // 0.25 | 0.5 | 0.75 | 1.0
```

**Defaults**:
- `alertMode`: `'beep'` (preserves existing behavior)
- `ttsVoice`: `''` (uses browser default)
- `ttsRate`: `1.0`
- `ttsVolume`: `1.0`

### Core Logic

#### `speak(text)` Function

New function adjacent to `playBeep()` / `startAlert()` / `stopAlert()` (~line 644):

```javascript
function speak(text) {
  const mode = GM_getValue(STORAGE_KEY_ALERT_MODE, 'beep');
  if (mode === 'beep') return;  // TTS disabled

  speechSynthesis.cancel();  // Cancel any in-progress speech

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
```

#### Modified Alert Triggering

In `checkForChanges()` (~lines 1939-1950), the alert triggering branches based on mode:

- **Missing elements path** (line 1939): Call `speak("Warning: N watched elements not found")` then conditionally call `startAlert()` only if mode is `'beep'` or `'both'`.
- **Changes detected path** (line 1946): Call `speak(changeMessage)` then conditionally call `startAlert()`.

#### Modified `stopAlert()`

Add `speechSynthesis.cancel()` at the top of `stopAlert()` to ensure TTS stops when the user dismisses the alert.

### Integration Points

| System | Integration |
|--------|-------------|
| `startAlert()` / `stopAlert()` | Conditional execution based on alert mode; `stopAlert` also cancels TTS |
| `checkForChanges()` | Builds announcement text and calls `speak()` alongside existing alert logic |
| Settings modal (`Modal.define('settings')`) | New "Alert Mode" option in General section |
| Sub-modal system | New `alert-mode-picker` modal with nested voice/speed/volume pickers |
| `showToast()` | Unchanged — visual toast always shows regardless of alert mode |

### Browser API Notes

- `window.speechSynthesis` is available in all modern browsers (Chrome, Firefox, Edge, Safari)
- `speechSynthesis.getVoices()` may return an empty array on first call; listen for `voiceschanged` event for lazy population
- Voice list is populated asynchronously in Chrome — the voice picker sub-modal should handle this

---

## Edge Cases & Error Handling

- **Speech API unavailable**: If `window.speechSynthesis` is undefined, hide TTS options entirely from the settings modal and force alert mode to `'beep'`. Do not error.
- **No voices available**: If `getVoices()` returns empty even after `voiceschanged`, show "No voices available" in the voice picker and use the browser default (pass no voice to `SpeechSynthesisUtterance`).
- **Selected voice no longer available**: If the stored voice name doesn't match any available voice, fall back to the browser default silently.
- **Speech interrupted by new change**: If a new change triggers while TTS is still speaking, `speechSynthesis.cancel()` clears the queue and the new announcement takes priority.
- **Very long page titles**: Truncate `document.title` to 30 characters with ellipsis for the spoken announcement.
- **Tab in background**: `speechSynthesis.speak()` works in background tabs in most browsers, but Chrome may throttle it. This is acceptable — the beep alert has the same limitation.
- **Multiple rapid changes**: TTS does not repeat. One announcement per `checkForChanges()` cycle, regardless of how many watches changed.

---

## Scope & Non-Goals

### In Scope
- Three alert modes: Beep Only, Speech Only, Beep + Speech
- Configurable voice, rate, and volume
- Voice picker with available system voices
- Test/preview button in settings
- Speech cancellation on alert dismissal
- Graceful degradation when Speech API is unavailable

### Out of Scope (Future)
- Custom announcement templates (user-defined speech text patterns)
- Speaking the actual content diff (e.g., "Price changed from $299 to $275") — would require structured diff extraction
- Per-watch TTS settings (different voice per watch)
- TTS for toast messages beyond change alerts
- Queueing multiple announcements — latest wins

---

## Risks & Open Questions

1. **Chrome background tab throttling**: Chrome may delay or block `speechSynthesis.speak()` in background tabs. Should we document this limitation, or attempt a workaround (e.g., offscreen audio context)?
2. **Voice list timing**: `getVoices()` is async in Chrome. The voice picker needs to handle the `voiceschanged` event. Should the voice list be cached or fetched fresh each time the picker opens?
3. **Announcement verbosity**: Is "Watch changed on [page title]. Content updated." the right level of detail, or should it be shorter (just "Watch changed") or longer (include selector/element info)?
4. **Interaction with Spec 02 (Alert Modes)**: Spec 02 proposes different alert modes. If 02 is implemented first, TTS should integrate as an additional alert type within that framework rather than as a parallel system. If 27 is implemented first, the design should be compatible with 02's future architecture.
5. **Volume control granularity**: Should volume be preset buttons (25/50/75/100%) or a continuous slider? Preset buttons match existing picker patterns; a slider would be more precise but a different UI pattern.

---

## Implementation Details

**Version**: 1.8.0
**Date**: 2026-04-11
**Action Plan**: [action-plans/text-to-speech-alerts.md](../action-plans/text-to-speech-alerts.md)

### What Was Built
- Three alert modes (Beep Only, Speech Only, Beep + Speech) controlled via `STORAGE_KEY_ALERT_MODE`
- `speak(text)` function using Web Speech API with configurable voice, rate, and volume
- `_pageLabel()` helper to produce truncated page title for announcements
- Modified `startAlert()` to skip beep in speech-only mode
- Modified `stopAlert()` to cancel in-progress speech via `speechSynthesis.cancel()`
- Modified `checkForChanges()` to build contextual announcement text and call `speak()` before `startAlert()`
- Four new sub-modals: `alert-mode-picker`, `tts-voice-picker`, `tts-speed-picker`, `tts-volume-picker`
- "Alert Mode" entry in Settings → General with dynamic mode label
- Voice picker groups voices by language code, browser locale first
- `voiceschanged` event handling for async voice list population in Chrome
- `_ttsAvailable` flag for graceful degradation when Speech API is missing
- Test Speech button for previewing current settings

### Deviations from Spec
- None — implemented as specced

### Code Location
| Component | Location |
|-----------|----------|
| Storage keys (`STORAGE_KEY_ALERT_MODE`, etc.) | Line ~160-163 |
| `speak()`, `_pageLabel()`, `_ttsAvailable` | Line ~656-678 |
| Modified `startAlert()` | Line ~646 |
| Modified `stopAlert()` | Line ~651 |
| `ALERT_MODE_OPTIONS`, `TTS_RATE_OPTIONS`, `TTS_VOLUME_OPTIONS` | Line ~1180-1200 |
| `tts-speed-picker` modal | Line ~1202 |
| `tts-volume-picker` modal | Line ~1216 |
| `tts-voice-picker` modal | Line ~1230 |
| `alert-mode-picker` modal | Line ~1281 |
| Settings modal Alert Mode entry | Line ~1599 |
| Modified `checkForChanges()` | Line ~1959 |

### Testing Notes
All tests passed:
1. Default beep mode — unchanged behavior ✓
2. Alert Mode entry in Settings → General shows correct label ✓
3. Alert Mode picker shows 3 options correctly ✓
4. Speech Only: Speech Settings section appears ✓
5. Beep + Speech: Speech Settings section appears ✓
6. Beep Only: Speech Settings section hidden ✓
7. Voice picker lists system voices grouped by language (EN first) ✓
8. Speed picker shows 4 options with current marked ✓
9. Test Speech button executes without errors ✓
10. Settings persist across modal re-opens ✓
11. No console errors ✓

### Screenshots
- [27-settings-alert-mode.png](images/27-settings-alert-mode.png) — Main settings with Alert Mode entry
- [27-alert-mode-picker.png](images/27-alert-mode-picker.png) — Alert Mode picker with Speech Settings
- [27-voice-picker.png](images/27-voice-picker.png) — Voice picker with system voices
