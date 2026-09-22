import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FlowDiagram from '../.vitepress/theme/components/diagrams/FlowDiagram.vue';

/**
 * Geometry gate for the flow figures: an edge that runs across a box, or a
 * label that lands on one, is unreadable on the page, so every diagram the
 * docs actually carry is laid out here and checked point by point.
 */

const SRC = join(process.cwd(), 'src');

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...mdFiles(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function attr(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`${name}="([\\s\\S]*?)"`));
  return m?.[1];
}

/**
 * The prop arrays are authored as JS object literals inside a double-quoted
 * attribute, so quoting the keys and the single-quoted strings makes them JSON.
 */
function parseArray(src: string | undefined): unknown[] {
  if (!src) return [];
  const json = src
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s: string) => JSON.stringify(s))
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(json) as unknown[];
}

/** Every <FlowDiagram> authored in the docs tree, with its props parsed. */
function collectDiagrams() {
  const found: { file: string; props: Record<string, unknown> }[] = [];
  for (const file of mdFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/<FlowDiagram\b[\s\S]*?\/>/g)) {
      const block = m[0];
      found.push({
        file: file.slice(SRC.length + 1),
        props: {
          title: attr(block, 'title'),
          direction: attr(block, 'direction') === 'TB' ? 'TB' : 'LR',
          nodes: parseArray(attr(block, ':nodes')),
          edges: parseArray(attr(block, ':edges')),
          groups: parseArray(attr(block, ':groups')),
        },
      });
    }
  }
  return found;
}

type Pt = [number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sample the path commands the component emits (M / L / Q / C only). */
function samplePath(d: string, per = 24): Pt[] {
  const pts: Pt[] = [];
  let cur: Pt = [0, 0];
  for (const m of d.matchAll(/([MLQC])([^MLQC]*)/g)) {
    const n = (m[2].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (m[1] === 'M') {
      cur = [n[0], n[1]];
      pts.push(cur);
    } else if (m[1] === 'L') {
      const end: Pt = [n[0], n[1]];
      for (let i = 1; i <= per; i++) {
        pts.push([lerp(cur[0], end[0], i / per), lerp(cur[1], end[1], i / per)]);
      }
      cur = end;
    } else if (m[1] === 'Q') {
      const [cx, cy, ex, ey] = n;
      for (let i = 1; i <= per; i++) {
        const t = i / per;
        const u = 1 - t;
        pts.push([
          u * u * cur[0] + 2 * u * t * cx + t * t * ex,
          u * u * cur[1] + 2 * u * t * cy + t * t * ey,
        ]);
      }
      cur = [ex, ey];
    } else {
      const [x1, y1, x2, y2, ex, ey] = n;
      for (let i = 1; i <= per; i++) {
        const t = i / per;
        const u = 1 - t;
        pts.push([
          u ** 3 * cur[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * ex,
          u ** 3 * cur[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * ey,
        ]);
      }
      cur = [ex, ey];
    }
  }
  return pts;
}

/** Inset so a route that merely grazes a border is not reported. */
const INSET = 2.5;

const inside = (p: Pt, b: Box) =>
  p[0] > b.x + INSET && p[0] < b.x + b.w - INSET && p[1] > b.y + INSET && p[1] < b.y + b.h - INSET;

const overlaps = (a: Box, b: Box) =>
  a.x + a.w - INSET > b.x + INSET &&
  a.x + INSET < b.x + b.w - INSET &&
  a.y + a.h - INSET > b.y + INSET &&
  a.y + INSET < b.y + b.h - INSET;

function boxesOf(w: ReturnType<typeof mount>, selector: string): Box[] {
  return w.findAll(selector).map((el) => ({
    x: Number(el.attributes('x')),
    y: Number(el.attributes('y')),
    w: Number(el.attributes('width')),
    h: Number(el.attributes('height')),
  }));
}

describe('flow diagram geometry', () => {
  const diagrams = collectDiagrams();

  it('finds the diagrams authored in the docs', () => {
    expect(diagrams.length).toBeGreaterThan(20);
  });

  it('routes every edge clear of the boxes it does not touch', () => {
    const hits: string[] = [];
    for (const { file, props } of diagrams) {
      const w = mount(FlowDiagram, { props: props as never });
      const nodes = props.nodes as { id: string }[];
      const edges = (props.edges as { from: string; to: string }[]).filter(
        (e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to),
      );
      const boxes = boxesOf(w, 'rect.fd-node');
      const paths = w.findAll('path.fd-edge');
      expect(paths).toHaveLength(edges.length);
      paths.forEach((path, i) => {
        const ends = [edges[i].from, edges[i].to];
        for (const p of samplePath(path.attributes('d') as string)) {
          boxes.forEach((b, bi) => {
            if (ends.includes(nodes[bi].id)) return;
            if (inside(p, b)) {
              hits.push(`${file}: ${edges[i].from}->${edges[i].to} crosses ${nodes[bi].id}`);
            }
          });
        }
      });
    }
    expect([...new Set(hits)].join('\n')).toBe('');
  });

  it('keeps every edge label off the boxes', () => {
    const hits: string[] = [];
    for (const { file, props } of diagrams) {
      const w = mount(FlowDiagram, { props: props as never });
      const boxes = boxesOf(w, 'rect.fd-node');
      const nodeLabels = (props.nodes as { label: string }[]).map((n) => n.label);
      const texts = w.findAll('text.fd-edge-label').map((el) => el.text().replace(/\s+/g, ' '));
      boxesOf(w, 'rect.fd-edge-label-bg').forEach((label, li) => {
        boxes.forEach((b, bi) => {
          if (overlaps(label, b)) {
            hits.push(`${file}: label "${texts[li]}" sits on "${nodeLabels[bi]}"`);
          }
        });
      });
    }
    expect([...new Set(hits)].join('\n')).toBe('');
  });
});
