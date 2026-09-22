---
title: 納品前チェックを CI で回す
description: 「このマスターは合格か」という問いを、不合格なら非ゼロで終了するスクリプトに変え、コミットのたびに CI で回します。
---

# 納品前チェックを CI で回す

マスターが納品されようとしている。「聴いた感じは良さそう」とプラットフォーム側の受け入れチェックのあいだのどこかで、誰かが単純な問いに白黒つけなければなりません。この仕様を満たしているか、という問いです。このページはその問いを 1 本のスクリプトに変えます。送信前に人間が手元で走らせられて、しかも誰も覚えていなくても CI がコミットのたびに走らせてくれるスクリプトです。

この作業の目的はラウドネスをゼロから測り直すことではありません。マスタリングの段階がすでに取った数値を読み、その段階ではカバーされないフォーマットと破損のチェックを足し、どれか 1 つでも目標を外したらはっきり失敗として知らせることです。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- フォーマット・破損・ラウドネス・True Peak を納品仕様と突き合わせるゲートスクリプトを書き、いずれか 1 つでも失敗した瞬間に非ゼロで終了させる。
- 各チェックのしきい値を、当てずっぽうではなく理由をもって決める。
- ステレオファイルではラウドネスと True Peak をマスタリングレポートから読むべき理由と、別途 `lufs` や `mastering-streaming` を呼ぶとゲートを誤らせる理由を説明できる。
- このスクリプトをコミットのたびに走る CI ジョブへ組み込む。

## ゲートスクリプト

マスタリングの段階がすでに走り、マスター本体とそれが書き出した `--report` の両方が残っていることを前提にします。その段階については [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) を参照してください。

```bash
#!/usr/bin/env bash
set -euo pipefail

MASTER="${1:-master.wav}"
REPORT="${2:-report.json}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Delivery contract for this target. Change these, not the checks below.
export GATE_SAMPLE_RATE=48000
export GATE_TARGET_LUFS=-14.0
export GATE_LUFS_TOLERANCE=0.5
export GATE_CEILING_DBTP=-1.0

# 1. Format: the file that ships is the file you think it is.
sonare info "$MASTER" --json 2>/dev/null > "$WORKDIR/info.json"

# 2. Damage: --detect writes nothing, so it is free to run on every delivery.
sonare repair "$MASTER" --detect --json 2>/dev/null > "$WORKDIR/defects.json"

python3 - "$REPORT" "$WORKDIR/info.json" "$WORKDIR/defects.json" <<'PY'
import json
import os
import sys

report_path, info_path, defects_path = sys.argv[1], sys.argv[2], sys.argv[3]
target_lufs = float(os.environ["GATE_TARGET_LUFS"])
tolerance = float(os.environ["GATE_LUFS_TOLERANCE"])
ceiling_dbtp = float(os.environ["GATE_CEILING_DBTP"])
sample_rate = int(os.environ["GATE_SAMPLE_RATE"])

failures = []

info = json.load(open(info_path))
if info["channels"] != 2:
    failures.append(f"channels = {info['channels']} (expected 2)")
if info["sample_rate"] != sample_rate:
    failures.append(f"sample_rate = {info['sample_rate']} (expected {sample_rate})")
if info["duration"] < 1.0:
    failures.append(f"duration = {info['duration']:.3f}s, file looks truncated")

defects = json.load(open(defects_path))["defects"]
if defects["clip_sample_fraction"] > 0.0:
    failures.append(f"clipping: {defects['clip_sample_fraction'] * 100:.3f}% of samples")
if defects["click_per_second"] > 0.2:
    failures.append(f"clicks: {defects['click_per_second']:.2f}/s")
if defects["crackle_per_second"] > 1.0:
    failures.append(f"crackle: {defects['crackle_per_second']:.2f}/s")
if defects["hum_peak_found"] and defects["hum_fundamental_prominence"] > 6.0:
    failures.append(
        f"mains hum at {defects['hum_fundamental_hz']:.0f} Hz, "
        f"{defects['hum_fundamental_prominence']:.1f} dB prominence"
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
  - true_peak_dbtp = -0.95 (ceiling -1.0)
```

