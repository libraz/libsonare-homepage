---
title: 録音素材をまとめて整音する
description: クリップし、ハムが乗り、クリックが混じり、頭と尻に無音が余分についた荒いテイクの束を、まず何が壊れているかを測り、その根拠が求める処理だけを当て、トリムするところまで。何を見つけ何をしたかの記録付きです。
---

# 録音素材をまとめて整音する

荒いテイクの束がドライブに転がっている。ゲインが高すぎてクリップしたもの、アースが悪くて 50 Hz や 60 Hz の商用電源ハムが乗ったもの、そしてほとんどのテイクは頭と尻に 1、2 秒の無音が余分に付いている。どのテイクにどの問題があるのか、ファイルごとには分かっていない。このページはまずそれを測り、その測定結果が求める処理だけを当て、両方を記録に残します。

この作業は「全部に declip を掛ける」ことではありません。何も壊れていないステージを走らせるのは、ただ品質を削るだけです。declip は一度もクリップしていないサンプルまで再合成しますし、dehum は商用電源周波数に乗っている本物の音楽的な成分までノッチで削ります。修復アシスタントの価値は、根拠のないステージを断る点にあり、`--explain` はそれが実際にそうなったかを確かめる手段です。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- テイクに触れる前にまず何が壊れているかを測り、アシスタントが選んだ、あるいは選ばなかった各修復ステージの理由を読める。
- `repair`・`trim-silence`・`declip` をファイルごとのバッチ処理としてスクリプト化し、クリーンなテイクと、何を見つけ何をしたかの JSON 記録の両方を書き出せる。
- `repair` を動かす 3 つの方法 —— 計測して選ばせる・名前付きプリセット・フィールド単位の上書き —— を区別し、それぞれがどんな場面向けかを判断できる。
- 修復は不可逆な取引であることを踏まえ、ある数値をゼロまで追い込むことが割に合わない場面を見分けられる。

## 全体のスクリプト

以下がこの作業の全体です。テイクの入ったフォルダに対して実行し、そのうえで各段階が何をしているか、なぜそうなっているかを読んでください。

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p clean reports

