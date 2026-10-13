import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import MixDynamicsEditor from '@/demos/mixing/MixDynamicsEditor.vue';
import { TRACK_SLOT_INDEX } from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  duckKeyClosesCycle,
  type MixingState,
  setDuckKey,
  TRACK_SLOTS,
} from '@/demos/mixing/mixingState';
import { DYNAMICS_SLOTS } from '@/demos/mixing/mixingUi';
import { silentFrame, silentStrip } from '@/demos/mixing/useMixingMetering';
import type { MixingController } from '@/demos/mixing/useMixingStudio';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

const state = addTrack(createMixingState(), 'a', 1);
const track = state.tracks[0];

function controller(insertGrDb: number[]): MixingController {
  const frame = silentFrame();
  frame.tracks = { [track.id]: { ...silentStrip(), insertGrDb } };
  const view = shallowRef<MixingState>(state);
  return {
    view,
    editLocked: shallowRef(false),
    metering: { frame: shallowRef(frame) },
    begin: () => {},
    end: () => {},
    edit: () => {},
    paramInfo: () => [],
    // An engine-less controller answers from the state alone.
    canDuckKey: (trackId: number, key: number) =>
      !duckKeyClosesCycle(view.value.tracks, trackId, key),
  } as unknown as MixingController;
}

describe('dynamics editor gain reduction', () => {
  it('shows the selected slot its own insert reduction', async () => {
    const grs = TRACK_SLOTS.map((_, i) => -(i + 1));
    const wrapper = mount(MixDynamicsEditor, { props: { m: controller(grs), track } });
    const tabs = wrapper.findAll('[role="radio"]');
    expect(tabs).toHaveLength(DYNAMICS_SLOTS.length);
    for (const [i, slot] of DYNAMICS_SLOTS.entries()) {
      await tabs[i].trigger('click');
      const meters = wrapper.findAll('[role="meter"]');
      expect(meters).toHaveLength(1);
      expect(Number(meters[0].attributes('aria-valuenow'))).toBe(grs[TRACK_SLOT_INDEX[slot]]);
    }
  });

  it('reads no reduction before the engine reports', () => {
    const wrapper = mount(MixDynamicsEditor, { props: { m: controller([]), track } });
    expect(wrapper.find('[role="meter"]').attributes('aria-valuenow')).toBe('0');
  });

  it('offers no duck key that would close a cycle', async () => {
    let s = addTrack(addTrack(addTrack(createMixingState(), 'a', 1), 'b', 1), 'c', 1);
    s = setDuckKey(setDuckKey(s, 2, 1), 3, 2);
    const c = controller([]);
    (c.view as { value: typeof s }).value = s;
    const wrapper = mount(MixDynamicsEditor, { props: { m: c, track: s.tracks[0] } });
    await wrapper.findAll('[role="radio"]')[DYNAMICS_SLOTS.indexOf('duck')].trigger('click');
    const ids = wrapper.findAll('select option').map((o) => o.attributes('value'));
    expect(ids).toEqual(['']);
  });
});
