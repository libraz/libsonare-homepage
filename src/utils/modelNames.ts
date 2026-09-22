/**
 * What to call a thing whose standard name is a machine's model number.
 *
 * The site prints no hardware model designations, and the substitution has to
 * read the same wherever it appears: the sound module's kit browser takes its
 * names from the engine at runtime, while the inline kit audition lists the
 * same sets as static copy. Both resolve here so the two cannot drift apart.
 */

/** A display name in both languages the site serves. */
export interface LocalizedName {
  en: string;
  ja: string;
}

/**
 * A model designation: a short letter cluster bound to a number, with or
 * without a hyphen. The same shape the generated-data guard refuses, expressed
 * once more here because names fetched from the engine at runtime never pass
 * through the generator.
 */
export const MODEL_DESIGNATION =
  /\b[A-Za-z]{2,5}-\d{2,5}[A-Za-z]{0,3}\b|\b[A-Za-z]{2,5}\d{3,5}[A-Za-z]{0,3}\b/;

/**
 * Rhythm sets whose standard name is a machine's model number.
 *
 * Keyed by program, because the slot is what the substitution is about, and
 * each entry says what kind of machine the set voices rather than which one.
 */
export const RHYTHM_SET_KINDS: Readonly<Record<number, LocalizedName>> = {
  25: { en: 'Analog Machine', ja: 'アナログマシン' },
  27: { en: 'Rhythm Box', ja: 'リズムボックス' },
  28: { en: 'Compact Machine', ja: 'コンパクトマシン' },
  29: { en: 'Digital Machine', ja: 'デジタルマシン' },
  30: { en: 'Hybrid Machine', ja: 'ハイブリッドマシン' },
  127: { en: 'Legacy Map', ja: 'レガシーマップ' },
};

/**
 * The name to show for a rhythm set the engine reports.
 *
 * Most sets are named for their sound and pass through unchanged. Six are named
 * after particular drum machines, and those show the kind of machine instead.
 * The program number is displayed beside the name either way, and it is the
 * identifier a file actually selects — nothing addressable is lost.
 *
 * The pattern is the guard, not the table: a name that looks like a model
 * designation and has no entry falls back to its slot number, so a set added
 * upstream cannot put one on screen.
 */
export function rhythmSetLabel(program: number, engineName: string): string {
  if (!MODEL_DESIGNATION.test(engineName)) return engineName;
  return RHYTHM_SET_KINDS[program]?.en ?? `Set ${program}`;
}
