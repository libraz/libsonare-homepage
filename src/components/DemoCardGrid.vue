<script setup lang="ts">
import { computed } from 'vue';
import DemoCardVisual from '@/components/demos/DemoCardVisual.vue';
import { buildDemoCards, demoCardsCopy } from '@/components/demos/demoCards';
import { useCarouselScroll } from '@/components/demos/useCarouselScroll';
import { useI18n } from '@/composables/useI18n';

const props = withDefaults(
  defineProps<{
    /** 'carousel' (default) for horizontal scroll, 'grid' to wrap all cards into rows. */
    layout?: 'carousel' | 'grid';
  }>(),
  {
    layout: 'carousel',
  },
);

const { localizedPath, localizedValue } = useI18n();
const isGrid = computed(() => props.layout === 'grid');
const { scroller, canScrollLeft, canScrollRight, scrollByCard } = useCarouselScroll({
  enabled: computed(() => !isGrid.value),
});

const copy = computed(() => localizedValue(demoCardsCopy));
const prevLabel = computed(() => copy.value.prevLabel);
const nextLabel = computed(() => copy.value.nextLabel);
const cards = computed(() => buildDemoCards(copy.value, localizedPath));
</script>

<template>
  <div
    class="demo-carousel"
    :class="{
      'demo-carousel--grid': isGrid,
      'demo-carousel--fade-left': canScrollLeft,
      'demo-carousel--fade-right': canScrollRight,
    }"
  >
    <button
      v-if="!isGrid"
      type="button"
      class="demo-carousel__nav demo-carousel__nav--prev"
      :class="{ 'demo-carousel__nav--hidden': !canScrollLeft }"
      :aria-label="prevLabel"
      :tabindex="canScrollLeft ? 0 : -1"
      @click="scrollByCard(-1)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <button
      v-if="!isGrid"
      type="button"
      class="demo-carousel__nav demo-carousel__nav--next"
      :class="{ 'demo-carousel__nav--hidden': !canScrollRight }"
      :aria-label="nextLabel"
      :tabindex="canScrollRight ? 0 : -1"
      @click="scrollByCard(1)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
    <div ref="scroller" class="demo-grid" :class="{ 'demo-grid--wrap': isGrid }">
    <a
      v-for="(card, idx) in cards"
      :key="card.id"
      :href="card.path"
      class="demo-grid__card"
      :class="{ 'demo-grid__card--accent': card.accent }"
      :style="{ '--i': idx }"
    >
      <div class="demo-grid__head">
        <span class="demo-grid__status" :class="{ 'demo-grid__status--accent': card.accent }">
          <span class="demo-grid__status-dot"></span>
          {{ card.status }}
        </span>
        <span class="demo-grid__eyebrow">{{ card.eyebrow }}</span>
      </div>

      <DemoCardVisual :visual="card.visual" />

      <h3 class="demo-grid__title">{{ card.title }}</h3>
      <p class="demo-grid__tagline">{{ card.tagline }}</p>

      <ul class="demo-grid__chips">
        <li v-for="chip in card.chips" :key="chip">{{ chip }}</li>
      </ul>

      <span class="demo-grid__cta">
        {{ card.cta }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </a>
    </div>
  </div>
</template>

<style src="./demos/DemoCardGrid.css"></style>
