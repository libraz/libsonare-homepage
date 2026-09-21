import {
  durationCode,
  midiToVexKey,
  PHRASE_BEATS,
  PHRASE_BEATS_PER_BAR,
  PHRASE_VOICES,
  timedNotes,
} from './midiPhrase';

interface PlacedNote {
  x: number;
  y: number;
  startBeat: number;
  durBeat: number;
}

export interface ScoreStaffMark {
  el: SVGGElement;
  notes: PlacedNote[];
}

const INK = '#26211a';
const STAFF_INK = '#6c6353';
const HILITE = '#b07410';
const SVG_NS = 'http://www.w3.org/2000/svg';
const STAFF_CLEFS = ['treble', 'bass'] as const;

export async function renderScoreEngraving(target: HTMLDivElement): Promise<ScoreStaffMark[]> {
  target.replaceChildren();

  const VF = await import('vexflow');
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await Promise.all([
      document.fonts.load('30pt Bravura'),
      document.fonts.load('30pt Academico'),
    ]).catch(() => undefined);
  }

  const TIME = '4/4';
  const TOP_TREBLE = 24;
  const TOP_BASS = 104;
  const HEIGHT = 230;
  const LEFT = 30;
  const RIGHT = 18;
  const RIGHT_PAD = 22;
  const BASE_WIDTH = 500;

  const ink = { fillStyle: INK, strokeStyle: INK };
  const staffInk = { fillStyle: INK, strokeStyle: STAFF_INK };
  const STEM = { up: VF.Stem.UP, down: VF.Stem.DOWN } as const;
  const barlinedStaves = new Set<number>();

  const voiceBuilds = PHRASE_VOICES.map((phraseVoice) => {
    const staveIndex = STAFF_CLEFS.indexOf(phraseVoice.clef);
    const wantBarlines = !barlinedStaves.has(staveIndex);
    barlinedStaves.add(staveIndex);
    const events = timedNotes(phraseVoice);
    const staveNotes: InstanceType<typeof VF.StaveNote>[] = [];
    const tickables: InstanceType<typeof VF.Note>[] = [];
    let beat = 0;

    for (const [midi, durBeat] of phraseVoice.notes) {
      if (wantBarlines && beat > 0 && beat % PHRASE_BEATS_PER_BAR === 0) {
        tickables.push(new VF.BarNote());
      }
      const note = new VF.StaveNote({
        clef: phraseVoice.clef,
        keys: [midiToVexKey(midi)],
        duration: durationCode(durBeat),
        autoStem: phraseVoice.stem === 'auto',
      });
      if (phraseVoice.stem !== 'auto') note.setStemDirection(STEM[phraseVoice.stem]);
      note.setStyle(ink);
      staveNotes.push(note);
      tickables.push(note);
      beat += durBeat;
    }
    if (wantBarlines) tickables.push(new VF.BarNote(VF.Barline.type.SINGLE));

    const vfVoice = new VF.Voice({ numBeats: PHRASE_BEATS, beatValue: 4 });
    vfVoice.setMode(VF.VoiceMode.SOFT).addTickables(tickables);
    return { staveIndex, staveNotes, vfVoice, events };
  });

  const allVoices = voiceBuilds.map((build) => build.vfVoice);
  const formatter = new VF.Formatter();
  for (let staff = 0; staff < STAFF_CLEFS.length; staff++) {
    const staffVoices = voiceBuilds
      .filter((build) => build.staveIndex === staff)
      .map((build) => build.vfVoice);
    if (staffVoices.length) formatter.joinVoices(staffVoices);
  }

  const probe = new VF.Stave(0, 0, 200);
  probe.addClef('treble');
  probe.addTimeSignature(TIME);
  const modifierWidth = probe.getNoteStartX() - probe.getX();
  const minNoteWidth = formatter.preCalculateMinTotalWidth(allVoices);
  const staveWidth = Math.max(
    BASE_WIDTH - LEFT - RIGHT,
    Math.ceil(modifierWidth + minNoteWidth + RIGHT_PAD),
  );
  const renderWidth = LEFT + staveWidth + RIGHT;

  const renderer = new VF.Renderer(target, VF.Renderer.Backends.SVG);
  renderer.resize(renderWidth, HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle(INK);
  context.setStrokeStyle(INK);

  const tops = [TOP_TREBLE, TOP_BASS];
  const staves = STAFF_CLEFS.map((clef, i) => {
    const stave = new VF.Stave(LEFT, tops[i], staveWidth);
    stave.addClef(clef);
    stave.addTimeSignature(TIME);
    stave.setEndBarType(VF.Barline.type.END);
    stave.setStyle(staffInk);
    stave.setContext(context).draw();
    return stave;
  });

  for (const type of [VF.StaveConnector.type.BRACE, VF.StaveConnector.type.SINGLE_LEFT]) {
    const connector = new VF.StaveConnector(staves[0], staves[1]);
    connector.setType(type);
    connector.setStyle(ink);
    connector.setContext(context).draw();
  }

  const noteArea = Math.min(...staves.map((stave) => stave.getNoteEndX() - stave.getNoteStartX()));
  formatter.format(allVoices, noteArea - RIGHT_PAD);
  for (const build of voiceBuilds) build.vfVoice.draw(context, staves[build.staveIndex]);

  for (const build of voiceBuilds) {
    for (const beam of VF.Beam.generateBeams(build.staveNotes, { maintainStemDirections: true })) {
      beam.setStyle(ink);
      beam.setContext(context).draw();
    }
  }

  const svg = target.querySelector('svg');
  if (!svg) return [];
  fitViewBox(svg, staves, voiceBuilds, renderWidth);

  return voiceBuilds.map((build) => {
    const placed: PlacedNote[] = build.staveNotes.map((note, index) => ({
      x: note.getAbsoluteX() + 6,
      y: note.getYs()[0],
      startBeat: build.events[index].startBeat,
      durBeat: build.events[index].durBeat,
    }));
    const mark = createHighlightMark();
    svg.appendChild(mark);
    return { el: mark, notes: placed };
  });
}

