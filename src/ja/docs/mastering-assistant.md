---
title: マスタリングアシスタント API
description: libsonare の説明可能なマスタリング補助 API、masteringAudioProfile・masteringAssistantSuggest・masteringStreamingPreview を、実際に返る JSON と、提案をマスターへレンダリングする方法とともに解説します。
---

# マスタリングアシスタント API

libsonare は、レンダリング済み音声だけでなく*判断根拠*を扱いたいアプリ向けに、**JSON を返す**マスタリング補助 API を 3 つ提供します。**ローカル DSP 解析のみ**で動作し、アップロードも外部モデルも使いません。UI 表示やレポート保存に使える構造化 JSON を返します。アシスタントは指定したプリセットを出発点にし、省略時は `streaming` を使います。

「LUFS」「True Peak」「クレストファクター」「トーナルバランス」に馴染みがなければ、先に [マスタリングとは?](./glossary/concepts/what-is-mastering.md) と [メーターの読み方](./glossary/mastering/meter-reading.md) を読んでください。本ページは用語を前提に、JSON の仕様に絞って説明します。

::: info 「アシスタント」は自動仕上げボタンではない
ここでのアシスタントは、音源を測定し、なぜその処理が妥当そうかを JSON で説明する補助 API です。実際の音作りは、提案をユーザーが確認・調整し、別のレンダリング API に渡して行います。
:::

最初に組み込む場合は、次の順で読むと分かりやすくなります。

1. `masteringAudioProfile(...)` で、元音源の状態をユーザーに見せる。
2. `masteringAssistantSuggest(...)` で、編集可能なマスタリングチェーンのたたき台を作る。
3. ユーザーが提案を確認・調整してからレンダリングする。
4. `masteringStreamingPreview(...)` で、配信プラットフォームが音量をどう扱うか説明する。

::: tip アシスタントの位置
アシスタントは**説明と提案**を行い、あなたの代わりに決定はしません。よい流れは、ソースを*プロファイル*→方向を*提案*→ユーザーが調整→*レンダリング*→ストリーミング各社での再生を*プレビュー*、です。最終判断は耳で行ってください。JSON は UI の材料であって、耳の代わりではありません。
:::

3 つのヘルパーは、UI 上では別々のボタンとして考えると分かりやすくなります。

| ボタン | ユーザーが期待すること | ヘルパー |
|--------|------------------------|----------|
| ソースを解析 | 「このファイルの状態を教えてほしい」 | `masteringAudioProfile` |
| 出発点を提案 | 「編集できる初期設定を入れてほしい」 | `masteringAssistantSuggest` |
| 配信を確認 | 「YouTube / Podcast などで音量がどう扱われるか知りたい」 | `masteringStreamingPreview` |

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- ソースプロファイル、チェーン提案、レンダリング、配信プレビューを別々の UI ステップとして扱える。
- JSON を返す 3 つのヘルパーをパースし、どのフィールドが測定値で、どれが提案かを区別できる。
- ユーザー調整を残したまま、アシスタントの提案を `masteringChain` のレンダリングへ渡せる。
- これらのヘルパーがリモート自動マスタリングではなく、ローカル DSP 解析である理由を説明できる。

## 3 つの API の概要

| ステップ | JavaScript | Python | 戻り値 |
|----------|------------|--------|--------|
| ソースを調べる | `masteringAudioProfile(samples, sr)` | `mastering_audio_profile(...)` | 測定プロファイル |
| チェーンを提案 | `masteringAssistantSuggest(samples, sr, params)` | `mastering_assistant_suggest(...)` | レンダリング可能なチェーン設定 + 根拠 |
| 配信をプレビュー | `masteringStreamingPreview(samples, sr, platforms)` | `mastering_streaming_preview(...)` | プラットフォーム別の正規化 |

3 つとも **JSON 文字列**を返します — `JSON.parse`（JS）または `json.loads`（Python）で解析してください。スキーマは C・Node・Python・WASM バインディングで同一です。PyPI 版 `sonare` CLI でも `sonare mastering-profile`・`sonare mastering-suggest`・`sonare mastering-streaming` として同じ JSON を標準出力に得られます。

