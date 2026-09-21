---
title: GM Tone Map
description: The data-free NativeSynth fallback voicing for every General MIDI program — instrument name, synthesis engine, and voicing notes for all 128 programs, family by family.
---

# GM Tone Map

This page lists, for every one of the 128 General MIDI programs, the data-free fallback voicing NativeSynth uses when no SoundFont covers that program: instrument name, synthesis engine, and voicing notes. The bank behind it — its GS variation tones, drum-kit variants, and SoundFont fallback routing — is on [GM and GS Fallback Bank](./gm-gs.md), and the canonical instrument names are also available at runtime from `Project.gmInstrumentName(program)`. Rows marked *provisional* use one of the acoustic physical models still being calibrated.

**Model status** — **stable**: the subtractive, FM, modal, additive, and percussion cores are settled. **provisional**: the piano, Karplus-Strong, pipe-organ, bowed-string, reed, brass, flute, plucked-string (buzzing-bridge), vocal, and free-reed physical models are still being calibrated. The harpsichord's decay and stretch are regressed against captured references, so it is not marked provisional.

## Piano (0-7)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | provisional; shared modal soundboard |
| 1 | Bright Acoustic Piano | `piano` | provisional |
| 2 | Electric Grand Piano | `piano` | provisional (the acoustic waveguide, not FM) |
| 3 | Honky-tonk Piano | `piano` | provisional |
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
| 15 | Dulcimer | `karplus-strong` | provisional; hammered (struck) string |

## Organ (16-23)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 16 | Drawbar Organ | `additive` | 9-drawbar Hammond |
| 17 | Percussive Organ | `additive` | |
| 18 | Rock Organ | `additive` | |
| 19 | Church Organ | `pipe-organ` | provisional; multi-rank plenum |
| 20 | Reed Organ | `free-reed` | provisional; harmonium — mellow plate, soft tongues |
| 21 | Accordion | `free-reed` | provisional; shares the reed-organ voicing |
| 22 | Harmonica | `free-reed` | provisional; small, bright, stiff tongues + hand vibrato |
| 23 | Tango Accordion | `free-reed` | provisional; bandoneon, musette (wet-beating) detune |

## Guitar (24-31)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 24 | Acoustic Guitar (nylon) | `karplus-strong` | provisional; softer pluck, no dispersion |
| 25 | Acoustic Guitar (steel) | `karplus-strong` | provisional; steel-string dispersion + sympathetic |
| 26 | Electric Guitar (jazz) | `karplus-strong` | provisional; near-bridge pickup, no body |
| 27 | Electric Guitar (clean) | `karplus-strong` | provisional; shares the jazz voicing |
| 28 | Electric Guitar (muted) | `karplus-strong` | provisional; choked (palm-mute) decay |
| 29 | Overdriven Guitar | `karplus-strong` | provisional; pre-filter drive |
| 30 | Distortion Guitar | `karplus-strong` | provisional; harder drive |
| 31 | Guitar Harmonics | `karplus-strong` | provisional |

## Bass (32-39)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 32 | Acoustic Bass | `karplus-strong` | provisional; large resonating body |
| 33 | Electric Bass (finger) | `karplus-strong` | provisional; pickup + two-polarization beat |
| 34 | Electric Bass (pick) | `karplus-strong` | provisional; bright near-bridge attack |
| 35 | Fretless Bass | `karplus-strong` | provisional; rounder, glide-friendly |
| 36 | Slap Bass 1 | `karplus-strong` | provisional; thumb slap + fret-slap buzz |
| 37 | Slap Bass 2 | `karplus-strong` | provisional; sharper pop |
| 38 | Synth Bass 1 | `subtractive` | synth bass by design |
| 39 | Synth Bass 2 | `subtractive` | synth bass by design |

## Strings (40-47)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 40 | Violin | `bowed-string` | provisional |
| 41 | Viola | `bowed-string` | provisional; darker/slower |
| 42 | Cello | `bowed-string` | provisional |
| 43 | Contrabass | `bowed-string` | provisional; darkest/slowest |
| 44 | Tremolo Strings | `subtractive` | detuned-saw section with an amplitude-tremolo LFO |
| 45 | Pizzicato Strings | `karplus-strong` | provisional; short pluck into a violin-body corpus |
| 46 | Orchestral Harp | `karplus-strong` | provisional; long undamped ring |
| 47 | Timpani | `percussion` | note-tracked kettledrum |

## Ensemble (48-55)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 48 | String Ensemble 1 | `subtractive` | wide supersaw pad with section vibrato |
| 49 | String Ensemble 2 | `subtractive` | |
| 50 | SynthStrings 1 | `subtractive` | |
| 51 | SynthStrings 2 | `subtractive` | |
| 52 | Choir Aahs | `vocal` | provisional; open /a/ vowel, glottal source + formants |
| 53 | Voice Oohs | `vocal` | provisional; darker closed /u/ vowel |
| 54 | Synth Voice | `vocal` | provisional; brighter, steadier synthetic vowel |
| 55 | Orchestra Hit | `subtractive` | bright detuned-saw stab |

