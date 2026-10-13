---
title: パラメータ記述子からコントロールを組み立てる
description: エンジンが公開するパラメータ記述子から操作画面を組み立てる手順。パラメータごとの部品の選び方、線形・対数スケールのスライダーへの対応付け、兄弟パラメータによる範囲制限、バンド群の表示切り替え、catalog.chain からのマスタリングチェーン画面の構成、値をエンジンへ戻す方法を扱います。
---

# パラメータ記述子からコントロールを組み立てる

エンジンが構築できるプロセッサは、どれも自分のパラメータを記述しています。名前、型、単位、既定値、受け入れ範囲、表示範囲、軸、兄弟パラメータとの制約、音声の再生中に値を変えられるかどうかです。ホストがこの記述子を読めば、手書きの表を持たずにどのインサートやマスタリングの段の操作画面も描けます。ビルドでキーやバンドが増えれば、画面もそれに追従します。

このページでは、その操作画面を素の JavaScript で順に組み立てます。フィールドごとのリファレンスは別ページにあるので、ここでは繰り返さずにリンクします。各フィールドは [パラメータ記述子](../effects-inserts.md#パラメータ記述子)、`min`・`max`・`default` の出どころは [カタログの値域の読み方](../mastering-processors.md#カタログの値域の読み方)、ドキュメント全体は [機能カタログ](../capability-catalog.md) を参照してください。

以下のコード片はすべて 1 本のスクリプトで、同梱の WASM ビルドに対して Node で実行したものです。出力ブロックはそのとき表示された内容です。

::: info 用意するもの
- **インストール:** `npm install @libraz/libsonare`（Node.js 22.12 以降）。最後のコード片がテスト用のトーンを自分で作るので、音声ファイルは不要です。
- **実行方法:** コード片を順に 1 つのファイル `controls.mjs` に貼り付け、`node controls.mjs` で実行します。後のコード片は、前のコード片で定義した名前（`catalog`、`processor`、`gate`、`multiband`）を使います。
- **前提知識:** インサートとマスタリングチェーンが何かは知っている前提です。どちらも [ミキシングの基礎](../glossary/concepts/mixing-basics.md) と [マスタリングとは?](../glossary/concepts/what-is-mastering.md) で解説しています。
:::

## 記述子を読む

`capabilityCatalog()` は 1 回の呼び出しでビルド全体を返します。各プロセッサとその `params` 配列に加え、マスタリングチェーン用の `chain` セクションも含みます。`masteringInsertParamInfo(name, sampleRate?)` は 1 つのプロセッサについて同じ記述子を返し、サンプルレートに依存する上限も解決できます。UI は起動時にカタログを 1 回読むのが普通です。

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

このページで扱う要素の大半が、ゲートの記述子に出ています。範囲は 2 種類あり、`min` / `max` は構築が受け入れる範囲、`uiMin` / `uiMax` はコントロールが描くべき範囲です。アタックとリリースの時間は対数軸で描きます。`closeThresholdDb` には自前の範囲がなく、`thresholdDb` との関係だけを持っています。最後の 3 行は再生中には変更できません。

## パラメータごとに部品を選ぶ

部品は `type` と `choices` で決まります。数値がスライダーになるのは、表示範囲か受け入れ範囲から両端が分かるときだけで、それ以外は数値入力欄が必要です。

```js
function controlKind(p) {
  if (p.type === 'boolean') return 'toggle';
  if (p.choices !== null) return 'select';   // 列挙型、または受け入れる値に飛びがある数値
  if (p.type !== 'number') return 'custom';  // 'string' / 'array': インパルス応答、バンドごとのリスト
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

`field` が多いのは意図どおりです。ゲインやオフセットの多くは境界を公開していません。`null` は構築がその側で値を拒否しないという意味で、測っていないという意味ではありません（[null と既定値が教えてくれないこと](../effects-inserts.md#null-と既定値が教えてくれないこと)）。こうしたキーには、単位を添えた数値入力欄が実態に合ったコントロールです。スライダーにするには、エンジンが一度も示していない範囲が必要になります。`select` は選択肢の数値 `value` を送り、`name` はラベルとして使います。

## スライダーをスケールに対応させる

`scale` は軸で、`'linear'` か `'log'` です。対数スライダーには正の下端と有限の上端が必要です。現在のビルドでは、対数スケールの記述子はすべて、`uiMin` / `uiMax` か `min` / `max` のどちらかで両端を公開しています。`uiMin ?? min` と `uiMax ?? max` で必ず見つかります。

```js
function sliderRange(p) {
  const lo = p.uiMin ?? p.min;
  let hi = p.uiMax ?? p.max;
  // 描く範囲の上端が受け入れ上限そのもので、その上限値は拒否される
  if (p.uiMax === null && p.maxExclusive) hi *= 0.999;
  return [lo, hi];
}

function toValue(p, t) {
  const [lo, hi] = sliderRange(p);
  return p.scale === 'log' ? lo * (hi / lo) ** t : lo + (hi - lo) * t;
}

function toPosition(p, value) {
  const [lo, hi] = sliderRange(p);
  const v = Math.min(Math.max(value, lo), hi);  // つまみは端に留め、値そのものは保持する
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

出力から 3 つのケースが読み取れます。

- コンプレッサーのアタックは 0 ms を受け入れます（`min: 0`）。しかし対数軸は 0 に届かないため、記述子は `uiMin` の 0.1 ms から描くよう指定しています。スライダーの中央は両端の幾何平均の 4.47 ms です。
- EQ バンドの周波数には `uiMax` がありません。上限はナイキスト周波数で、その値自体は含みません。セッションのレートを `masteringInsertParamInfo` に渡すと、48 kHz で測った値が 44.1 kHz のセッション用に 22050 へ変わり、スライダーはそのすぐ手前で止まります。このレートでエンジンは 22027.95 Hz を受け入れ、22050 Hz を拒否します。
- 値が表示範囲の外にあることもあります。トランジェントシェイパーの `fastAttackMs` は既定値が 0 で、`uiMin` の 0.1 より下です。`toPosition` はつまみを端に留め、値は 0 のまま保ちます。値を表示範囲に丸めると、読み込んだ時点で音が変わってしまいます。

`min` と `max` は、入力された値を早めに確かめる用途にも使えます。ただし他のパラメータをすべて既定値にして測った範囲なので、兄弟と連動するパラメータでは既定の構成での範囲にすぎません。`dependsOn` が表すのは単純な大小関係の連動で、それ以外に値域を動かす兄弟は `coupledWith` が挙げます。ルームリバーブの `receiverSpacingM` は `dependsOn` が空で、`coupledWith` に `lengthM`、`widthM`、`listenerX`、`listenerY`、`sourceX`、`sourceY` を挙げています。2.5 m を公開しているのは、既定の部屋でそこが壁に当たる位置だからです（[幾何ベースのルーム系インサート](../effects-inserts.md#幾何ベースのルーム系インサート)）。ユーザーが `coupledWith` に挙がったキーを変更したら、既定の構成での境界のままにせず、依存する側のコントロールを再検証する（あるいは検査を緩める）ようにしてください。公開された境界は警告に使い、最終判断はエンジンが拒否するかどうかに任せてください。手順は [値をエンジンへ戻す](#値をエンジンへ戻す) にあります。

## 兄弟パラメータで範囲を絞る

`dependsOn` は、現在値がこのキーの範囲を決める兄弟パラメータの一覧です。各要素は `this <relation> factor * sibling` と読みます。UI はこれを、兄弟が動くと一緒に動く範囲に変換します。

```js
function liveBounds(p, values) {
  let lo = p.min, hi = p.max, loOpen = p.minExclusive, hiOpen = p.maxExclusive;
  for (const { key, relation, factor } of p.dependsOn) {
    if (values[key] === undefined) continue;  // 兄弟パラメータが有効でない
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

ゲートのクローズしきい値はオープンしきい値と等しくてもよく（`le`）、超えることはできません。クロスオーバーのカットオフは厳密に順序づけられている（`lt` / `gt`）ので、隣と同じ値にはできません。現在のビルドの関係は、古典的なデノイズとデリバーブの段を除いてすべて係数 1 です。この 2 つでは `hopLength` が `nFft` の半分以下でなければなりません（`le`、係数 0.5）。

兄弟の値が依存側の値を追い越したとき、UI の対応は 2 通り考えられます。依存側の値を一緒に動かすか、ユーザーが直すまでその組を無効と表示するかです。その組をそのまま送ってはいけません。構築が拒否します。

`dependsOn` は値の範囲を決めるもので、コントロールを隠したり無効にしたりはしません。コントロールが存在するかどうかは、次に扱う `slot` フィールドが決めます。

## 存在するバンドだけを表示する

`slot` が null でないキーは、条件付きで存在する群に属します。プロセッサの `slots` 配列が、各群の `activation`、`parent`、`minCrossoverCutoffs` を示します（[機能カタログ](../capability-catalog.md)）。プロセッサは次の 2 つのパターンで扱えます。

- `activation: 'anyKey'` の群は、そのキーのどれか 1 つが送られた時点で存在します。パラメトリック EQ のバンドはキーを 1 つ送れば作られるので、UI は「バンドを追加」を用意し、追加後はそのバンドのコントロールを表示します。
- `activation: 'always'` と `minCrossoverCutoffs` の組み合わせでは、有効なクロスオーバーのカットオフが足りている間だけ群が存在します。マルチバンドコンプレッサーのバンド数はカットオフ数より 1 つ多くなります。カットオフのキーを 1 つも送らなければ既定の分割が使われ、既定値が null でないカットオフがそのまま有効になります。

```js
function presentSlots(proc, values) {
  const cutoffKeys = proc.params.filter((p) => /^cutoff\d+Hz$/.test(p.name));
  const sent = cutoffKeys.filter((p) => values[p.name] !== undefined).length;
  const cutoffs = sent > 0 ? sent : cutoffKeys.filter((p) => p.default !== null).length;
  const present = new Set();
  for (const slot of proc.slots) {  // 親は必ず子より前に並ぶ
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

カットオフのキーを 1 つでも送ると、分割は送ったカットオフちょうどになります。そのため、バンドを追加する UI は `cutoff0Hz` から順にカットオフの一覧をすべて送ります。マルチバンドコンプレッサーではエンジンもこれに従います。既定の 2 つのカットオフのままでは、`masteringInsertTiming` は `band3.*` のキーをインサートが読まないキーとして拒否し、カットオフを 3 つ送ると受け入れます。

## 再生中に変えられる値を見分ける

`rtSafe` はコントロールを 2 つに分けます。`rtSafe` のパラメータは、リアルタイムエンジンの名前指定セッターかオートメーションレーンを通じて、再生中に変更できます。それ以外のパラメータは、オートメーション `id` を持つものも含めて、インサートを構築したときにだけ反映されます。変更するにはストリップを組み直す必要があります。現在のビルドの記述子 5,579 個のうち、`rtSafe` は 1,261 個です。さらに 98 個は `id` を持っていても `rtSafe` ではありません。

この違いは、ユーザーが操作する前から画面に出せます。オートメーションレーンは `rtSafe` の行にだけ描き、構築時専用の変更はドラッグの途中ではなくコントロールを離したときに適用します。

## 値をエンジンへ戻す

ユーザーの値は、`name` をキーにした疎なオブジェクトで持ちます。ユーザーが設定したキーだけを入れておけば、残りにはプロセッサ自身の既定値が使われます。構築の前には `masteringInsertTiming(name, params, sampleRate)` が検証役になります。ストリップと同じ手順でインサートを構築し、構築が拒否する値も、インサートが読まないキーも拒否します。単発の `masteringProcess` は未知のキーを無視するので、検証には向きません。

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

範囲外の値の扱いは経路によって違います。構築（シーン JSON、`setTrackStripJson`、`masteringProcess`、`masteringInsertTiming`）は受け入れ範囲外の値を拒否し、`compressor ratio must be at least 1` のように問題を示すメッセージを返します。ライブ経路は値を丸めます。上限が 0 のゲートの `rangeDb` にオートメーションで +12 dB を与えると、0 dB と同じサンプルがレンダリングされました。丸めに頼る UI はユーザーへのフィードバックを失うので、ライブのコントロールは描いた範囲の中に収めてください。

ライブ用のセッター、オートメーション id、ライブで変えた値とその後のストリップ再構築の関係は、[グループルーティング・サイドチェイン・ライブストリップ操作](../realtime-engine.md#グループルーティング・サイドチェイン・ライブストリップ操作) と [パラメータオートメーション](../realtime-engine.md#パラメータオートメーション) を参照してください。シーンのインサート形式は [ミキシングシーン JSON](../mixing-scene-json.md#インサート) にあります。

## マスタリングチェーンの画面を組む

マスタリングチェーン（`masteringChain`、`masterAudio`、すべてのプリセット）はドット区切りのフラットなキーを受け取ります。そのキーを記述するのが `catalog.chain` で、内容は [チェーンキーの記述](../mastering-processors.md#チェーンキーの記述) のとおりです。

- `stages` は段ごとに 1 要素で、キーの `prefix`、`<prefix>.<leaf>` キーが記述子を借りるカタログの `processor`、`enabledKey` を持ちます。
- `lists` はインデックス付きのリストで、`minItems` / `maxItems` を持ちます。
- `params` は、どのプロセッサも持たないキーの記述子です。`enabled` スイッチや `loudness.*` がここに入ります。
- `aliases` は正規キーの別表記です。UI は正規キーを書けばよく、この一覧は無視して構いません。

段のパネルはこれらを組み合わせて作ります。`enabledKey` からトグル、段のプロセッサからコントロール、段の prefix に属する `params` からコントロール、段が持つリストごとに行エディタを用意します。

```js
const { stages, lists, params: chainParams } = catalog.chain;
const chainParam = (key) => chainParams.find((p) => p.name === key);

function stagePanel(stage) {
  const owned = lists.filter((l) => l.key.startsWith(`${stage.prefix}.`));
  const fromProcessor = stage.processor === null ? [] : processor(stage.processor).params
    // リストを持つ段は、インデックス付きキーを cutoff<i>Hz / band<i>.* ではなくリスト経由で編集する
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

リストが必要になるのはマルチバンドの段です。そのプロセッサの `cutoff<i>Hz` と `band<i>.*` キーはリスト要素の別表記で、チェーン経由では既に存在するカットオフとバンドしか指せません。数を決めるのはリストのキーで、`crossover.cutoffsHz` に 3 要素を入れるとバンドは 4 つになります。`bands` の各要素は `dynamics.compressor` のフィールドを取り、カットオフの各要素は `params` にある `dynamics.multibandComp.crossover.cutoffsHz` の記述子を使います。20 Hz から 20 kHz の範囲を対数で描く周波数です。`loudness` の段にはプロセッサがない（`processor: null`）ので、コントロールはすべて `params` から来ます。

`stages` の並びはチェーンの実行順ではありません。配列では `repair.declick` が `repair.declip` より前にありますが、チェーンは declip を先に実行します。チェーンを信号の流れとして描く UI は、[チェーンの順序](../mastering-processors.md#チェーンの順序) から順序を取ってください。

パネルの適用は 1 つのフラットなオブジェクトで済みます。列挙型は `choices` の名前で送れます。

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

単発のプロセッサ呼び出しと違い、チェーンは知らないキーを拒否します（`unknown chain config key: ...`）。パネルから組み立てたキーの綴りが間違っていれば、最初のレンダリングで分かります。

## 関連

- [エフェクトインサート](../effects-inserts.md#カタログからインサートの操作面へ)：プロセッサ id から操作画面までの、インサート固有の手順
- [マスタリングプロセッサ](../mastering-processors.md#カタログの値域の読み方)：境界と既定値の測り方
- [JavaScript API](../js-api.md#capabilitycatalog)：`capabilityCatalog()` のシグネチャと TypeScript の型
- [リアルタイムエンジン](../realtime-engine.md#パラメータオートメーション)：`rtSafe` パラメータ向けのライブセッターとオートメーションレーン
- [ブラウザでミキシングアプリを作る](./browser-mixer.md)：エンジン経由でストリップとインサートの値を適用するアプリ
