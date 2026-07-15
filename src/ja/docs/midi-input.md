---
title: ライブ MIDI 入力と Web MIDI
description: ハードウェアキーボードから libsonare のリアルタイムエンジンを演奏する方法。MIDI デスティネーション、ライブのノート／CC キューイング、CC からパラメータへのバインド、パニック復帰、Web MIDI 設定、そして USB キーボードでシンセを実際に鳴らす AudioWorklet レシピを解説します。
---

# ライブ MIDI 入力と Web MIDI

**ライブ MIDI 入力**は、リアルタイムエンジンを演奏できる楽器に変えます。USB キーボードで押した鍵がノートオンイベントになり、エンジンはそれをバインド済みのシンセサイザーへ送り、次の音声ブロックで音が鳴ります。ファイルもオフラインレンダーも要りません。

libsonare の `RealtimeEngine` は、トランスポート・クリップ・オートメーションと同じリアルタイム安全な入口からライブ MIDI を受け取ります。ブラウザでは、小さな **Web MIDI ブリッジ**（`bindWebMidi`）が、プラットフォームの MIDI ポートをそのエンジンへ直接つないでくれます。

最初に選ぶ入口は 2 つです。

| 手元にあるもの | まず使うもの |
|----------------|--------------|
| アプリ内のオンスクリーンキーボードやシーケンサーのステップ | 即時の `pushMidiNoteOn` / `pushMidiNoteOff` 呼び出し |
| USB キーボードや外部コントローラー | `bindWebMidi`。内部ではライブ入力ソース用の呼び出しを使います |

::: info MIDI のきほん
**ノートオン**は「この音高がこの強さで始まった」、**ノートオフ**は「離した」を伝えます。**コントロールチェンジ**（CC）は連続的なツマミ／スライダーのメッセージで、モジュレーションホイール（CC1）、サスティン（CC64）、エクスプレッション（CC11）などがあります。libsonare はこの 3 つをすべてライブで扱えます。
:::

::: info MIDI デスティネーション
**MIDI デスティネーション**はスピーカー出力ではありません。エンジン内部の楽器スロットです。MIDI イベントは `0` のようなデスティネーション ID に送られ、その ID にバインドされた楽器が実際の音を決めます。
:::

::: tip このページの位置づけ
本ページはコントローラーからエンジンを*演奏する*話です。ノートが届く楽器のバインドは [NativeSynth](./native-synth.md)（パッチ駆動のシンセサイザー）と [SoundFont プレイヤー](./soundfont-player.md)（GS/GM の `.sf2` 再生）を参照してください。演奏をタイムラインへ録音するには [録音とテイク](./recording-and-takes.md) を参照します。マイク音声の入力は別経路です。最後の節を参照してください。
:::

## ライブ MIDI の流れ

ブラウザが MIDI バイトを受け取り、`bindWebMidi` がエンジンイベントへ変換し、デスティネーションの楽器が `process(...)` の中で音声を作ります。以下の矢印はそれぞれ、生の鍵盤入力からサンプルデータに至る経路上の 1 ホップであり、ループラベルは各ノートで繰り返される部分を示します。

<SequenceDiagram
  title="USB キーボードから音声出力まで"
  :participants="[
    { id: 'keyboard', label: 'USB キーボード' },
    { id: 'bridge', label: 'bindWebMidi' },
    { id: 'engine', label: 'RealtimeEngine' },
    { id: 'instrument', label: '楽器（デスティネーション 0）' },
    { id: 'output', label: '音声出力ブロック' }
  ]"
  :messages="[
    { from: 'keyboard', to: 'bridge', label: 'ノートオン / ノートオフ / CC', loop: 'MIDI メッセージごと' },
    { from: 'bridge', to: 'engine', label: 'pushMidiInput*(サンプル時刻)', loop: 'MIDI メッセージごと' },
    { from: 'engine', to: 'instrument', label: 'デスティネーション ID でルーティング' },
    { from: 'instrument', to: 'output', label: 'process() 内で発音' }
  ]"
  caption="エンジンより左側はイベントごとに 1 回、右側は音声ブロックごとに 1 回だけ実行されます。"
