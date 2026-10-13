---
title: マスタリングプロセッサ
description: libsonare の名前付きマスタリング API、プリセット、ソロプロセッサ、ペア／ステレオ解析を、目的別プロセッサ早見表とともに、実行時レジストリと同期して掲載します。
---

# マスタリングプロセッサ

このページは libsonare の名前付きマスタリング API の**レジストリ**です。「*何を呼べるか*」に答え、「*内部でどう動くか*」には答えません。

「dBFS」「ヘッドルーム」「マスタリングチェーン」に馴染みがなければ、先に [オーディオ基礎](./glossary/concepts/audio-basics.md) と [マスタリングとは?](./glossary/concepts/what-is-mastering.md) を読んでください。本ページは用語を前提に、プロセッサの名前に絞って説明します。

実行時の根拠は `masteringProcessorNames()`、`masteringPairProcessorNames()`、`masteringPairAnalysisNames()`、`masteringStereoAnalysisNames()`、`masteringPresetNames()` です。このページはそれらを反映します。

::: tip マスタリングが初めてなら、ここから始めない
プロセッサを 1 つずつ呼ぶのは手間のかかる方法です。まずは**プリセット**（`masterAudio`）か、音声をプロファイルしてチェーン全体を提案する **[マスタリングアシスタント](./mastering-assistant.md)** から始めてください。ソロプロセッサは、特定の段だけを細かく制御したいときに使います。
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
ダイナミクス系には、`dynamics.duckingProcessor`（サイドチェインダッキング）、`maximizer.loudnessOptimize`（[LUFS](./glossary/lufs.md) ターゲットへのマキシマイズ。LUFS は Loudness Units relative to Full Scale の略で、放送規格のラウドネス尺度です）、`dynamics.deesser` のバンドパス `Q` コントロール（ステレオ保持つき）があります。これらは `dynamics.transientShaper`、`dynamics.upwardCompressor`、`dynamics.upwardExpander`、`dynamics.vocalRider`、`dynamics.sidechainRouter` と並ぶ名前付きプロセッサです。
:::

## プリセット

プリセットは別アルゴリズムではなく、名前付きのチェーン設定です。`masterAudio(samples, sr, preset, overrides?)` の `overrides?`（上書き値）で必要な項目だけ調整できます。

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`, `vinyl`, `tapeHiss`, `fieldRecording`, `voiceMemo`, `shellac78`

`masteringPresetNames()` はこの簡潔な名前一覧を返します。カタログの `masteringPresets` 配列は各名前に `kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を加えます。レストレーション用の項目では 3 つの数値が `null` です。選択した名前を `masterAudio` の上書き値として使える数値／真偽値のフラットなマップへ展開するには、`masteringPresetParams(preset)` を使います。

プリセットを完成マスターと見なさずに選ぶ方法は [プリセットの選び方](./glossary/mastering/preset-selection.md) を参照してください。

### レストレーション用プリセット

