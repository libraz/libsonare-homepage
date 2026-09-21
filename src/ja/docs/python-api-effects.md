---
title: Python エフェクト API
description: libsonare Python パッケージのオーディオエフェクト、ルーム音響解析、リアルタイムボイスチェンジャー、librosa 互換ヘルパーのリファレンスです。
---

# Python エフェクト API

libsonare Python パッケージのオーディオエフェクト、ルーム音響解析、リアルタイムボイスチェンジャー、librosa 互換ヘルパーのリファレンスです。インストール、クイックスタート、その他の API ファミリーは [Python API](./python-api.md) の索引ページを参照してください。

## オーディオエフェクト

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# HPSS（倍音成分／打撃成分の分離）
hpss_result = audio.hpss()
harmonic = audio.harmonic()
percussive = audio.percussive()

# タイムストレッチ / ピッチシフト
stretched = audio.time_stretch(rate=1.5)       # 1.5倍速
shifted = audio.pitch_shift(semitones=2.0)     # 2半音上げ

# ノーマライズと無音トリム
normalized = audio.normalize(target_db=-3.0)
trimmed = audio.trim(threshold_db=-60.0)

# リサンプリング
resampled = audio.resample(target_sr=44100)
```

時間／周波数の領域指定編集には `spectral_edit(samples, sample_rate, [SpectralRegionOp(...)])` を使います。詳しくは [スペクトル編集](./spectral-editing.md) を参照してください。

## ルーム音響解析

これらの関数は、曲の構造ではなく部屋や再生環境を扱います。

| 目的 | 使う API |
|------|----------|
| きれいなインパルス応答を測る | `analyze_impulse_response(...)` |
| 通常音声から部屋の減衰を推定する | `detect_acoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimate_room(...)` |
| 寸法からモノラルのルームインパルス応答（RIR）を作る | `synthesize_rir(...)` |
| 目標ルームの響きを音作り効果として足す | `room_morph(...)` |

::: info 既定値と用語
`analyze_impulse_response(...)` と `detect_acoustic(...)` は `AcousticResult` を返し、RT60、EDT、C50、C80、D50、バンド別配列、信頼度、`is_blind` を含みます。これらの `sample_rate` の既定値は `48000` で、多くの楽曲解析ヘルパーの `22050` とは異なります。RIR は room impulse response（ルームインパルス応答）の略です。RT60 は残響時間で、残響が 60 dB 減衰するまでの長さを指します。C50 と C80 は、初期エネルギーと後期エネルギーの比で明瞭度を表します。
:::

```python
ir = sonare.analyze_impulse_response(ir_samples, sample_rate, n_octave_bands=6, min_decay_db=30.0)
print(ir.rt60, ir.edt, ir.c50, ir.c80, ir.confidence)

blind = sonare.detect_acoustic(
    room_recording,
    sample_rate,
    n_octave_bands=6,
    n_third_octave_subbands=24,
    min_decay_db=30.0,
    noise_floor_margin_db=10.0,
)
print(blind.is_blind, blind.rt60_bands)

estimate = sonare.estimate_room(room_recording, sample_rate, n_octave_bands=6)
print(estimate.volume, estimate.length, estimate.width, estimate.height)
print(estimate.drr_db, estimate.confidence, estimate.absorption_bands)

rir = sonare.synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=sample_rate)
print(rir.sample_rate, len(rir.rir), rir.has_error)