/>

音が出ないときは、ブラウザ権限、`bindWebMidi` の入力一覧、デスティネーション ID、バインド済み楽器、AudioWorklet/出力配線の順に確認してください。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- 組み込み・NativeSynth・SoundFont の楽器を **MIDI デスティネーション**へバインドし、ライブイベントを送れる。
- ノートオン／ノートオフ／CC のライブイベントをサンプル精度でキューイングできる。
- `bindMidiCc` で MIDI CC をエンジンパラメータへマッピングできる。
- デスティネーションごとの MIDI FX インサートを、ノートを残さず差し替えられる。
- **MIDI パニック**でスタックノートから復帰できる。
- ブラウザで `bindWebMidi` を使い、ホットプラグ・権限・CC バインド・タイムスタンプからサンプルへの変換まで含めてハードウェアキーボードを接続できる。
- エンジンを AudioWorklet 内でホストし、MIDI をスレッド境界を越えて転送して、演奏を実際に音として出せる。
- 出荷前に現在のブラウザ対応状況を把握できる。

## MIDI デスティネーションモデル

エンジンはノートを直接鳴らすのではなく、**MIDI デスティネーション**へ送り、各デスティネーションには楽器がバインドされています。デスティネーションは小さな整数 ID（既定は `0`）で識別します。楽器を一度バインドすれば、その ID 宛のライブイベントやスケジュール済みクリップはすべてその楽器でレンダリングされます。

<SonareDemo id="synth-note" />

デスティネーションには 3 種類の楽器を置けます。

| バインド方法 | 楽器 | 参照 |
|--------------|------|------|
| `setBuiltinInstrument(config, destinationId)` | 内蔵の波形シンセ（データ不要の最下層） | — |
| `setSynthInstrument(patch, destinationId)` | パッチ駆動の NativeSynth | [NativeSynth](./native-synth.md) |
| `setSf2Instrument(config, destinationId)` | GS 互換の SoundFont プレイヤー | [SoundFont プレイヤー](./soundfont-player.md) |

::: tip MPE 表現は setBuiltinInstrument の機能
真の MPE スタイルの per-note 表現（per-note のピッチベンドと、チャンネル／ポリフォニックプレッシャー、フル 16 ビットの MIDI 2.0 ベロシティ）を持つのは、内蔵の波形シンセ（`setBuiltinInstrument`）だけです。その MPE ベンドレンジは ±2 半音に固定されています。NativeSynth（`setSynthInstrument`）はチャンネル単位で動作します。RPN-0 で設定可能なベンドレンジと、フル解像度の RPN/NRPN・14 ビット CC を持ちますが、ベロシティは 7 ビットに量子化され、per-note プレッシャーは追跡しません。NativeSynth のチャンネル単位のベンド／CC の詳細は [NativeSynth](./native-synth.md) を参照してください。
:::

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const engine = new RealtimeEngine(48000, /* maxBlockSize */ 128);

// デスティネーション 0 → NativeSynth プリセット（synthPresetNames() 参照）
engine.setSynthInstrument('saw-lead', 0);

