# Feature Spec: Custom Alert Sounds

## Overview

Allow users to upload, select, and preview custom alert sounds for watch change notifications. Includes a built-in library of tones and the ability to load sounds from URLs or base64-encoded audio.

---

## Problem Statement

The current alert uses a single hardcoded beep tone. Users who monitor pages for extended periods find the default sound either too intrusive, too easy to miss, or indistinguishable from other system notifications. Custom sounds improve recognition and reduce alert fatigue.

---

## User Stories

- As a user with multiple monitoring tools, I want a unique sound so I can instantly identify which tool is alerting.
- As someone working in a quiet environment, I want a softer notification chime.
- As a power user, I want different sounds for different watches (urgent vs. informational).

---

## UX Design

### Sound Settings (sub-modal from Settings)

```
┌──────────────────────────────────────┐
│ 🔊 Alert Sound Settings             │
│                                      │
│ BUILT-IN SOUNDS                      │
│ (●) Default beep      [▶ Preview]   │
│ ( ) Soft chime         [▶ Preview]   │
│ ( ) Urgent alarm       [▶ Preview]   │
│ ( ) Ping               [▶ Preview]   │
│ ( ) Subtle click       [▶ Preview]   │
│ ( ) None (silent)      [▶ Preview]   │
│                                      │
│ CUSTOM SOUNDS                        │
│ ┌──────────────────────────────────┐ │
│ │ my-alert.mp3         [▶] [✕]    │ │
│ │ price-drop.wav       [▶] [✕]    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [+ Upload Sound File]               │
│ [+ Add Sound URL]                   │
│                                      │
│ Volume: ████████░░ 80%              │
│                                      │
│         [Save]  [Cancel]            │
└──────────────────────────────────────┘
```

### Per-Watch Sound Override (in Watch config)

```
Alert Sound: [Default ▼]
             ├─ Default (settings)
             ├─ Soft chime
             ├─ Urgent alarm
             ├─ my-alert.mp3
             └─ price-drop.wav
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Select built-in sound | Sound set; preview plays on ▶ click |
| Upload file (mp3/wav/ogg) | Encoded to base64; stored in GM_setValue |
| Add sound URL | URL stored; validated on preview |
| Preview sound | Plays 2-second clip at current volume |
| Set volume | Slider 0-100%; applied to all alert sounds |
| Delete custom sound | Confirm → remove from storage; watches using it revert to default |
| Per-watch override | Specific watch uses its own sound instead of global default |
| File too large (>500KB) | Rejection message: "Sound file must be under 500KB" |
| Invalid audio format | Rejection: "Unsupported format. Use MP3, WAV, or OGG" |

---

## Technical Notes

### Built-In Sound Library (Web Audio API)

```javascript
const BUILT_IN_SOUNDS = {
    default: { freq: 800, type: 'sine', duration: 0.2 },
    chime:   { freq: [523, 659, 784], type: 'sine', duration: 0.15 },
    urgent:  { freq: [880, 0, 880, 0, 880], type: 'square', duration: 0.1 },
    ping:    { freq: 1200, type: 'sine', duration: 0.08 },
    click:   { freq: 4000, type: 'sine', duration: 0.02 },
    none:    null
};

function playBuiltInSound(name, volume = 0.8) {
    const sound = BUILT_IN_SOUNDS[name];
    if (!sound) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    const freqs = Array.isArray(sound.freq) ? sound.freq : [sound.freq];
    let time = ctx.currentTime;

    freqs.forEach(f => {
        if (f === 0) { time += sound.duration; return; }
        const osc = ctx.createOscillator();
        osc.type = sound.type;
        osc.frequency.value = f;
        osc.connect(gain);
        osc.start(time);
        osc.stop(time + sound.duration);
        time += sound.duration + 0.02;
    });
}
```

### Custom Sound Storage

```javascript
function uploadSound(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 500_000) return reject('File too large (max 500KB)');
        if (!/\.(mp3|wav|ogg)$/i.test(file.name)) return reject('Unsupported format');

        const reader = new FileReader();
        reader.onload = () => {
            const sounds = JSON.parse(GM_getValue('customSounds', '[]'));
            sounds.push({ name: file.name, data: reader.result });
            GM_setValue('customSounds', JSON.stringify(sounds));
            resolve();
        };
        reader.readAsDataURL(file);
    });
}

function playCustomSound(name, volume = 0.8) {
    const sounds = JSON.parse(GM_getValue('customSounds', '[]'));
    const sound = sounds.find(s => s.name === name);
    if (!sound) return playBuiltInSound('default', volume);

    const audio = new Audio(sound.data);
    audio.volume = volume;
    audio.play().catch(e => console.warn('[Auto-Refresh] Audio play failed:', e));
}
```

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `alertSound` | `string` | Global sound name (built-in key or custom name) |
| `alertVolume` | `number` | Volume 0.0 – 1.0 |
| `customSounds` | `string (JSON)` | Array of `{name, data}` (base64 audio) |
| `watches[].alertSound` | `string\|null` | Per-watch override (null = use global) |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Storage bloat from audio files | Medium | 500KB limit per file; max 10 custom sounds |
| Autoplay restrictions in browsers | Medium | AudioContext resume on user gesture; user already clicked |
| Custom sound fails to play | Low | Graceful fallback to built-in default |
| Sound plays unexpectedly | Low | Preview button gives user control; volume slider |
| Base64 encoding overhead | Low | Small files only; ~33% overhead acceptable at 500KB limit |
