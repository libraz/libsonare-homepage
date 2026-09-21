---
title: C++ エフェクト API
description: libsonare C++ インターフェースのオーディオエフェクト、ミキシングエンジン、編集ヘルパー、および FFI 統合向けの C ABI。
---

# C++ エフェクト API

libsonare C++ インターフェースのオーディオエフェクト、ミキシングエンジン、編集ヘルパー、FFI 統合向けの C ABI。C++ の他の面については [C++ API リファレンス](./cpp-api.md) を参照してください。

## エフェクト

### HPSS <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
HPSS は STFT の計算とメディアンフィルターによる処理を必要とします。処理時間はオーディオの長さに比例します。
:::

```cpp
HpssConfig config;
config.kernel_size_harmonic = 31;
config.kernel_size_percussive = 31;
config.use_soft_mask = false;  // ハードマスク。既定値は true

StftConfig stft_config;
stft_config.n_fft = 2048;
stft_config.hop_length = 512;

auto result = hpss(audio, config, stft_config);
// result.harmonic
// result.percussive

auto with_residual = hpss_with_residual(audio, config, stft_config);
// with_residual.harmonic / .percussive / .residual

// 便利関数
auto harm = harmonic(audio);
auto perc = percussive(audio);
```

### タイムストレッチ <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
フェーズボコーダーアルゴリズムを使用。処理時間はオーディオの長さに比例します。
:::

```cpp
TimeStretchConfig stretch_config;
stretch_config.n_fft = 2048;
stretch_config.hop_length = 512;

// 0.5 = 半速、2.0 = 倍速
auto slow = time_stretch(audio, 0.5f, stretch_config);
auto fast = time_stretch(audio, 1.5f, stretch_config);
```

### ピッチシフト <Badge type="warning" text="Heavy" />

::: tip パフォーマンス
タイムストレッチとリサンプリングを組み合わせます。処理時間はオーディオの長さに比例します。
:::

```cpp
PitchShiftConfig shift_config;
shift_config.n_fft = 2048;
shift_config.hop_length = 512;

// 半音: +12 = 1オクターブ上
auto higher = pitch_shift(audio, 2.0f, shift_config);
auto lower = pitch_shift(audio, -3.0f, shift_config);
```

### ノーマライズ & オーディオユーティリティ

```cpp
// ピーク正規化
auto normalized = normalize(audio, 0.0f);      // 目標ピークレベル (dB)

// RMS 正規化
auto rms_norm = normalize_rms(audio, -20.0f);  // 目標 RMS レベル (dB)

// 無音トリミング（絶対 dBFS 閾値）
auto trimmed = trim_absolute(audio, -60.0f);   // 閾値 (dBFS)

// フレーム RMS の無音トリミング（#include <effects/silence.h> が必要。<sonare.h> には含まれない）。
// 既定値は frame_length=2048、hop_length=512。
std::vector<float> samples(audio.begin(), audio.end());
auto framed_trim = trim(samples, /*top_db=*/60.0f, /*frame_length=*/2048,
                        /*hop_length=*/512);

// レベル測定 (metering/basic.h, namespace sonare::metering)
float peak = sonare::metering::peak_db(audio);  // ピーク振幅 (dB)
float rms = sonare::metering::rms_db(audio);    // RMS レベル (dB)

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
- **`trim` / `split`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frame` / `pad_center` / `fix_length` / `fix_frames`** — 固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peak_pick` / `vector_normalize`** — 1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`** — クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

これらのヘルパーは個別のヘッダーにあり、`<sonare.h>` には含まれません。
使う関数ごとにヘッダーを include してください。入力は `Audio` ではなく生のサンプル
バッファ（`std::vector<float>` または `const float*` と長さ）です。

