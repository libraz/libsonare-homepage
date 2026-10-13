---
title: プロジェクトをオーディオへバウンス
description: libsonare の Project を決定的にオフラインレンダリングする方法。オーディオクリップのプレーンバウンス、内蔵シンセ／NativeSynth／SF2 を通した MIDI のバウンス、Python の外部楽器プロトコル、結果の WAV 書き出しを解説します。
---

# プロジェクトをオーディオへバウンス

**バウンスは、アレンジ全体を 1 つの音声ファイルへ変換し、保存・再生・解析できるようにする操作です。** DAW を使ったことがあれば「エクスポート」や「レンダリング」のボタンにあたり、libsonare では `Project.bounce*` 系のメソッドが担います。レンダリングは**オフライン**（曲をライブ再生するのではなく、実時間より速く一括で処理します）かつ**決定的**で、同じプロジェクトと同じオプションからは、ビット単位までまったく同一のサンプルが常に得られます。

[Project](./project-editing.md) はタイムライン上にトラックとクリップを保持します。オーディオクリップはすでにサンプルを持つため、そのままレンダリングされます。一方 MIDI クリップが持つのは*イベント*（ノートオン・ノートオフ）であって音そのものではないので、楽譜に演奏者が要るのと同じで、音にするには**楽器**が必要です。つまりどのバウンスメソッドを選ぶかは、*どの楽器で MIDI を鳴らすか*という 1 つの問いに尽きます。

<FlowDiagram
  title="バウンスパイプライン: クリップから WAV へ"
  direction="TB"
  :nodes="[
    { id: 'mc', label: 'MIDI クリップ', col: 0, row: 0, group: 'timeline', variant: 'muted' },
    { id: 'ac', label: 'オーディオクリップ', col: 1, row: 0, group: 'timeline', variant: 'muted' },
    { id: 'bind', label: '楽器バインド', col: 0, row: 1, variant: 'accent' },
    { id: 'strip', label: 'チャンネルストリップ', col: 0, row: 2 },
    { id: 'scene', label: 'ミキサーシーン', col: 0, row: 3 },
    { id: 'master', label: 'マスターバス', col: 0, row: 4 },
    { id: 'out', label: 'WAV 出力', col: 0, row: 5, variant: 'success' }
  ]"
  :edges="[
    { from: 'mc', to: 'bind' },
    { from: 'ac', to: 'strip' },
    { from: 'bind', to: 'strip' },
    { from: 'strip', to: 'scene' },
    { from: 'scene', to: 'master' },
    { from: 'master', to: 'out' }
  ]"
  :groups="[
    { id: 'timeline', label: 'タイムライン上の Project' }
  ]"
  caption="楽器バインドは MIDI デスティネーションごとに NativeSynth・SoundFont・内蔵シンセのいずれかを選び、そのあとチャンネルストリップがトリム・EQ・インサート・フェーダー・パンを適用してから、ミキサーがすべてをマスターバスへ合算します。"
/>

この一連の処理はオフラインで計算されるため、結果は毎回再現できます。

::: info 位置は 4 分音符単位
プロジェクトの位置とクリップ長は **PPQ** で表します。これは 4 分音符を表す float です。`ppq: 1` は 4 分音符 1 つ分です。120 BPM では 4 分音符が 0.5 秒なので、4 拍のクリップ（`lengthPpq: 4`）は 2 秒になります。`setTempoSegments([{ startPpq: 0, bpm: 120 }])` でテンポを明示しておくと、バウンスの長さが予測しやすくなります。
:::

::: tip バウンスは生クリップの加算ではなくミキサー全体を反映する
トラックは単純に加算されるわけではありません。各トラックはチャンネルストリップ（トリム、EQ、インサート、フェーダー、パン、センド、バス）を通って[シーンミキサー](./mixing.md)でレンダリングされます。バウンス結果はルーティング済みのマスターで、リアルタイム再生とまったく同じ出力です。