3 つにはそれぞれ、1 本のバッファではなく左右のペアを受け取るステレオ版があります。返す JSON スキーマは同じなので、このページの内容は両方にそのまま当てはまります。モノラル版では不十分になる場面については[ステレオ素材](#ステレオ素材)を参照してください。

| ステップ | モノラル | ステレオ |
|----------|----------|----------|
| ソースを調べる | `masteringAudioProfile` | `masteringAudioProfileStereo` |
| チェーンを提案 | `masteringAssistantSuggest` | `masteringAssistantSuggestStereo` |
| 配信をプレビュー | `masteringStreamingPreview` | `masteringStreamingPreviewStereo` |

3 つのヘルパーは、それぞれ別の問いに答えます。

| ヘルパー | 答える問い | 測定か提案か |
|----------|------------|--------------|
| `masteringAudioProfile` | 「この元音源はどんな状態か？」 | 測定のみ |
| `masteringAssistantSuggest` | 「どんなチェーンを出発点にするとよさそうか？」 | プロファイルに基づく提案 |
| `masteringStreamingPreview` | 「配信側でどれくらい上げ下げされるか？」 | ラウドネス測定に基づく配信シミュレーション |

::: code-group

```typescript [ブラウザ]
import { init, masteringAudioProfile, masteringAssistantSuggest, masteringStreamingPreview } from '@libraz/libsonare';
await init();

const profile    = JSON.parse(masteringAudioProfile(samples, sampleRate));
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: 'pop', targetLufs: -14, ceilingDb: -1 }));
const preview    = JSON.parse(masteringStreamingPreview(samples, sampleRate, [
  { name: 'YouTube',  targetLufs: -14, ceilingDb: -1 },
  { name: 'Podcast',  targetLufs: -16, ceilingDb: -1 },
]));
```

```python [Python]
import json
import libsonare as sonare

profile    = json.loads(sonare.mastering_audio_profile(samples, sample_rate=sr))
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"preset": "pop", "targetLufs": -14, "ceilingDb": -1}))
preview    = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sr, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

```bash [CLI]
sonare mastering-profile source.wav
sonare mastering-suggest source.wav --preset pop --params targetLufs=-14,ceilingDb=-1
sonare mastering-streaming source.wav \
  --platforms '[{"name":"YouTube","targetLufs":-14,"ceilingDb":-1},{"name":"Podcast","targetLufs":-16,"ceilingDb":-1}]'
```

:::

### 型付きの結果

ヘルパーは JSON 文字列を返しますが、宣言された型がパース後の形を持っています。TypeScript では `masteringAudioProfile` が `TypedJson<MasteringAudioProfile>`、`masteringAssistantSuggest` が `TypedJson<MasteringAssistantResult>`、`masteringStreamingPreview` が `TypedJson<MasteringStreamingPreviewResult>` を返します（ステレオ版も同じ型です）。`TypedJson<R>` は実行時には単なる `string` で、`JsonResult<J>` がその結果型を取り出すので、形を書き直さずにパース結果へ型を付けられます。

```typescript
import { masteringAudioProfile, type JsonResult } from '@libraz/libsonare';

const profile: JsonResult<ReturnType<typeof masteringAudioProfile>> = JSON.parse(
  masteringAudioProfile(samples, sampleRate),
);
profile.spectral.midRmsDb;      // number
profile.defects.measured;       // boolean
```

`MasteringAssistantResult.profile` は平坦な `MasteringAssistantProfile`（無音またはゲート未満の入力では `integratedLufs` が `null`）、`chainConfig` は `MasteringChainConfigDocument`（`version: 1 | 2`）で、配信プレビューの各行の `integratedLufs` は `number | null` です。Python は `MasteringAudioProfile`、`MasteringAssistantResult`、`MasteringStreamingPreviewResult` を `libsonare` の `TypedDict` として宣言しています。

::: warning 短いクリップ: profile と suggest は動くが、意味のある結果には実際のスペクトル成分が必要
`masteringAudioProfile` と `masteringAssistantSuggest` は [STFT](./glossary/analysis/spectrogram-stft.md)（短時間フーリエ変換。短い窓を少しずつずらしながら周波数解析する手法）ベースの解析全体を実行します（既定の `nFft` は 2048）。例外を投げるのは**完全に空のバッファ**だけです（`SonareError`、メッセージは "audio input must be a non-empty buffer"）。どれほど短くても、空でなければバッファは受理され、解析されます。`nFft` サイズの窓（既定 2048 サンプル）はあくまで目安であってエラー条件ではありません。1 窓ぶんより短いバッファは、意味のあるプロファイルを得るにはスペクトル成分が足りないというだけなので、「`nFft` より短い」はガードすべき失敗ではなく、UI に出す品質上の注意として扱ってください。`masteringStreamingPreview` はラウドネスを測るだけなので、空でない音声バッファであればどんなバッファでも受け付けます。`platforms` が空リストでも問題なく、その場合は既定のプラットフォーム集合（Spotify、Apple Music、YouTube）にフォールバックします。UI から短い録音やファイル選択を渡すときは、profile／suggest の呼び出しを `isSonareError` を使った `try`／`catch` で囲んで空バッファのケースに備え、`nFft` より短い場合はハードブロックではなく、長さについての控えめな注意表示を検討してください。

```typescript [ブラウザ]
import { masteringAudioProfile, isSonareError } from '@libraz/libsonare';

const ONE_ANALYSIS_WINDOW = 2048; // 既定の nFft — ハード制限ではなく品質のヒント
const shortClip = samples.length < ONE_ANALYSIS_WINDOW; // 「スペクトル成分が限定的」と注記する

try {
  const profile = JSON.parse(masteringAudioProfile(samples, sampleRate));
  if (shortClip) {
    // 成功はしている — UI では低信頼度の結果として表示する
  }
} catch (err) {
  if (isSonareError(err)) {
    // ここに来るのは完全に空のバッファのときだけ
  } else {
    throw err;
  }
}
```
:::

## `masteringAudioProfile` — ソースを測る

入力の読み取り専用の要約です。どれだけ大きいか、スペクトル全体にエネルギーがどう広がっているか、どれだけダイナミックか、任意の不具合検出が何を見つけたかを示します。何も処理しません。

任意の `params` は JS 風／Python 風のどちらの名前も受け付けます: `nFft`/`n_fft`（既定 `2048`）、`hopLength`/`hop_length`（既定 `512`。2 つとも 48 kHz でのサンプル数で、入力のレートに換算され、帯域レベルはレートをまたいで揃うよう正規化されます）、`truePeakOversample`/`true_peak_oversample`（既定 `4`）、`detectDefects`/`detect_defects`（既定 `false`）です。

::: info True Peak でオーバーサンプリングする理由
保存されたサンプルの位置は固定されていますが、帯域制限された波形を再構成すると*サンプル間*でピークが高くなることがあります。ここでは 4 倍の補間フィルターでサンプル間ピークを推定します。`truePeakDb` はそのフィルターによる再構成波形の近似値で、個々のコンバーターのアナログ出力を測った値ではありません。倍率を上げると推定精度を高められますが、CPU 負荷も増えます。
:::

この結果は、元音源を説明するために使います。合否判定ではありません。たとえば「すでに大きい」「暗い」「密度が高い」「アタックが多い」といった事実を UI に出すためのものです。

| すること | しないこと |
|----------|------------|
| ラウドネス、True Peak、クレストファクター、スペクトル、ダイナミクス、任意の不具合を測る | 音声を変更しない |
| レンダリング前に UI へ表示する材料を返す | 最終設定を単独では決めない |

例は合成した 4 秒ループ（キック、ハイハット、パッドをソフトクリップしたもの）のプロファイルで、数値はあくまで例示です。

```json
{
  "durationSec": 4,
  "bpm": 119.87,
  "bpmConfidence": 0.76,
  "loudness": {
    "integratedLufs": -9.47,
    "lraLu": 0.02,
    "truePeakDb": -1.94,
    "crestFactorDb": 6.22
  },
  "spectral": {
    "subRmsDb": -29.0, "lowRmsDb": -9.29, "lowMidRmsDb": -15.2, "midRmsDb": -25.5,
    "highMidRmsDb": -43.0, "highRmsDb": -41.44, "airRmsDb": -38.54,
    "centroidHz": 1100.33, "flatness": 0.0017, "rolloffHz": 2327.98
  },
  "dynamics": { "shortTermLufsStd": 0.009, "attackDensity": 3.75, "sustainRatio": 0.997 },
  "defects": { "measured": false }
}
```

`defects` は省略した形です。`detectDefects` を有効にしないと `measured` は `false` で、ほかの不具合フィールドも測定値ではなく既定値のまま含まれます。

| グループ | フィールド | 意味 |
|----------|-----------|------|
| `loudness` | `integratedLufs` | 全体の[ラウドネス](./glossary/lufs.md)（EBU R128） |
| | `lraLu` | ラウドネスレンジ — 時間方向のラウドネス変動 |
| | `truePeakDb` | サンプル間ピークを含む [True Peak](./glossary/true-peak.md) |
| | `crestFactorDb` | ピーク対 RMS の差 — 大 = パンチ、小 = 密度（[クレストファクター](./glossary/concepts/crest-factor.md)） |
| `spectral` | `subRmsDb` … `airRmsDb` | 帯域ごとのエネルギー（sub → air）。ノイズ系フィールドと同じ平均二乗の規約による dBFS で、フルスケールの正弦波はその帯域で −3.01 dBFS になる |
| | `centroidHz` | スペクトルの「重心」— 明るさの目安 |
| | `flatness` | 0 = トーン的、1 = ノイズ的 |
| | `rolloffHz` | エネルギーの大半が収まる周波数 |
| `dynamics` | `attackDensity` | 打撃的な立ち上がりが固定の下限を超えたオンセットの 1 秒あたりの数。持続音は 0 になる |
| | `sustainRatio` | 持続的か過渡的か |
| `defects` | object | 不具合のカウンターと測定値。`detectDefects` を有効にしない場合は `measured` が `false` |

::: info スペクトル帯域の読み方
`*RmsDb` のフィールドは低域から高域へ並びます: `sub`（重低音）→ `low`/`lowMid`（低音と温かみ）→ `mid`（芯、ボーカル）→ `highMid`/`high`（存在感、明瞭さ）→ `air`（高域のきらめき）。

これらの値は、プロファイルのノイズ系フィールドと同じ平均二乗の規約による dBFS です。そのため、ノイズフロアや他の帯域と同じ尺度で読めます。フルスケールの 1 kHz 正弦波はその帯域で −3.01 dBFS（`mid` 帯域で実測 −3.03）になり、ほかの帯域では −49 dBFS 以下です。上のループで `lowRmsDb: -9.29` が最大なのは、キックとパッドがこの帯域にあるからです。さらに音楽のスペクトルはもともと高域に向かって下がるため、通常のマスターならほぼ例外なく `air` は `low` よりはるかに低く出ます。帯域どうしを見比べると、どの曲もほとんど「暗め」と判定してしまいます。暗め／明るめは、リファレンストラックや過去のレンダリング結果の同じ帯域と比べて判断してください。
:::

::: details ラウドネスレンジ・アタック密度・サステイン比とは？
- **ラウドネスレンジ**（LRA、単位 LU） — 体感ラウドネスが曲全体でどれだけ変動するか。値が大きいほど、はっきり静かになったり大きくなったりします（ダイナミックなクラシック曲）。小さいほど、ほぼ一定の音量です（密度の高い EDM マスター）。「LU」（ラウドネス単位）は LUFS と同じ尺度で、絶対値ではなく振れ幅として測ります。
- **アタック密度** — 1 秒あたりおおよそ何回、鋭いノート／ドラムのオンセットが起こるか。打撃的な立ち上がりが固定の下限を超えたオンセットだけを数えるので、持続音は 0 になります。高い＝忙しく打撃的、低い＝まばらまたは持続的。
- **サステイン比**（0〜1） — 素材が長く伸びた音（1 に近い）に支配されているか、短いバーストやアタック（0 に近い）に支配されているか。アタック密度とは別に（オンセットではなく RMS 包絡から）測られますが、傾向としては逆向きに動きます。

アタック密度、サステイン比、ミキシング分類器のヒット検出は、イベント最大値を基準に測り、最も大きいイベントを除外します。除外数は 10 秒ごとに 1 つ、最大 2 つで、10 秒未満では何も除外しません。
- **短時間 LUFS の標準偏差** — 瞬間ごとのラウドネスがどれだけ揺れるか。値が大きいほどレベルが落ち着かず、ゼロに近いほど非常に安定して保たれています。
:::

::: warning これらは測定値であって評価ではない
`crestFactorDb` が 5.8 でも「悪い」わけではなく、信号を記述しているだけです。プロファイルはソースを*理解し*、何を変えるか判断するために使い、合否スコアとしては使わないでください。
:::

## `masteringAssistantSuggest` — チェーンを提案

プロファイルを土台に、そのままレンダリングできるマスタリングチェーンと、人が読める根拠を提案します。第 3 引数に出発点のプリセットと意図（`preset`、`targetLufs`、`ceilingDb` など）を渡します。

受け付けるキーは `preset`、`targetPlatform`/`target_platform`、`targetLufs`/`target_lufs`、`ceilingDb`/`ceiling_db`、`enableRepair`/`enable_repair`、`preferStreamingSafe`/`prefer_streaming_safe`、`speechMonoAmount`/`speech_mono_amount` です。`preset` と `targetPlatform` は名前を渡し、それ以外は数値または真偽値を渡します。

::: details 任意の意図キーの働き
`preset` は出発点にするチェーンを選び、省略時は `streaming` になります。アシスタントは音源からプリセットを推測しません。`targetPlatform` は、対象に固有の規則（`broadcast`、`podcast`、`club`、`cd`）があり、対応する値を明示していない場合だけラウドネスと天井を適用します。`streaming`、`youtube`、`audiobook`、`cinema` も受け付けますが、アシスタントの現在のターゲットと天井は変更しません。`enableRepair` は、ソースに不具合があるときにクリーンアップ段（declick、denoise など）を有効にします。declip 段が提案されるのは、サンプルが同じレベルに張り付いた区間があり、かつそのレベルより大きい音がどのチャンネルにもない場合だけです（共有のしきい値がクリップしていない音まで書き換えてしまうため）。モノラル入力にも同じ規則が適用され、その場合 `explanation` は `declip withheld` と表示します。`preferStreamingSafe` は、リペアを有効にしたときにストリーミング向けの denoise 推定器を選びます。`speechMonoAmount`（0〜1）は、speech プリセットの 120 Hz モノメーカー・クロスオーバーより下にあるサイド成分をモノラルへ寄せる量です。
:::

このヘルパーは「根拠つきのプリセット生成」と考えると分かりやすいです。すぐレンダリングできる出発点を一式返しますが、想定ワークフローはユーザーが編集できる形です。

| 出力の一部 | 使い方 |
|------------|--------|
| `chainConfig.params` | UI コントロールへ展開する、または `masterAudio` の上書き値として渡す |
| `explanation` | なぜ各段が有効化・調整されたかを表示する |
| `preset` 入力 | アシスタントを呼ぶ前にベースプリセットを選ぶ |
| `profile` | レポート内で提案を自己完結させる |

```json
{
  "chainConfig": {
    "version": 1,
    "params": {
      "eq.tilt.enabled": true,
      "eq.tilt.tiltDb": 0.5,
      "dynamics.transientShaper.enabled": true,
      "dynamics.compressor.enabled": true,
      "saturation.exciter.enabled": true,
      "stereo.imager.enabled": true,
      "loudness.enabled": true,
      "loudness.targetLufs": -14,
      "loudness.ceilingDb": -1
    }
  },
  "explanation": [
    "base preset: pop",
    "target loudness and ceiling applied from AssistantConfig"
  ],
  "profile": { "integratedLufs": -9.47, "truePeakDb": -1.94, "crestFactorDb": 6.22, "...": "平坦化したプロファイル" }
}
```

| フィールド | 意味 |
|-----------|------|
| `chainConfig.params` | **提案チェーン全体**をフラットなドット記法キー（`stage.processor.param`）で表したもの。`*.enabled` は JSON のブール値（`true`／`false`）です。**`masterAudio` の上書き値が受け付けるキーと同一**なので、提案をそのままレンダリングできます。 |
| `explanation` | 各判断の平易な理由。UI に表示して、なぜその選択になったかを示してください。 |
| `profile` | ソースプロファイルの平坦化コピー。提案が自己完結します。 |

::: details params オブジェクトは既定チェーン全体
上の例は省略版です。実際の `params` マップは、選択したプリセットのチェーンにある**すべて**のパラメータを含みます。リペア、EQ、ダイナミクス、サチュレーション、ステレオ、True Peak リミッター、ラウドネス段などが対象で、それぞれに全パラメータと `enabled` フラグが付きます。アシスタントは指定したプリセットを土台に、ターゲットと天井を適用します。`speech` プリセットでは低域のサイド成分をまとめるモノメーカー段（120 Hz のクロスオーバー）を追加し、`enableRepair` を有効にすると測定した不具合に対応するリペア段を有効にします。マップは疎な差分ではなく、チェーン全体を上書きできるスナップショットとして扱ってください。
:::

### 提案をマスターとしてレンダリングする

`chainConfig.params` は `masterAudio` の上書きキーを使うので、提案のレンダリングは 1 回の呼び出しです。ベースプリセットを明示し、アシスタントと `masterAudio` に同じ名前を渡します。params マップ全体（上に示した数キーだけでなく、チェーン全体です）を上書き値として渡します。

::: code-group

```typescript [ブラウザ]
const basePreset = 'pop';
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: basePreset, targetLufs: -14, ceilingDb: -1 }));

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 周波数帯
```

```typescript [Node]
const basePreset = 'pop';
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: basePreset, targetLufs: -14, ceilingDb: -1 }));

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 周波数帯
```

```python [Python]
base_preset = "pop"
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"preset": base_preset, "targetLufs": -14, "ceilingDb": -1}))