// 複数のデスティネーションを同時に動かし、それぞれに楽器を持たせられる
engine.setSf2Instrument({ destinationId: 1, gain: 1 }, 1);
```

`clearMidiInstrument(destinationId)` で 1 つのバインドを解除し、`midiInstrumentCount()` で現在の数を確認できます。複数デスティネーションを使えば、1 つのエンジンに重ねたリグ（`0` にリードシンセ、`1` にドラム、など）を持たせられます。

## ライブイベントのキューイング

ライブイベントは同期実行ではなく*キューイング*されます。各呼び出しは、イベントを発火させるサンプル位置をエンジンへ渡します。次の `process(...)` ブロックが、そのブロックで処理すべきイベントをすべて消費します。これがタイミングを正確にする仕組みです。イベントは「メッセージが届いた時」ではなく、正確なフレームに着地します。

キューイングの経路は 2 つあり、デスティネーションごとにどちらかを選びます。目安として、イベントを自分のコードで生成する場合（シーケンサーのステップ、オンスクリーンキーボード）は**即時コマンド**を使い、ハードウェアキーボードのように外部から独自のタイムスタンプ付きでイベントが届く場合（`bindWebMidi` 経由）は**入力ソース**を使います。後者のレーンは、Web MIDI ブリッジが必要とするポートごとのタイムスタンプを運ぶためです。

- **即時エンジンコマンド** — `pushMidiNoteOn` / `pushMidiNoteOff` / `pushMidiCc` はそれぞれ `destinationId` と `renderFrame`（または「できるだけ早く」を表す `-1`）を取ります。`pushMidiPanic(renderFrame)` は `renderFrame` のみを取り、すべての destination の発音中ノートを一括で解放します。
- **エンジン所有のライブ入力ソース** — `setMidiInputSource(destinationId)` で専用の入力レーンを開き、`pushMidiInputNoteOn` / `pushMidiInputNoteOff` / `pushMidiInputCc` で `portTimeSamples` タイムスタンプ付きのイベントを送ります。Web MIDI ブリッジはこのレーンへイベントを流します。
- **ライブ SysEx** — `pushMidiSysex(destinationId, data, renderFrame = -1)` は、デスティネーションへ完全な SysEx フレームをキューイングします。`data` は先頭の `0xF0` と末尾の `0xF7` を含む完全なメッセージ（1〜512 バイト）で、`renderFrame` はほかの `pushMidi*` 呼び出しと同じ即時／スケジュール規約に従います。主な用途は、再生を止めずに、ライブの SF2 バインド済みデスティネーションへ GS/GM リセットや GS インサーションエフェクト（EFX）の選択を届けることです。そのバイト列が何を選ぶかは [SoundFont プレイヤー](./soundfont-player.md) を参照してください。

Node では同じ `pushMidiSysex(...)` 名です。Python は `push_midi_sysex(destination_id, data, render_frame=-1)` を公開し、完全なフレームを `bytes` またはほかのバイト列として受け取ります。C ABI の入口は `sonare_engine_push_midi_sysex(...)` です。

```typescript
// 即時経路: 次のブロック先頭でノートを発火
engine.pushMidiNoteOn(/* destinationId */ 0, /* group */ 0, /* channel */ 0, /* note */ 60, /* velocity */ 100, -1);
engine.pushMidiCc(0, 0, 0, /* controller */ 1, /* value */ 64, -1);
engine.pushMidiNoteOff(0, 0, 0, 60, 0, -1);
engine.pushMidiSysex(/* destinationId */ 0, gsResetOrEfxBytes, -1); // 0xF0/0xF7 込みの完全なフレーム

// 入力ソース経路（bindWebMidi が内部で使う経路）
engine.setMidiInputSource(0);
engine.pushMidiInputNoteOn(/* group */ 0, /* channel */ 0, 60, 100, /* portTimeSamples */ 0);
engine.pushMidiInputCc(0, 0, 1, 64, 0);
engine.pushMidiInputNoteOff(0, 0, 60, 0, 0);
// engine.midiInputPendingCount()  -> 次の process() ブロックを待つイベント数
```

`group` と `channel` は MIDI ニブル（0..15）、`note`・`velocity`・`controller`・`value` は 7 ビット（0..127）です。ベロシティ `0` のノートオンは、MIDI 仕様どおりノートオフとして扱われます。

## MIDI CC をエンジンパラメータへバインドする

CC は二役を果たせます。楽器へ届くと同時に、エンジンのオートメーションパラメータも動かせます。`bindMidiCc(channel, controller, paramId, options)` は、コントローラーの 7 ビット値を登録済みパラメータの `[minValue, maxValue]` へマッピングし、その間も CC はデスティネーション楽器へ流れ続けます。

```typescript
// CC で動かしたいパラメータを登録し、モジュレーションホイール（CC1）を割り当てる
engine.addParameter({ id: 42, name: 'cutoff', minValue: 0, maxValue: 1, defaultValue: 0.5 });
engine.bindMidiCc(/* channel */ 0, /* controller */ 1, /* paramId */ 42, { minValue: 0, maxValue: 1 });

