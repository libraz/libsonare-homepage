# アルゴリズム根拠

このページは、現行 libsonare のソース、テスト、README から確認できるアルゴリズム、論文、標準規格、互換性参照をまとめます。一般的な DSP 文献一覧ではなく、プロジェクト内で確認できる根拠の地図です。

## このページで身につくこと

このページを読むと、次のことを判断・確認できるようになります。

- ソースで確認済みの根拠、参照値で検証した互換性、アルゴリズムファミリー名のみの記載を区別できる。
- ラウドネス、トゥルーピーク、デノイズ、EQ、ピッチ、室内音響、シーケンスヘルパー、リバーブ系の標準・論文・根拠を探せる。
- このページを「すべての高レベル推定が別ライブラリと同一」という保証として読まないようにできる。
- テスト範囲を確認したいときに [実装検証](./implementation-validation.md) と組み合わせて読める。

## 根拠の段階

| 段階 | 意味 |
|------|------|
| ソースで確認済み | 現行ソース、ヘッダーコメント、テスト、README が標準規格、アルゴリズム、著者、論文を明示している |
| 参照値で検証 | 主に librosa 0.11.0 の生成済み参照値に対して数値互換性を確認している |
| アルゴリズム名のみ確認 | 現行ソースがアルゴリズムファミリー名を示しているが、完全な論文引用までは埋め込まれていない |

## ソースで確認できる根拠

| 領域 | 根拠 | 根拠箇所 |
|------|------|----------|
| ラウドネスとトゥルーピーク | ITU-R BS.1770-4/5、EBU R128、EBU Tech 3342 loudness range | `README.md`、`src/rt/biquad_design.h`、`src/rt/true_peak_filter.h`、`src/metering/lufs.cpp`、`tests/rt/true_peak_filter_test.cpp` |
| K-weighting | 48 kHz の BS.1770 参照係数と、他サンプルレート向けの解析式設計 | `src/rt/biquad_design.h`、`src/rt/biquad_design.cpp` |
| トゥルーピーク補間 | BS.1770 の目標周波数応答に合わせた 2x/4x/8x polyphase FIR | `src/rt/true_peak_filter.h`、`src/rt/true_peak_filter.cpp` |
| 古典的デノイズ | Ephraim-Malah MMSE-STSA (1984)、Ephraim-Malah LogMMSE (1985)、Berouti spectral subtraction with over-subtraction (1979)、MCRA、IMCRA | `src/mastering/repair/denoise_classical.h` |
| テープヒステリシス | Jiles-Atherton hysteresis、Chowdhury "Real-time Physical Modelling for Analog Tape Machines", DAFx-19 2019, equations 6-10 | `src/mastering/common/hysteresis_ja.cpp`、`src/mastering/saturation/tape.h` |
| EQ フィルター | RBJ biquads、Vicanek matched-Z IIR、Butterworth Q、Linkwitz-Riley crossovers with all-pass phase compensation | `README.md`、`src/rt/biquad_design.h`、`src/rt/biquad_design.cpp`、EQ routing / cut-filter sources |
| 非線形処理のアンチエイリアシング | ADAA / antiderivative anti-aliasing | `README.md`、`src/rt/adaa.h`、`src/rt/aliasing_control.h` |
| スライディング最大値 | Lemire sliding max | `README.md`、リミッター／トゥルーピーク補助処理の利用箇所 |
| Tonnetz | Harte et al. 2006 と `librosa.feature.tonnetz` の挙動 | `src/feature/tonnetz.h`、`src/feature/tonnetz.cpp`、`tests/librosa/tonnetz_test.cpp` |
| ピッチ追跡 | YIN と pYIN。pYIN は確率的な複数ピッチ候補と Viterbi decoding を使う | `src/feature/pitch.h`、`tests/librosa/pitch_test.cpp` |
| 室内音響解析 | インパルスレスポンス向けの Schroeder 型 energy decay curve、RT60、EDT、C50、C80、D50、自由減衰区間検出と指数減衰フィットによるブラインド RT60 推定 | `src/analysis/acoustic_analyzer.h`、`src/analysis/acoustic_analyzer.cpp`、`tests/analysis/acoustic_analyzer_test.cpp`、`tests/analysis/acoustic_dataset_test.cpp` |
| シーケンスヘルパー | DTW、Viterbi、discriminative Viterbi、recurrence quantification analysis、`librosa.sequence` 互換 | `src/util/sequence.h`、`src/feature/segment.*`、librosa のシーケンス参照 |
| タイムストレッチとピッチシフト | Native spectral stretch、phase-vocoder fallback、time stretch followed by resampling による pitch shift | `src/effects/time_stretch.h`、`src/effects/pitch_shift.h` |
| リバーブ系 | Convolution、Dattorro plate、FDN、velvet-noise reverb engines | `README.md`、`src/effects/reverb/*`、`tests/effects/creative_fx_test.cpp` |

