---
title: マスタリングプロセッサ
description: libsonare の名前付きマスタリング API、プリセット、ソロプロセッサ、ペア／ステレオ解析を、目的別プロセッサ早見表とともに、実行時レジストリと同期して掲載します。
---

# マスタリングプロセッサ

このページは libsonare の名前付きマスタリング API の**レジストリ**です。「*何を呼べるか*」に答え、「*内部でどう動くか*」には答えません。

実行時の根拠は `masteringProcessorNames()`、`masteringPairProcessorNames()`、`masteringPairAnalysisNames()`、`masteringStereoAnalysisNames()`、`masteringPresetNames()` です。このページはそれらを反映します。

::: tip マスタリングが初めてなら、ここから始めない
プロセッサを 1 つずつ呼ぶのは難しい道です。まずは**プリセット**（`masterAudio`）か、音声をプロファイルしてチェーン全体を提案する **[マスタリングアシスタント](./mastering-assistant.md)** から始めてください。ソロプロセッサは、ある段を外科的に制御したいときだけ使います。
:::

*挙動*・処理境界・DSP ファミリーごとのリアルタイム注意点は [DSP 実装解説](./dsp-implementation.md) を、規格と論文の引用は [アルゴリズム根拠](./algorithm-references.md) を、テストカバレッジは [実装検証](./implementation-validation.md) を参照してください。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- プリセット、ソロプロセッサ、ペアプロセッサ、JSON を返す解析を区別できる。
- ID をアルファベット順に眺めるのではなく、「ダイナミクスを制御する」「リファレンスに合わせる」といった目的から入口を選べる。
- 直接プロセッサを呼ぶより、プリセットやアシスタントの流れが適している場面を判断できる。
- JavaScript、Python、Node ネイティブ、C ABI に渡す正確なレジストリ名を見つけられる。

## 名前の種類

| 種類 | 意味 | 例 |
|------|------|----|
| プリセット | スタイルや配信ターゲット向けの名前付きチェーン設定 | `streaming`、`podcast`、`jpop` |
| ソロプロセッサ | モノラル／ステレオ信号に適用する 1 プロセッサ | `dynamics.compressor`、`eq.tilt` |
| ペアプロセッサ | ソース**と**リファレンス信号を使うプロセッサ | `match.applyMatchEq` |
| 解析 | 音声ではなく **JSON** を返す測定 | `match.referenceLoudness`、`stereo.monoCompatCheck` |

::: info サイドチェイン／ラウドネス系プロセッサ
ダイナミクス系には、`dynamics.duckingProcessor`（サイドチェインダッキング）、`maximizer.loudnessOptimize`（[LUFS](./glossary/lufs.md) ターゲットへのマキシマイズ。LUFS は Loudness Units relative to Full Scale の略で、放送規格のラウドネス尺度です）、`dynamics.deesser` の bandpass `Q` コントロール（ステレオ保持つき）があります。

これらは `dynamics.transientShaper`、`dynamics.upwardCompressor`、`dynamics.upwardExpander`、`dynamics.vocalRider`、`dynamics.sidechainRouter` と並ぶ名前付きプロセッサです。
:::

## プリセット

