---
title: エフェクトインサート
description: libsonare のミキシング／リアルタイムエンジン向けクリエイティブ FX インサートのカタログ。リバーブ、モジュレーション、ディレイの各インサートとパラメータ表、ビルドフラグによる有効化条件を、名前付きマスタリングプロセッサレジストリとは分けて掲載します。
---

# エフェクトインサート

**エフェクトインサート**は、ミキサーのチャンネルストリップやバスのスロット（およびリアルタイムエンジンのインサート）に読み込むクリエイティブ FX プロセッサです。リバーブ、モジュレーション、ディレイが該当します。これらは [ミキシングエンジン](./mixing.md) がチャンネルストリップのインサートに使うものと同じインサートファクトリで構築します。

::: info インサートはマスタリングプロセッサではありません
このページが扱うのは**ミキサー／エンジンのインサート**です。名前付き [マスタリングプロセッサ](./mastering-processors.md) レジストリ — コンプレッサー、EQ、サチュレーション、ステレオ、リペア、ラウドネス／マキシマイザー段 — は別の範囲を持つ別トピックです。両者が重なるのは、一部の FX インサートが単発のマスタリングプロセッサ*としても*公開されている箇所だけです（後述）。マスタリングレジストリを探しているなら、そちらのページから始めてください。
:::

インサートはチャンネルの経路の中に入るので、その出力はフェーダーもセンドもバスも含めた下流すべてが見ることになります。この位置こそがインサートとセンドの違いであり、下のカタログを読む前に押さえておきたい点です。

<SonareDemo id="pre-post-fader" />

## インサート集合を調べる

ミキサーシーンのインサートはマスタリングインサートと同じファクトリを使いますが、有効なインサート集合は `masteringProcessorNames()` より少し広いです。何が使えてどう設定するかは、次の 4 つの実行時 API で把握できます。