for raw in raw/*.wav; do
  name="$(basename "${raw%.wav}")"

  # 1. Measure the damage. Writes nothing -- safe to run on every take.
  sonare repair "$raw" --detect --json > "reports/${name}.before.json"

  # 2. Let the assistant choose only the stages step 1's evidence calls for.
  sonare repair "$raw" -o "clean/${name}.wav" --explain --json > "reports/${name}.repair.json"

  # 3. Trim the dead air every take was padded with.
  sonare trim-silence "clean/${name}.wav" -o "clean/${name}.trimmed.wav" --json \
    > "reports/${name}.trim.json"

  # 4. Measure again. This is the verification step, not a separate audit.
  sonare repair "clean/${name}.trimmed.wav" --detect --json > "reports/${name}.after.json"

  # 5. Fold the four records into one per-file report.
  python3 - "$name" <<'PY'
import json
import sys

name = sys.argv[1]
before = json.load(open(f"reports/{name}.before.json"))["defects"]
repair = json.load(open(f"reports/{name}.repair.json"))
trim = json.load(open(f"reports/{name}.trim.json"))
after = json.load(open(f"reports/{name}.after.json"))["defects"]

record = {
    "file": name,
    "detect_before": before,
    "stages_chosen": repair["stages"],
    "reasons": repair.get("explanation", []),
    "output_gain_db": repair["output_gain_db"],
    "trimmed_duration": trim["duration"],
    "detect_after": after,
}
with open(f"reports/{name}.json", "w") as f:
    json.dump(record, f, indent=2)
PY

  rm -f "reports/${name}.before.json" "reports/${name}.repair.json" \
        "reports/${name}.trim.json" "reports/${name}.after.json"
done
```

2 本のテイク —— 一方はハードクリップと商用電源ハム、もう一方はハムとクリックだけ —— に対して実行すると、こう出力されます。

```text
reports/take-01.json  ->  repair.declip, repair.declick, repair.decrackle, repair.dehum
reports/take-02.json  ->  repair.declick, repair.decrackle, repair.dehum
```

`take-02` にはクリップがなく、そのステージ一覧に `declip` はありません。この 1 行だけで、先に測ることの意味が尽きています。アシスタントは 2 本の異なるテイクを見て、実際に 2 通りの違うものを直しました。

<FlowDiagram
  title="バッチ整音のパイプライン"
  direction="LR"
  :nodes="[
    { id: 'raw', label: 'テイク一式 (WAV)', col: 0, row: 0, variant: 'muted' },
    { id: 'detect1', label: 'repair --detect', col: 1, row: 0, variant: 'accent' },
    { id: 'choose', label: 'アシスタントが選択', col: 2, row: 0, variant: 'decision' },
    { id: 'repair', label: 'repair --explain', col: 3, row: 0, variant: 'accent' },
    { id: 'clean', label: '修復済みテイク', col: 4, row: 0 },
    { id: 'trim', label: 'trim-silence', col: 5, row: 0, variant: 'accent' },
    { id: 'trimmed', label: 'クリーンなテイク', col: 6, row: 0, variant: 'success' },
    { id: 'detect2', label: 'repair --detect (検証)', col: 6, row: 1, variant: 'warning' },
    { id: 'record', label: 'ファイルごとの record.json', col: 7, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'raw', to: 'detect1' },
    { from: 'detect1', to: 'choose' },
    { from: 'raw', to: 'repair', label: '音声', style: 'dashed' },
    { from: 'choose', to: 'repair' },
    { from: 'repair', to: 'clean' },
    { from: 'clean', to: 'trim' },
    { from: 'trim', to: 'trimmed' },
    { from: 'trimmed', to: 'detect2', style: 'dashed' },
    { from: 'detect1', to: 'record', style: 'dashed' },
    { from: 'detect2', to: 'record', style: 'dashed' }
  ]"
  caption="検出器はテイクごとに 2 回走ります。1 回目は何を直すか決めるため、2 回目は直せたことを確かめるためです。"
/>

## ステップ 1 — 触る前にまず測る

```bash
sonare repair take-raw.wav --detect --json
```

`--detect` は計測して報告するだけです。ファイルは何も書き出さず、`-o` を渡すことすらできません。だからこそフォルダ内のテイク全部に対して、何も決める前に気軽に走らせられます。オプション全体は [CLI リファレンス — repair](../cli.md#repair) にあります。

```json
{
  "mode": "detect",
  "defects": {
    "click_count": 1,
    "click_rejected": 4989,
    "crackle_per_second": 0.759,
    "clip_sample_fraction": 0.1139,
    "clip_run_count": 3137,
    "clip_longest_run_samples": 45,
    "clip_flat_level": 0.99997,
    "noise_floor_dbfs": -120.0,
    "hum_peak_found": true,
    "hum_fundamental_hz": 50.0,
    "hum_fundamental_prominence": 18.62,
    "hum_harmonics": 2,
    "late_decay_ratio_db": -4.86
  }
}
```

このテイクでは 4 つの数値だけでほぼ全体像が分かります。`clip_sample_fraction` はサンプルの 11.4% がクリップしていると言い、1.0 に近い `clip_flat_level` はそれが単に大きいのではなく平らに張り付いていることを示します。ちょうど 50 Hz に商用電源の倍音が 18.6 dB の突出度で乗っており、`crackle_per_second` はノイズフロアが単なる静かなヒスではなく広帯域のクラックルであることを示します。`click_count` はわずか 1 ですが、`click_rejected`（4989）は検出器が「クリックらしく見えて実はそうではない」と判断したイベントの数です。検出器が何かを見逃したと結論する前に、この数字を知っておく価値があります。

## ステップ 2 — アシスタントに選ばせる

```bash
sonare repair take-raw.wav -o take-clean.wav --explain --json
```

```json
{
  "mode": "assistant",
  "stages": ["repair.declip", "repair.declick", "repair.decrackle", "repair.dehum"],
  "explanation": [
    "declip: runs of samples sit pinned at one level",
    "declick: impulsive runs stand out from their neighbours",
    "decrackle: samples depart from the local median",
    "dehum: a prominent harmonic series sits on a mains frequency"
  ],
  "output": "take-clean.wav",
  "output_gain_db": -1.87
}
```

各ステージは、検出器が使ったのと同じ語彙で、それを発火させた根拠そのものを述べています。`denoise` と `dereverb` は入っていません。このテイクの `noise_floor_dbfs` と `late_decay_ratio_db` がそれらを求めなかったので、一度も走っていないということです。`output_gain_db` は修復ステージではありません。declip はクリッパーが削ったピークを再構築するため、その結果はフルスケールを超えて膨らみがちです。そこでサンプルごとにクランプするのではなく、ファイル全体に 1 つのゲインを当てて収めます。

::: tip `--explain` と `--detect` は併用できません
`--detect` では修復ステージが 1 つも走らないため、説明すべき選択が存在しません。両方渡すと不正なパラメータとして拒否されます。理由を見たいなら `--detect` を外し、数値だけでよいなら `--explain` を外してください。
:::

## ステップ 3 — 無音の余白をトリムする

```bash
sonare trim-silence take-clean.wav -o take-trimmed.wav --json
```

```json
{"length": 350528, "duration": 7.303, "threshold_db": -60.0, "n_fft": 2048, "hop_length": 512}
```

テイクは頭と尻の余白を含めて 7.9 秒でしたが、トリム後は 7.303 秒です。つまりおよそ 0.6 秒の無音が取れました。`--threshold-db`（デフォルト −60 dB）は、あるフレームを無音と数える閾値です。ファイル自身のピークを基準にした値で同じ切り方をしたい場合は `--top-db` も受け付けます。トリムは修復とは無関係で、テイクに修復が必要だったかどうかに関係なく走ります。ここでパイプラインの中で修復のあとに置いているのは、無音の余白をトリムするためであって、余白の形をしたクリップ済みの端をトリムしてしまわないためです。

## ステップ 4 — 複数テイクを共有する無音で切る

問題が 1 本の欠陥テイクではなく、そこそこ良い出来のテイクが何本もあることもあります。同じフレーズに 3 回挑戦し、それぞれ入りと抜けのタイミングが少しずつ違っていて、それらをスライスごとに聴き比べたい、という場合です。ステップ 3 の `trim-silence` を各テイクに個別に掛けても役には立ちません。テイクごとに別々の切り出し位置が決まってしまうため、境界がファイルごとに違う場所へ来てしまい、「同じ」スライスのつもりが実は 3 種類の違うスライスになります。

[`split-silence`](../cli.md#split-silence) はまさにこの用途のために、一度に複数のファイルを受け取れます。1 本目のテイクは位置引数で渡し、同じ部分の残りのテイクは繰り返し指定できる `--input` で加えます。

```bash
sonare split-silence take1.wav --json
```

```json
[{"start_sample": 28160, "end_sample": 116224}, {"start_sample": 153088, "end_sample": 241152}, {"start_sample": 287232, "end_sample": 394752}]
```

テイク 1 本だけでは、フレーズごとに 1 つずつ、3 つの非無音区間が報告されます。`trim-silence` が見つけるのと同じ形を、1 つのトリム後の長さではなくサンプル範囲として表したものです。同じ部分の残り 2 本のテイクを加えます。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --json
```

```json
[{"start_sample": 23040, "end_sample": 121344}, {"start_sample": 147968, "end_sample": 246272}, {"start_sample": 282624, "end_sample": 399872}]
```

最初の区間は 28160–116224 から 23040–121344 へと広がります。この広がり方こそがこの機能の要点です。報告される区間は各テイク自身の非無音区間の **和集合** で、接するところは統合されます。つまり切り出しが起きるのは全テイクが同時に無音になっている場所だけで、どのテイクのフレーズの途中にもかかりません。各テイクを自分自身の区間で切ってしまうと、あるテイクの早い入りが別のテイクのスライスではアタックを削り取ることになります。3 本まとめて和集合で切れば、どのテイクも全テイクが共有する無音の分だけを失い、それ以上は失いません。

`split-silence` は `-o` を一切受け付けません。区間を報告するだけのコマンドで、`--output` を渡すと使用法エラーで終了します。共有区間を実際の音声にするのが `--write-takes PREFIX` で、テイクごと・区間ごとに 1 ファイルずつ、`PREFIX{take:02d}_{interval:03d}.wav`（どちらの番号も 1 始まり）という名前で書き出します。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --write-takes comp --json
```

3 本のテイクと 3 つの共有区間から、9 個のファイル `comp01_001.wav` から `comp03_003.wav` までが書き出されます。1 つの区間の中では、テイクをまたいでもファイルの長さが揃います —— 区間 1 ならどのテイクでも 98304 サンプルです。テイク自身はサンプル単位で揃っているわけではないのに、です。和集合の境界より前に終わっているテイクは、短く切られるのではなくその分だけ無音でパディングされます。だからこそ `comp01_001.wav`・`comp02_001.wav`・`comp03_001.wav` は横並びで聴き比べられます。開始位置も長さも同じ、同じフレーズの 3 つの異なる演奏です。

ここで **やらないこと** も明確にしておきます。最良のテイクを選ぶことはなく、クロスフェードもせず、フレーズ途中のタイミングのずれも直しません。途中で走ったり遅れたりしているテイクは、切り出した後もそのまま走ったり遅れたりします。手元に残るのは判断材料としての揃ったスライスであって、完成したコンピングではありません。

全テイクのサンプルレートが一致している必要があり、これは何よりも先にチェックされます。

```bash
sonare split-silence take1.wav --input take2.wav --input t3_44.wav --json
# Error: take sample rate differs: t3_44.wav is 44100 Hz, the first take is 48000 Hz
```

これは使用法レベルの不一致で（終了コード 3）、このページの他の場所で不明なパラメータキーを渡したときと同じ分類です。

::: warning `--top-db` は各テイク自身のピークが基準で、絶対値ではありません
同じ `--top-db` でも、ノイズの多いテイクほど見つかる無音は少なくなります。閾値は固定の dBFS ではなく、そのテイク自身のピークを基準にしているからです。`take1.wav` は（`repair --detect` で測ると）ノイズフロアが約 −99.9 dBFS で、3 つのフレーズの間にはっきりした隙間が残ります。ファイルの他の部分は変えずにそのノイズフロアを約 −69.1 dBFS まで持ち上げると、同じテイクの結果はファイルのほぼ全体を覆う 1 つの区間に潰れてしまいます —— 閾値が、無音と呼べるほど静かな場所をもう見つけられなくなったということです。「このくらいのヘッドルームがあれば安全」という一律の dB はありません。まず `noise_floor_dbfs` を確認し、ノイズフロアが高いテイクは `--top-db` を下げて帳尻を合わせるのではなく、コンピングの前に[ステップ 2](#ステップ-2-—-アシスタントに選ばせる)の修復アシスタントに通してください。
:::

## ステップ 5 — 検証: もう一度 `--detect` を走らせる

検出器はそのまま受け入れ試験にもなります。結果に対して再度走らせ、比較してください。

```bash
sonare repair take-clean.wav --detect --json
```

| フィールド | 修復前 | 修復後 |
|---|---|---|
| `clip_sample_fraction` | 0.1139 | 0.000227 |
| `click_count` | 1 | 0 |
| `crackle_per_second` | 0.759 | 0 |
| `hum_fundamental_prominence` | 18.62 | 7.94 |
| `hum_harmonics` | 2 | 1 |
| `noise_floor_dbfs` | −120.0 | −101.5 |

クリップ・クリック・クラックルはいずれもほぼゼロまで下がります。ハムの突出度は半分以下に下がりますがゼロにはならず、`noise_floor_dbfs` はむしろ上がります。declip の LPC 再構築と 2 つのインパルス系修復ステージが、手を入れたサンプルにごくわずかな広帯域の痕跡を残すためです。どちらも実行の不具合ではなく、正直な修復の姿です。ハムの数値をさらに追い込むことがたいてい割に合わない理由は、次の節で扱います。

::: info 検出器そのものが答え
「うまくいったか」を確かめる別コマンドはありません。何を直すか決めたのと同じ `--detect` が、直せたかどうかを、同じ数値・同じ単位で証明します。
:::

## ステップ 6 — すでに欲しいものが分かっているとき

アシスタントに判断させたくない場合の逃げ道が 2 つあります。

**名前付きプリセット** は計測を飛ばし、修復ステージをマスタリングプリセット自身の設定からそのまま持ってきます。`sonare mastering-presets --json` が 30 種すべての名前を列挙し、その中には壊れた・音楽的でない素材向けに調整されたものもいくつかあります —— `voiceMemo`、`fieldRecording`、`broadcast`、`podcast` です。`--preset` と `--explain` も併用できません。理由は `--detect` のときと同じで、プリセットのステージは計測で選ばれるのではなく直接名指しされるため、`--explain` が報告することが何もないからです。

```bash
sonare repair take-raw.wav --preset voiceMemo -o take-voicememo.wav --json
```

```json
{"mode": "preset", "preset": "voiceMemo", "stages": ["repair.declip", "repair.denoise", "repair.dereverb"]}
```

このテイクに `voiceMemo` を当てると declip・denoise・dereverb が走りますが、dehum は一度も走りません。ファイルの測定値に関係なく、そのプリセットがそもそも持っていないステージだからです。結果を再度検出すればそれが確認できます。`hum_fundamental_prominence` は 20.5 と、元の 18.6 からほとんど変わっていません。プリセットが正しい選択になるのは、素材の素性が最初から分かっていて（電話のボイスメモ、フィールド録音）毎回同じ固定処理を当てたい場合です。ファイル自身の証拠に判断させたいなら向いておらず、それは計測して選ばせる経路に `--explain` を付ける方法の役目です。

**フィールド単位の上書き** は、どちらの経路を取っていても `--params repair.<stage>.<field>=value,...` で 1 つのパラメータだけを変えます。アシスタント自身の dehum ステージをさらに強く押してみると、ステップ 5 のトレードオフがそのまま見えます。

```bash
sonare repair take-raw.wav -o take-clean-harm.wav --params repair.dehum.harmonics=6 --json
```

ノッチが追う倍音の数をアシスタント自身の 2 から 6 に上げても、残留量はほとんど動きません。`hum_fundamental_prominence` はデフォルト実行の 7.94 に対して 7.88 と、実行ごとの測定誤差に埋もれる程度の差です。動くのは `output_gain_db` のほうで、デフォルトの −1.87 dB に対して −3.4 dB まで下がります。ほぼ同じ結果を得るために、波形の作り直しがほぼ倍になったということです。`dehum` を「ゼロまで追い込みたい」という衝動が取る形はいつもこれで、残留量は目減りしていく一方、コストは実際に、そして測定可能なかたちで積み上がります。[整音・入力系コントロール](../glossary/mastering/repair.md) のグロッサリーページも denoise について同じことを言っています。ノイズを少し残すほうが、ドラムがにじんだり水っぽいアーティファクトが出たりするより良い、と。ノッチフィルタが本物の音楽的成分と共有する基音を削ってしまう場面にも、同じ抑制が当てはまります。

## ステップ 7 — 単機能の逃げ道: `declip`

`repair` 自身の declip ステージは `--params` 以上には単独で調整できません。特定のテイクに対して控えめすぎる、あるいは強すぎる場合は、専用の制御を持つ単機能コマンド `declip` を使います。

```bash
sonare declip take-raw.wav -o take-declip-only.wav --clip-threshold 0.95 --json
```

```json
{"clip_threshold": 0.95, "lpc_order": 36, "iterations": 2, "lpc_blend": 0.65, "output": "take-declip-only.wav"}
```

`--clip-threshold` は、フルスケールにどこまで近づいたサンプルをクリップとみなすかです（修復アシスタントはもう少し控えめな既定値を使います）。`--lpc-order`・`--iterations`・`--lpc-blend` は、線形予測による再構築で失われた波形をどれだけ積極的に組み立て直すか、それとも生の（クリップした）信号をどれだけ混ぜ戻すかを決めます。ここに手を伸ばすのは `--detect` で declip こそが手で調整する価値のあるステージだと分かってからにしてください。それ以外は何も直しません。

## ステップ 8 — ステレオのテイク

ここまではすべてモノラルのテイクで実行しました。`repair --detect`（そして修復チェーン自体）はステレオファイルをモノラルにダウンミックスし、標準エラー出力にその旨を出します。

```text
warning: 2-channel input is downmixed to mono by this CLI command; use the stereo library API for channel-preserving processing
```

::: warning ステレオの損傷レポートも有効な損傷レポートです
このダウンミックスの警告は、数値が合算後の信号を表しているという意味であって、その数値をもとに動いてはいけないという意味ではありません。ダウンミックス上で検出されたクリップ・クリック・ハム・クラックルは、ステレオファイル自体にも実在する欠陥です。変わるのは *修復* のほうです。ステレオの納品物をチャンネルごとに保ったまま直すには、このモノラル専用の CLI パスではなく [Python API](../python-api.md) のステレオ用エントリポイントが必要です。
:::

## スクリプトとして回す

このページのコマンドはすべて `--json` を受け付け、失敗はすべて[規定の終了コード](../cli.md#終了コード)で返ります。`--detect` と `--explain` の不正な組み合わせや `-o` の欠落、認識できないパラメータキーは 3、存在しないファイルは 4 です。したがってバッチスクリプト冒頭の `set -euo pipefail` だけで、実際に壊れたテイクのところで実行を止められます。それを黙ってスキップしたまま「バッチはきれいに終わった」と報告することはありません。

## 次に読むもの

- テイクがきれいになり、そこからミックスを組み立てたい —— [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md)。
- 修復ステージとそのフィールドを一箇所でまとめて見たい —— [マスタリングプロセッサ](../mastering-processors.md)。
- モノラルのテイクではなくステレオの納品物を修復したい —— [Python API](../python-api.md) のステレオ用エントリポイント。
