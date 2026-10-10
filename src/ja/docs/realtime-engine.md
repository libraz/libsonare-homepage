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

### シークとメトロノーム

`seekSample(timelineSample, renderFrame?)`、`seekPpq(ppq, renderFrame?)`、`seekMarker(markerId, renderFrame?)` は、プレイヘッドのジャンプをキューします（マーカー版は先に `setMarkers([...])` を呼びます）。他のキュー済みコマンドと同じく `renderFrame` で、省略時は次のブロック先頭で適用されます。シークは、ループの折り返しや停止と同様に、鳴っているノートを解放しコントローラーをリセットします。`setMetronome({ enabled, beatGain?, accentGain?, clickSamples?, clickSeconds? })` でクリックを設定し、`metronome()` で読み戻せます。クリックの長さは 1 秒までです。ワークレットの `SonareEngine` では、ライブリングがコマンドをキューできないとき `setMetronome` は `false` を返します。

```typescript
engine.setMetronome({ enabled: true, beatGain: 0.5, accentGain: 0.9, clickSeconds: 0.01 });
engine.seekPpq(16);
```

### コンパイル済み Project タイムラインをインストールする

`Project.compileTimeline()` はコンパイル結果に `timeline` ハンドルを加えて返します。適用する前に `hasTimeline` と診断情報を確認してください。エラー時の `timeline` は `null` です。`RealtimeEngine.applyProjectTimeline(timeline)` は、**停止中かつ prepare 済み**のエンジンに対してコントロールスレッドから呼び出し、タイムラインのプロジェクトサンプルレートを prepare 済みのレートと一致させます。テンポ／拍子記号セグメント、マーカー、トラックレーン、トラックオートメーション、オーディオ／MIDI クリップ、プロジェクトのミキサーシーンにあるトラックごとのストリップをまとめて置き換えます。インストゥルメント、バス、マスターストリップ、メトロノーム、ループ、キャプチャはエンジン側の設定を保つため、インストゥルメントは別にバインドしてください。

適用は全体として成功するか失敗します。破棄済みのタイムライン、不正なシーンまたはタイムライン、複数トラックからルーティングされたシーンストリップは拒否され、置き換えは公開されません。WASM では、同じ初期化済みモジュールが作った `ProjectTimeline` だけを渡せます。別のモジュールインスタンスのハンドルや解放済みハンドルは適用できません。適用に成功するとエンジンが自分の参照を保持するため、タイムラインはすぐに破棄できます。タイムラインを適用した後、別のサンプルレートでの prepare は、`setClips([])` と `setMidiClips([])` でタイムラインの両方のクリップ領域を消去するまで拒否されます。

```typescript
const project = new Project();
project.setSampleRate(48000);
project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
const { clipId } = project.addMidiClip(0, 4);
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 0, 60, 100),
  Project.midiNoteOff(2, 0, 0, 60, 0),
]);

const compiled = project.compileTimeline();
if (!compiled.hasTimeline || compiled.timeline === null) {
  throw new Error(compiled.messages);
}
const engine = new RealtimeEngine(48000, 128);
try {
  engine.applyProjectTimeline(compiled.timeline);
  compiled.timeline.dispose(); // エンジンが独自の参照を保持します
} finally {
  engine.destroy();
  project.delete();
}
```

`RealtimeEngine` はトランスポート以外にも、パラメータ情報の登録、オートメーションレーンの設定、シーク、メトロノームクリックの設定、モニター出力付き処理、キャプチャ、オフラインバウンス、クリップのフリーズも扱えます。UI を組むうえで重要なテレメトリは 2 系統あります。

- **メーター** — ステレオ高速経路なら `drainMeterTelemetry()`、サラウンド／オフライン対象のプレーン別レコードなら `drainMeterTelemetryWide()` を使います。
- **スコープ** — `configureScopeTelemetry(intervalFrames, bandCount)` を 1 度呼んでターゲットごとのスペクトラム＋ベクトルスコープ取得を有効化し、`drainScopeTelemetry()` でスナップショットを読み出します。
  - `intervalFrames` — スナップショット間の最小レンダーフレーム間隔（`0` で取得を無効化）。
  - `bandCount` — FFT のバンド分解能。`1..64` にクランプされ、実際に適用されたバンド数が戻り値として返ります。

