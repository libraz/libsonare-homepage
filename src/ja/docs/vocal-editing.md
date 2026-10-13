---
title: オフラインモノフォニックボーカル編集
description: libsonare のオフラインモノフォニックボーカルセッション API を実用的に解説。解析、ピッチ編集、ドラフト、アンドゥ／リドゥ、レンダリング、永続化、Worker 実行、Project への適用を扱います。
---

# オフラインモノフォニックボーカル編集

ボーカル編集 API は、モノラル録音 1 つを編集可能なノートモデルへ変換します。ソースを解析してノートのピッチと時間を公開し、ピッチ・フォルマント・振幅の編集をトランザクションとして適用し、オーディオデバイスやリアルタイムエンジンなしで編集済みソースをレンダリングします。Node、ブラウザ／WASM、Python のバインディングは同じセッションモデルを公開します。

オフラインで補正するボーカルテイクには `VocalEditSession` を使います。結果をアレンジへ配置する場合は、セッションと `Project.applyVocalEdit()` を組み合わせます。この API が受け付けるのはモノフォニックの 1 ラインです。重なった声を分離したり、ポリフォニックソースの編集を置き換えたりするものではありません。リアルタイム入力には[リアルタイムボイスチェンジャー](./realtime-voice-changer.md)を使います。

::: info 読み始める前に
このページは音高まわりの用語を改めて説明せずに使います。**F0** は各瞬間の声の基本周波数で、ピッチトラッカー（既定では pYIN）が解析フレームごとに測ります。歌い手が音程のある音を出しているフレームを**有声**と呼びます。音高の差は半音の 100 分の 1 にあたる**セント**で表します。半音と MIDI ノート番号は[編集の基礎](./glossary/concepts/editing-basics.md)、F0 の追跡は[メロディとピッチ](./glossary/analysis/melody-pitch.md)、フォルマントは[ボイスとフォルマント](./glossary/editing/voice-formant.md)で説明しています。
:::

ボーカル編集サーフェスは Node、ブラウザ／WASM、Python のバインディングから利用します。CLI では `sonare vocal-notes` が、セッションがテイクから見つけるノートを一覧表示します。オプションはセッションの解析設定です。セッションの編集とレンダリングに対応する CLI コマンドはありません。

<FlowDiagram
  title="ボーカル編集のライフサイクル"
  :nodes="[
    { id: 'source', label: 'モノラル PCM', col: 0, row: 0 },
    { id: 'session', label: 'セッションを作成 / 復元', col: 1, row: 0, variant: 'accent' },
    { id: 'analysis', label: 'ノートとピッチ解析', col: 2, row: 0 },
    { id: 'draft', label: 'ドラフト操作', col: 3, row: 0 },
    { id: 'commit', label: 'リビジョンをコミット', col: 4, row: 0, variant: 'accent' },
    { id: 'render', label: '全体または範囲をレンダリング', col: 5, row: 0, variant: 'success' },
    { id: 'project', label: 'Project へ適用', col: 6, row: 0 }
  ]"
  :edges="[
    { from: 'source', to: 'session' },
    { from: 'session', to: 'analysis' },
    { from: 'analysis', to: 'draft' },
    { from: 'draft', to: 'commit' },
    { from: 'commit', to: 'render' },
    { from: 'render', to: 'project' }
  ]"
  caption="セッションから解析結果を読み、編集をリビジョンとしてコミットし、コミット済みのレンダリング結果を Project に関連付けます。"
/>

## セッションを作成して調べる

入力はモノラルの `Float32Array` と、8,000 Hz 以上 384,000 Hz 以下のサンプルレートです。次の決定的なソースは解析結果も渡すため、解析器のヒューリスティックに依存しないスモークテストになります。`analysis` を省略すると、libsonare 内蔵の pYIN 経路でソースを解析します。

::: code-group

