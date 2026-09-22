<script setup lang="ts">
import { computed } from 'vue';
import SearchBox from '@/components/search/SearchBox.vue';
import { useI18n } from '@/composables/useI18n';

const { t, localizedPath } = useI18n();

const searchPagePath = computed(() => `${localizedPath('/search')}.html`);
</script>

<template>
  <div class="nav-search">
    <!-- Below the menu breakpoint the bar has no room for a field, so it
         collapses to a target that opens the full search page. -->
    <a class="nav-search__button" :href="searchPagePath" :aria-label="t('search.openPage')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </a>

    <SearchBox class="nav-search__field" variant="nav" />
  </div>
</template>

<style scoped>
.nav-search {
  display: flex;
  align-items: center;
}

/* ── Collapsed target ──────────────────────────────────── */
.nav-search__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--color-text-tertiary);
  transition:
    color 0.22s cubic-bezier(0.32, 0.72, 0, 1),
    background-color 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

.nav-search__button:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}

.nav-search__field {
  display: none;
}

/* The menu itself appears at 768px, but between there and 960px the bar is
   already tight — the field only earns its width once the layout opens up. */
@media (min-width: 960px) {
  .nav-search__button {
    display: none;
  }

  .nav-search__field {
    display: block;
    width: 212px;
  }
}

@media (min-width: 1280px) {
  .nav-search__field {
    width: 248px;
  }
}
</style>
