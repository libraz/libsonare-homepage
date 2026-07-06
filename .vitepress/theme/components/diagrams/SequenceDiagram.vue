<script setup lang="ts">
import { computed, useId } from 'vue';

interface Participant {
  id: string;
  label: string;
}

interface Message {
  from: string;
  to: string;
  label: string;
  /** 'sync' (default) = solid arrow; 'async' and 'return' = dashed. */
  type?: 'sync' | 'async' | 'return';
  /** Consecutive messages sharing the same loop string are framed together. */
  loop?: string;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    participants: Participant[];
    messages: Message[];
    caption?: string;
  }>(),
  {},
);

const uid = useId();

const BOX_H = 32;
const MSG_PITCH = 44;
const SELF_PITCH = 54;
const LOOP_TOP = 22;
const LOOP_BOTTOM = 18;
const FRAME_SIDE = 34;

/**
 * Estimate rendered text width without DOM measurement (SSR-safe).
 * CJK glyphs advance ~1em; Latin averages are tuned for Inter /
 * JetBrains Mono at UI sizes, with padding absorbing the error.
 */
function estText(s: string, size: number, mono = false): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x2e7f) w += 1;
    else if (mono) w += 0.62;
    else if (/[A-Z0-9@#%&_-]/.test(ch)) w += 0.68;
    else if (/[ijl.,:;'"!|()[\] ]/.test(ch)) w += 0.34;
    else w += 0.56;
  }
  return w * size;
}

const layout = computed(() => {
  const ps = props.participants;
  const idx = new Map(ps.map((p, i) => [p.id, i]));
  const boxW = ps.map((p) => Math.max(88, Math.ceil(estText(p.label, 12)) + 28));

  // Per-gap width requirements from the messages that cross each gap.
  const gaps: number[] = new Array(Math.max(ps.length - 1, 0)).fill(120);
  for (const m of props.messages) {
    const f = idx.get(m.from);
    const t = idx.get(m.to);
    if (f === undefined || t === undefined) continue;
    const labelW = estText(m.label, 10.5, true);
    if (f === t) {
      // Self-message loops out to the right: widen that gap.
      if (f < gaps.length) gaps[f] = Math.max(gaps[f], labelW + 64);
    } else if (Math.abs(f - t) === 1) {
      const g = Math.min(f, t);
      gaps[g] = Math.max(gaps[g], labelW + 56);
    }
  }

  // Lifeline x centers.
  const cx: number[] = [];
  let x = boxW.length > 0 ? boxW[0] / 2 : 0;
  for (let i = 0; i < ps.length; i++) {
    if (i > 0) x += boxW[i - 1] / 2 + gaps[i - 1] + boxW[i] / 2;
    cx.push(x);
  }

  // Loop blocks: consecutive messages sharing the same loop string.
  const blocks: { label: string; start: number; end: number }[] = [];
  for (let i = 0; i < props.messages.length; i++) {
    const key = props.messages[i].loop;
    if (!key) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.label === key && last.end === i - 1) last.end = i;
    else blocks.push({ label: key, start: i, end: i });
  }
  const blockStart = new Map(blocks.map((b) => [b.start, b]));
  const blockEnd = new Set(blocks.map((b) => b.end));

  // Vertical rhythm.
  const ys: number[] = [];
  let y = BOX_H + 34;
  for (let i = 0; i < props.messages.length; i++) {
    if (blockStart.has(i)) y += LOOP_TOP;
    ys.push(y);
    const m = props.messages[i];
    y += m.from === m.to ? SELF_PITCH : MSG_PITCH;
    if (blockEnd.has(i)) y += LOOP_BOTTOM;
  }
  const height = y - 8;

  // Arrows and labels.
  interface Arrow {
    d: string;
    dashed: boolean;
    soft: boolean;
    labelX: number;
    labelY: number;
    labelW: number;
    labelAnchor: 'middle' | 'start';
  }
  const arrows: Arrow[] = [];
  const xs: number[] = [];
  for (let i = 0; i < ps.length; i++) {
    xs.push(cx[i] - boxW[i] / 2, cx[i] + boxW[i] / 2);
  }

  props.messages.forEach((m, i) => {
    const f = idx.get(m.from);
    const t = idx.get(m.to);
    if (f === undefined || t === undefined) return;
    const my = ys[i];
    const dashed = m.type === 'async' || m.type === 'return';
    const soft = m.type === 'return';
    const labelW = estText(m.label, 10.5, true) + 14;

    if (f === t) {
      const sx = cx[f];
      arrows.push({
        d: `M ${sx} ${my} C ${sx + 56} ${my - 4}, ${sx + 56} ${my + 22}, ${sx + 7} ${my + 18}`,
        dashed,
        soft,
        labelX: sx + 16,
        labelY: my - 9,
        labelW,
        labelAnchor: 'start',
      });
      xs.push(sx + 16 + labelW, sx + 58);
    } else {
      const dir = t > f ? 1 : -1;
      const sx = cx[f];
      const ex = cx[t] - dir * 2;
      arrows.push({
        d: `M ${sx} ${my} L ${ex} ${my}`,
        dashed,
        soft,
        labelX: (sx + cx[t]) / 2,
        labelY: my - 9,
        labelW,
        labelAnchor: 'middle',
      });
    }
  });

  // Loop frames span the lifelines their messages touch.
  const frames: {
    x: number;
    y: number;
    w: number;
    h: number;
    chipW: number;
    label: string;
  }[] = [];
  for (const b of blocks) {
    const involved: number[] = [];
    for (let i = b.start; i <= b.end; i++) {
      const m = props.messages[i];
      const f = idx.get(m.from);
      const t = idx.get(m.to);
      if (f !== undefined) involved.push(f);
      if (t !== undefined) involved.push(t);
    }
    if (involved.length === 0) continue;
    const x0 = Math.min(...involved.map((i) => cx[i])) - FRAME_SIDE;
    const x1 = Math.max(...involved.map((i) => cx[i])) + FRAME_SIDE;
    const y0 = ys[b.start] - 28;
    const y1 = ys[b.end] + (props.messages[b.end].from === props.messages[b.end].to ? 30 : 14);
    const chipText = `LOOP · ${b.label.toUpperCase()}`;
    const chipW = estText(chipText, 9.5, true) * 1.06 + 18;
    frames.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, chipW, label: chipText });
    xs.push(x0 - 4, x1 + 4, x0 + 10 + chipW);
  }

  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 0);
  const PAD = 10;
  const width = maxX - minX + PAD * 2;

  return {
    viewBox: `${minX - PAD} ${-PAD} ${width} ${height + PAD * 2}`,
    width,
    height,
    boxes: ps.map((p, i) => ({
      id: p.id,
      label: p.label,
      x: cx[i] - boxW[i] / 2,
      w: boxW[i],
      cx: cx[i],
    })),
    arrows,
    frames,
  };
});

