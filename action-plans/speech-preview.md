# Implementation Plan: Speech Preview in Pickers (Feature #53)

## Version Target: 4.4.0

## Status: COMPLETED
**Version**: 4.4.0
**Date**: 2026-04-15

## Overview
Add inline preview buttons (`[▶]`/`[■]`) on Voice, Speed, Volume, and Alert Mode picker option rows. Each button plays a speech/beep sample with that option's value as a temporary override, without saving to Config. A centralized `previewSpeak()` helper and `makePreviewBtn()` factory handle all preview logic. Cancel-on-close cleanup and single-utterance-at-a-time behavior are enforced.

## Implementation Steps

### Step 1: Add I18N keys
**Location**: EN dictionary (~line 354), ES dictionary (~line 745)
- Add `btn.preview` and `btn.preview.stop` keys

### Step 2: Add CSS for `.ar-preview-btn`
**Location**: `buildCss()` function, append after existing button styles
- Small 28×28 button with border, centered content, theme-aware colors
- `.ar-preview-playing` variant with accent color

### Step 3: Add `previewSpeak()` helper function
**Location**: After `speak()` function (~line 1904)
- Takes `{ voice, rate, volume }` overrides
- Calls `speechSynthesis.cancel()` first
- Returns the `SpeechSynthesisUtterance` so callers can listen for `end`/`error`

### Step 4: Add `makePreviewBtn()` factory function
**Location**: After `previewSpeak()` (~line 1915)
- Creates a `[▶]` button with `ar-preview-btn` class
- On click: `e.stopPropagation()`, cancel any playing preview, speak with overrides
- Toggles text to `[■]` while playing, back to `[▶]` on end/error/cancel
- Returns the button element

### Step 5: Add `renderOption` to speed picker
**Location**: `tts-speed-picker` definition (~line 2882)
- Add `renderOption: (btn, { key }) => { btn.querySelector('.ar-opt-top').appendChild(makePreviewBtn({ rate: parseFloat(key) })); }`
- Register cleanup for `speechSynthesis.cancel()` — but renderOption doesn't have ctx access, so cleanup needs to be on the modal definition instead

### Step 6: Add `renderOption` to volume picker
**Location**: `tts-volume-picker` definition (~line 2895)
- Similar pattern: `makePreviewBtn({ volume: parseFloat(key) })`

### Step 7: Add preview buttons to voice picker
**Location**: Inside `tts-voice-picker` build function (~line 2970)
- After each `makeOptionBtn()` call for a voice, append a `makePreviewBtn({ voice: v.name })`
- Also append one for the "Default" option with no voice override

### Step 8: Add preview buttons to alert mode picker option rows
**Location**: Inside `alert-mode-picker` build function (~line 2997)
- For `beep`: preview plays `playBeep()` — use a custom handler
- For `speech`: preview calls `previewSpeak()`
- For `both`: preview calls `playBeep()` then `previewSpeak()` after 400ms delay

### Step 9: Add cleanup to all TTS picker modals
**Location**: In each picker's build function or via onClose
- For custom-build pickers (voice, alert-mode): `ctx.cleanups.push(() => speechSynthesis.cancel())`
- For type:'picker' modals (speed, volume): need to add an `onClose` callback or convert to custom build, or add cleanup in the auto-generated build

## Key Design Decisions
- Preview button appended inside `.ar-opt-top` div to sit alongside the value text, leveraging existing flex `justify-content: space-between`
- `e.stopPropagation()` on preview click prevents parent row click (which would save the option)
- Global `speechSynthesis.cancel()` before every preview ensures single-utterance-at-a-time
- `playBeep()` uses Web Audio (separate from speechSynthesis), so it doesn't conflict
- For picker-type modals, add an `onOpen` callback to register cleanups, or register cleanup via the auto-generated build enhancement

## Testing Plan
1. Open Settings → Alert Mode → Speed picker → each row has [▶] button
2. Click [▶] on "Slow" → hears speech at 0.7x rate, button shows [■]
3. Click [▶] on "Fast" while "Slow" is still playing → stops Slow, plays Fast
4. Click [■] while playing → stops playback, reverts to [▶]
5. Open Volume picker → each row has [▶], plays at different volumes
6. Open Voice picker → each voice row has [▶], plays with that voice
7. Open Alert Mode picker → "Beep Only" has [▶] that plays one beep
8. "Speech Only" row → [▶] speaks with saved settings
9. "Beep + Speech" row → [▶] plays beep, then speaks after 400ms
10. Press Escape while preview is playing → preview stops (cleanup)
11. Keyboard: ArrowDown to a preview button, Enter to play — verify it works
12. Console: zero errors throughout

## Deviations from Spec
(Initially empty — update during implementation if needed)
