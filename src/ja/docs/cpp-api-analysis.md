---
title: C++ 解析 API
description: libsonare C++ インターフェースの特徴抽出、ピッチ追跡、CQT/VQT、および解析結果の型。
---

# C++ 解析 API

libsonare C++ インターフェースの特徴抽出関数と解析結果の型。C++ API のその他の部分については [C++ API リファレンス](./cpp-api.md) を参照してください。

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

## C ABI の解析関数の追加分

`sonare_c_features.h`、`sonare_c_types_functions.h`、`sonare_c.h` で宣言されています。前提となる構造体のバージョンと既定値は [C ABI のバージョン](./cpp-api.md#c-abi-のバージョン) にあります。

| 関数 | 用途 |
|------|------|
| `sonare_detect_key_with_tuning(...)` | 録音の `tuning`（半音の端数、`[-0.5, 0.5)`）を指定するか、`tuning_auto` で測定させるキー検出。`out_tuning` に使われた値が入ります |
| `sonare_chord_functions(chords, count, key_root, key_mode, &roman, &functions)` | 既に手元にあるコードのローマ数字と和声機能を、`count` 個ずつの `SonareStringArray` 2 つで返します。解放は `sonare_free_string_array`。音声は解析しません |
| `sonare_chord_symbol_from_analysis(...)`、`sonare_key_mode_from_analysis(mode, &out_mode)` | 検出したコードやキーを、ライブラリ自身の変換表を通してアレンジ注釈（`SonareProjectChordSymbol`、`SonareProjectKeySegment`）のフィールドへ変換します。宣言は `sonare_c_project_annotate.h` |
| `sonare_tuning_to_reference_hz`, `sonare_reference_hz_to_tuning` | 解析のチューニング単位と Hz の基準音の間の変換 |
| `sonare_scale_mask_for_mode(root, mode, &mask)` | `SonareMode` の 12 ビットのスケールマスク。`sonare_scale_quantize_midi` と `SonarePitchCorrectionConfig` が読むレイアウト |
| `sonare_mfcc_to_mel_checked_ex(mfcc, input_length, n_mfcc, n_frames, n_mels, lifter, &out)` | 長さを検査し、リフターを考慮する MFCC から Mel への逆変換。`lifter` は順変換で使った値（`0` は未適用） |
| `sonare_mfcc_to_audio_checked_ex2(...)` | 長さを検査し、`htk` と `lifter` を扱う MFCC から音声への逆変換 |

`SonareMelResult` と `SonareMfccResult` は順変換のパラメータ（`n_fft`、適用された `fmin`／`fmax`、`htk`、`is_db`。MFCC はさらに `sample_rate`、`hop_length`、`n_mels`、`lifter`）を持つので、結果だけで逆変換できます。`sonare_analyze_json_ex` は、`tuning` と `tuning_auto` でチューニングを選ぶ `SonareMusicAnalyzeOptions` を受け取り、その JSON は使われた値を `tuning` で報告します。

## 構造境界

`BoundaryDetector` は、MFCC とクロマの特徴量に対するチェッカーボードカーネルのノヴェルティ曲線から、セクションの転換点を見つけます。`BoundaryConfig` は検出器のパラメータを公開し、2 つのしきい値は役割が違います。

```cpp
BoundaryConfig config;
config.threshold = 0.3f;            // 相対: 局所ノヴェルティ最大値に対する割合
config.absolute_threshold = 0.005f; // 生の応答に対する下限: そもそも変化があったか
config.reference_window = 60.0f;    // 相対しきい値を測る片側の秒数

BoundaryDetector detector(audio, config);
for (const Boundary& b : detector.boundaries()) {
  // b.time（秒）、b.strength（曲全体の最大値で正規化したノヴェルティ）
}
```

`threshold` は、ピークから `reference_window` 秒以内で最大の生ノヴェルティイベントに対して測られ、孤立した支配的イベント（`reference_window` 内の他のどのイベントも 30% 以内に達しないもの）は除かれます。そのため、窓より遠くにある支配的な変化が、より弱い変化を締め出すことはありません。`0` は各フレームを自分自身の基準にして `threshold` を無効にし、曲の長さ以上の値は基準を曲全体にします（孤立した支配的イベントを除く点は同じです）。基準が局所的なため、`Boundary::strength`（曲全体の最大値で正規化した曲内の順位）は `threshold` を下回ることがあります。

C ABI は `sonare_detect_boundaries(samples, length, sample_rate, &options, &out)` で、`SonareBoundaryOptions` は必ず `sonare_boundary_options_default()` から始めます。ゼロ埋めにすると `absolute_threshold` が 0 になり、定常な入力でも区間が切られてしまいます。結果は `sonare_free_boundary_result` で解放します。

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

// 生の序数からキー名を綴る。to_string / to_short_string と同じ（root が 0〜11 でなければ ""）
std::string key_name(int root, bool minor, bool short_form);
```

`KeyConfig::tuning`、`ChordConfig::tuning`、`MusicAnalyzerConfig::tuning` は、録音の A440 からのずれを半音の端数（`[-0.5, 0.5)`）で表します。3 つのいずれでも `auto_tuning = true` にすると、値を読む代わりに音声から測定します（`feature/pitch.h` の `measure_tuning(audio)`）。使われた値は `KeyAnalyzer::tuning()`、`ChordAnalyzer::tuning()`、`MusicAnalyzer::tuning()` が報告し、`AnalysisResult::tuning` にも入ります。`feature/chroma.h` の `tuning_to_reference_hz(tuning, a4 = 440)` と `reference_hz_to_tuning(hz, a4 = 440)` は、基準音を表す Hz との間で変換します。

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

// 生のルート／クオリティの序数からコードを綴る（コードなしは "N.C."。例外は送出しない）
std::string chord_symbol(int root, int quality);
```

`ChordAnalyzer::chord_to_roman_numeral(chord, key_root, mode)` はキー内でのコードのローマ数字を返し（未知のコードは `"N.C."`）、`ChordAnalyzer::chord_function(chord, key_root, mode)` はその和声機能を返します。`"tonic"`、`"subdominant"`、`"dominant"`、キーのスケール外のルートなら `"chromatic"`、未知のコードなら `"none"` です。マイナー以外のモードはすべてメジャースケールとして読まれます。どちらも static で、音声は解析しません。

### Section

```cpp
struct Section {
  SectionType type;    // Intro, Verse, Chorus 等
  float start;
  float end;
  float energy_level;  // フレーム RMS の中央値を、最も大きいセクションで正規化
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
  float tuning;      // クロマグラムの生成に使った半音の端数（指定値または測定値）
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

