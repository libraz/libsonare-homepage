<script setup lang="ts">
import { computed, useId } from 'vue';
import { estText, roundedPath, wrapLabel } from './text';

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

const NODE_H = 44;
const NODE_H_WRAPPED = 58;
const NODE_FONT = 13.5;
const NODE_PAD_X = 28;
const NODE_MIN_W = 80;
const NODE_WRAP_W = 150;
const EDGE_FONT = 11;
const EDGE_WRAP_W = 120;
const LANE_GAP_LR = 38;
const LANE_GAP_TB = 44;
const STEP_GAP_TB = 56;
const GROUP_PAD = 14;
const GROUP_PAD_LABEL_TOP = 28;

/** An edge label as drawn: its lines and the plate they sit on. */
function edgeLabelBox(text: string, x: number, y: number) {
  const lines = wrapLabel(text, EDGE_WRAP_W, EDGE_FONT, true);
  return {
    lines,
    x,
    y,
    w: Math.max(...lines.map((l) => estText(l, EDGE_FONT, true))) + 14,
    h: lines.length * 14 + 4,
  };
}

/** Anything a route has to steer around: a node box or a group's label chip. */
interface Obstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

interface Rect extends Obstacle {
  label: string;
  lines: string[];
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

  const labelLines = new Map<string, string[]>();
  const widths = new Map<string, number>();
  for (const n of props.nodes) {
    const lines = wrapLabel(n.label, NODE_WRAP_W, NODE_FONT);
    labelLines.set(n.id, lines);
    const textW = Math.max(...lines.map((l) => estText(l, NODE_FONT)));
    widths.set(n.id, Math.max(NODE_MIN_W, Math.ceil(textW) + NODE_PAD_X));
  }
  // One height for every box in a figure, tall enough for the wrapped ones.
  const nodeH = [...labelLines.values()].some((l) => l.length > 1) ? NODE_H_WRAPPED : NODE_H;

  // Map sparse author coordinates to dense ordinal indices.
  const stepVals = [...new Set(props.nodes.map(stepOf))].sort((a, b) => a - b);
  const laneVals = [...new Set(props.nodes.map(laneOf))].sort((a, b) => a - b);
  const stepIdx = new Map(stepVals.map((v, i) => [v, i]));
  const laneIdx = new Map(laneVals.map((v, i) => [v, i]));