メーターレコードにはトリム前入力ピークも含まれます。ステレオ経路では `inputPeakDbL` と `inputPeakDbR`、ワイド経路では有効なプレーンごとの `inputPeakDb` として返ります。`gainReductionDb` はマスターだけでなく、対象ストリップまたはバスのリダクションを報告します。

集約値の元になったインサートごとの値は `meterTargetInsertGainReduction(targetId)` で取得できます。直近にレンダーしたブロックのリダクションを dB（各値は `<= 0`）で、プリフェーダーからポストフェーダーまでをまとめたインサート順に返します。バイパス中またはダイナミクス系ではないインサートは `0` で、メーターレコードの `gainReductionDb` はこの配列の最小値です。`targetId` の `0` はマスター、`1..32` はレーン、`33..40` はバス、入力モニターは空配列です。

AudioWorklet では、postMessage の構造化メータースナップショットに `insertGainReductionDb` が付くのは、1 回のドレインでターゲットごとに最新のレコードだけです。値はドレイン時点でコミットされた最新ホストブロックを表します。固定レイアウトの SharedArrayBuffer メーターリングにはこの任意フィールドを置けないため、リング経路では `SonareEngine.pollInsertGainReduction(targetId)`（または低レベルノードの `SonareRealtimeEngineNode` メソッド）を呼び出してください。

AudioWorklet の生メーターリングは 49 float のレコードを使い、ヘッダーのスロット 3 にはプロトコルバージョン 2 が入ります。そのため、異なるパッケージバージョンのメインスレッドとワークレットでリングを共有してはいけません。`SharedArrayBuffer` を直接読むコードは、固定されたレコード形式を前提にせず、公開された `SONARE_METER_RING_RECORD_FLOATS` 定数でレコードのサイズとストライドを決め、レコード数／ヘッダーを使ってください。

読み出した各スコープスナップショットは `targetId`（マスター・レーン・バスのいずれか）で識別され、2 本の配列を持ちます。`bands` は線形バンドの FFT マグニチュード（dB、長さ＝適用されたバンド数）、`points` はベクトルスコープ表示用のゴニオメータ点群で、`{ left, right }` レコードが最大 32 ステレオ点入ります（ワークレットのスコープリングバッファは同じ点群をインターリーブされた `[l0, r0, l1, r1, …]` の `Float32Array` として渡します）。スペクトラムは実際のサンプル数に Hann 窓を適用し、窓のコヒーレントゲインを正規化した FFT から、各線形バンドに含まれるビンの平均パワーを dBFS へ変換して求めます。読み値はレンダーブロックサイズ、FFT の周波数分解能、`bandCount` に依存するため、これらの設定をそろえたスナップショット同士を比較してください。

マスターメーターの統合ラウドネスをやり直すには `resetMasterLoudnessMeter(renderFrame?)` を呼びます（Python は `reset_master_loudness_meter(render_frame=None)`、ワークレットノードは `resetMasterLoudnessMeter(sampleTime?)`）。このコマンドが消去するのは統合ラウドネスの積算値だけで、モーメンタリー、ショートターム、True Peak の履歴は保持されます。`renderFrame` はリセットを適用するレンダーフレームで、省略すると次のブロック先頭で適用されます。負の値は拒否され（WASM と Node では `RangeError`）、これはトランスポート、パラメータ、ソロ／ミュート、MIDI の各呼び出しにある `renderFrame` すべてに共通です。

`drainMeterTelemetry()`／`drainMeterTelemetryWide()`／`drainScopeTelemetry()` が返す各レコードには、生成元のタップに対応する `droppedRecords` が含まれます。この値はタップの `prepare` または `reset` 以降に失われたレコードの累積数で、ドレインしても 0 には戻りません。前回のポーリング値と比較し、増加していればその間にレコードが失われています。値が変わらなければ、その間に新しいドロップはありません。0 以外でも、以前の期間に発生したドロップを示す場合があります。

メーターレコードの dB 値を持つレベル／ラウドネスのフィールド（`peakDbL`／`R`、`rmsDbL`／`R`、`truePeakDbL`／`R`、`maxTruePeakDb`、`momentaryLufs`／`shortTermLufs`／`integratedLufs`）はすべて −120 dBFS のフロアを持ち、`NaN` や `-Infinity` を返しません。未初期化・無音・未書き込みのプレーン（例: モノラルレーンの右チャンネル）は 0 dBFS ではなく −120 dBFS を返すので、レコードは常に JSON セーフです（`correlation`・`monoCompatWidth`・`gainReductionDb` などの非 dB フィールドは 0 が既定）。積分系メーターのフィールド（`momentaryLufs`／`shortTermLufs`／`integratedLufs` と true-peak 系）は、ストリーミングが一定時間続いて初めてフロアより上に上がります。短いレンダーやワンショットのレンダーでは −120 のままです。

