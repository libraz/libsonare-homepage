---
title: 納品前チェックを CI で回す
description: 「このマスターは合格か」という問いを、不合格なら非ゼロで終了するスクリプトに変え、コミットのたびに CI で回します。
---

# 納品前チェックを CI で回す

マスターが納品されようとしている。「聴いた感じは良さそう」という段階からプラットフォーム側の受け入れチェックまでのどこかで、この仕様を満たしているかという単純な問いに、誰かが白黒をつけなければなりません。このページはその問いを 1 本のスクリプトに変えます。送信前に人間が手元で実行でき、誰も覚えていなくても CI がコミットのたびに実行してくれるスクリプトです。

この作業の目的はラウドネスをゼロから測り直すことではありません。マスタリングの段階がすでに計測した数値を読み、その段階ではカバーされないフォーマットと破損のチェックを足し、どれか 1 つでも目標を外したらはっきり失敗として知らせることです。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- フォーマット・破損・ラウドネス・True Peak を納品仕様と突き合わせるゲートスクリプトを書き、いずれか 1 つでも失敗した瞬間に非ゼロで終了させる。
- 各チェックのしきい値を、当てずっぽうではなく理由をもって決める。
- ステレオファイルではラウドネスと True Peak をマスタリングレポートから読むべき理由と、別途 `lufs` や `mastering-streaming` を呼ぶとゲートを誤らせる理由を説明できる。
- このスクリプトをコミットのたびに実行される CI ジョブへ組み込む。

## ゲートスクリプト

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）。スクリプトの最後のチェックが Python パッケージを読み込むので、最初の 2 つのコマンドにネイティブの `sonare-cli` を使う場合（そこでは `sonare` を `sonare-cli` に読み替えます）でも必要です。
- **`master.wav` と `report.json`:** ステレオのマスターと、マスタリングの段階がそれについて書き出した `--report`。どちらも [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) で作れます。このページの数値はすべて、そのページのスクリプトを記載どおりに実行して書き出されるステムから取っています。
- **スクリプト:** 下のブロックを `gate.sh` として保存し、`chmod +x gate.sh` で実行権限を付けてください。
:::

マスタリングの段階がすでに実行済みで、マスター本体とそれが書き出した `--report` の両方が残っていることを前提にします。その段階については [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) を参照してください。

