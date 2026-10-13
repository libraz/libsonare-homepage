import { type ComputedRef, computed, type InjectionKey, inject } from 'vue';
import { enCopy, type MixingCopy } from '@/demos/mixing/mixingCopy';

export type MixingTermKey = keyof typeof enCopy.terms.items;

export const MIXING_TERM_SLUGS: Record<MixingTermKey, string | undefined> = {
  inputMeter: 'concepts/gain-staging',
  trim: 'concepts/gain-staging',
  fader: 'concepts/gain-staging',
  masterFader: 'concepts/gain-staging',
  pan: 'concepts/audio-basics',
  width: 'concepts/mono-compatibility',
  polarity: 'concepts/mono-compatibility',
  correlation: 'concepts/mono-compatibility',
  lufs: 'concepts/loudness-matching',
  truePeak: 'concepts/true-peak-safety',
  goniometer: 'concepts/mono-compatibility',
  panLaw: 'concepts/mixing-basics',
  panMode: 'concepts/mixing-basics',
  dualPan: 'concepts/mixing-basics',
  channelDelay: 'concepts/mixing-basics',
  soloSafe: undefined,
  eq: 'concepts/mixing-basics',
  gate: 'concepts/dynamic-range',
  compressor: 'concepts/dynamic-range',
  deesser: 'concepts/dynamic-range',
  ducking: 'concepts/mixing-basics',
  gainReduction: 'concepts/dynamic-range',
  send: 'concepts/mixing-basics',
  reverb: 'concepts/mixing-basics',
  delay: 'concepts/mixing-basics',
  vcaGroup: 'concepts/mixing-basics',
  automation: 'concepts/mixing-basics',
  curve: 'concepts/mixing-basics',
  mute: undefined,
  solo: undefined,
  glue: 'concepts/dynamic-range',
  limiter: 'concepts/true-peak-safety',
  dither: 'concepts/audio-basics',
  budget: 'concepts/browser-local-processing',
  assistant: 'concepts/mixing-basics',
  group: 'concepts/mixing-basics',
  routing: 'concepts/mixing-basics',
  clip: 'arrangement/clips-and-tracks',
  bounce: 'arrangement/bounce-and-rendering',
};

/** Props for `TermLabel` / `Tooltip`: the term's help text and its glossary link. */
export interface MixingTermProps {
  eyebrow: string;
  title: string;
  body: string;
  tip: string;
  tipLabel: string;
  defaultValue?: string;
  defaultLabel: string;
  href?: string;
  linkLabel: string;
  compact: boolean;
}

export type MixingTerm = (key: MixingTermKey, compact?: boolean) => MixingTermProps;

/** Builds the term lookup for one locale's copy and glossary base path. */
export function createMixingTerm(
  copy: ComputedRef<MixingCopy>,
  glossaryBase: ComputedRef<string>,
): MixingTerm {
  return (key, compact = false) => {
    const { terms } = copy.value;
    const item: { title: string; body: string; tip: string; default?: string } = terms.items[key];
    const slug = MIXING_TERM_SLUGS[key];
    return {
      eyebrow: terms.eyebrow,
      title: item.title,
      body: item.body,
      tip: item.tip,
      tipLabel: terms.tipLabel,
      defaultValue: item.default,
      defaultLabel: terms.defaultLabel,
      href: slug ? `${glossaryBase.value}/${slug}` : undefined,
      linkLabel: terms.linkLabel,
      compact,
    };
  };
}

/** Injection key of the page's term lookup. */
export const MIXING_TERM: InjectionKey<MixingTerm> = Symbol('mixing-term');

const englishTerm = createMixingTerm(
  computed(() => enCopy),
  computed(() => '/docs/glossary'),
);

/** The term lookup the page provides; English when mounted on its own. */
export function useMixingTerm(): MixingTerm {
  return inject(MIXING_TERM, englishTerm);
}
