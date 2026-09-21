# Python API

libsonare は、スクリプト、ノートブック、バッチ処理、ローカルツール向けの Python バインディングを提供します。Python パッケージは **ctypes** 経由でネイティブの libsonare ライブラリを呼び出すため、独自の C 拡張をビルドしなくても、コンパイル済みの C/C++ エンジンを Python から使えます。対応対象の Linux/macOS 向けに PyPI ホイールを配布しています。

::: details ctypes（と C API）とは？
libsonare のコアはコンパイル済みの C/C++ です。

**ctypes** は、コンパイル済み共有ライブラリ（`.so`／`.dylib`）の関数を直接呼び出せる Python 標準の仕組みです。追加の C 拡張をビルドする必要はありません。

Python パッケージは、呼び出しを C++ ライブラリと同じネイティブコードへ橋渡しします。そのため、素の Python からネイティブ速度を得られます。

ここでいう **C API** は、Python が内部で呼び出すフラットな C 関数群を指します。
:::

このページは、スクリプト、ノートブック、バッチ解析、ローカルツールから音声ファイルを直接扱いたい人向けです。ブラウザ UI を作らない場合、Python パッケージが最も入りやすい選択肢になることが多いです。リファレンスは 3 つの姉妹ページに続きます。解析関数と特徴抽出関数は [Python 解析 API](./python-api-analysis.md)、オーディオエフェクト・ルーム音響解析・リアルタイムボイスチェンジャーは [Python エフェクト API](./python-api-effects.md)、結果と設定の型は [Python 型定義](./python-api-types.md) を参照してください。

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
3. 属性名、行優先の行列形状、JS 互換の別名が必要になったときだけ [型定義](./python-api-types.md#型定義) に戻る。

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

## 各節の移動先

| 節 | 移動先 |
|----|--------|
| オーディオエフェクト | [Python エフェクト API](./python-api-effects.md#オーディオエフェクト) |
| 特徴抽出 | [Python 解析 API](./python-api-analysis.md#特徴抽出) |
| 単位変換 | [Python 解析 API](./python-api-analysis.md#単位変換) |
| API リファレンス（Audio、解析関数） | [Python 解析 API](./python-api-analysis.md#api-リファレンス) |
| ルーム音響解析 | [Python エフェクト API](./python-api-effects.md#ルーム音響解析) |
| エフェクト関数 | [Python エフェクト API](./python-api-effects.md#エフェクト関数) |
| リアルタイムボイスチェンジャー | [Python エフェクト API](./python-api-effects.md#リアルタイムボイスチェンジャー) |
| 特徴抽出関数 | [Python 解析 API](./python-api-analysis.md#特徴抽出関数) |
| 逆再構成関数 | [Python 解析 API](./python-api-analysis.md#逆再構成関数) |
| メータリング関数 | [Python 解析 API](./python-api-analysis.md#メータリング関数) |
| スケール量子化 | [Python 解析 API](./python-api-analysis.md#スケール量子化) |
| librosa 互換ヘルパー | [Python エフェクト API](./python-api-effects.md#librosa-互換ヘルパー) |
| 変換関数 | [Python 解析 API](./python-api-analysis.md#変換関数) |
| 型定義 | [Python 型定義](./python-api-types.md#型定義) |
