# C++ API リファレンス

libsonare C++ インターフェースの完全な API リファレンス。

## 概要

libsonare は C++ アプリケーション向けに、オーディオ解析、メーター、特徴抽出、編集 DSP、リアルタイムストリーミング、マスタリング、ミキシングを提供します。`sonare.h` は解析・特徴量系の広い入口です。マスタリング、ミキシング、エンジン、グラフ、編集モジュールは、必要なサブシステムだけを include したい場合の専用ヘッダーも持っています。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- quick helper、`MusicAnalyzer`、`StreamAnalyzer`、各モジュールヘッダー、C ABI を使い分けられる。
- どの C++ サーフェスが各言語バインディングの土台になっているかを理解できる。
- 音声読み込み、解析、ストリーミングフレーム、マスタリング、ミキシング、FFI に必要な struct / class を探せる。
- 目的別ガイドを読んだ後のリファレンスとして、このページを使える。

| コンポーネント | 目的 | 主なクラス/関数 |
|-----------|---------|----------------------|
| **コア** | オーディオI/Oと信号処理 | `Audio`, `Spectrogram` |
| **Quick API** | 一行解析とルーム音響の入口 | `quick::detect_bpm()`, `quick::detect_key()`, `quick::detect_beats()`, `quick::detect_acoustic()` |
| **MusicAnalyzer** | コールバック付きの楽曲解析 | `MusicAnalyzer`, `AnalysisResult` |
| **ストリーミング** | ブロック単位の MIR フレームと逐次推定 | `StreamAnalyzer`, `StreamConfig`, `FrameBuffer` |
| **特徴量** | 低レベル特徴抽出と逆変換特徴量 | `MelSpectrogram`, `Chroma`, `cqt()`, `vqt()`, `mel_to_audio()` |
| **エフェクト／編集** | オーディオ処理と編集プリミティブ | `hpss()`, `time_stretch()`, `pitch_shift()`, pitch editor / voice changer モジュール |
| **マスタリング** | プリセット、チェーン、名前付きプロセッサ、assistant/profile JSON | `mastering::MasteringChain`, `mastering::api::*` |
| **ミキシング／エンジン** | シーンベースのミキサーと DAW 風リアルタイムトランスポート | `mixing::api::Scene`, `mixing::MixerController`, `RealtimeEngine` |
| **C ABI** | バインディング向けの安定 FFI | `sonare_c.h` |

## C++ でどの入口を使うか

| 目的 | include / API |
|------|---------------|
| BPM、キー、ビート、オンセット、音響指標を単発で見る | `#include <sonare.h>` と `sonare::quick::*` |
| 同じ音声から複数の楽曲解析結果を得る | `MusicAnalyzer`。中間特徴量を再利用できます |
| ライブビジュアライザや逐次推定 | `#include <streaming/stream_analyzer.h>` |
| マスタリングプリセットや名前付きプロセッサ | `src/mastering/api/*` ヘッダー。[マスタリングプロセッサ](./mastering-processors.md) も参照 |
| ステムミキサー / シーン JSON | `src/mixing/api/scene.h` と `src/mixing/api/scene_json.cpp` の概念。[ミキシングエンジン](./mixing.md) も参照 |
| 言語バインディングやプラグイン境界 | C++ クラスではなく `sonare_c.h` |

::: tip 用語について
オーディオ解析が初めてですか？[用語集](/ja/docs/glossary) で BPM、STFT、Chroma、HPSS などの用語の説明をご覧ください。
:::

## 名前空間

すべての libsonare 機能は `sonare` 名前空間に含まれています。

