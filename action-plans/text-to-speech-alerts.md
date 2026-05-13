# Implementation Plan: Text-to-Speech Alerts (Feature #27)

## Version Target: 1.8.0

## Overview
Add an optional TTS alert mode using the Web Speech API. Three modes: Beep Only (default), Speech Only, Beep + Speech. Configurable voice, rate, and volume via new sub-modals in Settings → General.

## Implementation Steps

### Step 1: Add Storage Key Constants
**Location**: After line 159 (`STORAGE_KEY_OPACITY`)
- Add `STORAGE_KEY_ALERT_MODE`, `STORAGE_KEY_TTS_VOICE`, `STORAGE_KEY_TTS_RATE`, `STORAGE_KEY_TTS_VOLUME`

### Step 2: Add `speak()` Function and Modify Alert System
**Location**: After `stopAlert()` (line ~644)
- Add `speak(text)` function
- Modify `stopAlert()` to also cancel speechSynthesis
- Modify `startAlert()` to check alert mode — skip beep if mode is `'speech'`

### Step 3: Modify `checkForChanges()`
**Location**: Lines ~1939-1950
- Build announcement text based on change type
- Call `speak()` with the announcement
- Conditionally call `startAlert()` based on mode

### Step 4: Add Alert Mode Picker Sub-Modals
**Location**: After `hotkey-picker` Modal.define (~line 1003)
- `alert-mode-picker` — mode selection + speech settings + test button
- `tts-voice-picker` — voice list from `speechSynthesis.getVoices()`
- `tts-speed-picker` — Slow/Normal/Fast/Very Fast
- `tts-volume-picker` — 25%/50%/75%/100%

### Step 5: Add Settings Modal Entry
**Location**: General section, after hotkey option (~line 1403)
- Add "Alert Mode" option with `ctx.push('alert-mode-picker')`

## Key Design Decisions
- Default to `'beep'` to preserve existing behavior
- Speech does not repeat — one announcement per detection cycle
- `stopAlert()` always cancels speech to prevent orphaned audio
- Voice picker handles async `getVoices()` with `voiceschanged` event
- If `speechSynthesis` is unavailable, hide TTS options and force beep mode

## Testing Plan
1. Default mode (beep) works unchanged
2. Speech Only mode speaks announcement, no beep
3. Beep + Speech mode speaks then beeps
4. Voice picker shows system voices
5. Speed/volume settings affect speech output
6. Test Speech button works
7. Stop Alert silences both beep and speech
8. Settings persist across page reloads
9. Graceful fallback when Speech API unavailable

## Deviations from Spec
(None — implemented as specced)

## Status: COMPLETED
**Version**: 1.8.0
**Date**: 2026-04-11
