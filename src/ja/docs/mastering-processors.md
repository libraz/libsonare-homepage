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

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`, `vinyl`, `tapeHiss`, `fieldRecording`, `voiceMemo`, `shellac78`

プリセットを完成マスターと見なさずに選ぶ方法は [プリセットの選び方](./glossary/mastering/preset-selection.md) を参照してください。

### レストレーション用プリセット

末尾の 5 つはレストレーション用のプリセットです。有効にするのはリペア段だけで、レベルには手を触れません。ラウドネス目標もシーリングもなく、トーン段やダイナミクス段も動きません。それぞれが素材に必要な [リペアチェーン](#リペア段) の部分集合を有効にし、名前の挙がらない段はすべて無効のままです。

| プリセット | 対象 | 有効にする段 |
|------------|------|--------------|
| `vinyl` | LP の取り込み。溝の傷によるクリックとポップ、盤面のクラックル、その下に敷かれたノイズフロア | `declick`、`decrackle`、`denoise`。いずれも既定値のまま |
| `tapeHiss` | テープの取り込みで、欠陥が広帯域のヒスノイズだけのもの。機器のハムはテープ音源全般に共通するほど普遍的ではないため、`dehum` は既定では有効にしない | `denoise` |
| `fieldRecording` | ロケーション録音。マイクのノイズフロア、機材をつないだ回路の電源ハム、収録場所の響き | `denoise`、`adaptive` を有効にした `dehum`（設定した 50 Hz にぴったり乗るとは限らず許容範囲内でずれる電源周波数を追従する）、`dereverb` |
| `voiceMemo` | スマートフォンやノート PC での収録。自身の AGC に対してクリップし、マイクのノイズフロアが高く、話者がいた部屋の響きをそのまま含む | `declip`、`denoise`、`dereverb` |
| `shellac78` | 78 回転の SP 盤の取り込み。LP より粗い溝は幅の広いポップとより密な表面ノイズに摩耗し、ノイズフロアも高い | `maxClickSamples` を 16 に広げた `declick`（78 回転盤のクリック長でも補間フォールバックではなく LPC 再構成に届くようにする）、`threshold` を 0.25 に下げた `decrackle`（表面ノイズのより多くをクラックルとして扱う）、`reductionDb` を 32 に深めた `denoise` |

これらのプリセットが対象とする素材に、リペア段の 1 つがどう効くかを聴いてみてください。クリップは電源ハム、表面ノイズ、まばらなクリックを乗せたピアノのターンアラウンドで、適用している段は古典的なデリバーブです。取り除かれるのはノイズの土台と滲んだ余韻で、クリックとハムはデクリック段とハム除去段の担当としてそのまま残ります。

<SonareDemo id="mastering-restoration" />

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
- ラウドネス段は「ゲイントリムの後ろに別のリミッターを置いたもの」ではありません。`target - current` の静的ゲインを 1 回かけ、そのゲインでシーリングを超えた分を、段が自前で持つポストゲインの True Peak リミッターに引き戻させます。`loudness.maxLimiterGainReductionDb`（既定 12 dB。有限かつ 0 以上）は、そのリミッターをどこまで駆動してよいかの上限で、静的ゲインがシーリングまでのピークヘッドルームを超えられるのは最大でこの量までです。決めているのはマスターの最大音量ではなく、どれだけピークの立った入力までノーマライズを試みるかで、許容量が `target - current` 以上のゲインを与えることはなく、シーリング自体を超えることもありません。この既定値はすべてのラウドネス経路で共有されるため、チェーン・単体ヘルパー・名前付きプロセッサ（`maximizer.loudnessOptimize` は同じキーを `maxLimiterGainReductionDb` として読む）のいずれでも同じようにノーマライズされます。`0` にするとヘッドルームで厳密に頭打ちになり、ピークノーマライズ済みの素材では大きな目標値に届かなくなります。`sonare mastering song.wav --preset pop --params "loudness.maxLimiterGainReductionDb=0"` は -16.19 LUFS に着地し、既定の -14.06 LUFS と差が出ます。残る不足分はリミッター自身のゲインリダクションで、1 回で反復しないパスでは測り直されないため、`loudnessTargetLimited` で報告されます。
- `maximizer.truePeakLimiter` はシーリングをサンプル単位で守り、ブロック全体を一括でスケーリングすることはありません。内部のすべての段が呼び出しをまたいで状態を持ち越すため、出力は呼び出し側がストリームをどう区切るかに依存しません。同じ素材を 1 ブロックで処理しても、256〜16384 サンプルの均等なブロックで処理しても、トランジェントの途中で切れる不揃いな分割で処理しても、結果は同一で、ストリーミングのレンダリングとオフラインのレンダリングは一致します。残るのはサンプル間のわずかな残差で、これはブロックサイズではなく「リミッターより細かく測る」ことに由来する性質です。既定の 4 倍リミッターが決めたシーリングを 8 倍オーバーサンプリングのメーターで読むと約 +0.02 dB 上に出ますが、ドライブ 0〜+36 dB の範囲で一定です。リミッターと同じオーバーサンプリングで測ればシーリングは正確に守られていることが確認でき、`oversampleFactor` を上げれば残差そのものを小さくできます。
- UI 向けには `meteringVectorscope(...)` と `meteringPhaseScope(...)` に `maxPoints` を渡します。点列を最大 `maxPoints` 点まで間引くので、点数の多いスコープでも描画コストを抑えられます（`maxPoints` を省くと入力サンプル 1 個につき 1 点を返します。旧来の `meteringVectorscopeDecimated(...)` ／ `meteringPhaseScopeDecimated(...)` は非推奨で、内部で委譲するだけです）。`meteringSpectrumFrame(...)` は、スペクトラムアナライザーのスナップショット向けに単一フレーム（時間平均なし）のスペクトラムを読み取ります。
- `multiband.*` のソロプロセッサ（`compressor`、`dynamicEq`、`expander`、`imager`、`limiter`、`saturation` の全 6 種）は、いずれも同じクロスオーバー機構を共有し、クロスオーバー数を任意に指定できます。固定 3 バンドではなく、素材に合わせたバンド数で分割できます。この入口が公開する `cutoffNHz` スロットは最大 8 個（`cutoff0Hz` 〜 `cutoff7Hz`）なので、`multiband.*` の呼び出し 1 回で最大 9 バンドまで扱えます。
:::

::: info 歪み系プロセッサのエイリアシング対策
波形を強く整形する 5 つのプロセッサは、スペクトルの折り返しを生みます。これらはいずれも `aliasing` パラメータを取り、その扱い方を選べます。`0` は対策なし、`1` は 1 次の原始関数アンチエイリアシング（ADAA1）、`2` は 2 次（ADAA2）、`3` は 4 倍オーバーサンプリング経路です。

| プロセッサ | 実装しているモード |
|---|---|
| `saturation.hardClipper` | なし、ADAA1、ADAA2、4 倍オーバーサンプリング |
| `saturation.softClipper`、`saturation.waveshaper` | なし、ADAA1、4 倍オーバーサンプリング |
| `saturation.exciter`、`spectral.presenceEnhancer` | なし、4 倍オーバーサンプリング |

実装していないモードは黙って無視されるのではなく拒否され、メッセージが使えるモードの集合を示します。`soft clipper ADAA2 anti-aliasing is not supported; use None, Adaa1, or Oversample4x` のような形です。この 5 つ以外のプロセッサにこのパラメータを渡した場合は、キー自体が拒否されます。`unknown --params key for saturation.tube: aliasing` となります。

オーバーサンプリング経路はドライ信号の時間を揃え、発生した遅延を報告します。1 フェーズあたり 24 タップのポリフェーズフィルターを上りと下りで往復するため、基本レートで 24 サンプルの遅延が生じ、4 倍経路ではレイテンシが `24`、他のモードでは `0` になります。この値はプロセッサの結果が届く場所にそのまま乗ります。ブラウザと Node では `masteringProcess()` が返す `MasteringResult` の `latencySamples`、Python では `MasteringResult` の `latency_samples`、C では `SonareMasteringResult` の `latency_samples`、インサートとして組み込んだ場合はプロセッサ自身の `latency_samples()` です。チェーンが報告する他の遅延と同じように補正してください。
:::

::: info クロスオーバーとは？
クロスオーバーは、信号を周波数帯（たとえば低域／中域／高域）に分割し、各帯域を別々に処理できるようにします。「クロスオーバー周波数」は、ある帯域が終わり次の帯域が始まる境界の周波数です。クロスオーバーが多いほど帯域が増え、より細かく制御できます。
:::

## チェーンの順序

フルチェーン（`masterAudio`、`masteringChain`、そしてすべてのプリセット）は、スロットを 1 つの固定順で実行します。repair → eq → dynamics → saturation → spectral → stereo（ステレオ経路のみ）→ maximizer → loudness です。設定が選ぶのはどのスロットを動かすかであって、位置ではありません。図はエンジンが持つすべてのスロットを実行順に並べたもので、`pop` プリセットが有効にするものを塗りつぶしています。空のスロットもその位置に存在していて、有効にする設定を待っています。

<MasteringChainFigure
  title="すべてのチェーンスロットを、エンジンの実行順に"
  :enabled="['eq.tilt', 'dynamics.compressor', 'dynamics.transientShaper', 'saturation.exciter', 'stereo.imager', 'loudness.optimize']"
  :labels="{
    repair: 'リペア',
    eq: 'EQ',
    dynamics: 'ダイナミクス',
    saturation: 'サチュレーション',
    spectral: 'スペクトル',
    stereo: 'ステレオ',
    maximizer: 'マキシマイザー',
    loudness: 'ラウドネス',
    output: '出力',
    enabled: 'この設定で有効',
    available: '存在するが無効',
    fixedOrder: '順序は固定です。設定が選ぶのはどのスロットを動かすかであって、位置ではありません。',
  }"
/>

### リペア段

リペア系は 6 つの段が 1 つのスロットを共有し、その順序が結果を左右するため、最もよく質問されるファミリーです。設定がどの部分集合を有効にしても、損傷の大きいものから順に実行され、各段は前の段が整えた後の素材を受け取ります。

1. `declip` — `declick` より前。平坦に潰れた領域にはクリック検出器が測るべきトランジェントがないためです。
2. `declick`
3. `decrackle`
4. `dehum`
5. `denoise`
6. `dereverb` — 最後。広帯域のノイズフロアは定常的な残響の後部として読まれ、残響の推定をそちらへ引きずるためです。

::: details `repair.denoise.reductionDb` — フロアではなく深さ
デノイズ段の深さは `repair.denoise.reductionDb` で決めます。ゲインマスクがどのビンにも適用できる最も深い減衰量を dB で表したもので、有限かつ 0 以上でなければならず、上限はありません。既定は `26` で、大きいほど多く取り除きます。ゲートではなく残留ノイズのフロアとして働き、26 dB ならノイズは消えるのではなく 26 dB 下がった状態で残ります。デノイズ結果がゲートをかけたような音にならないのはこのためです。単体の `masteringRepairDenoiseClassical` が返すレポートは、このフロアがどれだけ効いたかを示します。`maxReductionDb` が `reductionDb` で飽和していれば深さを決めたのは推定器ではなくフロアであり、`floorLimitedFraction` はフロアに張り付いたマスクセルの割合です。

同じつまみは線形のフロアとしても受け付けます。`repair.denoise.gainFloor` キーは読み込み時に `reductionDb = -20 * log10(gainFloor)` で変換され、変換は元の有効範囲も引き継ぎます。1 を超えるフロアは負の深さになり拒否されます。短縮キーの `repair.reductionDb` と `repair.gainFloor` も同じデノイズスロットへ対応づけられます。フラットな上書き、JSON のチェーン設定ドキュメント、ブラウザと Node のネストした `MasteringChainConfig` 型のいずれも `gainFloor` をこの形で受け付け、TypeScript の型は `reductionDb` を優先するよう非推奨とマークしています。
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

キャビネットとマイク関連のキーも構築時専用で、`masteringInsertParamInfo('saturation.ampSim')` にはいずれも現れません。

| キー | 意味 |
|------|------|
| `preset` | 名前付きのアンプリグ。数値キーより先に解決される |
| `cabIrF32Base64` | 収録済みのキャビネットインパルス応答。32 ビット浮動小数サンプルを base64 で渡す |
| `cabIrSampleRate` | その IR を収録したサンプルレート。`0` はプロセッサのレートと同じであることを表す |
| `cabIrGenerate` | 解析的なキャビネット特性の代わりに、`cabModel` からインパルス応答を合成する |
| `cabIrDrivers` | 合成したインパルス応答にキャビネットの他のドライバーを合算するか |
| `micModel`、`micAxis`、`micDistanceCm`、`micBlend` | 1 本目のマイク。種類（`0` なし、`1` ダイナミック、`2` リボン、`3` コンデンサ）、軸上位置、距離、ブレンド量 |
| `micBModel`、`micBAxis`、`micBDistanceCm`、`micBInvert` | ペアの 2 本目のマイク。極性反転を含む |
| `cone`、`doppler` | コーン分割振動とコーン運動によるドップラー。`doppler` は報告されるレイテンシを変える |
:::

::: warning オフラインレンダリングでは `saturation.ampSim` のテールを出し切る
このプロセッサが報告するテールには、2 本目のマイクの経路差による遅延だけでなくキャビネットインパルス応答が含まれます。読み込んだ／合成したキャビネット応答は最長で 48 kHz において約 21 ms あるため、最後の入力サンプルで出力の取り出しをやめるオフラインバウンスは、その分のキャビネットの減衰を失います。レンダリング結果がわずかに早く終わり、わずかにドライになるだけで、何の兆候も出ません。報告されたテールを出し切るまで出力を読み続けてください。
:::

::: info 実際にレンダリングするチャンネル数で prepare する
`saturation.ampSim` はチャンネルごとに確保します。各チャンネルがキャビネット IR のリングバッファ、ドップラーライン、2 本のマイクディレイラインを持ちます。そのためサチュレーション系の中では prepare のコストが突出して大きく、モノラルのバウンスに対してリアルタイム用の最大チャンネル数で prepare すると約 84 MB を確保します。同等の `saturation.tube` のレンダリングが 2.6 MB であることを考えると、大きな WebAssembly のミキシンググラフでは確保に失敗しかねない量です。

チャンネル数を受け取る `prepare` のオーバーロードは、実際に処理するチャンネル分だけ状態を確保するので、オフラインのモノラル／ステレオレンダリングではこちらを使ってください。引数 2 つの `prepare` を使うリアルタイム呼び出し側の挙動は変わりません。
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

::: warning マッチカーブは周波数範囲の内側でしか定義されない
`match.applyMatchEq` と `match.matchEqCurve` 解析は、`[minFrequencyHz, maxFrequencyHz]`（既定では 40 Hz〜18 kHz）の範囲で補正をフィットします。使えるバンド数は最大 `maxBands`（既定 8）、1 バンドあたりの補正量は最大 `maxGainDb`（既定 12）です。この区間の外は一切マッチングされません。

カーブの実現方法は 2 通りありますが、どちらもその点で一致するため、相互に置き換えられます。パラメトリック側は範囲外にバンドを置きません。FIR 側は両端から 1 オクターブかけてゲインをユニティへ戻し、高域側はナイキストが 1 オクターブより近い場合に幅を詰めて、ナイキスト周波数でちょうど重みがゼロになるようにします。

このテーパーは見た目を整えるための平滑化ではなく、本質的な部分です。フィットしたゲインを DC までそのまま延長すると、低域の厚いリファレンスに対して痩せたソースをマッチさせた場合、下限より下で `maxGainDb` いっぱいまで持ち上がります。広帯域のオフセットと超低域のエネルギーが乗り、以降の全ステージのヘッドルームを食う一方で、同じマッチのパラメトリック実現はその帯域に手を付けません。超低域までマッチさせたい場合は `minFrequencyHz` を下げてください。既定のフィットがそこまで届くことを期待しないでください。
:::

::: details マッチ EQ の構築キー
`match.applyMatchEq` と `match.matchEqCurve` は同じカーブフィッティング用のキーを読みます。残りは FIR 実現のみに関わるキーです。

| キー | 既定値 | 意味 |
|------|--------|------|
| `minFrequencyHz` | `40` | マッチング範囲の下端。0 より大きい必要がある |
| `maxFrequencyHz` | `18000` | マッチング範囲の上端。`minFrequencyHz` より大きい必要がある |
| `maxBands` | `8` | フィットに使えるバンド数の上限 |
| `maxGainDb` | `12` | 1 バンドあたりの補正量の上限 |
| `q` | `1.0` | フィットする各バンドの Q |
| `smoothingBins` | `2` | フィット前にかけるスペクトル平滑化 |
| `fftSize` | `2048` | FIR 実現での解析 FFT サイズ |
| `kernelSize` | `513` | FIR カーネル長 |
| `phase` | `0` | `0` = リニアフェーズ、`1` = ミニマムフェーズ |
| `partitionSize` | `0` | 畳み込みの分割サイズ。`0` で自動選択 |
:::

::: details `stereo.monoCompatCheck` と `stereo.monoCompatCheckLogBands` の読み方
`stereo.monoCompatCheck` は信号全体に対する 1 つの判定を返します。`correlation`、`width`、`monoPeak`、`sideRms`、そして唯一のパラメータ `correlationThreshold`（既定 `0`）と比較して決まる `likelyMonoCompatible` フラグです。

`stereo.monoCompatCheckLogBands` は同じ測定を対数バンドへ分割します。`lowHz`（既定 `20`）から `highHz`（既定 `20000`）までを `bandsPerOctave`（既定 `3`）で刻み、各要素が `lowHz`、`highHz`、`correlation`、`sideRms` を持つ `bands` 配列を返します。

各バンドの相関は、対数中心の 1 点をプローブするのではなく、そのバンドの `[lowHz, highHz)` 区間全体を対象に測ります。この違いが読み取り結果を信頼できるかどうかを決めます。1 つのバンドの中に同相の成分と逆相の成分が同居していると、モノラルに合算したときに互いを打ち消しますが、中心周波数のプローブでは中心に近い方しか見えず、そのバンドを相関ありと判定してしまいます。区間全体を測れば、打ち消し合うペアをそのまま報告できます。

バンド数は見た目ほどコストに効きません。各バンドが信号全体を個別に走査するのではなく、変換一式を共有するため、長いバッファを 30 バンドに分割しても 3 バンドの 10 倍近い処理量にはなりません。素材に必要な分解能を選んでください。
:::

## ミキサー／エンジンのインサート

クリエイティブ FX インサートのカタログ — リバーブ、モジュレーション、ディレイのインサート ID、それぞれのパラメータ表、`masteringInsertNames()` の検出 API、`SONARE_HAVE_FX` / `BUILD_ACOUSTIC_SIM` によるビルド有効化 — は独立したページにまとめました。[エフェクトインサート](./effects-inserts.md) を参照してください。

## 呼び出し方

単体・ペア・クリエイティブインサートのプロセッサを、現在のビルドに合わせた 1 つのピッカーへまとめる場合は `capabilityCatalog()` / `capability_catalog()` を使います。各プロセッサのパラメータ記述子（名前・id・型・単位・リアルタイム安全性、および `min` / `max` / `default` の 3 値）と、組み込みプリセット一覧も取得できます。`masteringProcessorCatalog()` は、マスタリング専用ピッカー向けの、より狭いレジストリ分類です。

### カタログの値域の読み方

記述子は 3 つの値フィールドをすべて持つため、本ページのプロセッサ別の表を書き写さなくても、カタログから直接コントロールの範囲を決められます。ただし埋まり方は一様ではありません。`default` はほぼすべてのパラメータが公開する一方、`min` と `max` は制限が存在する場合にだけ公開されます。`null` の値域はデータの欠落ではなく、その側に既知の制限がないことを表しており、これが依然として多数派です。

2 種類の値は出どころが異なり、ホストがどこまで信頼できるかもそれで決まります。

- **default** はプロセッサの設定構造体そのもののフィールド初期化子で、各ビルダーがそこへフォールバックする際に記録されます。そのため初期化子を変更したフィールドが、カタログに古い値を残したままになることはありません。
- **値域は宣言ではなく実測**です。候補値は呼び出し側と同じ構築経路を通り、カタログにはバリデーションが受理した区間が載ります。

::: warning 値域は推奨レンジではなく受理条件
`min` と `max` はプロセッサが**受け付ける**範囲を表します。コントロールを動かすうえで音楽的に妥当なレンジではありません。区間内の値でも不適切な設定はあり得ますし、区間外の値はクランプされずに拒否されます。
:::

値域が宣言ではなく実測であることから、ホスト側で考慮すべき性質が 3 つあります。

- **各値域は他のパラメータを既定値に置いたまま測定されます**。そのため互いを制約し合う 2 つのコントロールは、それぞれ**相手の既定値**を自分の限界として報告します。`maximizer.adaptiveRelease` が `minReleaseMs` の上限を 250、`maxReleaseMs` の下限を 20 として公開するのはこのためで、これらは相手側の既定値であり、ペア全体としての限界ではありません。
- **サンプルレート由来の値域は prepare 前の状態を反映します**。EQ の `band*.frequencyHz` の上限がいずれも 24000 と読めるのはこのためで、インサートをより高いレートで prepare すれば上がります。
- **開区間の境界は、除外される値そのものとして報告されます**。`dynamics.compressor` は `sidechainHpfHz` の `min` を 0 として公開しますが、0 は拒否します。

フラットなパラメータ集合の大半を占めるのがバンド単位の EQ です。`eq.parametric`、`eq.midSide`、`multiband.dynamicEq` は、インデックス付きの `band*` フィールドすべてについて型と既定値を公開します。公開されたからといって**読み取られる**キーが増えるわけではなく、不完全に指定したバンドの残りのキーは、これまでどおり無視されたものとして報告されます。

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