末尾の 5 つはレストレーション用のプリセットです。有効にするのはリペア段だけで、別途のラウドネス正規化は行いません。ラウドネス目標もシーリングもなく、トーン段やダイナミクス段も動きません。それぞれが素材に必要な [リペアチェーン](#リペア段) の部分集合を有効にし、名前の挙がらない段はすべて無効のままです。

| プリセット | 対象 | 有効にする段 |
|------------|------|--------------|
| `vinyl` | LP の取り込み。溝の傷によるクリックとポップ、盤面のクラックル、その下に敷かれたノイズフロア | `declick`、`decrackle`、`denoise`。いずれも既定値のまま |
| `tapeHiss` | テープの取り込みで、欠陥が広帯域のヒスノイズだけのもの。機器のハムはテープ音源全般に共通するほど普遍的ではないため、`dehum` は既定では有効にしない | `denoise` |
| `fieldRecording` | ロケーション録音。マイクのノイズフロア、機材をつないだ回路の電源ハム、収録場所の響き | `denoise`、`adaptive` を有効にした `dehum`（設定した 50 Hz にぴったり乗るとは限らず許容範囲内でずれる電源周波数を追従する）、`dereverb` |
| `voiceMemo` | スマートフォンやノート PC での収録。自身の AGC に対してクリップし、マイクのノイズフロアが高く、話者がいた部屋の響きをそのまま含む | `declip`、`denoise`、`dereverb` |
| `shellac78` | 78 回転の SP 盤の取り込み。LP より粗い溝が摩耗して幅の広いポップとより密な表面ノイズが生じ、ノイズフロアも高い | `maxClickSamples` を 16 に広げた `declick`（この上限より長いランは `rejected` に数えられ、修復されずに残るため、そのままでは 78 回転盤の幅の広いクリックが見送られる）、`threshold` を 0.25 に下げた `decrackle`（表面ノイズのより多くをクラックルとして扱う）、`reductionDb` を 32 に深めた `denoise` |

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

しきい値とレシオを動かすと、伝達カーブが曲がる様子と `dynamics.compressor` が実信号に効く音を確認できます（スレッショルド、レシオ、アタック、リリース、ニーは[ダイナミクスコントロール](./glossary/mastering/dynamics.md)で計算例の表とともに説明しています）。

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
| Repair | 入力にクリック、クラックル、ハム、クリップ、ノイズ、過剰な残響があるとき | 音源分離やニューラルリペアを期待しているとき |

多くのチェーンは、必要ならリペア、トーン段を 1 つ、ダイナミクス段を 1 つ、必要に応じてサチュレーション / ステレオ、最後にマキシマイザー / ラウドネスで十分です。レジストリから大量に積むより、プリセットから始めて 1〜2 箇所だけ上書きする方が安定します。

::: info ラウドネス・オーバーサンプリング・メーターの詳細
マキシマイザー／final と解析の API の下には、いくつかの機能があります。

- インテグレーテッド LUFS 測定は最大 8 チャンネルのサラウンド構成に対応し、[BS.1770](./algorithm-references.md) のチャンネル重み付けを適用します。フロントのチャンネルは等倍、サラウンドは +1.5 dB（パワーの重み 1.41）で、LFE チャンネルは除外します。5.1 を超える構成について、BS.1770-4 はスピーカーの位置で重みを決めます。仰角が低く方位角 60°〜120° のチャンネルは +1.5 dB、それ以外は等倍です。そのため 7.1 では ±90° のサイドのペアが +1.5 dB、±135°〜±150° のバックのペアが等倍になります。libsonare の 8 チャンネル構成は、サイドとバックの 4 つのサラウンドチャンネルすべてを +1.5 dB にするので、バックのペアに集まった素材は位置による規則より最大 1.5 dB 大きく測られます。クアッド（4 チャンネル）も、2 つのサラウンドを +1.5 dB にします。
- 内部のオーバーサンプラーと True Peak 段はオーバーサンプリング係数として 1〜16 の 2 のべき乗（1, 2, 4, 8, 16）を受け付けます（ライブメーターも同じ係数）。CPU と引き換えにサンプル間ピーク（ISP）の精度を上げます。
- ラウドネス段は「ゲイントリムの後ろに別のリミッターを置いたもの」ではありません。静的ゲインを 1 回かけ、そのゲインでシーリングを超えた分を、段が自前で持つポストゲインの True Peak リミッターに引き戻させます。このゲインは、候補ゲインで信号を測り直して、ゲート後のターゲットに合うように解かれます。ゲインによって絶対ゲートをまたぐブロックがなければ `target - current` に等しく、またぐ場合は、測り直した信号をターゲットに合わせる解が使われます。同じ解法は A/B のラウドネスマッチ、リファレンスマッチ、LUFS ノーマライズ、`maximizer.loudnessOptimize` にも使われ、これらすべての経路が下記の既定値を共有します。そのため、チェーン・単体ヘルパー・名前付きプロセッサのいずれでも同じようにノーマライズされます。
- `loudness.maxLimiterGainReductionDb`（`maximizer.loudnessOptimize` は同じキーを `maxLimiterGainReductionDb` として読みます。有限かつ 0 以上）は、そのリミッターをどこまで駆動してよいかの上限です。静的ゲインがシーリングまでのピークヘッドルームを超えられるのは、最大でこの量までです。決めているのはマスターの最大音量ではなく、どれだけピークの立った入力までノーマライズを試みるかです。許容量が、解かれたターゲットゲイン以上のゲインを与えることはなく、シーリング自体を超えることもありません。

  | 値 | 挙動 |
  |---|---|
  | `12`（既定） | ピークヘッドルームを超えたゲインのうち、最大 12 dB 分をリミッターが引き戻してよい |
  | `0` | ヘッドルームで厳密に頭打ちになり、ピークの立った素材では大きな目標値に届かない |

  ここでいうピークヘッドルームは、入力の True Peak からシーリングまでの距離です（[クリッピングとヘッドルーム](./glossary/concepts/audio-basics.md#クリッピングとヘッドルーム)）。たとえば −18 LUFS で True Peak がすでに −1 dBTP にあるミックスを、シーリング −1 dBTP のまま −14 LUFS へノーマライズする場合、ターゲットが求めるゲインは +4 dB、ヘッドルームは 0 dB です。つまり 4 dB 分のゲインがまるごとシーリングを超え、それをリミッターが引き戻すことになります。これは既定の 12 dB の許容量に収まります。`0` ではゲインが 0 dB で止まり、ミックスは −18 LUFS のままです。

  -16.78 LUFS の 6 秒のキックループをターゲット -14 LUFS、シーリング -1 dBTP で処理すると、`0` では -17.32 LUFS、既定の 12 では -16.14 LUFS に着地します。残る不足分はリミッター自身のゲインリダクションで、1 回で反復しないパスでは測り直されないため、`loudnessTargetLimited` で報告されます。
- `maximizer.truePeakLimiter` はシーリングをサンプル単位で守り、ブロック全体を一括でスケーリングすることはありません。出力ガードは補正で持ち上がり得る過去の位置をすべて再確認するので、短いバーストが True Peak シーリングを超えることはなく、実行中にシーリングを下げると、すでにキューにある出力も再評価されます。`maximizer.truePeakLimiter` と `maximizer.adaptiveRelease` は、既定値でどちらも 129 サンプルのレイテンシを報告します。
- リミッターの出力は、呼び出し側がストリームをどう区切るかに依存しません。内部のすべての段が呼び出しをまたいで状態を持ち越すためで、同じ素材を 1 ブロックで処理しても、256〜16384 サンプルの均等なブロックで処理しても、トランジェントの途中で切れる不揃いな分割で処理しても、結果は同一です。ストリーミングのレンダリングとオフラインのレンダリングは一致します。残るのはサンプル間のわずかな残差で、これはブロックサイズではなく「リミッターより細かく測る」ことに由来する性質です。既定の 4 倍リミッターの出力を 8 倍や 16 倍オーバーサンプリングのメーターで読むと、シーリングをわずかに上回ります。48 kHz でシーリング −1 dBTP の場合、サンプルレートの 4 分の 1 付近の正弦波は 16 倍で −0.95 dBTP、リミッターへ 24 dB 突っ込んだ広帯域ノイズは −0.92 dBTP でした。より細かいメーターで納品物を確認するなら、0.1 dB ほどの余裕を見てください。リミッターと同じオーバーサンプリングで測ればシーリングが正確に守られていることを確認できます。`oversampleFactor` を 8 に上げると、同じ素材でシーリングとの差は 0.01 dB 以内に収まりました。
- UI 向けには `meteringVectorscope(...)` と `meteringPhaseScope(...)` に `maxPoints` を渡します。点列を最大 `maxPoints` 点まで間引くので、点数の多いスコープでも描画コストを抑えられます（`maxPoints` を省くと入力サンプル 1 個につき 1 点を返します。旧来の `meteringVectorscopeDecimated(...)` ／ `meteringPhaseScopeDecimated(...)` は非推奨で、内部で委譲するだけです）。`meteringSpectrumFrame(...)` は、スペクトラムアナライザーのスナップショット向けに単一フレーム（時間平均なし）のスペクトラムを読み取ります。
- `multiband.*` のソロプロセッサ（`compressor`、`dynamicEq`、`expander`、`imager`、`limiter`、`saturation` の全 6 種）は、いずれも同じクロスオーバー機構を共有し、クロスオーバー数を任意に指定できます。固定 3 バンドではなく、素材に合わせたバンド数で分割できます。ソロプロセッサとインサートの入口が公開する `cutoffNHz` スロットは最大 8 個（`cutoff0Hz` 〜 `cutoff7Hz`）なので、`multiband.*` の呼び出し 1 回で最大 9 バンドまで扱えます。マスタリングチェーンはさらに多く、63 個のクロスオーバーと 64 バンドまで指定できます（[チェーン設定 JSON スキーマ](#チェーン設定-json-スキーマ) を参照）。
:::

::: info 歪み系プロセッサのエイリアシング対策
波形を強く整形する 5 つのプロセッサは、スペクトルの折り返しを生みます。これらはいずれも `aliasing` パラメータを取り、その扱い方を選べます。`0` は対策なし、`1` は 1 次の原始関数アンチエイリアシング（ADAA1）、`2` は 2 次（ADAA2）、`3` は 4 倍オーバーサンプリング経路です。

| プロセッサ | 実装しているモード |
|---|---|
| `saturation.hardClipper` | なし、ADAA1、ADAA2、4 倍オーバーサンプリング |
| `saturation.softClipper`、`saturation.waveshaper` | なし、ADAA1、4 倍オーバーサンプリング |
| `spectral.presenceEnhancer` | なし、ADAA1、4 倍オーバーサンプリング |
| `saturation.exciter` | なし、4 倍オーバーサンプリング |

実装していないモードは黙って無視されるのではなく拒否され、メッセージが使えるモードの集合を示します。`soft clipper ADAA2 anti-aliasing is not supported; use None, Adaa1, or Oversample4x` のような形です。この 5 つ以外のプロセッサにこのパラメータを渡した場合は、キー自体が拒否されます。`unknown --params key for saturation.tube: aliasing` となります。

オーバーサンプリング経路はドライ信号の時間を揃え、発生した遅延を報告します。ポリフェーズフィルターを上りと下りで往復するため、基本レートで 48 サンプルの遅延が生じ、4 倍経路ではレイテンシが `48` になります。`なし` と `ADAA1` は `0` です（ADAA1 の半サンプルの遅延は Q8 で管理され、ブレンドのドライ経路はそれに合わせて遅らせます）。`saturation.hardClipper` の ADAA2 は `1` を報告します。この値はプロセッサの結果と一緒に返されます。ブラウザと Node では `masteringProcess()` が返す `MasteringResult` の `latencySamples`、Python では `MasteringResult` の `latency_samples`、C では `SonareMasteringResult` の `latency_samples`、インサートとして組み込んだ場合はプロセッサ自身の `latency_samples()` です。チェーンが報告する他の遅延と同じように補正してください。
:::

::: info クロスオーバーとは？
クロスオーバーは、信号を周波数帯（たとえば低域／中域／高域）に分割し、各帯域を別々に処理できるようにします。「クロスオーバー周波数」は、ある帯域が終わり次の帯域が始まる境界の周波数です。クロスオーバーが多いほど帯域が増え、より細かく制御できます。

スロープ、4 つのクロスオーバーモード、線形位相モードのコストは[クロスオーバー](./glossary/mastering/crossover.md)で説明しています。
:::

## チェーンの順序

フルチェーン（`masterAudio`、`masteringChain`、そしてすべてのプリセット）は、スロットを 1 つの固定順で実行します。repair → eq → dynamics → saturation → spectral → stereo（ステレオ経路のみ）→ maximizer → loudness です。設定が選ぶのはどのスロットを動かすかであって、位置ではありません。図はエンジンが持つすべてのスロットを実行順に並べたもので、`pop` プリセットが有効にするものを塗りつぶしています。空のスロットもその位置にあり、設定で有効にすればそこで動きます。

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

検出から処理までの手順は、[音声リペア](./audio-repair.md)、[ノイズ・ハム除去](./repair-noise.md)、[クリップ・クリック・クラックルのリペア](./repair-transients.md)、[デリバーブ](./repair-reverb.md)で説明しています。

6 つのリペア段は 1 つのスロットを共有し、その順序が結果を左右します。設定がどの部分集合を有効にしても、損傷の大きいものから順に実行され、各段は前の段が整えた後の素材を受け取ります。チェーンはこれらをオフラインで実行しますが、`decrackle`、`dehum`、`denoise`、`dereverb` は因果的なリアルタイムインサートとしても、レジストリ id `repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical` で使えます（[オーディオリペアの流れ](./audio-repair.md#リアルタイムインサート)を参照）。`declick`、`declip`、`repair.trimSilence` は因果的ではなく、オフライン専用です。

1. `declip`：`declick` より前。平坦に潰れた領域にはクリック検出器が測るべきトランジェントがないためです。
2. `declick`
3. `decrackle`
4. `dehum`
5. `denoise`
6. `dereverb`：最後。広帯域のノイズフロアは定常的な残響の後部として読まれ、残響の推定をそちらへ引きずるためです。

::: details `repair.denoise.reductionDb`：フロアではなく深さ
デノイズ段の深さは `repair.denoise.reductionDb` で決めます。ゲインマスクがどのビンにも適用できる最も深い減衰量を dB で表したもので、有限かつ `[0, 120]` の範囲でなければなりません。既定値は `26` です。値を大きくすると深い減衰を許可しますが、ノイズがその量だけ減る保証はありません。26 dB ではマスクのゲインが約 0.0501 より小さくならず、実際の減衰量はノイズと信号の推定に依存します。この下限は急なゲーティングを抑えますが、処理による音の崩れをなくすものではありません。ステレオ形式、リンク形式、`masteringRepairApply` が返すレポート（モノラル呼び出しはサンプルだけを返します）は、このフロアがどれだけ効いたかを示します。`maxReductionDb` が `reductionDb` で飽和していれば深さを決めたのは推定器ではなくフロアであり、`floorLimitedFraction` はフロアに張り付いたマスクセルの割合です。

同じつまみは線形のフロアとしても受け付けます。`repair.denoise.gainFloor` キーは読み込み時に `reductionDb = -20 * log10(gainFloor)` で変換され、変換は元の有効範囲も引き継ぎます。1 を超えるフロアは負の深さになり拒否され、`1e-6` を下回るフロアは 120 dB を超える深さになるため、やはり拒否されます。短縮キーの `repair.reductionDb` と `repair.gainFloor` も同じデノイズスロットへ対応づけられます。フラットな上書き、JSON のチェーン設定ドキュメント、ブラウザと Node のネストした `MasteringChainConfig` 型のいずれも `gainFloor` をこの形で受け付け、TypeScript の型は `reductionDb` を優先するよう非推奨とマークしています。
:::

## ソロプロセッサ

| ファミリー | プロセッサ名 |
|-----------|-------------|
| Dynamics | `dynamics.brickwallLimiter`, `dynamics.compressor`, `dynamics.deesser`, `dynamics.expander`, `dynamics.gate`, `dynamics.limiter`, `dynamics.parallelComp`, `dynamics.sidechainRouter`, `dynamics.duckingProcessor`, `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider` |
| Effects | `effects.acoustic.roomMorph`, `effects.delay.stereo`, `effects.filter.vowel`, `effects.gsEfx`, `effects.modulation.autoWah`, `effects.modulation.chorus`, `effects.modulation.ensemble`, `effects.modulation.flanger`, `effects.modulation.phaser`, `effects.modulation.pitchShifter`, `effects.modulation.ringModulator`, `effects.modulation.rotary`, `effects.modulation.wah`, `effects.reverb.convolution`, `effects.reverb.dattorro`, `effects.reverb.fdn`, `effects.reverb.plate`, `effects.reverb.room`, `effects.reverb.velvet`（FX ビルドのみ。[エフェクトインサート](./effects-inserts.md)を参照） |
| EQ | `eq.apiStyle`, `eq.bandPass`, `eq.cutFilter`, `eq.dynamic`, `eq.equalizer`, `eq.graphic`, `eq.linearPhase`, `eq.midSide`, `eq.minimumPhase`, `eq.parametric`, `eq.pultec`, `eq.shelving`, `eq.tilt` |
| Final | `final.bitDepth`, `final.dither`, `final.outputChain` |
| Maximizer | `maximizer.adaptiveRelease`, `maximizer.loudnessOptimize`, `maximizer.maximizer`, `maximizer.softKneeMax`, `maximizer.truePeakLimiter` |
| Multiband | `multiband.compressor`, `multiband.dynamicEq`, `multiband.expander`, `multiband.imager`, `multiband.limiter`, `multiband.saturation` |
| Repair | `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`, `repair.trimSilence`（`decrackle`、`dehum`、`denoiseClassical`、`dereverbClassical` はリアルタイムインサートとしても使える） |
| Saturation | `saturation.ampSim`, `saturation.bitcrusher`, `saturation.distortion`, `saturation.exciter`, `saturation.hardClipper`, `saturation.multibandExciter`, `saturation.overdrive`, `saturation.softClipper`, `saturation.tape`, `saturation.transformer`, `saturation.tube`, `saturation.waveshaper` |
| Spectral | `spectral.airBand`, `spectral.lowEndFocus`, `spectral.presenceEnhancer`, `spectral.spectralShaper` |
| Stereo | `stereo.autoPan`, `stereo.binaural`, `stereo.haasEnhancer`, `stereo.imager`, `stereo.monoMaker`, `stereo.phaseAlign`, `stereo.stereoBalance` |
| Utility | `utility.gain` |
| Voice | `voice.changer`（[リアルタイムボイスチェンジャー](./realtime-voice-changer.md)を参照） |

::: warning ステレオ系プロセッサは入口が異なります
ほとんどのプロセッサは単一配列を取る `masteringProcess()`（モノラル、またはインターリーブ）で処理します。一方、ステレオ系プロセッサ（`stereo.imager`、`stereo.monoMaker`、`stereo.autoPan`、`stereo.binaural`、`stereo.haasEnhancer`、`stereo.phaseAlign`、`stereo.stereoBalance`）は左右チャンネルを別々に扱うため、`left` と `right` の 2 配列を取る専用の入口 `masteringProcessStereo()` / `mastering_process_stereo()` から呼び出します。`stereo.monoMaker` は `frequencyHz` をクロスオーバー周波数として使い、それより低い帯域をモノラルへ寄せます。寄せる強さは `amount` で決めます。`eq.midSide` と `multiband.*` も同様です。これらを `masteringProcess()` に渡してもチャンネルを独立して表現できません。正確なシグネチャは [呼び出し方](#呼び出し方) を参照してください。
:::

::: details ディザーとは？
ビット深度を下げる（たとえば CD／配信向けに 24bit から 16bit へ）と、各サンプルを最も近い段階に丸めたときの誤差が信号に連動して残り、静かな余韻やフェードでざらついた歪みとして聞こえます。ディザーは丸める前に微小なランダムノイズを加え、誤差が信号に連動しないようにします。歪みは、一定のごく小さなヒスに置き換わります。`final.dither` の既定は TPDF（三角分布）ディザーで、誤差の平均と大きさのどちらも信号に左右されなくなる標準的な方式です。RPDF（矩形分布）と、ヒスを耳の感度が低い帯域へ寄せるノイズシェーピングも選べます。最終のビット深度削減のときに、最後に 1 回だけ適用します。
:::

::: warning リペアは設計上クラシカル DSP
`repair.denoiseClassical`・`repair.dereverbClassical` などは、明示的なノイズ推定を伴うスペクトル減算／MMSE-STSA／LogMMSE を使います。

DNN 音源分離やニューラルなスペクトルリペア**ではありません**。

- 向く用途: ノイズ、ハム、クリック、クリップ、軽い部屋鳴りの整理。
- 向かない用途: 完成トラックの分離、失われた音源の再構成。
- 設計上の理由: リペア経路を決定的で外部依存なしに保つためです。
:::

<SonareDemo id="repair-denoise" />

::: tip レジストリ名とチェーンキーは異なります
名前付きプロセッサレジストリでは、単発のリペアプロセッサ名は `repair.denoiseClassical` と `repair.dereverbClassical` です。

フルチェーン設定では、短い段キーの `repair.denoise.*` と `repair.dereverb.*` を使います。これらは `MasteringChainConfig` 内のリペアスロットを指します。

どちらの名前も、同じクラシカルなデノイズ／デリバーブ実装を呼び出します。
:::

::: details クラシカルなデノイズ：スペクトル減算と MMSE ゲイン
いずれもクラシカルなデノイズ手法です。どれも短時間スペクトルのフレーム単位で動き、まず周波数ビンごとのノイズを推定する必要があります。

1. **ノイズ推定**：`quantile` 推定器（オフラインの既定）は、最も静かな 10% のフレームを平均して固定のノイズスペクトルをひとつ作ります。`mcra`・`imcra`・`spp` はフレームごとにノイズを追跡するので、変化するノイズフロアにも追従でき、ストリームでも動きます。リアルタイムインサートとリペアの推奨設定が使うのは `spp` です。
2. **スペクトル減算**は、推定したノイズのパワーを各フレームから差し引きます。過減算係数と下限を伴います。
3. **MMSE-STSA** と **LogMMSE**（既定）は何も差し引きません。ビンごとに推定した信号対雑音比から、下限と 1 のあいだのゲインを求め、そのビンに掛けます。

このとき使う信号対雑音比はフレーム間で平滑化されます（決定指向型の推定、`ddAlpha`）。単純な減算で残りがちな「ミュージカルノイズ」のようなざらつきを抑えるのは、この平滑化です。どの手法も楽器を分離するものではなく、ノイズを減衰させるだけです。
:::

::: details `saturation.overdrive` と `saturation.distortion` とは？
この 2 つはリアルタイムで安全に変更できるマルチチャンネルプロセッサで、ドライブペダルをモデル化します。ミキサーやリアルタイムのインサートとしても使えます。capability catalog が返す構築時の値域と既定値は次のとおりです。

| プロセッサ | パラメータ | 受理範囲 | 既定値 | 単位 |
|---|---|---|---|---|
| `saturation.overdrive` | `gainDb` | `0`〜`41` | `20` | dB |
|  | `toneHz` | `500`〜`8000` | `3000` | Hz |
|  | `levelDb` | カタログ上の最小値なし、最大値 `770.636` | `0` | dB |
| `saturation.distortion` | `gainDb` | `0`〜`60` | `30` | dB |
|  | `toneHz` | `475`〜`20000` | `4000` | Hz |
|  | `levelDb` | カタログ上の最小値なし、最大値 `770.636` | `0` | dB |

どちらもカタログ上のレイテンシは `48` samples で、48 kHz でのテールは overdrive が 10,513 samples、distortion が 15,793 samples です。3 つのパラメータはすべてリアルタイムオートメーションの対象です。`levelDb` の最大値は有限ゲインの受理上限であり、推奨する操作範囲ではありません。
:::

::: details `saturation.ampSim` とは？
ギター／ベースアンプ系の色付け段で、プリアンプドライブ → トーンスタック → パワーアンプ → キャビネットの構成です。オーバーサンプリングした双三極管のドライブ段を 1 つの `[0, 1]` ドライブノブで操作し、ドライブ量に応じてプリエンファシスのシェルフが変化するため、ドライブを上げるほど歪みの質感が変わります。ドライブの後にはバス／ミッド／トレブルのトーンスタックが続き、その後に任意のパワーアンプ段とデータ不要のキャビネット特性が入ります。ライブオートメーション対象は `drive`（0-1）、`bassDb`、`midDb`、`trebleDb`、`presenceDb`、`levelDb`、`power`、`sag`、`transformer`、`nfb`、`micAxis`、`micBAxis`、`micBlend`、`cone`、`crossover`、`biasShift`、`inputDb` で、全バインディングの `set_parameter` から自動化できます。`power` は class-AB プッシュプルのソフトサチュレーション、`sag` は強い入力後の電源電圧低下と膨らみ、`transformer` は低域の出力トランス飽和、`nfb` は有効なパワーアンプ段を囲むネガティブフィードバックを加えます。`cab`（ブール値）と `cabModel` もライブ対象です。`cabModel` は `0` = ギター 4x12 スタック、`1` = ベース 8x10 スタック、`2` = 1x12 コンボ、`3` = 2x12 オープンバックです。`ampModel` は構築時に指定する選択肢で、`0` = クランチ、`1` = 明るいクリーン、`2` = モダンなハイゲイン、`3` = 低ゲインで入力に応じて歪みが増すタイプ、`4` = 高域が持ち上がるチャイム系クリーン、`5` = 重いハイゲインです。

キャビネットとマイク関連のキーも `masteringInsertParamInfo('saturation.ampSim')` に含まれ、id は nullable です。大半は構築時専用（`id: null`、`rtSafe: false`）で、`ampModel`、`micModel`、`micBModel`、`micBInvert`、`powerTube`、`topology`、`preampStages`、`doppler`、マイク距離が該当します。`micAxis`、`micBAxis`、`micBlend`、`cone` にはライブオートメーション用の id があり、`crossover`、`biasShift`、`inputDb`、`cab`、`cabModel` も同様です。キャビネットやマイクのコントロールを prepare 後に変更できるかどうかは、各記述子を読んで判断してください。

| キー | 意味 |
|------|------|
| `preset` | 名前付きのアンプリグ。数値キーより先に解決される |
| `cabIrF32Base64` | 収録済みのキャビネットインパルス応答。32 ビット浮動小数サンプルを base64 で渡す |
| `cabIrSampleRate` | その IR を収録したサンプルレート。`0` はプロセッサのレートと同じであることを表す |
| `cabIrGenerate` | 解析的なキャビネット特性の代わりに、`cabModel` からインパルス応答を合成する |
| `cabIrDrivers` | 合成したインパルス応答にキャビネットの他のドライバーを合算するか |
| `micModel`、`micAxis`、`micDistanceCm`、`micBlend` | 1 本目のマイク。種類（`0` なし、`1` ダイナミック、`2` リボン、`3` コンデンサ）、軸上位置、距離、ブレンド量 |
| `micBModel`、`micBAxis`、`micBDistanceCm`、`micBInvert` | ペアの 2 本目のマイク。極性反転を含む |
| `ampModel`、`powerTube`、`topology`、`presetIndex`、`preampStages` | そのほかの構築時の選択。アンプの音色、パワー管の種類、`topology`（`voiced` または `circuit`）、プリアンプの段数、プリセット番号 |
| `cone`、`doppler` | コーン分割振動とコーン運動によるドップラー。`doppler` は報告されるレイテンシを変える |

2 本目のマイクの経路差による遅延は揃えられてレイテンシに計上されるため、レイテンシ（ドップラーなしの 48 kHz で 48 samples）は `micBlend` やパワー段の設定では動きません。
:::

::: warning オフラインレンダリングでは `saturation.ampSim` のテールを出し切る
このプロセッサが報告するテールには、2 本目のマイクの経路差による遅延だけでなくキャビネットインパルス応答が含まれます。既定のリグは 48 kHz で 8,939 samples のテールを報告する（合成したキャビネット応答では 4,419、`cab: false` では 2,500）ため、最後の入力サンプルで出力の取り出しをやめるオフラインバウンスは、その分のキャビネットの減衰を失います。レンダリング結果がわずかに早く終わり、わずかにドライになるだけで、何の兆候も出ません。報告されたテールを出し切るまで出力を読み続けてください。
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

ペアプロセッサとペア解析は、リファレンスを独自のレートのまま `referenceSampleRate`（Python は `reference_sample_rate`）で受け取れます。`EqMatchOptions` と `StreamingEqualizer.match` も同様です。リファレンスはソースのレートへリサンプルされ、遅延推定はソースのレートのサンプル数で返ります。リクエストの形は [独自のサンプルレートのリファレンス](./js-api-mastering.md#独自のサンプルレートのリファレンス) にあります。両 CLI の `mastering-pair-analyze` と `mastering-pair-processor` は、任意のレートのリファレンスファイルを読み込みます。

ステレオペアの入口 `masteringPairProcessStereo()` が受け付けるプロセッサ名は `match.abCrossfade` だけです。各ソースペアの左右、各リファレンスペアの左右は同じ長さでなければなりませんが、ソースペアとリファレンスペアの長さは異なっていても構いません。`masteringAbMatchLoudnessStereo()` はリクエストオブジェクトを受け取り、ステレオプログラムに対して 1 つのゲインを計測して左右へ共有し、シーリングによるクランプなしで `left` と `right` の結果を返します。

これらは `masteringPairAnalyze(...)` / `masteringStereoAnalyze(...)` に渡すレジストリ名です。レジストリとは別に、アシスタント系ヘルパーにも左右のペアを直接受け取るステレオ版があります。`masteringAudioProfileStereo`、`masteringAssistantSuggestStereo`、`masteringStreamingPreviewStereo` の 3 つです。ダウンミックスをプロファイルすると無相関素材では積分ラウドネスを約 6 dB 過小に読むため、これらを使ってください。詳細は[ステレオ素材](./mastering-assistant.md#ステレオ素材)を参照してください。

::: details 「トーナルバランス」と「モノラル互換性」は何を測る？
- **トーナルバランス**（`match.tonalBalance`）は、トラックのエネルギーが各周波数帯（サブ・低域・中域・プレゼンス・エア）にどう分布しているかを表します。リファレンス曲と比べると、自分の音がどこで暗い／明るいかが分かり、`match.applyMatchEq` がそれを補正します。
- **モノラル互換性**（`stereo.monoCompatCheck`）は、ステレオミックスをモノラルに合算したときに何が起きるかを予測します。スマホのスピーカー、クラブの PA、一部の放送経路では、この確認が重要です。

左右が逆相だと、合算時に打ち消し合ってレベルが失われることがあります。このチェックはそのリスクを事前に知らせます。詳しくは [モノラル互換性](./glossary/concepts/mono-compatibility.md) を参照してください。
:::

::: warning マッチカーブは周波数範囲の内側でしか定義されない
`match.applyMatchEq` と `match.matchEqCurve` 解析は、`[minFrequencyHz, maxFrequencyHz]`（既定では 40 Hz〜18 kHz）の範囲で補正をフィットします。使えるバンド数は最大 `maxBands`（既定 8）、1 バンドあたりの補正量は最大 `maxGainDb`（既定 12）です。この区間の外は一切マッチングされません。

カーブの実現方法は 2 通りありますが、どちらもその点で一致するため、相互に置き換えられます。パラメトリック側は範囲外にバンドを置きません。FIR 側は両端から 1 オクターブかけてゲインをユニティへ戻し、高域側はナイキストが 1 オクターブより近い場合に幅を詰めて、ナイキスト周波数でちょうど重みがゼロになるようにします。

このテーパーは見た目を整えるための平滑化ではなく、本質的な部分です。フィットしたゲインを DC までそのまま延長すると、低域の厚いリファレンスに対して痩せたソースをマッチさせた場合、下限より下で `maxGainDb` いっぱいまで持ち上がります。広帯域のオフセットと超低域のエネルギーが乗り、以降の全段のヘッドルームを食う一方で、同じマッチのパラメトリック実現はその帯域に手を付けません。超低域までマッチさせたい場合は `minFrequencyHz` を下げてください。既定のフィットがそこまで届くことを期待しないでください。
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

クリエイティブ FX インサートのカタログ（リバーブ、モジュレーション、ディレイ、GS のインサート ID、それぞれのパラメータ表、`masteringInsertNames()` の検出 API、`SONARE_HAVE_FX` / `BUILD_ACOUSTIC_SIM` によるビルド有効化）は、独立したページにあります。[エフェクトインサート](./effects-inserts.md) を参照してください。単体でも使える `effects.gsEfx` は `BUILD_FX` で有効になり、GS タイプと raw バイトのオプションも同ページで説明しています。

## 呼び出し方

単体・ペア・クリエイティブインサートのプロセッサを、現在のビルドに合わせた 1 つのピッカーへまとめる場合は `capabilityCatalog()` / `capability_catalog()` を使います。各プロセッサのパラメータ記述子（名前・nullable な id・型・`unit`・リアルタイム安全性、`min` / `max` / nullable な `default`、`scale`、表示範囲、兄弟キーとの `dependsOn`、連動する兄弟の `coupledWith`、`choices`、スロット所属）と、プロセッサの `slots` メタデータ、フラットなチェーンキーを記述する `chain` セクション（[チェーンキーの記述](#チェーンキーの記述)を参照）、組み込みプリセット一覧（`presets.playbackRoom` は常に存在し、再生機能がビルドされていなければ空）、マスタリングプリセットのメタデータも取得できます。`masteringProcessorCatalog()` は、マスタリング専用ピッカー向けの、より狭いレジストリ分類です。

### カタログの値域の読み方

記述子は同じ 18 個のフィールド（`name`、`id`、`rtSafe`、`type`、`min`、`max`、`minExclusive`、`maxExclusive`、`maxRelativeTo`、`default`、`unit`、`scale`、`uiMin`、`uiMax`、`dependsOn`、`coupledWith`、`choices`、`slot`。[パラメータ記述子](./effects-inserts.md#パラメータ記述子)を参照）をすべて持つため、本ページのプロセッサ別の表を書き写さなくても、カタログから直接コントロールの範囲を決められます。構築時専用キーは `id: null` かつ `rtSafe: false` で、id 付きでも `rtSafe: false` ならライブオートメーションには使えません。フォールバックがない場合は `default` も `null` です。`choices` は間隔のある離散値も含む名前付き数値の閉じた集合を、`slot` はキーが属するスロット群を表します。スロットの存在はプロセッサの `slots` メタデータにある `activation`、`parent`、`minCrossoverCutoffs` で決まります。`null` の値域はデータの欠落ではなく、その側に既知の制限がないことを表します。

値の出どころはフィールドごとに異なり、ホストがどこまで信頼できるかもそれで決まります。

| フィールド | 出どころ | 読み方 |
|---|---|---|
| `default` | プロセッサの設定構造体そのもののフィールド初期化子。各ビルダーがそこへフォールバックする際に記録される | 初期化子を変更したフィールドが、カタログに古い値を残したままになることはない。 |
| `min`、`max`、`minExclusive`、`maxExclusive` | 実測。候補値が呼び出し側と同じ構築経路を通り、カタログにはバリデーションが受理した区間が内側へ丸められて載る | 各境界は、ほかのキーを既定値にして測られる。 |
| `coupledWith` | 実測。`dependsOn` 以外でキーの受理範囲を動かす兄弟（ルームリバーブの `receiverSpacingM` は、部屋の大きさと配置に連動する） | こうしたキーのコントロールは、連動先が変わったときに境界を読み直す。 |
| `unit`、`scale`、`uiMin`、`uiMax`、`dependsOn` | ライブラリが宣言する。`dependsOn` の各項目は `this <relation> factor * sibling` と読む | 対数軸のパラメータでは `uiMin ?? min` が正、`uiMax ?? max` が有限（表示範囲の端が `null` なら、受理範囲の端をそのまま使える）。`dependsOn` の項目を兄弟の既定値で言い直しただけの境界は `null` のままにして、依存関係側に任せる。 |

すべての `repair.*` エントリも同じ方法で設定を公開します（その段自身の検証を通して測定）。これらの行は、4 つのリアルタイムリペアインサートでも、オートメーション `id` を持たず、`rtSafe` にもなりません。`denoiseClassical` と `dereverbClassical` は `nFft` を `choices`（4 から 524288 までの 2 のべき乗）、`hopLength` を 1 以上の任意の整数として公開し、`dependsOn` で `nFft` の半分以下と宣言します。`masteringInsertParamInfo` は、オフラインのリペア段を含むすべてのカタログ id に答えます。

::: warning 値域は推奨レンジではなく受理条件
`min` と `max` はプロセッサが**受け付ける**範囲を表します。コントロールを動かすうえで音楽的に妥当なレンジではありません。区間内の値でも不適切な設定はあり得ますし、区間外の値はクランプされずに拒否されます。
:::

値域が宣言ではなく実測であることから、ホスト側で考慮すべき性質が 3 つあります。

- **各値域は他のパラメータを既定値に置いたまま測定されます**。そのため互いを制約し合う 2 つのコントロールは、それぞれ**相手の既定値**を自分の限界として報告します。`maximizer.adaptiveRelease` が `minReleaseMs` の上限を 250、`maxReleaseMs` の下限を 20 として公開するのはこのためで、これらは相手側の既定値であり、ペア全体としての限界ではありません。
- **サンプルレート由来の値域は、レートを渡すまで印が付くだけで解決されません**。レートがなければ、EQ の `band*.frequencyHz` の上限はいずれも `maxRelativeTo: 'nyquist'` 付きで 24000 と読めます。`masteringInsertParamInfo(name, sampleRate)` を使うと、上限はそのレートのナイキスト周波数に解決されます。`eq.parametric` は 22050 Hz で 11025、44100 Hz で 22050、192 kHz で 96000 を返します。レートが分かっている状態で構築した EQ（単発処理、エンジンやミキサーのストリップ）は、同じ上限までのバンド周波数を受け付け、拒否時のメッセージに上限が示されます（`EQ band frequency must be below 48000 Hz (Nyquist at 96000 Hz)`）。レートなしで構築した場合は 24000 Hz のままです。
- **開区間の境界は、除外される値そのものとして報告されます**。`dynamics.compressor` は `sidechainHpfHz` の `min` を 0 として公開しますが、0 は拒否し、`minExclusive` / `maxExclusive` がそれを示します。

フラットなパラメータ集合の大半を占めるのがバンド単位の EQ です。`eq.parametric`、`eq.midSide`、`multiband.dynamicEq` は、構築用キーも含め、インデックス付きの `band*` フィールドすべてについて記述子を公開します。公開されたからといって**読み取られる**キーが増えるわけではなく、不完全に指定したバンドの残りのキーは、これまでどおり無視されたものとして報告されます。

::: code-group

```typescript [ブラウザ]
const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();   // 実行時にソロプロセッサ id を取得
masteringProcessorCatalog(); // ピッカー／フィルタ用にプロセッサを分類
masteringInsertParamInfo('eq.parametric', sampleRate); // 構築用／オートメーション用メタデータ（ナイキスト上限をこのレートで解決）
masteringInsertTiming('eq.parametric', { 'band0.frequencyHz': 1000 }, sampleRate);
masteringPresetParams('pop'); // masterAudio 用のフラットな上書き値

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});

const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });

// 解析は JSON 文字列を返すので、パースする
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono   = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```typescript [Node]
import {
  capabilityCatalog,
  masteringInsertParamInfo,
  masteringInsertTiming,
  masteringPairAnalyze,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorCatalog,
  masteringProcessorNames,
  masteringPresetParams,
  masteringStereoAnalyze,
} from '@libraz/libsonare-native';

const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();
masteringProcessorCatalog();
masteringInsertParamInfo('eq.parametric');
masteringInsertTiming('eq.parametric', { 'band0.frequencyHz': 1000 }, sampleRate);
masteringPresetParams('pop');

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
sonare.mastering_insert_param_info('eq.parametric')
sonare.mastering_insert_timing('eq.parametric', {'band0.frequencyHz': 1000}, sr)
sonare.mastering_preset_params('pop')

out = sonare.mastering_process('dynamics.compressor', samples, sample_rate=sr, params={
    'thresholdDb': -24,
    'ratio': 1.5,
})

stereo = sonare.mastering_process_stereo('stereo.imager', left, right, sample_rate=sr, params={'width': 1.1})

# 解析は JSON 文字列を返すので、パースする
report = json.loads(sonare.mastering_pair_analyze('match.referenceLoudness', source, reference, sample_rate=sr))
mono   = json.loads(sonare.mastering_stereo_analyze('stereo.monoCompatCheck', left, right, sample_rate=sr))
```

```bash [CLI]
# 現在のビルドと機能カタログの概要を確認
sonare doctor --json

# ソロプロセッサ id を取得
sonare mastering-processors

# CLI はプリセットの一覧と適用を提供しますが、タイミングとフラットな
# プリセットパラメータの問い合わせは API 専用です。
sonare mastering-presets

# ソロプロセッサを 1 つ適用（--params は k=v,k=v。数値、または列挙キーの choices 名）
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

ネイティブ C の呼び出し側は、同じフラットな JSON パラメータマップとサンプルレートを `sonare_mastering_insert_timing` に渡して問い合わせます。名前付きプリセットの展開には `sonare_mastering_preset_params_json` を使い、`{"version":1,"params":{...}}` を受け取ったら C ABI の文字列解放関数で解放します。`sonare_capability_catalog_json` には `masteringPresets` のメタデータも含まれます。CLI はプリセット名の一覧と適用を提供しますが、タイミングやパラメータマップの問い合わせは提供しません。

:::: details チェーンの入口で設定スタイルが異なる
レジストリは文字列ベースなので、C・Python・Node・WASM・CLI が同じプロセッサ識別子を共有できます。

単一プロセッサではなく*チェーン*を組むときは、入口ごとに設定スタイルが変わります。

| 入口 | 設定スタイル |
|------|--------------|
| WASM `masteringChain(...)` | ネストした設定オブジェクト。同じオブジェクト内でドット記法のリーフキーも受け付けます |
| `masterAudio(...)` と Python/Node 相当 | `'loudness.targetLufs'` のようなフラットなドット記法 |
| [マスタリングアシスタント](./mastering-assistant.md) の `chainConfig.params` | `masterAudio` にそのまま渡せるフラット形式。`params["dynamics.multibandComp"]` には、任意バンド数のネストされた v2 オブジェクトが入ることもあります。[チェーン設定 JSON スキーマ](#チェーン設定-json-スキーマ) を参照してください |

`MasteringChainConfig` は両方の書き方を受け付けます。`'loudness.targetLufs': -20` のようなドット記法のリーフキーは、ネストした `loudness: { targetLufs: -20 }` と並べても置き換えても構いません。コアがキーを検証し、未知のキーは拒否します。ドット記法は C ABI がパラメータを運ぶ形式でもあるため、上書き値を手で書き下すのではなく動的に組み立てる場面では、こちらが扱いやすい形になります。

正準（canonical）な書き方はネスト形式です。手で書くコードではネスト形式を選んでください。TypeScript はネストした設定をフィールド単位で型検査できますが、ドット記法のキーは実行時にしか検査されません。

repair のチェーンキーは、単発プロセッサのレジストリ名ではなくチェーン内のスロットに合わせます。フラットな上書きでは `repair.denoise.*` / `repair.dereverb.*`、`masteringChain(...)` のネスト形式では `repair: { denoise: ..., dereverb: ... }` を使ってください。

列挙型のチェーンキーは、数値と並んで `choices` の名前でも指定できます。`repair.denoise.mode`、`repair.denoise.noiseEstimator`、`repair.decrackle.mode`、`repair.dehum.mode`、`dynamics.compressor.detector`、マルチバンドのスロープ・モード・バンドごとのディテクターのキーが対象です。`masteringProcess`、`masteringProcessStereo`、`masteringInsertTiming` の params と、両 CLI の `--params`・`--chain-config` も同様です。未知の名前は、キーと有効な名前を示して拒否されます。`repair.decrackle.mode` が受け付けるのは 0（メディアン）または 1（ウェーブレット縮小）だけです。ミキサーシーンの `params` には、選択肢の名前ではなく数値（`choices[].value`）を書きます。
::::

## チェーン設定 JSON スキーマ

フラットな `chainConfig.params` マップ（上の表にある `chainConfig.params` の形、`masterAudio` の上書きが受け付ける形）には、CLI と[マスタリングアシスタント](./mastering-assistant.md)が使う JSON ドキュメント表現があります。`sonare mastering --config <file>` はこれを読み込み、`masteringAssistantSuggest` の `chainConfig` もこの形式で表現されます。このシリアライズは 2 つのスキーマバージョンを自動的に選びます。

::: details バージョン 1 と バージョン 2
- **バージョン 1**：フラットで固定 **3 バンド**の low/mid/high マルチバンドコンプレッサー形式です。`dynamics.multibandComp.lowCutoffHz`、`.highCutoffHz`、およびバンドごとの `lowThresholdDb`／`midThresholdDb`／`highThresholdDb` と、それぞれに対応するレシオ／アタック／リリースのキーを使います。フラット上書き系の入口はすべてこの形で送り、マスタリングアシスタントも、同梱プリセットのマルチバンド段が既定の 3 バンド形状なので、この形で出力します。
- **バージョン 2**：マルチバンドコンプレッサーの設定が固定 3 バンド形状で表現できなくなった時点（クロスオーバーのカットオフ数が違う、クロスオーバーのスロープ／モードが既定と異なる、FIR カーネルサイズが既定と異なる、など）で自動的に選ばれます。この場合、`params["dynamics.multibandComp"]` はフラットな `low`／`mid`／`high` キーではなく、構造化されたオブジェクトになります。
  - `crossover.cutoffsHz[]`、`crossover.slope`、`crossover.mode`、`crossover.firKernelSize`
  - `bands[]`：最大 **64 バンド**、各バンドに `thresholdDb`、`ratio`、`attackMs`、`releaseMs`、`kneeDb`、`makeupGainDb`、`autoMakeup`、`detector`、`sidechainHpfEnabled`、`sidechainHpfHz`、`pdrTimeMs`、`pdrReleaseScale`

  フィールド検証は厳格です。バージョン 2 の `dynamics.multibandComp` オブジェクト内で未知のキーがあれば拒否され、バンド数はカットオフ数 + 1 と一致していなければなりません。
:::

この構造化形式は JSON ドキュメントに限らず、すべてのチェーン呼び出しから使えます。Node と WASM の `MasteringChainConfig`、および Python の設定 dict では、`dynamics.multibandComp` が `crossover`（`cutoffsHz`、`slope`、`mode`、`firKernelSize`）と `bands`（`MultibandCompressorBand`）を受け付けます。フラットキーの `dynamics.multibandComp.crossover.cutoffsHz.<i>` と `dynamics.multibandComp.bands.<i>.<field>` も、その場で指定する `cutoff<i>Hz` / `band<i>.<field>` や low/mid/high の省略形と並べて使えます。`cutoffsHz` はカットオフ一覧を置き換え、バンド数を要素数 + 1 に決めます。キーの順序は問いません。同じフィールドを 1 回の呼び出しで 2 通りの綴りで指定すると拒否されるため、`cutoffsHz` を `lowCutoffHz` / `highCutoffHz` と併用しないでください。

```typescript
masteringChain(samples, sampleRate, {
  dynamics: {
    multibandComp: {
      crossover: { cutoffsHz: [200, 2000, 8000], slope: 'lr4', mode: 'linkwitzRiley' },
      bands: [{ thresholdDb: -24 }, { ratio: 3 }, {}, { detector: 'peak' }],
    },
  },
})
```

バンド数はどの入口でも、また両 CLI でも 2 から 64 として検査されます。1 バンドの段は拒否され（`multiband stage needs at least two bands; one band is the compressor stage`）、構造が不正なマルチバンドの段は、無効にしてあっても拒否されます。プリセットとアシスタントのチェーンパラメータは、バージョン 2 のマルチバンドの段をフラットキーで返します。

### チェーンキーの記述

`capabilityCatalog().chain`（`CapabilityCatalogChain`）は、`processors` がプロセッサのパラメータを記述するのと同じ形で、フラットなチェーンキーを記述します。

| フィールド | 内容 |
|-----------|------|
| `stages` | 各段のキー `prefix`、`<prefix>.<leaf>` キーがそのパラメータにあたるカタログの `processor`（全キーがチェーン専用なら `null`）、`enabledKey` |
| `lists` | インデックス付きの一覧 `dynamics.multibandComp.crossover.cutoffsHz`（1〜63 項目）と `dynamics.multibandComp.bands`（2〜64 項目、各項目は `dynamics.compressor` のフィールド）。`minItems` / `maxItems` を持つ |
| `params` | どのプロセッサも持たないキーの記述子。`enabled` スイッチ、`loudness.*`、`repair.denoise.gainFloor`、クロスオーバーの FIR カーネルサイズとカットオフ一覧が対象で、値域はチェーン自身のバリデーターを通して実測 |
| `aliases` | 正準キーの別の綴り。`<i>` は一覧のインデックスを表す |

チェーンの列挙名は、すべての段のキーで解決されます。

`catalog.chain` から段のパネルを組み立てる手順は、[パラメータ記述子からコントロールを組み立てる](./use-cases/parameter-controls.md)で通して説明しています。

## 関連

- [マスタリングアシスタント](./mastering-assistant.md)：profile/suggest/preview の JSON と提案→レンダリング経路
- [マスタリング実装](./mastering-implementation.md)：ブラウザデモでレンダリングするチェーン
- [DSP 実装解説](./dsp-implementation.md)：各ファミリーの挙動
- [ミキシングエンジン](./mixing.md)：これらをチャンネルストリップ／バスのインサートとして読み込む
