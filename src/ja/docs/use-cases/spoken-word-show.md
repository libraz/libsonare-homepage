---
title: トーク番組を仕上げる
description: ホスト・ゲスト・音楽ベッドをダッキング済みで規定ラウドネスの 1 本にまとめる手順。commentaryDucking プリセットでミックスし、speech チェーンでマスタリングし、CLI だけで検証します。
---

# トーク番組を仕上げる

手元にあるのは 3 本のファイルです。ホストのトラック、ゲストのトラック、そして音楽ベッド。発話は重ならず、ベッドは番組全体を通して鳴り続け、納品物はダッキング済みで規定ラウドネスに収まった 1 本のファイルです。このページは、それを組み込みのミキサープリセットと明示的なマスタリングプリセットで実現します。どちらも「これは音楽ではなく音声の仕事だ」という前提で選ばれています。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- ホスト・ゲスト・音楽ベッドを組み込みの `commentaryDucking` ミキサープリセットに通し、ダッキングを実際に配線しているものが何かを読み取れる。
- シーン内のダッキング量を編集し、本当に効いた変更と何も変えなかった変更を見分けられる。
- アシスタントにジャンルを推測させるのではなく `speech` プリセットでマスタリングし、なぜそちらが妥当なのかを説明できる。
- 番組が配信可能な状態かどうかを決めるラウドネス値を読み取れる。

## 全体のスクリプト

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Fetch the built-in ducking scene and inspect it before rendering.
sonare mixing-preset --preset commentaryDucking --json > scene.json

# 2. Loosen the duck a little: edit the music bed's sidechain range in place.
python3 -c '
import json
scene = json.load(open("scene.json"))
for strip in scene["strips"]:
    if strip["id"] == "music-bed":
        for insert in strip["inserts"]:
            if insert["processor"] == "dynamics.sidechainRouter":
                insert["params"] = json.dumps({"rangeDb": 5})
json.dump(scene, open("scene.json", "w"))
'

# 3. Render host, guest, and the bed through the edited scene.
sonare mix --scene scene.json \
  --input host=host.wav \
  --input guest=guest.wav \
  --input music-bed=music-bed.wav \
  -o show.wav --json

# 4. Master for the platform with the explicit speech preset, not the genre-guessing assistant.
sonare mastering show.wav \
  --preset speech \
  -o show-master.wav --json

# 5. Confirm the loudness the episode actually landed at (a second render is
#    unavoidable here: --report only comes from a run that also writes audio).
sonare mastering show.wav \
  --assistant --explain --target-platform podcast \
  -o show-assistant.wav --report show-report.json --json
