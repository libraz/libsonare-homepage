<script setup lang="ts">
/**
 * WebGL effect overlay for the Piano Practice roll.
 *
 * This canvas sits transparently over the 2D structure canvas and draws only the
 * *light*: additive spark bursts and landing flashes (a single THREE.Points with
 * a soft round-sprite shader), upward key beams, and a glowing strike line. All
 * blending is additive, so the glow reads as real light against the roll beneath
 * it. Coordinates are screen pixels via an orthographic camera, sharing the same
 * strike-line math as the 2D layer (see {@link rollConfig}).
 *
 * The component is render-on-demand: the parent calls `draw()` every frame from
 * its paint loop with the current playhead, so playback, pause and seek all stay
 * in lockstep with the falling bars and the audio.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type KeyboardLayout, keyCenterRatio, keyWidthRatio } from './keyboard';
import type { ParsedMidi } from './midiSmf';
import {
  BEAM_PX,
  FLASH_SEC,
  HIT_RATIO,
  LOOKAHEAD_SEC,
  pitchRgb,
  rand2,
  SPARK_SEC,
  SPARKS,
} from './rollConfig';

const props = defineProps<{
  layout: KeyboardLayout;
  midi: ParsedMidi | null;
  accent?: string;
}>();

const host = ref<HTMLDivElement | null>(null);

// Three handles — client-only (SSR guarded), typed `any` because three is
// dynamically imported and its module types are not in scope here.
let THREE: any = null;
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let points: any = null;
let beams: any[] = [];
let strike: any = null;
let resizeObserver: ResizeObserver | null = null;
let disposed = false;

// Pre-allocated particle buffers (note landings + game hit/miss bursts).
const CAP = 1000;
const BEAM_POOL = 28;

// Game judgment bursts (Perfect / Great / Good / Miss), fired imperatively by
// the scorer. Aged on a wall clock so they animate independently of the chart.
const MAX_BURSTS = 18;
const BURST_SEC = 0.72;
type BurstKind = 'perfect' | 'great' | 'good' | 'miss';
interface Burst {
  x: number;
  y: number;
  kind: BurstKind;
  birth: number;
}
let bursts: Burst[] = [];
// Additive RGB (0..1) per judgment — gold reads as a white-gold pop, red as a fail.
const BURST_RGB: Record<BurstKind, [number, number, number]> = {
  perfect: [1.0, 0.82, 0.32],
  great: [0.4, 0.82, 1.0],
  good: [0.46, 0.95, 0.6],
  miss: [1.0, 0.32, 0.32],
};
let positions: Float32Array;
let colors: Float32Array;
let sizes: Float32Array;
let alphas: Float32Array;
const rgb: [number, number, number] = [0, 0, 0];

let keyByMidi = new Map<number, KeyboardLayout['keys'][number]>();

const SPARK_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uPixelRatio;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;
const SPARK_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    a = pow(a, 1.5);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Beam: bright at the strike line (uv.y → 0), softening upward and at the sides.
const BEAM_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float a = pow(1.0 - vUv.y, 1.6);
    a *= smoothstep(0.5, 0.12, abs(vUv.x - 0.5));
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;
// Strike line: a bright horizontal core that falls off above and below.
const STRIKE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float a = pow(max(1.0 - abs(vUv.y - 0.5) * 2.0, 0.0), 2.4);
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;

function rebuildKeyMap(): void {
  keyByMidi = new Map(props.layout.keys.map((k) => [k.midi, k]));
}

function accentRgb(out: [number, number, number]): void {
  const hex = (props.accent || '#8b5cf6').replace('#', '');
  out[0] = parseInt(hex.slice(0, 2), 16) / 255;
  out[1] = parseInt(hex.slice(2, 4), 16) / 255;
  out[2] = parseInt(hex.slice(4, 6), 16) / 255;
}

function setParticle(i: number, x: number, y: number, size: number, alpha: number): void {
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = 0;
  colors[i * 3] = rgb[0];
  colors[i * 3 + 1] = rgb[1];
  colors[i * 3 + 2] = rgb[2];
  sizes[i] = size;
  alphas[i] = alpha;
}

/**
 * Render one frame of effects for the given playhead.
 *
 * @param posBase Playhead in score seconds (negative during the count-in).
 * @param active  MIDI notes currently sounding, for the key beams.
 * @param isDark  Theme, for the pitch-color ramp.
 * @param motion  When false (reduced motion), the moving spark particles are skipped.
 */
