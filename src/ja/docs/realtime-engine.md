---
title: リアルタイムエンジン
description: libsonare の RealtimeEngine リファレンス。トランスポートとテレメトリ、リアルタイムセーフなレーンミキサー、グループルーティングとサイドチェイン、パラメータオートメーション、ワイドメーター付きサラウンドグループバス、サンプル精度の MIDI クリップスケジューリング、トラックの外部 MIDI 機器への送出を解説します。
---

# リアルタイムエンジン

`RealtimeEngine` は libsonare のトランスポート／再生エンジンです。パラメータとトランスポートへのサンプル精度コマンド、トラックごとのレーンミキサー（レーン、バス、センド、チャンネルストリップ）、MIDI クリップスケジュールを扱います。グループルーティングとサイドチェイン、サラウンドグループバス、キャプチャ、オフラインバウンス、フリーズ、メーター情報も扱います。クリップ・MIDI・トランスポート・ミックス済み音声を*出力*するとき、つまり DAW 風のタイムラインや楽器ホストに使います。

ストリーミング解析器（`StreamAnalyzer`）、テンポグラム、AudioWorklet ブリッジ、クリップ音声のページストリーミング、表示用の波形ピークは、[リアルタイムとストリーミング](./realtime-streaming.md)を参照してください。

## このページで身につくこと

以下の節はおおむね独立しています。最初の節を読んだら、あとは自分のホストに合う節へ飛んでください。このページを読み終えると、次のことができるようになります。

- エンジンを構築し、実際のチャンネル数に合わせてサイズを決め、トランスポートとメーター／スコープのテレメトリを動かす。
- 内蔵のレーンミキサーで再生中のトラックをミックスし、PFL／AFL でレーンを独立したキューバスへタップする。
- グループバス・サイドチェイン・パンといったルーティングを、チャンネルストリップを作り直さずにライブで変更する。
- エンジンパラメータとインサートパラメータをタイムラインに沿って自動化し、再生中にレーンを書き換える。
- オーディオクリップをワープモード付きでスケジュールし、ページングによる音切れを見分ける。
- MIDI クリップをテンポマップに合わせてスケジュールし、トラックを外部 MIDI 機器へ送出する。

::: warning 構築前にエンジン ABI を確認する
`engineCapabilities().abiCompatible` は、読み込んだ WASM が JS パッケージの期待するエンジン ABI と一致するかを確認します。ABI（アプリケーションバイナリインターフェース）とは、両者が前提として共有するメモリレイアウトと呼び出しシグネチャのことです。リアルタイムエンジンはライブラリ中で最もバージョンに敏感な API で、不一致のバイナリに対して構築したときの動作は未定義です。下記のチェックでガードし、失敗したら `@libraz/libsonare` パッケージを更新して、WASM バイナリと JS パッケージを同じリリースに揃えてください。
:::

## トランスポートと出力

`RealtimeEngine` はパラメータやトランスポートに対するサンプル精度のコマンドを扱い、非リアルタイム書き出し用のオフラインレンダーも提供します。

最初は、トランスポートと出力だけを動かしてから機能を足すと切り分けやすくなります。デバイスのサンプルレートとブロックサイズでエンジンを作り、テンポとループを設定し、`play()` してブロック処理する。その後で、メーター、レーンミキサー、MIDI クリップ、録音を足します。こうすると「まずエンジンが鳴る」ことを確認してから、ルーティングや録音の問題を見られます。

```typescript
import { init, RealtimeEngine, engineCapabilities } from '@libraz/libsonare';

await init();

const caps = engineCapabilities();
if (!caps.abiCompatible) throw new Error('Realtime engine ABI mismatch');

// (sampleRate, maxBlockSize, commandCapacity?, telemetryCapacity?, maxChannels?)
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

### 実際のチャンネル数に合わせて prepare する

コンストラクタと `prepare(...)` は、末尾に省略可能な `maxChannels` を取ります。prepare は
キャプチャ・インストゥルメント・PDC（プラグインのディレイ補正）・モニターの各プレーンを、
常に 64 本ではなくこの数だけ確保するため、ステレオのホストが決して使わない 64 プレーン分のスクラッチを抱える必要がなくなります。

```typescript
// ステレオのホスト: 64 ではなく 2 プレーンを確保
const engine = new RealtimeEngine(48000, 128, /*commandCapacity=*/undefined,
                                  /*telemetryCapacity=*/undefined, /*maxChannels=*/2);