これは丸め誤差ではなく、本物の不合格です。`-0.95` は `-1.0` より大きい、つまりより大きな音です。2 つの数値を目で見比べると逆に読みたくなりますが、ゲートは符号を正しく扱っています。直す場所はこのスクリプトではなくマスタリングの段階です。より厳しい `--ceiling-db` を指定して再実行するか、実際の納品先がヘッドルームの目減りを許容するなら [配信ターゲット](../glossary/mastering/delivery-targets.md) にある `-2 dBTP` というコーデック安全寄りのシーリングを選び、`GATE_CEILING_DBTP` をそれに合わせて更新してください。やってはいけないのは、このファイルがたまたま通るところまでゲートのシーリングを緩めることです。

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
{"path": "master.wav", "duration": 10.303104166666667, "sample_rate": 48000,
 "channels": 2, "samples": 494549, "peak_db": -1.205, "rms_db": -18.57}
```

`channels` と `sample_rate` は最も安く済むチェックです。壊れたパイプライン段から出てきたレンダリングを、音そのものを表す数値に時間をかける前に捕まえます。`channels` はこのページ全体がステレオ納品を前提にしているため `2` に固定し、`GATE_SAMPLE_RATE` はプロジェクトごとに本当に変わる部分なので変数にしてあります。`duration < 1.0` は途中で切れたファイルを捕まえます。空のまま終わった、あるいは途中で止まったレンダリングはパイプラインの手前側のほとんどのツールでは exit 0 のまま通ってしまうため、これがそれに気づく唯一のチェックになることも珍しくありません。

### 破損: `repair --detect`

```bash
sonare repair master.wav --detect --json
```

```json
{"mode": "detect", "defects": {
  "clip_sample_fraction": 0.0, "clip_run_count": 0,
  "click_count": 1, "click_per_second": 0.097,
  "crackle_per_second": 0.485, "noise_floor_dbfs": -94.97,
  "hum_peak_found": true, "hum_fundamental_hz": 60.0,
  "hum_fundamental_prominence": 2.19
}}
```

`--detect` は計測するだけで何も書き出さないので、コミットのたびに走らせてもコストがかかりません。`clip_sample_fraction` のしきい値は `0.0` にします。仕上がったマスターがクリップすることは本来ないはずで、それを防ぐのがリミッターの仕事そのものだからです。`click_per_second` と `crackle_per_second` には現実的な余裕が必要です。普通の楽曲でも検出器はゼロではない基準値を返すからで、破損のないこのマスターでもそれぞれ 1 秒あたり `0.097` と `0.485` を記録しています。`0.2` と `1.0` なら、通常の密度で誤検知することなく本当に破損したファイルを捕まえられます。

`hum_peak_found` はそれ単体では真偽値にすぎず、ノイズフロア以下の商用電源ハムはよくあることで、聞こえもしません。ゲートはその有無だけで落とすべきではありません。それを実用的なチェックに変えるのが `hum_fundamental_prominence` です。このマスターにたまたま乗っている 60 Hz のピークは突出度 `2.19` dB ですが、同じセッションの実際に破損したテイクは 50 Hz で `18.6` dB を記録しています。`6.0` dB はその中間に置いてあり、聞こえないピークを無視しつつ聞こえるピークは捕まえるだけの高さです。

### ラウドネスと True Peak: マスタリングレポート

```json
{"before": {"integrated_lufs": -19.61, "true_peak_dbtp": -6.13},
 "after":  {"integrated_lufs": -14.11, "true_peak_dbtp": -0.95}}
```

どちらの数値も、マスタリング段階が書き出した `--report` の `after` から取ります。チェーン自身がステレオペア全体に対して行った計測です。`GATE_LUFS_TOLERANCE` はプラットフォームが目標をどれだけ厳しく運用しているかに合わせます。ストリーミング向けの目標に対して `±0.5` LU は余裕があり、放送向けには厳しめです。`GATE_CEILING_DBTP` はマスタリングの段階自身に指示したシーリングと同じ値にします。アシスタントはその値をすでに絶対の制約として扱っているので、レポートがそれを超えているなら、プラットフォームが何であれ上流の何かが自分自身の設定を守れなかったということであり、はっきり失敗として知らせる価値があります。

同じファイルに対して `sonare info` は `peak_db: -1.205` を返していました。これはサンプルピークで、True Peak では不合格になった `-1.0` の天井を通ってしまう値です。この 2 つの差が、下のデモが描いているものです。保存されたサンプルはすべて天井の下にあるのに、コンバーターがその間を再構成した波形は天井を超えます。ゲートが `info` の `peak_db` ではなくレポートの `true_peak_dbtp` を読むのは、このためです。

<SonareDemo id="inter-sample-peak" />

`report.json` に `loudness_target_limited: true` と大きな `max_gain_reduction_db` が並んでいる場合は、マスターが目標ラウドネスに届く前にミックスのヘッドルームが尽きたということです。これはしきい値の調整では直せないミックス側の問題です。[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md#ステップ-6-—-どの数値を信じるか) の「どの数値を信じるか」を参照してください。

::: danger ステレオファイルでは `lufs` や `mastering-streaming` からラウドネスや True Peak を読んではいけません
どちらのコマンドも計測の前にステレオ入力をモノラルへダウンミックスし、そうしたことを標準エラー出力に警告として出します。[ITU-R BS.1770](../glossary/lufs.md) はチャンネルのパワーを合算するため、モノラルへ畳んだ値はステレオのプログラムよりおおむね 3 dB 低く出ます。これは合格を不合格に、あるいはその逆に変えるだけの大きさです。

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.57, ...}          <- モノラルに畳んだ値
# report.json after.integrated_lufs = -14.11 <- ステレオのマスター
```

