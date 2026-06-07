---
title: 録音・テイク・コンピング
description: libsonare のリアルタイムエンジンからの音声キャプチャ、ブラウザのマイク入力、プロジェクトクリップへのループテイク録音、テイクをまたいだコンピング、録音波形の描画を、そのまま使えるレシピつきで解説します。
---

# 録音・テイク・コンピング

**このページは、ライブの音をプロジェクトへ取り込み、いくつもの不完全な演奏を 1 本の良い演奏に仕上げる方法を扱います。** **録音**は、ライブの音声（ボーカル、ギターの DI（アンプをマイクで拾わず直結）、シンセの演奏など）を、保存・編集・配置できるバッファへ取り込む作業です。**コンピング**（compilation の略）はその後の工程で、同じパートを複数の**テイク**として録り、各テイクの良い瞬間をつなぎ合わせて 1 本の決定版を組み立てます。何枚かの集合写真から、それぞれの一番良い表情を選んで 1 枚の完璧な集合写真を作るようなものです。

libsonare はこれを協調する 2 つの層に分けています。[リアルタイムエンジン](./realtime-streaming.md)はライブの**キャプチャ経路**（アーミング、キャプチャバッファ、入力モニタリング、パンチイン／アウト＝選んだ範囲だけを録り直し、テイクの残りには触れない）を担います。[プロジェクトモデル](./project-editing.md)はその*結果*を担い、**テイク**と**コンプセグメント**を持つクリップを、編集コンパイラが 1 本の連続した演奏としてレンダリングします。

::: info 2 つのクロック、2 つの層
キャプチャ経路は音声スレッド上で**サンプル**単位で動きます。プロジェクトは **PPQ**（音楽的位置）で動き、PPQ の 1 単位は 4 分音符 1 つ分です。つまり 120 BPM では `ppq: 1` が 0.5 秒です。録音はサンプルで行い、結果は拍で記述します。この 2 つを取り違えなければ、以降の内容はすべて素直に理解できます。
:::

::: info テイクとコンプ
**テイク**は 1 回分の録音です。**コンプ**は、複数テイクの良い部分をつなげた決定版です。libsonare では元のテイクをクリップ内に残し、コンプセグメントが PPQ 範囲ごとに「どのテイクを鳴らすか」だけを選びます。
:::

::: tip パイプライン内での録音の位置
**録音**で音声を取り込み、**編集**でタイミングとピッチを直し、**ミキシング**で複数トラックのバランスを取り、**マスタリング**でステレオ結果を磨きます。本ページは最初の工程と、テイクの山を 1 つの使えるクリップに変えるコンピング作業を扱い、その後は [プロジェクト編集](./project-editing.md) へ引き継ぎます。
:::

## マイクからコンプ済みクリップまで

録音はリアルタイム層とプロジェクト層をまたぎます。エンジンがサンプルをキャプチャし、プロジェクトがそのサンプルをテイクとコンプ指示として保持します。

```mermaid
flowchart LR
  A[マイクまたはエンジン出力] --> B[RealtimeEngine のキャプチャバッファ]
  B --> C[capturedAudio()]
  C --> D[Project.addLoopRecordingTakes]
  D --> E[クリップのテイク]
  E --> F[コンプセグメント]
  F --> G[compile() / bounce()]
```

音声コールバック内で `Project` の編集メソッドを呼ばないでください。まずリアルタイムエンジンで録音し、テイクが終わってからメイン／制御スレッドでプロジェクトを更新します。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- エンジンのキャプチャバッファをサイズ指定してアームし、キャプチャソースを選び、録音した音声を読み戻す。
- 録音オフセットで往復レイテンシを補償し、入力モニタリングで自分の演奏を聞く。
- パンチイン／アウトで選んだ範囲だけを録音する。
- `bindMicrophoneInput` でブラウザのマイクを開き、正しく後始末する。
- `addLoopRecordingTakes` でキャプチャしたループをテイクに分割し、`setClipTakes` / `setClipCompSegments` でテイクをまたいでコンピングする。
- `waveformPeaks` と `waveformPeakPyramid` で録音波形を描画する。