```bash
#!/usr/bin/env bash
set -euo pipefail

MASTER="${1:-master.wav}"
REPORT="${2:-report.json}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Delivery contract for this target. Change these, not the checks below.
# Each one can also be set in the environment for a one-off run.
export GATE_SAMPLE_RATE="${GATE_SAMPLE_RATE:-48000}"
export GATE_TARGET_LUFS="${GATE_TARGET_LUFS:--14.0}"
export GATE_LUFS_TOLERANCE="${GATE_LUFS_TOLERANCE:-0.5}"
export GATE_CEILING_DBTP="${GATE_CEILING_DBTP:--1.0}"
export GATE_MAX_CLICKS_PER_S="${GATE_MAX_CLICKS_PER_S:-0.2}"
export GATE_MAX_CRACKLE_PER_S="${GATE_MAX_CRACKLE_PER_S:-1.0}"

# 1. Format: the file that ships is the file you think it is.
sonare info "$MASTER" --json 2>/dev/null > "$WORKDIR/info.json"

# 2. Damage: --detect writes nothing, so it is free to run on every delivery.
sonare repair "$MASTER" --detect --json 2>/dev/null > "$WORKDIR/defects.json"

python3 - "$MASTER" "$REPORT" "$WORKDIR/info.json" "$WORKDIR/defects.json" <<'PY'
import json
import os
import sys

from libsonare import Audio, mastering_streaming_preview_stereo

master_path, report_path, info_path, defects_path = sys.argv[1:5]
target_lufs = float(os.environ["GATE_TARGET_LUFS"])
tolerance = float(os.environ["GATE_LUFS_TOLERANCE"])
ceiling_dbtp = float(os.environ["GATE_CEILING_DBTP"])
sample_rate = int(os.environ["GATE_SAMPLE_RATE"])
max_clicks = float(os.environ["GATE_MAX_CLICKS_PER_S"])
max_crackle = float(os.environ["GATE_MAX_CRACKLE_PER_S"])

failures = []

info = json.load(open(info_path))
if info["channels"] != 2:
    failures.append(f"channels = {info['channels']} (expected 2)")
if info["sample_rate"] != sample_rate:
    failures.append(f"sample_rate = {info['sample_rate']} (expected {sample_rate})")
if info["duration"] < 1.0:
    failures.append(f"duration = {info['duration']:.3f}s, file looks truncated")

defects = json.load(open(defects_path))["defects"]
if not defects.get("measured"):
    # 短すぎて測定できないファイルは、他のフィールドを一切返さない。
    failures.append("damage not measured (file too short for the detectors)")
else:
    if defects["clip_sample_fraction"] > 0.0:
        failures.append(f"clipping: {defects['clip_sample_fraction'] * 100:.3f}% of samples")
    if defects["click_per_second"] > max_clicks:
        failures.append(f"clicks: {defects['click_per_second']:.2f}/s")
    if defects["crackle_per_second"] > max_crackle:
        failures.append(f"crackle: {defects['crackle_per_second']:.2f}/s")
    if defects["hum_peak_found"] and defects["hum_fundamental_prominence"] > 6.0:
        failures.append(
            f"mains hum at {defects['hum_fundamental_hz']:.0f} Hz, "
            f"prominence {defects['hum_fundamental_prominence']:.1f}"
        )

# Loudness and true peak come from the mastering report -- the stereo
# measurement the chain itself took -- not from a separate `lufs` call.
after = json.load(open(report_path))["after"]
lufs_gap = after["integrated_lufs"] - target_lufs
if abs(lufs_gap) > tolerance:
    failures.append(
        f"integrated_lufs = {after['integrated_lufs']:.2f} "
        f"({lufs_gap:+.2f} LU from {target_lufs} target)"
    )
if after["true_peak_dbtp"] > ceiling_dbtp:
    failures.append(f"true_peak_dbtp = {after['true_peak_dbtp']:.2f} (ceiling {ceiling_dbtp})")

# The report must describe this file. Re-measure the shipped stereo pair; a
# mismatch means report.json came from another render, or the file changed after it.
if info["channels"] == 2:
    pair = []
    for i in range(2):
        with Audio.from_file_channel(master_path, i) as audio:
            pair.append(audio.data)
    spec = [{"name": "spec", "targetLufs": target_lufs, "ceilingDb": ceiling_dbtp}]
    shipped = json.loads(mastering_streaming_preview_stereo(*pair, sample_rate, spec))["platforms"][0]
    if (abs(shipped["integratedLufs"] - after["integrated_lufs"]) > 0.1
            or abs(shipped["truePeakDb"] - after["true_peak_dbtp"]) > 0.1):
        failures.append(
            f"report does not match the file: file measures {shipped['integratedLufs']:.2f} LUFS, "
            f"{shipped['truePeakDb']:.2f} dBTP"
        )

if failures:
    print("DELIVERY GATE: FAIL")
    for line in failures:
        print(f"  - {line}")
    sys.exit(1)

print("DELIVERY GATE: PASS")
print(
    f"  {info['sample_rate']} Hz, {info['channels']}ch, "
    f"{info['duration']:.2f}s, {after['integrated_lufs']:.2f} LUFS, "
    f"{after['true_peak_dbtp']:.2f} dBTP"
)
PY
```

ミックスの手順で作ったマスターに対して実行します。

```bash
./gate.sh master.wav report.json
```

```text
DELIVERY GATE: FAIL
  - clicks: 2.43/s
  - crackle: 1.56/s
```

一覧にラウドネスと True Peak はなく、落ちたのはダメージのチェックです。これはマスターのレベルではなくテスト素材の性質によるものです。テスト用のドラムはキックと、立ち上がりが瞬時のノイズバーストでできていて、クリック検出器がそれを数えます（ドラムのステム単体もミックスダウンも 1 秒あたり 2.17 回）。クラックルは、ミックスダウンでは 0.00 だったものがマスターでは 1 秒あたり 1.56 回になっています。既定値の `0.2` と `1.0` は通常の楽曲向けなので（後述）、スクリプトを書き換えずに、この 1 回の実行だけ環境変数で上書きします。