| API | 返すもの |
|-----|----------|
| `masteringInsertNames()` | 有効なインサート id の全リスト |
| `masteringInsertParamNames(name)` | 1 つのインサートが受け付ける構築用キー（バンド／サブバンド型はインデックス付きの `band{i}.*` キーを列挙し、未知の名前には空配列を返す） |
| `masteringInsertParamInfo(name)` | リアルタイムオートメーション可能なパラメータごとの完全な記述子。[パラメータ記述子](#パラメータ記述子)を参照 |
| `masteringProcessorCatalog()` | `kind`、`realtimeInsertable`、`stereoOnly`、`latencySamples`、`tailSamples`、`channelPolicy` を持つ機械処理しやすいエントリ。代表的な既定構成（48 kHz／512 サンプル）のプローブでレイテンシと可聴な減衰テールを返し（オフライン専用はどちらも 0）、構成依存の正確なレイテンシは実際のプロセッサへ問い合わせます。プロセッサ ID をハードコードせず能力で絞り込めます。 |

Python の対応関数は `mastering_insert_param_names(name)`、`mastering_insert_param_info(name)`、`mastering_processor_catalog()` です。

一覧外のキーはプロセッサに無視され、そのキーを含むシーンを読み込むと [`Mixer.sceneWarnings()`](./mixing-scene-json.md) が報告します。

### パラメータ記述子

`masteringInsertParamInfo(name)` は、リアルタイムオートメーション可能なパラメータごとに記述子を 1 つ返します。記述子は次の 8 フィールドをすべて持ち、省略可能なフィールドはありません。

| フィールド | 型 | 意味 |
|------------|----|------|
| `name` | `string` | シーンインサートの params で使う JSON キー |
| `id` | `number` | リアルタイムオートメーションや MIDI CC 紐付けに使う整数のパラメータ id |
| `rtSafe` | `boolean` | インサート稼働中にオーディオスレッドから値を変更できるか |
| `type` | `'number'` \| `'boolean'` | 設定ビルダーがそのキーをどの型として読むか |
| `min` | `number` \| `null` | 受理される最小値。カタログが制限を把握していない場合は `null` |
| `max` | `number` \| `null` | 受理される最大値。カタログが制限を把握していない場合は `null` |
| `default` | `number` \| `boolean` \| `null` | キーを省略したときに使われる値 |
| `unit` | `string` \| `null` | 物理単位（`dB`、`Hz`、`ms`、`samples`）。無次元のパラメータは `null` |

`unit` は省略可能フィールドではなく `string | null` です。無次元のパラメータはキーを省くのではなく `null` を返すため、ホストは存在チェックなしにすべての記述子から 8 フィールドを読めます。`min` / `max` / `default` は `capabilityCatalog()` に載る値と同じで、その出どころとどこまで信頼できるかは[カタログの値域の読み方](./mastering-processors.md#カタログの値域の読み方)で説明しています。

::: info 記述子の一覧は構築用キーの一覧より狭い
`masteringInsertParamNames(name)` はインサートが構築時に受け付けるキーをすべて列挙します。`masteringInsertParamInfo(name)` が扱うのは、その後オートメーションできるサブセットだけです。そのため、インサート構築時に決めるしかないキー — トポロジーの選択、渡すインパルス応答、その IR を収録したサンプリングレート — には記述子がありません。差が最も大きいのは `saturation.ampSim` で、キャビネットとマイク関連のキーはほとんどが構築時専用です。ピッカーはパラメータ名から、オートメーション面は記述子から組んでください。両者は同じ一覧ではありません。
:::

## クリエイティブ FX インサートのカタログ

マスタリングの[ソロプロセッサ](./mastering-processors.md#ソロプロセッサ)に加え、クリエイティブ FX 有効ビルドではリバーブ、モジュレーション、ディレイのインサート ID も使えます。

| Insert ID | 意味 |
|-----------|------|
| `effects.reverb.plate` | Dattorro 系プレートリバーブのエイリアス |
| `effects.reverb.dattorro` | Dattorro リバーブ |
| `effects.reverb.fdn` | フィードバックディレイネットワークリバーブ |
| `effects.reverb.velvet` | Velvet-noise 系リバーブ |
| `effects.reverb.convolution` | Convolution リバーブ。ネイティブ insert 作成経路ではインパルス応答（IR。実際の空間が短い衝撃音にどう応答するかを記録したもの）を使えます |
| `effects.reverb.room` | ルームパラメータから合成する幾何ベースのルームリバーブ |
| `effects.acoustic.roomMorph` | 目標の幾何ベースルームへ寄せるルームモーフィング |
| `effects.modulation.ensemble` | Solina 系 BBD ストリングマシンアンサンブル |
| `effects.modulation.chorus` | ステレオコーラス |
| `effects.modulation.flanger` | フランジャー |
| `effects.modulation.phaser` | フェイザー |
| `effects.modulation.wah` | 周期的に動くワウフィルター |
| `effects.modulation.autoWah` | 入力エンベロープで動くオートワウフィルター |
| `effects.modulation.rotary` | ロータリースピーカー風のピッチ／トレモロの動き |
| `effects.modulation.ringModulator` | リングモジュレーター |
| `effects.modulation.pitchShifter` | シンプルなピッチシフター |
| `effects.delay.stereo` | ステレオディレイ |

::: warning ビルドフラグによる有効化
これらの insert ID は、CMake オプション `BUILD_FX` を有効にしたビルドでのみ使えます（内部的にはこのオプションから `SONARE_HAVE_FX` マクロが導出されます）。幾何ベースのルーム系インサート（`effects.reverb.room`、`effects.acoustic.roomMorph`）は `BUILD_ACOUSTIC_SIM` も必要です。オプションを有効にしていないビルドでは、対応する ID は `masteringInsertNames()` に現れません。
:::

実用上の注意は次の通りです。

| 項目 | 意味 |
|------|------|
| `effects.reverb.plate` と `effects.reverb.dattorro` | 同じ Dattorro プロセッサの別名 |
| リバーブの params | `decaySec`、`decay`、`damping` / `hfDamping`、`dryWet`、`preDelayMs`、`reverbTimeS`、`densityHz`、`enableShelf`（アルゴリズムにより該当キーは異なる）。`effects.reverb.convolution` は構築時に `decaySec` を、合成テイルの上限である 12 秒へクランプする。Dattorro／プレート insert はコーラスのかかったテイル用に `modRateHz`（図形8タンクの LFO＝低周波オシレーターのレート[Hz]、既定値 `0.5`）と `modDepthSamples`（リバーブの基準レートでの変調深さ[サンプル]、既定値 `6.0`）も受け付ける |
| `effects.modulation.chorus` の params | `rateHz`、`depthMs`、`centerDelayMs`、`dryWet` |
| `effects.modulation.flanger` の params | `rateHz`、`depthMs`、`centerDelayMs`、`feedback`、`dryWet` |
| `effects.modulation.phaser` の params | `rateHz`、`minHz`、`maxHz`、`stages`、`dryWet` |
| `effects.modulation.ensemble` の params | `rateSlowHz`、`rateFastHz`、`depthSlowMs`、`depthFastMs`、`centerDelayMs`、`toneHz`、`dryWet` |
| `effects.modulation.wah` の params | `rateHz`、`minHz`、`maxHz`、`resonance`、`dryWet` |
| `effects.modulation.autoWah` の params | `sensitivity`、`minHz`、`maxHz`、`resonance`、`attackMs`、`releaseMs`、`dryWet` |
| `effects.modulation.rotary` の params | `rateHz`、`depthMs`、`tremolo`、`stereoSpread`、`dryWet` |
| `effects.modulation.ringModulator` の params | `carrierHz`、`dryWet` |
| `effects.modulation.pitchShifter` の params | `semitones`、`dryWet` |
| `effects.delay.stereo` の params | `delayTimeLMs`、`delayTimeRMs`、`feedback`、`pingPong`、`dryWet` |
| `effects.reverb.convolution` | ネイティブの insert 構築時にインパルス応答を渡す必要がある |
| IR のない convolution insert | 実質的にパススルーとして動作する |

::: warning 幾何ベースのルーム系インサートは `absorption` をクランプせず検証する
`effects.reverb.room` と `effects.acoustic.roomMorph` は、`[0, 1]` に正規化した吸音係数 `absorption` を受け取ります。この区間から外れた値は**拒否**され、最も近い有効な値に丸めて構築されることはありません。

クランプの方が一見親切ですが、ここでは適切ではありません。百分率や別スケールの反射係数、あるいは dB 値を正規化済みのフィールドへ渡した場合、意図しない部屋がそのまま構築され、テイルが短すぎる／長すぎるという形でしか誤りが表に出ません。同じ係数を渡す他の経路 — これらのインサートのバンド別 absorption 配列と、オフラインのルームインパルス合成のファサード — はすでにパラメータエラーを返すため、スカラー経路も同じ挙動にしています。
:::

幾何ベースのルーム系インサートは、空気吸収のコントロールも受け取ります。`airAbsorptionEnabled`（既定は OFF）、`airTemperatureC`、`airHumidityPercent` の 3 つです。オフラインのファサードとまったく同じオプション解決を通るため、インサートとして構築した部屋と `synthesizeRir(...)` で構築した同じ部屋は一致します。気象条件の `0` がリテラルのゼロではなく ISO の基準気象条件を選ぶ、という規則も共通です。[ルーム音響解析](./acoustic-analysis.md#後期残響モデルとテールのコントロール) を参照してください。

::: details これらのリバーブアルゴリズムの違いは？
いずれも残響のテイルを生成する方式の違いです。正しさではなく、欲しい質感で選んでください — どれも有効です。

- **Plate / Dattorro** — 滑らかで密度の高い、定番スタジオ的な響き。Dattorro 方式は広く使われるプレート系の設計で、`plate` はその別名です。
- **FDN**（フィードバックディレイネットワーク） — 相互接続したディレイラインで構成する柔軟なアルゴリズミックリバーブ。小さな部屋から大ホールまで調整しやすいのが特長です。
- **Velvet-noise** — まばらなランダムインパルスを使い、低い CPU 負荷で自然なテイルを作ります。
- **Convolution**（畳み込み） — 実空間で測定したインパルス応答と信号を畳み込み、*実際の*空間を再現します。
:::

::: details `effects.modulation.ensemble` とは？
Solina 系の BBD ストリングマシンアンサンブルで、ビンテージのストリングシンセらしい厚いコーラス感のある音色です。チャンネルごとに 3 つのディレイタップを持ち、低速と高速の 2 つの 3 相 LFO バンクで同時に揺らすため、単純なコーラスの揺れではなく密度の高いモジュレーションになります。ウェット経路には BBD のバケツ帯域を模したローパスがかかり、アナログのバケツリレー素子らしく暗くなります。右チャンネルの LFO 極性は反転しており、モノラルのソースを広いステレオ像へ広げます。インサートファクトリから利用でき、パラメータは全バインディングで `set_parameter` から自動化できます。
:::

## 単発マスタリングプロセッサでもあるインサート

これらは [ミキシングシーン JSON](./mixing-scene-json.md) の `insert.processor` フィールドで使います。出荷される FX 有効の WASM ビルドでは、一部は単発マスタリングプロセッサでもあります。`effects.reverb.plate`、`effects.reverb.dattorro`、`effects.reverb.fdn`、`effects.reverb.velvet`、`effects.reverb.convolution`、`effects.modulation.chorus`、`effects.modulation.flanger`、`effects.modulation.phaser`、`effects.delay.stereo` は `masteringProcessorNames()` から返り、単発適用パスで動作します。一方、幾何ベースのインサートと新しいモジュレーションインサート — `effects.reverb.room`、`effects.acoustic.roomMorph`、`effects.modulation.ensemble`、`effects.modulation.wah`、`effects.modulation.autoWah`、`effects.modulation.rotary`、`effects.modulation.ringModulator`、`effects.modulation.pitchShifter` — はインサート専用で、`masteringProcessorNames()` には**現れません**。これらは `masteringInsertNames()` とシーンインサート経由で使ってください。

## 関連

- [ミキシングエンジン](./mixing.md) — これらをチャンネルストリップ／バスのインサートとして読み込む
- [ミキシングシーン JSON](./mixing-scene-json.md) — `insert.processor` フィールドのリファレンス
- [マスタリングプロセッサ](./mastering-processors.md) — 名前付きマスタリングプロセッサ／プリセット／解析のレジストリ