```cpp
#include <core/pcen.h>
#include <effects/preemphasis.h>
#include <effects/silence.h>
#include <feature/rhythm.h>
#include <feature/tonnetz.h>
#include <util/frame.h>
#include <util/padding.h>
#include <util/peak.h>
#include <util/vector_normalize.h>

using namespace sonare;

// Pre-emphasis / de-emphasis (librosa.effects.preemphasis / deemphasis)
// Buffer in, buffer out — pass audio samples, not an Audio object.
auto pre   = preemphasis(samples, /*coef=*/0.97f);
auto deemp = deemphasis(samples, /*coef=*/0.97f);

// Silence trim / split (librosa.effects.trim / split) — buffer in, sample-index ranges out
TrimResult trimmed = trim(samples, /*top_db=*/60.0f);  // {audio, start_sample, end_sample}
auto intervals = split(samples, /*top_db=*/60.0f);     // std::vector<std::pair<int,int>>

// Frame / pad / length helpers (librosa.util.*)
auto frames = frame(samples, /*frame_length=*/2048, /*hop_length=*/512);
auto padded = pad_center(values, /*size=*/4096);
auto fixed  = fix_length(values, /*size=*/4096);
auto bounds = fix_frames(frame_indices, /*x_min=*/0, /*x_max=*/-1);

// Peak picking and vector normalize (librosa.util.peak_pick / normalize).
// The C++ name is normalize(); vector_normalize is the header/C-ABI name.
// Overload resolution keeps it distinct from normalize(const Audio&, float).
auto peaks  = peak_pick(onset_envelope, pre_max, post_max, pre_avg, post_avg, delta, wait);
auto normed = normalize(values, NormType::L2);  // Inf, L1, L2, Power

// PCEN (librosa.pcen) — input is row-major [n_bins x n_frames].
// Sample rate and hop length are PcenConfig fields, not positional arguments.
PcenConfig pcen_config;
pcen_config.sr = sample_rate;
pcen_config.hop_length = hop_length;
auto pcen_out = pcen(mel, n_bins, n_frames, pcen_config);

// Tonnetz / tempogram / PLP
auto tonnetz_out = tonnetz(chromagram.data(), n_chroma, n_frames);
auto tempo_out   = tempogram(onset_env, sample_rate);
PlpConfig plp_config;
plp_config.sr = sample_rate;
auto plp_out     = plp(onset_env, plp_config);
```

## C API

FFI 統合向けの C ABI です。`SonareAudio*` を受け取るハンドルベースの入口と、`float*` の生サンプルを受け取るサンプルベースの入口があります。

