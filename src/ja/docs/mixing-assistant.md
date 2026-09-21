---
title: ミキシングアシスタント
description: オフラインのミキシングアシスタント。複数トラックを計測し、判断ごとの理由を添えたミキサーシーンを返します。音声そのものには一切触れません。
---

# ミキシングアシスタント

アシスタントに複数のトラックを渡すと、各トラックを計測し、さらにトラック*同士*のあいだで起きていることを計測して、**ミキサーシーン**を返します。入力トリム、フェーダー、パンと幅、補正 EQ、ダイナミクス、エフェクトバスとセンド — そのすべてに、なぜそう判断したかの文章が付きます。

::: warning 提案はしますが、適用はしません
音声は一切処理されず、出力もされません。アシスタントはバッファを読み、パラメータを返すだけです。そのシーンをミキサーへ渡すのは呼び出し側が明示的に行う `Mixer.fromSceneJson` のステップであり、両者をまとめて実行する便利なエントリポイントは意図的に用意していません。ミックスに唯一の正解はないため、人が提案を受け入れるか手を入れるかを決めるその瞬間こそが、この API の目的だからです。
:::

ストリップ・センド・バスがまだ馴染みのない語であれば、先に [ミキシングの基礎](./glossary/concepts/mixing-basics.md) と [ミキシングエンジン](./mixing.md) を読んでください。シーンのドキュメント自体は [ミキシングシーン JSON](./mixing-scene-json.md) にフィールド単位で規定されています。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 複数トラックに対してアシスタントを呼び出し、返ってくるシーン・トラックごとの計測値・説明文を読める。
- 提案を実際のミックスへ、意図された 2 段階の手順として反映できる。
- アシスタントが何を「やらない」かを予測できる。とくに EQ の提案がなぜ少ないのかを理解できる。
- 劣化した入力と拒否される入力を区別し、ビルドにアシスタントが含まれているかを判定できる。

## よくある使い方

トラックを計測し、理由を確認し、シーンを読み込みます。

::: code-group

```typescript [Node]
import { suggestMixScene, Mixer } from '@libraz/libsonare-native';

const result = suggestMixScene({
  sampleRate,
  tracks: [
    { id: 'kick',   name: 'Kick',   left: kick },
    { id: 'bass',   name: 'Bass',   left: bass },
    { id: 'guitar', name: 'Gtr L',  left: guitarL, right: guitarR },
    { id: 'vocal',  name: 'Lead Vox', left: vocal },
  ],
  options: { targetTrackLufs: -18, suggestionStrength: 0.8 },
});

for (const line of result.explanation) console.log(line);

// この時点でまだ音声には何も起きていません。適用するのは次の行です。
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
import json

import libsonare as sonare

result = sonare.suggest_mix_scene(
    [
        sonare.MixTrackInput("kick", kick, name="Kick"),
        sonare.MixTrackInput("bass", bass, name="Bass"),
        sonare.MixTrackInput("guitar", guitar_l, guitar_r, name="Gtr L"),
        sonare.MixTrackInput("vocal", vocal, name="Lead Vox"),
    ],
    sample_rate=sample_rate,
    target_track_lufs=-18.0,
    suggestion_strength=0.8,
)

for line in result["explanation"]:
    print(line)

mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix \
  --input kick=kick.wav --input bass=bass.wav \
  --input guitar=guitar.wav --input vocal=vocal.wav \
  --sample-rate 48000 \
  --params targetTrackLufs=-18,suggestionStrength=0.8 \
  --scene-out scene.json
```

:::

::: tip トラック名はラベルではなくヒント
`name` はソース分類に使われます。分類器が計測で判定できるクラスについては、名前は確信度を調整するだけで、それ単独でクラスを決めることはできません。計測では区別できない 4 クラス — `keys`、`strings`、`backing`、`fx` — についてのみ、名前がクラスを与える唯一の手がかりになり、しかも計測が答えを出せなかったときに限られます。UI に表示している名前をそのまま渡してください。命名規約に依存する箇所はありません。
:::

