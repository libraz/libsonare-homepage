---
title: エフェクトインサート
description: libsonare のミキシング／リアルタイムエンジン向けクリエイティブ FX インサートのカタログ。リバーブ、モジュレーション、ディレイ、サチュレーションの各インサートとパラメータ表、ビルドフラグによる有効化条件を、名前付きマスタリングプロセッサレジストリとは分けて掲載します。
---

# エフェクトインサート

**エフェクトインサート**は、ミキサーのチャンネルストリップやバスのスロット（およびリアルタイムエンジンのインサート）に読み込むクリエイティブ FX プロセッサです。リバーブ、モジュレーション、ディレイ、サチュレーションペダルが該当します。これらは [ミキシングエンジン](./mixing.md) がチャンネルストリップのインサートに使うものと同じインサートファクトリで構築します。

::: info インサートはマスタリングプロセッサではありません
このページが扱うのは**ミキサー／エンジンのインサート**です。名前付き [マスタリングプロセッサ](./mastering-processors.md) レジストリ — コンプレッサー、EQ、サチュレーション、ステレオ、リペア、ラウドネス／マキシマイザー段 — は別の範囲を持つ別トピックです。両者は重なっていて、すべての FX インサートは単発のマスタリングプロセッサ*でもあります*（後述）。マスタリングレジストリを探しているなら、そちらのページから始めてください。
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

`masteringInsertParamInfo(name)` は、構築用キーとリアルタイムオートメーション対象ごとに記述子を 1 つ返します。記述子は次の 17 フィールドをすべて持ち、省略可能なフィールドはありません。

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
| `uiMin`、`uiMax` | `number` \| `null` | `[min, max]` の内側にある任意の表示範囲。ライブラリが宣言していなければ `null`。対数軸（`scale: 'log'`）のパラメータは、必ず正の `uiMin` と有限の `uiMax` を公開します |
| `dependsOn` | `{ key: string; relation: 'lt' \| 'le' \| 'ge' \| 'gt'; factor: number }[]` | このキーの値域を、現在の値で縛る兄弟キー。`this <relation> factor * sibling` と読みます。`factor` は単純な大小関係（たとえば `cutoff0Hz` は `cutoff1Hz` 未満）なら 1 |
| `choices` | `{ name: string; value: number }[]` \| `null` | 名前付き数値の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null` |
| `slot` | `string` \| `null` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` |