```

<FlowDiagram
  title="ホスト・ゲスト・ベッドからダッキング済みエピソードへ"
  direction="LR"
  :nodes="[
    { id: 'host', label: 'host.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'guest', label: 'guest.wav', col: 0, row: 1, variant: 'muted' },
    { id: 'bed', label: 'music-bed.wav', col: 0, row: 2, variant: 'muted' },
    { id: 'hoststrip', label: 'host: デエッサー+コンプ', col: 1, row: 0, variant: 'accent' },
    { id: 'gueststrip', label: 'guest: コンプ', col: 1, row: 1, variant: 'accent' },
    { id: 'bedstrip', label: 'music-bed: sidechainRouter', col: 1, row: 2, variant: 'decision' },
    { id: 'master', label: 'master バス', col: 2, row: 1, variant: 'accent' },
    { id: 'mixdown', label: 'show.wav', col: 3, row: 1 },
    { id: 'mastering', label: 'mastering --preset speech', col: 4, row: 1, variant: 'accent' },
    { id: 'out', label: 'show-master.wav', col: 5, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'host', to: 'hoststrip' },
    { from: 'guest', to: 'gueststrip' },
    { from: 'bed', to: 'bedstrip' },
    { from: 'host', to: 'bedstrip', label: 'sidechainKey', style: 'dashed' },
    { from: 'hoststrip', to: 'master' },
    { from: 'gueststrip', to: 'master' },
    { from: 'bedstrip', to: 'master' },
    { from: 'master', to: 'mixdown' },
    { from: 'mixdown', to: 'mastering' },
    { from: 'mastering', to: 'out' }
  ]"
  caption="ダッキングを駆動するのはホストのストリップだけです。ゲストの発話は音楽ベッドを下げません。"
/>

## ステップ 1 — プリセットを取得し、何が配線されているかを読む

`sonare mixing-presets --json` は組み込みシーンを 3 つ返します。`vocalReverbSend`、`drumBusSubgroup`、そして `commentaryDucking` です。3 つ目がこの仕事に対応します。

```bash
sonare mixing-preset --preset commentaryDucking --json
```

レンダリングする前に、まずシーンを読んでください。プリセットは出発点であってブラックボックスではなく、`strips` の中身を読めば何をしているかがそのまま分かります。

| ストリップ | `faderDb` | インサート | 備考 |
|-----------|-----------|-----------|------|
| `host` | -3 | `dynamics.deesser`（6000 Hz、スレッショルド -24 dB）、続けて `dynamics.compressor`（スレッショルド -20 dB、レシオ 3） | `pan: 0`、センター |
| `guest` | -4 | `dynamics.compressor`（スレッショルド -22 dB、レシオ 2.5） | `pan: 0.1`、2 人の声が重ならないようわずかに右へ寄せてある |
| `music-bed` | -18 | `dynamics.sidechainRouter`（`rangeDb: 18`、`sidechainKey: "host"`、`slot: "post"`） | ダッキングが働く前から、すでに声より 15 dB 低い |

3 本のストリップはいずれも `master` バスへ直接つながっており、[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) のリバーブ・ディレイのようなリターンを管理する必要はありません。`voices` という VCA グループが `host` と `guest` を `gainDb: 0` でまとめており、電話出演のコーナーなどで 2 人の声だけをまとめて下げたいとき、ベッドに触れずに 1 本のフェーダー操作で済ませられます。

ダッキング自体はインサート 1 個です。`dynamics.sidechainRouter` が `music-bed` ストリップのポストフェーダースロットに乗り、`sidechainKey: "host"` で紐付いています。このキーがダッキングの仕組みそのものであり、ホストとゲストが両方流し込むステレオバスのようなものではありません。ベッドを下げるのはホストの音声だけです。ゲストが音楽の上で話していてホストが黙っていれば、このプリセットはベッドを下げないままにします。ナレーションを 1 人が担う対談番組ならそれで筋が通りますが、2 人が対等に喋るトーク番組では `guest` にキーした 2 個目のサイドチェインインサートか、両者の音声を合算してからサイドチェインへ読ませるバスが必要になります。どちらもフラグではなく、取得したシーンへの手作業の編集です。

::: tip レンダリングする前にシーンを読む
`mixing-preset --preset <名前> --json` はただの JSON 出力で、ここではまだ音声に何も起きていません。そのまま `mix --scene -` へパイプしても動きますが、上のスクリプトのように一度ファイルへ書き出しておけば、こうした片側だけのサイドチェインを何もレンダリングしないうちに見つけられます。
:::

## ステップ 2 — ダッキング量を編集し、本当の変更と無効な変更を見分ける

サイドチェインインサートの `rangeDb` は、実際にどれだけダッキングされるかではなく上限です。ベッドを下げてよい最大量であって、ホストの音量が実際にそれを要求したときにだけそこまで下げられます。この教材素材では、その違いは机上の話ではありません。

```bash
python3 -c '
import json
scene = json.load(open("scene.json"))
for strip in scene["strips"]:
    if strip["id"] == "music-bed":
        for insert in strip["inserts"]:
            if insert["processor"] == "dynamics.sidechainRouter":
                insert["params"] = json.dumps({"rangeDb": 30})
json.dump(scene, open("scene.json", "w"))
'
sonare mix --scene scene.json \
  --input host=host.wav --input guest=guest.wav --input music-bed=music-bed.wav \
  -o show-r30.wav --json
