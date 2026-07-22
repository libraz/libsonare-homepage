<script lang="ts">
import type { ScanResult } from '@/workers/spatial.worker';

/**
 * Map a libsonare room point (x∈length, y∈width, z up) into three.js scene coords,
 * centered on the given room. Pure and THREE-free so scene geometry is unit-testable.
 * (libsonare x→scene x-left, z→scene up, y→scene depth.)
 */
export function sceneCoords(
  p: { x: number; y: number; z: number },
  room: { length: number; width: number },
): [number, number, number] {
  return [p.x - room.length / 2, p.z, p.y - room.width / 2];
}

/**
 * Scene position of the ground-truth source marker, centered on the *truth* room dims
 * (not the estimated room) so it stays inside its own dashed truth box when the blind
 * estimate diverges. Returns null when there is no truth overlay.
 */
export function truthMarkerCoords(res: ScanResult): [number, number, number] | null {
  return res.truth ? sceneCoords(res.truth.source, res.truth.room) : null;
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    result: ScanResult | null;
    accent?: string;
    cyan?: string;
    amber?: string;
    truth?: string;
    isDark?: boolean;
    autoRotate?: boolean;
    level?: number;
  }>(),
  {
    accent: '#8B5CF6',
    cyan: '#22D3EE',
    amber: '#F59E0B',
    truth: '#34D399',
    isDark: true,
    autoRotate: true,
    level: 0,
  },
);

const host = ref<HTMLDivElement | null>(null);

// Three.js handles — populated on the client only (guarded for SSR). Typed as
// `any` because three is dynamically imported; the module type is not in scope here.
let THREE: any = null;
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let roomGroup: any = null;
let wavefronts: any[] = [];
let resizeObserver: ResizeObserver | null = null;
let disposed = false;
let frame = 0;
let target = { x: 0, y: 1.5, z: 0 };

// Honour the OS reduced-motion preference: keep drag-to-orbit interactive but
// stop autonomous rotation / wavefront / pulse animation and render statically.
const reduceMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Orbit state (spherical around target).
const orbit = { radius: 18, theta: Math.PI * 0.62, phi: Math.PI * 0.42 };
let dragging = false;
let lastX = 0;
let lastY = 0;

function color(hex: string) {
  return new THREE.Color(hex);
}

// libsonare coords (x∈len, y∈width, z∈height, z up) → three (x-left, z up, y-depth).
function toScene(p: { x: number; y: number; z: number }, room: { length: number; width: number }) {
  const [x, y, z] = sceneCoords(p, room);
  return new THREE.Vector3(x, y, z);
}

function disposeGroup(group: any) {
  if (!group) return;
  group.traverse((obj: any) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) for (const m of obj.material) m.dispose();
      else obj.material.dispose();
    }
  });
  scene.remove(group);
}

function addWireBox(
  group: any,
  len: number,
  wid: number,
  hei: number,
  hex: string,
  opacity: number,
  dashed = false,
) {
  const geo = new THREE.BoxGeometry(len, hei, wid);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = dashed
    ? new THREE.LineDashedMaterial({
        color: color(hex),
        transparent: true,
        opacity,
        dashSize: 0.4,
        gapSize: 0.3,
      })
    : new THREE.LineBasicMaterial({ color: color(hex), transparent: true, opacity });
  const line = new THREE.LineSegments(edges, mat);
  if (dashed) line.computeLineDistances();
  line.position.set(0, hei / 2, 0);
  group.add(line);
  return line;
}

