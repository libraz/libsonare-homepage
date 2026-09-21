/**
 * Every full-page demo, in the order the switcher and the demo index list them.
 *
 * One row per demo directory under `src/demos/`. `dir` is the repo-relative path
 * holding that demo's whole source — entry component, composables, worker and
 * styles — so the demo header can link a visitor straight to the code behind the
 * page. `listed: false` keeps a page out of the demo switcher and the demo index
 * without hiding its source link.
 */
export const DEMO_MANIFEST = [
  { id: 'analyzer', route: '/analyzer', dir: 'src/demos/analyzer', listed: true },
  { id: 'mastering', route: '/mastering', dir: 'src/demos/mastering', listed: true },
  { id: 'analysis', route: '/music-analysis', dir: 'src/demos/music-analysis', listed: true },
  { id: 'mixing', route: '/mixing', dir: 'src/demos/mixing', listed: true },
  { id: 'fx', route: '/realtime-fx', dir: 'src/demos/realtime-fx', listed: true },
  { id: 'spatial', route: '/spatial', dir: 'src/demos/spatial', listed: true },
  { id: 'synth', route: '/synth', dir: 'src/demos/synth', listed: true },
  { id: 'studio', route: '/studio', dir: 'src/demos/studio', listed: true },
  { id: 'practice', route: '/practice', dir: 'src/demos/practice', listed: true },
] as const;

export type DemoManifestEntry = (typeof DEMO_MANIFEST)[number];

/** Every demo page, including the ones kept out of the switcher. */
export type DemoId = DemoManifestEntry['id'];

export type ListedDemoEntry = Extract<DemoManifestEntry, { listed: true }>;

/** The demos the switcher and the demo index carry. */
export type ListedDemoId = ListedDemoEntry['id'];

/** This site's own repository — the demos link to their source inside it. */
export const REPO_URL = 'https://github.com/libraz/libsonare-homepage';

/** The demos the switcher and the demo index carry, in listing order. */
export const LISTED_DEMOS = DEMO_MANIFEST.filter((demo): demo is ListedDemoEntry => demo.listed);

export function demoManifest(id: DemoId): DemoManifestEntry {
  const entry = DEMO_MANIFEST.find((demo) => demo.id === id);
  if (!entry) throw new Error(`Unknown demo id: ${id}`);
  return entry;
}

/** Browsable URL of a demo's source directory. */
export function demoSourceUrl(id: DemoId): string {
  return `${REPO_URL}/tree/main/${demoManifest(id).dir}`;
}
