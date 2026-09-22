import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StepBassViews from '@/demos/step-bass/StepBassViews.vue';
import StepGrid from '@/demos/step-bass/StepGrid.vue';
import * as stepBassCopy from '@/demos/step-bass/stepBassCopy';
import { enCopy, jaCopy, SILKSCREEN } from '@/demos/step-bass/stepBassCopy';
import { STEP_COUNT } from '@/demos/step-bass/stepBassPatch';
import type { Step } from '@/demos/step-bass/stepBassTypes';
import { DESIGNATION_SHAPE } from '../../../scripts/check-terms.mjs';

const lang = { value: 'en-US' };
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

const root = join(__dirname, '../../..');
const styles = readFileSync(join(root, 'src/demos/step-bass/stepBass.css'), 'utf8');

/** Every string the module exports, whatever it is nested inside. */
function collectStrings(value: unknown, path: string, into: [string, string][]): void {
  if (typeof value === 'string') into.push([path, value]);
  else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStrings(item, `${path}[${index}]`, into);
    });
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value))
      collectStrings(nested, `${path}.${key}`, into);
  }
}

/**
 * The same structural test `check-terms.mjs` runs over doc prose: a letter
 * cluster bound to a number, with a capital in the cluster. That script only
 * reads markdown, so the panel's own strings are swept here instead.
 */
function designationsIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DESIGNATION_SHAPE)) {
    const cluster = match[1] ?? match[3];
    if (/[A-Z]/.test(cluster)) found.push(match[0]);
  }
  return found;
}

function allStrings(): [string, string][] {
  const strings: [string, string][] = [];
  collectStrings(stepBassCopy, 'stepBassCopy', strings);
  return strings;
}

/** Key paths of an object, so two locales can be compared by shape. */
function keyPaths(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [path];
  return Object.entries(value).flatMap(([key, nested]) => keyPaths(nested, `${path}.${key}`));
}

function stepsOf(overrides: Partial<Record<number, Partial<Step>>> = {}): Step[] {
  return Array.from({ length: STEP_COUNT }, (_, index) => ({
    gate: 'note' as const,
    note: 36,
    accent: false,
    slide: false,
    ...(overrides[index] ?? {}),
  }));
}

/** jsdom carries neither of these, and every mount below reaches for both. */
function stubBrowserMedia(reduce = false, wide = true): void {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
      return {
        observe: vi.fn(() => callback([], {} as ResizeObserver)),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    }),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion')
        ? reduce
        : query.includes('min-width')
          ? wide
          : !wide,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function mountGrid(steps: Step[], folded = false) {
  return mount(StepGrid, {
    props: { steps, copy: enCopy, playhead: -1, folded },
  });
}

