<script setup lang="ts">
import { useRouter } from 'vitepress';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { type SearchResult, useSearch } from '@/composables/useSearch';
import type { SearchSection } from '@/utils/searchIndex';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    inline?: boolean;
    /** When set, filter results to a single site section. Used by a page that
     *  wants its hit count and dropdown to reflect only its own universe. */
    section?: SearchSection;
    /** Take the caret on mount. Used by the full search page. */
    autofocus?: boolean;
    /** `nav` is the compact form that lives in the navigation bar. */
    variant?: 'default' | 'nav';
  }>(),
  {
    placeholder: '',
    inline: false,
    section: undefined,
    autofocus: false,
    variant: 'default',
  },
);

const emit = defineEmits<{
  'update:query': [value: string];
  'update:results': [value: SearchResult[]];
  'update:error': [value: boolean];
}>();

const router = useRouter();
const { locale, t, localizedPath } = useI18n();

const { query, results: rawResults, isLoading, hasError } = useSearch(locale);

// Scoped to a single section if `props.section` is set; otherwise global.
const results = computed<SearchResult[]>(() =>
  props.section ? rawResults.value.filter((r) => r.section === props.section) : rawResults.value,
);

const defaultPlaceholder = computed(() => props.placeholder || t('search.placeholder'));

// Dropdown state
const showDropdown = ref(false);
const activeIndex = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);

const isActive = computed(() => query.value.trim().length > 0);
const displayResults = computed(() => results.value.slice(0, 8));

/**
 * The nav bar and a page rail can both hold a field at once, so the listbox
 * needs an id of its own for `aria-controls` / `aria-activedescendant` to point
 * anywhere meaningful. `useId` is stable across the server and client renders,
 * so the pair does not break on hydration.
 */
const listboxId = `sb-listbox-${useId()}`;

/** One name for the open state, so the markup and ARIA cannot disagree. */
const isDropdownOpen = computed(() => !props.inline && showDropdown.value && !isLoading.value);

/**
 * What a screen reader is told about the state of the search. A live region
 * only reports a change if it was already in the document, so this one is
 * always rendered and only its text swaps — the loader and the dropdown both
 * come and go, and a region mounted alongside them announces nothing.
 *
 * In inline mode the results are the parent's to present, so only the wait is
 * worth reporting.
 */
const statusMessage = computed(() => {
  if (isLoading.value) return t('search.loading');
  if (props.inline || !showDropdown.value) return '';
  if (hasError.value) return t('search.error');
  if (displayResults.value.length === 0) return t('search.noResults');
  return '';
});

const searchPagePath = computed(() => `${localizedPath('/search')}.html`);

// The dropdown caps at 8 hits; the overflow row links through to the full
// search page, carrying the query and the current section in the hash.
const seeAllHref = computed(() => {
  const parts = [`q=${encodeURIComponent(query.value.trim())}`];
  if (props.section) parts.push(`section=${props.section}`);
  return `${searchPagePath.value}#${parts.join('&')}`;
});

const seeAllLabel = computed(() => {
  const total = results.value.length;
  if (total > 8) return t('search.seeAll', { total: String(total) });
  return t('search.openPage');
});

// Sync to parent in inline mode
watch(query, (q) => {
  if (props.inline) {
    emit('update:query', q);
  }
});

watch(results, (r) => {
  if (props.inline) {
    emit('update:results', r);
  }
});

watch(hasError, (e) => {
  if (props.inline) {
    emit('update:error', e);
  }
});

// Dropdown visibility
watch(query, (q) => {
  if (!props.inline) {
    showDropdown.value = q.trim().length > 0;
    activeIndex.value = -1;
  }
});

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (props.inline || !showDropdown.value) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, displayResults.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, -1);
  } else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault();
    const result = displayResults.value[activeIndex.value];
    if (result) navigateTo(result.link);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    showDropdown.value = false;
    inputRef.value?.blur();
  }
}

// Through the router, so opening a row with the keyboard is the same
// navigation as clicking it.
function navigateTo(link: string) {
  showDropdown.value = false;
  router.go(link);
}

function clearQuery() {
  query.value = '';
  showDropdown.value = false;
  nextTick(() => inputRef.value?.focus());
}

// Click outside
function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    showDropdown.value = false;
  }
}