スケジュール済みのクリップとシーケンス MIDI が鳴るのは、トランスポートが走っている間だけです。停止中のエンジンでは音が漏れず無音のままです。オフラインヘルパー（`renderOffline`、`bounceOffline`、`freezeOffline`）はレンダー期間だけトランスポートを走らせ、終了後に元の状態へ戻すので、オフラインのクリップ／MIDI レンダリングに手動の `play()` は不要です。

`bounceOffline` は prepare 済みのエンジンレートでレンダーします。`sourceSampleRate` を 0 または省略するとそのレートになり、0 以外を指定する場合は一致しなければ拒否されます。`totalFrames` はソースレートで数えます。`targetSampleRate` を 0 または省略するとソースレートを保ち、別のレートを指定すると返却バッファをリサンプルして `result.sampleRate` にそのレートを報告します。

`bounceOffline` と `freezeOffline` は、聴こえるレンダーの前に非レンダーのオフラインプライムを行います。キュー済みコマンドを排出し、すべてのミキサーとエフェクトのプロセッサを prepare 直後の状態へリセットし（インストゥルメントはリセットしません）、公開済みのテンポ／グラフ／レーン／オートメーションのスナップショットを取り込み、開始位置のオートメーションを適用してからパラメータランプを確定値へスナップします。プライム中はトランスポートを停止するため、プレイヘッドは進みません。ユーザーが `play()` やプライミング用の `process()` を呼ぶ必要はありません。プロセッサが prepare 直後の状態から始まるので、ライブ再生で鳴り残っていたインサートのテールやディレイラインは切れ、同じエンジンでの 2 回目のバウンスは 1 回目と同じ音声になります。

`renderOffline` はチャンク化できる低レベルのレンダーで、エンジンの現在のライフサイクルとランプ状態を保ち、停止中ならレンダー中だけトランスポートを走らせて元へ戻します。停止中の `process()` の量子はプロセッサ状態を進めるため、同等のプライムにはなりません。`settleParameters()` だけでは既知のターゲットをスナップするだけで、保留中のレーン／グラフ／テンポのスナップショットは取り込みません。ライブ音声スレッド外で使用してください。

prepare 時のブロックサイズより大きなブロックサイズは、`renderOffline`、`bounceOffline`、`freezeOffline`、`primeOfflineParameters` のいずれでも拒否されます（`InvalidParameter` の `SonareError`。ワークレットファサードは `RangeError`）。prepare 時のサイズで黙ってレンダーすることはありません。`blockSize` の既定値は 128 で、prepare 時のサイズより小さくてもかまいません。

```typescript
engine.renderOffline({ channels: [new Float32Array(totalFrames), new Float32Array(totalFrames)], blockSize: 128 });
```

### チャンク化したレンダーと手動のプライム

ブロック単位でレンダーするホストは、このプライムの各ステップを自分で実行できます。

| メソッド | 動作 |
|--------|------|
| `primeOfflineParameters(numChannels, blockSize)` | レンダーを伴わないオフラインプライム全体。キュー済みコマンドの適用、ミキサーとエフェクトのプロセッサのリセット、スナップショットの取り込み、トランスポート位置でのオートメーションとレーンゲートの解決、スムーザーのスナップを行います。最初のチャンクの前に 1 度呼ぶと、繰り返しのレンダーが同じ状態から始まります。 |
| `resetProcessorState(renderFrame?)` | プロセッサのリセットだけをキューし、`renderFrame`（省略時は次のブロック先頭）で適用します。再生中に呼ぶと、シークと同じく鳴っているインサートのテールやディレイラインを途中で切ります。 |
| `settleParameters()` / `settleInsertParameters()` | 進行中のパラメータランプ、または構造変更後のインサートオートメーションスロットだけをスナップします。 |
| `finishOfflineRender()` | `renderOffline({ ..., finalize: false })` で始めたチャンク化レンダーを終えます。保持中のノートを解放し、ディレイラインをフラッシュします。省略すると、最後のチャンクで鳴っていたノートが鳴り続けます。 |
| `tailSamples()` / `graphLatencySamplesQ8()` | 可聴テールの上限（サンプル数。`2147483647` は無制限）と、処理レイテンシ（1/256 サンプル単位）。 |

