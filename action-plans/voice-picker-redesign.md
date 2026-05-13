# Implementation Plan: Voice Picker Redesign (Feature #55)

## Version Target: 4.5.0

## Status: COMPLETED
**Version**: 4.5.0
**Date**: 2026-04-15

## Overview
Add search filter, "Natural" voice badges, and auto-preview on keyboard focus to the voice picker. Three focused changes to the existing `tts-voice-picker` modal build function.

## Implementation Steps

### Step 1: Add I18N keys
**Location**: EN dictionary (~line 356), ES dictionary (~line 749)
- `voice.search`: "Search voices…"
- `voice.noMatch`: "No matching voices"
- `voice.natural`: "Natural"

### Step 2: Add search input to voice picker
**Location**: `tts-voice-picker` build function (~line 3010)
- Insert `ar-input` before the scroll container
- Wire `input` event to re-render with filter
- Modify `renderVoices(showAll, filter)` to accept filter string
- When filter is active, search across all languages regardless of `showAll`

### Step 3: Add "Natural" badge to voice rows
**Location**: Inside `renderVoices`, where voice buttons are created (~line 3072)
- Detect via `/natural|neural/i.test(v.name)`
- Append a `★` span after the subtitle (language code)

### Step 4: Add auto-preview on keyboard focus
**Location**: Inside `tts-voice-picker` build function
- Store voice name as `data-voice` attribute on each voice button
- Set up `focusin` listener on the panel
- 800ms debounce: when focus moves to a button with `data-voice`, start timer
- Cancel on next focus move, modal close, or search input focus
- Register timer cleanup via `ctx.cleanups`

### Step 5: Debounce search input
- Add 150ms debounce on the input event to avoid excessive re-renders

## Key Design Decisions
- Search filter replaces the two-step language picker (simpler, same benefit)
- Natural badge uses `★` character, not an image
- Auto-preview delay is 800ms — long enough to skip during fast browsing
- Search input stays outside the scroll container so it's always visible

## Testing Plan
1. Voice picker opens with search input at top, voices below
2. Type "spanish" → only Spanish voices shown
3. Clear search → returns to normal view
4. Type "natural" → only Natural voices shown, each with ★ badge
5. Type "xyz" → "No matching voices" message
6. Arrow-key to a voice, wait 800ms → auto-preview speaks
7. Arrow quickly through 3 voices → only last one previews (debounce)
8. Click [▶] button manually → still works normally
9. Escape during auto-preview → speech cancelled (cleanup)
10. Search input → type → ArrowDown into results → navigation works
11. Console: zero errors

## Deviations from Spec
(Initially empty — update during implementation if needed)
