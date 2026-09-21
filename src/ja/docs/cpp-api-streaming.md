---
title: C++ ストリーミング API
description: libsonare C++ インターフェースの StreamAnalyzer によるリアルタイム・ブロック単位のオーディオ解析。
---

# C++ ストリーミング API

libsonare C++ インターフェースのリアルタイムストリーミング解析。C++ の他の面については [C++ API リファレンス](./cpp-api.md) を参照してください。

## StreamAnalyzer <Badge type="tip" text="リアルタイム" />

ビジュアライゼーションとライブモニタリング用のリアルタイムストリーミング音声アナライザー。

::: info バッチ vs ストリーミング
録音済みファイルの総合解析には `MusicAnalyzer` を使います。低レイテンシのリアルタイム処理には `StreamAnalyzer` を使います。
:::

ランタイム横断の例や境界ウィンドウでのクリップストリーミングは [リアルタイムストリーミング](./realtime-streaming.md) を参照してください。

フレームはオーディオコールバックから内部の上限付きキューに入り、転送コストに合わせた表現で読み出します。3 つの読み出しメソッドは同じキューを消費するので、消費側ごとに 1 つを選びます。

<FlowDiagram
  title="StreamAnalyzer の読み出し経路"
  :nodes="[
    { id: 'callback', label: 'オーディオコールバックスレッド', col: 0, row: 1, variant: 'accent' },
    { id: 'process', label: 'analyzer.process()', col: 1, row: 1, variant: 'accent' },
    { id: 'queue', label: '上限付きフレームキュー', col: 2, row: 1 },
    { id: 'aos', label: 'read_frames() — AoS の StreamFrame', col: 3, row: 0, group: 'read' },
    { id: 'soa', label: 'read_frames_soa() — SoA の FrameBuffer', col: 3, row: 1, group: 'read' },
    { id: 'quant', label: 'read_frames_quantized_u8 / _i16', col: 3, row: 2, variant: 'muted', group: 'read' },
    { id: 'consumer', label: '消費側 / Worker / UI スレッド', col: 4, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'callback', to: 'process' },
    { from: 'process', to: 'queue', label: 'available_frames()' },
    { from: 'queue', to: 'aos', label: 'フル float' },
    { from: 'queue', to: 'soa', label: 'フル float・連続配置' },
    { from: 'queue', to: 'quant', label: '任意の 8/16bit', style: 'dashed' },
    { from: 'aos', to: 'consumer', label: 'フレーム単位の構造体' },
    { from: 'soa', to: 'consumer', label: 'キャッシュ効率よく安価に受け渡し' },
    { from: 'quant', to: 'consumer', label: '帯域幅 1/4 ・ 1/2' }
  ]"
  :groups="[
    { id: 'read', label: '読み出し形式（消費側ごとに 1 つ選ぶ）' }
  ]"
  caption="フル float の読み出しは精度をすべて保ちます。SoA は同じ float を連続配置して安価に転送でき、任意の 8/16bit 量子化読み出しは精度と引き換えにバッファを 1/4・1/2 に縮め、Worker や UI スレッドへ渡すのに向きます。"
/>

### 設定

```cpp
struct StreamConfig {
  int sample_rate = 44100;
  int n_fft = 2048;
  int hop_length = 512;
  WindowType window = WindowType::Hann;

  // 特徴フラグ
  bool compute_magnitude = false;
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
  OutputFormat output_format = OutputFormat::Float32; // レガシー。Float32 のままにする
  int emit_every_n_frames = 1;   // 4 = 44100Hz で約 60fps
  int magnitude_downsample = 1;  // マグニチュードのダウンサンプル係数
  size_t max_pending_frames = 4096; // 未読上限。超過時は新たに生成したフレームを破棄
  size_t max_progression_entries = 4096; // 進行データの保持上限。超過時は最も古いエントリを破棄

  // 推定を更新する間隔
  float key_update_interval_sec = 5.0f;
  float bpm_update_interval_sec = 10.0f;
};
```

`output_format` はソース互換性のために残っており、`OutputFormat::Float32` のままにする必要があります。`Int16` または `Uint8` のペイロードが必要な場合は、アナライザ設定を変えるのではなく、後述の明示的な量子化読み出しメソッドを使います。

`analyzer.stats()` は既存の総数・進行中推定に加え、`pending_frames` と累積 `dropped_output_frames` を返します。これにより、ネイティブホストは正常に上限管理されているキューと、読み出し側が繰り返し遅れている状態を区別できます。

### 基本的な使い方

```cpp
#include <streaming/stream_analyzer.h>

using namespace sonare;

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

### StreamFrame

`read_frames()` は読み出したフレームを内部キューから消費し、フレーム単位の構造体として返します。デバッグやネイティブ UI への直接描画には扱いやすい形式です。

```cpp
struct StreamFrame {
  float timestamp;          // ストリーム時間（秒）
  int frame_index;          // 累積フレーム番号

  std::vector<float> magnitude;  // [n_bins] またはダウンサンプル後
  std::vector<float> mel;        // [n_mels]
  std::vector<float> chroma;     // 有効時は [12]、無効時は空

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
// buffer.n_chroma / buffer.feature_flags - ストライドと MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
// buffer.chroma - [n_frames * n_chroma]。CHROMA が無効なら空
// buffer.onset_strength - [n_frames]
// buffer.rms_energy - [n_frames]
// buffer.spectral_centroid - [n_frames]
// buffer.spectral_flatness - [n_frames]
// buffer.chord_root / chord_quality / chord_confidence - [n_frames]
```

::: details レイアウト用語: Structure-of-Arrays・row-major・量子化
- **Structure-of-Arrays**（SoA） — フレームごとの構造体の配列ではなく、各フィールドを独立した連続配列（`timestamps`、`mel`、`chroma`…）に持ちます。キャッシュ効率・SIMD 効率がよく、別スレッドへの受け渡しも安価です。
- **row-major**（行優先） — `mel`（`[n_frames * n_mels]`）のような 2 次元データを、1 行ずつ連続して格納します。フレーム 0 のメル全ビン、次にフレーム 1…という順です。要素 `(f, m)` は `f * n_mels + m` で参照します。
- **量子化**（後述） — 各 32bit float を固定の min/max 範囲で 8bit / 16bit 整数に詰め、精度と引き換えにバッファを約 1/4・1/2 に縮めます。UI スレッドへフレームを渡すのに向いています。
:::

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
  size_t pending_frames;                        // 現在保持されている未読出力フレーム数
  size_t dropped_output_frames;                 // pending-frame 上限で破棄された出力フレーム数
  size_t dropped_chord_progression_entries;     // 履歴上限で破棄されたコード進行エントリ数
  size_t dropped_bar_progression_entries;       // 履歴上限で破棄された小節コード進行エントリ数
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

### 更新される推定

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

### 外部同期

外部タイムラインに正確に同期させるには:

```cpp
// 累積サンプルオフセットは呼び出し側で管理する
size_t sample_offset = 0;

void audio_callback(const float* samples, size_t n_samples) {
  analyzer.process(samples, n_samples, sample_offset);
  sample_offset += n_samples;
}
```

### リセット

```cpp
// 新しいストリームのためにリセット
analyzer.reset();

// 基準オフセットを指定してリセット
analyzer.reset(initial_sample_offset);
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

// サンプルレートを取得
int sr = analyzer.config().sample_rate;
```

