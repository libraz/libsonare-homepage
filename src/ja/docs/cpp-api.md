# C++ API リファレンス

libsonare C++ インターフェースの完全な API リファレンス。

## 概要

libsonare は C++ アプリケーション向けの包括的なオーディオ解析を提供します：

| コンポーネント | 目的 | 主なクラス/関数 |
|-----------|---------|----------------------|
| **コア** | オーディオI/Oと信号処理 | `Audio`, `Spectrogram` |
| **Quick API** | シンプルな一行解析 | `detect_bpm()`, `detect_key()`, `analyze()` |
| **MusicAnalyzer** | コールバック付き完全解析 | `MusicAnalyzer`, `AnalysisResult` |
| **特徴量** | 低レベル特徴抽出 | `MelSpectrogram`, `Chroma`, spectral関数 |
| **エフェクト** | オーディオ処理 | `hpss()`, `time_stretch()`, `pitch_shift()` |

::: tip 用語について
オーディオ解析が初めてですか？[用語集](/ja/docs/glossary)で BPM、STFT、Chroma、HPSS などの用語の説明をご覧ください。
:::

## 名前空間

すべての libsonare 機能は `sonare` 名前空間に含まれています。

```cpp
#include <sonare/sonare.h>

using namespace sonare;
```

## コアクラス

### Audio

共有所有権とゼロコピースライシングを持つオーディオバッファ。

#### ファクトリメソッド

```cpp
// 生サンプルバッファから（コピー）
static Audio Audio::from_buffer(const float* samples, size_t size, int sample_rate);

// ベクターから（ムーブ）
static Audio Audio::from_vector(std::vector<float> samples, int sample_rate);

// ファイルから（WAV, MP3）
static Audio Audio::from_file(const std::string& path);
static Audio Audio::from_file(const std::string& path, const AudioLoadOptions& options);

// メモリバッファから
static Audio Audio::from_memory(const uint8_t* data, size_t size);
static Audio Audio::from_memory(const uint8_t* data, size_t size, const AudioLoadOptions& options);
```

#### プロパティ

```cpp
const float* data() const;        // サンプルへのポインタ
size_t size() const;              // サンプル数
int sample_rate() const;          // サンプルレート (Hz)
float duration() const;           // 長さ (秒)
int channels() const;             // 常に 1 (モノラル)
bool empty() const;               // サンプルがない場合 true
```

#### 操作

```cpp
// 時間によるゼロコピースライス
Audio slice(float start_time, float end_time = -1.0f) const;

// サンプルインデックスによるゼロコピースライス
Audio slice_samples(size_t start_sample, size_t end_sample = -1) const;

// サンプルアクセス
float operator[](size_t index) const;

// イテレータサポート
const float* begin() const;
const float* end() const;
```

#### AudioLoadOptions

リソース制限付きでオーディオファイルを読み込むための設定。

```cpp
struct AudioLoadOptions {
  size_t max_file_size = 500 * 1024 * 1024;  // デフォルト 500 MB
  int target_sample_rate = 0;                 // 0 = 元のまま
  bool normalize = false;                     // 読み込み時にピークノーマライズ
};
```

::: tip 大きなファイルの処理
非常に大きなファイルの場合は、`max_file_size` を適切に設定するか、`slice()` を使用してセグメントごとに処理してください。
:::

### Spectrogram

オーディオ信号の短時間フーリエ変換（STFT）。

```cpp
struct StftConfig {
  int n_fft = 2048;
  int hop_length = 512;
  int win_length = 0;  // 0 = n_fft
  WindowType window = WindowType::Hann;
  bool center = true;
};

// STFT を計算
auto spec = Spectrogram::compute(audio, config);

// プロパティ
spec.n_bins();      // 周波数ビン (n_fft/2 + 1)
spec.n_frames();    // 時間フレーム
spec.n_fft();
spec.hop_length();
spec.sample_rate();

// データアクセス
spec.complex_view();  // [n_bins x n_frames]
spec.magnitude();     // キャッシュ済み
spec.power();         // キャッシュ済み
spec.to_db();         // dB に変換

// 再構成
auto reconstructed = spec.to_audio();
```

::: warning スレッドセーフティ
`Spectrogram` オブジェクトは**スレッドセーフではありません**。キャッシュされた `magnitude()` および `power()` の結果は遅延初期化を使用します。複数のスレッドから同じ `Spectrogram` にアクセスする必要がある場合は、別々のコピーを作成するか、外部で同期を行ってください。
:::

## Quick API

一般的な解析タスクのためのシンプルな関数。