```cpp
#include <sonare.h>

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

// ファイルから（標準は WAV/MP3。SONARE_WITH_FFMPEG 有効ビルドでは FFmpeg 対応形式）
// デコード失敗時は SonareException
static Audio Audio::from_file(const std::string& path);

// メモリ上のエンコード済み音声から。対応形式は from_file() と同じ
// デコード失敗時は SonareException
static Audio Audio::from_memory(const uint8_t* data, size_t size);
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

::: tip 大きなファイルの処理
非常に大きなファイルを扱う場合は、読み込み後に `slice()` でセグメントに分割して処理することを検討してください。
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
  PadMode pad_mode = PadMode::Constant;
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

一般的な解析タスクのためのシンプルな関数群です。1 回限りの BPM・キー・ビート・ダウンビート・オンセット検出やルーム音響解析に向きます。

::: info Quick API と MusicAnalyzer の使い分け
- **Quick API（`sonare::quick::...`）** — 1 つの結果だけが欲しいとき。内部で必要なステージだけを走らせます。
- **MusicAnalyzer** — 同じ音源から BPM・キー・コード・セクションなど複数の結果が必要なとき。中間特徴量（STFT・クロマ・オンセット包絡線）を共有して二重計算を避けます。
:::

```cpp
namespace sonare::quick {
  // BPM 検出
  float detect_bpm(const float* samples, size_t length, int sample_rate);

  // キー検出
  Key detect_key(const float* samples, size_t length, int sample_rate);
  Key detect_key(const float* samples, size_t length, int sample_rate, const KeyConfig& config);
  std::vector<KeyCandidate> detect_key_candidates(const float* samples, size_t length, int sample_rate,
                                                  const KeyConfig& config = KeyConfig());

  // ビート時刻（秒）
  std::vector<float> detect_beats(const float* samples, size_t length, int sample_rate);

  // ダウンビート時刻（秒）
  std::vector<float> detect_downbeats(const float* samples, size_t length, int sample_rate);

  // オンセット時刻（秒）
  std::vector<float> detect_onsets(const float* samples, size_t length, int sample_rate);

  // 完全解析
  AnalysisResult analyze(const float* samples, size_t length, int sample_rate);

  // ルーム音響
  AcousticParameters detect_acoustic(const float* samples, size_t length, int sample_rate);
  AcousticParameters analyze_impulse_response(const float* samples, size_t length, int sample_rate);
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

  // チューニング設定
  float tuning_ref_hz = 440.0f;  // A4 の基準周波数

  // 出力設定
  OutputFormat output_format = OutputFormat::Float32;
  int emit_every_n_frames = 1;   // 4 = 44100Hz で約 60fps
  int magnitude_downsample = 1;  // マグニチュードのダウンサンプル係数

  // プログレッシブ推定間隔
  float key_update_interval_sec = 5.0f;
  float bpm_update_interval_sec = 10.0f;
};
```

`OutputFormat` は下流へ渡すストリーミングフレームの内部表現を選びます。`Float32` は精度優先、`Int16` は帯域幅を抑えた転送、`Uint8` は可視化向けの軽量ペイロードに向きます。UI スレッドや Worker へ送る量を減らしたい場合は、後述の量子化読み出しメソッドと組み合わせて使います。

### 基本的な使い方

```cpp
#include <streaming/stream_analyzer.h>

using namespace sonare;

StreamConfig config;
config.sample_rate = 44100;
config.n_mels = 64;
config.emit_every_n_frames = 4;
config.output_format = OutputFormat::Float32;

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

### StreamFrame

`read_frames()` は読み出したフレームを内部キューから消費し、フレーム単位の構造体として返します。デバッグやネイティブ UI への直接描画には扱いやすい形式です。

```cpp
struct StreamFrame {
  float timestamp;          // ストリーム時間（秒）
  int frame_index;          // 累積フレーム番号

  std::vector<float> magnitude;  // [n_bins] またはダウンサンプル後
  std::vector<float> mel;        // [n_mels]
  std::vector<float> chroma;     // [12]

  float spectral_centroid;       // Hz
  float spectral_flatness;       // 0-1
  float rms_energy;              // 正規化 RMS

  float onset_strength;
  bool onset_valid;              // 最初のフレームでは false

  int chord_root;                // 0-11、-1 = 不明
  int chord_quality;             // 0=Maj, 1=Min, 2=Dim など
  float chord_confidence;        // 0-1
};
```

