# 使用例

::: warning パッケージ未公開
npm パッケージ `@libraz/sonare` は現在ベータ版です。[インストール](/ja/docs/installation)で代替オプションを確認してください。
:::

## JavaScript/TypeScript

### 基本的な BPM とキー検出

```typescript
import { init, detectBpm, detectKey } from '@libraz/sonare';

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

### 完全な音楽解析

```typescript
import { init, analyze } from '@libraz/sonare';

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

### Harmonic-Percussive 分離

```typescript
import { init, hpss, detectKey } from '@libraz/sonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic - メロディ成分
// result.percussive - ドラム/パーカッション

// キー検出には調和成分を使用（よりクリーン）
const key = detectKey(result.harmonic, result.sampleRate);
```

### オーディオエフェクト

```typescript
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/sonare';

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

### 特徴抽出

```typescript
import { init, melSpectrogram, mfcc, chroma } from '@libraz/sonare';

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

### ピッチ検出

```typescript
import { init, pitchPyin } from '@libraz/sonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`中央値 F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`平均 F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`有声フレーム: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

### ストリーミング解析

ビジュアライゼーションとライブモニタリング用のリアルタイム音声解析。

```typescript
import { init, StreamAnalyzer } from '@libraz/sonare';

await init();

// 44.1kHz 音声用アナライザーを作成
const analyzer = new StreamAnalyzer(
  44100,  // sampleRate
  2048,   // nFft
  512,    // hopLength
  128,    // nMels
  true,   // computeMel
  true,   // computeChroma
  true,   // computeOnset
  4       // 4 フレームごとに出力（約 60fps）
);

// 入力音声チャンクを処理
function onAudioData(samples: Float32Array) {
  analyzer.process(samples);

  // 利用可能なフレームをチェック
  const available = analyzer.availableFrames();
  if (available > 0) {
    // 効率的な転送のため量子化形式を使用
    const frames = analyzer.readFramesU8(available);

    // frames.nFrames - フレーム数
    // frames.mel - [nFrames * nMels] Uint8Array
    // frames.chroma - [nFrames * 12] Uint8Array
    // frames.onsetStrength - [nFrames] Uint8Array
    // frames.rmsEnergy - [nFrames] Uint8Array

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
class AnalyzerProcessor extends AudioWorkletProcessor {
  private analyzer: StreamAnalyzer;

  constructor() {
    super();
    this.analyzer = new StreamAnalyzer(sampleRate, 2048, 512, 64, true, true, true, 4);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFramesU8(available);
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
#include <sonare/sonare.h>
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
#include <sonare/sonare.h>
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
#include <sonare/sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // メルスペクトログラム
  sonare::MelConfig config;
  config.n_mels = 128;
  config.stft.n_fft = 2048;
  config.stft.hop_length = 512;

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
#include <sonare/sonare.h>

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
#include <sonare/sonare.h>
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

### オーディオ処理

```bash
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
