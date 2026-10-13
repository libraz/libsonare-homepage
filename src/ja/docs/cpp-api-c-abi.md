---
title: C ABI リファレンス
description: FFI 統合向けの libsonare C ABI。ハンドル、解析、エフェクト、ヘッダー索引、エンジン、マスタリング、ミキシングの入口。
---

# C ABI リファレンス

C ABI は、各言語バインディングとプラグインホストが土台にする安定した境界です。C++ の入口は [C++ API リファレンス](./cpp-api.md)、構造体のバージョン管理は [C ABI のバージョン](./cpp-api.md#c-abi-のバージョン) を参照してください。ルーム音響の呼び出しは[幾何ベースのルーム音響](./cpp-api-effects.md#幾何ベースのルーム音響)にまとめています。

## ハンドル、解析、ユーティリティ

FFI 統合向けの C ABI です。`SonareAudio*` を受け取るハンドルベースの入口と、`float*` の生サンプルを受け取るサンプルベースの入口があります。

```c
#include <sonare/sonare_c.h>

// オーディオハンドル
SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // WASM では利用不可
SonareError sonare_audio_file_channel_count(const char* path, int* out_channels);  // WASM では利用不可
SonareError sonare_audio_from_file_channel(const char* path, int channel_index,
                                           SonareAudio** out);  // ソースの 1 チャンネルだけ、ダウンミックスなし。WASM では利用不可
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
SonareError sonare_last_error_code(void);       // 直近のメッセージと対で記録されるコード。ハンドルを返す呼び出しが NULL を返した理由
const char* sonare_last_warning_message(void);  // スレッドローカルな非致命的警告（例: どのプロセッサも読まなかったシーンインサートのパラメータ）
const char* sonare_version(void);
uint32_t    sonare_abi_version(void);            // 集約 ABI バージョン。コンパイル時の SONARE_ABI_VERSION と比較し、POD 受け渡し前に構造体レイアウト／契約の不一致を検出します
uint32_t    sonare_engine_abi_version(void);     // リアルタイムのコマンドキューの ABI。sonare_abi_version() には含まれない
int         sonare_has_ffmpeg_support(void);     // FFmpeg 専用フォーマット（M4A/AAC/FLAC/OGG）をデコードできるビルドなら 1、そうでなければ 0
```

`SonareError` を返す C ABI 呼び出しはすべて、開始時にスレッドローカルの詳細をクリアし、以前のメッセージが後続結果へ漏れるのを防ぎます。診断アクセサと `void` の後始末ヘルパーは意図的にクリアしないため、部分出力を解放してから `sonare_last_error_message()` を読めます。

`sonare_audio_file_channel_count(path, out_channels)` はデコードせずにファイルのソースチャンネル数を調べます。常にモノラルの `SonareAudio` を作る `sonare_audio_from_file` とは別物です。1 チャンネルだけ読み込むには `sonare_audio_from_file_channel(path, channel_index, &out)` を使います。どちらも WASM では利用できません。

`SonareAnalysisResult` は C ABI 用のコンパクトな結果で、BPM、BPM 確信度、キー、
拍子、ビート時刻を保持します。フル解析（コード、セクション、音色、ダイナミクス、リズム、メロディ、form、拍ごとの強度）が必要なときは `sonare_analyze_json`（段階ごとの進捗が要るなら `sonare_analyze_json_with_progress`）を呼び出します。camelCase の JSON 文字列を返し、`sonare_free_string` で解放します。

## ヘルパー群

いくつかのヘルパー群には、サンプルベースの C ABI 入口もあります。

| 系統 | 例 |
|------|----|
| エフェクト | `sonare_hpss`、`sonare_hpss_ex`、`sonare_hpss_with_residual`、`sonare_time_stretch_ex`、`sonare_phase_vocoder`、`sonare_pitch_shift_ex`、`sonare_spectral_edit`、`sonare_normalize`、`sonare_normalize_rms`、`sonare_trim_ex` |
| 特徴量 | `sonare_stft`、`sonare_mel_spectrogram`、`sonare_mfcc`、`sonare_mfcc_ex`、`sonare_chroma`、`sonare_chroma_cqt`、`sonare_nnls_chroma_ex2`、`sonare_spectral_*`、`sonare_pitch_yin`、`sonare_pitch_pyin` |
| ルーム音響 | `sonare_analyze_impulse_response_ex`、`sonare_synthesize_rir`、`sonare_estimate_room`、`sonare_room_morph`、`sonare_room_morph_stereo` |
| 変換とリサンプリング | `sonare_resample`。関数一覧は `include/sonare/sonare_c.h` を参照 |

特徴量では、ノート活性の `sonare_chroma` に加えて、定 Q クロマグラム（`librosa.feature.chroma_cqt` 相当）の `sonare_chroma_cqt` があります。明示レンジ版の MFCC 入口 `sonare_mfcc_ex`（fmin/fmax/htk）は、末尾にケプストラルリフタリング引数 `lifter` を持ちます（`0` で無効）。

拡張 C ABI のエフェクト関数はバインディングと同じ FFT 設定を公開します。
`sonare_hpss_ex` は `n_fft`、`hop_length`、`use_soft_mask`、残差出力フラグを受け取り、
`sonare_time_stretch_ex` と `sonare_pitch_shift_ex` は `n_fft` と `hop_length` を受け取ります。
`sonare_trim_ex` は `frame_length` と `hop_length`、`sonare_analyze_impulse_response_ex` は
`min_decay_db`、`sonare_nnls_chroma_ex2` は NNLS オプションの CQT `hop_length` を追加します。

## プロジェクトとシンセパッチの補足

プロジェクトまたはエンジンのサンプルレートは、サポート範囲内の整数ヘルツでなければなりません（`sonare_project_set_sample_rate` は `[8000, 384000]`）。小数のレートは `SONARE_ERROR_INVALID_PARAMETER` を返し、`sample_rate` が小数のプロジェクト JSON は `SONARE_ERROR_INVALID_FORMAT` と診断 `invalid_sample_rate` で読み込みに失敗します。

プロジェクト編集は `sonare_c_project.h` にあります。`sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` の最後の引数が任意の equal-power 継ぎ目クロスフェードです。有限で 0 以上である必要があり、`0` ならハードループのままです。エンジンは使用可能なプリロールとループ長の半分を上限にクランプし、ワープ時は無視します。

### SynthPatch のバージョン

`sonare_project_bounce_with_synth_instruments` と `sonare_engine_set_synth_instrument` が受け取る NativeSynth のパッチ `SonareSynthPatch` は、現在 `SONARE_SYNTH_PATCH_STRUCT_VERSION` 9 で、C の呼び出し側は再ビルドが必要です。以前のバージョンはすべて引き続き読まれます。バージョンごとに次のフィールドが末尾に追加されます（宣言は `sonare_c_types_analysis.h`）。

| `struct_version` | 追加されるもの |
|------------------|----------------|
| 0、1 | 元のレイアウト |
| 2 | 末尾の `present_fields` ビットマスク |
| 3 | サンプルエンジンのブロック |
| 4 | 直列の高域通過 |
| 5 | コンバーターのブロック |
| 6 | `pitch_offset_cents` |
| 7 | `retrigger` |
| 8 | `engine_params` / `engine_param_count` |
| 9 | 2 つ目の存在ワード `present_fields2`（ビット `SONARE_SYNTH_FIELD2_*`）と `drift_rate_hz`、`amp_delay_ms`、`amp_hold_ms`、`filter_delay_ms`、`filter_hold_ms`、`one_shot` |

`retrigger` は `SONARE_SYNTH_RETRIGGER_BASE`（0）、`SONARE_SYNTH_RETRIGGER_FREE`（1）、`SONARE_SYNTH_RETRIGGER_NOTE`（2）のいずれかです。`FREE` はノートごとにオシレーターの位相、ユニゾンの揺らぎ、ドリフト、エンジンのノイズストリームを変え、`NOTE` はノート番号からそれらを決めるため、テール後に同じノートを鳴らすと同じサンプル列になります。どちらもボイス外の状態（コントローラー、共有楽器の共鳴、エフェクトのテールなど）はリセットしません。

`present_fields` は 31 ビットを使用しており、2 ワード目が `present_fields2` です。さらに拡張する場合はどちらのワードも広げず、新しい `struct_version` で次のワードを追加します。enum フィールドに存在ビットがないのは、ゼロがベースを保つ値で、実際の enum 値はすべて非ゼロだからです。`SONARE_SYNTH_FIELD_MOD_ROUTINGS` を立てて `num_mod_routings == 0` にするとベースのモッドマトリクスを消去し、要素のあるテーブルは置き換えます。

`engine_params` は `SonareSynthEngineParam {key, value}` を借用で渡すリストで、選択したエンジン固有のモデルフィールド（弓圧、息の圧力、唇の張り、打弦位置、FM オペレーターレベル、FM の `algorithm`、モード比）をキーで設定します。キーはエンジンセクションのフィールドを lowerCamelCase にしたもの（`bowForce`、`ranks2.level`）で、未知のキー、別のエンジンのキー、重複したキー、有限でない値、フィールドの範囲外の値は、クランプされずにキー名を挙げた `SONARE_ERROR_INVALID_PARAMETER` で呼び出しが失敗します。`sonare_synth_engine_param_info(engine_mode)` はエンジンのセクションフィールドの記述子をスレッドローカルな JSON 配列で返し（同じスレッドの次の呼び出しまで有効）、`sonare_synth_patch_param_info()` は数値のパッチフィールドすべて（と `one_shot`）の記述子を静的な配列で返します。どちらも解放しないでください。default、subtractive、sample の各モードは `[]` を返します。各記述子は `{name, type, integer, min, max, default, unit}` に加え、他のフィールドの条件でのみボイスに届くフィールドには `activeWhen` を持ちます。`activeWhen` は選択肢の配列で、各選択肢は `{key, scope, relation, value}` のリストです。少なくとも 1 つの選択肢の条件がすべて成り立つとき、そのフィールドはボイスに届くので、UI は成り立たないコントロールを無効表示にできます。エンジンモードだけを設定したパッチは、そのエンジンのベースプリセットで発音します。

librosa 互換ヘルパーも C API から使えます。

| 分類 | ヘルパー |
|------|----------|
| プリエンファシスと無音処理 | `sonare_preemphasis`、`sonare_deemphasis`、`sonare_trim_silence`、`sonare_split_silence` |
| フレーム分割とパディング | `sonare_frame_signal`、`sonare_pad_center`、`sonare_fix_length`、`sonare_fix_frames` |
| ピーク検出と正規化 | `sonare_peak_pick`、`sonare_vector_normalize` |
| 特徴量ユーティリティ | `sonare_pcen`、`sonare_tonnetz`、`sonare_tempogram`、`sonare_plp` |
| dB 変換 | `sonare_power_to_db`、`sonare_amplitude_to_db`、`sonare_db_to_power`、`sonare_db_to_amplitude` |
| 時間／フレーム変換 | `sonare_frames_to_samples`、`sonare_samples_to_frames` |
| 分解／ノイズ除去 | `sonare_decompose`、`sonare_decompose_with_init`（init は `"random"`／`"nndsvd"`）、`sonare_decompose_stems`、`sonare_decompose_stems_linked`、`sonare_nn_filter` |

リンク版のステム分解は、チャンネル平均の振幅から 1 つの NMF モデルを作り、同じソフトマスクを各チャンネルの複素スペクトルへ適用します。そのため、チャンネル間の位相とレベルの関係が保たれます。フラットな出力は `(component, channel, sample)` の順で、`out_w` と `out_h` は `sonare_decompose_stems` と同じ因子の形状です。

```c
SonareError sonare_decompose_stems_linked(const float* const* channels, size_t channel_count,
                                          size_t length, int sample_rate,
                                          const SonareDecomposeStemsConfig* config, float** out,
                                          size_t* out_component_count, size_t* out_channel_count,
                                          size_t* out_component_length, float** out_w,
                                          size_t* out_w_length, float** out_h,
                                          size_t* out_h_length);
```

## ヘッダー索引

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
| `sonare_c_mastering.h` | プリセット、フルチェーン、進捗コールバック、名前付きプロセッサと機械可読なプロセッサカタログ、アシスタント／プロファイル／プレビュー JSON とその `*_stereo` 入口、レイテンシと実際に組まれた段を検査できるストリーミングマスタリングチェーン（`sonare_streaming_mastering_chain_stage_names`）、ストリーミング EQ、リペア／ダイナミクスの単発ヘルパー |
| `sonare_c_mixing.h` | チャンネルストリップ制御、センド、バス、VCA グループ、オートメーション、メーター、ゴニオメーター、シーンプリセット |
| `sonare_c_streaming.h` | `StreamAnalyzer`、上限付き未読出力（`max_pending_frames`）、量子化フレーム読み出し、滞留／破棄を含む更新統計、チューニング／正規化制御 |
| `sonare_c_transcribe.h` | 音声から音楽的なグリッド上の MIDI ノートへの採譜: `SonareTranscribeConfig`、`sonare_transcribe`、`sonare_transcribe_config_default` |
| `sonare_c_polyphony.h` | コードの 1 音だけを編集する: `SonarePolyphonicConfig`、`sonare_polyphonic_analyze`、音声への再レンダリング |
| `sonare_c_vocal_edit.h`、`sonare_c_vocal_project.h` | モノフォニックなボーカルノートのオフラインかつ非破壊の編集と、レンダリング結果のプロジェクトクリップへの再バインド |
| `sonare_c_playback.h` | 再生レンダラー: デコード済みの映像音声をヘッドホン（バイノーラル）またはステレオ／5.1／7.1 スピーカーへ |
| `sonare_c_sample_bank.h` | サンプル合成エンジン向けの、ホストが用意した PCM とキーマップ |
| `sonare_c_assist.h` | 作曲アシスト: 組み込みのルールベース生成モジュールのプレビューと、プロジェクトへの適用 |
| `sonare_c_types_*.h`、`sonare_c_project_*.h` | `sonare_c_types.h` と `sonare_c_project.h` から取り込まれる分割ヘッダー（解析・エンジン・列挙の型、アノテート、コア、編集、外部ステム、インストゥルメント、MIDI、パートリグ、タイムラインのプロジェクト呼び出し）。これらではなくアンブレラヘッダーをインクルードしてください |

## ルーム音響、サラウンド、リアルタイムエンジンの補足

C ABI のルーム音響では、次の設定を公開します。

- `SonareRirSynthConfig`: 形状、吸音率、`material_preset`、`absorption_bands`／`scattering_bands`、`ism_order`、`seed`、`max_seconds`、`mixing_time_ms`、`crossfade_ms`、`late_model`、空気吸収のフィールド群（[大空間での空気吸収](./cpp-api-effects.md#大空間での空気吸収)を参照）。
- 壁材の優先順位: 0 でない `material_preset`（`SONARE_MATERIAL_PRESET_*`）が最優先で、次が NULL でない `absorption_bands`、最後がスカラーの `absorption` です。
- `SonareRoomEstimateConfig`: アスペクト比と吸音率の事前条件、`reference_absorption`、`min_decay_db`、`noise_floor_margin_db`、`prefer_eyring`、`n_octave_bands`、解析 `mode`。`reference_absorption` が 0 ならライブラリの既定値（0.15）が使われ、それ以外の値は拒否されずに [0.01, 0.99] へクランプされ、推定される体積はその 3 乗に比例します。
- 解析 `mode`: `SONARE_ACOUSTIC_MODE_AUTO`、`SONARE_ACOUSTIC_MODE_BLIND`、`SONARE_ACOUSTIC_MODE_IMPULSE_RESPONSE`。

C ABI でのサラウンド／マルチチャンネルのエンジンバスでは、次を扱えます。

- `SonareChannelLayout` はスピーカーベッドを列挙します。`SONARE_CHANNEL_LAYOUT_MONO`（0）、`SONARE_CHANNEL_LAYOUT_STEREO`（1）、`SONARE_CHANNEL_LAYOUT_5_1`（2）、`SONARE_CHANNEL_LAYOUT_7_1`（3）。値は `sonare::ChannelLayout` と一致し、ABI／JSON のワイヤフォーマットの一部です。
- `SonareEngineBus.channel_layout` はバスのスピーカーベッドを設定します（マスターバスはプロジェクト出力レイアウトを担い、既定はステレオ）。`SonareEngineTrackLane.source_channel_layout` は `SONARE_CHANNEL_LAYOUT_STEREO` でなければなりません。マルチチャンネルのレーン入力は未実装のため、`sonare_engine_set_track_lanes` はモノラル、5.1、7.1 のレーンに `SONARE_ERROR_INVALID_PARAMETER` を返します。ゼロ初期化したレーンはモノラル（`SONARE_CHANNEL_LAYOUT_MONO` は 0）として読まれるので、すべてのレーンに `STEREO` を明示してください。
- リアルタイムのレーンミキサーは、ストリップの `surroundPan` 位置から各モノラル／ステレオレーンを 5.1/7.1 の宛先へパンし、バスをプレーンごとに合算してプレーン別（ワイド）メーターを公開します。`azimuth`、`divergence`、`lfe` は配置に反映され、`elevation` と `distance` は予約です。[リアルタイムエンジンのサラウンドグループバス](./realtime-engine.md#サラウンドグループバスとワイドメーター)を参照してください。

C ABI のリアルタイム・インサートオートメーションと外部 MIDI では、次を扱えます。

- トラック、マスター、バスの各ストリップには、インサートのバイパスとリアルタイム安全なパラメータを変更する関数があります。パラメータ名には `sonare_mastering_insert_param_info` が返す JSON キーを使います。未対応またはリアルタイム安全でない名前には `SONARE_ERROR_INVALID_PARAMETER` が返ります。
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` は、インサートのパラメータ名を `sonare_engine_set_automation_lane`、`sonare_engine_set_parameter`、`sonare_engine_set_parameter_smoothed` が受け取る数値 id に変換します。共通のランプ時間は `sonare_engine_set_param_smoothing_ms` で変更でき、既定は 20 ms、`0` は即時変更です。
- `sonare_engine_push_midi_program(engine, destination_id, group, channel, program, bank_valid, bank_msb, bank_lsb, render_frame)` と `sonare_engine_push_midi_input_program(engine, group, channel, program, bank_valid, bank_msb, bank_lsb, offset_in_block_samples)` は、任意のバンク付きのライブプログラムチェンジを 1 つの MIDI 2.0 Program Change として詰めて送ります。受け側自身の条件がそのまま適用されます。`bank_valid` が 0 のまま非ゼロのバンクを渡すと `SONARE_ERROR_INVALID_PARAMETER` です。受け側ごとの扱いは次のとおりです。

  | 受け側 | プログラムチェンジに従うか |
  |--------|---------------------------|
  | SoundFont プレイヤー | 従う。自身の条件のもとでバンクとプログラムを選ぶ |
  | `use_gm_programs` を付けて割り当てた NativeSynth | 従う。各チャンネルのボイスをそれらから決める |
  | パッチが GM キットを鳴らす NativeSynth（`drum-kit` プリセット、または `gm_kit` をオンにしたパーカッションパッチ） | 従う。全チャンネルでプログラムを GS ドラムセットの選択として扱う |
  | それ以外の受け側（内蔵シンセ、ほかの NativeSynth パッチ、RX PROGRAM CHANGE がオフのパート、MPE のメンバーチャンネル） | 受け付けたうえで無視する |

- ライブ MIDI の push 関数（`sonare_engine_push_midi_note_on`、`_note_off`、`_cc`、`_pitch_bend`、`_channel_pressure`、`_poly_pressure`、`_program`、`_ump` と `sonare_engine_push_midi_input_*` 系）は、MIDI の範囲外の値を、引数名と範囲を挙げたメッセージ（`channel must be in [0, 15]`）付きの `SONARE_ERROR_INVALID_PARAMETER` で拒否します。無効な入力ソースへの push は `SONARE_ERROR_INVALID_STATE`、入力キューが満杯なら `SONARE_ERROR_OUT_OF_MEMORY` です。
- `sonare_engine_set_parameter`、`sonare_engine_set_parameter_smoothed`、`sonare_engine_set_automation_lane` は、予約されたミキサー名前空間（`0x4D58xxxx`）のパラメータ ID のうちマスター ID でないものを `SONARE_ERROR_INVALID_PARAMETER` で拒否します。
- `sonare_engine_set_track_sends(engine, track_id, sends, send_count)` と `sonare_engine_set_track_output_bus(engine, track_id, output_bus_id)` は、レーン一覧を渡し直さずに 1 本のトラックレーンのセンドまたは出力バス（`0` はマスターミックス）を変更します。`sonare_engine_set_track_lanes` は引き続きすべてのレーンを置き換えます。
- `sonare_engine_push_midi_sysex` には、先頭の `0xF0` と末尾の `0xF7` を含む完全な SysEx フレームを渡します。長さは 1〜512 バイトです。
- `sonare_engine_set_midi_destination_external` を使うと、その送出先（デスティネーション）は内蔵インストゥルメントラックを通らず、ホストが回収する出力キューへ送られます。外部化できるデスティネーションは最大 16 個です。クロック／トランスポート転送は `sonare_engine_set_external_midi_clock_enabled` で明示的に有効化し、そのメッセージのデスティネーション id は `0xFFFFFFFF` です。
- ホスト／制御スレッドでは `sonare_engine_drain_external_midi` をイベント数が 0 になるまで繰り返し呼び、得られた 1〜3 バイトの MIDI 1.0 メッセージを機器へ渡します。1 個の UMP（Universal MIDI Packet）レコードが 4 メッセージへ展開される場合があるため、`max_events` は 4 以上必要です。ホストの回収が遅すぎないかは `sonare_engine_external_midi_dropped_count` で監視できます。SysEx／Data など MIDI 1.0 へ変換できない UMP メッセージは、この drain API からは出力されません。
- 取り出した各 `SonareEngineTelemetry` レコードの `error` フィールドは `SonareEngineTelemetryError`（`sonare_c_types_engine.h`）の序数です。`NONE = 0`、`1`〜`18` はキューと容量のオーバーフロー（コマンドキュー、保留コマンド、境界、テレメトリ、キャプチャ、オートメーションバインドターゲット、インサートオートメーション、MIDI クロック、メトロノーム）、リアルタイム安全でない・未準備のコマンド、古いオートメーションレーン、クリップページのアンダーランを表し、`20` が `MAX_CHANNELS_EXCEEDED`、`21` が `PARAMETER_BASE_OVERFLOW` です。

## C ABI の正準契約

ステレオのペア処理とノート編集の入口は、次の C ABI 名とシグネチャで契約を定義しています。

```c
SonareError sonare_mastering_apply_pair_processor_stereo(
    const char* processor_name, const float* source_left, const float* source_right,
    const float* reference_left, const float* reference_right, size_t length,
    int sample_rate, const SonareMasteringParam* params, size_t param_count,
    SonareMasteringStereoResult* out);
SonareError sonare_mastering_apply_pair_processor_stereo_ex(
    const char* processor_name, const float* source_left, const float* source_right,
    size_t source_length, const float* reference_left, const float* reference_right,
    size_t reference_length, int reference_sample_rate, int sample_rate,
    const SonareMasteringParam* params, size_t param_count, SonareMasteringStereoResult* out);
SonareError sonare_mastering_ab_match_loudness_stereo(
    const float* source_left, const float* source_right, size_t source_length,
    const float* reference_left, const float* reference_right, size_t reference_length,
    int reference_sample_rate, int sample_rate, SonareMasteringStereoResult* out,
    SonareLoudnessMatch* out_match);
```

ステレオのペアプロセッサ関数が対応するのは `match.abCrossfade` だけです。ソースの左右チャンネル、リファレンスの左右チャンネルは、それぞれ同じ長さにしてください。`_ex` なしは 1 つの共通長を使い、`_ex` 版はソースとリファレンスで異なる長さを許し、短い方のペア長を返します。`sonare_mastering_ab_match_loudness_stereo` はソースの両チャンネルへ 1 つのゲインを共有して適用し、ソースの長さとステレオイメージを保ち、シーリングを行いません。マッチ情報が不要な場合は `out_match` に `NULL` を渡します。

2 つのバッファを取るエントリはどれもリファレンス自身のレートを受け取ります。`sonare_mastering_apply_pair_processor_ex`、`sonare_mastering_apply_pair_processor_stereo_ex`、`sonare_mastering_analyze_pair_ex`、`sonare_mastering_ab_match_loudness`、`sonare_mastering_ab_match_loudness_stereo` は `reference_length` の後ろに `int reference_sample_rate` を持ち、`sonare_eq_match_ex(eq, source, source_length, sample_rate, reference, reference_length, reference_sample_rate, max_bands)` が EQ マッチの対応する関数です（`sonare_eq_match` は 1 つの長さと 1 つのレートでこれに委譲します）。別のレートのリファレンスは先に `sample_rate` へリサンプルされ、レートが等しければリサンプルは行われないので、出力と遅延推定はソースレートのサンプルで返ります。0 以下のレートは `SONARE_ERROR_INVALID_PARAMETER` です。`sonare_mixing_assistant_suggest` と `sonare_mixing_assistant_suggest_scene_json` は `track_lengths` の後ろに `const int* track_sample_rates` を取り（`NULL` なら全トラックが `sample_rate`）、各トラックは呼び出しのレートへリサンプルされます。

```c
SonareError sonare_streaming_mastering_chain_set_parameter(
    SonareStreamingMasteringChain* handle, const char* key, double value);
SonareError sonare_render_notes(
    const float* samples, size_t length, int sample_rate,
    const SonareNoteObject* notes, size_t note_count,
    const float* envelopes, size_t envelope_count, const float* f0_hz,
    const int32_t* voiced, size_t n_frames, float frame_rate,
    const SonareNoteRenderConfig* config, float** out, size_t* out_length);
SonareError sonare_decompose_note_pitch(
    const float* f0_hz, const int32_t* voiced, size_t n_frames,
    float frame_rate, float median_hz, float vibrato_cutoff_hz,
    SonarePitchDecompositionResult* out);
```

`sonare_streaming_mastering_chain_set_parameter` は、準備済みで有効な段をフルドット記法のキーで指定します。キーはリアルタイム安全である必要があり、構造を変えるキー、無効な段のキー、未知のキーは変更前に拒否されます。処理、フラッシュ、リセット、prepare とブロック境界で直列化してください。既存の DSP インスタンス、音声履歴、レイテンシは保持されます。

`sonare_render_notes` は、ピッチカーブを使う編集がなければ `f0_hz` に `NULL` を渡せます。`voiced` も省略できます。`voiced` が非 `NULL` の場合は `f0_hz` も必要です。`voiced` が `NULL` なら、正で有限な利用可能 F0 から有声判定を推測し、0 のフラグは利用可能な F0 も無効にします。`sonare_decompose_note_pitch` は `n_frames > 0` の非 `NULL` F0 トラックを必要としますが、`voiced` フラグは省略でき、同じ利用可能 F0 の規則を使います。非正または非有限の F0 フレームはピッチ測定に寄与しません。

C ABI でプロセッサを分類するには、`sonare_mastering_processor_catalog()` が JSON 配列の文字列 `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","realtimeCost","channelPolicy","category","params","slots"}, ...]` を返します。`kind` は `realtime`／`offline`／`pair` で、`realtimeInsertable` は `sonare_mastering_insert_names()` の id に対してのみ真になります。`latencySamples` と `tailSamples` は代表的な既定構成（48 kHz／512 サンプル）での測定値で、構成によって変わる値は `sonare_mastering_insert_timing` で取得します。`realtimeCost` はライブインサート向けの大まかな `low`／`moderate`／`high` のアルゴリズム負荷見積もりであり、ハードウェア上のベンチマークではなく、非インサート id では `null` です。`channelPolicy` はサラウンドホストでミキサーがプロセッサをどうラップするか、`category` は id 名前空間から導出する安定した UI グループです。`params` はリアルタイム対象と構築用キーの記述子（非インサートプロセッサでは空配列）で、各記述子は `name`、`id`、`rtSafe`、`type`、`min`、`max`、`minExclusive`、`maxExclusive`、`maxRelativeTo`、`default`、`unit`、`scale`、`uiMin`、`uiMax`、`dependsOn`、`choices`、`slot` を持ちます。`slots` は条件付きキー群を `{name,parent,activation,minCrossoverCutoffs}` として列挙します。id の全集合は `sonare_mastering_processor_names()`、インサート集合、`sonare_mastering_pair_processor_names()` の和なので、ホストは id をハードコードせずにプロセッサ選択を絞り込めます。ポインタはスレッドローカルで（解放せず、スレッドをまたいでキャッシュしないでください）、`sonare_mastering_processor_names()` と同様の扱いです。

C ABI の専用クエリは次のとおりです。

```c
const char* sonare_mastering_insert_param_info(const char* name);
SonareError sonare_mastering_insert_timing(const char* name, const char* params,
                                           int sample_rate, int* out_latency_samples,
                                           int* out_tail_samples);
SonareError sonare_mastering_preset_params_json(const char* preset, char** json_out);
```

`minExclusive` と `maxExclusive` は、対応する境界値そのものを拒否するかどうかを表します。共通フィールドは[インサートのパラメータ記述子](./effects-inserts.md)を参照してください。

`sonare_mastering_insert_param_info` はスレッドローカルな JSON 記述子配列を返すため、解放しないでください。記述子は、`name`、`id`、`rtSafe`、`type`、`min`、`max`、`default`、`choices`、`slot` に加えて、受け入れ範囲の外でコントロールが必要とする情報を宣言します。`unit` は、そのキーを消費するプロセッサから読まれ、閉じた集合（`dB`、`dBFS`、`LUFS`、`Hz`、`ms`、`s`、`samples`、`m`、`cm`、`mm`、`deg`、`percent`、`degC`、`V`、`inPerSec`、`dBPerOct`、`semitones`、`cents`、`ratio`、`bits`、`count`、`none`）の値です。`scale` は `linear` または `log`、`uiMin` / `uiMax` は `[min, max]` の内側に置く任意の表示範囲、`dependsOn` は現在値がこのキーの範囲を左右する兄弟キーで、それぞれ `this <relation> factor * sibling` と読みます。`coupledWith` は受け入れ範囲を動かすそのほかの兄弟キーで、`min` / `max` はそれらを既定値にして測った値です。`sonare_mastering_insert_param_info_at_rate(name, sample_rate)` は同じ配列を返しますが、`maxRelativeTo` が `"nyquist"` のキーを、そのホストレートで受け入れられる上限（ホストのナイキストと、インサート構築時に固定された上限のうち低い方）に解決します。レートが範囲外なら `SONARE_ERROR_INVALID_PARAMETER` とともに `NULL` を返し、レートなしの問い合わせは変わりません。`sonare_mastering_insert_timing` は未知のキーを拒否し、指定した構成のレイテンシとテールを返します。`sonare_mastering_preset_params_json` は `{"version":1,"params":{...}}` を返し、ヒープで確保された文字列を `sonare_free_string` で解放します。カタログの `repair.*` 項目は、同じ記述子でパラメータを公開し、自動化 `id` を持たず、`rtSafe` にもなりません。すべての項目は `causal` も持ちます（`repair.declick`、`repair.declip`、`repair.trimSilence` は false、他のリペア段とすべてのインサートは true）。`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical` はそれぞれの ID でリアルタイムインサートになり、declick と declip はオフラインのままです。enum 値のパラメータは数値と並んで `choices` の名前も受け付け、`sonare_mastering_enum_value(processor, key, name, &is_enum, &value)` が名前を解決します。`sonare_capability_catalog_json()` はプロセッサカタログ、組み込みのマスタリング、シンセ、ミキシングシーン、ボイスチェンジャーのプリセット名一覧、詳細な `masteringPresets` 項目をまとめて返します。

リアルタイムボイスプリセットは C では `sonare_realtime_voice_changer_preset_names()`、`sonare_realtime_voice_changer_preset_json()`、`sonare_realtime_voice_changer_validate_preset_json()` から扱えます。型付きのプリセット選択子は `SonareVoiceCharacterPreset` 列挙です（`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 から `SONARE_VC_PRESET_DARK_VILLAIN` = 5）。`sonare_voice_character_preset_id(preset)` は正規の id 文字列を返し（不明値には NULL）、`SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` マクロはコンパイル時のバインディング生成向けに改行区切りの id 一覧を提供します。ネイティブ POD 設定の ABI は `SONARE_VOICE_CHANGER_ABI_VERSION` で、プリセット JSON の `schemaVersion` とは別です。

## C ABI のエントリポイントの追加分

ピッチ、ボイス、リペア（`sonare_c_effects.h`、`sonare_c_mastering.h`）:

| 関数 | 用途 |
|------|------|
| `sonare_auto_tune(samples, length, sample_rate, key, config, &out, &out_length, &out_key)` | モノフォニックな録音を、キーのスケールに合わせるオフラインの自動ピッチ補正。`key` は `SonareKey`、または検出させるなら `NULL`（指定したキーは確定として扱われ、`out_key` の信頼度は 1）。`config` は `NULL` でもよく、読まれるのは `scale_reference_midi`、`retune_amount`、`max_correction_semitones`、`retune_speed_ms`、`vibrato_threshold_cents` だけです。出力は入力と同じ長さで、`sonare_free_floats` で解放します |
| `sonare_voice_change_ex(samples, length, sample_rate, &config, &out, &out_length)` | `SonareVoiceChangeConfig`（`struct_version` は 0 または 1、`pitch_semitones`、`formant_factor`、`formant_mode`）を取る `sonare_voice_change`。`SONARE_FORMANT_MODE_RELATIVE`（0）はピッチシフトの後に掛かるワープで、フォルマントはピッチに追従します。`SONARE_FORMANT_MODE_ABSOLUTE`（1）は入力に対するフォルマントシフトで、`1` ならフォルマントは元の位置に留まります。絶対モードで `formant_factor / 2^(semitones / 12)` が [0.55, 1.65] を外れる指定は `SONARE_ERROR_INVALID_PARAMETER` で拒否され、最後のエラーメッセージが届く係数の範囲を示します |
| `sonare_mastering_repair_analyze(channels, channel_count, length, sample_rate, request_json, &json)` | チャンネルごとのリペア欠陥と、アシスタントが推奨する段を JSON で返します（`defects`、`channels`、`declipThresholdSafe`、`integratedLufs`、`recommended`、`explanation`）。`request_json` は `NULL` または `{"preferStreamingSafe": true}`。デリバーブは推奨されません。文字列は `sonare_free_string` で解放します |
| `sonare_mastering_repair_apply(channels, channel_count, length, sample_rate, stages_json, progress, user_data, out_channels, &reports_json, cancel, cancel_user_data)` | `[{"stage": ..., ...settings}]` を全チャンネルに適用します。配列の順序に関わらず、declip、declick、decrackle、dehum、denoise、dereverb の固定順で実行され、重複した段、未知の段、未知の設定は `SONARE_ERROR_INVALID_PARAMETER` です。`out_channels` は呼び出し側が所有するプレーンで（入力と同じメモリでもかまいません）、成功時にのみ書き込まれます。レポートは `[{stage, scope, reports}]` で、`scope` は `"channel"`（チャンネルごとに 1 件）または `"linked"`（全体で 1 件）です。コールバックはどちらも `NULL` にでき、`cancel` が 0 以外を返すと `SONARE_ERROR_CANCELLED` になります |
| `sonare_streaming_loudness_gain(samples, length, sample_rate, params, param_count, &out)` と `_stereo(left, right, ...)` | `sonare_streaming_mastering_chain_create_ex` に渡す `SonareStreamingLoudnessGain`（`loudness_static_gain_db`、`true_peak_db`、`integrated_lufs`）を、ラウドネス段の入力で測定します。ゲインはオフラインチェーンが適用するものと等しく（シーリングのクランプを含む）、`params` は `sonare_mastering_chain` と同じキーを取ります |

リアルタイムエンジン（`sonare_c_engine.h`。ここでの `render_frame` は `int64_t` のままで、負の値は「次のブロック先頭」を意味します）:

| 関数 | 用途 |
|------|------|
| `sonare_engine_upsert_clip(engine, &clip)`, `sonare_engine_remove_clip(engine, clip_id)` | 公開済みのクリップ集合の他の部分はそのままに、クリップを 1 つ置換・追加、または削除します。拒否されたクリップは集合を変えません。未知の ID の削除は `SONARE_ERROR_INVALID_PARAMETER` です。コントロールスレッド専用 |
| `sonare_engine_reset_processor_state(engine, render_frame)` | すべてのミキサーとエフェクトのプロセッサを準備直後の状態へ戻す処理をキューに積み、その後に再生を始めると、オフラインバウンスが始まるのと同じ状態から鳴ります。インストゥルメントは状態を保ち、再生中に呼ぶとシークと同様に進行中のテールを切ります |
| `sonare_engine_prime_offline_parameters(engine, num_channels, block_size)` | バウンスとフリーズが実行するオフラインのプリロールを、レンダリングせずに行います。`sonare_engine_render_offline` を自分で駆動するホストは、最初のチャンクの前に 1 回呼びます。準備済みの最大値を超えるチャンネル数やブロックサイズは `SONARE_ERROR_INVALID_PARAMETER`、準備前のエンジンは `SONARE_ERROR_INVALID_STATE` です |
| `sonare_engine_tail_samples(engine, &samples)` | 最後の入力の後に聞こえる最長のテールの上限（サンプル数。`2147483647` は無制限） |
| `sonare_engine_graph_latency_samples_q8(engine, &latency_q8)` | 処理レイテンシ（1/256 サンプル単位）。テレメトリレコードが持つ値と同じです |
| `sonare_engine_can_set_lane_sidechain`, `sonare_engine_can_set_bus_sidechain`, `sonare_engine_can_set_master_sidechain` | 対応する `set_*_sidechain` が接続を受理するかを、何も変更せずに報告します。`out_refusal` に `SonareSidechainRefusal` が入ります。`NONE`（0）、`INVALID_TARGET`、`INSERT_OUT_OF_RANGE`、`UNDECLARED_SOURCE`、`INVALID_SOURCE_KIND`、`SELF_KEY`、`CYCLE`、`TABLE_FULL`、`PLAN_REFUSED`（1〜8）です |
| `sonare_engine_resolve_track_lane_automation_id(engine, track_id, "faderDb" または "pan", &id)`, `sonare_engine_resolve_bus_automation_id(engine, bus_id, "faderDb", &id)` | 位置ではなくトラックまたはバスを指す、予約済みのオートメーション ID。`sonare_engine_set_track_lanes` や `sonare_engine_set_track_buses` で並べ替えても対象を追い続け、対象が削除されると未知のターゲットとして失敗します |
| `sonare_engine_resolve_master_automation_id(engine, "faderDb"・"pan"・"width", &id)` | マスターストリップに対する同じ ID。マスターは常に存在するため、ID が古くなることはありません。それ以外の名前は `SONARE_ERROR_INVALID_PARAMETER` で、`id` は 0 になります |

準備時より大きなブロックサイズでのオフラインレンダリング、バウンス、フリーズ、プリロールは `SONARE_ERROR_INVALID_PARAMETER` で拒否されます。`sonare_engine_set_track_strip_json`、`sonare_engine_set_bus_strip_json`、`sonare_engine_set_master_strip_json` は、シーンリーダーが読まないキーを名指しして拒否します（`unknown strip key 'strips[0].faderDB'`）。`$` または `x-` で始まるキーと snake_case の別名は、引き続き受け付けられます。

ミキサーとプロジェクト（`sonare_c_mixing.h`、`sonare_c_project_core.h`、`sonare_c_project_edit.h`）:

| 関数 | 用途 |
|------|------|
| `sonare_mixer_set_output_bus(mixer, source_id, bus_id)` | 構築後に、オフラインミキサーのストリップやバスをサブミックスへルーティングします。ソースの主接続を置き換え、未知の ID、バスではない宛先、ソースとしてのマスター、自分自身へのルーティング、接続やセンドを経由するサイクルは、何も変更する前に拒否します。追加したサブミックスがマスターに届くのは、それもマスターへルーティングしたときだけです |
| `sonare_mixer_flush_meters(mixer)` | すべてのストリップとバスのメーターに信号の終わりを知らせ、True Peakの読みに残っている群遅延分を、公開済みスナップショットに反映します。オフラインまたは単発の処理では最後のブロックの後に呼びます。その後の process 呼び出しは新しい信号として始まります |
| `sonare_project_unresolved_audio_source_by_index(project, index, &source)` | 解決できていないオーディオソースの記述子を、0 始まりのインデックスで読みます。順序は `sonare_project_unresolved_audio_source_id_by_index` と同じで、`name_or_uri` は 127 バイトで切り詰められます |
| `sonare_chord_symbol_from_analysis(root, quality, bass, &root_pc, &quality, extensions, capacity, &extension_count, &slash_bass_pc)`、`sonare_key_mode_from_analysis(mode, &out_mode)` | 検出したコードやキーを、ライブラリ自身の変換表を通してアレンジ注釈（`SonareProjectChordSymbol`、`SonareProjectKeySegment`）のフィールドへ変換します。番号体系の異なる 2 つの語彙を手で対応付ける必要はありません。`extensions` は度数で、最大 32 です |
| `sonare_align_take_to_reference_ex(reference, reference_len, reference_sample_rate, take, take_len, take_sample_rate, config, &anchors, &count, &alignment)` | 別のレートで録音したテイクのための `sonare_align_take_to_reference`。テイクはリファレンスのグリッドへリサンプルされ、両方のアンカー軸がリファレンスレートのサンプルで返るので、ワープマップを設定する前にプロジェクトレート÷リファレンスレートで換算します |
| `sonare_project_get_audio_source_uri(project, source_id, &uri)` | オーディオソース ID の、切り詰められていない完全な URI。ヒープのコピーで、`sonare_free_string` で解放します |

`sonare_project_add_loop_recording_takes` が取る `SonareProjectLoopRecordingDesc` の `flags` ワードは、`0`（部分的な最後のテイクを残す）または `SONARE_PROJECT_LOOP_RECORDING_DROP_PARTIAL_TAIL`（作らない）で、他のビットは `SONARE_ERROR_INVALID_PARAMETER` です。部分的な最後のテイクは残されますが、それ以前に完全なテイクがあればアクティブにはならず、プロジェクト JSON で `"partial": true` と記されます。残りが 1 フレーム以下ならテイクは作られません。
