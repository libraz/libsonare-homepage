---
title: Python 解析 API
description: libsonare Python パッケージの解析関数、特徴抽出、逆再構成、メータリング、スケール量子化、変換関数のリファレンスです。
---

# Python 解析 API

libsonare Python パッケージの解析関数と特徴抽出関数のリファレンスです。インストール、クイックスタート、その他の API ファミリーは [Python API](./python-api.md) の索引ページを参照してください。

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

共通の特徴量・編集・ラウドネス・マスタリング・リサンプリング系メソッドに加えて、`analyze_bpm(...)`、`analyze_impulse_response(...)`、`detect_acoustic(...)`、`analyze_rhythm(...)`、`analyze_dynamics(...)`、`analyze_timbre(...)`、位置引数形式の `detect_chords(...)` も使えます。

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
| `analyze(samples, sample_rate)` | `AnalysisResult` | 総合解析: BPM とその候補・キー・拍子とその候補・ビート・検出キーを基準にした `roman_numeral` 付きコード・セクション・音色・ダイナミクス・リズム・メロディ・フォーム |
| `analyze_with_progress(samples, sample_rate, on_progress?)` | `AnalysisResult` | `analyze` と同じ結果・解析キーワードオプションに、任意の `(progress, stage)` コールバックとキーワード専用の `cancel` コールバックを加えたもの |
| `transcribe(samples, sample_rate, ...)` | `TranscribeResult` | モノラル音声を一定テンポの PPQ グリッド上の MIDI イベントへ変換。`events`、`note_count`、`tempo_bpm` を返します |
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
| `room_morph(samples, sample_rate, length_m, width_m, height_m, ...)` | `RoomMorphResult` | 目標ルームへ寄せるオフラインのルームモーフィング。モーフィング後のサンプルは `.audio`、サンプルレートは `.sample_rate`、診断情報は `.diagnostics` から読み取ります |
| `version()` | `str` | ライブラリバージョン |
| `voice_changer_abi_version()` | `int` | リアルタイムボイスチェンジャー POD 設定の ABI バージョン。プリセット JSON の `schemaVersion` とは別 |
| `voice_character_preset_id(preset)` | `str \| None` | 整数の序数から正規の voice-character プリセット ID を返す。未知の序数は `None` |
| `realtime_voice_changer_preset_config(preset)` | `RealtimeVoiceChangerConfig` | JSON 解析なしで、組み込みボイスプリセットの解決済みフラット POD 設定を返す |
| `engine_abi_version()` | `int` | リアルタイムエンジンインターフェースの ABI バージョン |
| `project_abi_version()` | `int` | `Project` のシリアライズ、バウンス、リアルタイムクリップ交換で使うプロジェクト／編集 API の ABI バージョン |
| `has_ffmpeg_support()` | `bool` | 読み込まれたネイティブライブラリが FFmpeg デコードに対応しているか |

### `transcribe(...)`

`sonare.transcribe` はモノラル音声を、一定テンポの PPQ グリッド上のノートイベントへ変換します。`tempo_bpm` を渡すとそのテンポでグリッドを作り、省略するとテンポを検出します。戻り値の `TranscribeResult` には `events`、`note_count`、使用した `tempo_bpm` が含まれ、プロジェクトのテンポマップは変更しません。

```python
result = sonare.transcribe(
    samples,
    sample_rate,
    tempo_bpm=120.0,
    polyphonic=True,
)
print(result.note_count, result.tempo_bpm)
project.set_midi_events(clip_id, result.events)
```

プロジェクトのテンポマップに合わせる場合は `Project.transcribeToClip(...)`／`project.transcribe_to_clip(...)` を使います。

コア解析、エフェクト、特徴量、ラウドネス、マスタリングの多くは
`Audio` インスタンスメソッドとしても使えます（例: `audio.detect_bpm()`）。
一方で `analyze_sections(...)`、`analyze_melody(...)`、`cqt(...)`、`vqt(...)`
など一部の詳細ヘルパーはスタンドアロン関数です。これらには `audio.data` と
`audio.sample_rate` を渡してください。

Python の `analyze(...)` は現行ビルドでは内部で `sonare_analyze_json_ex` を呼び、BPM と順位付き BPM 仮説、キー、拍子とその候補、ビート時刻・拍ごとの強度に加えて、検出キーを基準にした `roman_numeral` を持つコード、セクション、音色、ダイナミクス、リズム、メロディ、フォームまで含む `AnalysisResult` を 1 回で返します（他のバインディングと揃っています）。上の専用関数は、1 つのフィールドだけが欲しい、呼び出しごとにオプションを変えたい、または結果全体の再計算を避けたいときに役立ちます。ルーム音響（RT60 など）は `AnalysisResult` には含まれず、`estimate_room` などのルームヘルパーで取得します。

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

`analyze(...)` は `MusicAnalyzerConfig` 全体をキーワード引数として受け取ります。`n_fft=2048`、`hop_length=512`、`bpm_min=60.0`、`bpm_max=200.0`、`start_bpm=120.0`、`use_triads_only=True`、`use_hpss=True`、`chroma_highpass_hz=80.0`、`use_bass_weighted=True`、`chroma_hop_multiplier=4`、`use_chord_hmm=False`、`use_chord_key_context=False`、`chord_hmm_beam_width=24`、`detect_chord_inversions=False`、`adaptive_tempo=False`、`tempo_update_interval_beats=8`、`compute_tempo_curve=False`、`meter_candidate_numerators=None`、`meter_denominator=4`、`tuning=0.0` です。

`tuning` は `estimate_tuning(...)` が返す単位で指定する、半音の分数単位の録音チューニングずれです。範囲は `[-0.5, 0.5)`、既定値 `0.0` は A440 です。`analyze_with_progress(...)` でも同じキーワードを使え、キー・コード・セクションに使うクロマへ反映されます。

