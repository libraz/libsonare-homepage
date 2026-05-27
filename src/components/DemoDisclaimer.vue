<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CornerBrackets } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';

const STORAGE_KEY = 'libsonare-demo-disclaimer-v2';

const { locale } = useI18n();
const ja = computed(() => locale.value === 'ja');

const showOverlay = ref(false);
const mounted = ref(false);

const copy = computed(() =>
  ja.value
    ? {
        badge: '注意',
        kicker: 'OSS DEMO · LOCAL ONLY',
        title: 'これはサービスではなく\nオープンソースのデモです',
        lead: 'libsonare は Apache-2.0 のオープンソース音声ライブラリです。このページはその機能を試すためのデモで、有料サービスでも製品でもありません。',
        points: [
          {
            key: 'NO UPLOAD',
            text: '音声はこのブラウザ内だけで処理され、サーバーへ送信・保存されることは一切ありません。',
          },
          {
            key: 'FREE / OSS',
            text: 'すべての処理はあなたの端末上で WebAssembly により実行されます。',
          },
          { key: 'NO ACCOUNT', text: 'ログイン不要・登録不要。気軽に試してそのまま閉じられます。' },
        ],
        dismiss: '理解しました',
        source: 'ソースを見る',
        bannerLabel: 'OSS デモ',
        bannerText:
          'すべての処理はあなたの端末内だけで行われ、データはどこにも送信されません。これは有料サービスではなくオープンソースのデモです。',
        reopen: '詳細',
      }
    : {
        badge: 'NOTE',
        kicker: 'OSS DEMO · LOCAL ONLY',
        title: 'This is an open-source demo,\nnot a service',
        lead: 'libsonare is an Apache-2.0 open-source audio library. This page is a demo for trying it out — it is not a paid service or product.',
        points: [
          {
            key: 'NO UPLOAD',
            text: 'Audio is processed only inside this browser. Nothing is uploaded to or stored on any server.',
          },
          { key: 'FREE / OSS', text: 'Every operation runs on your own device via WebAssembly.' },
          {
            key: 'NO ACCOUNT',
            text: 'No login, no sign-up. Try it freely and close the tab when you are done.',
          },
        ],
        dismiss: 'Got it',
        source: 'View source',
        bannerLabel: 'OSS DEMO',
        bannerText:
          'Everything runs locally on your device and nothing is sent anywhere. This is an open-source demo, not a service.',
        reopen: 'Details',
      },
);

function dismiss() {
  showOverlay.value = false;
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* localStorage may be unavailable (private mode) — ignore */
  }
}

function reopen() {
  showOverlay.value = true;
}

onMounted(() => {
  mounted.value = true;
  let seen = false;
  try {
    seen = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    seen = false;
  }
  if (!seen) showOverlay.value = true;
});
</script>

<template>
  <!-- Permanent slim banner -->
  <div class="demo-disclaimer__banner" role="note">
    <span class="demo-disclaimer__badge">{{ copy.bannerLabel }}</span>
    <p class="demo-disclaimer__banner-text">{{ copy.bannerText }}</p>
    <button type="button" class="demo-disclaimer__reopen" @click="reopen">{{ copy.reopen }}</button>
  </div>

  <!-- First-visit overlay -->
  <Teleport to="body">
    <Transition name="demo-disclaimer-fade">
      <div
        v-if="mounted && showOverlay"
        class="demo-disclaimer__overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="copy.kicker"
        @click.self="dismiss"
      >
        <div class="demo-disclaimer__panel">
          <CornerBrackets size="lg" offset="lg" />
          <div class="demo-disclaimer__scan" aria-hidden="true"></div>

          <div class="demo-disclaimer__head">
            <span class="demo-disclaimer__pulse" aria-hidden="true"></span>
            <span class="demo-disclaimer__kicker">{{ copy.kicker }}</span>
          </div>

          <h2 class="demo-disclaimer__title">{{ copy.title }}</h2>
          <p class="demo-disclaimer__lead">{{ copy.lead }}</p>

          <ul class="demo-disclaimer__points">
            <li
              v-for="(point, i) in copy.points"
              :key="point.key"
              class="demo-disclaimer__point"
              :style="{ '--i': i }"
            >
              <span class="demo-disclaimer__point-key">{{ point.key }}</span>
              <span class="demo-disclaimer__point-text">{{ point.text }}</span>
            </li>
          </ul>

          <div class="demo-disclaimer__actions">
            <button type="button" class="demo-disclaimer__confirm" @click="dismiss">
              {{ copy.dismiss }}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <a
              href="https://github.com/libraz/libsonare"
              target="_blank"
              rel="noopener noreferrer"
              class="demo-disclaimer__source"
            >{{ copy.source }}</a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== PERMANENT BANNER ===== */