// The ⌘K hint only makes sense on a machine with a keyboard, and the modifier
// glyph differs by platform, so it is resolved after mount. It rides on the
// nav field alone — that is where the shortcut puts the caret, and two hints
// on one screen would advertise a key that moves focus somewhere else.
const shortcutHint = ref('');

onMounted(() => {
  document.addEventListener('click', onClickOutside, true);

  // Restore search query from URL hash in inline mode
  if (props.inline) {
    const hash = window.location.hash;
    const qMatch = hash.match(/q=([^&]+)/);
    if (qMatch) {
      query.value = decodeURIComponent(qMatch[1]);
    }
  }

  if (props.autofocus && !query.value) inputRef.value?.focus();

  if (props.variant === 'nav' && !window.matchMedia?.('(pointer: coarse)').matches) {
    shortcutHint.value = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside, true);
});

// Scroll active item into view
watch(activeIndex, async (idx) => {
  if (idx < 0) return;
  await nextTick();
  const el = rootRef.value?.querySelector('.sb-result--active');
  el?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <div ref="rootRef" class="sb" :class="{ 'sb--inline': inline, 'sb--nav': variant === 'nav' }">
    <div class="sb-field">
      <!-- Search icon -->
      <svg class="sb-field__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <!--
        With a dropdown attached the field is a combobox and has to say so: the
        placeholder is gone the moment anything is typed, and the arrow keys move
        a CSS class that nothing announces unless `aria-activedescendant` points
        at the row. The inline variant has no popup, so it carries the name only
        — claiming a combobox that controls nothing would be worse than silence.
      -->
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="sb-field__input"
        :role="inline ? undefined : 'combobox'"
        :aria-label="t('search.label')"
        :aria-autocomplete="inline ? undefined : 'list'"
        :aria-expanded="inline ? undefined : isDropdownOpen"
        :aria-controls="isDropdownOpen ? listboxId : undefined"
        :aria-activedescendant="isDropdownOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined"
        :placeholder="defaultPlaceholder"
        spellcheck="false"
        autocomplete="off"
        @keydown="onKeydown"
        @focus="() => { if (!inline && isActive) showDropdown = true }"
      />

      <!-- Loading indicator. Purely visual: the wait is announced by the live
           region below, which outlives this element. -->
      <span v-if="isLoading" class="sb-field__loader" aria-hidden="true">
        <span class="sb-field__loader-dot" />
        <span class="sb-field__loader-dot" />
        <span class="sb-field__loader-dot" />
      </span>

      <!-- Hit count -->
      <span v-else-if="isActive && !hasError" class="sb-field__hits">
        {{ results.length }}
      </span>

      <!-- Keyboard shortcut hint, while the field is idle -->
      <kbd v-if="!isActive && shortcutHint" class="sb-field__kbd">{{ shortcutHint }}</kbd>

      <!-- Clear -->
      <button v-if="isActive" type="button" class="sb-field__clear" :aria-label="t('search.clear')" @click="clearQuery">&times;</button>
    </div>

    <!--
      Announced, never seen. Kept outside every `v-if` so that a change of state
      lands in a region the reader was already watching.
    -->
    <span class="sb-a11y-status" role="status">{{ statusMessage }}</span>

    <!-- Dropdown (non-inline mode) -->
    <Transition name="sb-drop">
      <div v-if="isDropdownOpen" class="sb-dropdown">
        <!--
          The empty and error rows sit outside the listbox: a listbox may hold
          options and nothing else, and a reader that honours that will skip
          straight past a row explaining why there are none.
        -->
        <div v-if="hasError" class="sb-empty sb-empty--error">
          {{ t('search.error') }}
        </div>

        <div v-else-if="displayResults.length === 0" class="sb-empty">
          <span class="sb-empty__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="8" x2="14" y2="14" />
              <line x1="14" y1="8" x2="8" y2="14" />
            </svg>
          </span>
          {{ t('search.noResults') }}
        </div>

        <div :id="listboxId" class="sb-list" role="listbox" :aria-label="t('search.label')">
          <!--
            `tabindex="-1"` keeps the caret in the field: the active row is named
            through `aria-activedescendant`, and a link that also takes Tab would
            move real focus somewhere the combobox still claims it is not.
          -->
          <a
            v-for="(r, i) in displayResults"
            :id="`${listboxId}-${i}`"
            :key="r.link"
            :href="r.link"
            class="sb-result"
            :class="{ 'sb-result--active': i === activeIndex }"
            role="option"
            tabindex="-1"
            :aria-selected="i === activeIndex"
            @mouseenter="activeIndex = i"
            @click.prevent="navigateTo(r.link)"
          >
            <span class="sb-result__badge">{{ t(`search.sections.${r.section}`) }}</span>
            <span class="sb-result__body">
              <span class="sb-result__title">{{ r.title }}</span>
              <span v-if="r.description" class="sb-result__desc">{{ r.description }}</span>
              <span v-if="r.heading" class="sb-result__heading">
                <span class="sb-result__heading-chevron" aria-hidden="true">›</span>{{ r.heading.text }}
              </span>
            </span>
          </a>
        </div>

        <!-- Pinned below the scroll area: with the nav field in place this row
             is the main way through to the full search page, so it must not
             scroll out of sight. -->
        <a v-if="results.length" class="sb-more" :href="seeAllHref">
          <span>{{ seeAllLabel }}</span>
          <svg class="sb-more__arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sb {
  position: relative;
  width: 100%;
}

/* Carries the live region without taking any room or leaving the page. */
.sb-a11y-status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* ── Input Field ───────────────────────────────────────── */
.sb-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 0.85rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.sb-field:focus-within {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
  background: var(--color-bg-primary);
}

.sb-field__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.sb-field:focus-within .sb-field__icon {
  color: var(--vp-c-brand-1);
}

.sb-field__input {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0;
  font-family: var(--font-body);
  font-size: 0.88rem;
  font-weight: 400;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.sb-field__input::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
}

/* ── Loading dots ──────────────────────────────────────── */
.sb-field__loader {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 0 0.15rem;
}

.sb-field__loader-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  opacity: 0.4;
  animation: sb-pulse 1s ease-in-out infinite;
}

