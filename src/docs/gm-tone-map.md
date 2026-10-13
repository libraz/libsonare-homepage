---
title: GM Tone Map
description: The data-free NativeSynth fallback voicing for every General MIDI program — instrument name, synthesis engine, and voicing notes for all 128 programs, family by family.
---

# GM Tone Map

This page lists, for every one of the 128 General MIDI programs, the data-free fallback voicing NativeSynth uses when no SoundFont covers that program: instrument name, synthesis engine, and voicing notes. It is the one per-program table; the bank behind it (GS variation tones, drum-kit variants, SoundFont fallback routing) is on [GM and GS Fallback Bank](./gm-gs.md). Canonical instrument names are also available at runtime from `Project.gmInstrumentName(program)`.

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: 'Calibration status',
    body: 'Only the acoustic piano (programs 0-3) is calibrated against a reference recording. Every program on another physical-model engine, including the harpsichord, modal and percussion engines, is provisional and can change across patch releases. The subtractive, FM and additive programs are signal-based and carry no calibration status.'
  }"
/>

## Programs per engine

| Engine | Programs | Count |
|--------|----------|-------|
| `subtractive` | 38-39, 44, 50-51, 55, 80-103, 120-127 | 38 |
| `karplus-strong` | 15, 24-37, 45-46, 105 | 18 |
| `reed` | 64-71, 109, 111 | 10 |
| `percussion` | 47, 112-119 | 9 |
| `modal` | 8-14, 108 | 8 |
| `flute` | 72-79 | 8 |
| `bowed-string` | 40-43, 48-49, 110 | 7 |
| `brass` | 56-61 | 6 |
| `fm` | 4-5, 7, 62-63 | 5 |
| `piano` | 0-3 | 4 |
| `free-reed` | 20-23 | 4 |
| `additive` | 16-18 | 3 |
| `plucked-string` | 104, 106-107 | 3 |
| `vocal` | 52-54 | 3 |
| `harpsichord` | 6 | 1 |
| `pipe-organ` | 19 | 1 |

## Piano (0-7)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | shared modal soundboard |
| 1 | Bright Acoustic Piano | `piano` | the same grand, voiced hard |
| 2 | Electric Grand Piano | `piano` | the acoustic waveguide, not FM |
| 3 | Honky-tonk Piano | `piano` | unisons pulled apart until they beat |
| 4 | Electric Piano 1 | `fm` | tine/bell FM |
| 5 | Electric Piano 2 | `fm` | shares the EP1 voicing |
| 6 | Harpsichord | `harpsichord` | jack and plectrum; three bank-selected registrations |
| 7 | Clavi | `fm` | bright high-ratio FM |

## Chromatic Percussion (8-15)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 8 | Celesta | `modal` | soft felt-struck steel bar |
| 9 | Glockenspiel | `modal` | uniform-bar mode ratios |
| 10 | Music Box | `modal` | twin-tooth beating for tine shimmer |
| 11 | Vibraphone | `modal` | motor tremolo (LFO → amplitude) |
| 12 | Marimba | `modal` | deep-arch bar, wood-tube body |
| 13 | Xylophone | `modal` | short, dry deep-arch bar |
| 14 | Tubular Bells | `modal` | missing-fundamental strike pitch, long ring |
| 15 | Dulcimer | `karplus-strong` | hammered (struck) string |

## Organ (16-23)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 16 | Drawbar Organ | `additive` | nine-drawbar tonewheel organ |
| 17 | Percussive Organ | `additive` | |
| 18 | Rock Organ | `additive` | |
| 19 | Church Organ | `pipe-organ` | multi-rank plenum |
| 20 | Reed Organ | `free-reed` | harmonium: mellow plate, soft tongues |
| 21 | Accordion | `free-reed` | shares the reed-organ voicing |
| 22 | Harmonica | `free-reed` | small, bright, stiff tongues + hand vibrato |
| 23 | Tango Accordion | `free-reed` | bandoneon, musette (wet-beating) detune |

## Guitar (24-31)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 24 | Acoustic Guitar (nylon) | `karplus-strong` | softer pluck, no dispersion |
| 25 | Acoustic Guitar (steel) | `karplus-strong` | steel-string dispersion + sympathetic strings |
| 26 | Electric Guitar (jazz) | `karplus-strong` | near-bridge pickup, no body |
| 27 | Electric Guitar (clean) | `karplus-strong` | shares the jazz voicing |
| 28 | Electric Guitar (muted) | `karplus-strong` | choked (palm-mute) decay |
| 29 | Overdriven Guitar | `karplus-strong` | pre-filter drive |
| 30 | Distortion Guitar | `karplus-strong` | harder drive |
| 31 | Guitar Harmonics | `karplus-strong` | touched node, not the open string |

## Bass (32-39)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 32 | Acoustic Bass | `karplus-strong` | large resonating body |
| 33 | Electric Bass (finger) | `karplus-strong` | pickup + two-polarization beat |
| 34 | Electric Bass (pick) | `karplus-strong` | bright near-bridge attack |
| 35 | Fretless Bass | `karplus-strong` | rounder, glide-friendly |
| 36 | Slap Bass 1 | `karplus-strong` | thumb slap + fret-slap buzz |
| 37 | Slap Bass 2 | `karplus-strong` | sharper pop |
| 38 | Synth Bass 1 | `subtractive` | synth bass by design |
| 39 | Synth Bass 2 | `subtractive` | synth bass by design |

