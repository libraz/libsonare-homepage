<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

type Placement = 'top' | 'bottom'

const props = withDefaults(
  defineProps<{
    eyebrow?: string
    title?: string
    body?: string
    tip?: string
    tipLabel?: string
    /** Default-value chip (e.g. "-18 dB" / "0 (off)"). */
    defaultValue?: string
    /** Rationale shown next to the default value chip. */
    defaultRationale?: string
    /** Label for the default section (defaults to "Default"). */
    defaultLabel?: string
    href?: string
    linkLabel?: string
    placement?: 'auto' | Placement
    maxWidth?: number
    /** Adds aria-label to the trigger wrapper. */
    ariaLabel?: string
  }>(),
  {
    placement: 'auto',
    maxWidth: 296,
  },
)

const triggerRef = ref<HTMLSpanElement | null>(null)
const popoverRef = ref<HTMLDivElement | null>(null)
const open = ref(false)
const placementState = ref<Placement>('top')

const styleVars = computed(() => ({ '--tt-max-width': `${props.maxWidth}px` }))

const popoverStyle = ref<Record<string, string>>({})

let showTimer: number | null = null
let hideTimer: number | null = null

function clearTimers() {
  if (showTimer !== null) {
    window.clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

function show() {
  if (typeof window === 'undefined') return
  clearTimers()
  if (open.value) return
  showTimer = window.setTimeout(() => {
    open.value = true
    void nextTick(updatePosition)
  }, 80)
}

function hide() {
  clearTimers()
  hideTimer = window.setTimeout(() => {
    open.value = false
  }, 100)
}

function cancelHide() {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

function toggle() {
  if (open.value) {
    clearTimers()
    open.value = false
  } else {
    clearTimers()
    open.value = true
    void nextTick(updatePosition)
  }
}

function updatePosition() {
  const trigger = triggerRef.value
  const popover = popoverRef.value
  if (!trigger || !popover) return

  const triggerRect = trigger.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const gap = 10
  const edgePadding = 12

  let placement: Placement
  if (props.placement === 'top' || props.placement === 'bottom') {
    placement = props.placement
  } else {
    const spaceAbove = triggerRect.top
    const spaceBelow = viewportH - triggerRect.bottom
    placement = spaceAbove >= popoverRect.height + gap + edgePadding || spaceAbove >= spaceBelow ? 'top' : 'bottom'
  }
  placementState.value = placement

  const top =
    placement === 'top'
      ? triggerRect.top - popoverRect.height - gap
      : triggerRect.bottom + gap

  // Center horizontally over trigger, clamped to viewport.
  const triggerCenter = triggerRect.left + triggerRect.width / 2
  const half = popoverRect.width / 2
  let left = triggerCenter - half
  left = Math.max(edgePadding, Math.min(left, viewportW - popoverRect.width - edgePadding))

  // Arrow offset (where arrow should sit horizontally relative to popover).
  const arrowOffset = Math.max(14, Math.min(triggerCenter - left, popoverRect.width - 14))

  popoverStyle.value = {
    top: `${Math.max(edgePadding, top)}px`,
    left: `${left}px`,
    '--tt-arrow-x': `${arrowOffset}px`,
  }
}

function handleScrollOrResize() {
  if (!open.value) return
  updatePosition()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    clearTimers()
    open.value = false
  }
}

watch(open, (next) => {
  if (typeof window === 'undefined') return
  if (next) {
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
    window.removeEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  clearTimers()
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <span
    ref="triggerRef"
    class="tt-trigger"
    :aria-label="ariaLabel"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @click="toggle"
  >
    <slot />

    <Teleport to="body">
      <Transition name="tt">
        <div
          v-if="open"
          ref="popoverRef"
          class="tt-popover"
          :class="`tt-popover--${placementState}`"
          role="tooltip"
          :style="{ ...popoverStyle, ...styleVars }"
          @mouseenter="cancelHide"
          @mouseleave="hide"
        >
          <span class="tt-popover__corner tt-popover__corner--tl" aria-hidden="true"></span>
          <span class="tt-popover__corner tt-popover__corner--tr" aria-hidden="true"></span>
          <span class="tt-popover__corner tt-popover__corner--bl" aria-hidden="true"></span>
          <span class="tt-popover__corner tt-popover__corner--br" aria-hidden="true"></span>

          <span class="tt-popover__arrow" aria-hidden="true">
            <span class="tt-popover__arrow-fill"></span>
          </span>

          <header v-if="eyebrow || title" class="tt-popover__head">
            <span v-if="eyebrow" class="tt-popover__eyebrow">{{ eyebrow }}</span>
            <strong v-if="title" class="tt-popover__title">{{ title }}</strong>
          </header>

          <p v-if="body" class="tt-popover__body">{{ body }}</p>

          <section v-if="tip" class="tt-popover__tip">
            <span class="tt-popover__tip-label">
              <span class="tt-popover__tip-mark" aria-hidden="true"></span>
              {{ tipLabel || 'Use when' }}
            </span>
            <p class="tt-popover__tip-body">{{ tip }}</p>
          </section>

          <section v-if="defaultValue || defaultRationale" class="tt-popover__default">
            <span class="tt-popover__default-label">{{ defaultLabel || 'Default' }}</span>
            <span v-if="defaultValue" class="tt-popover__default-value">{{ defaultValue }}</span>
            <p v-if="defaultRationale" class="tt-popover__default-rationale">{{ defaultRationale }}</p>
          </section>

          <a
            v-if="href"
            class="tt-popover__link"
            :href="href"
          >
            <span>{{ linkLabel || 'Read in docs' }}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.tt-trigger {
  display: inline-flex;
  align-items: center;
}

.tt-popover {
  --tt-bg: rgba(8, 10, 14, 0.96);
  --tt-bg-soft: rgba(255, 255, 255, 0.04);
  --tt-text: rgba(255, 255, 255, 0.78);
  --tt-text-strong: #ffffff;
  --tt-text-muted: rgba(255, 255, 255, 0.45);
  --tt-accent: #8B5CF6;
  --tt-accent-light: #A78BFA;
  --tt-accent-subtle: rgba(139, 92, 246, 0.14);
  --tt-cyan: #22D3EE;
  --tt-border: rgba(139, 92, 246, 0.28);

  position: fixed;
  z-index: 200;
  display: grid;
  gap: 8px;
  max-width: var(--tt-max-width, 280px);
  padding: 11px 13px 11px 14px;
  border: 1px solid var(--tt-border);
  border-radius: 8px;
  background: var(--tt-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.08),
    0 24px 56px -28px rgba(0, 0, 0, 0.7),
    0 0 28px -8px rgba(139, 92, 246, 0.35);
  font-family: 'Space Grotesk', sans-serif;
  pointer-events: auto;
}

html:not(.dark) .tt-popover {
  --tt-bg: rgba(252, 250, 255, 0.97);
  --tt-bg-soft: rgba(0, 0, 0, 0.03);
  --tt-text: rgba(0, 0, 0, 0.7);
  --tt-text-strong: #1a1a2e;
  --tt-text-muted: rgba(0, 0, 0, 0.45);
  --tt-accent: #7C3AED;
  --tt-accent-light: #8B5CF6;
  --tt-accent-subtle: rgba(124, 58, 237, 0.08);
  --tt-cyan: #0891B2;
  --tt-border: rgba(124, 58, 237, 0.28);
  box-shadow:
    0 0 0 1px rgba(124, 58, 237, 0.08),
    0 22px 52px -26px rgba(40, 22, 80, 0.28),
    0 0 26px -6px rgba(124, 58, 237, 0.2);
}

/* ---- Corner brackets ---- */
.tt-popover__corner {
  position: absolute;
  width: 7px;
  height: 7px;
  border-color: var(--tt-accent);
  opacity: 0.85;
  pointer-events: none;
}

.tt-popover__corner--tl {
  top: 4px;
  left: 4px;
  border-top: 1px solid currentColor;
  border-left: 1px solid currentColor;
  color: var(--tt-accent);
}

.tt-popover__corner--tr {
  top: 4px;
  right: 4px;
  border-top: 1px solid currentColor;
  border-right: 1px solid currentColor;
  color: var(--tt-accent);
}

.tt-popover__corner--bl {
  bottom: 4px;
  left: 4px;
  border-bottom: 1px solid currentColor;
  border-left: 1px solid currentColor;
  color: var(--tt-accent);
}

.tt-popover__corner--br {
  bottom: 4px;
  right: 4px;
  border-bottom: 1px solid currentColor;
  border-right: 1px solid currentColor;
  color: var(--tt-accent);
}

/* ---- Arrow / notch ---- */
.tt-popover__arrow {
  position: absolute;
  left: var(--tt-arrow-x, 50%);
  transform: translateX(-50%);
  width: 14px;
  height: 7px;
  pointer-events: none;
}

.tt-popover--top .tt-popover__arrow {
  bottom: -7px;
}

.tt-popover--bottom .tt-popover__arrow {
  top: -7px;
}

.tt-popover__arrow-fill {
  position: absolute;
  inset: 0;
  background: var(--tt-bg);
  border: 1px solid var(--tt-border);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
}

.tt-popover--bottom .tt-popover__arrow-fill {
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

/* ---- Content ---- */
.tt-popover__head {
  display: grid;
  gap: 3px;
  padding-right: 4px;
}

.tt-popover__eyebrow {
  color: var(--tt-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.tt-popover__title {
  color: var(--tt-text-strong);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.005em;
  line-height: 1.25;
}

.tt-popover__body {
  margin: 0;
  color: var(--tt-text);
  font-size: 12.5px;
  line-height: 1.55;
}

.tt-popover__head + .tt-popover__body {
  position: relative;
  padding-top: 8px;
}

.tt-popover__head + .tt-popover__body::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 22px;
  height: 1px;
  background: var(--tt-accent);
  opacity: 0.7;
}

/* ---- Tip section ---- */
.tt-popover__tip {
  position: relative;
  display: grid;
  gap: 5px;
  margin-top: 2px;
  padding: 9px 12px 10px 16px;
  border-radius: 6px;
  background: var(--tt-bg-soft);
  border: 1px solid color-mix(in srgb, var(--tt-text-strong) 6%, transparent);
}

/* Left accent rail — visually anchors the tip block without tinting the surface */
.tt-popover__tip::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--tt-accent);
  opacity: 0.85;
  pointer-events: none;
}

.tt-popover__tip-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tt-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.tt-popover__tip-mark {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--tt-accent);
  transform: rotate(45deg);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tt-accent) 60%, transparent);
}

.tt-popover__tip-body {
  margin: 0;
  color: var(--tt-text);
  font-size: 12px;
  line-height: 1.5;
}

/* ---- Default value chip + rationale ---- */
.tt-popover__default {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: 4px 10px;
  margin-top: 2px;
  padding: 8px 12px 9px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--tt-cyan) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--tt-cyan) 26%, transparent);
}