```c
#include <sonare/sonare_c.h>

// オーディオハンドル
SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // WASM では利用不可
SonareError sonare_audio_file_channel_count(const char* path, int* out_channels);  // WASM では利用不可
void        sonare_audio_free(SonareAudio* audio);
const float* sonare_audio_data(const SonareAudio* audio);
size_t      sonare_audio_length(const SonareAudio* audio);
int         sonare_audio_sample_rate(const SonareAudio* audio);
float       sonare_audio_duration(const SonareAudio* audio);

// ハンドルベースの解析（FFI 境界をまたぐサンプルのコピーを避ける）
SonareError sonare_audio_detect_bpm(const SonareAudio* audio, float* out_bpm);
SonareError sonare_audio_detect_key(const SonareAudio* audio, SonareKey* out_key);
SonareError sonare_audio_detect_beats(const SonareAudio* audio,
                                      float** out_times, size_t* out_count);
SonareError sonare_audio_detect_downbeats(const SonareAudio* audio,
                                          float** out_times, size_t* out_count);
SonareError sonare_audio_detect_onsets(const SonareAudio* audio,
                                       float** out_times, size_t* out_count);
SonareError sonare_audio_analyze(const SonareAudio* audio, SonareAnalysisResult* out);

// サンプルベースの解析（生の float バッファを既に持っている場合に使う）
SonareError sonare_detect_bpm(const float* samples, size_t length, int sample_rate,
                              float* out_bpm);
SonareError sonare_detect_key(const float* samples, size_t length, int sample_rate,
                              SonareKey* out_key);
SonareError sonare_detect_beats(const float* samples, size_t length, int sample_rate,
                                float** out_times, size_t* out_count);
SonareError sonare_detect_downbeats(const float* samples, size_t length, int sample_rate,
                                    float** out_times, size_t* out_count);
SonareError sonare_detect_onsets(const float* samples, size_t length, int sample_rate,
                                 float** out_times, size_t* out_count);
SonareError sonare_analyze(const float* samples, size_t length, int sample_rate,
                           SonareAnalysisResult* out);

// フル解析を camelCase の JSON オブジェクトに直列化（コード、セクション、音色、
// ダイナミクス、リズム、メロディ、form、拍ごとの強度）。*out_json はヒープ確保され、
// sonare_free_string で解放します。
SonareError sonare_analyze_json(const float* samples, size_t length, int sample_rate,
                                char** out_json);
SonareError sonare_analyze_json_with_progress(const float* samples, size_t length, int sample_rate,
                                              SonareAnalyzeProgressCallback callback,
                                              void* user_data, char** out_json);

void sonare_free_floats(float* ptr);
void sonare_free_ints(int* ptr);
void sonare_free_bytes(uint8_t* ptr);
void sonare_free_string(char* ptr);             // *_json など char* を返す C ABI 呼び出しのヒープ文字列
void sonare_free_key_candidates(SonareKeyCandidate* ptr);  // sonare_detect_key_candidates* が返す配列
void sonare_free_result(SonareAnalysisResult* result);
// 各結果構造体には、その構造体名を冠した専用の解放関数があります。
// 例: sonare_free_stft_result / _mel_result / _mfcc_result / _chroma_result /
// _pitch_result / _hpss_result。構造体は必ず対応する関数でのみ解放してください。

// リサンプリングと 12-TET スケールクォンタイザー（どちらも sonare_c.h 自体で宣言）
SonareError sonare_resample(const float* samples, size_t length, int src_sr, int target_sr,
                            float** out, size_t* out_length);   // *out は sonare_free_floats で解放
SonareError sonare_scale_quantize_midi(int root, uint16_t mode_mask, float reference_midi,
                                       float midi, float* out_quantized_midi);
SonareError sonare_scale_correction_semitones(int root, uint16_t mode_mask, float reference_midi,
                                              float midi, float* out_semitones);
SonareError sonare_scale_pitch_class_enabled(int root, uint16_t mode_mask, int pitch_class,
                                             int* out_enabled);

// ユーティリティ
const char* sonare_error_message(SonareError error);
const char* sonare_last_error_message(void);    // 直近の失敗のスレッドローカルな詳細メッセージ
const char* sonare_last_warning_message(void);  // スレッドローカルな非致命的警告（例: どのプロセッサも読まなかったシーンインサートのパラメータ）
const char* sonare_version(void);
uint32_t    sonare_abi_version(void);            // 集約 ABI バージョン。コンパイル時の SONARE_ABI_VERSION と比較し、POD 受け渡し前に構造体レイアウト／契約の不一致を検出します
int         sonare_has_ffmpeg_support(void);     // FFmpeg 専用フォーマット（M4A/AAC/FLAC/OGG）をデコードできるビルドなら 1、そうでなければ 0
```

`SonareError` を返す C ABI 呼び出しはすべて、開始時にスレッドローカルの詳細をクリアし、以前のメッセージが後続結果へ漏れるのを防ぎます。診断アクセサと `void` の後始末ヘルパーは意図的にクリアしないため、部分出力を解放してから `sonare_last_error_message()` を読めます。

`sonare_audio_file_channel_count(path, out_channels)` はデコードせずにファイルのソースチャンネル数を調べます。常にモノラルの `SonareAudio` を作る `sonare_audio_from_file` とは別物です。WASM では利用できません。

`SonareAnalysisResult` は C ABI 用のコンパクトな結果で、BPM、BPM 確信度、キー、
拍子、ビート時刻を保持します。フル解析（コード、セクション、音色、ダイナミクス、
リズム、メロディ、form、拍ごとの強度）が必要なときは `sonare_analyze_json`
（段階ごとの進捗が要るなら `sonare_analyze_json_with_progress`）を呼び出します。
camelCase の JSON 文字列を返し、`sonare_free_string` で解放します。

いくつかのヘルパー群には、サンプルベースの C ABI 入口もあります。

