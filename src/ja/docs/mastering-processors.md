---
title: マスタリングプロセッサ
description: libsonare の名前付きマスタリング API、プリセット、ソロプロセッサ、ペア／ステレオ解析を、目的別プロセッサ早見表とともに、実行時レジストリと同期して掲載します。
---

# マスタリングプロセッサ

このページは libsonare の名前付きマスタリング API の**レジストリ**です。「*何を呼べるか*」に答え、「*内部でどう動くか*」には答えません。実行時の根拠は `masteringProcessorNames()`、`masteringPairProcessorNames()`、`masteringPairAnalysisNames()`、`masteringStereoAnalysisNames()`、`masteringPresetNames()` で、このページはそれらを反映します。

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
ダイナミクス系には `dynamics.duckingProcessor`（サイドチェインダッキング）、`maximizer.loudnessOptimize`（LUFS ターゲットのマキシマイズ）、`dynamics.deesser` の bandpass `Q` コントロール（ステレオ保持つき）があり、`dynamics.transientShaper`、`dynamics.upwardCompressor`、`dynamics.upwardExpander`、`dynamics.vocalRider`、`dynamics.sidechainRouter` と並びます。
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
| 耳障りな「サ行」を抑える | `dynamics.deesser` | [ダイナミクス](./glossary/mastering/dynamics.md) |
| 音楽ベッドを声の下に下げる | `dynamics.duckingProcessor`、`dynamics.sidechainRouter` | [ミキシングエンジン](./mixing.md) |
| 全体のトーン／明るさを整える | `eq.tilt`、`eq.parametric`、`spectral.airBand` | [トーンと Air](./glossary/mastering/tone-air.md) |
| 温かみ／倍音を加える | `saturation.tape`、`saturation.tube`、`saturation.exciter` | [トーンと Air](./glossary/mastering/tone-air.md) |
| ステレオを広げる／狭める／確認 | `stereo.imager`、`stereo.monoMaker`、`stereo.monoCompatCheck` | [ステレオとラウドネス](./glossary/mastering/stereo-limiter-loudness.md) |
| ラウドネスに安全に到達 | `loudness` 段、`maximizer.loudnessOptimize`、`maximizer.truePeakLimiter` | [配信ターゲット](./glossary/mastering/delivery-targets.md) |
| ノイズ／クリック／クリップ除去 | `repair.denoiseClassical`、`repair.declick`、`repair.declip` | [リペアと入力](./glossary/mastering/repair.md) |
| リファレンスに合わせる | `match.applyMatchEq`、`match.referenceLoudness` | [リファレンスマッチ](./glossary/mastering/reference-match.md) |

::: details パラレルコンプレッションとは？
通常のコンプレッサーは大きい部分を下げます。**パラレルコンプレッション**は代わりに、*原音*と*強くかけたコピー*を混ぜます。圧縮したコピーが小さなディテールを持ち上げ、手つかずの原音が自然なピークを保つので、トランジェントを潰さずに密度と「まとまり」を足せます（ニューヨークコンプとも呼ばれます）。`dynamics.transientShaper` は逆向きの道具で、各打撃のアタックを強調・緩和します。
:::

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

## ソロプロセッサ

| ファミリー | プロセッサ名 |
|-----------|-------------|
| Dynamics | `dynamics.brickwallLimiter`, `dynamics.compressor`, `dynamics.deesser`, `dynamics.expander`, `dynamics.gate`, `dynamics.limiter`, `dynamics.parallelComp`, `dynamics.sidechainRouter`, `dynamics.duckingProcessor`, `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider` |
| EQ | `eq.apiStyle`, `eq.bandPass`, `eq.cutFilter`, `eq.dynamic`, `eq.equalizer`, `eq.graphic`, `eq.linearPhase`, `eq.midSide`, `eq.minimumPhase`, `eq.parametric`, `eq.pultec`, `eq.shelving`, `eq.tilt` |
| Final | `final.bitDepth`, `final.dither`, `final.outputChain` |
| Maximizer | `maximizer.adaptiveRelease`, `maximizer.loudnessOptimize`, `maximizer.maximizer`, `maximizer.softKneeMax`, `maximizer.truePeakLimiter` |
| Multiband | `multiband.compressor`, `multiband.dynamicEq`, `multiband.expander`, `multiband.imager`, `multiband.limiter`, `multiband.saturation` |
| Repair | `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`, `repair.trimSilence` |
| Saturation | `saturation.bitcrusher`, `saturation.exciter`, `saturation.hardClipper`, `saturation.multibandExciter`, `saturation.softClipper`, `saturation.tape`, `saturation.transformer`, `saturation.tube`, `saturation.waveshaper` |
| Spectral | `spectral.airBand`, `spectral.lowEndFocus`, `spectral.presenceEnhancer`, `spectral.spectralShaper` |
| Stereo | `stereo.autoPan`, `stereo.haasEnhancer`, `stereo.imager`, `stereo.monoMaker`, `stereo.phaseAlign`, `stereo.stereoBalance` |

