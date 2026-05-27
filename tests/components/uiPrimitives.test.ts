import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CornerBrackets from '@/components/ui/CornerBrackets.vue';
import GridOverlay from '@/components/ui/GridOverlay.vue';
import MetricItem from '@/components/ui/MetricItem.vue';
import ScanLine from '@/components/ui/ScanLine.vue';
import StatusIndicator from '@/components/ui/StatusIndicator.vue';
import TechPanel from '@/components/ui/TechPanel.vue';
import TermLabel from '@/components/ui/TermLabel.vue';
import Tooltip from '@/components/ui/Tooltip.vue';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Tooltip', () => {
  function rect(left: number, top: number, width: number, height: number) {
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    };
  }

  it('opens on hover after delay, positions content and closes on Escape', async () => {
    vi.useFakeTimers();
    const wrapper = mount(Tooltip, {
      attachTo: document.body,
      props: {
        eyebrow: 'TERM',
        title: 'Loudness',
        body: 'Integrated level.',
        tip: 'Compare at matched loudness.',
        tipLabel: 'Tip',
        defaultValue: '-14 LUFS',
        defaultRationale: 'Streaming baseline',
        defaultLabel: 'Default',
        href: '/docs/loudness',
        linkLabel: 'Docs',
        maxWidth: 320,
      },
      slots: { default: '<button>Info</button>' },
    });
    vi.spyOn(wrapper.find('.tt-trigger').element, 'getBoundingClientRect').mockReturnValue(
      rect(100, 300, 40, 20),
    );

    await wrapper.find('.tt-trigger').trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(79);
    expect(document.body.querySelector('.tt-popover')).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    const popover = document.body.querySelector('.tt-popover') as HTMLElement;
    expect(popover).toBeTruthy();
    vi.spyOn(popover, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 200, 120));
    window.dispatchEvent(new Event('resize'));
    await flushPromises();

    expect(popover.textContent).toContain('Loudness');
    expect(popover.textContent).toContain('Integrated level.');
    expect(popover.textContent).toContain('-14 LUFS');
    expect(popover.querySelector('a')?.getAttribute('href')).toBe('/docs/loudness');
    expect(popover.getAttribute('style')).toContain('--tt-max-width: 320px');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(document.body.querySelector('.tt-popover')).toBeNull();
  });

  it('toggles immediately on click and honors explicit bottom placement', async () => {
    const wrapper = mount(Tooltip, {
      attachTo: document.body,
      props: {
        title: 'Pan',
        placement: 'bottom',
      },
      slots: { default: '<button>Pan</button>' },
    });
    vi.spyOn(wrapper.find('.tt-trigger').element, 'getBoundingClientRect').mockReturnValue(
      rect(50, 50, 20, 20),
    );

    await wrapper.find('.tt-trigger').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('.tt-popover--bottom')).toBeTruthy();

    await wrapper.find('.tt-trigger').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('.tt-popover')).toBeNull();
  });

  it('delays close on mouseleave and can cancel the pending hide from the popover', async () => {
    vi.useFakeTimers();
    const wrapper = mount(Tooltip, {
      attachTo: document.body,
      props: { title: 'Width' },
      slots: { default: '<button>Width</button>' },
    });

    await wrapper.find('.tt-trigger').trigger('click');
    await flushPromises();
    const popover = document.body.querySelector('.tt-popover') as HTMLElement;
    expect(popover).toBeTruthy();

    await wrapper.find('.tt-trigger').trigger('mouseleave');
    await popover.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(120);
    expect(document.body.querySelector('.tt-popover')).toBeTruthy();

    await popover.dispatchEvent(new Event('mouseleave'));
    await vi.advanceTimersByTimeAsync(100);
    expect(document.body.querySelector('.tt-popover')).toBeNull();
  });
});

