---
title: トーク番組を仕上げる
description: ホスト・ゲスト・音楽ベッドをダッキング済みで規定ラウドネスの 1 本にまとめる手順。commentaryDucking プリセットでミックスし、speech チェーンでマスタリングし、CLI だけで検証します。
---

# トーク番組を仕上げる

このページでは、ホストのトラック、ゲストのトラック、音楽ベッドを `commentaryDucking` でレンダリングし、`speech` でマスタリングして、レポートを確認します。

::: info どの CLI か
このページは Python CLI（`pip install libsonare`、コマンド名 `sonare`）を使います。`mix` はネイティブの `sonare-cli` にはありません。[どの CLI を使っているか](../cli.md#どの-cli-を使っているか)を参照してください。コードからは `Mixer.fromSceneJson` が同じシーンを読み込みます（[ミキシングエンジン](../mixing.md#シーンベースのミックス-mixer)）。
:::

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）。Node のタブには `npm install @libraz/libsonare`（Node.js 22.12 以降）が必要です。
- **長さとサンプルレートのそろった WAV ファイル 3 つ:** `host.wav`、`guest.wav`、`music-bed.wav`。モノラルでもステレオでもかまいません。ここでは 48 kHz を使っています。
- **テスト素材:** 下の数値は、下のスクリプトが書き出す 8 秒の合成音（声は母音のような音節、ベッドは持続する和音）で測ったものです。手元の素材でもコマンドは同じで、数値は手元の素材のものになります。
:::

::: details テスト用の声と音楽ベッドを書き出すスクリプト
`make_show.py` として保存し、`python make_show.py` を実行します（NumPy は `pip install libsonare` で一緒に入ります）。ホストは最初の 3 秒と最後の 3 秒に話し、その間はゲストが話します。

```python
"""Write host.wav, guest.wav and music-bed.wav: 8 s, 48 kHz mono test material."""
import wave

import numpy as np

SR = 48000
t = np.arange(8 * SR) / SR
rng = np.random.default_rng(5)


def save(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def voice(f0, talking):
    """Vowel-like syllables at about 4 per second, plus a little breath noise."""
    phase = 2 * np.pi * np.cumsum(f0 * (1 + 0.05 * np.sin(2 * np.pi * 0.7 * t))) / SR
    tone = sum(np.sin(k * phase) / k for k in range(1, 30))
    syllables = np.clip(np.sin(2 * np.pi * 4.0 * t), 0.0, None) ** 0.5
    x = (0.25 * tone + 0.02 * rng.standard_normal(len(t))) * syllables
    return x * talking


host_talks = ((t < 3.0) | (t >= 5.0)).astype(float)
save("host.wav", voice(120.0, host_talks))
save("guest.wav", voice(200.0, 1.0 - host_talks))
save("music-bed.wav", 0.3 * sum(np.sin(2 * np.pi * f * t) for f in (220.0, 277.2, 329.6)) / 3)
```
:::

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
                insert["params"].update({"rangeDb": 5})
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

::: code-group

```bash [CLI]
sonare mixing-preset --preset commentaryDucking --json
```

```typescript [Node]
import { init, mixingScenePresetJson } from '@libraz/libsonare';

await init();
const scene = JSON.parse(mixingScenePresetJson('commentaryDucking'));
```

```python [Python]
import json
import libsonare as sonare

scene = json.loads(sonare.mixing_scene_preset_json("commentaryDucking"))
```

:::

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
                insert["params"].update({"rangeDb": 30})
json.dump(scene, open("scene.json", "w"))
'
sonare mix --scene scene.json \
  --input host=host.wav --input guest=guest.wav --input music-bed=music-bed.wav \
  -o show-r30.wav --json
cmp show.wav show-r30.wav   # 出力なし: 同一
```

`rangeDb` をプリセットの既定値 18 から 30 へ上げても何も変わりません。`cmp` は 2 つのレンダリングをバイト単位で完全一致と報告します。この素材では、ホストの音量が求める削減量はどれだけ多くてもおよそ 5.7 dB までしかなく（上限 5.5 ではレンダリングが変わり、5.8 では変わりません）、6 dB 前後以上の上限であれば上限がないのと同じ挙動になるからです。その値より下げれば、編集が結果に現れます。`sonare dynamics` でファイル全体を測ると何かが変わったことはわかりますが、声そのものと、ホストが話していない長い区間も含めた 8 秒の平均なので、変化はごく小さく見えます。

| `rangeDb` | `rms_db`（ファイル全体） | `peak_db` | `18` との比較 |
|-----------|--------------------------|-----------|---------------|
| —（インサートを丸ごと削除） | -24.39 | -10.63 | 異なる |
| `1` | -24.42 | -10.63 | 異なる |
| `5` | -24.47 | -10.63 | 異なる |
| `18`（プリセットの既定値） | -24.47 | -10.63 | — |
| `30` | -24.47 | -10.63 | バイト単位で同一 |

`rangeDb: 5` は、このページ冒頭のスクリプトが最終的に採用している値です。当てずっぽうではなく、上の表で確かめたうえでプリセットの既定値よりわずかに浅いダッキングを選んでいます。

::: warning 一度も届いていない上限は、調整したことにならない
`rangeDb` を下げても手元のレンダリングが何も変わらないなら、原因はパラメータではなく、ホストのトラックがルーターの反応するスレッショルドより静かで、そもそもダッキングが要求されていないことです。深さを詰める作業に時間をかける前に、プリセットの既定値でダッキングがそもそも働いているかを確認してください。
:::

### ダッキングを決めるパラメータ

`rangeDb` はダッキングの上限を決めるだけです。どれだけ深く、どう動くかは、ルーターのコンプレッサー系の設定で決まります。プリセットが送っているのは `rangeDb` だけなので、ほかは既定値で動いています。

| パラメータ | 既定値 | 話し声の下の音楽での出発点 | 理由 |
|---|---|---|---|
| `thresholdDb` | -24 | ホストのふだんの話し声より 10 dB ほど下 | フレーズごとにホストがここを超えないと、ダッキングはまったく起きません |
| `ratio` | 4 | 4 | ホストがスレッショルドをどれだけ超えるかと合わせて深さが決まります。ホストが話している間、ベッドが 6〜12 dB 下がるのを目安にします |
| `attackMs` | 5 | 5〜20 | 最初の音節が埋もれない程度に速く、クリック音が出ない程度に遅く |
| `releaseMs` | 100 | 300〜500 | 100 ms だと単語の切れ目ごとにベッドが戻ってきて、ポンピングとして聞こえます。リリースを遅くすると 1 文の間ベッドが下がったままになります |
| `rangeDb` | 18（プリセットの値） | 12〜18 | 上限です。大声を出してもベッドが完全に埋もれないようにします |

これは出発点であって答えではありません。話し声の大きさもベッドも素材ごとに違うので、設定してレンダリングし、測ってください。

編集は `rangeDb` と同じく、インサートの `params` にマージします。

```python
insert["params"].update({"thresholdDb": -36, "ratio": 4, "attackMs": 10, "releaseMs": 400})
```

<SonareDemo id="ducking" />

ファイル全体の数値からは、ダッキングの深さはわかりません。ホストが話している間だけベッドを測り、同じ区間のダッキングしていないベッドと比べます。下のスクリプトはシーンを 3 回（そのまま、ダッキングを外して、ベッドだけで）レンダリングし、引き算でダッキング後のベッドだけを取り出して、`host.wav` が -40 dBFS より大きい 10 ms ブロックで両方のベッドを平均します。

::: details 話し声の下でダッキングを測るスクリプト
3 つの WAV ファイルと同じ場所に `duck_depth.py` として保存し、`python duck_depth.py scene.json` を実行します。

```python
"""Print how far the duck pulls the music bed down while the host is talking."""
import copy
import json
import subprocess
import sys

import numpy as np
from libsonare import Audio

BLOCK = 480  # 10 ms at 48 kHz


def render(scene, path):
    with open("duck-scene.json", "w") as f:
        json.dump(scene, f)
    subprocess.run(
        ["sonare", "mix", "--scene", "duck-scene.json", "--input", "host=host.wav",
         "--input", "guest=guest.wav", "--input", "music-bed=music-bed.wav", "-o", path],
        check=True, capture_output=True,
    )
    with Audio.from_file_channel(path, 0) as audio:
        return audio.data


def variant(scene, duck=True, voices=True):
    s = copy.deepcopy(scene)
    for strip in s["strips"]:
        if strip["id"] == "music-bed" and not duck:
            strip["inserts"] = []
        if strip["id"] in ("host", "guest") and not voices:
            strip["muted"] = True
    return s


def block_db(x):
    x = x[: len(x) // BLOCK * BLOCK].reshape(-1, BLOCK)
    return 10 * np.log10(np.mean(x**2, axis=1) + 1e-12)


def level_db(x):
    blocks = block_db(x)
    n = min(len(blocks), len(talking))
    return 10 * np.log10(np.mean(10 ** (blocks[:n][talking[:n]] / 10)))


scene = json.load(open(sys.argv[1]))
bed_alone = render(variant(scene, duck=False, voices=False), "duck-c.wav")
# The master bus is a plain sum, so (with duck) - (without duck) + (bed alone)
# leaves the ducked bed by itself.
ducked = (render(variant(scene), "duck-a.wav") - render(variant(scene, duck=False), "duck-b.wav")
          + bed_alone)
with Audio.from_file("host.wav") as audio:
    talking = block_db(audio.data) > -40.0  # 10 ms blocks where the host is speaking

before, after = level_db(bed_alone), level_db(ducked)
print(f"bed while the host talks: {before:.1f} dB unducked, {after:.1f} dB ducked, "
      f"duck depth {before - after:.1f} dB")
```

このページ冒頭のスクリプトで作ったテスト素材では、編集していないプリセットはホストが話している間ベッドを 3.2 dB 下げ、上の `update` 行（`rangeDb` はプリセットの 18 のまま）では 8.6 dB 下げます。測るのは実際にレンダリングするシーンにしてください。冒頭のスクリプトは `rangeDb: 5` も設定しており、この素材では 3.1 dB です。ホストが上限の許す量を超えて求めることがないためです。
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
{"strip_count": 3, "sample_rate": 48000, "block_size": 512, "rendered_samples": 384124, "output": "show.wav"}
```

`strip_count` が 3 なのは、このシーンに aux リターンが 1 本もないからです。すべての `--input` が実在するストリップを指しており、4 ステムの楽曲シーンにあったような無音のリターンを気にする必要がありません。各 `--input` の ID はシーン内のストリップ `id` と一致していなければならず、どの `--input` も名指ししなかったストリップには無音が入ります。これはベッドをある回だけ意図的に外すなら正しい挙動ですが、`music-bed` を `musicbed` と打ち間違えたときも同じことが黙って起こります。

## ステップ 4 — speech プリセットでマスタリングする

```bash
sonare mastering show.wav --preset speech -o show-master.wav --json
```

```json
{"mode": "preset", "input_lufs": -22.33, "output_lufs": -16.00, "applied_gain_db": 7.15, "output": "show-master.wav", "preset": "speech", "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "loudness.optimize"]}
```

同じ名前付きプリセットをアシスタントの出発点にすると、レポートへ説明も追加できます。

```bash
sonare mastering show.wav --assistant --preset speech --explain --target-platform podcast -o show-assistant.wav --report show-report.json --json
```

```json
{"mode": "assistant", "input_lufs": -22.33, "output_lufs": -16.00, "applied_gain_db": 7.15, "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "stereo.monoMaker", "loudness.optimize"], "explanation": ["base preset: speech", "target loudness and ceiling applied from AssistantConfig", "speech preset enables de-esser and mono compatibility"]}
```

単独の `speech` プリセット実行は、組み込みの -16 LUFS を目標にします。アシスタント実行は同じチェーンを出発点にし、`--target-platform podcast` から -16 LUFS を取得します。さらに speech プリセットの低域モノメーカー段と説明を加えます。アシスタントは音声からジャンルを推測しないため、`--preset speech` という選択がそのまま表示され、再現できます。

::: warning ノイズ除去は仕上がった番組ではなく、ミックス前の声にかける
どちらの実行も `repair.denoise` から始まり、ここでは音楽ベッドを含む番組全体にかかります。音楽にノイズ除去をかけると持続音がにじみ、水っぽいアーティファクトが残りますが、ベッドにはそもそも必要ありません。実際の録音では、ステップ 3 の前に声を 1 本ずつ整音し、マスターのデノイズを無効にしてください。

```bash
sonare repair host.wav -o host-clean.wav --explain --json
sonare repair guest.wav -o guest-clean.wav --explain --json
# Mix host-clean.wav and guest-clean.wav in Step 3, then:
sonare mastering show.wav --preset speech --params repair.denoise.enabled=0 \
  -o show-master.wav --json
```

`repair.denoise.enabled=0` を付けると段のリストは `eq.tilt` から始まります。同じ `--params` は `--assistant` の実行でも使えます。`repair` は声ごとに計測し、その根拠が求める段だけを実行します（[録音素材をまとめて整音する](./recording-cleanup.md) を参照）。修復後のピークがフルスケールを超えた声はフルスケールまでスケーリングし直されるので、ミックスの前に声のレベルをもう一度確認してください。このシーンではホストのストリップにもディエッサーがあるので、マスターの `dynamics.deesser` はホストにとって 2 回目のディエッサーです。ホストのサ行が舌足らずに聞こえ始めたら、どちらかを弱めてください。
:::

::: danger `--target-platform` には `--assistant` が必要です
```bash
sonare mastering show.wav --preset speech --target-platform podcast -o x.wav --json
# Error: --target-platform requires --assistant
# exit code 3
```
プラットフォームターゲットはアシスタントへの入力であって、全体設定ではありません。単独の `--preset` 実行と組み合わせることはできないため、このフラグは拒否されます。名前付き speech チェーンとプラットフォームターゲットを両方使うときは、`--assistant --preset speech --target-platform podcast` を指定します。
:::

`--target-platform` は 8 つの名前を受け付けますが、実際に何かを変えるのはそのうち 4 つです。

| `--target-platform` | ラウドネス目標 | True Peak のシーリング |
|---|---|---|
| `broadcast` | -23 LUFS | -1 dBTP |
| `podcast` | -16 LUFS | -1 dBTP |
| `club`、`cd` | -9 LUFS | -0.3 dBTP |
| `streaming`、`youtube`、`audiobook`、`cinema` | `--target-lufs` の値（既定 -14 LUFS） | `--ceiling-db` の値（既定 -1 dBTP） |

最後の行は独自の値を何も適用しません。特に `--target-platform audiobook` だけを指定すると -14 LUFS、-1 dBTP でマスタリングされ、オーディオブックの配信事業者がふつう受け付ける範囲（RMS で -23〜-18 dBFS、ピークは -3 dBFS 以下とするのが一般的）より大きく、ピークも高くなります。オーディオブックでは値を自分で渡し、配信先の仕様と照らし合わせてください。

```bash
sonare mastering chapter.wav --assistant --preset speech \
  --target-lufs -20 --ceiling-db -3 -o chapter-master.wav --report chapter-report.json --json
```

`--target-lufs` や `--ceiling-db` を明示すると、値を持つ 4 つのターゲットよりもそちらが優先されます。全オプションは `sonare mastering --help` で確認できます。各ターゲットが実際に何を要求しているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

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
  "before": { "integrated_lufs": -22.33, "true_peak_dbtp": -10.58 },
  "after":  { "integrated_lufs": -16.00, "true_peak_dbtp": -4.19 },
  "applied_gain_db": 7.15,
  "max_gain_reduction_db": -0.47,
  "loudness_target_limited": false
}
```

-16 LUFS は `--target-platform podcast` が求めている値で、`after.integrated_lufs` が計測結果です。`loudness_target_limited: false` は、設定した制約の範囲で目標に到達したことだけを意味し、リミッターが動いていないことやマスターが完成したことは示しません。`max_gain_reduction_db` で実際の最大ゲインリダクションを確認し、ラウドネスと True Peak の値を読んだうえで試聴してください。数値そのものの意味は [LUFS](../glossary/lufs.md) に、他のプラットフォームが -16 の代わりに何を求めているかは [配信ターゲット](../glossary/mastering/delivery-targets.md) にまとまっています。

[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) の 4 ステムの例と同じく、別途 `sonare lufs show-master.wav` を呼ぶとこの値とは食い違います。先にモノラルへダウンミックスしたうえで標準エラー出力に警告を出すからです。ステレオの納品物では、マスタリングレポートの数値を信じてください。

## 次に読むもの

- ベッドや声そのものにノイズ・クリック・ハムが乗っている場合は [録音素材をまとめて整音する](./recording-cleanup.md)。
- このエピソードのラウドネスをリリースのたびに自動で点検したい場合は [納品前チェックを CI で回す](./delivery-check.md)。
- ここで使ったシーンとインサートの JSON 形式はフィールド単位で [ミキシングシーン JSON](../mixing-scene-json.md) に、ダッキングとダイナミクス系プロセッサは [マスタリングプロセッサ](../mastering-processors.md) に、アシスタントの判断ルールは [マスタリングアシスタント](../mastering-assistant.md) にまとまっています。
- スクリプトではなくアプリにこのパイプラインを組み込みたい場合は [ミキシングエンジン](../mixing.md) が [CLI リファレンス](../cli.md) と各言語 API を通じて同じシーン・ストリップモデルを示しています。
