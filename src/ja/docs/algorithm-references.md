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

::: info 下の表で使うルーム音響用語
**RIR** は room impulse response の略です。**等価ルーム推定**は、音声から実用上の部屋モデルを推定する処理で、正確な実形状の復元ではありません。**ルームモーフィング**は音作り向けのルーム効果であり、残響除去ではありません。
:::

| 領域 | 根拠 | 根拠箇所 |
|------|------|----------|
| ラウドネスとトゥルーピーク | ITU-R BS.1770-4/5、EBU R128、EBU Tech 3342 loudness range | `README.md`、`src/rt/biquad_design.h`、`src/rt/true_peak_filter.h`、`src/metering/lufs.cpp`、`tests/rt/true_peak_filter_test.cpp` |
| K-weighting | 48 kHz の BS.1770 参照係数と、他サンプルレート向けの解析式設計 | `src/rt/biquad_design.h`、`src/rt/biquad_design.cpp` |
| トゥルーピーク補間 | BS.1770 の目標周波数応答に合わせた 2x/4x/8x/16x polyphase FIR。規格準拠の測定には 4x 以上を使う。2x は BS.1770 の最小要件である 4x を下回る、意図的に非準拠の高速近似。 | `src/rt/true_peak_filter.h`、`src/rt/true_peak_filter.cpp` |
| 古典的デノイズ | Ephraim-Malah MMSE-STSA (1984)、Ephraim-Malah LogMMSE (1985)、Berouti spectral subtraction with over-subtraction (1979)、MCRA、IMCRA | `src/mastering/repair/denoise_classical.h` |
| テープヒステリシス | Jiles-Atherton hysteresis、Chowdhury "Real-time Physical Modelling for Analog Tape Machines", DAFx-19 2019, equations 6-10 | `src/mastering/common/hysteresis_ja.cpp`、`src/mastering/saturation/tape.h` |
| EQ フィルター | RBJ biquads、Vicanek matched-Z IIR、Butterworth Q、Linkwitz-Riley crossovers with all-pass phase compensation | `README.md`、`src/rt/biquad_design.h`、`src/rt/biquad_design.cpp`、EQ routing / cut-filter sources |
| 非線形処理のアンチエイリアシング | ADAA / antiderivative anti-aliasing | `README.md`、`src/rt/adaa.h`、`src/rt/aliasing_control.h` |
| スライディング最大値 | Lemire sliding max | `README.md`、リミッター／トゥルーピーク補助処理の利用箇所 |
| Tonnetz | Harte et al. 2006 と `librosa.feature.tonnetz` の挙動 | `src/feature/tonnetz.h`、`src/feature/tonnetz.cpp`、`tests/librosa/tonnetz_test.cpp` |
| ピッチ追跡 | YIN と pYIN。pYIN は確率的な複数ピッチ候補と Viterbi decoding を使う | `src/feature/pitch.h`、`tests/librosa/pitch_test.cpp` |
| ルーム音響解析 | 減衰指標、ブラインド減衰フィット、RIR 合成、ルーム推定、ルームモーフィング | `src/analysis/acoustic_analyzer.*`、`src/acoustic/*`、`src/analysis/room_estimator.*`、`src/effects/acoustic/room_morph.*`、`tests/acoustic/*`、`tests/effects/room_morph_test.cpp` |
| シーケンスヘルパー | DTW、Viterbi、discriminative Viterbi、recurrence quantification analysis、`librosa.sequence` 互換 | `src/util/sequence.h`、`src/feature/segment.*`、librosa のシーケンス参照 |
| タイムストレッチとピッチシフト | Native spectral stretch、phase-vocoder fallback、time stretch followed by resampling による pitch shift | `src/effects/time_stretch.h`、`src/effects/pitch_shift.h` |
| リバーブ系 | Convolution、Dattorro plate、FDN、velvet-noise、幾何ベースのルームリバーブエンジン | `README.md`、`src/effects/reverb/*`、`src/effects/acoustic/*`、`tests/effects/*` |

::: info Tonnetz とは？
Tonnetz（「音のネットワーク」）は、和声を幾何空間へ写像する特徴量で、音楽的に関連の深いコードどうしが近くに配置されます。クロマから導出され、和声の変化やコード間の関係を測るのに役立ちます。
:::

::: details 名前付きアルゴリズムの平易な解説
このページはアルゴリズムを名前で引用しています。分かりにくいものを補足します。

