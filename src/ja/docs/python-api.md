# Python API

libsonare はネイティブ C API を **ctypes** 経由で呼び出す Python バインディングを提供し、デスクトップ環境で高速な音声解析を実現します。対応対象の Linux/macOS 向けに PyPI ホイールを配布しています。

::: details ctypes（と C API）とは？
libsonare のコアはコンパイル済みの C/C++ です。

**ctypes** は、コンパイル済み共有ライブラリ（`.so`／`.dylib`）の関数を直接呼び出せる Python 標準の仕組みです。追加の C 拡張をビルドする必要はありません。

Python パッケージは、呼び出しを C++ ライブラリと同じネイティブコードへ橋渡しする薄いラッパーです。そのため、素の Python からネイティブ速度を得られます。

ここでいう **C API** は、そのラッパーが対象とするフラットな C 関数群を指します。
:::

このページは、スクリプト、ノートブック、バッチ解析、ローカルツールから音声ファイルを直接扱いたい人向けです。ブラウザ UI を作らない場合、Python パッケージが最も入りやすい選択肢になることが多いです。

## Python での考え方

| 手順 | 内容 |
|------|------|
| 1. 音声を読み込む | `Audio.from_file(...)` で対応形式のファイルをサンプルへ読み込む |
| 2. 解析または処理する | `detect_bpm`、`analyze`、特徴量関数、編集 DSP、マスタリング、ミキシング API を呼ぶ |
| 3. 結果を使う | 値を表示する、JSON を保存する、音声を書き出す、自分のパイプラインへ特徴量を渡す |

多くの Python API は、生のサンプル配列と `sample_rate` を受け取ります。`Audio` ラッパーは、ファイルを扱うワークフローを簡単にするためのものです。

::: tip `Audio` から始めるか、関数を直接呼ぶか
音声ファイルを読むところから始めるなら `Audio.from_file(...)` が入口です。すでに NumPy 配列や別ライブラリで読み込んだサンプルを持っているなら、`detect_bpm(samples, sample_rate)` のようなモジュール直下の関数を直接呼ぶ方が分かりやすくなります。
:::

## このリファレンスの読み方

このページは 3 段階で読むと迷いにくくなります。