function addWalls(group: any, len: number, wid: number, hei: number, hex: string, opacity: number) {
  const geo = new THREE.BoxGeometry(len, hei, wid);
  const mat = new THREE.MeshBasicMaterial({
    color: color(hex),
    transparent: true,
    opacity,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, hei / 2, 0);
  group.add(mesh);
}

function addFloorGrid(group: any, len: number, wid: number, hex: string, opacity: number) {
  const divisions = Math.max(4, Math.round(Math.max(len, wid) / 1.5));
  const grid = new THREE.GridHelper(Math.max(len, wid), divisions, color(hex), color(hex));
  grid.material.transparent = true;
  grid.material.opacity = opacity;
  group.add(grid);
}

function addMarker(group: any, pos: any, hex: string, radius: number, emissive = 0.0) {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ color: color(hex) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  group.add(mesh);
  // Soft halo.
  const haloGeo = new THREE.SphereGeometry(radius * 2.1, 20, 14);
  const haloMat = new THREE.MeshBasicMaterial({
    color: color(hex),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.copy(pos);
  group.add(halo);
  if (emissive > 0) {
    mesh.userData.pulse = true;
    halo.userData.pulseHalo = true;
  }
  return mesh;
}

function addSphereShell(
  group: any,
  center: any,
  radius: number,
  hex: string,
  fillOpacity: number,
  wireOpacity: number,
) {
  const geo = new THREE.SphereGeometry(radius, 40, 28);
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: color(hex),
      transparent: true,
      opacity: fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fill.position.copy(center);
  group.add(fill);
  const wire = new THREE.Mesh(
    geo.clone(),
    new THREE.MeshBasicMaterial({
      color: color(hex),
      transparent: true,
      opacity: wireOpacity,
      wireframe: true,
      depthWrite: false,
    }),
  );
  wire.position.copy(center);
  group.add(wire);
}

function buildScene() {
  if (!THREE || !scene) return;
  disposeGroup(roomGroup);
  wavefronts = [];
  roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const res = props.result;
  if (!res) return;

  const room = { length: res.room.length, width: res.room.width, height: res.room.height };
  const listener = toScene(res.listener, room);
  const source = toScene(res.source, room);

  // On the light demo panel the brand purple washes out against the lavender
  // background, so the room is recoloured to a deep violet with stronger fills.
  // Dark mode keeps the flagship brand-purple look.
  const lineColor = props.isDark ? props.accent : '#4C1D95';
  const wallColor = props.isDark ? props.accent : '#5B21B6';

  // Wall opacity scales with absorption: damped rooms read as more solid.
  const meanAbs = res.bands.length
    ? res.bands.reduce((s, b) => s + b.absorption, 0) / res.bands.length
    : 0.2;
  const wallOpacity = props.isDark ? 0.05 + meanAbs * 0.16 : 0.1 + meanAbs * 0.16;

  addWalls(roomGroup, room.length, room.width, room.height, wallColor, wallOpacity);
  addWireBox(
    roomGroup,
    room.length,
    room.width,
    room.height,
    lineColor,
    props.isDark ? 0.85 : 0.95,
  );
  addFloorGrid(roomGroup, room.length, room.width, lineColor, props.isDark ? 0.22 : 0.42);

  // Ground-truth room overlay for built-in presets. Drawn in a dedicated truth hue so
  // it reads distinctly from the cyan critical-distance shell. The truth source marker
  // is centered on the truth room dims (not the estimated room) so it stays anchored to
  // its own dashed box when the blind estimate diverges.
  if (res.truth) {
    addWireBox(
      roomGroup,
      res.truth.room.length,
      res.truth.room.width,
      res.truth.room.height,
      props.truth,
      0.5,
      true,
    );
    addMarker(
      roomGroup,
      toScene(res.truth.source, res.truth.room),
      props.truth,
      sizeFor(room, 0.05),
    );
  }

  const markerR = sizeFor(room, 0.045);
  // Critical-distance sphere (where direct = reverberant energy).
  addSphereShell(
    roomGroup,
    listener,
    res.criticalDistance,
    props.cyan,
    0.0,
    props.isDark ? 0.1 : 0.08,
  );
  // Estimated source-distance shell.
  addSphereShell(
    roomGroup,
    listener,
    res.sourceDistance,
    props.amber,
    props.isDark ? 0.05 : 0.04,
    props.isDark ? 0.16 : 0.12,
  );

  addMarker(roomGroup, listener, props.isDark ? '#ffffff' : '#1E1B4B', markerR);
  addMarker(roomGroup, source, props.amber, markerR * 1.05, 1);

  // Wavefront emitters from the source.
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(1, 28, 18);
    const mat = new THREE.MeshBasicMaterial({
      color: color(props.amber),
      transparent: true,
      opacity: 0.0,
      wireframe: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(source);
    mesh.userData.offset = i / 3;
    mesh.userData.maxR = res.sourceDistance * 1.05;
    roomGroup.add(mesh);
    wavefronts.push(mesh);
  }

  // Recentre orbit + auto-fit distance to room size.
  target = { x: 0, y: room.height / 2, z: 0 };
  const diag = Math.hypot(room.length, room.width, room.height);
  orbit.radius = diag * 1.15;
}

// Marker / detail sizing relative to room scale so small and huge rooms both read well.
function sizeFor(room: { length: number; width: number; height: number }, factor: number) {
  return Math.max(0.08, Math.hypot(room.length, room.width, room.height) * factor * 0.18);
}

function updateCamera() {
  const r = orbit.radius;
  const phi = Math.max(0.15, Math.min(Math.PI - 0.15, orbit.phi));
  camera.position.set(
    target.x + r * Math.sin(phi) * Math.cos(orbit.theta),
    target.y + r * Math.cos(phi),
    target.z + r * Math.sin(phi) * Math.sin(orbit.theta),
  );
  camera.lookAt(target.x, target.y, target.z);
}

function animate() {
  frame = requestAnimationFrame(animate);

  // Autonomous motion (auto-rotate, expanding wavefronts, source pulse) is
  // suppressed under reduced-motion; drag-to-orbit below still re-renders.
  if (!reduceMotion) {
    if (props.autoRotate && !dragging) orbit.theta += 0.0024;

    const t = performance.now() * 0.001;
    // Playback level drives emission: faster, brighter wavefronts and a larger source
    // pulse while audio is loud, so the 3D scene reflects what you hear.
    const lvl = Math.max(0, Math.min(1, props.level));
    const speed = 0.3 + lvl * 0.7;
    for (const wf of wavefronts) {
      const p = (t * speed + wf.userData.offset) % 1;
      const scale = Math.max(0.001, p * wf.userData.maxR);
      wf.scale.setScalar(scale);
      wf.material.opacity = (1 - p) * (0.12 + lvl * 0.5);
    }
    roomGroup?.traverse?.((obj: any) => {
      if (obj.userData?.pulse) {
        const s = 1 + Math.sin(t * 3.2) * 0.08 + lvl * 0.5;
        obj.scale.setScalar(s);
      }
      if (obj.userData?.pulseHalo) {
        obj.material.opacity = 0.1 + (Math.sin(t * 3.2) * 0.5 + 0.5) * 0.1 + lvl * 0.28;
      }
    });
  }

  updateCamera();
  renderer.render(scene, camera);
}

function resize() {
  if (!host.value || !renderer || !camera) return;
  const w = host.value.clientWidth;
  const h = host.value.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  orbit.theta -= (e.clientX - lastX) * 0.006;
  orbit.phi -= (e.clientY - lastY) * 0.006;
  lastX = e.clientX;
  lastY = e.clientY;
}
function onPointerUp() {
  dragging = false;
}
function onWheel(e: WheelEvent) {
  e.preventDefault();
  orbit.radius = Math.max(2, Math.min(220, orbit.radius * (1 + Math.sign(e.deltaY) * 0.08)));
}

onMounted(async () => {
  if (typeof window === 'undefined' || !host.value) return;
  const loadedThree = await import('three');
  if (disposed || !host.value) return;
  THREE = loadedThree;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.value.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';

  buildScene();
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
  animate();
});

onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  disposeGroup(roomGroup);
  renderer?.dispose?.();
  if (renderer?.domElement?.parentNode)
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  THREE = renderer = scene = camera = roomGroup = null;
});

watch(
  () => props.result,
  () => {
    if (THREE) buildScene();
  },
);
watch(
  () => props.isDark,
  () => {
    if (THREE) buildScene();
  },
);
</script>

<template>
  <div
    ref="host"
    class="room-scene"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @wheel="onWheel"
  ></div>
</template>

<style scoped>
.room-scene {
  position: absolute;
  inset: 0;
  cursor: grab;
}
.room-scene:active {
  cursor: grabbing;
}
</style>
