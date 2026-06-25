# 使用例

このページは [はじめに](./getting-started.md) の後に読むページです。例は意図的に目的別に並べています。作りたいものに最も近いワークフローを選び、詳細な API はリンク先の実行環境別リファレンスで確認してください。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ、Python、CLI、Node ネイティブの小さな動作パターンを 1 つコピーして試せる。
- 同じ処理が実行環境ごとにどう変わるかを見比べられる。
- 「音声を読み込む／デコードする」処理と「libsonare を呼ぶ」処理を区別できる。
- オプションや戻り値の形が必要になったときに、レシピから該当 API リファレンスへ移れる。

## ユースケース別

### ブラウザアプリで BPM とキーを表示する

音声をブラウザ内で扱う場合は、npm の WebAssembly パッケージを使います。ファイルは先に Web Audio API でデコードし、モノラルの `Float32Array` サンプルを libsonare に渡します。

```typescript
import { init, detectBpm, detectKey } from '@libraz/libsonare';

await init();

const audioCtx = new AudioContext();
const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
const samples = decoded.getChannelData(0);

const bpm = detectBpm(samples, decoded.sampleRate);
const key = detectKey(samples, decoded.sampleRate);
```

### ターミナルで音楽フォルダを一括解析する

CLI は、ターミナルでの確認やスクリプト向け JSON サマリー出力に向いています。CLI は npm ではなく PyPI からインストールします。

```bash
pip install libsonare

for f in *.mp3; do
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

### Python でメタデータを抽出する

Python は、スクリプト、ノートブック、librosa に近いワークフローでネイティブ C++ バックエンドを使いたい場合に向いています。

```python
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    result = audio.analyze()

print(result.bpm, result.key, len(result.beat_times))
```

### Node.js でアップロード音源を解析する

サーバーサイドでファイル読み込みやネイティブ性能が必要な場合は、Node.js ネイティブバインディングを使います。現在はソースビルド前提です。

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('/tmp/upload.wav');
const result = audio.analyze();

console.log(result.bpm, result.key.name);
```

## 機能別レシピ

各レシピは同じ処理を実行環境ごとに示します。libsonare を動かす環境のタブを選んでください。
ブラウザ例ではデコード済みのモノラル `Float32Array` サンプルを渡します。入力がエンコード済み
バイト列の場合は、その前段で Web Audio、別の JavaScript デコーダ、または `Audio.fromMemory*`
を使います。Python パッケージと `sonare` CLI は WAV/MP3 ファイルを直接読み込めます。C++ プログラムは下の C++ セクションにまとめています。

### 基本的な BPM とキー検出

::: code-group

```typescript [ブラウザ]
import { init, detectBpm, detectKey } from '@libraz/libsonare';

async function quickAnalysis(url: string) {
  await init();

  const audioCtx = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const samples = audioBuffer.getChannelData(0);
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

### 完全な音楽解析

ブラウザでも Python でも `analyze()` がコード・セクション・楽曲形式（form）に加えて、音色・ダイナミクス・リズム・メロディまで一度に返します。`detect_chords()` や `analyze_sections()` は、解析全体を実行せずにその要素だけが欲しいときのオプションとして残しています。

::: tip Python：関数とメソッドの違い
モジュールレベルの `analyze(samples, sample_rate)` 関数は完全な結果を返します。`Audio.analyze()` メソッドは基本サマリー（BPM・キー・拍子・ビート）のみを返すので、コード・セクション・楽曲形式をまとめて取得したいときはサンプルを関数に渡してください。
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
from libsonare import Audio, analyze

with Audio.from_file("song.mp3") as audio:
    result = analyze(audio.data, audio.sample_rate)

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
**セクション** は曲の構造的なパートです。イントロ、ヴァース、コーラス、ブリッジ、アウトロのように、音楽的な性格が変わる場所から検出します。

**フォーム** は、それらのセクションをコンパクトなパターンで表した曲全体の構成です。たとえば `イントロ-ヴァース-コーラス-ヴァース-コーラス-アウトロ` や `ABABCB` のように書きます。

両者は「この曲が時間軸上でどう構成されているか」に答えます。
:::

### 室内音響メトリクス

まず、手元の入力や目的から選びます。

| 入力または目的 | 使う API |
|----------------|----------|
| 測定済みのインパルスレスポンス | `analyzeImpulseResponse()` |
| 通常の音楽・音声録音 | `detectAcoustic()` |
| 音声から実用的な部屋モデルを推定する | `estimateRoom()` |
| 部屋寸法からインパルスレスポンスを作る | `synthesizeRir()` |
| 目標ルームへ寄せる音作り効果 | `roomMorph()` |

::: info RIR と等価ルーム
**RIR** は room impulse response の略で、部屋が短い音にどう反応するかを表す音声サンプルです。**等価ルーム** は、音声から推定した実用上のモデルであり、実際の部屋を正確にスキャンした結果ではありません。
:::

ブラインド推定と等価ルーム推定はタグ付けやモニタリングに便利です。UI で強く見せるかどうかは `confidence` を見て判断してください。

::: code-group

```typescript [ブラウザ]
import { init, analyzeImpulseResponse, detectAcoustic, estimateRoom, synthesizeRir, roomMorph } from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate);
console.log(`RT60: ${measured.rt60.toFixed(2)} 秒`);
console.log(`C80: ${measured.c80.toFixed(1)} dB`);