プリセットは別アルゴリズムではなく、名前付きのチェーン設定です。`masterAudio(samples, sr, preset, overrides?)` の `overrides?`（上書き値）で必要な項目だけ調整できます。

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`

プリセットを完成マスターと見なさずに選ぶ方法は [プリセットの選び方](./glossary/mastering/preset-selection.md) を参照してください。

## 目的別プロセッサ早見表

以下のレジストリへの目的起点のインデックスです。規則ではなく出発点なので、決める前にリンク先のガイドを読んでください。

| やりたいこと | 使うもの | 概念を学ぶ |
|--------------|----------|-----------|
| レベルをそろえる／ダイナミクス制御 | `dynamics.compressor`、`dynamics.limiter`、`multiband.compressor` | [ダイナミクス](./glossary/mastering/dynamics.md) |
| 潰さずパンチを出す | `dynamics.transientShaper`、`dynamics.parallelComp` | [ダイナミクス](./glossary/mastering/dynamics.md) |
| 耳障りな歯擦音（サ行）を抑える | `dynamics.deesser` | [ダイナミクス](./glossary/mastering/dynamics.md) |
| 音楽ベッドを声の下に下げる | `dynamics.duckingProcessor`、`dynamics.sidechainRouter` | [ミキシングエンジン](./mixing.md) |
| 全体のトーン／明るさを整える | `eq.tilt`、`eq.parametric`、`spectral.airBand` | [トーンと Air](./glossary/mastering/tone-air.md) |
| 温かみ／倍音を加える | `saturation.tape`、`saturation.tube`、`saturation.exciter` | [トーンと Air](./glossary/mastering/tone-air.md) |
| ステレオを広げる／狭める／確認 | `stereo.imager`、`stereo.monoMaker`、`stereo.monoCompatCheck` | [ステレオとラウドネス](./glossary/mastering/stereo-limiter-loudness.md) |
| ラウドネスに安全に到達 | `loudness` 段、`maximizer.loudnessOptimize`、`maximizer.truePeakLimiter` | [配信ターゲット](./glossary/mastering/delivery-targets.md) |
| ノイズ／クリック／クリップ除去 | `repair.denoiseClassical`、`repair.declick`、`repair.declip` | [リペアと入力](./glossary/mastering/repair.md) |
| リファレンスに合わせる | `match.applyMatchEq`、`match.referenceLoudness` | [リファレンスマッチ](./glossary/mastering/reference-match.md) |

::: details サイドチェイン／ダッキングとは？
サイドチェインは、ある信号で別の信号にかけたプロセッサを制御する仕組みです。最もよくある用途が**ダッキング**で、声があるときは音楽ベッドが自動で下がり、隙間で戻ります。ナレーションの下で BGM が下がるあの動きです。
:::

::: details パラレルコンプレッションとは？
通常のコンプレッサーは大きい部分を下げます。

**パラレルコンプレッション**は、*原音*と*強くかけたコピー*を混ぜます。圧縮したコピーが小さなディテールを持ち上げ、手つかずの原音が自然なピークを保ちます。

トランジェントを潰さずに密度と「まとまり」を足したいときに使います。ニューヨークコンプとも呼ばれます。`dynamics.transientShaper` は逆向きの道具で、各打撃のアタックを強調・緩和します。
:::

しきい値とレシオを動かすと、伝達カーブが曲がる様子と `dynamics.compressor` が実信号に効く音を確認できます。

<SonareDemo id="compressor-curve" />

## プロセッサファミリーを役割で読む

コードでは正確な ID が重要ですが、選ぶときはまず*役割*で見ます。

| ファミリー | 使う場面 | 避ける場面 |
|------------|----------|------------|
| Dynamics | 音量の包絡が問題のとき。ピークが飛び出す、ボーカルが不均一、トランジェントを整えたい、声の下にベッドを下げたい | 問題が音色バランスなら EQ や spectral 系の方が明確です |
| EQ | 暗い、刺さる、膨らむ、特定帯域を切りたいなど、周波数バランスが問題のとき | ラウドネスを稼ぎたい場合。dynamics / maximizer を使います |
| Multiband | 帯域ごとに異なるダイナミクスや幅処理が必要なとき | 単一帯域の処理で十分なとき。multiband は過剰調整になりやすいです |
| Saturation | 倍音密度、エッジ、温かみ、クリップ感を加えたいとき | クリーンな補正が必要なとき。saturation は意図的に色を付けます |
| Spectral | Air、プレゼンス、低域のフォーカスなど、知覚上のトーンを広く整えたいとき | 正確なフィルター操作が必要なとき。EQ を使います |
| Stereo | 幅、モノラル互換性、位相、左右バランスが問題のとき | すでに位相に敏感なミックスや、モノラル配信が主目的のとき |
| Maximizer / final | 配信直前。ラウドネス、シーリング、ビット深度、最終出力の調整 | まだバランスやアレンジの問題を直している段階 |
| Repair | 入力にクリック、クラックル、ハム、クリップ、ノイズ、過剰な残響があるとき | 音源分離やニューラル修復を期待しているとき |

多くのチェーンは、必要ならリペア、トーン段を 1 つ、ダイナミクス段を 1 つ、必要に応じてサチュレーション / ステレオ、最後にマキシマイザー / ラウドネスで十分です。レジストリから大量に積むより、プリセットから始めて 1〜2 箇所だけ上書きする方が安定します。

::: info ラウドネス・オーバーサンプリング・メーターの詳細
マキシマイザー／final と解析の API の下には、いくつかの機能があります。

- インテグレーテッド LUFS 測定は最大 8 チャンネルのサラウンド構成に対応し、[BS.1770](./algorithm-references.md) のチャンネル重み付けを適用します。BS.1770-4 自体が規格として定めているのは 5.1（6 チャンネル）までで、7.1／8 チャンネルの重み付け（サイドサラウンドのペアをリアサラウンドと同様に +1.5 dB として扱う）は規格に含まれない非公式の拡張です。
- 内部のオーバーサンプラーと True Peak 段はオーバーサンプリング係数として 1〜16 の 2 のべき乗（1, 2, 4, 8, 16）を受け付けます（ライブメーターも同じ係数）。CPU と引き換えにサンプル間ピーク（ISP）の精度を上げます。
- UI 向けには `meteringVectorscope(...)` と `meteringPhaseScope(...)` に `maxPoints` を渡します。点列を最大 `maxPoints` 点まで間引くので、点数の多いスコープでも描画コストを抑えられます（`maxPoints` を省くと入力サンプル 1 個につき 1 点を返します。旧来の `meteringVectorscopeDecimated(...)` ／ `meteringPhaseScopeDecimated(...)` は非推奨で、内部で委譲するだけです）。`meteringSpectrumFrame(...)` は、スペクトラムアナライザーのスナップショット向けに単一フレーム（時間平均なし）のスペクトラムを読み取ります。
- `multiband.*` のソロプロセッサ（`compressor`、`dynamicEq`、`expander`、`imager`、`limiter`、`saturation` の全 6 種）は、いずれも同じクロスオーバー機構を共有し、クロスオーバー数を任意に指定できます。固定 3 バンドではなく、素材に合わせたバンド数で分割できます。この入口が公開する `cutoffNHz` スロットは最大 8 個（`cutoff0Hz` 〜 `cutoff7Hz`）なので、`multiband.*` の呼び出し 1 回で最大 9 バンドまで扱えます。
:::

::: info クロスオーバーとは？
クロスオーバーは、信号を周波数帯（たとえば低域／中域／高域）に分割し、各帯域を別々に処理できるようにします。「クロスオーバー周波数」は、ある帯域が終わり次の帯域が始まる境界の周波数です。クロスオーバーが多いほど帯域が増え、より細かく制御できます。
:::

## ソロプロセッサ

| ファミリー | プロセッサ名 |
|-----------|-------------|
| Dynamics | `dynamics.brickwallLimiter`, `dynamics.compressor`, `dynamics.deesser`, `dynamics.expander`, `dynamics.gate`, `dynamics.limiter`, `dynamics.parallelComp`, `dynamics.sidechainRouter`, `dynamics.duckingProcessor`, `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider` |
| EQ | `eq.apiStyle`, `eq.bandPass`, `eq.cutFilter`, `eq.dynamic`, `eq.equalizer`, `eq.graphic`, `eq.linearPhase`, `eq.midSide`, `eq.minimumPhase`, `eq.parametric`, `eq.pultec`, `eq.shelving`, `eq.tilt` |
| Final | `final.bitDepth`, `final.dither`, `final.outputChain` |
| Maximizer | `maximizer.adaptiveRelease`, `maximizer.loudnessOptimize`, `maximizer.maximizer`, `maximizer.softKneeMax`, `maximizer.truePeakLimiter` |
| Multiband | `multiband.compressor`, `multiband.dynamicEq`, `multiband.expander`, `multiband.imager`, `multiband.limiter`, `multiband.saturation` |
| Repair | `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`, `repair.trimSilence` |
| Saturation | `saturation.ampSim`, `saturation.bitcrusher`, `saturation.exciter`, `saturation.hardClipper`, `saturation.multibandExciter`, `saturation.softClipper`, `saturation.tape`, `saturation.transformer`, `saturation.tube`, `saturation.waveshaper` |
| Spectral | `spectral.airBand`, `spectral.lowEndFocus`, `spectral.presenceEnhancer`, `spectral.spectralShaper` |
| Stereo | `stereo.autoPan`, `stereo.haasEnhancer`, `stereo.imager`, `stereo.monoMaker`, `stereo.phaseAlign`, `stereo.stereoBalance` |

::: warning ステレオ系プロセッサは入口が異なります
ほとんどのプロセッサは単一配列を取る `masteringProcess()`（モノラル、またはインターリーブ）で処理します。一方、ステレオ系プロセッサ（`stereo.imager`、`stereo.monoMaker`、`stereo.autoPan`、`stereo.haasEnhancer`、`stereo.phaseAlign`、`stereo.stereoBalance`）は左右チャンネルを別々に扱うため、`left` と `right` の 2 配列を取る専用の入口 `masteringProcessStereo()` / `mastering_process_stereo()` から呼び出します。`stereo.monoMaker` は `frequencyHz` をクロスオーバー周波数として使い、それより低い帯域をモノラルへ寄せます。寄せる強さは `amount` で決めます。`eq.midSide` と `multiband.*` も同様です。これらを `masteringProcess()` に渡してもチャンネルを独立して表現できません。正確なシグネチャは [呼び出し方](#呼び出し方) を参照してください。
:::

::: details ディザーとは？
ビット深度を下げる（たとえば CD／配信向けに 24bit から 16bit へ）と、丸め処理が静かな余韻にかすかな歪みを生みます。ディザーは、注意深く整形した微小なノイズを加えてその歪みを覆い隠し、フェードがざらつかず滑らかに聞こえるようにします。最終のビット深度削減のときに、最後に 1 回だけ適用します。
:::

::: warning リペアは設計上クラシカル DSP
`repair.denoiseClassical`・`repair.dereverbClassical` などは、明示的なノイズ推定を伴うスペクトル減算／MMSE-STSA／LogMMSE を使います。

DNN 音源分離やニューラルなスペクトル修復**ではありません**。

- 向く用途: ノイズ、ハム、クリック、クリッピング、軽い部屋鳴りの整理。
- 向かない用途: 完成トラックの分離、失われた音源の再構成。
- 設計上の理由: リペア経路を決定的で外部依存なしに保つためです。
:::

<SonareDemo id="repair-denoise" />

::: tip レジストリ名とチェーンキーは異なります
名前付きプロセッサレジストリでは、単発のリペアプロセッサ名は `repair.denoiseClassical` と `repair.dereverbClassical` です。

フルチェーン設定では、短いステージキーの `repair.denoise.*` と `repair.dereverb.*` を使います。これらは `MasteringChainConfig` 内のリペアスロットを指します。

どちらの名前も、同じクラシカルなデノイズ／ディリバーブ実装を呼び出します。
:::

::: details スペクトル減算（MMSE-STSA／LogMMSE）とは？
いずれもクラシカルなノイズ除去手法です。

1. 静かな箇所から**ノイズプロファイル**（定常的なヒスやハム）を推定します。
2. **スペクトル減算**は、各短時間スペクトルフレームからその推定ノイズを差し引きます。
3. **MMSE-STSA** と **LogMMSE** は、周波数ビンごとに信号とノイズの割合を推定してから差し引く統計的手法です。

これにより、素朴な減算で残る「ミュージカルノイズ」のようなざらつきを抑えます。楽器を分離するものではなく、ノイズを減衰させるだけです。
:::

::: details `saturation.ampSim` とは？
ギター／ベースアンプ系の色付け段で、プリアンプドライブ → トーンスタック → パワーアンプ → キャビネットの構成です。オーバーサンプリングした 12AX7 三極管のドライブ段が 1 つの `[0, 1]` ドライブノブの背後にあり、ドライブ量に応じてプリエンファシスのシェルフが変化するため、押し込むほど歪みの質感が変わります。ドライブの後にはバス／ミッド／トレブルのトーンスタックが続き、その後に任意のパワーアンプ段とデータ不要のキャビネット特性が入ります。構築／パラメータキーのうち、`drive`（0-1）、`bassDb`、`midDb`、`trebleDb`、`presenceDb`、`levelDb`、`power`、`sag`、`transformer`、`nfb` は、全バインディングで `set_parameter` から自動化できます。`power` は class-AB プッシュプルのソフトサチュレーション、`sag` は強い入力後の電源電圧低下と膨らみ、`transformer` は低域の出力トランス飽和、`nfb` は有効なパワーアンプ段を囲むネガティブフィードバックを加えます。`cab`（ブール値）、`cabModel`（`0` = ギター 4x12、`1` = ベース 8x10）、`ampModel`（`0` = classic crunch、`1` = Fender 系 clean、`2` = modern high-gain、`3` = tweed、`4` = Vox 系 chime、`5` = rectifier）は離散的なトポロジー選択なので、オートメーションではなく構築時に指定します。
:::

## ペアプロセッサと解析

ペアプロセッサはソース**と**リファレンスを取ります。ペア／ステレオ*解析*は測定 JSON を返し、それ自体では音声をレンダリングしません。

| 種類 | 名前 |
|------|------|
| ペアプロセッサ | `match.applyMatchEq`, `match.alignReferenceToSource`, `match.abSwitch`, `match.abCrossfade` |
| ペア解析 | `match.referenceLoudness`, `match.tonalBalance`, `match.tonalBalanceLogBands`, `match.matchEqCurve`, `match.estimateReferenceDelaySamples` |
| ステレオ解析 | `stereo.monoCompatCheck`, `stereo.monoCompatCheckLogBands` |

これらは `masteringPairAnalyze(...)` / `masteringStereoAnalyze(...)` に渡すレジストリ名です。レジストリとは別に、アシスタント系ヘルパーにも左右のペアを直接受け取るステレオ版があります — `masteringAudioProfileStereo`、`masteringAssistantSuggestStereo`、`masteringStreamingPreviewStereo` の 3 つです。ダウンミックスをプロファイルすると無相関素材では積分ラウドネスを約 6 dB 過小に読むため、これらを使ってください。詳細は[ステレオ素材](./mastering-assistant.md#ステレオ素材)を参照してください。

::: details 「トーナルバランス」と「モノラル互換性」は何を測る？
- **トーナルバランス**（`match.tonalBalance`）は、トラックのエネルギーが各周波数帯（サブ・低域・中域・プレゼンス・エア）にどう分布しているかを表します。リファレンス曲と比べると、自分の音がどこで暗い／明るいかが分かり、`match.applyMatchEq` がそれを補正します。
- **モノラル互換性**（`stereo.monoCompatCheck`）は、ステレオミックスをモノラルに合算したときに何が起きるかを予測します。スマホのスピーカー、クラブの PA、一部の放送経路では、この確認が重要です。

左右が逆相だと、合算時に打ち消し合ってレベルが失われることがあります。このチェックはそのリスクを事前に知らせます。詳しくは [モノラル互換性](./glossary/concepts/mono-compatibility.md) を参照してください。
:::

## ミキサー／エンジンのインサート

クリエイティブ FX インサートのカタログ — リバーブ、モジュレーション、ディレイのインサート ID、それぞれのパラメータ表、`masteringInsertNames()` の検出 API、`SONARE_HAVE_FX` / `BUILD_ACOUSTIC_SIM` によるビルド有効化 — は独立したページにまとめました。[エフェクトインサート](./effects-inserts.md) を参照してください。

## 呼び出し方

単体・ペア・クリエイティブインサートのプロセッサを、現在のビルドに合わせた 1 つのピッカーへまとめる場合は `capabilityCatalog()` / `capability_catalog()` を使います。各プロセッサのパラメータ記述子（名前・id・型・単位・リアルタイム安全性）と、組み込みプリセット一覧も取得できます。ただし `min` / `max` / `default` は常に `null` なので、ピッカーの生成には使えてもコントロールの範囲決めには使えません。値の範囲は本ページのプロセッサ別の表を参照してください。`masteringProcessorCatalog()` は、マスタリング専用ピッカー向けの、より狭いレジストリ分類です。

::: code-group

```typescript [ブラウザ]
const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();   // 実行時にソロプロセッサ id を取得
masteringProcessorCatalog(); // ピッカー／フィルタ用にプロセッサを分類
masteringInsertParamInfo('eq.parametric'); // リアルタイムオートメーション用メタデータ

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});

