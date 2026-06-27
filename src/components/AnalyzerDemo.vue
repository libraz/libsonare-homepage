<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AudioAnalyzer from '@/components/AudioAnalyzer.vue';
import ToolShell from '@/components/ToolShell.vue';
import { useI18n } from '@/composables/useI18n';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();

const libVersion = ref('');

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Visual Player',
      subtitle: 'Audio player with real-time chroma & spectrum visualization',
      localOnly: 'LOCAL',
      guideTitle: 'Visual player',
      guideBody:
        'Runs entirely in your browser via WebAssembly. Visualizes chroma and spectrum in real time as it plays; BPM and key are live reference values. For full analysis, see Analysis.',
      guideDocs: 'Open docs',
    },
    ja: {
      title: 'ビジュアルプレイヤー',
      subtitle: 'クロマ・スペクトルをリアルタイム可視化するオーディオプレイヤー',
      localOnly: 'ローカル実行',
      guideTitle: 'ビジュアルプレイヤー',
      guideBody:
        'WebAssembly でブラウザ内完結。再生に合わせてクロマ・スペクトルをリアルタイム可視化します。BPM・キーは再生中の参考値です。詳しい解析は「楽曲分析」へ。',
      guideDocs: 'ドキュメント',
    },
  }),
);
const docsPath = computed(() => localizedPath('/docs/wasm'));
const oppositeLocalePath = computed(() => alternateLocalePath('/analyzer'));

async function initWasm() {
  if (typeof window === 'undefined' || libVersion.value) return;
  try {
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
    libVersion.value = wasm.version();
  } catch (e) {
    console.warn('Failed to initialize WASM:', e);
  }
}

onMounted(() => {
  const ric = (window as any).requestIdleCallback;
  if (ric) ric(initWasm, { timeout: 2000 });
  else setTimeout(initWasm, 100);
});
</script>

<template>
  <ToolShell
    demo-id="analyzer"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    status="active"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideDocs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <AudioAnalyzer :lib-version="libVersion" />
  </ToolShell>
</template>