const blind = detectAcoustic(samples, sampleRate);
console.log(`ブラインド RT60: ${blind.rt60.toFixed(2)} 秒`);
console.log(`信頼度: ${(blind.confidence * 100).toFixed(0)}%`);

const estimate = estimateRoom(samples, sampleRate);
console.log(`推定ルーム: ${estimate.length.toFixed(1)} x ${estimate.width.toFixed(1)} x ${estimate.height.toFixed(1)} m`);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
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
print(f"推定ルーム: {estimate.length:.1f} x {estimate.width:.1f} x {estimate.height:.1f} m")
```

```bash [CLI]
# 測定済みインパルスレスポンスとして扱う:
sonare acoustic room-ir.wav --ir --json

# 通常の音声から音響パラメータを推定する:
sonare acoustic recording.wav --json

# 幾何ベースのルームを推定・合成・モーフィングする:
sonare estimate-room recording.wav --json
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav
sonare room-morph recording.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

### HPSS（倍音／打撃成分の分離）

::: code-group

```typescript [ブラウザ]
import { init, hpss, detectKey } from '@libraz/libsonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic   — 倍音成分（ボーカル／メロディ／和音）
// result.percussive — 打撃成分（ドラム／パーカッション）

// ドラムやトランジェントはクロマ推定をにじませるため、倍音成分だけで
// キー検出するとクリーンな結果が得られます
const key = detectKey(result.harmonic, result.sampleRate);
```

```python [Python]
from libsonare import Audio, detect_key

with Audio.from_file("song.mp3") as audio:
    result = audio.hpss()
    # result.harmonic   — 倍音成分（ボーカル／メロディ／和音）
    # result.percussive — 打撃成分（ドラム／パーカッション）

# ドラムやトランジェントはクロマ推定をにじませるため、倍音成分だけで
# キー検出するとクリーンな結果が得られます
key = detect_key(result.harmonic, result.sample_rate)
```

```bash [CLI]
# Python CLI は倍音／打撃成分のエネルギーを表示します:
sonare hpss song.mp3 --json

# 倍音／打撃成分の WAV 書き出しは C++ 製 sonare_cli ビルドで提供されます:
#   sonare hpss song.wav -o separated
```

:::

### オーディオエフェクト

::: code-group

```typescript [ブラウザ]
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/libsonare';

await init();

// 80% 速度にスローダウン
const slower = timeStretch(samples, sampleRate, 0.8);

// 2 半音上に移調
const higher = pitchShift(samples, sampleRate, 2);

// -3dB に正規化
const normalized = normalize(samples, sampleRate, -3);

// 無音をトリム
const trimmed = trim(samples, sampleRate, -60);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    slower = audio.time_stretch(0.8)        # 80% 速度にスローダウン
    higher = audio.pitch_shift(2)           # 2 半音上に移調
    normalized = audio.normalize(-3)        # -3 dB に正規化
    trimmed = audio.trim(-60)               # -60 dB 以下の無音をトリム
```

```bash [C++ CLI]
# ソースビルド C++ CLI
sonare time-stretch song.wav --rate 0.8 -o slower.wav
sonare pitch-shift song.wav --semitones 2 -o higher.wav
sonare normalize song.wav --target-db -3 -o normalized.wav
sonare trim-silence song.wav -o trimmed.wav
```

:::

### 特徴抽出

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

### ピッチ検出

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

### ストリーミング解析

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
  emitEveryNFrames: 4, // 4 フレームごとに出力（約 60fps）
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
    // frames.chroma         - [nFrames * 12] Float32Array
    // frames.onsetStrength  - [nFrames] Float32Array
    // frames.rmsEnergy      - [nFrames] Float32Array
    // frames.spectralCentroid / spectralFlatness / chordRoot / chordQuality / chordConfidence

    updateVisualization(frames);
  }
}

// プログレッシブ BPM/キー推定を取得
function checkEstimates() {
  const stats = analyzer.stats();

  if (stats.estimate.bpm > 0) {
    console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(stats.estimate.bpmConfidence * 100).toFixed(0)}%)`);
  }

  if (stats.estimate.key >= 0) {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const mode = stats.estimate.keyMinor ? 'マイナー' : 'メジャー';
    console.log(`キー: ${keys[stats.estimate.key]} ${mode}`);
  }
}
```