describe('shared UI primitives', () => {
  it('renders MetricItem variants, slots and fallback values', () => {
    const wrapper = mount(MetricItem, {
      props: { label: 'Peak', variant: 'success', layout: 'column' },
      slots: {
        label: 'True Peak',
        default: '-1.0 dB',
      },
    });
    expect(wrapper.classes()).toContain('metric-item--column');
    expect(wrapper.find('.metric-item__label').text()).toBe('True Peak');
    expect(wrapper.find('.metric-item__value').classes()).toContain('metric-item__value--success');
    expect(wrapper.find('.metric-item__value').text()).toBe('-1.0 dB');

    const fallback = mount(MetricItem);
    expect(fallback.find('.metric-item__value').text()).toBe('-');
  });

  it('renders StatusIndicator classes, label and slot content', () => {
    const wrapper = mount(StatusIndicator, {
      props: { status: 'warning', label: 'Rendering', pulse: true },
      slots: { default: '<strong>extra</strong>' },
    });
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['status-indicator--warning', 'status-indicator--pulse']),
    );
    expect(wrapper.text()).toContain('Rendering');
    expect(wrapper.text()).toContain('extra');
  });

  it('renders TechPanel header, header-right, body, footer and transparent variant', () => {
    const wrapper = mount(TechPanel, {
      props: { title: 'Meters', variant: 'transparent' },
      slots: {
        'header-right': '<button>R</button>',
        default: '<p>Body</p>',
        footer: '<small>Footer</small>',
      },
    });
    expect(wrapper.classes()).toContain('tech-panel--transparent');
    expect(wrapper.find('.tech-panel__title').text()).toBe('Meters');
    expect(wrapper.find('.tech-panel__header').text()).toContain('R');
    expect(wrapper.find('.tech-panel__body').text()).toBe('Body');
    expect(wrapper.find('.tech-panel__footer').text()).toBe('Footer');
  });

  it('renders scan line, grid overlay and corner bracket visual classes/styles', () => {
    const scan = mount(ScanLine, {
      props: { active: true, duration: 4, color: '#f00' },
    });
    expect(scan.classes()).toContain('scan-line--active');
    expect(scan.attributes('style')).toContain('--scan-duration: 4s');
    expect(scan.attributes('style')).toContain('--scan-color: #f00');

    const grid = mount(GridOverlay, {
      props: { variant: 'dense', color: '#0ff', scanlines: true },
    });
    expect(grid.classes()).toContain('grid-overlay--dense');
    expect(grid.classes()).toContain('grid-overlay--scanlines');
    expect(grid.find('.grid-overlay__grid').attributes('style')).toContain('--grid-color: #0ff');
    expect(grid.find('.grid-overlay__scanlines').exists()).toBe(true);

    const corners = mount(CornerBrackets, {
      props: { size: 'lg', offset: 'sm', color: '#fff' },
    });
    expect(corners.classes()).toContain('corner-brackets--lg');
    expect(corners.classes()).toContain('corner-brackets--offset-sm');
    expect(corners.findAll('.corner-brackets__bracket')).toHaveLength(4);
    expect(corners.find('.corner-brackets__bracket').attributes('style')).toContain(
      'border-color:',
    );
  });

  it('wraps labels with Tooltip through TermLabel and supports compact mode', async () => {
    vi.useFakeTimers();
    const wrapper = mount(TermLabel, {
      attachTo: document.body,
      props: {
        label: 'LUFS',
        title: 'Integrated LUFS',
        body: 'Perceived loudness.',
        href: '/docs/lufs',
        compact: true,
        tone: 'strong',
        mono: false,
      },
    });

    expect(wrapper.find('.term-label').classes()).toContain('term-label--strong');
    expect(wrapper.find('.term-label').classes()).not.toContain('term-label--mono');
    expect(wrapper.find('.term-label__dot').exists()).toBe(false);

    await wrapper.find('.tt-trigger').trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(80);
    await flushPromises();
    expect(document.body.querySelector('.tt-popover')?.textContent).toContain('Integrated LUFS');
    expect(document.body.querySelector('.tt-popover a')?.getAttribute('href')).toBe('/docs/lufs');
  });
});
