# librosa 互換性

libsonare の関数が Python の librosa ライブラリにどのように対応するかを説明します。

## 概要

libsonare は、[librosa](https://librosa.org/) と同じような音楽情報検索（MIR）の基本部品を提供しつつ、C++、Python バインディング、Node.js ネイティブバインディング、WebAssembly での利用を想定しています。librosa の完全なドロップイン置き換えではありません。API、デフォルト値、数値計算の細部は異なる場合があります。libsonare のテストスイートでは、一部の機能について librosa 0.11 の参照値と比較しています。

## 機能比較

### サポートされている機能

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.load()` | `Audio::from_file()` | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 |
| `librosa.resample()` | `resample()` | librosa 0.11 は標準で soxr、libsonare は r8brain を使用 |
| `librosa.stft()` | `Spectrogram::compute()` | デフォルト値は互換。小さな数値差は発生します |
| `librosa.istft()` | `Spectrogram::to_audio()` | OLA 再構成 |
| `librosa.feature.melspectrogram()` | `MelSpectrogram::compute()` | Slaney 正規化 |
| `librosa.feature.mfcc()` | `MelSpectrogram::mfcc()` / `mfcc()` | DCT-II。librosa と合わせる場合は `n_mfcc` を明示してください |
| `librosa.feature.chroma_stft()` | `Chroma::compute()` | STFT ベース |
| `librosa.onset.onset_strength()` | `compute_onset_strength()` | スペクトルフラックス |
| `librosa.beat.beat_track()` | `BeatAnalyzer` | DP ベース |
| `librosa.beat.tempo()` | `BpmAnalyzer` | テンポグラム |
| `librosa.effects.hpss()` | `hpss()` | メディアンフィルタリング |
| `librosa.effects.time_stretch()` | `time_stretch()` | フェーズボコーダー |
| `librosa.effects.pitch_shift()` | `pitch_shift()` | タイムストレッチとリサンプリング |

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
| `n_mfcc` | 20 | JS / トップレベルヘルパーは 13。一部のラッパーメソッドは 20 |
| `n_chroma` | 12 | 12 |

librosa の出力と比較する場合は、ラッパーごとのデフォルトに頼らず、パラメータを明示してください。

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

libsonare は Slaney 変換ヘルパーを公開しており、C++ コアの Mel 設定では HTK 形式のフィルターバンク生成にも対応しています。
```typescript
const melSlaney = hzToMel(hz);     // Slaney（デフォルト）
```

## 参照用の許容誤差ガイドライン

これは libsonare の librosa 0.11 参照テストで使っている実用上の比較目安です。回帰テストや移行確認のための指標であり、任意の音源に対する精度保証ではありません。

| 機能 | 許容誤差 | 備考 |
|---------|-----------|-------|
| STFT magnitude | 集計値は約0.1%。個別ビンはより大きくずれる場合あり | float32 / float64、窓処理、ゼロ近傍の差 |
| Mel フィルターバンク | 参照テストの合計値/最大値で約0.1% | フィルターバンク生成 |
| MFCC | 平均/標準偏差の参照チェックで約10-15% | DCT と log-Mel の細部 |
| クロマ | < 5% | ピッチマッピング |
| BPM | 数%程度。半分/倍テンポになる場合あり | テンポ候補の違い |
| ビート時刻 | 数十 ms からインパルス列テストで約80 ms 程度 | 位相アライメント |

## 既知の違い

### 1. リサンプリング

- **librosa 0.11**: 標準は `soxr_hq`。複数のリサンプラーを選択可能
- **libsonare**: `r8brain-free` を使用（24ビット品質）

リサンプリング後の特徴量には小さな差が出る場合があります。

### 2. CQT

- **librosa**: librosa 固有のパラメータ体系を持つ CQT / VQT API
- **libsonare**: libsonare 固有の API を持つ CQT / VQT 実装

### 3. 窓の正規化

- **librosa**: COLA 用に窓を正規化
- **libsonare**: 生の窓値を使用

iSTFT 風の再構成では小さな振幅差が出る場合があります。レベル一致が重要なワークフローでは、再構成後に正規化してください。

## 移行ガイド

### Python から TypeScript へ

`librosa.load()` は標準でモノラル化し、22050 Hz にリサンプルします。ブラウザではまずファイルをデコードし、必要に応じてモノラルへダウンミックスし、同じ挙動に合わせたい場合は明示的にリサンプルしてください。

**変更前 (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3', sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"BPM: {tempo}")
```

**変更後 (TypeScript):**
```typescript
import { init, detectBpm, resample } from '@libraz/libsonare';

await init();

// AudioContext からオーディオを取得
// 必要に応じて、解析前にステレオをモノラルへダウンミックスします。
const samples = audioBuffer.getChannelData(0);

// オプションで 22050 にリサンプル
const resampled = resample(samples, audioBuffer.sampleRate, 22050);

const bpm = detectBpm(resampled, 22050);
console.log(`BPM: ${bpm}`);
```

### Python から C++ へ

`Audio::from_file()` はデコードしたファイルのサンプルレートを保持します。`librosa.load(..., sr=22050)` と合わせる場合は明示的にリサンプルしてください。

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
| STFT | 13ms | 14ms | 同等 |
| メルスペクトログラム | 20ms | 23ms | 同等 |
| MFCC | 22ms | 24ms | 同等 |
| ビート追跡 | 36ms | 24ms | 1.5倍 |
| クロマ | 45ms | 15ms | 2.9倍 |
| HPSS | 1,762ms | 89ms | **19.7倍** |
| pYIN | 5,825ms | 474ms | **12.3倍** |
| 完全解析 | 36.4秒 | 0.67秒 | **~54倍** |

*Apple M5 Max（16コア、128GB）、73秒 WAV（44100 Hz ステレオ）で計測。すべての機能別呼び出しは raw audio からの standalone 計測です。完全な計測手法と再現手順は[ベンチマーク](/ja/docs/benchmarks)を参照。*

WebAssembly は一般にネイティブ C++ より低速です。実際の性能は機能、ブラウザ、入力長、ビルド設定に依存します。計測結果は[ベンチマーク](/ja/docs/benchmarks)を参照してください。
