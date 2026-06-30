# Inline Demo Architecture

The documentation demos are organized so an OSS user can reuse one layer without
copying the whole site.

## Layers

- `src/demos/registry/` contains data-only demo definitions. Markdown references
  a stable id through `<SonareDemo id="..." />`.
- `SonareDemo.vue` is the dispatcher. It resolves ids, lazy-activates demos near
  the viewport, and selects an archetype component.
- `DemoFrame.vue` and `DemoControls.vue` are shared UI chrome. Archetypes pass
  state and render only their visual screen plus optional controls.
- `archetypes/` contains demo-specific behavior. Each archetype owns one
  interaction pattern, such as signal generation, parameter sweeps, detectors, or
  meters.
- `composables/` contains reusable archetype state: localization, frame tone,
  errors, and registry-backed parameter defaults.
- `canvas.ts` contains the canvas sizing helper shared by visual archetypes.
- `src/demos/audio/` contains dependency-free audio helpers that can be reused
  outside Vue components.
- `src/components/demos/index.ts` and `src/demos/index.ts` are the intended
  import entrypoints for consumers copying or packaging the demo layer.

## Adding an Archetype

1. Add the archetype key to `DemoArchetype` in `src/demos/types.ts`.
2. Add an async component mapping in `archetypes/index.ts`.
3. Build the component from `DemoFrame`, `DemoControls`, `useDemoChrome`, and
   `useDemoParams`.
4. Add data-only registry entries under `src/demos/registry/`.
5. Add focused tests for any shared logic you introduce.

Keep reusable signal processing and drawing primitives out of `.vue` files when
they are not tied to template state. This keeps demos easier to audit, test, and
lift into third-party examples.

## Public Imports

```ts
import { DemoFrame, SonareDemo, useDemoChrome } from '@/components/demos';
import { getDemo, localized, peakNormalize } from '@/demos';
```
