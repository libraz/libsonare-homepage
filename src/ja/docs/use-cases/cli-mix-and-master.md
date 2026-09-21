---
title: CLI だけでミックスからマスタリングまで
description: ステムのフォルダから配信可能なマスターまでをシェルだけで完結させる手順。シーンを提案させ、手で直し、レンダリングし、点検し、マスタリングし、結果を検証します。
---

# CLI だけでミックスからマスタリングまで

ステムが 4 本あって、DAW は開いていない。このページはその状態から 1 本のシェルスクリプトで完成したマスターまで到達し、そのうえで各ステップが何を決めたのか、その判断が妥当かをどう見分けるのかを解説します。

この作業は「魔法のコマンドを 1 つ叩く」ものではありません。計測・提案・レンダリング・マスタリングという 4 つの段階の連鎖であり、その途中に人間のチェックポイントが入ります。ミックスは機械が最後まで代われない部分だからです。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- ステム一式からミキサーシーンを作り、その中の数値ひとつひとつについてアシスタントが述べる理由を読める。
- そのシーンを素の JSON として編集し、ステレオのミックスダウンへレンダリングできる。
- ミックスダウンを指定した配信ターゲット向けにマスタリングし、処理前後のレポートを読める。
- 画面に出ている複数のラウドネス値のうち、どれを信じるべきかを判断できる。

## 全体のスクリプト

以下がこの作業の全体です。まず実行し、そのうえで各段階の説明を読んでください。

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. ステムからミックスを提案させる。ここでは計測のみで、音声は処理されない。
sonare suggest-mix \
  --input drums=stems/drums.wav \
  --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav \
  --input vox=stems/vox.wav \
  --sample-rate 48000 \
  --tempo-bpm auto \
  --scene-out scene.json \
  --json > suggestion.json

# 2. 理由を読み、scene.json を手で直す。ここがチェックポイント。
python3 -c 'import json;[print(l) for l in json.load(open("suggestion.json"))["explanation"]]'

# 3. シーンをステレオのミックスダウンへレンダリングする。
sonare mix --scene scene.json \
  --input drums=stems/drums.wav \
  --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav \
  --input vox=stems/vox.wav \
  -o mix.wav --json

# 4. マスタリングに進む前に、破損がないか確認する。
sonare repair mix.wav --detect --json > defects.json

# 5. 配信ターゲット向けにマスタリングし、レポートを残す。
sonare mastering mix.wav \
  --assistant --explain \
  --target-platform streaming \
  -o master.wav --report report.json --json
```

<FlowDiagram
  title="ステムからマスターまで"
  direction="LR"
  :nodes="[
    { id: 'stems', label: 'ステム (WAV)', col: 0, row: 0, variant: 'muted' },
    { id: 'suggest', label: 'suggest-mix', col: 1, row: 0, variant: 'accent' },
    { id: 'scene', label: 'scene.json', col: 2, row: 0 },
    { id: 'edit', label: '手による編集', col: 3, row: 0, variant: 'decision' },
    { id: 'mix', label: 'mix', col: 4, row: 0, variant: 'accent' },
    { id: 'mixdown', label: 'mix.wav', col: 5, row: 0 },
    { id: 'detect', label: 'repair --detect', col: 5, row: 1, variant: 'warning' },
    { id: 'master', label: 'mastering --assistant', col: 6, row: 0, variant: 'accent' },
    { id: 'out', label: 'master.wav', col: 7, row: 0, variant: 'success' },
    { id: 'report', label: 'report.json', col: 7, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'stems', to: 'suggest' },
    { from: 'suggest', to: 'scene' },
    { from: 'scene', to: 'edit' },
    { from: 'edit', to: 'mix' },
    { from: 'stems', to: 'mix', label: '音声', style: 'dashed' },
    { from: 'mix', to: 'mixdown' },
    { from: 'mixdown', to: 'detect', style: 'dashed' },
    { from: 'mixdown', to: 'master' },
    { from: 'master', to: 'out' },
    { from: 'master', to: 'report', style: 'dashed' }
  ]"
  caption="アシスタントは計測して提案するだけで、音声に触れるのはミキサーとマスタリングチェーンの 2 段階のみです。"
/>

## ステップ 1 — ミックスを提案させる

`suggest-mix` は各ステムを計測し、さらにステム同士のあいだで起きていることを計測して、ミキサーシーンを書き出します。音声そのものには一切触れません。`--scene-out` が出すのはレンダリング結果ではなくドキュメントです。オプション全体と背後のルールは [ミキシングアシスタント](../mixing-assistant.md) にあります。

```bash
sonare suggest-mix \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  --sample-rate 48000 --tempo-bpm auto \
  --scene-out scene.json --json