### SOA 形式（効率的な転送）

Worker や UI スレッドへまとめて渡す場合は、Structure-of-Arrays の `FrameBuffer` を使います。`std::vector<StreamFrame>` より連続メモリに寄せやすく、WASM や `postMessage` 相当の転送に向いています。

```cpp
FrameBuffer buffer;
analyzer.read_frames_soa(max_frames, buffer);

// buffer.n_frames
// buffer.timestamps - [n_frames]
// buffer.mel - [n_frames * n_mels]
// buffer.chroma - [n_frames * 12]
// buffer.onset_strength - [n_frames]
// buffer.rms_energy - [n_frames]
// buffer.spectral_centroid - [n_frames]
// buffer.spectral_flatness - [n_frames]
// buffer.chord_root / chord_quality / chord_confidence - [n_frames]
```

::: details レイアウト用語: Structure-of-Arrays・row-major・量子化
- **Structure-of-Arrays（SoA）** — フレームごとの構造体の配列ではなく、各フィールドを独立した連続配列（`timestamps`、`mel`、`chroma`…）に持ちます。キャッシュ効率・SIMD 効率がよく、別スレッドへの受け渡しも安価です。
- **row-major（行優先）** — `mel`（`[n_frames * n_mels]`）のような 2 次元データを、1 行ずつ連続して格納します。フレーム 0 のメル全ビン、次にフレーム 1…という順です。要素 `(f, m)` は `f * n_mels + m` で参照します。
- **量子化**（後述） — 各 32bit float を固定の min/max 範囲で 8bit / 16bit 整数に詰め、精度と引き換えにバッファを約 1/4・1/2 に縮めます。UI スレッドへフレームを渡すのに向いています。
:::

### ChordChange

```cpp
struct ChordChange {
  int root;           // 0-11 (C-B)
  int quality;        // 0=Maj, 1=Min, 2=Dim, etc.
  float start_time;   // 秒
  float confidence;   // 0-1
};
```

### BarChord

小節境界で検出されたコード（ビート同期）。

```cpp
struct BarChord {
  int bar_index;
  int root;           // 0-11 (C-B)
  int quality;        // 0=Maj, 1=Min, 2=Dim, etc.
  float start_time;   // 秒
  float confidence;   // 0-1
};
```

### AnalyzerStats

```cpp
struct AnalyzerStats {
  int total_frames;
  size_t total_samples;
  float duration_seconds;
  ProgressiveEstimate estimate;
};
```

### ProgressiveEstimate

時間とともに精度が向上する BPM、キー、コード、パターンの推定値。

```cpp
struct ProgressiveEstimate {
  // BPM 推定
  float bpm;                // 未推定の場合は 0
  float bpm_confidence;     // 0-1、時間とともに増加
  int bpm_candidate_count;

  // キー推定
  int key;                  // 0-11 (C-B)、-1 = 不明
  bool key_minor;
  float key_confidence;     // 0-1、時間とともに増加

  // コード推定（現在）
  int chord_root;           // 0-11、-1 = 不明
  int chord_quality;        // 0=Maj, 1=Min, etc.
  float chord_confidence;
  float chord_start_time;

  // コード進行（時間とともに蓄積）
  std::vector<ChordChange> chord_progression;

  // 小節同期コード進行（安定した BPM が必要）
  std::vector<BarChord> bar_chord_progression;
  int current_bar;          // BPM 不安定時は -1
  float bar_duration;       // BPM 不安定時は 0

  // パターン検出
  int pattern_length;                     // 繰り返しパターンの長さ（デフォルト: 4小節）
  std::vector<BarChord> voted_pattern;    // 各パターン位置の投票済みコード
  std::string detected_pattern_name;      // 最も一致するパターン名（例: "royalRoad"）
  float detected_pattern_score;           // 一致スコア（0-1）
  std::vector<std::pair<std::string, float>> all_pattern_scores;

  // 統計情報
  float accumulated_seconds;
  int used_frames;
  bool updated;             // このフレームで推定が更新された場合 true
};
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

// コード進行パターン
if (!stats.estimate.detected_pattern_name.empty()) {
  std::cout << "パターン: " << stats.estimate.detected_pattern_name
            << " (スコア: " << stats.estimate.detected_pattern_score << ")\n";
}
```

