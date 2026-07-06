<script setup lang="ts">
import { computed, useId } from 'vue';

/** A single node placed on the author-chosen grid. */
interface FlowNode {
  id: string;
  label: string;
  /** LR: step along the flow. TB: lane within the step. */
  col: number;
  /** LR: lane within the step. TB: step along the flow. */
  row: number;
  variant?: 'default' | 'accent' | 'decision' | 'success' | 'warning' | 'error' | 'muted';
  group?: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

interface FlowGroup {
  id: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    direction?: 'LR' | 'TB';
    nodes: FlowNode[];
    edges?: FlowEdge[];
    groups?: FlowGroup[];
    caption?: string;
  }>(),
  {
    direction: 'LR',
    edges: () => [],
    groups: () => [],
  },
);

const uid = useId();

const NODE_H = 40;
const LANE_GAP_LR = 36;
const LANE_GAP_TB = 44;
const STEP_GAP_TB = 56;
const GROUP_PAD = 14;
const GROUP_PAD_LABEL_TOP = 28;

/**
 * Estimate rendered text width without DOM measurement (SSR-safe).
 * CJK glyphs advance ~1em; Latin averages are tuned for Inter /
 * JetBrains Mono at UI sizes, with box padding absorbing the error.
 */
function estText(s: string, size: number, mono = false): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x2e7f) w += 1;
    else if (mono) w += 0.62;
    else if (/[A-Z0-9@#%&_ワ-]/.test(ch)) w += 0.68;
    else if (/[ijl.,:;'"!|()[\] ]/.test(ch)) w += 0.34;
    else w += 0.56;
  }
  return w * size;
}

interface Rect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  rx: number;
  variant: string;
}

/** Evaluate a cubic bezier at t = 0.5 for edge-label placement. */
function cubicMid(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  return [(p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8, (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8];
}

const layout = computed(() => {
  const LR = props.direction !== 'TB';
  const stepOf = (n: FlowNode) => (LR ? n.col : n.row);
  const laneOf = (n: FlowNode) => (LR ? n.row : n.col);

  const widths = new Map<string, number>();
  for (const n of props.nodes) {
    widths.set(n.id, Math.max(84, Math.ceil(estText(n.label, 12.5)) + 32));
  }

  // Map sparse author coordinates to dense ordinal indices.
  const stepVals = [...new Set(props.nodes.map(stepOf))].sort((a, b) => a - b);
  const laneVals = [...new Set(props.nodes.map(laneOf))].sort((a, b) => a - b);
  const stepIdx = new Map(stepVals.map((v, i) => [v, i]));
  const laneIdx = new Map(laneVals.map((v, i) => [v, i]));

  const maxEdgeLabel = Math.max(
    0,
    ...props.edges.filter((e) => e.label).map((e) => estText(e.label as string, 10, true)),
  );
  const stepGapLR = Math.max(64, Math.min(150, maxEdgeLabel + 28));

  const rects = new Map<string, Rect>();

  if (LR) {
    // Column (step) extents along x, lanes along y.
    const stepW = stepVals.map((v) =>
      Math.max(
        ...props.nodes.filter((n) => stepOf(n) === v).map((n) => widths.get(n.id) as number),
      ),
    );
    const stepX: number[] = [];
    let x = 0;
    for (let i = 0; i < stepW.length; i++) {
      stepX.push(x);
      x += stepW[i] + stepGapLR;
    }
    for (const n of props.nodes) {
      const si = stepIdx.get(stepOf(n)) as number;
      const li = laneIdx.get(laneOf(n)) as number;
      const w = widths.get(n.id) as number;
      const nx = stepX[si] + (stepW[si] - w) / 2;
      const ny = li * (NODE_H + LANE_GAP_LR);
      rects.set(n.id, makeRect(n, nx, ny, w));
    }
  } else {
    // Lane extents along x, steps along y.
    const laneW = laneVals.map((v) =>
      Math.max(
        ...props.nodes.filter((n) => laneOf(n) === v).map((n) => widths.get(n.id) as number),
      ),
    );
    const laneX: number[] = [];
    let x = 0;
    for (let i = 0; i < laneW.length; i++) {
      laneX.push(x);
      x += laneW[i] + LANE_GAP_TB;
    }
    for (const n of props.nodes) {
      const si = stepIdx.get(stepOf(n)) as number;
      const li = laneIdx.get(laneOf(n)) as number;
      const w = widths.get(n.id) as number;
      const nx = laneX[li] + (laneW[li] - w) / 2;
      const ny = si * (NODE_H + STEP_GAP_TB);
      rects.set(n.id, makeRect(n, nx, ny, w));
    }
  }

  function makeRect(n: FlowNode, x: number, y: number, w: number): Rect {
    const variant = n.variant ?? 'default';
    return {
      id: n.id,
      label: n.label,
      x,
      y,
      w,
      h: NODE_H,
      cx: x + w / 2,
      cy: y + NODE_H / 2,
      rx: variant === 'decision' ? NODE_H / 2 : 8,
      variant,
    };
  }

  // Group frames (mermaid subgraph replacement).
  const groupFrames: { id: string; label: string; x: number; y: number; w: number; h: number }[] =
    [];
  for (const g of props.groups) {
    const members = props.nodes.filter((n) => n.group === g.id).map((n) => rects.get(n.id) as Rect);
    if (members.length === 0) continue;
    const minX = Math.min(...members.map((r) => r.x)) - GROUP_PAD;
    const maxX = Math.max(...members.map((r) => r.x + r.w)) + GROUP_PAD;
    const padTop = g.label ? GROUP_PAD_LABEL_TOP : GROUP_PAD;
    const minY = Math.min(...members.map((r) => r.y)) - padTop;
    const maxY = Math.max(...members.map((r) => r.y + r.h)) + 12;
    const minW = g.label ? estText(g.label, 9.5, true) * 1.1 + 26 : 0;
    groupFrames.push({
      id: g.id,
      label: g.label ? g.label.toUpperCase() : '',
      x: minX,
      y: minY,
      w: Math.max(maxX - minX, minW),
      h: maxY - minY,
    });
  }

  // Edges.
  const edgePaths: { d: string; dashed: boolean }[] = [];
  const edgeLabels: { text: string; x: number; y: number; w: number }[] = [];
  const extraPoints: [number, number][] = [];

  for (const e of props.edges) {
    const sn = props.nodes.find((n) => n.id === e.from);
    const tn = props.nodes.find((n) => n.id === e.to);
    if (!sn || !tn) continue;
    const s = rects.get(sn.id) as Rect;
    const t = rects.get(tn.id) as Rect;
    const ds = (stepIdx.get(stepOf(tn)) as number) - (stepIdx.get(stepOf(sn)) as number);

    let p0: [number, number];
    let p1: [number, number];
    let p2: [number, number];
    let p3: [number, number];

    if (LR) {
      if (ds > 0) {
        p0 = [s.x + s.w, s.cy];
        p3 = [t.x - 1, t.cy];
        const dx = p3[0] - p0[0];
        p1 = [p0[0] + dx * 0.45, p0[1]];
        p2 = [p3[0] - dx * 0.45, p3[1]];
      } else if (ds === 0) {
        const down = t.cy > s.cy;
        p0 = [s.cx, down ? s.y + s.h : s.y];
        p3 = [t.cx, down ? t.y - 1 : t.y + t.h + 1];
        const dy = p3[1] - p0[1];
        p1 = [p0[0], p0[1] + dy * 0.45];
        p2 = [p3[0], p3[1] - dy * 0.45];
      } else {
        // Backward edge: exit left, loop around into the target's right side.
        p0 = [s.x, s.cy];
        p3 = [t.x + t.w + 1, t.cy];
        if (s.cy === t.cy) {
          p1 = [p0[0] - 40, p0[1] + 58];
          p2 = [p3[0] + 40, p3[1] + 58];
        } else {
          p1 = [p0[0] - 48, p0[1]];
          p2 = [p3[0] + 48, p3[1]];
        }
      }
    } else {
      if (ds > 0) {
        p0 = [s.cx, s.y + s.h];
        p3 = [t.cx, t.y - 1];
        const dy = p3[1] - p0[1];
        p1 = [p0[0], p0[1] + dy * 0.45];
        p2 = [p3[0], p3[1] - dy * 0.45];
      } else if (ds === 0) {
        const right = t.cx > s.cx;
        p0 = [right ? s.x + s.w : s.x, s.cy];
        p3 = [right ? t.x - 1 : t.x + t.w + 1, t.cy];
        const dx = p3[0] - p0[0];
        p1 = [p0[0] + dx * 0.45, p0[1]];
        p2 = [p3[0] - dx * 0.45, p3[1]];
      } else {
        p0 = [s.x + s.w, s.cy];
        p3 = [t.x + t.w + 1, t.cy];
        if (s.cx === t.cx) {
          p1 = [p0[0] + 58, p0[1]];
          p2 = [p3[0] + 58, p3[1]];
        } else {
          p1 = [p0[0] + 48, p0[1]];
          p2 = [p3[0] + 48, p3[1]];
        }
      }
    }

    edgePaths.push({
      d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`,
      dashed: e.style === 'dashed',
    });
    const mid = cubicMid(p0, p1, p2, p3);
    extraPoints.push(mid);
    if (e.label) {
      edgeLabels.push({
        text: e.label,
        x: mid[0],
        y: mid[1],
        w: estText(e.label, 10, true) + 14,
      });
    }
  }

  // Canvas bounds from every drawn element, then a symmetric viewBox pad.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rects.values()) {
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.h);
  }
  for (const g of groupFrames) {
    xs.push(g.x, g.x + g.w);
    ys.push(g.y, g.y + g.h);
  }
  for (const [px, py] of extraPoints) {
    xs.push(px - 10, px + 10);
    ys.push(py - 10, py + 10);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const PAD = 10;
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;

  return {
    viewBox: `${minX - PAD} ${minY - PAD} ${width} ${height}`,
    width,
    nodeRects: [...rects.values()],
    groupFrames,
    edgePaths,
    edgeLabels,
  };
});

const ariaLabel = computed(() => props.title ?? 'Flow diagram');
</script>

<template>
  <figure class="doc-diagram-wrap flow-diagram">
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
          <path d="M0.8 1 L7 4 L0.8 7 Z" class="fd-arrow" />
        </marker>
      </defs>

      <g v-for="g in layout.groupFrames" :key="`g-${g.id}`">
        <rect class="fd-group" :x="g.x" :y="g.y" :width="g.w" :height="g.h" rx="10" />
        <text v-if="g.label" class="fd-group-label" :x="g.x + 12" :y="g.y + 17">{{ g.label }}</text>
      </g>

      <path
        v-for="(e, i) in layout.edgePaths"
        :key="`e-${i}`"
        class="fd-edge"
        :class="{ 'fd-edge--dashed': e.dashed }"
        :d="e.d"
        :marker-end="`url(#${uid}-arrow)`"
      />

      <g v-for="(l, i) in layout.edgeLabels" :key="`el-${i}`">
        <rect
          class="fd-edge-label-bg"
          :x="l.x - l.w / 2"
          :y="l.y - 8"
          :width="l.w"
          height="16"
          rx="4"
        />
        <text class="fd-edge-label" :x="l.x" :y="l.y" text-anchor="middle" dy="0.34em">
          {{ l.text }}
        </text>
      </g>

      <g v-for="n in layout.nodeRects" :key="`n-${n.id}`">
        <rect
          class="fd-node"
          :class="`fd-node--${n.variant}`"
          :x="n.x"
          :y="n.y"
          :width="n.w"
          :height="n.h"
          :rx="n.rx"
        />
        <text
          class="fd-node-label"
          :class="{ 'fd-node-label--muted': n.variant === 'muted' }"
          :x="n.cx"
          :y="n.cy"
          text-anchor="middle"
          dy="0.35em"
        >
          {{ n.label }}
        </text>
      </g>
    </svg>
    <div v-if="caption" class="doc-diagram-caption">{{ caption }}</div>
  </figure>
</template>

<style scoped>
.flow-diagram {
  --dg-bg: var(--vp-code-block-bg);
  --dg-edge: color-mix(in srgb, var(--color-text-primary) 52%, transparent);
}

/* --- Edges --- */
.fd-edge {
  fill: none;
  stroke: var(--dg-edge);
  stroke-width: 1.4;
}

.fd-edge--dashed {
  stroke-dasharray: 5 4;
  stroke: color-mix(in srgb, var(--color-text-primary) 40%, transparent);
}

.fd-arrow {
  fill: var(--dg-edge);
}

.fd-edge-label-bg {
  fill: var(--dg-bg);
}

.fd-edge-label {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--color-text-secondary);
}

/* --- Nodes --- */
.fd-node {
  stroke-width: 1.3;
}

.fd-node--default {
  fill: color-mix(in srgb, var(--color-brand) 6%, transparent);
  stroke: color-mix(in srgb, var(--color-brand) 42%, transparent);
}

.fd-node--accent {
  fill: color-mix(in srgb, var(--color-brand) 13%, transparent);
  stroke: var(--color-brand);
  stroke-width: 1.6;
}

.fd-node--decision,
.fd-node--warning {
  fill: color-mix(in srgb, var(--demo-status-warn) 9%, transparent);
  stroke: color-mix(in srgb, var(--demo-status-warn) 62%, transparent);
}

.fd-node--success {
  fill: color-mix(in srgb, var(--demo-status-ok) 8%, transparent);
  stroke: color-mix(in srgb, var(--demo-status-ok) 60%, transparent);
}

.fd-node--error {
  fill: color-mix(in srgb, var(--demo-status-error) 8%, transparent);
  stroke: color-mix(in srgb, var(--demo-status-error) 58%, transparent);
}

.fd-node--muted {
  fill: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
  stroke: var(--color-border-default);
  stroke-dasharray: 3 3;
}

.fd-node-label {
  font-family: var(--font-reading);
  font-size: 12.5px;
  font-weight: 500;
  fill: var(--color-text-primary);
}

.fd-node-label--muted {
  fill: var(--color-text-tertiary);
}

/* --- Groups (subgraph frames) --- */
.fd-group {
  fill: color-mix(in srgb, var(--vp-c-brand-1) 4%, transparent);
  stroke: color-mix(in srgb, var(--vp-c-brand-1) 26%, transparent);
  stroke-width: 1;
}

.fd-group-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  fill: var(--color-brand);
}
</style>