cmp show.wav show-r30.wav   # identical — no output
```

`rangeDb` をプリセットの既定値 18 から 30 へ上げても何も変わりません。`cmp` は 2 つのレンダリングをバイト単位で完全一致と報告します。この素材では、ホストの音量が求める削減量はどれだけ多くてもおよそ 7 dB までしかなく、8 dB 前後以上の上限であれば上限がないのと同じ挙動になるからです。その値より下げれば、編集が結果に現れます。`sonare dynamics` でファイル全体を測ると効果が出ますが、8 秒のうちホストが話していない区間も長く含めた平均なので値そのものは小さく出ます。

| `rangeDb` | `rms_db`（ファイル全体） | `peak_db` |
|-----------|--------------------------|-----------|
| インサートを丸ごと削除 | -22.80 | -10.79 |
| `1` | -22.85 | -10.84 |
| `5` | -22.95 | -10.92 |
| `18`（プリセットの既定値） | -22.96 | -10.92 |
| `30` | -22.96（`18` とバイト単位で同一） | -10.92 |

`rangeDb: 5` は、このページ冒頭のスクリプトが最終的に採用している値です。当てずっぽうではなく、上の表で確かめたうえでプリセットの既定値よりわずかに浅いダッキングを選んでいます。

::: warning 一度も届いていない上限は、調整したことにならない
`rangeDb` を下げても手元のレンダリングが何も変わらないなら、原因はパラメータではなく、ホストのトラックがルーターの反応するスレッショルドより静かで、そもそもダッキングが要求されていないことです。深さを詰める作業に時間をかける前に、プリセットの既定値でダッキングがそもそも働いているかを確認してください。
:::

サイドチェインルーターは、検出器がベッドではなくホストを聴いているコンプレッサーです。要求される削減量は下の網かけのゲインリダクションそのもので、キーがスレッショルドをどれだけ超えたかにレシオを掛けた分しかありません。プログラムが超えなくなるまでスレッショルドを上げると網かけは消えます。それが上の警告が述べている状態で、`rangeDb` をいくつにしても戻ってきません。

<SonareDemo id="compressor-curve" />

## ステップ 3 — レンダリングする

```bash
sonare mix --scene scene.json \
  --input host=host.wav \
  --input guest=guest.wav \
  --input music-bed=music-bed.wav \
  -o show.wav --json