## キャプチャ経路

リアルタイムエンジンは、事前に確保した**キャプチャバッファ**へ録音します。バッファを確保し、かつキャプチャを**アーム**するまでは何も記録されません。アームしている間、各 `process(...)` ブロックがバッファへ追記します。

エンジンは Node でも動くため、以下のキャプチャ経路はブラウザの外でも検証できます。ブラウザが必要なのはマイクの節だけです。

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const sampleRate = 48000;
const engine = new RealtimeEngine(sampleRate, /* maxBlockSize */ 128);
try {
  engine.setCaptureBuffer(/* numChannels */ 2, /* capacityFrames */ sampleRate * 10); // 10 秒分
  engine.armCapture();           // 次に処理するブロックから追記を開始
  engine.play();

  // ブロック単位でエンジンを駆動する（実アプリでは音声コールバック内）
  engine.process([blockL, blockR]);

  const status = engine.captureStatus();
  // { capturedFrames, overflowCount, armed, punchEnabled, source, recordOffsetSamples }

  const channels = engine.capturedAudio(); // Float32Array[] — チャンネルごとに 1 本
} finally {
  engine.destroy();              // WASM ハンドルは GC されない — 必ず解放する
}
```

::: danger エンジンは必ず解放する
`RealtimeEngine` はすべての embind オブジェクトと同様、JavaScript の GC では回収できない WASM ヒープハンドルを保持します。`finally` ブロックで `engine.destroy()` を呼んでください。ハンドルをリークすると、長時間のセッションで WASM メモリが徐々に枯渇します。
:::

### キャプチャバッファのサイズ指定

`setCaptureBuffer(numChannels, capacityFrames)` は、音声スレッドがテイク途中で確保しないように録音領域を事前確保します。想定する最長テイクに合わせて `capacityFrames = 秒数 * sampleRate` でサイズを決めてください。テイクが容量を超えると、エンジンは追記を止め、捨てたフレーム数を `captureStatus().overflowCount` に数えます。これが 0 でなければ容量不足なので、より大きなバッファを確保してください。

### アーミングとキャプチャステータス

`armCapture(armed?)` は録音を切り替えます。引数なし（または `true`）でアーム、`armCapture(false)` で、これまでの内容を捨てずに追記だけ止めます。`resetCapture()` は記録済みフレームを 0 に戻し、次のテイクをまっさらから始めます。進捗はいつでも `captureStatus()` で読めます。

| フィールド | 意味 |
|-----------|------|
| `capturedFrames` | これまでに記録したフレーム数 |
| `overflowCount` | バッファが満杯で捨てたフレーム数（0 が健全） |
| `armed` | 現在追記中かどうか |
| `punchEnabled` | パンチイン／アウト範囲が有効かどうか |
| `source` | `'output'` か `'input'` — 何をキャプチャしているか |
| `recordOffsetSamples` | 有効な録音オフセット補償 |

### キャプチャソース: 出力バスかライブ入力か

`setCaptureSource('output' | 'input')` は、エンジンが*何を*録音するかを選びます。

- **`'output'`**（既定）はエンジンのレンダリング済み出力バス、つまり実際に聞こえる音（再生中のクリップや楽器を含む）をキャプチャします。アレンジのライブ演奏をバウンスするのに使います。
- **`'input'`** は `process(...)` に渡した生の音声、つまりマイクや楽器からのライブ信号をキャプチャします。新しいパートを録るのに使います。

### 録音オフセット補償

ライブモニタリング経路にはレイテンシがあります。演奏者がクリックを聞いて音を出す頃には、エンジンはすでに先へ進んでいます。`setRecordOffsetSamples(offsetSamples)` は、キャプチャした音声をタイムラインに合わせて再びそろえるようにシフトします。負のオフセットは録音を前へ引きます（往復レイテンシを打ち消す通常の向き）。有効な値は `captureStatus().recordOffsetSamples` に反映されます。

### 入力モニタリング

`setInputMonitor(enabled, gain?)` は、演奏者が自分の音を聞けるように、ライブ入力をエンジンの出力へ混ぜるかどうかを決めます。`setInputMonitor(true, 0.5)` は入力を半分のレベルで通し、`setInputMonitor(false)` は無音で録音します（二重モニタリングのレイテンシを避けるため、演奏者がハードウェア側でモニタリングする場合に便利です）。モニタリングはキャプチャソースとは独立しているので、入力をモニタリングしながら出力バスをキャプチャする、あるいはその逆も可能です。

### パンチイン／アウト

パンチ録音は、選んだタイムライン範囲の内側だけでキャプチャをアームし、その外側にある確定テイクには手を触れません。`setCapturePunch(startSample, endSample, enabled?)` は入／出ポイントをタイムラインサンプルで設定し、`punchEnabled` が true の間は、トランスポート（動いている再生位置）が `[startSample, endSample)` の内側にあるときだけ追記します。`enabled: false`（または `resetCapture()`）で範囲を解除し、自由録音へ戻ります。

:::: details パートを録ってから読み戻す
```typescript
const engine = new RealtimeEngine(48000, 128);
try {
  engine.setCaptureBuffer(1, 48000 * 8);   // モノラル、最大 8 秒
  engine.setCaptureSource('input');         // ミックスではなくライブ信号を録音
  engine.setRecordOffsetSamples(-256);      // 約 256 フレームのモニタリングレイテンシを打ち消す
  engine.setInputMonitor(true, 1.0);        // 演奏者に自分の音を聞かせる
  engine.armCapture();
  engine.play();

  // ... engine.process([micBlock]) でライブ入力ブロックを供給 ...

  const [mono] = engine.capturedAudio();    // 録音したテイクが Float32Array で得られる
} finally {
  engine.destroy();
}
```
::::

## ブラウザのマイク入力

ブラウザでは、`bindMicrophoneInput(audioContext, engine, options?)` が `getUserMedia` のマイクストリームをリアルタイムエンジンノードへ配線し、後でクローズできるバインディングを返します。これは**ブラウザ専用**で、ライブの `AudioContext` と WebAudio グラフが必要です。`SharedArrayBuffer` なしで動きます（COOP/COEP ヘッダー不要）。

```typescript
// ブラウザ専用 — ライブの AudioContext を持つページ内で動作する
const binding = await bindMicrophoneInput(audioContext, engineNode, {
  // MediaStreamConstraints のフィールドはそのまま getUserMedia へ渡される
  audio: { echoCancellation: false, noiseSuppression: false, channelCount: 1 },
  // すでに開いたストリームを再利用することもできる
  // stream: existingMediaStream,
  stopTracksOnClose: true,   // 既定値。クローズ時にマイクトラックを停止する
});

