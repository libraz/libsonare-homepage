---
title: トーク番組を仕上げる
description: ホスト・ゲスト・音楽ベッドをダッキング済みで規定ラウドネスの 1 本にまとめる手順。commentaryDucking プリセットでミックスし、speech チェーンでマスタリングし、CLI だけで検証します。
---

# トーク番組を仕上げる

このページでは、ホストのトラック、ゲストのトラック、音楽ベッドを `commentaryDucking` でレンダーし、`speech` でマスタリングして、レポートを確認します。

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

# 4. Master for the platform with the explicit speech preset.
sonare mastering show.wav \
  --preset speech \
  -o show-master.wav --json

# 5. Confirm the loudness the episode actually landed at (a second render is
#    unavoidable here: --report only comes from a run that also writes audio).
sonare mastering show.wav \
  --assistant --preset speech --explain --target-platform podcast \
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

ダッキング自体はインサート 1 個です。`dynamics.sidechainRouter` が `music-bed` ストリップのポストフェーダースロットに乗り、`sidechainKey: "host"` で紐付いています。このキーがダッキングの仕組みそのものであり、ホストとゲストが両方流し込むステレオバスのようなものではありません。ベッドを下げるのはホストの音声だけです。ゲストが音楽の上で話していてホストが黙っていれば、このプリセットはベッドを下げないままにします。ナレーションを 1 人が担う対談番組ならそれで筋が通りますが、2 人が対等に喋るトーク番組では `guest` をキーにした 2 個目のサイドチェインインサートか、両者の音声を合算してからサイドチェインへ読ませるバスが必要になります。どちらもフラグではなく、取得したシーンへの手作業の編集です。

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

## ステップ 4 — speech プリセットでマスタリングする

```bash
sonare mastering show.wav --preset speech -o show-master.wav --json
```

```json
{"mode": "preset", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.95, "output": "show-master.wav", "preset": "speech", "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "loudness.optimize"]}
```

同じ名前付きプリセットをアシスタントの出発点にすると、レポートへ説明も追加できます。

```bash
sonare mastering show.wav --assistant --preset speech --explain --target-platform podcast -o show-assistant.wav --report show-report.json --json
```

```json
{"mode": "assistant", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.29, "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "stereo.monoMaker", "loudness.optimize"], "explanation": ["base preset: speech", "target loudness and ceiling applied from AssistantConfig", "speech preset enables de-esser and mono compatibility"]}
```

単独の `speech` プリセット実行は、組み込みの -16 LUFS を目標にします。アシスタント実行は同じチェーンを出発点にし、`--target-platform podcast` から -16 LUFS を取得します。さらに speech プリセットの低域モノメーカー段と説明を加えます。アシスタントは音声からジャンルを推測しないため、`--preset speech` という選択がそのまま表示され、再現できます。

::: danger `--target-platform` には `--assistant` が必要です
```bash
sonare mastering show.wav --preset speech --target-platform podcast -o x.wav --json
# Error: --target-platform requires --assistant
# exit code 3
```
プラットフォームターゲットはアシスタントへの入力であって、全体設定ではありません。単独の `--preset` 実行と組み合わせることはできないため、このフラグは拒否されます。名前付き speech チェーンとプラットフォームターゲットを両方使うときは、`--assistant --preset speech --target-platform podcast` を指定します。
:::

`--target-platform` は `streaming`、`youtube`、`broadcast`、`podcast`、`audiobook`、`cinema`、`club`、`cd` を受け付けます。`broadcast`、`podcast`、`club`、`cd` は、対応する値を明示していない場合に固有のラウドネスと天井を適用します。それ以外の名前は受け付けますが、現在の値を変更しません。全オプションは `sonare mastering --help` で確認できます。各ターゲットが実際に何を要求しているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

## ステップ 5 — 声がモノラルで安全かを確認する

```bash
sonare mastering show.wav --assistant --preset speech --target-platform podcast --speech-mono-amount 0 -o show-mono0.wav --json
sonare mastering show.wav --assistant --preset speech --target-platform podcast --speech-mono-amount 1 -o show-mono1.wav --json
if cmp -s show-mono0.wav show-mono1.wav; then
  echo "mono amount did not change these files"
else
  echo "mono amount changed the render"
fi
```

`--speech-mono-amount`（0〜1、既定値 1）は、speech プリセットの 120 Hz モノメーカー・クロスオーバーより下にあるサイド成分をモノラルへ寄せる量を調整します。`--preset speech` を選んでいるためアシスタントがこの処理を適用し、音声のジャンル分類には依存しません。0 は低域のサイド成分をそのまま残し、1 はクロスオーバーより下のサイド成分を取り除きます。クロスオーバーより上のサイド成分は残ります。聴感上およびバイト単位の差は、エピソードにどれだけ低域のサイド成分があるかで変わります。

低域をモノラルにまとめるこの処理を試す理由は、実番組にもあります。携帯電話のスピーカー、通話モードの Bluetooth イヤホン、ポッドキャストアプリの「音声を強調」設定は、再生前に左右をひとつのチャンネルへ合算します。このシーンでは `host` の `pan` が 0、`guest` の `pan` が 0.1 とほぼセンターなので、差が大きくなるのはステレオの部屋鳴りマイクなど、収録に広い低域サイド成分が含まれる場合です。

::: tip 発話専用フラグを使う前にプリセットを確認する
`--explain` を付けて実行し、`explanation` フィールドに `speech preset enables de-esser and mono compatibility` が含まれることを確認してください。speech プリセットを出発点にし、発話向けの処理が適用されたことを確認できます。
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

-16 LUFS は `--target-platform podcast` が求めている値で、`after.integrated_lufs` が計測結果です。`loudness_target_limited: false` は、設定した制約の範囲で目標に到達したことだけを意味し、リミッターが動いていないことやマスターが完成したことは示しません。`max_gain_reduction_db` で実際の最大ゲインリダクションを確認し、ラウドネスと True Peak の値を読んだうえで試聴してください。数値そのものの意味は [LUFS](../glossary/lufs.md) に、他のプラットフォームが -16 の代わりに何を求めているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) の 4 ステムの例と同じく、別途 `sonare lufs show-master.wav` を呼ぶとこの値とは食い違います。先にモノラルへダウンミックスしたうえで標準エラー出力に警告を出すからです。ステレオの納品物では、マスタリングレポートの数値を信じてください。

## 次に読むもの

- ベッドや声そのものにノイズ・クリック・ハムが乗っている — [録音素材をまとめて整音する](./recording-cleanup.md)。
- このエピソードのラウドネスをリリースのたびに自動で点検したい — [納品前チェックを CI で回す](./delivery-check.md)。
- ここで使ったシーンとインサートの JSON 形式はフィールド単位で [ミキシングシーン JSON](../mixing-scene-json.md) に、ダッキングとダイナミクス系プロセッサは [マスタリングプロセッサ](../mastering-processors.md) に、アシスタントの判断ルールは [マスタリングアシスタント](../mastering-assistant.md) にまとまっています。
- スクリプトではなくアプリにこのパイプラインを組み込みたい — [ミキシングエンジン](../mixing.md) が [CLI リファレンス](../cli.md) と各言語 API を通じて同じシーン・ストリップモデルを示しています。
