---
title: マスタリングアシスタント API
description: libsonare の説明可能なマスタリング補助 API、masteringAudioProfile・masteringAssistantSuggest・masteringStreamingPreview を、実際に返る JSON と、提案をマスターへレンダリングする方法とともに解説します。
---

# マスタリングアシスタント API

libsonare は、レンダリング済み音声だけでなく*判断根拠*を扱いたいアプリ向けに、**JSON を返す**マスタリング補助 API を 3 つ提供します。**ローカル DSP 解析のみ**で動作し、アップロードも外部モデルも隠れたプリセットも使わず、UI 表示やレポート保存に使える構造化 JSON を返します。

「LUFS」「トゥルーピーク」「クレストファクター」「トーンバランス」に馴染みがなければ、先に [マスタリングとは?](./glossary/concepts/what-is-mastering.md) と [メーターの読み方](./glossary/mastering/meter-reading.md) を読んでください。本ページは用語を前提に JSON の契約に集中します。

::: info 「アシスタント」は自動仕上げボタンではない
ここでのアシスタントは、音源を測定し、なぜその処理が妥当そうかを JSON で説明する補助 API です。実際の音作りは、提案をユーザーが確認・調整し、別のレンダリング API に渡して行います。
:::

最初に組み込む場合は、次の順で読むと分かりやすくなります。

1. `masteringAudioProfile(...)` で、元音源の状態をユーザーに見せる。
2. `masteringAssistantSuggest(...)` で、編集可能なマスタリングチェーンを初期入力する。
3. ユーザーが提案を確認・調整してからレンダリングする。
4. `masteringStreamingPreview(...)` で、配信プラットフォームが音量をどう扱うか説明する。

::: tip アシスタントの位置
アシスタントは**説明と提案**を行い、あなたの代わりに決定はしません。よい流れは、ソースを*プロファイル*→方向を*提案*→ユーザーが調整→*レンダリング*→ストリーミング各社での再生を*プレビュー*、です。最終判断は耳で行ってください。JSON は UI の材料であって、耳の代わりではありません。
:::

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
| チェーンを提案 | `masteringAssistantSuggest(samples, sr, params)` | `mastering_assistant_suggest(...)` | 完全なチェーン設定 + 根拠 |
| 配信をプレビュー | `masteringStreamingPreview(samples, sr, platforms)` | `mastering_streaming_preview(...)` | プラットフォーム別の正規化 |

3 つとも **JSON 文字列**を返します — `JSON.parse`（JS）または `json.loads`（Python）で解析してください。スキーマは C・Node・Python・WASM バインディングで同一です。これらのヘルパーに対応する `sonare` CLI サブコマンドはありません。ブラウザまたは Python バインディングを使ってください。

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
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
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
    samples, sample_rate=sr, params={"targetLufs": -14, "ceilingDb": -1}))
preview    = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sr, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

```bash [CLI]
# assistant 専用 CLI はないため、同じターゲットの解析・レンダーを CLI で行う。
sonare lufs source.wav --json
sonare mastering source.wav --target-lufs -14 --ceiling-db -1 -o master.wav
```

:::

## `masteringAudioProfile` — ソースを測る

入力の読み取り専用の要約です。どれだけ大きいか、スペクトル全体にエネルギーがどう広がっているか、どれだけダイナミックか、どのジャンルに似ているか。何も処理しません。

任意の `params` は数値で、JS 風／Python 風のどちらの名前も受け付けます: `nFft`/`n_fft`（既定 `2048`）、`hopLength`/`hop_length`（既定 `512`）、`truePeakOversample`/`true_peak_oversample`（既定 `4`）。

この結果は、元音源を説明するために使います。合否判定ではありません。たとえば「すでに大きい」「暗い」「密度が高い」「アタックが多い」といった事実を UI に出すためのものです。

| すること | しないこと |
|----------|------------|
| ラウドネス、トゥルーピーク、クレストファクター、スペクトル、ダイナミクス、ジャンル候補を測る | 音声を変更しない |
| レンダリング前に UI へ表示する材料を返す | 最終設定を単独では決めない |

```json
{
  "durationSec": 2,
  "bpm": 89.5,
  "bpmConfidence": 0.24,
  "loudness": {
    "integratedLufs": -8.71,
    "lraLu": 0,
    "truePeakDb": -2.41,
    "crestFactorDb": 5.76
  },
  "spectral": {
    "subRmsDb": 6.37, "lowRmsDb": 40.35, "lowMidRmsDb": 13.26, "midRmsDb": 23.56,
    "highMidRmsDb": -1.96, "highRmsDb": -1.99, "airRmsDb": -1.92,
    "centroidHz": 5806.83, "flatness": 0.0035, "rolloffHz": 15386.5
  },
  "dynamics": { "shortTermLufsStd": 0, "attackDensity": 3, "sustainRatio": 1 },
  "genreCandidates": [
    { "name": "hipHop", "score": 0.70 },
    { "name": "edm",    "score": 0.65 },
    { "name": "pop",    "score": 0.45 }
  ]
}
```