同じダウンミックスが Spotify 向けのプレビューも歪めます。

```bash
sonare mastering-streaming master.wav --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.57, "normalization_gain_db": 3.57,
   "true_peak_db": -1.21, "ceiling_risk": true},
  /* Apple Music, YouTube -- same integrated_lufs, each platform's own gain and risk */
]}
```

そのゲインをモノラルに畳んだ後のピーク値に適用すると `+2.37` dBTP まで達し、`-1.0` dBTP のシーリングを 3.37 dB も超える計算になり、深刻な失敗に見えます。同じ計算をレポートの本当のステレオの値（`-14.11` LUFS、`-0.95` dBTP）でやり直すと、必要なゲインは `+0.1` dB ほどまで下がり、予測されるピークは `-0.84` dBTP になります。それでもシーリングは超えていますが、超過は `3.37` ではなく `0.16` dB です。ダウンミックスがこの問題を作り出しているわけではなく、小さくて本物の超過を 20 倍近くひどく見せているだけです。納品物がモノラルならダウンミックス分を補正する必要はなく、`lufs` や `mastering-streaming` はファイルをそのまま読みます。次の `take-clean.wav` を見てください。

```bash
sonare lufs take-clean.wav --json
# {"integrated_lufs": -6.0630, ...}
sonare mastering-profile take-clean.wav --json
# {"loudness": {"integrated_lufs": -6.0630, ...}, ...}
```

`mastering-streaming` を直接使うのは、納品物がモノラルのときか、この補正を自分で適用したうえでのクロスチェックとしてです。マスタリングレポート以外の場面でステレオのまま正確に測りたいときは、[Python API](../python-api.md) のステレオ用エントリポイントを使ってください。`mastering_streaming_preview_stereo` とその仲間はダウンミックスではなく両チャンネルを測ります。
:::

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
  {"name": "Spotify", "integrated_lufs": -17.57, "normalization_gain_db": 3.57, "true_peak_db": -1.21, "ceiling_risk": true},
  {"name": "Apple Music", "integrated_lufs": -17.57, "normalization_gain_db": 1.57, "true_peak_db": -1.21, "ceiling_risk": true}
]}
```

`--platforms` はファイルではなく同じ配列をその場で渡す形です。組み込みの 3 種類が納品先と一致していると信じるのではなく、モノラルのファイルで、あるいは上の補正を自分で適用したうえで、実際の納品契約の数値をどちらかに渡してください。

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
      - run: pip install libsonare
      - run: ./gate.sh master.wav report.json
```

このスクリプトが呼ぶコマンドはすべて `--json` を受け付け、失敗はすべて素の `1` ではなく[規定の終了コード](../cli.md#終了コード)で返ります。冒頭の `set -euo pipefail` があるからこそ、それが「実際に壊れた段階でジョブが失敗する」という挙動に変わります。`SONARE_LEGACY_EXIT=1` は、パイプラインの上流にまだ古い「失敗はすべて `1`」という前提を決め打ちしている呼び出し元がいる場合のためのものです。このゲートスクリプト自身は特定の終了コードで分岐しているわけではなく自前のしきい値で判定しているので、これを必要としません。

## 次に読むもの

- ゲートが落ちている理由が納品契約ではなくマスター自体にある — [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) に戻ってください。
- 同じ録音で破損チェックが何度も引っかかる — [録音素材をまとめて整音する](./recording-cleanup.md) は、納品ファイル側ではなくソース側で直す方法を扱っています。
- このロジックをシェルスクリプトではなくアプリに組み込みたい — 同じ計測は [Python API](../python-api.md) にもあり、CI スクリプトからは CLI 経由で届かないステレオ用エントリポイントも含まれています。
