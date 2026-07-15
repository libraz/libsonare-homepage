---
title: リアルタイムエンジン
description: libsonare の RealtimeEngine リファレンス。トランスポートとテレメトリ、リアルタイムセーフなレーンミキサー、グループルーティングとサイドチェイン、パラメータオートメーション、ワイドメーター付きサラウンドグループバス、サンプル精度の MIDI クリップスケジューリング、トラックの外部 MIDI 機器への送出を解説します。
---

# リアルタイムエンジン

`RealtimeEngine` は libsonare のトランスポート／再生エンジンです。パラメータとトランスポートへのサンプル精度コマンド、トラックごとのレーンミキサー（レーン、バス、センド、チャンネルストリップ）、MIDI クリップスケジュール、グループルーティングとサイドチェイン、サラウンドグループバス、キャプチャ、オフラインバウンス、フリーズ、メーター情報を扱います。クリップ・MIDI・トランスポート・ミックス済み音声を*出力*するとき、つまり DAW 風のタイムラインや楽器ホストに使います。

ストリーミング解析器（`StreamAnalyzer`）、テンポグラム、AudioWorklet ブリッジ、クリップ音声のページストリーミング、表示用の波形ピークは、[リアルタイムとストリーミング](./realtime-streaming.md)を参照してください。

::: warning 構築前にエンジン ABI を確認する
`engineCapabilities().abiCompatible` は、読み込んだ WASM が JS パッケージの期待するエンジン ABI と一致するかを確認します。リアルタイムエンジンはライブラリ中で最もバージョンに敏感な API で、不一致のバイナリに対して構築すると未定義です。下記のチェックでガードし、失敗したら `@libraz/libsonare` パッケージを更新して、WASM バイナリと JS パッケージを同じリリースに揃えてください。
:::

## トランスポートと出力

`RealtimeEngine` はパラメータやトランスポートに対するサンプル精度のコマンドを扱い、非リアルタイム書き出し用のオフラインレンダーも提供します。

最初は、トランスポートと出力だけを動かしてから機能を足すと切り分けやすくなります。デバイスのサンプルレートとブロックサイズでエンジンを作り、テンポとループを設定し、`play()` してブロック処理する。その後で、メーター、レーンミキサー、MIDI クリップ、録音を足します。こうすると「まずエンジンが鳴る」ことを確認してから、ルーティングや録音の問題を見られます。

```typescript
import { init, RealtimeEngine, engineCapabilities } from '@libraz/libsonare';

await init();

const caps = engineCapabilities();
if (!caps.abiCompatible) throw new Error('Realtime engine ABI mismatch');

const engine = new RealtimeEngine(48000, 128);
engine.setTempo(128);
engine.setTimeSignature(4, 4);
engine.setLoop(0, 16, true);
engine.play();

const output = engine.process([leftBlock, rightBlock]);
const transport = engine.getTransportState();
const telemetry = engine.drainTelemetry();

engine.stop();
engine.destroy();
```

`RealtimeEngine` はトランスポート以外にも、パラメータ情報の登録、オートメーションレーンの設定、マーカーへのシーク、メトロノームクリックの設定、モニター出力付き処理、キャプチャ、オフラインバウンス、クリップのフリーズも扱えます。UI を組むうえで重要なテレメトリは 2 系統あります。

- **メーター** — ステレオ高速経路なら `drainMeterTelemetry()`、サラウンド／オフライン対象のプレーン別レコードなら `drainMeterTelemetryWide()` を使います。
- **スコープ** — `configureScopeTelemetry(intervalFrames, bandCount)` を 1 度呼んでターゲットごとのスペクトラム＋ベクトルスコープ取得を有効化し、`drainScopeTelemetry()` でスナップショットを読み出します。
  - `intervalFrames` — スナップショット間の最小レンダーフレーム間隔（`0` で取得を無効化）。
  - `bandCount` — FFT のバンド分解能。`1..64` にクランプされ、実際に適用されたバンド数が戻り値として返ります。