- **Viterbi デコーディング** — 各フレーム単独の最良値ではなく、最も尤もらしい状態の*系列*（時間方向のピッチ候補など）を選びます。これにより pYIN は滑らかなノートラインを得ます。
- **DTW**（動的時間伸縮法） — 速度の異なる 2 つの系列を、時間を伸縮して対応づけます。演奏や特徴量系列の比較に使います。
- **MMSE-STSA／LogMMSE** — 周波数ビンごとに信号とノイズの割合を推定してから差し引く統計的なノイズ除去（平易版は [マスタリングプロセッサ](./mastering-processors.md) を参照）。**オーバーサブトラクション**は残りを消すために少し多めに引く手法で、信号も多少失います。
- **スペクトル減算／MCRA／IMCRA** — スペクトル減算はノイズスペクトルを推定し、各フレームから差し引きます。MCRA と IMCRA は、音声や音楽が鳴っている間もそのノイズフロアを時間方向に追従させるため、固定した推定値ではなく状況に合わせて減算が適応します。
- **Jiles-Atherton ヒステリシス** — 磁気テープが直近の信号を「記憶」する様子を表す物理モデルで、テープサチュレーション特有の非線形で履歴依存の質感を与えます。
- **ADAA**（反微分アンチエイリアシング） — 歪み曲線を数学的な積分に通すことで、非線形処理が生むエイリアシングを抑える手法です。
- **Schroeder エネルギー減衰曲線** — 部屋のインパルスレスポンスを時間方向に逆積分して滑らかな減衰曲線を得ます。RT60／EDT はこれを基に測定します。
- **RBJ バイカッド／Linkwitz-Riley クロスオーバー** — EQ フィルターの標準的な設計法と、正しい位相特性で音声を帯域分割する方式です。
:::

## 内蔵合成と GM/GS 互換

データ非依存の[内蔵シンセサイザー](./native-synth.md)は、公開されている合成・物理モデリングの文献をもとに構築しています。アコースティック系のエンジンは、これらのアルゴリズム系統を独自に実装したものであり、サンプリングや録音による音源ではありません。

| エンジン | アルゴリズム系統の根拠 | 根拠 |
|--------|------------------------|----------|
| FM | Chowning のフェーズモジュレーション FM（1973） | `src/midi/synth/fm_voice.*` |
| Karplus-Strong | Karplus-Strong 撥弦（1983）と Jaffe-Smith 拡張（1983）。二偏波・ブリッジ結合は Karjalainen-Välimäki-Tolonen（1998）、Bank-Karjalainen（2010）、Woodhouse（2004）に基づき、フレットスラップは Rank-Kubin（1997）に基づく | `src/midi/synth/ks_voice.*` |
| 撥弦（バズブリッジ） | Karplus-Strong 弦に、分布的な非線形のジャワリ／サワリ・ブリッジ接触（振幅制限のループ反射）を加え、シタール／箏／ハープのバズを再現 | `src/midi/synth/plucked_string_voice.*` |
| モーダル | モーダル共振合成（Adrien 1991）、バンド化導波路（Essl-Cook） | `src/midi/synth/modal_voice.*` |
| ピアノ | 剛性弦のオールパス連鎖による分散、非線形フェルトハンマー接触、連成ユニゾン弦、共有モーダル響板、Railsback ストレッチチューニング | `src/midi/synth/piano_voice.*` |
| 擦弦 | ディジタル導波路の擦弦（McIntyre-Schumacher-Woodhouse 1983、Smith）、弾塑性の弓摩擦（Dupont 2002、Avanzini-Serafin-Rocchesso 2003） | `src/midi/synth/bowed_string_voice.*` |
| リード | 単簧のディジタル導波路木管（Smith）、トーンホール散乱（STK BlowHole 系） | `src/midi/synth/reed_voice.*` |
| 金管 | リップリード金管導波路（Smith-Cook）、外向き打撃のリップバルブ（Fletcher 1979）、キュイヴレの波面急峻化（Hirschberg 1996）、2モードのリップ（Adachi-Sato 1996） | `src/midi/synth/brass_voice.*` |
| フルート／パイプオルガン | エアジェット／フルー管の導波路と集中定数のジェット駆動（Fabre-Hirschberg）、エッジヒステリシス（Auvray-Ernoult-Fabre-Lagrée 2014） | `src/midi/synth/flute_voice.*`, `src/midi/synth/pipe_organ_voice.*` |
| ボイス（ソースフィルター） | ソースフィルター方式のボイス。スペクトル傾斜を与えた声門ノコギリ波と気息成分を、RBJ の定ピーク帯域通過フォルマントの並列バンクに通す。低音域の母音フォルマントデータは Csound FOF コーパスに基づく | `src/midi/synth/vocal_voice.*` |
| フリーリード | 駆動されるフリーリードの舌振動子（位相アキュムレーター、非対称サチュレーター、リードプレート胴のローパス）とミュゼットデチューンの舌ペア。フリーリードの音響は Cottingham に基づく | `src/midi/synth/free_reed_voice.*` |
| パーカッション | 円形膜（Rayleigh）モードと打点の Bessel 重み付け、PhISEM 確率的粒子モデル（Cook） | `src/midi/synth/percussion_voice.*` |