// engine.midiCcBindingCount()  -> 1
// engine.clearMidiCcBindings() -> すべてのマッピングを削除
```

::: tip CC ラーンのワークフロー
オフラインで「ツマミを動かし、どの CC が動いたか取り込む」流れには、プロジェクト API の `Project.midiCcLearn(events, paramId, options)` と、録音した CC ストリームをオートメーションへ変換する `midiCcToBreakpoint` / `midiParamToCc` があります。これらはライブエンジンではなく、取り込んだ `ProjectMidiEvent` データを対象とします。[プロジェクト編集](./project-editing.md) を参照してください。
:::

## ノートを残さず MIDI FX を差し替える

各デスティネーションは 1 つの **MIDI FX インサート** を持てます。イベントストリームへの非破壊な変換（トランスポーズ、チャンネルフィルタ、ベロシティカーブなど）を JSON で設定します。

```typescript
// 入力されたノートをすべて 1 オクターブ上げる
engine.setMidiFx(/* destinationId */ 0, JSON.stringify({ transpose_semitones: 12 }));
engine.clearMidiFx(0);   // 指定したデスティネーションのみ解除（ID 省略時は 0）
```

Python でも v1.5.1 から同じライブ差し替えを `engine.set_midi_fx(destination_id, config_json)` で利用できます。解除には `engine.clear_midi_fx(destination_id)` を使います。

設定 JSON は [`bakeMidiFx`](./project-editing.md) と同じスキーマです。各ステージはそのパラメータをキーにするので、ステージのキーを含めれば有効になり、省けばスキップされます。主なキーは `transpose_semitones`、`velocity_scale` / `velocity_offset` / `velocity_gamma`、`quantize_ppq` / `quantize_strength`、`chord_intervals`、`arpeggiator_intervals` / `arpeggiator_step_ppq` / `arpeggiator_gate_ppq` です。キーの全一覧と例は [プロジェクト編集](./project-editing.md) を参照してください。

`setMidiFx` は楽器のボイスをリセットせずにインサートをその場で*置き換え*ます。そのため、よくあるケース（フレーズ間で 1 つの変換を別の変換へ差し替える）では、鳴っているノートはそのまま保たれます。鍵を押したまま FX を変える場合の注意点が 2 つあります。

この呼び出しは制御スレッドから不変の設定を publish し、音声スレッドが次のブロック境界で採用するため、エンジンの処理中にも実行できます。

- 現在の状態が不確かなら、先に FX をクリアしてください。
- 変換がノートオフのルーティングを変えてノートが鳴り続けたら、差し替えの後にパニック（次節）を送ってください。

## MIDI パニックとスタックノート復帰

**スタックノート**は、対応するノートオフが届かなかったノートオンです。ケーブルを抜いた、Bluetooth パケットを落とした、FX の差し替えがオフを飲み込んだ、などが原因です。対処は **MIDI パニック**、すなわち鳴っている全ボイスを解放する all-notes-off です。

```typescript
engine.pushMidiPanic(-1);   // -1 = 即時。renderFrame を渡せばスケジュールも可能
```

パニックはリアルタイム安全で軽量です。楽器 UI の見える「パニック」ボタンに割り当てておきましょう。Web MIDI ブリッジは切断時に自動パニックしません。ホットアンプラグを自分で扱う場合は、演奏中だったポートが消えたらパニックを送ってください。

## ブラウザの Web MIDI ブリッジ

::: info ワイヤーフォーマットの用語
**UMP**（Universal MIDI Packet）は MIDI 2.0 のメッセージ形式です。ブリッジは従来の MIDI 1.0 バイトに加えてこれも受け付けます。**SysEx**（システムエクスクルーシブ）は自由形式でメーカー固有のメッセージで、GS Reset などに使われ、ブラウザでは別の権限でゲートされます。**RPN／NRPN**（（非）登録パラメータナンバー）は CC を介して追加パラメータを指定するもので、たとえば RPN 0 はピッチベンドレンジを設定します。
:::

ブラウザでは、`bindWebMidi(engine, options)` が配線を担います。MIDI アクセスを要求し、エンジンのライブ入力ソースを有効化し、一致する全入力ポートにリスナーを取り付け、受信バイト（ランニングステータスや UMP を含む）を解析し、サンプルタイムスタンプ付きでエンジンへキューイングします。

```typescript
import { init, RealtimeEngine, isWebMidiAvailable, bindWebMidi } from '@libraz/libsonare';

