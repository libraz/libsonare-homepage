# Python API

libsonare はネイティブ C API を **ctypes** 経由で呼び出す Python バインディングを提供し、デスクトップ環境で高速な音声解析を実現します。対応対象の Linux/macOS 向けに PyPI ホイールを配布しています。

::: details ctypes（と C API）とは？
libsonare のコアはコンパイル済みの C/C++ です。**ctypes** は、コンパイル済み共有ライブラリ（`.so`／`.dylib`）の関数を、追加の C 拡張をビルドせずに直接呼び出せる Python 標準の仕組みです。Python パッケージは、呼び出しを C++ ライブラリと同じネイティブコードへ橋渡しする薄いラッパーなので、素の Python からネイティブ速度を得られます。（「C API」は、そのラッパーが対象とするフラットな C 関数群を指します。）
:::

このページは、スクリプト、ノートブック、バッチ解析、ローカルツールから音声ファイルを直接扱いたい人向けです。ブラウザ UI を作らない場合、Python パッケージが最も入りやすい選択肢になることが多いです。

## Python での考え方

| 手順 | 内容 |
|------|------|
| 1. 音声を読み込む | `Audio.from_file(...)` で対応形式のファイルをサンプルへ読み込む |
| 2. 解析または処理する | `detect_bpm`、`analyze`、特徴量関数、編集 DSP、マスタリング、ミキシング API を呼ぶ |
| 3. 結果を使う | 値を表示する、JSON を保存する、音声を書き出す、自分のパイプラインへ特徴量を渡す |

多くの Python API は、生のサンプル配列と `sample_rate` を受け取ります。`Audio` ラッパーは、ファイルを扱うワークフローを簡単にするためのものです。

## このリファレンスの読み方

このページは 3 段階で読むと迷いにくくなります。