`unit` は `dB`、`dBFS`、`LUFS`、`Hz`、`ms`、`s`、`samples`、`m`、`cm`、`deg`、`percent`、`degC`、`V`、`inPerSec`、`dBPerOct`、`semitones`、`cents`、`ratio`、`bits`、`count`、`none`（無次元の数値）のいずれかです。キーの綴りから推測するのではなく、そのキーを使うプロセッサが宣言するので、`decaySec` は `s`、`lengthM` は `m`、プレートと Dattorro の `modDepthSamples` は `samples` を返します。`null` になるのは数値以外のキーだけです。ホストは存在チェックなしにすべての記述子から 17 フィールドを読めます。`id: null` は構築時専用キーを、`rtSafe: false` は id の有無にかかわらずライブ変更できないことを表します。同じフィールドは `capabilityCatalog()` にも載り、`min` / `max` / `default` の出どころとどこまで信頼できるかは[カタログの値域の読み方](./mastering-processors.md#カタログの値域の読み方)で説明しています。値域、表示範囲、`dependsOn` は構築時の受理条件を表し、リアルタイムのパラメータ経路ではクランプされます。公開される境界は内側へ丸められるため、公開された限界値は常にインサートが受理する値です。

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

ドキュメントそのもの — どのサーフェスが返すか、記述子のフィールド、スロットメタデータ、値域の実測方法 — は [機能カタログが返すもの](./api-surface.md#機能カタログが返すもの) が扱っています。この節はインサートに固有の部分です。ホストが自前の表を持たずに、プロセッサ id からコントロールを並べた操作面をどう組み立てるかを説明します。

手順は、プロセッサごとに API を呼ぶのではなく、1 つのドキュメントを 3 回参照するだけです。

1. **インサート集合を選ぶ。** `processors` を `realtimeInsertable` で絞ります。95 エントリ中 84 で、`masteringInsertNames()` が返す集合と同一です。残る 11 はオフラインプロセッサ 7 とペアプロセッサ 4 です。ペアプロセッサ、`final.*`、`maximizer.loudnessOptimize` は空の `params` 配列を持ち、`repair.declick`、`repair.declip`、`repair.trimSilence` は構築時専用の行として自分の `params` を公開します。`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical` はリアルタイムインサートですが、設定はやはり構築時専用です。`category` はピッカーと同じ切り方で集合を分けます（`effects` がこのページの 19 個のクリエイティブ FX id、`voice` が `voice.changer` インサート、その他のカテゴリがマスタリングの各ファミリー）。どのエントリも `causal` を持ち、`repair.declick`、`repair.declip`、`repair.trimSilence` では `false`、すべてのインサートでは `true` です。`channelPolicy` は、ステレオより広いバスでミキサーがそのインサートをどう包むかを示します。リバーブ、モジュレーション、ディレイのインサートは `effects.modulation.ringModulator` を除いて `stereoPairOnly` で、ringModulator は `multichannel` です。
2. **記述子を読む。** インサートの `params` は、その id に対して `masteringInsertParamInfo(id)` が返すリストと同一で、順序も同じです。カタログを持っているホストは、プロセッサごとの呼び出しを必要としません（オフライン専用のリペアプロセッサも同じ呼び出しで答えます）。`id: null` は構築時専用キーを示し、整数の id は Node／WASM の `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)`、Python の `Mixer.schedule_insert_automation(...)`、C ABI の `sonare_strip_schedule_insert_automation` に渡すオートメーション id です。リアルタイムエンジンのセッターは代わりに `name` を取ります（`setTrackStripInsertParamByName` とそのマスター版、バス版）。
3. **各コントロールを配置する。** `type`、`default`、`min`、`max`、`unit`、`choices` から組みます。構築時専用キーにも記述子があるため、フェイザーの `stages`、オートワウの `attackMs` / `releaseMs`、ロータリーの `stereoSpread`、ルームのジオメトリを構築時フィールドとして表現できます。`slot` で所属するスロット群を特定し、プロセッサの `slots` エントリにある `activation`（`anyKey` または `always`）、内側を包む `parent`、`minCrossoverCutoffs` を組み合わせて、その群の存在を表示・検証します。

カタログには `saturation.overdrive` と `saturation.distortion` も `saturation` カテゴリで含まれます。どちらもマルチチャンネルのリアルタイムインサートで、ソロプロセッサでもあります。そのため、ミキサーのチェーン、リアルタイムエンジン、単発のマスタリング適用で同じ ID を使えます。

同じ記述子経路から、現在インサートとして使えるマキシマイザーのコントロールも取得できます。`maximizer.truePeakLimiter`、`maximizer.maximizer`、`maximizer.adaptiveRelease`、`maximizer.softKneeMax` の `ceilingDb` です。GS に結び付いたリアルタイムコントロールも記述子に載ります。`effects.modulation.pitchShifter` の `windowMs`、`preDelayMs`、`preDelay2Ms`、`effects.modulation.rotary` の `stereoSpread`、`accelTauS`、`decelTauS`、`undershootHz`、`drumUndershootHz`、`effects.reverb.dattorro` の `preDelayMs`、`character`、`saturation.bitcrusher` の `typeLadder` です。別の操作表を持たず、記述子一覧を使ってください。

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);   // 95 中 84
const fx = inserts.filter((p) => p.category === 'effects');               // 下の 19 id
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
- **レイテンシとテールはインサートごとで、リバーブでは 0 ではない。** `effects.reverb.convolution`、`effects.reverb.room`、`effects.acoustic.roomMorph` は 256 サンプルのレイテンシを報告します。リバーブのテールは 51,217 サンプル（`room`、`roomMorph`）、72,000（`convolution`）を経て 358,682（`fdn`）まで、ステレオディレイは 120,029 で、いずれも既定パラメータ・48 kHz での値です。報告されるテールは出力が満尺の 1e-5 に下がるまでを覆うので、バウンス長を決める上限として使えます。`realtimeCost` はリバーブでは `moderate`、`velvet` だけが `high`、モジュレーションとディレイはすべて `low` で、`null` になるのは非インサートの 11 個だけです。
- **エフェクト系はパラメータ数が少ない。** 19 プロセッサ合わせて 237 記述子です。全カタログの 5,579 記述子の大半はバンド単位の EQ プロセッサが占めます（`multiband.dynamicEq` だけで 1,019）。記述子の数で自身の大きさを決めるインサート UI は、2 つのファミリーが 1 桁違うことを前提にしてください。

### null と既定値が教えてくれないこと

**`null` の境界が示すのは構築がその値を拒否しないということだけで、どんな値でも意味を持つわけではありません。** 境界がないことは JSON では文字通り `null`（Python では `None`）です。スキーマは `min` と `max` を `number | null` と定め、すべての記述子が両方のキーを持ちます。構築時専用の記述子にも、検証が公開する場合は境界が載ります。一方、string や array のキーは通常 `null` です。`effects.modulation.chorus` は `dryWet` に境界を公開せず、構築は `5` を受け入れ、プロセッサは内部でウェット比を `[0, 1]` にクランプするので、`dryWet: 5` は `dryWet: 1` と同じ音になります。カタログが測るのは構築が拒否する値であり、拒否せず折り畳むプロセッサは `null` を報告します。`null` に対する範囲チェックは、1 種類の誤りしか除外できません。`null` の境界は「頼れる検証がない」と読み、妥当な範囲はパラメータの意味と単位から決めてください。

カタログの有限な値域は受理条件です。たとえば `saturation.bitcrusher.bitDepth` は `min: 2`、`max: 24` を公開し、範囲外の値を拒否します。ゲイン系の一部は、dB から線形値へ変換した結果が有限にならない値も拒否します。大きな上限が実測されても、実用的な操作範囲を意味するわけではありません。

**既定値は設定構造体の初期化子の値にすぎず、プリセットがその値を使うとは限りません。** 構築時専用の記述子は、フォールバックがなければ `default: null` になりますが、プリセットやシーンはそのキーを明示できます。`default` だけで初期化する操作面は、読み込んだシーンに対して誤った値を表示することがあります。シーン自身の `params` から初期化し、シーンが持たないキーだけカタログの既定値に戻し、`null` の既定値にはシーンまたはユーザーの明示値が必要だと扱ってください。

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
| `stereo.binaural` | 測定 HRTF でステレオペアを仮想スピーカーへ配置するプロセッサ |

::: warning ビルドフラグによる有効化
これらの insert ID は、CMake オプション `BUILD_FX` を有効にしたビルドでのみ使えます（内部的にはこのオプションから `SONARE_HAVE_FX` マクロが導出されます）。幾何ベースのルーム系インサート（`effects.reverb.room`、`effects.acoustic.roomMorph`）は `BUILD_ACOUSTIC_SIM` も必要です。オプションを有効にしていないビルドでは、対応する ID は `masteringInsertNames()` に現れません。
:::

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

以下の表は代表的なキーと挙動を取り上げた要約です。完全なビルド別一覧 — chorus／flanger の `preFilterHz` と `preFilterMode`、phaser の `feedback` と `mixMode`、rotary のドラム制御、pitch-shifter の `windowMs`、ステレオディレイの `dampingHz` などの新しいキーを含む — は [`masteringInsertParamInfo(name)`](#パラメータ記述子) または `capabilityCatalog().processors[].params` から取得できます。

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

実用上の注意は次の通りです。

| 項目 | 意味 |
|------|------|
| `effects.reverb.plate` と `effects.reverb.dattorro` | 同じ Dattorro プロセッサの別名 |
| リバーブの params | `decaySec`、`decay`、`damping` / `hfDamping`、`dryWet`、`preDelayMs`、`reverbTimeS`、`densityHz`、`enableShelf`（アルゴリズムにより該当キーは異なる）。`effects.reverb.convolution` は構築時に `decaySec` を、合成テイルの上限である 12 秒へクランプする。Dattorro／プレート insert はコーラスのかかったテイル用に `modRateHz`（図形8タンクの LFO＝低周波オシレーターのレート[Hz]、既定値 `0.5`）と `modDepthSamples`（リバーブ内部の基準レートでの変調深さ[サンプル]、既定値 `6.0`、単位は `samples`）も受け付ける |
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
| `effects.filter.vowel` の params | `vowel`、`accelMs`、`drive`、`driveOn`、`dryWet` |
| `stereo.binaural` の params | `azimuthDeg`、`autoTurn`、`turnRateHz`、`clockwise`、`output`（`0` = スピーカー、`1` = ヘッドホン）、`dryWet` |
| `effects.reverb.convolution` の IR | インパルス応答（IR。実際の空間が短い衝撃音にどう応答するかを記録したもの）は、insert params の `irF32Base64` キーに base64 の float32 として渡す。シーン JSON でも他の経路でも同じ |
| IR のない convolution insert | prepare 時に `decaySec`（RT60 相当の長さ。12 秒にクランプ）と `seed` から減衰ノイズの IR を合成するので、パススルーにはならず、他のアルゴリズミックリバーブと同様にテールを生成する |

::: warning 幾何ベースのルーム系インサートは `absorption` をクランプせず検証する
`effects.reverb.room` と `effects.acoustic.roomMorph` は、`[0, 1]` に正規化した吸音係数 `absorption` を受け取ります。この区間から外れた値は**拒否**され、最も近い有効な値に丸めて構築されることはありません。

クランプの方が一見親切ですが、ここでは適切ではありません。百分率や別スケールの反射係数、あるいは dB 値を正規化済みのフィールドへ渡した場合、意図しない部屋がそのまま構築され、テイルが短すぎる／長すぎるという形でしか誤りが表に出ません。同じ係数を渡す他の経路 — これらのインサートのバンド別 absorption 配列と、オフラインのルームインパルス合成のファサード — はすでにパラメータエラーを返すため、スカラー経路も同じ挙動にしています。
:::

幾何ベースのルーム系インサートは、ステレオペアの受音点のどちらかが部屋の外に出る配置を InvalidParameter で拒否します。したがって、側壁までの距離が受音点間隔の半分より小さいリスナーは、モノラルのストリップでも拒否されます。カタログの実測した範囲もこれに従い、`listenerX` と `listenerY` は壁の内側に収まる最小値・最大値を公開し、`lengthM` と `widthM` の最小値はそれに合わせて引き上げられます。ライブラリはそのようなリスナーを動かさずに拒否します。動かしたリスナーは別の部屋の響きになるからです。受音点間隔を `s` とすると、`[s/2, lengthM - s/2]` × `[s/2, widthM - s/2]` の内側のリスナーは必ず構築できるので、保存済みのシーンが拒否されたら、リスナーをこの範囲に移してください。ステレオのストリップでは、各チャンネルが間隔をあけた 2 つの受音点（`receiverSpacingM`。省略または 0 で 0.5 m、最大 2.5 m）のうち自分の側で聞こえるターゲットルームと畳み込まれるため、付加されるルームは中央に寄らず、左右で同一にもなりません。後部のテールは、それだけ離れた 2 点の拡散音場コヒーレンスに従います。モノラルのストリップは単一リスナーの応答のままです。オフラインのモノラル `roomMorph` は受音点のペアを置かないので、そのような配置も受け付けます。

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

これらの id は [ミキシングシーン JSON](./mixing-scene-json.md) の `insert.processor` フィールドで使います。出荷される FX 有効の WASM ビルドでは、幾何ベースの `effects.reverb.room` と `effects.acoustic.roomMorph`、新しめのモジュレーションインサート（`effects.modulation.ensemble`、`wah`、`autoWah`、`rotary`、`ringModulator`、`pitchShifter`）を含め、すべてのインサート id が `masteringProcessorNames()` に含まれ、単発の適用経路で実行できます。そのため、同じパラメータマップをミキサーのチェーン、リアルタイムエンジン、`masteringProcess(...)` のどれでも使えます。単発呼び出しは `latencySamples` にインサートのレイテンシを報告します（コンボリューションと幾何ベースのルームのインサートは 256）。

## 関連

- [ミキシングエンジン](./mixing.md) — これらをチャンネルストリップ／バスのインサートとして読み込む
- [ミキシングシーン JSON](./mixing-scene-json.md) — `insert.processor` フィールドのリファレンス
- [マスタリングプロセッサ](./mastering-processors.md) — 名前付きマスタリングプロセッサ／プリセット／解析のレジストリ