1. ファイルを読むなら `Audio.from_file(...)` から始める。すでにサンプル列があるなら、モジュール直下の関数を直接呼ぶ。
2. 参照全体を眺めるのではなく、[目的から API を選ぶ](#目的から-api-を選ぶ) で関数ファミリーを 1 つ選ぶ。
3. 属性名、行優先の行列形状、JS 互換の別名が必要になったときだけ [型定義](#型定義) に戻る。

`analyze(...)` を 1 回呼べば、コード、セクション、音色、ダイナミクス、リズム、メロディ、フォーム、拍ごとの強度を含む完全な結果が返り、他のバインディングと揃っています。1 つのフィールドだけが欲しいときや、呼び出しごとにオプションを変えたいときは、下の専用関数を使ってください。

エラーは `SonareError` を送出します。これは `RuntimeError` のサブクラスで、`.code` 属性にネイティブのエラーコードを保持します。そのため `except RuntimeError:` はそのまま機能し、`except sonare.SonareError as e:` ではコードを取得できます。

## 目的から API を選ぶ

| やりたいこと | 最初に使う API | 理由 |
|--------------|----------------|------|
| ファイルを読んでメタデータを出すスクリプト | `Audio.from_file(...)` + `detect_bpm` / `detect_key` / `analyze` | Python 側でデコードでき、短いコードで書けます |
| 詳細な楽曲解析 | `analyze_bpm`, `detect_chords`, `analyze_sections`, `analyze_timbre`, `analyze_dynamics`, `analyze_rhythm` | `analyze(...)` の概要より細かい情報を返します |
| ノートブックや ML 用の特徴量 | `mel_spectrogram`, `mfcc`, `chroma`, `cqt`, `vqt`, `nnls_chroma` | Python のリスト／結果オブジェクトで返り、必要なら NumPy に変換できます |
| クリップを編集する | `time_stretch`, `pitch_shift`, `pitch_correct_to_midi`, `note_stretch`, `voice_change`, `RealtimeVoiceChanger` | 解析ではなく音そのものを変えます |
| ファイルをマスタリングする | `master_audio`, `mastering_chain`, `StreamingMasteringChain` | まずプリセット、必要に応じて明示的なチェーン設定を使います |
| ライブ音声やチャンク単位の解析 | `StreamAnalyzer` | 音声ブロックを渡し、特徴フレームと逐次 BPM/キー/コード推定を読み出します |
| ステムをミックスする | `mix_stereo` または `Mixer.from_scene_json(...)` | 一括配列処理から始め、センド・バス・オートメーション・メーターが必要ならシーンミキサーを使います |
| 部屋の残響、明瞭度、等価ルーム推定、ルーム生成を扱う | `analyze_impulse_response`, `detect_acoustic`, `estimate_room`, `synthesize_rir`, `room_morph` | 楽曲ではなく録音空間を説明・適用します |

## インストール

Python 3.11 以上が必要です（3.11、3.12、3.13）。

```bash
pip install libsonare
```

`sonare` コマンドもあわせてインストールされます。詳しくは [CLI リファレンス](/ja/docs/cli) をご覧ください。

標準の PyPI ホイールは WAV と MP3 をデコードします。読み込まれているビルドが
FFmpeg デコードに対応しているかは `libsonare.has_ffmpeg_support()` で確認できます。
M4A/AAC/FLAC/OGG/Opus を直接読み込みたい場合は、FFmpeg を有効にしてソースから
インストールします。

```bash
SONARE_FFMPEG=1 pip install libsonare --no-binary libsonare
```

FFmpeg 有効ビルドには FFmpeg の開発ライブラリが必要です。macOS では `brew install ffmpeg`、Debian/Ubuntu 系では `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev` をインストールしてください。

### ソースからビルド（上級者向け）

PyPI のホイールが利用できない環境では、ソースからビルドすることもできます。

**要件:**
- Python 3.11 以上
- CMake 3.16 以上
- C++17 対応コンパイラ（対応対象の Linux/macOS では GCC または Clang）
- `SONARE_FFMPEG=1` でビルドする場合は FFmpeg 開発ライブラリ

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED=ON
cmake --build build -j

cd bindings/python
pip install -e .
```

## クイックスタート

```python
from libsonare import Audio, analyze, detect_bpm, detect_key, detect_beats

# ファイルから音声を読み込み
audio = Audio.from_file("music.mp3")

# 個別の解析
bpm = detect_bpm(audio.data, audio.sample_rate)
key = detect_key(audio.data, audio.sample_rate)
beats = detect_beats(audio.data, audio.sample_rate)

# フル解析
result = analyze(audio.data, audio.sample_rate)
print(f"BPM: {result.bpm} ({result.bpm_confidence:.0%})")
print(f"キー: {result.key}")
print(f"拍子: {result.time_signature}")
print(f"ビート数: {len(result.beat_times)}")
```

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

## 特徴抽出

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# スペクトログラム特徴
stft_result = audio.stft(n_fft=2048, hop_length=512)
mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
mfcc = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)
chroma = audio.chroma(n_fft=2048, hop_length=512)

# スペクトル特徴
centroid = audio.spectral_centroid()
bandwidth = audio.spectral_bandwidth()
rolloff = audio.spectral_rolloff(roll_percent=0.85)
flatness = audio.spectral_flatness()
zcr = audio.zero_crossing_rate()
rms = audio.rms_energy()

# ピッチ検出
pitch_yin = audio.pitch_yin(fmin=65.0, fmax=2093.0)
pitch_pyin = audio.pitch_pyin(fmin=65.0, fmax=2093.0)
print(f"中央値 F0: {pitch_pyin.median_f0:.1f} Hz")
```

::: details ピッチ・特徴量の用語: YIN/pYIN・ゼロ交差率・MIDI ノート番号
- **YIN / pYIN** — 単音の*基本周波数*（体感ピッチ）を推定するアルゴリズムです。YIN は自己相関を使い、pYIN は確率的な平滑化を加えてピッチラインを時間方向に安定させます。いずれも和音ではなく一度に 1 音を追跡します。
- **ゼロ交差率（ZCR）** — 波形が 1 フレームあたり何回ゼロを横切るか。高いとノイズ的・高域的（シンバル、摩擦音）、低いと滑らかで音程的な音を表します。
- **MIDI ノート番号** — ピッチを表す整数で、A4 = 69、中央 C = 60、半音ごとに ±1 です。下の `hz_to_midi` / `midi_to_hz` が Hz とこの尺度を変換します。
:::

## 単位変換

```python
from libsonare import hz_to_mel, mel_to_hz, hz_to_midi, midi_to_hz
from libsonare import hz_to_note, note_to_hz, frames_to_time, time_to_frames

hz_to_mel(440.0)       # → Melスケール値
mel_to_hz(549.64)      # → Hz
hz_to_midi(440.0)      # → 69.0
midi_to_hz(69.0)       # → 440.0
hz_to_note(440.0)      # → "A4"
note_to_hz("A4")       # → 440.0

frames_to_time(100, sr=22050, hop_length=512)  # → 秒
time_to_frames(2.32, sr=22050, hop_length=512) # → フレームインデックス
```

## API リファレンス

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.from_file(path)` | WAV/MP3 ファイルを読み込み。FFmpeg 有効ビルドでは FFmpeg が対応する形式も読み込めます |
| `Audio.from_buffer(data, sample_rate)` | floatサンプルから作成 |
| `Audio.from_memory(data)` | `from_file` と同じ形式対応で、メモリ上のエンコード済み音声をデコード |
| `audio.data` | 生のfloatサンプル |
| `audio.sample_rate` | サンプルレート（Hz） |
| `audio.duration` | 長さ（秒） |
| `audio.length` | サンプル数 |
| `audio.close()` | ネイティブメモリを解放 |

Python の `Audio` オブジェクトは、WASM の簡易ラッパーより広い機能を持ちます。

共通の特徴量・編集・ラウドネス・マスタリング・リサンプリング系メソッドに加えて、`analyze_bpm(...)`、`analyze_impulse_response(...)`、`detect_acoustic(...)`、`analyze_rhythm(...)`、`analyze_dynamics(...)`、`analyze_timbre(...)`、positional な `detect_chords(...)` も使えます。

コンテキストマネージャによる自動クリーンアップに対応:

```python
with Audio.from_file("music.mp3") as audio:
    result = audio.analyze()
```

### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detect_bpm(samples, sample_rate)` | `float` | テンポ（BPM） |
| `detect_key(samples, sample_rate)` | `Key` | ルート、モード、確信度 |
| `detect_beats(samples, sample_rate)` | `list[float]` | ビート位置（秒） |
| `detect_onsets(samples, sample_rate)` | `list[float]` | オンセット位置（秒） |
| `detect_downbeats(samples, sample_rate)` | `list[float]` | ダウンビート位置（秒） |
| `detect_key_candidates(samples, sample_rate, ...)` | `list[KeyCandidate]` | 相関値つきのキー候補（順位付き） |
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | 時系列のコードセグメント |
| `analyze(samples, sample_rate)` | `AnalysisResult` | コア解析: BPM・キー・拍子・ビート |
| `analyze_with_progress(samples, sample_rate, on_progress?)` | `AnalysisResult` | `analyze` と同じ結果に、オプションの `(progress, stage)` コールバックを付けたもの |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | 上位候補付きの BPM 解析 |
| `chord_functional_analysis(samples, key_root, key_mode?, ...)` | `list[str]` | 検出したコードに対する、キーを基準としたローマ数字ラベル（`"I"`、`"IV"`、`"V"`、`"vi"` …） |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | シンコペーション・グルーヴ・規則性 |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | ブライトネス・ウォームス・密度・粗さ・複雑さと、窓ごとの `timbre_over_time`（`timbreOverTime` alias） |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | 楽曲構造のセクション（イントロ／ヴァース／コーラス…） |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | 単音メロディの輪郭（YIN） |
| `analyze_impulse_response(samples, sample_rate, ...)` | `AcousticResult` | インパルス応答からの室内音響（RT60／EDT／C50／C80） |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | ブラインドなルーム音響推定 |
| `estimate_room(samples, sample_rate, ...)` | `RoomEstimate` | 体積、寸法、DRR、吸音率バンド、RT60 バンド、信頼度を含む等価ルーム推定 |
| `synthesize_rir(length_m, width_m, height_m, ...)` | `RirResult` | シューボックス形状からのモノラル RIR |
| `room_morph(samples, sample_rate, length_m, width_m, height_m, ...)` | `list[float]` | 目標ルームへ寄せるオフラインのルームモーフィング |
| `version()` | `str` | ライブラリバージョン |
| `voice_changer_abi_version()` | `int` | リアルタイムボイスチェンジャー POD 設定の ABI バージョン。プリセット JSON の `schemaVersion` とは別 |
| `voice_character_preset_id(preset)` | `str \| None` | 整数の序数から正規の voice-character プリセット ID を返す |
| `realtime_voice_changer_preset_config(preset)` | `RealtimeVoiceChangerConfig` | JSON 解析なしで、組み込みボイスプリセットの解決済みフラット POD 設定を返す |
| `engine_abi_version()` | `int` | リアルタイムエンジンインターフェースの ABI バージョン |
| `has_ffmpeg_support()` | `bool` | 読み込まれたネイティブライブラリが FFmpeg デコードに対応しているか |

コア解析、エフェクト、特徴量、ラウドネス、マスタリングの多くは
`Audio` インスタンスメソッドとしても使えます（例: `audio.detect_bpm()`）。
一方で `analyze_sections(...)`、`analyze_melody(...)`、`cqt(...)`、`vqt(...)`
など一部の詳細ヘルパーはスタンドアロン関数です。これらには `audio.data` と
`audio.sample_rate` を渡してください。

`analyze(...)` を万能 API として扱わず、必要に応じて個別関数を使ってください。Python の `analyze(...)` は BPM、キー、拍子、ビート時刻を返すコンパクトなコア解析です。コード、セクション、メロディ、音色、ダイナミクス、リズム、音響指標は上の専用関数で取得します。

```python
keys = sonare.detect_key_candidates(
    audio.data,
    audio.sample_rate,
    modes=["major", "minor"],
    profile="krumhansl",
)

chords = sonare.detect_chords(
    audio.data,
    audio.sample_rate,
    use_hmm=True,
    use_key_context=True,
    key_root=keys[0].key.root,
    key_mode=keys[0].key.mode,
    chroma_method="nnls",
)

sections = sonare.analyze_sections(audio.data, audio.sample_rate)
```

長いファイルでは、`analyze_with_progress(...)` が `analyze(...)` と同じ `AnalysisResult` を返しつつ、`on_progress=(progress, stage)` コールバックを受け取れます。下のマスタリング進捗コールバックと同じ形です。

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.analyze_with_progress(audio.data, audio.sample_rate, on_progress=on_step)
```

コードをキー基準のローマ数字でラベル付けするには `chord_functional_analysis(...)` を使います。`detect_chords(...)` と同じアルゴリズムでコードを検出し、検出順に 1 コードあたり 1 ラベルを返します。

```python
labels = sonare.chord_functional_analysis(
    audio.data,
    key_root=keys[0].key.root,
    key_mode=keys[0].key.mode,
    sample_rate=audio.sample_rate,
    use_key_context=True,
)
print(labels)  # 例: ['I', 'V', 'vi', 'IV']
```

## ルーム音響解析

これらの関数は、曲の構造ではなく部屋や再生環境を扱います。

| 目的 | 使う API |
|------|----------|
| きれいなインパルスレスポンスを測る | `analyze_impulse_response(...)` |
| 通常音声から部屋の減衰を推定する | `detect_acoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimate_room(...)` |
| 寸法からモノラルのルームインパルスレスポンスを作る | `synthesize_rir(...)` |
| 目標ルームの響きを音作り効果として足す | `room_morph(...)` |

::: info デフォルト値と用語
`analyze_impulse_response(...)` と `detect_acoustic(...)` は `AcousticResult` を返し、RT60、EDT、C50、C80、D50、バンド別配列、信頼度、`is_blind` を含みます。これらの `sample_rate` デフォルトは `48000` で、多くの楽曲解析ヘルパーの `22050` とは異なります。RIR は room impulse response の略です。
:::

```python
ir = sonare.analyze_impulse_response(ir_samples, sample_rate, n_octave_bands=6)
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

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sample_rate, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS） |
| `harmonic(samples, sample_rate)` | `list[float]` | 倍音成分を抽出 |
| `percussive(samples, sample_rate)` | `list[float]` | 打撃成分を抽出 |
| `time_stretch(samples, sample_rate, rate)` | `list[float]` | ピッチを変えずにテンポ変更 |
| `pitch_shift(samples, sample_rate, semitones)` | `list[float]` | テンポを変えずにピッチ変更 |
| `pitch_correct_to_midi(samples, sample_rate, current_midi?, target_midi?)` | `list[float]` | 目標 MIDI ノートへピッチ補正 |
| `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate?, hop_length?, voiced?, voiced_prob?)` | `list[float]` | コントゥアに沿うピッチ補正。フレームごとの `f0_hz` コントゥアに沿って、有声フレームを `target_midi` へ寄せます。ビブラートやドリフトを平坦化せず保持します |
| `note_stretch(samples, sample_rate, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | 単一ノート区間をその場でストレッチ |
| `voice_change(samples, sample_rate, pitch_semitones?, formant_factor?)` | `list[float]` | ピッチとフォルマントを独立にシフト |
| `voice_change_realtime(samples, sample_rate?, preset?, channels?)` | `np.ndarray` | リアルタイム音声プリセットチェーンで 1 回レンダリング |
| `normalize(samples, sample_rate, target_db?)` | `list[float]` | 目標 dB にノーマライズ（デフォルト: 0.0） |
| `trim(samples, sample_rate, threshold_db?)` | `list[float]` | 無音区間をトリム（デフォルト: -60.0 dB） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートへリサンプリング |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の librosa 互換 `trim_silence(...)` はフレーム RMS と `top_db` を使い、トリム後の音声と元音源上のサンプル範囲を返します。

### リアルタイムボイスチェンジャー

`RealtimeVoiceChanger` は、WASM / Node ネイティブと同じプリセット駆動のライブ音声チェーンを Python から扱うラッパーです。

リチューン、フォルマント、EQ、ゲート、コンプレッサー、ディエッサー、リバーブ、リミッターの状態をブロック間で保持します。

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

現在のプリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。

JSON ではなく解決済みの POD 設定が必要な場合は、`realtime_voice_changer_preset_config(preset)` を使います。組み込みプリセット（ID またはインデックス）の正規化済み `RealtimeVoiceChangerConfig` を返します。

`realtime_voice_changer_preset_pod(preset)` は互換 alias として残っています。

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sample_rate, n_fft?, hop_length?)` | `StftResult` | 短時間フーリエ変換 |
| `stft_db(samples, sample_rate, n_fft?, hop_length?)` | `tuple` | デシベル単位の STFT |
| `mel_spectrogram(samples, sample_rate, n_fft?, hop_length?, n_mels?, fmin?, fmax?, htk?)` | `MelSpectrogramResult` | メルスペクトログラム。`fmin`/`fmax` で帯域の端を指定し、`htk=True` で HTK 方式のメル公式を使います |
| `mfcc(samples, sample_rate, n_fft?, hop_length?, n_mels?, n_mfcc?, fmin?, fmax?, htk?)` | `MfccResult` | メル周波数ケプストラム係数 |
| `chroma(samples, sample_rate, n_fft?, hop_length?)` | `ChromaResult` | クロマ特徴（ピッチクラス分布） |
| `spectral_centroid(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル重心 |
| `spectral_bandwidth(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル帯域幅 |
| `spectral_rolloff(samples, sample_rate, n_fft?, hop_length?, roll_percent?)` | `list[float]` | フレームごとのスペクトルロールオフ |
| `spectral_flatness(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル平坦度 |
| `spectral_contrast(samples, sample_rate?, n_fft?, hop_length?, n_bands?, fmin?, quantile?)` | `np.ndarray` | スペクトルコントラスト。形状は `(n_bands + 1, n_frames)` |
| `poly_features(samples, sample_rate?, n_fft?, hop_length?, order?)` | `np.ndarray` | フレームごとの多項式スペクトル係数 |
| `zero_crossing_rate(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | フレームごとのゼロ交差率 |
| `zero_crossings(samples, threshold?, ref_magnitude?, pad?, zero_pos?)` | `np.ndarray` | 波形がゼロを横切るサンプル位置 |
| `rms_energy(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | フレームごとの RMS エネルギー |
| `pitch_yin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | YIN ピッチ推定。無声音の `f0` は `fill_na=True` でない限り `nan` |
| `pitch_pyin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | pYIN ピッチ推定。無声音の `f0` は `fill_na=True` でない限り `nan` |
| `pitch_tuning(frequencies, resolution?, bins_per_octave?)` | `float` | 検出済み周波数からビン単位のチューニングずれを推定 |
| `estimate_tuning(samples, sample_rate?, n_fft?, hop_length?, resolution?, bins_per_octave?)` | `float` | 音声からチューニングずれを直接推定 |
| `cqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | 定Q変換の振幅 |
| `vqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | 可変Q変換の振幅 |
| `nnls_chroma(samples, sample_rate)` | `tuple[int, list[float]]` | NNLS クロマグラム — `(n_frames, 行優先 12 x n_frames データ)` を返す |
| `decompose(s, n_features, n_frames, n_components, n_iter?, beta?)` | `tuple` | 行優先スペクトログラムから NMF 分解係数 `(w, h)` を返す |
| `nn_filter(s, n_features, n_frames, aggregate?, k?, width?)` | `np.ndarray` | 行優先スペクトログラムの近傍フィルタ |
| `onset_envelope(samples, sample_rate, n_fft?, hop_length?, n_mels?)` | `list[float]` | オンセット強度包絡（テンポグラム系の入力） |
| `lufs(samples, sample_rate)` | `LufsResult` | Integrated／momentary／short-term LUFS とラウドネスレンジ（EBU R128） |
| `lufs_interleaved(samples, channels, sample_rate?)` | `LufsResult` | インターリーブされたサンプルからチャンネル重み付きマルチチャンネルラウドネスを測定 |
| `ebur128_loudness_range(samples, sample_rate?)` | `float` | EBU R128 loudness range（LRA、LU 単位） |
| `momentary_lufs(samples, sample_rate)` | `list[float]` | フレームごとの momentary LUFS |
| `short_term_lufs(samples, sample_rate)` | `list[float]` | フレームごとの short-term LUFS |

デフォルトパラメータ: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, ピッチ検出の `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`。CQT/VQT は `fmin=32.70319566` Hz（C1）、`n_bins=84`、`bins_per_octave=12` を使います。

追加のエフェクト系ヘルパーとして `remix(samples, intervals, sample_rate?, align_zeros?)`、`phase_vocoder(samples, sample_rate?, rate?)`、`hpss_with_residual(samples, sample_rate?, kernel_harmonic?, kernel_percussive?)` も利用できます。librosa 型の区間リミックス、直接のフェーズボコーダー時間伸縮、残差信号を保持した HPSS が必要な場合に使います。

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため、元音声への完全な往復変換ではありません。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。行列入力は行優先（row-major）です。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `mel_to_stft(mel, n_mels, n_frames, sample_rate?, n_fft?, fmin?, fmax?, htk?)` | `InverseResult` | メルスペクトログラムからリニア STFT パワー |
| `mel_to_audio(mel, n_mels, n_frames, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | メルスペクトログラムから音声（Griffin-Lim） |
| `mfcc_to_mel(mfcc_coeffs, n_mfcc, n_frames, n_mels?)` | `InverseResult` | MFCC 係数からメルスペクトログラム（dB） |
| `mfcc_to_audio(mfcc_coeffs, n_mfcc, n_frames, n_mels?, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | MFCC 係数から音声 |

`fmin`/`fmax` に `0.0` を渡すと全帯域の既定値、`n_iter` は既定 `32` です。往復変換の整合性を保つため、`fmin`/`fmax`/`htk` は順変換で使った値と同じにしてください。

### メータリング関数

レベル、ダイナミクス、ステレオイメージを測る単体メーターです。各関数はキーワード専用の `validate` フラグ（既定 `True`）を受け取ります。

ホットパスでは `validate=False` を渡して NaN/Inf 入力チェックを省略できます。

ステレオメーターは `left` と `right` が同じ長さである必要があります。`sample_rate` の既定値は `22050` です。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `metering_peak_db(samples, sample_rate?, *, validate?)` | `float` | サンプルピーク（dBFS） |
| `metering_rms_db(samples, sample_rate?, *, validate?)` | `float` | RMS レベル（dBFS） |
| `metering_crest_factor_db(samples, sample_rate?, *, validate?)` | `float` | クレストファクター。ピーク − RMS（dB） |
| `metering_dc_offset(samples, sample_rate?, *, validate?)` | `float` | 平均（DC）オフセット、リニア振幅 |
| `metering_true_peak_db(samples, sample_rate?, oversample_factor?, *, validate?)` | `float` | インターサンプル（トゥルー）ピーク（dBFS）。`oversample_factor` は 1..16 の 2 の冪（0 で既定 4） |
| `metering_detect_clipping(samples, sample_rate?, threshold?, min_region_samples?, *, validate?)` | `ClippingReport` | クリップしたサンプルの連続区間。`threshold` 既定 `0.999`、`min_region_samples` 既定 `1` |
| `metering_dynamic_range(samples, sample_rate?, window_sec?, hop_sec?, low_percentile?, high_percentile?, *, validate?)` | `DynamicRangeReport` | スライディングウィンドウのダイナミックレンジ。`0.0` で既定値（窓 3 秒・ホップ 1 秒・low 0.10・high 0.95） |
| `metering_stereo_correlation(left, right, sample_rate?, *, validate?)` | `float` | ピアソン相関、−1..1 |
| `metering_stereo_width(left, right, sample_rate?, *, validate?)` | `float` | ミッド/サイドのステレオ幅 |
| `metering_vectorscope(left, right, sample_rate?, *, validate?)` | `VectorscopeReport` | サンプルごとのミッド/サイド点列 |
| `metering_phase_scope(left, right, sample_rate?, *, validate?)` | `PhaseScopeReport` | フェーズスコープの点列と要約統計 |
| `metering_spectrum(samples, sample_rate?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | 単一フレームの振幅/パワー/dB スペクトラム。`n_fft`/`octave_fraction`/`db_ref`/`db_amin` に `0` で既定値（2048 / 3 / 1.0 / 下限値） |

### スケール量子化

ピッチ補正ターゲットを構築するための 12-TET スケールヘルパーです。

`mode_mask` は 12 ビットのマスクです。ビット *i* が、`root`（`PitchClass`、C = 0）を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。

`reference_midi` はチューニング基準音です。A4 = 69 にするには `0.0` を渡します。`pitch_correct_to_midi(...)` と組み合わせると、最も近いスケール構成音へリチューンできます。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `scale_quantize_midi(root, mode_mask, midi, reference_midi?)` | `float` | 小数を含む MIDI 番号を最も近い有効なピッチクラスへスナップ |
| `scale_correction_semitones(root, mode_mask, midi, reference_midi?)` | `float` | 補正量（量子化後 − 入力）をセミトーンで返す |
| `scale_pitch_class_enabled(root, mode_mask, pitch_class)` | `bool` | `pitch_class`（0..11）が `root` を基準に有効か |

### librosa 互換ヘルパー

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
| `frame_signal(samples, frame_length, hop_length)` | `tuple[int, list[float]]` | `librosa.util.frame`。`(n_frames, row-major フレーム)` を返す |
| `pad_center(values, size, pad_value?)` | `list[float]` | `librosa.util.pad_center` |
| `fix_length(values, size, pad_value?)` | `list[float]` | `librosa.util.fix_length` |
| `fix_frames(frames, x_min?, x_max?, pad?)` | `list[int]` | `librosa.util.fix_frames` |
| `peak_pick(values, pre_max, post_max, pre_avg, post_avg, delta, wait)` | `list[int]` | `librosa.util.peak_pick`。ピーク位置のインデックスを返す |
| `vector_normalize(values, norm_type?, threshold?)` | `list[float]` | `librosa.util.normalize`。`norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, n_bins, n_frames, sample_rate?, hop_length?, time_constant?, gain?, bias?, power?, eps?)` | `list[float]` | `librosa.pcen`。入力は row-major の `[n_bins x n_frames]` メル |
| `tonnetz(chromagram, n_chroma, n_frames)` | `list[float]` | `librosa.feature.tonnetz`。row-major の `[6 x n_frames]` を返す |
| `tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?, mode?)` | `tuple[int, list[float]]` | `librosa.feature.tempogram`。`mode`: `"autocorrelation"`（既定）または `"cosine"` |
| `fourier_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?)` | `tuple[int, list[float]]` | FFT ベースのテンポグラム（オンセット包絡の STFT）|
| `cyclic_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, bpm_min?, n_bins?)` | `tuple[int, list[float]]` | オクターブ畳み込みの循環テンポグラム |
| `tempogram_ratio(tempogram_data, win_length?, sample_rate?, hop_length?, factors?)` | `list[float]` | テンポグラムからのテンポ比特徴量 |
| `plp(onset_envelope, sample_rate?, hop_length?, tempo_min?, tempo_max?, win_length?)` | `list[float]` | `librosa.beat.plp`。Predominant Local Pulse |

### 変換関数

| 関数 | 説明 |
|------|------|
| `hz_to_mel(hz)` | ヘルツ → Melスケール |
| `mel_to_hz(mel)` | Melスケール → ヘルツ |
| `hz_to_midi(hz)` | ヘルツ → MIDIノート番号 |
| `midi_to_hz(midi)` | MIDIノート番号 → ヘルツ |
| `hz_to_note(hz)` | ヘルツ → 音名（例: "A4"） |
| `note_to_hz(note)` | 音名 → ヘルツ |
| `frames_to_time(frames, sr, hop_length)` | フレームインデックス → 秒 |
| `time_to_frames(time, sr, hop_length)` | 秒 → フレームインデックス |
| `frames_to_samples(frames, hop_length?, n_fft?)` | フレームインデックス → サンプルインデックス（librosa.frames_to_samples）|
| `samples_to_frames(samples, hop_length?, n_fft?)` | サンプルインデックス → フレームインデックス（librosa.samples_to_frames）|
| `power_to_db(values, ref?, amin?, top_db?)` | パワー → dB（librosa.power_to_db）|
| `amplitude_to_db(values, ref?, amin?, top_db?)` | 振幅 → dB（librosa.amplitude_to_db）|
| `db_to_power(values, ref?)` | dB → パワー |
| `db_to_amplitude(values, ref?)` | dB → 振幅 |

### 型定義

結果オブジェクトは属性アクセスできる通常のクラスです。多くは JS との対応の
ため camelCase のプロパティ別名（例: `bpm_confidence` / `bpmConfidence`）も
公開します。以下はデータフィールドの形です。

```python
class PitchClass(IntEnum):
    C, CS, D, DS, E, F, FS, G, GS, A, AS, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1
    DORIAN = 2
    PHRYGIAN = 3
    LYDIAN = 4
    MIXOLYDIAN = 5
    LOCRIAN = 6

class KeyProfile(IntEnum):
    KRUMHANSL_SCHMUCKLER = 0
    TEMPERLEY = 1
    SHAATH = 2
    FARALDO_EDMT = 3
    FARALDO_EDMA = 4
    FARALDO_EDMM = 5
    BELLMAN_BUDGE = 6

class Key:
    root: PitchClass
    mode: Mode
    confidence: float
    name: str          # プロパティ -> "C major"、"A minor" など
    short_name: str    # プロパティ -> "C"、"Am" など

class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
    beats: list[Beat]              # プロパティ: 各拍の強度を持つオブジェクト
    # コード・セクション・音色・ダイナミクス・リズムは、専用の
    # detect_chords() / analyze_sections() / analyze_timbre() / ... を呼ぶ。

class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

class PitchResult:
    n_frames: int
    f0: list[float]          # フレームごとの基本周波数（Hz）
    voiced_prob: list[float] # フレームごとの有声確率（0–1）
    voiced_flag: list[bool]  # フレームごとの有声/無声判定
    median_f0: float
    mean_f0: float

class StreamConfig:
    sample_rate: int = 44100
    n_fft: int = 2048
    hop_length: int = 512
    n_mels: int = 128
    fmin: float = 0.0
    fmax: float = 0.0
    tuning_ref_hz: float = 440.0
    compute_magnitude: bool = False
    compute_mel: bool = True
    compute_chroma: bool = True
    compute_onset: bool = True
    compute_spectral: bool = True
    emit_every_n_frames: int = 1
    magnitude_downsample: int = 1
    key_update_interval_sec: float = 5.0
    bpm_update_interval_sec: float = 10.0
    window: int = 0          # 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
    output_format: int = 0  # 0=Float32, 1=Int16, 2=Uint8

class StreamFrames:
    n_frames: int
    n_mels: int
    timestamps: list[float]
    mel: list[float]        # n_frames × n_mels, row-major
    chroma: list[float]     # n_frames × 12, row-major
    onset_strength: list[float]
    rms_energy: list[float]
    spectral_centroid: list[float]
    spectral_flatness: list[float]
    chord_root: list[int]
    chord_quality: list[int]
    chord_confidence: list[float]

class StreamChordChange:
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamBarChord:
    bar_index: int
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamPatternScore:
    name: str
    score: float

class StreamStats:
    total_frames: int
    total_samples: int
    duration_seconds: float
    bpm: float
    bpm_confidence: float
    bpm_candidate_count: int
    key: int
    key_minor: bool
    key_confidence: float
    chord_root: int
    chord_quality: int
    chord_confidence: float
    chord_start_time: float
    current_bar: int
    bar_duration: float
    chord_progression: list[StreamChordChange]
    bar_chord_progression: list[StreamBarChord]
    voted_pattern: list[StreamBarChord]
    pattern_length: int
    detected_pattern_name: str
    detected_pattern_score: float
    all_pattern_scores: list[StreamPatternScore]
    accumulated_seconds: float
    used_frames: int
    updated: bool
```

個別 API が返す追加の Python result class:

| 分野 | クラス |
|------|--------|
| メータリング | `ClippingRegion`, `StreamFramesU8`, `StreamFramesI16` |
| マスタリング | `MasteringResult`, `MasteringStereoResult` |
| リアルタイムエンジンのテレメトリ | `MeterTelemetryRecord` |

## ストリーミング解析 API

`StreamAnalyzer` は、音声がブロック単位で届く場面で使います。たとえば、ライブ入力、コールバックループ、一度に全体解析したくない長いファイル、フレーム単位の可視化です。

内部バッファに音声を蓄積しながら、mel/chroma/onset/spectral フレームを出力します。BPM、キー、コード、小節、進行パターンの推定も定期的に更新します。

```python
import libsonare as sonare

stream = sonare.StreamAnalyzer(
    sonare.StreamConfig(
        sample_rate=44100,
        n_mels=64,
        emit_every_n_frames=4,
        output_format=0,  # 0=Float32, 1=Int16, 2=Uint8
    )
)

for block in audio_blocks:
    stream.process(block)

    frames = stream.read_frames(stream.available_frames())
    # frames.mel は [n_frames * n_mels] のフラット配列
    # frames.chroma は [n_frames * 12] のフラット配列

    stats = stream.stats()
    if stats.bpm > 0:
        print(stats.bpm, stats.bpm_confidence)

stream.close()
```

UI 転送量を抑える場合は、`read_frames(max_frames)` の代わりに量子化読み出しを使います。

| メソッド | 変わる点 |
|----------|----------|
| `read_frames_u8(max_frames)` | 特徴量配列を unsigned 8-bit 値へ量子化します。 |
| `read_frames_i16(max_frames)` | 特徴量配列を signed 16-bit 値へ量子化します。 |

どちらもタイムスタンプは float のまま保持します。外部の音声クロックと同期したい場合は、`process_with_offset(samples, sample_offset)` でチャンク開始位置を明示してください。

## ストリーミング EQ API

`StreamingEqualizer` は、ネイティブのブロック処理 EQ エンジンを Python から扱うラッパーです。ライブプレビュー、プロセッサ UI、マスタリングチェーンを組まずにソースの音色をリファレンスへ寄せる用途に使えます。

```python
with sonare.StreamingEqualizer(sample_rate=48000, max_block_size=512) as eq:
    eq.set_band(0, {"type": "bell", "frequencyHz": 2500, "gainDb": 2.5, "q": 1.0})
    eq.set_phase_mode("natural")
    eq.set_auto_gain(True)
    eq.match(source_samples, reference_samples, max_bands=8)
    out = eq.process_mono(input_block)
    snapshot = eq.spectrum()
```

バンドは Python の辞書または JSON 文字列で渡せます。`set_phase_mode(...)` は `zero` / `natural` / `linear` の名前、または数値を受け取ります。出力ゲイン／パン、ダイナミックバンド用のサイドチェイン入力、`process_stereo(...)`、`spectrum()`、`latency_samples`、`last_auto_gain_db` も利用できます。

## マスタリング API

Python からもブラウザデモと同じ名前付きマスタリングプロセッサを利用できます。まず一覧取得用のヘルパー関数で、現在のビルドに含まれるプロセッサ名を確認したうえで、モノラル／ステレオ／ペア／解析の各 API をパラメータ明示で呼び出します。

```python
import json
import libsonare as sonare

print(sonare.mastering_processor_names())
# 例: ['dynamics.compressor', 'eq.parametric', 'spectral.airBand', 'stereo.imager', ...]

result = sonare.mastering_process(
    "spectral.airBand",
    samples,
    sample_rate=sample_rate,
    params={
        "amount": 0.4,
        "shelfFrequencyHz": 14000,
    },
)

report = sonare.mastering_stereo_analyze(
    "stereo.monoCompatCheck",
    left,
    right,
    sample_rate=sample_rate,
)
print(json.loads(report))

# プリセット駆動のチェーン（一括処理）
sonare.mastering_preset_names()
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech', 'streaming', 'youtube', 'broadcast', 'podcast', 'audiobook', 'cinema', 'jpop', 'ambient', 'lofi', 'classical', 'drumAndBass', 'techno', 'metal', 'trap', 'rnb', 'jazz', 'kpop', 'trance', 'gameOst']
chain_result = sonare.master_audio(
    samples,
    sample_rate=sample_rate,
    preset_name="aiMusic",
    overrides={"loudness.targetLufs": -13},
)
print(chain_result.output_lufs, chain_result.applied_gain_db)

# ブロック単位のストリーミング処理
with sonare.StreamingMasteringChain({
    "eq.tilt.tiltDb": 0.5,
    "dynamics.compressor.thresholdDb": -20.0,
}) as chain:
    chain.prepare(sample_rate=48000, max_block_size=512, num_channels=1)
    out_block = chain.process_mono([0.0] * 512)

profile = json.loads(sonare.mastering_audio_profile(samples, sample_rate=sample_rate, params={
    "n_fft": 2048,
    "hop_length": 512,
    "true_peak_oversample": 4,
}))
suggestions = json.loads(sonare.mastering_assistant_suggest(samples, sample_rate=sample_rate, params={
    "target_lufs": -14,
    "ceiling_db": -1,
    "prefer_streaming_safe": True,
}))
preview = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sample_rate, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

`mastering_audio_profile()` は任意のプロファイル設定として `n_fft`、`hop_length`、`true_peak_oversample` を受け取れます。`mastering_assistant_suggest()` は `target_lufs`、`ceiling_db`、`enable_repair`、`prefer_streaming_safe`、`speech_mono_amount` を受け取ります。共有ネイティブパーサーを通るため、camelCase の別名も使えます。

リファレンストラックを使う処理では `mastering_pair_processor_names()`、`mastering_pair_process()`、`mastering_pair_analysis_names()`、`mastering_pair_analyze()` を使います。ペア入力はサンプルレートを揃え、長さもなるべく近づけてください。

### 単発のダイナミクスとリペア

名前付きの各ステージは、単発のモジュールレベル関数としても利用できます。チェーンを組まずに 1 つのプロセッサだけを実行できます。

パラメータはキーワード専用で、対応する `MasteringChainConfig` のキーを snake_case にしたものです。

ダイナミクス系は `(processed_samples, latency_samples)` のタプルを返し、`latency_samples` は `int` です。リペア系は処理後サンプル（`np.ndarray`）を返します。

| 関数 | 戻り値 | 主なパラメータ |
|------|--------|----------------|
| `mastering_dynamics_compressor(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `threshold_db=-18.0`、`ratio=2.0`、`attack_ms=10.0`、`release_ms=100.0`、`knee_db`、`makeup_gain_db`、`auto_makeup`、`detector='rms'`、`sidechain_hpf_enabled`、`sidechain_hpf_hz`、`pdr_time_ms`、`pdr_release_scale` |
| `mastering_dynamics_gate(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `threshold_db=-50.0`、`attack_ms=2.0`、`release_ms=80.0`、`range_db=-80.0`、`hold_ms`、`close_threshold_db`、`key_hpf_hz` |
| `mastering_dynamics_transient_shaper(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `attack_gain_db=3.0`、`sustain_gain_db`、`fast_attack_ms`、`fast_release_ms=20.0`、`slow_attack_ms=15.0`、`slow_release_ms=200.0`、`sensitivity=1.0`、`max_gain_db=12.0`、`gain_smoothing_ms`、`lookahead_ms` |
| `mastering_repair_declick(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.8`、`neighbor_ratio=4.0`、`max_click_samples=8`、`lpc_order=20`、`residual_ratio=8.0` |
| `mastering_repair_declip(samples, sample_rate?, *, ...)` | `np.ndarray` | `clip_threshold=0.98`、`lpc_order=36`、`iterations=2`、`lpc_blend=0.65` |
| `mastering_repair_decrackle(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.4`、`mode='median'`、`levels=4` |
| `mastering_repair_dehum(samples, sample_rate?, *, ...)` | `np.ndarray` | `fundamental_hz=50.0`、`harmonics=4`、`q=20.0`、`adaptive`、`search_range_hz`、`adaptation`、`frame_size`、`pll_bandwidth` |
| `mastering_repair_denoise_classical(samples, sample_rate?, *, ...)` | `np.ndarray` | `mode='logMmse'`、`noise_estimator='quantile'`、`n_fft=1024`、`hop_length=256`、`dd_alpha=0.98`、`gain_floor=0.05`、`over_subtraction=2.0`、`spectral_floor=0.05`、`noise_estimation_quantile=0.1`、`speech_presence_gain`、`gain_smoothing` |
| `mastering_repair_dereverb_classical(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.05`、`attenuation=0.5`、`n_fft=1024`、`hop_length=256`、`t60_sec=0.4`、`late_delay_ms=50.0`、`over_subtraction`、`spectral_floor`、`wpe_enabled`、`wpe_iterations`、`wpe_taps`、`wpe_strength` |
| `mastering_repair_trim_silence(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.001`、`padding_samples=0`、`mode='peak'`、`gate_lufs=-60.0`、`window_ms=400.0` |

リペア系のステージはオフライン専用で、`StreamingMasteringChain` では拒否されます。これらの単発ヘルパー、または `mastering_chain*` / `master_audio*` の中で実行してください。詳細は [ダイナミクス](./glossary/mastering/dynamics.md) と [リペア](./glossary/mastering/repair.md) を参照してください。

### 進捗コールバック

`mastering_chain()`、`mastering_chain_stereo()`、`master_audio()`、
`master_audio_stereo()` は、オプションの `on_progress=callable` キーワードを受け取ります。

このコールバックは、各ステージ完了時に `(progress: float, stage: str)` で呼び出されます。

| 値 | 意味 |
|----|------|
| `progress` | `0.0`〜`1.0` の全体進捗。 |
| `stage` | 完了した名前付きプロセッサ。例: `eq.tilt`, `dynamics.compressor`, `loudness.targetLufs`。 |

UI の進捗バー表示や、ステージごとの所要時間ロギングに利用できます。

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.mastering_chain(
    samples,
    sample_rate=sample_rate,
    config={"loudness": {"targetLufs": -14, "ceilingDb": -1}},
    on_progress=on_step,
)
```

マスタリング API は次の系統に分かれます。

| 目的 | 関数 |
|------|------|
| シンプルなラウドネスマスタリング | `mastering()` |
| 組み込みプリセット一覧 | `mastering_preset_names()` |
| プリセットをモノラルに適用 | `master_audio()` |
| プリセットをステレオに適用 | `master_audio_stereo()` |
| フルチェーン実行（モノラル） | `mastering_chain()` |
| フルチェーン実行（ステレオ） | `mastering_chain_stereo()` |
| ブロック単位のストリーミング | `StreamingMasteringChain` |
| マスタリング判断用の音源プロファイルを取得 | `mastering_audio_profile()` |
| 音源解析からマスタリングの提案を取得 | `mastering_assistant_suggest()` |
| 配信先ごとのラウドネス見込みをプレビュー | `mastering_streaming_preview()` |
| 名前付きプロセッサ一覧（モノラル／ステレオ） | `mastering_processor_names()` |
| モノラルプロセッサを単体で実行 | `mastering_process()` |
| ステレオプロセッサを単体で実行 | `mastering_process_stereo()` |
| ペアプロセッサ一覧 | `mastering_pair_processor_names()` |
| ソース／リファレンスのペア処理 | `mastering_pair_process()` |
| ペア解析の一覧 | `mastering_pair_analysis_names()` |
| ソース／リファレンスのペア解析 | `mastering_pair_analyze()` |
| ステレオ解析の一覧 | `mastering_stereo_analysis_names()` |
| ステレオチャンネル解析 | `mastering_stereo_analyze()` |

関連するマスタリングガイド: [プリセット選択](./glossary/mastering/preset-selection.md)、[配信ターゲット](./glossary/mastering/delivery-targets.md)、[メーターの読み方](./glossary/mastering/meter-reading.md)、[品質チェックリスト](./glossary/mastering/quality-checklist.md)。

## ミキシング API

Python からも libsonare のミキシングエンジンを使えます。ステムを一括でレンダーするだけなら `mix_stereo(...)`、センド、バス、オートメーション、メーター、シーンの保存が必要ならシーン JSON から読み込む `Mixer` を使います。組み込みのシーンプリセット一覧は `mixing_scene_preset_names()` で取得できます。

```python
import libsonare as sonare

print(sonare.mixing_scene_preset_names())
scene_json = sonare.mixing_scene_preset_json("vocalReverbSend")

offline = sonare.mix_stereo(
    [(vocal_l, vocal_r), (music_l, music_r)],
    sample_rate=48000,
    input_trim_db=[3, 0],
    fader_db=[-3, -12],
    pan=[0, -0.2],
    width=[1, 0.9],
)

# Mixer はコンテキストマネージャではありません。使い終わったら close() を呼びます。
mixer = sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512)
try:
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
finally:
    mixer.close()
```

ルーティングの考え方、シーンプリセット、リアルタイム処理の注意点は [ミキシングエンジン](./mixing.md) を参照してください。

## プロジェクト・インストゥルメント・ライブ MIDI

ヘッドレス DAW の機能群は Python からも利用できます。`Project` でアレンジを作り、組み込みインストゥルメントでレンダーし、ライブ MIDI でリアルタイムエンジンを駆動できます。詳細は各専用ガイドにあります。ここは Python の入口をまとめたマップです。

| やりたいこと | API | ガイド |
|--------------|-----|--------|
| トラック、クリップ、テンポ、マーカー、undo/redo を編集する | `Project`（コンテキストマネージャ。`with` を使う） | [プロジェクト編集](./project-editing.md) |
| 組み込みシンセサイザーで MIDI をレンダーする | `Project.bounce_with_synth_instrument(...)`、`synth_preset_names()`、`SynthPatch` | [組み込みシンセサイザー](./native-synth.md)、[プロジェクトのバウンス](./project-bounce.md) |
| SoundFont で MIDI をレンダーする | `Project.load_soundfont(data)`、`Project.bounce_with_sf2_instrument(...)` | [SoundFont プレイヤー](./soundfont-player.md) |
| バウンス中に自前のインストゥルメントをホストする | `ExternalInstrument` プロトコルを使う `Project.bounce_with_instruments(...)`。`render(channels, num_frames)` コールバックに加え、任意の `prepare`/`on_event` フックと `latency_samples` を持ちます。**Python 専用です**。 | [プロジェクトのバウンス](./project-bounce.md) |
| MIDI イベントからインストゥルメントをライブ演奏する | `RealtimeEngine.set_synth_instrument(...)`、`RealtimeEngine.load_soundfont(...)`、およびエンジンの MIDI 入力キュー | [MIDI 入力](./midi-input.md) |

```python
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    track = project.add_track(kind="midi")
    # ... クリップと MIDI イベントを追加（プロジェクト編集ガイドを参照） ...
    audio = project.bounce_with_synth_instrument("e-piano", num_channels=2)
```

`Project` は自動クリーンアップのために `with` に対応しますが、`Mixer` は対応しません（`mixer.close()` を明示的に呼んでください）。
