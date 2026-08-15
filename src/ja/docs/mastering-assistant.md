---
title: マスタリングアシスタント API
description: libsonare の説明可能なマスタリング補助 API、masteringAudioProfile・masteringAssistantSuggest・masteringStreamingPreview を、実際に返る JSON と、提案をマスターへレンダリングする方法とともに解説します。
---

# マスタリングアシスタント API

libsonare は、レンダリング済み音声だけでなく*判断根拠*を扱いたいアプリ向けに、**JSON を返す**マスタリング補助 API を 3 つ提供します。**ローカル DSP 解析のみ**で動作し、アップロードも外部モデルも隠れたプリセットも使わず、UI 表示やレポート保存に使える構造化 JSON を返します。

「LUFS」「True Peak（トゥルーピーク）」「クレストファクター」「トーナルバランス」に馴染みがなければ、先に [マスタリングとは?](./glossary/concepts/what-is-mastering.md) と [メーターの読み方](./glossary/mastering/meter-reading.md) を読んでください。本ページは用語を前提に JSON の契約に集中します。

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
sonare mastering-profile source.wav
sonare mastering-suggest source.wav --params targetLufs=-14,ceilingDb=-1
sonare mastering-streaming source.wav \
  --platforms '[{"name":"YouTube","targetLufs":-14,"ceilingDb":-1},{"name":"Podcast","targetLufs":-16,"ceilingDb":-1}]'
