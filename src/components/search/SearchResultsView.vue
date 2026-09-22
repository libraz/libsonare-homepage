<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import SearchBox from '@/components/search/SearchBox.vue';
import { useI18n } from '@/composables/useI18n';
import { type SearchResult, useSearch } from '@/composables/useSearch';
import { SEARCH_SECTIONS, type SearchSection } from '@/utils/searchIndex';

type Scope = 'all' | SearchSection;

const { t } = useI18n();

const query = ref('');
const results = ref<SearchResult[]>([]);
const searchError = ref(false);
const scope = ref<Scope>('all');

const isQueryActive = computed(() => query.value.trim().length > 0);

// Counts are always taken over the full result set, so the tab strip shows
// where a query landed even while a section other than "all" is selected.
const counts = computed<Record<Scope, number>>(() => {
  const c: Record<Scope, number> = { all: results.value.length, doc: 0, glossary: 0, demo: 0 };
  for (const r of results.value) c[r.section] += 1;
  return c;
});

const scopedResults = computed<SearchResult[]>(() => {
  if (scope.value === 'all') return results.value;
  return results.value.filter((r) => r.section === scope.value);
});

const resultCountText = computed(() => {
  const total = scopedResults.value.length;
  const trimmedQuery = query.value.trim();
  if (total === 1) return t('search.page.resultCountOne', { query: trimmedQuery });
  return t('search.page.resultCount', { total: String(total), query: trimmedQuery });
});

/* ── Hash sync (q=, section=) — SearchBox restores q= itself on mount. */
const sectionPattern = new RegExp(`section=(${[...SEARCH_SECTIONS, 'all'].join('|')})`);

// The field restores `q=` as it mounts, which would rewrite the hash before
// the section had been read back out of it.
let hashRead = false;

function readHash() {
  const match = window.location.hash.match(sectionPattern);
  if (match) scope.value = match[1] as Scope;
  hashRead = true;
}

function writeHash() {
  if (!hashRead || typeof window === 'undefined') return;
  const parts: string[] = [];
  if (query.value.trim()) parts.push(`q=${encodeURIComponent(query.value.trim())}`);
  if (scope.value !== 'all') parts.push(`section=${scope.value}`);
  const hash = parts.length ? `#${parts.join('&')}` : window.location.pathname;
  window.history.replaceState(null, '', hash);
}

watch(query, writeHash);
watch(scope, writeHash);

onMounted(readHash);

function onSearchQuery(q: string) {
  query.value = q;
}
function onSearchResults(r: SearchResult[]) {
  results.value = r;
}
function onSearchError(e: boolean) {
  searchError.value = e;
}
</script>

