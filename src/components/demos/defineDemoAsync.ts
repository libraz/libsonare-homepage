import { type AsyncComponentLoader, defineAsyncComponent } from 'vue';
import DemoLoadPending from './DemoLoadPending.vue';

// Keep VitePress-bound i18n code out of the normal demo registry import path.
// The recovery UI itself is loaded only if a demo chunk fails.
const DemoLoadError = defineAsyncComponent(() => import('./DemoLoadError.vue'));

/** Shared loader policy for every demo-facing code split. */
export function defineDemoAsync(loader: AsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: DemoLoadPending,
    errorComponent: DemoLoadError,
    delay: 150,
    timeout: 30_000,
  });
}
