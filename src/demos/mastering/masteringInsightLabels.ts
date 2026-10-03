/**
 * Visitor-facing wording for what the mastering assistant returns: its
 * rationale lines and the chain keys the project could not take. The engine
 * writes both for developers (dotted config keys, English notes), so the page
 * words them itself and keeps an unknown line as the engine wrote it.
 */
import type { MasteringCopy } from '@/demos/mastering/masteringCopy';
import { CHAIN_STAGE_SLOTS } from '@/demos/mastering/masteringPresetMap';
import { MASTERING_INSERT_LAYOUT } from '@/demos/mastering/masteringState';
import type { MasteringPresetId } from '@/demos/mastering/useMastering';

/** Assistant preset ids whose page preset id is spelled differently. */
const PAGE_PRESET: Readonly<Record<string, MasteringPresetId>> = { hipHop: 'hiphop' };

/** One assistant rationale line in the page's words. */
export function assistantNoteText(note: string, copy: MasteringCopy): string {
  const notes = copy.insights.notes;
  const base = note.match(/^base preset: (\w+)$/);
  if (base) {
    const id = (PAGE_PRESET[base[1]] ?? base[1]) as MasteringPresetId;
    const name = copy.presets[id]?.name;
    return name ? notes.basePreset.replace('{preset}', name) : note;
  }
  if (note.startsWith('target loudness and ceiling applied from ')) return notes.assistantTarget;
  if (note.startsWith('speech preset enables ')) return notes.speechPreset;
  return note;
}

/**
 * Labels for the chain keys the assistant suggested and the project could not
 * take. Loudness-stage extras fold into one label: the loudness fit owns them.
 */
export function unmappedLabels(keys: readonly string[], copy: MasteringCopy): string[] {
  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const key of keys) {
    const dot = key.lastIndexOf('.');
    const stage = key.slice(0, dot);
    const leaf = key.slice(dot + 1);
    if (stage === 'loudness') {
      add(copy.insights.unmappedLoudness);
      continue;
    }
    const slot = CHAIN_STAGE_SLOTS[stage];
    const module = slot === undefined ? undefined : MASTERING_INSERT_LAYOUT[slot]?.id;
    if (!module) {
      add(key);
      continue;
    }
    const param = (copy.params as Readonly<Record<string, string>>)[leaf] ?? leaf;
    add(`${copy.modules[module]} · ${param}`);
  }
  return labels;
}