```bash
GATE_MAX_CLICKS_PER_S=3 GATE_MAX_CRACKLE_PER_S=2 ./gate.sh master.wav report.json
```

```text
DELIVERY GATE: PASS
  48000 Hz, 2ch, 11.52s, -14.05 LUFS, -1.00 dBTP
```

`-1.00` は偶然ではありません。マスタリングレポートの True Peak は、リミッター自身の 4 倍オーバーサンプリング（BS.1770）の検出器で測られ、リミッターはその測り方でマスターをシーリングに保ちます。このレポートは `-1.0000004` で、マスターは `-1.0` のシーリングの下ではなく、ちょうどそこにいます。そのためレポートの値だけでは不足は現れません。不足が見えるのは、マスターを作ったときより低いシーリングと比べたときや、別のメーターがファイルを読んだときです。同じマスターを `-1.2` のシーリングに対して実行します。

```bash
GATE_MAX_CLICKS_PER_S=3 GATE_MAX_CRACKLE_PER_S=2 GATE_CEILING_DBTP=-1.2 ./gate.sh master.wav report.json
```

```text
DELIVERY GATE: FAIL
  - true_peak_dbtp = -1.00 (ceiling -1.2)
```

`-1.00` は `-1.2` より大きい、つまりより大きな音です。2 つの数値を目で見比べると逆に読みたくなりますが、ゲートは符号を正しく扱っています。直す場所はこのスクリプトではなくマスタリングの段階です。`--ceiling-db -1.2` で再実行すれば、同じゲートが `-1.20 dBTP`（`-14.06` LUFS）で通ります。

レポートが正確なのに、なぜ仕様より低くマスタリングするのか。仕様はリミッターの測り方で満たされているだけで、ファイルは別のメーターにも読まれるからです。次の表は、同じミックスを 3 つのシーリングでマスタリングし、それぞれをレポート、出荷ファイルへの 16 倍メーター、非可逆エンコーダーを往復させた後の 16 倍メーターで読んだものです（すべて dBTP、悪い側のチャンネル）。

| `--ceiling-db` | レポート（4 倍） | ファイル、16 倍 | AAC 256 kbit/s、16 倍 | MP3 320 kbit/s、16 倍 |
| --- | --- | --- | --- | --- |
| -1.0（既定） | -1.000 | -0.997 | -0.672 | -0.391 |
| -1.2 | -1.200 | -1.197 | -0.785 | -0.655 |
| -2.0 | -2.000 | -1.997 | -1.315 | -1.374 |

`-1.0` の仕様に対して読みます。より細かいメーターはこのファイルを 0.003 dB 高く読むので、既定のシーリングのマスターは 16 倍のチェッカーでは `-0.997 > -1.0` で不合格になり、`-1.2` のマスターは余裕をもって通ります。非可逆エンコードはピークをさらに大きく動かし、既定のマスターでは AAC で約 0.3 dB、MP3 で約 0.6 dB 上がります。`-1.2` でも足りず、どちらのデコード結果も `-1.0` を超えます。両方を `-1.0` の下に収めたのは [配信ターゲット](../glossary/mastering/delivery-targets.md) にある `-2 dBTP` のコーデック安全寄りのシーリングだけ（`-1.315` と `-1.374`）で、納品後にエンコードされるファイルならこれでマスタリングし、`GATE_CEILING_DBTP` もそれに合わせてください。1 つの素材と ffmpeg 内蔵の AAC および LAME エンコーダーでの値で、別のエンコーダーなら読みも変わるため、実際の配信経路で測ってください。表のコマンドは次のとおりです。

```bash
ffmpeg -i master.wav -c:a aac -b:a 256k master.m4a && ffmpeg -i master.m4a master-aac.wav
ffmpeg -i master.wav -c:a libmp3lame -b:a 320k master.mp3 && ffmpeg -i master.mp3 master-mp3.wav
```

```python
import libsonare as sonare
from libsonare import Audio


def true_peak_db(path, oversample):
    peaks = []
    for i in range(Audio.file_channel_count(path)):
        with Audio.from_file_channel(path, i) as audio:
            peaks.append(sonare.metering_true_peak_db(audio.data, audio.sample_rate, oversample))
    return max(peaks)


print(true_peak_db("master.wav", 16))  # -0.9967
```