```cpp
namespace sonare::quick {
  // BPM 検出（±2 BPM 精度）
  float detect_bpm(const float* samples, size_t length, int sample_rate);

  // キー検出
  Key detect_key(const float* samples, size_t length, int sample_rate);

  // ビート時刻（秒）
  std::vector<float> detect_beats(const float* samples, size_t length, int sample_rate);

  // オンセット時刻（秒）
  std::vector<float> detect_onsets(const float* samples, size_t length, int sample_rate);

  // 完全解析
  AnalysisResult analyze(const float* samples, size_t length, int sample_rate);
}
```

## MusicAnalyzer <Badge type="warning" text="Heavy" />

遅延初期化による包括的な音楽解析のファサードクラス。

::: tip パフォーマンス
完全解析は計算負荷が高いです。長い音声ファイル（3分以上）の場合は、進捗コールバックを使用して進捗を表示するか、関連するセグメントのみを解析することを検討してください。
:::

```cpp
MusicAnalyzerConfig config;
config.bpm_min = 80.0f;
config.bpm_max = 180.0f;

MusicAnalyzer analyzer(audio, config);

// 進捗コールバックを設定
analyzer.set_progress_callback([](float progress, const char* stage) {
  std::cout << stage << ": " << (progress * 100) << "%\n";
});

// 個別の結果
float bpm = analyzer.bpm();
Key key = analyzer.key();
auto beats = analyzer.beat_times();
auto chords = analyzer.chords();

// 完全解析
auto result = analyzer.analyze();
```

## StreamAnalyzer <Badge type="tip" text="リアルタイム" />

ビジュアライゼーションとライブモニタリング用のリアルタイムストリーミング音声アナライザー。

::: info バッチ vs ストリーミング
録音済みファイルの完全解析には `MusicAnalyzer` を使用。低レイテンシのリアルタイム処理には `StreamAnalyzer` を使用。
:::

### 設定

```cpp
struct StreamConfig {
  int sample_rate = 44100;
  int n_fft = 2048;
  int hop_length = 512;
  WindowType window = WindowType::Hann;

  // 特徴フラグ
  bool compute_magnitude = true;
  bool compute_mel = true;
  bool compute_chroma = true;
  bool compute_onset = true;
  bool compute_spectral = true;

  // Mel 設定
  int n_mels = 128;
  float fmin = 0.0f;
  float fmax = 0.0f;  // 0 = sr/2

  // 出力スロットリング
  int emit_every_n_frames = 1;  // 4 = 44100Hz で約 60fps

  // プログレッシブ推定間隔
  float key_update_interval_sec = 5.0f;
  float bpm_update_interval_sec = 10.0f;
};
```

### 基本的な使い方

```cpp
#include <sonare/streaming/stream_analyzer.h>

StreamConfig config;
config.sample_rate = 44100;
config.n_mels = 64;
config.emit_every_n_frames = 4;

StreamAnalyzer analyzer(config);

// 音声チャンクを処理（例: オーディオコールバックから）
void audio_callback(const float* samples, size_t n_samples) {
  analyzer.process(samples, n_samples);

  // 利用可能なフレームを読み取り
  size_t available = analyzer.available_frames();
  if (available > 0) {
    auto frames = analyzer.read_frames(available);
    for (const auto& frame : frames) {
      // frame.timestamp - 秒単位の時間
      // frame.mel - [n_mels] メルスペクトログラム
      // frame.chroma - [12] クロマグラム
      // frame.onset_strength - オンセット値
      // frame.rms_energy - RMS エネルギー
      visualize(frame);
    }
  }
}
```

### プログレッシブ推定

時間とともに精度が向上する BPM とキーの推定を取得:

```cpp
AnalyzerStats stats = analyzer.stats();

// BPM（約 10 秒後に利用可能）
if (stats.estimate.bpm > 0) {
  std::cout << "BPM: " << stats.estimate.bpm
            << " (信頼度: " << stats.estimate.bpm_confidence << ")\n";
}

// キー（約 5 秒後に利用可能）
if (stats.estimate.key >= 0) {
  const char* keys[] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
  std::cout << "キー: " << keys[stats.estimate.key]
            << (stats.estimate.key_minor ? " マイナー" : " メジャー") << "\n";
}
```

### 量子化形式（帯域幅削減）

```cpp
// 8 ビット量子化（帯域幅 4 分の 1）
QuantizedFrameBufferU8 u8_buffer;
QuantizeConfig qconfig;
qconfig.mel_db_min = -80.0f;
qconfig.mel_db_max = 0.0f;

analyzer.read_frames_quantized_u8(max_frames, u8_buffer, qconfig);

// 16 ビット量子化（帯域幅 2 分の 1）
QuantizedFrameBufferI16 i16_buffer;
analyzer.read_frames_quantized_i16(max_frames, i16_buffer, qconfig);
```

