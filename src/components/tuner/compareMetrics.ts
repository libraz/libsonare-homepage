/**
 * Compatibility re-export. The comparison metrics live in the Vue-independent
 * DSP layer (so the auto-fit optimizer and worker can share them); this path is
 * kept for the components that imported it before the move.
 */
export * from '@/tuner/dsp/compareMetrics';