// binding.stream  -> ライブの MediaStream
// binding.source  -> エンジンへ供給する MediaStreamAudioSourceNode

// テイクが終わったら
binding.close();             // ソースを切断する（stopTracksOnClose ならトラックも停止）
```

オプションオブジェクトは **`MediaStreamConstraints` を継承**しているので、`getUserMedia` に渡せる制約（`echoCancellation`・`noiseSuppression`・`channelCount`、デバイスの `deviceId` などを持つ `audio` オブジェクト）はそのまま通ります。追加の 2 フィールドが libsonare 独自です。

- **`stream`** — 新規に許可を求める代わりに、すでに取得済みの `MediaStream` を再利用します。
- **`stopTracksOnClose`** — 既定は `true` です。true のとき、`binding.close()` が背後のマイクトラックも停止し、OS の録音インジケーターを消します。自分で所有する `stream` を渡し、他所でも使い続けたい場合は `false` にしてください。

::: warning 終わったらバインディングをクローズする
`binding.close()` はソースノードを切断し、マイクがエンジンへ供給するのを止めます。`bindMicrophoneInput` には必ず `close()` を組にしてください（通常はユーザーが録音を止めたとき、またはコンポーネントのアンマウント時）。既定ではマイクトラックも停止するため OS の録音インジケーターが消えます。同じストリームをアプリの別部分で使い続ける場合だけ `stopTracksOnClose: false` を渡してください。
:::

周辺の AudioWorklet 配線（エンジンノードの構築、ワークレットプロセッサの登録、SAB なしのリアルタイム経路）は [リアルタイムストリーミング](./realtime-streaming.md) を参照してください。外部マイクではなくシンセやサンプラーを録音へ*入れたい*場合は、[NativeSynth](./native-synth.md) と [SoundFont プレイヤー](./soundfont-player.md)、ライブ演奏で鳴らすなら [MIDI 入力](./midi-input.md) を参照してください。

## ループ録音からテイクへ

ループ録音は、演奏しながら同じ音楽的範囲を何度も繰り返し、1 周ごとに 1 つの**テイク**をキャプチャします。`Project.addLoopRecordingTakes(desc)` は、全周分を*連結した*キャプチャ音声を受け取り、1 本の新しいクリップ上の周回ごとのテイクへ分割します。

```typescript
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
try {
  const sampleRate = 48000;
  project.setSampleRate(sampleRate);
  const trackId = project.addTrack({ kind: 'audio', name: 'vocal' });

  // 120 BPM での 4 分音符 4 つ分のループは 4 * (60 / 120) = 2 秒。
  // したがって 3 周には 3 * 2 秒の音声が必要。
  const loopLengthQuarters = 4;
  const passes = 3;
  const passSamples = Math.round((loopLengthQuarters * 60 / 120) * sampleRate); // 96000
  const recorded = new Float32Array(passes * passSamples);                       // 連結したテイク

  const result = project.addLoopRecordingTakes({
    trackId,
    startPpq: 0,
    loopLengthPpq: loopLengthQuarters,   // ループ長（4 分音符単位）
    audio: recorded,
    audioChannels: 1,
    audioSampleRate: sampleRate,
  });
  // result -> { clipId, takeCount: 3 }
} finally {
  project.delete();
}
```

::: warning 主張するテイク数に見合う音声を渡す
`loopLengthPpq` は 4 分音符単位なので、その長さはテンポに依存します。4 分音符 4 つ分のループは 120 BPM で 2 秒、60 BPM では 4 秒です。先にプロジェクトのテンポを設定し、そこから周回ごとのサンプル数を求め、`passes * passSamples` フレームを渡してください。これより少ないと、期待より少ないテイクしか得られません。
:::

この呼び出しは、ループの各周回を別テイクとして持つクリップを 1 本追加し、**アクティブテイク**を最後の完全な周回に設定します。ここからテイクをまたいでコンピングします。

## テイクとコンプセグメント

クリップは、順序づけられた**テイク**のリストに加えて、**アクティブテイク ID**（コンプの指定がないとき再生されるテイク）と**コンプセグメント**のリスト（PPQ 範囲ごとに、そこで再生するテイクを指す）を持てます。どちらも取り消し可能な編集で、どちらも JSON でラウンドトリップします。

```typescript
// takes: 各テイクは安定した id を持つ。sourceOffsetPpq はテイクのソースをクリップ下でずらす。
project.setClipTakes(clipId, [
  { id: 1, name: 'take A' },
  { id: 2, sourceOffsetPpq: 0, name: 'take B' },
], /* activeTakeId */ 2);