### General MIDI と GS の互換

libsonare は、公開されている General MIDI・General MIDI 2 の楽器／打楽器マップ（MIDI Association）と、Roland が定義した GS 拡張（追加バンク・NRPN・ドラムキットの変種・挿入エフェクト（EFX））に、アドレスのレベルで準拠します。その際に用いるのは、公開されている MIDI／SysEx の実装仕様とエフェクトのタイプ番号体系です。この互換ターゲットにより、GM/GS 準拠で作られた MIDI が、作者の意図したバンク・キット・エフェクトを選べます。

これらのアドレスに割り当てられる音自体は、公開資料と上記の文献をもとに再構成した libsonare 独自のプロシージャル合成および DSP です。libsonare は、いかなるハードウェアモジュールのサンプル・ROM データ・ファームウェアも同梱しておらず、各エフェクトは独自のアルゴリズムです。したがってこれは**独立した再構成**であり、GS のアドレス指定とエフェクト構成には従いますが、特定機器の音そのものを再現するものでは**ありません**。以下の librosa フィクスチャと同様、これは互換ターゲットであって実装コードの複製ではなく、出力が同一であるという主張でもありません。

## librosa 参照互換性

`tests/librosa/reference/` 以下の参照値は librosa 0.11.0 で生成されています。

`tests/librosa/reference/NOTICE.md` には、`tests/librosa/generate_librosa_reference.py` により生成した参照データだと記録されています。目的は、libsonare と librosa の数値互換性を検証することです。

これは互換性の参照であり、実装コードをコピーしているという意味ではありません。

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

室内音響には、性質の違う 5 つの入口があります。

| 入口 | 入力 | 何をしているか | 結果の扱い |
|------|------|----------------|------------|
| `analyze_impulse_response` / `analyzeImpulseResponse` | 拍手、風船破裂音、スターターピストル音、スイープ由来 IR など、部屋の反応だけが分かりやすい短い励振音の録音 | 音が鳴った後の減衰曲線を直接測る | 測定値として扱いやすい |
| `detect_acoustic` / `detectAcoustic` | 通常の音楽、会話、環境録音など | 録音の中から「部屋の残響だけが自然に減っている区間」を探して推定する | 目安として扱い、`confidence` を必ず見る |
| `estimate_room` / `estimateRoom` | 録音またはインパルスレスポンス | 体積、寸法、直接音対残響音比（DRR）、吸音率バンド、RT60 バンド、信頼度を含む等価ルームを推定する | 正確な実寸ではなくモデルフィットとして扱う |
| `synthesize_rir` / `synthesizeRir` | シューボックス寸法と音源／聴取位置 | モノラル RIR を合成する | 不正な形状は `hasError` / `has_error` を確認する |
| `room_morph` / `roomMorph` | 録音と目標ルーム形状 | 元の残響尾部を少し抑えて目標ルームの響きを足す | 残響除去ではなく音作り効果として扱う |

ここでいう **decay curve**（減衰曲線） は、音が止まった後にエネルギーがどれくらいの速さで小さくなるかを表す曲線です。インパルスレスポンス解析では、この曲線を直接作って RT60 や EDT を読みます。

一方、ブラインド推定では、入力が通常音声なので「今見えている減衰が本当に部屋の残響なのか」を常に判断する必要があります。楽器の余韻、声の伸ばし、コンプレッサー、背景ノイズなども減衰に見えることがあるためです。

`synthesize_rir` / `synthesizeRir` は、鏡像音源法による初期反射と、同じ設定なら同じ結果になる後期テールを使います。これは生成 RIR を比較するときには重要ですが、利用者向けには「寸法から再現性のある部屋応答を作る」と理解すれば十分です。

そのため `detect_acoustic` / `detectAcoustic` と `estimate_room` / `estimateRoom` は `confidence` を返します。明確な自由減衰区間が見つからない場合は、結果が利用不可になったり、低信頼度になったりします。

低い `confidence` の値は「部屋がそう響く」と断定せず、「この録音からは十分に読み取れない」と解釈してください。