### 設定メソッド

```cpp
// パターンロックの最適タイミングのために予想総時間を設定
analyzer.set_expected_duration(180.0f);  // 3 分

// ラウドな音声のノーマライズゲインを設定
analyzer.set_normalization_gain(0.5f);   // -6dB 減衰

// チューニング基準周波数を設定（デフォルト: 440 Hz）
// 非標準チューニングの音声に使用
analyzer.set_tuning_ref_hz(466.16f);     // 半音高い
```

### クエリメソッド

```cpp
// 処理済みフレーム数
int count = analyzer.frame_count();

// 現在の時間位置（秒）
float time = analyzer.current_time();
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
config.n_fft = 2048;
config.hop_length = 512;

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
逆変換関数 `icqt()` および `ivqt()` はヘッダー上で**非推奨**です。新しいコードでは、
Griffin-Lim または位相ボコーダ系の再構成経路を優先してください。

```cpp
// 非推奨 - 使用しないでください
[[deprecated("Use Griffin-Lim or phase vocoder for better reconstruction quality")]]
Audio icqt(const CqtResult& cqt);

[[deprecated("Use griffinlim_vqt or phase vocoder for better reconstruction quality")]]
Audio ivqt(const VqtResult& vqt);
```

**移行方法:** プレビュー音声の再構成には逆変換ヘルパー側の Griffin-Lim 経路を使い、
品質が重要な場合は独自の STFT ドメイン処理で位相情報を保持してください。
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

### librosa 互換ヘルパー

対応する `librosa` 関数の挙動に
合わせています。全体のマッピングは
[librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trim_silence` / `split_silence`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — 固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peak_pick` / `vector_normalize`** — 1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`** — クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

```cpp
// プリエンファシス／ディエンファシス（librosa.effects.preemphasis / deemphasis）
auto pre   = preemphasis(audio, /*coef=*/0.97f);
auto deemp = deemphasis(audio, /*coef=*/0.97f);

// 無音トリム／分割（librosa.effects.trim / split）
auto [trimmed, start_sample, end_sample] = trim_silence(audio, /*top_db=*/60.0f);
auto intervals = split_silence(audio, /*top_db=*/60.0f);  // std::vector<std::pair<int,int>>

// フレーミング／パディングのヘルパー（librosa.util.*）
auto frames = frame_signal(samples, /*frame_length=*/2048, /*hop_length=*/512);
auto padded = pad_center(values, /*size=*/4096);
auto fixed  = fix_length(values, /*size=*/4096);
auto bounds = fix_frames(frame_indices, /*x_min=*/0, /*x_max=*/-1);

// ピーク検出／ベクトル正規化（librosa.util.peak_pick / normalize）
auto peaks  = peak_pick(onset_envelope, pre_max, post_max, pre_avg, post_avg, delta, wait);
auto normed = vector_normalize(values, /*norm_type=*/2);  // 0=inf, 1=L1, 2=L2, 3=power

// PCEN（librosa.pcen）— 入力は row-major の [n_bins x n_frames]
auto pcen_out = pcen(mel, n_bins, n_frames, sample_rate, hop_length);

// Tonnetz／Tempogram／PLP
auto tonnetz_out = tonnetz(chromagram, n_chroma, n_frames);
auto tempo_out   = tempogram(onset_env, sample_rate);
auto plp_out     = plp(onset_env, sample_rate);
```

## 型

### Key

```cpp
struct Key {
  PitchClass root;      // C=0, Cs=1, ..., B=11
  Mode mode;            // Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian
  float confidence;     // 0.0 - 1.0

  std::string to_string() const;  // "C major"
  std::string to_short_string() const; // "C", "Am"
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
  PitchClass bass;        // 転回形表記用のベース音

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
  MelodyContour melody;
  std::string form;  // "IABABCO"
};
```