MIDI クリップでは、`setClipGain` とクリップフェードはそのクリップのデスティネーションにバインドされた楽器の出力に掛かり、ベロシティには掛かりません。複数のクリップが同じデスティネーションを共有するときにエンベロープがどう決まるかは[プロジェクト編集](./project-editing.md#クリップを編集する)を参照してください。MIDI トラック全体の音量を動かすには、[ミキサーシーン](./mixing.md)のトラックフェーダーを使います。
:::

## このページで身につくこと

このページを読むと、次のことを実装できるようになります。

- オーディオクリップのプロジェクトをプレーンな `bounce` でレンダリングできる。
- 内蔵シンセ、[NativeSynth](./native-synth.md)、[SF2 プレイヤー](./soundfont-player.md)を通して MIDI を音にできる。
- NativeSynth のパッチをプリセット名・`va:` プレフィックス・パッチオブジェクトで指定できる。
- JavaScript または Python から `ExternalInstrument` プロトコルで自前の楽器を組み込める。
- `validateMidiNotes` で MIDI クリップを事前検査し、楽器未バインド時のコンパイル警告を読める。
- レンダリング長をエンジンに自動導出させ、結果を WAV ファイルへ書き出せる。

## 適切なバウンスメソッドを選ぶ

まず上の行から検討し、MIDI により豊かな楽器が必要になったときだけ下の行へ進んでください。

| あなたのプロジェクト | 使う API | 結果 |
|----------------------|----------|------|
| オーディオクリップのみ（MIDI なし、または MIDI を無音にしたい） | `bounce` | ルーティング済み音声。MIDI トラックは無音 |
| MIDI をとにかく*鳴らしたい* | `bounceWithBuiltinInstrument` | シンプルなオシレーターシンセ |
| 本格的な楽器のキャラクターが必要な MIDI | `bounceWithSynthInstrument` | フル [NativeSynth](./native-synth.md)（減算 / FM / モーダル / ピアノ …） |
| SoundFont で鳴らしたい MIDI | `bounceWithSf2Instrument` | GS 互換 [SF2 プレイヤー](./soundfont-player.md) |
| 自前のシンセで鳴らす MIDI | `bounceWithInstruments` / `bounceWithInstrument`（Node、WASM）、`bounce_with_instruments`（Python） | ホスト側が用意する [`ExternalInstrument`](#自前の楽器を組み込む) |

::: info 1 つの Project、すべての実行環境
同じ `Project` モデルと中核のバウンス挙動は、WASM/JS、Node ネイティブ、Python から使えます。名前は各言語の慣習に従います（`bounceWithSynthInstrument` ↔ `bounce_with_synth_instrument`）。CLI では `project bounce`（MIDI を内蔵シンセへ通す `--synth` を含む）や SMF/MIDI 2.0 入出力としてプロジェクトワークフローを使えますが、デスティネーションごとの楽器バインドオプションがすべて配線されているわけではありません。アレンジモデル・コンパイラ・DSP は実行環境を問わず同一です。
:::

## プレーンバウンス: オーディオクリップ

`bounce` はプロジェクトをレンダリング可能なタイムラインへコンパイルし、**インターリーブされた float 音声**へオフラインレンダリングします。オーディオクリップはチャンネルストリップを通って鳴り、MIDI クリップは楽器がバインドされていないため無音でレンダリングされます。

::: code-group

```typescript [ブラウザ / WASM]
import { init, Project } from '@libraz/libsonare';

await init();

const project = Project.create();
try {
  project.setSampleRate(48000);
  project.setTempoSegments([{ startPpq: 0, bpm: 120 }]); // 長さを予測可能に

  const track = project.addTrack({ kind: 'audio', name: 'tone' });
  project.addClip({
    trackId: track,
    startPpq: 0,
    lengthPpq: 4,          // 4 分音符 4 つ = 120 BPM で 2 秒
    audio: monoSamples,    // Float32Array
    audioChannels: 1,
    audioSampleRate: 48000,
  });

  // インターリーブステレオ: [L0, R0, L1, R1, ...]
  const audio = project.bounce({ numChannels: 2, sampleRate: 48000 });
} finally {
  project.delete();        // WASM ハンドルは GC されない
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    project.set_tempo_segments([{"start_ppq": 0.0, "bpm": 120}])  # 長さを予測可能に

    track = project.add_track("audio", name="tone")
    project.add_clip(
        track,
        start_ppq=0.0,
        length_ppq=4.0,            # 4 分音符 4 つ = 120 BPM で 2 秒
        audio=mono_samples,
        audio_channels=1,
        audio_sample_rate=48000,
    )

    audio = project.bounce(num_channels=2, sample_rate=48000)  # (frames, 2) の float32 ndarray
```

:::

Node はブラウザ版パッケージと同じ呼び出しです。以降の例はブラウザ版と Python 版を並べています。

::: danger Project は必ず解放する
`Project` はすべての embind オブジェクトと同様、JavaScript の GC では回収できない WASM ヒープハンドルを保持します。`finally` ブロックで `project.delete()` を呼んでください（Node は `destroy()` も可、Python は `project.close()`）。ハンドルをリークすると、長時間のセッションで WASM メモリが徐々に枯渇します。
:::

::: info インターリーブ音声とは
「インターリーブ」とは、チャンネルがサンプルごとに 1 本の配列へ織り込まれていることを指します。すなわち `[L0, R0, L1, R1, …]` で、左サンプル・右サンプル・左・右、と続きます（対になる「プレーナー」は各チャンネルを別々の配列に保ちます）。WAV ライターはこの 1 本の配列を端から順にたどるため、N フレームの 2 チャンネルバウンスは `2 × N` 個の float になります。
:::

### バウンスオプション

オプションオブジェクトの各フィールドは任意です。

| オプション | 意味 | 既定 |
|-----------|------|------|
| `totalFrames` | 出力フレーム数でのレンダリング長 | 自動導出（後述） |
| `blockSize` | レンダリングブロックサイズ。正の値はそのまま使われます | 128（`<= 0` も同じ） |
| `numChannels` | 出力チャンネル数: `1`、`2`、`6`、`8` のいずれか | 2（`<= 0` も同じ） |
| `sampleRate` | 出力サンプルレート（Hz、整数）。プロジェクトのレートと一致する必要があり、リサンプルはしません | プロジェクトのサンプルレート（`<= 0` も同じ） |
| `instrumentLatencySamples` | コンパイラへ渡すホスト側の楽器の PDC（プラグインディレイ補償） | 0 |

::: info `numChannels` はミキサーシーンのマスターレイアウトを超えられません
バウンスのマスターバスは `numChannels` の幅で処理されます。マスターレイアウトが `"5.1"` なら `6` まで、`"7.1"` なら `8` まで許容し、ステレオのマスターなら `1` か `2` のままです（[バス](./mixing-scene-json.md#バス)を参照）。`{1, 2, 6, 8}` 以外の値、またはマスターレイアウトより広い値は拒否されます。サラウンドシーンをマスターより狭い `numChannels` でバウンスすると、余った平面を捨てるのではなく、リアルタイムエンジンと同じ[ITU-R BS.775 ダウンミックス](./realtime-engine.md#サラウンドグループバスとワイドメーター)で畳み込みます。
:::

::: info PDC（レイテンシ補償）とは
楽器やエフェクトの中には、数サンプルの「先読み」を必要とし、その分だけ音声を遅れて出すものがあります。**PDC**（プラグインディレイ補償）は、その楽器が何サンプル遅れるかをコンパイラへ伝え、エンジンが遅延分を戻して全トラックのタイミングをそろえられるようにします。楽器にレイテンシがなければ `0` のままで構いません。
:::

::: tip ライブ状態に左右されない
オフラインバウンスはレンダリング前に、スムージングされたゲインとエフェクトパラメータをすべて目標値へ**整定**（settle）します。そのため、フェーダーやフィルタースイープがレンダリング開始時にどこにあったかに結果は左右されません。ライブで操作した直後にバウンスしても、読み込み直後のプロジェクトからバウンスしたのと同じサンプルになります。
:::

### 長さを省略する

`totalFrames` を省略（または `<= 0`）すると、レンダリング長は**コンパイル済みタイムラインから自動導出**されます。すなわちアレンジの音楽的な終端に、楽器のリリーステールを加えた長さです。内容のあるプロジェクトはフレーム数を自分で計算しなくてもレンダリングでき、空のプロジェクトは空のバッファを返します。楽器が `tail_samples` に `INT_MAX`（`2^31 - 1`）を返す場合はテールが無限なので、内容のあるアレンジの自動長バウンスは拒否されます。有限な窓でレンダーするには、正の `totalFrames` を渡してください。

`useGmPrograms: true` の場合、NativeSynth はアレンジが実際に鳴らすプログラムと、ドラムのノート／キットの組み合わせからリリースの上限を求めます。使わない GM ボイスはバウンスを延長しません。ピアノのサウンドボードとギターの共鳴は、それらを使うノートが鳴った場合だけ加算します。準備（prepare）やリセットの直後で最初のノートが鳴る前、または異なるパッチ／ドラムの組み合わせを 128 種類より多く鳴らしたあとは、テールの問い合わせに対してバンク全体を見積もった保守的な上限を返します。

`drum-kit` プリセット（`gmKit` が ON のパーカッションパッチ）も同じ方法で上限を求めます。ノートが鳴ったあとは、実際に叩かれたキットのピースだけをテールが覆うので、2 秒のクリップでキックを 1 つ鳴らすプロジェクトのレンダリング長は約 2.69 秒で、キット全体の最大値にはなりません。最初のノートの前、または鳴らしたピースの集合が上限を超えたあとは、キットの全ピースにわたる最大値です。

## 内蔵シンセで MIDI をバウンスする

MIDI のみのプロジェクトをプレーンな `bounce` でバウンスすると無音になります。**内蔵オシレーターシンセ**を通せば、1 回の呼び出しで音にできます。波形とエンベロープを選ぶバインディングを渡すか、既定のサイン波パッチなら `{}` を渡します。

::: code-group

```typescript [ブラウザ / WASM]
const project = Project.create();
try {
  project.setSampleRate(48000);
  project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);

  const { clipId } = project.addMidiClip(0, 4);   // MIDI トラック + クリップ、4 拍長
  project.setMidiEvents(clipId, [
    Project.midiNoteOn(0, 0, 0, 60, 100),         // 0 拍目で C4
    Project.midiNoteOff(3, 0, 0, 60, 0),          // 3 拍目でリリース
  ]);

  // MIDI のみのプロジェクト -> 無音でないステレオ音声
  const audio = project.bounceWithBuiltinInstrument(
    { waveform: 'saw', gain: 0.5 },
    { numChannels: 2, sampleRate: 48000 },
  );
} finally {
  project.delete();
}
```

```python [Python]
with sonare.Project() as project:
    project.set_sample_rate(48000)
    project.set_tempo_segments([{"start_ppq": 0.0, "bpm": 120}])

    _, clip_id = project.add_midi_clip(0.0, 4.0)  # MIDI トラック + クリップ、4 拍長
    project.set_midi_events(clip_id, [
        sonare.Project.midi_note_on(0.0, 0, 0, 60, 100),   # 0 拍目で C4
        sonare.Project.midi_note_off(3.0, 0, 0, 60, 0),    # 3 拍目でリリース
    ])

    audio = project.bounce_with_builtin_instrument(
        sonare.BuiltinSynthConfig(waveform="saw", gain=0.5),
        num_channels=2,
        sample_rate=48000,
    )
```

:::

`BuiltinSynthBinding` は `waveform`（`'sine'`、`'saw'`、`'square'`、`'triangle'`）、`gain`、ADSR（`attackMs`、`decayMs`、`sustain`、`releaseMs`）、`polyphony`、そして 1 つの MIDI デスティネーションを指す `destinationId` を受け付けます。数値フィールドはすべて「0 / 省略で既定値を維持」なので、`{}` がそのまま使える既定パッチになります。複数の MIDI デスティネーションをレンダリングするにはバインディングの**配列**を渡します。引数の省略または `undefined` は既定バインディングを 1 つ作ります。何もバインドせず無音でレンダリングするには、明示的な空配列 `[]`（または実行時の `null`）を渡します。

## NativeSynth で MIDI をバウンスする

本格的な楽器のキャラクターが必要なら、`bounceWithSynthInstrument` が MIDI をフル [NativeSynth](./native-synth.md) へ通します。減算・FM・Karplus-Strong・モーダル・加算・パーカッション・ピアノの各エンジンに加え、リアリズムレイヤーまで使えます。楽器の指定方法は 3 通りです。

::: code-group

```typescript [ブラウザ / WASM]
import { init, Project, synthPresetNames } from '@libraz/libsonare';

await init();
synthPresetNames();   // ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', ...]

// 1. プリセット名の文字列
const a = project.bounceWithSynthInstrument('saw-lead', { numChannels: 2, sampleRate: 48000 });

// 2. 同じプリセットを "va:" ルーティングプレフィックスつきで
const b = project.bounceWithSynthInstrument('va:saw-lead', { numChannels: 2, sampleRate: 48000 });

// 3. パッチオブジェクト: ベースプリセット + 共通設定の上書き
const c = project.bounceWithSynthInstrument(
  { preset: 'warm-pad', cutoffHz: 1200, ampReleaseMs: 600 },
  { numChannels: 2, sampleRate: 48000 },
);
```

```python [Python]
sonare.synth_preset_names()   # ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', ...]

# 1. プリセット名の文字列、2. 同じプリセットを "va:" ルーティングプレフィックスつきで
a = project.bounce_with_synth_instrument("saw-lead", num_channels=2, sample_rate=48000)
b = project.bounce_with_synth_instrument("va:saw-lead", num_channels=2, sample_rate=48000)

# 3. パッチオブジェクト: ベースプリセット + 共通設定の上書き
c = project.bounce_with_synth_instrument(
    sonare.SynthPatch(preset="warm-pad", cutoff_hz=1200, amp_release_ms=600),
    num_channels=2,
    sample_rate=48000,
)
```

:::

有効な名前はマジック文字列をハードコードせず [`synthPresetNames()`](./native-synth.md) で取得してください。未知の名前は例外を投げます。パッチオブジェクトは `preset` ベース（`preset` 省略時は既定の減算パッチ）から始まり、共通設定を上書きします。フィールドの一覧は [NativeSynth](./native-synth.md) を参照してください。複数のデスティネーションをバインドするには配列を渡します。空配列は何もバインドしません。

::: tip 1 つのパッチに固定する代わりに GM プログラムへ追従する
`bounceWithSynthInstrument` に渡す各エントリは、プリセット名の文字列ではなく `SynthPatch` オブジェクトで渡した場合にかぎり、`destinationId`（既定 `0`）と `useGmPrograms`（既定 `false`）も持てます。`useGmPrograms` を有効にすると、MIDI のプログラムチェンジがデスティネーションごとに対応する General MIDI ボイスを選び、バインドしたパッチはそのマップがカバーしないものへのフォールバックとして残ります。ほかのバインディングでの名前は、C ABI が `use_gm_programs`、Python が `auto_select_gm` です。詳しい説明と例は [パッチを固定せず GM プログラムに追従させる](./gm-gs.md#パッチを固定せず-gm-プログラムに追従させる) を参照してください。
:::

下のピアノロールはまさにこの呼び出しです。1 つの MIDI フレーズを `bounceWithSynthInstrument` に通し、プリセットを切り替えるたびに同じ音符が別の音色で鳴り直します。再生ヘッドはバウンスした音声に追従します。

<SonareDemo id="midi-piano-roll" />

::: info 決定的であること
プロジェクト・オプション・パッチを固定すれば、`bounceWithSynthInstrument` はビット単位で再現可能です。これはすべてのバウンスメソッドに共通で、だからこそバウンスをテストのスナップショットに採ったり、ハッシュでキャッシュしたりしても安全です。
:::

## SoundFont で MIDI をバウンスする

`bounceWithSf2Instrument` は、プロジェクトに読み込まれた SoundFont を使う GS 互換 [SoundFont プレイヤー](./soundfont-player.md)で MIDI を鳴らします。先に `.sf2` のバイト列を読み込み、それからバウンスします。

::: code-group

```typescript [ブラウザ / WASM]
const sf2Bytes = new Uint8Array(await (await fetch('/piano.sf2')).arrayBuffer());
project.loadSoundFont(sf2Bytes);

// プレイヤーあたり 16 MIDI チャンネル、チャンネル 10 はバンク 128 のドラム、GS NRPN + SysEx に対応
const audio = project.bounceWithSf2Instrument(
  { gain: 0.5 },
  { numChannels: 2, sampleRate: 48000 },
);
```

```python [Python]
project.load_soundfont(open("piano.sf2", "rb").read())

audio = project.bounce_with_sf2_instrument(
    sonare.Sf2InstrumentConfig(gain=0.5),
    num_channels=2,
    sample_rate=48000,
)
```

:::

::: info General MIDI・バンク・ドラム
General MIDI（GM）は、どの SoundFont も対応づける標準の 128 音色セットです。これによりプログラム番号は、ファイルが違っても同じ種類の楽器を選びます。慣習として、チャンネル 10 はドラム用に予約され、バンク 128 として指定します。NRPN と SysEx は、より細かな調整やベンダー固有の調整のための追加 MIDI メッセージで、手作業で設定することはまれです。
:::

SoundFont がカバーしないプログラム（SoundFont を 1 つも読み込まずにバウンスする場合を含む）は、内蔵シンセの GM バンクへフォールバックします。`(channel, bank, program)` ごとに `'sf2'` で解決されるか `'synth'` へフォールバックするかは、[`soundFontManifest()`](./soundfont-player.md) で確認できます。

## 自前の楽器を組み込む

どのランタイムでも、`ExternalInstrument` プロトコルで書いた**任意**の楽器を組み込めます。Node と WASM は `bounceWithInstruments` / `bounceWithInstrument`、Python は `bounce_with_instruments` です。イベントは **UMP**（Universal MIDI Packet）ワード、つまり MIDI 2.0 のパケット形式で楽器に届き、楽器はバウンスが渡すスクラッチバッファへ音声を加算します。

### JavaScript（Node と WASM）

必須なのは `render` だけです。`destinationId`（既定 `0`）、`prepare`、`onEvent`、`latencySamples`、`tailSamples` は任意です。`onEvent` は `{ destinationId, words, renderFrame }` を受け取ります。`render(outputs, frames)` はチャンネルごとにゼロ埋めされた `Float32Array` を受け取ります（常に 2 本。`numChannels` に関係なく、エンジンは楽器をステレオソースとしてホストします）。`render` が返った時点で配列に入っている内容がバウンスへ加算されます。

```typescript
class SineInstrument {
  destinationId = 0;
  tailSamples = 4096;                       // 自動長バウンスを延長するリリーステール
  voices = new Map<number, { phase: number; amp: number }>();
  sampleRate = 48000;

  prepare(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.voices.clear();
  }

  onEvent({ words }: { words: number[] }) {
    const status = (words[0] >>> 20) & 0xf;      // 0x9 ノートオン、0x8 ノートオフ
    const note = (words[0] >>> 8) & 0xff;
    const velocity = words[0] & 0xff;
    if (status === 0x9 && velocity > 0) this.voices.set(note, { phase: 0, amp: (velocity / 127) * 0.3 });
    else if (status === 0x8 || status === 0x9) this.voices.delete(note);
  }

  render(outputs: Float32Array[], frames: number) {
    for (const [note, v] of this.voices) {
      const step = (2 * Math.PI * 440 * 2 ** ((note - 69) / 12)) / this.sampleRate;
      for (let i = 0; i < frames; i++) {
        const s = Math.sin(v.phase) * v.amp;
        for (const out of outputs) out[i] += s;
        v.phase += step;
      }
    }
  }
}

const audio = project.bounceWithInstrument(new SineInstrument(), { numChannels: 2 });
// 複数を同時に鳴らすには project.bounceWithInstruments([a, b], options)。destinationId ごとに 1 つ
```

コールバックはすべて、バウンスがブロックされたまま呼び出し側のスレッド上で同期的に実行されます。そのため Promise を返すコールバックは `TypeError` で拒否されます。コールバックが例外を投げると以降のコールバックは止まり、バウンスは戻った時点で最初のエラーを再送出します（ネイティブ側の失敗はそれより先に報告されます）。コールバックの中からプロジェクトを使うこと（変更、入れ子のバウンス、`delete`）は `InvalidState` になります。異なるチャンネルストリップへ流れるトラックが 1 つの楽器を共有する構成は、コールバックの音声に元トラックの情報がないため拒否されます。ストリップごとに 1 つのデスティネーションをバインドしてください。

### Python

Python では、`bounce_with_instruments` が同じプロトコルをディスパッチします。必須なのは `render` だけで、`prepare`、`on_event`、`latency_samples` / `tail_samples` 属性は任意（ダックタイピング）です。イベントは前節と同じ **UMP** ワードとして `on_event` に届くため、ノートオンもデコード済みのオブジェクトではなくパケットワードのタプルとして渡されます。

```python
import numpy as np
import libsonare as sonare


class SineInstrument:
    """最小構成の外部楽器: 保持中のノートごとにサイン波 1 ボイス。"""

    latency_samples = 0      # コンパイラへ報告する PDC（プラグインディレイ補償）
    tail_samples = 4096      # 自動長バウンス向け。INT_MAX は無限テール

    def prepare(self, sample_rate: float, max_block_size: int) -> None:
        self.sample_rate = sample_rate

    def on_event(self, destination_id: int, ump_words: tuple[int, ...], render_frame: int) -> None:
        # ディスパッチされた UMP ワード（ノートオン／オフ）を解釈してボイスを更新する。
        ...

    def render(self, channels: np.ndarray, num_frames: int) -> None:
        # channels はゼロ埋め済みの (num_channels, num_frames) float32 配列。
        # 自分の音声をここへ加算する。無関係なフレームを上書きしない。
        channels += 0.0


with sonare.Project.from_json(project_json) as project:
    audio = project.bounce_with_instruments(
        SineInstrument(),
        total_frames=0,            # 0 => 長さを自動導出（+ tail_samples）
        num_channels=2,
        sample_rate=48000,
    )                              # -> np.ndarray、形状 (frames, channels)
```

各コールバックはバウンスを呼び出したスレッド上で同期的に実行されるため、スレッド間で守るべき状態はありません。コールバック内で送出された例外は呼び出し側へ伝播します。`ValueError` は無音のドロップアウトではなく `ValueError` として表面化します。`tail_samples` は自動長バウンスを延長し、リバーブやリリースのテールが切れないようにします。

複数の楽器を同時に鳴らすには、単一の楽器ではなく `instruments=[(destination_id, instrument), ...]` を渡します。各タプルが 1 つの楽器を 1 つの MIDI デスティネーションにバインドします。

## バウンス前に MIDI を検証する

コンパイラは寛容で、楽器未バインドの MIDI クリップはエラーではなく**非致命的な警告**です。`compile()` の結果は `hasTimeline: true` のままで、診断には次のメッセージが含まれます。

```
project contains MIDI clips; bounce is silent unless an instrument is bound
```

このメッセージは、`bounce` からいずれかの楽器バウンスへ切り替える合図です。*本当の*問題（鳴りっぱなしのノート）を検出するには、各 MIDI クリップを `validateMidiNotes` で事前検査します。これはすべてのノートオンに対応するノートオフがあるかを確認します。

::: code-group

```typescript [ブラウザ / WASM]
const report = project.validateMidiNotes(clipId);
// { ok: true, unmatchedNoteOns: 0, unmatchedNoteOffs: 0 }
if (!report.ok) {
  // 宙吊りのノートはレンダリング終了まで鳴り続ける。先にイベントを直す
}
```

```python [Python]
report = project.validate_midi_notes(clip_id)
# NotePairValidation(ok=True, unmatched_note_ons=0, unmatched_note_offs=0)
if not report.ok:
    ...  # 宙吊りのノートはレンダリング終了まで鳴り続ける。先にイベントを直す
```

:::

クリップイベントの確認と修復については [MIDI クリップを編集する](./midi-editing.md) を参照してください。

## バウンスを WAV ファイルへ書き出す

バウンスはプレーンな `Float32Array`（チャンネルでインターリーブ）です。ブラウザでは 16 ビット PCM の WAV にラップしてダウンロードさせます。

```typescript
function exportWav(interleaved: Float32Array, sampleRate: number, numChannels: number): Blob {
  const bytesPerSample = 2;
  const dataBytes = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);                                   // PCM チャンクサイズ
  view.setUint16(20, 1, true);                                    // PCM フォーマット
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));          // 量子化前にクランプ
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const audio = project.bounceWithSynthInstrument('saw-lead', { numChannels: 2, sampleRate: 48000 });
const url = URL.createObjectURL(exportWav(audio, 48000, 2));
// url を <a download> に割り当ててクリックさせる
```

Python では CLI が WAV を書き出します（次節）。ライブラリから直接書く場合は、`np.ndarray` を `soundfile` や任意の WAV ライターへ渡してください。

## Python CLI からバウンスする

Python パッケージには `project` サブコマンドが付属し、プロジェクト JSON を読み込んでコードを書かずに WAV へレンダリングできます。

```bash
# プレーンバウンス（オーディオクリップ。MIDI トラックは無音）
sonare project bounce --in song.json -o master.wav --sample-rate 48000

# MIDI を内蔵シンセで鳴らす（プロジェクトの GM プログラムに追従）
sonare project bounce --in song.json -o master.wav --synth

# または NativeSynth カタログの 1 プリセットへ全デスティネーションを固定する
# （全一覧は `sonare project synth-presets`）
sonare project bounce --in song.json -o master.wav --synth saw
sonare project bounce --in song.json -o pad.wav --synth warm-pad

# 未解決のオーディオソースを持つプロジェクトは、先にサンプルの供給が必要です。
# 各ソース自身の file:// URI を一括で開く...
sonare project bounce --in song.json -o master.wav --resolve-audio

# ...またはソースを ID で明示的に 1 つずつバインドする（ソースごとに繰り返し指定）
sonare project bounce --in song.json -o master.wav --audio 1=vocals.wav

# まず確認: コンパイル診断（楽器未バインド警告を含む）
sonare project compile --in song.json --json
```

| フラグ | 意味 |
|--------|------|
| `--in FILE` | プロジェクト JSON（必須） |
| `-o FILE` | 出力 WAV |
| `--sample-rate N` | プロジェクトのレートと一致する必要がある（リサンプルではない）。既定はプロジェクトのレート |
| `--frames N` | レンダリング長（フレーム数）。`0` または省略でアレンジから導出 |
| `--block-size N` | レンダリングブロックサイズ |
| `--channels N` | `1`、`2`、`6`、`8` のいずれかで、シーンのマスター幅以下（既定 `2`） |
| `--instrument-latency N` | 楽器の遅延補償（サンプル数） |
| `--audio ID=WAV` | デコード済みファイルを 1 つのオーディオソースへバインドする（繰り返し指定可） |
| `--resolve-audio` | プロジェクトのソースが持つ `file://` URI を開く |
| `--synth [PRESET]` | 値なし: プロジェクトの GM プログラムに追従。値あり: 全デスティネーションをそのプリセットへ固定 |

プロジェクトの `sources` エントリはオーディオを URI だけで参照し、ライブラリ自身はそれを開きません。そのため、クリップがオーディオを参照するプロジェクトは、コマンドラインがサンプルを供給するまで何もレンダリングしません。`--resolve-audio` はドキュメントのソースがすでに持っている `file://` URI を開きます。それ以外のスキームはスキップされるのではなく、名指しで拒否されます。

```
Error: source 1 (https://example.com/take.wav): --resolve-audio opens file:// URIs only; pass --audio 1=FILE
```

`--audio <source_id>=WAV` は、プロジェクトの `sources` 配列（または下の拒否メッセージ）にある数値 ID でソースを指定し、デコード済みのファイルを 1 つのソースへバインドします。ソースごとにこのフラグを繰り返してください。レンダリング開始時にまだ未解決のソースがあると、その ID・URI・それを供給できたはずのオプションとともに拒否されます。

```
Error: source 1 (file:///song/vocals.wav) has no audio; pass --audio 1=FILE or --resolve-audio
```

バインドされたソースは、デコード元のファイルのチャンネル数をそのまま保ちます。モノラルのテイクをバインドしても、ステレオへアップミックスされることはありません。`midi-render` はどちらのフラグも受け付けません。未解決のオーディオソースを持つプロジェクトを `midi-render` でバウンスすると、`midi-render` が持たないオプションを名指しするメッセージではなく、素の `Error: [7] Invalid state` が発生します。

プリセットを指定しない `--synth` はプロジェクトのチャンネルごとの General MIDI プログラムチェンジに追従し、チャンネル 10 は GM ドラムキットマップへルーティングされ、マップがカバーしないものは `sine` パッチへフォールバックします。プロジェクトが本物の GM プログラムを持つときはこちらを選びます。`--synth <preset>` はすべてのデスティネーションを、[NativeSynth のプリセットカタログ](./native-synth.md)にある 1 つのプリセット（`--synth warm-pad`、`--synth saw-lead` など）へ固定します。名前の一覧は `sonare project synth-presets` で取得できます。SF2 とデスティネーションごとの synth JSON は引き続きバインディング専用（WASM／Node／Python）です。SoundFont を使うバウンスには Project API を使ってください。ほかに `project new`、`project validate`、`project synth-presets`、`project abi` も使えます。

## レシピ

:::: details MIDI のみのプロジェクトをダウンロード可能な WAV へ
楽器と書き出しを含む、MIDI からファイルまでの全経路です。

```typescript
const project = Project.create();
try {
  project.setSampleRate(48000);
  project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
  const { clipId } = project.addMidiClip(0, 4);
  project.setMidiEvents(clipId, [
    Project.midiNoteOn(0, 0, 0, 60, 100),
    Project.midiNoteOff(3, 0, 0, 60, 0),
  ]);
  const audio = project.bounceWithSynthInstrument('saw-lead', { numChannels: 2, sampleRate: 48000 });
  const url = URL.createObjectURL(exportWav(audio, 48000, 2));
} finally {
  project.delete();
}
```
::::

:::: details 出荷前に無音バウンスを検出する
コンパイルし、警告を読み、それから楽器を選びます。

```typescript
const result = project.compile();
const hasMidiWarning = result.diagnostics.some((d) =>
  d.severity === 1 && d.message.includes('bounce is silent'),
);
const audio = hasMidiWarning
  ? project.bounceWithSynthInstrument('saw-lead', { numChannels: 2 })
  : project.bounce({ numChannels: 2 });
```
::::

きれいなバウンスが得られれば、ミックスは完成です。各トラックがマスターへ届く前の音作りを調整したいなら [ミキシングエンジン](./mixing.md) でチャンネルストリップを詰め、アレンジしてバウンスする素材をさらに録りたいなら [録音とテイク](./recording-and-takes.md) を参照してください。

## 関連

- [プロジェクト編集](./project-editing.md) — バウンスするトラック・クリップ・MIDI イベントを組み立てる
- [NativeSynth](./native-synth.md) — `bounceWithSynthInstrument` の背後にあるシンセサイザー
- [SoundFont プレイヤー](./soundfont-player.md) — `bounceWithSf2Instrument` の背後にある SF2 バックエンド
- [MIDI 入力](./midi-input.md) — アレンジしてバウンスする MIDI を取り込む
- [ミキシングエンジン](./mixing.md) — 各トラックが通るチャンネルストリップ・センド・バス