## Strings (40-47)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 40 | Violin | `bowed-string` | |
| 41 | Viola | `bowed-string` | darker, slower |
| 42 | Cello | `bowed-string` | |
| 43 | Contrabass | `bowed-string` | darkest, slowest |
| 44 | Tremolo Strings | `subtractive` | detuned-saw section with an amplitude-tremolo LFO |
| 45 | Pizzicato Strings | `karplus-strong` | short pluck into a violin-body corpus |
| 46 | Orchestral Harp | `karplus-strong` | long undamped ring |
| 47 | Timpani | `percussion` | note-tracked kettledrum |

## Ensemble (48-55)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 48 | String Ensemble 1 | `bowed-string` | ensemble bowing |
| 49 | String Ensemble 2 | `bowed-string` | the same voicing, slower |
| 50 | SynthStrings 1 | `subtractive` | |
| 51 | SynthStrings 2 | `subtractive` | |
| 52 | Choir Aahs | `vocal` | open /a/ vowel, glottal source + formants |
| 53 | Voice Oohs | `vocal` | darker closed /u/ vowel |
| 54 | Synth Voice | `vocal` | brighter, steadier synthetic vowel |
| 55 | Orchestra Hit | `subtractive` | bright detuned-saw stab |

## Brass (56-63)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 56 | Trumpet | `brass` | lip-reed waveguide |
| 57 | Trombone | `brass` | |
| 58 | Tuba | `brass` | dark, conical |
| 59 | Muted Trumpet | `brass` | physical mute model |
| 60 | French Horn | `brass` | rounder, conical |
| 61 | Brass Section | `brass` | the lip-reed waveguide, in section |
| 62 | SynthBrass 1 | `fm` | FM by design |
| 63 | SynthBrass 2 | `fm` | FM by design |

## Reed (64-71)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 64 | Soprano Sax | `reed` | conical bore |
| 65 | Alto Sax | `reed` | conical |
| 66 | Tenor Sax | `reed` | conical |
| 67 | Baritone Sax | `reed` | conical, darkest sax |
| 68 | Oboe | `reed` | conical, bright/nasal |
| 69 | English Horn | `reed` | conical |
| 70 | Bassoon | `reed` | conical, low |
| 71 | Clarinet | `reed` | cylindrical bore (odd harmonics) |

## Pipe (72-79)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 72 | Piccolo | `flute` | brightest |
| 73 | Flute | `flute` | |
| 74 | Recorder | `flute` | |
| 75 | Pan Flute | `flute` | breathy vortex |
| 76 | Blown Bottle | `flute` | dark, high damping |
| 77 | Shakuhachi | `flute` | breathiest |
| 78 | Whistle | `flute` | |
| 79 | Ocarina | `flute` | closed vessel |

## Synth Lead, Pad and Effects (80-103)

All 24 programs run on `subtractive` oscillators.

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | 3-oscillator detuned lead through a four-pole transistor-ladder filter |
| 81-84 | Lead 2 (sawtooth) to Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | a sung lead: the oscillator runs through the **vocal formant body**, which is the model; the oscillator only has to be rich enough to feed it |
| 86-87 | Lead 7 (fifths), Lead 8 (bass + lead) | `subtractive` | |
| 88 | Pad 1 (new age) | `subtractive` | 7-oscillator supersaw pad |
| 89-90 | Pad 2 (warm), Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | the same **vocal formant body** as Lead 6, mixed higher, over the pad's envelope instead of the lead's |
| 92-95 | Pad 5 (bowed) to Pad 8 (sweep) | `subtractive` | |
| 96 | FX 1 (rain) | `subtractive` | drifting detuned triangles |
| 97-103 | FX 2 (soundtrack) to FX 8 (sci-fi) | `subtractive` | |

## Ethnic (104-111)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 104 | Sitar | `plucked-string` | jawari bridge buzz, long shimmering ring |
| 105 | Banjo | `karplus-strong` | steel strings drained by a membrane head |
| 106 | Shamisen | `plucked-string` | sawari buzz, drier and harder than the sitar |
| 107 | Koto | `plucked-string` | bridge-buzz plucked string |
| 108 | Kalimba | `modal` | plucked steel tine, wood-tube body |
| 109 | Bag pipe | `reed` | conical double reed at fixed bag pressure, no drones |
| 110 | Fiddle | `bowed-string` | violin voicing, bowed the folk way |
| 111 | Shanai | `reed` | double reed into a brass-bell body |

## Percussive (112-119)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 112 | Tinkle Bell | `percussion` | sparse inharmonic modes |
| 113 | Agogo | `percussion` | two-tone metal bell |
| 114 | Steel Drums | `percussion` | near-harmonic modes |
| 115 | Woodblock | `percussion` | very short, with stick click |
| 116 | Taiko Drum | `percussion` | strong pitch drop + shell boom |
| 117 | Melodic Tom | `percussion` | note-tracked, with shell body |
| 118 | Synth Drum | `percussion` | decaying-sine electronic drum |
| 119 | Reverse Cymbal | `percussion` | long rising swell (simulated reverse) |

## Sound Effects (120-127)

<SonareDemo id="gm-sfx" />

The demo above auditions all eight GM Sound-Effects programs. Each is its own subtractive gesture built from noise, a filter and an envelope.

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 120 | Guitar Fret Noise | `subtractive` | short, bright scrape with no pitched body |
| 121 | Breath Noise | `subtractive` | soft low-passed burst with a gradual onset |
| 122 | Seashore | `subtractive` | long noise swell with a receding high-pass edge |
| 123 | Bird Tweet | `subtractive` | triangle swept upward by an envelope |
| 124 | Telephone Ring | `subtractive` | key-following resonant square |
| 125 | Helicopter | `subtractive` | low noise band with periodic amplitude |
| 126 | Applause | `subtractive` | broad bright noise with random scatter |
| 127 | Gunshot | `subtractive` | compressed noise impulse with a bright crack |

These are approximations built without samples. A SoundFont that covers these programs plays its own recordings instead.