やってはいけないのは、このファイルがたまたま通るところまでゲートのシーリングを緩めることです。

<FlowDiagram
  title="納品の合否を判定する"
  direction="LR"
  :nodes="[
    { id: 'master', label: 'master.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'report', label: 'report.json', col: 0, row: 2, variant: 'muted' },
    { id: 'format', label: 'sonare info', col: 1, row: 0, variant: 'default' },
    { id: 'damage', label: 'repair --detect', col: 1, row: 1, variant: 'warning' },
    { id: 'loud', label: 'ラウドネス + True Peak', col: 1, row: 2, variant: 'default' },
    { id: 'gate', label: 'すべて合格?', col: 2, row: 1, variant: 'decision' },
    { id: 'pass', label: 'exit 0 -- 出荷', col: 3, row: 0, variant: 'success' },
    { id: 'fail', label: 'exit 1, 失敗理由を出力', col: 3, row: 2, variant: 'error' }
  ]"
  :edges="[
    { from: 'master', to: 'format' },
    { from: 'master', to: 'damage' },
    { from: 'report', to: 'loud' },
    { from: 'format', to: 'gate' },
    { from: 'damage', to: 'gate' },
    { from: 'loud', to: 'gate' },
    { from: 'gate', to: 'pass', label: 'yes' },
    { from: 'gate', to: 'fail', label: 'no' }
  ]"
  caption="フォーマットと破損はマスターファイル自身から。ラウドネスと True Peak は別途 lufs を呼ぶのではなく、ステレオのマスタリングレポートから取ります。"
/>

## 各チェックの中身としきい値の決め方

### フォーマット: `sonare info`

```bash
sonare info master.wav --json
```

```json
{"path": "master.wav", "duration": 11.5219375, "sample_rate": 48000,
 "channels": 2, "samples": 553053, "peak_db": -1.071, "rms_db": -19.44}
```

`channels` と `sample_rate` は最も安く済むチェックです。壊れたパイプライン段から出てきたレンダリングを、音そのものを表す数値に時間をかける前に捕まえます。`channels` はこのページ全体がステレオ納品を前提にしているため `2` に固定し、`GATE_SAMPLE_RATE` はプロジェクトごとに本当に変わる部分なので変数にしてあります。`duration < 1.0` は途中で切れたファイルを捕まえます。空のまま終わった、あるいは途中で止まったレンダリングはパイプラインの手前側のほとんどのツールでは exit 0 のまま通ってしまうため、これがそれに気づく唯一のチェックになることも珍しくありません。

### 破損: `repair --detect`

::: code-group

```bash [CLI]
sonare repair master.wav --detect --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { decodeChannels, init, masteringRepairAnalyze } from '@libraz/libsonare';

await init();
// マスターの各チャンネルを、まとめずに別々に計測する
const { sampleRate, channels } = decodeChannels(new Uint8Array(readFileSync('master.wav')));
const { defects } = masteringRepairAnalyze({ channels, sampleRate });
if (!defects.measured) throw new Error('damage not measured');
console.log(defects.clipSampleFraction, defects.clickPerSecond, defects.cracklePerSecond, defects.humFundamentalProminence);
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# マスターの各チャンネルを、まとめずに別々に計測する
channels = []
for i in range(Audio.file_channel_count("master.wav")):
    with Audio.from_file_channel("master.wav", i) as audio:
        channels.append(audio.data)
        sample_rate = audio.sample_rate

defects = sonare.mastering_repair_analyze(channels, sample_rate)["defects"]
if not defects["measured"]:
    raise SystemExit("damage not measured")
print(defects["clipSampleFraction"], defects["clickPerSecond"], defects["cracklePerSecond"], defects["humFundamentalProminence"])
```

:::

```json
{"mode": "detect", "defects": {
  "measured": true,
  "clip_sample_fraction": 0.0, "clip_run_count": 0,
  "click_count": 28, "click_per_second": 2.43,
  "crackle_per_second": 1.56, "noise_floor_dbfs": -120.0,
  "hum_peak_found": true, "hum_fundamental_hz": 51.75,
  "hum_fundamental_prominence": 3.45
}}
```