::: warning リペアは設計上クラシカル DSP
`repair.denoiseClassical`・`repair.dereverbClassical` などは、明示的なノイズ推定を伴うスペクトル減算／MMSE-STSA／LogMMSE を使います。DNN 音源分離やニューラルなスペクトル修復**ではありません**。ノイズ・ハム・クリック・クリッピングを整えますが、完成トラックを分離し直すことはしません。これによりライブラリの外部依存なしの方針を保ちます。
:::

::: tip レジストリ名とチェーンキーは異なります
名前付きプロセッサレジストリでは、単発のリペアプロセッサ名は `repair.denoiseClassical` と `repair.dereverbClassical` です。フルチェーン設定では `MasteringChainConfig` 内のリペアスロットを指すため、短いステージキーの `repair.denoise.*` と `repair.dereverb.*` を使います。どちらも同じクラシカルなデノイズ／ディリバーブ実装を呼び出します。
:::

::: details スペクトル減算（MMSE-STSA／LogMMSE）とは？
いずれもクラシカルなノイズ除去手法です。まず静かな箇所から**ノイズプロファイル**（定常的なヒスやハム）を推定します。**スペクトル減算**は各短時間スペクトルフレームからその推定ノイズを差し引き、信号を残します。**MMSE-STSA** と **LogMMSE** はより賢い統計的手法で、周波数ビンごとに信号とノイズの割合を推定してから差し引くため、素朴な減算で残る「ミュージカルノイズ」のようなざらつきを抑えます。いずれも楽器を分離するものではなく、ノイズを減衰させるだけです。
:::

## ペアプロセッサと解析

ペアプロセッサはソース**と**リファレンスを取ります。ペア／ステレオ*解析*は測定 JSON を返し、それ自体では音声をレンダリングしません。

| 種類 | 名前 |
|------|------|
| ペアプロセッサ | `match.applyMatchEq`, `match.alignReferenceToSource`, `match.abSwitch`, `match.abCrossfade` |
| ペア解析 | `match.referenceLoudness`, `match.tonalBalance`, `match.tonalBalanceLogBands`, `match.matchEqCurve`, `match.estimateReferenceDelaySamples` |
| ステレオ解析 | `stereo.monoCompatCheck`, `stereo.monoCompatCheckLogBands` |

::: details 「トーナルバランス」と「モノラル互換性」は何を測る？
- **トーナルバランス**（`match.tonalBalance`）は、トラックのエネルギーが各周波数帯（サブ・低域・中域・プレゼンス・エア）にどう分布しているかを表します。リファレンス曲と比べると、自分の音がどこで暗い／明るいかが分かり、`match.applyMatchEq` がそれを補正します。
- **モノラル互換性**（`stereo.monoCompatCheck`）は、ステレオミックスをモノラルに合算したとき（スマホのスピーカー、クラブの PA、一部の放送経路など）に何が起きるかを予測します。左右が逆相だと、合算時に打ち消し合ってレベルが失われることがあります。このチェックはそのリスクを事前に知らせます。詳しくは [モノラル互換性](./glossary/concepts/mono-compatibility.md) を参照してください。
:::

## ミキサーインサート名

ミキサーシーンのインサートはマスタリングインサートと同じファクトリを使いますが、有効なインサート集合は `masteringProcessorNames()` より少し広いです。上のソロプロセッサに加え、クリエイティブ FX 有効ビルドではリバーブインサート ID も使えます。

| Insert ID | 意味 |
|-----------|------|
| `effects.reverb.plate` | Dattorro 系プレートリバーブのエイリアス |
| `effects.reverb.dattorro` | Dattorro reverb |
| `effects.reverb.fdn` | Feedback delay network reverb |
| `effects.reverb.velvet` | Velvet-noise 系 reverb |
| `effects.reverb.convolution` | Convolution reverb。ネイティブ insert 作成経路ではインパルスレスポンスを使えます |

