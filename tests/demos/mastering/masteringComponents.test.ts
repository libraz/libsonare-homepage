import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { computed, h } from 'vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

import MasteringChoiceGrid from '@/demos/mastering/MasteringChoiceGrid.vue';
import MasteringEqEditor from '@/demos/mastering/MasteringEqEditor.vue';
import MasteringExportPanel from '@/demos/mastering/MasteringExportPanel.vue';
import MasteringMeterBridge from '@/demos/mastering/MasteringMeterBridge.vue';
import MasteringModuleEditor from '@/demos/mastering/MasteringModuleEditor.vue';
import MasteringMonitor from '@/demos/mastering/MasteringMonitor.vue';
import MasteringParamGrid from '@/demos/mastering/MasteringParamGrid.vue';
import MasteringRack from '@/demos/mastering/MasteringRack.vue';
import MasteringSourceBar from '@/demos/mastering/MasteringSourceBar.vue';
import MasteringTimeline from '@/demos/mastering/MasteringTimeline.vue';
import { jaCopy, MASTERING_COPY } from '@/demos/mastering/masteringCopy';
import {
  defaultMasteringState,
  MASTERING_SLOT,
  masteringMutators,
} from '@/demos/mastering/masteringState';
import { silentReading } from '@/demos/mastering/useMasteringMetering';

enableAutoUnmount(afterEach);

beforeAll(() => {
  // jsdom lays nothing out; give every element a 100 px box at the origin.
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, x: 0, y: 0 }) as DOMRect;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function pointer(type: string, clientX: number) {
  return new MouseEvent(type, { clientX, bubbles: true, button: 0 }) as unknown as PointerEvent;
}

describe('MasteringRack', () => {
  const props = () => ({
    state: masteringMutators.setInsertBypassed(defaultMasteringState(), MASTERING_SLOT.tape, true),
    selected: 'compressor' as const,
    grDb: -3.2,
    resetFlash: 0,
    repairProgress: null,
    repairFailed: false,
  });

  it('lists repair, EQ and the 13 inserts with bypass switches and the chain GR once, in the footer', async () => {
    const wrapper = mount(MasteringRack, { props: props() });
    const rows = wrapper.findAll('.rack__row');
    expect(rows).toHaveLength(15);
    expect(rows[MASTERING_SLOT.compressor + 2].find('[aria-current="true"]').exists()).toBe(true);
    // The engine reports one GR for the whole lane, so no module row claims it.
    expect(wrapper.find('.rack__row .gr-meter').exists()).toBe(false);
    expect(wrapper.find('.rack__foot .gr-meter').exists()).toBe(true);
    // The drive slot belongs to the loudness fit and has no switch.
    expect(rows[MASTERING_SLOT.drive + 2].find('button.rack__power').exists()).toBe(false);

    const tape = rows[MASTERING_SLOT.tape + 2].find('button.rack__power');
    expect(tape.attributes('aria-pressed')).toBe('false');
    expect(tape.attributes('aria-label')).toBe('Enable Tape');
    await tape.trigger('click');
    expect(wrapper.emitted('bypass')?.[0]).toEqual([MASTERING_SLOT.tape, false]);

    await rows[1].find('.rack__select').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['eq']);
  });

  it('announces a rebuild while the reset flash is on', async () => {
    const wrapper = mount(MasteringRack, { props: { ...props(), resetFlash: 1 } });
    expect(wrapper.find('.rack').classes()).toContain('rack--rebuilt');
    expect(wrapper.find('[role="status"]').text()).toBe('Inserts rebuilt');
  });
});

describe('MasteringParamGrid', () => {
  const insert = () => defaultMasteringState().inserts[MASTERING_SLOT.multiband];

  it('applies a crossover once, on release', async () => {
    const wrapper = mount(MasteringParamGrid, {
      props: { slotIndex: MASTERING_SLOT.multiband, insert: insert() },
    });
    const crossover = wrapper
      .findAll('[role="slider"]')
      .find((node) => node.attributes('aria-label') === 'Low / mid');
    expect(crossover).toBeDefined();
    crossover!.element.dispatchEvent(pointer('pointerdown', 10));
    crossover!.element.dispatchEvent(pointer('pointermove', 60));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('param')).toBeUndefined();
    expect(wrapper.emitted('begin')).toBeUndefined();
    crossover!.element.dispatchEvent(pointer('pointerup', 60));
    await wrapper.vm.$nextTick();
    const params = wrapper.emitted('param') ?? [];
    expect(params).toHaveLength(1);
    expect(params[0][0]).toBe('cutoff0Hz');
    expect(params[0][1]).toBeGreaterThan(220);
  });

  it('streams a realtime parameter between begin and end', async () => {
    const wrapper = mount(MasteringParamGrid, {
      props: { slotIndex: MASTERING_SLOT.multiband, insert: insert() },
    });
    const threshold = wrapper.findAll('[role="slider"]')[0];
    threshold.element.dispatchEvent(pointer('pointerdown', 10));
    threshold.element.dispatchEvent(pointer('pointermove', 30));
    threshold.element.dispatchEvent(pointer('pointerup', 30));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('begin')).toHaveLength(1);
    expect(wrapper.emitted('end')).toHaveLength(1);
    expect(wrapper.emitted('param')?.every(([name]) => name === 'band0.thresholdDb')).toBe(true);
  });

  it('switches booleans directly and labels in the provided locale', async () => {
    const wrapper = mount(MasteringParamGrid, {
      props: {
        slotIndex: MASTERING_SLOT.compressor,
        insert: defaultMasteringState().inserts[MASTERING_SLOT.compressor],
      },
      global: { provide: { [MASTERING_COPY as symbol]: computed(() => jaCopy) } },
    });
    expect(wrapper.text()).toContain('スレッショルド');
    await wrapper.find('input[type="checkbox"]').setValue(false);
    expect(wrapper.emitted('param')?.[0]).toEqual(['autoMakeup', false]);
  });
});