1. ファイルを読むなら `Audio.from_file(...)` から始める。すでにサンプル列があるなら、モジュール直下の関数を直接呼ぶ。
2. 参照全体を眺めるのではなく、[目的から API を選ぶ](#目的から-api-を選ぶ) で関数ファミリーを 1 つ選ぶ。
3. 属性名、行優先の行列形状、JS 互換の別名が必要になったときだけ [型定義](#型定義) に戻る。

Python の `analyze(...)` は意図的にコンパクトです。コード、セクション、音色、ダイナミクス、リズム、メロディ、音響指標が必要なら、下の専用関数を使ってください。

## 目的から API を選ぶ

| やりたいこと | 最初に使う API | 理由 |
|--------------|----------------|------|
| ファイルを読んでメタデータを出すスクリプト | `Audio.from_file(...)` + `detect_bpm` / `detect_key` / `analyze` | Python 側でデコードでき、短いコードで書けます |
| 詳細な楽曲解析 | `analyze_bpm`, `detect_chords`, `analyze_sections`, `analyze_timbre`, `analyze_dynamics`, `analyze_rhythm` | `analyze(...)` の概要より細かい情報を返します |
| ノートブックや ML 用の特徴量 | `mel_spectrogram`, `mfcc`, `chroma`, `cqt`, `vqt`, `nnls_chroma` | Python のリスト／結果オブジェクトで返り、必要なら NumPy に変換できます |
| クリップを編集する | `time_stretch`, `pitch_shift`, `pitch_correct_to_midi`, `note_stretch`, `voice_change` | 解析ではなく音そのものを変えます |
| ファイルをマスタリングする | `master_audio`, `mastering_chain`, `StreamingMasteringChain` | まずプリセット、必要に応じて明示的なチェーン設定を使います |
| ライブ音声やチャンク単位の解析 | `StreamAnalyzer` | 音声ブロックを渡し、特徴フレームと逐次 BPM/キー/コード推定を読み出します |
| ステムをミックスする | `mix_stereo` または `Mixer.from_scene_json(...)` | 一括配列処理から始め、センド・バス・オートメーション・メーターが必要ならシーンミキサーを使います |
| 部屋の残響や明瞭度を測る | `analyze_impulse_response`, `detect_acoustic` | 楽曲ではなく録音空間を説明します |

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

Python の `Audio` object は、WASM の convenience wrapper より広い機能を持ちます。

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
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | 上位候補付きの BPM 解析 |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | シンコペーション・グルーヴ・規則性 |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | ブライトネス・ウォームス・密度・粗さ・複雑さ |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | 楽曲構造のセクション（イントロ／ヴァース／コーラス…） |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | 単音メロディの輪郭（YIN） |
| `analyze_impulse_response(samples, sample_rate, ...)` | `AcousticResult` | インパルス応答からの室内音響（RT60／EDT／C50／C80） |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | ブラインドな室内音響推定 |
| `version()` | `str` | ライブラリバージョン |
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
    key_root=keys[0].root,
    key_mode=keys[0].mode,
    chroma_method="nnls",
)

sections = sonare.analyze_sections(audio.data, audio.sample_rate)
```

## ルーム音響解析

きれいなインパルスレスポンスには `analyze_impulse_response(...)`、通常録音からのブラインド推定には `detect_acoustic(...)` を使います。どちらも `AcousticResult` を返し、RT60、EDT、C50、C80、D50、バンド別配列、信頼度、`is_blind` を含みます。これらの `sample_rate` デフォルトは `48000` で、多くの楽曲解析ヘルパーの `22050` とは異なります。

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
```

値の読み方とブラインド推定を使う場面は [ルーム音響解析](./acoustic-analysis.md) を参照してください。

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS） |
| `harmonic(samples, sr)` | `list[float]` | 倍音成分を抽出 |
| `percussive(samples, sr)` | `list[float]` | 打撃成分を抽出 |
| `time_stretch(samples, sr, rate)` | `list[float]` | ピッチを変えずにテンポ変更 |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | テンポを変えずにピッチ変更 |
| `pitch_correct_to_midi(samples, sr, current_midi?, target_midi?)` | `list[float]` | 目標 MIDI ノートへピッチ補正 |
| `note_stretch(samples, sr, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | 単一ノート区間をその場でストレッチ |
| `voice_change(samples, sr, pitch_semitones?, formant_factor?)` | `list[float]` | ピッチとフォルマントを独立にシフト |
| `normalize(samples, sr, target_db?)` | `list[float]` | 目標 dB にノーマライズ（デフォルト: -3.0） |
| `trim(samples, sr, threshold_db?)` | `list[float]` | 無音区間をトリム（デフォルト: -60.0 dB） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートへリサンプリング |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の librosa 互換
`trim_silence(...)` はフレーム RMS と `top_db` を使い、トリム後の音声と元音源上の
サンプル範囲を返します。

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sr, n_fft?, hop_length?)` | `StftResult` | 短時間フーリエ変換 |
| `stft_db(samples, sr, n_fft?, hop_length?)` | `tuple` | デシベル単位のSTFT |
| `mel_spectrogram(samples, sr, n_fft?, hop_length?, n_mels?)` | `MelSpectrogramResult` | メルスペクトログラム |
| `mfcc(samples, sr, n_fft?, hop_length?, n_mels?, n_mfcc?)` | `MfccResult` | メル周波数ケプストラム係数 |
| `chroma(samples, sr, n_fft?, hop_length?)` | `ChromaResult` | クロマ特徴（ピッチクラス分布） |
| `spectral_centroid(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル重心 |
| `spectral_bandwidth(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル帯域幅 |
| `spectral_rolloff(samples, sr, n_fft?, hop_length?, roll_percent?)` | `list[float]` | フレームごとのスペクトルロールオフ |
| `spectral_flatness(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル平坦度 |
| `zero_crossing_rate(samples, sr, frame_length?, hop_length?)` | `list[float]` | フレームごとのゼロ交差率 |
| `rms_energy(samples, sr, frame_length?, hop_length?)` | `list[float]` | フレームごとのRMSエネルギー |
| `pitch_yin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | YINピッチ推定 |
| `pitch_pyin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | pYINピッチ推定 |
| `cqt(samples, sr, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | 定Q変換の振幅 |
| `vqt(samples, sr, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | 可変Q変換の振幅 |
| `nnls_chroma(samples, sr)` | `tuple[int, list[float]]` | NNLS クロマグラム — `(n_frames, 行優先 12 x n_frames データ)` を返す |
| `onset_envelope(samples, sr, n_fft?, hop_length?, n_mels?)` | `list[float]` | オンセット強度包絡（テンポグラム系の入力） |
| `lufs(samples, sr)` | `LufsResult` | Integrated／momentary／short-term LUFS とラウドネスレンジ（EBU R128） |
| `momentary_lufs(samples, sr)` | `list[float]` | フレームごとの momentary LUFS |
| `short_term_lufs(samples, sr)` | `list[float]` | フレームごとの short-term LUFS |

デフォルトパラメータ: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, ピッチ検出の `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`。CQT/VQT は `fmin=32.70319566` Hz（C1）、`n_bins=84`、`bins_per_octave=12` を使います。

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
    compute_magnitude: bool = True
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

## ストリーミング解析 API

`StreamAnalyzer` は、ライブ入力、コールバックループ、一度に全体解析したくない長いファイル、フレーム単位の可視化のように、音声がブロック単位で届く場面で使います。内部バッファに音声を蓄積しながら、mel/chroma/onset/spectral フレームを出力し、BPM、キー、コード、小節、進行パターンの推定を定期的に更新します。

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
    preset="aiMusic",
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

`mastering_audio_profile()` は任意の profile params として `n_fft`、`hop_length`、`true_peak_oversample` を受け取れます。`mastering_assistant_suggest()` は `target_lufs`、`ceiling_db`、`enable_repair`、`prefer_streaming_safe`、`speech_mono_amount` を受け取ります。共有ネイティブ parser 経由のため camelCase の別名も使えます。

リファレンストラックを使う処理では `mastering_pair_processor_names()`、`mastering_pair_process()`、`mastering_pair_analysis_names()`、`mastering_pair_analyze()` を使います。ペア入力はサンプルレートを揃え、長さもなるべく近づけてください。

### 進捗コールバック

`mastering_chain()`、`mastering_chain_stereo()`、`master_audio()`、
`master_audio_stereo()` は、オプションの `on_progress=callable` キーワードを受け取ります。

この callback は、各ステージ完了時に `(progress: float, stage: str)` で呼び出されます。

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

Python からも libsonare のミキシングエンジンを使えます。ステムを一括でレンダーするだけなら `mix_stereo(...)`、センド、バス、オートメーション、メーター、シーンの保存が必要ならシーン JSON から読み込む `Mixer` を使います。

```python
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json("vocalReverbSend")

offline = sonare.mix_stereo(
    [(vocal_l, vocal_r), (music_l, music_r)],
    sample_rate=48000,
    input_trim_db=[3, 0],
    fader_db=[-3, -12],
    pan=[0, -0.2],
    width=[1, 0.9],
)

with sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512) as mixer:
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
```

ルーティングの考え方、シーンプリセット、リアルタイム処理の注意点は [ミキシングエンジン](./mixing.md) を参照してください。
