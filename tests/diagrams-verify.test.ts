import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FlowDiagram from '../.vitepress/theme/components/diagrams/FlowDiagram.vue';
import SequenceDiagram from '../.vitepress/theme/components/diagrams/SequenceDiagram.vue';

describe('FlowDiagram', () => {
  it('renders LR flow with groups, decision, dashed error edge', () => {
    const w = mount(FlowDiagram, {
      props: {
        title: 'Decode pipeline',
        direction: 'LR' as const,
        nodes: [
          { id: 'in', label: 'AudioBuffer', col: 0, row: 0 },
          { id: 'chk', label: 'Format OK?', col: 1, row: 0, variant: 'decision' as const },
          {
            id: 'dec',
            label: 'decode()',
            col: 2,
            row: 0,
            variant: 'accent' as const,
            group: 'wasm',
          },
          { id: 'err', label: 'throw', col: 2, row: 1, variant: 'error' as const },
          { id: 'out', label: 'PCM', col: 3, row: 0, variant: 'success' as const, group: 'wasm' },
        ],
        edges: [
          { from: 'in', to: 'chk' },
          { from: 'chk', to: 'dec', label: 'yes' },
          { from: 'chk', to: 'err', label: 'no', style: 'dashed' as const },
          { from: 'dec', to: 'out' },
          { from: 'out', to: 'in', label: 'next chunk' },
        ],
        groups: [{ id: 'wasm', label: 'WASM heap' }],
        caption: 'Test caption',
      },
    });
    const svg = w.find('svg');
    expect(svg.exists()).toBe(true);
    const vb = (svg.attributes('viewBox') ?? '').split(' ').map(Number);
    expect(vb).toHaveLength(4);
    for (const v of vb) expect(Number.isFinite(v)).toBe(true);
    expect(vb[2]).toBeGreaterThan(100);
    expect(vb[3]).toBeGreaterThan(50);
    expect(w.findAll('rect.fd-node')).toHaveLength(5);
    expect(w.findAll('path.fd-edge')).toHaveLength(5);
    expect(w.findAll('rect.fd-group')).toHaveLength(1);
    expect(w.findAll('.fd-edge--dashed')).toHaveLength(1);
    expect(w.find('.doc-diagram-head').text()).toBe('Decode pipeline');
    expect(w.find('.doc-diagram-caption').text()).toBe('Test caption');
    // No NaN anywhere in the generated markup.
    expect(w.html()).not.toContain('NaN');
  });

  it('renders TB flow and Japanese labels', () => {
    const w = mount(FlowDiagram, {
      props: {
        direction: 'TB' as const,
        nodes: [
          { id: 'a', label: '入力バッファ', col: 0, row: 0 },
          { id: 'b', label: '解析', col: 0, row: 1 },
          { id: 'c', label: 'ミキサー', col: 1, row: 1, variant: 'muted' as const },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
        ],
      },
    });
    expect(w.findAll('rect.fd-node')).toHaveLength(3);
    expect(w.html()).not.toContain('NaN');
  });
});

describe('SequenceDiagram', () => {
  it('renders participants, loop frame, self message, dashed return', () => {
    const w = mount(SequenceDiagram, {
      props: {
        title: 'Streaming loop',
        participants: [
          { id: 'app', label: 'App' },
          { id: 'worker', label: 'Worker' },
          { id: 'wasm', label: 'WASM' },
        ],
        messages: [
          { from: 'app', to: 'worker', label: 'init()' },
          { from: 'worker', to: 'wasm', label: 'pushChunk()', loop: 'each frame' },
          { from: 'wasm', to: 'wasm', label: 'analyze', loop: 'each frame' },
          {
            from: 'wasm',
            to: 'worker',
            label: 'result',
            type: 'return' as const,
            loop: 'each frame',
          },
          { from: 'worker', to: 'app', label: 'done', type: 'async' as const },
        ],
        caption: 'cap',
      },
    });
    const svg = w.find('svg');
    const vb = (svg.attributes('viewBox') ?? '').split(' ').map(Number);
    for (const v of vb) expect(Number.isFinite(v)).toBe(true);
    expect(w.findAll('rect.sd-part')).toHaveLength(3);
    expect(w.findAll('line.sd-lifeline')).toHaveLength(3);
    expect(w.findAll('path.sd-msg')).toHaveLength(5);
    expect(w.findAll('rect.sd-loop')).toHaveLength(1);
    expect(w.findAll('.sd-msg--dashed')).toHaveLength(2);
    expect(w.find('.sd-loop-label').text()).toContain('LOOP');
    expect(w.html()).not.toContain('NaN');
  });
});