function draw(posBase: number, active: Set<number>, isDark: boolean, motion: boolean): void {
  if (!renderer || !host.value) return;
  const w = host.value.clientWidth;
  const h = host.value.clientHeight;
  if (w === 0 || h === 0) return;

  const lay = props.layout;
  const wc = lay.whiteCount;
  const span = Math.max(1, lay.highMidi - lay.lowMidi);
  const hitY = h * HIT_RATIO;
  const m = props.midi;

  // --- spark + flash particles ---
  let p = 0;
  if (m) {
    for (const n of m.notes) {
      const age = posBase - n.startSec;
      if (age < 0 || age > SPARK_SEC) continue;
      const laid = keyByMidi.get(n.midi);
      if (!laid) continue;
      const cx = keyCenterRatio(laid, wc) * w;
      const life = age / SPARK_SEC;
      pitchRgb((n.midi - lay.lowMidi) / span, isDark, rgb);
      // Landing flash: one large soft point that blooms and fades.
      if (p < CAP) {
        setParticle(p, cx, hitY, (1 - life) * (26 + (n.velocity / 127) * 74), (1 - life) * 0.5);
        p++;
      }
      if (!motion) continue;
      // Spark shower: deterministic upward fan with a touch of gravity.
      const seed = (n.midi * 131 + Math.round(n.startSec * 1000)) >>> 0;
      const vel = 0.5 + (n.velocity / 127) * 0.5;
      for (let s = 0; s < SPARKS && p < CAP; s++) {
        const a = rand2(seed, s);
        const b = rand2(seed, s + 64);
        const angle = -Math.PI / 2 + (a - 0.5) * 1.7;
        const speed = (60 + b * 120) * vel;
        const px = cx + Math.cos(angle) * speed * age;
        const py = hitY + Math.sin(angle) * speed * age + 140 * age * age;
        setParticle(p, px, py, (1 - life) * (3 + b * 4.5), (1 - life) * 0.95);
        p++;
      }
    }
  }
  // --- game judgment bursts ---
  const tnow = typeof performance !== 'undefined' ? performance.now() : 0;
  for (let bIdx = bursts.length - 1; bIdx >= 0; bIdx--) {
    const bu = bursts[bIdx];
    const age = (tnow - bu.birth) / 1000;
    if (age > BURST_SEC) {
      bursts.splice(bIdx, 1);
      continue;
    }
    if (!motion) continue;
    const life = age / BURST_SEC;
    const col = BURST_RGB[bu.kind];
    rgb[0] = col[0];
    rgb[1] = col[1];
    rgb[2] = col[2];
    // Bright central pop.
    if (p < CAP) {
      setParticle(p, bu.x, bu.y, (1 - life) * (bu.kind === 'perfect' ? 130 : 80), (1 - life) * 0.6);
      p++;
    }
    const seed = (Math.round(bu.birth) + Math.round(bu.x)) >>> 0;
    const count = bu.kind === 'perfect' ? 22 : bu.kind === 'miss' ? 14 : 13;
    const fail = bu.kind === 'miss';
    for (let s = 0; s < count && p < CAP; s++) {
      const a = rand2(seed, s);
      const b = rand2(seed, s + 97);
      // Miss rains sharp shards downward; a hit fountains out in all directions.
      const angle = fail ? Math.PI / 2 + (a - 0.5) * 2.0 : a * Math.PI * 2;
      const gravity = fail ? 280 : 36;
      const speed = 120 + b * 280;
      const px = bu.x + Math.cos(angle) * speed * age;
      const py = bu.y + Math.sin(angle) * speed * age + gravity * age * age;
      setParticle(p, px, py, (1 - life) * (3 + b * 5.5), (1 - life) * 0.95);
      p++;
    }
  }

  const geo = points.geometry;
  geo.attributes.position.needsUpdate = true;
  geo.attributes.aColor.needsUpdate = true;
  geo.attributes.aSize.needsUpdate = true;
  geo.attributes.aAlpha.needsUpdate = true;
  geo.setDrawRange(0, p);
  points.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();

  // --- upward key beams on the active lanes ---
  let bi = 0;
  for (const mn of active) {
    if (bi >= beams.length) break;
    const laid = keyByMidi.get(mn);
    if (!laid) continue;
    const cx = keyCenterRatio(laid, wc) * w;
    const bw = keyWidthRatio(laid, wc) * w * 1.7;
    pitchRgb((mn - lay.lowMidi) / span, isDark, rgb);
    const beam = beams[bi++];
    beam.visible = true;
    beam.position.set(cx, hitY - BEAM_PX / 2, 0);
    beam.scale.set(bw, BEAM_PX, 1);
    beam.material.uniforms.uColor.value.setRGB(rgb[0], rgb[1], rgb[2]);
    beam.material.uniforms.uOpacity.value = 0.6;
  }
  for (let i = bi; i < beams.length; i++) beams[i].visible = false;

  // --- strike line, pulsing on landings ---
  let pulse = 0;
  if (m && motion) {
    for (const n of m.notes) {
      const age = posBase - n.startSec;
      if (age >= 0 && age < FLASH_SEC) pulse = Math.max(pulse, 1 - age / FLASH_SEC);
    }
  }
  strike.position.set(w / 2, hitY, 0);
  strike.scale.set(w, 30, 1);
  strike.material.uniforms.uOpacity.value = 0.5 + pulse * 0.55;

  renderer.render(scene, camera);
}