.demo-disclaimer__banner {
  position: relative;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--demo-warn-border, rgba(245, 158, 11, 0.4));
  background: var(--demo-warn-bg, rgba(245, 158, 11, 0.1));
  color: var(--demo-warn-text, #FCD9A0);
}

.demo-disclaimer__badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border: 1px solid var(--demo-warn-border, rgba(245, 158, 11, 0.4));
  border-radius: 5px;
  color: var(--demo-warn, #F59E0B);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.demo-disclaimer__badge::before {
  content: '\26A0';
  font-size: 10px;
}

.demo-disclaimer__banner-text {
  flex: 1 1 auto;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.demo-disclaimer__reopen {
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid var(--demo-warn-border, rgba(245, 158, 11, 0.4));
  border-radius: 5px;
  background: transparent;
  color: var(--demo-warn, #F59E0B);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.demo-disclaimer__reopen:hover {
  background: var(--demo-warn, #F59E0B);
  color: #1a1206;
}

@media (max-width: 720px) {
  .demo-disclaimer__banner {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 8px 12px;
  }

  .demo-disclaimer__banner-text {
    flex-basis: 100%;
    order: 3;
  }
}

/* ===== OVERLAY ===== */
/* Teleported to <body>, so it sits outside .tool-page and cannot inherit the
   --demo-* theme tokens. Redefine the tokens it needs here for each theme. */
.demo-disclaimer__overlay {
  --demo-bg-elevated: rgba(8, 10, 14, 0.92);
  --demo-text-strong: #ffffff;
  --demo-text: rgba(255, 255, 255, 0.72);
  --demo-text-muted: rgba(255, 255, 255, 0.45);
  --demo-accent: #8B5CF6;
  --demo-accent-light: #A78BFA;
  --demo-accent-subtle: rgba(139, 92, 246, 0.08);
  --demo-accent-border: rgba(139, 92, 246, 0.25);
  --demo-border: rgba(139, 92, 246, 0.14);
  --demo-warn: #F59E0B;

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(
      circle at 50% 30%,
      color-mix(in srgb, var(--demo-accent) 14%, rgba(3, 4, 5, 0.86)),
      rgba(3, 4, 5, 0.9)
    );
  backdrop-filter: blur(8px);
}

html:not(.dark) .demo-disclaimer__overlay {
  --demo-bg-elevated: #ffffff;
  --demo-text-strong: #1a1a2e;
  --demo-text: rgba(0, 0, 0, 0.62);
  --demo-text-muted: rgba(0, 0, 0, 0.45);
  --demo-accent: #7C3AED;
  --demo-accent-light: #8B5CF6;
  --demo-accent-subtle: rgba(124, 58, 237, 0.07);
  --demo-accent-border: rgba(124, 58, 237, 0.22);
  --demo-border: rgba(0, 0, 0, 0.1);
  --demo-warn: #B45309;

  background: radial-gradient(
      circle at 50% 30%,
      color-mix(in srgb, var(--demo-accent) 12%, rgba(248, 246, 255, 0.82)),
      rgba(230, 226, 245, 0.86)
    );
}

.demo-disclaimer__panel {
  position: relative;
  width: min(520px, 100%);
  padding: 30px 30px 26px;
  border: 1px solid var(--demo-accent-border, rgba(139, 92, 246, 0.25));
  border-radius: 14px;
  background: var(--demo-bg-elevated, rgba(8, 10, 14, 0.92));
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.3),
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 0 60px -16px color-mix(in srgb, var(--demo-accent, #8B5CF6) 50%, transparent);
  overflow: hidden;
  animation: demo-disclaimer-rise 0.42s cubic-bezier(0.2, 0.8, 0.2, 1);
}

html:not(.dark) .demo-disclaimer__panel {
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 30px 80px -24px rgba(60, 40, 120, 0.4),
    0 0 0 1px rgba(124, 58, 237, 0.08);
}

.demo-disclaimer__scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 3px,
    rgba(0, 0, 0, 0.025) 3px,
    rgba(0, 0, 0, 0.025) 4px
  );
  opacity: 0.6;
}

html:not(.dark) .demo-disclaimer__scan {
  display: none;
}

.demo-disclaimer__head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 18px;
}

.demo-disclaimer__pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--demo-warn, #F59E0B);
  box-shadow: 0 0 8px var(--demo-warn, #F59E0B);
  animation: demo-disclaimer-pulse 1.8s ease-in-out infinite;
}

.demo-disclaimer__kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.45));
}