## Brass (56-63)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 56 | Trumpet | `brass` | provisional; lip-reed waveguide |
| 57 | Trombone | `brass` | provisional |
| 58 | Tuba | `brass` | provisional; dark, conical |
| 59 | Muted Trumpet | `brass` | provisional; physical mute model |
| 60 | French Horn | `brass` | provisional; rounder, conical |
| 61 | Brass Section | `fm` | FM by design (not the brass waveguide) |
| 62 | SynthBrass 1 | `fm` | FM by design |
| 63 | SynthBrass 2 | `fm` | FM by design |

## Reed (64-71)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 64 | Soprano Sax | `reed` | provisional; conical bore |
| 65 | Alto Sax | `reed` | provisional; conical |
| 66 | Tenor Sax | `reed` | provisional; conical |
| 67 | Baritone Sax | `reed` | provisional; conical, darkest sax |
| 68 | Oboe | `reed` | provisional; conical, bright/nasal |
| 69 | English Horn | `reed` | provisional; conical |
| 70 | Bassoon | `reed` | provisional; conical, low |
| 71 | Clarinet | `reed` | provisional; cylindrical bore (odd harmonics) |

## Pipe (72-79) — air-jet flute engine

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 72 | Piccolo | `flute` | provisional; brightest |
| 73 | Flute | `flute` | provisional |
| 74 | Recorder | `flute` | provisional |
| 75 | Pan Flute | `flute` | provisional; breathy vortex |
| 76 | Blown Bottle | `flute` | provisional; dark, high damping |
| 77 | Shakuhachi | `flute` | provisional; breathiest |
| 78 | Whistle | `flute` | provisional |
| 79 | Ocarina | `flute` | provisional; closed-vessel |

## Synth Lead (80-87) — subtractive oscillators

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | 3-osc detuned lead through a Moog-ladder filter |
| 81 | Lead 2 (sawtooth) | `subtractive` | |
| 82 | Lead 3 (calliope) | `subtractive` | |
| 83 | Lead 4 (chiff) | `subtractive` | |
| 84 | Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | a sung lead: the oscillator runs through the **vocal formant body**, which is the model — the oscillator only has to be rich enough to feed it |
| 86 | Lead 7 (fifths) | `subtractive` | |
| 87 | Lead 8 (bass + lead) | `subtractive` | |

## Synth Pad (88-95) — subtractive oscillators

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 88 | Pad 1 (new age) | `subtractive` | 7-osc supersaw pad |
| 89 | Pad 2 (warm) | `subtractive` | |
| 90 | Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | the same **vocal formant body** as Lead 6, mixed higher, over the pad's envelope instead of the lead's |
| 92 | Pad 5 (bowed) | `subtractive` | |
| 93 | Pad 6 (metallic) | `subtractive` | |
| 94 | Pad 7 (halo) | `subtractive` | |
| 95 | Pad 8 (sweep) | `subtractive` | |

## Synth Effects (96-103) — all subtractive

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 96 | FX 1 (rain) | `subtractive` | drifting detuned triangles |
| 97 | FX 2 (soundtrack) | `subtractive` | |
| 98 | FX 3 (crystal) | `subtractive` | |
| 99 | FX 4 (atmosphere) | `subtractive` | |
| 100 | FX 5 (brightness) | `subtractive` | |
| 101 | FX 6 (goblins) | `subtractive` | |
| 102 | FX 7 (echoes) | `subtractive` | |
| 103 | FX 8 (sci-fi) | `subtractive` | |

## Ethnic (104-111) — buzzing-bridge plucked + karplus-strong

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 104 | Sitar | `plucked-string` | provisional; jawari bridge buzz, long shimmering ring |
| 105 | Banjo | `karplus-strong` | provisional; shared pluck sketch |
| 106 | Shamisen | `plucked-string` | provisional; sawari buzz, drier and harder than the sitar |
| 107 | Koto | `plucked-string` | provisional; bridge-buzz plucked string |
| 108 | Kalimba | `karplus-strong` | provisional; shared pluck sketch |
| 109 | Bag pipe | `karplus-strong` | provisional; shared pluck sketch (no reed drone yet) |
| 110 | Fiddle | `karplus-strong` | provisional; shared pluck sketch (not bowed yet) |
| 111 | Shanai | `karplus-strong` | provisional; shared pluck sketch (no reed model yet) |

## Percussive (112-119) — all percussion

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

## Sound Effects (120-127) — generic placeholder

<SonareDemo id="gm-sfx" />

The demo above auditions all eight GM Sound-Effects programs directly — a quick way to hear that they currently share one voice instead of eight distinct effects.

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 120 | Guitar Fret Noise | `subtractive` | generic resonant-noise placeholder (see note below) |
| 121 | Breath Noise | `subtractive` | generic resonant-noise placeholder |
| 122 | Seashore | `subtractive` | generic resonant-noise placeholder |
| 123 | Bird Tweet | `subtractive` | generic resonant-noise placeholder |
| 124 | Telephone Ring | `subtractive` | generic resonant-noise placeholder |
| 125 | Helicopter | `subtractive` | generic resonant-noise placeholder |
| 126 | Applause | `subtractive` | generic resonant-noise placeholder |
| 127 | Gunshot | `subtractive` | generic resonant-noise placeholder |

Note on 120-127: in the data-free fallback these eight programs currently share one generic noise-through-a-resonant-bandpass voice, differentiated only by the note played — there is no per-effect procedural model yet. A SoundFont that covers these programs plays its own samples instead.
