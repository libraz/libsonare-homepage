---
title: オフライン単旋律ボーカル編集
description: libsonare のオフライン単旋律ボーカルセッション API を実用的に解説。解析、ピッチ編集、ドラフト、アンドゥ／リドゥ、レンダリング、永続化、Worker 実行、Project への適用を扱います。
---

# オフライン単旋律ボーカル編集

ボーカル編集 API は、モノラル録音 1 つを編集可能なノートモデルへ変換します。ソースを解析してノートのピッチと時間を公開し、ピッチ・フォルマント・振幅の編集をトランザクションとして適用し、オーディオデバイスやリアルタイムエンジンなしで編集済みソースをレンダリングします。Node、ブラウザ／WASM、Python のバインディングは同じセッションモデルを公開します。

オフラインで補正するボーカルテイクには `VocalEditSession` を使います。結果をアレンジへ配置する場合は、セッションと `Project.applyVocalEdit()` を組み合わせます。この API が受け付けるのは単旋律の 1 ラインです。重なった声を分離したり、ポリフォニックソースの編集を置き換えたりするものではありません。リアルタイム入力には[リアルタイムボイスチェンジャー](./realtime-voice-changer.md)を使います。

ボーカル編集サーフェスは Node、ブラウザ／WASM、Python のバインディングから利用します。libsonare CLI には対応するボーカル編集サブコマンドがありません。

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
  caption="セッションから解析結果を読み、編集をリビジョンとしてコミットし、コミット済みのレンダーを Project に関連付けます。"
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

利用可否は `vocalEditAvailable()` で確認し、API バージョンは `vocalEditApiVersion()`（Python は `vocal_edit_api_version()`、C は `sonare_vocal_edit_api_version`）で読めます。`session.capabilities().apiVersion` も同じカウンターを返します。これはエンジンの ABI カウンターとは別です。セッション、ドラフト、スナップショット、レンダージョブはそれぞれ `dispose()`、`delete()`、`destroy()` でハンドルを解放でき、`Symbol.dispose` にも対応するため、明示的リソース管理が使えるランタイムでは `using session = createVocalEditSession(...)` と書けます。

`session.notes()` はノートとピッチ遷移を返します。ノートにはソース範囲、解析フレーム範囲、中央値周波数、中心 MIDI ノート、ピッチの安定度、振幅サンプル、現在の編集が含まれます。`session.analysis()` は F0 と有声音配列、解析グリッド、アルゴリズムのメタデータ、ソースダイジェスト、設定を返します。`session.capabilities()` ではプロファイル、単旋律の制約、読み込んだプロファイルが解析キャンセルに対応するか、利用できるフォルマントシフト範囲を調べられます。UI にプロファイルの制限を埋め込まず、これらの値を読み取ってください。

リビジョン、世代、リクエスト ID、バイト数の上限（`maxHistoryBytes` と `maxCacheBytes`）は、JavaScript 境界を越えるときに 10 進文字列（`VocalUint64`）になります。これらの値は文字列のまま扱います。`maxUndoDepth` と `maxRenderJobs` は数値です。Python バインディングではメソッド名が snake_case になり、これらのカウンターは Python の整数として公開され、`with` ブロックの終了時にセッションが閉じられます。`evaluatePitch(noteId)` はノートの実測・ターゲット・有効ピッチ・有声音の配列を返し、座標変換メソッドは時間編集後のソースサンプルと出力サンプルを相互変換します。

## ドラフトとして編集を適用する

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

`setSourceSpan` と `split` の位置は、サンプルまたは秒のどちらか一方の表記で指定します（`sourceSample` / `sourceSec`、および `sourceStartSample` / `sourceStartSec`、`sourceEndSample` / `sourceEndSec`、`destinationStartSample` / `destinationStartSec`、`destinationLengthSamples` / `destinationLengthSec`）。秒はセッションのサンプルレートで最も近いサンプルに丸められます。同じ位置に両方の表記を渡すと拒否され、負の位置も拒否されます。`merge` は `noteIds` と、省略可能な `policy`（`'preserve'` または `'reset'`）を取ります。

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

編集をコミットした後にスナップショットを取得します。スナップショットは取得時点の状態を保持するため、その後にセッションを編集しても実行中のレンダーは変わりません。`range` を省略すると出力全体をレンダリングし、半開区間を指定するとプレビューになります。範囲の境界は `startSample` / `endSample` または `startSec` / `endSec`（どちらか一方の表記で、最も近いサンプルに丸められます）で指定します。開始を省略すると 0、終了を省略すると出力の末尾になり、負の境界は拒否されます。Python では `render()` と `begin_render_job()` が `VocalRange`、`(start, end)` のペア、または `start_sec=` / `end_sec=` キーワードを受け取ります。

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

