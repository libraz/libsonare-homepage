<script setup lang="ts">
import { useMixingStudio } from '@/components/mixing/useMixingStudio';
import ToolShell from '@/components/ToolShell.vue';
import {
  AudioTransport,
  MetricItem,
  ScanLine,
  StatusIndicator,
  TechPanel,
  TermLabel,
  Tooltip,
} from '@/components/ui';

const {
  MAX_TRACKS,
  MAX_DURATION_SECONDS,
  REVERB_SEND_FLOOR,
  VCA_GROUP_IDS,
  AUTOMATION_CURVES,
  AUTOMATION_PARAM_IDS,
  copy,
  libVersion,
  tracks,
  selectedTrackId,
  masterFaderDb,
  reverb,
  vcaGains,
  automationParam,
  automationCurve,
  isLoading,
  isBouncing,
  progress,
  progressStage,
  localError,
  warning,
  bounceResult,
  outputUrl,
  fileInput,
  sceneInput,
  timelineRef,
  autoLaneRef,
  zoomSeconds,
  playheadSeconds,
  isPlaying,
  docsPath,
  oppositeLocalePath,
  statusKind,
  statusLabel,
  selectedTrack,
  slots,
  loadedDuration,
  timelineDuration,
  timelineTicks,
  statusFields,
  selectedMeter,
  masterMonoCompatible,
  selectedAutomation,
  automationPath,
  term,
  stripMeterFor,
  meterHeight,
  goniometerPoints,
  chooseFiles,
  handleFileInput,
  handleDrop,
  loadDemo,
  removeTrack,
  resetTrack,
  bounceMix,
  downloadMix,
  exportScene,
  chooseScene,
  importScene,
  automationValueToY,
  addAutomationPoint,
  startAutomationDrag,
  dragAutomationPoint,
  endAutomationDrag,
  removeAutomationPoint,
  clearAutomation,
  formatAutomationValue,
  togglePreview,
  stopPreview,
  seekTimeline,
  startClipDrag,
  dragClip,
  endClipDrag,
  clipStyle,
  playheadStyle,
  timeToPercent,
  trackLevels,
  waveformPath,
  formatDb,
  formatDuration,
  formatSampleRate,
} = useMixingStudio();
</script>