// A live scope keeps an animation loop running, and a leaked one would answer
// the next test's frame-count question for it.
enableAutoUnmount(afterEach);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('step bass copy', () => {
  it('carries no string shaped like a model designation', () => {
    const offenders = allStrings().flatMap(([path, text]) =>
      designationsIn(text).map((hit) => `${path}: ${hit}`),
    );
    expect(offenders).toEqual([]);
  });

  it('sweeps both locales and the silkscreen, not one of them', () => {
    const paths = allStrings().map(([path]) => path);
    expect(paths.some((path) => path.startsWith('stepBassCopy.enCopy.'))).toBe(true);
    expect(paths.some((path) => path.startsWith('stepBassCopy.jaCopy.'))).toBe(true);
    expect(paths.some((path) => path.startsWith('stepBassCopy.SILKSCREEN.'))).toBe(true);
  });

  it('has teeth: the shape catches a designation and clears the instrument name', () => {
    expect(designationsIn('SB-16 on the bench')).toEqual(['SB-16']);
    expect(designationsIn(SILKSCREEN.designation)).toEqual([]);
  });

  it('prints the panel legends in Latin script in every locale', () => {
    for (const legend of Object.values(SILKSCREEN)) {
      expect(legend, legend).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('gives the two locales the same shape', () => {
    expect(keyPaths(jaCopy)).toEqual(keyPaths(enCopy));
  });
});

describe('step grid', () => {
  it('folds into two banks of eight, so sixteen cells across are never asked for', () => {
    const wide = mountGrid(stepsOf());
    expect(wide.findAll('[role="grid"]')).toHaveLength(1);
    expect(wide.findAll('.step-grid__row--ruler [role="columnheader"]')).toHaveLength(
      STEP_COUNT + 1,
    );

    const narrow = mountGrid(stepsOf(), true);
    const banks = narrow.findAll('[role="grid"]');
    expect(banks).toHaveLength(2);
    for (const bank of banks) {
      expect(bank.findAll('.step-grid__row--ruler [role="columnheader"]')).toHaveLength(
        STEP_COUNT / 2 + 1,
      );
    }
  });

  it('keeps touch-action on the drag target alone, so the page still scrolls', () => {
    const selectors = styles
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .filter((rule) => rule.includes('touch-action'))
      .map((rule) => rule.split('{')[0].trim());
    expect(selectors).toEqual(['.step-grid__button--note']);
  });

  it('reads an accent as unavailable on a hold and on a rest', () => {
    const wrapper = mountGrid(stepsOf({ 1: { gate: 'tie' }, 2: { gate: 'rest' } }));
    const accents = wrapper.findAll('.step-grid__row')[3].findAll('button');
    for (const index of [1, 2]) {
      expect(accents[index].attributes('aria-disabled')).toBe('true');
      expect(accents[index].attributes('aria-label')).toContain(enCopy.grid.unavailable);
    }
    expect(accents[0].attributes('aria-disabled')).toBeUndefined();
  });

  it('marks the last step as pitch only and says why', async () => {
    const wrapper = mountGrid(stepsOf({ [STEP_COUNT - 1]: { slide: true } }));
    const slides = wrapper.findAll('.step-grid__row')[4].findAll('button');
    expect(slides[STEP_COUNT - 1].attributes('aria-label')).toContain(enCopy.grid.pitchOnlyBadge);

    await slides[STEP_COUNT - 1].trigger('click');
    expect(wrapper.find('.step-grid__badge').text()).toBe(enCopy.grid.pitchOnlyBadge);
    expect(wrapper.text()).toContain(enCopy.grid.slidePitchOnly);
  });

  it('gives the sixty-four cells one tab stop and a two-dimensional cursor', async () => {
    const wrapper = mountGrid(stepsOf());
    const cells = wrapper.findAll('[tabindex]');
    expect(cells).toHaveLength(STEP_COUNT * 4);
    expect(cells.filter((cell) => cell.attributes('tabindex') === '0')).toHaveLength(1);

    await cells[0].trigger('keydown', { key: 'ArrowRight' });
    await cells[1].trigger('keydown', { key: 'ArrowDown' });
    const moved = wrapper.findAll('[tabindex]').findIndex((c) => c.attributes('tabindex') === '0');
    expect(moved).toBe(STEP_COUNT + 1);
  });
});

describe('step bass displays', () => {
  function mountViews(wide: boolean) {
    stubBrowserMedia(false, wide);
    return mount(StepBassViews, {
      props: {
        copy: enCopy,
        analyser: null,
        cutoffHz: 700,
        resonanceQ: 6.4,
        envModCents: 2400,
        waveform: 'saw',
        peak: 0.5,
        bpm: 120,
        playhead: -1,
        patternName: 'Root Walk',
        sampleRate: 48_000,
        wide,
      },
    });
  }

  it('calls the filter plot a measured response rather than the cutoff reading', () => {
    const wrapper = mountViews(true);
    expect(wrapper.text()).toContain(enCopy.views.filter.caption);
    expect(wrapper.findAll('.step-views__panel')).toHaveLength(3);
  });

  it('shows peak and no gain reduction', () => {
    const wrapper = mountViews(true);
    expect(wrapper.find('[role="meter"]').attributes('aria-label')).toBe(SILKSCREEN.peak);
    expect(wrapper.findAll('[role="meter"]')).toHaveLength(1);
  });

  it('switches one display at a time below the wide breakpoint, in equal segments', () => {
    const wrapper = mountViews(false);
    const buttons = wrapper.findAll('.step-views__switch-button');
    expect(buttons).toHaveLength(3);
    expect(wrapper.findAll('.step-views__panel')).toHaveLength(1);
    expect(styles).toMatch(/\.step-views__switch-button\s*\{[^}]*flex:\s*1 1 0/);
  });
});

describe('step bass motion', () => {
  // A component that reads the preference once, at module scope, has to be
  // loaded after the stub is in place for the reading to be the stubbed one.
  async function mountDemo() {
    vi.resetModules();
    const StepBassDemo = (await import('@/demos/step-bass/StepBassDemo.vue')).default;
    return mount(StepBassDemo, {
      global: {
        stubs: { ToolShell: { template: '<div><slot name="statusbar" /><slot /></div>' } },
      },
    });
  }

  it('runs no animation frame under a reduced-motion preference', async () => {
    stubBrowserMedia(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const wrapper = await mountDemo();
    expect(raf).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('runs the playhead loop when motion is allowed', async () => {
    stubBrowserMedia(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const wrapper = await mountDemo();
    expect(raf).toHaveBeenCalled();
    wrapper.unmount();
  });
});