`renderAsync()` はネイティブの作業単位の間で制御を返し、シグナルが中断された場合は部分的な PCM を公開しません。プル方式でスケジュールする場合は `beginRenderJob()` を使い、`complete` が true になるまで `next()` を呼び、最後に `finalize()` を呼びます。停止するときは `abort()` を呼びます。レンダー結果には処理済み範囲、キャッシュヒット数、ドライパスしたフレーム数、補正上限に達したフレーム数が含まれます。

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

実行時の制限は作成時または復元時に指定できます。既定値は履歴 64 MiB、レンダーキャッシュ 128 MiB、アンドゥ 128 エントリー、同時レンダージョブ 4 件です。ホストのメモリとスケジュール予算に合わせて制限を設定してください。レンダージョブ制限を 0 にするとセッションの作成が拒否され、ジョブ枠が埋まっている間は新しいジョブが拒否されます。

## 専用 Worker でセッションを実行する

ブラウザ／WASM パッケージは `VocalEditWorkerClient` を公開します。コンストラクターのオプションを省略すると、`./vocal_edit_worker.js` のモジュール Worker を作成します。バンドラーが別の URL にアセットを出力する場合は `workerUrl` を渡してください。

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

型付き配列のバッファは既定値（`copy: false`）で転送され、呼び出し元のスレッドでは切り離されます。`samples`、永続化した状態、状態変更要求内の配列を呼び出し元でも使い続ける場合は `copy: true` を指定します。`AbortSignal` と `VocalEditWorkerTask.cancel()` は作成・復元・プレビューをキャンセルします。セッションの状態変更は FIFO で実行され、キャンセルできないため、UI の書き込みを直列化し、期待リビジョンまたは世代を使います。最新の意図と一致しないパイプライン応答は `VocalEditWorkerStaleResultError` で拒否されるため、UI の状態は最新の受理済み結果だけで更新します。

## ボーカル編集を Project に適用する

コミット済みセッションからソース全体をレンダリングし、そのレンダーと SVE1 状態を対応するオーディオクリップへ関連付けます。Project アダプターは、派生ソースとボーカルサイドカーを作る前に、ソース ID、サンプルレート、サンプル数、ソースダイジェスト、クリップ長、ソースオフセット、コミット済みレンダートークンを検査します。

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

v1 のアダプターには、サンプル 0 から始まるソース全体のモノラルレンダーと、開いたドラフトを持たないコミット済みトークンが必要です。ループモード、ワープ参照、コンプセグメント、未対応のレンダーパーツを使うクリップは拒否されます。現在のソースがすでに派生ソースであるクリップを再編集するときは、元のルートソースが解決されます。依存関係を保つため、そのルートを元にしたセッションから状態をエクスポートして適用してください。

## 依存関係を調べ、読み込み後に再ハイドレートする

`getVocalEditDependencies()` は、各クリップ／テイクのサイドカー、元と派生のソース ID、コミット済みリビジョン、ダイジェスト、PCM の利用可能性を列挙します。Project のクリップ複製・分割・アンドゥ／リドゥ・互換性のあるソース／テイクの再バインドではサイドカーの関係が保たれます。クリップを削除するとサイドカーも削除され、解決されるソースが変わる再バインドでは対象のサイドカーが整理されます。

Project JSON はサイドカーのメタデータと SVE1 状態を保持しますが、読み込んだプロジェクトの元または派生 PCM はメモリにないことがあります。読み込み後に元ソースのバッファを `rehydrateVocalEdits()` へ渡してください。再ハイドレートは永続化された状態と元ソースから不足している派生 PCM を再レンダーし、処理が成功するまで結果をステージし、実行中にプロジェクトが変わっていないことを検査します。

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

- セッションは単旋律です。`capabilities().monophonicOnly` を確認し、`minimumFormantShiftSemitones` と `maximumFormantShiftSemitones` が返すフォルマント範囲を表示してください。
- ソースのサンプルレートは 8,000 Hz 以上 384,000 Hz 以下です。v1 アダプターでは Project のレンダーレートをソースレートと一致させます。
- リビジョン、ドラフト世代、リクエスト ID、バイト数の上限は 10 進の `VocalUint64` 文字列です。アンドゥの深さとレンダージョブ数の上限は数値です。制御スレッドの操作が競合し得る書き込みには `expectedRevision` と `expectedGeneration` を渡します。
- 状態の永続化にはソース PCM とアンドゥ履歴が含まれません。元ソースまたはコンテンツアドレスで同一性を確認できるデータをプロジェクト JSON と一緒に保存します。
- Worker はブラウザ／WASM の実行経路です。直接のセッションは呼び出し元スレッドで同期実行されるため、長いレンダーとキャンセルには `renderAsync()` または Worker を使います。

## 関連

- [プロジェクト & アレンジ編集](./project-editing.md) — コミット済みボーカルレンダーをオーディオクリップへ配置
- [プロジェクトの保存と読み込み](./project-save-load.md) — プロジェクトソースをシリアライズして再バインド
- [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) — リアルタイム経路で入力を処理
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの API 差分