```typescript [ブラウザ / WASM]
import {
  createVocalEditSession,
  init,
  vocalEditAvailable,
} from '@libraz/libsonare';

await init();
if (!vocalEditAvailable()) throw new Error('この WASM ビルドにはボーカル編集 API がありません');

const sampleRate = 16_000;
const samples = new Float32Array(4096);
for (let i = 0; i < samples.length; i += 1) {
  samples[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
}

const frameLengthSamples = 256;
const hopLengthSamples = 128;
const frameCount = Math.ceil(samples.length / hopLengthSamples) + 1;
const session = createVocalEditSession({
  samples,
  sampleRate,
  frameLengthSamples,
  hopLengthSamples,
  analysis: {
    frameOriginSample: 0,
    samplesPerFrame: hopLengthSamples,
    frameLengthSamples,
    f0Hz: new Float32Array(frameCount).fill(440),
    voiced: new Uint8Array(frameCount).fill(1),
    algorithmId: 'libsonare.pyin',
    algorithmVersion: 1,
  },
});

try {
  const { notes, transitions } = session.notes();
  const analysis = session.analysis();
  console.log(notes.length, transitions.length, analysis.sourceLengthSamples);
} finally {
  session.dispose();
}
```

```typescript [Node]
import { createVocalEditSession, vocalEditAvailable } from '@libraz/libsonare';

if (!vocalEditAvailable()) throw new Error('このビルドにはボーカル編集 API がありません');
const session = createVocalEditSession({ samples, sampleRate });
try {
  console.log(session.notes().notes);
} finally {
  session.dispose();
}
```

```python [Python]
import numpy as np
from libsonare import create_vocal_edit_session, vocal_edit_available

if not vocal_edit_available():
    raise RuntimeError('このビルドにはボーカル編集 API がありません')
sample_rate = 16_000
samples = (0.25 * np.sin(2 * np.pi * 440 * np.arange(4096) / sample_rate)).astype(np.float32)
with create_vocal_edit_session(samples, sample_rate) as session:
    notes, transitions = session.notes()
    rendered = session.render()
    state = session.export_state()
    print(len(notes), len(transitions), rendered.samples.size, len(state))
```

:::

利用可否は `vocalEditAvailable()` で確認し、API バージョンは `vocalEditApiVersion()`（Python は `vocal_edit_api_version()`、C は `sonare_vocal_edit_api_version`）で読めます。`session.capabilities().apiVersion` も同じカウンターを返します。これはエンジンの ABI カウンターとは別です。セッション、ドラフト、スナップショット、レンダリングジョブはそれぞれ `dispose()`、`delete()`、`destroy()` でハンドルを解放でき、`Symbol.dispose` にも対応するため、明示的リソース管理が使えるランタイムでは `using session = createVocalEditSession(...)` と書けます。

`session.notes()` はノートとピッチ遷移を返します。ノートにはソース範囲、解析フレーム範囲、中央値周波数、中心 MIDI ノート（`centerMidi`）、ピッチの安定度、振幅サンプル、現在の編集が含まれます。

中心 MIDI ノートは、音声に合わせて精密化した F0 を、両端のグライドを除いてビブラートの整数周期で平均して求めます。ピッチトラッカーの 10 セント刻みには縛られないので、`center` を目標にすると指定した音程に着地します。

`session.analysis()` は F0 と有声音配列、解析グリッド、アルゴリズムのメタデータ、ソースダイジェスト、設定を返します。`session.capabilities()` ではプロファイル、モノフォニックの制約、読み込んだプロファイルが解析キャンセルに対応するか、利用できるフォルマントシフト範囲を調べられます。UI にプロファイルの制限を埋め込まず、これらの値を読み取ってください。

Python バインディングではメソッド名が snake_case になり、これらのカウンターは Python の整数として公開され、`with` ブロックの終了時にセッションが閉じられます。

`evaluatePitch(noteId)` はノートの実測・ターゲット・有効ピッチ・有声音の配列を返します。座標変換メソッドは、時間編集後のソースサンプルと出力サンプルを相互変換します。

### セッションのオプション

オプションはすべて省略可能です。`analysis` は組み込みの pYIN の代わりに自分で用意した F0 トラックを渡すもので、それ以外は解析、ノートの分割、レンダリングを調整します。