mastered = sonare.master_audio(
    samples, sample_rate=sr,
    preset_name=base_preset,
    overrides=suggestion["chainConfig"]["params"],
)
assert mastered.report is not None
print(mastered.report.before.integrated_lufs, "→", mastered.report.after.integrated_lufs)
print(len(mastered.report.band_energy_delta_db))  # 32 周波数帯
```

```bash [CLI]
sonare mastering-suggest source.wav --preset pop \
  --target-lufs -14 --ceiling-db -1 --config-out suggestion-chain.json
sonare mastering source.wav --chain-config suggestion-chain.json \
  --report mastering-report.json -o master.wav
```

:::

戻り値にはトップレベルのラウドネス値に加え、処理前後を UI で比較するための `report` が入ります。処理前後の各値は、統合・最大モーメンタリ・最大ショートターム LUFS、True Peak、ラウドネスレンジです。レポートには適用ゲイン、最大ゲインリダクション、ピーク上限によってラウドネスターゲットが制限されたかどうか、処理後と処理前の差を示す 32 帯域のエネルギー差も含まれます。CLI に `--report` を渡すと、同じ形を snake_case キーで書き出します。両 CLI とも `--chain-config` と `--params` は 1 つのパラメータ一覧として読み込まれます。ドキュメントと `--params` にまたがって同じフィールドが 2 通りの綴りで指定されると、両方のキー名を示して拒否されます。ドキュメントの `<stage>.enabled: false` は、`--params` がそのステージのフィールドを設定しても、ステージを無効のまま保ちます。

::: tip suggest と render の間でユーザーに編集させる
意図したパターンは、`chainConfig.params` を編集可能な UI コントロールへ展開し、ユーザーに値を調整させてから、*編集後*のマップを `masterAudio` へ渡すことです。`explanation[]` の文字列は、各段を有効にした理由を短く添える表示に向いています。
:::

## `masteringStreamingPreview` — 配信をプレビュー

ソースと対象プラットフォームのリストを与えると、各社のラウドネス正規化があなたの音声をどう再生するかを報告します。レンダリングの*前*に、どのサービスで音量が下げられるか、シーリングに余裕があるかを確認できます。

入力 `platforms` は `StreamingPlatform` オブジェクト（`name`、`targetLufs`、`ceilingDb`）です。

このヘルパーは「配信側が何をするか」のレポートとして読むと分かりやすくなります。

| 状態 | 意味 |
|------|------|
| `normalizationGainDb` が負 | プラットフォームが音量を下げる |
| `normalizationGainDb` が正 | プラットフォームが音量を上げる可能性がある |
| `ceilingRisk` が `true` | そのゲインでピークがプラットフォームのシーリングを超える可能性がある |

```json
{
  "platforms": [
    { "name": "YouTube", "integratedLufs": -9.47, "truePeakDb": -1.94, "normalizationGainDb": -4.53, "ceilingRisk": false },
    { "name": "Podcast", "integratedLufs": -9.47, "truePeakDb": -1.94, "normalizationGainDb": -6.53, "ceilingRisk": false }
  ]
}
```

| フィールド | 意味 |
|-----------|------|
| `integratedLufs` / `truePeakDb` | 測定したソース値（どのプラットフォームでも同じ） |
| `normalizationGainDb` | ターゲットに合わせるためプラットフォームが適用するゲイン。**負は音量を下げられる**ことを意味する |
| `ceilingRisk` | 正規化が信号をプラットフォームのシーリングを超えて押し上げる場合 `true` |

::: warning ストリーミングでは大きい＝良いではない
−9.5 LUFS のマスターは YouTube で「大きく」はなりません。プラットフォームは `normalizationGainDb`（ここでは −4.5 dB）を適用してすべての曲をほぼ同じラウドネスに揃えるので、過度なコンプはラウドネス上の利点なしにダイナミクスを犠牲にするだけです。[配信ターゲット](./glossary/mastering/delivery-targets.md) と [ラウドネスマッチング](./glossary/concepts/loudness-matching.md) を参照してください。
:::

<SonareDemo id="loudness-meter" />

## ステレオ素材

上の 3 つのヘルパーは 1 本のバッファを受け取ります。ステレオトラックに使うには `0.5 * (left + right)` のダウンミックスを渡すことになりますが、このダウンミックスはペアの中立な代用にはなりません。左右で異なる成分は加算時に部分的に打ち消し合うため、実際のプログラムより小さく測定されます。

誤差の大きさは左右の相関の度合いで決まります。無相関のピンクノイズペア（48 kHz、4 秒）で測ると、ステレオ経路が **−12.43 LUFS** と報告するのに対し、ダウンミックスは **−18.45 LUFS** — **6.03 dB** の過小評価です。左右が同一のペアでは差は 3.01 dB にとどまりますが、この分はすべてステレオ側に由来します。BS.1770 が 2 チャンネルの平均二乗を合算する一方、左右が同一ならダウンミックスは減衰しないからです（`0.5 * (L + L)` は `L` そのものです）。無相関ペアで残る約 3 dB が、ダウンミックス側で実際に打ち消し合って失われる分です。広がりのある素材、残響の多い素材、ステレオイメージを強く作り込んだ素材は、大きい方の値に近づきます。

この 1 つの測定値は、そのまま後段へ波及します。

| 過小に読まれるもの | 結果 |
|--------------------|------|
| プロファイルの積分ラウドネス | ソースが実際より小さく見える |
| 提案されるラウドネスステージ | 不要なゲインを加える前提でチェーンが組まれる |
| 配信プレビューの `normalizationGainDb` | プラットフォームが実際より大きく持ち上げるように見える |
| `ceilingRisk` | このラウドネスから導かれるため、実際にはリスクがあっても安全と読まれうる |

同じ無相関ペアで −14 LUFS のターゲットを見ると、`normalizationGainDb` はモノラル経路では **+4.45** に、ステレオ経路では **−1.57** になります。モノラル側の値は、使えるヘッドルームを 6 dB 分そのまま過大に見せています。

したがって、素材が本当にステレオであるときはステレオ版を使ってください。`left` と `right` を渡せば、積分ラウドネスは BS.1770 のチャンネル加算で、True Peak は左右の大きい方で、ペアを直接測定します。

```typescript
import { init, masteringAudioProfileStereo, masteringStreamingPreviewStereo } from '@libraz/libsonare';