## 学習ではなくルールベース

ここには学習済みモデルも、統計的分類器も、学習されたパラメータもありません。ソース分類は計測特徴量 — スペクトル重心、ロールオフ、平坦度、オンセット密度、サステイン比、voicing — に対する単層の決定表であり、その下流の判断はすべて、ソースで読める閾値を持ったルールです。

ルールの出発点となる数値はスタジオの慣習です。同じ量をプロの制作実務について測った査読付きの調査がある場合には、慣習をそのまま主張するのではなく、その調査と突き合わせてあります。リバーブのリターンレベル、リバーブのプリディレイ、リードボーカルの定位、広いパンの幅、コンプレッションレシオの周波数順 — これらはいずれも P. Pestana, J. D. Reiss, *Intelligent Audio Production Strategies Informed by Best Practices*, AES 53rd International Conference on Semantic Audio, London, 2014 に由来します。

::: info UI にとって何が重要か
ルールベースのアシスタントは、常に理由を言えます。`explanation` が生成された講評ではなく実用的な機能である理由はここにあります。各行は、変更を生んだルール自身が、その変更を生んだ瞬間に出力したものです。あとからまとめ直したり言い換えたりする処理はありません。
:::

## エントリポイント

| サーフェス | エントリポイント | 形 |
|---|---|---|
| WASM（`@libraz/libsonare`） | `suggestMixScene(request)` | リクエストオブジェクト 1 つ（`{ tracks, sampleRate, options? }`）。同期。`MixAssistantResult` を返します。 |
| Node（`@libraz/libsonare-native`） | `suggestMixScene(request)` | 同じリクエストオブジェクトと同じ結果。同期。 |
| Python（`libsonare`） | `suggest_mix_scene(tracks, *, sample_rate, ...)` | トラックは位置引数、オプションはすべて snake_case のキーワード。`dict` を返します。 |
| C ABI | `sonare_mixing_assistant_suggest_scene_json(...)` | フラットな C 配列と `SonareMasteringParam` のリスト。JSON を `char** json_out` へ書き出します。 |

`sampleRate` はどのサーフェスでも必須で、既定値はありません。

いずれにも、パース済みではなく直列化済みのドキュメントを返す `...Json` 版があります。`suggestMixSceneJson`、`suggest_mix_scene_json`、そして C 側では完全な結果を返す `sonare_mixing_assistant_suggest` に対し、シーンだけを返す `sonare_mixing_assistant_suggest_scene_json` です。後者は、提案を適用したいだけの呼び出し側が、より大きな結果ドキュメントからシーンを掘り出して再直列化せずに済むように用意されています。C の文字列は `sonare_free_string` で解放してください。

ソースクラス名の一覧は実行時に `mixSourceClassNames()` / `mix_source_class_names()` で取得でき、逆引きは `mixSourceClassFromName(name)` です。

## オプション

オプション集合は意図的にフラットです。入れ子のグループも、ドメインごとのサブオブジェクトもありません。すべて省略可能で、省略したキーはそもそも転送されないため、コア側の既定値がそのまま効きます。