// comp segments: 各 PPQ 範囲が 1 つのテイクを選ぶ。ヴァースは A、コーラスは B。
project.setClipCompSegments(clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },
  { startPpq: 2, endPpq: 4, takeId: 2 },
]);
```

`ProjectClipTake` は `{ id, sourceId?, sourceOffsetPpq?, name? }`、`ProjectClipCompSegment` は `{ startPpq, endPpq, takeId? }` です。テイク id は一意でなければならず、コンプセグメントが参照する `takeId` はすべて存在していなければなりません。どちらの規則も違反すると例外を投げるので、不正な編集はクリップを壊すのではなく、はっきり失敗します。

::: tip アクティブテイクとコンプセグメント
**アクティブテイク**は、コンプセグメントがないときに再生される唯一のテイクです（まだ試聴している段階で便利です）。**コンプセグメント**はこれを範囲ごとに上書きします。セグメントが位置を覆っていれば、その `takeId` が勝ち、どのセグメントの外側でもアクティブテイクが埋めます。コンプはアクティブテイクを置き換えるのではなく、その上にセグメントを足して組み立ててください。
:::

### 編集コンパイラがコンプをどうレンダリングするか

プロジェクトを `compile()`（またはレンダリング）すると、編集コンパイラはクリップのタイムラインをたどり、各位置についてどのテイクの音声を読むかを解決します。その位置を覆うコンプセグメントがあればそのテイク、なければアクティブテイクです。各テイクのソースはそれぞれの `sourceOffsetPpq` で読まれるので、少し遅れて録れたテイクも、録り直さずに位置へ寄せられます。こうしてコンパイル済みのタイムラインは、多数のテイクから組み立てた 1 本の継ぎ目ない演奏として再生されます。コンプは*ビュー*であり、元のテイクはそのまま残って後で組み直せます。

### JSON ラウンドトリップ

`project.toJson()` はテイク、アクティブテイク、コンプセグメントをシリアライズします（`"takes"`・`"active_take_id"`・`"comp_segments"`）。`Project.fromJson(json)` がそれらを復元します。コンピングはテイク上の非破壊メタデータなので、プロジェクトを保存して読み直しても、すべての別テイクとコンプが保たれます。セッションをまたいでコンプを練り続けられます。

:::: details 2 つのテイクをコンプして保存
```typescript
project.setClipTakes(clipId, [
  { id: 1, name: 'take A' },
  { id: 2, name: 'take B' },
], 1);
project.setClipCompSegments(clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },   // 前半は take A
  { startPpq: 2, endPpq: 4, takeId: 2 },   // 後半は take B
]);

