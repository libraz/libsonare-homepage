# Python API

libsonare は、スクリプト、ノートブック、バッチ処理、ローカルツール向けの Python バインディングを提供します。Python パッケージは **ctypes** 経由でネイティブの libsonare ライブラリを呼び出すため、独自の C 拡張をビルドしなくても、コンパイル済みの C/C++ エンジンを Python から使えます。対応対象の Linux/macOS 向けに PyPI ホイールを配布しています。

::: details ctypes（と C API）とは？
libsonare のコアはコンパイル済みの C/C++ です。

**ctypes** は、コンパイル済み共有ライブラリ（`.so`／`.dylib`）の関数を直接呼び出せる Python 標準の仕組みです。追加の C 拡張をビルドする必要はありません。

Python パッケージは、呼び出しを C++ ライブラリと同じネイティブコードへ橋渡しします。そのため、素の Python からネイティブ速度を得られます。

ここでいう **C API** は、Python が内部で呼び出すフラットな C 関数群を指します。
:::

このページは、スクリプト、ノートブック、バッチ解析、ローカルツールから音声ファイルを直接扱いたい人向けです。ブラウザ UI を作らない場合、Python パッケージが最も入りやすい選択肢になることが多いです。

## Python での考え方

| 手順 | 内容 |
|------|------|
| 1. 音声を読み込む | `Audio.from_file(...)` で対応形式のファイルをサンプルへ読み込む |
| 2. 解析または処理する | `detect_bpm`、`analyze`、特徴量関数、編集 DSP、マスタリング、ミキシング API を呼ぶ |
| 3. 結果を使う | 値を表示する、JSON を保存する、音声を書き出す、自分のパイプラインへ特徴量を渡す |

多くの Python API は、生のサンプル配列と `sample_rate` を受け取ります。生のサンプル配列とは、MP3 や WAV のファイル名ではなく、デコード後の音声値の並びです。`Audio` オブジェクトは、ファイルを扱うワークフローを簡単にするためのものです。一度読み込んだ音声に対して、解析や処理のメソッドを続けて呼べます。

最初のスクリプトは、これくらい小さく始めるのがおすすめです。

1. `audio = sonare.Audio.from_file("song.mp3")`
2. `sonare.detect_bpm(audio.data, audio.sample_rate)` または `sonare.analyze(audio.data, audio.sample_rate)` を呼ぶ。
3. 結果を表示するか、JSON として保存する。

::: tip `Audio` から始めるか、関数を直接呼ぶか
音声ファイルを読むところから始めるなら `Audio.from_file(...)` が入口です。すでに NumPy 配列や別ライブラリで読み込んだサンプルを持っているなら、`detect_bpm(samples, sample_rate)` のようなモジュール直下の関数を直接呼ぶ方が分かりやすくなります。
:::

## このリファレンスの読み方

このページは 3 段階で読むと迷いにくくなります。