## 特徴抽出

### MelSpectrogram <Badge type="info" text="Medium" />

```cpp
MelConfig config;
config.n_mels = 128;
config.stft.n_fft = 2048;
config.stft.hop_length = 512;

auto mel = MelSpectrogram::compute(audio, config);

// パワースペクトラム [n_mels x n_frames]
auto power = mel.power();

// dB に変換
auto db = mel.to_db();

// MFCC
auto mfcc = mel.mfcc(13);  // 13 係数
```

### Chroma <Badge type="info" text="Medium" />

```cpp
ChromaConfig config;
config.n_chroma = 12;

auto chroma = Chroma::compute(audio, config);

// 特徴 [12 x n_frames]
auto features = chroma.features();

// ピッチクラスごとの平均エネルギー
auto energy = chroma.mean_energy();
```

### スペクトル特徴

```cpp
// フレームごとのスペクトル重心 (Hz)
std::vector<float> spectral_centroid(const Spectrogram& spec, int sr);

// フレームごとのスペクトル帯域幅 (Hz)
std::vector<float> spectral_bandwidth(const Spectrogram& spec, int sr);

// フレームごとのスペクトルロールオフ (Hz)
std::vector<float> spectral_rolloff(const Spectrogram& spec, int sr, float percent = 0.85f);

// フレームごとのスペクトル平坦度
std::vector<float> spectral_flatness(const Spectrogram& spec);

// ゼロ交差率
std::vector<float> zero_crossing_rate(const Audio& audio, int frame_length, int hop_length);

// RMS エネルギー
std::vector<float> rms_energy(const Audio& audio, int frame_length, int hop_length);

// スペクトルコントラスト（周波数帯域のピークと谷の差）
std::vector<float> spectral_contrast(const Spectrogram& spec, int sr, int n_bands = 6,
                                     float fmin = 200.0f, float quantile = 0.02f);
```

### ピッチ追跡 <Badge type="info" text="Medium" />

```cpp
PitchConfig config;
config.frame_length = 2048;
config.hop_length = 512;
config.fmin = 65.0f;    // C2
config.fmax = 2093.0f;  // C7
config.threshold = 0.3f;

// YIN アルゴリズム
PitchResult yin = yin_track(audio, config);

// pYIN アルゴリズム（確率的 YIN + HMM 平滑化）
PitchResult pyin = pyin(audio, config);

// 結果へのアクセス
float median = pyin.median_f0();
float mean = pyin.mean_f0();
const std::vector<float>& f0 = pyin.f0;
const std::vector<bool>& voiced = pyin.voiced_flag;
```

### CQT / VQT <Badge type="info" text="Medium" />

音楽解析のための Constant-Q 変換と Variable-Q 変換。

```cpp
CqtConfig config;
config.fmin = 32.7f;         // C1
config.n_bins = 84;          // 7 オクターブ
config.bins_per_octave = 12; // 半音解像度

auto cqt_result = cqt(audio, config);

// マグニチュードにアクセス [n_bins x n_frames]
auto mag = cqt_result.magnitude();
auto power = cqt_result.power();

// Variable-Q 変換（可変 Q ファクター）
VqtConfig vqt_config;
vqt_config.gamma = 0.0f;  // 0 = CQT と同じ動作
auto vqt_result = vqt(audio, vqt_config);
```

::: warning スレッドセーフティ
`CqtResult` および `VqtResult` オブジェクトは、キャッシュされた結果に遅延初期化を使用します。並行アクセスに対して**スレッドセーフではありません**。マルチスレッドで使用する場合は、別々のコピーを作成してください。
:::

::: danger 非推奨関数
逆変換関数 `icqt()` および `ivqt()` は**非推奨**であり、将来のバージョンで削除される予定です。

```cpp
// 非推奨 - 使用しないでください
[[deprecated("代わりに Griffin-Lim 再構成を使用してください")]]
Audio icqt(const CqtResult& cqt);

[[deprecated("代わりに Griffin-Lim 再構成を使用してください")]]
Audio ivqt(const VqtResult& vqt);
```

**移行方法:** CQT/VQT からオーディオを再構成するには、代わりに STFT で Griffin-Lim アルゴリズムを使用してください:
```cpp
// 推奨アプローチ
auto spec = Spectrogram::compute(audio, stft_config);
// ... マグニチュードを変更 ...
auto reconstructed = griffin_lim(modified_magnitude, stft_config);
```
:::