`--detect` は計測するだけで何も書き出さないので、コミットのたびに実行してもコストがかかりません。短すぎて検出器にかけられないファイルは `{"measured": false}` だけを返します。ゲートはこれを問題なしではなく不合格として扱います。ライブラリの呼び出しは同じ計測値を camelCase の名前（`clipSampleFraction`、`clickPerSecond`）で返します。`hum_peak_found` は CLI の出力にだけ存在し、突出度が 1.0 を超えたことを意味します。`clip_sample_fraction` のしきい値は `0.0` にします。仕上がったマスターがクリップすることは本来ないはずで、それを防ぐのがリミッターの仕事そのものだからです。`click_per_second` と `crackle_per_second` には現実的な余裕が必要です。立ち上がりの鋭い素材では検出器がゼロではない基準値を返すからです。既定の `0.2` と `1.0` は通常の楽曲向けの出発点であって、破損のないマスターの実測値ではありません。このページの合成ドラムは、破損のないマスターで 1 秒あたり `2.43` と `1.56` を記録し、だからこそ上のウォークスルーではこの 1 回だけ両方を引き上げました。ジャンルの近い良品マスターを何本か測って調整し、変更がレビューで見えるようにコントラクトのブロックに置いてください。

`hum_peak_found` はそれ単体では真偽値にすぎず、ノイズフロア以下の商用電源ハムはよくあることで、聞こえもしません。ゲートはその有無だけで落とすべきではありません。それを実用的なチェックに変えるのが `hum_fundamental_prominence` です。これは dB ではなく単純な比で、最も強いハム候補のエネルギーを、試したすべての候補の中央値で割ったものです。`1.0` はピークがまったくないことを表します。このマスターにたまたま乗っているピークは、51.75 Hz にあります。これはハムではなくテスト用キックの基音で、突出度は `3.45` です。一方、[録音素材をまとめて整音する](./recording-cleanup.md) の破損したテイクは 50 Hz で `18.6` を記録しています。`6.0` はその中間に置いてあり、聞こえないピークを無視しつつ聞こえるピークは捕まえるだけの高さです。これは突出度が `10` を超えたときだけ dehum を実行するリペアアシスタントより厳しい基準です（[録音素材をまとめて整音する](./recording-cleanup.md#ステップ-2-—-アシスタントに選ばせる) を参照）。突出度 7.9 まで整音したテイクも、このゲートでは不合格になります。

::: warning `repair --detect` が測るのはステレオマスターをモノラルにまとめたもの
CLI はダメージを調べる前に `master.wav` をモノラルにまとめ、その旨を標準エラー出力に出します。片方のチャンネルだけのクリックやクリップは、まとめたときに小さくなったり打ち消されたりするので、CLI のレポートがきれいでも各チャンネルがきれいだとは言えません。チャンネルごとに調べるには、上の Node か Python のタブにあるライブラリの呼び出しを両チャンネルに対して実行してください。`masteringRepairAnalyze` と `mastering_repair_analyze` は渡されたすべてのチャンネルを計測します。
:::

### ラウドネスと True Peak: マスタリングレポート

```json
{"before": {"integrated_lufs": -20.49, "true_peak_dbtp": -2.10},
 "after":  {"integrated_lufs": -14.05, "true_peak_dbtp": -1.00}}
```

どちらの数値も、マスタリング段階が書き出した `--report` の `after` から取ります。チェーン自身がステレオペア全体に対して行った計測です。`GATE_LUFS_TOLERANCE` は納品仕様が目標をどれだけ厳しく定めているかに合わせます。`±0.5` LU は、EBU R128 がファイルベースの放送番組に認めている許容幅です（生放送の番組は ±1 LU）。ストリーミングのプラットフォームは許容幅をそもそも公表していません。再生時に正規化して大きすぎるマスターを下げるので、ストリーミング向けでは許容幅は自分たちの一貫性のための決まりで、シーリングのほうが重要です。`GATE_CEILING_DBTP` はマスタリングの段階自身に指示したシーリングと同じ値にします。アシスタントはその値をすでに絶対の制約として扱っているので、レポートがそれを超えているなら、プラットフォームが何であれ上流の何かが自分自身の設定を守れなかったということであり、はっきり失敗として知らせる価値があります。

最後のチェックは、レポートがこのファイルのものかを確かめます。`report.json` を読むだけのゲートでは、以前のレンダリングの古いレポートや、マスタリング後にリサンプリング、ディザー、トリムをしたマスターでも通ってしまいます。スクリプトは納品するステレオペアを `mastering_streaming_preview_stereo` で測り直し、ラウドネスか True Peak がレポートと 0.1 dB より大きく違えば不合格にします。書き出したばかりの 16 ビットのファイルなら、自分のレポートとの差はそれよりはるかに小さくなります。

同じファイルに対して `sonare info` は `peak_db: -1.071` を返します（先にモノラルへダウンミックスし、警告を出します）。右チャンネルで保存されている最大のサンプルは `-1.048` ですが、そのチャンネルの True Peak は `-1.000` です。コンバーターが保存サンプルの間を再構成した波形は、どの保存サンプルよりも高くなります。下のデモが描いているのはこの現象です。ゲートが `info` の `peak_db` ではなくレポートの `true_peak_dbtp` を読むのは、このためです。

<SonareDemo id="inter-sample-peak" />

`report.json` に `loudness_target_limited: true` と大きな `max_gain_reduction_db` が並んでいる場合は、マスターが目標ラウドネスに届く前にミックスのヘッドルームが尽きたということです。これはしきい値の調整では直せないミックス側の問題です。[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md#ステップ-6-—-どの数値を信じるか) の「どの数値を信じるか」を参照してください。

::: danger ステレオファイルでは `lufs` や `mastering-streaming` からラウドネスや True Peak を読んではいけません
どちらのコマンドも計測の前にステレオ入力をモノラルへダウンミックスし、そうしたことを標準エラー出力に警告として出します。普遍的な補正値はありません。`m = (L + R) / 2` とすると、左右が同一ならモノラル合算はステレオのチャンネルパワーの読みより 3.01 LU 低く、同じパワーで無相関のチャンネルなら 6.02 LU 低くなり、逆極性では打ち消し合います。これは信号に依存する例なので、実際のステレオ素材はレポートまたはステレオ API で比較してください。[ITU-R BS.1770](../glossary/lufs.md) はチャンネルのパワーを合算するため、ダウンミックスで合否が逆転することがあります。

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.36, ...}          <- モノラルに畳んだ値
# report.json after.integrated_lufs = -14.05 <- ステレオのマスター
```

同じダウンミックスが Spotify 向けのプレビューも歪めます。

```bash
sonare mastering-streaming master.wav --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.36, "normalization_gain_db": 3.36,
   "true_peak_db": -1.07, "ceiling_risk": true},
  /* Apple Music, YouTube -- same integrated_lufs, each platform's own gain and risk */
]}
```

上の数値は 1 つの素材についての例であり、補正係数ではありません。そのゲインをモノラルに畳んだ後のピーク値に適用すると `+2.29` dBTP（-1.07 + 3.36）まで達し、`-1.0` dBTP のシーリングを 3.29 dB も超える計算になり、深刻な失敗に見えます。同じ計算をレポートの本当のステレオの値（`-14.05` LUFS、`-1.00` dBTP）でやり直すと、必要なゲインは `+0.05` dB ほどまで下がり、予測されるピークは `-0.95` dBTP になります。それでもシーリングは超えていますが、超過は `3.29` ではなく `0.05` dB です。ダウンミックスがこの問題を作り出しているわけではなく、小さくて本物の超過を約 70 倍ひどく見せているだけです。納品物がモノラルならダウンミックス分を補正する必要はなく、`lufs` や `mastering-streaming` はファイルをそのまま読みます。次の `take-clean.wav` を見てください。

```bash
sonare lufs take-clean.wav --json
# {"integrated_lufs": -6.0630, ...}
sonare mastering-profile take-clean.wav --json
# {"loudness": {"integrated_lufs": -6.0630, ...}, ...}
```

`mastering-streaming` を直接使うのは、納品物がモノラルのときか、クロスチェックとしてです。マスタリングレポート以外の場面でステレオのまま正確に測りたいときは、[Python API](../python-api.md) のステレオ用エントリポイントを使ってください。`mastering_streaming_preview_stereo` などのステレオ用関数はダウンミックスではなく両チャンネルを測ります。
:::

左右がどれだけ似ているかで、モノラルへの畳み込みによる損失は変わります。デモでは、同じサイン波の位相差を広げていくと平均が小さくなり、180° で打ち消されます。

<SonareDemo id="mono-fold" />

`mastering-streaming` は組み込みの 3 プラットフォームの代わりに、自分の納品仕様を渡すこともできます。ここでの `platforms.json` の中身は次のとおりです。

```json
[{"name": "Spotify", "targetLufs": -14, "ceilingDb": -1},
 {"name": "Apple Music", "targetLufs": -16, "ceilingDb": -1}]