<template>
  <ToolShell
    demo-id="mixing"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.help.title"
    :guide-body="copy.help.body"
    :guide-link-label="copy.help.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="mix-statusbar" role="status" aria-live="polite">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isBouncing" />
        <span v-for="field in statusFields" :key="field.key" class="mix-statusbar__field">
          <span class="mix-statusbar__key">{{ field.key }}</span>
          <span class="mix-statusbar__value">{{ field.value }}</span>
        </span>
      </div>
    </template>

    <div class="mix-studio" @drop="handleDrop" @dragover.prevent>
      <aside class="mix-studio__left">
        <TechPanel :title="copy.import.title">
          <div class="mix-drop" @click="chooseFiles">
            <input ref="fileInput" class="mix-drop__input" type="file" accept="audio/*" multiple @change="handleFileInput">
            <span class="mix-drop__icon">{{ tracks.length }}/8</span>
            <strong>{{ copy.import.dropTitle }}</strong>
            <span>{{ copy.import.dropBody }}</span>
            <ScanLine />
          </div>
          <div class="mix-actions">
            <button class="mix-button mix-button--primary" :disabled="isLoading || isBouncing || tracks.length >= MAX_TRACKS" @click="chooseFiles">
              {{ copy.import.choose }}
            </button>
            <button v-if="!tracks.length" class="mix-button" :disabled="isLoading || isBouncing" @click="loadDemo">
              {{ copy.import.loadDemo }}
            </button>
          </div>
        </TechPanel>
      </aside>

      <section class="mix-studio__center">
        <div v-if="isBouncing" class="mix-progress">
          <div class="mix-progress__top">
            <span>{{ progressStage }}</span>
            <span>{{ Math.round(progress * 100) }}%</span>
          </div>
          <div class="mix-progress__bar"><span :style="{ width: `${progress * 100}%` }"></span></div>
        </div>

        <div v-if="localError" class="mix-message mix-message--error">{{ localError }}</div>
        <div v-else-if="warning" class="mix-message mix-message--warning">{{ warning }}</div>

        <TechPanel :title="copy.panels.timeline">
          <div class="mix-arrange">
            <div class="mix-transport">
              <button class="mix-button mix-button--transport" :disabled="!tracks.length" @click="togglePreview">
                {{ isPlaying ? copy.controls.stop : copy.controls.play }}
              </button>
              <button class="mix-button mix-button--transport" :disabled="!tracks.length" @click="playheadSeconds = 0; stopPreview()">
                00:00
              </button>
              <label class="mix-zoom">
                <span>{{ copy.controls.zoom }}</span>
                <input v-model.number="zoomSeconds" type="range" min="15" max="300" step="5">
                <b>{{ formatDuration(timelineDuration) }}</b>
              </label>
              <span class="mix-playhead-readout">{{ formatDuration(playheadSeconds) }}</span>
            </div>

            <div ref="timelineRef" class="mix-timeline" @click="seekTimeline">
              <div class="mix-ruler">
                <span
                  v-for="tick in timelineTicks"
                  :key="tick.time"
                  class="mix-ruler__tick"
                  :style="{ left: `${tick.left}%` }"
                >
                  {{ tick.label }}
                </span>
              </div>
              <div class="mix-playhead" :style="playheadStyle()"></div>
              <div
                v-for="(track, index) in tracks"
                :key="track.id"
                class="mix-lane"
                :class="{ 'mix-lane--selected': track.id === selectedTrackId }"
                @click.stop="selectedTrackId = track.id"
              >
                <div class="mix-lane__header">
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <strong>{{ track.name }}</strong>
                  <small>{{ formatDuration(track.offsetSeconds) }}</small>
                </div>
                <div class="mix-lane__body">
                  <button
                    class="mix-clip"
                    :class="{ 'mix-clip--muted': track.muted }"
                    :style="clipStyle(track)"
                    @pointerdown.stop="startClipDrag($event, track)"
                    @pointermove.stop="dragClip"
                    @pointerup.stop="endClipDrag"
                    @pointercancel.stop="endClipDrag"
                  >
                    <svg viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
                      <path :d="waveformPath(track)" />
                    </svg>
                    <span>{{ track.name }}</span>
                  </button>
                </div>
              </div>
              <div v-if="!tracks.length" class="mix-timeline__empty">
                {{ copy.import.timelineEmpty }}
              </div>
            </div>

            <div v-if="selectedTrack" class="mix-autolane">
              <div class="mix-autolane__bar">
                <span class="mix-autolane__title">
                  <TermLabel v-bind="term('automation')">{{ copy.controls.automation }}</TermLabel>
                  <em>{{ selectedTrack.name }}</em>
                </span>
                <div class="mix-segment mix-segment--mini">
                  <button
                    v-for="(label, index) in copy.automationParams"
                    :key="label"
                    class="mix-segment__btn"
                    :class="{ 'mix-segment__btn--active': automationParam === AUTOMATION_PARAM_IDS[index] }"
                    @click="automationParam = AUTOMATION_PARAM_IDS[index]"
                  >{{ label }}</button>
                </div>
                <div class="mix-segment mix-segment--mini">
                  <Tooltip v-for="(label, index) in copy.automationCurves" :key="label" v-bind="term('curve')">
                    <button
                      class="mix-segment__btn"
                      :class="{ 'mix-segment__btn--active': automationCurve === AUTOMATION_CURVES[index] }"
                      @click="automationCurve = AUTOMATION_CURVES[index]"
                    >{{ label }}</button>
                  </Tooltip>
                </div>
                <button class="mix-button mix-button--mini" :disabled="!selectedAutomation.length" @click="clearAutomation">{{ copy.controls.clearLane }}</button>
              </div>
              <div class="mix-autolane__row">
                <span class="mix-autolane__gutter">{{ copy.automationParams[AUTOMATION_PARAM_IDS.indexOf(automationParam)] }}</span>
                <div
                  ref="autoLaneRef"
                  class="mix-autolane__plot"
                  @click="addAutomationPoint"
                  @pointermove="dragAutomationPoint"
                  @pointerup="endAutomationDrag"
                  @pointercancel="endAutomationDrag"
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <line class="mix-autolane__zero" x1="0" :y1="automationValueToY(automationParam === 'width' ? 1 : 0)" x2="100" :y2="automationValueToY(automationParam === 'width' ? 1 : 0)" />
                    <polyline v-if="automationPath" class="mix-autolane__line" :points="automationPath" />
                  </svg>
                  <button
                    v-for="point in selectedAutomation"
                    :key="point.id"
                    class="mix-autolane__node"
                    :style="{ left: `${timeToPercent(point.timeSec)}%`, top: `${automationValueToY(point.value)}%` }"
                    :title="`${formatAutomationValue(point)} · ${formatDuration(point.timeSec)}`"
                    @click.stop
                    @pointerdown="startAutomationDrag($event, point)"
                    @dblclick="removeAutomationPoint($event, point)"
                  ></button>
                  <span v-if="!selectedAutomation.length" class="mix-autolane__hint">{{ copy.controls.automationHint }}</span>
                </div>
              </div>
            </div>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.mixer">
          <div class="mix-console">
            <div
              v-for="(track, index) in slots"
              :key="track?.id || `empty-${index}`"
              class="mix-strip"
              :class="{ 'mix-strip--empty': !track, 'mix-strip--selected': track?.id === selectedTrackId }"
              @click="track && (selectedTrackId = track.id)"
            >
              <template v-if="track">
                <div class="mix-strip__top">
                  <span class="mix-strip__number">{{ String(index + 1).padStart(2, '0') }}</span>
                  <button class="mix-strip__remove" @click.stop="removeTrack(track)">x</button>
                </div>
                <input v-model="track.name" class="mix-strip__name" :aria-label="`Track ${index + 1} name`">
                <svg class="mix-strip__wave" viewBox="0 0 100 36" preserveAspectRatio="none">
                  <path :d="waveformPath(track)" />
                </svg>
                <div class="mix-strip__meter" :class="{ 'mix-strip__meter--live': stripMeterFor(track) }">
                  <span class="mix-strip__meter-peak" :style="{ height: `${stripMeterFor(track) ? meterHeight(stripMeterFor(track)!.peakDb) : 0}%` }"></span>
                  <span v-if="stripMeterFor(track)" class="mix-strip__meter-rms" :style="{ bottom: `${meterHeight(stripMeterFor(track)!.rmsDb)}%` }"></span>
                  <small v-if="stripMeterFor(track)" class="mix-strip__meter-val">{{ formatDb(stripMeterFor(track)!.peakDb) }}</small>
                </div>
                <div v-if="track.vcaGroup || stripMeterFor(track)" class="mix-strip__flags">
                  <span v-if="track.vcaGroup" class="mix-flag mix-flag--vca" :title="`${copy.controls.vcaGroup}: ${track.vcaGroup}`">{{ track.vcaGroup }}</span>
                  <span
                    v-if="stripMeterFor(track) && !stripMeterFor(track)!.monoCompatible"
                    class="mix-flag mix-flag--warn"
                    :title="`${copy.metrics.monoCompat}: ${copy.metrics.no}`"
                  >MONO</span>
                  <span
                    v-if="stripMeterFor(track) && stripMeterFor(track)!.truePeakDb > 0"
                    class="mix-flag mix-flag--danger"
                    :title="`${copy.metrics.truePeak} ${formatDb(stripMeterFor(track)!.truePeakDb)}`"
                  >TP</span>
                </div>
                <label class="mix-strip__control">
                  <span><TermLabel v-bind="term('fader', true)">{{ copy.controls.fader }}</TermLabel></span>
                  <input v-model.number="track.faderDb" type="range" min="-60" max="12" step="0.5">
                  <b>{{ track.faderDb.toFixed(1) }}</b>
                </label>
                <label class="mix-strip__control">
                  <span><TermLabel v-bind="term('pan', true)">{{ copy.controls.pan }}</TermLabel></span>
                  <input v-model.number="track.pan" type="range" min="-1" max="1" step="0.01">
                  <b>{{ track.pan.toFixed(2) }}</b>
                </label>
                <label class="mix-strip__control">
                  <span><TermLabel v-bind="term('width', true)">{{ copy.controls.width }}</TermLabel></span>
                  <input v-model.number="track.width" type="range" min="0" max="2" step="0.01">
                  <b>{{ Math.round(track.width * 100) }}%</b>
                </label>
                <div class="mix-strip__toggles">
                  <Tooltip v-bind="term('mute')">
                    <button :class="{ 'mix-toggle--active': track.muted }" class="mix-toggle" @click.stop="track.muted = !track.muted">M</button>
                  </Tooltip>
                  <Tooltip v-bind="term('solo')">
                    <button :class="{ 'mix-toggle--solo': track.soloed }" class="mix-toggle" @click.stop="track.soloed = !track.soloed">S</button>
                  </Tooltip>
                </div>
              </template>
              <template v-else>
                <span class="mix-strip__empty-number">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="mix-strip__empty-label">DROP</span>
              </template>
            </div>
          </div>
        </TechPanel>
      </section>

      <aside class="mix-studio__right">
        <TechPanel :title="copy.panels.inspector">
          <div v-if="selectedTrack" class="mix-inspector">
            <input v-model="selectedTrack.name" class="mix-inspector__name">
            <MetricItem :value="formatDuration(selectedTrack.audio.duration)">
              <template #label><TermLabel v-bind="term('duration')">{{ copy.metrics.duration }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="String(selectedTrack.audio.channels)">
              <template #label><TermLabel v-bind="term('channels')">{{ copy.metrics.channels }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="formatSampleRate(selectedTrack.audio.sampleRate)">
              <template #label><TermLabel v-bind="term('sampleRate')">{{ copy.metrics.sampleRate }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="trackLevels(selectedTrack).peak">
              <template #label><TermLabel v-bind="term('peak')">{{ copy.metrics.peak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="trackLevels(selectedTrack).rms">
              <template #label><TermLabel v-bind="term('rms')">{{ copy.metrics.rms }}</TermLabel></template>
            </MetricItem>
            <div v-if="selectedMeter" class="mix-gonio">
              <div class="mix-gonio__scope">
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  <circle class="mix-gonio__ring" cx="50" cy="50" r="46" />
                  <line class="mix-gonio__axis" x1="50" y1="6" x2="50" y2="94" />
                  <line class="mix-gonio__axis" x1="6" y1="50" x2="94" y2="50" />
                  <polyline class="mix-gonio__trace" :points="goniometerPoints(selectedMeter.goniometer)" />
                </svg>
                <span class="mix-gonio__label">
                  <TermLabel v-bind="term('goniometer')">{{ copy.metrics.goniometer }}</TermLabel>
                </span>
              </div>
              <div class="mix-gonio__readouts">
                <MetricItem :value="formatDb(selectedMeter.truePeakDb)">
                  <template #label><TermLabel v-bind="term('truePeak')">{{ copy.metrics.truePeak }}</TermLabel></template>
                </MetricItem>
                <MetricItem :value="selectedMeter.correlation.toFixed(2)">
                  <template #label><TermLabel v-bind="term('correlation')">{{ copy.metrics.correlation }}</TermLabel></template>
                </MetricItem>
                <MetricItem :value="selectedMeter.monoCompatible ? copy.metrics.yes : copy.metrics.no">
                  <template #label><TermLabel v-bind="term('monoCompat')">{{ copy.metrics.monoCompat }}</TermLabel></template>
                </MetricItem>
              </div>
            </div>
            <label class="mix-inspector__slider">
              <span><TermLabel v-bind="term('offset')">{{ copy.controls.offset }}</TermLabel> {{ formatDuration(selectedTrack.offsetSeconds) }}</span>
              <input v-model.number="selectedTrack.offsetSeconds" type="range" min="0" :max="Math.max(0, MAX_DURATION_SECONDS - selectedTrack.audio.duration)" step="0.1">
            </label>
            <label class="mix-inspector__slider">
              <span><TermLabel v-bind="term('trim')">{{ copy.controls.trim }}</TermLabel> {{ selectedTrack.inputTrimDb.toFixed(1) }} dB</span>
              <input v-model.number="selectedTrack.inputTrimDb" type="range" min="-24" max="24" step="0.5">
            </label>

            <div class="mix-field">
              <span class="mix-field__label"><TermLabel v-bind="term('panMode')">{{ copy.controls.panMode }}</TermLabel></span>
              <div class="mix-segment">
                <button
                  v-for="(mode, index) in copy.panModes"
                  :key="mode"
                  class="mix-segment__btn"
                  :class="{ 'mix-segment__btn--active': selectedTrack.panMode === index }"
                  @click="selectedTrack.panMode = index"
                >{{ mode }}</button>
              </div>
            </div>

            <template v-if="selectedTrack.panMode === 2">
              <label class="mix-inspector__slider">
                <span><TermLabel v-bind="term('dualPan')">{{ copy.controls.dualPanLeft }}</TermLabel> {{ selectedTrack.dualPanLeft.toFixed(2) }}</span>
                <input v-model.number="selectedTrack.dualPanLeft" type="range" min="-1" max="1" step="0.01">
              </label>
              <label class="mix-inspector__slider">
                <span><TermLabel v-bind="term('dualPan')">{{ copy.controls.dualPanRight }}</TermLabel> {{ selectedTrack.dualPanRight.toFixed(2) }}</span>
                <input v-model.number="selectedTrack.dualPanRight" type="range" min="-1" max="1" step="0.01">
              </label>
            </template>

            <div class="mix-field">
              <span class="mix-field__label"><TermLabel v-bind="term('panLaw')">{{ copy.controls.panLaw }}</TermLabel></span>
              <div class="mix-segment">
                <button
                  v-for="(law, index) in copy.panLaws"
                  :key="law"
                  class="mix-segment__btn"
                  :class="{ 'mix-segment__btn--active': selectedTrack.panLaw === index }"
                  @click="selectedTrack.panLaw = index"
                >{{ law }}</button>
              </div>
            </div>

            <label class="mix-inspector__slider">
              <span><TermLabel v-bind="term('channelDelay')">{{ copy.controls.channelDelay }}</TermLabel> {{ selectedTrack.channelDelayMs.toFixed(1) }} ms</span>
              <input v-model.number="selectedTrack.channelDelayMs" type="range" min="0" max="50" step="0.1">
            </label>

            <div class="mix-eq">
              <div class="mix-eq__head">
                <TermLabel v-bind="term('eq')">{{ copy.controls.eq }}</TermLabel>
                <Tooltip v-bind="term('eq')">
                  <button class="mix-toggle mix-toggle--wide" :class="{ 'mix-toggle--on': selectedTrack.eqEnabled }" @click="selectedTrack.eqEnabled = !selectedTrack.eqEnabled">{{ copy.controls.eqOn }}</button>
                </Tooltip>
              </div>
              <template v-if="selectedTrack.eqEnabled">
                <label class="mix-inspector__slider">
                  <span><TermLabel v-bind="term('tilt')">{{ copy.controls.tilt }}</TermLabel> {{ selectedTrack.eqTiltDb.toFixed(1) }} dB</span>
                  <input v-model.number="selectedTrack.eqTiltDb" type="range" min="-12" max="12" step="0.5">
                </label>
                <label class="mix-inspector__slider">
                  <span><TermLabel v-bind="term('air')">{{ copy.controls.air }}</TermLabel> +{{ selectedTrack.eqAirDb.toFixed(1) }} dB</span>
                  <input v-model.number="selectedTrack.eqAirDb" type="range" min="0" max="12" step="0.5">
                </label>
              </template>
            </div>

            <label class="mix-inspector__slider">
              <span><TermLabel v-bind="term('reverbSend')">{{ copy.controls.reverbSend }}</TermLabel> {{ selectedTrack.reverbSendDb <= REVERB_SEND_FLOOR ? '—' : `${selectedTrack.reverbSendDb.toFixed(1)} dB` }}</span>
              <input v-model.number="selectedTrack.reverbSendDb" type="range" :min="REVERB_SEND_FLOOR" max="0" step="0.5">
            </label>

            <div class="mix-field">
              <span class="mix-field__label"><TermLabel v-bind="term('vcaGroup')">{{ copy.controls.vcaGroup }}</TermLabel></span>
              <div class="mix-segment">
                <button
                  class="mix-segment__btn"
                  :class="{ 'mix-segment__btn--active': selectedTrack.vcaGroup === '' }"
                  @click="selectedTrack.vcaGroup = ''"
                >{{ copy.controls.groupNone }}</button>
                <button
                  v-for="groupId in VCA_GROUP_IDS"
                  :key="groupId"
                  class="mix-segment__btn"
                  :class="{ 'mix-segment__btn--active': selectedTrack.vcaGroup === groupId }"
                  @click="selectedTrack.vcaGroup = groupId"
                >{{ groupId }}</button>
              </div>
            </div>

            <div class="mix-inspector__toggles mix-inspector__toggles--3">
              <Tooltip v-bind="term('soloSafe')">
                <button :class="{ 'mix-toggle--solo': selectedTrack.soloSafe }" class="mix-toggle" @click="selectedTrack.soloSafe = !selectedTrack.soloSafe">{{ copy.controls.soloSafe }}</button>
              </Tooltip>
            </div>

            <div class="mix-inspector__toggles">
              <Tooltip v-bind="term('polarity')">
                <button :class="{ 'mix-toggle--active': selectedTrack.polarityLeft }" class="mix-toggle" @click="selectedTrack.polarityLeft = !selectedTrack.polarityLeft">POL L</button>
              </Tooltip>
              <Tooltip v-bind="term('polarity')">
                <button :class="{ 'mix-toggle--active': selectedTrack.polarityRight }" class="mix-toggle" @click="selectedTrack.polarityRight = !selectedTrack.polarityRight">POL R</button>
              </Tooltip>
            </div>
            <div class="mix-actions mix-actions--stack">
              <button class="mix-button" @click="resetTrack(selectedTrack)">{{ copy.controls.reset }}</button>
              <button class="mix-button" @click="removeTrack(selectedTrack)">{{ copy.controls.remove }}</button>
            </div>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.master">
          <div class="mix-inspector">
            <MetricItem :value="`${masterFaderDb.toFixed(1)} dB`">
              <template #label><TermLabel v-bind="term('masterFader')">{{ copy.metrics.masterFader }}</TermLabel></template>
            </MetricItem>
            <label class="mix-inspector__slider">
              <input v-model.number="masterFaderDb" type="range" min="-24" max="12" step="0.5">
            </label>
            <MetricItem :value="bounceResult ? formatDuration(bounceResult.duration) : formatDuration(loadedDuration)">
              <template #label><TermLabel v-bind="term('duration')">{{ copy.metrics.duration }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? formatDb(bounceResult.peakDb) : '-'">
              <template #label><TermLabel v-bind="term('peak')">{{ copy.metrics.peak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? formatDb(bounceResult.rmsDb) : '-'">
              <template #label><TermLabel v-bind="term('rms')">{{ copy.metrics.rms }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? bounceResult.correlation.toFixed(2) : '-'">
              <template #label><TermLabel v-bind="term('correlation')">{{ copy.metrics.correlation }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? `${bounceResult.integratedLufs.toFixed(1)} LUFS` : '-'">
              <template #label><TermLabel v-bind="term('lufs')">{{ copy.metrics.lufs }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? formatDb(bounceResult.truePeakDb) : '-'">
              <template #label><TermLabel v-bind="term('truePeak')">{{ copy.metrics.truePeak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="bounceResult ? (masterMonoCompatible ? copy.metrics.yes : copy.metrics.no) : '-'">
              <template #label><TermLabel v-bind="term('monoCompat')">{{ copy.metrics.monoCompat }}</TermLabel></template>
            </MetricItem>
            <AudioTransport v-if="outputUrl" class="mix-audio" :src="outputUrl" />
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.reverb">
          <div class="mix-inspector">
            <div class="mix-eq__head">
              <TermLabel v-bind="term('reverb')">{{ copy.controls.reverbOn }}</TermLabel>
              <Tooltip v-bind="term('reverb')">
                <button class="mix-toggle mix-toggle--wide" :class="{ 'mix-toggle--on': reverb.enabled }" @click="reverb.enabled = !reverb.enabled">{{ copy.controls.reverbOn }}</button>
              </Tooltip>
            </div>
            <template v-if="reverb.enabled">
              <label class="mix-inspector__slider">
                <span><TermLabel v-bind="term('reverb')">{{ copy.controls.decay }}</TermLabel> {{ reverb.decaySec.toFixed(1) }} s</span>
                <input v-model.number="reverb.decaySec" type="range" min="0.2" max="8" step="0.1">
              </label>
              <label class="mix-inspector__slider">
                <span><TermLabel v-bind="term('reverb')">{{ copy.controls.preDelay }}</TermLabel> {{ Math.round(reverb.preDelayMs) }} ms</span>
                <input v-model.number="reverb.preDelayMs" type="range" min="0" max="120" step="1">
              </label>
            </template>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.groups">
          <div class="mix-inspector">
            <label v-for="groupId in VCA_GROUP_IDS" :key="groupId" class="mix-inspector__slider">
              <span><TermLabel v-bind="term('vcaGroup')">VCA {{ groupId }}</TermLabel> {{ vcaGains[groupId].toFixed(1) }} dB</span>
              <input v-model.number="vcaGains[groupId]" type="range" min="-24" max="12" step="0.5">
            </label>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.export">
          <div class="mix-actions mix-actions--stack">
            <button class="mix-button mix-button--primary" :disabled="!tracks.length || isBouncing" @click="bounceMix">
              {{ copy.controls.bounce }}
            </button>
            <button class="mix-button" :disabled="!outputUrl" @click="downloadMix">
              {{ copy.controls.download }}
            </button>
            <button class="mix-button" :disabled="!tracks.length" @click="exportScene">
              {{ copy.controls.exportScene }}
            </button>
            <button class="mix-button" :disabled="!tracks.length" @click="chooseScene">
              {{ copy.controls.importScene }}
            </button>
            <input ref="sceneInput" class="mix-drop__input" type="file" accept="application/json,.json" @change="importScene">
          </div>
        </TechPanel>
      </aside>
    </div>
  </ToolShell>
</template>

<style scoped src="./mixing/mixingStudio.css"></style>
