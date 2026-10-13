import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DemoDisclaimer from '@/components/DemoDisclaimer.vue';
import DemoLoadPending from '@/components/DemoLoadPending.vue';
import DemoEmpty from '@/components/ui/DemoEmpty.vue';
import DemoNotice from '@/components/ui/DemoNotice.vue';
import InfoDot from '@/components/ui/InfoDot.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'ja' } }) }));

afterEach(() => {
  document.body.replaceChildren();
});

const OPTIONS = [
  { id: 'quick', label: 'Quick' },
  { id: 'studio', label: 'Studio' },
  { id: 'locked', label: 'Locked', disabled: true },
  { id: 'reference', label: 'Reference' },
];

describe('SegmentedControl', () => {
  it('exposes a radiogroup with one checked radio in the tab order', () => {
    const wrapper = mount(SegmentedControl, {
      props: { modelValue: 'studio', options: OPTIONS, ariaLabel: 'Mode' },
    });
    const group = wrapper.find('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('Mode');
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
    expect(radios.every((r) => r.attributes('type') === 'button')).toBe(true);
  });

  it('fills the row by default from three options and stays inline for two', () => {
    const three = mount(SegmentedControl, {
      props: { modelValue: 'quick', options: OPTIONS, ariaLabel: 'Mode' },
    });
    expect(three.classes()).toContain('segmented--fill');
    expect(three.attributes('style')).toContain('--seg-count: 4');
    expect(three.attributes('style')).toContain('--seg-index: 0');

    const two = mount(SegmentedControl, {
      props: { modelValue: 'quick', options: OPTIONS.slice(0, 2), ariaLabel: 'Mode' },
    });
    expect(two.classes()).not.toContain('segmented--fill');
  });

  it('emits the clicked id and ignores the already-selected one', async () => {
    const wrapper = mount(SegmentedControl, {
      props: { modelValue: 'quick', options: OPTIONS, ariaLabel: 'Mode' },
    });
    const radios = wrapper.findAll('[role="radio"]');
    await radios[0].trigger('click');
    await radios[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['studio']]);
  });

  it('moves selection and focus with arrow keys, skipping disabled options and wrapping', async () => {
    const wrapper = mount(SegmentedControl, {
      attachTo: document.body,
      props: { modelValue: 'studio', options: OPTIONS, ariaLabel: 'Mode' },
    });
    const radios = wrapper.findAll('[role="radio"]');

    await radios[1].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['reference']);
    expect(document.activeElement).toBe(radios[3].element);

    await radios[3].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['quick']);

    await radios[0].trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['reference']);

    await radios[1].trigger('keydown', { key: 'Home' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['quick']);
  });
});

describe('DemoNotice', () => {
  it.each([
    ['error', 'alert'],
    ['warn', 'status'],
    ['info', 'status'],
    ['success', 'status'],
  ] as const)('announces tone %s with role %s', (tone, role) => {
    const wrapper = mount(DemoNotice, { props: { tone }, slots: { default: 'Body' } });
    const notice = wrapper.find('.demo-notice');
    expect(notice.attributes('role')).toBe(role);
    expect(notice.classes()).toContain(`demo-notice--${tone}`);
  });

  it('leaves a hint as static help with title, body and action slot', () => {
    const wrapper = mount(DemoNotice, {
      props: { tone: 'hint', title: 'Tip' },
      slots: { default: 'Drop a file first.', action: '<button>Load</button>' },
    });
    const notice = wrapper.find('.demo-notice');
    expect(notice.attributes('role')).toBeUndefined();
    expect(wrapper.find('.demo-notice__title').text()).toBe('Tip');
    expect(wrapper.find('.demo-notice__text').text()).toBe('Drop a file first.');
    expect(wrapper.find('.demo-notice__action button').text()).toBe('Load');
    expect(wrapper.find('.demo-notice__dismiss').exists()).toBe(false);
  });

  it('emits dismiss from a localized close button', async () => {
    const wrapper = mount(DemoNotice, {
      props: { tone: 'warn', dismissible: true },
      slots: { default: 'Degraded.' },
    });
    const close = wrapper.find('.demo-notice__dismiss');
    expect(close.attributes('aria-label')).toBe('閉じる');
    await close.trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});

describe('InfoDot', () => {
  it('is a named button by default', () => {
    const wrapper = mount(InfoDot, { props: { label: 'About ratio' } });
    expect(wrapper.element.tagName).toBe('BUTTON');
    expect(wrapper.attributes('type')).toBe('button');
    expect(wrapper.attributes('aria-label')).toBe('About ratio');
    expect(wrapper.classes()).toContain('info-dot--md');
  });

  it('renders a hidden, unfocusable mark when decorative', () => {
    const wrapper = mount(InfoDot, { props: { decorative: true, size: 'sm' } });
    expect(wrapper.element.tagName).toBe('SPAN');
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('tabindex')).toBeUndefined();
    expect(wrapper.classes()).toContain('info-dot--sm');
  });
});

describe('DemoEmpty', () => {
  it('renders title, body and action slots', () => {
    const wrapper = mount(DemoEmpty, {
      props: { title: 'No analysis yet', compact: true },
      slots: { default: 'Load a clip.', action: '<button>Load demo</button>' },
    });
    expect(wrapper.classes()).toContain('demo-empty--compact');
    expect(wrapper.find('.demo-empty__title').text()).toBe('No analysis yet');
    expect(wrapper.find('.demo-empty__body').text()).toBe('Load a clip.');
    expect(wrapper.find('.demo-empty__action button').exists()).toBe(true);
  });
});

describe('DemoDisclaimer', () => {
  it('focuses the confirm button on open, closes on Escape and returns focus', async () => {
    localStorage.setItem('libsonare-demo-disclaimer-v2', '1');
    const wrapper = mount(DemoDisclaimer, { attachTo: document.body });
    const reopen = wrapper.find('.demo-disclaimer__reopen');
    (reopen.element as HTMLElement).focus();
    await reopen.trigger('click');
    await flushPromises();

    const confirm = document.body.querySelector('.demo-disclaimer__confirm');
    expect(document.activeElement).toBe(confirm);

    document.body
      .querySelector('.demo-disclaimer__overlay')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.body.querySelector('.demo-disclaimer__overlay')).toBeNull();
    expect(document.activeElement).toBe(reopen.element);
    wrapper.unmount();
  });
});

describe('DemoLoadPending', () => {
  it('labels the loader in the page language', () => {
    document.documentElement.lang = 'ja';
    const wrapper = mount(DemoLoadPending);
    expect(wrapper.find('.signal-loader__stage').text()).toBe('デモを読み込み中…');
    expect(wrapper.attributes('role')).toBe('status');
    document.documentElement.lang = '';
  });
});
