import { type AsyncComponentLoader, defineAsyncComponent, h } from 'vue';
import type { DemoId } from '@/demos/manifest';
import DemoPagePending from './DemoPagePending.vue';
import { DemoLoadError } from './defineDemoAsync';

/** A whole demo page split out of the theme: the site shell stays visible while its chunk loads. */
export function defineDemoPageAsync(demoId: DemoId, loader: AsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: () => h(DemoPagePending, { demoId }),
    errorComponent: DemoLoadError,
    delay: 0,
    timeout: 30_000,
  });
}