| グループ | フィールド | 意味 |
|----------|-----------|------|
| `loudness` | `integratedLufs` | 全体の[ラウドネス](./glossary/lufs.md)（EBU R128） |
| | `lraLu` | ラウドネスレンジ — 時間方向のラウドネス変動 |
| | `truePeakDb` | サンプル間 [トゥルーピーク](./glossary/true-peak.md) |
| | `crestFactorDb` | ピーク対 RMS の差 — 大 = パンチ、小 = 密度（[クレストファクター](./glossary/concepts/crest-factor.md)） |
| `spectral` | `subRmsDb` … `airRmsDb` | 帯域ごとのエネルギー（sub → air）。暗い／明るいバランスの把握に |
| | `centroidHz` | スペクトルの「重心」— 明るさの目安 |
| | `flatness` | 0 = トーン的、1 = ノイズ的 |
| | `rolloffHz` | エネルギーの大半が収まる周波数 |
| `dynamics` | `attackDensity` | トランジェントの密度 |
| | `sustainRatio` | 持続的か過渡的か |
| `genreCandidates` | `[{name, score}]` | 最も近いスタイル。先頭が提案のベースプリセットになる |

::: details ラウドネスレンジ・アタック密度・サステイン比とは？
- **ラウドネスレンジ（LRA、単位 LU）** — 体感ラウドネスが曲全体でどれだけ変動するか。値が大きいほど、はっきり静かになったり大きくなったりします（ダイナミックなクラシック曲）。小さいほど、ほぼ一定の音量です（密度の高い EDM マスター）。「LU」（ラウドネス単位）は LUFS と同じ尺度で、絶対値ではなく振れ幅として測ります。
- **アタック密度** — 1 秒あたりおおよそ何回、鋭いノート／ドラムのオンセットが起こるか。高い＝忙しく打撃的、低い＝まばらまたは持続的。
- **サステイン比**（0〜1） — 素材が長く伸びた音（1 に近い）に支配されているか、短いバーストやアタック（0 に近い）に支配されているか。アタック密度とは別に（オンセットではなく RMS 包絡から）測られますが、傾向としては逆向きに動きます。
:::

::: warning これらは測定値であって評価ではない
`crestFactorDb` が 5.8 でも「悪い」わけではなく、信号を記述しているだけです。プロファイルはソースを*理解し*、何を変えるか判断するために使い、合否スコアとしては使わないでください。
:::

## `masteringAssistantSuggest` — チェーンを提案

プロファイルを土台に、完全なマスタリングチェーンと、人が読める根拠を提案します。第 3 引数に意図（`targetLufs`、`ceilingDb` など）を渡します。

意図として受け付けるキーは `targetLufs`/`target_lufs`、`ceilingDb`/`ceiling_db`、`enableRepair`/`enable_repair`、`preferStreamingSafe`/`prefer_streaming_safe`、`speechMonoAmount`/`speech_mono_amount` です。

このヘルパーは「根拠つきのプリセット生成」と考えると分かりやすいです。そのままレンダリングできる完全な出発点を返しますが、想定ワークフローはユーザーが編集できる形です。

| 出力の一部 | 使い方 |
|------------|--------|
| `chainConfig.params` | UI コントロールへ展開する、または `masterAudio` の上書き値として渡す |
| `explanation` | なぜ各段が有効化・調整されたかを表示する |
| `genreCandidates` | ベースプリセットを選ぶ、または候補として表示する |
| `profile` | レポート内で提案を自己完結させる |

```json
{
  "chainConfig": {
    "version": 1,
    "params": {
      "eq.tilt.enabled": 1,
      "eq.tilt.tiltDb": -0.5,
      "dynamics.transientShaper.enabled": 1,
      "dynamics.compressor.enabled": 1,
      "dynamics.compressor.thresholdDb": -18,
      "saturation.tape.enabled": 1,
      "spectral.airBand.enabled": 1,
      "maximizer.truePeakLimiter.enabled": 1,
      "maximizer.truePeakLimiter.ceilingDb": -1,
      "loudness.enabled": 1,
      "loudness.targetLufs": -14,
      "loudness.ceilingDb": -1
    }
  },
  "explanation": [
    "base preset selected from top genre candidate: hipHop",
    "target loudness and ceiling applied from AssistantConfig",
    "air band enabled because the spectral profile is dark",
    "transient shaper enabled for dense attacks"
  ],
  "genreCandidates": [ { "name": "hipHop", "score": 0.70 } ],
  "profile": { "integratedLufs": -8.7, "truePeakDb": -2.43, "crestFactorDb": 5.75, "...": "平坦化したプロファイル" }
}
```