// 構築済みのエンジンに対して指定する場合
engine.prepare(48000, 128, undefined, undefined, 8);   // 7.1 向け
```

実際にレンダリングする最大チャンネル数を指定してください。指定しなければ従来どおりの挙動です。

### コントロール専用のホスト

`process()` を呼ばないホスト（ヘッドレスのコントローラーや、コマンドをキューイングして
状態を読むだけのオフライン経路）は、コマンドキューを明示的に流し込めます。

```typescript
engine.setTempo(140);
engine.flushControlCommands();   // レンダリングせずにキュー済みコマンドを適用
```

`getTransportState()` には生のサンプル位置と PPQ 位置（4 分音符単位の音楽的な位置）だけでなく、小節・拍で表した再生位置も含まれます。`barCount` は 0 始まり、`beat` はその小節内で 1 始まり、`beatFraction` は `[0, 1)` の範囲です。そのため、PPQ から自前で換算せずに一般的な小節:拍表示を作れます。

```typescript
const { barCount, beat, beatFraction } = transport;
const playhead = `${barCount + 1}:${beat}`; // 例: "3:2"
// beatFraction はその拍の進行度。滑らかなインジケーターに使える。
```

`RealtimeEngine` はトランスポート以外にも、パラメータ情報の登録、オートメーションレーンの設定、マーカーへのシーク、メトロノームクリックの設定、モニター出力付き処理、キャプチャ、オフラインバウンス、クリップのフリーズも扱えます。UI を組むうえで重要なテレメトリは 2 系統あります。

- **メーター** — ステレオ高速経路なら `drainMeterTelemetry()`、サラウンド／オフライン対象のプレーン別レコードなら `drainMeterTelemetryWide()` を使います。
- **スコープ** — `configureScopeTelemetry(intervalFrames, bandCount)` を 1 度呼んでターゲットごとのスペクトラム＋ベクトルスコープ取得を有効化し、`drainScopeTelemetry()` でスナップショットを読み出します。
  - `intervalFrames` — スナップショット間の最小レンダーフレーム間隔（`0` で取得を無効化）。
  - `bandCount` — FFT のバンド分解能。`1..64` にクランプされ、実際に適用されたバンド数が戻り値として返ります。

読み出した各スコープスナップショットは `targetId`（マスター・レーン・バスのいずれか）で識別され、2 本の配列を持ちます。`bands` は線形バンドの FFT マグニチュード（dB、長さ＝適用されたバンド数）、`points` はベクトルスコープ表示用のゴニオメータ点群で、`{ left, right }` レコードが最大 32 ステレオ点入ります（ワークレットのスコープリングバッファは同じ点群をインターリーブされた `[l0, r0, l1, r1, …]` の `Float32Array` として渡します）。バンドのレベルはレンダーブロックサイズに応じて変化し、ブロックサイズが 2 倍になるとおよそ −3 dB 下がります。比較はブロックサイズを固定したスナップショット同士で行ってください。

`drainMeterTelemetry()`／`drainMeterTelemetryWide()`／`drainScopeTelemetry()` が返す各レコードには `droppedRecords` が含まれます。これは前回のドレイン以降にロックフリーのテレメトリリングから失われたスナップショット数です。値が 0 以外なら、消費側のドレインが追いついておらず（バックプレッシャー）、メーターやスコープがちらつかないようにポーリング頻度を上げる必要があります。

メーターレコードの dB 値を持つレベル／ラウドネスのフィールド（`peakDbL`／`R`、`rmsDbL`／`R`、`truePeakDbL`／`R`、`maxTruePeakDb`、`momentaryLufs`／`shortTermLufs`／`integratedLufs`）はすべて −120 dBFS のフロアを持ち、`NaN` や `-Infinity` を返しません。未初期化・無音・未書き込みのプレーン（例: モノラルレーンの右チャンネル）は 0 dBFS ではなく −120 dBFS を返すので、レコードは常に JSON セーフです（`correlation`・`monoCompatWidth`・`gainReductionDb` などの非 dB フィールドは 0 が既定）。積分系メーターのフィールド（`momentaryLufs`／`shortTermLufs`／`integratedLufs` と true-peak 系）は、ストリーミングが一定時間続いて初めてフロアより上に上がります。短いレンダーやワンショットのレンダーでは −120 のままです。

スケジュール済みのクリップとシーケンス MIDI が鳴るのは、トランスポートが走っている間だけです。停止中のエンジンでは音が漏れず無音のままです。オフラインヘルパー（`renderOffline`、`bounceOffline`、`freezeOffline`）はレンダー期間だけトランスポートを走らせ、終了後に元の状態へ戻すので、オフラインのクリップ／MIDI レンダリングに手動の `play()` は不要です。

**手動**でオフラインレンダーする場合、つまりこれらのヘルパーを使わず自分で `process()` を回す場合は、次の手順に従ってください。シーク後、まずプライミング用の `process()` ブロックを 1 回流します（これでキュー済みコマンドが排出され、シーク位置のオートメーションが適用されます）。続いて `engine.settleParameters()` を呼び、進行中のあらゆるパラメータランプ（エンジンレベルのスムーズ化パラメータ、ミキサーレーンのフェーダー／パン／ゲート、バスゲイン）をターゲット値へスナップさせてください。これで最初に聴こえるブロックが、既定値からランプインせず確定値でレンダーされます。`settleParameters()` はライブ音声スレッドと同時に実行してはならず、オフライン／メインスレッド専用です。

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
エンジンは、楽器への**ライブ MIDI** 入力と、再生されている内容の**録音**も受け付けます。これらには専用ページがあります。Web MIDI からエンジンへのブリッジ（ポート管理、CC バインド、NativeSynth／SF2 のデスティネーション）は [MIDI 入力](./midi-input.md) を参照してください。キャプチャ・ループ録音のテイク／コンプレーン・`getUserMedia` をエンジンノードへつなぐブラウザマイクヘルパー `bindMicrophoneInput(...)` は [録音とテイク](./recording-and-takes.md) を参照してください。
:::

## レーンミキサー

エンジンはリアルタイムセーフな**レーンミキサー**を内蔵しており、再生エンジンが自分の再生するトラックを別のミキシングパスなしでそのままミックスできます。各トラックは**レーン**を 1 つ占有し、レーンは**Auxセンド**で番号付きの**バス**へ送れます。トラック・バス・マスターはそれぞれ EQ、インサート、フェーダー、パン、センドを備えた完全な**チャンネルストリップ**を持ち、これは[ミキシングエンジン](./mixing.md)と同じストリップモデルです。レーン構成を再発行するたびに、プラグインのディレイ補正（PDC）は自動で再計算されます。

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
あるトラック id が一度レーンを占有すると、そのレーンインデックスはエンジンの生存期間中固定されます。`setTrackLanes(...)` を呼ぶたびに、宣言済みのレーン id を現在の順序どおりに並べ、新しいトラック id はその後ろにのみ追加できます。生の `RealtimeEngine` では、呼び出しのたびに各レーンのセンドを、そのレーンのエントリーが渡した `sends` 配列から作り直します。`sends` を省略すると（id だけの指定を含む）、既存のセンドは維持されず消去されます。省略時にセンドを維持するのは `SonareEngine` ワークレットファサードのほうで、JS 側にセンドのキャッシュを持ち、呼び出しのたびに完全なリストを裏で再送信しています。`setSoloMute` はこの固定インデックスでレーンを指定します。
:::

::: warning 構造を変えるストリップ呼び出しはコントロールスレッドで
`setTrackLanes`、`setTrackBuses`、ストリップ JSON セッターは内部構造を構築するため、`process(...)` と同時に実行してはいけません。レンダーの合間か停止中に発行してください。ライブ操作向けの軽量なコントロールは、サンプル精度でキューされる `setSoloMute` と、1 バンドをその場で書き換える EQ バンド更新です。
:::

### バスのインサート列は合算後の信号を 1 度だけ通る

クリップのオーディオとホストしたインストゥルメントのオーディオは、同じバスへ流れ込む 2 つの寄与であり、ストリップ・センド・バス列が走る前に 1 つのブロックへまとめて集約されます。したがってバスのインサート列は、寄与の **合計** を 1 ブロックにつきちょうど 1 回だけ処理します。これは非線形なインサートが必要とする条件そのものです。コンプレッサーやサチュレーションをクリップ側の寄与とインストゥルメント側の寄与に分けて 2 回走らせると、合算後のバスにかけるのとは別物の、2 つの部分信号にかけることになります。リバーブであればテールが 1 ブロックにつき 2 回進んでしまいます。

このまとめ処理が行われるには 2 つの条件があります。1 つはプラグインディレイコンペンセーション（PDC）が働いていないことです。PDC が有効なあいだ、クリップバスは専用のスクラッチへレンダリングされ、内部で遅延されたインストゥルメントと位相が揃うように遅延されます。そのときのバスはこの別パスに属するものです。もう 1 つはインストゥルメントラックが空でないことで、空であればそもそもまとめる相手がありません。

::: info ソロとミュートのランプは所定の時間をかけて進みます
各レーンが 1 ブロックにつき 1 度だけ仕上げられるため、そのフェーダー・パン・ゲートのスムーザーも 1 ブロックにつき 1 度だけ進みます。ソロとミュートの背後にあるゲートスムーザーの時定数は **10 ms**、パンスムーザーは **5 ms** です。そのためソロやミュートの切り替えは、段差ではなく短い可聴のランプになります。これはインサートパラメータやフェーダーのオートメーションの既定追従時間（既定 20 ms）を決める `setParamSmoothingMs` とは別のものです。
:::

<SonareDemo id="engine-lane-mixer" />

## トラックモニタータップ: off・PFL・AFL

設定済みの各トラックレーンは、独立したキュー／モニターバスへ信号を送れます。`setTrackMonitorMode(laneIndex, mode, renderFrame?)` でモードをキューします。`laneIndex` は `setTrackLanes` で決まる追加専用のインデックス、`renderFrame` の既定値は `-1`（次のブロック先頭）、`mode` は `'off'`・`'pfl'`・`'afl'`（または序数 `0`・`1`・`2`）です。

- **off** — レーンはモニターバスへ何も送らない。
- **PFL**（pre-fader listen）— レーンストリップとプラグインディレイ補正の後、レーンのフェーダー・ゲート・パンの前でタップします。そのため、レーンをミュートしたりソロ制御でゲートしたりしても、ここでは聞こえます。
- **AFL**（after-fader listen）— フェーダー・ゲート・パンの後でタップします。サラウンドレーンではフェーダー／ゲートとサラウンドのプレーン配置の後、ステレオ AFL ではパンの後です。

<FlowDiagram
  title="PFL と AFL がタップする位置"
  :nodes="[
    { id: 'strip', label: 'レーンストリップ + PDC', col: 0, row: 0 },
    { id: 'fader', label: 'フェーダー・ゲート・パン', col: 1, row: 0 },
    { id: 'out', label: 'メイン出力', col: 2, row: 0, variant: 'success' },
    { id: 'pfl', label: 'PFL タップ', col: 1, row: 1, variant: 'accent' },
    { id: 'afl', label: 'AFL タップ', col: 2, row: 1, variant: 'accent' },
    { id: 'cue', label: 'キュー／モニターバス', col: 3, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'strip', to: 'fader' },
    { from: 'fader', to: 'out' },
    { from: 'strip', to: 'pfl', label: 'フェーダー前' },
    { from: 'fader', to: 'afl', label: 'フェーダー後' },
    { from: 'pfl', to: 'cue' },
    { from: 'afl', to: 'cue' }
  ]"
  caption="PFL はフェーダー・ゲート・パンの前で聴くため、ミュートしたレーンでも聞こえます。AFL はそれらの後で聴きます。"
/>

モニターバスには PFL／AFL を設定した複数レーンが合算されます。通常の `process(...)` は互換性のためこのバスをメイン出力へ折り込みます。プログラム出力とキュー出力を分けるには `processWithMonitor(...)` を使います。

```typescript
engine.setTrackMonitorMode(0, 'pfl');
const { output, monitor } = engine.processWithMonitor([leftBlock, rightBlock]);
engine.setTrackMonitorMode(0, 'off');
```

WASM と Node は `{ output, monitor }` を返します。Python は `set_track_monitor_mode(0, 'afl')` を使い、`process_with_monitor(...)` から `(output, monitor)` を受け取ります。C のエントリーポイントは `sonare_engine_set_track_monitor_mode` と `sonare_engine_process_with_monitor` です。

## グループルーティング・サイドチェイン・ライブストリップ操作

レーン／センドのグラフ以外にも、ストリップを作り直さずにルーティングとパンを変えるリアルタイムセーフな操作がいくつかあります。

| 目的 | 生の `RealtimeEngine` | `SonareEngine` ワークレット API |
|------|----------------------|--------------------------------------|
| レーンをグループバスへ折り込む（`busId 0` でマスターミックスへ戻す） | `setTrackLanes(...)` のレーン `outputBusId`（`0` または未指定でマスターミックス） | `setTrackOutputBus(target, busId)`（`busId 0` でマスターミックスへ戻す） |
| バスを別バスへ折り込む、またはコピーをセンドする | `setTrackBuses(...)` のバス `outputBusId` と `sends`（出力が `0`／未指定ならマスターミックス） | `setTrackBuses(...)` の同じフィールド |
| あるレーンのインサートを別レーンでキーイング（ダッキング） | `setLaneSidechain(trackId, insertIndex, sourceTrackId)`（`0` で解除） | `setLaneSidechain(target, insertIndex, sourceTarget)`（`null` で解除） |
| バスのインサートをトラックか別バスでキーイング | `setBusSidechain(busId, insertIndex, sourceKind, sourceId)`（`sourceId 0` で解除） | 同名 |
| マスターのインサートをトラックかバスでキーイング | `setMasterSidechain(insertIndex, sourceKind, sourceId)` | 同名 |
| レーンをパンする | `setTrackStripPan(trackId, pan)` | `setTrackStripPan(target, pan)` |
| パンロー／パンモード | `setTrackStripPanLaw(...)`、`setTrackStripPanMode(...)` | 同名 |
| 左右独立（デュアル）パン | `setTrackStripDualPan(trackId, left, right)` | `setTrackStripDualPan(target, left, right)` |
| レーンごとのサンプル遅延 | `setTrackStripChannelDelaySamples(trackId, samples)` | 同名 |
| インサートパラメータを名前で設定 | `setTrackStripInsertParamByName(trackId, insertIndex, paramName, value)`（マスター／バス: `setMasterStripInsertParamByName(...)`、`setBusStripInsertParamByName(...)`） | 同名、加えて `setStripInsertParamByName(target, ...)` |
| バスインサートをバイパス | `setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass?)` | 同名 |

`setTrackStripInsertParamByName(...)` はリアルタイムオートメーションの入り口です。[`masteringInsertParamInfo(name)`](./mastering-processors.md) が返す JSON キーでパラメータを指定するため、ホストはストリップ JSON を作り直さずにインサートの自動化可能なパラメータをライブで変更できます。ワークレット API では `target` はトラック id または名前です。

バス／マスターのサイドチェインキーにおける `sourceKind` は `'track'`（レーンのストリップ処理後・レーンフェーダー前の信号）または `'bus'`（バスの処理後・自身の `gainDb` 前の信号。より広ければステレオへ畳まれる）です。Python の `set_bus_sidechain` / `set_master_sidechain` も同じ名前、または対応する `0`／`1` の序数を取ります。マスターの `insertIndex` は、他のマスターインサートセッターと同じ順序で、まずプリフェーダーインサート、続いてポストフェーダーインサートを数えます。どちらのキーもレーンのサイドチェインバインディングテーブル（32 エントリ）を共有し、`setTrackBuses` 自体と同じくコントロールスレッド専用です。

```typescript
// バス 2 の出力をバス 1 へ折り込み、同じバスへプリフェーダーセンドも送ってから、
// バス 1 のコンプレッサーをバス 2 自身の信号でダッキングする。
engine.setTrackBuses([
  { busId: 1, gainDb: 0 },
  { busId: 2, gainDb: -6, outputBusId: 1, sends: [{ busId: 1, levelDb: -12, sendTiming: 'preFader' }] },
]);
engine.setBusSidechain(1, 0, 'bus', 2);   // バス 1 のインサート 0 を、バス 2 でキーイング
engine.setMasterSidechain(0, 'track', 1); // マスターのインサート 0 を、トラック 1 でキーイング
```

バスの出力・センド・サイドチェインキーが自分より狭い宛先（より小さいバス、レンダリング幅でのマスター、あるいは常にステレオであるサイドチェインのキータップ）へ届くときは、[下のサラウンドの節で使う ITU-R BS.775 ダウンミックス](#サラウンドグループバスとワイドメーター)で畳まれます。宛先が広ければ、送り元のプレーンはそのままのインデックスで届きます。バスリストの設定は、出力・センド・バス発のキーすべてを 1 つの依存グラフとして検証されます。閉路、未宣言のバスへの参照、バスの自己参照、レーンがまだ使っているバスの削除は拒否され、以前の設定のまま変わりません。

## パラメータオートメーション

`RealtimeEngine` は、[`setTrackStripInsertParamByName`](#グループルーティング・サイドチェイン・ライブストリップ操作) のストリップインサートパラメータとは別に、エンジンレベルのパラメータレジストリを持ちます。`addParameter(info)` でパラメータを 1 度登録し、`setParameter(id, value, renderFrame?)`（ランプには `setParameterSmoothed(...)`）でライブに変更するか、`setAutomationLane(id, points)` でタイムライン上にスケジュールします。

メタデータは `parameterInfo(id)` で調べられます。ホストが登録した id に加えて、ホストしたインストゥルメントのパラメータ、ミキサーのフェーダー／パン／ステレオ幅（`width`）のターゲット、エンジンがストリップ仕様を保持しているチャンネルストリップのインサートパラメータに対応する予約 id も解決します。予約 id のメタデータはコンパイル時の既定値とインサートカタログに基づき、現在の音声状態を表しません。インストゥルメントの既定値はロード前のパッチの値で、外部でバインドしたストリップにはインサートを説明する仕様が保持されません。`parameterCount()` と `parameterInfoByIndex(index)` が列挙するのはホストが登録したパラメータだけです。予約 id は `parameterInfo(id)` で取得できますが、この列挙には含まれません。Python は `parameter_info`、`parameter_count`、`parameter_info_by_index`、C API は `sonare_engine_parameter_info`、`sonare_engine_parameter_count`、`sonare_engine_parameter_info_by_index` を使います。

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

ストリップインサートとして使える `eq.*`、`dynamics.*`、`saturation.*`、`spectral.*`、`stereo.*`、`maximizer.*`、`multiband.*` は、すべてこの方法で id を解決でき、音声ブロック単位で動かせます。一方、信号全体を扱う `repair.*`、`loudness`、マッチ系のマスタリング段にはインサート形式もオートメーション id もありません。これらは信号全体をバッファリングするため、リアルタイム経路では動作しません。

```typescript
const thresholdId = engine.resolveBusInsertAutomationId(1, 0, 'thresholdDb');
if (thresholdId < 0) throw new Error('bus compressor threshold is not automatable');
engine.setAutomationLane(thresholdId, [
  { ppq: 0, value: -18 },
  { ppq: 8, value: -24, curveToNext: 3 },
]);
```

### ホストしたインストゥルメントをオートメーションする

MIDI デスティネーションにバインドしたシンセにもオートメーション可能なパラメータがあり、インサートパラメータとまったく同じ手順で解決できます。`resolveInstrumentAutomationId(destinationId, paramName)` は、ホストしたインストゥルメントの連続パラメータを JSON キー名（`'cutoffHz'` など）で指定し、`setAutomationLane`・`setParameter`・`setParameterSmoothed` にそのまま渡せる予約 id へ変換します。これによりホストは、シンセのカットオフやビブラートの深さをコントロールスレッドから小刻みに更新するのではなく、オートメーションレーンからオーディオブロック精度で駆動できます。解決されたレーンはオーディオスレッド上でスムージングされるため、ライブ再生とオフラインレンダリングの結果は一致します。

先に `setSynthInstrument` または `setSf2Instrument` でインストゥルメントをバインドしてから解決してください。解決はコントロールスレッド専用で、オーディオ側の状態には触れません。

::: code-group

```typescript [node]
engine.setSynthInstrument(0, patch);