morphed = sonare.room_morph(room_recording, sample_rate, 12.0, 9.0, 4.0, wet=0.6)
```

注意点は 3 つです。

- `estimate_room(...)` は実空間そのものではなく等価ルームを返すため、`confidence` を確認してください。
- `synthesize_rir(...)` は音源／聴取位置が不正な場合に `has_error` で知らせます。
- `room_morph(...)` は音作り効果であり、残響除去ではありません。

値の読み方とブラインド推定を使う場面は [ルーム音響解析](./acoustic-analysis.md) を参照してください。

## エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sample_rate, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS）。既定は `kernel_harmonic=31`、`kernel_percussive=31`、`n_fft=2048`、`hop_length=512`、`hard_mask=False` |
| `hpss_with_residual(samples, sample_rate, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)` | `dict[str, object]` | 倍音、打撃、残差を返す HPSS |
| `harmonic(samples, sample_rate)` | `list[float]` | 倍音成分を抽出 |
| `percussive(samples, sample_rate)` | `list[float]` | 打撃成分を抽出 |
| `time_stretch(samples, sample_rate, rate, n_fft?, hop_length?)` | `list[float]` | ピッチを変えずにテンポ変更。既定は `n_fft=2048`、`hop_length=512` |
| `pitch_shift(samples, sample_rate, semitones, n_fft?, hop_length?)` | `list[float]` | テンポを変えずにピッチ変更。既定は `n_fft=2048`、`hop_length=512` |
| `pitch_correct_to_midi(samples, sample_rate, current_midi?, target_midi?)` | `list[float]` | 目標 MIDI ノートへピッチ補正 |
| `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate?, hop_length?, voiced?, voiced_prob?)` | `list[float]` | コントゥアに沿うピッチ補正。フレームごとの `f0_hz` コントゥアに沿って、有声フレームを `target_midi` へ寄せます。ビブラートやドリフトを平坦化せず保持します |
| `note_stretch(samples, sample_rate, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | 単一ノート区間をその場でストレッチ |
| `note_move(samples, sample_rate, onset_sample?, offset_sample?, target_onset_sample?)` | `list[float]` | ノート区間の長さを変えずに、新しいオンセット位置へ移動 |
| `voice_change(samples, sample_rate, pitch_semitones?, formant_factor?)` | `list[float]` | ピッチとフォルマントを独立にシフト |
| `voice_change_realtime(samples, sample_rate?, preset?, channels?)` | `np.ndarray` | リアルタイム音声プリセットチェーンで 1 回レンダリング |
| `normalize(samples, sample_rate, target_db?)` | `list[float]` | ピークを目標 dB にノーマライズ（既定値: 0.0） |
| `normalize_rms(samples, sample_rate, target_db?)` | `list[float]` | RMS を目標 dB にノーマライズ（既定値: -20.0） |
| `normalize_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | ペア共通の 1 つのゲインでピークノーマライズ（`target_db` 既定 `0.0`） |
| `normalize_rms_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | ペア共通の 1 つのゲインで RMS ノーマライズ（`target_db` 既定 `-20.0`） |
| `remix(samples, intervals, sample_rate?, align_zeros?)` | `np.ndarray` | 区間スライスで並べ替え／連結。`align_zeros` は既定 `False` |
| `remix_aligned_intervals(samples, intervals, sample_rate?, align_zeros?)` | `list[int]` | `remix` が使う切り出し位置だけを解決する（切り出しはしない）。`align_zeros` は既定 `True` |
| `trim(samples, sample_rate, threshold_db?, frame_length?, hop_length?)` | `list[float]` | 無音区間をトリム（既定: `-60.0` dB、`frame_length=2048`、`hop_length=512`） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートへリサンプリング |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の librosa 互換 `trim_silence(...)` はフレーム RMS と `top_db` を使い、トリム後の音声と元音源上のサンプル範囲を返します。

### ステレオペアのノーマライズ

Python はステレオ用のノーマライザを 2 つに分けて持っています。ピーク用の `normalize_stereo` と RMS 用の `normalize_rms_stereo` です（JavaScript 側は 1 つの関数と `mode` 引数で表現します）。どちらもレベルをペア全体で測り、**1 つの共通ゲインを両チャンネルに適用**します。これがステレオイメージを保つ仕組みです。チャンネルごとに自前のゲインでノーマライズすると、2 つのピークが揃うまで小さい側が持ち上がり、レベルではなく定位バランスが変わってしまいます。ゲインが共通なので `NormalizeStereoResult.applied_gain_db` はチャンネルごとの組ではなく単一の値で、すでに無音のペアはそのまま返り、ゲインはちょうど `0` になります。結果は `left`／`right` に加えて、ペア共通のサンプル数 `length` を保持します。

どちらかのチャンネルが空の場合、および 2 つのチャンネルの長さが一致しない場合は拒否されます。C のエントリポイントはペアに対して 1 つのサンプルレートを取るので、2 つのチャンネルがサンプルレートで食い違うことはありません。

```python
result = sonare.normalize_stereo(left, right, 48000, target_db=-3.0)
print(result.length, result.applied_gain_db)
```

### マルチチャンネル素材を共通のフレームで切る

`remix(..., align_zeros=True)` はスライス境界を信号のゼロクロスへスナップしますが、これは信号ごとの判断です。`remix` をチャンネルごとに呼ぶと各チャンネルが別々のフレームへスナップされ、ステレオ素材がずれていきます。`remix_aligned_intervals(...)` は 1 つのチャンネルから切り出し位置を 1 セットだけ解決し（クランプ済みの `(start, end)` ペアのフラットなリスト）、同じフレームで全チャンネルを切り出せるようにします。既定値が意図的に非対称な点に注意してください。`remix` は `align_zeros=False`、`remix_aligned_intervals` は `True` です。

スナップでスライスが消えないよう、ガードが 2 つあります。符号変化がまったくない信号（無音、DC オフセット、あらゆる定数）はスナップされません。また、内容があったのにスナップ後に空へ潰れるスライスは、スナップ前の境界を保ちます。

```python
cuts = sonare.remix_aligned_intervals(left, [0, 48000, 96000, 144000], sample_rate=48000)
left_out = sonare.remix(left, cuts, sample_rate=48000)
right_out = sonare.remix(right, cuts, sample_rate=48000)
```

## リアルタイムボイスチェンジャー

`RealtimeVoiceChanger` は、WASM / Node ネイティブと同じプリセット式のライブ音声チェーンを Python から扱うオブジェクトです。

ハイパス、ゲート、リチューン、フォルマント、EQ、コンプレッサー、ディエッサー、リバーブ、リミッターの状態をブロック間で保持します。

マイク入力やストリームを処理する場合は、オフラインの `voice_change(...)` ではなくこちらを使います。

```python
import json
import libsonare as sonare

print(sonare.realtime_voice_changer_preset_names())
print(sonare.voice_changer_abi_version())  # ネイティブ POD 設定の ABI バージョン
print(sonare.voice_character_preset_id(1))  # "bright-idol"
preset_json = sonare.realtime_voice_changer_preset_json("bright-idol")
print(sonare.validate_realtime_voice_changer_preset_json(preset_json)["ok"])
preset_config = sonare.realtime_voice_changer_preset_config("bright-idol")  # 正規化済み RealtimeVoiceChangerConfig

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config(json.loads(preset_json))
    print(changer.latency_samples(), changer.config_json(), out.shape)

# 同じリアルタイムチェーンを使う単発レンダー。
processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

現在のプリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。組み込み ID はここに示した厳密な文字列です。カスタムマッピングはプリセット JSON のバリデーターを通し、`dsp` または `macros` のどちらか一方だけを持つ必要があります。壊れた形は拒否されます。

JSON ではなく解決済みの POD 設定が必要な場合は、`realtime_voice_changer_preset_config(preset)` を使います。組み込みプリセット（ID またはインデックス）の正規化済み `RealtimeVoiceChangerConfig` を返します。

`realtime_voice_changer_preset_pod(preset)` は互換 alias として残っています。

## librosa 互換ヘルパー

対応する `librosa` 関数の挙動に
合わせています。各ヘルパーが対応する librosa 関数は
[librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trim_silence` / `split_silence`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — 固定フレーム DSP に通す前のフレーミング・サイズ揃え。
- **`peak_pick` / `vector_normalize`** — オンセット強度のような 1 次元信号からのピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮（ノイズ・音量変動に強い特徴量）。
- **`tonnetz`** — クロマグラムを 6 次元のハーモニック空間へ射影。コード関係や転調解析に有効。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現（自己相関、または `mode="cosine"`）と、支配的なパルスの抽出。
- **`fourier_tempogram` / `cyclic_tempogram` / `tempogram_ratio`** — FFT ベースのテンポグラム、オクターブ畳み込みの循環テンポグラム、テンポ比特徴量。
:::

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `preemphasis(samples, coef?, zi?)` | `list[float]` | プリエンファシス（librosa.effects.preemphasis）|
| `deemphasis(samples, coef?, zi?)` | `list[float]` | ディエンファシス（librosa.effects.deemphasis）|
| `trim_silence(samples, top_db?, frame_length?, hop_length?)` | `tuple[list[float], int, int]` | `librosa.effects.trim`。`(audio, start_sample, end_sample)` を返す |
| `split_silence(samples, top_db?, frame_length?, hop_length?)` | `list[tuple[int, int]]` | `librosa.effects.split`。非無音区間をサンプル単位で返す |
| `split_silence_common(signals, top_db?, frame_length?, hop_length?)` | `list[tuple[int, int]]` | 同じパートの複数テイクが揃って無音だと認める切れ目。`signals` はシーケンスのシーケンスを 1 つ取るため、信号数と各信号の長さが食い違うことがない |
| `frame_signal(samples, frame_length, hop_length)` | `tuple[int, list[float]]` | `librosa.util.frame`。`(n_frames, row-major フレーム)` を返す |
| `pad_center(values, size, pad_value?)` | `list[float]` | `librosa.util.pad_center` |
| `fix_length(values, size, pad_value?)` | `list[float]` | `librosa.util.fix_length` |
| `fix_frames(frames, x_min?, x_max?, pad?)` | `list[int]` | `librosa.util.fix_frames` |
| `peak_pick(values, pre_max, post_max, pre_avg, post_avg, delta, wait)` | `list[int]` | `librosa.util.peak_pick`。ピーク位置のインデックスを返す |
| `vector_normalize(values, norm_type?, threshold?)` | `list[float]` | `librosa.util.normalize`。`norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, n_bins, n_frames, sample_rate?, hop_length?, time_constant?, gain?, bias?, power?, eps?)` | `list[float]` | `librosa.pcen`。入力は row-major の `[n_bins x n_frames]` メル |
| `tonnetz(chromagram, n_chroma, n_frames)` | `list[float]` | `librosa.feature.tonnetz`。row-major の `[6 x n_frames]` を返す |
| `tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?, mode?)` | `tuple[int, list[float]]` | `librosa.feature.tempogram`。`mode`: `"autocorrelation"`（既定）または `"cosine"` |
| `fourier_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?)` | `tuple[int, list[float]]` | FFT ベースのテンポグラム（オンセット包絡線の STFT）|
| `cyclic_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, bpm_min?, n_bins?)` | `tuple[int, list[float]]` | オクターブ畳み込みの循環テンポグラム |
| `tempogram_ratio(tempogram_data, win_length?, sample_rate?, hop_length?, factors?)` | `list[float]` | テンポグラムからのテンポ比特徴量 |
| `plp(onset_envelope, sample_rate?, hop_length?, tempo_min?, tempo_max?, win_length?)` | `list[float]` | `librosa.beat.plp`。Predominant Local Pulse |