::: warning `use_triads_only` はここでは既定が **True** です
統合された `analyze(...)` の経路は、明示的に指定しないかぎりトライアドだけを探索します。一方、単独の `detect_chords(...)` API は同じフラグの既定が `False` です。`analyze(...)` からセブンスやテンションを得たい場合は `use_triads_only=False` を渡してください。
:::

このうち 3 つは特に注意が必要です。

- `meter_candidate_numerators` の既定はネイティブの候補集合 `(3, 4, 6)` です。変拍子は、その分子を候補に含めた場合にのみ報告されます。要素は最大 16 個、各要素は `[2, 32]` の範囲です。候補を広げても広い拍子が強制されるわけではありません。
- `meter_denominator`（`[1, 32]` の 2 のべき乗）は、検出した拍子に対して報告される拍の単位です。`analyze(...)` は音声を持っているので、複合拍子を解決したときは自身の判断で `8` を報告します。
- `compute_tempo_curve=True` は `beat_local_bpm` を埋めます。既定で無効なのは、解析精度が上がるわけではなく出力が 1 つ増えるだけだからです。`adaptive_tempo=True` も併せて指定しないかぎりビートトラッキングは単一のテンポ事前分布を保持するため、実際に変動するテンポを測るには両方が必要です。

#### 結果の読み方

- `key.confidence` は、スコアリングされた全候補のプロファイル相関に対するソフトマックスです。値域は `[0, 1)` で、候補の confidence の総和は 1 になります。したがって 24 候補中の 1 つが 1 に達することはなく、根拠が割れる平行調どうしはそれぞれおよそ半分を報告します。これはクロマがどれだけ明確に候補集合から 1 つを選び取ったかを示す値であり、**その選択がどれだけの頻度で正しいかではありません**。アノテーション付き録音に対して較正されたものは何もないため、この値で処理を分岐させる場合は、自分の素材で確かめてしきい値を決める必要があります。
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

`Chord.quality` は[型定義](./python-api-types.md#型定義)に列挙した文字列のいずれかです。そのうちいくつかは互いにアナグラムで、クロマグラムではこのペアを区別できません。`major6` は短 3 度下の `minor7` と同じ構成音で、`minor6` はその下の `halfDim7`、`dominant7Sus4` は完全 4 度下の `sus2Add4` と同じです。各ペアでは確立された読み方が既定のまま残り、6th へ持ち上げられるのはベースの証拠がある場合だけです。

長いファイルでは、`analyze_with_progress(...)` が `analyze(...)` と同じ `AnalysisResult` を返し、`tuning` を含む同じ解析キーワード、`on_progress=(progress, stage)` コールバック、キーワード専用の `cancel` コールバックを受け取れます。下のマスタリング進捗コールバックと同じ形です。

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.analyze_with_progress(audio.data, audio.sample_rate, on_progress=on_step)
```

`detect_chords(...)` と `chord_functional_analysis(...)` の `tuning` も `analyze(...)` と同じ半音の分数単位です。コードをキー基準のローマ数字でラベル付けするには `chord_functional_analysis(...)` を使います。`detect_chords(...)` と同じアルゴリズムでコードを検出し、検出順に 1 コードあたり 1 ラベルを返します。`detect_chords(...)` の結果とラベルが対応するのは、両方に同じオプションを渡したときだけです。

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
| `decompose_stems_linked(channels, sample_rate?, n_components?, n_fft?, hop_length?, n_iter?, beta?, init?, mask_power?, *, validate?)` | `dict[str, object]` | 1 つ以上の同じ長さのチャンネル（最大 64）で共有 NMF 分離を行い、チャンネル間のレベルと位相を保ちます。`components[k][c]` の平面を返し、既定値は `decompose_stems` と同じです。1 チャンネルならビット単位で一致します |
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

マルチチャンネル入力には `decompose_stems_linked(...)` を使います。各チャンネルの振幅を平均して 1 つの NMF モデルとソフトマスクを作り、そのマスクを各チャンネルの元の複素スペクトルへ同じまま適用します。チャンネル間のレベル差と位相差が保たれます。同じ長さのチャンネルを 1 つ以上、最大 64 チャンネルまで渡してください。各 `components[k]` はチャンネルを行にした 2 次元の float32 配列で、`components[k][c]` が成分 `k` のチャンネル `c` です。`w` と `h` はチャンネル間で共有され、既定値は `decompose_stems` と同じです。1 チャンネルなら `decompose_stems(...)` とビット単位で一致します。

```python
linked = sonare.decompose_stems_linked(
    [left_channel, right_channel], sample_rate=sample_rate
)
first_left = linked["components"][0][0]
first_right = linked["components"][0][1]
print(linked["w"].shape, linked["h"].shape)
```

このエントリポイントでは `n_components`、`n_fft`、`hop_length`、`n_iter` が実際の既定値を持つため、`0` は「既定値を使う」というセンチネル（C ABI と JavaScript 側の同じフィールドではそう解釈されます）ではなく、呼び出し側の誤りとして拒否されます。

::: warning NNDSVD のシードは倍精度で計算されます
これは精度の改善ではなく**再現性**の確保です。振幅スペクトログラムの末尾側の特異ベクトルは単精度のノイズフロアに埋もれるため、float でシードすると総和の順序に依存し、ターゲットが違えば違うコンポーネントが返ってしまいます。形状、非負性、再構成品質は影響を受けません。`decompose` と `decompose_stems` は、同じ入力でも単精度のシードとは異なる係数を返すため、単精度のシードで得た保存済みの係数やステム書き出しとは一致しません。
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

### 単位変換

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