読み出した各スコープスナップショットは `targetId`（マスター・レーン・バスのいずれか）で識別され、2 本の配列を持ちます。`bands` は線形バンドの FFT マグニチュード（dB、長さ＝適用されたバンド数）、`points` はベクトルスコープ表示用のインターリーブステレオのゴニオメータ点群 `[l0, r0, l1, r1, …]`（最大 32 ステレオ点）です。バンドのレベルはブロックサイズに依存しません。振幅の正規化が短いブロックを考慮するため、AudioWorklet のブロックサイズによらず dB 値が安定します。

`drainMeterTelemetry()`／`drainMeterTelemetryWide()`／`drainScopeTelemetry()` が返す各レコードには `droppedRecords` が含まれます。これは前回のドレイン以降にロックフリーのテレメトリリングから失われたスナップショット数です。値が 0 以外なら、消費側のドレインが追いついておらず（バックプレッシャー）、メーターやスコープがちらつかないようにポーリング頻度を上げる必要があります。

メーターレコードの dB 値を持つレベル／ラウドネスのフィールド（`peakDbL`／`R`、`rmsDbL`／`R`、`truePeakDbL`／`R`、`maxTruePeakDb`、`momentaryLufs`／`shortTermLufs`／`integratedLufs`）はすべて −120 dBFS のフロアを持ち、`NaN` や `-Infinity` を返しません。未初期化・無音・未書き込みのプレーン（例: モノラルレーンの右チャンネル）は 0 dBFS ではなく −120 dBFS を返すので、レコードは常に JSON セーフです（`correlation`・`monoCompatWidth`・`gainReductionDb` などの非 dB フィールドは 0 が既定）。積分系メーターのフィールド（`momentaryLufs`／`shortTermLufs`／`integratedLufs` と true-peak 系）は、ストリーミングが一定時間続いて初めてフロアより上に上がります。短いレンダーやワンショットのレンダーでは −120 のままです。

スケジュール済みのクリップとシーケンス MIDI が鳴るのは、トランスポートが走っている間だけです。停止中のエンジンでは音が漏れず無音のままです。オフラインヘルパー（`renderOffline`、`bounceOffline`、`freezeOffline`）はレンダー期間だけトランスポートを走らせ、終了後に元の状態へ戻すので、オフラインのクリップ／MIDI レンダリングに手動の `play()` は不要です。

**手動**でオフラインレンダーする場合、つまりこれらのヘルパーを使わず自分で `process()` を回す場合は、シーク後にまずプライミング用の `process()` ブロックを 1 回流し（これでキュー済みコマンドが排出され、シーク位置のオートメーションが適用されます）、続いて `engine.settleParameters()` を呼んで、進行中のあらゆるパラメータランプ（エンジンレベルのスムーズ化パラメータ、ミキサーレーンのフェーダー／パン／ゲート、バスゲイン）をターゲット値へスナップさせてください。これで最初に聴こえるブロックが、既定値からランプインせず確定値でレンダーされます。`settleParameters()` はライブ音声スレッドと同時に実行してはならず、オフライン／メインスレッド専用です。

```typescript
// プライミング: キュー済みコマンドを排出し、シーク位置のオートメーションを適用する。
engine.process([new Float32Array(blockSize), new Float32Array(blockSize)]);
engine.settleParameters(); // 最初に聴こえるブロックの前に、全スムーズ化ランプをターゲットへスナップ
```

録音まわりでは、キャプチャ面にいくつかのコントロールが加わります。

- `setCaptureSource('output' | 'input')` — エンジンのレンダー済み出力バスを録るか、`process(...)` に渡す生の入力を録るかを選びます。
- `setRecordOffsetSamples(offset)` — モニタリングの往復レイテンシを補正するため、キャプチャ音声をずらします。
- `setInputMonitor(enabled, gain?)` — 演奏者が自分の音を聞けるように、ライブ入力を出力へミックスします。

