/**
 * The deck's modules, the chapters printed over it, and what each chapter lights.
 *
 * A chapter is metadata only: which modules it is about, where its annotation
 * card sits, which phrase it plays, and what it is called. The prose and the
 * comparisons live in `SynthChapters.vue`, keyed by the same id.
 *
 * `noteArea` is chosen per chapter so the card never covers a module the
 * chapter lights and never covers the patchbay. Every value stays in row 1,
 * whose height is fixed, so the deck holds still when a chapter changes.
 */
import type { LocalizedName } from './classicSynthCopy';
import type { ParamGroup } from './classicSynthState';

/**
 * One region of the instrument, in deck order. `groups` names the parameter
 * sections printed inside it; `matrix` has none because it holds the patchbay.
 */
export const DECK_MODULES = [
  { id: 'osc', groups: ['osc'], area: 'osc' },
  { id: 'filter', groups: ['filter'], area: 'filter' },
  { id: 'env', groups: ['amp', 'filter-env'], area: 'env' },
  { id: 'lfo', groups: ['lfo'], area: 'lfo' },
  { id: 'matrix', groups: [], area: 'matrix' },
  { id: 'body', groups: ['body'], area: 'body' },
  { id: 'out', groups: ['out'], area: 'out' },
] as const satisfies readonly { id: string; groups: readonly ParamGroup[]; area: string }[];

export type DeckModule = (typeof DECK_MODULES)[number];
export type ModuleId = DeckModule['id'];

export interface Chapter {
  id: string;
  title: LocalizedName;
  /** Deck modules this chapter is about. Every other module dims. */
  modules: ModuleId[];
  /** Where the annotation card sits, as CSS grid lines: row/col start, row/col end. */
  noteArea: string;
  /** Which phrase its comparisons and its play button use. */
  phraseId: string;
}

const ALL_MODULES: ModuleId[] = DECK_MODULES.map((module) => module.id);

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'sound',
    title: { en: 'Make a sound', ja: 'まず鳴らす' },
    modules: ['osc', 'out'],
    noteArea: '1 / 2 / 2 / 4',
    phraseId: 'sustain',
  },
  {
    id: 'waveform',
    title: { en: 'The waveform', ja: '波形' },
    modules: ['osc'],
    noteArea: '1 / 2 / 2 / 4',
    phraseId: 'sustain',
  },
  {
    id: 'filter',
    title: { en: "The filter's four characters", ja: 'フィルタの 4 つの人格' },
    modules: ['filter'],
    noteArea: '1 / 3 / 2 / 5',
    phraseId: 'sustain',
  },
  {
    id: 'envelope',
    title: { en: 'Envelopes', ja: 'エンベロープ' },
    // The filter module is in scope too: the filter envelope reaches the sound
    // only through the cutoff amount, which lives there.
    modules: ['env', 'filter'],
    noteArea: '1 / 1 / 2 / 3',
    phraseId: 'staccato',
  },
  {
    id: 'modulation',
    title: { en: 'LFOs and the mod matrix', ja: 'LFO とモジュレーション行列' },
    modules: ['lfo', 'matrix'],
    noteArea: '1 / 1 / 2 / 4',
    phraseId: 'gesture',
  },
  {
    id: 'body',
    title: { en: 'Body resonance', ja: 'ボディ共鳴' },
    modules: ['body'],
    noteArea: '1 / 1 / 2 / 3',
    phraseId: 'staccato',
  },
  {
    id: 'thickness',
    title: { en: 'Thickness and width', ja: '厚みと広がり' },
    modules: ['osc', 'out'],
    noteArea: '1 / 2 / 2 / 4',
    phraseId: 'chord',
  },
  {
    id: 'playground',
    title: { en: 'Playground', ja: 'プレイグラウンド' },
    modules: ALL_MODULES,
    noteArea: '1 / 1 / 2 / 4',
    phraseId: 'range',
  },
];

export function chapterOf(id: string): Chapter {
  const chapter = CHAPTERS.find((candidate) => candidate.id === id);
  if (!chapter) throw new Error(`Unknown chapter: ${id}`);
  return chapter;
}