export function updateScoreHighlight(
  marks: ScoreStaffMark[],
  options: { playing: boolean; progress: number; duration: number; tempo: number },
): void {
  if (!marks.length) return;
  if (!options.playing) {
    for (const mark of marks) mark.el.style.visibility = 'hidden';
    return;
  }

  const beat = options.progress * options.duration * (options.tempo / 60);
  for (const mark of marks) {
    const note = mark.notes.find((n) => n.startBeat <= beat && beat < n.startBeat + n.durBeat);
    if (note) {
      mark.el.setAttribute('transform', `translate(${note.x} ${note.y})`);
      mark.el.style.visibility = 'visible';
    } else {
      mark.el.style.visibility = 'hidden';
    }
  }
}

function fitViewBox(
  svg: SVGSVGElement,
  staves: Array<{
    getYForLine(line: number): number;
  }>,
  voiceBuilds: Array<{ staveNotes: Array<{ getYs(): number[] }> }>,
  renderWidth: number,
): void {
  let cTop = Math.min(...staves.map((stave) => stave.getYForLine(0)));
  let cBot = Math.max(...staves.map((stave) => stave.getYForLine(4)));
  for (const build of voiceBuilds) {
    for (const note of build.staveNotes) {
      for (const y of note.getYs()) {
        cTop = Math.min(cTop, y);
        cBot = Math.max(cBot, y);
      }
    }
  }
  const pad = 16;
  svg.setAttribute('viewBox', `0 ${cTop - pad} ${renderWidth} ${cBot - cTop + pad * 2}`);
  svg.style.width = '';
  svg.style.height = '';
}

function createHighlightMark(): SVGGElement {
  const mark = document.createElementNS(SVG_NS, 'g');
  mark.style.visibility = 'hidden';
  const glow = document.createElementNS(SVG_NS, 'circle');
  glow.setAttribute('class', 'sc-glow');
  glow.setAttribute('r', '15');
  glow.setAttribute('fill', 'rgba(200, 138, 30, 0.16)');
  const halo = document.createElementNS(SVG_NS, 'circle');
  halo.setAttribute('r', '10.5');
  halo.setAttribute('fill', 'rgba(214, 158, 54, 0.22)');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('r', '9.5');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', HILITE);
  ring.setAttribute('stroke-width', '1.6');
  mark.appendChild(glow);
  mark.appendChild(halo);
  mark.appendChild(ring);
  return mark;
}