```

出力のうち重要なのは 3 か所で、それぞれ答えている問いが違います。

`explanation` は、各数値がなぜその値なのかを示します。判断 1 件につき 1 行が、その判断を下したルール自身から出力されます。

```text
staged vox with -7.2 dB of input trim towards the -18.0 LUFS target
balanced vox at +2.7 dB relative to its staged level as a vocal part,
  scaled down from +5.0 dB by a 0.53 classification confidence
compressed vox at 3.3:1 above -22.2 dB, with the 5.3 ms attack and 200.0 ms
  release its 5.2 dB crest factor and 1.00 sustain ratio call for
sent vox to the plate reverb at -10.5 dB as a vocal part
pulled the master bus down to leave the summed mix its headroom
```

シーンより先にここを読んでください。納得できない判断は、たいていその手前の分類に納得できていません。そして各行はそれを明示します。`scaled down from +5.0 dB by a 0.53 classification confidence` は、そのステムがボーカルだという確信が半分しかなかったとアシスタント自身が言っている行です。

`tracks` は、何を計測したかを示します。ステムごとに `integratedLufs`、`crestFactorDb`、`sustainRatio`、`spectralCentroidHz`、`bandOccupancy`、`channelCount`、そして到達した分類（`source`、`sourceConfidence`）が並びます。これが説明文の根拠です。

`mix` は、ステム同士のあいだで起きていることを示します。`bandDominance` は帯域ごとにマスクする側とされる側の組を並べ、`crowdedBands` は各帯域の混雑度を数値化し、`monoRisks` はモノラルで崩れる素材を指摘します。シーンはこれらに直接手を打ちません。問題がフェーダーで解けるのかアレンジの話なのかを、読み手が判断するための材料です。

::: tip `--tempo-bpm auto` の意味
提案されるシーンのディレイタイムはテンポに合わせて決まります。`auto` は最初の `--input` からテンポを検出します。フラグ自体を省くとトランスポートのフォールバックテンポが使われますが、それが曲のテンポと一致することはまずありません。
:::

## ステップ 2 — シーンを編集する

`scene.json` は素のドキュメントで、フィールド単位の仕様は [ミキシングシーン JSON](../mixing-scene-json.md) にあります。開いて、納得できないところを直して、保存する。これが 2 段階設計の狙いです。ステムからミックスダウンまでをこのファイルを見せずに一気に進めるコマンドは、意図的に用意していません。

上の実行で得られたシーンにはストリップが 6 本あります。4 本のステムに加えて、aux バスから供給される `reverbReturn` と `delayReturn` です。各インサートはパラメータを JSON 文字列として持ちます。

```json
{
  "id": "vox",
  "faderDb": 2.652244806289673,
  "inputTrimDb": -7.215085029602051,
  "inserts": [
    { "processor": "dynamics.compressor", "slot": "pre",
      "params": "{\"attackMs\":5.26,\"ratio\":3.34,\"thresholdDb\":-22.2,\"autoMakeup\":true}" },
    { "processor": "dynamics.vocalRider", "slot": "pre",
      "params": "{\"targetDb\":-18,\"maxBoostDb\":3,\"maxCutDb\":3}" }
  ],
  "sends": [
    { "id": "vox-to-reverbBus", "destinationBusId": "reverbBus", "sendDb": -10.5, "timing": "post" },
    { "id": "vox-to-delayBus", "destinationBusId": "delayBus", "sendDb": -14, "timing": "post" }
  ]
}
```

`sendDb`・`faderDb`・スレッショルドの変更は単なるテキスト編集です。プロセッサを外すのは `inserts` からオブジェクトを 1 つ消すことです。ミキサーは読み込み時にドキュメントを検証するため、記述ミスは「妙なミックス」ではなくロードエラーとして表面化します。

ストリップに書き込む `faderDb` は、シーンが読み込まれたあとにミキサーがライブの操作子として公開するフェーダーそのものです。下の各レーンはエンジン内の 3 本のストリップで、フェーダーやミュートを動かすとそのレーンの出力だけが変わります。`scene.json` で音を聴かずに行っている編集はこれで、ステップ 3 のレンダリングで初めて耳で確かめられます。

<SonareDemo id="engine-lane-mixer" />

## ステップ 3 — レンダリングする

```bash
sonare mix --scene scene.json \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  -o mix.wav --json
```

```json
{"strip_count": 6, "sample_rate": 48000, "block_size": 512,
 "rendered_samples": 494549, "output": "mix.wav"}