`captureStatus()` は、現在のキャプチャ元 `source`（`'output'` または `'input'`）と現在の `recordOffsetSamples` の両方を返すので、何を録っているかを UI 側で確認できます。全体の流れは [録音とテイク](./recording-and-takes.md) を参照してください。

::: info ライブ MIDI と録音
エンジンは、楽器への**ライブ MIDI** 入力と、再生されている内容の**録音**も受け付けます。これらには専用ページがあります。Web MIDI からエンジンへのブリッジ（ポート管理、CC バインド、NativeSynth／SF2 の宛先）は [MIDI 入力](./midi-input.md)、キャプチャ・ループ録音のテイク／コンプレーン・`getUserMedia` をエンジンノードへつなぐブラウザマイクヘルパー `bindMicrophoneInput(...)` は [録音とテイク](./recording-and-takes.md) を参照してください。
:::

## レーンミキサー

エンジンはリアルタイムセーフな**レーンミキサー**を内蔵しており、再生エンジンが自分の再生するトラックを別のミキシングパスなしでそのままミックスできます。各トラックは**レーン**を 1 つ占有し、レーンは**Auxセンド**で番号付きの**バス**へ送れます。トラック・バス・マスターはそれぞれ EQ、インサート、フェーダー、パン、センドを備えた完全な**チャンネルストリップ**を持ち、これは[ミキシングエンジン](./mixing.md)と同じストリップモデルです。レーン構成を再発行するたびに、プラグインのディレイ補正は自動で再計算されます。

```typescript
// まずバスを宣言し、次にセンド付きでレーン順を宣言する。
engine.setTrackBuses([{ busId: 1, gainDb: 0 }]);
engine.setTrackLanes([
  { trackId: 1, sends: [{ busId: 1, levelDb: -12, enabled: true }] },
  2, // トラック id だけを書くと、センドなしのレーンを追加する
]);

// ストリップはミキサーシーン JSON を再利用する:
// シーンの最初の strips[0] エントリーがストリップ仕様になる。
engine.setTrackStripJson(1, vocalSceneJson);
engine.setBusStripJson(1, reverbSceneJson);   // バスは setTrackBuses で先に存在させる
engine.setMasterStripJson(masterSceneJson);

// ストリップを作り直さずに内蔵 EQ の 1 バンドだけ更新する
// （バンド JSON のスキーマは eq.parametric / StreamingEqualizer と同じ）:
engine.setTrackStripEqBandJson(1, 0,
  JSON.stringify({ type: 'peak', frequencyHz: 250, gainDb: -2, q: 1.0 }));

// インサートをその場でバイパスする。第 4 引数に true を渡すと状態もリセットする。
engine.setTrackStripInsertBypassed(1, 0, true);

// キュー可能なソロ／ミュート: レーンインデックスと renderFrame を取る
// （-1 = 即時適用、将来のフレームを渡すとサンプル精度で適用）。
engine.setSoloMute(0, true, false, -1);
```

::: info レーンインデックスは追加専用
あるトラック id が一度レーンを占有すると、そのレーンインデックスはエンジンの生存期間中固定されます。`setTrackLanes(...)` を呼ぶたびに、宣言済みのレーン id を現在の順序どおりに並べ、新しいトラック id はその後ろにのみ追加できます。`sends` を持つエントリーはそのトラックのセンドリストを置き換え、`sends` のないエントリー（id だけの指定を含む）は既存のセンドに触れません。`setSoloMute` はこの固定インデックスでレーンを指定します。
:::

::: warning 構造を変えるストリップ呼び出しはコントロールスレッドで
`setTrackLanes`、`setTrackBuses`、ストリップ JSON セッターは内部構造を構築するため、`process(...)` と同時に実行してはいけません。レンダーの合間か停止中に発行してください。ライブ操作向けの軽量なコントロールは、サンプル精度でキューされる `setSoloMute` と、1 バンドをその場で書き換える EQ バンド更新です。
:::

