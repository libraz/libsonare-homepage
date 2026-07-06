<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { EngineFamily } from '@/tuner/dsp/params';

/**
 * The tuner's 3D centrepiece: a vibrating filament field standing in for the
 * physical model's medium. A note-on injects energy; the field's motion
 * character tracks the instrument family (plucked strings decay sharply, bowed
 * and wind sustain and shimmer, struck bars ring with a hard attack, membranes
 * radiate). It is purely a visualization — the audio is the WASM-parity DSP.
 */
const props = defineProps<{
  family: EngineFamily;
  /** Live output level (0..1) from the engine meter. */
  level: number;
  isDark: boolean;
  reduceMotion: boolean;
}>();

const host = ref<HTMLDivElement | null>(null);
// three.js is lazy-imported and structurally typed as any in this visual-only scene.
let THREE: any = null;
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let raf = 0;
let disposed = false;

const ROWS = 15;
const COLS = 48;
let lines: any[] = [];
let energy = 0; // decays each frame; a note-on refills it
let phase = 0;

const ACCENT = { dark: 0x8b5cf6, light: 0x7c3aed };
const CYAN = { dark: 0x22d3ee, light: 0x0891b2 };

/** Family-specific motion character. */
function motionFor(family: EngineFamily) {
  switch (family) {
    case 'string':
      return { decay: 0.985, wobble: 1.0, radial: 0, modeShape: 2 };
    case 'keyboard':
      return { decay: 0.99, wobble: 0.8, radial: 0, modeShape: 3 };
    case 'mallet':
      return { decay: 0.975, wobble: 1.4, radial: 0, modeShape: 4 };
    case 'percussion':
      return { decay: 0.965, wobble: 1.2, radial: 1, modeShape: 3 };
    case 'wind':
      return { decay: 0.997, wobble: 0.5, radial: 0, modeShape: 1 };
  }
}

function accentColor(): number {
  return props.isDark ? ACCENT.dark : ACCENT.light;
}
function cyanColor(): number {
  return props.isDark ? CYAN.dark : CYAN.light;
}

function buildField(): void {
  for (const l of lines) {
    scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  }
  lines = [];
  for (let r = 0; r < ROWS; ++r) {
    const positions = new Float32Array(COLS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const t = r / (ROWS - 1);
    const color = new THREE.Color(t < 0.5 ? accentColor() : cyanColor());
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35 + 0.5 * (1 - Math.abs(t - 0.5) * 2),
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    lines.push(line);
  }
  updateField(0);
}

function updateField(amp: number): void {
  const m = motionFor(props.family);
  for (let r = 0; r < ROWS; ++r) {
    const line = lines[r];
    const pos = line.geometry.attributes.position.array as Float32Array;
    const z = (r / (ROWS - 1) - 0.5) * 6;
    for (let c = 0; c < COLS; ++c) {
      const x = (c / (COLS - 1) - 0.5) * 12;
      const u = c / (COLS - 1);
      // Standing-wave envelope pinned at the ends (a plucked/struck string).
      const env = Math.sin(Math.PI * u);
      let y: number;
      if (m.radial) {
        const rr = Math.sqrt(x * x + z * z) / 7;
        y = amp * Math.sin(m.modeShape * Math.PI * rr - phase * 3) * Math.max(0, 1 - rr);
      } else {
        y =
          amp *
          env *
          Math.sin(m.modeShape * Math.PI * u - phase * m.wobble) *
          (1 - 0.3 * (Math.abs(r / (ROWS - 1) - 0.5) * 2));
      }
      pos[c * 3] = x;
      pos[c * 3 + 1] = y;
      pos[c * 3 + 2] = z;
    }
    line.geometry.attributes.position.needsUpdate = true;
  }
}

/** Inject energy on a note-on (called by the parent via `pulse`). */
function pulse(strength = 1): void {
  energy = Math.min(1.6, energy + strength);
}
defineExpose({ pulse });

function frame(): void {
  if (disposed) return;
  const m = motionFor(props.family);
  energy *= m.decay;
  // Sustained families ride the live meter; transient ones ride the decaying
  // injected energy, so a plucked string visibly dies while a bowed one holds.
  const sustained = props.family === 'wind' || props.family === 'string';
  const target = sustained ? Math.max(energy, props.level * 2.2) : energy;
  phase += 0.03 + 0.04 * target;
  updateField(0.9 * target);
  scene.rotation.y = Math.sin(phase * 0.05) * 0.35;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

async function init(): Promise<void> {
  const el = host.value;
  if (!el) return;
  THREE = await import('three');
  if (disposed || !host.value) return;
  const w = el.clientWidth || 640;
  const h = el.clientHeight || 360;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(0, 5.5, 12);
  camera.lookAt(0, 0, 0);
  buildField();
  if (props.reduceMotion) {
    updateField(0.45);
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }
  window.addEventListener('resize', onResize);
}

function onResize(): void {
  const el = host.value;
  if (!el || !renderer || !camera) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

watch(
  () => [props.family, props.isDark],
  () => {
    if (scene && THREE) buildField();
  },
);

onMounted(init);
onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
  for (const l of lines) {
    l.geometry.dispose();
    l.material.dispose();
  }
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
});
</script>

<template>
  <div ref="host" class="tuner-scene" aria-hidden="true"></div>
</template>

<style scoped>
.tuner-scene {
  width: 100%;
  height: 100%;
  min-height: 220px;
}
.tuner-scene :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
