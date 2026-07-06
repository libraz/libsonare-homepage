<script setup lang="ts">
import type { DemoVisual } from '@/components/demos/demoCards';

defineProps<{
  visual: DemoVisual;
}>();

const spectrumBars = [34, 52, 28, 60, 44, 70, 38, 56, 30, 64, 42, 50];
const faderLevels = [62, 38, 78, 46, 70, 30, 54, 42];
const chromaCells = [20, 70, 35, 90, 50, 25, 80, 45, 60, 30, 75, 40];
const stepCellsOn = [0, 3, 5, 9, 14, 16, 18, 20, 22];
const fallingNotes = [
  { x: 14, y: -8, h: 16 },
  { x: 60, y: 6, h: 12 },
  { x: 96, y: 18, h: 20 },
  { x: 130, y: 0, h: 14 },
  { x: 168, y: 22, h: 18 },
  { x: 192, y: 10, h: 12 },
];
</script>

<template>
  <div class="demo-grid__visual" :class="`demo-grid__visual--${visual}`" aria-hidden="true">
    <svg v-if="visual === 'spectrum'" viewBox="0 0 220 60" preserveAspectRatio="none">
      <rect
        v-for="(bar, i) in spectrumBars"
        :key="i"
        :x="i * (220 / spectrumBars.length) + 2"
        :y="60 - bar"
        :width="220 / spectrumBars.length - 4"
        :height="bar"
        rx="1"
        class="demo-grid__bar"
        :style="{ '--d': `${i * 90}ms` }"
      />
    </svg>

    <svg v-else-if="visual === 'lufs'" viewBox="0 0 120 60" preserveAspectRatio="xMidYMid meet">
      <path d="M14 52 A 46 46 0 0 1 106 52" fill="none" class="demo-grid__arc-track" />
      <path d="M14 52 A 46 46 0 0 1 92 18" fill="none" class="demo-grid__arc-fill" />
      <line x1="60" y1="52" x2="86" y2="26" class="demo-grid__needle" />
      <circle cx="60" cy="52" r="3.5" class="demo-grid__needle-hub" />
      <text x="60" y="46" text-anchor="middle" class="demo-grid__gauge-label">-14 LUFS</text>
    </svg>

    <div v-else-if="visual === 'chroma'" class="demo-grid__chroma">
      <span
        v-for="(cell, i) in chromaCells"
        :key="i"
        class="demo-grid__chroma-cell"
        :style="{ '--v': cell / 100, '--d': `${i * 70}ms` }"
      ></span>
    </div>

    <div v-else-if="visual === 'faders'" class="demo-grid__faders">
      <span v-for="(level, i) in faderLevels" :key="i" class="demo-grid__fader">
        <span
          class="demo-grid__fader-cap"
          :style="{ bottom: `${level}%`, '--d': `${i * 80}ms` }"
        ></span>
      </span>
    </div>

    <svg v-else-if="visual === 'room'" viewBox="0 0 220 60" preserveAspectRatio="xMidYMid meet">
      <g class="demo-grid__room">
        <polygon class="demo-grid__room-floor" points="74,44 146,44 168,32 96,32" />
        <path class="demo-grid__room-edge" d="M74,44 96,32 96,12 74,24 Z" />
        <path class="demo-grid__room-edge" d="M146,44 168,32 168,12 146,24 Z" />
        <path class="demo-grid__room-edge" d="M74,24 96,12 168,12 146,24 Z" />
        <path class="demo-grid__room-edge" d="M74,24 74,44 146,44 146,24 Z" />
        <circle class="demo-grid__room-source" cx="108" cy="30" r="3.4" />
        <circle class="demo-grid__room-ring" cx="108" cy="30" r="9" />
        <circle class="demo-grid__room-ring demo-grid__room-ring--2" cx="108" cy="30" r="9" />
        <circle class="demo-grid__room-listener" cx="138" cy="38" r="2.6" />
      </g>
    </svg>

    <svg v-else-if="visual === 'keys'" viewBox="0 0 220 60" preserveAspectRatio="none">
      <g class="demo-grid__keys">
        <rect
          v-for="i in 8"
          :key="`w${i}`"
          :x="(i - 1) * 27.5 + 1"
          y="2"
          width="25.5"
          height="56"
          rx="2"
          class="demo-grid__key-white"
          :class="{ 'demo-grid__key-white--lit': i === 3 || i === 6 }"
          :style="{ '--d': `${i * 160}ms` }"
        />
        <rect
          v-for="(x, i) in [19, 47, 102, 130, 158]"
          :key="`b${i}`"
          :x="x"
          y="2"
          width="15"
          height="33"
          rx="2"
          class="demo-grid__key-black"
        />
      </g>
    </svg>

    <svg v-else-if="visual === 'steps'" viewBox="0 0 220 60" preserveAspectRatio="none">
      <g class="demo-grid__steps">
        <rect
          v-for="i in 24"
          :key="i"
          :x="((i - 1) % 8) * 27.5 + 2"
          :y="Math.floor((i - 1) / 8) * 20 + 2"
          width="23.5"
          height="16"
          rx="2"
          class="demo-grid__step"
          :class="{ 'demo-grid__step--on': stepCellsOn.includes(i - 1) }"
          :style="{ '--d': `${((i - 1) % 8) * 110}ms` }"
        />
      </g>
    </svg>

    <svg v-else-if="visual === 'fall'" viewBox="0 0 220 60" preserveAspectRatio="none">
      <g class="demo-grid__fall">
        <rect
          v-for="(note, i) in fallingNotes"
          :key="i"
          class="demo-grid__fall-note"
          :x="note.x"
          :y="note.y"
          width="14"
          :height="note.h"
          rx="2"
          :style="{ '--d': `${i * 220}ms` }"
        />
        <line class="demo-grid__fall-line" x1="0" y1="46" x2="220" y2="46" />
        <g class="demo-grid__fall-keys">
          <rect
            v-for="i in 8"
            :key="`fk${i}`"
            :x="(i - 1) * 27.5 + 1"
            y="48"
            width="25.5"
            height="11"
            rx="1.5"
            class="demo-grid__fall-key"
            :class="{ 'demo-grid__fall-key--lit': i === 2 || i === 5 }"
          />
        </g>
      </g>
    </svg>

    <svg v-else-if="visual === 'rack'" viewBox="0 0 220 60" preserveAspectRatio="none">
      <g class="demo-grid__rack">
        <rect
          v-for="(x, i) in [16, 54, 92, 130, 168]"
          :key="`kn${i}`"
          :x="x"
          y="10"
          width="34"
          height="34"
          rx="17"
          class="demo-grid__rack-knob"
          :class="{ 'demo-grid__rack-knob--lit': i === 1 || i === 3 }"
          :style="{ '--d': `${i * 150}ms` }"
        />
        <line
          v-for="(x, i) in [33, 71, 109, 147, 185]"
          :key="`pt${i}`"
          :x1="x"
          y1="27"
          :x2="x + (i % 2 === 0 ? 6 : -6)"
          :y2="i % 2 === 0 ? 15 : 39"
          class="demo-grid__rack-pointer"
        />
        <line x1="8" y1="52" x2="212" y2="52" class="demo-grid__rack-rail" />
      </g>
    </svg>

    <svg v-else viewBox="0 0 220 60" preserveAspectRatio="none">
      <polyline
        class="demo-grid__wave"
        points="0,30 18,30 26,12 34,48 42,22 50,38 58,30 78,30 86,16 94,44 102,26 110,34 118,30 138,30 146,20 154,40 162,28 170,32 178,30 220,30"
      />
    </svg>
  </div>
</template>