## 列挙型

```cpp
enum class PitchClass {
  C = 0, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
};

enum class Mode {
  Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian
};

enum class ChordQuality {
  Major, Minor, Diminished, Augmented,
  Dominant7, Major7, Minor7, Sus2, Sus4, Unknown,
  Add9, MinorAdd9, Dim7, HalfDim7, Major9, Dominant9, Sus2Add4
};

enum class SectionType {
  Intro, Verse, PreChorus, Chorus, Bridge, Instrumental, Outro, Unknown
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

// フレーム <-> サンプル（librosa.frames_to_samples / samples_to_frames）
int frames_to_samples(int frames, int hop_length = 512, int n_fft = 0);
int samples_to_frames(int samples, int hop_length = 512, int n_fft = 0);

// dB 変換（librosa.power_to_db / amplitude_to_db とその逆）
std::vector<float> power_to_db(const std::vector<float>& values,
                               float ref = 1.0f, float amin = 1e-10f, float top_db = 80.0f);
std::vector<float> amplitude_to_db(const std::vector<float>& values,
                                   float ref = 1.0f, float amin = 1e-5f, float top_db = 80.0f);
std::vector<float> db_to_power(const std::vector<float>& values, float ref = 1.0f);
std::vector<float> db_to_amplitude(const std::vector<float>& values, float ref = 1.0f);
```

## ミキシングエンジン

C++ コアには、C、Python、Node、WASM の各バインディングから使われるミキシングエンジンも含まれます。主な構成要素は、チャンネルストリップ、バス、センド、FX バス、VCA グループ、オートメーションレーン、メータースナップショット、ゴニオメーターバッファ、シーンプリセット、オフラインステレオレンダーです。

```cpp
#include <mixing/channel_strip.h>
#include <mixing/api/presets.h>

auto scene = sonare::mixing::api::scene_preset(
  sonare::mixing::api::scene_preset_from_string("vocalReverbSend")
);
auto json = sonare::mixing::api::scene_to_json(scene);

sonare::mixing::ChannelStrip strip;
strip.set_input_trim_db(3.0f);
strip.set_fader_db(-6.0f);
strip.set_pan(-0.15f);
strip.set_width(1.1f);
strip.prepare(48000.0, 512);
```

ランタイム横断の例とシーン単位の説明は [ミキシングエンジン](./mixing.md) を参照してください。

## マスタリング

高レベルのマスタリング API は `sonare::mastering::api` にあります。`master_audio_mono` / `master_audio_stereo` は組み込みの `Preset`（必要に応じてフラットなドット記法の上書き値付き）を適用し、チェーン結果を返します。`preset_*` ヘルパーはプリセット識別子の列挙と解決を行います。

```cpp
#include <mastering/api/presets.h>

namespace api = sonare::mastering::api;

// 25 個の組み込みプリセット: Pop, EDM, Acoustic, HipHop, AIMusic, Speech, Streaming,
// YouTube, Broadcast, Podcast, Audiobook, Cinema, JPop, Ambient, Lofi, Classical,
// DrumAndBass, Techno, Metal, Trap, RnB, Jazz, KPop, Trance, GameOst。
std::vector<std::string> names = api::preset_names();
api::Preset preset = api::preset_from_string("aiMusic");

// 任意のフラットな上書き値（チェーン設定 params と同じドット記法）
api::Param overrides[] = {{"loudness.targetLufs", -13.0f}};

api::MonoChainResult result = api::master_audio_mono(
  preset, samples.data(), samples.size(), sample_rate, overrides, 1);
// result にはレンダリング後のサンプルと各ステージの指標が含まれます。

// ステレオ版:
// api::master_audio_stereo(preset, left, right, length, sample_rate, overrides, 1);
```