```

```bash
sonare mastering-streaming master.wav --platforms-file platforms.json --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.36, "normalization_gain_db": 3.36, "true_peak_db": -1.07, "ceiling_risk": true},
  {"name": "Apple Music", "integrated_lufs": -17.36, "normalization_gain_db": 1.36, "true_peak_db": -1.07, "ceiling_risk": true}
]}
```

`--platforms` はファイルではなく同じ配列をその場で渡す形です。組み込みの 3 種類が納品先と一致していると決めつけず、モノラルのファイルで、あるいは上の補正を自分で適用したうえで、実際の納品契約の数値をどちらかに渡してください。

### 納品物にプロジェクトドキュメントが含まれる場合

ステムや DAW 間の受け渡しを伴う納品では、音声と一緒にプロジェクトファイルを渡すことがよくあります。`sonare project validate` は、読み込みには成功するものの、渡した先のツールが情報を黙って落としてしまうような診断を抱えたドキュメントを捕まえます。

```bash
sonare project validate --in project.json --strict --json
```

```json
{"valid": true, "bytes": 518, "diagnostic_count": 1,
 "diagnostics": ["dropped_automation_lane_target_id: track 1 carried an automation lane with target id 0; lane dropped"]}
```

`--strict` を付けなければこれは exit 0 で終わります。診断が 1 件あるだけではドキュメント全体を落とす理由にはならず、ローダーは問題の断片だけを外して回復するからです。`--strict` はその同じ回復を納品の不合格（exit 9、無効な状態）に変えます。オートメーションレーンが 1 本黙って消えることが、その納品物にとって許容できないなら、これが正しい選択です。

## CI で実行する

```yaml
name: delivery-gate
on: [push]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install libsonare
      - run: ./gate.sh master.wav report.json
