---
title: エフェクトインサート
description: libsonare のミキシング／リアルタイムエンジン向けクリエイティブ FX インサートのカタログ。リバーブ、モジュレーション、ディレイ、サチュレーションの各インサートとパラメータ表、ビルドフラグによる有効化条件を、名前付きマスタリングプロセッサレジストリとは分けて掲載します。
---

# エフェクトインサート

**エフェクトインサート**は、ミキサーのチャンネルストリップやバスのスロット（およびリアルタイムエンジンのインサート）に読み込むクリエイティブ FX プロセッサです。リバーブ、モジュレーション、ディレイ、サチュレーションペダルが該当します。これらは [ミキシングエンジン](./mixing.md) がチャンネルストリップのインサートに使うものと同じインサートファクトリで構築します。

::: info インサートはマスタリングプロセッサではありません
このページが扱うのは**ミキサー／エンジンのインサート**です。名前付き [マスタリングプロセッサ](./mastering-processors.md) レジストリ（コンプレッサー、EQ、サチュレーション、ステレオ、リペア、ラウドネス／マキシマイザー段）は別の範囲を持つ別トピックです。両者は重なっていて、すべての FX インサートは単発のマスタリングプロセッサ*でもあります*（後述）。マスタリングレジストリを探しているなら、そちらのページから始めてください。
:::

インサートはチャンネルの経路の中に入るので、その出力はフェーダー、センド、バスを含む下流のすべてに渡ります。この位置こそがインサートとセンドの違いであり、下のカタログを読む前に押さえておきたい点です。

<SonareDemo id="pre-post-fader" />

## インサート集合を調べる

ミキサーシーンのインサートはマスタリングインサートと同じファクトリを使います。すべてのインサート id は `masteringProcessorNames()` にも含まれます。逆は成り立たず、オフライン専用の 7 つのプロセッサ（`final.bitDepth`、`final.dither`、`final.outputChain`、`maximizer.loudnessOptimize`、`repair.declick`、`repair.declip`、`repair.trimSilence`）は単発呼び出しでのみ動きます。何が使えてどう設定するかは、次の 6 つの実行時 API で把握できます。