<SonareDemo id="engine-lane-mixer" />

## グループルーティング・サイドチェイン・ライブストリップ操作

レーン／センドのグラフ以外にも、ストリップを作り直さずにルーティングとパンを変えるリアルタイムセーフな操作がいくつかあります。

| 目的 | 生の `RealtimeEngine` | `SonareEngine` ワークレット API |
|------|----------------------|--------------------------------------|
| レーンをグループバスへ折り込む（`busId 0` でマスターミックスへ戻す） | `setTrackLanes(...)` のレーン `outputBusId`（`0` または未指定でマスターミックス） | `setTrackOutputBus(target, busId)`（`busId 0` でマスターミックスへ戻す） |
| あるレーンのインサートを別レーンでキーイング（ダッキング） | `setLaneSidechain(trackId, insertIndex, sourceTrackId)`（`0` で解除） | `setLaneSidechain(target, insertIndex, sourceTarget)`（`null` で解除） |
| レーンをパンする | `setTrackStripPan(trackId, pan)` | `setTrackStripPan(target, pan)` |
| パンロー／パンモード | `setTrackStripPanLaw(...)`、`setTrackStripPanMode(...)` | 同名 |
| 左右独立（デュアル）パン | `setTrackStripDualPan(trackId, left, right)` | `setTrackStripDualPan(target, left, right)` |
| レーンごとのサンプル遅延 | `setTrackStripChannelDelaySamples(trackId, samples)` | 同名 |
| インサートパラメータを名前で設定 | `setTrackStripInsertParamByName(trackId, insertIndex, paramName, value)`（マスター／バス: `setMasterStripInsertParamByName(...)`、`setBusStripInsertParamByName(...)`） | 同名、加えて `setStripInsertParamByName(target, ...)` |
| バスインサートをバイパス | `setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass?)` | 同名 |

`setTrackStripInsertParamByName(...)` はリアルタイムオートメーションの入り口です。[`masteringInsertParamInfo(name)`](./mastering-processors.md) が返す JSON キーでパラメータを指定するため、ホストはストリップ JSON を作り直さずにインサートの自動化可能なパラメータをライブで変更できます。ワークレット API では `target` はトラック id または名前です。

## パラメータオートメーション

