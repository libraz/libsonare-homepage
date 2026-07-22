<script setup lang="ts">
/**
 * StudioShowcase — a standalone band that points to sonare studio, a full
 * browser DAW whose audio engine is libsonare, hosted on its own domain.
 * (Score engraving and music theory live in separate libraries, so the copy
 * scopes libsonare to the audio side rather than claiming the whole app.)
 *
 * It sits apart from the nine focused demos on purpose: those isolate one
 * capability each, whereas sonare studio drives the audio engine end-to-end
 * inside a real DAW.
 * The copy matches the libsonare README's temperature — a hosted live demo,
 * not a production product, source not public — so the framing stays honest
 * whether or not the source is ever published.
 *
 * Design: a "DAW arrangement blueprint". Rather than a tenth flat demo card,
 * this band borrows the site's technical vocabulary (Outfit display, mono
 * labels, corner brackets, the `--demo-screen` surface) to render a small
 * arrangement view — track lanes, clips, and a playhead — so the visual says
 * "a real DAW" at a glance. Everything is token-driven, so the panel stays
 * light in light mode and dark in dark mode (never a forced dark slab).
 */
import { computed } from 'vue';
import { CornerBrackets } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';

const STUDIO_URL = 'https://sonare-studio.libraz.net';
const STUDIO_HOST = 'sonare-studio.libraz.net';

const CHIPS = ['MULTI-TRACK', 'PIANO ROLL', 'SCORE', 'MIXER', 'MASTERING', 'EXPORT'];

/**
 * Decorative arrangement lanes. Each clip is `[left%, width%]`; `tone` picks
 * an accent tint. Purely visual — the whole panel is aria-hidden.
 */
const LANES: Array<{ tone: 'a' | 'b' | 'c'; clips: Array<[number, number]> }> = [
  {
    tone: 'a',
    clips: [
      [3, 24],
      [31, 41],
    ],
  },
  {
    tone: 'b',
    clips: [
      [9, 30],
      [45, 30],
    ],
  },
  {
    tone: 'a',
    clips: [
      [3, 13],
      [20, 19],
      [44, 35],
    ],
  },
  { tone: 'c', clips: [[28, 47]] },
];

const copyMap = {
  en: {
    signal: 'LIVE',
    eyebrow: 'FULL DAW · LIBSONARE AUDIO ENGINE',
    name: 'sonare studio',
    tagline: 'A full DAW in your browser',
    body: 'A complete client-side workstation: sequencing, piano roll, score engraving, a mixer, mastering, and WAV/MP3/MIDI/MusicXML export. libsonare is its audio engine — playback, mixing, mastering, the built-in instruments, and WAV/MP3/MIDI export — while score engraving, MusicXML, and music theory come from separate libraries. It shows how far the audio engine reaches inside a real DAW.',
    note: 'Hosted live demo · source not public · not a production product.',
    cta: 'Open sonare studio',
    screenLabel: 'ARRANGEMENT',
  },
  ja: {
    signal: 'LIVE',
    eyebrow: 'フルDAW · オーディオは libsonare',
    name: 'sonare studio',
    tagline: 'ブラウザで動くフルDAW',
    body: 'シーケンス、ピアノロール、スコア浄書、ミキサー、マスタリング、WAV/MP3/MIDI/MusicXML 書き出しまで揃った、すべてクライアントサイドで動くワークステーション。libsonare はそのオーディオエンジンで、再生・ミキシング・マスタリング・内蔵音源・WAV/MP3/MIDI 書き出しを担います。スコア浄書・MusicXML・音楽理論は別ライブラリです。実際の DAW のなかでオーディオエンジンがどこまで通用するかを示しています。',
    note: 'ホスト型のライブデモ · ソース非公開 · 製品ではありません。',
    cta: 'sonare studio を開く',
    screenLabel: 'ARRANGEMENT',
  },
};

const { localizedValue } = useI18n();
const copy = computed(() => localizedValue(copyMap));
</script>

<template>
  <section class="studio-band" aria-labelledby="studio-band-name">
    <CornerBrackets size="md" offset="sm" />

    <div class="studio-band__lead">
      <p class="studio-band__eyebrow demo-label">
        <span class="studio-band__signal">
          <span class="studio-band__signal-dot" aria-hidden="true"></span>{{ copy.signal }}
        </span>
        <span class="studio-band__eyebrow-sep" aria-hidden="true">·</span>
        {{ copy.eyebrow }}
      </p>

      <h2 id="studio-band-name" class="studio-band__name">{{ copy.name }}</h2>
      <p class="studio-band__tagline">{{ copy.tagline }}</p>
      <p class="studio-band__text">{{ copy.body }}</p>

      <ul class="studio-band__chips" aria-hidden="true">
        <li v-for="chip in CHIPS" :key="chip" class="studio-band__chip">{{ chip }}</li>
      </ul>

      <p class="studio-band__note">{{ copy.note }}</p>
    </div>

    <div class="studio-band__aside">
      <div class="studio-band__screen" aria-hidden="true">
        <div class="studio-band__screen-head">
          <span class="studio-band__screen-label">{{ copy.screenLabel }}</span>
          <span class="studio-band__screen-dots">
            <i></i><i></i><i></i>
          </span>
        </div>
        <div class="studio-band__lanes">
          <div v-for="(lane, i) in LANES" :key="i" class="studio-band__lane">
            <span
              v-for="(clip, j) in lane.clips"
              :key="j"
              class="studio-band__clip"
              :class="`studio-band__clip--${lane.tone}`"
              :style="{ left: `${clip[0]}%`, width: `${clip[1]}%` }"
            ></span>
          </div>
          <div class="studio-band__playhead"></div>
        </div>
      </div>

      <a
        :href="STUDIO_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="studio-band__cta"
      >
        {{ copy.cta }}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 17L17 7M17 7H8M17 7V16" />
        </svg>
      </a>
      <p class="studio-band__host demo-label">{{ STUDIO_HOST }}</p>
    </div>
  </section>
