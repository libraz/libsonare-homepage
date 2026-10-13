---
title: C++ エフェクト API
description: libsonare C++ インターフェースのオーディオエフェクト、ミキシングエンジン、編集ヘルパー、幾何ベースのルーム音響。
---

# C++ エフェクト API

libsonare C++ インターフェースのオーディオエフェクト、ミキシングエンジン、編集ヘルパー、幾何ベースのルーム音響。C++ API のその他の部分は [C++ API リファレンス](./cpp-api.md)、C ABI は [C ABI リファレンス](./cpp-api-c-abi.md) を参照してください。

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

<SonareDemo id="hpss-separation" />

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

対応する `librosa` 関数の挙動に合わせています。全体のマッピングは [librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trim` / `split`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frame` / `pad_center` / `fix_length` / `fix_frames`** — 固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peak_pick` / `vector_normalize`** — 1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`** — クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

これらのヘルパーは個別のヘッダーにあり、`<sonare.h>` には含まれません。使う関数ごとにヘッダーを include してください。入力は `Audio` ではなく生のサンプルバッファ（`std::vector<float>` または `const float*` と長さ）です。

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

FFI 統合向けの C ABI（ハンドル版とサンプル版の入口、ヘッダー索引、リアルタイムエンジン、マスタリング、ミキシング、プロジェクトの呼び出し）は [C ABI リファレンス](./cpp-api-c-abi.md) にあります。ルーム音響の呼び出しは、このページの [C ABI からのルームモーフ](#c-abi-からのルームモーフ) にあります。

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

## 幾何ベースのルーム音響

これらの API は、部屋モデルを推定・合成・適用するためのものです。専用モジュールヘッダーにあり、`BUILD_ACOUSTIC_SIM=ON` ビルドで使えます（ソースビルドの既定値です）。

::: info このセクションの用語
- **等価ルーム** は、音声から推定した実用上の部屋モデルです。実際の部屋の正確な形状ではありません。
- **RIR** は room impulse response（ルームインパルス応答）の略で、部屋が短い音にどう反応するかを表すサンプル列です。
- **RT60** は残響時間です。残響が 60 dB 減衰するまでの長さを指します（[音響解析](./acoustic-analysis.md)を参照）。
- **DRR (direct-to-reverberant ratio)** は直接音と残響の音量比を dB で表します。値が大きいほど、乾いた近い音になります。
- **ルームモーフィング** は、部屋の響きを足す音作り効果です。残響除去ではありません。
:::

<SonareDemo id="room-decay" />

```cpp
#include <acoustic/rir_synthesizer.h>
#include <analysis/room_estimator.h>
#include <effects/acoustic/room_morph.h>

using namespace sonare;

acoustic::ShoeboxRoom room = acoustic::uniform_shoebox({7.0f, 5.0f, 3.0f}, 0.2f);
acoustic::SourceListener placement{{1.0f, 1.0f, 1.2f}, {5.0f, 4.0f, 1.7f}};
auto rir = acoustic::synthesize_rir(room, placement, 48000);
if (!rir.rir.empty()) {
  RoomEstimate estimate = estimate_room(rir.rir);
}

effects::acoustic::RoomMorphConfig morph_config;
morph_config.target = room;
morph_config.placement = placement;
morph_config.wet = 0.6f;
effects::acoustic::RoomMorphResult morphed = effects::acoustic::room_morph(recording, morph_config);
// morphed.audio がレンダリング結果、morphed.diagnostics は目標 RIR 合成でクランプされた項目の一覧。
```

3 つの呼び出しは、ワークフローの別々の部分を担当します。

- `estimate_room(...)` は、体積、代表寸法、吸音率バンド、RT60 バンド、DRR、信頼度を返します。
- `synthesize_rir(...)` は、形状問題を診断情報で報告します。音源／聴取位置が不正な場合は空の RIR を返します。
- `room_morph_stereo(left, right, config)` はステレオペアをモーフします。目標ルームはリスナーを挟んで `config.receiver_spacing_m`（既定 0.5 m、(0, 4] の範囲）だけ離れた 2 本の無指向性レシーバーで聴かれ、各チャンネルは自分のレシーバーの応答と畳み込まれ、リンクした 1 つのサプレッサーゲインが両チャンネルに適用されます。`left`、`right`、重複を除いた `diagnostics` を持つ `RoomMorphStereoResult` を返し、長さの異なるチャンネルやルームの外にあるレシーバーペアは `ErrorCode::InvalidParameter` の例外を投げます。
- `room_morph(...)` は、入力音声に目標ルームの響きを付けてレンダリングし、`RoomMorphResult` を返します。音声に加えて、`synthesize_rir(...)` と同じ診断情報を持ちます。目標 RIR を同じコードで合成しているためです。使えない設定はエラー項目として報告されるのではなく、`ErrorCode::InvalidParameter` の例外を投げます。

::: details 設定項目の詳細
`acoustic::RirSynthConfig` では、RIR 生成の設定を指定できます。

- 鏡像音源法の反射次数
- Sabine/Eyring の後期テールモデル
- 決定的なシード
- RIR の最大長
- 初期反射と後期テールの混合時刻
- クロスフェード幅

`RoomEstimateConfig` は、`AcousticConfig` 経由で解析設定を渡します。主な項目は、解析モード、オクターブバンド数、最小減衰幅、ノイズフロア余裕です。

アスペクトヒントと `reference_absorption` は、等価ルームの事前条件を決めます。
:::

### C ABI の名前取得と推定からジオメトリへの変換

`sonare_material_preset_name(preset)` と `sonare_acoustic_mode_name(mode)` は、`SONARE_MATERIAL_PRESET_*` または `SONARE_ACOUSTIC_MODE_*` の値の名前を返し（`"none"`、`"concrete"`、`"wood"`、`"curtain"`、`"carpet"`、`"glass"`、および `"auto"`、`"blind"`、`"impulse_response"`）、最後の値を過ぎると `NULL` を返します。値は 0 から連続しているので、`NULL` になるまで数え上げれば有効な名前を列挙できます。返される文字列は静的領域のもので、解放しないでください。

`sonare_room_geometry_from_estimate(&estimate, &config)` は、`sonare_estimate_room` の結果を `SonareRirSynthConfig` のジオメトリに変換します。3 つの寸法を設定し、バンドごとの吸音率は推定結果から借用するので、推定結果は config より長く生きている必要があります。音源とリスナーは既定の配置（音源 (1, 1, 1.2)、リスナー (5, 4, 1.7)）を、推定した寸法と既定の 7 × 5 × 3 の比で軸ごとに拡縮した位置なので、どんな推定ルームの内側にも収まります。スカラーの `absorption` は有限なバンドの平均で、有限なバンドがなければ 0 のままです。`sonare_synthesize_rir` を呼ぶ前に、必要なフィールドは上書きできます。有限でない吸音バンドは借用されず、測定可能な減衰がない推定結果（寸法が有限でない）は `SONARE_ERROR_INVALID_PARAMETER` で拒否されます。

### C ABI からのルームモーフ

`sonare_c_acoustic.h` の `sonare_room_morph` は、入力サンプル、そのサンプルレート、`SonareRoomMorphConfig` を受け取り、モーフ後のモノラル信号を出力ポインタの組で返します。目標ルームの合成が出した診断情報は戻り値には含まれず、スレッドローカルの構造化チャンネルに置かれるので、呼び出しが返ってから読み出します。所有権と寿命は以下のとおりです。

```c
float* out = NULL;
size_t out_length = 0;
SonareError err = sonare_room_morph(samples, length, sample_rate, &config, &out, &out_length);
if (err != SONARE_OK) return err;  // 何も確保されていない。詳細は sonare_last_error_message() にある
for (size_t i = 0; i < sonare_last_diagnostic_count(); ++i) {
  const char* code = sonare_last_diagnostic_code(i);  // 例: "acoustic.rir_length_clamped"
  // sonare_last_diagnostic_message(i) と sonare_last_diagnostic_severity(i) が同じ添字で並ぶ
}
sonare_free_floats(out);
```

- `*out` はライブラリが確保し、`sonare_free_floats` で解放します。長さは入力の `length` サンプルに目標ルームのテールを足したもので、サンプルレートは入力と同じです。空の入力では `NULL` ／ `0` が返り、そのまま解放しても安全です。戻り値が `SONARE_OK` 以外なら何も確保されていません。
- 診断情報の文字列はライブラリが所有し、`NULL` になることはなく、同じスレッドで診断情報を記録またはクリアする次の C ABI 呼び出しまで有効です。`sonare_room_morph` と `sonare_synthesize_rir` はどちらも入口でこのチャンネルをクリアし、それ以外の呼び出しの後は件数が `0` になります。読み出しても項目は消費されず、解放するものもありません。保持したい文字列はコピーしてください。
- 件数以上の添字を渡すと `""` と `SONARE_DIAGNOSTIC_INFO` が返るので、ループは重要度ではなく件数で区切ります。モーフが出す項目はすべて回復可能なクランプで、重要度は `SONARE_DIAGNOSTIC_WARNING` です。使えない設定は項目ではなくエラー戻り値になります。
- `sonare_room_morph_stereo(left, right, length, sample_rate, &config, &out)` がステレオ版です。`SonareRoomMorphStereoResult`（`left`、`right`、`length`、`sample_rate`）を埋め、`sonare_free_room_morph_stereo_result` で解放します。`config->receiver_spacing_m` はレシーバー間隔（メートル、(0, 4] の範囲）で、`0` なら既定の 0.5 m です。`sonare_room_morph` はこのフィールドを読みません。診断情報は同じスレッドローカルのチャンネルで届きます。
- `sonare_last_warning_message()` には同じ項目が `code: message; code: message` の 1 本の文字列に畳まれて入ります。これは従来この形式を読んでいた呼び出し側のために残されているもので、分岐には構造化アクセサを使ってください。区切り文字を含むメッセージは元に戻せず、重要度も文字列には含まれないためです。

### 大空間での空気吸収

大きなホールでは、長い伝搬経路での空気損失を考慮しない幾何学のみの RT60 推定は、高域の残響を長く見積もりすぎることがあります。C++ の音響コアでは、Sabine/Eyring 計算に ISO 9613-1 の大気吸収項を加えられます。これはオプトインです。最後の引数を省略すれば、従来の幾何学のみの結果がそのまま得られます。

```cpp
#include <acoustic/late_reverb.h>

acoustic::AirAbsorption air;
air.temperature_c = 20.0f;
air.humidity_percent = 50.0f;

const auto rt60 = acoustic::shoebox_reverb_time(
    room, acoustic::ReverbModel::Eyring, &air);
// rt60.rt60_bands: 空気損失により、とくに高域が短くなる。
```

`AirAbsorption` の既定値は 20 ℃・相対湿度 50% です。同じ項は RIR 合成とルームモーフのすべての入口で任意に有効化できます。C ABI では `SonareRirSynthConfig` と `SonareRoomMorphConfig` の `air_absorption_enabled`／`air_temperature_c`／`air_humidity_percent`（気候フィールドの 0 は ISO 基準気候を選ぶため、0 ℃ は 0.01 で指定）、Node と WASM では `airAbsorptionEnabled`、Python では `air_absorption_enabled` です。無効のままなら、どの入口も幾何学のみの結果を保ちます。