```typescript
engine.primeOfflineParameters(2, 128);
// 各チャンクはブロック数の整数倍で、blockSize はすべて同じにします。
engine.renderOffline({ channels: chunkA, blockSize: 128, finalize: false });
engine.renderOffline({ channels: chunkB, blockSize: 128, finalize: false });
engine.finishOfflineRender();
```

Python では `prime_offline_parameters`、`reset_processor_state`、`settle_insert_parameters`、`finish_offline_render`、`tail_samples`、`graph_latency_samples_q8` です。ワークレットの `SonareEngine` にも `bounceOffline`、`freezeOffline`、`finishOfflineRender`、`renderOffline({ totalFrames, blockSize?, finalize? })` があり、ファサードのメインスレッド側オフラインエンジンで実行されるため、レンダーが終わるまで呼び出し元のスレッドをブロックします。

録音まわりでは、キャプチャ面にいくつかのコントロールが加わります。

- `setCaptureSource('output' | 'input')` — エンジンのレンダー済み出力バスを録るか、`process(...)` に渡す生の入力を録るかを選びます。
- `setRecordOffsetSamples(offset)` — モニタリングの往復レイテンシを補正するため、キャプチャ音声をずらします。
- `setInputMonitor(enabled, gain?)` — 演奏者が自分の音を聞けるように、ライブ入力を出力へミックスします。

`captureStatus()` は、現在のキャプチャ元 `source`（`'output'` または `'input'`）と現在の `recordOffsetSamples` の両方を返すので、何を録っているかを UI 側で確認できます。全体の流れは [録音とテイク](./recording-and-takes.md) を参照してください。

