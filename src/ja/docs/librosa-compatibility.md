# librosa 互換性

libsonare の関数が Python の librosa ライブラリにどのように対応するかを説明します。

::: tip このページの読み方
- **librosa を知らない**：まず [イントロダクション](/ja/docs/introduction) と [MIR の全体像](/ja/docs/glossary/concepts/mir-overview) を読んでから戻ってきてください。
- **librosa から移行したい**：本ページ末尾の [移行ガイド](#移行ガイド) と [既知の違い](#既知の違い) を最初に確認するのが近道です。
- **対応関係だけ知りたい**：[機能比較](#機能比較) の各テーブルを参照してください。
:::

## 概要

libsonare は、[librosa](https://librosa.org/) と同じような MIR（music information retrieval：音声からテンポ・キー・ピッチなどの音楽的特徴を抽出する分野）の基本部品を提供しつつ、C++、Python バインディング、Node.js ネイティブバインディング、WebAssembly での利用を想定しています。librosa の完全なドロップイン置き換えではありません。API、デフォルト値、数値計算の細部は異なる場合があります。libsonare のテストスイートでは、一部の機能について librosa 0.11 の参照値と比較しています。

## 目的別マップ

長い対応表を見る前に、この表で入口を選んでください。

| librosa コードでやっていること | libsonare で使うもの | 注意点 |
|--------------------------------|----------------------|--------|
| ファイルを読み込み、単発解析する | `Audio.from_file(...)` のあと `detect_bpm`, `detect_key`, `analyze` | ブラウザ/WASM はファイルをデコードしません。先に Web Audio などで PCM にします |
| ML 用のスペクトログラム特徴を作る | `stft`, `melSpectrogram` / `mel_spectrogram`, `mfcc`, `pcen` | 比較時は `n_fft`, `hop_length`, `n_mels`, `n_mfcc` を明示してください |
| クロマや和声特徴を計算する | `chroma`, `chromaCqt` / `chroma_cqt`, `nnlsChroma` / `nnls_chroma`, `tonnetz` | `chromaCqt` / `chroma_cqt` が `librosa.feature.chroma_cqt` の直接の相当。`nnlsChroma` は別物の NNLS 音符活性化クロマです |
| テンポ、ビート、オンセット、パルスを見る | `onsetEnvelope`, `detectOnsets`, `detectBeats`, `detectBpm`, `tempogram`, `plp` | 高レベル検出器はビート／オンセット時刻を秒で返します |
| 音声を編集・変換する | `hpss`, `hpssWithResidual` / `hpss_with_residual`, `timeStretch` / `time_stretch`, `phaseVocoder` / `phase_vocoder`, `pitchShift` / `pitch_shift`, `remix`, `trimSilence` / `trim_silence` | フェーズボコーダー、HPSS、リサンプリングの細部は librosa と異なります |
| 単位変換や配列整形をする | `framesToSamples`, `samplesToFrames`, `frameSignal`, `padCenter`, `fixLength`, `vectorNormalize` | JS は camelCase、Python は snake_case です |
| 特徴量から近似音声を復元する | `melToAudio`, `mfccToAudio` | Griffin-Lim による位相推定なので、復元はロスがあります |

::: info PCEN とは？
PCEN（Per-Channel Energy Normalization）は、メルスペクトログラムを対数スケール化する代わりの手法です。周波数バンドごとに自動ゲイン制御をかけ、定常的な背景ノイズを抑えてラウドネスを平準化します。ML や音響イベント検出での頑健性を高めることがよくあります。
:::

## 検証カバレッジ

ここでいう互換性は「API が同一」という意味ではありません。librosa の挙動を参照し、近い結果になるかをテストしている、という意味です。

libsonare リポジトリには、STFT、Mel/MFCC、chroma、CQT、pitch、tuning、onset/beat/tempo、tempogram/PLP、PCEN、spectral contrast/poly features/zero crossings、dB 変換、フレーミング／シーケンスヘルパー、silence trim/split、HPSS、harmonic/decompose/NN filter/remix/phase vocoder、tonnetz などについて librosa 参照比較テストがあります。

下の許容誤差は、移行時の目安として読んでください。すべての入力で厳密に同じ数値になることを保証するものではありません。

## 機能比較

### サポートされている機能

#### コア／IO

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.load()` | `Audio::from_file()` | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 |
| `librosa.resample()` | `resample()` | librosa 0.11 は標準で soxr、libsonare は r8brain を使用 |
| `librosa.stft()` | `Spectrogram::compute()` / `stft()` | デフォルト値は互換。小さな数値差は発生します |
| `librosa.istft()` | `Spectrogram::to_audio()` | OLA 再構成 |
| `librosa.power_to_db()` | `powerToDb()` / `power_to_db()` | `ref`／`amin`／`top_db` 対応 |
| `librosa.amplitude_to_db()` | `amplitudeToDb()` / `amplitude_to_db()` | 同上 |
| `librosa.db_to_power()` | `dbToPower()` / `db_to_power()` | `power_to_db` の逆変換 |
| `librosa.db_to_amplitude()` | `dbToAmplitude()` / `db_to_amplitude()` | `amplitude_to_db` の逆変換 |

#### エフェクト

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.effects.hpss()` | `hpss()` | メディアンフィルタリング |
| residual を含む `librosa.effects.hpss()` 相当 | `hpssWithResidual()` / `hpss_with_residual()` | 倍音、打撃、残差信号を返す |
| `librosa.effects.harmonic()` | `harmonic()` | 倍音成分のみ |
| `librosa.effects.percussive()` | `percussive()` | 打撃成分のみ |
| `librosa.effects.time_stretch()` | `time_stretch()` / `timeStretch()` | フェーズボコーダー |
| `librosa.phase_vocoder()` | `phaseVocoder()` / `phase_vocoder()` | 直接のフェーズボコーダー時間伸縮 |
| `librosa.effects.pitch_shift()` | `pitch_shift()` / `pitchShift()` | タイムストレッチとリサンプリング |
| `librosa.effects.remix()` | `remix()` | 区間スライスの並べ替え／連結。区間単位はサンプル |
| `librosa.effects.preemphasis()` | `preemphasis()` | `coef`、任意の `zi` |
| `librosa.effects.deemphasis()` | `deemphasis()` | プリエンファシスの逆 |
| `librosa.effects.trim()` | `trimSilence()` / `trim_silence()` | WASM/Node は `{ audio, startSample, endSample }`、Python は `(audio, start_sample, end_sample)` を返す |
| `librosa.effects.split()` | `splitSilence()` / `split_silence()` | WASM/Node はフラットな `Int32Array`、Python は `list[tuple[int, int]]` を返す |

#### 特徴量（スペクトル／ピッチ／クロマ）

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.feature.melspectrogram()` | `MelSpectrogram::compute()` / `melSpectrogram()` | Slaney 正規化 |
| `librosa.feature.mfcc()` | `MelSpectrogram::mfcc()` / `mfcc()` | DCT-II。librosa と合わせる場合は `n_mfcc` を明示してください。末尾の `lifter`（ケプストラルリフタリング、既定 0 = リフタリングなし）は librosa の `lifter` に対応します |
| `librosa.feature.chroma_stft()` | `Chroma::compute()` / `chroma()` | STFT ベース。各フレームは 12 個のピッチクラス値の最大が 1.0 になるよう正規化され（L-infinity／最大値正規化）、librosa の既定 `norm=np.inf` と一致 |
| `librosa.feature.spectral_centroid()` | `spectralCentroid()` / `spectral_centroid()` | フレーム単位 |
| `librosa.feature.spectral_bandwidth()` | `spectralBandwidth()` / `spectral_bandwidth()` | フレーム単位 |
| `librosa.feature.spectral_rolloff()` | `spectralRolloff()` / `spectral_rolloff()` | `roll_percent` 対応 |
| `librosa.feature.spectral_flatness()` | `spectralFlatness()` / `spectral_flatness()` | フレーム単位 |
| `librosa.feature.spectral_contrast()` | `spectralContrast()` / `spectral_contrast()` | 行列形状は `(n_bands + 1) x n_frames` |
| `librosa.feature.poly_features()` | `polyFeatures()` / `poly_features()` | 行列形状は `(order + 1) x n_frames` |
| `librosa.feature.zero_crossing_rate()` | `zeroCrossingRate()` / `zero_crossing_rate()` | フレーム単位 |
| `librosa.zero_crossings()` | `zeroCrossings()` / `zero_crossings()` | ゼロ交差サンプル位置 |
| `librosa.feature.rms()` | `rmsEnergy()` / `rms_energy()` | フレーム単位 |
| `librosa.feature.tonnetz()` | `tonnetz()` | 入力: row-major クロマグラム |
| `librosa.cqt()` | `cqt()` | 定 Q 変換の振幅 |
| `librosa.vqt()` | `vqt()` | 可変 Q 変換。`gamma` で Q を制御 |
| `librosa.feature.chroma_cqt()` | `chromaCqt()` / `chroma_cqt()` | 定 Q クロマグラム。`librosa.feature.chroma_cqt` の直接の相当 |
| _（librosa に厳密な clone なし）_ | `nnlsChroma()` / `nnls_chroma()` | 追加の NNLS 音符活性化クロマ。librosa に厳密な相当なし |
| `librosa.feature.chroma_cens()` | `chromaCens()` / `chroma_cens()` | CENS（Chroma Energy Normalized Statistics）クロマ。平滑化・L1 正規化済み |
| _（librosa に厳密な相当なし）_ | `bassChroma()` / `bass_chroma()` | CQT ベースの低域クロマ。ベース音・転回形の推定向け |
| `librosa.hybrid_cqt()` | `hybridCqt()` / `hybrid_cqt()` | ハイブリッド CQT（低域ビンは CQT、高域ビンは pseudo-CQT） |
| `librosa.pseudo_cqt()` | `pseudoCqt()` / `pseudo_cqt()` | 近似的（低精度）CQT |
| `librosa.feature.tempogram()` | `tempogram()` | 自己相関（既定）または `mode='cosine'` の窓内コサイン類似度 |
| `librosa.feature.fourier_tempogram()` | `fourierTempogram()` / `fourier_tempogram()` | 複素フーリエテンポグラム |
| _（テンポオクターブ不変版）_ | `cyclicTempogram()` / `cyclic_tempogram()` | 巡回テンポグラム。librosa に厳密な相当なし |
| `librosa.feature.tempogram_ratio()` | `tempogramRatio()` / `tempogram_ratio()` | テンポグラム比特徴量 |
| `librosa.pcen()` | `pcen()` | `time_constant`／`gain`／`bias`／`power`／`eps` |
| `librosa.pyin()` | `pitchPyin()` / `pitch_pyin()` | 確率的 YIN。`fillNa` / `fill_na` で無声音 `f0` を `NaN` のままにするか `0` にするかを選択 |
| `librosa.yin()` | `pitchYin()` / `pitch_yin()` | YIN。`fillNa` / `fill_na` で無声音 `f0` を `NaN` のままにするか `0` にするかを選択 |
| `librosa.pitch_tuning()` | `pitchTuning()` / `pitch_tuning()` | 周波数列からチューニングずれを推定 |
| `librosa.estimate_tuning()` | `estimateTuning()` / `estimate_tuning()` | 音声からチューニングずれを推定 |

#### 分解とラウドネス

| librosa / 標準 | libsonare | 備考 |
|----------------|-----------|------|
| `librosa.decompose.decompose()` | `decompose()` | 行優先スペクトログラムから NMF 分解行列を返す |
| `librosa.decompose.decompose(init=...)` | `decomposeWithInit()` / `decompose_with_init()` | 初期化方式を選べる NMF。`init='random'`（既定）または `init='nndsvd'`（SVD によるウォームスタート） |
| `librosa.decompose.nn_filter()` | `nnFilter()` / `nn_filter()` | 近傍フィルタ |
| ITU-R BS.1770 / EBU R128 | `lufsInterleaved()` / `lufs_interleaved()` | インターリーブサンプルからマルチチャンネル Integrated loudness を測定 |
| EBU Tech 3342 LRA | `ebur128LoudnessRange()` / `ebur128_loudness_range()` | LU 単位の loudness range |

::: details ここでの NMF と NNLS とは？
NMF（非負値行列因子分解）は、スペクトログラムを少数の繰り返し現れるスペクトル「テンプレート」と、それぞれが時間方向にどれだけ強く働いているかへ分解します。重なった音を切り分けるのに役立ちます。NNLS（非負最小二乗）はこれに関連する当てはめで、`nnlsChroma` が各音符の活性度を推定するために使い、素のスペクトログラムより整理されたクロマを返します。
:::

#### 逆再構成

`librosa.feature.inverse.*` に対応します。位相は Griffin-Lim で推定するため往復は近似です。[逆変換特徴量](./inverse-features.md) を参照してください。

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.feature.inverse.mel_to_stft()` | `melToStft()` / `mel_to_stft()` | メルパワー → 線形 STFT パワー。`fmin`／`fmax`／`htk` でカスタムメル域・HTK も往復可 |
| _（mel_to_stft + `librosa.griffinlim`）_ | `melToAudio()` / `mel_to_audio()` | メルパワー → 音声（Griffin-Lim） |
| `librosa.feature.inverse.mfcc_to_mel()` | `mfccToMel()` / `mfcc_to_mel()` | MFCC → メルパワー |
| `librosa.feature.inverse.mfcc_to_audio()` | `mfccToAudio()` / `mfcc_to_audio()` | MFCC → 音声（Griffin-Lim） |

#### オンセット／ビート／テンポ

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.onset.onset_strength()` | `onsetEnvelope()` / `onset_envelope()` | スペクトルフラックス（C++ の自由関数は `compute_onset_strength()`） |
| `librosa.onset.onset_strength_multi()` | `onsetStrengthMulti()` / `onset_strength_multi()` | マルチバンドのオンセット強度（既定 `nBands=3`）。WASM/Node は `{ nBands, nFrames, data }` を返す |
| `librosa.onset.onset_detect()` | `detectOnsets()` / `detect_onsets()` | オンセット時刻 |
| `librosa.beat.beat_track()` | `BeatAnalyzer` / `detectBeats()` | DP ベース |
| `librosa.beat.tempo()` | `BpmAnalyzer` / `detectBpm()` | テンポグラム |
| `librosa.beat.plp()` | `plp()` | Predominant Local Pulse |
| `librosa.util.peak_pick()` | `peakPick()` / `peak_pick()` | ピーク位置のインデックス |

#### ユーティリティ

| librosa | libsonare | 備考 |
|---------|-----------|-------|
| `librosa.util.frame()` | `frameSignal()` / `frame_signal()` | row-major フレーム |
| `librosa.util.pad_center()` | `padCenter()` / `pad_center()` | 指定サイズで中央寄せパディング |
| `librosa.util.fix_length()` | `fixLength()` / `fix_length()` | 切り詰めまたはパディング |
| `librosa.util.fix_frames()` | `fixFrames()` / `fix_frames()` | フレーム範囲を制限 |
| `librosa.util.normalize()` | `vectorNormalize()` / `vector_normalize()` | `norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `librosa.frames_to_samples()` | `framesToSamples()` / `frames_to_samples()` | フレーム → サンプル |
| `librosa.samples_to_frames()` | `samplesToFrames()` / `samples_to_frames()` | サンプル → フレーム |
| `librosa.frames_to_time()` | `framesToTime()` / `frames_to_time()` | フレーム → 秒 |
| `librosa.time_to_frames()` | `timeToFrames()` / `time_to_frames()` | 秒 → フレーム |

### librosa にない高レベル解析

librosa は低レベル DSP の充実が強みで、上位の音楽解析は別ツールに任せる設計です。libsonare はそれらの上位タスクを 1 つのライブラリにまとめています。

| libsonare | 説明 |
|-----------|-------------|
| `KeyAnalyzer` | 音楽キー検出（Krumhansl-Schmuckler プロファイル） |
| `ChordAnalyzer` | コード認識（108 種のテンプレートマッチング） |
| `SectionAnalyzer` | 楽曲構造解析（イントロ／Aメロ／サビなど） |
| `TimbreAnalyzer` | 音色特性（ブライトネス、ウォームス、密度ほか） |
| `DynamicsAnalyzer` | ラウドネス・ダイナミックレンジ・クレストファクター |
| `RhythmAnalyzer` | 拍子、グルーブ、シンコペーション、規則性 |

::: info ストリーミング
さらに、`StreamAnalyzer` による「音声が届くにつれて更新される」リアルタイム BPM／キー／コード推定も libsonare 固有の機能です（librosa にはストリーミング API はありません）。
:::

## 関数マッピング

以下の libsonare のスニペットは `import libsonare as sonare`（Python）または
`@libraz/libsonare` からの名前付きインポート（ブラウザ）を前提とします。

### STFT

**librosa:**
```python
S = librosa.stft(
    y,
    n_fft=2048,
    hop_length=512,
    win_length=None,
    window='hann',
    center=True
)
```

**libsonare:**
::: code-group
```typescript [ブラウザ]
const result = stft(samples, sampleRate, 2048, 512);
```
```python [Python]
result = sonare.stft(samples, sample_rate, n_fft=2048, hop_length=512)
```
```cpp [C++]
sonare::StftConfig config;
config.n_fft = 2048;
config.hop_length = 512;
config.window = sonare::WindowType::Hann;
config.center = true;

auto spec = sonare::Spectrogram::compute(audio, config);
```
```bash [CLI]
# STFT 行列全体を出力する CLI はありません。CLI ではスペクトル要約を使います。
sonare spectral song.wav --n-fft 2048 --hop-length 512 --json
```
:::

### メルスペクトログラム

**librosa:**
```python
mel = librosa.feature.melspectrogram(
    y=y, sr=sr,
    n_fft=2048, hop_length=512,
    n_mels=128, fmin=0.0, fmax=None,
    htk=False, norm='slaney'
)
mel_db = librosa.power_to_db(mel, ref=np.max)
```

**libsonare:**
::: code-group
```typescript [ブラウザ]
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
// mel.power - パワースペクトラム
// mel.db - dB スケール
```
```python [Python]
mel = sonare.mel_spectrogram(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128)
# mel.power - パワースペクトラム
# mel.db - dB スケール
```
```bash [CLI]
sonare mel song.wav --n-fft 2048 --hop-length 512 --n-mels 128 --json
```
:::

<SonareDemo id="mel-spectrogram" />

### MFCC

**librosa:**
```python
mfcc = librosa.feature.mfcc(
    y=y, sr=sr, n_mfcc=13,
    n_fft=2048, hop_length=512, n_mels=128
)
```

**libsonare:**
::: code-group
```typescript [ブラウザ]
const result = mfcc(samples, sampleRate, 2048, 512, 128, 13);
// result.coefficients - [nMfcc x nFrames]
```
```python [Python]
result = sonare.mfcc(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128, n_mfcc=13)
# result.coefficients - [n_mfcc x n_frames]
```
```bash [C++ CLI]
# MFCC 係数をそのまま出力する CLI はありません。ソースビルド C++ CLI では MFCC からの音声プレビューを作れます。
sonare mfcc-to-audio song.wav --n-fft 2048 --hop-length 512 --n-mels 128 --n-mfcc 13 -o mfcc-preview.wav
```
:::

::: details DCT-II とは？なぜ MFCC で使う？
MFCC は *Mel-Frequency Cepstral Coefficients*（メル周波数ケプストラム係数）の略です。メルスペクトログラムを作り、その対数をとったあと、libsonare は周波数軸方向に **DCT-II**（タイプ II 離散コサイン変換）を適用します。DCT は実数だけを生み、エネルギーを先頭の数係数に集める FFT のようなもので、`n_mfcc` 個だけ残せばスペクトルの*形*（「ケプストラム」）をコンパクトに要約でき、細部は捨てられます。だから MFCC はフルスペクトルではなく、小さく ML 向けの音色記述子になります。
:::

### HPSS

**librosa:**
```python
y_harm, y_perc = librosa.effects.hpss(y, kernel_size=31)
```

**libsonare:**
::: code-group
```typescript [ブラウザ]
const result = hpss(samples, sampleRate, 31, 31);
// result.harmonic
// result.percussive
```
```python [Python]
result = sonare.hpss(samples, sample_rate, kernel_harmonic=31, kernel_percussive=31)
# result.harmonic
# result.percussive
```
```bash [CLI]
sonare hpss song.wav --json
```
:::

### ビート追跡

**librosa:**
```python
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120)
beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)
```

**libsonare:**
::: code-group
```typescript [ブラウザ]
const bpm = detectBpm(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);  // すでに秒単位
```
```python [Python]
bpm = sonare.detect_bpm(samples, sample_rate)
beats = sonare.detect_beats(samples, sample_rate)  # すでに秒単位
```
```bash [CLI]
sonare bpm song.wav --json
sonare beats song.wav --json
```
:::

## デフォルトパラメータ

| パラメータ | librosa | libsonare |
|-----------|---------|-----------|
| `sr` | 22050 | 単体の解析／特徴量／ラウドネスヘルパーはすべて既定 22050。`lufs`／`true-peak` にはバッファの実レートを渡してください。`Audio`／`Spectrogram` クラスのメソッドは読み込んだファイルのレートを使います。 |
| `n_fft` | 2048 | 2048 |
| `hop_length` | 512 | 512 |
| `win_length` | n_fft | n_fft |
| `window` | 'hann' | Hann |
| `center` | True | true |
| `n_mels` | 128 | 128 |
| `fmin` | 0.0 | Mel / 逆変換ヘルパーは 0.0。ピッチ検出は 65.0 Hz、CQT/VQT は C1（32.70319566 Hz） |
| `fmax` | sr/2 | sr/2 |
| `n_mfcc` | 20 | 全バインディングの単体 `mfcc()` / `Audio.mfcc()` は 20。analyzer／音色抽出の経路は 13 |
| `n_chroma` | 12 | 12 |

librosa の出力と比較する場合は、実行環境ごとのデフォルトに頼らず、パラメータを明示してください。

## Mel スケール式

### Slaney (librosa デフォルト、libsonare デフォルト)

```
f < 1000 Hz の場合:  mel = 3 * f / 200
f >= 1000 Hz の場合: mel = 15 + 27 * log10(f / 1000) / log10(6.4)
```

### HTK

```
mel = 2595 * log10(1 + f / 700)
```

libsonare は Slaney 変換ヘルパーを公開しており、C++ コアの Mel 設定では HTK 形式のフィルターバンク生成にも対応しています。
::: code-group
```typescript [ブラウザ]
const melSlaney = hzToMel(hz);     // Slaney（デフォルト）
```
```python [Python]
mel_slaney = sonare.hz_to_mel(hz)  # Slaney（デフォルト）
```
```bash [CLI]
# Hz/Mel 変換専用 CLI はありません。この変換は上の API から使います。
```
:::

## 参照用の許容誤差ガイドライン

これは libsonare の librosa 0.11 参照テストで使っている実用上の比較目安です。回帰テストや移行確認のための指標であり、任意の音源に対する精度保証ではありません。

| 機能 | 許容誤差 | 備考 |
|---------|-----------|-------|
| STFT 振幅 | 集計値は約0.1%。個別ビンはより大きくずれる場合あり | float32 / float64、窓処理、ゼロ近傍の差 |
| Mel フィルターバンク | 参照テストの合計値/最大値で約0.1% | フィルターバンク生成 |
| MFCC | 平均/標準偏差の参照チェックで約10-15% | DCT と log-Mel の細部 |
| クロマ | < 5% | ピッチマッピング |
| BPM | 数%程度。半分/倍テンポになる場合あり | テンポ候補の違い |
| ビート時刻 | 数十 ms からインパルス列テストで約80 ms 程度 | 位相アライメント |

## 既知の違い

### 1. リサンプリング

- **librosa 0.11**: 標準は `soxr_hq`。複数のリサンプラーを選択可能
- **libsonare**: `r8brain-free` を使用（24ビット品質）

リサンプリング後の特徴量には小さな差が出る場合があります。

### 2. CQT

- **librosa**: librosa 固有のパラメータ体系を持つ CQT / VQT API
- **libsonare**: libsonare 固有の API を持つ CQT / VQT 実装

### 3. 窓の正規化

- **librosa**: COLA 用に窓を正規化
- **libsonare**: 生の窓値を使用

逆 STFT 後には小さな振幅差が出る場合があります。出力の絶対レベルを librosa に合わせる必要があるワークフローでは、再構成後に音声を（たとえば元音源のピークや RMS に合わせて）スケーリングし直してください。

::: details COLA とは？
**COLA** は *Constant Overlap-Add*（定数オーバーラップ加算）の略です。STFT から音声を再構成するとき、重なり合う窓掛けフレームを足し合わせます。重なる窓がどのサンプル位置でも一定値に合算されるなら、再構成のゲインはどこでも均一になります — これが COLA 条件です。librosa はこれが厳密に成り立つよう窓を正規化しますが、libsonare は生の窓を使うため、合算後のレベルがわずかに異なることがあります。逆 STFT 後の絶対レベルに依存する場合だけ問題になります。
:::

## 移行ガイド

### Python から TypeScript へ

`librosa.load()` は標準でモノラル化し、22050 Hz にリサンプルします。ブラウザではまずファイルをデコードし、必要に応じてモノラルへダウンミックスし、同じ挙動に合わせたい場合は明示的にリサンプルしてください。

**変更前 (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3', sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"BPM: {tempo}")
```

**変更後 (TypeScript):**
```typescript
import { init, detectBpm, resample } from '@libraz/libsonare';

await init();

// AudioContext からオーディオを取得
// 必要に応じて、解析前にステレオをモノラルへダウンミックスします。
const samples = audioBuffer.getChannelData(0);

// オプションで 22050 にリサンプル
const resampled = resample(samples, audioBuffer.sampleRate, 22050);

const bpm = detectBpm(resampled, 22050);
console.log(`BPM: ${bpm}`);
```

### Python から C++ へ

`Audio::from_file()` はデコードしたファイルのサンプルレートを保持します。`librosa.load(..., sr=22050)` と合わせる場合は明示的にリサンプルしてください。

**変更前 (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3')
chroma = librosa.feature.chroma_stft(y=y, sr=sr)
```

**変更後 (C++):**
```cpp
#include <sonare.h>

auto audio = sonare::Audio::from_file("audio.mp3");
auto chroma = sonare::Chroma::compute(audio);
auto energy = chroma.mean_energy();
```

## パフォーマンス比較

要点だけ言うと、コアのスペクトル変換（STFT・メル・MFCC）は librosa とほぼ同等で、反復的なアルゴリズム（HPSS・pYIN）と総合解析パイプラインは大幅に高速です。機能別の数値、ハードウェア構成、計測手法、再現手順は 1 か所にまとめてあります（[ベンチマーク](/ja/docs/benchmarks) を参照）。このページに数値の複製を置かないのは、更新時のズレを防ぐためです。

WebAssembly は一般にネイティブ C++ より低速です。実際の性能は機能、ブラウザ、入力長、ビルド設定に依存します。計測結果は [ベンチマーク](/ja/docs/benchmarks) を参照してください。