`RealtimeEngine` は、[`setTrackStripInsertParamByName`](#グループルーティング・サイドチェイン・ライブストリップ操作) のストリップインサートパラメータとは別に、エンジンレベルのパラメータレジストリを持ちます。`addParameter(info)` でパラメータを 1 度登録し、`setParameter(id, value, renderFrame?)`（ランプには `setParameterSmoothed(...)`）でライブに変更するか、`setAutomationLane(id, points)` でタイムライン上にスケジュールします。

```typescript
// EngineParameterInfo: id, name, unit, min/max/default, rtSafe, defaultCurve（0=linear）
engine.addParameter({
  id: 1, name: 'volume', unit: 'lin',
  minValue: 0, maxValue: 1, defaultValue: 1,
  rtSafe: true, defaultCurve: 0,
});

// オートメーション点は PPQ（4 分音符単位）で位置づけ、任意で curveToNext コード
// （0=linear、1=exponential、2=hold、3=s-curve）を持ちます。
engine.setAutomationLane(1, [
  { ppq: 0, value: 1, curveToNext: 0 },
  { ppq: 4, value: 0 },
]);

// あるいはコントロールスレッドから命令的に設定する（renderFrame -1 = 即時）。
engine.setParameter(1, 0.5);
```

`SonareEngine` ワークレット API では、パラメータを登録せずにミキサーのフェーダー／パンを自動化することもできます。`automationParamId(target, 'faderDb' | 'pan')` と `busAutomationParamId(busId)` はミキサー名前空間の予約済みエンジンパラメータ id を返すので、それをそのまま `setAutomationLane(paramId, points)` に渡してトラック／マスターのフェーダーやパン、あるいはバスのフェーダー（バス id はそのフェーダーゲイン dB に解決されます）を自動化できます。`target`／`busId` は初回利用時にミキサーのレーン／バスを宣言します。

インサートパラメータも同じオートメーションレーンで動かせますが、先に予約 id を取得します。`resolveTrackInsertAutomationId(trackId, insertIndex, paramName)`、`resolveMasterInsertAutomationId(...)`、`resolveBusInsertAutomationId(...)` のいずれかを呼び、その戻り値を `setAutomationLane`、`setParameter`、`setParameterSmoothed` に渡してください。`insertIndex` はストリップの pre インサート、続いて post インサートを連結した列を指し、`paramName` は `masteringInsertParamInfo` が返す JSON キーです。未知のストリップ／インサート／キーでは WASM/Node は `-1`、Python は `SonareError` を返します。

```typescript
const thresholdId = engine.resolveBusInsertAutomationId(1, 0, 'thresholdDb');
if (thresholdId < 0) throw new Error('bus compressor threshold is not automatable');
engine.setAutomationLane(thresholdId, [
  { ppq: 0, value: -18 },
  { ppq: 8, value: -24, curveToNext: 3 },
]);
```

`setParamSmoothingMs(ms)` は、フェーダー／パンのスムーズな変更、インサートパラメータのオートメーション、MIDI CC マッピングに使う既定の追従時間を変更します。既定は `20` ms、`0` は即時変更です。ホストがオートメーション全体の感触を意図的に変える場合を除き、再生前にコントロールスレッドから 1 度設定してください。

## サラウンドグループバスとワイドメーター

サラウンドの `channelLayout`（`SonareChannelLayout`: `0` モノラル、`1` ステレオ、`2` 5.1、`3` 7.1）で宣言したバスは**サラウンドグループバス**になります。バスはプレーンごとにマスターへ合算し、プレーン別メーターを公開します。そこへルーティングしたレーンは点音源へフォールドされた後、ストリップの [`surroundPan`](./mixing.md#サラウンドとマルチチャンネル) に従って配置されます。`azimuth`、`divergence`、`lfe` は有効で、`elevation` と `distance` は予約です。単体の `Mixer` はステレオのままなので、この DSP はリアルタイムエンジンのワイドバス経路に固有です。

```typescript
engine.setTrackBuses([{ busId: 1, channelLayout: 2 }]); // 5.1 のグループバス
engine.setTrackOutputBus(1, 1);                          // レーンをそこへルーティング
engine.setTrackStripJson(1, JSON.stringify({
  strips: [{ id: 'source', surroundPan: { azimuth: -30, divergence: 0, lfe: 0 } }],
  buses: [],
  connections: [],
}));
```

`EngineTrackLane` の `sourceChannelLayout` は現状では説明／シリアライズ用です。レーンのレンダー入力はまだモノラルまたはステレオで、ステレオはサラウンド配置の前に点音源へフォールドされます。既存の 5.1/7.1 ソースがディスクリートのまま保たれる指定としては使わないでください。

`setTrackOutputBus(1, 0)`（または `setTrackLanes` で `outputBusId: 0` を指定）を呼ぶと、レーンをマスターミックスへ戻せます。

サラウンドメーターはライブのワークレットメーターリングを通りません。オフラインまたはメインスレッドのエンジンで `drainMeterTelemetryWide(maxRecords?)` を使って読み取ると、プレーンごとの（ワイドな）レコードが返ります。`drainMeterTelemetry()` はステレオの高速パスのままです。この 2 つのドレインは同じシングルコンシューマのテレメトリキューを消費するため、1 つのエンジンインスタンスにつきどちらか一方だけを呼んでください。ライブの AudioWorklet 経路はステレオドレインでキューを所有しており、そのため `drainMeterTelemetryWide()` はオフライン（非ワークレット）エンジン向けです。両方を 1 つのエンジンで回すと、互いのレコードを奪い合います。

## MIDI クリップスケジューリングと `sampleAtPpq`

音声クリップにはクリップスケジュールとページプロバイダがあり、**MIDI クリップ**には専用のリアルタイムスケジュールがあります。`setMidiClips(clips)` はエンジンの MIDI クリップスケジュール全体を 1 回の呼び出しで置き換え、各クリップはイベントを MIDI の**宛先 id** に従って楽器へルーティングします（`setBuiltinInstrument`、`setSynthInstrument`、`setSf2Instrument` でバインドした楽器。宛先モデルは [MIDI 入力](./midi-input.md)を参照）。

このスケジュールは*コンパイル済み*です。タイミングは PPQ ではなく**エンジンタイムライン上の絶対サンプル**で表します。音楽的な位置の変換には `sampleAtPpq(ppq)` を使ってください。エンジンのテンポマップ（`setTempo` / `setTempoSegments` のすべての変更）を積分するため、テンポが途中で変わっても正しい位置が得られます。

```typescript
// UMP MIDI 1.0 チャンネルボイスワード（ノートオン = ステータス 0x9、ノートオフ = 0x8）。
const noteOn  = (ch: number, note: number, vel: number) =>
  (0x2 << 28) | (0x9 << 20) | (ch << 16) | (note << 8) | vel;
const noteOff = (ch: number, note: number) =>
  (0x2 << 28) | (0x8 << 20) | (ch << 16) | (note << 8);

const start = engine.sampleAtPpq(8);                  // テンポマップを考慮した変換
const length = engine.sampleAtPpq(16) - start;

engine.setMidiClips([{
  id: 1,
  trackId: 1,
  destinationId: 0,            // このイベントをレンダーする楽器の宛先
  startSample: start,
  startPpq: 8,
  lengthSamples: length,
  loop: true,
  loopLengthSamples: length,
  events: [
    // renderFrame はエンジンタイムライン上の絶対サンプル。1 ワードの
    // MIDI 1.0 イベントでは wordCount を省略できる（word0 から推論される）。
    { renderFrame: start,                          word0: noteOn(0, 60, 100) },
    { renderFrame: start + Math.floor(length / 2), word0: noteOff(0, 60) },
  ],
}]);
```

ループするクリップは `loopLengthSamples` ごとにイベントリストを繰り返します。スケジュールを空にするには `setMidiClips([])` を呼びます。*プロジェクト*レベル（PPQ 単位のノート、テイク、コンピング）で作業したい場合は、[プロジェクト編集](./project-editing.md)でアレンジを組んでバウンスしてください。このリアルタイムスケジュールは、DAW フロントエンドがコンパイルして渡す低レベル側の API です。

## トラックを外部 MIDI 機器へ送る

**内部デスティネーション**は libsonare 内の NativeSynth／SF2 インストゥルメントで MIDI をレンダーします。**外部デスティネーション**はそのインストゥルメントを通さず、ホストがハードウェアや別アプリへ送るための MIDI 1.0 バイト列を出力キューへ入れます。libsonare はメッセージの変換と時刻付けを行いますが、OS／Web MIDI ポートを開くのはホスト側の役割です。

デスティネーションを外部に設定し、通常どおり音声処理した後、出力キューを高頻度でドレインします。生エンジンのメソッド名はバインディング間で共通で、ブラウザと Node は camelCase、Python は snake_case です。

::: code-group

```typescript [Browser]
engine.setMidiDestinationExternal(2, true); // デスティネーション 2 を外部機器へ送る
engine.setExternalMidiClockEnabled(true);  // 任意: clock + start/continue/stop

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // クロック／トランスポートは、ホストが選んだ全外部ポートへ配信する。
    for (const output of externalOutputs.values()) output.send(event.bytes);
  } else {
    externalOutputs.get(event.destinationId)?.send(event.bytes);
  }
}
```

```typescript [Node]
// Node は WASM と同じ camelCase の生エンジンメソッドを公開する。
engine.setMidiDestinationExternal(2, true);
engine.setExternalMidiClockEnabled(true);

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // クロック／トランスポートを、開いている全ハードウェアポートへ転送する。
    for (const port of externalPorts.values()) port.sendMessage([...event.bytes]);
  } else {
    externalPorts.get(event.destinationId)?.sendMessage([...event.bytes]);
  }
}
```

```python [Python]
engine.set_midi_destination_external(2, True)  # デスティネーション 2 を外部機器へ送る
engine.set_external_midi_clock_enabled(True)   # 任意: clock + start/continue/stop

engine.process([left_block, right_block])
for event in engine.drain_external_midi(256):
    if event.destination_id == 0xFFFFFFFF:
        # クロック／トランスポートを、開いている全ハードウェアポートへ配信する。
        for port in external_ports.values():
            port.send_message(list(event.bytes))
    else:
        port = external_ports.get(event.destination_id)
        if port is not None:
            port.send_message(list(event.bytes))

# 目安: 値が増え続ける場合、ホストが読み出す前にキューが満杯になっている。
dropped = engine.external_midi_dropped_count()
```

:::

各イベントは `destinationId`、`renderFrame`、`bytes`（1〜3 バイトの変換済み MIDI 1.0 メッセージ 1 個。Python では snake_case の `destination_id` ／ `render_frame`）を持ちます。クロック／トランスポートはデスティネーションの番兵値 `0xFFFFFFFF` を使い、チャンネルメッセージは元のデスティネーション id を保ちます。`maxRecords` は戻り値のメッセージ数を制限し、残りは次回のドレインまでキューに残ります。`externalMidiDroppedCount()`（Python では `external_midi_dropped_count()`）が増え続ける場合、ホストが読み出す前に固定容量のリアルタイムキューが満杯になっています。

`SonareEngine` AudioWorklet ファサード（ブラウザ専用）では `setMidiDestinationExternal(trackId, true)` と `onMidiOut(callback)` を使います。ワークレットはレンダーブロックごとに内部エンジンをすでにドレインし、メインスレッドへバッチを送るため、別の消費側として生のドレインを呼ばないでください。

```typescript
engine.setMidiDestinationExternal('hardware-lead', true);
const unsubscribe = engine.onMidiOut((events) => {
  for (const event of events) {
    if (event.destinationId === 0xffffffff) {
      for (const output of externalOutputs.values()) output.send(event.bytes);
    } else {
      externalOutputs.get(event.destinationId)?.send(event.bytes);
    }
  }
});
```

## AudioWorklet でエンジンを動かす

通常の WASM パッケージは、この `RealtimeEngine` クラスを直接公開します。リアルタイム音声スレッドで動かすには、Worklet ブリッジが同じ embind ベースのエンジンを `AudioWorkletGlobalScope` 内でホストし、より高レベルの `SonareEngine` ファサードがエンジンのほぼ全面をコントロールメッセージ経由で Worklet にミラーします。ブリッジの設定、`SonareEngine` ファサードの一覧、Worklet 側のスコープスナップショットは [リアルタイムとストリーミング — AudioWorklet での使い分け](./realtime-streaming.md#audioworklet-での使い分け) を参照してください。

## 関連

- [リアルタイムとストリーミング](./realtime-streaming.md) — `StreamAnalyzer`、テンポグラム、AudioWorklet ブリッジ、クリップのページストリーミング、波形ピーク
- [ミキシングエンジン](./mixing.md) — このエンジンのレーンミキサーとストリップモデルを共有する単体のストリップ／バス／センドミキサー
- [MIDI 入力](./midi-input.md) · [録音とテイク](./recording-and-takes.md) — エンジンへのライブ MIDI 入力と、再生内容のキャプチャ
