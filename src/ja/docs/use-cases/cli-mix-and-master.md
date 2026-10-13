---
title: CLI だけでミックスからマスタリングまで
description: ステムのフォルダから配信可能なマスターまでをシェルだけで完結させる手順。シーンを提案させ、手で直し、レンダリングし、点検し、マスタリングし、結果を検証します。
---

# CLI だけでミックスからマスタリングまで

ステムが 4 本あって、DAW は開いていない。このページはその状態から 1 本のシェルスクリプトで完成したマスターまで到達し、そのうえで各ステップが何を決めたのか、その判断が妥当かをどう見分けるのかを解説します。

この作業は「コマンドを 1 つ実行すれば終わる」ものではありません。計測・提案・レンダリング・マスタリングという 4 つの段階の連鎖であり、その途中に人間のチェックポイントが入ります。ミックスは機械が最後まで代われない部分だからです。

::: info どの CLI か
このページは Python CLI（`pip install libsonare`、コマンド名 `sonare`）を使います。`mix` と `declip` はネイティブの `sonare-cli` にはありません。[どの CLI を使っているか](../cli.md#どの-cli-を使っているか)を参照してください。Node または Python のタブがあるステップは、CLI なしでどちらのバインディングでも実行できます。
:::

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）。Node のタブには `npm install @libraz/libsonare`（Node.js 22.12 以降）が必要です。
- **`stems/` に置いた 4 本のステム:** `drums.wav`、`bass.wav`、`gtr.wav`、`vox.wav`。同じセッションから書き出し、頭がそろっていて、長さとサンプルレートが同じものにしてください。モノラルでもステレオでもかまいません。このページは 48 kHz で進めます。
- **テスト素材:** このページの数値はすべて、下のスクリプトが書き出す 6 秒のステム 4 本を、記載どおりに実行して得たものです。同じ手順で再現できます。自分のステムで実行する場合、コマンドは同じで、数値はそのステム固有の値になります。
- **用語:** アシスタントの説明文に出てくる用語は、[ミキシングの基礎](../glossary/concepts/mixing-basics.md)、[ゲインステージング](../glossary/concepts/gain-staging.md)、[バスとセンド](../glossary/mixing/buses-sends.md) で解説しています。
:::

::: details テスト用のステムを 4 本書き出すスクリプト
`make_stems.py` として保存し、`python make_stems.py` を実行します（NumPy は `pip install libsonare` で一緒に入ります）。120 BPM で 4 つのコードを繰り返す素材として、キックとスネア、矩形波のベース、コードのパッド、母音のようなメロディを書き出します。

```python
"""Write four 6-second test stems to stems/: drums, bass, gtr and vox, 48 kHz mono."""
import os
import wave

import numpy as np

SR = 48000
t = np.arange(6 * SR) / SR
rng = np.random.default_rng(3)
beat = 0.5  # 120 BPM


def save(name, x):
    with wave.open(f"stems/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def hits(times, length, make):
    x = np.zeros_like(t)
    for start in times:
        i = int(start * SR)
        n = min(length, len(t) - i)
        x[i : i + n] += make(np.arange(n) / SR)
    return x


kick = hits(np.arange(0, 6, beat), 9000, lambda u: np.sin(2 * np.pi * (50 + 80 * np.exp(-u * 30)) * u) * np.exp(-u * 12))
snare = hits(np.arange(beat, 6, 2 * beat), 6000, lambda u: rng.standard_normal(len(u)) * np.exp(-u * 25) * 0.5)
roots = np.repeat([110.0, 87.3, 130.8, 98.0], 3 * SR // 2)[: len(t)]  # A, F, C, G: 1.5 s each
bass = 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(roots) / SR)) * (0.6 + 0.4 * np.cos(2 * np.pi * t / beat))
gtr = 0.15 * sum(np.sin(2 * np.pi * np.cumsum(roots * r) / SR) for r in (2.0, 2.52, 3.0))
melody = np.repeat([440.0, 523.3, 493.9, 392.0], 3 * SR // 2)[: len(t)]
vox = 0.3 * sum(np.sin(k * 2 * np.pi * np.cumsum(melody * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * t))) / SR) / k for k in range(1, 12))

os.makedirs("stems", exist_ok=True)
save("drums", 0.6 * (kick + snare))
save("bass", bass)
save("gtr", gtr)
save("vox", vox)
```
:::

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
  --assistant --preset edm --explain \
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

::: code-group

```bash [CLI]
sonare suggest-mix \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  --sample-rate 48000 --tempo-bpm auto \
  --scene-out scene.json --json
```

```typescript [Node]
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeChannels, init, suggestMixScene } from '@libraz/libsonare';

await init();
// 各ステムの第 1 チャンネル。ステレオのステムなら `right` も渡す
const load = (name: string) => decodeChannels(new Uint8Array(readFileSync(`stems/${name}.wav`))).channels[0];
const [drums, bass, gtr, vox] = ['drums', 'bass', 'gtr', 'vox'].map(load);
const result = suggestMixScene({
  sampleRate: 48000,
  tracks: [
    { id: 'drums', name: 'Drums', left: drums },
    { id: 'bass', name: 'Bass', left: bass },
    { id: 'gtr', name: 'Gtr', left: gtr },
    { id: 'vox', name: 'Vox', left: vox },
  ],
  options: { tempoBpm: 120 },
});
for (const line of result.explanation) console.log(line);
writeFileSync('scene.json', JSON.stringify(result.scene, null, 2));
```

```python [Python]
import json
from pathlib import Path

import libsonare as sonare
from libsonare import Audio


def load(name):
    # 各ステムの第 1 チャンネル。MixTrackInput は右チャンネルも受け取れる
    with Audio.from_file_channel(f"stems/{name}.wav", 0) as audio:
        return audio.data


drums, bass, gtr, vox = (load(n) for n in ("drums", "bass", "gtr", "vox"))
result = sonare.suggest_mix_scene(
    [
        sonare.MixTrackInput("drums", drums, name="Drums"),
        sonare.MixTrackInput("bass", bass, name="Bass"),
        sonare.MixTrackInput("gtr", gtr, name="Gtr"),
        sonare.MixTrackInput("vox", vox, name="Vox"),
    ],
    sample_rate=48000,
    tempo_bpm=120.0,
)
print("\n".join(result["explanation"]))
Path("scene.json").write_text(json.dumps(result["scene"], indent=2))
```

:::

ライブラリの呼び出しはテンポを検出しません。`tempoBpm`（Python は `tempo_bpm`）を自分で渡してください。省くとトランスポートのフォールバックテンポになります。`--tempo-bpm auto` は CLI だけの機能です。

出力のうち重要なのは 3 か所で、それぞれ答えている問いが違います。

`explanation` は、各数値がなぜその値なのかを示します。判断 1 件につき 1 行が、その判断を下したルール自身から出力されます。以下は、実行が出力する 26 行のうち `vox` の行です。

```text
staged vox with -6.6 dB of input trim towards the -18.0 LUFS target
balanced vox at +2.8 dB relative to its staged level as a vocal part,
  scaled down from +5.0 dB by a 0.55 classification confidence
compressed vox at 3.3:1 above -29.1 dB, with the 5.5 ms attack and 200.0 ms
  release its 5.8 dB crest factor and 1.00 sustain ratio call for
sent vox to the plate reverb at -10.5 dB as a vocal part
pulled the master bus down to leave the summed mix its headroom
```

シーンより先にここを読んでください。納得できない判断があるなら、たいていはその手前の分類に納得できていないのであって、各行はその分類を明示しています。`scaled down from +5.0 dB by a 0.55 classification confidence` は、そのステムがボーカルだという確信が半分しかなかったとアシスタント自身が言っている行です。

`tracks` は、何を計測したかを示します。ステムごとに `integratedLufs`、`crestFactorDb`、`sustainRatio`、`spectralCentroidHz`、`bandOccupancy`、`channelCount`、そして判定された分類（`source`、`sourceConfidence`）が並びます。これが説明文の根拠です。

::: tip 説明文の用語を読む
- **-18 LUFS に向けたインプットトリム** は、フェーダーの前で各ステムを近い作業レベルにそろえる操作です。これでフェーダーは 0 dB 付近から始まり、プラグインにも扱いやすいレベルが入ります（[ゲインステージング](../glossary/concepts/gain-staging.md)、[LUFS](../glossary/lufs.md)）。
- **クレストファクター** はピークと平均の比を dB で表したもので、ドラムの一打では大きく、伸ばしたパッドでは小さくなります（[クレストファクター](../glossary/concepts/crest-factor.md)）。**サステイン比** はステムのうちアタックではなく持続音が占める割合です。アシスタントはこの 2 つからコンプレッサーのアタックとリリースを決めます。
- **プレートリバーブへのセンド** は、ボーカルのコピーを、共有のリバーブを置いたバスへ送ることで、**post** はセンドがフェーダーの後ろにあり、フェーダーに連動するという意味です（[バスとセンド](../glossary/mixing/buses-sends.md)）。
- **マスクする側／される側:** 混み合った帯域で、大きいほうのステム（マスクする側）が小さいほうのステム（マスクされる側）を聞こえにくくします。
:::

`mix` は、ステム同士のあいだで起きていることを示します。`bandDominance` は帯域ごとにマスクする側とされる側の組を並べ、`crowdedBands` は各帯域の混雑度を数値化し、`monoRisks` はモノラルで崩れる素材を指摘します。シーンはこれらに直接手を打ちません。問題がフェーダーで解けるのかアレンジの話なのかを、読み手が判断するための材料です。

::: tip `--tempo-bpm auto` の意味
提案されるシーンのディレイタイムはテンポに合わせて決まります。`auto` は最初の `--input` からテンポを検出します。フラグ自体を省くとトランスポートのフォールバックテンポが使われますが、それが曲のテンポと一致することはまずありません。
:::

## ステップ 2 — シーンを編集する

`scene.json` は素のドキュメントで、フィールド単位の仕様は [ミキシングシーン JSON](../mixing-scene-json.md) にあります。開いて、納得できないところを直して、保存する。これが 2 段階設計の狙いです。ステムからミックスダウンまでをこのファイルを見せずに一気に進めるコマンドは、意図的に用意していません。

上の実行で得られたシーンにはストリップが 6 本あります。4 本のステムに加えて、aux バスから供給される `reverbReturn` と `delayReturn` です。各インサートはパラメータを、パラメータ名をキーとするオブジェクトとして持ちます。

```json
{
  "id": "vox",
  "faderDb": 2.75,
  "inputTrimDb": -6.614171028137207,
  "inserts": [
    { "processor": "dynamics.compressor", "slot": "pre",
      "params": { "attackMs": 5.52, "ratio": 3.31, "thresholdDb": -29.1, "autoMakeup": true } },
    { "processor": "dynamics.vocalRider", "slot": "pre",
      "params": { "targetDb": -18, "maxBoostDb": 3, "maxCutDb": 3 } }
  ],
  "sends": [
    { "id": "vox-to-reverbBus", "destinationBusId": "reverbBus", "sendDb": -10.5, "timing": "post" },
    { "id": "vox-to-delayBus", "destinationBusId": "delayBus", "sendDb": -14, "timing": "post" }
  ]
}
```

`sendDb`・`faderDb`・しきい値の変更は単なるテキスト編集です。プロセッサを外すのは `inserts` からオブジェクトを 1 つ消すことです。ミキサーは読み込み時にドキュメントを検証するため、記述ミスは「妙なミックス」ではなくロードエラーとして表面化します。

ストリップに書き込む `faderDb` は、シーンが読み込まれたあとにミキサーがライブの操作子として公開するフェーダーそのものです。下の各レーンはエンジン内の 3 本のストリップで、フェーダーやミュートを動かすとそのレーンの出力だけが変わります。`scene.json` で音を聴かずに行っている編集はこれで、ステップ 3 のレンダリングで初めて耳で確かめられます。

<SonareDemo id="engine-lane-mixer" />

## ステップ 3 — レンダリングする

`mix` は Python CLI のコマンドです。コードからは `Mixer.fromSceneJson` が同じシーンを読み込み、`processStereo` がブロック単位でレンダリングします。[ミキシングエンジン](../mixing.md#シーンベースのミックス-mixer)を参照してください。

```bash
sonare mix --scene scene.json \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  -o mix.wav --json
```

```json
{"strip_count": 6, "sample_rate": 48000, "block_size": 512,
 "rendered_samples": 553053, "output": "mix.wav"}
```

この出力には、知らないと驚く点が 3 つあります。

`--input` の ID はストリップ名です。`drums=stems/drums.wav` は `id` が `drums` のストリップへ供給します。どの `--input` でも指定されなかったストリップには無音が入ります。2 本のリターンストリップにはそれが正しい挙動ですが、名前を打ち間違えたときもまったく同じことが起きます。`strip_count` は供給した本数ではなくシーンのストリップ総数なので、`--input` の数にリターンの数を足した値と突き合わせてください。

レンダリング結果はステムより長くなります。ここでのステムは 6 秒ですが、`rendered_samples` は 553053 フレーム、つまり 11.5 秒です。伸びた分は、プレートリバーブとステレオディレイが最後の音の後に鳴り残っている時間です。エフェクトリターンとそのセンドを外した同じシーンをレンダリングすると 288574 フレームが返ってきます。入力の 288000 フレームより 574 フレーム長い値です。

ステレオは保たれます。モノラルのステムは左右両方に載り、ステレオのステムは自分の 2 チャンネルを保ち、出力は常にステレオペアです。3 チャンネル以上の入力は警告付きでダウンミックスされます。

## ステップ 4 — マスタリング前にミックスダウンを点検する

マスタリングは、小さな破損を大きくします。先に探しておきます。

::: code-group

```bash [CLI]
sonare repair mix.wav --detect --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { decodeChannels, init, masteringRepairAnalyze } from '@libraz/libsonare';

await init();
// ステレオのミックスダウンの両チャンネルを別々に計測する
const { sampleRate, channels } = decodeChannels(new Uint8Array(readFileSync('mix.wav')));
const { defects, recommended } = masteringRepairAnalyze({ channels, sampleRate });
console.log(defects.clipSampleFraction, defects.cracklePerSecond, recommended.map((s) => s.stage));
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# ステレオのミックスダウンの両チャンネルを別々に計測する
channels = []
for i in range(Audio.file_channel_count("mix.wav")):
    with Audio.from_file_channel("mix.wav", i) as audio:
        channels.append(audio.data)
        sample_rate = audio.sample_rate

analysis = sonare.mastering_repair_analyze(channels, sample_rate)
print(analysis["defects"]["clipSampleFraction"], [s["stage"] for s in analysis["recommended"]])
```

:::

`--detect` は計測と報告だけを行い、何も書き出しません。レンダリングのたびに気軽に実行できます。返ってくるのはクリップ連続の長さとファイル中の割合、クリックとクラックルの件数、ノイズフロア、そして商用電源周波数の倍音列が信号に乗っているかどうかです。ライブラリの呼び出しも同じ項目を計測し、推奨するリペアの段（`recommended`）も返します。フィールド名は `clipSampleFraction` のような camelCase です。見つかったものは、マスターで直すよりステムで直すほうが安く済みます。整音側の手順は [録音素材をまとめて整音する](./recording-cleanup.md) にあります。

::: warning CLI が調べるのはステレオミックスをモノラルにまとめたもの
`repair --detect` は `mix.wav` をモノラルにまとめてから計測し、そのことを標準エラー出力に出します。左だけのクリックや片側だけのクリップのように一方のチャンネルにしかない傷は、まとめたときに小さくなったり打ち消されたりします。Node と Python のタブはチャンネルごとに計測するので、CLI のレポートがきれいでも問題が聞こえるときはそちらを使ってください。
:::

::: warning `--explain` と `--detect` は併用できません
`--detect` ではリペアの段が 1 つも実行されないため、説明すべき選択が存在しません。両方を渡すと無効なパラメータとして拒否されます（終了コード 3）。各段が選ばれる理由を見たい場合は `--detect` を外してください。
:::

## ステップ 5 — 配信ターゲット向けにマスタリングする

```bash
sonare mastering mix.wav \
  --assistant --preset edm --explain \
  --target-platform streaming \
  -o master.wav --report report.json --json
```

```json
{"mode": "assistant",
 "input_lufs": -20.49, "output_lufs": -14.05, "applied_gain_db": 7.67, "output": "master.wav",
 "stages": ["eq.tilt", "dynamics.compressor", "saturation.exciter",
            "stereo.imager", "loudness.optimize"],
 "explanation": ["base preset: edm",
                 "target loudness and ceiling applied from AssistantConfig"],
 "latency_samples": 0}
```

`--assistant` はミックスダウンをプロファイリングし、`--preset` で指定したプリセットを出発点にします。省略時は `streaming` を使います。音源からジャンルを推測することはありません。`--explain` は、ベースプリセットとリペアやスピーチ固有の判断を出力します。`--target-platform` は `streaming`、`youtube`、`broadcast`、`podcast`、`audiobook`、`cinema`、`club`、`cd` を受け付けます。独自のラウドネスとシーリングを持つのは `broadcast`（-23 LUFS、-1 dBTP）、`podcast`（-16 LUFS、-1 dBTP）、`club` と `cd`（-9 LUFS、-0.3 dBTP）だけで、それも `--target-lufs` や `--ceiling-db` を渡していないときに限ります。残りの 4 つは何も適用しません。上のスクリプトの `--target-platform streaming` は、フラグがない場合とまったく同じ既定値の -14 LUFS とシーリング -1 dBTP に着地します。一般的なストリーミングの正規化と合っているので、ここではこれが正しいターゲットです。オーディオブックでは、[トーク番組を仕上げる](./spoken-word-show.md#ステップ-4-—-speech-プリセットでマスタリングする) にあるとおり値を自分で渡してください。プロセッサ自体は [マスタリングプロセッサ](../mastering-processors.md) に、アシスタントの入出力の仕様は [マスタリングアシスタント](../mastering-assistant.md) にまとまっています。

::: warning `--target-platform` は `--assistant` を要求します
プラットフォームターゲットはアシスタントへの入力であって、全体設定ではありません。プリセット実行に渡すと終了コード 3 でその旨を表示して止まります。固定プリセットでマスタリングする場合は、`--preset <name>` とそのプリセットの組み込みターゲットを使います。別のターゲットやシーリングを指定する場合は、`--assistant --preset <name>` と `--target-lufs`／`--ceiling-db` を組み合わせるか、`mastering-suggest` でチェーンを書き出して `--chain-config` でレンダリングします。
:::

`edm` はこの例での選択にすぎません。ベースプリセットは音楽の中身で選んでください。選び方は [マスタリングプリセットの選び方](../glossary/mastering/preset-selection.md) にあります。素材の役割が決まっている場合は、ベースプリセットを明示してください。`sonare mastering-presets --json` が 30 種すべてを列挙します。`pop` や `jpop` から `speech`、`fieldRecording`、さらに `vinyl` や `shellac78` まで揃っています。`--assistant --preset <name>` に同じ名前を渡せます。`vinyl` などのリストア用プリセットはマスタリング用のラウドネスターゲットを持たないため、アシスタントでは拒否されます。

## ステップ 6 — どの数値を信じるか

`--report` は、チェーン自身が取った処理前後の計測値を書き出します。

```json
{
  "before": { "integrated_lufs": -20.49, "true_peak_dbtp": -2.10, "loudness_range": 6.85 },
  "after":  { "integrated_lufs": -14.05, "true_peak_dbtp": -1.00, "loudness_range": 7.54 },
  "applied_gain_db": 7.67,
  "max_gain_reduction_db": -6.86,
  "loudness_target_limited": false,
  "band_energy_delta_db": [ /* 32 バンド */ ]
}
```

`after` の True Peak が `-1.00` なのは、リミッター自身の 4 倍オーバーサンプリング（BS.1770）の検出器がマスターをシーリングに保っているためです。保証はこの測り方に対するもので、より細かいメーターや非可逆エンコードではこれより高く読めます（どれだけ高くなるかは [CI で納品物をゲートする](./delivery-check.md) で測っています）。レポートで目標と処理結果を確認します。`loudness_target_limited` は、要求した目標に実際に到達したかを示します。`false` は設定した制約の範囲で目標に到達したことを意味しますが、リミッターが動いていないことやマスターが完成したことは示しません。`max_gain_reduction_db` は実際の最大ゲインリダクションを示します。処理後のラウドネスと True Peak を読み、試聴してください。`true` の場合は設定したゲインとシーリングの制約下で目標に到達していないため、ミックス、目標、またはシーリングを見直します。

::: danger レポートの数値はステレオの値です。別途 `lufs` で測った値は違います
Python CLI では `mastering` がステレオペアを最後まで保つ一方、`lufs` をはじめとする計測系コマンドは先にモノラルへダウンミックスし、標準エラー出力に警告を出します。そのため同じファイルに対して両者の値が食い違います。

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.36, ...}   ← モノラルに畳んだ値
# report.json の after.integrated_lufs = -14.05   ← ステレオのマスター
```

この差はどちらかの誤りではありません。[ITU-R BS.1770](../glossary/lufs.md) はチャンネルのパワーを合算するため、2 チャンネルのプログラムは同じ素材をモノラルへ畳んだものより約 3 dB 高く出ます。さらにサイド成分がダウンミックスで失われる分が上乗せされます。ここでの差は 3.3 LU（-14.05 に対して -17.36）です。モノラルファイルなら両者は完全に一致します。

ステレオの納品物では、ラウドネスと True Peak をマスタリングレポートから取ってください。`lufs` を使うのは納品物がモノラルのときです。ステレオのまま測りたい場合は [Python API](../python-api.md) のステレオ用エントリポイントを使います。
:::

左右がどれだけ似ているかで、モノラルへの畳み込みによる損失は変わります。デモでは、同じサイン波の位相差を広げていくと平均が小さくなり、180° で打ち消されます。

<SonareDemo id="mono-fold" />

## スクリプトとして回す

ここで使ったコマンドはすべて `--json` を受け付け、失敗はすべて[規定の終了コード](../cli.md#終了コード)で返ります。使用方法の誤りは 2、無効なパラメータは 3、ファイルが見つからなければ 4、出力先に書けなければ 12 です。したがってスクリプト冒頭の `set -euo pipefail` だけで、実際に壊れた段階で連鎖を止められます。レンダリングされていないファイルをマスタリングしてしまう事故は起きません。

最後のステップをコミットごとの合否判定にする方法は [納品前チェックを CI で回す](./delivery-check.md) に続きます。

## 次に読むもの

- ミックスは近いが音色バランスが狙いどおりでない場合は [リファレンス曲に寄せる](./reference-master.md)。
- ステム自体が荒い場合は [録音素材をまとめて整音する](./recording-cleanup.md)。
- スクリプトではなくアプリに組み込みたい場合は [ミキシングエンジン](../mixing.md) と [マスタリングアシスタント](../mastering-assistant.md) が同じパイプラインを API で示しています。
