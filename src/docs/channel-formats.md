---
title: Channel Formats
description: How libsonare recognizes mono, stereo, 5.1 and 7.1 audio across its modules — canonical channel order, LFE handling, the ITU-R BS.775 downmix used for narrowing, and the one shared rule every module's own upmix uses for widening.
---

# Channel Formats

libsonare recognizes four channel layouts system-wide — mono, stereo, 5.1 and 7.1 — but different modules were built for different jobs, so a channel count above 2 is not handled the same way everywhere. This page is the map: which module accepts how many channels, what canonical order and LFE handling mean, and the one rule every module's own upmix and downmix follows.

## Layouts and Speaker Roles

| Layout | Channels | Roles, canonical order |
|---|---|---|
| Mono | 1 | (no role; a single channel) |
| Stereo | 2 | L, R |
| 5.1 | 6 | L, R, C, LFE, Ls, Rs |
| 7.1 | 8 | L, R, C, LFE, Ls, Rs, Lss, Rss |

Canonical order matches `WAVE_FORMAT_EXTENSIBLE`. In 7.1, `Ls`/`Rs` (indices 4/5) and `Lss`/`Rss` (indices 6/7) are two distinct role pairs, not the same pair renamed — see [Widening](#widening-upmix) for where each one sits.

**LFE** (low-frequency effects) carries only the bass content mixed into the track at reduced level, on the assumption a decoder boosts it back by about 10 dB on the way to a subwoofer. Two rules cover every case a target without its own way to reproduce it can end up in:

- **Fold-in** (no LFE channel on the target, or bass management has no subwoofer): the LFE signal is low-pass filtered at 120 Hz and added into the L/R pair at reduced level.
- **Subwoofer feed** (bass management enabled with a subwoofer): the LFE signal is boosted and combined with the low-frequency content crossed over from speakers marked `"small"`, then sent to the LFE channel.
- With bass management disabled and a target that does have an LFE channel, the LFE plane passes through unchanged — the downstream amplifier is assumed to apply its own +10 dB.

## Channel Handling by Module

Most of the library processes mono or stereo and rejects anything wider; only the modules below accept a surround channel count, and each one decides differently what to do with material wider than what it renders.

| Module | Accepts | Wider-than-stereo behaviour |
|---|---|---|
| Audio file loading | Folds to mono, or passes an interleaved buffer through untouched | 1/2/6/8-channel files fold to mono through the BS.775 downmix below; any other count is averaged |
| Analysis and streaming analysis | Mono only | Caller folds first |
| Loudness metering (`lufsInterleaved`) | Any channel count | BS.1770 channel weights are selected by channel count |
| True peak, correlation, phase scope | Mono / stereo | Rejected |
| One-shot effects and mastering processors | 1–2 | Rejected |
| Realtime processors (dynamics, EQ, …) | Up to 64 planar | Runs per-plane; a stereo-pair-only effect on a wide bus acts on the front pair only |
| Mixing bus, strip, meter | 1 / 2 / 6 / 8 | Follows the bus's declared layout |
| Mixer graph | Bus width as declared | A narrower destination (a smaller bus, a stereo sidechain key) gets the BS.775 downmix; a wider one receives the source planes unchanged |
| Realtime engine / project bounce | Bus layout; output is 1 / 2 / 6 / 8 | Same rule as the mixer graph; a request wider than the master bus is refused |
| Realtime voice changer | 1–2 | Rejected |
| **Playback renderer** | 1 / 2 / 6 / 8, plus a channel map | Follows the conversion table below in both directions |

## Declaring an Input Layout with a Channel Map

Decoders disagree on channel order — AAC uses `C L R Ls Rs LFE`, some frameworks distinguish "5.1" from "5.1(side)", and platform APIs each have their own convention. The playback renderer's `input.channel_map` names the role of each input channel explicitly (`input.layout` must then be a fixed layout, not `"auto"`) instead of asking every caller to reorder its own buffers first: an incorrect map fails loudly as a validation error rather than landing as a silently swapped or missing channel. A 5.1(side) source's `SL`/`SR` channels map onto the `Ls`/`Rs` roles — the role name is "left/right surround"; the angle it ends up at is decided by the output side, not the input labeling.

## Narrowing (Downmix)

Every module above that renders a surround bus to something narrower — file loading, the mixer graph, project bounce, and the playback renderer — uses the same ITU-R BS.775 coefficients (`downmix` in the mixing module): 5.1 to stereo and 7.1 to 5.1/stereo fold the surround pair in at reduced level, keeping the LFE channel out of the arithmetic so it can be handled by the LFE rules above instead. In JavaScript the same coefficients are exposed as `downmix(channels, targetLayout)`: centre and surround enter the front pair at -3 dB and the LFE plane is dropped. `decodeChannels(bytes)` keeps every channel of a file so you can narrow it yourself, and the browser-codec fallback of `Audio.fromMemoryWithBrowserFallback` folds to mono through this rule, so both decoders give the same samples. See [JavaScript/TypeScript Audio and Streaming API](./js-api-audio.md) for the signatures, and [Surround group buses and wide meters](./realtime-engine.md#surround-group-buses-and-wide-meters) for the mixer graph's own narrowing rule.

The playback renderer's own conversion table, by source and target:

| Source \ Target | Stereo speakers | 5.1 speakers | 7.1 speakers | Headphones |
|---|---|---|---|---|
| Mono | L/R, -3 dB | Centre only | Centre only | Virtualized centre |
| Stereo | Passthrough | Upmix (or L/R only, `upmix.enabled: false`) | Upmix (or L/R only) | Upmix then virtualized (or virtualized L/R at ±30°) |
| 5.1 | BS.775 downmix + LFE fold-in | Passthrough | L/R/C/LFE unchanged; `Ls`/`Rs` move to `Lss`/`Rss`; 7.1's own `Ls`/`Rs` are silent | Virtualized 5.1 |
| 7.1 | BS.775 downmix + LFE fold-in | BS.775 downmix (LFE unchanged) | Passthrough | Virtualized 7.1 |

## Widening (Upmix)

The mixer and playback renderer widen channel beds differently. The mixer sums a narrower bus into the same plane indices of a wider bus, leaving the additional planes silent. The playback renderer uses speaker geometry when mapping ambience to a wider layout. These routing rules are separate from the surround panner's speaker angles:

| Module | L / R | 5.1 `Ls`/`Rs` | 7.1 `Ls`/`Rs` | 7.1 `Lss`/`Rss` |
|---|---|---|---|---|
| Mixer surround panner | ±30° | ±110° | ±135° (rear) | ±90° (side) |
| Playback renderer | ±30° | ±110° | ±135° (rear) | ±90° (side) |

For a mixer bus widened from 5.1 to 7.1, the surround pair stays at indices 4 and 5 (`Ls`/`Rs`); the side planes at indices 6 and 7 receive no copied signal. The playback renderer's 5.1-to-7.1 conversion instead moves the surround pair to the side planes at indices 6 and 7, leaving the rear planes silent. Its stereo-to-7.1 upmix generates ambience for both rear and side pairs, with an additional anti-phase component on the rear pair. A matching panner angle table therefore does not imply matching bus-widening behavior.

The renderer does not create a rear pair from a 5.1 source (no synthetic rear-channel generation), and it does not upmix to a wide-plus-height format — see [Playback Renderer § Non-Goals](./playback.md#non-goals).

## Related Pages

- [Playback Renderer](./playback.md)
- [Surround group buses and wide meters](./realtime-engine.md#surround-group-buses-and-wide-meters)
- [Bouncing Projects](./project-bounce.md)