const json = project.toJson();             // "takes" と "comp_segments" を含む
const restored = Project.fromJson(json);   // コンプはラウンドトリップで保たれる
restored.delete();
```
::::

## 録音波形を描く

テイクを描くとき、全サンプルをプロットはしません。音声をバケットごとの **min/max** 対へ縮約し、それを塗りつぶしのエンベロープとして描きます。`waveformPeaks(samples, channels, options?)` が*インターリーブ*音声からこの縮約を行います。

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// インターリーブステレオ: L, R, L, R, ...
const interleaved = new Float32Array([
  -1.0, 0.5, 0.25, -0.25, 0.75, 0.1, -0.5, -0.75, 0.0, 0.9,
]);

const report = waveformPeaks(interleaved, 2, { samplesPerBucket: 2 });
// report = {
//   channels: 2,
//   bucketCount: 3,
//   samplesPerBucket: 2,
//   min: Float32Array [ -1, -0.5, 0,  -0.25, -0.75, 0.9 ],  // チャンネルメジャー
//   max: Float32Array [ 0.25, 0.75, 0,  0.5,  0.1,   0.9 ],
// }
```

`min` と `max` の配列は**チャンネルメジャー**です。チャンネル 0 の全バケット、続いてチャンネル 1 の全バケットの順に並びます。`channels` と `bucketCount` を使えば、チャンネル `c` のバケット `b` は `report.min[c * report.bucketCount + b]` で参照できます。`samplesPerBucket` を省略すると、バケットあたり 512 フレームが既定値になります。

ズーム可能な表示には、`waveformPeakPyramid(samples, channels, options?)` がレポート 1 つではなくズームレベルごとに 1 つずつレポートを返します。

