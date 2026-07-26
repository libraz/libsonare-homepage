<script setup lang="ts">
/**
 * Why the estimated dimensions are acoustic rather than architectural.
 *
 * The measured space has alcoves, angled walls, and absorptive furniture. The
 * inversion does not recover any of that — it recovers the one rectangular room
 * whose volume and total absorption decay the same way. Drawing the two side by
 * side is the fastest way to show that the output is an equivalence, not a
 * floor plan.
 */
import { computed } from 'vue';
import FigureFrame from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'measured'
  | 'equivalent'
  | 'link'
  | 'source'
  | 'listener'
  | 'absorbers'
  | 'length'
  | 'width'
  | 'volume';

const DEFAULTS: Record<Key, string> = {
  measured: 'the space that was recorded',
  equivalent: 'the equivalent shoebox',
  link: 'same decay',
  source: 'source',
  listener: 'mic',
  absorbers: 'absorptive surfaces',
  length: 'L',
  width: 'W',
  volume: 'V = L × W × H',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

// An L-shaped hall with one angled corner — deliberately nothing a shoebox
// could describe geometrically.
const PLAN = '50,192 50,92 96,50 252,50 252,122 192,122 192,192';

const BOX = { x: 356, y: 70, w: 200, h: 112 };

const absorbers = [
  { x: 104, y: 56, w: 46, h: 9 },
  { x: 236, y: 66, w: 9, h: 44 },
  { x: 58, y: 176, w: 40, h: 9 },
];

const box = computed(() => ({
  cx: BOX.x + BOX.w / 2,
  cy: BOX.y + BOX.h / 2,
  right: BOX.x + BOX.w,
  bottom: BOX.y + BOX.h,
}));
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 258"
    :width="640"
  >
    <!-- ===== Measured space ===== -->
    <text class="fx-axis-label" :x="50" :y="34">{{ label('measured') }}</text>
    <polygon class="fx-block fx-block--muted" :points="PLAN" />
    <rect
      v-for="(a, i) in absorbers"
      :key="`abs-${i}`"
      class="fx-block fx-block--2"
      :x="a.x"
      :y="a.y"
      :width="a.w"
      :height="a.h"
      rx="2"
    />
    <text class="fx-note" :x="104" :y="150">{{ label('absorbers') }}</text>
    <path class="fx-leader" d="M 100 146 L 84 178" />

    <circle class="fx-dot fx-dot--3" cx="146" cy="86" r="4" />
    <text class="fx-value fx-value--3" :x="156" :y="90">{{ label('source') }}</text>
    <circle class="fx-dot fx-dot--hollow" cx="118" cy="168" r="4" />
    <text class="fx-value" :x="128" :y="172">{{ label('listener') }}</text>

    <!-- ===== Equivalence arrow ===== -->
    <text class="fx-axis-label" :x="302" :y="112" text-anchor="middle">{{ label('link') }}</text>
    <path class="fx-axis" d="M 272 126 L 330 126" />
    <path class="fx-axis" d="M 322 121 L 331 126 L 322 131" />

    <!-- ===== Equivalent shoebox ===== -->
    <text class="fx-axis-label" :x="BOX.x" :y="34">{{ label('equivalent') }}</text>
    <rect
      class="fx-block"
      :x="BOX.x"
      :y="BOX.y"
      :width="BOX.w"
      :height="BOX.h"
      rx="2"
    />
    <text class="fx-value fx-value--1" :x="box.cx" :y="box.cy + 4" text-anchor="middle">
      {{ label('volume') }}
    </text>

    <!-- Length dimension -->
    <path class="fx-leader" :d="`M ${BOX.x} ${box.bottom + 8} L ${BOX.x} ${box.bottom + 24}`" />
    <path class="fx-leader" :d="`M ${box.right} ${box.bottom + 8} L ${box.right} ${box.bottom + 24}`" />
    <path class="fx-axis" :d="`M ${BOX.x} ${box.bottom + 18} L ${box.right} ${box.bottom + 18}`" />
    <rect class="fx-plate" :x="box.cx - 12" :y="box.bottom + 10" width="24" height="16" />
    <text class="fx-value" :x="box.cx" :y="box.bottom + 22" text-anchor="middle">
      {{ label('length') }}
    </text>

    <!-- Width dimension -->
    <path class="fx-leader" :d="`M ${box.right + 8} ${BOX.y} L ${box.right + 24} ${BOX.y}`" />
    <path class="fx-leader" :d="`M ${box.right + 8} ${box.bottom} L ${box.right + 24} ${box.bottom}`" />
    <path class="fx-axis" :d="`M ${box.right + 18} ${BOX.y} L ${box.right + 18} ${box.bottom}`" />
    <rect class="fx-plate" :x="box.right + 10" :y="box.cy - 9" width="16" height="18" />
    <text class="fx-value" :x="box.right + 18" :y="box.cy + 4" text-anchor="middle">
      {{ label('width') }}
    </text>
  </FigureFrame>
</template>
