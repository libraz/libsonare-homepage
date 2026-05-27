<script setup lang="ts">
import { useSynesthesiaVisualizer } from '@/components/synesthesia/useSynesthesiaVisualizer';

const props = defineProps<{
  chromaData: {
    features: Float32Array;
    nFrames: number;
    nChroma: number;
  } | null;
  rmsData: Float32Array | null;
  bandData: {
    low: Float32Array;
    high: Float32Array;
  } | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}>();
const { canvas } = useSynesthesiaVisualizer(props);
</script>

<template>
  <div class="scope">
    <div class="scope__bezel">
      <div class="scope__screen">
        <canvas ref="canvas" class="scope__canvas"></canvas>
      </div>
      <div class="scope__indicators">
        <div class="scope__indicator scope__indicator--drums">
          <span class="scope__indicator-dot"></span>
          <span class="scope__indicator-label">LOW</span>
        </div>
        <div class="scope__indicator scope__indicator--melody">
          <span class="scope__indicator-dot"></span>
          <span class="scope__indicator-label">HIGH</span>
        </div>
      </div>
    </div>
    <div class="scope__footer">
      <span class="scope__model">CHROMA-12</span>
      <span class="scope__type">SPECTRAL ANALYZER</span>
    </div>
  </div>
</template>

<style scoped src="./synesthesia/synesthesiaVisualizer.css"></style>