await init();
if (!isWebMidiAvailable()) {
  // navigator.requestMIDIAccess が無い — オンスクリーンキーボードへフォールバック
}

const engine = new RealtimeEngine(48000, 128);
engine.setSynthInstrument('saw-lead', 0);

const binding = await bindWebMidi(engine, {
  destinationId: 0,        // 演奏するエンジン MIDI デスティネーション（既定 0）
  group: 0,                // MIDI 1.0 イベント用の UMP グループ（既定 0）
  // inputIds: ['<port-id>'],  // 特定ポートに限定。省略時は接続中の全ポート
  sysex: false,            // SysEx 対応アクセスを要求（既定 false）
  software: true,          // 対応環境ではソフトウェアポートを要求（既定 true）
  ccBindings: [
    { channel: 0, controller: 1, paramId: 42, options: { minValue: 0, maxValue: 1 } },
  ],
  timestampToSamples: (eventTimeMs) => Math.round((eventTimeMs / 1000) * 48000),
  onInputsChanged: (inputs) => {
    // ホットプラグ時、ヘルパーが一致ポートを再バインドした後に呼ばれる
    console.log('MIDI inputs:', inputs.map((i) => `${i.name} (${i.state})`));
  },
});

// binding.inputs()  -> WebMidiInputInfo[] { id, name, manufacturer, state }
// binding.access    -> 生の制御が必要なときの MIDIAccess オブジェクト
```

各オプションの役割は次のとおりです。

- **`destinationId` / `group`** — ライブソースがイベントを送るエンジンデスティネーションと、MIDI 1.0 チャンネルボイスイベントに刻む UMP グループです。
- **`inputIds`** — `binding.inputs()` から得た特定のポート ID にバインドを限定します。省略または空配列で接続中の全入力にバインドします。
- **`sysex` / `software`** — `navigator.requestMIDIAccess` へそのまま渡されます。SysEx アクセスは通常、別の権限プロンプトを出します。`software` はプラットフォームが提供する場合にソフトウェアシンセのポートを要求します。
- **`ccBindings`** — ポート接続より*前*に適用される `bindMidiCc` のマッピングです。最初のツマミ操作からすでにルーティング済みになります。対象パラメータは先に `addParameter(...)` で登録してください。
- **`onInputsChanged`** — ホットプラグ（`MIDIAccess` の `statechange`）時、ヘルパーが一致ポートを再バインドした後に、最新のポート一覧とともに発火します。

### タイムスタンプからサンプルへの変換が重要な理由

2 つのクロックが噛み合っていません。Web MIDI は各メッセージをミリ秒の時刻（ページクロックの `DOMHighResTimeStamp`）付きで届けますが、エンジンはイベントを**サンプルフレーム**でスケジュールします。`timestampToSamples(eventTimeMs)` はその両者を橋渡しします。メッセージ時刻を、エンジンがキューイングする `portTimeSamples` の値へ変換します。

なぜ手間をかけるのか。変換が正しければ、タイミングが詰まった箇所（和音や速いパッセージ）が、演奏したとおりの正確なフレームへ着地します。省略すると、すべてのイベントが次のブロックのサンプル `0` にキューイングされます。気軽な演奏には十分ですが、リズミカルな素材では聴き取れるほど緩くなります。

実用的な実装は、`performance.now()`（または `AudioContext.currentTime`）とエンジンのフレームクロックとの差分を追い、その差分をここで適用します。

### ライフサイクル

`bindWebMidi` は `WebMidiBinding` を返します。終わったら `binding.close()` を呼びます。`statechange` リスナーを外し、全ポートリスナーを切り離し、`engine.clearMidiInputSource()` を呼びます。エンジンは破棄しません。エンジンは `engine.destroy()` で別途解放してください。

```typescript
binding.close();   // MIDI ポートを切り離し、エンジンの入力ソースをクリア
engine.destroy();  // エンジンのネイティブハンドルを解放
```

### ブラウザ対応

Web MIDI の対応はまちまちなので、`isWebMidiAvailable()` で実行時に確認し、使えない場合はオンスクリーンキーボードなどへ切り替えてください。

- **Chrome・Edge**（デスクトップ） — ホットプラグや SysEx（権限プロンプト付き）を含む Web MIDI に対応しています。主たる対象です。
- **Firefox** — Web MIDI を提供しています。SysEx やアドオン要件は時期により変わってきたため、前提にせず機能検出してください。
- **Safari** — 従来は `navigator.requestMIDIAccess` を公開していませんでした。対応は変化しているため、存在を前提にしないでください。常に `isWebMidiAvailable()` でゲートし、代替入力としてオンスクリーンキーボードを用意します。

状況は移り変わるため、コードでは機能検出を真とし、文章での断定は控えめに保ってください。

## レシピ: USB キーボードでブラウザのシンセを鳴らす

「キーボードを挿した」から「スピーカーから音が出る」までの、実装全体が見えるレシピです。処理が 2 つのスレッドにまたがるため、ファイルも 2 つになります。

- **音声スレッド** — AudioWorklet プロセッサがエンジンをホストし、レンダークォンタムごとにブロックをレンダリングします。エンジンはここに置く必要があります。メインスレッドのエンジンでは `process(...)` が音声コールバックから呼ばれないため、音が出ないままになります。
- **メインスレッド** — Web MIDI アクセス（`bindWebMidi`）を持ち、すべてのイベントをノードのポート経由でワークレットへ転送します。

::: info 代役オブジェクトが bindWebMidi を満たせる理由
`bindWebMidi` が渡されたエンジンに対して呼ぶのは、ライブ入力に必要な小さな部分だけです。`setMidiInputSource`、`bindMidiCc`、3 つの `pushMidiInput*` メソッド、そして close 時の `clearMidiInputSource`。この 6 メソッドを実装したオブジェクトなら、エンジンの代役になれます。つまり、各イベントをワークレットのポートへ post する小さな*フォワーダー*が、バインディングをスレッド境界の向こうへ運んでくれます。
:::

### 音声スレッド: ワークレットがエンジンをホストする

`AudioWorkletGlobalScope` は動的 `import()` を禁止しているため、通常のパッケージ入口は使えません（その `init()` は WASM モジュールを動的にインポートします）。代わりに Emscripten ファクトリ `sonare.js` を静的にインポートし、それが公開する低レベルのエンジンを呼び出します。この低レベル入口について知っておくことは 2 つです。

- ワークレットは `.wasm` のバイト列も fetch できません。メインスレッドで fetch して `processorOptions` 経由で渡します。
- 一部の引数順が通常の JS パッケージ入口と異なります。特に `setSynthInstrument(destinationId, patch)` です。

```js
// synth-worklet.js — context.audioWorklet.addModule(...) で読み込む。
// sonare.js と sonare.wasm は @libraz/libsonare パッケージから静的アセットへ
// コピーしておく。import 指定子はワークレットが解決できる URL であること。
import createModule from '/wasm/sonare.js';