</template>

<style scoped>
.studio-band {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 20rem);
  align-items: center;
  gap: clamp(1.75rem, 4vw, 3rem);
  padding: clamp(1.6rem, 3.5vw, 2.5rem);
  border: 1px solid var(--demo-accent-border);
  border-radius: 10px;
  color: var(--demo-text);
  background:
    radial-gradient(120% 140% at 100% 0%, var(--demo-accent-subtle), transparent 55%),
    repeating-linear-gradient(0deg, var(--demo-grid-color) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, var(--demo-grid-color) 0 1px, transparent 1px 22px),
    var(--demo-bg-elevated);
  overflow: hidden;
}

/* ── Lead column ─────────────────────────────────────────── */
.studio-band__lead {
  min-width: 0;
}

.studio-band__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0 0 0.85rem;
  color: var(--demo-text-muted);
  flex-wrap: wrap;
}

.studio-band__signal {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--demo-accent);
}

.studio-band__signal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--demo-accent);
  box-shadow: 0 0 0 0 var(--demo-accent-dim);
  animation: studio-pulse 2.4s ease-out infinite;
}

.studio-band__eyebrow-sep {
  color: var(--demo-text-faint);
}

.studio-band__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 4.5vw, 2.6rem);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: var(--demo-text-strong);
}

.studio-band__tagline {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1rem, 2vw, 1.15rem);
  font-weight: 500;
  color: var(--demo-accent);
}

.studio-band__text {
  margin: 1rem 0 0;
  max-width: 46rem;
  font-size: 0.94rem;
  line-height: 1.65;
  color: var(--demo-text);
}

.studio-band__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 1.15rem 0 0;
  padding: 0;
  list-style: none;
}

.studio-band__chip {
  padding: 0.24rem 0.6rem;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--demo-text-muted);
  background: var(--demo-control-bg);
}

.studio-band__note {
  margin: 1.15rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: var(--demo-text-faint);
}

/* ── Aside: arrangement screen + CTA ─────────────────────── */
.studio-band__aside {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.studio-band__screen {
  border: 1px solid var(--demo-border);
  border-radius: 7px;
  padding: 0.6rem 0.65rem 0.7rem;
  background: var(--demo-screen-bg);
  box-shadow: inset 0 1px 0 var(--demo-bezel-inset-light), inset 0 0 0 1px rgba(0, 0, 0, 0.02);
}

.studio-band__screen-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.studio-band__screen-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--demo-text-muted);
}

.studio-band__screen-dots {
  display: inline-flex;
  gap: 3px;
}

.studio-band__screen-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--demo-border-strong);
}

.studio-band__lanes {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.studio-band__lane {
  position: relative;
  height: 15px;
  border-radius: 3px;
  background: var(--demo-track-bg);
  overflow: hidden;
}

.studio-band__clip {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 2px;
  background: var(--clip-color);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.studio-band__clip--a {
  --clip-color: var(--demo-accent);
}

.studio-band__clip--b {
  --clip-color: var(--demo-accent-light);
  opacity: 0.82;
}

.studio-band__clip--c {
  --clip-color: var(--demo-clip);
  opacity: 0.72;
}

/* Playhead — parked until hover, then it plays across like a transport. */
.studio-band__playhead {
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: 38%;
  width: 1.5px;
  background: var(--demo-text-strong);
  opacity: 0.55;
  box-shadow: 0 0 6px var(--demo-accent-dim);
}

.studio-band:hover .studio-band__playhead {
  animation: studio-playhead 2.6s linear infinite;
}

/* ── CTA ─────────────────────────────────────────────────── */
.studio-band__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.72rem 1.4rem;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--demo-on-accent);
  background: var(--demo-accent);
  text-decoration: none;
  box-shadow: 0 6px 18px -8px var(--demo-accent-dim);
  transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.studio-band__cta svg {
  transition: transform 0.18s ease;
}

.studio-band__cta:hover {
  background: var(--demo-accent-light);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px -8px var(--demo-accent-dim);
}

.studio-band__cta:hover svg {
  transform: translate(2px, -2px);
}

.studio-band__host {
  margin: 0;
  text-align: center;
  font-size: 0.62rem;
  color: var(--demo-text-faint);
  text-transform: none;
}

/* ── Motion ──────────────────────────────────────────────── */
@keyframes studio-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--demo-accent-dim);
  }
  70%,
  100% {
    box-shadow: 0 0 0 7px transparent;
  }
}

@keyframes studio-playhead {
  from {
    left: 2%;
  }
  to {
    left: 98%;
  }
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 820px) {
  .studio-band {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }

  .studio-band__cta {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-band__signal-dot,
  .studio-band:hover .studio-band__playhead {
    animation: none;
  }

  .studio-band__cta,
  .studio-band__cta svg {
    transition: none;
  }

  .studio-band__cta:hover {
    transform: none;
  }

  .studio-band__cta:hover svg {
    transform: none;
  }
}
</style>