await init();

// Request form only — these entry points have no positional overload.
const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
console.log(profile.loudness.integratedLufs);

// Omitting `platforms` falls back to Spotify / Apple Music / YouTube.
const preview = JSON.parse(masteringStreamingPreviewStereo({ left, right, sampleRate }));
```

```python
import json
import libsonare as sonare

profile = json.loads(sonare.mastering_audio_profile_stereo(left, right, sample_rate=sample_rate))
preview = json.loads(sonare.mastering_streaming_preview_stereo(left, right, sample_rate=sample_rate))
```

::: info 変わるのは loudness ブロックだけ
ステレオ版のプロファイルが両チャンネルから測るのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから、True Peak は左右の大きい方から求めます。`spectral`・`dynamics` とテンポの各フィールドは絶対レベルではなく形と時間構造を表すため、引き続きダウンミックス上で測定されます。これは意図的な設計で、同じ素材に対する `masteringAudioProfile` の結果とそのまま比較できる状態を保つためです。
:::

`masteringAssistantSuggestStereo` は `masteringAudioProfileStereo` を通してプロファイルを取るため、ラウドネスステージは 6 dB 低く読まれたダウンミックスではなく、チャンネル加算したプログラムを土台に組まれます。提案のそれ以外の部分 — プロセッサの選択と根拠テキスト — はモノラル版と同じ形です。

## 関連

- [マスタリングプロセッサ](./mastering-processors.md) — 提案が参照するプロセッサ id とプリセット
- [マスタリング実装](./mastering-implementation.md) — 実際にレンダリングするチェーン経路
- [配信ターゲット](./glossary/mastering/delivery-targets.md) · [メーターの読み方](./glossary/mastering/meter-reading.md) · [品質チェックリスト](./glossary/mastering/quality-checklist.md)