```

この出力には、知らないと驚く点が 3 つあります。

`--input` の ID はストリップ名です。`drums=stems/drums.wav` は `id` が `drums` のストリップへ供給します。どの `--input` も名指ししなかったストリップには無音が入ります。2 本のリターンストリップにはそれが正しい挙動ですが、名前を打ち間違えたときもまったく同じことが起きます。`strip_count` は供給した本数ではなくシーンのストリップ総数なので、`--input` の数にリターンの数を足した値と突き合わせてください。

レンダリング結果はステムより長くなります。ここでのステムは 6 秒ですが、`rendered_samples` は 494549 フレーム、つまり 10.3 秒です。この尾はプレートリバーブとステレオディレイが最後の音の後に鳴り残る分です。エフェクトリターンを外した同じシーンをレンダリングすると、ちょうど 288000 フレーム、入力と 1 サンプルも違わない長さが返ってきます。

ステレオは保たれます。モノラルのステムは左右両方に載り、ステレオのステムは自分の 2 チャンネルを保ち、出力は常にステレオペアです。3 チャンネル以上の入力は警告付きでダウンミックスされます。

## ステップ 4 — マスタリング前にミックスダウンを点検する

マスタリングは、小さな破損を大きくします。先に探しておきます。

```bash
sonare repair mix.wav --detect --json
```

`--detect` は計測と報告だけを行い、何も書き出しません。レンダリングのたびに気軽に走らせられます。返ってくるのはクリップ連続の長さとファイル中の割合、クリックとクラックルの件数、ノイズフロア、そして商用電源周波数の倍音列が信号に乗っているかどうかです。見つかったものは、マスターで直すよりステムで直すほうが安く済みます。整音側の手順は [録音素材をまとめて整音する](./recording-cleanup.md) にあります。

::: warning `--explain` と `--detect` は併用できません
`--detect` では修復ステージが 1 つも走らないため、説明すべき選択が存在しません。両方を渡すと使い方のエラーになります。どのステージが選ばれる理由を見たい場合は `--detect` を外してください。
:::

## ステップ 5 — 配信ターゲット向けにマスタリングする

```bash
sonare mastering mix.wav \
  --assistant --explain \
  --target-platform streaming \
  -o master.wav --report report.json --json
```

```json
{"mode": "assistant",
 "input_lufs": -19.61, "output_lufs": -14.11, "applied_gain_db": 7.53,
 "stages": ["eq.tilt", "dynamics.transientShaper", "dynamics.compressor",
            "saturation.exciter", "spectral.airBand", "stereo.imager",
            "loudness.optimize"],
 "explanation": ["base preset selected from top genre candidate: edm",
                 "target loudness and ceiling applied from AssistantConfig",
                 "air band enabled because the spectral profile is dark",
                 "compressor adjusted because loudness range is high",
                 "transient shaper enabled for dense attacks"],
 "latency_samples": 0}