::: info ライブ MIDI と録音
エンジンは、楽器への**ライブ MIDI** 入力（`pushMidiNoteOn`、`pushMidiCc`、`pushMidiPitchBend`、`pushMidiChannelPressure`、`pushMidiPolyPressure`、`pushMidiUmp`、`pushMidiSysex`）と、再生されている内容の**録音**も受け付けます。これらには専用ページがあります。Web MIDI からエンジンへのブリッジ（ポート管理、CC バインド、NativeSynth／SF2 のデスティネーション）は [MIDI 入力](./midi-input.md) を参照してください。キャプチャ・ループ録音のテイク／コンプレーン・`getUserMedia` をエンジンノードへつなぐブラウザマイクヘルパー `bindMicrophoneInput(...)` は [録音とテイク](./recording-and-takes.md) を参照してください。
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
// （省略 = 次のブロック先頭で適用、将来のフレームを渡すとサンプル精度で適用）。
engine.setSoloMute(0, true, false);
```

::: info レーンの順序は `setTrackLanes(...)` に従います
`setTrackLanes(...)` が成功すると、トラックの並べ替え、削除、追加が反映されます。キュー済みコマンド、センド、インサートオートメーション、レーン状態はトラックの識別子に追従し、レーンインデックスは呼び出し後の現在位置になります。生の `RealtimeEngine` では、呼び出しのたびに各レーンのセンドを、そのレーンのエントリーが渡した `sends` 配列から作り直します。`sends` を省略すると（id だけの指定を含む）、既存のセンドは維持されず消去されます。省略時にセンドを維持するのは `SonareEngine` ワークレットファサードのほうで、JS 側にセンドのキャッシュを持ち、呼び出しのたびに完全なリストを裏で再送信しています。トポロジー変更後は、数値のレーン指定やトラックインサート指定を読み直してください。

レーン一覧を書き直さずに 1 レーンのセンドや出力バスだけを変えるには、`setTrackSends(trackId, sends)` と `setTrackOutputBus(trackId, busId)` を使います（C は `sonare_engine_set_track_sends` / `sonare_engine_set_track_output_bus`、Python は `set_track_sends` / `set_track_output_bus`）。どちらもそのレーンのほかのフィールドと、ほかのレーンには触れません。センドのリストが変わらなければ、進行中のレベルランプも維持されます。未知のトラック id、宣言されていないバス、重複したセンド先バス、センドの範囲外のレベルは例外になります。生の `RealtimeEngine` では、レーンが `setTrackLanes` で宣言済みである必要があります。ワークレットファサードの `setTrackSends` は、トラックにレーンがなければ作成します。

センドやインサートのためにエンジンが作ったストリップ、またはシーン仕様から構築したストリップを持つレーンを含め、中央のモノラルレーンはどのパンロウでもユニティで再生されます。パンを振れば、そのぶん動きます。
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

設定済みの各トラックレーンは、独立したキュー／モニターバスへ信号を送れます。`setTrackMonitorMode(laneIndex, mode, renderFrame?)` でモードをキューします。`laneIndex` は直近の `setTrackLanes` 呼び出しにおける現在の位置なので、並べ替え後は読み直してください。`renderFrame` を省略すると次のブロック先頭で適用され、`mode` は `'off'`・`'pfl'`・`'afl'`（または序数 `0`・`1`・`2`）です。

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
| レーンをグループバスへ折り込む（`busId 0` でマスターミックスへ戻す） | `setTrackLanes(...)` のレーン `outputBusId`（`0` または未指定でマスターミックス）、または 1 レーンだけなら `setTrackOutputBus(trackId, busId)` | `setTrackOutputBus(target, busId)`（`busId 0` でマスターミックスへ戻す） |
| 1 レーンの補助センドを置き換える（空配列で消去） | `setTrackSends(trackId, sends)` | `setTrackSends(target, sends)` |
| バスを別バスへ折り込む、またはコピーをセンドする | `setTrackBuses(...)` のバス `outputBusId` と `sends`（出力が `0`／未指定ならマスターミックス） | `setTrackBuses(...)` の同じフィールド |
| サイドチェインのバインディングを適用せずに検査 | `canSetLaneSidechain(trackId, insertIndex, sourceTrackId)`、`canSetBusSidechain(...)`、`canSetMasterSidechain(...)`（引数はセッターと同じ） | 同名 |
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

レーンのサイドチェインキーは、ソースレーンのストリップ後かつレーンフェーダー前から取り、宛先ストリップの入力へディレイ補正します。エンジンはサイドチェインキーの順序でレーンをレンダーするため、`setTrackLanes(...)` に渡した順序やレンダーブロックサイズに結果が左右されません。自己キー、閉路、満杯のバインディングテーブル、ディレイ補正の上限を超える整列は拒否され、バインディングは変わりません。この補正はエンジンの報告レイテンシに含まれます。`setTrackStripChannelDelaySamples(...)` はそのストリップだけを遅らせ、PDC や報告レイテンシは変えません。

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

各 `canSet*Sidechain` はセッターと同じ引数を取り、何も変更せずに `SidechainCheck`（`{ ok, reason }`）を返します。`reason` は `ok` が true のときだけ `null` で、そうでなければセッターが最初に失敗するチェックを `'invalidTarget'`、`'insertOutOfRange'`、`'undeclaredSource'`、`'invalidSourceKind'`、`'selfKey'`、`'cycle'`、`'tableFull'`、`'planRefused'` のいずれかで示します。UI では、不可能なキー元を提示する前にグレーアウトするのに使えます。レーンの `insertOutOfRange` はそのレーンのストリップに該当するインサートがないこと（ストリップのないレーンはインサートを持ちません）、`undeclaredSource` はソースのトラックにレーンが宣言されていないことを表し、バスとマスターの形式でも同じ理由が返ります。`planRefused` は、ディレイ上限を超えるアラインメントかオーバーフローだけを意味します。Python にも同じ 3 つのメソッド（`can_set_lane_sidechain` など）があり、`SidechainCheck` を返します。いずれもコントロールスレッド専用です。

```typescript
engine.canSetLaneSidechain(1, 0, 1);  // { ok: false, reason: 'selfKey' }
engine.canSetLaneSidechain(1, 0, 2);  // { ok: true, reason: null }
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