```

:::

::: warning 短いクリップ: profile と suggest は動くが、意味のある結果には実際のスペクトル成分が必要
`masteringAudioProfile` と `masteringAssistantSuggest` は [STFT](./glossary/analysis/spectrogram-stft.md)（短時間フーリエ変換。短い窓を少しずつずらしながら周波数解析する手法）ベースの解析全体を実行します（既定の `nFft` は 2048）。例外を投げるのは**完全に空のバッファ**だけです（`SonareError`、メッセージは "audio input must be a non-empty buffer"）。どれほど短くても、空でなければバッファは受理され、解析されます。`nFft` サイズの窓（既定 2048 サンプル）はあくまで目安であってエラー条件ではありません。1 窓ぶんより短いバッファは、意味のあるプロファイルを得るにはスペクトル成分が足りないというだけなので、「`nFft` より短い」はガードすべき失敗ではなく、UI に出す品質上の注意として扱ってください。`masteringStreamingPreview` はラウドネスを測るだけなので、空でない音声バッファであればどんなバッファでも受け付けます。`platforms` が空リストでも問題なく、その場合は既定のプラットフォーム集合（Spotify、Apple Music、YouTube）にフォールバックします。UI から短い録音やファイル選択を渡すときは、profile／suggest の呼び出しを `isSonareError` を使った `try`／`catch` で囲んで空バッファのケースに備え、`nFft` より短い場合はハードブロックではなく、やわらかい長さのヒントを検討してください。

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

入力の読み取り専用の要約です。どれだけ大きいか、スペクトル全体にエネルギーがどう広がっているか、どれだけダイナミックか、どのジャンルに似ているか。何も処理しません。

任意の `params` は数値で、JS 風／Python 風のどちらの名前も受け付けます: `nFft`/`n_fft`（既定 `2048`）、`hopLength`/`hop_length`（既定 `512`）、`truePeakOversample`/`true_peak_oversample`（既定 `4`）。

::: info True Peak でオーバーサンプリングする理由
デジタルのピークは固定された点でサンプリングされますが、実際の波形はその*サンプルとサンプルの間*で高くなることがあります。オーバーサンプリングは信号をより高いレートで（ここでは 4 倍で）測り直し、こうしたサンプル間ピーク（ISP）を捉えます。これにより `truePeakDb` が、コンバーターが実際に出力する値を反映します。倍率を上げるほど正確になりますが、CPU 負荷も増えます。
:::

この結果は、元音源を説明するために使います。合否判定ではありません。たとえば「すでに大きい」「暗い」「密度が高い」「アタックが多い」といった事実を UI に出すためのものです。

| すること | しないこと |
|----------|------------|
| ラウドネス、True Peak、クレストファクター、スペクトル、ダイナミクス、ジャンル候補を測る | 音声を変更しない |
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
| | `truePeakDb` | サンプル間ピークを含む [True Peak](./glossary/true-peak.md) |
| | `crestFactorDb` | ピーク対 RMS の差 — 大 = パンチ、小 = 密度（[クレストファクター](./glossary/concepts/crest-factor.md)） |
| `spectral` | `subRmsDb` … `airRmsDb` | 帯域ごとの相対エネルギー（sub → air）。内部スケールで dBFS ではないため、帯域間ではなくリファレンスと比較する |
| | `centroidHz` | スペクトルの「重心」— 明るさの目安 |
| | `flatness` | 0 = トーン的、1 = ノイズ的 |
| | `rolloffHz` | エネルギーの大半が収まる周波数 |
| `dynamics` | `attackDensity` | トランジェントの密度 |
| | `sustainRatio` | 持続的か過渡的か |
| `genreCandidates` | `[{name, score}]` | 最も近いスタイル。先頭が提案のベースプリセットになる |

::: info スペクトル帯域の読み方
`*RmsDb` のフィールドは低域から高域へ並びます: `sub`（重低音）→ `low`/`lowMid`（低音と温かみ）→ `mid`（芯、ボーカル）→ `highMid`/`high`（存在感、明瞭さ）→ `air`（高域のきらめき）。

これらの値は内部 FFT スケール上の相対的な帯域レベルであり、dBFS ではありません。上の例でも `lowRmsDb: 40.35` と 0 を大きく超えています。さらに音楽のスペクトルはもともと高域に向かって下がるため、通常のマスターならほぼ例外なく `air` は `low` よりはるかに低く出ます。帯域どうしを見比べると、どの曲もほとんど「暗め」と判定してしまいます。暗め／明るめは、リファレンストラックや過去のレンダリング結果の同じ帯域と比べて判断してください。ライブラリ内部のジャンル推定も同じ考え方で、`air` が `mid` より 22 dB 以上低いことをローファイ／こもり気味の条件にしています（0 dB を基準にはしていません）。
:::

::: details ラウドネスレンジ・アタック密度・サステイン比とは？
- **ラウドネスレンジ**（LRA、単位 LU） — 体感ラウドネスが曲全体でどれだけ変動するか。値が大きいほど、はっきり静かになったり大きくなったりします（ダイナミックなクラシック曲）。小さいほど、ほぼ一定の音量です（密度の高い EDM マスター）。「LU」（ラウドネス単位）は LUFS と同じ尺度で、絶対値ではなく振れ幅として測ります。
- **アタック密度** — 1 秒あたりおおよそ何回、鋭いノート／ドラムのオンセットが起こるか。高い＝忙しく打撃的、低い＝まばらまたは持続的。
- **サステイン比**（0〜1） — 素材が長く伸びた音（1 に近い）に支配されているか、短いバーストやアタック（0 に近い）に支配されているか。アタック密度とは別に（オンセットではなく RMS 包絡から）測られますが、傾向としては逆向きに動きます。
- **短時間 LUFS の標準偏差** — 瞬間ごとのラウドネスがどれだけ揺れるか。値が大きいほどレベルが落ち着かず、ゼロに近いほど非常に安定して保たれています。
:::

::: warning これらは測定値であって評価ではない
`crestFactorDb` が 5.8 でも「悪い」わけではなく、信号を記述しているだけです。プロファイルはソースを*理解し*、何を変えるか判断するために使い、合否スコアとしては使わないでください。
:::

## `masteringAssistantSuggest` — チェーンを提案

プロファイルを土台に、そのままレンダリングできるマスタリングチェーンと、人が読める根拠を提案します。第 3 引数に意図（`targetLufs`、`ceilingDb` など）を渡します。

意図として受け付けるキーは `targetLufs`/`target_lufs`、`ceilingDb`/`ceiling_db`、`enableRepair`/`enable_repair`、`preferStreamingSafe`/`prefer_streaming_safe`、`speechMonoAmount`/`speech_mono_amount` です。

::: details 任意の意図キーの働き
`enableRepair` は、ソースに不具合があるときにクリーンアップ段（declick、denoise など）を有効にします。`preferStreamingSafe` は、最大音量よりも配信向けの安全なシーリングとターゲットへ提案を寄せます。`speechMonoAmount`（0〜1）は、小型スピーカーやモノラルスピーカーでの聞き取りやすさのために、スピーチの低域／中央成分をモノラル寄りにまとめます。
:::

このヘルパーは「根拠つきのプリセット生成」と考えると分かりやすいです。すぐレンダリングできる出発点を一式返しますが、想定ワークフローはユーザーが編集できる形です。

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
      "eq.tilt.enabled": true,
      "eq.tilt.tiltDb": -0.5,
      "dynamics.transientShaper.enabled": true,
      "dynamics.compressor.enabled": true,
      "dynamics.compressor.thresholdDb": -18,
      "saturation.tape.enabled": true,
      "spectral.airBand.enabled": true,
      "maximizer.truePeakLimiter.enabled": true,
      "maximizer.truePeakLimiter.ceilingDb": -1,
      "loudness.enabled": true,
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
| `chainConfig.params` | **提案チェーン全体**をフラットなドット記法キー（`stage.processor.param`）で表したもの。`*.enabled` は JSON のブール値（`true`／`false`）です。**`masterAudio` の上書き値が受け付けるキーと同一**なので、提案をそのままレンダリングできます。 |
| `explanation` | 各判断の平易な理由。UI に表示して選択を透明にしてください。 |
| `genreCandidates` | プロファイルと同じ順位付きスタイル。先頭がベースプリセット。 |
| `profile` | ソースプロファイルの平坦化コピー。提案が自己完結します。 |

::: details params オブジェクトは既定チェーン全体
上の例は省略版です。実際の `params` マップは既定チェーンの**すべて**のパラメータを含みます — リペア全段（declick、declip、decrackle、dehum、dereverb、denoise）、EQ、ディエッサー、トランジェントシェイパー、コンプレッサー、マルチバンド、サチュレーション（tape/exciter）、エアバンド、ステレオ、True Peak リミッター、ラウドネス段 — それぞれ全パラメータと `enabled` フラグつきです。アシスタントはプロファイルに基づき `enabled` を切り替え、いくつかの値を調整し、残りは既定のままにします。マップは疎な差分ではなく、チェーン全体を上書きできるスナップショットとして扱ってください。
:::

### 提案をマスターとしてレンダリングする

`chainConfig.params` は `masterAudio` の上書きキーを使うので、提案のレンダリングは 1 回の呼び出しです。先頭のジャンル候補をベースプリセットにし、params マップ全体（上に示した数キーだけでなく、チェーン全体です）を上書き値として渡します。

::: code-group

```typescript [ブラウザ]
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const basePreset = suggestion.genreCandidates[0].name;        // 例 "hipHop"

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 周波数帯
```

```typescript [Node]
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const basePreset = suggestion.genreCandidates[0].name;

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 周波数帯
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
assert mastered.report is not None
print(mastered.report.before.integrated_lufs, "→", mastered.report.after.integrated_lufs)
print(len(mastered.report.band_energy_delta_db))  # 32 周波数帯
```

```bash [CLI]
sonare mastering source.wav --target-lufs -14 --ceiling-db -1 \
  --report mastering-report.json -o master.wav