const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });

// 解析は JSON 文字列を返す — パースする
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono   = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```typescript [Node]
import {
  capabilityCatalog,
  masteringInsertParamInfo,
  masteringPairAnalyze,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorCatalog,
  masteringProcessorNames,
  masteringStereoAnalyze,
} from '@libraz/libsonare-native';

const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();
masteringProcessorCatalog();
masteringInsertParamInfo('eq.parametric');

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});
const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```python [Python]
import json
import libsonare as sonare

build = sonare.capability_catalog()
print(len(build["processors"]), build["presets"]["mastering"])

sonare.mastering_processor_names()   # 実行時にソロプロセッサ id を取得

out = sonare.mastering_process('dynamics.compressor', samples, sample_rate=sr, params={
    'thresholdDb': -24,
    'ratio': 1.5,
})

stereo = sonare.mastering_process_stereo('stereo.imager', left, right, sample_rate=sr, params={'width': 1.1})

# 解析は JSON 文字列を返す — パースする
report = json.loads(sonare.mastering_pair_analyze('match.referenceLoudness', source, reference, sample_rate=sr))
mono   = json.loads(sonare.mastering_stereo_analyze('stereo.monoCompatCheck', left, right, sample_rate=sr))
```

```bash [CLI]
# 現在のビルドと機能カタログの概要を確認
sonare doctor --json

