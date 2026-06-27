---
title: Section and Structure
description: Boundaries, self-similarity, repeated sections, energy, and vocal likelihood — how libsonare labels song sections.
---

# Section and Structure

**Section analysis** divides a track into longer musical spans such as intro, verse, chorus, bridge, instrumental, and outro. It is a structural estimate: useful for navigation and visualization, but not a replacement for a producer's arrangement notes.

Use it to navigate a track, set loop points around a chorus, or drive a structural visualization — anywhere you need an approximate map of the song's large-scale form.

For newcomers, think of section analysis as building a map of the song. It looks at large spans such as an intro, verse-like area, chorus-like area, or bridge-like area, rather than short events like individual beats or chords.

## Reading a self-similarity matrix

The central tool is the **self-similarity matrix (SSM)**. It compares every moment of a feature sequence against every other moment.

You can read it as a "which parts sound alike?" table:

| Pattern in the SSM | Meaning |
|--------------------|---------|
| Bright cell | These two times sound similar |
| Block along the diagonal | A span is internally consistent, so it may be one section |
| Stripe away from the diagonal | Two different times sound similar, often a repeated chorus or repeated verse |

Two signals are especially useful:

- **Novelty** means the SSM changes suddenly. It helps find boundaries.
- **Repetition** means similar material appears in separate places. It helps group recurring sections.

Novelty alone tends to split too much. Repetition alone can miss one-off parts. libsonare combines both.

## Boundaries first

libsonare detects section boundaries by building frame-level features, computing a self-similarity matrix, and looking for novelty peaks. The default feature mix uses MFCC and chroma, so boundaries can come from timbre changes, harmonic changes, or both.

`minSectionSec` controls how short a detected section is allowed to be. Very short edits, drops, or pickup bars may be merged into neighboring spans.

For long-form input, the boundary detector mean-pools its feature sequence when the self-similarity matrix would exceed the native integer index cap. Boundary `time` values remain in the original audio timeline; on very long files, the diagnostic `frame` field refers to the pooled analysis grid, so UI code should place markers from `time`, not from `frame`.

## Then labels

After boundaries are found, the implementation classifies each span using several clues:

| Clue | What it helps identify |
|------|------------------------|
| Normalized energy | Whether a span feels like a high-energy or low-energy section |
| Chroma similarity to other spans | Whether the same harmonic material returns elsewhere |
| Vocal-likelihood descriptor | Whether the span is likely to contain a lead vocal or vocal-like material |

Typical outcomes are heuristic:

| Pattern | Likely label |
|---------|--------------|
| Repeated, high-energy, vocal-like span | Chorus |
| Repeated, lower-energy span | Verse |
| Low-energy first or last span | Intro / outro |
| Distinctive interior span with low vocal likelihood | Instrumental / bridge |

These labels are intentionally heuristic. They are good for orientation, not for declaring a canonical song form.

## Why the result is an estimate

Song structure is partly subjective. Two listeners may disagree about the exact start of a chorus, and different genres use different cues. A techno track and a ballad do not announce sections in the same way.

Treat section output as a strong hint for navigation, looping, and visualization. It works best on music with clear repeated sections, and it is weaker on through-composed, ambient, or very gradual material. A boundary being a few seconds off is normal, so automatic results are best used as a starting point for review.

::: details How libsonare computes it
`BoundaryDetector` combines MFCC and chroma features, L2-normalizes them, mean-pools long inputs when needed, builds a cosine self-similarity matrix, computes a checkerboard novelty curve, and picks boundary peaks. `SectionAnalyzer` turns boundaries into spans, computes RMS energy, chroma descriptors, spectral flatness, and vocal-band energy, then assigns `Intro`, `Verse`, `Pre-Chorus`, `Chorus`, `Bridge`, `Instrumental`, `Outro`, or `Unknown` labels with confidence.
:::

Related: [Mel, MFCC, and Timbre](./mel-mfcc-timbre.md), [Chroma Features](./chroma-features.md), [MIR Overview](../concepts/mir-overview.md)