| 系統 | 例 |
|------|----|
| エフェクト | `sonare_hpss`、`sonare_hpss_ex`、`sonare_hpss_with_residual`、`sonare_time_stretch_ex`、`sonare_phase_vocoder`、`sonare_pitch_shift_ex`、`sonare_spectral_edit`、`sonare_normalize`、`sonare_normalize_rms`、`sonare_trim_ex` |
| 特徴量 | `sonare_stft`、`sonare_mel_spectrogram`、`sonare_mfcc`、`sonare_mfcc_ex`、`sonare_chroma`、`sonare_chroma_cqt`、`sonare_nnls_chroma_ex2`、`sonare_spectral_*`、`sonare_pitch_yin`、`sonare_pitch_pyin` |
| ルーム音響 | `sonare_analyze_impulse_response_ex`、`sonare_synthesize_rir`、`sonare_estimate_room`、`sonare_room_morph` |
| 変換とリサンプリング | `sonare_resample`。関数一覧は `include/sonare/sonare_c.h` を参照 |

特徴量では、ノート活性の `sonare_chroma` に加えて、定 Q クロマグラム（`librosa.feature.chroma_cqt` 相当）の `sonare_chroma_cqt` があります。明示レンジ版の MFCC 入口 `sonare_mfcc_ex`（fmin/fmax/htk）は、末尾にケプストラルリフタリング引数 `lifter` を持ちます（`0` で無効）。

拡張 C ABI のエフェクト関数はバインディングと同じ FFT 設定を公開します。
`sonare_hpss_ex` は `n_fft`、`hop_length`、`use_soft_mask`、残差出力フラグを受け取り、
`sonare_time_stretch_ex` と `sonare_pitch_shift_ex` は `n_fft` と `hop_length` を受け取ります。
`sonare_trim_ex` は `frame_length` と `hop_length`、`sonare_analyze_impulse_response_ex` は
`min_decay_db`、`sonare_nnls_chroma_ex2` は NNLS オプションの CQT `hop_length` を追加します。

プロジェクト編集は `sonare_c_project.h` にあります。`sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` の最後の引数が任意の equal-power 継ぎ目クロスフェードです。有限で 0 以上である必要があり、`0` ならハードループのままです。エンジンは使用可能なプリロールとループ長の半分を上限にクランプし、ワープ時は無視します。

`sonare_project_bounce_with_synth_instruments` と `sonare_engine_set_synth_instrument` が受け取る NativeSynth のパッチ `SonareSynthPatch` は、先頭の `struct_version` フィールドでバージョン管理されています。元のレイアウトでは数値フィールドはすべて「0 はベースプリセットの値を保つ」という規則に従うため、明示的なゼロを表現できませんでした。`struct_version = 2` は、呼び出し側が意図して設定したフィールドを示すビットマスク `present_fields`（`SONARE_SYNTH_FIELD_*`）を末尾に追加します。ビットが立っていれば、その値がゼロであってもベースを上書きし、立っていなければ従来の挙動のままです。この末尾のワードは `struct_version` が 2 以上のときだけ読まれます。したがって、これまで通りに構造体を埋める呼び出し側は、`struct_version` を `0` や `1` のままにしていても従来の挙動を保ち、ソースを変更する必要はありません。enum フィールドに存在ビットがないのは意図的です。ゼロがすでに「ベースを保つ」の予約値で、実際の値はすべて非ゼロだからです。`num_mod_routings == 0` の状態で `SONARE_SYNTH_FIELD_MOD_ROUTINGS` を立てると、ベースのモッドマトリクスを保つのではなく消去します。要素のあるテーブルはどちらの場合でも置き換えです。マスクは 32 ビット 1 ワードで、うち 27 ビットを使用しています。さらに拡張する場合は、このワードを広げるのではなく、新しい `struct_version` のもとで 2 ワード目を追加します。

librosa 互換ヘルパーも C API から使えます。

