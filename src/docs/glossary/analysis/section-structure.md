---
title: Section and Structure
description: Boundaries, self-similarity, repeated sections, energy, and vocal likelihood — how libsonare labels song sections.
---

# Section and Structure

**Section analysis** divides a track into longer musical spans such as intro, verse, chorus, bridge, instrumental, and outro. It is a structural estimate: useful for navigation and visualization, but not a replacement for a producer's arrangement notes.

Use it to navigate a track, set loop points around a chorus, or build a structural visualization — anywhere you need an approximate map of the song's large-scale form.

For newcomers, think of section analysis as building a map of the song. It looks at large spans such as an intro, verse-like area, chorus-like area, or bridge-like area, rather than short events like individual beats or chords.

## Reading a self-similarity matrix

The central tool is the **self-similarity matrix (SSM)**. It compares every moment of a feature sequence against every other moment.

You can read it as a "which parts sound alike?" table:

| Pattern in the SSM | Meaning |
|--------------------|---------|
| Bright cell | These two times sound similar |
| Block along the diagonal | A span is internally consistent, so it may be one section |
| Stripe away from the diagonal | Two different times sound similar, often a repeated chorus or repeated verse |

<SectionMatrixFigure
  title="From repetition to a section list"
  caption="Each A section is similar to itself along the diagonal and to the other A sections off it — those off-diagonal blocks are the repetition cue. The novelty curve measures how sharply the matrix changes from one moment to the next, and its peaks are where boundaries get placed."
/>

Two signals are especially useful:

- **Novelty** means the SSM changes suddenly. It helps find boundaries.
- **Repetition** means similar material appears in separate places. It helps group recurring sections.

Novelty alone tends to split too much. Repetition alone can miss one-off parts. libsonare combines both.

## Boundaries first

libsonare detects section boundaries by building frame-level features, computing a self-similarity matrix, and looking for novelty peaks. The default feature mix uses MFCC and chroma, so boundaries can come from timbre changes, harmonic changes, or both.

`minSectionSec` (default 4 s) does two jobs. It sets the minimum spacing between novelty peaks, and a merge pass afterwards folds any span still shorter than it into a neighbour — so it is a real floor on the length of a returned section. The one exception is a lone whole-track section: when merging leaves a single span, it is returned whatever its length. The leading and trailing spans are bounded by the file edges rather than by two peaks, and very short edits, drops, or pickup bars are absorbed into neighboring spans rather than returned on their own.

For long-form input, the boundary detector mean-pools its feature sequence when the self-similarity matrix would exceed the native integer index cap. Boundary `time` values remain in the original audio timeline; on very long files, the diagnostic `frame` field refers to the pooled analysis grid, so UI code should place markers from `time`, not from `frame`.

The boundary stage is reachable on its own, without the labelling that follows it: `detectBoundaries` / `detect_boundaries` returns the transitions **and** the novelty curve they were picked from, which is what a caller applying its own threshold needs. See [`detectBoundaries(request)`](../../js-api-analysis.md#detectboundaries-request).

## Then labels

Before anything is labelled, adjacent segments whose chroma is indistinguishable are merged, so a novelty peak that fell inside one continuous stretch of music does not survive as a boundary.

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
| Distinctive interior span with low vocal likelihood | Instrumental |
| Distinctive interior span that still reads as vocal | Bridge |

::: info Uniform material is given no form at all
Repetition is only evidence when some pairs of sections repeat and others do not. When nearly every pair counts as a repetition of every other — which is what uniform material looks like — the repetition cue carries no information, and it is treated that way rather than as evidence for a verse/chorus alternation. Eight identical bars therefore come back unlabelled instead of as a full verse/chorus form.
:::

::: warning `Unknown` is an answer, not an absence
`PreChorus` has no detection branch, so filtering a section list on it always yields nothing and a pre-chorus is never detected.

`Unknown` is the opposite. It is a first-class result on three paths: the segmenter found no boundaries at all and the whole track is one span; the span matched none of the positive branches above; or the evidence for a musical function was there but too weak to assert. The first case reports `confidence` 0, and the last keeps the sub-threshold score so you can see how close the span came to a label. Filtering `Unknown` out of the result therefore drops real stretches of the track rather than padding — to drop only the unclassifiable ones, test the confidence too.
:::

These labels are intentionally heuristic. They are good for orientation, not for declaring a canonical song form.

## Why the result is an estimate

Song structure is partly subjective. Two listeners may disagree about the exact start of a chorus, and different genres use different cues. A techno track and a ballad do not announce sections in the same way.

Treat section output as a strong hint for navigation, looping, and visualization. It works best on music with clear repeated sections, and it is weaker on through-composed material (music that keeps developing instead of repeating sections), ambient, or very gradual material. A boundary being a few seconds off is normal, so automatic results are best used as a starting point for review.

::: details How libsonare computes it
`BoundaryDetector` combines MFCC and chroma features, L2-normalizes them, mean-pools long inputs when needed, builds a cosine self-similarity matrix, computes a checkerboard novelty curve, and picks boundary peaks. `SectionAnalyzer` turns boundaries into spans, computes RMS energy, chroma descriptors, spectral flatness, and vocal-band energy, then assigns `Intro`, `Verse`, `Chorus`, `Bridge`, `Instrumental`, `Outro`, or `Unknown` labels with confidence. Two guards run before classification: `merge_indistinct_sections` collapses neighbours whose mean chroma does not separate them, and the repetition cue is discounted when it fires on nearly every pair. `PreChorus` is the one `SectionType` value with no classifier branch, so a `switch` arm for it is dead code.
:::

Related: [Mel, MFCC, and Timbre](./mel-mfcc-timbre.md), [Chroma Features](./chroma-features.md), [MIR Overview](../concepts/mir-overview.md)
