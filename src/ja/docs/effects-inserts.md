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

ミキサーシーンのインサートはマスタリングインサートと同じファクトリを使いますが、有効なインサート集合は `masteringProcessorNames()` より少し広いです。何が使えてどう設定するかは、次の 6 つの実行時 API で把握できます。

| API | 返すもの |
|-----|----------|
| `masteringInsertNames()` | 有効なインサート id の全リスト |
| `masteringInsertParamNames(name)` | 1 つのインサートが受け付ける構築用キー（バンド／サブバンド型はインデックス付きの `band{i}.*` キーを列挙し、未知の名前には空配列を返す） |
| `masteringInsertParamInfo(name)` | 構築用キーとリアルタイムオートメーション対象ごとの完全な記述子。[パラメータ記述子](#パラメータ記述子)を参照 |
| `masteringProcessorCatalog()` | `kind`、`realtimeInsertable`、`stereoOnly`、`latencySamples`、`tailSamples`、`channelPolicy`、`params`、条件付き `slots` を持つ機械処理しやすいエントリ。代表的な既定構成（48 kHz／512 サンプル）のプローブでレイテンシと可聴な減衰テールを返し（オフライン専用はどちらも 0）、構成依存の正確なレイテンシは実際のプロセッサへ問い合わせます。プロセッサ ID をハードコードせず能力で絞り込めます。 |
| `masteringInsertTiming(name, params, sampleRate)` | 1 つのインサート構成を prepare した正確なレイテンシとテール。`params` には有限の数値と真偽値だけを渡します。[プリセットパラメータと構成済みインサートのタイミング](./js-api-mastering.md#プリセットパラメータと構成済みインサートのタイミング)を参照 |
| `capabilityCatalog()` | ビルド全体のドキュメント。全プロセッサを `masteringInsertParamInfo` と同じ記述子付きで、プリセット一覧とともに 1 回で読めます。[カタログからインサートの操作面へ](#カタログからインサートの操作面へ) を参照 |

Python の対応関数は `mastering_insert_names()`、`mastering_insert_param_names(name)`、`mastering_insert_param_info(name)`、`mastering_processor_catalog()`、`mastering_insert_timing(name, params, sample_rate)`、`capability_catalog()` です。

一覧外のキーはプロセッサに無視され、そのキーを含むシーンを読み込むと [`Mixer.sceneWarnings()`](./mixing-scene-json.md) が報告します。

### パラメータ記述子

`masteringInsertParamInfo(name)` は、構築用キーとリアルタイムオートメーション対象ごとに記述子を 1 つ返します。記述子は次の 10 フィールドをすべて持ち、省略可能なフィールドはありません。

| フィールド | 型 | 意味 |
|------------|----|------|
| `name` | `string` | シーンインサートの params で使う JSON キー |
| `id` | `number` \| `null` | リアルタイムオートメーションや MIDI CC 紐付けに使う整数のパラメータ id。構築時専用キーは `null` |
| `rtSafe` | `boolean` | インサート稼働中にオーディオスレッドから値を変更できるか |
| `type` | `'number'` \| `'boolean'` \| `'enum'` \| `'string'` \| `'array'` | 設定ビルダーがそのキーをどの型として読むか |
| `min` | `number` \| `null` | 受理される最小値。カタログが制限を把握していない場合は `null` |
| `max` | `number` \| `null` | 受理される最大値。カタログが制限を把握していない場合は `null` |
| `default` | `number` \| `boolean` \| `null` | キーを省略したときに使われる値 |
| `unit` | `string` \| `null` | 認識された単位（`dB`、`Hz`、`ms`、`samples`。プレートと Dattorro の `modDepthSamples` だけは `referenceSamples@29761Hz`）。カタログに既知の単位がない場合は `null` で、無次元とは限りません |
| `choices` | `{ name: string; value: number }[]` \| `null` | 名前付き数値の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null` |
| `slot` | `string` \| `null` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` |

`unit` は省略可能フィールドではなく `string | null` です。キーの接尾辞に認識できる単位がなければ `null` を返し、キーを省略することはありません。`decaySec` や `lengthM` のような物理量もこの状態になり得るため、カタログに単位がない場合はキー名とプロセッサのドキュメントを使ってください。ホストは存在チェックなしにすべての記述子から 10 フィールドを読めます。`id: null` は構築時専用キーを、`rtSafe: false` は id の有無にかかわらずライブ変更できないことを表します。認識される単位はキーの接尾辞（`…Db`、`…Hz`、`…Ms`、`…Samples`）から読み取るので、値域と違って実測ではなく宣言です。唯一の例外を綴りで明示しているのは、その深さがセッションレートではなくリバーブ内部の基準レートで数えられるからです。`min` / `max` / `default` は `capabilityCatalog()` に載る値と同じで、その出どころとどこまで信頼できるかは[カタログの値域の読み方](./mastering-processors.md#カタログの値域の読み方)で説明しています。

::: info 記述子の一覧は構築用キーとオートメーション対象を含みます
`masteringInsertParamNames(name)` は構築時に読み取るキーの一覧です。`masteringInsertParamInfo(name)` はその一覧に加えてリアルタイムオートメーション対象も返します。構築時専用の行は `id: null` かつ `rtSafe: false` です。準備済みプロセッサで安全に変更できない id 付き対象も `rtSafe: false` になります。パラメータ名からピッカーを作り、`rtSafe` が true の記述子だけをライブ操作に使ってください。
:::

## カタログからインサートの操作面へ

ドキュメントそのもの — どのサーフェスが返すか、10 個のフィールド、スロットメタデータ、値域の実測方法 — は [機能カタログが返すもの](./api-surface.md#機能カタログが返すもの) が扱っています。この節はインサートに固有の部分です。ホストが自前の表を持たずに、プロセッサ id から並べ終えた操作面へどう辿り着くかを説明します。

経路はプロセッサごとの呼び出しではなく、1 つのドキュメントに対する 3 回の参照です。

1. **インサート集合を選ぶ。** `processors` を `realtimeInsertable` で絞ります。89 エントリ中 74 で、`masteringInsertNames()` が返す集合と同一です。残る 15（オフラインプロセッサ 11 とペアプロセッサ 4）は空の `params` 配列を持ちます。`category` はピッカーと同じ切り方で集合を分けます（`effects` がこのページの 17 個のクリエイティブ FX id、その他のカテゴリがマスタリングの各ファミリー）。`channelPolicy` は、ステレオより広いバスでミキサーがそのインサートをどう包むかを示します。リバーブ、モジュレーション、ディレイのインサートは `effects.modulation.ringModulator` を除いて `stereoPairOnly` で、ringModulator は `multichannel` です。
2. **記述子を読む。** エントリの `params` は、その id に対して `masteringInsertParamInfo(id)` が返すリストと同一で、順序も同じです。カタログを持っているホストは、プロセッサごとの呼び出しを必要としません。`id: null` は構築時専用キーを示し、整数の id は Node／WASM の `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)`、Python の `Mixer.schedule_insert_automation(...)`、C ABI の `sonare_strip_schedule_insert_automation` に渡すオートメーション id です。リアルタイムエンジンのセッターは代わりに `name` を取ります（`setTrackStripInsertParamByName` とそのマスター版、バス版）。
3. **各コントロールを配置する。** `type`、`default`、`min`、`max`、`unit`、`choices` から組みます。構築時専用キーにも記述子があるため、フェイザーの `stages`、オートワウの `attackMs` / `releaseMs`、ロータリーの `stereoSpread`、ルームのジオメトリを構築時フィールドとして表現できます。`slot` で所属するスロット群を特定し、プロセッサの `slots` エントリにある `activation`（`anyKey` または `always`）、内側を包む `parent`、`minCrossoverCutoffs` を組み合わせて、その群の存在を表示・検証します。

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);   // 89 中 74
const fx = inserts.filter((p) => p.category === 'effects');               // 下の 17 id
const chorus = fx.find((p) => p.id === 'effects.modulation.chorus')!;
for (const param of chorus.params) {
  // param.id は構築時専用キーでは null、param.name はシーン JSON のキー
  addControl(param.name, param.default, param.min, param.max, param.unit, param.rtSafe);
  if (param.id !== null && param.rtSafe) {
    bindAutomation(param.id, param.choices, param.slot);
  }
}
```

エフェクト系のエントリが報告する内容のうち、ドキュメントの一般的な読み方からは予想しにくいものが 4 つあります。

- **`rtSafe: false` はオートメーションを止める。** ヒントではありません。そのパラメータにオートメーションをスケジュールすると `NotSupported`（コード 6）が返ります。構築時専用の行は `id: null` かつ `rtSafe: false` で、準備済みプロセッサで安全に変更できない id 付き対象もあります。記述子ごとにオートメーションレーンを描く UI は、`rtSafe` が false の行をすべて無効化する必要があります。
- **カタログには数値以外の型もあります。** エフェクト系の記述子には `number`、`boolean`、`enum`、`string`、`array` があります。`choices` には enum 値や、間隔のある離散的な数値集合が載ります。名前からトグルを推測せず、`type` を使い、離散値の操作には `choices` を使ってください。
- **レイテンシとテールはインサートごとで、リバーブでは 0 ではない。** `effects.reverb.convolution`、`effects.reverb.room`、`effects.acoustic.roomMorph` は 256 サンプルのレイテンシを報告します。リバーブのテールは 51,217 サンプル（`room`、`roomMorph`）から 264,000（`fdn`）まで、ステレオディレイは 59,795 で、いずれも代表構成の 48 kHz プローブでの値です。`realtimeCost` はリバーブでは `moderate`、`velvet` だけが `high`、モジュレーションとディレイはすべて `low` で、`null` になるのは非インサートの 15 個だけです。
- **エフェクト系はパラメータ数が少ない。** 17 プロセッサ合わせて 131 記述子です。5,352 の大半はバンド単位の EQ プロセッサが占めます（`multiband.dynamicEq` だけで 1,019）。記述子の数で自身の大きさを決めるインサート UI は、2 つのファミリーが 1 桁違うことを前提にしてください。

### null と既定値が教えてくれないこと

**`null` の境界は、構築が拒否しなかったことを意味し、どんな値でも意味を持つことを意味しません。** 境界がないことは JSON では文字通り `null`（Python では `None`）です。スキーマは `min` と `max` を `number | null` と定め、すべての記述子が両方のキーを持ちます。構築時専用の記述子にも、検証が公開する場合は境界が載ります。一方、string や array のキーは通常 `null` です。`effects.modulation.chorus` は `dryWet` に境界を公開せず、構築は `5` を受け入れ、プロセッサは内部でウェット比を `[0, 1]` にクランプするので、`dryWet: 5` は `dryWet: 1` と同じ音になります。カタログが測るのは構築が拒否する値であり、拒否せず折り畳むプロセッサは `null` を報告します。`null` に対する範囲チェックは、1 種類の誤りしか除外できません。`null` の境界は「頼れる検証がない」と読み、妥当な範囲はパラメータの意味と単位から決めてください。

**既定値は設定構造体の初期化子であって、プリセットがそれを渡してくる保証はありません。** 構築時専用の記述子は、フォールバックがなければ `default: null` になりますが、プリセットやシーンはそのキーを明示できます。`default` だけで初期化する操作面は、読み込んだシーンに対して誤った値を表示することがあります。シーン自身の `params` から初期化し、シーンが持たないキーだけカタログの既定値に戻し、`null` の既定値にはシーンまたはユーザーの明示値が必要だと扱ってください。

## クリエイティブ FX インサートのカタログ

マスタリングの[ソロプロセッサ](./mastering-processors.md#ソロプロセッサ)に加え、クリエイティブ FX 有効ビルドではリバーブ、モジュレーション、ディレイのインサート ID も使えます。

| Insert ID | 意味 |
|-----------|------|
| `effects.reverb.plate` | Dattorro 系プレートリバーブのエイリアス |
| `effects.reverb.dattorro` | Dattorro リバーブ |
| `effects.reverb.fdn` | フィードバックディレイネットワークリバーブ |
| `effects.reverb.velvet` | Velvet-noise 系リバーブ |
| `effects.reverb.convolution` | Convolution リバーブ。params の `irF32Base64` でインパルス応答を受け取るか、`decaySec` と `seed` から合成します |
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

以下の表は代表的なキーと挙動を取り上げた要約です。完全なビルド別一覧 — chorus／flanger の `preFilterHz` と `preFilterMode`、phaser の `feedback` と `mixMode`、rotary のドラム制御、pitch-shifter の `windowMs`、ステレオディレイの `dampingHz` などの新しいキーを含む — は [`masteringInsertParamInfo(name)`](#パラメータ記述子) または `capabilityCatalog().processors[].params` から取得できます。

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
| `effects.reverb.convolution` の IR | インパルス応答（IR。実際の空間が短い衝撃音にどう応答するかを記録したもの）は、insert params の `irF32Base64` キーに base64 の float32 として渡す。シーン JSON でも他の経路でも同じ。ネイティブホストは構築時に直接注入することもできる |
| IR のない convolution insert | prepare 時に `decaySec`（RT60 相当の長さ。12 秒にクランプ）と `seed` から減衰ノイズの IR を合成するので、パススルーにはならず、アルゴリズミックな兄弟と同様にテールを生成する |

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
