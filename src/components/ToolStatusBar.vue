<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { StatusIndicator } from '@/components/ui';

export interface ToolStatusField {
  key: string;
  value: string;
  wide?: boolean;
}

const props = defineProps<{
  status: 'idle' | 'active' | 'warning' | 'error';
  label: string;
  pulse?: boolean;
  fields: ToolStatusField[];
}>();

const scrollerRef = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function syncScroll() {
  const el = scrollerRef.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 1;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

onMounted(() => {
  const el = scrollerRef.value;
  if (!el) return;
  syncScroll();
  el.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll);
});

onBeforeUnmount(() => {
  scrollerRef.value?.removeEventListener('scroll', syncScroll);
  window.removeEventListener('resize', syncScroll);
});

watch(
  () => props.fields,
  () => {
    nextTick(syncScroll);
  },
  { deep: true },
);
</script>

<template>
  <div class="tool-statusbar" role="status" aria-live="polite">
    <div
      ref="scrollerRef"
      class="tool-statusbar__inner"
      :class="{
        'tool-statusbar__inner--fade-left': canScrollLeft,
        'tool-statusbar__inner--fade-right': canScrollRight,
      }"
    >
      <StatusIndicator
        :status="status"
        :label="label"
        :pulse="pulse"
        class="tool-statusbar__status"
      />
      <span class="tool-statusbar__divider" aria-hidden="true"></span>
      <template v-for="(field, index) in fields" :key="field.key">
        <span v-if="index === 5" class="tool-statusbar__divider" aria-hidden="true"></span>
        <span class="tool-statusbar__field">
          <span class="tool-statusbar__key">{{ field.key }}</span>
          <span class="tool-statusbar__value" :class="{ 'tool-statusbar__value--wide': field.wide }">
            {{ field.value }}
          </span>
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tool-statusbar {
  position: relative;
  z-index: 8;
  border-bottom: 1px solid var(--demo-border);
  background: var(--demo-bg-overlay);
}

.tool-statusbar__inner {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 7px 24px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tool-statusbar__inner::-webkit-scrollbar {
  display: none;
}

.tool-statusbar__inner--fade-left {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px);
  mask-image: linear-gradient(90deg, transparent, #000 24px);
}

.tool-statusbar__inner--fade-right {
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
}

.tool-statusbar__inner--fade-left.tool-statusbar__inner--fade-right {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
}

.tool-statusbar__status,
.tool-statusbar__divider {
  flex: 0 0 auto;
}

.tool-statusbar__divider {
  width: 1px;
  height: 18px;
  background: var(--demo-border);
}

.tool-statusbar__field {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
}

.tool-statusbar__key {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.tool-statusbar__value {
  color: var(--demo-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.tool-statusbar__value--wide {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

@media (max-width: 720px) {
  .tool-statusbar__inner {
    padding: 7px 16px;
    gap: 12px;
  }
}
</style>
