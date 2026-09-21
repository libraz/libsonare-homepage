import { onBeforeUnmount, onMounted, type Ref, ref } from 'vue';

export interface CarouselScrollOptions {
  enabled: Ref<boolean>;
  cardSelector?: string;
}

export function useCarouselScroll(options: CarouselScrollOptions) {
  const scroller = ref<HTMLElement | null>(null);
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);
  let resizeObserver: ResizeObserver | null = null;

  function syncScrollState() {
    const el = scroller.value;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    canScrollLeft.value = el.scrollLeft > 4;
    canScrollRight.value = el.scrollLeft < max - 4;
  }

  function scrollByCard(direction: -1 | 1) {
    const el = scroller.value;
    if (!el) return;
    const selector = options.cardSelector ?? '.demo-grid__card';
    const card = el.querySelector<HTMLElement>(selector);
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  onMounted(() => {
    if (!options.enabled.value) return;
    syncScrollState();
    scroller.value?.addEventListener('scroll', syncScrollState, { passive: true });
    if (typeof ResizeObserver !== 'undefined' && scroller.value) {
      resizeObserver = new ResizeObserver(syncScrollState);
      resizeObserver.observe(scroller.value);
    }
  });

  onBeforeUnmount(() => {
    scroller.value?.removeEventListener('scroll', syncScrollState);
    resizeObserver?.disconnect();
  });

  return {
    scroller,
    canScrollLeft,
    canScrollRight,
    scrollByCard,
    syncScrollState,
  };
}
