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

Every module above that renders a surround bus to something narrower — file loading, the mixer graph, project bounce, and the playback renderer — uses the same ITU-R BS.775 coefficients (`downmix` in the mixing module): 5.1 to stereo and 7.1 to 5.1/stereo fold the surround pair in at reduced level, keeping the LFE channel out of the arithmetic so it can be handled by the LFE rules above instead. See [Surround group buses and wide meters](./realtime-engine.md#surround-group-buses-and-wide-meters) for the mixer graph's own narrowing rule.

The playback renderer's own conversion table, by source and target:

| Source \ Target | Stereo speakers | 5.1 speakers | 7.1 speakers | Headphones |
|---|---|---|---|---|
| Mono | L/R, -3 dB | Centre only | Centre only | Virtualized centre |
| Stereo | Passthrough | Upmix (or L/R only, `upmix.enabled: false`) | Upmix (or L/R only) | Upmix then virtualized (or virtualized L/R at ±30°) |
| 5.1 | BS.775 downmix + LFE fold-in | Passthrough | L/R/C/LFE unchanged; `Ls`/`Rs` move to `Lss`/`Rss`; 7.1's own `Ls`/`Rs` are silent | Virtualized 5.1 |
| 7.1 | BS.775 downmix + LFE fold-in | BS.775 downmix (LFE unchanged) | Passthrough | Virtualized 7.1 |

## Widening (Upmix)

Every module that widens a channel bed — the mixer graph placing a narrower bus's planes on a wider one, and the playback renderer's stereo upmix — follows one shared principle: **place each source plane at the destination role whose angle, on that module's own angle table, is closest to the source plane's own angle.** The angle tables differ by module because they serve different jobs, so the same role name can end up at a different angle depending which module's table is in play:

| Module | L / R | 5.1 `Ls`/`Rs` | 7.1 `Ls`/`Rs` | 7.1 `Lss`/`Rss` |
|---|---|---|---|---|
| Mixer graph panner | ±30° | ±110° | ±110° (same table, no separate 7.1 row) | ±90° |
| Playback renderer | ±30° | ±110° | ±135° (rear) | ±90° (side) |

The mixer graph keeps one angle per role across every width it renders, so a bus's 5.1 surround pair lands on the same channel index when the bus widens to 7.1. The playback renderer instead follows ITU-R BS.2051's nominal loudspeaker angles, which place 5.1's `Ls`/`Rs` (±110°) closer to 7.1's side pair `Lss`/`Rss` (±90°) than to 7.1's own `Ls`/`Rs` (±135°, further back). Applying the same nearest-angle rule with a different table therefore sends a stereo upmix's decorrelated ambience to `Lss`/`Rss` rather than to `Ls`/`Rs`: the two tables give the same role name a different angle, and the rule follows the angle, not the name.

The renderer does not create a rear pair from a 5.1 source (no synthetic rear-channel generation), and it does not upmix to a wide-plus-height format — see [Playback Renderer § Non-Goals](./playback.md#non-goals).

## Related Pages

- [Playback Renderer](./playback.md)
- [Surround group buses and wide meters](./realtime-engine.md#surround-group-buses-and-wide-meters)
- [Bouncing Projects](./project-bounce.md)