// あるいはコントロールスレッドから命令的に設定する（renderFrame を省略すると即時）。
engine.setParameter(1, 0.5);
```

トラック、バス、マスターのフェーダーとトラックのパンは、パラメータを登録せずに自動化できます。生の `RealtimeEngine` では、先にレーンとバスを宣言（`setTrackLanes`、`setTrackBuses`）してから id を解決します。

```typescript
const faderId = engine.resolveTrackLaneAutomationId(1, 'faderDb'); // または 'pan'
const busId = engine.resolveBusAutomationId(1, 'faderDb');
if (faderId < 0 || busId < 0) throw new Error('declare the lane and bus first');
engine.setAutomationLane(faderId, [{ ppq: 0, value: 0 }, { ppq: 8, value: -12 }]);
```

トラックにレーンがない、またはバスが設定されていないときは、どちらも `-1` を返します（Python は `SonareError` を送出します。`resolve_track_lane_automation_id`、`resolve_bus_automation_id`。C は `sonare_engine_resolve_track_lane_automation_id`、`sonare_engine_resolve_bus_automation_id`）。id は位置ではなくトラックまたはバスそのものを指すため、`setTrackLanes` や `setTrackBuses` の並べ替え、他のストリップの削除をまたいでも同じストリップを駆動し続けます。そのトラックまたはバス自身が削除されると、何も適用しなくなります。マスターのフェーダー、パン、幅の id は固定で、解決は不要です。予約済みのミキサー id 名前空間（`0x4D58xxxx`）で受け付けるのはマスターの id だけです。`setParameter`、`setParameterSmoothed`、`setAutomationLane` は、それ以外の id を `InvalidParameter` で拒否します。トラックとバスの id は、計算で組み立てず、必ずリゾルバーか `automationParamId` から受け取ってください。`SonareEngine` ワークレット API の `automationParamId(target, 'faderDb' | 'pan')` と `busAutomationParamId(busId)` も同種の id を返し、初回利用時にミキサーのレーン／バスを宣言します。

インサートパラメータも同じオートメーションレーンで動かせますが、先に予約 id を取得します。`resolveTrackInsertAutomationId(trackId, insertIndex, paramName)`、`resolveMasterInsertAutomationId(...)`、`resolveBusInsertAutomationId(...)` のいずれかを呼び、その戻り値を `setAutomationLane`、`setParameter`、`setParameterSmoothed` に渡してください。`insertIndex` はストリップの pre インサート、続いて post インサートを連結した列を指し、`paramName` は `masteringInsertParamInfo` が返す JSON キーです。未知のストリップ／インサート／キーでは WASM/Node は `-1`、Python は `SonareError` を返します。

トラック、バス、マスターのインサート id は、同じ寿命の規則に従います。id はストリップをその識別子と、スロットにあるプロセッサの種類（`effects.gsEfx` では EFX タイプも）で指します。`setTrackLanes` や `setTrackBuses` の並べ替え、他のストリップの削除をまたいでも有効です。ストリップが削除されるか、スロットが別の種類のプロセッサに替わると無効になります。その id は何も適用せず、キュー済みの編集は破棄され、再発行もされないので、新しいプロセッサに対しては解決し直してください。エンジンが保持できるインサート id のエントリーは 8192 個で、それを超えるストリップ、バス、レーンの変更は `InvalidParameter` で拒否されます。`insertParameterConstructedValue(paramId)` は、現在のライブ値やオートメーション値ではなく、そのインサートパラメータの構築時に使った不変値を返します。

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

`setClips(clips)` は、エンジンのオーディオクリップスケジュール全体をコントロールスレッドから 1 回の呼び出しで置き換えます。クリップは **直接** 型（`channels`: チャンネルごとに 1 本の `Float32Array`）か **ページ** 型（`pageProvider`: ホストがページ単位で供給するプロバイダ。[クリップ音声のページストリーミング](./wasm-streaming.md#クリップ音声のページストリーミング) を参照）のどちらかです。`startPpq` で配置し、`lengthSamples`・`clipOffsetSamples`・`loop`・`gain`・フェード長で形を整え、`warpMode` と `warpAnchors` でテンポマップへの追従の仕方を決めます。Python では同じ呼び出しを `set_clips`、`warp_mode` と綴ります。

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

`setClips` はスケジュール全体を置き換えます。他のクリップを再送せずに 1 つだけ追加・置換・削除するには、`upsertClip(clip)`（同じ `id` のクリップを置き換え、なければ追加）と `removeClip(clipId)`（その id のクリップがなければ `InvalidParameter`）を使います。他のクリップの音声は再コピーされず、拒否されたクリップがあっても公開済みのセットは変わりません。Python では `upsert_clip` と `remove_clip` です。

アンカーは有限かつ非負で、両軸とも狭義単調増加でなければならず、そうでなければ呼び出しは拒否されます。`'repitch'` と `'time-stretch'` は同じアンカーマップをオーディオスレッド上で読みます。アンカーが 2 個未満ならどちらもクリップをネイティブ速度で再生し、どちらのモードでもソース位置はマップだけで決まり（`clipOffsetSamples` は加算されません）、ループ継ぎ目のクロスフェードは適用されません。`'tempo-sync'` は生のエンジン上では性質が異なり、`setClips` の実行時に伸縮後の音声をベイクします。そのため tempo-sync クリップはページ型にできず、`loop` もできず、`clipOffsetSamples` はソースの範囲内でなければなりません。いずれも `InvalidParameter` として拒否されます。各モードが音楽的に何を意味し、どれをいつ選ぶかは [ワープとテンポ同期](./glossary/arrangement/warp-and-tempo.md) にあります。

### `'time-stretch'` のボイス予算

`'time-stretch'` クリップは、レンダーするブロックごとに事前確保されたストレッチャボイスを 1 本借ります。プールの容量は既定で **8** 本で、1 本のボイスが扱えるのは **2 チャンネル** までです。コントロールスレッドから `setWarpVoiceCapacity(voices)` で容量を設定し、`warpVoiceCapacity()` で読み取れます。Python では `set_warp_voice_capacity()` と `warp_voice_capacity()`、C では `sonare_engine_set_warp_voice_capacity()` と `sonare_engine_warp_voice_capacity()` を使います。指定できる範囲は **0..64** です。64 を超える値は拒否され、直前の容量は変わりません。容量 **0** はこれらのクリップのタイムストレッチを無効にします。クリップは `'repitch'` 経路を使い、このフォールバックは `warpStretchOverflowCount()`（Python では `warp_stretch_overflow_count()`、C では `sonare_engine_warp_stretch_overflow_count()`）に加算されません。エンジンが prepare 済みのときに容量を変更すると、ボイスプールが直ちに作り直され、その時点でボイスを使っているクリップは WSOLA 状態を引き継がずに再開します。

クリップは前のブロックで使ったボイスをそのまま使い続け、新しいクリップは空いているボイスか、最も長くアイドル状態だったボイスを取ります。出力中のボイスが音の途中で奪われることはありません。空きボイスがないと、そのブロックは `'repitch'` 経路になり、オーバーフローカウンターが増えます。ソースが 3 チャンネル以上の場合もストレッチャの状態に収まらないため `'repitch'` 経路になります。カウンターは prepare 済みセッション内で単調増加し、`prepare` でリセットされます。シーク、ループの折り返し、ボイスの付け替えが起きるとストレッチャのストリームは新しい位置から再開するため、つなぎ目は前の位置を引きずらず、きれいな頭出しになります。

### ページアンダーランはどう見えるか

ページ型クリップは、オーディオスレッド上でプロバイダからサンプルを読みます。あるサンプルを含むページが常駐していなければ、その読み出しは **ページミス** です。そのクリップはそのサンプルについて無音を出し、ほかのクリップやインストゥルメントは通常どおりレンダーされ、トランスポートは走り続けます。エンジンがストレージを待って止まることはありません。ミスはホストが供給すべきページ要求としてキューに入り、あわせて `drainTelemetry()` にブロックあたり 1 回、エラー `ClipPageUnderrun`（序数 `15`、Python では `CLIP_PAGE_UNDERRUN`）として、`value` にクリップ id を載せて報告されます。このレコードが音切れの合図です。

このレコードをそもそも出さないために、プレイヤーは *これから* 読むページも要求します。既定では各ブロックの先にあるタイムライン半秒ぶんを、同じ要求キューを通して要求します。この窓の幅、その設定方法、JS 側のストリーミング窓との関係は [先読み](./wasm-streaming.md#先読み) にあります。要求そのものには、ミスなのか先読みなのかの区別がありません。ミスを示すのはテレメトリのレコードだけなので、要求はすべて速やかに供給してください。有界の要求キューが満杯になると `clipPageRequestOverflowCount()` が増えます。落ちたページは次のブロックで再度要求されますが、供給されるまでに来たブロックはそのぶん無音になります。

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

トラックレーンの `sourceChannelLayout` はステレオ（既定）でなければなりません。モノラル、5.1、7.1 を指定した `setTrackLanes` は拒否されます（WASM は `RangeError`、それ以外は `InvalidParameter`）。レーンの音声は、サラウンド配置の前に必ずステレオから点音源へフォールドされるためです。C で `SonareEngineTrackLane` をゼロ初期化するとモノラル扱いになるので、`SONARE_CHANNEL_LAYOUT_STEREO` を設定してください。

レーンの定位はライブで `setTrackStripSurroundPan(trackId, { azimuth, divergence, lfe })` により動かせます（`RealtimeEngine`、および `SonareEngine` ワークレットファサードではトラック ID または名前を指定）。省略したフィールドは中央のポイントソースになり、非有限のフィールドやレーンストリップを持たないトラックは例外になります。定位はクリックを出さず、時定数およそ 5 ms で滑らかに移動し、移動中も合計のパワーは一定に保たれます。

出力プレーン順は 5.1 が `L R C LFE Ls Rs`、7.1 が `L R C LFE Ls Rs Lss Rss` の正準順です。`SonareEngine` の `channelCount` を 6 または 8 にするとそのプレーン数で出力しますが、Web Audio の既定のデスティネーションは 2 チャンネルの `'speakers'` なので、アプリが先に `audioContext.destination.channelCount` を（`destination.maxChannelCount` まで）引き上げない限り、ブラウザはステレオへダウンミックスします。解釈（interpretation）が効くのはチャンネル数が一致しない間だけです。`'speakers'` はモノラル、ステレオ、クワッド、5.1 に対するダウンミックスのみを定義しており、8 のようなそれ以外の数では `'discrete'` 相当になります。`'discrete'` は先頭のプレーンをコピーして残りを捨てます。チャンネル数が一致していれば、どちらのモードでもプレーンはそのまま通ります。

`setTrackLanes` で `outputBusId: 0` を指定する（または、このメソッドを持つ `SonareEngine` ワークレットファサード側で `setTrackOutputBus(1, 0)` を呼ぶ）と、レーンをマスターミックスへ戻せます。

メインスレッドまたはオフラインのエンジンでは、サラウンドメーターを `drainMeterTelemetryWide(maxRecords?)` で読み取ります。プレーンごとの（ワイドな）レコードが返り、ステレオターゲットの左右はプレーン 0 と 1 として扱われます。これが唯一のメータードレインで、`drainMeterTelemetry()` はステレオの高速パスのままです。ドレインどうしは同じシングルコンシューマのテレメトリキューを消費するため、1 つのエンジンインスタンスにつき 1 つだけを呼んでください。2 つ回すと互いのレコードを奪い合います。

AudioWorklet では、`SonareEngine` のメータースナップショットが、ステレオより広いターゲットに対して、ステレオ用のフィールドに加えて `channelCount` とチャンネルごとの配列 `peakDb`、`rmsDb`、`truePeakDb`、`inputPeakDb` を持ちます。postMessage と SharedArrayBuffer リングの両方の経路で届きます。ワークレットはメーター間隔をターゲットごとに保持するので、あるターゲットのレコードが別のターゲットのレコードを遅らせることはありません。

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

## AudioWorklet でエンジンを動かす

通常の WASM パッケージは、この `RealtimeEngine` クラスを直接公開します。リアルタイム音声スレッドで動かすには、Worklet ブリッジが同じ embind ベースのエンジンを `AudioWorkletGlobalScope` 内でホストし、より高レベルの `SonareEngine` ファサードがエンジンのほぼ全面をコントロールメッセージ経由で Worklet にミラーします。ブリッジの設定、`SonareEngine` ファサードの一覧、Worklet 側のスコープスナップショットは [リアルタイムとストリーミング — AudioWorklet での使い分け](./realtime-streaming.md#audioworklet-での使い分け) を参照してください。

## 関連

- [リアルタイムとストリーミング](./realtime-streaming.md) — `StreamAnalyzer`、テンポグラム、AudioWorklet ブリッジ、クリップのページストリーミング、波形ピーク
- [ミキシングエンジン](./mixing.md) — このエンジンのレーンミキサーとストリップモデルを共有する単体のストリップ／バス／センドミキサー
- [MIDI 入力](./midi-input.md) · [録音とテイク](./recording-and-takes.md) — エンジンへのライブ MIDI 入力と、再生内容のキャプチャ
