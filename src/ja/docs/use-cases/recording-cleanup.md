---
title: 録音素材をまとめて整音する
description: クリップし、ハムが乗り、クリックが混じり、頭と尻に無音が余分についた荒いテイクの束を、まず何が壊れているかを測り、その根拠が求める処理だけを当て、トリムするところまで。何を見つけ何をしたかの記録付きです。
---

# 録音素材をまとめて整音する

荒いテイクの束がドライブに転がっている。ゲインが高すぎてクリップしたもの、アースが悪くて 50 Hz や 60 Hz の商用電源ハムが乗ったもの、そしてほとんどのテイクは頭と尻に 1、2 秒の無音が余分に付いている。どのテイクにどの問題があるのか、ファイルごとには分かっていない。このページはまずそれを測り、その測定結果が求める処理だけを当て、両方を記録に残します。

この作業は「全部に declip を掛ける」ことではありません。何も壊れていないのにリペアの段を実行するのは、ただ品質を削るだけです。declip は一度もクリップしていないサンプルまで再合成しますし、dehum は商用電源周波数に乗っている本物の音楽的な成分までノッチで削ります。リペアアシスタントの価値は、根拠のない段を断る点にあり、`--explain` はそれが実際にそうなったかを確かめる手段です。

このページは Python CLI（`pip install libsonare`、コマンド名 `sonare`）を使います。`declip`（ステップ 7）はネイティブの `sonare-cli` にはなく、ほかのコマンドは両方にあります。[どの CLI を使っているか](../cli.md#どの-cli-を使っているか)を参照してください。

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）。Node のタブには `npm install @libraz/libsonare`（Node.js 22.12 以降）が必要です。
- **`raw/` に置いたモノラルのテイク:** WAV ファイルで、サンプルレートは一般的なものなら何でもかまいません。CLI のリペアはモノラルで動きます。ステレオのテイクはモノラルにまとめられ、モノラルのファイルとして書き出されます（ステレオの扱いは[ステップ 8](#ステップ-8-—-ステレオのテイク)）。
- **ステップ 4 用:** 同じパートを 2〜3 回録ったテイク `take1.wav`〜`take3.wav`。サンプルレートはそろえてください。
- **テスト素材:** このページのテイクは合成音です。下のスクリプトがそれを書き出し、ここに載せた数値はすべてその出力に各手順を実行して得たものです。ステップ 1〜7 の `take-raw.wav` は `raw/take-01.wav` です（その名前でコピーしてください）。
:::

::: details 傷のあるテスト用テイクを書き出すスクリプト
`make_takes.py` として保存し、`python make_takes.py` を実行します。必要な NumPy は `pip install libsonare` で一緒に入ります。`raw/take-01.wav`（クリップあり、50 Hz のハムとクリック入り）、`raw/take-02.wav`（ハムとクリックのみでクリップなし）、ステップ 4 用の `take1.wav`〜`take3.wav` を、すべて 48 kHz のモノラルで書き出します。

```python
"""Write damaged test takes: raw/take-01.wav, raw/take-02.wav, take1-3.wav."""
import os
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def save(path, x):
    pcm = (np.clip(x, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def phrase(seconds):
    t = np.arange(int(seconds * SR)) / SR
    chord = sum(np.sin(2 * np.pi * f * t) for f in (220.0, 277.2, 329.6)) / 3
    return 0.4 * chord * np.minimum(1.0, t / 0.02) * np.exp(-t / 3.0)


def damage(x, clip_gain=None):
    t = np.arange(len(x)) / SR
    x = x + 0.03 * np.sin(2 * np.pi * 50 * t) + 0.01 * np.sin(2 * np.pi * 150 * t)  # mains hum
    for i in rng.integers(SR, len(x) - SR, 6):  # sparse clicks
        x[i : i + 3] += 0.5 * np.array([1.0, -0.8, 0.4])
    if clip_gain is not None:
        x = np.clip(x * clip_gain, -1.0, 1.0)  # input gain set too hot
    pad = np.zeros(int(0.3 * SR))  # dead air at both ends
    return np.concatenate([pad, x, pad])


os.makedirs("raw", exist_ok=True)
save("raw/take-01.wav", damage(phrase(7.0), clip_gain=4.0))
save("raw/take-02.wav", damage(phrase(7.0)))

# Three takes of one part for Step 4: three phrases each, entering at slightly different times.
for take, shift in enumerate((0.0, -0.1, 0.08), start=1):
    x = np.zeros(int(8.5 * SR))
    for start in (0.6, 3.2, 6.0):
        s = int((start + shift) * SR)
        p = phrase(1.8)
        x[s : s + len(p)] += p
    save(f"take{take}.wav", x)
```

この 2 つのテイクにバッチを実行すると、下と同じ段が選ばれます。`take-01` は declip、declick、decrackle、dehum、`take-02` はそこから declip を除いたものです。
:::

ライブラリ API を使う手順と欠陥ごとの処理は、[音声リペア](../audio-repair.md)、[ノイズ・ハム除去](../repair-noise.md)、[クリック・クラックル・クリッピング修復](../repair-transients.md)、[デリバーブ](../repair-reverb.md)で説明しています。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- テイクに触れる前にまず何が壊れているかを測り、アシスタントが選んだ、あるいは選ばなかったリペアの各段の理由を読める。
- `repair`・`trim-silence`・`declip` をファイルごとのバッチ処理としてスクリプト化し、クリーンなテイクと、何を見つけ何をしたかの JSON 記録の両方を書き出せる。
- `repair` を動かす 3 つの方法（計測して選ばせる、名前付きプリセット、フィールド単位の上書き）を区別し、それぞれがどんな場面向けかを判断できる。5 つあるレストレーション用プリセットのうち、どれをまず試すべきかも含めて。
- 修復には必ず失うものがあることを踏まえ、ある数値をゼロまで追い込むことが割に合わない場面を見分けられる。

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

  # 2. Trim the dead air every take was padded with. This comes first: dehum's
  #    notch rings into the padding and a later trim would find nothing to cut.
  sonare trim-silence "$raw" -o "clean/${name}.trimmed.wav" --json \
    > "reports/${name}.trim.json"

  # 3. Let the assistant choose only the stages step 1's evidence calls for.
  sonare repair "clean/${name}.trimmed.wav" -o "clean/${name}.wav" --explain --json \
    > "reports/${name}.repair.json"

  # 4. Measure again. This is the verification step, not a separate audit.
  sonare repair "clean/${name}.wav" --detect --json > "reports/${name}.after.json"

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

2 本のテイク（一方はハードクリップと商用電源ハム、もう一方はハムとクリックだけ）に対して実行すると、こう出力されます。

```text
reports/take-01.json  ->  repair.declip, repair.declick, repair.decrackle, repair.dehum
reports/take-02.json  ->  repair.declick, repair.decrackle, repair.dehum
```

`take-02` にはクリップがなく、その段の一覧に `declip` はありません。この 1 行に、先に測ることの意義がすべて表れています。アシスタントは 2 本の異なるテイクを見て、実際に 2 通りの違うものを直しました。

<FlowDiagram
  title="バッチ整音のパイプライン"
  direction="LR"
  :nodes="[
    { id: 'raw', label: 'テイク一式 (WAV)', col: 0, row: 0, variant: 'muted' },
    { id: 'detect1', label: 'repair --detect', col: 1, row: 0, variant: 'accent' },
    { id: 'trim', label: 'trim-silence', col: 2, row: 0, variant: 'accent' },
    { id: 'choose', label: 'アシスタントが選択', col: 3, row: 0, variant: 'decision' },
    { id: 'repair', label: 'repair --explain', col: 4, row: 0, variant: 'accent' },
    { id: 'clean', label: 'クリーンなテイク', col: 5, row: 0, variant: 'success' },
    { id: 'detect2', label: 'repair --detect (検証)', col: 5, row: 1, variant: 'warning' },
    { id: 'record', label: 'ファイルごとの record.json', col: 7, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'raw', to: 'detect1' },
    { from: 'detect1', to: 'trim' },
    { from: 'trim', to: 'choose' },
    { from: 'raw', to: 'trim', label: '音声', style: 'dashed' },
    { from: 'choose', to: 'repair' },
    { from: 'repair', to: 'clean' },
    { from: 'clean', to: 'detect2', style: 'dashed' },
    { from: 'detect1', to: 'record', style: 'dashed' },
    { from: 'detect2', to: 'record', style: 'dashed' }
  ]"
  caption="検出器はテイクごとに 2 回実行されます。1 回目は何を直すか決めるため、2 回目は直せたことを確かめるためです。"
/>

## ステップ 1 — 触る前にまず測る

::: code-group

```bash [CLI]
sonare repair take-raw.wav --detect --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { decodeChannels, init, masteringRepairAnalyze } from '@libraz/libsonare';

await init();
// チャンネルごとに Float32Array を 1 つ。モノラルなら 1 つ、ステレオなら 2 つ
const { sampleRate, channels } = decodeChannels(new Uint8Array(readFileSync('take-raw.wav')));
const { defects, recommended, explanation } = masteringRepairAnalyze({ channels, sampleRate });
console.log(defects.clipSampleFraction, defects.humFundamentalProminence, recommended.map((s) => s.stage), explanation);
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# チャンネルごとに配列を 1 つ。モノラルなら 1 つ、ステレオなら 2 つ
path = "take-raw.wav"
channels = []
for i in range(Audio.file_channel_count(path)):
    with Audio.from_file_channel(path, i) as audio:
        channels.append(audio.data)
        sample_rate = audio.sample_rate

analysis = sonare.mastering_repair_analyze(channels, sample_rate)
print(analysis["defects"]["clipSampleFraction"], analysis["defects"]["humFundamentalProminence"])
print([s["stage"] for s in analysis["recommended"]], analysis["explanation"])
```

:::

`--detect` は計測して報告するだけです。ファイルは何も書き出しません（Python CLI は `-o` との併用を拒否します）。だからこそフォルダ内のテイク全部に対して、何も決める前に気軽に実行できます。オプション全体は [CLI リファレンスの repair](../cli.md#repair) にあります。

ライブラリの呼び出しは、ステップ 1 の計測とステップ 2 の選択を担います。`recommended` と `explanation` はアシスタントが実行する段とその理由で、`masteringRepairApply` がそれを実行します。全チャンネルを計測するため、ステップ 8 のステレオに関する警告は当てはまりません。CLI は同じ計測値を snake_case の名前（`clip_sample_fraction`）で返します。

```json
{
  "mode": "detect",
  "defects": {
    "click_count": 6,
    "click_rejected": 307,
    "crackle_per_second": 2.368,
    "clip_sample_fraction": 0.01259,
    "clip_run_count": 164,
    "clip_longest_run_samples": 51,
    "clip_flat_level": 0.99997,
    "noise_floor_dbfs": -31.43,
    "hum_peak_found": true,
    "hum_fundamental_hz": 50.0,
    "hum_fundamental_prominence": 23.98,
    "hum_harmonics": 2,
    "late_decay_ratio_db": -5.85
  }
}
```

このテイクでは 4 つの数値だけでほぼ全体像が分かります。`clip_sample_fraction` はサンプルの 1.26% がクリップしていることを示し、1.0 に近い `clip_flat_level` はそれが単に大きいのではなく平らに張り付いていることを示します。ちょうど 50 Hz に商用電源の倍音が突出度 24.0 で乗っており、`crackle_per_second` がゼロでない（2.37）ことから短いインパルス状のクラックルがあるとわかります。`hum_fundamental_prominence` は dB ではなく単純な比です。ハムの候補のうち勝ち残ったもののエネルギーを、探索で試したすべての候補のエネルギーの中央値で割った値で、`1.0` はどのピークも目立たなかったことを表します。24.0 は、ある 1 つの周波数に典型的な候補の約 24 倍のエネルギーが乗っているということです。`click_count` は 6 で、スクリプトが書き込んだ 6 つのクリックそのものです。`click_rejected`（307）は検出器が「クリックらしく見えて実はそうではない」と判断したイベントの数です。検出器が何かを見逃したと結論する前に、この数字を知っておく価値があります。

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
  "output_gain_db": -2.70
}
```

各行は、検出器が使ったのと同じ語彙で、その段を選んだ根拠そのものを述べています。`denoise` が入っていないのは、このテイクの `noise_floor_dbfs` がプログラムよりはるかに低いからです。アシスタントが denoise を加えるのは、ノイズフロアがテイクの統合ラウドネスから 12 dB 以内に迫ったときだけです。`dereverb` はアシスタントが選ぶことはありません。残響のあるテイクと残響のない持続音を確実に見分けられる計測がないためで、dereverb はプリセットか `--params` で指定したときにだけ動きます。

アシスタントの判定は傷の有無を見るもので、程度を見るものではありません。

| 段 | アシスタントが実行する条件 |
|---|---|
| declip | サンプルが一定のレベルに張り付いた区間があり、そのレベルで修復してもクリップしていない大きな音には触れないとき |
| declick | 検出器がクリックを 1 つ以上見つけたとき |
| decrackle | 検出器がクラックルを少しでも見つけたとき |
| dehum | ハムのピークが 50 Hz か 60 Hz から 0.25 Hz 以内にあり、突出度が 10 を超えるとき |
| denoise | ノイズフロアがテイクの統合ラウドネスから 12 dB 以内にあるとき |

クリックが 1 つしかないテイクにも declick がかかるのはこのためです。[納品前チェックを CI で回す](./delivery-check.md) は仕上がったマスターについて「不合格にするほど傷があるか」という別の問いを立てるので、そちらでは頻度で判定します。きれいなプログラム素材でも検出器は小さな値を出すため、クリックは毎秒 0.2 個、クラックルは毎秒 1.0 回まで許容しています。

`output_gain_db` はリペアの段ではありません。リペアでフルスケールを超えたサンプルが出たとき、CLI は最大のサンプルがちょうどフルスケールに来るよう、修復後のファイルをスケーリングします（declip はクリッパーが削ったピークを再構築するので、たいていそうなります）。この数値はファイル全体にかけたその 1 つのゲインで、ピークがどれだけはみ出したかを示すものです。波形がどれだけ変わったかを示すものではありません。

::: warning テイクごとに別々にスケーリングされる
ゲインはファイルごとに合わせるので、同じセッションの 2 つのテイクでも `repair` を通すと音量がそろわず、どちらもピークが 0 dBFS になります。テイク同士を比べたりコンピングしたりするのはリペアの前にするか、リペア後のテイクを共通のレベルに戻してからにしてください。ピークがフルスケールに張り付いていると[インターサンプルピーク](../glossary/true-peak.md)の余地もないので、ミックスやマスターに入れる前にレベルを下げてください。
:::

::: tip `--explain` と `--detect` は併用できません
`--detect` ではリペアの段が 1 つも実行されないため、説明すべき選択が存在しません。両方渡すと無効なパラメータとして拒否されます（終了コード 3）。理由を見たいなら `--detect` を外し、数値だけでよいなら `--explain` を外してください。
:::

このテイクでは `denoise` が実行されなかったので、ここまでの出力には denoise の仕事が一度も出てきません。下のデモで聴けます。きれいな持続コードに広帯域のヒスノイズを乗せ、リペアの段がそれを取り除きます。Compare を切り替えると両者を聴き比べられます。ゲインには手を加えていないので、動くのはヒスノイズだけです。アルゴリズムを切り替えると、持ち上がった高域のフロアをどれだけ下げられるかの違いが分かります。

<SonareDemo id="repair-denoise" />

## ステップ 3 — 無音の余白をトリムする

```bash
sonare trim-silence take-raw.wav -o take-trimmed.wav --json
```

```json
{"length": 339200, "sample_rate": 48000, "duration": 7.0667, "threshold_db": -60.0, "n_fft": 2048, "hop_length": 512, "output": "take-trimmed.wav"}
```

テイクは頭と尻に 0.3 秒ずつの余白を含めて 7.6 秒でしたが、トリム後は 7.0667 秒です。つまり 0.533 秒の無音が取れました（切り位置は 512 サンプルのホップ単位に載ります）。`--threshold-db`（既定値 −60 dB）は、あるフレームを無音と数えるしきい値です。ファイル自身のピークを基準にした値で同じ切り方をしたい場合は `--top-db` も受け付けます。トリムは修復とは無関係で、テイクにリペアが必要だったかどうかに関係なく実行されます。トリムは生のテイクに対して、リペアの前に実行してください。リペア後のテイクは余白が無音ではなくなっています。dehum のノッチが余白に響き込むためです（dehum 単独で余白のピークは 0.07 と 0.10 になり、declip・declick・decrackle ではゼロのままです）。そのため `take-clean.wav` に同じコマンドを掛けても 7.6 秒がそのまま残ります。ライブラリにも独自のトリマー（`trimSilence`、`masteringRepairTrimSilence`）がありますが、オプションが別で、出力の長さがこのコマンドと一致するとは限りません。このステップは CLI のステップです。

## ステップ 4 — 複数テイクを共有する無音で切る

問題が 1 本の欠陥テイクではなく、そこそこ良い出来のテイクが何本もあることもあります。同じフレーズに 3 回挑戦し、それぞれ入りと抜けのタイミングが少しずつ違っていて、それらをスライスごとに聴き比べたい、という場合です。ステップ 3 の `trim-silence` を各テイクに個別に掛けても役には立ちません。テイクごとに別々の切り出し位置が決まってしまうため、境界がファイルごとに違う場所へ来てしまい、「同じ」スライスのつもりが実は 3 種類の違うスライスになります。

[`split-silence`](../cli-commands.md#split-silence) はまさにこの用途のために、一度に複数のファイルを受け取れます。1 本目のテイクは位置引数で渡し、同じ部分の残りのテイクは繰り返し指定できる `--input` で加えます。

```bash
sonare split-silence take1.wav --json
```

```json
[{"start_sample": 28160, "end_sample": 116224}, {"start_sample": 153088, "end_sample": 241152}, {"start_sample": 287232, "end_sample": 375808}]
```

テイク 1 本だけでは、フレーズごとに 1 つずつ、3 つの非無音区間が報告されます。`trim-silence` が見つけるのと同じ形を、1 つのトリム後の長さではなくサンプル範囲として表したものです。同じ部分の残り 2 本のテイクを加えます。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --json
```

```json
[{"start_sample": 23040, "end_sample": 120320}, {"start_sample": 147968, "end_sample": 245248}, {"start_sample": 282624, "end_sample": 379392}]
```

最初の区間は 28160–116224 から 23040–120320 へと広がります。この広がり方こそがこの機能の要点です。報告される区間は各テイク自身の非無音区間の **和集合** で、接するところは統合されます。つまり切り出しが起きるのは全テイクが同時に無音になっている場所だけで、どのテイクのフレーズの途中にもかかりません。各テイクを自分自身の区間で切ってしまうと、あるテイクの早い入りが別のテイクのスライスではアタックを削り取ることになります。3 本まとめて和集合で切れば、どのテイクも全テイクが共有する無音の分だけを失い、それ以上は失いません。

`split-silence` は `-o` を一切受け付けません。区間を報告するだけのコマンドで、`--output` を渡すと使用方法エラー（終了コード 2）で終了します。共有区間を実際の音声にするのが `--write-takes PREFIX` で、テイクごと・区間ごとに 1 ファイルずつ、`PREFIX{take:02d}_{interval:03d}.wav`（どちらの番号も 1 始まり）という名前で書き出します。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --write-takes comp --json
```

3 本のテイクと 3 つの共有区間から、9 個のファイル `comp01_001.wav` から `comp03_003.wav` までが書き出されます。1 つの区間の中では、テイクをまたいでもファイルの長さが揃います。区間 1 ならどのテイクでも 97280 サンプルです。テイク自身はサンプル単位で揃っているわけではないのに、です。和集合の境界より前に終わっているテイクは、短く切られるのではなくその分だけ無音でパディングされます。だからこそ `comp01_001.wav`・`comp02_001.wav`・`comp03_001.wav` は横並びで聴き比べられます。開始位置も長さも同じ、同じフレーズの 3 つの異なる演奏です。

ここで **やらないこと** も明確にしておきます。最良のテイクを選ぶことはなく、クロスフェードもせず、フレーズ途中のタイミングのずれも直しません。途中で前のめりになったり遅れたりしているテイクは、切り出した後も前のめりのまま、遅れたままです。手元に残るのは判断材料としての揃ったスライスであって、完成したコンピングではありません。

このコマンドが利用者に任せている選択を、下のデモで試せます。3 つのテイクから区間ごとに 1 つ選び、短いクロスフェードでつなぎます。

<SonareDemo id="comping" />


全テイクのサンプルレートが一致している必要があり、これは何よりも先にチェックされます。

```bash
sonare split-silence take1.wav --input take2.wav --input t3_44.wav --json
# Error: take sample rate differs: t3_44.wav is 44100 Hz, the first take is 48000 Hz
```

この不一致は無効なパラメータとして拒否され（終了コード 3）、このページの他の場所で不明なパラメータキーを渡したときと同じ分類になります。

::: warning `--top-db` は各テイク自身のピークが基準で、絶対値ではありません
同じ `--top-db` でも、ノイズの多いテイクほど見つかる無音は少なくなります。しきい値は固定の dBFS ではなく、そのテイク自身のピークを基準にしているからです。`take1.wav` に標準偏差 0.0001 のガウスノイズ（シード 1）を加えると、`repair --detect` はノイズフロアを −81.5 dBFS と測り、3 つのフレーズの間にはっきりした隙間が残ります。標準偏差を 0.0003 にするとノイズフロアは −71.2 dBFS となり、同じテイクの結果はファイル全体（`0` から `408000`）を覆う 1 つの区間に潰れてしまいます。しきい値が、無音と呼べるほど静かな場所をもう見つけられなくなったということです。「このくらいのヘッドルームがあれば安全」という一律の dB はありません。まず `noise_floor_dbfs` を確認し、ノイズフロアが高いテイクは `--top-db` を下げて帳尻を合わせるのではなく、コンピングの前に[ステップ 2](#ステップ-2-—-アシスタントに選ばせる)のリペアアシスタントに通してください。
:::

## ステップ 5 — 検証: もう一度 `--detect` を実行する

検出器はそのまま受け入れ試験にもなります。結果に対して再度実行し、比較してください。

```bash
sonare repair take-clean.wav --detect --json
```

| フィールド | 処理前 | 処理後 |
|---|---|---|
| `clip_sample_fraction` | 0.01259 | 0.0000274 |
| `click_count` | 6 | 0 |
| `crackle_per_second` | 2.368 | 0 |
| `hum_fundamental_prominence` | 23.98 | 2.15 |
| `hum_harmonics` | 2 | 0 |
| `noise_floor_dbfs` | −31.43 | −44.07 |

クリップは 1 つの連続区間の 10 サンプルまで減り、クリックとクラックルはゼロになります。ハムの突出度は 2.15 まで下がり、検出器がなお報告するピークは商用電源の周波数ではなく 61.5 Hz にあります。つまりこれはハムではなく、平坦な候補群の中でいちばん大きいものにすぎません。`noise_floor_dbfs` も下がります。低域の測定値を占めていたのが 50 Hz のハムとその倍音だったためです。どちらの数値もゼロにはならず、これがありのままの修復結果です。

残った突出度 2.15 はアシスタント自身のしきい値 10 を下回るので、もう一度 `repair` を通しても dehum は再実行されません。[納品前チェックを CI で回す](./delivery-check.md) が仕上がったマスターを不合格にする 6.0 も大きく下回ります。実際に再生されるレベルで低域を聴いてください。ある段が欲しかった成分まで削っているなら、次の節のフィールド上書きで、その削りと残留量をトレードオフにできます。

::: info 検出器そのものが答え
「うまくいったか」を確かめる別コマンドはありません。何を直すか決めたのと同じ `--detect` が、直せたかどうかを、同じ数値・同じ単位で証明します。
:::

## ステップ 6 — すでに欲しいものが分かっているとき

アシスタントに判断させたくない場合の逃げ道が 2 つあります。

**名前付きプリセット** は計測を飛ばし、リペアの段をマスタリングプリセット自身の設定からそのまま持ってきます。`sonare mastering-presets --json` が 30 種すべての名前を列挙しますが、そのうち 5 つはレストレーション用のプリセットで、リペアの段だけを持ちます。どれを選ぶかはファイルの測定値ではなく、手元の素材について最初から分かっていることで決める振り分けです。

| 手元にあるもの | まず試すプリセット | 実行される段（チェーン順） |
|---|---|---|
| LP のトランスファー（溝の摩耗によるクリックとポップ、表面のクラックル、その下に敷かれたノイズフロア） | `vinyl` | declick・decrackle・denoise |
| 78 回転 SP 盤（シェラック盤）のトランスファー（LP より幅の広いポップと、より密で高い表面ノイズ） | `shellac78` | `vinyl` と同じ 3 つの段を、それぞれ強めに。長いクリックまで対象にし、クラックルのしきい値を下げ、ノイズ低減を深くしたもの |
| カセットやオープンリールのトランスファー（一定の広帯域ヒスだけ） | `tapeHiss` | denoise |
| 屋外やロケでの収録（ヒス、50 Hz や 60 Hz からずれた電源ハム、周囲の空間の響き） | `fieldRecording` | dehum（適応追従）・denoise・dereverb |
| スマートフォンやノート PC のボイスメモ（自前の AGC に当たったクリップ、高いマイクのノイズフロア、話者がいた部屋の響き） | `voiceMemo` | declip・denoise・dereverb |

5 つのどれにも当てはまらない場合、たとえばハムとクリックはあるがヒスはないテイクでは、いちばん近いものを選んではいけません。`--preset` を外して上の計測して選ばせる経路に根拠から決めさせ、特定の段だけ足りなければ、次のフィールド単位の上書きで補ってください。各プリセットが設定するパラメータとその既定値は[マスタリングプロセッサ](../mastering-processors.md#プリセット)に、プリセットを選び分ける考え方は[マスタリングプリセットの選び方](../glossary/mastering/preset-selection.md)にまとまっています。

`--preset` と `--explain` も併用できません。理由は `--detect` のときと同じで、プリセットの段は計測で選ばれるのではなく直接名指しされるため、`--explain` が報告することが何もないからです。

```bash
sonare repair take-raw.wav --preset voiceMemo -o take-voicememo.wav --json
```

```json
{"mode": "preset", "preset": "voiceMemo", "stages": ["repair.declip", "repair.denoise", "repair.dereverb"]}
```

このテイクに `voiceMemo` を当てると declip・denoise・dereverb が実行されますが、dehum は一度も実行されません。ファイルの測定値に関係なく、そのプリセットがそもそも持っていない段だからです。結果を再度検出すればそれが確認できます。`hum_fundamental_prominence` は 24.45 と、元の 23.98 からほとんど変わっていません。プリセットが正しい選択になるのは、素材の素性が最初から分かっていて（電話のボイスメモ、フィールド録音）毎回同じ固定処理を当てたい場合です。ファイル自身の証拠に判断させたいなら向いておらず、それは計測して選ばせる経路に `--explain` を付ける方法の役目です。

レコード系のレストレーションが何を取り除き、何を別の段に残すかは、下のデモで聴けます。クリップはレストレーション用プリセットが想定する傷みを乗せたピアノのターンアラウンドで、電源ハム、表面ノイズとヒス、まばらなクリックとクラックルが入っています。ここで当てているのは古典的なデリバーブ 1 段だけなので、落ちるのはノイズの土台と滲んだ余韻です。クリックとハムはそのまま残ります。それらは declick と dehum の担当だからです。

<SonareDemo id="mastering-restoration" />

**フィールド単位の上書き** は、どちらの経路を取っていても `--params repair.<stage>.<field>=value,...` で 1 つのパラメータだけを変えます。アシスタント自身の dehum の段をさらに強めてみると、ステップ 5 のトレードオフがそのまま見えます。

```bash
sonare repair take-raw.wav -o take-clean-harm.wav --params repair.dehum.harmonics=6 --json
```

ノッチが追う倍音の数をアシスタント自身の 2 から 6 に上げても、残留量はほとんど動きません。`hum_fundamental_prominence` は既定値での実行の 2.15 に対して 2.14 です。検出器は決定的に動くので 0.01 は実在する差ですが、耳でわかる差ではありません。`output_gain_db` も既定値の −2.70 dB に対して −3.23 dB に変わりますが、これはフルスケールに合わせる前の修復後ファイルのピークが高くなったことを示すだけです。ノッチはその周波数付近の位相を動かすので、波形のピークは上にも下にも動きえます。この数値は、どれだけ手を入れたかの尺度ではありません。ノッチを増やすコストは、それが取り除くものにあります。ノッチは 100、150、200 Hz といった周波数にある本物の音楽的成分も削るので、ベースやキックではその量がかなりになります。`dehum` を「ゼロまで追い込みたい」という衝動は、いつもこういう結果になります。残留量はほとんど動かず、耳でわかるほど中身が削られます。[整音・入力系コントロール](../glossary/mastering/repair.md) のグロッサリーページも denoise について同じことを言っています。ノイズを少し残すほうが、ドラムがにじんだり水っぽいアーティファクトが出たりするより良い、と。ノッチフィルタが本物の音楽的成分と共有する基音を削ってしまう場面にも、同じ抑制が当てはまります。

下のデモは、このトレードオフを 50 Hz のハムとその 3 つの倍音を載せたクリーンな和音で確かめます。ハムの除去方法を切り替えて、それぞれの HUM スコアを読んでください。

<SonareDemo id="repair-dehum" />


## ステップ 7 — 単機能の逃げ道: `declip`

`repair` 自身の declip の段は `--params` 以上には単独で調整できません。特定のテイクに対して控えめすぎる、あるいは強すぎる場合は、専用の制御を持つ単機能コマンド `declip` を使います。

```bash
sonare declip take-raw.wav -o take-declip-only.wav --clip-threshold 0.95 --json
```

```json
{"sample_rate": 48000, "samples": 364800, "clip_threshold": 0.95, "lpc_order": 36, "iterations": 2, "lpc_blend": 0.65, "output": "take-declip-only.wav"}
```

`--clip-threshold` は、フルスケールにどこまで近づいたサンプルをクリップとみなすかです（修復アシスタントはもう少し控えめな既定値を使います）。`--lpc-order`・`--iterations`・`--lpc-blend` は、線形予測による再構築で失われた波形をどれだけ積極的に組み立て直すか、それとも生の（クリップした）信号をどれだけ混ぜ戻すかを決めます。ここに手を伸ばすのは `--detect` で declip こそが手で調整する価値のある段だと分かってからにしてください。それ以外は何も直しません。

## ステップ 8 — ステレオのテイク

ここまではすべてモノラルのテイクで実行しました。`repair --detect`（そして修復チェーン自体）はステレオファイルをモノラルにダウンミックスし、標準エラー出力にその旨を出します。

```text
warning: 2-channel input is downmixed to mono by this CLI command; use the stereo library API for channel-preserving processing
```

::: warning ステレオの損傷レポートはモノラル合算を示します
これはモノラル合算だけを表します。合算で見える欠陥は有用な手がかりですが、合算がきれいでも各チャンネルがきれいとは限りません。左右非対称のクリップ、逆極性のハムやクリック、片チャンネルだけの欠陥は隠れることがあります。チャンネルを保ったまま調べて修復するには、この CLI パスではなく [Python API](../python-api.md) のステレオ用エントリポイントを使ってください。
:::

## スクリプトとして回す

このページのコマンドはすべて `--json` を受け付け、失敗はすべて[規定の終了コード](../cli.md#終了コード)で返ります。`--detect` と `--explain` の無効な組み合わせや `-o` の欠落、認識できないパラメータキーは 3、存在しないファイルは 4 です。したがってバッチスクリプト冒頭の `set -euo pipefail` だけで、実際に壊れたテイクのところで実行を止められます。それを黙ってスキップしたまま「バッチはきれいに終わった」と報告することはありません。

## 次に読むもの

- テイクがきれいになり、そこからミックスを組み立てたい場合は [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md)。
- リペアの段とそのフィールドを一箇所でまとめて見たい場合は [マスタリングプロセッサ](../mastering-processors.md)。
- モノラルのテイクではなくステレオの納品物を直したい場合は、[Python API](../python-api.md) のステレオ用エントリポイント。