sonare mastering-processors
```

:::

戻り値には従来のトップレベルのラウドネス値に加え、処理前後を UI で比較するための `report` が入ります。処理前後の各値は、統合・最大モーメンタリ・最大ショートターム LUFS、True Peak、ラウドネスレンジです。レポートには適用ゲイン、最大ゲインリダクション、ピーク上限によってラウドネスターゲットが制限されたかどうか、処理後と処理前の差を示す 32 帯域のエネルギー差も含まれます。CLI に `--report` を渡すと、同じ形を snake_case キーで書き出します。

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

<SonareDemo id="loudness-meter" />

## ステレオ素材

上の 3 つのヘルパーは 1 本のバッファを受け取ります。ステレオトラックに使うには `0.5 * (left + right)` のダウンミックスを渡すことになりますが、このダウンミックスはペアの中立な代用にはなりません。左右で異なる成分は加算時に部分的に打ち消し合うため、実際のプログラムより小さく測定されます。

誤差の大きさは左右の相関の度合いで決まります。48 kHz の無相関ペアで測ると、ステレオ経路が **−16.44 LUFS** と報告するのに対し、ダウンミックスは **−22.55 LUFS** — **6.11 dB** の過小評価です。左右が同一のペアでは差は 3.01 dB にとどまりますが、この分はすべてステレオ側に由来します。BS.1770 が 2 チャンネルの平均二乗を合算する一方、左右が同一ならダウンミックスは減衰しないからです（`0.5 * (L + L)` は `L` そのものです）。無相関ペアで残る約 3 dB が、ダウンミックス側で実際に打ち消し合って失われる分です。広がりのある素材、残響の多い素材、ステレオイメージを強く作り込んだ素材は、大きい方の値に近づきます。

この 1 つの測定値は、そのまま後段へ波及します。

| 過小に読まれるもの | 結果 |
|--------------------|------|
| プロファイルの積分ラウドネス | ソースが実際より小さく見える |
| 提案されるラウドネスステージ | 不要なゲインを加える前提でチェーンが組まれる |
| 配信プレビューの `normalizationGainDb` | プラットフォームが実際より大きく持ち上げるように見える |
| `ceilingRisk` | このラウドネスから導かれるため、実際にはリスクがあっても安全と読まれうる |

同じ無相関ペアで Spotify の行を見ると、`normalizationGainDb` はモノラル経路では **+8.55** に、ステレオ経路では **+2.44** になります。モノラル側の答えは、使えるヘッドルームを 6 dB 分そのまま過大に見せています。

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