const BLOCK = 128; // エンジンのスクラッチを準備するレンダークォンタムサイズ

class KeyboardSynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine = null;
    this.channels = [];
    this.port.onmessage = (event) => this.onMessage(event.data);

    createModule({
      wasmBinary: options.processorOptions.wasmBinary,
      locateFile: () => 'sonare.wasm', // ワークレットからネットワークへは出ない
    })
      .then((mod) => {
        const engine = new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024);
        engine.setSynthInstrument(0, 'saw-lead'); // ネイティブの順序: (destinationId, patch)
        engine.setMidiInputSource(0);
        // ゼロコピーのレンダー経路: 準備済みスクラッチを埋めて processPrepared を呼ぶ。
        engine.prepareChannels(2, BLOCK);
        this.channels = [engine.getChannelBuffer(0, BLOCK), engine.getChannelBuffer(1, BLOCK)];
        this.engine = engine;
        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  onMessage(msg) {
    const engine = this.engine;
    if (!engine) return;
    if (msg.type === 'noteOn') {
      engine.pushMidiInputNoteOn(msg.group, msg.channel, msg.note, msg.velocity, 0);
    } else if (msg.type === 'noteOff') {
      engine.pushMidiInputNoteOff(msg.group, msg.channel, msg.note, msg.velocity, 0);
    } else if (msg.type === 'cc') {
      engine.pushMidiInputCc(msg.group, msg.channel, msg.controller, msg.value, 0);
    } else if (msg.type === 'panic') {
      engine.pushMidiPanic(-1);
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    if (!this.engine) {
      for (const channel of output) channel.fill(0);
      return true;
    }
    // WASM メモリの成長でヒープビューが切り離されたら取得し直す。
    if (this.channels[0].byteLength === 0) {
      this.channels = [this.engine.getChannelBuffer(0, BLOCK), this.engine.getChannelBuffer(1, BLOCK)];
    }
    const frames = Math.min(output[0].length, BLOCK);
    // シンセはジェネレータなので、レンダー前に入力スクラッチをクリアする。
    for (const channel of this.channels) channel.fill(0, 0, frames);
    this.engine.processPrepared(frames);
    for (let ch = 0; ch < output.length; ch++) {
      output[ch].set((this.channels[ch] ?? this.channels[0]).subarray(0, frames));
    }
    return true;
  }
}

registerProcessor('keyboard-synth', KeyboardSynthProcessor);
```

### メインスレッド: Web MIDI がワークレットへ流し込む

ここに `init()` はありません。この構成では WASM は音声スレッドだけで動きます。メインスレッドはワークレットを起動し、6 メソッドをポートへ post するフォワーダーを `bindWebMidi` に渡します。

```typescript
import { bindWebMidi, isWebMidiAvailable, type RealtimeEngine } from '@libraz/libsonare';

async function startKeyboardSynth() {
  if (!isWebMidiAvailable()) {
    throw new Error('Web MIDI が使えません — オンスクリーンキーボードを使ってください');
  }

  // --- ワークレットを起動（コンテキストが動くようユーザージェスチャーから呼ぶ） ---
  const context = new AudioContext({ latencyHint: 'interactive' });
  await context.audioWorklet.addModule('/synth-worklet.js');
  const wasmBinary = await (await fetch('/wasm/sonare.wasm')).arrayBuffer();
  const node = new AudioWorkletNode(context, 'keyboard-synth', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { wasmBinary },
  });
  node.connect(context.destination);
  await new Promise<void>((resolve, reject) => {
    node.port.onmessage = (event) =>
      event.data?.type === 'ready' ? resolve() : reject(new Error(event.data?.error));
  });

  // --- フォワーダー: bindWebMidi が呼ぶエンジンメソッドをポートへ post する ---
  const forwarder = {
    setMidiInputSource: () => {
      // ワークレットが起動時にデスティネーション 0 をバインド済み。
    },
    clearMidiInputSource: () => {
      node.port.postMessage({ type: 'panic' }); // close 時に押しっぱなしのノートを解放
    },
    bindMidiCc: () => {
      // このレシピでは CC からパラメータへのバインドは使わない。
    },
    pushMidiInputNoteOn: (group: number, channel: number, note: number, velocity: number) =>
      node.port.postMessage({ type: 'noteOn', group, channel, note, velocity }),
    pushMidiInputNoteOff: (group: number, channel: number, note: number, velocity: number) =>
      node.port.postMessage({ type: 'noteOff', group, channel, note, velocity }),
    pushMidiInputCc: (group: number, channel: number, controller: number, value: number) =>
      node.port.postMessage({ type: 'cc', group, channel, controller, value }),
  };

  const binding = await bindWebMidi(forwarder as unknown as RealtimeEngine, {
    destinationId: 0,
    onInputsChanged: (inputs) =>
      console.log('keyboards:', inputs.map((i) => i.name).join(', ')),
  });

  // これで USB キーボードの鍵を押すと 'saw-lead' パッチが鳴ります。

  return {
    stop() {
      binding.close();      // MIDI ポートを切り離す（forwarder.clearMidiInputSource() が呼ばれる）
      node.disconnect();
      void context.close(); // ワークレットと、その中のエンジンを破棄する
    },
  };
}
```

`timestampToSamples` を省略すると、すべてのイベントは次のレンダーブロックの先頭で発火します。ライブ演奏にはこれで十分なタイトさです。ブロック内精度が必要なら、前述の「タイムスタンプからサンプルへの変換が重要な理由」のとおりタイムスタンプを変換し、フォワーダーの最後の引数を `0` の代わりにその値にして渡してください。

::: warning ブラウザのジェスチャーと後始末
`AudioContext` はユーザージェスチャー（クリック）から生成／再開する必要があり、多くのブラウザはセキュアコンテキストからのみ MIDI アクセスを促します。`bindWebMidi` には必ず `binding.close()` を組み合わせ、ページ破棄時には `AudioContext` を close してください。このレシピでは、それがワークレットとエンジンのネイティブメモリを解放する手段です。
:::

## ほかの実行環境では

ライブ MIDI のエンジン API はブラウザ専用ではありません。**Node ネイティブ**と **Python** のバインディングは同じ `RealtimeEngine` 入力メソッドを公開します。ブラウザ固有なのは Web MIDI ブリッジ自体だけです（`navigator.requestMIDIAccess` に依存するため）。Python では名前は snake_case 慣習に従います。

```python
import libsonare as sonare

