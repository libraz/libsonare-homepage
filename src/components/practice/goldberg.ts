/**
 * Catalog of the bundled Goldberg Variations (BWV 988): the Aria, all thirty
 * variations, and the Aria da capo. The `.mid` files are generated from the
 * verified bach-mcp reference transcription by `scripts/generate-practice-assets.mjs`
 * (`yarn generate:practice`) into `src/public/midi/goldberg/NN.mid`.
 *
 * Each entry carries a localized short label (for the piece selector) and an
 * optional character tag — the canon interval or the named form (Fughetta,
 * Ouverture, Quodlibet, …) — so the selector reads like a real program.
 */

export interface GoldbergMovement {
  /** Movement number: 0 = Aria, 1–30 = variations, 31 = Aria da capo. */
  no: number;
  /** Public URL of the generated single-track MIDI. */
  file: string;
  labelEn: string;
  labelJa: string;
  /** Character of the movement (canon interval / named form), when notable. */
  tagEn?: string;
  tagJa?: string;
}

/** Character tags keyed by movement number (canons + named forms). */
const TAGS: Record<number, { en: string; ja: string }> = {
  3: { en: 'Canon at the unison', ja: 'ユニゾンのカノン' },
  6: { en: 'Canon at the second', ja: '2度のカノン' },
  9: { en: 'Canon at the third', ja: '3度のカノン' },
  10: { en: 'Fughetta', ja: 'フゲッタ' },
  12: { en: 'Canon at the fourth', ja: '4度のカノン' },
  15: { en: 'Canon at the fifth · Andante', ja: '5度のカノン・アンダンテ' },
  16: { en: 'Ouverture', ja: '序曲（フランス風）' },
  18: { en: 'Canon at the sixth', ja: '6度のカノン' },
  21: { en: 'Canon at the seventh', ja: '7度のカノン' },
  22: { en: 'Alla breve', ja: 'アラ・ブレーヴェ' },
  24: { en: 'Canon at the octave', ja: '8度のカノン' },
  25: { en: 'Adagio', ja: 'アダージョ' },
  27: { en: 'Canon at the ninth', ja: '9度のカノン' },
  30: { en: 'Quodlibet', ja: 'クォドリベット' },
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Build the 32-movement catalog (Aria, Var. 1–30, Aria da capo). */
export const GOLDBERG: GoldbergMovement[] = Array.from({ length: 32 }, (_, no) => {
  const tag = TAGS[no];
  let labelEn: string;
  let labelJa: string;
  if (no === 0) {
    labelEn = 'Aria';
    labelJa = 'アリア';
  } else if (no === 31) {
    labelEn = 'Aria da Capo';
    labelJa = 'アリア・ダ・カーポ';
  } else {
    labelEn = `Var. ${no}`;
    labelJa = `第${no}変奏`;
  }
  return {
    no,
    file: `/midi/goldberg/${pad2(no)}.mid`,
    labelEn,
    labelJa,
    tagEn: tag?.en,
    tagJa: tag?.ja,
  };
});

/** The Aria — the default piece the demo opens on. */
export const GOLDBERG_DEFAULT = GOLDBERG[0];
