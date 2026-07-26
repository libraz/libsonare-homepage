<script setup lang="ts">
/**
 * Shared chrome for every doc figure: the framed surface, the mono uppercase
 * title, the SVG canvas, an optional series legend, and the caption.
 *
 * Figure components own geometry only — they pass a viewBox and draw into the
 * default slot using the `.fx-*` vocabulary from styles/figures.css. Reusing
 * the `.doc-diagram-*` classes keeps figures and FlowDiagram/SequenceDiagram
 * visually interchangeable inside a page.
 */
export interface FigureLegendItem {
  /** Series index 1-5, matching the --fx-N palette; 0 is the neutral rule colour. */
  series?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Swatch form: a line (default), a filled block, or a dashed guide. */
  shape?: 'line' | 'block' | 'dashed';
  label: string;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Coordinate space the slot content is drawn in. */
    viewBox: string;
    /** Intrinsic width in px; the SVG scales down but never past 60%. */
    width: number;
    legend?: FigureLegendItem[];
    /** Screen-reader description of what the figure shows. */
    ariaLabel?: string;
  }>(),
  {
    legend: () => [],
  },
);
</script>

<template>
  <figure class="doc-diagram-wrap doc-figure">
    <figcaption v-if="props.title" class="doc-diagram-head">{{ props.title }}</figcaption>
    <svg
      class="doc-diagram-svg"
      :viewBox="props.viewBox"
      :style="{ maxWidth: `${props.width}px`, minWidth: `${Math.round(props.width * 0.6)}px` }"
      role="img"
      :aria-label="props.ariaLabel ?? props.title ?? 'Figure'"
      xmlns="http://www.w3.org/2000/svg"
    >
      <slot />
    </svg>
    <ul v-if="props.legend.length > 0" class="fx-legend">
      <li v-for="(item, i) in props.legend" :key="`lg-${i}`">
        <span
          class="fx-legend-swatch"
          :data-series="item.series ?? 1"
          :data-shape="item.shape ?? 'line'"
        />
        <span>{{ item.label }}</span>
      </li>
    </ul>
    <div v-if="props.caption" class="doc-diagram-caption">{{ props.caption }}</div>
  </figure>
</template>