| API | 返すもの |
|-----|----------|
| `masteringInsertNames()` | 有効なインサート id の全リスト |
| `masteringInsertParamNames(name)` | 1 つのインサートが受け付ける構築用キー（バンド／サブバンド型はインデックス付きの `band{i}.*` キーを列挙し、未知の名前には空配列を返す） |
| `masteringInsertParamInfo(name, sampleRate?)` | 構築用キーとリアルタイムオートメーション対象ごとの完全な記述子。[パラメータ記述子](#パラメータ記述子)を参照。`sampleRate` を渡すと、そのレートで決まるナイキスト上限を解決します |
| `masteringProcessorCatalog()` | `kind`、`realtimeInsertable`、`stereoOnly`、`latencySamples`、`tailSamples`、`channelPolicy`、`params`、条件付き `slots` を持つ機械処理しやすいエントリ。代表的な既定構成（48 kHz／512 サンプル）のプローブでレイテンシと可聴な減衰テールを返し（オフライン専用はどちらも 0）、構成依存の正確なレイテンシは実際のプロセッサへ問い合わせます。プロセッサ ID をハードコードせず能力で絞り込めます。 |
| `masteringInsertTiming(name, params, sampleRate)` | 1 つのインサート構成を prepare した正確なレイテンシとテール。`params` にはインサートの記述子が宣言するあらゆる値の型（数値、真偽値、列挙名、文字列、数値配列）を渡せます。[プリセットパラメータと構成済みインサートのタイミング](./js-api-mastering.md#プリセットパラメータと構成済みインサートのタイミング)を参照 |
| `capabilityCatalog()` | ビルド全体のドキュメント。全プロセッサを `masteringInsertParamInfo` と同じ記述子付きで、チェーンキーのセクションとプリセット一覧とともに 1 回で読めます。[カタログからインサートの操作面へ](#カタログからインサートの操作面へ) を参照 |

Python の対応関数は `mastering_insert_names()`、`mastering_insert_param_names(name)`、`mastering_insert_param_info(name, sample_rate=...)`、`mastering_processor_catalog()`、`mastering_insert_timing(name, params, sample_rate)`、`capability_catalog()` です。

一覧外のキーはプロセッサに無視され、そのキーを含むシーンを読み込むと [`Mixer.sceneWarnings()`](./mixing-scene-json.md) が報告します。

### パラメータ記述子

`masteringInsertParamInfo(name)` は、構築用キーとリアルタイムオートメーション対象ごとに記述子を 1 つ返します。記述子は次の 18 フィールドをすべて持ち、省略可能なフィールドはありません。

| フィールド | 型 | 意味 |
|------------|----|------|
| `name` | `string` | シーンインサートの params で使う JSON キー |
| `id` | `number` \| `null` | リアルタイムオートメーションや MIDI CC 紐付けに使う整数のパラメータ id。構築時専用キーは `null` |
| `rtSafe` | `boolean` | インサート稼働中にオーディオスレッドから値を変更できるか |
| `type` | `'number'` \| `'boolean'` \| `'enum'` \| `'string'` \| `'array'` | 設定ビルダーがそのキーをどの型として読むか |
| `min` | `number` \| `null` | 受理される最小値。カタログが制限を把握していない場合は `null` |
| `max` | `number` \| `null` | 受理される最大値。カタログが制限を把握していない場合は `null` |
| `minExclusive`、`maxExclusive` | `boolean` | 境界値そのものを拒否する（`true`）か受理するか |
| `maxRelativeTo` | `'nyquist'` \| `null` | `'nyquist'` は処理レートで決まる上限を示し、実効上限は `max` とナイキストの低いほうです。`masteringInsertParamInfo` に `sampleRate` を渡すと解決されます |
| `default` | `number` \| `boolean` \| `null` | キーを省略したときに使われる値 |
| `unit` | `string` \| `null` | プロセッサがそのキーを読む単位。閉じた集合（下記）から選ばれ、boolean・enum・string・array のキーでは `null` |
| `scale` | `'linear'` \| `'log'` | スライダーに使う軸 |
| `uiMin`、`uiMax` | `number` \| `null` | `[min, max]` の内側にある任意の表示範囲。ライブラリが宣言していなければ `null`。対数軸（`scale: 'log'`）では、`uiMin ?? min` は必ず正、`uiMax ?? max` は必ず有限です。`null` の側は、受理範囲の端がそのまま表示範囲の端になることを表します |
| `dependsOn` | `{ key: string; relation: 'lt' \| 'le' \| 'ge' \| 'gt'; factor: number }[]` | このキーの値域を、現在の値で縛る兄弟キー。`this <relation> factor * sibling` と読みます。`factor` は単純な大小関係（たとえば `cutoff0Hz` は `cutoff1Hz` 未満）なら 1 |
| `coupledWith` | `string[]` | `dependsOn` の項目以外で、このキーの受理範囲を動かす兄弟キー。`dependsOn` では表せない連動を示します。`min` / `max` はこれらを既定値にして測った値です。独立したキーでは空 |
| `choices` | `{ name: string; value: number }[]` \| `null` | 名前付き数値の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null`。ミキサーシーンの `params` には名前ではなく数値（`value`）を書く |
| `slot` | `string` \| `null` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` |

`unit` は `dB`、`dBFS`、`LUFS`、`Hz`、`ms`、`s`、`samples`、`m`、`cm`、`mm`、`deg`、`percent`、`degC`、`V`、`inPerSec`、`dBPerOct`、`semitones`、`cents`、`ratio`、`bits`、`count`、`none`（無次元の数値）のいずれかです。キーの綴りから推測するのではなく、そのキーを使うプロセッサが宣言するので、`decaySec` は `s`、`lengthM` は `m`、プレートと Dattorro の `modDepthSamples` は `samples` を返します。`null` になるのは数値以外のキーだけです。ホストは存在チェックなしにすべての記述子から 18 フィールドを読めます。`id: null` は構築時専用キーを、`rtSafe: false` は id の有無にかかわらずライブ変更できないことを表します。同じフィールドは `capabilityCatalog()` にも載り、`min` / `max` / `default` の出どころとどこまで信頼できるかは[カタログの値域の読み方](./mastering-processors.md#カタログの値域の読み方)で説明しています。値域、表示範囲、`dependsOn` は構築時の受理条件を表し、リアルタイムのパラメータ経路ではクランプされます。公開される境界は内側へ丸められるため、公開された限界値は常にインサートが受理する値です。

::: info 記述子の一覧は構築用キーとオートメーション対象を含みます
`masteringInsertParamNames(name)` は構築時に読み取るキーの一覧です。`masteringInsertParamInfo(name)` はその一覧に加えてリアルタイムオートメーション対象も返します。構築時専用の行は `id: null` かつ `rtSafe: false` です。準備済みプロセッサで安全に変更できない id 付き対象も `rtSafe: false` になります。パラメータ名からピッカーを作り、`rtSafe` が true の記述子だけをライブ操作に使ってください。
:::

処理レートで上限が決まる周波数キーは `maxRelativeTo: 'nyquist'` を公開し、`max` には既定レートでの値が入ります。セッションのレートを渡すと、そのレートで有効な上限が得られます。

```typescript
const band = (rate?: number) =>
  masteringInsertParamInfo('eq.parametric', rate).find((p) => p.name === 'band0.frequencyHz')!;
band().max;       // 24000（排他）
band(44100).max;  // 22050（排他）
band(96000).max;  // 48000（排他）
```

## カタログからインサートの操作面へ

ドキュメントそのもの（どのサーフェスが返すか、記述子のフィールド、スロットメタデータ、値域の実測方法）は [機能カタログが返すもの](./api-surface.md#機能カタログが返すもの) が扱っています。この節はインサートに固有の部分です。ホストが自前の表を持たずに、プロセッサ id からコントロールを並べた操作面をどう組み立てるかを説明します。

手順は、プロセッサごとに API を呼ぶのではなく、1 つのドキュメントを 3 回参照するだけです。

1. **インサート集合を選ぶ。** `processors` を `realtimeInsertable` で絞ります。これは `masteringInsertNames()` が返す集合と同一です。残りはオフラインプロセッサ 7 つとペアプロセッサ 4 つです。`category` はピッカーと同じ切り方で集合を分けます。`effects` がこのページのクリエイティブ FX の id、`voice` が `voice.changer` インサート、その他のカテゴリがマスタリングの各ファミリーです。ピッカーがインサートをどう扱うかは、次の 3 つのフィールドで決まります。

   | フィールド | 読み方 |
   |---|---|
   | `causal` | すべてのインサートで `true`。非インサートの 11 個（オフラインのリペアプロセッサ 3 つ `repair.declick`、`repair.declip`、`repair.trimSilence`、`final.*`、`maximizer.loudnessOptimize`、ペアプロセッサ）では `false`。 |
   | `channelPolicy` | ステレオより広いバスでミキサーがそのインサートをどう包むか。リバーブ、モジュレーション、ディレイのインサートは `effects.modulation.ringModulator`（`multichannel`）を除いて `stereoPairOnly`。 |
   | `params` | ペアプロセッサ、`final.*`、`maximizer.loudnessOptimize` では空。オフラインのリペアプロセッサ 3 つと、リアルタイムのリペアインサート 4 つ（`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical`）は構築時専用の行を公開する。 |

2. **記述子を読む。** インサートの `params` は、その id に対して `masteringInsertParamInfo(id)` が返すリストと同一で、順序も同じです。カタログを持っているホストは、プロセッサごとの呼び出しを必要としません（オフライン専用のリペアプロセッサも同じ呼び出しで答えます）。`id: null` は構築時専用キーを示し、整数の id は Node／WASM の `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)`、Python の `Mixer.schedule_insert_automation(...)`、C ABI の `sonare_strip_schedule_insert_automation` に渡すオートメーション id です。リアルタイムエンジンのセッターは代わりに `name` を取ります（`setTrackStripInsertParamByName` とそのマスター版、バス版）。
3. **各コントロールを配置する。** `type`、`default`、`min`、`max`、`unit`、`choices` から組みます。構築時専用キーにも記述子があるため、フェイザーの `stages`、オートワウの `attackMs` / `releaseMs`、ロータリーの `stereoSpread`、ルームのジオメトリを構築時フィールドとして表現できます。`slot` で所属するスロット群を特定し、プロセッサの `slots` エントリにある `activation`（`anyKey` または `always`）、内側を包む `parent`、`minCrossoverCutoffs` を組み合わせて、その群の存在を表示・検証します。

カタログには `saturation.overdrive` と `saturation.distortion` も `saturation` カテゴリで含まれます。どちらもマルチチャンネルのリアルタイムインサートで、ソロプロセッサでもあります。そのため、ミキサーのチェーン、リアルタイムエンジン、単発のマスタリング適用で同じ ID を使えます。

同じ記述子経路から、現在インサートとして使えるマキシマイザーのコントロールも取得できます。`maximizer.truePeakLimiter`、`maximizer.maximizer`、`maximizer.adaptiveRelease`、`maximizer.softKneeMax` の `ceilingDb` です。GS に結び付いたリアルタイムコントロールも記述子に載ります。`effects.modulation.pitchShifter` の `windowMs`、`preDelayMs`、`preDelay2Ms`、`effects.modulation.rotary` の `stereoSpread`、`accelTauS`、`decelTauS`、`undershootHz`、`drumUndershootHz`、`effects.reverb.dattorro` の `preDelayMs`、`character`、`saturation.bitcrusher` の `typeLadder` です。別の操作表を持たず、記述子一覧を使ってください。

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);
const fx = inserts.filter((p) => p.category === 'effects');               // このページのクリエイティブ FX の id
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

- **`rtSafe: false` はオートメーションを止める。** ヒントではありません。そのパラメータにオートメーションをスケジュールすると `NotSupported`（コード 6）が返ります。構築時専用の行は `id: null` かつ `rtSafe: false` です。GS EFX の raw バイトはすべて id 付きでも `rtSafe: false` で、`modDepthSamples` も同じです。記述子ごとにオートメーションレーンを描く UI は、id の有無にかかわらず `rtSafe` が false の行をすべて無効化する必要があります。
- **カタログには数値以外の型もあります。** エフェクト系の記述子には `number`、`boolean`、`enum`、`string`、`array` があります。`choices` には enum 値や、間隔のある離散的な数値集合が載ります。名前からトグルを推測せず、`type` を使い、離散値の操作には `choices` を使ってください。
- **レイテンシとテールはインサートごとで、リバーブでは 0 ではない。** `effects.reverb.convolution`、`effects.reverb.room`、`effects.acoustic.roomMorph` は 256 サンプルのレイテンシを報告します。既定パラメータ・48 kHz では、リバーブのテールは約 1 秒（`room`、`roomMorph`）、1.5 秒（`convolution`）を経て約 7.5 秒（`fdn`）まで、ステレオディレイは約 2.5 秒です。報告されるテールは出力が満尺の 1e-5 に下がるまでを覆うので、バウンス長を決める上限として使えます。`realtimeCost` はリバーブでは `moderate`、`velvet` だけが `high`、モジュレーションとディレイはすべて `low` で、`null` になるのは非インサートの 11 個だけです。
- **エフェクト系はパラメータ数が少ない。** 全カタログの記述子の大半は、バンド単位の EQ とマルチバンドのプロセッサが占めます。記述子の数で自身の大きさを決めるインサート UI は、ファミリー間で 1 桁違うことを前提にしてください。

### null と既定値が教えてくれないこと

**`null` の境界が示すのは構築がその値を拒否しないということだけで、どんな値でも意味を持つわけではありません。** 境界がないことは JSON では文字通り `null`（Python では `None`）です。スキーマは `min` と `max` を `number | null` と定め、すべての記述子が両方のキーを持ちます。構築時専用の記述子にも、検証が公開する場合は境界が載ります。一方、string や array のキーは通常 `null` です。`effects.modulation.chorus` は `dryWet` に境界を公開せず、構築は `5` を受け入れ、プロセッサは内部でウェット比を `[0, 1]` にクランプするので、`dryWet: 5` は `dryWet: 1` と同じ音になります。カタログが測るのは構築が拒否する値であり、拒否せず折り畳むプロセッサは `null` を報告します。`null` に対する範囲チェックは、1 種類の誤りしか除外できません。`null` の境界は「頼れる検証がない」と読み、妥当な範囲はパラメータの意味と単位から決めてください。

カタログの有限な値域は受理条件です。たとえば `saturation.bitcrusher.bitDepth` は `min: 2`、`max: 24` を公開し、範囲外の値を拒否します。ゲイン系の一部は、dB から線形値へ変換した結果が有限にならない値も拒否します。大きな上限が実測されても、実用的な操作範囲を意味するわけではありません。

**既定値は設定構造体の初期化子の値にすぎず、プリセットがその値を使うとは限りません。** 構築時専用の記述子は、フォールバックがなければ `default: null` になりますが、プリセットやシーンはそのキーを明示できます。`default` だけで初期化する操作面は、読み込んだシーンに対して誤った値を表示することがあります。シーン自身の `params` から初期化し、シーンが持たないキーだけカタログの既定値に戻し、`null` の既定値にはシーンまたはユーザーの明示値が必要だと扱ってください。

これらの記述子からスライダー、トグル、バンドのスロットを組み立てる通しの例は、[パラメータ記述子からコントロールを組み立てる](./use-cases/parameter-controls.md)にあります。

## クリエイティブ FX インサートのカタログ

マスタリングの[ソロプロセッサ](./mastering-processors.md#ソロプロセッサ)に加え、クリエイティブ FX 有効ビルドではリバーブ、モジュレーション、母音フィルター、ディレイ、ステレオのインサート ID も使えます。

`effects` カテゴリは 19 件で、`stereo.binaural` はステレオカテゴリのインサートとして同じ表に載せています。

| Insert ID | 意味 |
|-----------|------|
| `effects.reverb.plate` | Dattorro 系プレートリバーブのエイリアス |
| `effects.reverb.dattorro` | Dattorro リバーブ |
| `effects.reverb.fdn` | フィードバックディレイネットワークリバーブ |
| `effects.reverb.velvet` | Velvet-noise 系リバーブ |
| `effects.reverb.convolution` | Convolution リバーブ。params の `irF32Base64` でインパルス応答を受け取るか、`decaySec` と `seed` から合成します |
| `effects.reverb.room` | ルームパラメータから合成する幾何ベースのルームリバーブ |
| `effects.acoustic.roomMorph` | 目標の幾何ベースルームへ寄せるルームモーフィング |
| `effects.gsEfx` | 選択したタイプと 20 個の raw パラメータバイトを持つ GS インサートエフェクト |
| `saturation.overdrive` | ゲイン、トーン、出力レベルを持つオーバードライブペダル |
| `saturation.distortion` | ゲイン、トーン、出力レベルを持つディストーションペダル |
| `effects.filter.vowel` | 3 つの共鳴帯域とダイレクト経路を持つ母音フィルター |
| `effects.modulation.ensemble` | BBD ストリングマシンアンサンブル |
| `effects.modulation.chorus` | ステレオコーラス |
| `effects.modulation.flanger` | フランジャー |
| `effects.modulation.phaser` | フェイザー |
| `effects.modulation.wah` | 周期的に動くワウフィルター |
| `effects.modulation.autoWah` | 入力エンベロープで動くオートワウフィルター |
| `effects.modulation.rotary` | ロータリースピーカー風のピッチ／トレモロの動き |
| `effects.modulation.ringModulator` | リングモジュレーター |
| `effects.modulation.pitchShifter` | シンプルなピッチシフター |
| `effects.delay.stereo` | ステレオディレイ |
| `stereo.binaural` | 測定 HRTF でステレオペアを仮想スピーカーへ配置するプロセッサ |

::: warning ビルドフラグによる有効化
これらの insert ID は、CMake オプション `BUILD_FX` を有効にしたビルドでのみ使えます（内部的にはこのオプションから `SONARE_HAVE_FX` マクロが導出されます）。幾何ベースのルーム系インサート（`effects.reverb.room`、`effects.acoustic.roomMorph`）は `BUILD_ACOUSTIC_SIM` も必要です。オプションを有効にしていないビルドでは、対応する ID は `masteringInsertNames()` に現れません。
:::

### インサート別のパラメータ

この一覧は部分的で、各インサートの代表的なキーだけを載せています。完全な一覧は [`masteringInsertParamInfo(name)`](#パラメータ記述子) または `capabilityCatalog().processors[].params` から取得できます。chorus／flanger の `preFilterHz` と `preFilterMode`、phaser の `feedback` と `mixMode`、rotary のドラム制御、pitch-shifter の `windowMs`、ステレオディレイの `dampingHz` などのキーも含まれます。

| インサート | 代表的なキー |
|--------|-------------|
| リバーブ全般（該当キーはアルゴリズムにより異なる） | `decaySec`、`decay`、`damping` / `hfDamping`、`dryWet`、`preDelayMs`、`reverbTimeS`、`densityHz`、`enableShelf` |
| `effects.reverb.dattorro` / `plate` | リバーブ全般のキーに加え、コーラスのかかったテールのための `modRateHz`（8 の字型タンクの低周波オシレーターのレート、既定値 `0.5`）と `modDepthSamples`（リバーブ内部の基準レートでの変調深さ[サンプル]、既定値 `6.0`） |
| `effects.reverb.convolution` | `irF32Base64`（インパルス応答。実際の空間が短い衝撃音にどう応答するかを記録したもので、base64 の float32 としてシーン JSON でも他の経路でも同じように渡す）、`decaySec`、`seed`。インパルス応答がない場合は、prepare 時に `decaySec`（RT60 相当の長さ。12 秒にクランプ）と `seed` から減衰ノイズのインパルス応答を合成するので、信号がそのまま通ることはなく、他のアルゴリズミックリバーブと同様にテールを生成する |
| `effects.modulation.chorus` | `rateHz`、`depthMs`、`centerDelayMs`、`dryWet` |
| `effects.modulation.flanger` | `rateHz`、`depthMs`、`centerDelayMs`、`feedback`、`dryWet` |
| `effects.modulation.phaser` | `rateHz`、`minHz`、`maxHz`、`stages`、`dryWet` |
| `effects.modulation.ensemble` | `rateSlowHz`、`rateFastHz`、`depthSlowMs`、`depthFastMs`、`centerDelayMs`、`toneHz`、`dryWet` |
| `effects.modulation.wah` | `rateHz`、`minHz`、`maxHz`、`resonance`、`dryWet` |
| `effects.modulation.autoWah` | `sensitivity`、`minHz`、`maxHz`、`resonance`、`attackMs`、`releaseMs`、`dryWet` |
| `effects.modulation.rotary` | `rateHz`、`depthMs`、`tremolo`、`stereoSpread`、`dryWet` |
| `effects.modulation.ringModulator` | `carrierHz`、`dryWet` |
| `effects.modulation.pitchShifter` | `semitones`、`dryWet` |
| `effects.delay.stereo` | `delayTimeLMs`、`delayTimeRMs`、`feedback`、`pingPong`、`dryWet` |
| `effects.filter.vowel` | `vowel`、`accelMs`、`drive`、`driveOn`、`dryWet` |
| `stereo.binaural` | `azimuthDeg`、`autoTurn`、`turnRateHz`、`clockwise`、`output`（`0` = スピーカー、`1` = ヘッドホン）、`dryWet` |

`effects.reverb.convolution` は構築時に `decaySec` を、合成テールの上限である 12 秒にクランプします。

### GS EFX（`effects.gsEfx`）

`effects.gsEfx` は、単体でも使える GS インサートエフェクトです。ライブラリを `BUILD_FX` 有効でビルドした場合だけ含まれます。無効なビルドでは `masteringInsertNames()` に名前が現れず、`masteringProcess()` やインサートスロットへ渡せません。

ファクトリにはフラットな数値パラメータオブジェクトを渡します。`typeMsb` と `typeLsb` を両方とも省略するとタイプ `0`（thru）になります。別のタイプを選ぶときは、両方を整数の `0..127` で指定します。片方だけの指定は拒否され、2 つを `(typeMsb << 8) | typeLsb` として GS タイプを選びます。0 以外はビルドが対応するタイプでなければなりません。`realization` は省略可能で、`0` が modern（既定値）、`1` が classic です。`byte0` から `byte19` までは省略可能な GS の raw パラメータバイトで、それぞれ `0..127` にします。省略したバイトには選択したタイプの既定値が入り、タイプが受け付けない値は拒否されます。

```typescript
const processed = masteringProcess('effects.gsEfx', samples, sampleRate, {
  typeMsb: 0x01,
  typeLsb: 0x10,
  realization: 0,
  byte0: 64,
  byte19: 127,
});
```

ミキサーやリアルタイムインサートとして構築するときも同じパラメータオブジェクトを使います。現在のビルドが公開する記述子は `masteringInsertParamInfo('effects.gsEfx')` または機能カタログから取得してください。

### サチュレーションペダル

`saturation.overdrive` と `saturation.distortion` は、リアルタイムで安全に変更できるマルチチャンネルインサートです。名前付きソロプロセッサでもあるため、`masteringProcess(...)` でも同じパラメータマップを使えます。下の値域、既定値、タイミングは capability catalog の値です。

| インサート | パラメータ | 受理範囲 | 既定値 | 単位 |
|---|---|---|---|---|
| `saturation.overdrive` | `gainDb` | `0`〜`41` | `20` | dB |
|  | `toneHz` | `500`〜`8000` | `3000` | Hz |
|  | `levelDb` | カタログ上の最小値なし、最大値 `770.636` | `0` | dB |
| `saturation.distortion` | `gainDb` | `0`〜`60` | `30` | dB |
|  | `toneHz` | `475`〜`20000` | `4000` | Hz |
|  | `levelDb` | カタログ上の最小値なし、最大値 `770.636` | `0` | dB |

どちらもレイテンシを `48` samples と報告し、テールは 48 kHz で overdrive が 10,513 samples、distortion が 15,793 samples です。3 つのパラメータにはリアルタイムオートメーション ID があり、動作中に変更できます。`levelDb` の大きな最大値は、内側へ丸めた有限ゲインの上限であり、音楽的に推奨する範囲ではありません。

### 母音フィルター

<SonareDemo id="vowel-filter" />

`effects.filter.vowel` は、3 つの共鳴帯域とダイレクト経路で入力信号を整形します。母音の色付けを行うフィルターであり、完全な音声合成器ではありません。独立した A/B マッチング段もないため、フィルター後とダイレクト経路を比べるときは dry/wet を使います。

### ドライ／ウェットの混合法則

カタログの 9 エントリが enum の `mixLaw` を公開します。対象は `effects.delay.stereo`、`effects.modulation.chorus`、`effects.modulation.flanger`、`effects.modulation.ensemble`、`effects.modulation.pitchShifter`、`effects.modulation.ringModulator`、`effects.reverb.dattorro`、その別名 `effects.reverb.plate`、`saturation.bitcrusher` です。

| 選択肢 | ドライのゲイン | ウェットのゲイン |
|---|---|---|
| `crossfade`（`0`） | `1 - w` | `w` |
| `twoRamps`（`1`） | `min(1, 2 * (1 - w))` | `min(1, 2 * w)` |

`w` は `[0, 1]` の `dryWet` です。`0.5` では crossfade が両経路を半分のゲインにし、twoRamps は両経路を等倍にします。そのため、相関のある経路では音量が大きくなる場合があります。現在のカタログでは、この 9 エントリそれぞれの既定値が `crossfade` です。コントロールを作る際は、各プロセッサの `mixLaw` 記述子から `default`、`choices`、オートメーション ID を読みます。

::: details これらのリバーブアルゴリズムの違いは？
いずれも残響のテイルを生成する方式の違いです。正しさではなく、欲しい質感で選んでください。どれも有効です。

- **Plate / Dattorro**：滑らかで密度の高い、定番スタジオ的な響き。Dattorro 方式は広く使われるプレート系の設計で、`plate` はその別名です。
- **FDN**（フィードバックディレイネットワーク）：相互接続したディレイラインで構成する柔軟なアルゴリズミックリバーブ。小さな部屋から大ホールまで調整しやすいのが特長です。
- **Velvet-noise**：まばらなランダムインパルスを使い、低い CPU 負荷で自然なテイルを作ります。
- **Convolution**（畳み込み）：実空間で測定したインパルス応答と信号を畳み込み、*実際の*空間を再現します。
:::

::: details `effects.modulation.ensemble` とは？
バケツリレー素子（BBD）によるストリングマシンのアンサンブルで、ビンテージのストリングシンセらしい厚いコーラス感のある音色です。チャンネルごとに 3 つのディレイタップを持ち、低速と高速の 2 つの 3 相 LFO バンクで同時に揺らすため、単純なコーラスの揺れではなく密度の高いモジュレーションになります。ウェット経路には BBD のバケツ帯域を模したローパスがかかり、アナログのバケツリレー素子らしく暗くなります。右チャンネルの LFO 極性は反転しており、モノラルのソースを広いステレオ像へ広げます。インサートファクトリから利用でき、パラメータは全バインディングで `set_parameter` から自動化できます。
:::

### 幾何ベースのルーム系インサート

`effects.reverb.room` と `effects.acoustic.roomMorph` は、減衰時間ではなく部屋の幾何で駆動されます。直方体の部屋、音源位置、リスナー位置を指定します。表は、ルームインサートの記述子をケイパビリティカタログが公開するとおりに並べたものです。幾何と空気吸収のキーはすべて構築時のみで、リアルタイムのオートメーション ID を持つのは `dryWet` だけです。

| パラメータ | 受け付ける範囲 | 既定値 | 単位 |
|-----------|----------------|--------|------|
| `dryWet` | 公開なし | `0.35` | なし |
| `lengthM` | `5.15`〜`10000` | `7` | m |
| `widthM` | `4.2`〜`10000` | `5` | m |
| `heightM` | `1.7`〜`10000` | `3` | m |
| `sourceX` / `sourceY` / `sourceZ` | `0` 以上 | `1` / `1` / `1.2` | m |
| `listenerX` / `listenerY` / `listenerZ` | `0.242391`〜`6.88648` / `0.24567`〜`4.81918` / `0` 以上 | `5` / `4` / `1.7` | m |
| `absorption` | `0`〜`1`（検証される） | `0.2` | なし |
| `ismOrder` | カタログ上の範囲なし（負の値は `0` として扱われます） | `3` | 個数 |
| `maxSeconds` | `0`〜`600`。`0` は RT60 から応答の長さを決めます | `0` | 秒 |
| `seed` | カタログ上の範囲なし | `1` | なし |
| `receiverSpacingM` | カタログでは既定の配置で `0`〜`2.5`（下記参照）。`0` は 0.5 m を選びます | `0` | m |
| `airAbsorptionEnabled` | 真偽値 | `false` | なし |
| `airTemperatureC` / `airHumidityPercent` | カタログ上の範囲なし。`0` は ISO の基準気象条件を選びます | `0` | 摂氏 / パーセント |

`effects.acoustic.roomMorph` インサートは、同じ幾何・レシーバー・空気吸収のキーを受け取り、`dryWet` の既定値は `0.5` です。これに加えて `sourceTailSuppression`（`0`〜`1`、既定値 `0.5`、リアルタイムのオートメーション ID は `1`）、`crossfadeMs`（`0`〜`1000`）、`mixingTimeMs`（`0`〜`10000`）、`preferEyring`、`materialPreset`、配列の `bandAbsorption` / `bandScattering` を受け取ります。`ismOrder` のカタログ上の最小値は `0` です。上のリスナーの最小値・最大値は、既定の部屋と間隔で測った値なので、`lengthM`、`widthM`、`receiverSpacingM` に応じて動きます。

::: warning 幾何ベースのルーム系インサートは `absorption` をクランプせず検証する
`effects.reverb.room` と `effects.acoustic.roomMorph` は、`[0, 1]` に正規化した吸音率 `absorption` を受け取ります。この区間から外れた値は**拒否**され、最も近い有効な値に丸めて構築されることはありません。

クランプの方が一見親切ですが、ここでは適切ではありません。百分率や別スケールの反射係数、あるいは dB 値を正規化済みのフィールドへ渡した場合、意図しない部屋がそのまま構築され、テイルが短すぎる／長すぎるという形でしか誤りが表に出ません。同じ係数を渡す他の経路（これらのインサートのバンド別 absorption 配列と、オフラインのルームインパルス合成のファサード）はすでにパラメータエラーを返すため、スカラー経路も同じ挙動にしています。
:::

幾何ベースのルーム系インサートは、ステレオペアのレシーバーのどちらかが部屋の外に出る配置を InvalidParameter で拒否します。したがって、側壁までの距離がレシーバー間隔の半分より小さいリスナーは、モノラルのストリップでも拒否されます。カタログの実測した範囲もこれに従い、`listenerX` と `listenerY` は壁の内側に収まる最小値・最大値を公開し、`lengthM` と `widthM` の最小値はそれに合わせて引き上げられます。ライブラリはそのようなリスナーを動かさずに拒否します。動かしたリスナーは別の部屋の響きになるからです。レシーバー間隔を `s` とすると、`[s/2, lengthM - s/2]` × `[s/2, widthM - s/2]` の内側のリスナーは必ず構築できるので、保存済みのシーンが拒否されたら、リスナーをこの範囲に移してください。ステレオのストリップでは、各チャンネルが間隔をあけた 2 つのレシーバー（`receiverSpacingM`。省略または 0 で 0.5 m。両方のレシーバーが室内に収まる配置なら最大 4 m）のうち自分の側で聞こえるターゲットルームと畳み込まれるため、付加されるルームは中央に寄らず、左右で同一にもなりません。後部のテールは、それだけ離れた 2 点の拡散音場コヒーレンスに従います。モノラルのストリップは単一リスナーの応答のままです。オフラインのモノラル `roomMorph` はレシーバーのペアを置かないので、そのような配置も受け付けます。

幾何ベースのルーム系インサートは、空気吸収のコントロールも受け取ります。`airAbsorptionEnabled`（既定は OFF）、`airTemperatureC`、`airHumidityPercent` の 3 つです。オフラインのファサードとまったく同じオプション解決を通るため、インサートとして構築した部屋と `synthesizeRir(...)` で構築した同じ部屋は一致します。気象条件の `0` がリテラルのゼロではなく ISO の基準気象条件を選ぶ、という規則も共通です。[ルーム音響解析](./acoustic-analysis.md#後期残響モデルとテールのコントロール) を参照してください。

**カタログの 2.5 m は既定の部屋での上限です。** `receiverSpacingM` 記述子が最大値を 2.5 m と公開しているのは、リスナーの範囲と同じく既定値で測った値だからです。7 × 5 m の部屋で音源が (1, 1)、リスナーが (5, 4) のとき、レシーバーのペアは音源方向と直交する向きに並び、間隔が 2.5 m で片方が側壁に届きます。この範囲は部屋と配置によって動きますが、`dependsOn` では表せないため、記述子は `coupledWith` に連動するキーを挙げます。`receiverSpacingM` は `lengthM`、`widthM`、`listenerX`、`listenerY`、`sourceX`、`sourceY` を、`listenerX` は `lengthM` への `dependsOn` に加えて `listenerY`、`receiverSpacingM`、`sourceX`、`sourceY` を挙げています。これらのキーのコントロールを変更したら、新しい値に合わせて記述子を読み直すか、公開された境界を既定の構成での値として扱ってください。エンジンが実際に課す条件は、オフラインのルーム関数と共通です。間隔が (0, 4] m で、2 つのレシーバーが両方とも室内に収まることです。20 × 15 m の部屋では 3 m と 4 m の間隔も `masteringProcess(...)` で構築・レンダリングでき、4.5 m は InvalidParameter で拒否されます。

レシーバー間隔で音がどう変わるかは、[間隔を空けたレシーバーとチャンネル間コヒーレンス](./glossary/acoustics/spaced-receivers.md)を参照してください。

## 単発マスタリングプロセッサでもあるインサート

これらの id は [ミキシングシーン JSON](./mixing-scene-json.md) の `insert.processor` フィールドで使います。出荷される FX 有効の WASM ビルドでは、幾何ベースの `effects.reverb.room` と `effects.acoustic.roomMorph`、モジュレーションインサート（`effects.modulation.ensemble`、`wah`、`autoWah`、`rotary`、`ringModulator`、`pitchShifter`）を含め、すべてのインサート id が `masteringProcessorNames()` に含まれ、単発の適用経路で実行できます。そのため、同じパラメータマップをミキサーのチェーン、リアルタイムエンジン、`masteringProcess(...)` のどれでも使えます。単発呼び出しは `latencySamples` にインサートのレイテンシを報告します（コンボリューションと幾何ベースのルームのインサートは 256）。

## 関連

- [ミキシングエンジン](./mixing.md)：これらをチャンネルストリップ／バスのインサートとして読み込む
- [ミキシングシーン JSON](./mixing-scene-json.md)：`insert.processor` フィールドのリファレンス
- [マスタリングプロセッサ](./mastering-processors.md)：名前付きマスタリングプロセッサ／プリセット／解析のレジストリ