```typescript
const pyramid = waveformPeakPyramid(interleaved, 2, { samplesPerBucketLevels: [2, 4] });
// pyramid.length === 2
// pyramid[0].samplesPerBucket === 2  (細かい — バケットが多くズームイン)
// pyramid[1].samplesPerBucket === 4  (粗い — バケットが少なくズームアウト)
```

各レベルは完全な `WaveformPeaksReport` です。オプションなしの場合、ピラミッドは標準のズームセット `[512, 1024, 2048, 4096]` フレーム／バケットを使うので、ユーザーのズームに合わせて、毎フレームのピーク再計算なしに詳細度を切り替えられます。

::: tip キャプチャ音声から描く
`capturedAudio()` は**プレーナ**なチャンネル（それぞれ 1 本の `Float32Array`）を返しますが、`waveformPeaks` は**インターリーブ**入力を求めます。モノラルテイクなら、その 1 チャンネルを `channels: 1` でそのまま渡してください。ステレオなら、先に 2 チャンネルをインターリーブするか、チャンネルごとにピークを求めて各レーンを別々に描いてください。
:::

## レシピ

:::: details 出力バスをキャプチャして描く
アレンジのライブ演奏を録り、描画用の波形へ縮約します。

```typescript
const engine = new RealtimeEngine(48000, 128);
try {
  engine.setCaptureBuffer(2, 48000 * 30);   // ステレオ、最大 30 秒
  engine.setCaptureSource('output');         // レンダリング済みのミックスをキャプチャ
  engine.armCapture();
  engine.play();
  // ... engine.process([...]) で演奏を駆動 ...

  const [left] = engine.capturedAudio();     // 1 チャンネルを描く
  const peaks = waveformPeaks(left, 1);      // 既定で 512 フレームのバケット
  // peaks.min / peaks.max -> キャンバス用エンベロープ
} finally {
  engine.destroy();
}
```
::::

:::: details 確定テイクへフレーズをパンチ録音する
残りに触れずに 1 フレーズだけ録り直します。

```typescript
const inSample = Math.round(2.0 * 48000);    // 2 秒でパンチイン
const outSample = Math.round(4.0 * 48000);   // 4 秒でパンチアウト
engine.setCapturePunch(inSample, outSample, true);
engine.setCaptureSource('input');
engine.armCapture();
engine.play();
// トランスポートが [inSample, outSample) の内側にある間だけ追記する。
```
::::

:::: details 3 テイクをループ録音してコンプする
2 小節フレーズを 3 周キャプチャし、テイクへ分割して、良い半分どうしを残します。

```typescript
const result = project.addLoopRecordingTakes({
  trackId, startPpq: 0, loopLengthPpq: 4,
  audio: threePassesOfAudio, audioChannels: 1, audioSampleRate: 48000,
});
project.setClipCompSegments(result.clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },
  { startPpq: 2, endPpq: 4, takeId: 2 },
]);
```
::::

テイクをキャプチャしてコンプし終えれば、それは他のオーディオと同じようにプロジェクトのクリップとして存在します。ここからは [プロジェクト編集](./project-editing.md) でアレンジ・トリミングし、仕上がったアレンジを [プロジェクトのバウンス](./project-bounce.md) でファイルへ変換します。

## 関連

- [リアルタイムストリーミング](./realtime-streaming.md) — エンジンノード、AudioWorklet ブリッジ、SAB なしのリアルタイム経路
- [プロジェクト編集](./project-editing.md) — クリップ、PPQ、フェード、ワープ、コンプをレンダリングする編集コンパイラ
- [MIDI 入力](./midi-input.md) — 録音しながら楽器をライブで鳴らす
- [NativeSynth](./native-synth.md) · [SoundFont プレイヤー](./soundfont-player.md) — エンジンへ録音するソース
- [プロジェクトのバウンス](./project-bounce.md) — 録音し終えたアレンジをオフラインでレンダリングする