```

ジョブはリポジトリをチェックアウトするので、`gate.sh`、`master.wav`、`report.json` をリポジトリにコミットしておく必要があります。`gate.sh` は実行権限付きで（`git add` の前に `chmod +x gate.sh`）コミットしてください。`actions/setup-python` は `pip install` が書き込める Python をジョブに用意します。ランナーのシステム Python はグローバルなインストールを拒否することがあります。

このスクリプトが呼ぶコマンドはすべて `--json` を受け付け、失敗はすべて素の `1` ではなく[規定の終了コード](../cli.md#終了コード)で返ります。冒頭の `set -euo pipefail` があるからこそ、それが「実際に壊れた段階でジョブが失敗する」という挙動に変わります。`SONARE_LEGACY_EXIT=1` は、パイプラインの上流にまだ古い「失敗はすべて `1`」という前提を決め打ちしている呼び出し側がいる場合のためのものです。このゲートスクリプト自身は特定の終了コードで分岐しているわけではなく自前のしきい値で判定しているので、これを必要としません。

## 次に読むもの

- ゲートが落ちている理由が納品契約ではなくマスター自体にある場合は [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) に戻ってください。
- 同じ録音で破損チェックが何度も引っかかる場合は [録音素材をまとめて整音する](./recording-cleanup.md) は、納品ファイル側ではなくソース側で直す方法を扱っています。
- このロジックをシェルスクリプトではなくアプリに組み込みたい場合は、同じ計測が [Python API](../python-api.md) にもあり、CLI からは使えないステレオ用エントリポイントも含まれています。
