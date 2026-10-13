---
title: 機能別レシピ
description: BPM／キー検出、総合解析、ルーム音響、HPSS、オーディオエフェクト、特徴抽出、ピッチ検出、ストリーミング解析など、libsonare の各機能をブラウザ・Python・CLI の実行環境ごとに示すそのまま使えるレシピ集。
---

# 機能別レシピ

このページは [使用例](./examples.md) の続きで、機能ごとに 1 つのレシピを実行環境別に示します。libsonare を動かす環境のタブを選んでください。ブラウザ例ではデコード済みのモノラル `Float32Array` サンプルを渡します。入力がエンコード済みバイト列の場合は、先に `Audio.fromMemory*`、Web Audio、または別の JavaScript デコーダーでデコードします。Python パッケージと `sonare` CLI は WAV/MP3 ファイルを直接読み込めます。C++ プログラムは [使用例](./examples.md#c) にあります。

## 基本的な BPM とキー検出

::: code-group

```typescript [ブラウザ]
import { init, detectBpm, detectKey } from '@libraz/libsonare';

async function quickAnalysis(url: string) {
  await init();

  const audioCtx = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // チャンネルを平均してモノラルに畳む（ステレオでは Audio.fromMemory と同じ畳み方）。
  // getChannelData(0) だけでは左チャンネルしか解析されない。
  const samples = new Float32Array(audioBuffer.length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channel.length; i++) samples[i] += channel[i] / audioBuffer.numberOfChannels;
  }
  const sampleRate = audioBuffer.sampleRate;

  const bpm = detectBpm(samples, sampleRate);
  const key = detectKey(samples, sampleRate);

  console.log(`BPM: ${bpm}`);
  console.log(`キー: ${key.name} (信頼度: ${(key.confidence * 100).toFixed(1)}%)`);
}
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    bpm = audio.detect_bpm()
    key = audio.detect_key()

print(f"BPM: {bpm}")
print(f"キー: {key.name} (信頼度: {key.confidence * 100:.1f}%)")
```

```bash [CLI]
sonare bpm song.mp3
sonare key song.mp3
```

:::

## 総合的な音楽解析

どの実行環境でも `analyze()` がコード・セクション・楽曲形式（form）に加えて、音色・ダイナミクス・リズム・メロディまで一度に返します。Python の `Audio.analyze()` とモジュールレベルの `analyze(samples, sample_rate)` は同じ結果を返します。`detect_chords()` や `analyze_sections()` は、その要素だけが欲しいときの単体の呼び出しとして使えます。Python では `timbre`、`dynamics`、`rhythm`、`melody` の型が省略可能なので、使う前に `None` でないことを確認してください。

::: warning `analyze()` が返すのはトライアドです
総合解析の経路は `useTriadsOnly` を `true` にしてコード検出を実行するため、`result.chords` にはトライアドが返ります。曲中のセブンスは、その中に含まれるトライアドとして報告されます。この経路でも拡張コードが必要な場合は `analyze()` に `useTriadsOnly: false` を渡すか、既定で拡張コードまで探索する `detectChords()` を単体で呼んでください。
:::

::: code-group

```typescript [ブラウザ]
import { init, analyze } from '@libraz/libsonare';

await init();

const result = analyze(samples, sampleRate);

console.log('=== 音楽解析 ===');
console.log(`BPM: ${result.bpm} (信頼度: ${(result.bpmConfidence * 100).toFixed(0)}%)`);
console.log(`キー: ${result.key.name}`);
console.log(`拍子: ${result.timeSignature.numerator}/${result.timeSignature.denominator}`);

console.log('\nコード:');
for (const chord of result.chords) {
  console.log(`  ${chord.name} [${chord.start.toFixed(2)}秒 - ${chord.end.toFixed(2)}秒]`);
}

console.log('\nセクション:');
for (const section of result.sections) {
  console.log(`  ${section.name} [${section.start.toFixed(2)}秒 - ${section.end.toFixed(2)}秒]`);
}

console.log(`\n楽曲形式: ${result.form}`);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    result = audio.analyze()

print("=== 音楽解析 ===")
print(f"BPM: {result.bpm} (信頼度: {result.bpm_confidence * 100:.0f}%)")
print(f"キー: {result.key.name}")
print(f"拍子: {result.time_signature}")

print("\nコード:")
for chord in result.chords:
    print(f"  {chord.name} [{chord.start:.2f}秒 - {chord.end:.2f}秒]")

print("\nセクション:")
for section in result.sections:
    print(f"  {section.name} [{section.start:.2f}秒 - {section.end:.2f}秒]")

print(f"\n楽曲形式: {result.form}")

# 1 要素だけ欲しいときは、解析全体ではなく単体で呼び出します:
#   chords = audio.detect_chords().chords
#   sections = analyze_sections(audio.data, audio.sample_rate).sections
```

```bash [CLI]
sonare analyze song.mp3 --json > analysis.json
```

:::

::: details 「セクション」と「フォーム」とは？
**セクション** は曲の構造的なパートです。イントロ、Aメロ、サビ、ブリッジ、アウトロのように、音楽的な性格が変わる場所から検出します。

**フォーム** は曲全体の構成を、セクション 1 つにつき 1 文字の文字列で表したものです。たとえば `IABABCO` のようになります。

| 文字 | セクション |
|------|------------|
| `I` | イントロ |
| `A` | Aメロ |
| `P` | Bメロ（プリコーラス） |
| `B` | サビ |
| `C` | ブリッジ |
| `S` | 間奏 |
| `O` | アウトロ |
| `?` | 不明 |

両者は「この曲が時間軸上でどう構成されているか」に答えます。
:::

## ルーム音響メトリクス

まず、手元の入力や目的から選びます。

| 入力または目的 | 使う API |
|----------------|----------|
| 測定済みのインパルス応答（IR） | `analyzeImpulseResponse()` |
| 通常の音楽・音声録音 | `detectAcoustic()` |
| 音声から実用的な部屋モデルを推定する | `estimateRoom()` |
| 部屋寸法からインパルス応答を作る | `synthesizeRir()` |
| 目標ルームへ寄せる音作り効果 | `roomMorph()` |
| ステレオ録音に同じ効果をかけ、音像を保つ | `roomMorphStereo()` |

::: info RIR と等価ルーム
**RIR** は room impulse response（ルームインパルス応答）の略で、部屋が短い音にどう反応するかを表す音声サンプルです。**等価ルーム** は、音声から推定した実用上のモデルであり、実際の部屋を正確にスキャンした結果ではありません。
:::

ブラインド推定と等価ルーム推定はタグ付けやモニタリングに便利です。UI でどの程度前面に出すかは `confidence` を見て判断してください。

::: code-group

```typescript [ブラウザ]
import { init, analyzeImpulseResponse, detectAcoustic, estimateRoom, synthesizeRir, roomMorph, roomMorphStereo } from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate);
console.log(`RT60: ${measured.rt60.toFixed(2)} 秒`);
console.log(`C80: ${measured.c80.toFixed(1)} dB`);

const blind = detectAcoustic(samples, sampleRate);
console.log(`ブラインド RT60: ${blind.rt60.toFixed(2)} 秒`);
console.log(`信頼度: ${(blind.confidence * 100).toFixed(0)}%`);

const estimate = estimateRoom(samples, sampleRate);
console.log(`推定ルーム: ${estimate.lengthM.toFixed(1)} x ${estimate.widthM.toFixed(1)} x ${estimate.heightM.toFixed(1)} m`);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });

// ステレオペア：目標ルームを `receiverSpacingM`（既定 0.5 m）離した 2 つのレシーバーで聴いたものとして扱う
const { left: wetL, right: wetR } = roomMorphStereo({ left, right, sampleRate, lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

```python [Python]
from libsonare import Audio, analyze_impulse_response, estimate_room, synthesize_rir, room_morph

with Audio.from_file("room-ir.wav") as ir:
    measured = analyze_impulse_response(ir.data, sample_rate=ir.sample_rate)

print(f"RT60: {measured.rt60:.2f} 秒")
print(f"C80: {measured.c80:.1f} dB")

with Audio.from_file("recording.wav") as audio:
    blind = audio.detect_acoustic()
    estimate = estimate_room(audio.data, audio.sample_rate)
    rir = synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
    morphed = room_morph(audio.data, audio.sample_rate, 12.0, 9.0, 4.0, wet=0.6)

print(f"ブラインド RT60: {blind.rt60:.2f} 秒")
print(f"信頼度: {blind.confidence * 100:.0f}%")
print(f"推定ルーム: {estimate.length_m:.1f} x {estimate.width_m:.1f} x {estimate.height_m:.1f} m")
```

```bash [CLI]
# 測定済みインパルス応答として扱う:
sonare acoustic room-ir.wav --ir --json

# 通常の音声から音響パラメータを推定する:
sonare acoustic recording.wav --json

# 幾何ベースのルームを推定・合成・モーフィングする（2 チャンネルファイルはステレオペアとしてモーフィングされる）:
sonare estimate-room recording.wav --json
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav
sonare room-morph recording.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

## HPSS（倍音／打撃成分の分離）

::: code-group

```typescript [ブラウザ]
import { init, hpss, detectKey } from '@libraz/libsonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic   — 倍音成分（持続する音程のある音：ボーカル／コード／ベース／パッド）
// result.percussive — 打撃成分（短く帯域の広い音：ドラム／発音の立ち上がり／子音）

// ドラムやトランジェントはクロマ推定をにじませるため、倍音成分だけで
// キー検出するとクリーンな結果が得られます
const key = detectKey(result.harmonic, result.sampleRate);
```

```python [Python]
from libsonare import Audio, detect_key

with Audio.from_file("song.mp3") as audio:
    result = audio.hpss()
    # result.harmonic   — 倍音成分（持続する音程のある音：ボーカル／コード／ベース／パッド）
    # result.percussive — 打撃成分（短く帯域の広い音：ドラム／発音の立ち上がり／子音）

# ドラムやトランジェントはクロマ推定をにじませるため、倍音成分だけで
# キー検出するとクリーンな結果が得られます
key = detect_key(result.harmonic, result.sample_rate)
```

```bash [CLI]
# pip で入る Python CLI は両方のステムを書き出し、エネルギーも表示します:
sonare hpss song.mp3 -o separated --json

# ネイティブのリリース実行ファイルでも、固有のコマンド名で同じ処理ができます:
#   sonare-cli hpss song.wav -o separated --json
```

:::

## オーディオエフェクト

::: code-group

```typescript [ブラウザ]
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/libsonare';

await init();

// 80% 速度にスローダウン
const slower = timeStretch(samples, sampleRate, 0.8);

// 2 半音上にピッチシフト
const higher = pitchShift(samples, sampleRate, 2);

// サンプルピークを -3 dBFS に正規化
const normalized = normalize(samples, sampleRate, -3);

// 先頭と末尾で RMS が -60 dBFS を下回るフレームを切り詰める
// （絶対レベル。librosa の top_db のようなピーク基準ではない）
const trimmed = trim(samples, sampleRate, -60);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    slower = audio.time_stretch(0.8)        # 80% 速度にスローダウン
    higher = audio.pitch_shift(2)           # 2 半音上にピッチシフト
    normalized = audio.normalize(-3)        # サンプルピークを -3 dBFS に正規化
    trimmed = audio.trim(-60)               # RMS が -60 dBFS（絶対レベル）を下回る端を切り詰める
```

```bash [CLI]
# pip で入る Python CLI で実行できます
sonare time-stretch song.wav --rate 0.8 -o slower.wav
sonare pitch-shift song.wav --semitones 2 -o higher.wav
sonare normalize song.wav --target-db -3 -o normalized.wav
sonare trim-silence song.wav -o trimmed.wav
```

:::

## 特徴抽出

::: code-group

```typescript [ブラウザ]
import { init, melSpectrogram, mfcc, chroma } from '@libraz/libsonare';

await init();

// メルスペクトログラム
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
console.log(`Mel 形状: ${mel.nMels} x ${mel.nFrames}`);

// MFCC
const mfccResult = mfcc(samples, sampleRate, 2048, 512, 128, 13);
console.log(`MFCC 形状: ${mfccResult.nMfcc} x ${mfccResult.nFrames}`);

// クロマ
const chromaResult = chroma(samples, sampleRate);
console.log('ピッチクラス分布:', chromaResult.meanEnergy);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    # メルスペクトログラム
    mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
    print(f"Mel 形状: {mel.n_mels} x {mel.n_frames}")

    # MFCC
    mfcc_result = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=13)
    print(f"MFCC 形状: {mfcc_result.n_mfcc} x {mfcc_result.n_frames}")

    # クロマ
    chroma_result = audio.chroma()
    print("ピッチクラス分布:", chroma_result.mean_energy)
```

```bash [CLI]
sonare mel song.mp3 --json
sonare chroma song.mp3 --json
# MFCC 専用の CLI コマンドはありません。ブラウザまたは Python API を使ってください。
```

:::

## ピッチ検出

ピッチ検出は F0（基本周波数。周期的な波形が繰り返す速さで、ふつうは音の高さとして聞こえる値）をフレームごとに推定します。モノフォニックの音声からメロディラインを取り出すのはこの値です。

::: code-group

```typescript [ブラウザ]
import { init, pitchPyin } from '@libraz/libsonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`中央値 F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`平均 F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`有声フレーム: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    pitch = audio.pitch_pyin()

voiced = sum(1 for v in pitch.voiced_flag if v)
print(f"中央値 F0: {pitch.median_f0:.1f} Hz")
print(f"平均 F0: {pitch.mean_f0:.1f} Hz")
print(f"有声フレーム: {voiced}/{pitch.n_frames}")
```

```bash [CLI]
sonare pitch song.mp3 --algorithm pyin --json
```

:::

::: details 「有声（voiced）」フレームとは？
ピッチ追跡は各フレームを **有声**（voiced） か **無声**（unvoiced） に分類します。

*有声*は、明確な周期的ピッチが見つかったフレームです。歌の母音や持続音がこれに当たります。

*無声*は、明確なピッチがないフレームです。無音、息、「s」「t」などの子音、ノイズ的・打撃的な音がこれに当たります。

`voicedFlag` / `voiced_flag` は、そのフレームごとの真偽値です。`true` の数を数えると、クリップのどれだけが追跡可能なメロディを含んでいたかが分かります。
:::

<SonareDemo id="melody-contour" />

## ストリーミング解析

ビジュアライゼーションとライブモニタリング用のリアルタイム音声解析。

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

await init();

// 44.1kHz 音声用アナライザーを作成
const analyzer = new StreamAnalyzer({
  sampleRate: 44100,
  nFft: 2048,
  hopLength: 512,
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
  emitEveryNFrames: 4, // emit one frame per 4 hops (~21 fps at 44.1 kHz with hopLength 512)
});

// 入力音声チャンクを処理
function onAudioData(samples: Float32Array) {
  analyzer.process(samples);

  // 利用可能なフレームをチェック
  const available = analyzer.availableFrames();
  if (available > 0) {
    const frames = analyzer.readFrames(available);

    // frames.nFrames        - フレーム数
    // frames.timestamps     - [nFrames] Float32Array (秒単位のストリーム時刻)
    // frames.mel            - [nFrames * nMels] Float32Array
    // frames.chroma         - [nFrames * nChroma] Float32Array（CHROMA が無効なら空）
    // frames.featureFlags   - MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    // frames.onsetStrength  - [nFrames] Float32Array
    // frames.rmsEnergy      - [nFrames] Float32Array
    // frames.spectralCentroid / spectralFlatness / chordRoot / chordQuality / chordConfidence

    updateVisualization(frames);
  }
}

// 音声が届くにつれて更新される BPM/キー推定を取得
function checkEstimates() {
  const stats = analyzer.stats();

  if (stats.estimate.bpm > 0) {
    console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(stats.estimate.bpmConfidence * 100).toFixed(0)}%)`);
  }

  if (stats.estimate.key >= 0) {
    console.log(`キー: ${stats.estimate.keyName}`); // 例: "E minor"。keyShortName は "Em"
  }
}
```

## AudioWorklet でのストリーミング

ライブの Web Audio グラフでは、`SonareStreamAnalyzerNode` がグラフの分岐を受け取り、メインスレッドで解析します。プロセッサを書く必要はありません（[オーディオグラフの一部を解析する](./wasm-streaming.md#オーディオグラフの一部を解析する)）。`StreamAnalyzer` をオーディオスレッドで動かす場合は、自分の `AudioWorkletProcessor` の中で WASM モジュールをインスタンス化します。プロセッサの全体は [独自の analyzer worklet](./wasm-streaming.md#独自の-analyzer-worklet) にあります。
