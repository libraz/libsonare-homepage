---
title: C++ 解析 API
description: libsonare C++ インターフェースの特徴抽出、ピッチ追跡、CQT/VQT、および解析結果の型。
---

# C++ 解析 API

libsonare C++ インターフェースの特徴抽出関数と解析結果の型。C++ の他の面については [C++ API リファレンス](./cpp-api.md) を参照してください。

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
std::vector<float> spectral_rolloff(const Spectrogram& spec, int sr, float roll_percent = 0.85f);

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
config.threshold = 0.1f;

// YIN アルゴリズム
PitchResult yin = yin_track(audio, config);

// pYIN アルゴリズム（確率的 YIN + HMM 平滑化）
PitchResult pyin_result = pyin(audio, config);

// 結果へのアクセス
float median = pyin_result.median_f0();
float mean = pyin_result.mean_f0();
const std::vector<float>& f0 = pyin_result.f0;
const std::vector<bool>& voiced = pyin_result.voiced_flag;
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

::: tip Griffin-Lim
Griffin-Lim は、位相を持たない振幅のみのスペクトルから、時間領域と周波数領域の変換を交互に繰り返して位相を反復推定し、それらしい波形を再構成するアルゴリズムです。位相ボコーダは、これに対して STFT の位相そのものを追跡・操作します。
:::

::: danger 非推奨関数
逆変換関数 `icqt()` および `ivqt()` は、現行 C++ ヘッダー上で**非推奨**です。
新しいコードでは Griffin-Lim または位相ボコーダ系の再構成経路を優先してください。

```cpp
// 非推奨 - 新しいコードでは使用しないでください
[[deprecated("Use Griffin-Lim or phase vocoder for better reconstruction quality")]]
Audio icqt(const CqtResult& cqt_result, int length = 0);

[[deprecated("Use griffinlim_vqt or phase vocoder for better reconstruction quality")]]
Audio ivqt(const VqtResult& vqt_result, int length = 0);
```

**移行方法:** `griffinlim_cqt` と `griffinlim_vqt` は、`cqt()` / `vqt()` と同じ
`<feature/cqt.h>` / `<feature/vqt.h>` ヘッダーで宣言されているため、追加のインクルードは不要です。
プレビュー音声の再構成にはこれらの Griffin-Lim 経路を使い、品質が重要な場合は独自の STFT ドメイン処理で位相情報を保持してください。

```cpp
const auto& cqt_magnitude = cqt_result.magnitude();
auto reconstructed = griffinlim_cqt(cqt_magnitude.data(), cqt_result.n_bins(),
                                    cqt_result.n_frames(), config,
                                    cqt_result.sample_rate());
auto reconstructed_vqt = griffinlim_vqt(vqt_result, vqt_result.sample_rate());
```
:::

### NNLS クロマ

NNLS クロマは CQT の hop 長を設定できます。既定値は `512` サンプルです。
別のフレームグリッドに合わせる場合は `NnlsChromaConfig::cqt` に指定します。

```cpp
NnlsChromaConfig nnls_config;
nnls_config.cqt.hop_length = 512;
nnls_config.enable_stft_blend = true;
auto nnls_result = nnls_chroma(audio, nnls_config);
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

### Section

```cpp
struct Section {
  SectionType type;    // Intro, Verse, Chorus 等
  float start;
  float end;
  float energy_level;
  float confidence;

  std::string type_string() const;
  float duration() const;
};
```

### AnalysisResult

```cpp
struct AnalysisResult {
  float bpm;
  float bpm_confidence;
  std::vector<BpmCandidateHypothesis> bpm_candidates;
  Key key;
  TimeSignature time_signature;
  std::vector<TimeSignature> time_signature_candidates;
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

知覚的なサブ構造体を以下に展開します。`RhythmFeatures` と `MelodyContour` も同じく値で埋め込まれます。

### Timbre

音色の知覚的な指標です。いずれも `[0, 1]` に正規化されています。

```cpp
struct Timbre {
  float brightness;  // 大きいほど明るい／硬い
  float warmth;      // 大きいほど温かい／太い
  float density;     // 大きいほど密度が高い／複雑
  float roughness;   // 大きいほど粗い／ざらつく
  float complexity;  // 大きいほど倍音構成が複雑
};
```

### Dynamics

ラウドネスとダイナミックレンジの指標です（レベルは dB）。

```cpp
struct Dynamics {
  float dynamic_range_db;   // ダイナミックレンジ (dB)
  float peak_db;            // ピークレベル (dB)
  float rms_db;             // RMS レベル (dB)
  float crest_factor;       // ピーク対 RMS 比
  float loudness_range_db;  // ラウドネスレンジ / LRA (dB)
  bool  is_compressed;      // 強く圧縮されていると思われる場合 true
};
```