1. ファイルを読むなら `Audio.from_file(...)` から始める。すでにサンプル列があるなら、モジュール直下の関数を直接呼ぶ。
2. 参照全体を眺めるのではなく、[目的から API を選ぶ](#目的から-api-を選ぶ) で関数ファミリーを 1 つ選ぶ。
3. 属性名、行優先の行列形状、JS 互換の別名が必要になったときだけ [型定義](#型定義) に戻る。

`analyze(...)` を 1 回呼べば、コード、セクション、音色、ダイナミクス、リズム、メロディ、フォーム、拍ごとの強度を含む総合結果が返り、他のバインディングと揃っています。1 つのフィールドだけが欲しいときや、呼び出しごとにオプションを変えたいときは、下の専用関数を使ってください。

::: info 既定のサンプルレートはファミリーごとに異なる
楽曲解析系とメータリング系のヘルパーは `sample_rate=22050` を既定とし、ルーム音響系のヘルパー（`analyze_impulse_response`、`detect_acoustic`、`estimate_room`）は `48000` を既定とします。`Audio.from_file(...)` で読み込んだ場合は、必ず `audio.sample_rate` を渡してください。そうすれば、別のレートで録音した音声にファミリーごとの既定値が静かに当たることはありません。ここでいうインパルス応答（IR）とは、短い一発の音に対して空間がどう応答するかを録音したものです。
:::

## 目的から API を選ぶ

| やりたいこと | 最初に使う API | 理由 |
|--------------|----------------|------|
| ファイルを読んでメタデータを出すスクリプト | `Audio.from_file(...)` + `detect_bpm` / `detect_key` / `analyze` | Python 側でデコードでき、短いコードで書けます |
| 詳細な楽曲解析 | `analyze_bpm`, `detect_chords`, `analyze_sections`, `analyze_timbre`, `analyze_dynamics`, `analyze_rhythm` | 追加パラメータ付きで 1 種類の解析だけを実行します。`analyze(...)` はこれらのフィールドを 1 つの `AnalysisResult` にまとめて返します |
| ノートブックや ML 用の特徴量 | `mel_spectrogram`, `mfcc`, `chroma`, `cqt`, `vqt`, `chroma_cqt`, `nnls_chroma` | Python のリスト／結果オブジェクトで返り、必要なら NumPy に変換できます |
| クリップを編集する | `time_stretch`, `pitch_shift`, `pitch_correct_to_midi`, `note_stretch`, `voice_change`, `RealtimeVoiceChanger` | 解析ではなく音そのものを変えます |
| ファイルをマスタリングする | `master_audio`, `mastering_chain`, `StreamingMasteringChain` | まずプリセット、必要に応じて明示的なチェーン設定を使います |
| ライブ音声やチャンク単位の解析 | `StreamAnalyzer` | 音声ブロックを渡し、特徴フレームと、音が増えるにつれて更新される BPM/キー/コード推定を読み出します |
| ステムをミックスする | `mix_stereo` または `Mixer.from_scene_json(...)` | 一括配列処理から始め、センド・バス・オートメーション・メーターが必要ならシーンミキサーを使います |
| 部屋の残響、明瞭度、等価ルーム推定、ルーム生成を扱う | `analyze_impulse_response`, `detect_acoustic`, `estimate_room`, `synthesize_rir`, `room_morph` | 楽曲ではなく録音空間を説明・適用します |

## インストール

Python 3.11 以上が必要です（3.11、3.12、3.13）。

```bash
pip install libsonare
```

`sonare` コマンドもあわせてインストールされます。詳しくは [CLI リファレンス](/ja/docs/cli) をご覧ください。

標準の PyPI ホイールは WAV と MP3 をデコードします。読み込まれているビルドが FFmpeg デコードに対応しているかは `libsonare.has_ffmpeg_support()` で確認できます。M4A/AAC/FLAC/OGG/Opus を直接読み込みたい場合は、リポジトリをクローンし、FFmpeg を有効にしたホイールをビルドしてインストールします。

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
SONARE_FFMPEG=1 bash bindings/python/build_wheel.sh
python3 -m pip install bindings/python/dist/*.whl
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

### エラーハンドリング

例外クラスは 2 つで、あらゆる失敗がどちらかに入ります。

| 送出されるタイミング | クラス | メッセージ |
|---------------------|--------|-----------|
| ネイティブライブラリが OK 以外のコードを返したとき | `SonareError`（`RuntimeError` のサブクラス） | `[4] ` という数値接頭辞が付きます |
| C ABI に到達する前に、Python 側の引数・バッファ検証が呼び出しを拒否したとき | `SonareValueError` | 検証メッセージのみで、数値接頭辞は付きません |

`SonareValueError` は `SonareError` と `ValueError` の**両方**を継承します。そのため `except ValueError:` でも `except sonare.SonareError:` でも捕捉でき、どちらの書き方のハンドラも、個々のエントリポイントがどちらのクラスを選ぶかを知る必要がありません。`.code` は `ErrorCode.INVALID_PARAMETER` なので、コードで分岐するコードからは、これが肩代わりしている C ABI の拒否とまったく同じに見えます。`SonareError.code` は JS バインディングが `ErrorCode` として公開するのと同じ C ABI の値で（[エラーハンドリング](./js-api-types.md#エラーハンドリング)を参照）、`.code_name` はバインディング間で共通の名称を返します。CLI はこれらのコードを[終了コード](./cli.md#終了コード)へ対応付けます。

```python
try:
    result = sonare.master_audio_stereo(left, right, sample_rate=48000, preset_name="pop")
except sonare.SonareError as e:
    print(e.code, e.code_name, e)
```

#### 引数は呼び出し前に検査されます

バッファを受け取るエントリポイントは引数を事前検査します。そのため空・サイズ不一致・非有限値を含むバッファは、内部ヘルパーや素の C シンボルではなく、呼び出した関数の名前で報告されます。

```text
master_audio_stereo: right must not be empty
spectral_centroid: samples contains NaN or Inf at index 0
```

メッセージに現れる名前は、呼び出し側のシグネチャにある名前です。`cross_similarity` は内部の `data` ／ `rows` ではなく `x` ／ `x_rows` を報告し、スカラーおよびステレオのメーターは `sonare_` 接頭辞付きの C シンボルではなくファサード関数名（`metering_peak_db`）を報告します。`validate` を公開しているエントリポイントでは、`validate=False` を渡すと O(n) の NaN／Inf 走査は省略されますが、空チェックは省略されません。

::: warning メッセージ文字列で分岐している場合
`SonareError` や `ValueError` を捕捉するハンドラ、`.code` で分岐するコードは変更不要です。検証メッセージの**文字列**を照合しているコードは影響を受けます。文言はエントリポイント名と引数名を含む形になっています。
:::

#### 受け付けなくなった入力

- `trim_silence`、`split_silence`、`fix_frames` は、空のバッファに対して空の結果を返すのではなく例外を送出します。
- `tempogram_ratio` は、有限かつ正でない `factors` の要素を拒否します。NaN はコア内で未定義の float→int 変換に到達し、無限大は黙って DC ラグに縮退するためです。
- `mix_stereo` はミックスできないシーンを拒否します。すべてのストリップが空である場合、またはいずれかのストリップが NaN／Inf を含む場合で、ストリップのインデックスとチャンネルを示します（`mix_stereo: strips[1] right contains NaN or Inf at index 0`）。C ABI では 0 フレームのブロックは「このブロックを処理する」という意味の正当な no-op であり、「このストリップ群をミックスする」という意味ではありません。

#### 検査されないもの

要素ごとの変換は「空を渡せば空が返る」という契約を保っています。`power_to_db`、`amplitude_to_db`、`db_to_power`、`db_to_amplitude`、`preemphasis`、`deemphasis`、`vector_normalize`、`frame_signal`、`pad_center`、`fix_length` は空のシーケンスを受け取り、空を返します。テンポ系ヘルパーで入力行列を検査するのは `tempogram_ratio` だけで、`tempogram`、`fourier_tempogram`、`cyclic_tempogram`、`plp` は検査しません。

`f0_hz` は非有限値の走査を一切受けません。pYIN は無声フレームを `nan` で表し、そのトラック表現はピッチ補正へそのまま渡される必要があるためです。`note_segments`、`extract_notes`、`decompose_note_pitch`、`split_note`、`merge_notes` は `f0_hz` の形状だけを検査し、値は検査しません。

CLI の**使い方**の誤りは `SonareValueError` ではなくプレーンな `ValueError` を送出します。API 引数ではなくコマンドラインの誤りを報告するものだからです。どちらも終了コードは `3` です。

### このビルドで何ができるか

`capabilities()` は `sonare doctor` が表示するのと同じビルド診断レポートを返します。
`capability_catalog()` は、`schemas/capability-catalog.schema.json` で検証された
機械可読なプロセッサ／パラメータ／プリセットのカタログを返します。

```python
import libsonare as sonare

caps = sonare.capabilities()
if not caps["features"]["ffmpeg"]:
    print("このホイールがデコードできる形式:", caps["decode"]["builtin"])

catalog = sonare.capability_catalog()
for processor in catalog["processors"]:
    for param in processor["params"]:
        # コアが範囲を宣言していない場合、min / max / default は None になります。
        build_slider(processor["id"], param)
```

手で管理した表ではなくカタログで分岐してください。パラメータの範囲・既定値・単位・
リアルタイム安全性は、すべて読み込まれているビルドから得られます。Node と WASM では
同じデータが `capabilities()` / `capabilityCatalog()` です。

### 長い処理をキャンセルする

進捗を報告する解析・マスタリングの呼び出しは `cancel` も受け取ります。これは同じネイティブ
境界でポーリングされる述語で、`True` を返すと呼び出しが中断され、`SonareError` のコード `8`
（`SONARE_ERROR_CANCELLED`）になります。途中結果は残りません。

```python
import threading

stop = threading.Event()

try:
    result = sonare.master_audio(
        samples,
        sample_rate,
        preset_name="pop",
        on_progress=lambda p, stage: print(stage, p),
        cancel=stop.is_set,
    )
except sonare.SonareError as e:
    if e.code == 8:
        print("キャンセルされました")
    else:
        raise
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

時間／周波数の領域指定編集には `spectral_edit(samples, sample_rate, [SpectralRegionOp(...)])` を使います。詳しくは [スペクトル編集](./spectral-editing.md) を参照してください。

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

<SonareDemo id="mel-spectrogram" />

### テスト信号・再構成・構造解析

```python
import libsonare as sonare

# 決定的なテスト信号。アセットファイルは不要です。
sine = sonare.tone(frequency=440.0, sample_rate=48000, duration=1.0)
sweep = sonare.chirp(fmin=100.0, fmax=8000.0, sample_rate=48000, duration=2.0)
track = sonare.clicks(times=[0.0, 0.5, 1.0], sample_rate=48000)

# 再構成とビンごとのピッチ候補
audio_again = sonare.griffin_lim(magnitude, n_bins, n_frames, sample_rate=48000)
reassigned = sonare.reassigned_spectrogram(samples, sample_rate=48000)
peaks = sonare.piptrack(samples, sample_rate=48000)
delta = sonare.mel_delta(features, n_features, n_frames)
flux = sonare.spectral_flux(samples, sample_rate=48000)
backtracked = sonare.onset_backtrack(onset_frames, energy)

# モノフォニックの F0 トラックからノート区間を切り出す
pitch = sonare.pitch_pyin(samples, sample_rate=48000)
segments = sonare.note_segments(
    pitch.f0,
    [1.0 if v else 0.0 for v in pitch.voiced_flag],
    frame_rate=48000 / 512,
    min_note_ms=60.0,
)
```

::: warning 渡すのは `voiced_flag` であって `voiced_prob` ではありません
`note_segments` は、有声度の値が `voiced_threshold`（既定 `0.5`）を下回るところでノートを区切ります。したがって `pitch_pyin` の `voiced_flag` を `0.0`／`1.0` として渡してください。`voiced_prob` はそのフレームの有声観測**量**であり、解析窓に何周期分収まるかに依存するため、確信度を表すのではなく F0 とともに上昇します。`frame_length=2048`、48 kHz では、定常的な 3 倍音のトーンで C2 の平均が 0.1 をはるかに下回り、C5 で 0.5 前後になります。そのため低音楽器や低い男声のトラックを固定しきい値で処理すると、**例外は出ないまま空のリスト**が返ります。連続的な有声度で区切りたい場合は `voiced_threshold` がもう一方の調整点です。
:::

自己類似度系の関数は、JavaScript の `segment*` という名前とは異なり、Python では
`segment_` 接頭辞なしで公開されています。

| Python | JavaScript |
|--------|------------|
| `cross_similarity(...)` | `segmentCrossSimilarity(...)` |
| `recurrence_matrix(...)` | `segmentRecurrenceMatrix(...)` |
| `recurrence_to_lag(...)` | `segmentRecurrenceToLag(...)` |
| `lag_to_recurrence(...)` | `segmentLagToRecurrence(...)` |
| `path_enhance(...)` | `segmentPathEnhance(...)` |
| `subsegment(...)` | `segmentSubsegment(...)` |
| `agglomerative(...)` | `segmentAgglomerative(...)` |

::: details ピッチ・特徴量の用語: YIN/pYIN・ゼロ交差率・MIDI ノート番号
- **YIN / pYIN** — 単音の*基本周波数*（体感ピッチ）を推定するアルゴリズムです。YIN は自己相関を使い、pYIN は確率的な平滑化を加えてピッチラインを時間方向に安定させます。いずれも和音ではなく一度に 1 音を追跡します。
- **ゼロ交差率**（ZCR） — 波形が 1 フレームあたり何回ゼロを横切るか。高いとノイズ的・高域的（シンバル、摩擦音）、低いと滑らかで音程的な音を表します。
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
| `Audio.file_channel_count(path)` | デコードせずに音声ファイルのソースチャンネル数を調べる。`from_file` と異なり、モノラルへのダウンミックスは行わない |
| `audio.data` | 生のfloatサンプル |
| `audio.sample_rate` | サンプルレート（Hz） |
| `audio.duration` | 長さ（秒） |
| `audio.length` | サンプル数 |
| `audio.close()` | ネイティブメモリを解放 |

Python の `Audio` オブジェクトは、WASM の `Audio` オブジェクトより多くのメソッドを持ちます。

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
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | 時系列のコードセグメント。検出しきい値未満のフレームは明示的な `N.C.` 区間になります |
| `analyze(samples, sample_rate)` | `AnalysisResult` | 総合解析: BPM とその候補・キー・拍子とその候補・ビート・コード・セクション・音色・ダイナミクス・リズム・メロディ・フォーム |
| `analyze_with_progress(samples, sample_rate, on_progress?)` | `AnalysisResult` | `analyze` と同じ結果に、オプションの `(progress, stage)` コールバックを付けたもの |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | 上位候補付きの BPM 解析 |
| `estimate_meter(beat_times, beat_strengths, ...)` | `MeterEstimate` | 手元にあるビート系列だけから拍子とアクセントのグルーピングをスコアリング。音声も再解析も不要 |
| `chord_functional_analysis(samples, key_root, key_mode?, ...)` | `list[str]` | 検出したコードに対する、キーを基準としたローマ数字ラベル（`"I"`、`"IV"`、`"V"`、`"vi"` …） |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | シンコペーション・グルーヴ・規則性 |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | ブライトネス・ウォームス・密度・粗さ・複雑さと、窓ごとの `timbre_over_time`（`timbreOverTime` alias） |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | 楽曲構造のセクション（イントロ／Aメロ／サビ…） |
| `detect_boundaries(samples, sample_rate=22050, *, n_fft=2048, hop_length=512, kernel_size=64, threshold=0.3, absolute_threshold=0.005, n_mfcc=13, n_chroma=12, peak_distance=2.0, use_mfcc=True, use_chroma=True)` | `BoundaryResult` | 構造の転換点と、それを拾い出した元の `novelty_curve`、および両者が乗るグリッド。`analyze_sections` のラベル付き区間ではなく、自前のしきい値を当てたいときに使います |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | 単音メロディの輪郭（YIN） |
| `analyze_impulse_response(samples, sample_rate=48000, n_octave_bands=6, min_decay_db=30.0)` | `AcousticResult` | インパルス応答（IR）から求めるルーム音響（RT60／EDT／C50／C80）。`min_decay_db` は減衰フィットのしきい値 |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | ブラインドなルーム音響推定 |
| `estimate_room(samples, sample_rate, ...)` | `RoomEstimate` | 体積、寸法、DRR、吸音率バンド、RT60 バンド、信頼度を含む等価ルーム推定 |
| `synthesize_rir(length_m, width_m, height_m, ...)` | `RirResult` | シューボックス形状からのモノラル RIR |
| `room_morph(samples, sample_rate, length_m, width_m, height_m, ...)` | `list[float]` | 目標ルームへ寄せるオフラインのルームモーフィング |
| `version()` | `str` | ライブラリバージョン |
| `voice_changer_abi_version()` | `int` | リアルタイムボイスチェンジャー POD 設定の ABI バージョン。プリセット JSON の `schemaVersion` とは別 |
| `voice_character_preset_id(preset)` | `str \| None` | 整数の序数から正規の voice-character プリセット ID を返す。未知の序数は `None` |
| `realtime_voice_changer_preset_config(preset)` | `RealtimeVoiceChangerConfig` | JSON 解析なしで、組み込みボイスプリセットの解決済みフラット POD 設定を返す |
| `engine_abi_version()` | `int` | リアルタイムエンジンインターフェースの ABI バージョン |
| `project_abi_version()` | `int` | `Project` のシリアライズ、バウンス、リアルタイムクリップ交換で使うプロジェクト／編集 API の ABI バージョン |
| `has_ffmpeg_support()` | `bool` | 読み込まれたネイティブライブラリが FFmpeg デコードに対応しているか |

コア解析、エフェクト、特徴量、ラウドネス、マスタリングの多くは
`Audio` インスタンスメソッドとしても使えます（例: `audio.detect_bpm()`）。
一方で `analyze_sections(...)`、`analyze_melody(...)`、`cqt(...)`、`vqt(...)`
など一部の詳細ヘルパーはスタンドアロン関数です。これらには `audio.data` と
`audio.sample_rate` を渡してください。

Python の `analyze(...)` は内部で `sonare_analyze_json` を呼び、BPM と順位付き BPM 仮説、キー、拍子とその候補、ビート時刻・拍ごとの強度に加えてコード、セクション、音色、ダイナミクス、リズム、メロディ、フォームまで含む `AnalysisResult` を 1 回で返します（他のバインディングと揃っています）。上の専用関数は、1 つのフィールドだけが欲しい、呼び出しごとにオプションを変えたい、または結果全体の再計算を避けたいときに役立ちます。ルーム音響（RT60 など）は `AnalysisResult` には含まれず、`estimate_room` などのルームヘルパーで取得します。

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

#### `analyze()` のオプション

`analyze(...)` は `MusicAnalyzerConfig` 全体をキーワード引数として受け取ります。`n_fft=2048`、`hop_length=512`、`bpm_min=60.0`、`bpm_max=200.0`、`start_bpm=120.0`、`use_triads_only=True`、`use_hpss=True`、`chroma_highpass_hz=80.0`、`use_bass_weighted=True`、`chroma_hop_multiplier=4`、`use_chord_hmm=False`、`use_chord_key_context=False`、`chord_hmm_beam_width=24`、`detect_chord_inversions=False`、`adaptive_tempo=False`、`tempo_update_interval_beats=8`、`compute_tempo_curve=False`、`meter_candidate_numerators=None`、`meter_denominator=4` です。

::: warning `use_triads_only` はここでは既定が **True** です
統合された `analyze(...)` の経路は、明示的に指定しないかぎりトライアドだけを探索します。一方、単独の `detect_chords(...)` API は同じフラグの既定が `False` です。`analyze(...)` からセブンスやテンションを得たい場合は `use_triads_only=False` を渡してください。
:::

このうち 3 つは特に注意が必要です。

- `meter_candidate_numerators` の既定はネイティブの候補集合 `(3, 4, 6)` です。変拍子は、その分子を候補に含めた場合にのみ報告されます。要素は最大 16 個、各要素は `[2, 32]` の範囲です。候補を広げても広い拍子が強制されるわけではありません。
- `meter_denominator`（`[1, 32]` の 2 のべき乗）は、検出した拍子に対して報告される拍の単位です。`analyze(...)` は音声を持っているので、複合拍子を解決したときは自身の判断で `8` を報告します。
- `compute_tempo_curve=True` は `beat_local_bpm` を埋めます。既定で無効なのは、解析精度が上がるわけではなく出力が 1 つ増えるだけだからです。`adaptive_tempo=True` も併せて指定しないかぎりビートトラッキングは単一のテンポ事前分布を保持するため、実際に変動するテンポを測るには両方が必要です。

#### 結果の読み方

- `key.confidence` は、スコアリングされた全候補のプロファイル相関に対するソフトマックスです。値域は `[0, 1)` で、候補の confidence の総和は 1 になります。したがって 24 候補中の 1 つが 1 に達することはなく、証拠を分け合う平行調どうしはそれぞれおよそ半分を報告します。これはクロマがどれだけ明確に候補集合から 1 つを選び取ったかを示す値であり、**その選択がどれだけの頻度で正しいかではありません**。アノテーション付き録音に対して較正されたものは何もないため、この値で分岐するパイプラインは自前の素材に対して自前のしきい値を決める必要があります。
- `downbeat_indices` は `beat_times` のインデックスで、`beat_times[downbeat_indices[k]]` が k 番目のダウンビートです。`beat_times` より短く、あるビートがダウンビートかどうかの判定は、別の時系列との時刻比較ではなくこのリストへの所属判定になります。`downbeat_phase` は拍子推定器自身の位相なので、コードや低域の証拠からダウンビートが精緻化されると `downbeat_indices[0]` と食い違うことがあります。
- `beat_strengths` と `beat_observations.onset_strength` は別の測定値です。`beat_strengths` はビート自身のフレームで取得したオンセットエンベロープの生の 1 フレームで、正規化されておらず上限もなく、素材によってスケールが変わり、ビート位置の揺れに敏感です。`beat_observations.onset_strength` はライブラリ自身のダウンビート判定がスコアリングに使う窓処理済みの値で、アクセントを扱うならこちらを使います。`beat_observations` は `low_frequency_energy` と `chord_change` も保持します。
- `beat_local_bpm` は各ビート位置での平滑化された局所テンポで、`beat_times` と並行します。`compute_tempo_curve` を指定しないかぎり空で、ビートが 2 つ未満しか検出されなかった場合は指定しても空です（テンポは 2 つのビートの間隔の性質だからです）。最後の要素は、最終ビートへ至る間隔のテンポを繰り返したものです。設計上、テンポが動く素材では `bpm` から離れるので、ここから 1 つの値を取り出して全体テンポとして読まないでください。

#### 手元のビート系列から拍子をスコアリングする

`estimate_meter(...)` は、呼び出し側が渡したビート系列に対して拍子をスコアリングします。読むのはビートごとの時刻とアクセント値だけなので、既存の解析結果を別の候補集合で、あるいはビートの任意の区間について、パイプラインを回し直さずに再スコアリングできます。概念的な説明は[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md)を参照してください。

```python
result = sonare.analyze(audio.data, audio.sample_rate)
obs = result.beat_observations

meter = sonare.estimate_meter(
    result.beat_times,
    obs.onset_strength if obs else result.beat_strengths,
    candidate_numerators=(3, 4, 5, 6, 7),
)
if meter.searched:
    print(meter.time_signature.numerator, meter.grouping)  # 例: 7 [3, 2, 2]
```

キーワードオプションは `candidate_numerators`（既定 `(3, 4, 6)`）、`denominator=4`、`downbeat_weight=1.0`、`measure_weight=0.5`、`subdivision_weight=0.15`、`compound_subdivision_threshold=0.85` です。結果が意味を持つかどうかは、次の 2 点で決まります。

- 既定の候補集合は `{3, 4, 6}` なので、変拍子はその分子を指定した場合にのみ返ってきます。
- `searched` は、ビート系列が 8 ビート未満だった場合に `False` になります。そのとき他のすべてのフィールドは測定結果ではなく固定のフォールバック値です。**confidence も含みます**。短い区間の答えを検出結果として読まないでください。

`grouping` は小節が 2 拍・3 拍のアクセントグループにどう分かれるかを表し、常に報告された分子と一致します。7 拍子なら `[3, 2, 2]` です。複合拍子か単純拍子かは denominator ではなく grouping で判断してください。1 拍が 3 分割されるかどうかはビート**間**のエネルギーから測るものであり、ビートごとのアクセント値はそれを持たないため、この経路では `denominator` は指定されたとおりに報告されます。`candidate_scores` は指定した分子の並びと平行で、`candidates` は支持度の降順です。スコアと分子の対応は、`candidates` ではなく自分の指定リストを通して取ってください。スコアは標準化された符号付きの値で、スコアリングしたビート数の平方根に比例して大きくなるため、比較できるのは同一結果の内部だけです。

#### コードのクオリティ

`Chord.quality` は[型定義](#型定義)に列挙した文字列のいずれかです。そのうちいくつかは互いにアナグラムで、クロマグラムではこのペアを区別できません。`major6` は短 3 度下の `minor7` と同じ構成音で、`minor6` はその下の `halfDim7`、`dominant7Sus4` は完全 4 度下の `sus2Add4` と同じです。各ペアでは確立された読み方が既定のまま残り、6th へ持ち上げられるのはベースの証拠がある場合だけです。

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
| きれいなインパルス応答を測る | `analyze_impulse_response(...)` |
| 通常音声から部屋の減衰を推定する | `detect_acoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimate_room(...)` |
| 寸法からモノラルのルームインパルス応答（RIR）を作る | `synthesize_rir(...)` |
| 目標ルームの響きを音作り効果として足す | `room_morph(...)` |

::: info デフォルト値と用語
`analyze_impulse_response(...)` と `detect_acoustic(...)` は `AcousticResult` を返し、RT60、EDT、C50、C80、D50、バンド別配列、信頼度、`is_blind` を含みます。これらの `sample_rate` デフォルトは `48000` で、多くの楽曲解析ヘルパーの `22050` とは異なります。RIR は room impulse response（ルームインパルス応答）の略です。RT60 は残響時間で、残響が 60 dB 減衰するまでの長さを指します。C50 と C80 は、初期エネルギーと後期エネルギーの比で明瞭度を表します。
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

### エフェクト関数

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
| `normalize(samples, sample_rate, target_db?)` | `list[float]` | ピークを目標 dB にノーマライズ（デフォルト: 0.0） |
| `normalize_rms(samples, sample_rate, target_db?)` | `list[float]` | RMS を目標 dB にノーマライズ（デフォルト: -20.0） |
| `normalize_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | ペア共通の 1 つのゲインでピークノーマライズ（`target_db` 既定 `0.0`） |
| `normalize_rms_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | ペア共通の 1 つのゲインで RMS ノーマライズ（`target_db` 既定 `-20.0`） |
| `remix(samples, intervals, sample_rate?, align_zeros?)` | `np.ndarray` | 区間スライスで並べ替え／連結。`align_zeros` は既定 `False` |
| `remix_aligned_intervals(samples, intervals, sample_rate?, align_zeros?)` | `list[int]` | `remix` が使う切り出し位置だけを解決する（切り出しはしない）。`align_zeros` は既定 `True` |
| `trim(samples, sample_rate, threshold_db?, frame_length?, hop_length?)` | `list[float]` | 無音区間をトリム（既定: `-60.0` dB、`frame_length=2048`、`hop_length=512`） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートへリサンプリング |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の librosa 互換 `trim_silence(...)` はフレーム RMS と `top_db` を使い、トリム後の音声と元音源上のサンプル範囲を返します。

#### ステレオペアのノーマライズ

Python はステレオ用のノーマライザを 2 つに分けて持っています。ピーク用の `normalize_stereo` と RMS 用の `normalize_rms_stereo` です（JavaScript 側は 1 つの関数と `mode` 引数で表現します）。どちらもレベルをペア全体で測り、**1 つの共通ゲインを両チャンネルに適用**します。これがステレオイメージを保つ仕組みです。チャンネルごとに自前のゲインでノーマライズすると、2 つのピークが揃うまで小さい側が持ち上がり、レベルではなく定位バランスが変わってしまいます。ゲインが共通なので `NormalizeStereoResult.applied_gain_db` はチャンネルごとの組ではなく単一の値で、すでに無音のペアはそのまま返り、ゲインはちょうど `0` になります。結果は `left`／`right` に加えて、ペア共通のサンプル数 `length` を保持します。

どちらかのチャンネルが空の場合、および 2 つのチャンネルの長さが一致しない場合は拒否されます。C のエントリポイントはペアに対して 1 つのサンプルレートを取るので、2 つのチャンネルがサンプルレートで食い違うことはありません。

```python
result = sonare.normalize_stereo(left, right, 48000, target_db=-3.0)
print(result.length, result.applied_gain_db)
```

#### マルチチャンネル素材を共通のフレームで切る

`remix(..., align_zeros=True)` はスライス境界を信号のゼロクロスへスナップしますが、これは信号ごとの判断です。`remix` をチャンネルごとに呼ぶと各チャンネルが別々のフレームへスナップされ、ステレオ素材がずれていきます。`remix_aligned_intervals(...)` は 1 つのチャンネルから切り出し位置を 1 セットだけ解決し（クランプ済みの `(start, end)` ペアのフラットなリスト）、同じフレームで全チャンネルを切り出せるようにします。既定値が意図的に非対称な点に注意してください。`remix` は `align_zeros=False`、`remix_aligned_intervals` は `True` です。

スナップでスライスが消えないよう、ガードが 2 つあります。符号変化がまったくない信号（無音、DC オフセット、あらゆる定数）はスナップされません。また、内容があったのにスナップ後に空へ潰れるスライスは、スナップ前の境界を保ちます。

```python
cuts = sonare.remix_aligned_intervals(left, [0, 48000, 96000, 144000], sample_rate=48000)
left_out = sonare.remix(left, cuts, sample_rate=48000)
right_out = sonare.remix(right, cuts, sample_rate=48000)
```

### リアルタイムボイスチェンジャー

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

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sample_rate, n_fft?, hop_length?)` | `StftResult` | 短時間フーリエ変換 |
| `stft_db(samples, sample_rate, n_fft?, hop_length?)` | `tuple` | デシベル単位の STFT |
| `mel_spectrogram(samples, sample_rate, n_fft?, hop_length?, n_mels?, fmin?, fmax?, htk?)` | `MelSpectrogramResult` | メルスペクトログラム。`fmin`/`fmax` で帯域の端を指定し、`htk=True` で HTK 方式のメル公式を使います |
| `mfcc(samples, sample_rate, n_fft?, hop_length?, n_mels?, n_mfcc?, fmin?, fmax?, htk?, lifter?)` | `MfccResult` | メル周波数ケプストラム係数（`lifter=0.0` でケプストラルリフタリング無効） |
| `chroma(samples, sample_rate, n_fft?, hop_length?)` | `ChromaResult` | クロマ特徴（ピッチクラス分布） |
| `spectral_centroid(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル重心 |
| `spectral_bandwidth(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル帯域幅 |
| `spectral_rolloff(samples, sample_rate, n_fft?, hop_length?, roll_percent?)` | `list[float]` | フレームごとのスペクトルロールオフ |
| `spectral_flatness(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル平坦度 |
| `spectral_contrast(samples, sample_rate?, n_fft?, hop_length?, n_bands?, fmin?, quantile?)` | `np.ndarray` | スペクトルコントラスト。形状は `(n_bands + 1, n_frames)` |
| `poly_features(samples, sample_rate?, n_fft?, hop_length?, order?)` | `np.ndarray` | フレームごとの多項式スペクトル係数 |
| `zero_crossing_rate(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | フレームごとのゼロ交差率 |
| `zero_crossings(samples, threshold?, ref_magnitude?, pad?, zero_pos?)` | `np.ndarray` | 波形がゼロを横切るサンプル位置 |
| `waveform_peaks(samples, channels, *, samples_per_bucket=512, validate=True)` | `WaveformPeaksReport` | インターリーブされたマルチチャンネル音声（長さは `channels` の倍数）を波形描画用のチャンネルごとの min/max バケットに縮約。`min`/`max` はチャンネルメジャー（`channel * bucket_count + bucket`） |
| `waveform_peak_pyramid(samples, channels, *, samples_per_bucket_levels=(512, 1024, 2048, 4096), validate=True)` | `list[WaveformPeaksReport]` | ズームレベルごとに 1 つの peaks レポート（バケット幅ごとに 1 エントリ） |
| `rms_energy(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | フレームごとの RMS エネルギー |
| `pitch_yin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | YIN ピッチ推定。すべてのフレームの `f0` は有限で、有声かどうかは `voiced_flag` が示す |
| `pitch_pyin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | pYIN ピッチ推定。無声音の `f0` は `fill_na=True` でない限り `nan` |
| `pitch_tuning(frequencies, resolution?, bins_per_octave?)` | `float` | 検出済み周波数からビン単位のチューニングずれを推定 |
| `estimate_tuning(samples, sample_rate?, n_fft?, hop_length?, resolution?, bins_per_octave?)` | `float` | 音声からチューニングずれを直接推定 |
| `cqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | 定Q変換の振幅 |
| `vqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | 可変Q変換の振幅 |
| `hybrid_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | ハイブリッド CQT の振幅（ビンごとに CQT／擬似 CQT を切り替えて合成） |
| `pseudo_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | 擬似 CQT の近似振幅 |
| `bass_chroma(samples, sample_rate?, hop_length?, n_chroma?)` | `ChromaResult` | 低域寄りのクロマ（低音域のピッチクラス分布） |
| `chroma_cens(samples, sample_rate?, hop_length?, n_chroma?, bins_per_octave?)` | `ChromaResult` | CENS のエネルギー正規化・平滑化クロマ |
| `chroma_cqt(samples, sample_rate?, hop_length?, n_chroma?, bins_per_octave?)` | `ChromaResult` | 定 Q クロマグラム（`librosa.feature.chroma_cqt` 相当） — `features` は行優先 `[n_chroma x n_frames]` |
| `nnls_chroma(samples, sample_rate, *, enable_stft_blend?, stft_blend_weight?, stft_blend_n_fft?, hop_length?)` | `tuple[int, list[float]]` | NNLS クロマグラム — `(n_frames, 行優先 12 x n_frames データ)` を返す。`hop_length` の既定値は `512` |
| `decompose(s, n_features, n_frames, n_components, n_iter?, beta?)` | `tuple` | 行優先スペクトログラムから NMF 分解係数 `(w, h)` を返す |
| `decompose_with_init(s, n_features, n_frames, n_components, n_iter?, beta?, init?)` | `tuple` | 初期化方式を選べる NMF 分解 `(w, h)`。`init` は既定 `'random'`、`'nndsvd'`（SVD ウォームスタート）も受け付ける |
| `decompose_stems(samples, sample_rate?, n_components?, n_fft?, hop_length?, n_iter?, beta?, init?, mask_power?, *, validate?)` | `dict[str, object]` | 元の複素スペクトログラムにマスクを掛ける NMF 分離。各コンポーネントが元音源の位相を保ち、合計すると入力に戻る。既定は `n_components=4`、`n_iter=100`、`beta=2.0`、`init='random'`、`mask_power=1.0` |
| `nn_filter(s, n_features, n_frames, aggregate?, k?, width?)` | `np.ndarray` | 行優先スペクトログラムの近傍フィルター |
| `onset_envelope(samples, sample_rate, n_fft?, hop_length?, n_mels?)` | `list[float]` | オンセット強度の包絡線（テンポグラム系の入力） |
| `onset_strength_multi(samples, sample_rate?, n_fft?, hop_length?, n_mels?, n_bands?)` | `tuple[int, list[float]]` | マルチバンドのオンセット強度。`(n_frames, [n_bands x n_frames])` を行優先で返す（`n_bands` 既定 3） |
| `lufs(samples, sample_rate)` | `LufsResult` | Integrated／最後の窓の [LUFS](./glossary/lufs.md)（Loudness Units relative to Full Scale）、Max-M / Max-S、ラウドネスレンジ（EBU R128） |
| `lufs_interleaved(samples, channels, sample_rate?)` | `LufsResult` | インターリーブされたサンプルからチャンネル重み付きマルチチャンネルラウドネスを測定 |
| `ebur128_loudness_range(samples, sample_rate?)` | `float` | EBU R128 loudness range（LRA、LU 単位） |
| `momentary_lufs(samples, sample_rate)` | `list[float]` | フレームごとの momentary LUFS |
| `short_term_lufs(samples, sample_rate)` | `list[float]` | フレームごとの short-term LUFS |

主な既定値は、`n_fft=2048`、`hop_length=512`、`n_mels=128`、`n_mfcc=20`、ピッチ検出の `fmin=65.0`、`fmax=2093.0`、`threshold=0.1`、`roll_percent=0.85` です。

CQT/VQT は `fmin=32.70319566` Hz（C1）、`n_bins=84`、`bins_per_octave=12` を使います。VQT の既定 `gamma=-1` は ERB 由来の帯域幅を自動選択します。`chroma_cqt` と `chroma_cens` の既定は `n_chroma=12`、`bins_per_octave=36` です。`hpss(...)` と `hpss_with_residual(...)` は `kernel_harmonic=31`、`kernel_percussive=31`、`n_fft=2048`、`hop_length=512`、`hard_mask=False` を既定値とします。

追加のエフェクト系ヘルパーとして `phase_vocoder(samples, sample_rate?, rate?)`、`hpss_with_residual(samples, sample_rate?, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)` も利用できます。直接のフェーズボコーダー時間伸縮や、残差信号を保持した HPSS が必要な場合に使います。

#### NMF の係数と、聴けるステム

`decompose` と `decompose_with_init` が返すのは**振幅**スペクトログラムの W／H 係数です。これらは位相を持たないため、そこから音声を再構成するには位相推定器が必要で、推定された位相はステムとしては実用に耐えません。`decompose_stems` は、同じ因子分解からコンポーネントごとのソフトマスクを作り、それを**元の複素**スペクトログラムへ適用します。したがって各コンポーネントは元音源の位相を保ちます。モデルにエネルギーがあるところではマスクの総和が 1 になり、逆 STFT は線形なので、コンポーネントを合計すると入力に戻ります。

`mask_power` はソフトマスクの指数です。`1`（既定）は振幅比、`2` は Wiener 型のパワー比で、分離は強くなる代わりに倍音が重なる箇所でアーティファクトが増えます。1 未満は拒否されます。`init` は既定 `'random'`、SVD ウォームスタートなら `'nndsvd'` です。`beta` はダイバージェンス（`2` = Frobenius、`1` = Kullback-Leibler）です。

```python
stems = sonare.decompose_stems(audio.data, audio.sample_rate, n_components=4, mask_power=2.0)
for component in stems["components"]:
    ...  # いずれも入力と同じ長さの 1 次元 float32 配列
print(stems["w"].shape, stems["h"].shape, stems["sample_rate"])
```

このエントリポイントでは `n_components`、`n_fft`、`hop_length`、`n_iter` が実際の既定値を持つため、`0` は「既定値を使う」というセンチネル（C ABI と JavaScript 側の同じフィールドではそう解釈されます）ではなく、呼び出し側の誤りとして拒否されます。

::: warning NNDSVD のシードは倍精度で計算されます
これは精度の改善ではなく**再現性**の確保です。そのため `decompose` と `decompose_stems` は、単精度でシードを計算していたビルドとは同じ入力に対して異なる係数を返します。振幅スペクトログラムの末尾側の特異ベクトルは単精度のノイズフロアに埋もれるため、float でのシードは総和の順序に依存し、ターゲットが違えば違うコンポーネントが返っていました。形状、非負性、再構成品質は影響を受けません。保存した係数を持っている場合や、以前のステム書き出しと比較する場合は、値が変わることを前提にしてください。
:::

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため、元音声への完全な往復変換ではありません。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。行列入力は行優先（row-major）です。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `mel_to_stft(mel, n_mels, n_frames, sample_rate?, n_fft?, fmin?, fmax?, htk?)` | `InverseResult` | メルスペクトログラムからリニア STFT パワー |
| `mel_to_audio(mel, n_mels, n_frames, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | メルスペクトログラムから音声（Griffin-Lim） |
| `mfcc_to_mel(mfcc_coeffs, n_mfcc, n_frames, n_mels?, lifter?)` | `InverseResult` | MFCC 係数からメルスペクトログラム（dB）。`lifter` は順方向の `mfcc(...)` と揃えます |
| `mfcc_to_audio(mfcc_coeffs, n_mfcc, n_frames, n_mels?, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | MFCC 係数から音声 |
| `cqt_to_audio(magnitude, n_bins, n_frames, sample_rate?, hop_length?, fmin?, bins_per_octave?, n_iter?)` | `list[float]` | row-major CQT 振幅行列から音声（Griffin-Lim） |
| `vqt_to_audio(magnitude, n_bins, n_frames, sample_rate?, hop_length?, fmin?, bins_per_octave?, gamma?, n_iter?)` | `list[float]` | row-major VQT 振幅行列から音声（Griffin-Lim） |

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
| `metering_crest_factor_db_stereo(left, right, sample_rate?, *, validate?)` | `float` | 両チャンネルから測るクレストファクター。ピークは 2 つのうち大きい方、RMS は両チャンネルをまとめて計算する |
| `metering_dc_offset(samples, sample_rate?, *, validate?)` | `float` | 平均（DC）オフセット、リニア振幅 |
| `metering_silence_ratio(samples, sample_rate?, threshold_db?, frame_length?, hop_length?, *, validate?)` | `float` | RMS が `threshold_db` を下回る解析フレームの割合。既定は `threshold_db=-45.0`、`frame_length=1024`、`hop_length=256` |
| `metering_true_peak_db(samples, sample_rate?, oversample_factor?, *, validate?)` | `float` | サンプル間ピーク（ISP、True Peak）を dBFS で返す。`oversample_factor` は 1..16 の 2 の冪（0 で既定 4） |
| `metering_detect_clipping(samples, sample_rate?, threshold?, min_region_samples?, *, validate?)` | `ClippingReport` | クリップしたサンプルの連続区間。`threshold` 既定 `0.999`、`min_region_samples` 既定 `1` |
| `metering_dynamic_range(samples, sample_rate?, window_sec?, hop_sec?, low_percentile?, high_percentile?, *, validate?)` | `DynamicRangeReport` | スライディングウィンドウのダイナミックレンジ。`window_sec`/`hop_sec` は `0.0` で既定値（窓 3 秒・ホップ 1 秒）。`low_percentile`/`high_percentile` は負値（既定 `-1.0`）で既定値（low 0.10・high 0.95）。`0.0` は既定ではなく 0 パーセンタイルの指定 |
| `metering_stereo_correlation(left, right, sample_rate?, *, validate?)` | `float` | 非中心化相関（コサイン類似度）、−1..1 |
| `metering_stereo_width(left, right, sample_rate?, *, validate?)` | `float` | ミッド/サイドのステレオ幅 |
| `metering_vectorscope(left, right, sample_rate?, max_points?, *, validate?)` | `VectorscopeReport` | ミッド/サイドの点列。`max_points` で上限を与えない限り 1 サンプル 1 点 |
| `metering_vectorscope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `VectorscopeReport` | 表示サイズのミッド/サイドベクトルスコープ。`max_points` が点数の上限（`0` またはバッファ長以上で 1 サンプル 1 点となり `metering_vectorscope` と同一）。それ以外は決定的に間引き、バケットごとに最大半径のサンプルを残す |
| `metering_phase_scope(left, right, sample_rate?, max_points?, *, validate?)` | `PhaseScopeReport` | フェーズスコープの点列と要約統計。`max_points` で上限を与えない限り 1 サンプル 1 点 |
| `metering_phase_scope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `PhaseScopeReport` | 表示サイズのフェーズスコープ（リサージュ＋要約統計）。`max_points` が点群の上限（同じ規則）。要約統計は常にフル解像度の信号で計算する |
| `metering_spectrum(samples, sample_rate?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | バッファ全体の Welch 平均による振幅/パワー/dB スペクトラム（Hann 窓・50% オーバーラップの `n_fft` フレームを平均。単一フレームのスナップショットではない）。`n_fft`/`octave_fraction`/`db_ref`/`db_amin` に `0` で既定値（2048 / 3 / 1.0 / 下限値） |
| `metering_spectrum_frame(samples, sample_rate?, frame_offset?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | 真の単一フレームスペクトラム（Hann 窓 FFT 1 回）。`[frame_offset, frame_offset + n_fft)` の範囲を処理し、末尾はゼロパディング。`frame_offset`/`n_fft`/`octave_fraction`/`db_ref`/`db_amin` に `0` で既定値 |

ダウンミックスを `metering_crest_factor_db(...)` に渡すのではなく、`metering_crest_factor_db_stereo(...)` を使ってください。`0.5 * (left + right)` のダウンミックスは逆相のペアを打ち消してしまうため、RMS を小さく見積もり、その分クレストファクターを大きく見せます。位相を反転させたペアでは、ステレオメーターが `11.64` dB、ダウンミックス経由が `0.00` dB になります。左右の長さが違う場合は `ValueError("left and right channel lengths must match")` を送出します。

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

::: tip 行優先（row-major）の行列レイアウト
このページで「row-major」と記した平坦化フィールドは、`[rows x n]` の行列を行ごとに並べたものです。先頭の `n` 個が 0 行目、次の `n` 個が 1 行目…と続きます。行数で reshape すると 2 次元の NumPy 配列に戻せます。

```python
import numpy as np
mat = np.asarray(flat).reshape(rows, n)   # 例: 12 ピッチクラスのクロマグラムなら reshape(12, n_frames)
```
:::

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
    confidence: float  # スコアリングされた候補全体のソフトマックス配分。[0, 1)
    name: str          # プロパティ -> "C major"、"A minor" など
    short_name: str    # プロパティ -> "C"、"Am" など

class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

class BpmHypothesis:
    value: float
    confidence: float
    relation: Literal["primary", "half", "double", "other"]

class Chord:
    root: PitchClass
    quality: str             # "major"、"minor"、"diminished"、"augmented"、
                             #   "dominant7"、"major7"、"minor7"、"sus2"、"sus4"、
                             #   "add9"、"minorAdd9"、"dim7"、"halfDim7"、
                             #   "major9"、"dominant9"、"sus2Add4"、
                             #   "major6"、"minor6"、"minorMajor7"、
                             #   "dominant7Sus4"、"dominant11"、"dominant13"、
                             #   "dominant7Flat9"、"dominant7Sharp9"、"unknown"
    start: float             # セグメント開始（秒）
    end: float               # セグメント終了（秒）
    confidence: float
    bass: PitchClass | None  # スラッシュコードのベース音。root と同じなら None
    name: str                # プロパティ -> "Cmaj7"、"Am"、"G/B"
    duration: float          # プロパティ -> end - start

class ChordAnalysisResult:
    chords: list[Chord]      # detect_chords(...) の戻り値の型

class AnalysisBeatObservations:
    onset_strength: list[float]        # 拍ごとの、窓処理済みアクセント値
    low_frequency_energy: list[float]
    chord_change: list[float]

class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
    beat_strengths: list[float]    # 拍ごとの、生で上限のないオンセットエンベロープ 1 フレーム
    downbeat_indices: list[int]    # beat_times のうち小節頭にあたる位置
    downbeat_phase: int            # 解析が第 1 小節の何拍目から始まるか
    beat_local_bpm: list[float]    # beat_times と平行。compute_tempo_curve=True
                                   #   でないかぎり空
    bpm_candidates: list[BpmHypothesis]
    time_signature_candidates: list[TimeSignature]
    beats: list[Beat]              # プロパティ: 各拍の強度を持つオブジェクト
                                   #   (Beat はパッケージ直下ではなく libsonare.types にある)
    chords: list[Chord]
    sections: list[Section]
    timbre: AnalysisTimbre | None
    dynamics: AnalysisDynamics | None
    rhythm: AnalysisRhythm | None
    melody: AnalysisMelody | None
    beat_observations: AnalysisBeatObservations | None
    form: str
    # 専用の detect_chords() / analyze_sections() / analyze_timbre() / ... は、
    # 1 つの側面だけ、または呼び出しごとのオプション指定に使えます。

class MeterEstimate:
    time_signature: TimeSignature
    downbeat_phase: int
    searched: bool                 # False = 系列が短すぎてスコアリングできなかった
    grouping: list[int]            # アクセントグループ（例 [3, 2, 2]）。合計は分子
    candidate_scores: list[float]  # 指定した分子の並びと平行
    candidates: list[TimeSignature]  # 支持度の降順

class NormalizeStereoResult:
    left: list[float]
    right: list[float]
    length: int
    applied_gain_db: float         # 両チャンネルに適用された単一のゲイン

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

class WaveformPeaksReport:
    min: NDArray[np.float32]   # チャンネルメジャー: channel * bucket_count + bucket
    max: NDArray[np.float32]   # チャンネルメジャー
    channels: int
    bucket_count: int
    samples_per_bucket: int

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
    max_pending_frames: int = 4096  # 上限到達時は新たに生成されたフレームを破棄
    max_progression_entries: int = 4096  # 進行データそれぞれの保持上限
    key_update_interval_sec: float = 5.0
    bpm_update_interval_sec: float = 10.0
    window: int = 0          # 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
    output_format: int = 0  # レガシー。省略するか Float32 の値（0）を維持

class StreamFrames:
    n_frames: int
    n_mels: int
    n_chroma: int             # クロマがあれば 12、なければ 0
    feature_flags: int        # MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    timestamps: list[float]
    mel: list[float]        # n_frames × n_mels。MEL がなければ空
    chroma: list[float]     # n_frames × n_chroma。CHROMA がなければ空
    onset_strength: list[float]  # ONSET がなければ空
    rms_energy: list[float]
    spectral_centroid: list[float]  # SPECTRAL がなければ空
    spectral_flatness: list[float]  # SPECTRAL がなければ空
    chord_root: list[int]            # CHROMA がなければ空
    chord_quality: list[int]         # CHROMA がなければ空
    chord_confidence: list[float]    # CHROMA がなければ空

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
    pending_frames: int
    dropped_output_frames: int
    dropped_chord_progression_entries: int
    dropped_bar_progression_entries: int
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
| メータリング | `ClippingRegion`, `StreamFramesU8`, `StreamFramesI16`, `WaveformPeaksReport` |
| マスタリング | `MasteringResult`, `MasteringStereoResult` |
| ミキシング | `MixerStereoResult` |
| プロジェクト | `AssistSidecar`（`project.get_assist_sidecar(index)` / `project.assist_sidecars()` の戻り値 — [プロジェクト編集](./project-editing.md#アシストサイドカー) を参照）、`NotePairValidation` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `MeterTelemetryRecord`, `MeterTelemetryRecordWide`, `ScopeTelemetryRecord` |

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
    )
)

for block in audio_blocks:
    stream.process(block)

    frames = stream.read_frames(stream.available_frames())
    # frames.mel は [n_frames * n_mels] のフラット配列
    # 任意配列は frames.feature_flags を確認してから読む。クロマは [n_frames * n_chroma]

    stats = stream.stats()
    if stats.bpm > 0:
        print(stats.bpm, stats.bpm_confidence)

stream.close()
```

UI 転送量を抑える場合は、`read_frames(max_frames)` の代わりに量子化読み出しを使います。`output_format` はソース互換性のためだけに残っているので、省略するか `0` のままにし、使いたい読み出しメソッドを明示してください。

| メソッド | 変わる点 |
|----------|----------|
| `read_frames_u8(max_frames, quantize_config?)` | 特徴量配列を unsigned 8-bit 値へ量子化します。 |
| `read_frames_i16(max_frames, quantize_config?)` | 特徴量配列を signed 16-bit 値へ量子化します。 |

`quantize_config` は任意の `QuantizeConfig`（`libsonare` からエクスポート）で、既定より大幅に大きい／小さいストリームに合わせて量子化レンジを広げます。省略すると既定値を使います。フィールドと既定値は `mel_db_min=-80.0`、`mel_db_max=0.0`、`onset_max=50.0`、`rms_max=1.0`、`centroid_max=11025.0` です。量子化器は正規化値を `[0, 1]` にクランプするため、このレンジを外れた信号は端点へ静かに飽和します。これは JS/WASM ストリーミングドキュメントの `StreamQuantizeConfig` に対応します。

どちらもタイムスタンプは float のまま保持します。外部の音声クロックと同期したい場合は、`process_with_offset(samples, sample_offset)` でチャンク開始位置を明示してください。

`process_with_offset` が受け付けるのは連続したオフセットだけです。ギャップやシークの後、または `process(...)` から切り替える前には、`reset(base_sample_offset)` を呼んでから次のブロックを渡してください。`StreamConfig.max_progression_entries`（既定 `4096`）はコード進行と小節進行をそれぞれ保持する上限です。最古の履歴が破棄された場合は、`stats()` の `dropped_chord_progression_entries` と `dropped_bar_progression_entries` で確認できます。

## ストリーミング EQ API

`StreamingEqualizer` は、ネイティブのブロック処理 EQ エンジンを Python から扱うオブジェクトです。ライブプレビュー、プロセッサ UI、マスタリングチェーンを組まずにソースの音色をリファレンスへ寄せる用途に使えます。

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

Python からもブラウザデモと同じ名前付きマスタリングプロセッサを利用できます。まず一覧取得用のヘルパー関数で、現在のビルドに含まれるプロセッサ名を確認したうえで、モノラル／ステレオ／ペア／解析の各 API をパラメータ明示で呼び出します。フルチェーンは各ステージを下の固定順で実行します。

<FlowDiagram
  title="マスタリングチェーンの順序"
  :nodes="[
    { id: 'repair', label: 'リペア', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'ダイナミクス', col: 2, row: 0 },
    { id: 'saturation', label: 'サチュレーション', col: 3, row: 0 },
    { id: 'spectral', label: 'スペクトル', col: 4, row: 0 },
    { id: 'stereo', label: 'ステレオ', col: 5, row: 0 },
    { id: 'maximizer', label: 'マキシマイザー', col: 6, row: 0 },
    { id: 'loudness', label: 'ラウドネス', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="有効化したステージだけが処理されますが、有効なステージは常にこの順で実行されます。"
/>

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

catalog = sonare.mastering_processor_catalog()
insert_params = sonare.mastering_insert_param_info("eq.parametric")

# プリセット式のチェーン（一括処理）
sonare.mastering_preset_names()
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech', 'streaming', 'youtube', 'broadcast', 'podcast', 'audiobook', 'cinema', 'jpop', 'ambient', 'lofi', 'classical', 'drumAndBass', 'techno', 'metal', 'trap', 'rnb', 'jazz', 'kpop', 'trance', 'gameOst']
chain_result = sonare.master_audio(
    samples,
    sample_rate=sample_rate,
    preset_name="aiMusic",
    overrides={
        "loudness.targetLufs": -13,
        "maximizer.truePeakLimiter.releaseMs": 50,
        "maximizer.truePeakLimiter.applyGainAtInputRate": False,
    },
)
print(chain_result.output_lufs, chain_result.output_true_peak_dbtp, chain_result.output_lra)
print(chain_result.stage_gain_reductions)
if chain_result.report is not None:
    print(chain_result.report.before, chain_result.report.after)
    print(chain_result.report.band_energy_delta_db)

# ブロック単位のストリーミング処理
with sonare.StreamingMasteringChain({
    "eq.tilt.tiltDb": 0.5,
    "dynamics.compressor.thresholdDb": -20.0,
}) as chain:
    chain.prepare(sample_rate=48000, max_block_size=512, num_channels=1)
    print(chain.stage_names(), chain.latency_samples)  # latency_samples はプロパティ
    output = chain.process_mono([0.0] * 512)
    while True:
        tail = chain.flush_mono()
        if not tail:
            break
        output.extend(tail)

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

# ステレオ入口: パラメータも戻り値の JSON も同じで、測定だけが両チャンネル基準になります。
stereo_profile = json.loads(sonare.mastering_audio_profile_stereo(left, right, sample_rate=sample_rate, params={
    "n_fft": 2048,
    "hop_length": 512,
    "true_peak_oversample": 4,
}))
stereo_suggestions = json.loads(sonare.mastering_assistant_suggest_stereo(left, right, sample_rate=sample_rate, params={
    "target_lufs": -14,
    "ceiling_db": -1,
    "prefer_streaming_safe": True,
}))
# platforms を省略すると、組み込みの Spotify / Apple Music / YouTube のセットが使われます。
stereo_preview = json.loads(sonare.mastering_streaming_preview_stereo(left, right, sample_rate=sample_rate))
```

3 つの JSON ヘルパーにはそれぞれ `_stereo` 版があります。バッファ 1 本ではなく `left` と `right` を受け取り、`params` / `platforms` は同じもの、戻り値も同じ JSON 文字列です。2 チャンネルの素材を扱うときは常にこちらを使ってください。モノラル側の入口は `0.5 * (left + right)` のダウンミックスを測定するため、相関の低いステレオ素材では約 6 dB 低く出ます。その分だけ、インテグレーテッドラウドネス、そこから導かれるノーマライズゲイン、ピーク余裕の判定がまとめて過小評価されます。相関を落としたピンクノイズのペア（48 kHz・4 秒）では、ダウンミックス経由が -22.55 LUFS、ステレオ経由が -16.44 LUFS で、差は 6.11 dB でした。同じ差が Spotify の `normalizationGainDb` を +2.44 から +8.55 に押し上げます。相関の高いペアでは差は 3.01 dB にとどまり、これはダウンミックスで振幅が半分になる分です。残りの約 3 dB が相関の低さによるものです。

ステレオプロファイルのうち、両チャンネルから測るのは `loudness` ブロックだけです。インテグレーテッド LUFS と LRA はチャンネルを合算したプログラムから求め、True Peak は 2 つのうち大きい方を採ります。スペクトル・ダイナミクス・テンポの各フィールドは絶対レベルではなく形と時間構造を表すため、ダウンミックス基準のまま据え置き、モノラル呼び出しの結果とそのまま比較できます。

`mastering_audio_profile()` は任意のプロファイル設定として `n_fft`、`hop_length`、`true_peak_oversample` を受け取れます。`mastering_assistant_suggest()` は `target_lufs`、`ceiling_db`、`enable_repair`、`prefer_streaming_safe`、`speech_mono_amount` を受け取ります。共有ネイティブパーサーを通るため、camelCase の別名も使えます。

マスタリング helper では、リミッターのリリースと静的ゲイン段の位置も指定できます。単発の `mastering()` helper は `release_ms`（`0` なら 50 ms のライブラリ既定値を維持）と `apply_gain_at_input_rate` を使います。プリセット／チェーンの上書きではフラットキーの `"maximizer.truePeakLimiter.releaseMs"` と `"maximizer.truePeakLimiter.applyGainAtInputRate"` を使い、渡した上書き値がそのまま適用されます。

オフラインのチェーン／プリセット結果は、設定したラウドネス用オーバーサンプル倍率での `output_true_peak_dbtp`、EBU R128 ラウドネスレンジ（LU）の `output_lra`、`stage_gain_reductions` も報告します。各リダクションには、報告したダイナミクス／マキシマイザーステージと、その直近のゲインリダクション（0 以下の dB）が入ります。

`result.report` が存在する場合、その `before` と `after` にはそれぞれ `integrated_lufs`、`max_momentary_lufs`、`max_short_term_lufs`、`true_peak_dbtp`、`loudness_range` が入ります。レポートには適用ゲイン、最大ゲインリダクション、ピークの余裕によってラウドネス目標が制限されたかどうか、処理前後の対数スペクトルエネルギー変化を示す 32 バンドの `band_energy_delta_db` も入ります。

ストリーミング入力の最終ブロック後は、空のリストが返るまで `flush_mono()` を呼び、ステレオでは 2 つの空リストが返るまで `flush_stereo()` を呼びます。

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
| ステレオ両チャンネルから音源プロファイルを取得 | `mastering_audio_profile_stereo()` |
| 音源解析からマスタリングの提案を取得 | `mastering_assistant_suggest()` |
| ステレオ両チャンネルからマスタリングの提案を取得 | `mastering_assistant_suggest_stereo()` |
| 配信先ごとのラウドネス見込みをプレビュー | `mastering_streaming_preview()` |
| ステレオ両チャンネルから配信先ごとのラウドネス見込みをプレビュー | `mastering_streaming_preview_stereo()` |
| 名前付きプロセッサ一覧（モノラル／ステレオ） | `mastering_processor_names()` |
| プロセッサ分類カタログを取得 | `mastering_processor_catalog()` |
| チェーンのインサートプロセッサ一覧 | `mastering_insert_names()` |
| インサートが受け付けるパラメータキー一覧 | `mastering_insert_param_names(name)` |
| リアルタイムオートメーション可能なインサートパラメータ一覧 | `mastering_insert_param_info(name)` |
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
    print(mixer.scene_warnings())  # 非致命的: どのプロセッサも読まない insert パラメータ（タイプミス）
    print(mixer.latency_samples())  # ドライ／ウェット整列用のコンパイル済みグラフ遅延
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
finally:
    mixer.close()
```

`mixer.process_stereo(...)` は `MixerStereoResult` 名前付きタプルを返します。`.left` と `.right`（`list[float]`）、`.sample_rate`（`int`）を持ち、Node/WASM の `{left, right, sampleRate}` と同じ形です。

`Mixer.set_pan_law(...)` と `RealtimeEngine.set_track_strip_pan_law(...)` は、
`PanLaw` enum、整数の序数、または大文字小文字を区別しない文字列エイリアスを受け取ります。
`const3db`、`const-3db`、`-3db`、`const4.5db`、`const-4.5db`、`-4.5db`、
`const6db`、`const-6db`、`-6db`、`linear0db`、`linear-0db`、`linear`、`0db` が使え、
アンダースコアはハイフンとして扱われます。

ルーティングの考え方、シーンプリセット、リアルタイム処理の注意点は [ミキシングエンジン](./mixing.md) を参照してください。

## プロジェクト・インストゥルメント・ライブ MIDI

ヘッドレス DAW の機能群は Python からも利用できます。`Project` でアレンジを作り、内蔵インストゥルメントでレンダーし、ライブ MIDI をリアルタイムエンジンへ送れます。詳細は各専用ガイドにあります。ここは Python の入口をまとめたマップです。

| やりたいこと | API | ガイド |
|--------------|-----|--------|
| トラック、クリップ、テンポ、マーカー、undo/redo を編集する | `Project`（コンテキストマネージャ。`with` を使う） | [プロジェクト編集](./project-editing.md) |
| 内蔵シンセサイザー（NativeSynth）で MIDI をレンダーする | `Project.bounce_with_synth_instrument(...)`、`synth_preset_names()`、`synth_preset_patch(name)`、`SynthPatch` | [内蔵シンセサイザー](./native-synth.md)、[プロジェクトのバウンス](./project-bounce.md) |
| SoundFont で MIDI をレンダーする | `Project.load_soundfont(data)`、`Project.bounce_with_sf2_instrument(...)` | [SoundFont プレイヤー](./soundfont-player.md) |
| バウンス中に自前のインストゥルメントをホストする | `ExternalInstrument` プロトコルを使う `Project.bounce_with_instruments(...)`。`render(channels, num_frames)` コールバックに加え、任意の `prepare`/`on_event` フックと `latency_samples` を持ちます。**Python 専用です**。 | [プロジェクトのバウンス](./project-bounce.md) |
| MIDI イベントからインストゥルメントをライブ演奏し、送出先（デスティネーション）の MIDI FX を差し替える | `RealtimeEngine.set_synth_instrument(...)`、`RealtimeEngine.load_soundfont(...)`、`RealtimeEngine.set_midi_fx(...)`、およびエンジンの MIDI 入力キュー | [MIDI 入力](./midi-input.md) |
| ライブエンジンへ MIDI クリップをサンプル精度でスケジュールする | `EngineMidiClipSchedule` / `EngineMidiEvent` を渡す `RealtimeEngine.set_midi_clips([...])`、`RealtimeEngine.sample_at_ppq(ppq)`。ppq は音楽的時間の単位で、四分音符あたりのパルス数です | [リアルタイムエンジン](./realtime-engine.md#midi-クリップスケジューリングと-sampleatppq) |
| トラック単位のキューモニタリングを設定する | `RealtimeEngine.set_track_monitor_mode(lane_index, mode, render_frame=-1)`。`EngineTrackMonitorMode`（`off`／`pfl`／`afl`）を使います。PFL はフェーダー前、AFL はフェーダー後を試聴します | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| デスティネーションを外部 MIDI ハードウェアへ送る | `set_midi_destination_external(...)`、`set_external_midi_clock_enabled(...)`、`drain_external_midi(...)`、`external_midi_dropped_count()` | [リアルタイムエンジン](./realtime-engine.md#トラックを外部-midi-機器へ送る) |
| エンジンのトラックをライブミックス／自動化する | レーン／ストリップ操作に加え、`set_bus_strip_insert_param_by_name(...)`、`set_bus_strip_insert_bypassed(...)`、`resolve_track_insert_automation_id(...)`、`resolve_master_insert_automation_id(...)`、`resolve_bus_insert_automation_id(...)`、`set_param_smoothing_ms(...)` | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| ワイドメーターとスコープを読む | `drain_meter_telemetry_wide(...)`、`configure_scope_telemetry(...)`、`drain_scope_telemetry(...)` | [リアルタイムエンジン](./realtime-engine.md#サラウンドグループバスとワイドメーター) |

```python
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    track = project.add_track(kind="midi")
    # ... クリップと MIDI イベントを追加（プロジェクト編集ガイドを参照） ...
    audio = project.bounce_with_synth_instrument("e-piano", num_channels=2)
```

`Project` は自動クリーンアップのために `with` に対応しますが、`Mixer` は対応しません（`mixer.close()` を明示的に呼んでください）。

シンセプリセットの確認には `synth_preset_patch(name)` を使います。名前付きカタログプリセットを `SynthPatch` として返すので、バインドする前にフィールドを確認・調整できます（不明な名前では `SonareError` を送出し、`'va:'` ルーティング接頭辞も受け付けます）。`synth_enum_tables()` は実行時の enum 名テーブル（`dict[str, tuple[str, ...]]`）を返し、`SynthModRouting` のソース／デスティネーション名を、読み込まれたビルドに対して検証できます。

`SynthPatch` の数値フィールドはすべて既定値が `None` で、「ベースプリセットの値を保つ」という意味です。設定していないフィールドを読むと `0.0` ではなく `None` が返り、値を渡せばそれは明示的な上書きになります。`0` も同様なので、`SynthPatch(preset="warm-pad", amp_sustain=0)` は未設定として扱われず、アンプサステインを本当にゼロにします。`synth_preset_patch(name)` から得たパッチはプリセットの具体値で埋まって返るため、数値フィールドが `None` になることはありません。enum フィールド（`engine_mode`、`waveform`、`filter_model`、`filter_output`、`body`）では `0` ／ `"default"` が「ベースを保つ」を意味します。`mod_routings=None` はベースのモッドマトリクスを保ち、空タプルは消去、要素のあるタプルは置き換えです。

### 不透明なアシストサイドカー

`Project` は、プロジェクトごとでアンドゥ可能、モジュールが所有する不透明なバイト列（アシストサイドカー）を保持できます。スコープはモジュール ID・ターゲットトラック・領域です。`project.set_assist_sidecar(module_id, payload, *, schema_version=0, target_track_id=0, region_start_ppq=0.0, region_end_ppq=0.0)` で設定し、`project.assist_sidecar_count()`、`project.get_assist_sidecar(index) -> AssistSidecar`、`project.assist_sidecars()` で読み出します。バインディング間の詳細は [プロジェクト編集](./project-editing.md#アシストサイドカー) を参照してください。