`preset_to_string(Preset)` は正規の識別子を返し（例外を投げず、不正値には `"unknown"`）、`preset_config(Preset)` はチェーン実行前に確認・調整できる可変の `MasteringChainConfig` を返します。名前付きプロセッサのレジストリやアシスタント／プロファイルの JSON ヘルパーは、[マスタリングプロセッサ](./mastering-processors.md) と [マスタリングアシスタント](./mastering-assistant.md) を参照してください。

## C API

FFI 統合向けの C ABI です。`SonareAudio*` を受け取るハンドルベースの入口と、`float*` の生サンプルを受け取るサンプルベースの入口があります。

```c
#include <sonare_c.h>

SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // WASM では利用不可
void        sonare_audio_free(SonareAudio* audio);

SonareError sonare_audio_detect_bpm(const SonareAudio* audio, float* out_bpm);
SonareError sonare_audio_detect_key(const SonareAudio* audio, SonareKey* out_key);
SonareError sonare_audio_analyze(const SonareAudio* audio, SonareAnalysisResult* out);

SonareError sonare_detect_bpm(const float* samples, size_t length, int sample_rate,
                              float* out_bpm);
SonareError sonare_detect_key(const float* samples, size_t length, int sample_rate,
                              SonareKey* out_key);
SonareError sonare_analyze(const float* samples, size_t length, int sample_rate,
                           SonareAnalysisResult* out);

void sonare_free_floats(float* ptr);
void sonare_free_ints(int* ptr);
void sonare_free_result(SonareAnalysisResult* result);
const char* sonare_error_message(SonareError error);
const char* sonare_version(void);
```

`SonareAnalysisResult` は C ABI 用のコンパクトな結果で、BPM、BPM 確信度、キー、
拍子、ビート時刻を保持します。C++ の `AnalysisResult` にあるコード、セクション、
音色、ダイナミクス、リズム、メロディ、form などは、専用の C ABI 関数または
高レベル C++ API から取得します。

エフェクト、特徴量、変換、リサンプリング、librosa 互換ヘルパーにもサンプルベースの入口があります。完全な一覧は `src/sonare_c.h` を参照してください。

現在の C ABI は、用途別のヘッダーに分かれています。上の短い例に出ていないシンボルは、この表から探してください。

| ヘッダー | 公開範囲 |
|----------|---------|
| `sonare_c_types.h` | オーディオハンドル、コンパクト解析、キー候補、ダウンビート、エラー／バージョン／FFmpeg ヘルパー |
| `sonare_c_features.h` | 個別解析、STFT／メル／MFCC／クロマ、逆変換特徴量、CQT/VQT、ピッチ、テンポグラム／PLP、LUFS |
| `sonare_c_effects.h` | HPSS／編集 DSP、リアルタイムボイスチェンジャー、リアルタイムエンジン、分解／リミックスヘルパー |
| `sonare_c_metering.h` | ピーク／RMS／クレストファクター／DC オフセット／トゥルーピーク、クリッピング、ダイナミックレンジ、ステレオ相関／幅、ベクトルスコープ、位相スコープ、スペクトル |
| `sonare_c_mastering.h` | プリセット、フルチェーン、進捗コールバック、名前付きプロセッサ、アシスタント／プロファイル／プレビュー JSON、ストリーミングマスタリングチェーン、ストリーミング EQ、リペア／ダイナミクスの単発ヘルパー |
| `sonare_c_mixing.h` | チャンネルストリップ制御、センド、バス、VCA グループ、オートメーション、メーター、ゴニオメーター、シーンプリセット |
| `sonare_c_streaming.h` | `StreamAnalyzer`、量子化フレーム読み出し、逐次統計、チューニング／正規化制御 |

リアルタイムボイスプリセットは C では `sonare_realtime_voice_changer_preset_names()`、`sonare_realtime_voice_changer_preset_json()`、`sonare_realtime_voice_changer_validate_preset_json()` から扱えます。ネイティブ POD 設定の ABI は `SONARE_VOICE_CHANGER_ABI_VERSION` で、プリセット JSON の `schemaVersion` とは別です。

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