| 分類 | ヘルパー |
|------|----------|
| プリエンファシスと無音処理 | `sonare_preemphasis`、`sonare_deemphasis`、`sonare_trim_silence`、`sonare_split_silence` |
| フレーム分割とパディング | `sonare_frame_signal`、`sonare_pad_center`、`sonare_fix_length`、`sonare_fix_frames` |
| ピーク検出と正規化 | `sonare_peak_pick`、`sonare_vector_normalize` |
| 特徴量ユーティリティ | `sonare_pcen`、`sonare_tonnetz`、`sonare_tempogram`、`sonare_plp` |
| dB 変換 | `sonare_power_to_db`、`sonare_amplitude_to_db`、`sonare_db_to_power`、`sonare_db_to_amplitude` |
| 時間／フレーム変換 | `sonare_frames_to_samples`、`sonare_samples_to_frames` |
| 分解／ノイズ除去 | `sonare_decompose`、`sonare_decompose_with_init`（init は `"random"`／`"nndsvd"`）、`sonare_nn_filter` |

現在の C ABI は、用途別のヘッダーに分かれています。上の短い例に出ていないシンボルは、この表から探してください。

| ヘッダー | 公開範囲 |
|----------|---------|
| `sonare_c.h` | アンブレラヘッダー。他の公開ヘッダーをすべて推移的に取り込みます（エンジンとボイスチェンジャーは `sonare_c_effects.h` 経由）。加えて集約 ABI バージョン `SONARE_ABI_VERSION` / `sonare_abi_version()`、`sonare_resample`、12-TET スケールクォンタイザー、各結果構造体の解放関数をこのヘッダー自身で宣言します |
| `sonare_c_types.h` | オーディオハンドル、コンパクト解析、キー候補、ダウンビート、エンジンのレーン／バス／センド構造体（`SonareEngineTrackLane`、`SonareEngineBus`、`SonareEngineTrackSend`）と `SonareChannelLayout` 列挙、エラー／バージョン／FFmpeg ヘルパー |
| `sonare_c_project.h` | ヘッドレスのプロジェクト／アレンジメントのライフサイクル、トラック／クリップ件数と編集（`sonare_project_clip_count`）、MIDI イベントと MIDI-FX（`sonare_project_set_midi_events`、`set_midi_fx`、`bake_midi_fx`）、コンパイル／バウンス（`bounce_with_builtin_instruments`／`bounce_with_synth_instruments` を含む）、ワープマップ、ループ録音のテイクとコンプ区間、NativeSynth と SoundFont/SF2 楽器バインディング、アシストサイドカー、コード／キー注釈、`SONARE_PROJECT_ABI_VERSION` |
| `sonare_c_features.h` | 個別解析、STFT／メル／MFCC／クロマ、逆変換特徴量、CQT/VQT、ピッチ、テンポグラム／PLP、LUFS |
| `sonare_c_effects.h` | HPSS／編集 DSP、領域ベースのスペクトル編集（`sonare_spectral_edit`、モード GAIN/ATTENUATE/MUTE/HEAL）、分解／リミックスヘルパー |
| `sonare_c_engine.h` | `RealtimeEngine` の C ABI: トランスポート（再生／停止／シーク／ループ／テンポ／拍子）、ライブパラメータとオートメーションレーン制御、MIDI push/drain（CC、パニック、SysEx、外部 MIDI のデスティネーション）、キャプチャ、テレメトリ（`SonareEngineTelemetry`、メーターテレメトリの drain、`SonareEngineTelemetryError`） |
| `sonare_c_voice_changer.h` | リアルタイムボイスチェンジャー: 生成／破棄、設定（POD と JSON、ライブ安全なハンドオフ）、ブロック単位の処理（mono／interleaved／planar-stereo）、組み込みプリセット参照、レイテンシ |
| `sonare_c_acoustic.h` | ルーム形状からの RIR 合成、等価ルーム推定、オフラインのルームモーフィング、`SONARE_ACOUSTIC_ABI_VERSION` |
| `sonare_c_metering.h` | ピーク／RMS／クレストファクター／DC オフセット／True Peak（両チャンネルから測る `sonare_metering_crest_factor_db_stereo` を含む）、クリッピング、ダイナミックレンジ、ステレオ相関／幅、ベクトルスコープ、位相スコープ、スペクトル、マルチチャンネルのインターリーブ LUFS（`sonare_lufs_interleaved`）と EBU R128 ラウドネスレンジ（`sonare_ebur128_loudness_range`） |
| `sonare_c_mastering.h` | プリセット、フルチェーン、進捗コールバック、名前付きプロセッサと機械可読なプロセッサカタログ、アシスタント／プロファイル／プレビュー JSON とその `*_stereo` 入口、レイテンシと実現ステージを検査できるストリーミングマスタリングチェーン（`sonare_streaming_mastering_chain_stage_names`）、ストリーミング EQ、リペア／ダイナミクスの単発ヘルパー |
| `sonare_c_mixing.h` | チャンネルストリップ制御、センド、バス、VCA グループ、オートメーション、メーター、ゴニオメーター、シーンプリセット |
| `sonare_c_streaming.h` | `StreamAnalyzer`、上限付き未読出力（`max_pending_frames`）、量子化フレーム読み出し、滞留／破棄を含む更新統計、チューニング／正規化制御 |