/**
 * Fire a judgment burst on a key's lane at the strike line.
 *
 * @param midi MIDI note the player struck (or the note that was missed).
 * @param kind The judgment, which picks the burst color and shape.
 */
function hit(midi: number, kind: BurstKind): void {
  if (!host.value) return;
  const w = host.value.clientWidth;
  const h = host.value.clientHeight;
  if (w === 0 || h === 0) return;
  const laid = keyByMidi.get(midi);
  const cx = laid ? keyCenterRatio(laid, props.layout.whiteCount) * w : w / 2;
  bursts.push({
    x: cx,
    y: h * HIT_RATIO,
    kind,
    birth: typeof performance !== 'undefined' ? performance.now() : 0,
  });
  if (bursts.length > MAX_BURSTS) bursts.shift();
}

function applyCamera(): void {
  if (!host.value || !renderer || !camera) return;
  const w = host.value.clientWidth;
  const h = host.value.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.left = 0;
  camera.right = w;
  camera.top = 0;
  camera.bottom = h;
  camera.updateProjectionMatrix();
}

onMounted(async () => {
  if (typeof window === 'undefined' || !host.value) return;
  const loadedThree = await import('three');
  if (disposed || !host.value) return;
  THREE = loadedThree;
  rebuildKeyMap();

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(0, 1, 0, 1, -100, 100);
  camera.position.set(0, 0, 10);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.value.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  // Particle system: one Points cloud for every spark and flash.
  positions = new Float32Array(CAP * 3);
  colors = new Float32Array(CAP * 3);
  sizes = new Float32Array(CAP);
  alphas = new Float32Array(CAP);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setDrawRange(0, 0);
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  points = new THREE.Points(geo, sparkMat);
  points.frustumCulled = false;
  scene.add(points);

  // Beam pool (unit plane, scaled per frame).
  const beamGeo = new THREE.PlaneGeometry(1, 1);
  beams = [];
  for (let i = 0; i < BEAM_POOL; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0 } },
      vertexShader: PLANE_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    beams.push(mesh);
  }

  // Strike line glow.
  accentRgb(rgb);
  const strikeMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(rgb[0], rgb[1], rgb[2]) },
      uOpacity: { value: 0.5 },
    },
    vertexShader: PLANE_VERT,
    fragmentShader: STRIKE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  strike = new THREE.Mesh(beamGeo, strikeMat);
  strike.frustumCulled = false;
  scene.add(strike);

  applyCamera();
  resizeObserver = new ResizeObserver(applyCamera);
  resizeObserver.observe(host.value);
});

onBeforeUnmount(() => {
  disposed = true;
  resizeObserver?.disconnect();
  points?.geometry.dispose();
  points?.material.dispose();
  for (const b of beams) b.material.dispose();
  beams[0]?.geometry.dispose();
  strike?.material.dispose();
  renderer?.dispose?.();
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  THREE = renderer = scene = camera = points = strike = null;
  beams = [];
  bursts = [];
});

watch(
  () => props.layout,
  () => {
    if (THREE) rebuildKeyMap();
  },
);

defineExpose({ draw, hit });
</script>

<template>
  <div ref="host" class="practice-fx" aria-hidden="true"></div>
</template>

<style scoped>
.practice-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
</style>