| フィールド | 意味 |
|-----------|------|
| `chainConfig.params` | **提案チェーン全体**をフラットなドット記法キー（`stage.processor.param`）で表したもの。`*.enabled` は `1`/`0`。**`masterAudio` の上書き値が受け付けるキーと同一**なので、提案をそのままレンダリングできます。 |
| `explanation` | 各判断の平易な理由。UI に表示して選択を透明にしてください。 |
| `genreCandidates` | プロファイルと同じ順位付きスタイル。先頭がベースプリセット。 |
| `profile` | ソースプロファイルの平坦化コピー。提案が自己完結します。 |

::: details params オブジェクトは既定チェーン全体
上の例は省略版です。実際の `params` マップは既定チェーンの**すべて**のパラメータを含みます — リペア全段（declick、declip、decrackle、dehum、dereverb、denoise）、EQ、ディエッサー、トランジェントシェイパー、コンプレッサー、マルチバンド、サチュレーション（tape/exciter）、エアバンド、ステレオ、トゥルーピークリミッター、ラウドネス段 — それぞれ全パラメータと `enabled` フラグつきです。アシスタントはプロファイルに基づき `enabled` を切り替え、いくつかの値を調整し、残りは既定のままにします。マップは疎な差分ではなく、上書き可能な完全スナップショットとして扱ってください。
:::

### 提案をマスターとしてレンダリングする

`chainConfig.params` は `masterAudio` の上書きキーを使うので、提案のレンダリングは 1 回の呼び出しです。先頭のジャンル候補をベースプリセットにし、params を上書き値として渡します。

::: code-group

```typescript [ブラウザ]
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const basePreset = suggestion.genreCandidates[0].name;        // 例 "hipHop"

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
// mastered: { samples, sampleRate, inputLufs, outputLufs, appliedGainDb, stages }
```

```python [Python]
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"targetLufs": -14, "ceilingDb": -1}))
base_preset = suggestion["genreCandidates"][0]["name"]        # 例 "hipHop"

mastered = sonare.master_audio(
    samples, sample_rate=sr,
    preset_name=base_preset,
    overrides=suggestion["chainConfig"]["params"],
)
# mastered: samples, sample_rate, input_lufs, output_lufs, applied_gain_db, stages
```

```bash [CLI]
sonare mastering source.wav --target-lufs -14 --ceiling-db -1 -o master.wav
sonare mastering-processors
```

:::

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
    { "name": "YouTube", "integratedLufs": -8.70, "truePeakDb": -2.43, "normalizationGainDb": -5.30, "ceilingRisk": false },
    { "name": "Podcast", "integratedLufs": -8.70, "truePeakDb": -2.43, "normalizationGainDb": -7.30, "ceilingRisk": false }
  ]
}
```

| フィールド | 意味 |
|-----------|------|
| `integratedLufs` / `truePeakDb` | 測定したソース値（どのプラットフォームでも同じ） |
| `normalizationGainDb` | ターゲットに合わせるためプラットフォームが適用するゲイン。**負は音量を下げられる**ことを意味する |
| `ceilingRisk` | 正規化が信号をプラットフォームのシーリングを超えて押し上げる場合 `true` |

::: warning ストリーミングでは大きい＝良いではない
−8 LUFS のマスターは YouTube で「大きく」はなりません。プラットフォームは `normalizationGainDb`（ここでは −5.3 dB）を適用して全員をほぼ同じラウドネスに揃えるので、過度なコンプはラウドネス上の利点なしにダイナミクスを犠牲にするだけです。[配信ターゲット](./glossary/mastering/delivery-targets.md) と [ラウドネスマッチング](./glossary/concepts/loudness-matching.md) を参照してください。
:::

## 関連

- [マスタリングプロセッサ](./mastering-processors.md) — 提案が参照するプロセッサ id とプリセット
- [マスタリング実装](./mastering-implementation.md) — 実際にレンダリングするチェーン経路
- [配信ターゲット](./glossary/mastering/delivery-targets.md) · [メーターの読み方](./glossary/mastering/meter-reading.md) · [品質チェックリスト](./glossary/mastering/quality-checklist.md)