### AudioWorklet でのストリーミング

```typescript
// analyzer-processor.ts (AudioWorklet)
import { init, StreamAnalyzer } from '@libraz/libsonare';

class AnalyzerProcessor extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;

  constructor() {
    super();
    void init().then(() => {
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64,
        emitEveryNFrames: 4,
      });
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);
      this.port.postMessage({ type: 'frames', data: frames }, [
        frames.timestamps.buffer,
        frames.mel.buffer
      ]);
    }

    return true;
  }
}

registerProcessor('analyzer-processor', AnalyzerProcessor);
```

```typescript
// main.ts
const audioCtx = new AudioContext();
await audioCtx.audioWorklet.addModule('analyzer-processor.js');

const worklet = new AudioWorkletNode(audioCtx, 'analyzer-processor');
worklet.port.onmessage = (e) => {
  if (e.data.type === 'frames') {
    renderSpectrogram(e.data.data);
  }
};

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
audioCtx.createMediaStreamSource(stream).connect(worklet);
```

## C++

### 基本的な使い方

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  float bpm = sonare::quick::detect_bpm(
    audio.data(), audio.size(), audio.sample_rate()
  );

  std::cout << "BPM: " << bpm << std::endl;
  return 0;
}
```

### MusicAnalyzer での完全解析

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");
  sonare::MusicAnalyzer analyzer(audio);

  // 進捗コールバック
  analyzer.set_progress_callback([](float progress, const char* stage) {
    std::cout << stage << ": " << (progress * 100) << "%\n";
  });

  auto result = analyzer.analyze();

  std::cout << "BPM: " << result.bpm << std::endl;
  std::cout << "キー: " << result.key.to_string() << std::endl;

  std::cout << "\nコード:" << std::endl;
  for (const auto& chord : result.chords) {
    std::cout << "  " << chord.to_string()
              << " [" << chord.start << "秒 - " << chord.end << "秒]"
              << std::endl;
  }

  return 0;
}
```

### 特徴抽出

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // メルスペクトログラム
  sonare::MelConfig config;
  config.n_mels = 128;
  config.n_fft = 2048;
  config.hop_length = 512;

  auto mel = sonare::MelSpectrogram::compute(audio, config);
  std::cout << "Mel 形状: " << mel.n_mels() << " x " << mel.n_frames() << std::endl;

  // MFCC
  auto mfcc = mel.mfcc(13);
  std::cout << "MFCC 係数: " << mfcc.size() / mel.n_frames() << std::endl;

  return 0;
}
```

### オーディオエフェクト

```cpp
#include <sonare.h>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // HPSS
  auto hpss_result = sonare::hpss(audio);
  // hpss_result.harmonic
  // hpss_result.percussive

  // タイムストレッチ（50% にスローダウン）
  auto slow = sonare::time_stretch(audio, 0.5f);

  // ピッチシフト（+2 半音）
  auto higher = sonare::pitch_shift(audio, 2.0f);

  return 0;
}
```

### ゼロコピースライシング

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto full = sonare::Audio::from_file("song.mp3");
  std::cout << "全体の長さ: " << full.duration() << "秒\n";

  // ゼロコピースライス（同じバッファを共有）
  auto intro = full.slice(0.0f, 30.0f);
  auto chorus = full.slice(60.0f, 90.0f);

  // 各セクションを解析
  auto intro_key = sonare::quick::detect_key(
    intro.data(), intro.size(), intro.sample_rate()
  );
  auto chorus_key = sonare::quick::detect_key(
    chorus.data(), chorus.size(), chorus.sample_rate()
  );

  std::cout << "イントロのキー: " << intro_key.to_string() << "\n";
  std::cout << "サビのキー: " << chorus_key.to_string() << "\n";

  return 0;
}
```

## CLI 例

### クイック解析

```bash
# BPM 検出
sonare bpm song.mp3

# キー検出
sonare key song.mp3

# 完全解析 (JSON)
sonare analyze song.mp3 --json > analysis.json
```

### オーディオ処理（C++ CLI 専用）

::: info
`pitch-shift`、`time-stretch`、エクスポート用 `hpss` などのコマンドは、ソースからビルドする C++ 製 `sonare_cli` バイナリで提供されます。`pip install libsonare` でインストールされる Python CLI には、[CLI リファレンス](/ja/docs/cli) で説明する解析・特徴抽出系コマンドのみが含まれます。
:::

```bash [C++ CLI]
# 2 半音上に移調
sonare pitch-shift --semitones 2 input.wav -o output.wav

# 練習用にスローダウン
sonare time-stretch --rate 0.8 song.wav -o practice.wav

# ドラムとメロディを分離
sonare hpss song.wav -o separated
```

### バッチ処理

```bash
# すべての MP3 ファイルを解析
for f in *.mp3; do
  echo "処理中: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```