```

```json
{"strip_count": 3, "sample_rate": 48000, "block_size": 512, "rendered_samples": 384000, "output": "show.wav"}
```

`strip_count` が 3 なのは、このシーンに aux リターンが 1 本もないからです。すべての `--input` が実在するストリップを指しており、4 ステムの楽曲シーンにあったような無音のリターンを気にする必要がありません。各 `--input` の ID はシーン内のストリップ `id` と一致していなければならず、どの `--input` も名指ししなかったストリップには無音が入ります。これはベッドをある回だけ意図的に外すなら正しい挙動ですが、`music-bed` を `musicbed` と打ち間違えたときも同じことが黙って起こります。

## ステップ 4 — アシスタントの推測ではなく speech プリセットでマスタリングする

```bash
sonare mastering show.wav --preset speech -o show-master.wav --json
```

```json
{"mode": "preset", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.95, "output": "show-master.wav", "preset": "speech", "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "loudness.optimize"]}
```

これを、`--assistant` にチェーンを自分で選ばせた場合と比べます。

```bash
sonare mastering show.wav --assistant --explain --target-platform podcast -o show-assistant.wav --report show-report.json --json
```

```json
{"mode": "assistant", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.29, "stages": ["eq.tilt", "dynamics.compressor", "stereo.imager", "loudness.optimize"], "explanation": ["base preset selected from top genre candidate: classical", "target loudness and ceiling applied from AssistantConfig"]}
```

どちらも `--target-platform podcast` が求める -16 LUFS に同じように到達します。違うのはそこへ至るチェーンです。アシスタントはこのダッキング済みミックスダウンをプロファイリングし、ベースジャンルとして `classical` を選びました。楽器のような音色と発話のような音色が混在する信号に対しては一見もっともらしい推測ですが、実際のファイルの中身とはまったく違います。そのチェーンにはデノイズ段もデエッサーもありません。明示的な `speech` プリセットはその両方に加えて、同じティルト・コンプレッサー・ラウドネス最適化を備えています。話しことばを扱うときは、音楽向けに調整されたジャンル分類器にアシスタントの判断を委ねず、プリセットを名指ししてください。

::: danger `--target-platform` は `--assistant` を要求します
```bash
sonare mastering show.wav --preset speech --target-platform podcast -o x.wav --json
# Error: --target-platform requires --assistant
# exit code 3
```
プラットフォームターゲットはアシスタントへの入力であって、全体設定ではありません。`--preset` 実行にはアシスタントが調整すべきジャンル分類そのものが存在しないため、フラグはそのまま拒否されます。それでも下のステップ 5 のように `--assistant --target-platform podcast` の実行自体は行い、その `--report` からラウドネスの数値を読んでください。`--preset speech` でマスタリングする場合に使わないのは、その*処理チェーン*だけです。
:::

`--target-platform` は `streaming`、`youtube`、`broadcast`、`podcast`、`audiobook`、`cinema`、`club`、`cd` を受け付けます。全オプションは `sonare mastering --help` で確認できます。各ターゲットが実際に何を要求しているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

## ステップ 5 — 声がモノラルで安全かを確認する

```bash
sonare mastering show.wav --assistant --target-platform podcast --speech-mono-amount 0 -o show-mono0.wav --json
sonare mastering show.wav --assistant --target-platform podcast --speech-mono-amount 1 -o show-mono1.wav --json
cmp show-mono0.wav show-mono1.wav   # identical — no output
```

`--speech-mono-amount`（0〜1、既定値 1）は、発話らしい素材の低域・中央成分をモノラルへ寄せると説明されています。この教材素材では、両極端の値がバイト単位で同一のファイルを生成します。原因はここでもアシスタントのジャンル分類です。`--speech-mono-amount` はアシスタント専用のオプションで、`--preset` 実行に渡すとそのまま拒否されますし、アシスタントは自身が発話らしいと分類した素材にしかこの発話専用のモノラル処理を適用しません。この番組は `classical` に分類されている（ステップ 4 を参照）ため、値をいくつにしてもこのフラグには作用対象がありません。

それでもこの機能そのものの狙いは実番組にそのまま当てはまります。携帯電話のスピーカー、通話モードの Bluetooth イヤホン、ポッドキャストアプリの「音声を強調」設定は、いずれもリスナーの耳に届く前に左右をひとつのチャンネルへ合算します。このプリセットで `host` の `pan` が 0、`guest` の `pan` が 0.1 とほぼセンターに寄せてあるのはまさにこの理由からで、わずかなオフセットは、デバイスがペアをモノラルへ畳んだときの位相打ち消しのリスクを冒さずに 2 人の声を分離します。もし実際の収録がこのプリセットの固定パンより広いステレオイメージを声に持たせている場合、たとえばゲストにステレオの部屋鳴りマイクを使っているような場合は、それこそ `--speech-mono-amount` が用意されている状況です。ただしその場合も、フラグに絞り込みを任せる前に、アシスタントが実際にそれを発話として認識しているかを自分の素材で確かめる価値があります。

::: tip 発話専用フラグを信じる前に分類結果を確認する
「発話らしい素材」に限定されたアシスタントのオプションは、その判定を下す分類器と同じだけの精度しかありません。発話専用フラグが実際に発火したと判断するのは、`--explain` を付けて実行し、`explanation` フィールドが述べているジャンルを確認してからにしてください。
:::

## ステップ 6 — 信じるべきラウドネスを読む

podcast をターゲットにしたアシスタント実行の `--report show-report.json` には、番組が仕上がっているかどうかを決める数値が入っています。

```json
{
  "before": { "integrated_lufs": -21.13, "true_peak_dbtp": -10.92 },
  "after":  { "integrated_lufs": -16.01, "true_peak_dbtp": -4.63 },
  "applied_gain_db": 6.29,
  "max_gain_reduction_db": -1.15,
  "loudness_target_limited": false
}
```

-16 LUFS は `--target-platform podcast` が求めている値で、`output_lufs` はそこへ到達しています。`loudness_target_limited: false` は、True Peak の天井に押し戻されることなく、ゲインだけで目標に到達したことを意味します。数値そのものの意味は [LUFS](../glossary/lufs.md) に、他のプラットフォームが -16 の代わりに何を求めているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) の 4 ステムの例と同じく、別途 `sonare lufs show-master.wav` を呼ぶとこの値とは食い違います。先にモノラルへダウンミックスしたうえで標準エラー出力に警告を出すからです。ステレオの納品物では、マスタリングレポートの数値を信じてください。

## 次に読むもの

- ベッドや声そのものにノイズ・クリック・ハムが乗っている — [録音素材をまとめて整音する](./recording-cleanup.md)。
- このエピソードのラウドネスをリリースのたびに自動で点検したい — [納品前チェックを CI で回す](./delivery-check.md)。
- ここで使ったシーンとインサートの JSON 形式はフィールド単位で [ミキシングシーン JSON](../mixing-scene-json.md) に、ダッキングとダイナミクス系プロセッサは [マスタリングプロセッサ](../mastering-processors.md) に、アシスタントの判断ルールは [マスタリングアシスタント](../mastering-assistant.md) にまとまっています。
- スクリプトではなくアプリにこのパイプラインを組み込みたい — [ミキシングエンジン](../mixing.md) が [CLI リファレンス](../cli.md) と各言語 API を通じて同じシーン・ストリップモデルを示しています。
