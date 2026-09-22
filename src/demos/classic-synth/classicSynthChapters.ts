/**
 * The voice deck's sections, the chapters printed over them, and what each
 * chapter lights.
 *
 * A section lists its faders explicitly rather than deriving them from a
 * parameter group, because the panel cuts one group two ways: the high-pass
 * fader stands in its own HPF section while the rest of the `filter` group is
 * the VCF. `groups` stays as the contract a section's faders must satisfy, and
 * it is checked once at load.
 *
 * A chapter is metadata only: which sections it is about, whether the assign
 * block is in scope, which phrase it plays, and what it is called. The prose
 * and the comparisons live in `SynthChapters.vue`, keyed by the same id.
 */
import type { LocalizedName } from './classicSynthCopy';
import { type NumericParamKey, type ParamGroup, paramOf } from './classicSynthState';

/**
 * One section of the voice deck, in panel order. `legend` is the silkscreen
 * printed over it, `groups` the parameter groups it may print, `faders` the
 * amounts it prints in order, and `area` the layout hook the stylesheet keys on.
 */
export const DECK_MODULES = [
  {
    id: 'lfo',
    legend: 'LFO',
    groups: ['lfo'],
    area: 'lfo',
    faders: ['lfoRateHz', 'lfoToPitchCents', 'lfo2RateHz'],
  },
  {
    id: 'dco',
    legend: 'DCO',
    groups: ['osc'],
    area: 'dco',
    faders: ['unison', 'detuneCents', 'driftCents', 'drive'],
  },
  { id: 'hpf', legend: 'HPF', groups: ['filter'], area: 'hpf', faders: ['hpCutoffHz'] },
  {
    id: 'vcf',
    legend: 'VCF',
    groups: ['filter'],
    area: 'vcf',
    faders: ['cutoffHz', 'resonanceQ', 'keyTrack', 'envToCutoffCents', 'velToCutoffCents'],
  },
  {
    id: 'env-a',
    legend: 'ENV-A',
    groups: ['amp'],
    area: 'env-a',
    faders: ['ampAttackMs', 'ampDecayMs', 'ampSustain', 'ampReleaseMs'],
  },
  {
    id: 'env-f',
    legend: 'ENV-F',
    groups: ['filter-env'],
    area: 'env-f',
    faders: ['filterAttackMs', 'filterDecayMs', 'filterSustain', 'filterReleaseMs'],
  },
  { id: 'body', legend: 'BODY', groups: ['body'], area: 'body', faders: ['bodyMix'] },
  {
    id: 'out',
    legend: 'OUT',
    groups: ['out'],
    area: 'out',
    faders: ['glideMs', 'stereoSpread', 'gain', 'busDrive'],
  },
] as const satisfies readonly {
  id: string;
  legend: string;
  groups: readonly ParamGroup[];
  area: string;
  faders: readonly NumericParamKey[];
}[];

export type DeckModule = (typeof DECK_MODULES)[number];
export type ModuleId = DeckModule['id'];

for (const module of DECK_MODULES) {
  for (const key of module.faders) {
    if (!(module.groups as readonly ParamGroup[]).includes(paramOf(key).group)) {
      throw new Error(`Fader ${key} is printed in ${module.id}, which does not own its group`);
    }
  }
}

export interface Chapter {
  id: string;
  title: LocalizedName;
  /** Deck sections this chapter is about. Every other section dims. */
  modules: ModuleId[];
  /** Whether the assign block (the patchbay) is in scope and opens with the chapter. */
  patchbay: boolean;
  /** Which phrase its comparisons and its play button use. */
  phraseId: string;
}

const ALL_MODULES: ModuleId[] = DECK_MODULES.map((module) => module.id);

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'sound',
    title: { en: 'Make a sound', ja: 'まず鳴らす' },
    modules: ['dco', 'out'],
    patchbay: false,
    phraseId: 'sustain',
  },
  {
    id: 'waveform',
    title: { en: 'The waveform', ja: '波形' },
    modules: ['dco'],
    patchbay: false,
    phraseId: 'sustain',
  },
  {
    id: 'filter',
    title: { en: "The filter's four characters", ja: 'フィルタの 4 つの人格' },
    modules: ['vcf'],
    patchbay: false,
    phraseId: 'sustain',
  },
  {
    id: 'envelope',
    title: { en: 'Envelopes', ja: 'エンベロープ' },
    // The VCF is in scope too: the filter envelope reaches the sound only
    // through the envelope amount, which lives there.
    modules: ['env-a', 'env-f', 'vcf'],
    patchbay: false,
    phraseId: 'staccato',
  },
  {
    id: 'modulation',
    title: { en: 'LFOs and the mod matrix', ja: 'LFO とモジュレーション行列' },
    modules: ['lfo'],
    patchbay: true,
    phraseId: 'gesture',
  },
  {
    id: 'body',
    title: { en: 'Body resonance', ja: 'ボディ共鳴' },
    modules: ['body'],
    patchbay: false,
    phraseId: 'staccato',
  },
  {
    id: 'thickness',
    title: { en: 'Thickness and width', ja: '厚みと広がり' },
    modules: ['dco', 'out'],
    patchbay: false,
    phraseId: 'chord',
  },
  {
    id: 'playground',
    title: { en: 'Playground', ja: 'プレイグラウンド' },
    modules: ALL_MODULES,
    patchbay: true,
    phraseId: 'range',
  },
];

export function chapterOf(id: string): Chapter {
  const chapter = CHAPTERS.find((candidate) => candidate.id === id);
  if (!chapter) throw new Error(`Unknown chapter: ${id}`);
  return chapter;
}