.tt-popover__default-label {
  grid-column: 1;
  grid-row: 1;
  color: var(--tt-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.tt-popover__default-value {
  grid-column: 2;
  grid-row: 1;
  justify-self: start;
  color: var(--tt-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.tt-popover__default-rationale {
  grid-column: 1 / -1;
  grid-row: 2;
  margin: 2px 0 0;
  color: var(--tt-text);
  font-size: 11.5px;
  line-height: 1.5;
}

/* ---- Docs link (outline pill button) ---- */
.tt-popover__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: start;
  margin-top: 2px;
  padding: 5px 11px 5px 12px;
  border: 1px solid var(--tt-accent);
  border-radius: 999px;
  background: transparent;
  color: var(--tt-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

html:not(.dark) .tt-popover__link {
  color: var(--tt-accent);
}

.tt-popover__link:hover,
.tt-popover__link:focus-visible {
  background: var(--tt-accent);
  color: #fff;
  border-color: var(--tt-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tt-accent) 22%, transparent);
  outline: none;
}

.tt-popover__link svg {
  stroke: currentColor;
}

/* ---- Animations ---- */
.tt-enter-active,
.tt-leave-active {
  transition: opacity 140ms ease, transform 180ms cubic-bezier(0.32, 0.72, 0.24, 1);
}

.tt-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

.tt-leave-to {
  opacity: 0;
  transform: translateY(2px) scale(0.98);
}

.tt-popover--bottom.tt-enter-from {
  transform: translateY(-4px) scale(0.98);
}

.tt-popover--bottom.tt-leave-to {
  transform: translateY(-2px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .tt-enter-active,
  .tt-leave-active {
    transition: opacity 120ms ease;
  }

  .tt-enter-from,
  .tt-leave-to {
    transform: none;
  }
}
</style>
