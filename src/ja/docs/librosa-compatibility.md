# librosa 互換性

libsonare の関数が Python の librosa ライブラリにどのように対応するかを説明します。

## 概要

libsonare は C++ と WebAssembly 環境向けに最適化しながら、[librosa](https://librosa.org/) と同様の機能を提供することを目指しています。ほとんどのコア機能は同じアルゴリズムと互換性のあるデフォルトパラメータを使用しています。

## 機能比較

### サポートされている機能

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.load()` | `Audio::from_file()` | WAV, MP3 対応 |
| `librosa.resample()` | `resample()` | r8brain 使用 |
| `librosa.stft()` | `Spectrogram::compute()` | 完全互換 |
| `librosa.istft()` | `Spectrogram::to_audio()` | OLA 再構成 |
| `librosa.feature.melspectrogram()` | `MelSpectrogram::compute()` | Slaney 正規化 |
| `librosa.feature.mfcc()` | `MelSpectrogram::mfcc()` | DCT-II, リフタリング |
| `librosa.feature.chroma_stft()` | `Chroma::compute()` | STFT ベース |
| `librosa.onset.onset_strength()` | `compute_onset_strength()` | スペクトルフラックス |
| `librosa.beat.beat_track()` | `BeatAnalyzer` | DP ベース |
| `librosa.beat.tempo()` | `BpmAnalyzer` | テンポグラム |
| `librosa.effects.hpss()` | `hpss()` | メディアンフィルタリング |
| `librosa.effects.time_stretch()` | `time_stretch()` | フェーズボコーダー |
| `librosa.effects.pitch_shift()` | `pitch_shift()` | WSOLA 風 |

### librosa にない機能

| libsonare | 説明 |
|-----------|-------------|
| `KeyAnalyzer` | 音楽キー検出（Krumhansl-Schmuckler） |
| `ChordAnalyzer` | コード認識（テンプレートマッチング） |
| `SectionAnalyzer` | 楽曲構造解析 |
| `TimbreAnalyzer` | 音色特性 |
| `DynamicsAnalyzer` | ラウドネスとダイナミクス |
| `RhythmAnalyzer` | 拍子、グルーブ |

## 関数マッピング

### STFT

**librosa:**
```python
S = librosa.stft(
    y,
    n_fft=2048,
    hop_length=512,
    win_length=None,
    window='hann',
    center=True
)
```

**libsonare (C++):**
```cpp
sonare::StftConfig config;
config.n_fft = 2048;
config.hop_length = 512;
config.window = sonare::WindowType::Hann;
config.center = true;

auto spec = sonare::Spectrogram::compute(audio, config);
```

**libsonare (JS):**
```typescript
const result = stft(samples, sampleRate, 2048, 512);
```

### メルスペクトログラム

**librosa:**
```python
mel = librosa.feature.melspectrogram(
    y=y, sr=sr,
    n_fft=2048, hop_length=512,
    n_mels=128, fmin=0.0, fmax=None,
    htk=False, norm='slaney'
)
mel_db = librosa.power_to_db(mel, ref=np.max)
```

**libsonare:**
```typescript
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
// mel.power - パワースペクトラム
// mel.db - dB スケール
```

### MFCC

**librosa:**
```python
mfcc = librosa.feature.mfcc(
    y=y, sr=sr, n_mfcc=13,
    n_fft=2048, hop_length=512, n_mels=128
)
```

**libsonare:**
```typescript
const result = mfcc(samples, sampleRate, 2048, 512, 128, 13);
// result.coefficients - [nMfcc x nFrames]
```

### HPSS

**librosa:**
```python
y_harm, y_perc = librosa.effects.hpss(y, kernel_size=31)
```

**libsonare:**
```typescript
const result = hpss(samples, sampleRate, 31, 31);
// result.harmonic
// result.percussive
```

### ビート追跡

**librosa:**
```python
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120)
beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)
```

**libsonare:**
```typescript
const bpm = detectBpm(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);  // すでに秒単位
```

## デフォルトパラメータ

| パラメータ | librosa | libsonare |
|-----------|---------|-----------|
| `sr` | 22050 | ユーザー指定 |
| `n_fft` | 2048 | 2048 |
| `hop_length` | 512 | 512 |
| `win_length` | n_fft | n_fft |
| `window` | 'hann' | Hann |
| `center` | True | true |
| `n_mels` | 128 | 128 |
| `fmin` | 0.0 | 0.0 |
| `fmax` | sr/2 | sr/2 |
| `n_mfcc` | 20 | 13 |
| `n_chroma` | 12 | 12 |

## Mel スケール式

### Slaney (librosa デフォルト、libsonare デフォルト)

```
f < 1000 Hz の場合:  mel = 3 * f / 200
f >= 1000 Hz の場合: mel = 15 + 27 * log10(f / 1000) / log10(6.4)
```

### HTK

```
mel = 2595 * log10(1 + f / 700)
```

libsonare は両方を提供:
```typescript
const melSlaney = hzToMel(hz);     // Slaney（デフォルト）
// HTK は C++ API で利用可能
```

## 許容誤差ガイドライン

| 機能 | 許容誤差 | 備考 |
|---------|-----------|-------|
| STFT magnitude | < 1e-6 | 浮動小数点精度 |
| メルスペクトログラム | < 1% | フィルターバンクの違い |
| MFCC | < 2% | DCT 正規化 |
| クロマ | < 5% | ピッチマッピング |
| BPM | ±2 BPM | アルゴリズムの違い |
| ビート時刻 | ±50ms | 位相アライメント |

## 既知の違い

### 1. リサンプリング

- **librosa**: `resampy` を使用（Kaiser best）
- **libsonare**: `r8brain-free` を使用（24ビット品質）

下流の機能への影響は最小限。

### 2. CQT

- **librosa**: 完全な CQT 実装
- **libsonare**: STFT ベースのクロマのみ

### 3. 窓の正規化

- **librosa**: COLA 用に窓を正規化
- **libsonare**: 生の窓値を使用

iSTFT での振幅差を補正するには `normalize()` を使用。

## 移行ガイド

### Python から TypeScript へ

**変更前 (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3', sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"BPM: {tempo}")
```

**変更後 (TypeScript):**
```typescript
import { init, detectBpm, resample } from '@libraz/sonare';

await init();

// AudioContext からオーディオを取得
const samples = audioBuffer.getChannelData(0);

// オプションで 22050 にリサンプル
const resampled = resample(samples, audioBuffer.sampleRate, 22050);

const bpm = detectBpm(resampled, 22050);
console.log(`BPM: ${bpm}`);
```

### Python から C++ へ

**変更前 (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3')
chroma = librosa.feature.chroma_stft(y=y, sr=sr)
```

**変更後 (C++):**
```cpp
#include <sonare/sonare.h>

auto audio = sonare::Audio::from_file("audio.mp3");
auto chroma = sonare::Chroma::compute(audio);
auto energy = chroma.mean_energy();
```

## パフォーマンス比較

| 処理 | librosa (Python) | libsonare (C++) | 高速化 |
|-----------|------------------|-----------------|---------|
| STFT (3分) | ~500ms | ~50ms | ~10倍 |
| メルスペクトログラム | ~600ms | ~60ms | ~10倍 |
| MFCC | ~700ms | ~70ms | ~10倍 |
| ビート追跡 | ~2秒 | ~200ms | ~10倍 |
| 完全解析 | ~5秒 | ~500ms | ~10倍 |

*Intel Core i7、22050 Hz の 3 分間オーディオでベンチマーク*

WebAssembly はネイティブ C++ より約 2-3 倍遅いですが、Python よりは高速です。