```

`--assistant` はミックスダウンをプロファイリングし、計測したジャンルからベースプリセットを選び、見つかった特徴に応じてチェーンを調整します。`--explain` は、その調整のうちどれが発火したかとその理由を言わせるフラグです。`--target-platform` はチェーンが狙うラウドネスと天井を選びます。`streaming`、`youtube`、`broadcast`、`podcast`、`audiobook`、`cinema`、`club`、`cd` から選べます。プロセッサ自体は [マスタリングプロセッサ](../mastering-processors.md) に、判断ルールは [マスタリングアシスタント](../mastering-assistant.md) にまとまっています。

::: warning `--target-platform` は `--assistant` を要求します
プラットフォームターゲットはアシスタントへの入力であって、全体設定ではありません。プリセット実行に渡すと終了コード 3 でその旨を表示して止まります。固定プリセットでマスタリングしたい場合は `--preset <name>` を使い、`--target-lufs` と `--ceiling-db` を自分で指定してください。
:::

アシスタントが計測したジャンルに納得できないときは、プリセットを名指ししてください。`sonare mastering-presets --json` が 30 種すべてを列挙します。`pop` や `jpop` から `speech`、`fieldRecording`、さらに `vinyl` や `shellac78` まで揃っています。

## ステップ 6 — どの数値を信じるか

`--report` は、チェーン自身が取った処理前後の計測値を書き出します。

```json
{
  "before": { "integrated_lufs": -19.61, "true_peak_dbtp": -6.13, "loudness_range": 6.22 },
  "after":  { "integrated_lufs": -14.11, "true_peak_dbtp": -0.95, "loudness_range": 6.50 },
  "applied_gain_db": 7.53,
  "max_gain_reduction_db": -2.30,
  "loudness_target_limited": false,
  "band_energy_delta_db": [ /* 32 バンド */ ]
}
```

マスターが仕上がっているかを決めるのは 2 つのフィールドです。`loudness_target_limited` は、ラウドネス目標に届く前に天井へ当たったかどうかを示します。`false` なら目標に正攻法で到達したということです。`max_gain_reduction_db` は、そこへ到達するためにリミッターがどれだけ働いたかを示します。この値が大きく、かつ `loudness_target_limited` が `true` なら、ミックスのヘッドルームで出せる以上のラウドネスを要求しています。直すべきはマスターではなくミックスです。

::: danger レポートの数値はステレオの値です。別途 `lufs` で測った値は違います
Python CLI では `mastering` がステレオペアを最後まで保つ一方、`lufs` をはじめとする計測系コマンドは先にモノラルへダウンミックスし、標準エラー出力に警告を出します。そのため同じファイルに対して両者の値が食い違います。

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.57, ...}   ← モノラルに畳んだ値
# report.json の after.integrated_lufs = -14.11   ← ステレオのマスター
```

この差はどちらかの誤りではありません。[ITU-R BS.1770](../glossary/lufs.md) はチャンネルのパワーを合算するため、2 チャンネルのプログラムは同じ素材をモノラルへ畳んだものより約 3 dB 高く出ます。さらにサイド成分が畳み込みで失う分が上乗せされます。モノラルファイルなら両者は完全に一致します。

ステレオの納品物では、ラウドネスとトゥルーピークをマスタリングレポートから取ってください。`lufs` を使うのは納品物がモノラルのときです。ステレオのまま測りたい場合は [Python API](../python-api.md) のステレオ用エントリポイントを使います。
:::

## スクリプトとして回す

ここで使ったコマンドはすべて `--json` を受け付け、失敗はすべて[規定の終了コード](../cli.md#終了コード)で返ります。使い方の誤りは 2、不正なパラメータは 3、ファイルが見つからなければ 4、出力先に書けなければ 12 です。したがってスクリプト冒頭の `set -euo pipefail` だけで、実際に壊れた段階で連鎖を止められます。レンダリングされていないファイルをマスタリングしてしまう事故は起きません。

最後のステップをコミットごとの合否判定にする方法は [納品前チェックを CI で回す](./delivery-check.md) に続きます。

## 次に読むもの

- ミックスは近いが音色バランスが狙いどおりでない — [リファレンス曲に寄せる](./reference-master.md)。
- ステム自体が荒い — [録音素材をまとめて整音する](./recording-cleanup.md)。
- スクリプトではなくアプリに組み込みたい — [ミキシングエンジン](../mixing.md) と [マスタリングアシスタント](../mastering-assistant.md) が同じパイプラインを API で示しています。