| オプション | 既定値 | 意味 |
|------------|--------|------|
| `frameLengthSamples` / `hopLengthSamples` | `2048` / `512` | pYIN の解析フレームとホップ（サンプル単位） |
| `fminHz` / `fmaxHz` | `65` / `2093` | ピッチの探索範囲（Hz） |
| `yinThreshold` | `0.1` | pYIN の絶対しきい値 |
| `voicedThreshold` | `0.5` | フレームを有声とみなす有声確率の下限 |
| `centered` | `true` | 解析フレームをホップ位置に中心合わせする |
| `segmentationThresholdCents` | `50` | 新しいノートを始めるピッチ変化量。ビブラートのかかった持続音は 1 つのノートのままで、グライドの後に短い断片が分かれることもありません |
| `minNoteMs` | `30` | ノートとして残す最短の長さ（ms） |
| `referenceHz` | `440` | ノートごとのセントを測る基準 |
| `outputLengthSamples` | ソースの長さ | レンダリング出力の長さ。`0` または省略でソースの長さ |
| `edgeFadeMs` | `5` | 編集したノートの端ごとのフェード（ms） |
| `vibratoCutoffHz` | `3` | ノートのピッチカーブを分けるときの、ゆっくりしたドリフトとビブラートの境目 |
| `limits` | [永続化と復元](#セッションを永続化して復元する)を参照 | `maxHistoryBytes`、`maxCacheBytes`、`maxUndoDepth`、`maxRenderJobs` |

`session.analysis()` は解析に使われた設定を返すので、既定値を前提にせず読み取ってください。`sonare vocal-notes` コマンドは、分割とピッチ範囲の設定を `--segmentation-threshold-cents`、`--min-note-ms`、`--fmin-hz`、`--fmax-hz`、`--reference-hz` として受け取ります。

## ノート編集の中身

セッションは、各ノートで測ったピッチ曲線を 3 つの層に分けます。ノート全体を代表する 1 つの音高である中心（`centerMidi`）、中心のまわりのゆっくりした揺らぎであるドリフト（`vibratoCutoffHz` より下）、それより上の速い周期的な揺れであるビブラートです。下の編集フィールドはこれらの層に別々に作用するので、ドリフトとビブラートをそのまま残してノートの中心だけを動かせます。音高の移動は周期単位の断片ごとに再合成されるため、フォルマントはほぼ元の位置に残ります（[再合成エンジンは 2 種類](./glossary/editing/pitch-correction.md#再合成エンジンは-2-種類)）。

<SonareDemo id="melody-contour" />

各ノートは `VocalNoteEdit` を持ち、`setEdit` はそれを丸ごと置き換えます。`note.edit` から始めて、変えたいフィールドだけを変更してください。下の既定値は、手を加えていないノートが報告する値です。ピッチは**目標**で動きます。

| `pitch.target` | 結果 |
|----------------|------|
| `{ mode: 'none' }` | ピッチに手を加えない（既定） |
| `{ mode: 'center', midi }` | ノートの `centerMidi` を `[0, 127]` の `midi` へ動かす。中心まわりのドリフトとビブラートは残る |
| `{ mode: 'curve', points }` | `points`（各点は `{ sourceSample, midi }`）に従う。2 点以上で、`sourceSample` は厳密に増加し、最初と最後はノートのソース開始・終了に一致させる |

| フィールド | 意味 | 範囲 | 既定値 |
|------------|------|------|--------|
| `pitch.amount` | ピッチを目標へどこまで寄せるか。`0` なら補正しない | `[0, 1]` | `0` |
| `pitch.speedMs` | 目標へ乗る動きの時定数。`0` なら即座に動く | `>= 0` | `0` |
| `pitch.maxCorrectionSemitones` | どのフレームでも補正量を制限する上限 | `>= 0` | `12` |
| `pitch.transposeSemitones` | 補正の後でピッチに加算する量 | 有限の任意の値 | `0` |
| `pitch.driftScale` | 中心まわりのゆっくりしたドリフトの倍率。`0` で平坦になる | `>= 0` | `1` |
| `pitch.vibratoScale` | ビブラートの倍率。`0` で消える | `>= 0` | `1` |
| `formant.mode` | `'preserve'` はフォルマントを動かさず、`'shift'` は `shiftSemitones` だけスペクトル包絡を動かす | `'preserve'`、`'shift'` | `'preserve'` |
| `formant.shiftSemitones` | フォルマントの移動量。`'preserve'` では `0` が必要 | `capabilities()` が返す範囲（約 -10.3 〜 +8.7） | `0` |
| `destinationStartSample` | 出力でのノートの開始位置 | `>= 0` | ソースの開始位置 |
| `destinationLengthSamples` | ノートの出力での長さ。ソースと違う長さにすると伸縮される | `> 0`、出力の長さの内側 | ソースの長さ |
| `gainDb` | レベルの変更 | 有限値 | `0` |
| `muted` | ノートを無音にする | 真偽値 | `false` |
| `amplitudeEnvelope` | レンダリング後のノートの長さに引き伸ばされるゲイン点列。`gainDb` に上乗せされる | 有限値、`>= 0` | 空 |

## ドラフトとして編集を適用する

::: warning 10 進文字列
リビジョン、世代、リクエスト ID、バイト数の上限（`maxHistoryBytes`、`maxCacheBytes`）は、JavaScript 境界を越えるときに 10 進文字列（`VocalUint64`）になります。文字列のまま扱ってください。`maxUndoDepth` と `maxRenderJobs` は数値です。制御スレッドの別の操作と競合し得る書き込みには、`expectedRevision` と `expectedGeneration` を渡します。
:::

`beginEdit()` は現在コミットされているリビジョンに対する 1 つのトランザクションを開始します。`draft.apply()` はドラフト世代を検査し、変更された範囲とノート ID の変更を返します。`draft.commit()` は 1 つの新しいリビジョンを公開し、その編集をセッションから見えるようにします。失敗したドラフトや不要になったドラフトはキャンセルして、次のドラフトを開始できるようにします。

```typescript
const note = session.notes().notes[0];
const draft = session.beginEdit({ expectedRevision: session.revision() });

try {
  const edit = {
    ...note.edit,
    pitch: {
      ...note.edit.pitch,
      target: { mode: 'center', midi: 69 },
      amount: 1,
    },
  };
  const applied = draft.apply({
    expectedGeneration: draft.token().generation,
    operations: [{ kind: 'setEdit', noteId: note.id, edit }],
  });
  console.log(applied.dirtyRanges, applied.idChanges);
  draft.commit({ expectedRevision: session.revision() });
} catch (error) {
  draft.cancel();
  throw error;
}

session.undo({ expectedRevision: session.revision() });
session.redo({ expectedRevision: session.revision() });
```

操作の種類は `setEdit`、`setSourceSpan`、`split`、`merge`、`setTransition`、`removeTransition`、`reset` です。分割とマージではノート ID が廃止されることがあるため、`idChanges` に従い、後続の操作には返された ID を使います。

`setSourceSpan` と `split` の位置は、サンプルまたは秒のどちらか一方の表記で指定します（`sourceSample` / `sourceSec`、および `sourceStartSample` / `sourceStartSec`、`sourceEndSample` / `sourceEndSec`、`destinationStartSample` / `destinationStartSec`、`destinationLengthSamples` / `destinationLengthSec`）。秒はセッションのサンプルレートで最も近いサンプルに丸められます。同じ位置に両方の表記を渡すと拒否され、負の位置も拒否されます。`merge` は `noteIds` と、省略可能な `policy`（`'preserve'` または `'reset'`）を取ります。編集呼び出しごとの表記は[編集 DSP](./editing-dsp.md#サンプル指定と秒指定)にまとめています。

```typescript
const [first] = session.notes().notes;
const split = session.beginEdit({ expectedRevision: session.revision() });
const result = split.apply({
  expectedGeneration: split.token().generation,
  operations: [{ kind: 'split', noteId: first.id, sourceSec: 0.5 }],
});
console.log(result.idChanges); // [{ operationIndex: 0, retiredId, newIds: [a, b] }]
split.commit({ expectedRevision: session.revision() });

const [a, b] = result.idChanges[0].newIds;
const join = session.beginEdit({ expectedRevision: session.revision() });
join.apply({
  expectedGeneration: join.token().generation,
  operations: [{ kind: 'merge', noteIds: [a, b], policy: 'preserve' }],
});
join.commit({ expectedRevision: session.revision() });
```

Python では操作はデータクラスです。`VocalSplitNote(note_id, cut_source_sample=... または cut_source_sec=...)`、`VocalMergeNotes(note_ids, merge_policy)`、`VocalSetNoteSourceSpan(note_id, source_start_sec=..., ...)` を使います。`VocalSetNoteSourceSpan` の 2 つの移動先サンプルフィールドは既定で 0 で、0 は未指定として扱われるため、移動先を秒で指定した場合に拒否されるのは、0 でないサンプル値を併せて渡したときだけです。

期待リビジョンと世代を指定すると、同時または順序外の UI 書き込みが新しい編集を黙って上書きせず、明示的なリビジョン競合になります。空のドラフトをコミットしても履歴エントリーは増えません。

## コミット済みスナップショットをレンダリングする

編集をコミットした後にスナップショットを取得します。スナップショットは取得時点の状態を保持するため、その後にセッションを編集しても実行中のレンダリングは変わりません。`range` を省略すると出力全体をレンダリングし、半開区間を指定するとプレビューになります。範囲の境界は `startSample` / `endSample` または `startSec` / `endSec`（どちらか一方の表記で、最も近いサンプルに丸められます）で指定します。開始を省略すると 0、終了を省略すると出力の末尾になり、負の境界は拒否されます。Python では `render()` と `begin_render_job()` が `VocalRange`、`(start, end)` のペア、または `start_sec=` / `end_sec=` キーワードを受け取ります。

```typescript
const snapshot = session.captureRenderSnapshot();
try {
  const full = snapshot.render({
    range: { startSample: 0, endSample: session.outputLengthSamples() },
    requestId: '1',
  });
  console.log(full.samples.length, full.startSample, full.token.revision);

  const controller = new AbortController();
  const preview = await snapshot.renderAsync({
    range: { startSample: 64, endSample: 320 },
    requestId: '2',
    signal: controller.signal,
  });
  console.log(preview.processedRanges);
} finally {
  snapshot.dispose();
}
```

`renderAsync()` はネイティブの作業単位の間で制御を返し、シグナルが中断された場合は部分的な PCM を公開しません。プル方式でスケジュールする場合は `beginRenderJob()` を使い、`complete` が true になるまで `next()` を呼び、最後に `finalize()` を呼びます。停止するときは `abort()` を呼びます。レンダリング結果には処理済み範囲、キャッシュヒット数、ドライパスしたフレーム数、補正上限に達したフレーム数が含まれます。

## セッションを永続化して復元する

`exportState()` はコミット済みの編集状態を SVE1 バイト列としてシリアライズします。ソース PCM、実行時キャッシュ、ドラフト、アンドゥ履歴は含まれません。元と同じモノラルソースおよびサンプルレートで復元し、ソースの記述子とダイジェストの検査を通過させます。Python では `restore_vocal_edit_session(samples, sample_rate, state, *, max_history_bytes=..., max_cache_bytes=..., max_undo_depth=..., max_render_jobs=...)` または同じ引数の `VocalEditSession.restore(...)` で復元し、上限の既定値はセッション作成時のものです。

```typescript
import { restoreVocalEditSession } from '@libraz/libsonare';

const state = session.exportState();
const restored = restoreVocalEditSession({
  samples,
  sampleRate,
  state,
  limits: { maxUndoDepth: 64, maxRenderJobs: 2 },
});

try {
  console.log(restored.revision(), restored.history());
} finally {
  restored.dispose();
}
```

実行時の制限は作成時または復元時に指定できます。既定値は履歴 64 MiB、レンダリングキャッシュ 128 MiB、アンドゥ 128 エントリー、同時レンダリングジョブ 4 件です。ホストのメモリとスケジュール予算に合わせて制限を設定してください。レンダリングジョブ制限を 0 にするとセッションの作成が拒否され、ジョブ枠が埋まっている間は新しいジョブが拒否されます。

## 専用 Worker でセッションを実行する

ブラウザ／WASM パッケージは `VocalEditWorkerClient` を公開します。コンストラクターのオプションを省略すると、`./vocal_edit_worker.js` のモジュール Worker を作成します。バンドラーが別の URL にアセットを出力する場合は `workerUrl` を、Worker を自分で用意する場合は `workerFactory` を渡してください。ブラウザの Worker のほか、`node:worker_threads` の Worker も使えます。

```typescript
import { VocalEditWorkerClient } from '@libraz/libsonare';

const client = new VocalEditWorkerClient();
const controller = new AbortController();
const task = client.create(
  { samples, sampleRate },
  { copy: true, signal: controller.signal },
);

try {
  const workerSession = await task;
  const preview = workerSession.preview({
    range: { startSample: 0, endSample: 1024 },
    signal: controller.signal,
  });
  const result = await preview;
  console.log(result.samples.length);
  await workerSession.dispose();
} finally {
  client.dispose();
}
```

`client.restore(request)` は、`create` と同様に永続化した状態から Worker セッションを開きます。返される `VocalEditWorkerSession` のメソッドは、キャンセル可能なタスクを返します。読み取り（`notes()`、`analysis()`、`capabilities()`、`history()`、`evaluatePitch()`）、ドラフト操作（`beginEdit()`、`apply()`、`commit()`、`cancel()`、`undo()`、`redo()`）、`exportState()`、`preview()`、`dispose()` があります。`preview({ range: { startSec: 0.1, endSec: 0.2 } })` は、直接レンダリングと同じ秒またはサンプルの範囲を受け取ります。

型付き配列のバッファは既定値（`copy: false`）で転送され、呼び出し側のスレッドでは切り離されます。`samples`、永続化した状態、状態変更要求内の配列を呼び出し側でも使い続ける場合は `copy: true` を指定します。`AbortSignal` と `VocalEditWorkerTask.cancel()` は作成・復元・プレビューをキャンセルします。セッションの状態変更は FIFO で実行され、キャンセルできないため、UI の書き込みを直列化し、期待リビジョンまたは世代を使います。最新の意図と一致しないパイプライン応答は `VocalEditWorkerStaleResultError` で拒否されるため、UI の状態は最新の受理済み結果だけで更新します。

## ボーカル編集を Project に適用する

コミット済みセッションからソース全体をレンダリングし、そのレンダリング結果と SVE1 状態を対応するオーディオクリップへ関連付けます。Project アダプターは、派生ソースとボーカルサイドカーを作る前に、ソース ID、サンプルレート、サンプル数、ソースダイジェスト、クリップ長、ソースオフセット、コミット済みレンダリングトークンを検査します。

```typescript
import { Project } from '@libraz/libsonare';

const project = Project.create();
try {
  project.setSampleRate(sampleRate);
  const trackId = project.addTrack({ kind: 'audio', name: 'lead-vocal' });
  const clipId = project.addClip({
    trackId,
    startPpq: 0,
    lengthPpq: 4,
    audio: samples,
    audioChannels: 1,
    audioSampleRate: sampleRate,
  });
  const sourceId = project.sourceByIndex(0).id;
  const analysis = session.analysis();
  const snapshot = session.captureRenderSnapshot();
  let rendered;
  try {
    rendered = snapshot.render({
      range: { startSample: 0, endSample: session.outputLengthSamples() },
    }).samples;
  } finally {
    snapshot.dispose();
  }

  const result = project.applyVocalEdit({
    clipId,
    expectedSourceId: sourceId,
    expectedSourceSampleRate: sampleRate,
    expectedSourceSampleCount: samples.length,
    expectedSourceSha256: analysis.sourceSha256,
    expectedClipLengthPpq: 4,
    expectedSourceOffsetPpq: 0,
    renderedMono: rendered,
    renderedSampleRate: sampleRate,
    renderToken: session.token(),
    sve1: session.exportState(),
  });
  console.log(result.derivedSourceId, result.sidecarKey);
} finally {
  project.delete();
}
```

v1 のアダプターには、サンプル 0 から始まるソース全体のモノラルのレンダリング結果と、開いたドラフトを持たないコミット済みトークンが必要です。ループモード、ワープ参照、コンプセグメント、未対応のレンダリングパーツを使うクリップは拒否されます。現在のソースがすでに派生ソースであるクリップを再編集するときは、元のルートソースが解決されます。依存関係を保つため、そのルートを元にしたセッションから状態をエクスポートして適用してください。

## 依存関係を調べ、読み込み後に再ハイドレートする

`getVocalEditDependencies()` は、各クリップ／テイクのサイドカー、元と派生のソース ID、コミット済みリビジョン、ダイジェスト、PCM の利用可能性を列挙します。Project のクリップ複製・分割・アンドゥ／リドゥ・互換性のあるソース／テイクの再バインドではサイドカーの関係が保たれます。クリップを削除するとサイドカーも削除され、解決されるソースが変わる再バインドでは対象のサイドカーが整理されます。

Project JSON はサイドカーのメタデータと SVE1 状態を保持しますが、読み込んだプロジェクトの元または派生 PCM はメモリにないことがあります。読み込み後に元ソースのバッファを `rehydrateVocalEdits()` へ渡してください。再ハイドレートは永続化された状態と元ソースから不足している派生 PCM を再レンダリングし、処理が成功するまで結果をステージし、実行中にプロジェクトが変わっていないことを検査します。

```typescript
const json = project.toJson();
const loaded = Project.fromJson(json);
try {
  const dependencies = loaded.getVocalEditDependencies();
  const outcomes = loaded.rehydrateVocalEdits([
    { sourceId: dependencies[0].originalSourceId, mono: samples, sampleRate },
  ]);
  console.log(outcomes[0].status); // 0 再ハイドレート済み、1 準備済み、2 未解決
} finally {
  loaded.delete();
}
```

キャンセルコールバックは依存関係の項目間で検査され、真（truthy）を返すと処理を停止します。プロジェクトの変更、ネストした `apply`、ネストした再ハイドレートは操作を無効にするため、再ハイドレートは 1 つの制御スレッドトランザクションとして実行し、構造編集後には依存関係を読み直します。

## エディターに表示する制限

- セッションはモノフォニックです。`capabilities().monophonicOnly` を確認し、`minimumFormantShiftSemitones` と `maximumFormantShiftSemitones` が返すフォルマント範囲を表示してください。
- ソースのサンプルレートは 8,000 Hz 以上 384,000 Hz 以下です。v1 アダプターでは Project のレンダリングレートをソースレートと一致させます。
- リビジョン、世代、リクエスト ID、バイト数の上限は 10 進文字列です（[10 進文字列](#ドラフトとして編集を適用する)を参照）。競合し得る書き込みには、期待リビジョンと世代を渡します。
- 状態の永続化にはソース PCM とアンドゥ履歴が含まれません。元ソースまたはコンテンツアドレスで同一性を確認できるデータをプロジェクト JSON と一緒に保存します。
- Worker クライアントはブラウザ、または `node:worker_threads` の Worker 上で動きます。直接のセッションは呼び出し側スレッドで同期実行されるため、長いレンダリングとキャンセルには `renderAsync()` または Worker を使います。

## 関連

- [プロジェクト & アレンジ編集](./project-editing.md) — コミット済みボーカルのレンダリング結果をオーディオクリップへ配置
- [プロジェクトの保存と読み込み](./project-save-load.md) — プロジェクトソースをシリアライズして再バインド
- [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) — リアルタイム経路で入力を処理
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの API 差分
- [歌のピッチを直す](./use-cases/vocal-tuning.md) — 歌のテイクを測り、全体のスケール補正とノート単位の補正を比べ、ビブラートを残す