engine = sonare.RealtimeEngine(sample_rate=48000.0, max_block_size=128)
try:
    engine.set_synth_instrument("saw-lead", destination_id=0)
    engine.set_midi_input_source(0)
    engine.push_midi_input_note_on(0, 0, 60, 100, 0)   # group, channel, note, velocity, port_time_samples
    engine.push_midi_input_cc(0, 0, 1, 64, 0)
    engine.push_midi_input_note_off(0, 0, 60, 0, 0)
    out = engine.process([[0.0] * 128, [0.0] * 128])   # ノートが鳴れば非ゼロ
finally:
    engine.close()
```

これらのエンジンを実機から鳴らすには、プラットフォームのライブラリ（たとえば CoreMIDI や ALSA のバインディング）で MIDI を読み、同じ `push_midi_input_*` メソッドを呼びます。タイムスタンプからサンプルへの変換は、ブラウザの `timestampToSamples` と同様に自分で用意します。

::: info 実験的なネイティブ macOS バックエンド
C++ ソースビルドでは、既定で無効の CMake オプション `BUILD_COREAUDIO`・`BUILD_COREMIDI`・`BUILD_AU_HOST` でネイティブ macOS ホストバックエンド（CoreAudio 出力、CoreMIDI 入出力、Audio Unit 楽器ホスト）を有効化できます。これらは C-ABI を追加せず、公開パッケージ（npm／PyPI／WASM）にも含まれません。macOS 専用かつソースビルドでのオプトインで、今後変更される可能性があります。
:::

## マイク入力について

ライブ MIDI は*コントロール*入力です。エンジンに何を演奏するかを伝えます。**音声**入力（マイクや、インターフェース経由の楽器）は別経路です。`bindMicrophoneInput(context, engine, options)` が、取り込んだ音声をモニタリングと録音のためにエンジンへ送ります。両者は独立しており、同時に動かせます。[録音とテイク](./recording-and-takes.md) を参照してください。

## 関連

- [NativeSynth](./native-synth.md) — デスティネーションへバインドするパッチ駆動の楽器
- [SoundFont プレイヤー](./soundfont-player.md) — デスティネーションでの GS/GM `.sf2` 再生
- [録音とテイク](./recording-and-takes.md) — 演奏（およびマイク音声入力）の取り込み
- [プロジェクト編集](./project-editing.md) — MIDI クリップ、CC ラーン、CC からオートメーションへの変換
- [プロジェクトバウンス](./project-bounce.md) — MIDI 演奏のオフラインレンダー
- [リアルタイムとストリーミング](./realtime-streaming.md) — 音声出力を動かす AudioWorklet エンジンブリッジ
- [リアルタイムエンジン](./glossary/realtime/realtime-engine.md) · [リアルタイム安全性](./glossary/realtime/realtime-safety.md)