describe('MasteringModuleEditor', () => {
  it('shows the drive as a readout with no controls and the module guide link', () => {
    const state = masteringMutators.setInsertParam(
      defaultMasteringState(),
      MASTERING_SLOT.drive,
      'levelDb',
      4.25,
    );
    const wrapper = mount(MasteringModuleEditor, {
      props: {
        module: 'drive',
        state,
        glossaryBase: '/docs/glossary',
        freqs: null,
        outputDb: null,
        inputDb: null,
        wasm: null,
        sampleRate: 48000,
        repairProgress: null,
        repairFailed: false,
      },
    });
    expect(wrapper.find('.module-editor__drive strong').text()).toBe('+4.25 dB');
    expect(wrapper.find('[role="slider"]').exists()).toBe(false);
    expect(wrapper.find('a').attributes('href')).toBe(
      '/docs/glossary/mastering/stereo-limiter-loudness#loudness-target',
    );
  });

  it('bypasses and resets the selected insert', async () => {
    const wrapper = mount(MasteringModuleEditor, {
      props: {
        module: 'limiter',
        state: defaultMasteringState(),
        glossaryBase: '/docs/glossary',
        freqs: null,
        outputDb: null,
        inputDb: null,
        wasm: null,
        sampleRate: 48000,
        repairProgress: null,
        repairFailed: false,
      },
    });
    await wrapper.find('.module-editor__bypass').trigger('click');
    await wrapper.find('.module-editor__reset').trigger('click');
    expect(wrapper.emitted('bypass')?.[0]).toEqual([MASTERING_SLOT.limiter, true]);
    expect(wrapper.emitted('reset')?.[0]).toEqual([MASTERING_SLOT.limiter]);
  });
});

describe('MasteringEqEditor', () => {
  it('lists eight bands, hides gain on the pass bands and toggles a band', async () => {
    const wrapper = mount(MasteringEqEditor, {
      props: {
        bands: defaultMasteringState().eq,
        matchEq: null,
        freqs: null,
        outputDb: null,
        inputDb: null,
        wasm: null,
        sampleRate: 48000,
      },
    });
    const bands = wrapper.findAll('.eq-band');
    expect(bands).toHaveLength(8);
    expect(bands[0].findAll('[role="slider"]')).toHaveLength(2);
    expect(bands[2].findAll('[role="slider"]')).toHaveLength(3);
    await bands[3].find('input[type="checkbox"]').setValue(true);
    expect(wrapper.emitted('band')?.[0]).toEqual([3, { enabled: true }]);
  });
});