const ariaLabel = computed(() => props.title ?? 'Sequence diagram');
</script>

<template>
  <figure class="doc-diagram-wrap sequence-diagram">
    <figcaption v-if="title" class="doc-diagram-head">{{ title }}</figcaption>
    <svg
      class="doc-diagram-svg"
      :viewBox="layout.viewBox"
      :style="{ maxWidth: `${layout.width}px`, minWidth: `${layout.width * 0.6}px` }"
      role="img"
      :aria-label="ariaLabel"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          :id="`${uid}-arrow`"
          markerWidth="8"
          markerHeight="8"
          refX="6.8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0.8 1 L7 4 L0.8 7 Z" class="sd-arrow" />
        </marker>
      </defs>

      <!-- Lifelines -->
      <line
        v-for="b in layout.boxes"
        :key="`ll-${b.id}`"
        class="sd-lifeline"
        :x1="b.cx"
        :y1="BOX_H"
        :x2="b.cx"
        :y2="layout.height"
      />

      <!-- Loop frames -->
      <g v-for="(f, i) in layout.frames" :key="`f-${i}`">
        <rect class="sd-loop" :x="f.x" :y="f.y" :width="f.w" :height="f.h" rx="8" />
        <rect class="sd-loop-chip" :x="f.x + 10" :y="f.y - 8" :width="f.chipW" height="16" rx="4" />
        <text class="sd-loop-label" :x="f.x + 10 + f.chipW / 2" :y="f.y" text-anchor="middle" dy="0.34em">
          {{ f.label }}
        </text>
      </g>

      <!-- Messages -->
      <g v-for="(a, i) in layout.arrows" :key="`m-${i}`">
        <path
          class="sd-msg"
          :class="{ 'sd-msg--dashed': a.dashed, 'sd-msg--soft': a.soft }"
          :d="a.d"
          :marker-end="`url(#${uid}-arrow)`"
        />
        <rect
          class="sd-msg-label-bg"
          :x="a.labelAnchor === 'middle' ? a.labelX - a.labelW / 2 : a.labelX - 4"
          :y="a.labelY - 8"
          :width="a.labelW"
          height="16"
          rx="4"
        />
        <text
          class="sd-msg-label"
          :x="a.labelX"
          :y="a.labelY"
          :text-anchor="a.labelAnchor"
          dy="0.34em"
        >
          {{ messages[i].label }}
        </text>
      </g>

      <!-- Participant boxes (drawn last so lifelines tuck underneath) -->
      <g v-for="b in layout.boxes" :key="`p-${b.id}`">
        <rect class="sd-part" :x="b.x" y="0" :width="b.w" :height="BOX_H" rx="8" />
        <text class="sd-part-label" :x="b.cx" :y="BOX_H / 2" text-anchor="middle" dy="0.35em">
          {{ b.label }}
        </text>
      </g>
    </svg>
    <div v-if="caption" class="doc-diagram-caption">{{ caption }}</div>
  </figure>
</template>

<style scoped>
.sequence-diagram {
  --dg-bg: var(--vp-code-block-bg);
  --dg-edge: color-mix(in srgb, var(--color-text-primary) 52%, transparent);
}

.sd-lifeline {
  stroke: var(--color-border-default);
  stroke-width: 1;
}

/* --- Participants --- */
.sd-part {
  fill: color-mix(in srgb, var(--color-brand) 8%, var(--dg-bg));
  stroke: color-mix(in srgb, var(--color-brand) 45%, transparent);
  stroke-width: 1.3;
}

.sd-part-label {
  font-family: var(--font-reading);
  font-size: 12px;
  font-weight: 600;
  fill: var(--color-text-primary);
}

/* --- Messages --- */
.sd-msg {
  fill: none;
  stroke: var(--dg-edge);
  stroke-width: 1.4;
}

.sd-msg--dashed {
  stroke-dasharray: 5 4;
}

.sd-msg--soft {
  stroke: color-mix(in srgb, var(--color-text-primary) 36%, transparent);
}

.sd-arrow {
  fill: var(--dg-edge);
}

.sd-msg-label-bg {
  fill: var(--dg-bg);
}

.sd-msg-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--color-text-secondary);
}

/* --- Loop frames --- */
.sd-loop {
  fill: color-mix(in srgb, var(--vp-c-brand-1) 3%, transparent);
  stroke: color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.sd-loop-chip {
  fill: color-mix(in srgb, var(--vp-c-brand-1) 14%, var(--dg-bg));
}

.sd-loop-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  fill: var(--color-brand);
}
</style>