.demo-disclaimer__title {
  margin: 0 0 14px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -0.01em;
  color: var(--demo-text-strong, #fff);
  white-space: pre-line;
}

.demo-disclaimer__lead {
  margin: 0 0 20px;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--demo-text, rgba(255, 255, 255, 0.72));
}

.demo-disclaimer__points {
  display: grid;
  gap: 10px;
  margin: 0 0 26px;
  padding: 0;
  list-style: none;
}

.demo-disclaimer__point {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 12px;
  align-items: baseline;
  padding: 10px 12px;
  border: 1px solid var(--demo-border, rgba(139, 92, 246, 0.12));
  border-radius: 8px;
  background: var(--demo-accent-subtle, rgba(139, 92, 246, 0.06));
  opacity: 0;
  animation: demo-disclaimer-row 0.4s ease forwards;
  animation-delay: calc(0.12s + var(--i) * 0.07s);
}

.demo-disclaimer__point-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: right;
  color: var(--demo-accent-light, #A78BFA);
}

.demo-disclaimer__point-text {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--demo-text, rgba(255, 255, 255, 0.72));
}

.demo-disclaimer__actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.demo-disclaimer__confirm {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 0;
  border-radius: 8px;
  background: var(--demo-accent, #8B5CF6);
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.demo-disclaimer__confirm:hover {
  background: var(--demo-accent-light, #A78BFA);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px -8px color-mix(in srgb, var(--demo-accent, #8B5CF6) 70%, transparent);
}

.demo-disclaimer__confirm svg {
  transition: transform 0.2s ease;
}

.demo-disclaimer__confirm:hover svg {
  transform: scale(1.15);
}

.demo-disclaimer__source {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.45));
  transition: color 0.2s ease;
}

.demo-disclaimer__source:hover {
  color: var(--demo-accent, #8B5CF6);
}

@keyframes demo-disclaimer-rise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes demo-disclaimer-row {
  to {
    opacity: 1;
  }
}

@keyframes demo-disclaimer-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

.demo-disclaimer-fade-enter-active,
.demo-disclaimer-fade-leave-active {
  transition: opacity 0.28s ease;
}

.demo-disclaimer-fade-enter-from,
.demo-disclaimer-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .demo-disclaimer__panel,
  .demo-disclaimer__point,
  .demo-disclaimer__pulse {
    animation: none;
  }
  .demo-disclaimer__point {
    opacity: 1;
  }
}

@media (max-width: 560px) {
  .demo-disclaimer__panel {
    padding: 24px 20px 22px;
  }

  .demo-disclaimer__title {
    font-size: 21px;
  }

  .demo-disclaimer__point {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .demo-disclaimer__point-key {
    text-align: left;
  }
}
</style>
