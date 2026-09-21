<script setup lang="ts">
/**
 * The single mechanism for telling readers that a documented feature is new,
 * partial, or experimental. Visually related to the `::: tip` / `::: info`
 * custom blocks (same accent-token idiom) but a dashed border keeps it
 * distinguishable at a glance — "young, still moving" rather than a warning.
 *
 * `item` is a stable id a gate can grep for in the rendered markup; it does
 * not need to be legible to the reader. `labels` carries all reader-visible
 * text — callers pass already-localized strings, there is no lookup here.
 */
interface MaturityLabels {
  title: string;
  body: string;
}

defineProps<{
  /** Stable kebab-case id for the thing whose maturity is being described. */
  item: string;
  labels: MaturityLabels;
}>();
</script>

<template>
  <aside role="note" class="maturity-note" :data-maturity-item="item">
    <p class="maturity-note-title" role="heading" aria-level="4">
      {{ labels.title }}
    </p>
    <div class="maturity-note-body">
      <slot>{{ labels.body }}</slot>
    </div>
  </aside>
</template>

<style scoped>
.maturity-note {
  --mn-accent: var(--cb-info);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin: 1.5rem 0;
  border: 1px dashed color-mix(in srgb, var(--mn-accent) 45%, transparent);
  background: color-mix(in srgb, var(--mn-accent) 6%, transparent);
}

.maturity-note-title {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 600;
  margin: 0 0 0.45rem;
  color: var(--mn-accent);
}

.maturity-note-body {
  font-size: 0.93rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.maturity-note-body :deep(p) {
  margin: 0.4rem 0;
}

.maturity-note-body :deep(p:first-child) {
  margin-top: 0;
}

.maturity-note-body :deep(p:last-child) {
  margin-bottom: 0;
}

.maturity-note-body :deep(ul),
.maturity-note-body :deep(ol) {
  margin: 0.4rem 0;
  padding-left: 1.25rem;
}
</style>