これらの insert ID は、`SONARE_HAVE_FX` 有効ビルドでのみ使えます。

実用上の注意は次の通りです。

| 項目 | 意味 |
|------|------|
| `effects.reverb.plate` と `effects.reverb.dattorro` | 同じ Dattorro プロセッサの別名 |
| JSON シーンの params | アルゴリズムに応じて `decaySec`、`decay`、`damping` / `hfDamping`、`dryWet`、`preDelayMs`、`reverbTimeS`、`densityHz`、`enableShelf` などを調整できる |
| `effects.reverb.convolution` | ネイティブの insert 構築時にインパルスレスポンスを渡す必要がある |
| IR のない convolution insert | 実質的にパススルーとして動作する |

::: details これらのリバーブアルゴリズムの違いは？
いずれも残響のテイルを生成する方式の違いです。正しさではなく、欲しい質感で選んでください — どれも有効です。

- **Plate / Dattorro** — 滑らかで密度の高い、定番スタジオ的な響き。Dattorro 方式は広く使われるプレート系の設計で、`plate` はその別名です。
- **FDN（フィードバックディレイネットワーク）** — 相互接続したディレイラインで構成する柔軟なアルゴリズミックリバーブ。小さな部屋から大ホールまで調整しやすいのが特長です。
- **Velvet-noise** — まばらなランダムインパルスを使い、低い CPU 負荷で自然なテイルを作ります。
- **Convolution（畳み込み）** — 実空間で測定したインパルスレスポンスと信号を畳み込み、*実際の*空間を再現します。
:::

これらは [ミキシングシーン JSON](./mixing-scene-json.md) の `insert.processor` フィールドで使います。`masteringProcessorNames()` には含まれません。ミキサーインサート用のプロセッサであり、一括マスタリングプロセッサではないためです。

## 呼び出し方

::: code-group

```typescript [ブラウザ]
masteringProcessorNames();   // 実行時にソロプロセッサ id を取得

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});

const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });

// 解析は JSON 文字列を返す — パースする
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono   = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```python [Python]
import json
import libsonare as sonare

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
# ソロプロセッサ id を取得
sonare mastering-processors

# ソロプロセッサを 1 つ適用（--params は浮動小数の k=v,k=v）
sonare mastering-processor song.wav --processor dynamics.compressor \
  --params "thresholdDb=-24,ratio=1.5" -o out.wav

# 2 入力（ペア）解析は JSON を出力
sonare mastering-pair-analyze song.wav --reference ref.wav --analysis match.referenceLoudness

# ステレオプロセッサ（stereo.imager）には Python CLI サブコマンドはない。
# ソースビルドの C++ CLI では mastering-stereo-analyze / analyses も使える。
```

:::

:::: details チェーンの入口で設定スタイルが異なる
レジストリは意図的に文字列ベースで、C・Python・Node・WASM・CLI がプロセッサ識別子を共有できます。単一プロセッサではなく*チェーン*を組むときは、設定スタイルが入口で変わります。WASM `masteringChain(...)` は**ネスト**した設定オブジェクトを取り、`masterAudio(...)`（および Python/Node 相当）は `'loudness.targetLufs'` のような**フラットなドット記法**の上書き値を取ります。[マスタリングアシスタント](./mastering-assistant.md) の `chainConfig.params` はフラット形式なので、その出力は `masterAudio` へそのまま渡せます。

repair のチェーンキーは、単発プロセッサの registry 名ではなくチェーン内の slot に合わせます。フラットな上書きでは `repair.denoise.*` / `repair.dereverb.*`、`masteringChain(...)` のネスト形式では `repair: { denoise: ..., dereverb: ... }` を使ってください。
::::

## 関連

- [マスタリングアシスタント](./mastering-assistant.md) — profile/suggest/preview の JSON と提案→レンダリング経路
- [マスタリング実装](./mastering-implementation.md) — ブラウザデモでレンダリングするチェーン
- [DSP 実装解説](./dsp-implementation.md) — 各ファミリーの挙動
- [ミキシングエンジン](./mixing.md) — これらをチャンネルストリップ／バスのインサートとして読み込む