.sb-field__loader-dot:nth-child(2) { animation-delay: 0.15s; }
.sb-field__loader-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes sb-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.85); }
  50% { opacity: 0.8; transform: scale(1); }
}

/* ── Hit count ─────────────────────────────────────────── */
.sb-field__hits {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 0.15em 0.45em;
  border-radius: 4px;
  flex-shrink: 0;
  min-width: 1.4em;
  text-align: center;
}

/* ── Shortcut hint ─────────────────────────────────────── */
.sb-field__kbd {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  border-radius: 5px;
  padding: 0.2em 0.42em;
  flex-shrink: 0;
  white-space: nowrap;
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.sb-field:focus-within .sb-field__kbd {
  opacity: 0;
}

/* ── Clear button ──────────────────────────────────────── */
.sb-field__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.sb-field__clear:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border-color: var(--color-border-default);
}

/* ── Dropdown ──────────────────────────────────────────── */
.sb-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  max-height: 420px;
  overflow: hidden;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  box-shadow:
    0 14px 38px -10px rgba(0, 0, 0, 0.16),
    0 3px 10px -3px rgba(0, 0, 0, 0.07);
  padding: 0.35rem;
}

/* Translucent material where the platform can blur behind it — the panel
   picks up the page underneath instead of reading as an opaque slab. */
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .sb-dropdown {
    background: color-mix(in srgb, var(--color-bg-primary) 78%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(22px);
    backdrop-filter: saturate(180%) blur(22px);
  }
}

.dark .sb-dropdown {
  box-shadow:
    0 14px 38px -10px rgba(0, 0, 0, 0.5),
    0 3px 10px -3px rgba(0, 0, 0, 0.3);
}

/* Dropdown transition — settles from the field it belongs to. */
.sb-drop-enter-active,
.sb-drop-leave-active {
  transform-origin: top center;
  transition:
    opacity 0.22s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}

.sb-drop-enter-from,
.sb-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .sb-drop-enter-active,
  .sb-drop-leave-active {
    transition-duration: 0.01ms;
  }
  .sb-drop-enter-from,
  .sb-drop-leave-to {
    transform: none;
  }
}

/* Only the hits scroll; the footer row below stays put. */
.sb-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ── Result item ───────────────────────────────────────── */
.sb-result {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.6rem;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.14s cubic-bezier(0.32, 0.72, 0, 1);
}