describe('MasteringMonitor', () => {
  it('is a radio group whose reference lane waits for a reference', async () => {
    const wrapper = mount(MasteringMonitor, {
      props: {
        lane: 'after',
        matchLoudness: true,
        gains: { after: -2.04, before: 0, reference: 0 },
        canReference: false,
      },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(radios[0].text()).toContain('−2.0 dB');
    expect(radios[2].attributes('disabled')).toBeDefined();
    await radios[1].trigger('click');
    expect(wrapper.emitted('lane')?.[0]).toEqual(['before']);
    await wrapper.find('input[role="switch"]').setValue(false);
    expect(wrapper.emitted('match')?.[0]).toEqual([false]);
  });
});

describe('MasteringExportPanel', () => {
  const base = {
    fit: null,
    fitStale: true,
    targetLufs: -14,
    hasProgram: true,
    job: null,
    lastRender: null,
  };

  it('offers refit-and-export while the fit is stale and drops dither for float', async () => {
    const wrapper = mount(MasteringExportPanel, { props: base });
    expect(wrapper.find('.export__primary').text()).toBe('Refit and export');
    expect(wrapper.find('.export__badge').text()).toBe('Target not refitted');
    const [formats, dithers] = wrapper.findAll('[role="radiogroup"]');
    await formats.findAll('button')[0].trigger('click');
    await dithers.findAll('button')[2].trigger('click');
    await wrapper.find('.export__primary').trigger('click');
    expect(wrapper.emitted('export')?.[0]).toEqual(['pcm16', 'noiseShaped']);

    await formats.findAll('button')[2].trigger('click');
    expect(
      dithers.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    expect(wrapper.text()).toContain('Float output is not dithered.');
  });

  it('shows the fit and the last render once they exist', () => {
    const wrapper = mount(MasteringExportPanel, {
      props: {
        ...base,
        fitStale: false,
        fit: {
          targetLufs: -14,
          driveDb: 4.4,
          measuredLufs: -14.06,
          residualLu: 0.06,
          bounces: 2,
          limited: false,
          fingerprint: 'x',
        },
        lastRender: {
          result: {
            fit: null,
            integratedLufs: -14.06,
            loudnessRange: 6.2,
            maxMomentaryLufs: -9,
            maxShortTermLufs: -11,
            truePeakDb: -1.02,
            shortTermLufs: new Float32Array(1),
          },
          format: 'pcm24',
          dither: 'tpdf',
          at: 0,
          url: 'blob:x',
          fileName: 'mix-master.wav',
        },
      },
    });
    expect(wrapper.find('.export__primary').text()).toBe('Export WAV');
    expect(wrapper.find('.export__fit-line').text()).toBe('−14.1 LUFS · Drive +4.4 dB');
    expect(wrapper.find('.export__grid').text()).toContain('13.0');
    expect(wrapper.find('.export__result-head').text()).toContain('24-bit PCM · TPDF');
  });

  it('cannot act without a program', () => {
    const wrapper = mount(MasteringExportPanel, { props: { ...base, hasProgram: false } });
    expect(wrapper.find('.export__primary').attributes('disabled')).toBeDefined();
  });
});

describe('MasteringMeterBridge', () => {
  it('names the lane being metered and marks render-only figures', () => {
    const wrapper = mount(MasteringMeterBridge, {
      props: {
        reading: silentReading(),
        lane: 'before',
        targetLufs: -14,
        lra: Number.NaN,
        scopeMid: null,
        scopeSide: null,
        freqs: null,
        outputDb: null,
        variant: 'strip',
      },
    });
    expect(wrapper.find('.meter-bridge__lane').text()).toBe('Metering: Before');
    expect(wrapper.find('.meter-bridge__render').text()).toBe('LRA: last render');
    expect(wrapper.find('.goniometer').exists()).toBe(false);
  });
});

describe('MasteringTimeline', () => {
  it('seeks on click and sets the loop range with Shift-drag', async () => {
    const wrapper = mount(MasteringTimeline, {
      props: {
        peaks: null,
        duration: 10,
        position: 2,
        playing: false,
        loop: { enabled: false, start: 0, end: 10 },
        shortTerm: null,
        targetLufs: -14,
      },
    });
    const body = wrapper.find('.timeline__body');
    body.element.dispatchEvent(pointer('pointerdown', 40));
    expect(wrapper.emitted('seek')?.[0]).toEqual([4]);
    body.element.dispatchEvent(pointer('pointerup', 40));
    body.element.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 20, shiftKey: true, bubbles: true }),
    );
    body.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 70, shiftKey: true, bubbles: true }),
    );
    expect(wrapper.emitted('update:loop')?.at(-1)).toEqual([{ enabled: true, start: 2, end: 7 }]);
    expect(wrapper.find('.timeline__caption span').text()).toBe(
      'Export once to draw the short-term loudness lane.',
    );
  });
});

describe('MasteringChoiceGrid and MasteringSourceBar', () => {
  it('selects a choice as a radio', async () => {
    const wrapper = mount(MasteringChoiceGrid, {
      props: {
        modelValue: 'a',
        label: 'Genre',
        options: [
          { id: 'a', icon: 'A', name: 'Alpha', tagline: 't', description: 'd', tip: 'p' },
          { id: 'b', icon: 'B', name: 'Beta', tagline: 't', description: 'd', tip: 'p' },
        ],
      },
      global: { stubs: { Tooltip: { render: () => h('span') } } },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios[0].attributes('aria-checked')).toBe('true');
    await radios[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b']);
  });

  it('notes a restored session and emits a chosen file', async () => {
    const wrapper = mount(MasteringSourceBar, {
      props: {
        info: null,
        loading: false,
        pendingRestore: true,
        restoredName: 'old.wav',
        notices: ['eq.2.q'],
        error: null,
      },
    });
    expect(wrapper.text()).toContain('Load the audio to apply them. (old.wav)');
    expect(wrapper.text()).toContain('eq.2.q');
    const input = wrapper.find('input[type="file"]');
    const file = new File(['x'], 'a.wav', { type: 'audio/wav' });
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    expect(wrapper.emitted('file')?.[0]).toEqual([file]);
  });
});