# ソロプロセッサ id を取得
sonare mastering-processors

# ソロプロセッサを 1 つ適用（--params は浮動小数の k=v,k=v）
sonare mastering-processor song.wav --processor dynamics.compressor \
  --params "thresholdDb=-24,ratio=1.5" -o out.wav

# 2 入力（ペア）解析は JSON を出力
sonare mastering-pair-analyze song.wav --reference ref.wav --analysis match.referenceLoudness

# Python CLI には専用の mastering-stereo-analyze サブコマンドはなく、
# 2 チャンネルのステレオ解析はソースビルドの C++ CLI だけが公開する。
# （Python の mastering-processor コマンドはステレオ専用プロセッサも実行できるが、
#  モノラル入力を左右へ複製したプレビューになる。）
```

:::

:::: details チェーンの入口で設定スタイルが異なる
レジストリは文字列ベースなので、C・Python・Node・WASM・CLI が同じプロセッサ識別子を共有できます。

単一プロセッサではなく*チェーン*を組むときは、入口ごとに設定スタイルが変わります。

| 入口 | 設定スタイル |
|------|--------------|
| WASM `masteringChain(...)` | ネストした設定オブジェクト。同じオブジェクト内でドット記法のリーフキーも受け付けます |
| `masterAudio(...)` と Python/Node 相当 | `'loudness.targetLufs'` のようなフラットなドット記法 |
| [マスタリングアシスタント](./mastering-assistant.md) の `chainConfig.params` | `masterAudio` にそのまま渡せるフラット形式。`params["dynamics.multibandComp"]` には、後述する任意バンド数のネストされた v2 オブジェクトが入ることもあります — [チェーン設定 JSON スキーマ](#チェーン設定-json-スキーマ) を参照してください |

`MasteringChainConfig` は両方の書き方を受け付けます。`'loudness.targetLufs': -20` のようなドット記法のリーフキーは、ネストした `loudness: { targetLufs: -20 }` と並べても置き換えても構いません。コアがキーを検証し、未知のキーは拒否します。ドット記法は C ABI がパラメータを運ぶ形式でもあるため、上書き値を手で書き下すのではなく動的に組み立てる場面では、こちらが扱いやすい形になります。

正準（canonical）な書き方はネスト形式です。手で書くコードではネスト形式を選んでください。TypeScript はネストした設定をフィールド単位で型検査できますが、ドット記法のキーは実行時にしか検査されません。

repair のチェーンキーは、単発プロセッサのレジストリ名ではなくチェーン内のスロットに合わせます。フラットな上書きでは `repair.denoise.*` / `repair.dereverb.*`、`masteringChain(...)` のネスト形式では `repair: { denoise: ..., dereverb: ... }` を使ってください。
::::

## チェーン設定 JSON スキーマ

フラットな `chainConfig.params` マップ（上の表にある `chainConfig.params` の形、`masterAudio` の上書きが受け付ける形）には、CLI と[マスタリングアシスタント](./mastering-assistant.md)が使う JSON ドキュメント表現があります。`sonare mastering --config <file>` はこれを読み込み、`masteringAssistantSuggest` の `chainConfig` もこの形式で表現されます。このシリアライズは 2 つのスキーマバージョンを自動的に選びます。

::: details バージョン 1 と バージョン 2
- **バージョン 1** — フラットで固定 **3 バンド**の low/mid/high マルチバンドコンプレッサー形式です。`dynamics.multibandComp.lowCutoffHz`、`.highCutoffHz`、およびバンドごとの `lowThresholdDb`／`midThresholdDb`／`highThresholdDb` とそのレシオ／アタック／リリースの兄弟キーを使います。フラット上書き系の入口はすべてこの形で送り、マスタリングアシスタントも実運用では常にこの形で出力します — アシスタントはマルチバンドコンプレッサーを既定の 3 バンド形状から変更しないため、その `chainConfig` は常にバージョン 1 のままです。
- **バージョン 2** — マルチバンドコンプレッサーの設定が固定 3 バンド形状で表現できなくなった時点（クロスオーバーのカットオフ数が違う、クロスオーバーのスロープ／モードが既定と異なる、FIR カーネルサイズが既定と異なる、など）で自動的に選ばれます。この場合、`params["dynamics.multibandComp"]` はフラットな `low`／`mid`／`high` キーではなく、構造化されたオブジェクトになります。
  - `crossover.cutoffsHz[]`、`crossover.slope`、`crossover.mode`、`crossover.firKernelSize`
  - `bands[]` — 最大 **64 バンド**、各バンドに `thresholdDb`、`ratio`、`attackMs`、`releaseMs`、`kneeDb`、`makeupGainDb`、`autoMakeup`、`detector`、`sidechainHpfEnabled`、`sidechainHpfHz`、`pdrTimeMs`、`pdrReleaseScale`

  フィールド検証は厳格です。バージョン 2 の `dynamics.multibandComp` オブジェクト内で未知のキーがあれば拒否され、バンド数はカットオフ数 + 1 と一致していなければなりません。
:::

::: warning 到達性: JSON ドキュメントの機能であって JS オブジェクトの機能ではない
バージョン 2 の構造化形式に到達できるのは JSON ドキュメント経由です — CLI の `sonare mastering --config <file>`、またはチェーン設定を JSON として読み書きするコードです。WASM `masteringChain()` の TypeScript 型 `MasteringChainConfig.dynamics.multibandComp` インターフェースは、依然として固定の low/mid/high 省略形しか公開していないため、JavaScript で `MasteringChainConfig` オブジェクトを直接組み立てる方法では任意バンド数の形式には到達できません。到達するには、JSON ドキュメントを自分で書くか、より広いクロスオーバー数（たとえば[名前付きプロセッサ](#ソロプロセッサ)の `multiband.compressor` とその最大 9 バンドまでの `cutoffNHz` スロット）で生成したものを JSON 経路に渡す必要があります。
:::

## 関連

- [マスタリングアシスタント](./mastering-assistant.md) — profile/suggest/preview の JSON と提案→レンダリング経路
- [マスタリング実装](./mastering-implementation.md) — ブラウザデモでレンダリングするチェーン
- [DSP 実装解説](./dsp-implementation.md) — 各ファミリーの挙動
- [ミキシングエンジン](./mixing.md) — これらをチャンネルストリップ／バスのインサートとして読み込む