C ABI のルーム音響では、次の設定を公開します。

- `SonareRirSynthConfig`: 形状、吸音率、`ism_order`、`seed`、`max_seconds`、`mixing_time_ms`、`crossfade_ms`、`late_model`。
- `SonareRoomEstimateConfig`: アスペクト比と吸音率の事前条件、`min_decay_db`、`noise_floor_margin_db`、解析 `mode`。
- 解析 `mode`: `SONARE_ACOUSTIC_MODE_AUTO`、`SONARE_ACOUSTIC_MODE_BLIND`、`SONARE_ACOUSTIC_MODE_IMPULSE_RESPONSE`。

C ABI でのサラウンド／マルチチャンネルのエンジンバスでは、次を扱えます。

- `SonareChannelLayout` はスピーカーベッドを列挙します。`SONARE_CHANNEL_LAYOUT_MONO`（0）、`SONARE_CHANNEL_LAYOUT_STEREO`（1）、`SONARE_CHANNEL_LAYOUT_5_1`（2）、`SONARE_CHANNEL_LAYOUT_7_1`（3）。値は `sonare::ChannelLayout` と一致し、ABI／JSON のワイヤフォーマットの一部です。
- `SonareEngineBus.channel_layout` はバスのスピーカーベッドを設定します（マスターバスはプロジェクト出力レイアウトを担い、既定はステレオ）。`SonareEngineTrackLane.source_channel_layout` はソースのメタデータとしてシリアライズされますが、マルチチャンネルのレーン入力をディスクリートのまま扱う指定にはまだなりません。
- リアルタイムのレーンミキサーは、ストリップの `surroundPan` 位置から各モノラル／ステレオレーンを 5.1/7.1 の宛先へパンし、バスをプレーンごとに合算してプレーン別（ワイド）メーターを公開します。`azimuth`、`divergence`、`lfe` は配置に反映され、`elevation` と `distance` は予約です。[リアルタイムエンジンのサラウンドグループバス](./realtime-engine.md#サラウンドグループバスとワイドメーター)を参照してください。

C ABI のリアルタイム・インサートオートメーションと外部 MIDI では、次を扱えます。

- トラック、マスター、バスの各ストリップには、インサートのバイパスとリアルタイム安全なパラメータを変更する関数があります。パラメータ名には `sonare_mastering_insert_param_info` が返す JSON キーを使います。未対応またはリアルタイム安全でない名前には `SONARE_ERROR_INVALID_PARAMETER` が返ります。
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` は、インサートのパラメータ名を `sonare_engine_set_automation_lane`、`sonare_engine_set_parameter`、`sonare_engine_set_parameter_smoothed` が受け取る数値 id に変換します。共通のランプ時間は `sonare_engine_set_param_smoothing_ms` で変更でき、既定は 20 ms、`0` は即時変更です。
- `sonare_engine_push_midi_sysex` には、先頭の `0xF0` と末尾の `0xF7` を含む完全な SysEx フレームを渡します。長さは 1〜512 バイトです。
- `sonare_engine_set_midi_destination_external` を使うと、その送出先（デスティネーション）は内蔵インストゥルメントラックを通らず、ホストが回収する出力キューへ送られます。外部化できるデスティネーションは最大 16 個です。クロック／トランスポート転送は `sonare_engine_set_external_midi_clock_enabled` で明示的に有効化し、そのメッセージのデスティネーション id は `0xFFFFFFFF` です。
- ホスト／制御スレッドでは `sonare_engine_drain_external_midi` をイベント数が 0 になるまで繰り返し呼び、得られた 1〜3 バイトの MIDI 1.0 メッセージを機器へ渡します。1 個の UMP（Universal MIDI Packet）レコードが 3 メッセージへ展開される場合があるため、`max_events` は 3 以上必要です。ホストの回収が遅すぎないかは `sonare_engine_external_midi_dropped_count` で監視できます。SysEx／Data など MIDI 1.0 へ変換できない UMP メッセージは、この drain API からは出力されません。
- drain した各 `SonareEngineTelemetry` レコードの `error` フィールドは `SonareEngineTelemetryError`（`sonare_c_types_engine.h`）の序数です。`NONE = 0` に続き、キュー／バックログ／オーバーフロー系の条件が `1`〜`18`（コマンドキュー、保留コマンド、境界、テレメトリ、キャプチャ、オートメーションバインドターゲット、インサートオートメーション、MIDI クロック、メトロノームのオーバーフローなど）、そして `MAX_CHANNELS_EXCEEDED = 20` と続きます。

C ABI でプロセッサを分類するには、`sonare_mastering_processor_catalog()` が JSON 配列の文字列 `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","realtimeCost","channelPolicy","category","params"}, ...]` を返します。`kind` は `realtime`／`offline`／`pair` で、`realtimeInsertable` は `sonare_mastering_insert_names()` の id に対してのみ真になります。`latencySamples` と `tailSamples` は代表的な既定構成（48 kHz／512 サンプル）での測定値です。`tailSamples` は可聴な減衰テールの長さを表し、どちらもオフライン id では 0 です。`realtimeCost` はライブインサート向けの大まかな `low`／`moderate`／`high` のアルゴリズム負荷見積もりであり、ハードウェア上のベンチマークではなく、非インサート id では `null` です。`channelPolicy` はサラウンドホストでミキサーがプロセッサをどうラップするか、`category` は id 名前空間から導出する安定した UI グループ、`params` はリアルタイムインサートのパラメータ記述子を示します（非インサートプロセッサでは空配列）。id の全集合は `sonare_mastering_processor_names()`、インサート集合、`sonare_mastering_pair_processor_names()` の和なので、ホストは id をハードコードせずにプロセッサ選択を絞り込めます。ポインタはスレッドローカルで（解放せず、スレッドをまたいでキャッシュしないでください）、`sonare_mastering_processor_names()` と同様の扱いです。

リアルタイムボイスプリセットは C では `sonare_realtime_voice_changer_preset_names()`、`sonare_realtime_voice_changer_preset_json()`、`sonare_realtime_voice_changer_validate_preset_json()` から扱えます。型付きのプリセット選択子は `SonareVoiceCharacterPreset` 列挙です（`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 から `SONARE_VC_PRESET_DARK_VILLAIN` = 5）。`sonare_voice_character_preset_id(preset)` は正規の id 文字列を返し（不明値には NULL）、`SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` マクロはコンパイル時のバインディング生成向けに改行区切りの id 一覧を提供します。ネイティブ POD 設定の ABI は `SONARE_VOICE_CHANGER_ABI_VERSION` で、プリセット JSON の `schemaVersion` とは別です。

## ミキシングエンジン

C++ コアには、C、Python、Node、WASM の各バインディングから使われるミキシングエンジンも含まれます。

主な構成要素は、チャンネルストリップ、バス、センド、FX バス、VCA グループです。さらに、オートメーションレーン、メータースナップショット、ゴニオメーターバッファ、シーンプリセット、オフラインステレオレンダーも扱えます。

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

