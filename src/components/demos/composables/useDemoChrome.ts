import { type ComputedRef, computed, type Ref, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';

export type DemoStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DemoTone = DemoStatus | 'playing';

export interface DemoChromeState {
  locale: ComputedRef<DemoLocale>;
  title: ComputedRef<string>;
  caption: ComputedRef<string>;
  status: Ref<DemoStatus>;
  errorMsg: Ref<string>;
  tone: ComputedRef<DemoTone>;
  fail: (error: unknown) => void;
}

/**
 * Shared document-demo chrome state: localized labels plus the status/tone pair
 * consumed by DemoFrame. Archetypes keep ownership of their state labels because
 * those are domain-specific.
 */
export function useDemoChrome(
  def: SonareDemoDef,
  isPlaying: ComputedRef<boolean>,
): DemoChromeState {
  const { locale } = useI18n();
  const loc = computed<DemoLocale>(() => locale.value);
  const title = computed(() => localized(def.title, loc.value));
  const caption = computed(() => localized(def.caption, loc.value));
  const status = ref<DemoStatus>('idle');
  const errorMsg = ref('');

  const tone = computed<DemoTone>(() => {
    if (status.value === 'error') return 'error';
    if (status.value === 'loading') return 'loading';
    if (isPlaying.value) return 'playing';
    if (status.value === 'ready') return 'ready';
    return 'idle';
  });

  function fail(error: unknown): void {
    status.value = 'error';
    errorMsg.value = error instanceof Error ? error.message : String(error);
  }

  return { locale: loc, title, caption, status, errorMsg, tone, fail };
}