<template>
  <div class="search-page">
    <!-- ── Head — the standfirst plus the field is the whole header. ─────── -->
    <header class="search-page__head">
      <h1 class="search-page__title">{{ t('search.page.title') }}</h1>
      <p class="search-page__standfirst">{{ t('search.page.standfirst') }}</p>
    </header>

    <div class="search-page__field">
      <SearchBox
        inline
        autofocus
        :placeholder="t('search.page.placeholder')"
        @update:query="onSearchQuery"
        @update:results="onSearchResults"
        @update:error="onSearchError"
      />
    </div>

    <!-- ── Scope tabs — equal-width segmented control. ───────────────────── -->
    <nav v-if="isQueryActive && !searchError" class="search-page__scopes" role="tablist" :aria-label="t('search.label')">
      <button
        type="button"
        class="scope-tab"
        :class="{ 'scope-tab--active': scope === 'all' }"
        role="tab"
        :aria-selected="scope === 'all'"
        @click="scope = 'all'"
      >
        <span class="scope-tab__label">{{ t('search.page.scopeAll') }}</span>
        <span class="scope-tab__count">{{ counts.all }}</span>
      </button>
      <button
        v-for="section in SEARCH_SECTIONS"
        :key="section"
        type="button"
        class="scope-tab"
        :class="{ 'scope-tab--active': scope === section }"
        role="tab"
        :aria-selected="scope === section"
        @click="scope = section"
      >
        <span class="scope-tab__label">{{ t(`search.sections.${section}`) }}</span>
        <span class="scope-tab__count">{{ counts[section] }}</span>
      </button>
    </nav>

    <p v-if="isQueryActive && !searchError" class="search-page__count">{{ resultCountText }}</p>

    <!-- ── Results panel — a reserved minimum height keeps the page from
         jumping as the scope switches or as results stream in. ──────────── -->
    <div class="search-page__panel">
      <div v-if="searchError" class="search-page__state search-page__state--error">
        <p class="search-page__state-line">{{ t('search.error') }}</p>
      </div>

      <ol v-else-if="isQueryActive && scopedResults.length" class="results">
        <li v-for="r in scopedResults" :key="r.link" class="result">
          <a :href="r.link" class="result__link">
            <span class="result__badge">{{ t(`search.sections.${r.section}`) }}</span>
            <span class="result__body">
              <span class="result__title">{{ r.title }}</span>
              <span v-if="r.description" class="result__desc">{{ r.description }}</span>
              <span v-if="r.heading" class="result__heading">
                <span class="result__heading-chevron" aria-hidden="true">›</span>{{ r.heading.text }}
              </span>
            </span>
            <svg class="result__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </li>
      </ol>

      <div v-else-if="isQueryActive" class="search-page__state search-page__state--empty">
        <p class="search-page__state-line">{{ t('search.page.empty', { query: query.trim() }) }}</p>
        <p class="search-page__state-hint">{{ t('search.page.emptyHint') }}</p>
      </div>

      <div v-else class="search-page__state search-page__state--idle">
        <p class="search-page__state-line">{{ t('search.page.idle') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  display: block;
  width: 100%;
  max-width: 720px;
  margin: 0 auto 4rem;
  box-sizing: border-box;
}

/* ── Head. ─────────────────────────────────────────────── */
.search-page__head {
  margin: 1rem 0 1.6rem;
}
.search-page__title {
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 4vw, 2.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0;
  color: var(--color-text-primary);
  text-wrap: balance;
}
.search-page__standfirst {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.86rem;
  line-height: 1.6;
  letter-spacing: -0.005em;
  color: var(--color-text-secondary);
  margin: 0.65rem 0 0;
  max-width: 42em;
  text-wrap: pretty;
}

.search-page__field {
  margin: 1.6rem 0 1.4rem;
}

/* ── Scope tabs — full-width, equal-width segments regardless of label
   length across locales. ─────────────────────────────────────────────── */
.search-page__scopes {
  display: flex;
  width: 100%;
  gap: var(--space-1);
  margin: 0 0 1.2rem;
  padding: 3px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}
.scope-tab {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 0;
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--color-text-tertiary);
  transition: color 0.15s, background 0.15s;
}
.scope-tab:hover {
  color: var(--color-text-primary);
}
.scope-tab--active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.scope-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.4em;
  min-width: 1.4em;
  padding: 0 0.35em;
  border-radius: var(--radius-full);
  font-size: 0.62rem;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  color: var(--color-text-tertiary);
}
.scope-tab--active .scope-tab__count {
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent);
  color: var(--vp-c-brand-1);
}

/* ── Result count line. ────────────────────────────────── */
.search-page__count {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--color-text-tertiary);
  margin: 0 0 0.8rem;
}

/* ── Panel — reserves height so switching scope or query never collapses
   and re-expands the page around it. ──────────────────────────────────── */
.search-page__panel {
  min-height: 420px;
}

/* ── States. ───────────────────────────────────────────── */
.search-page__state {
  padding: 2.4rem 1rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  text-align: center;
  border: 1px dashed var(--color-border-default);
  border-radius: var(--radius-sm);
}
.search-page__state-line {
  margin: 0;
}
.search-page__state-hint {
  margin: 0.5rem 0 0;
  color: var(--color-text-muted);
  opacity: 0.8;
}
.search-page__state--error {
  color: var(--vp-c-danger-1, #d9534f);
  border-color: color-mix(in srgb, var(--vp-c-danger-1, #d9534f) 40%, transparent);
}

/* ── Results. ──────────────────────────────────────────── */
.results {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--color-border-default);
}
.result {
  border-bottom: 1px solid var(--color-border-default);
}
.result__link {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.95rem 0.3rem;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.result__link:hover {
  background: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
}
.result__badge {
  flex-shrink: 0;
  margin-top: 0.25em;
  padding: 0.2em 0.5em;
  font-family: var(--font-mono);
  font-size: 0.52rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
  border-radius: 3px;
}
.result__body {
  flex: 1;
  min-width: 0;
}
.result__title {
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 600;
  letter-spacing: -0.012em;
  line-height: 1.4;
  margin: 0 0 0.3rem;
  color: var(--color-text-primary);
  text-wrap: balance;
}
.result__link:hover .result__title {
  color: var(--vp-c-brand-1);
}
.result__desc {
  display: -webkit-box;
  font-family: var(--font-body);
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--color-text-tertiary);
  margin: 0;
  text-wrap: pretty;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result__heading {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result__heading-chevron {
  margin-right: 0.35em;
  opacity: 0.6;
}
.result__arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  transition: color 0.15s, transform 0.15s;
}
.result__link:hover .result__arrow {
  color: var(--color-text-secondary);
  transform: translateX(3px);
}

@media (max-width: 640px) {
  .search-page__title { font-size: clamp(1.6rem, 8vw, 2.1rem); }
  .search-page__scopes { flex-wrap: wrap; }
  .scope-tab { flex: 1 1 40%; }
  .result__arrow { display: none; }
}
</style>