.sb-result--active {
  background: var(--color-bg-secondary);
}

/* ── Section badge — one flat treatment for every section; the label text
   (Docs / Glossary / Demos) is what tells them apart. ─────────────────── */
.sb-result__badge {
  font-family: var(--font-mono);
  font-size: 0.52rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  padding: 0.2em 0.45em;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
}

/* ── Result body ───────────────────────────────────────── */
.sb-result__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.sb-result__title {
  font-family: var(--font-body);
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sb-result--active .sb-result__title {
  color: var(--vp-c-brand-1);
}

.sb-result__desc {
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Deep link — the heading the query actually matched, quieter than the
   description so it reads as metadata rather than a second summary. */
.sb-result__heading {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sb-result__heading-chevron {
  margin-right: 0.3em;
  opacity: 0.6;
}

/* ── Empty state ───────────────────────────────────────── */
.sb-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.sb-empty--error {
  color: var(--vp-c-danger-1, #d9534f);
}

.sb-empty__icon {
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  opacity: 0.6;
}

/* ── Footer row through to the full search page ────────── */
.sb-more {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
  padding: 0.55rem 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--color-text-tertiary);
  letter-spacing: 0.04em;
  border-top: 1px solid var(--color-border-default);
  /* Full-bleed to the panel edges, cancelling its padding. */
  margin: 0.25rem -0.35rem -0.35rem;
  border-radius: 0 0 11px 11px;
  text-decoration: none;
  transition:
    color 0.16s cubic-bezier(0.32, 0.72, 0, 1),
    background 0.16s cubic-bezier(0.32, 0.72, 0, 1);
}

.sb-more__arrow {
  opacity: 0.5;
  transition:
    transform 0.22s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.16s;
}

.sb-more:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.sb-more:hover .sb-more__arrow {
  opacity: 1;
  transform: translateX(2px);
}

/* ─────────────────────────────────────────────────────────
   Nav variant — a filled, borderless field sized for the bar.
   Chrome at this scale reads better as a tinted well than as
   an outlined box; the outline only appears on focus.
   ───────────────────────────────────────────────────────── */
.sb--nav .sb-field {
  gap: 0.4rem;
  padding: 0 0.6rem;
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  border-color: transparent;
  border-radius: 8px;
  transition:
    background-color 0.22s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

.sb--nav .sb-field:hover {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}

/* Two rings: a crisp edge, then a soft halo — the field lifts out of the
   bar without changing size, so the menu beside it never shifts. */
.sb--nav .sb-field:focus-within {
  background: var(--color-bg-primary);
  border-color: transparent;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--vp-c-brand-1) 55%, transparent),
    0 0 0 3.5px color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent);
}

/* The bar sets a 24px line-height; left alone it inflates the field to the
   height of a body row, which is far too heavy for chrome this size. */
.sb--nav .sb-field__input {
  padding: 0.4rem 0;
  font-size: 0.8rem;
  line-height: 1.25;
}

.sb--nav .sb-field__icon {
  width: 13px;
  height: 13px;
}

.sb--nav .sb-field__hits,
.sb--nav .sb-field__kbd {
  font-size: 0.55rem;
  line-height: 1.5;
}

.sb--nav .sb-field__clear {
  width: 17px;
  height: 17px;
  font-size: 0.85rem;
}

/* The field is deliberately narrow; the panel is not bound by it. Anchored to
   the field's right edge so it grows inward and never leaves the viewport. */
.sb--nav .sb-dropdown {
  left: auto;
  right: 0;
  width: min(400px, calc(100vw - 2rem));
  max-height: min(60vh, 460px);
}

/* ── Inline mode adjustments ───────────────────────────── */
.sb--inline .sb-field {
  background: transparent;
  border-color: var(--color-border-default);
}

.sb--inline .sb-field:focus-within {
  background: transparent;
}

/* ── Responsive ────────────────────────────────────────── */
@media (max-width: 640px) {
  .sb-field__input {
    font-size: 0.82rem;
  }

  .sb-result {
    padding: 0.45rem 0.5rem;
    gap: 0.45rem;
  }

  .sb-result__title {
    font-size: 0.8rem;
  }

  .sb-result__desc {
    font-size: 0.68rem;
  }
}
</style>