const cutoffId = engine.resolveInstrumentAutomationId(0, 'cutoffHz');
if (cutoffId < 0) throw new Error('cutoffHz is not automatable on this instrument');

engine.setAutomationLane(cutoffId, [
  { ppq: 0, value: 400 },
  { ppq: 8, value: 6000, curveToNext: 1 },
]);
```

```python [python]
from libsonare import AutomationCurve, AutomationPoint

engine.set_synth_instrument(patch, destination_id=0)

# 引数の順序に注意: こちらは param_name が先です。
cutoff_id = engine.resolve_instrument_automation_id("cutoffHz", destination_id=0)

engine.set_automation_lane(cutoff_id, [
    AutomationPoint(ppq=0, value=400, curve_to_next=AutomationCurve.EXPONENTIAL),
    AutomationPoint(ppq=8, value=6000),
])
```

:::

::: warning Python だけ引数の順序が逆です
WASM と Node では `resolveInstrumentAutomationId(destinationId, paramName)` と、デスティネーションが先です。Python は `resolve_instrument_automation_id(param_name, destination_id=0)` と **名前が先** で、デスティネーションは既定値 `0` を持ちます。名前の位置にデスティネーション id を渡すと解決されずに例外になるので取り違えはすぐ表面化しますが、ホストを両者のあいだで移植するときは一度確認しておいてください。
:::

この id はパラメータだけでなくデスティネーションのスロットも符号化しているため、**同じ** `destination_id` に対するアンバインドと再バインドをまたいでも有効なままで、そのデスティネーションに何もバインドされていないあいだは単に何も適用しません。プリセット、エンジンモード、波形、フィルタモデル、ユニゾン、最大同時発音数といった構造的なフィールドはオートメーションできません。これらはボイスプールのサイズを変えたり DSP のトポロジを差し替えたりするため、オーディオスレッド上では安全に扱えないからです。こうした変更には、新しいパッチでインストゥルメントを再バインドしてください。

エンジンが持つインストゥルメントオートメーションのスロットは **32** 個です。使い切ったあとの解決は、既存のレーンを付け替えるのではなく失敗します。キーが未知のとき、そのデスティネーションに何もバインドされていないとき、インストゥルメントがオートメーション可能なパラメータを持たないとき、スロットが満杯のときは、WASM と Node が `-1` を、C の入口 `sonare_engine_resolve_instrument_automation_id` が `SONARE_ERROR_INVALID_PARAMETER` を返します。レーンに渡す前に必ず戻り値を確認してください。アレンジメントサブシステムを含まないビルドでは C の入口が `SONARE_ERROR_NOT_SUPPORTED` を返し、そのビルドはケイパビリティ JSON に `instrumentParamAutomation: false` を報告します。ホストはこれを見て、リゾルバが応答しないことを事前に判別できます。[`capabilities()`](./js-api.md#capabilities) を参照してください。

`setParamSmoothingMs(ms)` は、フェーダー／パンのスムーズな変更、インサートパラメータのオートメーション、MIDI CC マッピングに使う既定の追従時間を変更します。既定は `20` ms、`0` は即時変更です。ホストがオートメーション全体の感触を意図的に変える場合を除き、再生前にコントロールスレッドから 1 度設定してください。

### レーンはどう再生されるか

レーンはブレークポイントで描いた曲線であって、時刻指定のジャンプの並びではありません。各点は `{ ppq, value, curveToNext? }` で、ある点の `curveToNext` は *次の* 点へ向かう区間の形を決めます。

| `curveToNext` | 次の点までの区間 |
|---------------|------------------|
| `0` linear | 2 つの値を直線で結ぶ |
| `1` exponential | 対数領域で補間するため、ゲインや周波数のスイープが均一に聞こえる。符号が異なる 2 値のあいだは直線に戻る |
| `2` hold | 次の点までこの点の値を保ち、そこで段差で切り替わる |
| `3` s-curve | この点から緩やかに出て次の点へ緩やかに入る（smoothstep） |

曲線の外側は平坦です。最初の点より前では最初の値を、最後の点より後では最後の値を返し、外挿はしません。点は受け取った時点で `ppq` 順に並べ替えられ、同じ `ppq` の点が 2 つあれば先に渡したほうだけが残ります。瞬時のジャンプは `hold` 区間（または、ごくわずかに後ろへずらした 2 点目）で表すもので、同じ位置に 2 点を置いても表せません。`ppq` や `value` が有限でない場合、カーブコードが `0..3` の範囲外の場合は、クランプされずに `InvalidParameter` として拒否されます。

オーディオスレッドは、すべてのブレークポイント（ブロックはそこで分割されるため、ブレークポイントは正確なフレームに落ちます）と、その合間の **64 フレーム** ごとに曲線を標本化します。この間隔が広がるのは、固定長の境界リストが溢れるほどブロックが大きいときだけです。標本化した値は、ライブの `setParameter` と同じ経路でターゲットへ渡ります。ミキサーのフェーダー・パン・バスゲイン、インサートパラメータ、インストゥルメントパラメータはそれぞれのスムーザーを通る（インサートとインストゥルメントの追従時間は `setParamSmoothingMs` が決めます）ため、曲線の段差は短いグライドになります。`addParameter` で登録したパラメータは直接設定され、段差のまま動きます。境界リストに収まらないほどブレークポイントが 1 ブロックに集中すると `BoundaryOverflow` として報告され、あふれた分は本来のフレームではなく次の 64 フレーム境界で適用されます。

**再生中にレーンを書き換えても、それ自体でグリッチは起きません。** `setAutomationLane(id, points)` はその id のレーンだけを置き換え、ほかのレーンはそのまま残します。新しいレーン集合はコントロールスレッドが組み立てて発行し、オーディオスレッドは次のブロックの先頭で 1 度だけ最新の集合を取り込みます。ブロックの途中で切り替わることはなく、ロックもメモリ確保も伴いません。聞こえうるのは、書き込んだ値のほうです。現在の再生位置で新しい曲線の値が古い曲線と異なれば、ターゲットは次のサブブロックでその値へ移ります。スムーザーを通るターゲットではグライド、直接設定されるターゲットでは段差です。何もバインドされていない id を狙ったレーンはスキップされ、`drainTelemetry()` に `UnknownTarget` として報告されます。`rtSafe: false` で登録したパラメータは入口で拒否されます（WASM と Node は `SonareError` を投げ、C のエントリーポイントは `SONARE_ERROR_INVALID_PARAMETER` を返します）。

レーンをクリアするには空の点配列を渡します: `setAutomationLane(id, [])`。オーディオスレッドがクリアを取り込むと、対象は `setParameter` または `setParameterSmoothed` で最後に明示的に送った値へ戻ります。その id に手動値を一度も送っていなければ、現在値をそのまま保ちます。手動書き込みとレーンのクリアのどちらを先にオーディオスレッドが取り込んでも、この結果は変わりません。Python では `[]` を渡し、C API では `point_count == 0` にします。

## オーディオクリップ — ワープモードとページアンダーラン

`setClips(clips)` は、エンジンのオーディオクリップスケジュール全体をコントロールスレッドから 1 回の呼び出しで置き換えます。クリップは **直接** 型（`channels`: チャンネルごとに 1 本の `Float32Array`）か **ページ** 型（`pageProvider`: ホストがページ単位で供給するプロバイダ。[クリップ音声のページストリーミング](./realtime-streaming.md#クリップ音声のページストリーミング) を参照）のどちらかです。`startPpq` で配置し、`lengthSamples`・`clipOffsetSamples`・`loop`・`gain`・フェード長で形を整え、`warpMode` と `warpAnchors` でテンポマップへの追従の仕方を決めます。Python では同じ呼び出しを `set_clips`、`warp_mode` と綴ります。

```typescript
engine.setClips([{
  id: 1, trackId: 1, channels: [left, right],
  startPpq: 0, lengthSamples: barLength,
  warpMode: 'time-stretch',            // 'off' | 'repitch' | 'tempo-sync' | 'time-stretch'（または 0..3）
  warpAnchors: [                       // warpSample: クリップ先頭から / sourceSample: ソース先頭から
    { warpSample: 0,         sourceSample: 0 },
    { warpSample: barLength, sourceSample: sourceBarLength },
  ],
}]);
```

アンカーは有限かつ非負で、両軸とも狭義単調増加でなければならず、そうでなければ呼び出しは拒否されます。`'repitch'` と `'time-stretch'` は同じアンカーマップをオーディオスレッド上で読みます。アンカーが 2 個未満ならどちらもクリップをネイティブ速度で再生し、どちらのモードでもソース位置はマップだけで決まり（`clipOffsetSamples` は加算されません）、ループ継ぎ目のクロスフェードは適用されません。`'tempo-sync'` は生のエンジン上では性質が異なり、`setClips` の実行時に伸縮後の音声をベイクします。そのため tempo-sync クリップはページ型にできず、`loop` もできず、`clipOffsetSamples` はソースの範囲内でなければなりません。いずれも `InvalidParameter` として拒否されます。各モードが音楽的に何を意味し、どれをいつ選ぶかは [ワープとテンポ同期](./glossary/arrangement/warp-and-tempo.md) にあります。

### `'time-stretch'` のボイス予算

`'time-stretch'` クリップは、レンダーするブロックごとに事前確保されたストレッチャボイスを 1 本借ります。プールの容量は既定で **8** 本で、1 本のボイスが扱えるのは **2 チャンネル** までです。コントロールスレッドから `setWarpVoiceCapacity(voices)` で容量を設定し、`warpVoiceCapacity()` で読み取れます。Python では `set_warp_voice_capacity()` と `warp_voice_capacity()`、C では `sonare_engine_set_warp_voice_capacity()` と `sonare_engine_warp_voice_capacity()` を使います。指定できる範囲は **0..64** です。64 を超える値は拒否され、直前の容量は変わりません。容量 **0** はこれらのクリップのタイムストレッチを無効にします。クリップは `'repitch'` 経路を使い、このフォールバックは `warpStretchOverflowCount()`（Python では `warp_stretch_overflow_count()`、C では `sonare_engine_warp_stretch_overflow_count()`）に加算されません。エンジンが prepare 済みのときに容量を変更すると、ボイスプールが直ちに作り直され、その時点でボイスを使っているクリップは WSOLA 状態を引き継がずに再開します。

クリップは前のブロックで使ったボイスをそのまま使い続け、新しいクリップは空いているボイスか、最も長くアイドル状態だったボイスを取ります。出力中のボイスが音の途中で奪われることはありません。空きボイスがないと、そのブロックは `'repitch'` 経路になり、オーバーフローカウンターが増えます。ソースが 3 チャンネル以上の場合もストレッチャの状態に収まらないため `'repitch'` 経路になります。カウンターは prepare 済みセッション内で単調増加し、`prepare` でリセットされます。シーク、ループの折り返し、ボイスの付け替えが起きるとストレッチャのストリームは新しい位置から再開するため、つなぎ目は前の位置を引きずらず、きれいな頭出しになります。

### ページアンダーランはどう見えるか

ページ型クリップは、オーディオスレッド上でプロバイダからサンプルを読みます。あるサンプルを含むページが常駐していなければ、その読み出しは **ページミス** です。そのクリップはそのサンプルについて無音を出し、ほかのクリップやインストゥルメントは通常どおりレンダーされ、トランスポートは走り続けます。エンジンがストレージを待って止まることはありません。ミスはホストが供給すべきページ要求としてキューに入り、あわせて `drainTelemetry()` にブロックあたり 1 回、エラー `ClipPageUnderrun`（序数 `15`、Python では `CLIP_PAGE_UNDERRUN`）として、`value` にクリップ id を載せて報告されます。このレコードが音切れの合図です。

このレコードをそもそも出さないために、プレイヤーは *これから* 読むページも要求します。既定では各ブロックの先にあるタイムライン半秒ぶんを、同じ要求キューを通して要求します。この窓の幅、その設定方法、JS 側のストリーミング窓との関係は [先読み](./realtime-streaming.md#先読み) にあります。要求そのものには、ミスなのか先読みなのかの区別がありません。ミスを示すのはテレメトリのレコードだけなので、要求はすべて速やかに供給してください。有界の要求キューが満杯になると `clipPageRequestOverflowCount()` が増えます。落ちたページは次のブロックで再度要求されますが、供給されるまでに来たブロックはそのぶん無音になります。

::: warning ページングによる音切れの見分け方
1 つのクリップだけに空白が生じ、それが `ClipPageUnderrun` のレコードと一致するなら、再生位置が到達した後にホストがページを供給したということです。まず `clipPageRequestOverflowCount()` を確認し（増えていれば要求が落ちています）、次に先読みかストリーマの読み先窓を広げてください。このレコードを **伴わない** 音切れはページングの問題ではありません。`droppedRecords`、コマンドキューのオーバーフロー、ブロック予算のほうを見てください。
:::

## サラウンドグループバスとワイドメーター

サラウンドの `channelLayout`（`SonareChannelLayout`: `0` モノラル、`1` ステレオ、`2` 5.1、`3` 7.1）で宣言したバスは**サラウンドグループバス**になります。バスはプレーンごとにマスターへ合算し、プレーン別メーターを公開します。そこへルーティングしたレーンは点音源へフォールドされた後、ストリップの [`surroundPan`](./mixing.md#サラウンドとマルチチャンネル) に従って配置されます。`azimuth`、`divergence`、`lfe` は有効で、`elevation` と `distance` は予約です。[ミキサーグラフとプロジェクトバウンス](./project-bounce.md#バウンスオプション)も同じ幅でサラウンドバスをレンダリングし、同じ規則に従います。ステレオ専用なのは単体の `Mixer`（`processStereo`）だけです。

サラウンドバスから信号を受けるストリップ ── バス出力やセンドの先にあるリターンストリップ ── は、ベッドをステレオへ畳んでから再度散布するのではなく、そのバス自身の幅で動作します。フェーダー・インサート・センドはすべてのプレーンに作用し、主出力がステレオ（またはそれ以下）のストリップだけがパン／幅のステージを保ちます。バスの幅より狭い宛先 ── 別のバス、レンダリング時のチャンネル数でのマスター、あるいは常にステレオであるサイドチェインのキータップ ── は、前方ペアだけを取るのではなく [ITU-R BS.775](https://www.itu.int/rec/R-REC-BS.775) ダウンミックスを受け取ります。広い宛先は送り元のプレーンをそのままのインデックスで受け取ります。サラウンドバス、そしてステレオより広く構築されたマスターは、パンをすでに拒否しているのと同じ理由で、既定以外のパンや幅を拒否します ── スピーカーベッドには、狭めたり広げたり動かしたりするステレオ像がありません。

```typescript
engine.setTrackBuses([{ busId: 1, channelLayout: 2 }]);  // 5.1 のグループバス
engine.setTrackLanes([{ trackId: 1, outputBusId: 1 }]);  // レーンをそこへルーティング
engine.setTrackStripJson(1, JSON.stringify({
  strips: [{ id: 'source', surroundPan: { azimuth: -30, divergence: 0, lfe: 0 } }],
  buses: [],
  connections: [],
}));
```

`EngineTrackLane` の `sourceChannelLayout` は現状では説明／シリアライズ用です。レーンのレンダー入力はまだモノラルまたはステレオで、ステレオはサラウンド配置の前に点音源へフォールドされます。既存の 5.1/7.1 ソースがディスクリートのまま保たれる指定としては使わないでください。

`setTrackLanes` で `outputBusId: 0` を指定する（または、このメソッドを持つ `SonareEngine` ワークレットファサード側で `setTrackOutputBus(1, 0)` を呼ぶ）と、レーンをマスターミックスへ戻せます。

サラウンドメーターはライブのワークレットメーターリングを通りません。オフラインまたはメインスレッドのエンジンで `drainMeterTelemetryWide(maxRecords?)` を使って読み取ると、プレーンごとの（ワイドな）レコードが返ります。`drainMeterTelemetry()` はステレオの高速パスのままです。この 2 つのドレインは同じシングルコンシューマのテレメトリキューを消費するため、1 つのエンジンインスタンスにつきどちらか一方だけを呼んでください。ライブの AudioWorklet 経路はステレオドレインでキューを消費しており、そのため `drainMeterTelemetryWide()` はオフライン（非ワークレット）エンジン向けです。両方を 1 つのエンジンで回すと、互いのレコードを奪い合います。

## MIDI クリップスケジューリングと `sampleAtPpq`

音声クリップにはクリップスケジュールとページプロバイダがあり、**MIDI クリップ**には専用のリアルタイムスケジュールがあります。`setMidiClips(clips)` はエンジンの MIDI クリップスケジュール全体を 1 回の呼び出しで置き換え、各クリップはイベントを MIDI の**送出先（デスティネーション）id** に従って楽器へルーティングします（`setBuiltinInstrument`、`setSynthInstrument`、`setSf2Instrument` でバインドした楽器。デスティネーションモデルは [MIDI 入力](./midi-input.md)を参照）。

このスケジュールは*コンパイル済み*です。タイミングは PPQ ではなく**エンジンタイムライン上の絶対サンプル**で表します。音楽的な位置の変換には `sampleAtPpq(ppq)` を使ってください。エンジンのテンポマップ（`setTempo` / `setTempoSegments` のすべての変更）を積分するため、テンポが途中で変わっても正しい位置が得られます。

`setTempoSegments([{ startPpq, bpm, endBpm? }, ...])` と `setTimeSignatureSegments([{ startPpq, numerator, denominator }, ...])` は、コントロールスレッドで区分的なマップを設定します。`endBpm` が 0 以外なら、そのセグメントの `bpm` からランプします。空配列を渡すとマップを消去し、直近に `setTempo` または `setTimeSignature` で設定した単一値へ戻ります。

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

クリップは `gain`（リニア、既定 `1`）、`fadeInSamples`、`fadeOutSamples`（既定 `0`。内部ループの 1 周ごとではなく、クリップ全長に対して 1 回）を持ち、イベント自体（ノートのタイミングや強さ）ではなく、宛先のレンダー後の楽器出力に適用されます。宛先ごとに、アクティブなクリップのうち最も新しく開始したものがエンベロープを決めます。そのクリップが終了しても、先に開始したクリップがまだアクティブなら、そちらのエンベロープに戻ります。アクティブなクリップがなくなった場合に限り、最後に終了したクリップの終了時点の値（フェードアウトがあれば `0`、なければ `gain`）を保持します。同時に開始したクリップは id が大きいほうが優先されます。宛先上のどのクリップもまだ開始していない間は、宛先はユニティで再生されます。同じ宛先へルーティングされた複数のトラックはこのエンベロープを共有します ── トラックごとではなく、選ばれたクリップが宛先全体を決めます。`lengthSamples` が `0`（オープンエンド）のとき `fadeOutSamples` を `0` より大きくすると拒否されます。終わりのないクリップにはフェードしていく先がありません。C ABI 上でゼロ初期化された `SonareEngineMidiClipSchedule` は無音です（`gain` が `0` になります）。JS と Python のバインディングは、省略された `gain` を `0` ではなく `1` として扱います。

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
