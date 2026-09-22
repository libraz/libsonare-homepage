# Demos

One directory per demo. Each holds everything that demo needs — entry
component, sub-components, composables, worker, styles and copy — so a visitor
can read a single directory and see the whole thing, and the demo pages link
here directly from their header.

| Directory | Page | Entry |
| --- | --- | --- |
| [`analyzer/`](analyzer) | `/analyzer` | `AnalyzerDemo.vue` |
| [`mastering/`](mastering) | `/mastering` | `MasteringDemo.vue` |
| [`music-analysis/`](music-analysis) | `/music-analysis` | `MusicAnalysisStudio.vue` |
| [`mixing/`](mixing) | `/mixing` | `MixingStudio.vue` |
| [`realtime-fx/`](realtime-fx) | `/realtime-fx` | `RealtimeFxLab.vue` |
| [`spatial/`](spatial) | `/spatial` | `SpatialScanner.vue` |
| [`synth/`](synth) | `/synth` | `SynthDemo.vue` |
| [`studio/`](studio) | `/studio` | `StudioDemo.vue` |
| [`practice/`](practice) | `/practice` | `PianoPracticeDemo.vue` |
| [`gs-module/`](gs-module) | `/gs-module` | `GsModuleDemo.vue` |
| [`inline/`](inline) | `<SonareDemo>` widgets in the docs | `SonareDemo.vue` |

`manifest.ts` is the one table binding an id to its route and its directory.
The switcher tabs, the demo index cards and the source link in each demo header
all read it, so adding a demo means adding a row rather than editing three
lists.

## Rules

- **A demo directory imports only from itself and from the shared layer.**
  Shared code lives in `src/components/` (chrome, `ui/` primitives, the
  keyboard), `src/composables/` (i18n, theme, WASM boot, MIDI input) and
  `src/utils/`. Two demos needing the same file is the signal to move it into
  the shared layer, not to reach across.
- Anything reused by a second demo moves out in the same change that introduces
  the second use.
- `tests/demos/manifest.test.ts` enforces both the layout and the
  no-cross-import rule, and mirrors the directories under `tests/demos/`.

Routes are wired in `.vitepress/theme/Layout.vue`, which selects a demo from the
page's `layout:` frontmatter and loads it as its own chunk.
