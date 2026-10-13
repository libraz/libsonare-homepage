---
title: Build Controls from Parameter Descriptors
description: Turn the engine's parameter descriptors into a control surface — pick a widget per parameter, map linear and log scales onto a slider, bound one control by another, show band groups as they come into existence, lay out the mastering chain from catalog.chain, and send the values back.
---

# Build Controls from Parameter Descriptors

Every processor the engine can build describes its own parameters: name, type, unit, default, accepted range, display range, axis, sibling constraints, and whether the value can change while audio runs. A host that reads those descriptors can draw a control surface for any insert or mastering stage without a hand-written table, and the surface follows the engine when a build adds a key or a band.

This page builds that surface step by step in plain JavaScript. The field-by-field reference is elsewhere and is linked rather than repeated: [The parameter descriptor](../effects-inserts.md#the-parameter-descriptor) for each field, [Reading a catalog bound](../mastering-processors.md#reading-a-catalog-bound) for where `min`, `max` and `default` come from, and [What the capability catalog reports](../api-surface.md#what-the-capability-catalog-reports) for the document as a whole.

Every snippet below is one script, run in Node against the shipped WASM build; the output blocks are what it printed.

## Read the descriptors

`capabilityCatalog()` returns the whole build in one call: every processor with its `params` array, plus a `chain` section for the mastering chain. `masteringInsertParamInfo(name, sampleRate?)` returns the same descriptors for one processor and can resolve a rate-dependent ceiling. A UI usually reads the catalog once at start-up.

```js
import {
  init, capabilityCatalog, masteringInsertParamInfo, masteringInsertTiming,
  masteringChain, RealtimeEngine,
} from '@libraz/libsonare';

await init();
const catalog = capabilityCatalog();
const processor = (id) => catalog.processors.find((p) => p.id === id);

const gate = processor('dynamics.gate');
for (const p of gate.params) {
  console.log(p.name.padEnd(17), p.type, p.unit, p.scale.padEnd(6),
    'min', p.min, 'max', p.max, 'ui', p.uiMin, p.uiMax, 'default', p.default,
    'rtSafe', p.rtSafe, p.dependsOn.map((d) => `${d.relation} ${d.key}`).join());
}
```

```text
thresholdDb       number dB linear min null max null ui -50 0 default -50 rtSafe true ge closeThresholdDb
attackMs          number ms log    min 0 max null ui 0.1 100 default 2 rtSafe true
releaseMs         number ms log    min 0 max null ui 0.1 2000 default 80 rtSafe true
rangeDb           number dB linear min null max 0 ui -80 0 default -80 rtSafe true
closeThresholdDb  number dB linear min null max null ui null null default -50 rtSafe false le thresholdDb
holdMs            number ms linear min 0 max null ui 0 1000 default 0 rtSafe false
keyHpfHz          number Hz linear min 0 max null ui null null default 0 rtSafe false
```

The gate shows most of what the rest of this page handles. Two kinds of range sit side by side: `min` / `max` is what construction accepts, `uiMin` / `uiMax` is what a control should draw. The attack and release times are drawn on a log axis. `closeThresholdDb` has no range of its own, only a relation to `thresholdDb`. The last three rows cannot change while audio runs.

## Choose a widget per parameter

`type` and `choices` decide the widget. A number becomes a slider only when both ends of a range are known, either from the display range or from the accepted range; otherwise it needs a numeric field.

```js
function controlKind(p) {
  if (p.type === 'boolean') return 'toggle';
  if (p.choices !== null) return 'select';   // an enum, or a number whose accepted values have gaps
  if (p.type !== 'number') return 'custom';  // 'string' / 'array': an impulse response, a per-band list
  const lo = p.uiMin ?? p.min;
  const hi = p.uiMax ?? p.max;
  return lo !== null && hi !== null ? 'slider' : 'field';
}

const kinds = {};
for (const proc of catalog.processors) {
  for (const p of proc.params) kinds[controlKind(p)] = (kinds[controlKind(p)] ?? 0) + 1;
}
console.log(kinds);
```

```text
{ slider: 1064, toggle: 1014, select: 745, field: 2751, custom: 5 }
```

The `field` count is large on purpose. Many gains and offsets have no published bound: `null` means construction does not refuse on that side, not that the limit went unmeasured ([Two things a null and a default do not tell you](../effects-inserts.md#two-things-a-null-and-a-default-do-not-tell-you)). A numeric field with the unit beside it is the honest control for those keys; a slider would need a range the engine never stated. A `select` sends the choice's numeric `value`; its `name` is the label.

## Map a slider onto the scale

`scale` is the axis: `'linear'` or `'log'`. A log slider needs a positive lower end and a finite upper end. In the current build every log-scaled descriptor publishes both, through `uiMin` / `uiMax` or through `min` / `max`; `uiMin ?? min` and `uiMax ?? max` always find them.

```js
function sliderRange(p) {
  const lo = p.uiMin ?? p.min;
  let hi = p.uiMax ?? p.max;
  // The top of the drawn range is the accepted ceiling itself, and that ceiling is refused.
  if (p.uiMax === null && p.maxExclusive) hi *= 0.999;
  return [lo, hi];
}

function toValue(p, t) {
  const [lo, hi] = sliderRange(p);
  return p.scale === 'log' ? lo * (hi / lo) ** t : lo + (hi - lo) * t;
}

function toPosition(p, value) {
  const [lo, hi] = sliderRange(p);
  const v = Math.min(Math.max(value, lo), hi);  // pin the thumb; the value itself is kept
  return p.scale === 'log' ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo);
}

const attack = processor('dynamics.compressor').params.find((p) => p.name === 'attackMs');
console.log(attack.scale, sliderRange(attack), [0, 0.5, 1].map((t) => +toValue(attack, t).toFixed(3)));

const sampleRate = 44100;
const freq = masteringInsertParamInfo('eq.parametric', sampleRate)
  .find((p) => p.name === 'band0.frequencyHz');
console.log(freq.scale, freq.maxRelativeTo, sliderRange(freq), +toValue(freq, 0.5).toFixed(1));

const fast = processor('dynamics.transientShaper').params.find((p) => p.name === 'fastAttackMs');
console.log(fast.default, sliderRange(fast), toPosition(fast, fast.default));
```

```text
log [ 0.1, 200 ] [ 0.1, 4.472, 200 ]
log nyquist [ 20, 22027.95 ] 663.7
0 [ 0.1, 10000 ] 0
```

Three cases from that output:

- The compressor attack accepts 0 ms (`min: 0`), but a log axis cannot reach 0, so the descriptor draws from `uiMin` 0.1 ms. The slider's midpoint is 4.47 ms, the geometric mean of the ends.
- An EQ band frequency has no `uiMax`; its ceiling is the Nyquist frequency and is exclusive. Passing the session rate to `masteringInsertParamInfo` turns the 48 kHz probe value into 22050 for a 44.1 kHz session, and the slider stops just below it. The engine accepts 22027.95 Hz at that rate and refuses 22050 Hz.
- A value can sit outside the display range: the transient shaper's `fastAttackMs` defaults to 0, below its `uiMin` of 0.1. `toPosition` pins the thumb at the end and the value stays 0. Clamping the value to the display range would change the sound on load.

`min` and `max` also serve as an early check on typed values. They are measured with every other parameter at its default, so for a parameter coupled to its siblings they describe the default setup only. `dependsOn` states the couplings that are a plain ordering; `coupledWith` lists the other siblings whose value moves the range. The room reverb's `receiverSpacingM` has an empty `dependsOn` and lists `lengthM`, `widthM`, `listenerX`, `listenerY`, `sourceX` and `sourceY` in `coupledWith`: it publishes 2.5 m because that is where a receiver meets the wall of the default room ([Geometric room inserts](../effects-inserts.md#geometric-room-inserts)). When the user changes a key named in `coupledWith`, re-validate the dependent control (or widen its check) instead of keeping the default-setup bound. Treat a published bound as a warning and the engine's refusal as the decision, as in [Send the values back](#send-the-values-back).

## Bound a control by its siblings

`dependsOn` lists the siblings whose current value bounds this key, each read as `this <relation> factor * sibling`. A UI turns it into a live range that moves when the sibling moves.

```js
function liveBounds(p, values) {
  let lo = p.min, hi = p.max, loOpen = p.minExclusive, hiOpen = p.maxExclusive;
  for (const { key, relation, factor } of p.dependsOn) {
    if (values[key] === undefined) continue;  // the sibling is not in effect
    const bound = factor * values[key];
    if (relation === 'lt' || relation === 'le') {
      if (hi === null || bound < hi) [hi, hiOpen] = [bound, relation === 'lt'];
    } else if (lo === null || bound > lo) {
      [lo, loOpen] = [bound, relation === 'gt'];
    }
  }
  return { lo, loOpen, hi, hiOpen };
}

const gateValues = { thresholdDb: -40, closeThresholdDb: -50 };
const close = gate.params.find((p) => p.name === 'closeThresholdDb');
console.log('closeThresholdDb', liveBounds(close, gateValues));

const multiband = processor('multiband.compressor');
const cutoff1 = multiband.params.find((p) => p.name === 'cutoff1Hz');
console.log('cutoff1Hz', liveBounds(cutoff1, { cutoff0Hz: 120, cutoff1Hz: 2000 }));

for (const params of [
  { thresholdDb: -40, closeThresholdDb: -40 },
  { thresholdDb: -40, closeThresholdDb: -30 },
]) {
  try {
    masteringInsertTiming('dynamics.gate', params, 48000);
    console.log(params, 'accepted');
  } catch (e) {
    console.log(params, 'refused:', e.message);
  }
}
```

```text
closeThresholdDb { lo: null, loOpen: false, hi: -40, hiOpen: false }
cutoff1Hz { lo: 120, loOpen: true, hi: null, hiOpen: false }
{ thresholdDb: -40, closeThresholdDb: -40 } accepted
{ thresholdDb: -40, closeThresholdDb: -30 } refused: invalid gate configuration
```

The gate's close threshold may equal the open threshold (`le`) but not exceed it. Crossover cutoffs are strictly ordered (`lt` / `gt`), so a cutoff cannot equal its neighbor. Of the relations in the current build, all use a factor of 1 except the classical denoise and dereverb stages, whose `hopLength` must be at most half of `nFft` (`le`, factor 0.5).

A UI has two reasonable responses when a sibling moves past a dependent value: carry the dependent value along, or mark the pair invalid until the user fixes it. What it should not do is send the pair, because construction refuses it.

`dependsOn` bounds a value; it does not hide or disable a control. Whether a control exists at all is the `slot` field's job, below.

## Show a band only when it exists

A key with a non-null `slot` belongs to a group that exists under a condition. The processor's `slots` array gives each group's `activation`, `parent`, and `minCrossoverCutoffs` ([Slot metadata](../api-surface.md#what-the-capability-catalog-reports)). Two patterns cover the processors:

- `activation: 'anyKey'`: the group exists once any of its keys is sent. A parametric EQ band is built by sending one of its keys, so the UI offers "add band" and shows the band's controls from then on.
- `activation: 'always'` with `minCrossoverCutoffs`: the group exists while enough crossover cutoffs are in effect. A multiband compressor has one band more than it has cutoffs. With no cutoff key sent, the default split applies: the cutoffs that publish a non-null default.

```js
function presentSlots(proc, values) {
  const cutoffKeys = proc.params.filter((p) => /^cutoff\d+Hz$/.test(p.name));
  const sent = cutoffKeys.filter((p) => values[p.name] !== undefined).length;
  const cutoffs = sent > 0 ? sent : cutoffKeys.filter((p) => p.default !== null).length;
  const present = new Set();
  for (const slot of proc.slots) {  // a parent is always listed before its children
    if (slot.parent !== null && !present.has(slot.parent)) continue;
    if (cutoffs < slot.minCrossoverCutoffs) continue;
    const keyed = Object.keys(values).some((k) => k.startsWith(`${slot.name}.`));
    if (slot.activation === 'always' || keyed) present.add(slot.name);
  }
  return [...present];
}

console.log(presentSlots(multiband, {}));
console.log(presentSlots(multiband, { cutoff0Hz: 120, cutoff1Hz: 2000, cutoff2Hz: 6000 }));
console.log(presentSlots(processor('eq.parametric'), { 'band0.gainDb': 3, 'band5.frequencyHz': 8000 }));
```

```text
[ 'band0', 'band1', 'band2' ]
[ 'band0', 'band1', 'band2', 'band3' ]
[ 'band0', 'band5' ]
```

Once any cutoff key is sent, the split is exactly the cutoffs sent, so a UI that adds a band sends the whole cutoff list from `cutoff0Hz` upward. The engine holds the multiband compressor to this: with the default two cutoffs, `masteringInsertTiming` refuses a `band3.*` key as one the insert does not read, and accepts it once three cutoffs are sent.

## Decide what changes live

`rtSafe` splits the controls into two groups. An `rtSafe` parameter can change while audio runs, through the realtime engine's by-name setters or an automation lane. Every other parameter, including some that carry an automation `id`, takes effect only when the insert is built, so changing it means rebuilding the strip. Of the 5,579 descriptors in the current build, 1,261 are `rtSafe`; 98 more carry an `id` but are not.

A UI can show the difference before the user touches the control: draw an automation lane only for `rtSafe` rows, and apply a construction-only change when the control is released rather than on every drag step.

## Send the values back

Keep the user's values as a sparse object keyed by `name`: only the keys the user set, so the processor's own defaults still apply to the rest. Before a construction, `masteringInsertTiming(name, params, sampleRate)` works as a validator. It builds the insert exactly as a strip would, refuses a value construction rejects, and refuses a key the insert does not read. The one-shot `masteringProcess` ignores an unknown key, which makes it a poor check.

```js
const changed = { thresholdDb: -45, closeThresholdDb: -55, holdMs: 20 };
console.log(masteringInsertTiming('dynamics.gate', changed, 48000));

const engine = new RealtimeEngine(48000, 128);
engine.setTrackLanes([1]);
engine.setTrackStripJson(1, JSON.stringify({
  version: 1,
  strips: [{ id: 'vocal', inserts: [{ processor: 'dynamics.gate', params: changed }] }],
}));

const isLive = (name) => gate.params.find((p) => p.name === name).rtSafe;
for (const [name, value] of [['thresholdDb', -38], ['holdMs', 40]]) {
  if (isLive(name)) {
    engine.setTrackStripInsertParamByName(1, 0, name, value);
    console.log(name, 'set live');
  } else {
    console.log(name, 'needs a rebuild of the strip');
  }
}
try {
  engine.setTrackStripInsertParamByName(1, 0, 'holdMs', 40);
} catch (e) {
  console.log('holdMs live:', e.message);
}
engine.destroy();
```

```text
{ latencySamples: 0, tailSamples: 0 }
thresholdDb set live
holdMs needs a rebuild of the strip
holdMs live: invalid track strip insert parameter target
```

The two paths treat a bad value differently. Construction (scene JSON, `setTrackStripJson`, `masteringProcess`, `masteringInsertTiming`) refuses a value outside the accepted range with a message naming the problem, such as `compressor ratio must be at least 1`. The live path clamps: an automation value of +12 dB on the gate's `rangeDb`, whose maximum is 0, rendered the same samples as 0 dB. A UI that leans on the clamp loses the feedback, so keep the live control inside the range it draws.

For the live setters, automation ids, and how a live value interacts with a later strip rebuild, see [Group routing, sidechains, and live strip controls](../realtime-engine.md#group-routing-sidechains-and-live-strip-controls) and [Parameter automation](../realtime-engine.md#parameter-automation). The scene insert format is in [Mixing Scene JSON](../mixing-scene-json.md#insert).

## Lay out the mastering chain

The mastering chain (`masteringChain`, `masterAudio`, and every preset) takes flat dot-notation keys. `catalog.chain` describes them, as listed in [Describing the chain keys](../mastering-processors.md#describing-the-chain-keys):

- `stages`: one entry per stage, with its key `prefix`, the catalog `processor` whose descriptors its `<prefix>.<leaf>` keys use, and its `enabledKey`.
- `lists`: the indexed lists, with `minItems` / `maxItems`.
- `params`: descriptors for keys no processor carries, such as the `enabled` switches and `loudness.*`.
- `aliases`: the other spellings of each canonical key. A UI writes the canonical key and can ignore this list.

A stage panel combines the three: a toggle from `enabledKey`, controls from the stage's processor, controls from `params` under the stage's prefix, and a row editor for each list the stage owns.

```js
const { stages, lists, params: chainParams } = catalog.chain;
const chainParam = (key) => chainParams.find((p) => p.name === key);

function stagePanel(stage) {
  const owned = lists.filter((l) => l.key.startsWith(`${stage.prefix}.`));
  const fromProcessor = stage.processor === null ? [] : processor(stage.processor).params
    // a stage with lists edits its indexed keys through them, not through cutoff<i>Hz / band<i>.*
    .filter((p) => owned.length === 0 || !/\d/.test(p.name))
    .map((p) => ({ ...p, key: `${stage.prefix}.${p.name}` }));
  const chainOnly = chainParams
    .filter((p) => p.name.startsWith(`${stage.prefix}.`) && p.name !== stage.enabledKey)
    .filter((p) => !owned.some((l) => l.key === p.name))
    .map((p) => ({ ...p, key: p.name }));
  const keys = new Set();
  return {
    title: stage.prefix,
    enabled: chainParam(stage.enabledKey),
    controls: [...fromProcessor, ...chainOnly].filter((c) => !keys.has(c.key) && keys.add(c.key)),
    lists: owned.map((l) => ({
      key: l.key, minItems: l.minItems, maxItems: l.maxItems,
      itemFields: l.processor === null ? [chainParam(l.key)] : processor(l.processor).params,
    })),
  };
}

const panels = stages.map(stagePanel);
for (const panel of panels.filter((p) => /compressor|multiband|loudness/i.test(p.title))) {
  console.log(panel.title, panel.enabled.default, panel.controls.map((c) => c.key.slice(panel.title.length + 1)).join(' '));
  for (const l of panel.lists) console.log('  list', l.key, `${l.minItems}..${l.maxItems}`, l.itemFields.length, 'fields');
}
```

```text
dynamics.compressor false thresholdDb ratio attackMs releaseMs makeupGainDb kneeDb autoMakeup detector sidechainHpfEnabled sidechainHpfHz pdrTimeMs pdrReleaseScale
dynamics.multibandComp false firKernelSize mode slope
  list dynamics.multibandComp.crossover.cutoffsHz 1..63 1 fields
  list dynamics.multibandComp.bands 2..64 12 fields
loudness false applyGainAtInputRate ceilingDb maxLimiterGainReductionDb releaseMs targetLufs truePeakOversample
```

The multiband stage is the one that needs the lists. Its processor's `cutoff<i>Hz` and `band<i>.*` keys are aliases of the list items, and through the chain they address only cutoffs and bands that already exist. The list keys set the count: three items in `crossover.cutoffsHz` give four bands. Each `bands` item takes the `dynamics.compressor` fields, and each cutoff item uses the descriptor of `dynamics.multibandComp.crossover.cutoffsHz` in `params`, a log-scaled frequency drawn from 20 Hz to 20 kHz. The `loudness` stage has no processor (`processor: null`), so all of its controls come from `params`.

The order of `stages` is not the order the chain runs: the array lists `repair.declick` before `repair.declip`, and the chain runs declip first. A UI that draws the chain as a signal flow takes the order from [Chain order](../mastering-processors.md#chain-order).

Applying the panel is one flat object; an enum can be sent by its `choices` name:

```js
const sr = 48000;
const tone = Float32Array.from({ length: sr }, (_, i) => 0.25 * Math.sin(2 * Math.PI * 220 * i / sr));
const result = masteringChain(tone, sr, {
  'dynamics.multibandComp.enabled': true,
  'dynamics.multibandComp.crossover.cutoffsHz.0': 120,
  'dynamics.multibandComp.crossover.cutoffsHz.1': 2000,
  'dynamics.multibandComp.crossover.cutoffsHz.2': 6000,
  'dynamics.multibandComp.bands.3.ratio': 3,
  'dynamics.compressor.enabled': true,
  'dynamics.compressor.detector': 'peak',
  'loudness.enabled': true,
  'loudness.targetLufs': -16,
});
console.log(result.stages, result.outputLufs.toFixed(2));
try {
  masteringChain(tone, sr, { 'dynamics.multibandComp.enabled': true, 'dynamics.multibandComp.band3.ratio': 3 });
} catch (e) {
  console.log(e.message);
}
```

```text
[
  'dynamics.compressor',
  'dynamics.multibandComp',
  'loudness.optimize'
] -16.00
multiband band index out of range: dynamics.multibandComp.band3.ratio
```

Unlike the one-shot processor call, the chain refuses a key it does not know (`unknown chain config key: ...`), so a misspelled key built from the panel shows up on the first render.

## Related

- [Effects Inserts](../effects-inserts.md#from-the-catalog-to-an-insert-control-surface) — the insert-specific route from a processor id to a control surface
- [Mastering Processors](../mastering-processors.md#reading-a-catalog-bound) — how bounds and defaults are measured
- [JavaScript API](../js-api.md#capabilitycatalog) — the `capabilityCatalog()` signature and the TypeScript types
- [Realtime Engine](../realtime-engine.md#parameter-automation) — live setters and automation lanes for `rtSafe` parameters
- [Build a Browser Mixer](./browser-mixer.md) — an app that applies strip and insert values through the engine
