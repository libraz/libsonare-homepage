<script setup lang="ts">
/**
 * GM program picker (custom listbox). A native <select> can't render the
 * out-of-scope marker as anything but plain option text, so this popover lists
 * the 128 programs grouped by family and tags each slot voiced by a non-physical
 * engine (FM / subtractive / additive) with a chip. Those rows are disabled — the
 * tool only tunes the twelve physical models — so they can't be chosen, only seen.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { GM_FAMILIES, gmVoicing, type SynthMode } from '@/components/tuner/gmTargets';

const props = defineProps<{
  modelValue: number;
  /** Localized program names (128, program-indexed). */
  programNames: string[];
  /** Localized GM family names (16, family-order). */
  familyNames: string[];
  /** Localized FM / Subtractive / Additive labels. */
  synthLabels: Record<SynthMode, string>;
  /** Short "not tunable here" chip caption. */
  outOfScopeLabel: string;
  /** Accessible name for the listbox. */
  ariaLabel: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [program: number] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
/** Keyboard-highlighted program while the popover is open. */
const activeProgram = ref(props.modelValue);
/** Fixed-position box for the teleported popover (dodges card overflow clip). */
const popStyle = ref<Record<string, string>>({});

interface Row {
  program: number;
  name: string;
  synth: SynthMode | null;
}
interface Group {
  name: string;
  rows: Row[];
}

const groups = computed<Group[]>(() =>
  GM_FAMILIES.map((fam, i) => {
    const end = i + 1 < GM_FAMILIES.length ? GM_FAMILIES[i + 1].start : 128;
    const rows: Row[] = [];
    for (let p = fam.start; p < end; ++p) {
      const v = gmVoicing(p);
      rows.push({
        program: p,
        name: props.programNames[p] ?? '',
        synth: v.kind === 'synth' ? v.mode : null,
      });
    }
    return { name: props.familyNames[i] ?? fam.name, rows };
  }),
);

/** Programs that can actually be selected (physical-model slots), in order. */
const selectable = computed<number[]>(() =>
  groups.value.flatMap((g) => g.rows.filter((r) => !r.synth).map((r) => r.program)),
);

const triggerLabel = computed(() => {
  const p = props.modelValue;
  return `${String(p).padStart(3, '0')} · ${props.programNames[p] ?? ''}`;
});

function toggle(): void {
  open.value ? close() : openPanel();
}

function openPanel(): void {
  open.value = true;
  activeProgram.value = props.modelValue;
  reposition();
  void nextTick(() => {
    reposition();
    scrollActiveIntoView();
  });
}

function close(): void {
  open.value = false;
}

/** Anchor the fixed popover under the trigger, capped to the viewport height. */
function reposition(): void {
  const el = trigger.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 12;
  popStyle.value = {
    top: `${Math.round(r.bottom + 4)}px`,
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(r.width)}px`,
    maxHeight: `${Math.round(Math.max(160, Math.min(340, below)))}px`,
  };
}

function pick(row: Row): void {
  if (row.synth) return; // out of scope — not selectable
  emit('update:modelValue', row.program);
  close();
}

function moveActive(delta: number): void {
  const list = selectable.value;
  if (list.length === 0) return;
  const idx = list.indexOf(activeProgram.value);
  const next = idx < 0 ? 0 : Math.min(list.length - 1, Math.max(0, idx + delta));
  activeProgram.value = list[next];
  void nextTick(() => scrollActiveIntoView());
}

function scrollActiveIntoView(): void {
  panel.value
    ?.querySelector(`[data-program="${activeProgram.value}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}

function onKeydown(e: KeyboardEvent): void {
  if (!open.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openPanel();
    }
    return;
  }
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      moveActive(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveActive(-1);
      break;
    case 'Home':
      e.preventDefault();
      activeProgram.value = selectable.value[0] ?? props.modelValue;
      void nextTick(() => scrollActiveIntoView());
      break;
    case 'End':
      e.preventDefault();
      activeProgram.value = selectable.value.at(-1) ?? props.modelValue;
      void nextTick(() => scrollActiveIntoView());
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      emit('update:modelValue', activeProgram.value);
      close();
      break;
    case 'Escape':
      e.preventDefault();
      close();
      break;
  }
}

function onDocPointer(e: PointerEvent): void {
  const t = e.target as Node;
  if (root.value?.contains(t) || panel.value?.contains(t)) return;
  close();
}

function onViewportChange(): void {
  if (open.value) reposition();
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('pointerdown', onDocPointer);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
  } else {
    window.removeEventListener('pointerdown', onDocPointer);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onDocPointer);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});
</script>

<template>
  <div ref="root" class="tn-picker">
    <button
      ref="trigger"
      type="button"
      class="tn-picker__trigger"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="tn-picker__current">{{ triggerLabel }}</span>
      <span class="tn-picker__caret" aria-hidden="true">▾</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="tn-picker__pop"
        :style="popStyle"
        role="listbox"
        :aria-label="ariaLabel"
        tabindex="-1"
        @keydown="onKeydown"
      >
      <div v-for="g in groups" :key="g.name" class="tn-picker__group">
        <div class="tn-picker__grouphead">{{ g.name }}</div>
        <button
          v-for="row in g.rows"
          :key="row.program"
          type="button"
          class="tn-picker__opt"
          :class="{
            'tn-picker__opt--active': row.program === activeProgram,
            'tn-picker__opt--selected': row.program === modelValue,
            'tn-picker__opt--disabled': row.synth !== null,
          }"
          role="option"
          :aria-selected="row.program === modelValue"
          :aria-disabled="row.synth !== null"
          :data-program="row.program"
          @click="pick(row)"
          @pointermove="row.synth ? null : (activeProgram = row.program)"
        >
          <span class="tn-picker__num">{{ String(row.program).padStart(3, '0') }}</span>
          <span class="tn-picker__name">{{ row.name }}</span>
          <span v-if="row.synth" class="tn-picker__chip">
            {{ synthLabels[row.synth] }}
            <span class="tn-picker__chip-sub">{{ outOfScopeLabel }}</span>
          </span>
        </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