| キー（JS） | 型 | 既定値 | 意味 |
|---|---|---|---|
| `targetTrackLufs` | number | `-18.0` | トラックごとの Integrated ラウドネス目標。読み込んだ集合の平均ではなく絶対値なので、静かなセッションはそのまま放置されず引き上げられます。 |
| `suggestionStrength` | number | `1.0` | `[0, 1]`。レベル系の判断すべてをスケールします。 |
| `eqMaxCutDb` | number | `4.0` | 1 つのカットの上限。 |
| `mixBusHeadroomDbtp` | number | `-6.0` | マスターの静的トリムの目標値。 |
| `tempoBpm` | number | `0.0` | `0` はトランスポート側のフォールバックテンポを選びます。20〜400 の外にある正の値はクランプされず拒否されます。 |
| `enableStructure` | boolean | `true` | バス構成とルーティング。 |
| `enableGain` | boolean | `true` | 入力トリムとラウドネスの段取り。 |
| `enableBalance` | boolean | `true` | フェーダー。 |
| `enableEq` | boolean | `true` | 補正 EQ。 |
| `enableDynamics` | boolean | `true` | コンプレッション。 |
| `enableImage` | boolean | `true` | パンと幅。 |
| `enableHighPass` | boolean | **`false`** | トラックごとのハイパス。既定でオフです（[後述](#控えめな-eq-と-enablehighpass)）。 |
| `nFft` | number | `2048` | 共通の [STFT](./glossary/analysis/spectrogram-stft.md) ジオメトリ。 |
| `hopLength` | number | `512` | |

Python は同じキーを snake_case で受け取ります（`target_track_lufs`、`enable_high_pass`、`n_fft` など）。C ABI は camelCase の綴りを `SonareMasteringParam` のエントリとして受け取ります。

::: warning `suggestionStrength: 0` は「何も提案しない」ではありません
レベル系の判断はゼロへ向かってスケールしますが、バス構成、ルーティング、極性、アライメントディレイ、低域のモノラル化はスケールしません。これらは構造的な決定であり、半分だけ適用されたルーティンググラフはミックスとして成立しないからです。したがってゼロでも、バスとセンドと補正を含んだシーンが返ります。あるドメインについて何も提案させたくない場合は、そのドメインごとオフにしてください。
:::

::: info 無効化したドメインは計測もされません
`enableEq: false` は「かぶりは計測するがカットは提案しない」ではありません。そのドメインは評価自体が行われないため、そこへ供給される計測も実施されません。ドメインを切るのは呼び出しを軽くする手段であって、助言抜きで解析結果だけを得る手段ではありません。
:::

## 返ってくるもの

`MixAssistantResult` は 4 つのフィールドを持ちます。

| フィールド | 型 | 内容 |
|---|---|---|
| `scene` | `MixSceneDocument` | `Mixer.fromSceneJson` が読むドキュメント。スキーマは [ミキシングシーン JSON](./mixing-scene-json.md) です。 |
| `tracks` | `MixAssistantTrackProfile[]` | トラックごとの計測値。入力順。 |
| `mix` | `MixAssistantMixProfile` | トラック*間*で計測されたもの。 |
| `explanation` | `string[]` | 適用順に並んだ理由。 |

### `tracks` — 各トラックが何であるか

| フィールド | 意味 |
|---|---|
| `stripId`、`name` | 渡した値そのまま。 |
| `source` | 分類されたソース。`unknown` `kick` `snare` `hiHat` `tom` `cymbal` `bass` `guitar` `keys` `strings` `lead` `vocal` `backing` `percussion` `fx` のいずれか。 |
| `sourceConfidence` | 決定表がどれだけ確信したか。 |
| `usable` | 計測できなかったトラックでは `false`。使えないトラックには、ゼロの提案ではなく提案そのものが付きません。 |
| `exclusionReason` | `usable` が `false` のとき、その理由を文章で。 |
| `channelCount`、`durationSec` | バッファの形。 |
| `integratedLufs` | `number \| null`。計測値が `-Infinity` になる場合（ゲート済みブロックが 1 つもないトラック）は **`null`** です。JSON にその数値表現がないためです。 |
| `truePeakDb`、`crestFactorDb` | レベルとピーク対 RMS のコントラスト。 |
| `spectralCentroidHz`、`spectralFlatness` | 明るさとノイズらしさ。 |
| `attackDensity`、`sustainRatio` | どれだけ打撃的か、どれだけ持続的か。 |
| `bandOccupancy` | そのトラック自身のエネルギーに占める、バンドごとの比率。 |

`bandOccupancy` は 7 つのバンド名をキーに持ちます。EQ の理由文はすべてこのバンド名で書かれるため、範囲を覚えておく価値があります。

| バンド | 範囲 |
|---|---|
| `sub` | 20〜60 Hz |
| `low` | 60〜250 Hz |
| `lowMid` | 250〜500 Hz |
| `mid` | 500 Hz〜2 kHz |
| `highMid` | 2〜6 kHz |
| `high` | 6〜12 kHz |
| `air` | 12 kHz〜ナイキスト周波数 |

### `mix` — トラック間で起きていること

| フィールド | 内容 |
|---|---|
| `trackCount` | プロファイルされたトラック数。 |
| `bandDominance[]` | どのトラックがどのトラックを、どのバンドで、どれだけマスクしているか（`masker`、`maskee`、`band`、`ratio`、`validFrames`）。 |
| `alignment[]` | ペアごとのタイミングと極性（`reference`、`target`、`lagSamples`、`correlation`、`polarityOpposed`）。 |
| `crowdedBands[]` | セッション全体が奪い合っているバンド。 |
| `monoRisks[]` | モノラルで一部が消えるストリップ（`correlation`、`width`、`wideLowEnd`）。 |

## 説明文の読み方

`explanation` は各差分が適用されるたびに組み立てられ、あとからまとめ直されることはありません。したがって上から順に読めば、シーンがどう構築されたかをそのまま追えます。すべてのドメインが無効な場合や、使えるトラックが 1 つもない場合は空になります。

アシスタントの慎重さは文面に現れます。EQ の理由は、周波数を示し、その周波数が**計測されたもの**なのかバンド中心へのフォールバックなのかを述べ、**両方**のパートの比率を挙げます。

```text
carved 3.2 dB at 1247 Hz (measured overlap in mid, which vocal needs at 41.6%
of its energy and guitar can spare at 12.4% of its own) out of guitar to make
room for the parts it shares those bands with
```

カットが `eqMaxCutDb` に当たった場合は、衝突が解決したふりをせず、そのことを明記します。

```text
…; the mid cut was held at the 4.0 dB ceiling, so the collision is only partly resolved
```

これは編集可能なコントロールに添えるキャプションとして優秀です。そのバンドでボーカルが自身のエネルギーの 41.6% を必要とし、ギターは 12.4% しか使っていない — それが見えているユーザーは、数値には異を唱えつつ、理屈には同意できます。

## 提案をミックスにする

常に 2 段階で、その 2 つは意図的に分かれています。

::: code-group

```typescript [Node]
const result = suggestMixScene({ sampleRate, tracks });
// …result.explanation を表示し、result.scene をユーザーに編集させる…
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
result = sonare.suggest_mix_scene(tracks, sample_rate=sample_rate)
# …result["explanation"] を表示し、result["scene"] をユーザーに編集させる…
mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix --input kick=kick.wav --input vocal=vocal.wav --scene-out scene.json
sonare mix --scene scene.json --input kick=kick.wav --input vocal=vocal.wav
```

:::

`suggest-mix` は両方のコマンドラインフロントエンドにあります。2 つめのコマンドはそうではありません。**`mix --scene` は Python 専用**なので、提案されたシーンを最後までレンダリングするシェルパイプラインは、後半に PyPI の `sonare` CLI を必要とします。

アシスタントが書き出すシーンは、ごく普通のミキサーシーン — レーン、フェーダー、センド、バス — です。下のデモはアシスタントではなくミキサーそのものですが、提案が最終的に何になるのかを示しています。実際のシーンを読む前に、シーンとは何かの感覚をつかむのに向いています。

<SonareDemo id="engine-lane-mixer" />

## 控えめな EQ と `enableHighPass`

アシスタントが提案する EQ は、初めて読む人の予想よりずっと少なく、それは機能の欠落ではなく設計です。

バンドが削られるのは、一方のパートがそのバンドで**成り立っていて**、もう一方がそこを**譲れる**場合だけです。判定は、各トラック自身のエネルギーに占めるそのバンドの比率で行われます。双方がそのバンドで成り立っている 2 つのパートがぶつかった場合、何も提案されません。どちらかの土台を抜いてしまわないカットが存在しないからです。キックとベースがどちらも 80 Hz に居るのはアレンジの問題であり、そうでないふりをする EQ は、どちらかを痩せさせるだけです。

カットが正当化された場合、その中心周波数はバンドの中点ではなく、バンド内で計測されて決まります。ここでのバンドは最大 2 オクターブに及ぶため、中点はカットの根拠となったかぶりから 1 オクターブ離れた位置に来ることがあります。よく考えられたカットが的外れな音程に落ちるのは、まさにこの経路です。理由文には、2 つのうちどちらが起きたかが書かれています。

::: info トラックごとのハイパスが既定でオフな理由
`enableHighPass` の既定値は `false` です。上記と同じ調査は、全トラック一律のハイパスがスタジオのミキシングでは多用されておらず、主観評価による裏付けもないことを示しています。伝統的だからという理由で既定適用してよいものではない、ということです。

有効にした場合、フィルターはクラスのラベルではなく、そのトラックの**音域より下で計測されたエネルギー**から提案されます。低く書かれたパートは、演奏している音をそのまま保てます。コーナー周波数は「ギターなら 80 Hz 以下には何もない」という前提ではなく、録音そのものに従います。
:::

## はっきり述べておくべき 2 つの挙動

**劣化した入力はエラーではありません。** トラックが 1 つもない、無音のトラック、計測できないほど短いトラック、サンプルレートが正でない、バッファに NaN や無限大が混じっている — いずれも例外を投げません。呼び出しは成功し、空のシーン、空の説明文、そしてトラックごとの `exclusionReason` が返ります。

| `exclusionReason` | 原因 |
|---|---|
| `track has no samples` | バッファが null、またはフレーム数がゼロ。 |
| `track sample rate is not positive` | |
| `track has non-finite samples` | NaN または無限大。無音と誤診せず、そのものとして名指しされます。 |
| `track is shorter than the minimum measurable duration` | |
| `track is silent` | |
| `track has no energy in the analysis bands` | |

**唯一拒否される入力は、トラック ID の重複です。** これは吸収されずに `InvalidParameter` を発生させます（Node では `RangeError`、Python では `SonareValueError`）。同じ ID のストリップを 2 つ持つシーンは、ミキサーが読み込みを拒否するシーンだからです。ここで受け入れても、失敗をより読みにくい場所へ動かすだけです。

## 利用可否

アシスタントは切り離し可能なビルド単位です。`BUILD_MIXING_ASSISTANT` の既定は **ON** で、有効にすると `BUILD_MIXING` も強制的に有効になります。一方 `SONARE_WASM_ANALYSIS_ONLY` はこれを強制的に **OFF** にするため、解析専用の WASM モジュールはアシスタントを含みません。

::: warning シンボルではなくケーパビリティを見てください
```typescript
import { capabilities } from '@libraz/libsonare';

if (capabilities().features.mixingAssistant) {
  // 呼び出して安全
}
```
`typeof suggestMixScene === 'function'` は判定として**成立しません**。アシスタントを含まないビルドでもエントリポイントは登録されたままで、呼ぶと例外になります（C ABI では `SONARE_ERROR_NOT_SUPPORTED` を返します）。つまりシンボルはどちらの場合も存在します。
:::

## 関連ページ

- [ミキシングシーン JSON](./mixing-scene-json.md) — アシスタントが返す `scene` のスキーマ
- [ミキシングエンジン](./mixing.md) — それを読み込むミキサー
- [マスタリングアシスタント](./mastering-assistant.md) — 1 段あとの工程における、同じ「説明してから決める」形
- [チャンネルストリップ](./glossary/mixing/channel-strip.md) · [バスとセンド](./glossary/mixing/buses-sends.md) · [パンとステレオ幅](./glossary/mixing/pan-width.md) · [モノラル互換性](./glossary/concepts/mono-compatibility.md)