  // Only the gap a labelled one-step edge actually sits in is widened for it;
  // a label on a longer edge rides the detour lane instead of the gap.
  const stepGaps = new Array(Math.max(0, stepVals.length - 1)).fill(46);
  let sidewaysLabelW = 0;
  for (const e of props.edges) {
    if (!e.label) continue;
    const sn = props.nodes.find((n) => n.id === e.from);
    const tn = props.nodes.find((n) => n.id === e.to);
    if (!sn || !tn) continue;
    const si = stepIdx.get(stepOf(sn)) as number;
    const ti = stepIdx.get(stepOf(tn)) as number;
    const plate = edgeLabelBox(e.label, 0, 0);
    if (Math.abs(ti - si) !== 1) {
      sidewaysLabelW = Math.max(sidewaysLabelW, plate.w);
      continue;
    }
    const g = Math.min(si, ti);
    stepGaps[g] = Math.max(stepGaps[g], Math.min(150, plate.w + 12));
  }

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
      x += stepW[i] + (stepGaps[i] ?? 0);
    }
    for (const n of props.nodes) {
      const si = stepIdx.get(stepOf(n)) as number;
      const li = laneIdx.get(laneOf(n)) as number;
      const w = widths.get(n.id) as number;
      const nx = stepX[si] + (stepW[si] - w) / 2;
      const ny = li * (nodeH + LANE_GAP_LR);
      rects.set(n.id, makeRect(n, nx, ny, w));
    }
  } else {
    // Lane extents along x, steps along y.
    const laneW = laneVals.map((v) =>
      Math.max(
        ...props.nodes.filter((n) => laneOf(n) === v).map((n) => widths.get(n.id) as number),
      ),
    );
    // A label on an edge that does not join neighbouring steps rides a lane
    // gap here rather than a step gap, so the lanes carry the room for it.
    const laneGap = Math.max(LANE_GAP_TB, sidewaysLabelW + 16);
    const laneX: number[] = [];
    let x = 0;
    for (let i = 0; i < laneW.length; i++) {
      laneX.push(x);
      x += laneW[i] + laneGap;
    }
    for (const n of props.nodes) {
      const si = stepIdx.get(stepOf(n)) as number;
      const li = laneIdx.get(laneOf(n)) as number;
      const w = widths.get(n.id) as number;
      const nx = laneX[li] + (laneW[li] - w) / 2;
      const ny = si * (nodeH + STEP_GAP_TB);
      rects.set(n.id, makeRect(n, nx, ny, w));
    }
  }

  function makeRect(n: FlowNode, x: number, y: number, w: number): Rect {
    const variant = n.variant ?? 'default';
    return {
      id: n.id,
      label: n.label,
      lines: labelLines.get(n.id) as string[],
      x,
      y,
      w,
      h: nodeH,
      cx: x + w / 2,
      cy: y + nodeH / 2,
      rx: variant === 'decision' ? nodeH / 2 : 8,
      variant,
    };
  }

  // Group frames (mermaid subgraph replacement).
  const groupFrames: {
    id: string;
    label: string;
    labelW: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  for (const g of props.groups) {
    const members = props.nodes.filter((n) => n.group === g.id).map((n) => rects.get(n.id) as Rect);
    if (members.length === 0) continue;
    const minX = Math.min(...members.map((r) => r.x)) - GROUP_PAD;
    const maxX = Math.max(...members.map((r) => r.x + r.w)) + GROUP_PAD;
    const padTop = g.label ? GROUP_PAD_LABEL_TOP : GROUP_PAD;
    const minY = Math.min(...members.map((r) => r.y)) - padTop;
    const maxY = Math.max(...members.map((r) => r.y + r.h)) + 12;
    const labelW = g.label ? estText(g.label, 9.5, true) * 1.1 + 8 : 0;
    groupFrames.push({
      id: g.id,
      label: g.label ? g.label.toUpperCase() : '',
      labelW,
      x: minX,
      y: minY,
      w: Math.max(maxX - minX, labelW + 18),
      h: maxY - minY,
    });
  }

  // Edges.
  const edgePaths: { d: string; dashed: boolean }[] = [];
  const edgeLabels: ReturnType<typeof edgeLabelBox>[] = [];
  const extraPoints: [number, number][] = [];

  const rectList = [...rects.values()];
  // A group's label chip is drawn inside its frame, so a detour lane has to
  // keep clear of it the way it keeps clear of a box.
  const routeBlockers: Obstacle[] = [
    ...rectList,
    ...groupFrames
      .filter((g) => g.label)
      .map((g) => ({
        id: `group-${g.id}`,
        x: g.x + 8,
        y: g.y + 4,
        w: g.labelW,
        h: 20,
        cx: g.x + 8,
        cy: g.y + 14,
      })),
  ];
  const EDGE_BAND = 10;
  const BYPASS_GAP = 22;
  const BYPASS_R = 9;
  /** Stands in for an unbounded channel edge, past any real coordinate. */
  const OPEN = 1e5;

  // Flow-axis and lane-axis extents of anything a route has to avoid.
  const mainLo = (r: Obstacle, horiz: boolean) => (horiz ? r.x : r.y);
  const mainHi = (r: Obstacle, horiz: boolean) => (horiz ? r.x + r.w : r.y + r.h);
  const offLo = (r: Obstacle, horiz: boolean) => (horiz ? r.y : r.x);
  const offHi = (r: Obstacle, horiz: boolean) => (horiz ? r.y + r.h : r.x + r.w);
  const offMid = (r: Obstacle, horiz: boolean) => (horiz ? r.cy : r.cx);
  const mainMid = (r: Obstacle, horiz: boolean) => (horiz ? r.cx : r.cy);

  /** True when the direct route between two nodes would run through a third. */
  function directBlocked(s: Rect, t: Rect, horiz: boolean): boolean {
    const mLo = Math.min(mainHi(s, horiz), mainHi(t, horiz));
    const mHi = Math.max(mainLo(s, horiz), mainLo(t, horiz));
    const oLo = Math.min(offMid(s, horiz), offMid(t, horiz)) - EDGE_BAND;
    const oHi = Math.max(offMid(s, horiz), offMid(t, horiz)) + EDGE_BAND;
    return rectList.some(
      (r) =>
        r.id !== s.id &&
        r.id !== t.id &&
        mainHi(r, horiz) > mLo &&
        mainLo(r, horiz) < mHi &&
        offHi(r, horiz) > oLo &&
        offLo(r, horiz) < oHi,
    );
  }

  /** Faces the detour leaves from and arrives at, following the travel axis. */
  function faces(s: Rect, t: Rect, horiz: boolean) {
    const fwd = mainMid(t, horiz) >= mainMid(s, horiz);
    return {
      fwd,
      exit: fwd ? mainHi(s, horiz) : mainLo(s, horiz),
      entry: fwd ? mainLo(t, horiz) : mainHi(t, horiz),
    };
  }

  /**
   * The intervals of an axis that no box in `boxes` covers, the two outermost
   * ones open-ended. A detour turning inside one of these crosses nothing,
   * whatever it does on the other axis.
   */
  function freeSpans(boxes: Obstacle[], lo: (r: Obstacle) => number, hi: (r: Obstacle) => number) {
    const used = boxes.map((r): [number, number] => [lo(r), hi(r)]).sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of used) {
      const last = merged[merged.length - 1];
      if (last && a <= last[1]) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    if (merged.length === 0) return [[-OPEN, OPEN]] as [number, number][];
    const free: [number, number][] = [[-OPEN, merged[0][0]]];
    for (let i = 1; i < merged.length; i++) free.push([merged[i - 1][1], merged[i][0]]);
    free.push([merged[merged.length - 1][1], OPEN]);
    return free;
  }

  /** The point of `span` closest to `to`, keeping `want` clear of its edges. */
  function nearestIn(span: [number, number], to: number, want = BYPASS_GAP): number {
    const pad = Math.min(want, (span[1] - span[0]) / 2);
    return Math.min(Math.max(to, span[0] + pad), span[1] - pad);
  }

  /** Where the detour turns off the travel axis: the nearest clear channel. */
  function turnPoints(s: Rect, t: Rect, horiz: boolean): [number, number] {
    const { fwd, exit, entry } = faces(s, t, horiz);
    const spans = freeSpans(
      routeBlockers,
      (r) => mainLo(r, horiz),
      (r) => mainHi(r, horiz),
    ).filter((sp) => sp[1] - sp[0] >= 10);
    const pick = (from: number, increasing: boolean) => {
      const cands = spans.filter((sp) => (increasing ? sp[0] >= from - 0.5 : sp[1] <= from + 0.5));
      const span = increasing ? cands[0] : cands[cands.length - 1];
      if (!span) return from + (increasing ? 18 : -18);
      return nearestIn(span, from);
    };
    return [pick(exit, fwd), pick(entry, !fwd)];
  }

  /**
   * Off-axis coordinate of the detour lane: the nearest channel beside the
   * route with room for `want` on either side, so a label rides it clear.
   */
  function bypassRun(s: Rect, t: Rect, horiz: boolean, want = BYPASS_GAP): number {
    const [ma, mb] = turnPoints(s, t, horiz);
    const runLo = Math.min(ma, mb);
    const runHi = Math.max(ma, mb);
    const blocking = routeBlockers.filter(
      (r) => mainHi(r, horiz) > runLo && mainLo(r, horiz) < runHi && r.id !== s.id && r.id !== t.id,
    );
    const lane = (offMid(s, horiz) + offMid(t, horiz)) / 2;
    const spans = freeSpans(
      blocking,
      (r) => offLo(r, horiz),
      (r) => offHi(r, horiz),
    ).filter((sp) => sp[1] - sp[0] >= 22);
    if (spans.length === 0) return lane;
    let best = nearestIn(spans[0], lane, want);
    for (const sp of spans.slice(1)) {
      const cand = nearestIn(sp, lane, want);
      if (Math.abs(cand - lane) < Math.abs(best - lane)) best = cand;
    }
    return best;
  }

  /**
   * Orthogonal detour: out of the source's face, aside to a clear lane in the
   * gap next to it, along, and back into the target's facing side. Both turns
   * happen in the gaps between boxes, so the detour crosses none of them.
   */
  function bypassEdge(s: Rect, t: Rect, horiz: boolean, runO: number) {
    const xy = (m: number, o: number): [number, number] => (horiz ? [m, o] : [o, m]);
    const { fwd, exit, entry } = faces(s, t, horiz);
    const [ma, mb] = turnPoints(s, t, horiz);
    const o0 = offMid(s, horiz);
    const o1 = offMid(t, horiz);
    const pts: [number, number][] = [
      xy(exit, o0),
      xy(ma, o0),
      xy(ma, runO),
      xy(mb, runO),
      xy(mb, o1),
      xy(entry + (fwd ? -1 : 1), o1),
    ];
    return {
      d: roundedPath(pts, BYPASS_R),
      mid: xy((ma + mb) / 2, runO),
      ends: [xy(ma, runO), xy(mb, runO)],
    };
  }

  for (const e of props.edges) {
    const sn = props.nodes.find((n) => n.id === e.from);
    const tn = props.nodes.find((n) => n.id === e.to);
    if (!sn || !tn) continue;
    const s = rects.get(sn.id) as Rect;
    const t = rects.get(tn.id) as Rect;
    const ds = (stepIdx.get(stepOf(tn)) as number) - (stepIdx.get(stepOf(sn)) as number);

    // An edge whose direct route would run through another box takes an
    // orthogonal detour instead, carrying its label onto the clear lane.
    // It travels along the flow axis, except between lanes of one step.
    const travelHoriz = LR === (ds !== 0);
    if (directBlocked(s, t, travelHoriz)) {
      const plate = e.label ? edgeLabelBox(e.label, 0, 0) : undefined;
      // The run has to clear the label's own plate, not just the line.
      const want = plate ? (travelHoriz ? plate.h : plate.w) / 2 + 6 : 0;
      const runO = bypassRun(s, t, travelHoriz, Math.max(BYPASS_GAP, want));
      const { d, mid, ends } = bypassEdge(s, t, travelHoriz, runO);
      edgePaths.push({ d, dashed: e.style === 'dashed' });
      extraPoints.push(mid, ...ends);
      if (e.label) edgeLabels.push(edgeLabelBox(e.label, mid[0], mid[1]));
      continue;
    }

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
    if (e.label) edgeLabels.push(edgeLabelBox(e.label, mid[0], mid[1]));
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
      :style="{ maxWidth: `${layout.width}px`, minWidth: `${Math.round(layout.width * 0.8)}px` }"
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

      <rect
        v-for="g in layout.groupFrames"
        :key="`g-${g.id}`"
        class="fd-group"
        :x="g.x"
        :y="g.y"
        :width="g.w"
        :height="g.h"
        rx="10"
      />

      <path
        v-for="(e, i) in layout.edgePaths"
        :key="`e-${i}`"
        class="fd-edge"
        :class="{ 'fd-edge--dashed': e.dashed }"
        :d="e.d"
        :marker-end="`url(#${uid}-arrow)`"
      />

      <!-- Group captions ride above the edges so a route cannot strike them out. -->
      <g v-for="g in layout.groupFrames" :key="`gl-${g.id}`">
        <template v-if="g.label">
          <rect
            class="fd-group-label-bg"
            :x="g.x + 8"
            :y="g.y + 6"
            :width="g.labelW"
            height="17"
            rx="4"
          />
          <text class="fd-group-label" :x="g.x + 12" :y="g.y + 17">{{ g.label }}</text>
        </template>
      </g>

      <g v-for="(l, i) in layout.edgeLabels" :key="`el-${i}`">
        <rect
          class="fd-edge-label-bg"
          :x="l.x - l.w / 2"
          :y="l.y - l.h / 2"
          :width="l.w"
          :height="l.h"
          rx="4"
        />
        <text class="fd-edge-label" :x="l.x" :y="l.y" text-anchor="middle">
          <tspan
            v-for="(line, li) in l.lines"
            :key="li"
            :x="l.x"
            :dy="li === 0 ? (l.lines.length > 1 ? '-0.25em' : '0.34em') : '1.25em'"
          >
            {{ line }}
          </tspan>
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
        >
          <tspan
            v-for="(line, li) in n.lines"
            :key="li"
            :x="n.cx"
            :dy="li === 0 ? (n.lines.length > 1 ? '-0.25em' : '0.35em') : '1.2em'"
          >
            {{ line }}
          </tspan>
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
  font-size: 11px;
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
  font-size: 13.5px;
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

.fd-group-label-bg {
  fill: var(--dg-bg);
}

.fd-group-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  fill: var(--color-brand);
}
</style>
