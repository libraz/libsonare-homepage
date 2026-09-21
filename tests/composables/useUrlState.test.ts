import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useUrlState } from '@/composables/useUrlState';

describe('useUrlState', () => {
  it('reads, writes, clears and responds to history changes', async () => {
    window.history.replaceState({}, '', '/mastering?mode=studio#demo');
    const mode = ref<'quick' | 'studio'>('quick');
    const url = useUrlState([
      {
        key: 'mode',
        state: mode,
        defaultValue: 'quick' as const,
        parse: (raw: string) => (raw === 'studio' || raw === 'quick' ? raw : null),
      },
    ]);

    url.applyFromUrl();
    expect(mode.value).toBe('studio');

    url.replaceInUrl();
    expect(window.location.search).toBe('?mode=studio');

    url.enable();
    await nextTick();
    mode.value = 'quick';
    await nextTick();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#demo');

    mode.value = 'studio';
    await nextTick();
    expect(window.location.search).toBe('?mode=studio');

    window.history.pushState({}, '', '/mastering');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(mode.value).toBe('quick');
    url.disable();

    mode.value = 'studio';
    await nextTick();
    expect(window.location.search).toBe('');
  });

  it('carries several parameters of different types in one query string', async () => {
    window.history.replaceState({}, '', '/demo?program=25&bank=gs&other=keep');
    const program = ref(0);
    const bank = ref<'gm' | 'gs'>('gm');
    const url = useUrlState([
      {
        key: 'program',
        state: program,
        defaultValue: 0,
        parse: (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null),
      },
      {
        key: 'bank',
        state: bank,
        defaultValue: 'gm' as const,
        parse: (raw: string) => (raw === 'gm' || raw === 'gs' ? raw : null),
      },
    ]);

    url.applyFromUrl();
    expect(program.value).toBe(25);
    expect(bank.value).toBe('gs');

    url.enable();
    await nextTick();
    program.value = 0;
    bank.value = 'gm';
    await nextTick();

    // Defaults leave no trace, and a parameter this composable does not own survives.
    const params = new URLSearchParams(window.location.search);
    expect(params.get('program')).toBeNull();
    expect(params.get('bank')).toBeNull();
    expect(params.get('other')).toBe('keep');
    url.disable();
  });

  it('keeps the current state when the URL carries a value it cannot parse', () => {
    window.history.replaceState({}, '', '/demo?mode=nonsense');
    const mode = ref<'quick' | 'studio'>('studio');
    const url = useUrlState([
      {
        key: 'mode',
        state: mode,
        defaultValue: 'quick' as const,
        parse: (raw: string) => (raw === 'studio' || raw === 'quick' ? raw : null),
      },
    ]);

    url.applyFromUrl();
    expect(mode.value).toBe('studio');
  });
});