::: details 名前付きアルゴリズムの平易な解説
このページはアルゴリズムを名前で引用しています。分かりにくいものを補足します。

- **Viterbi デコーディング** — 各フレーム単独の最良値ではなく、最も尤もらしい状態の*系列*（時間方向のピッチ候補など）を選びます。これにより pYIN は滑らかなノートラインを得ます。
- **DTW（動的時間伸縮法）** — 速度の異なる 2 つの系列を、時間を伸縮して対応づけます。演奏や特徴量系列の比較に使います。
- **MMSE-STSA／LogMMSE** — 周波数ビンごとに信号とノイズの割合を推定してから差し引く統計的なノイズ除去（平易版は [マスタリングプロセッサ](./mastering-processors.md) を参照）。**オーバーサブトラクション**は残りを消すために少し多めに引く手法で、信号も多少失います。
- **Jiles-Atherton ヒステリシス** — 磁気テープが直近の信号を「記憶」する様子を表す物理モデルで、テープサチュレーション特有の非線形で履歴依存の質感を与えます。
- **ADAA（反微分アンチエイリアシング）** — 歪み曲線を数学的な積分に通すことで、非線形処理が生むエイリアシングを抑える手法です。
- **Schroeder エネルギー減衰曲線** — 部屋のインパルスレスポンスを時間方向に逆積分して滑らかな減衰曲線を得ます。RT60／EDT はこれを基に測定します。
- **RBJ バイカッド／Linkwitz-Riley クロスオーバー** — EQ フィルターの標準的な設計法と、正しい位相特性で音声を帯域分割する方式です。
:::

## librosa 参照互換性

`tests/librosa/reference/` 以下の参照値は librosa 0.11.0 で生成されています。`tests/librosa/reference/NOTICE.md` には、`tests/librosa/generate_librosa_reference.py` により生成し、libsonare と librosa の数値互換性を検証するための参照データだと記録されています。これは互換性の参照であり、実装コードをコピーしているという意味ではありません。

| 機能ファミリー | 参照範囲 |
|----------------|----------|
| スペクトル特徴量 | STFT、reassigned spectrogram、mel filterbank、mel spectrogram、MFCC、chroma、CQT/iCQT、VQT/wavelet filters、spectral centroid/bandwidth/rolloff/flatness/contrast、zero crossing、RMS |
| リズムとオンセット | onset strength、beat、tempo、tempogram、Fourier tempogram、PLP |
| ピッチと調性特徴 | YIN、pYIN、piptrack 系ヘルパー、pitch utilities、tonnetz |
| 分解と変換 | HPSS、harmonic/percussive、decompose、remix、inverse mel/MFCC helpers、Griffin-Lim 関連の synthesis tests |
| sequence と構造 | segment helpers、cross-similarity、recurrence matrix、DTW/Viterbi 系 sequence helpers |
| ユーティリティ | frame/sample/time conversion、dB conversion、pre/de-emphasis、padding、fix length/frames、peak pick、vector normalize、trim/split silence、weighting |
| NNLS | NNLS tests は SciPy/librosa 参照データと比較し、NNLS chroma の挙動を支える |

## スコープの境界

ソース上のリペア処理は、古典的 DSP として位置づけられています。

つまり、DNN restoration、source separation、interactive spectral repair ではありません。

| リペア経路 | 読み方 |
|------------|--------|
| `repair.denoiseClassical`, `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.dereverbClassical`, `repair.trimSilence` | 現在の実装では、古典的または決定的な DSP 経路です。 |

室内音響には、性質の違う 2 つの入口があります。

| 入口 | 入力 | 何をしているか | 結果の扱い |
|------|------|----------------|------------|
| `analyze_impulse_response` / `analyzeImpulseResponse` | 拍手録音、風船の破裂音、スイープ由来 IR など、部屋の反応だけが分かりやすい録音 | 音が鳴った後の減衰曲線を直接測る | 測定値として扱いやすい |
| `detect_acoustic` / `detectAcoustic` | 通常の音楽、会話、環境録音など | 録音の中から「部屋の残響だけが自然に減っている区間」を探して推定する | 目安として扱い、`confidence` を必ず見る |

ここでいう **decay curve（減衰曲線）** は、音が止まった後にエネルギーがどれくらいの速さで小さくなるかを表す曲線です。インパルスレスポンス解析では、この曲線を直接作って RT60 や EDT を読みます。

一方、ブラインド推定では、入力が通常音声なので「今見えている減衰が本当に部屋の残響なのか」を常に判断する必要があります。楽器の余韻、声の伸ばし、コンプレッサー、背景ノイズなども減衰に見えることがあるためです。

そのため `detect_acoustic` / `detectAcoustic` は `confidence` を返します。明確な自由減衰区間が見つからない場合は、結果が利用不可になったり、低信頼度になったりします。低い `confidence` の値は「部屋がそう響く」と断定せず、「この録音からは十分に読み取れない」と解釈してください。