## エフェクト

### HPSS <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
HPSS は STFT 計算とメディアンフィルタリングを必要とします。処理時間はオーディオの長さに比例します。
:::

```cpp
HpssConfig config;
config.kernel_size_harmonic = 31;
config.kernel_size_percussive = 31;

auto result = hpss(audio, config);
// result.harmonic
// result.percussive

// 便利関数
auto harm = harmonic(audio);
auto perc = percussive(audio);
```

### タイムストレッチ <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
フェーズボコーダーアルゴリズムを使用。処理時間はオーディオの長さに比例します。
:::

```cpp
// 0.5 = 半速、2.0 = 倍速
auto slow = time_stretch(audio, 0.5f);
auto fast = time_stretch(audio, 1.5f);
```

### ピッチシフト <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
タイムストレッチとリサンプリングを組み合わせます。処理時間はオーディオの長さに比例します。
:::

```cpp
// 半音: +12 = 1オクターブ上
auto higher = pitch_shift(audio, 2.0f);
auto lower = pitch_shift(audio, -3.0f);
```

### ノーマライズ & オーディオユーティリティ

```cpp
// ピーク正規化
auto normalized = normalize(audio, 0.0f);      // 目標ピークレベル (dB)

// RMS 正規化
auto rms_norm = normalize_rms(audio, -20.0f);  // 目標 RMS レベル (dB)

// 無音トリミング
auto trimmed = trim(audio, -60.0f);            // 閾値 (dB)

// レベル測定
float peak = peak_db(audio);  // ピーク振幅 (dB)
float rms = rms_db(audio);    // RMS レベル (dB)

// ゲイン適用
auto louder = apply_gain(audio, 6.0f);   // +6 dB
auto quieter = apply_gain(audio, -3.0f); // -3 dB

// フェード
auto with_fade_in = fade_in(audio, 0.5f);   // 0.5秒フェードイン
auto with_fade_out = fade_out(audio, 1.0f); // 1.0秒フェードアウト

// 無音境界検出
auto [start, end] = detect_silence_boundaries(audio, -60.0f);
```

## 型

### Key

```cpp
struct Key {
  PitchClass root;      // C=0, Cs=1, ..., B=11
  Mode mode;            // Major, Minor
  float confidence;     // 0.0 - 1.0

  std::string to_string() const;  // "C major"
  std::string short_name() const; // "C", "Am"
};
```

### Chord

```cpp
struct Chord {
  PitchClass root;
  ChordQuality quality;  // Major, Minor, Dim, Aug, 7th 等
  float start;           // 秒
  float end;             // 秒
  float confidence;

  std::string to_string() const;  // "C", "Am", "G7"
};
```

### AnalysisResult

```cpp
struct AnalysisResult {
  float bpm;
  float bpm_confidence;
  Key key;
  TimeSignature time_signature;
  std::vector<Beat> beats;
  std::vector<Chord> chords;
  std::vector<Section> sections;
  Timbre timbre;
  Dynamics dynamics;
  RhythmFeatures rhythm;
  std::string form;  // "IABABCO"
};
```

## 列挙型

```cpp
enum class PitchClass {
  C = 0, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
};

enum class Mode { Major, Minor };

enum class ChordQuality {
  Major, Minor, Diminished, Augmented,
  Dominant7, Major7, Minor7, Sus2, Sus4
};

enum class SectionType {
  Intro, Verse, PreChorus, Chorus, Bridge, Instrumental, Outro
};

enum class WindowType {
  Hann, Hamming, Blackman, Rectangular
};
```

## 単位変換

```cpp
// Hz <-> Mel (Slaney 式)
float hz_to_mel(float hz);
float mel_to_hz(float mel);

// Hz <-> MIDI ノート番号
float hz_to_midi(float hz);      // A4 = 440Hz = 69
float midi_to_hz(float midi);

// Hz <-> ノート名
std::string hz_to_note(float hz);    // "A4", "C#5"
float note_to_hz(const std::string& note);

// 時間 <-> フレーム
float frames_to_time(int frames, int sr, int hop_length);
int time_to_frames(float time, int sr, int hop_length);
```

## エラーハンドリング

```cpp
class SonareException : public std::exception {
public:
  ErrorCode code() const;
  const char* what() const noexcept override;
};

try {
  auto audio = Audio::from_file("nonexistent.mp3");
} catch (const SonareException& e) {
  if (e.code() == ErrorCode::FileNotFound) {
    // ファイルが見つからない場合の処理
  }
}
```
