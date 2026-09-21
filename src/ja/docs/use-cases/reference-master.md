---
title: リファレンス曲に寄せる
description: 自分のミックスと市販のリファレンス曲との音色・ラウドネスの差を CLI から計測して詰める手順。リファレンス一致で直せないものも明示します。
---

# リファレンス曲に寄せる

自分のミックスと、目標にしている市販曲がある。やることは「そっくりに似せる」ではなく、2 つの間にある具体的で計測可能な差を詰めることです。どれだけ大きいか、どれだけ明るいか暗いか。このページはその差を計測し、モノラルへダウンミックスする経路ではなくステレオペアのまま補正をかけ、結果が収束したことを確認します。そして線も引きます。リファレンスの EQ カーブが動かせるのは音色だけで、アレンジや演奏、ミックスバランスではありません。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- 自分のミックスとリファレンス曲との間のラウドネス差・音色差を、どちらのファイルにも手を付ける前に計測できる。
- 4 帯域のトーナルバランス偏差を読み、その形がティルトで直せる形なのか、シェルフのペアが要るのか、フルパラメトリック EQ が要るのかを見分けられる。
- モノラルへ畳んでしまうペアコマンドではなく、ステレオペアを保ったまま補正を適用できる。
- リファレンス一致で直らないものを、はっきり言える。

## 全体のスクリプト

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. リファレンス自体の特徴をつかむ。
sonare mastering-profile reference.wav --json

# 2. ミックスとリファレンスのラウドネス差を計測する。
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.referenceLoudness --json

# 3. 音色差を帯域ごとに計測する。
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.tonalBalance --json

# 4. 補正はモノラルへ畳まず、ステレオペアのまま適用する。
sonare mastering-processor mix.wav --processor eq.tilt \
  --params "tiltDb=4" -o tilted.wav --json

# 5. 両方の差が詰まったか確認する。
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.tonalBalance --json
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
```

<FlowDiagram
  title="計測、診断、補正、確認"
  direction="LR"
  :nodes="[
    { id: 'mix', label: 'mix.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'ref', label: 'reference.wav', col: 0, row: 1, variant: 'muted' },
    { id: 'profile', label: 'mastering-profile', col: 1, row: 1 },
    { id: 'loud', label: 'referenceLoudness', col: 1, row: 0 },
    { id: 'tonal', label: 'tonalBalance', col: 2, row: 0 },
    { id: 'diagnose', label: '形を読む', col: 3, row: 0, variant: 'decision' },
    { id: 'correct', label: 'eq.tilt（ステレオ）', col: 4, row: 0, variant: 'accent' },
    { id: 'out', label: 'tilted.wav', col: 5, row: 0, variant: 'success' },
    { id: 'confirm', label: '再計測', col: 5, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'ref', to: 'profile' },
    { from: 'mix', to: 'loud', label: '音声', style: 'dashed' },
    { from: 'ref', to: 'loud', label: '音声', style: 'dashed' },
    { from: 'mix', to: 'tonal', style: 'dashed' },
    { from: 'ref', to: 'tonal', style: 'dashed' },
    { from: 'loud', to: 'diagnose' },
    { from: 'tonal', to: 'diagnose' },
    { from: 'diagnose', to: 'correct' },
    { from: 'mix', to: 'correct', label: '音声', style: 'dashed' },
    { from: 'correct', to: 'out' },
    { from: 'out', to: 'confirm', style: 'dashed' },
    { from: 'ref', to: 'confirm', label: '音声', style: 'dashed' }
  ]"
  caption="診断までは計測のみです。ミックスに手を入れるのは 1 回だけで、あとで再計測することが、当てずっぽうを確定した補正に変えます。"
/>

## ステップ 1 — リファレンス自体の特徴をつかむ

比較する前に、リファレンスがそもそも何なのかを調べます。

```bash
sonare mastering-profile reference.wav --json
```

```json
{
  "bpm": 119.88, "bpm_confidence": 0.70,
  "genre_candidates": [
    { "name": "edm", "score": 1.0 },
    { "name": "pop", "score": 0.75 },
    { "name": "classical", "score": 0.65 }
  ],
  "loudness": { "integrated_lufs": -24.56, "true_peak_db": -7.62,
                "crest_factor_db": 17.95, "lra_lu": 6.07 },
  "spectral": { "centroid_hz": 2555.14, "rolloff_hz": 5531.35,
                "sub_rms_db": 11.07, "low_rms_db": 21.40, "air_rms_db": -14.28 }
}
```

これ 1 回で、テンポとジャンルの推定、そして狙っているファイルのラウドネスとスペクトル形状が手に入ります。[マスタリングアシスタント](../mastering-assistant.md)が自分のミックスをプロファイリングするのと同じフィールドです。比較に入る前にここを読んでください。このリファレンスは統合ラウドネス -24.56 LUFS で、配信基準からすると控えめです。あとで「本当にこのラウドネスまで追うか、音色だけ追うか」を決めるときに効いてきます。

この `loudness` のフィールドのうち 3 つは、下のメーターが再生中のクリップに対して報告するものと同じです。インテグレーテッド LUFS は次のステップでミックスと比較する 1 つの数値、True Peak は上限、LRA はプログラム全体でラウドネスがどれだけ動くかです。LRA の広いリファレンスは、1 つのインテグレーテッド値の裏に大きな動きを隠しています。その値だけを合わせても、ミックスが同じように動くようにはなりません。

<SonareDemo id="loudness-meter" />

## ステップ 2 — ラウドネス差を計測する

```bash
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
```

```json
{ "gain_to_match_db": -1.70, "reference_lufs": -24.56, "source_lufs": -22.86 }
```

`gain_to_match_db` は、ソースをリファレンスのラウドネスへ着地させるゲインです。`source_lufs + gain_to_match_db = reference_lufs` という関係にあります。ここではミックスがリファレンスより 1.7 dB 大きいので、マイナスの値でそこまで下げることになります。

::: tip ラウドネスを合わせることと、目標を決めることは別
この数値が言っているのは「ミックスとリファレンスは 1.7 dB 違う」であって、「-24.56 LUFS でマスタリングしろ」ではありません。時代やプラットフォームの違うリファレンスは、いまの配信目標から外れた位置にあることがあります。`reference_lufs` をそのまま着地点にする前に[配信ターゲット](../glossary/mastering/delivery-targets.md)を確認してください。
:::

## ステップ 3 — 音色差を帯域ごとに計測する

```bash
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.tonalBalance --json
```

```json
{
  "bands": [
    { "low_hz": 20,    "high_hz": 250,   "reference_db": 14.40,  "source_db": 16.39,  "deviation_db": 2.00 },
    { "low_hz": 250,   "high_hz": 2000,  "reference_db": -1.62,  "source_db": -1.73,  "deviation_db": -0.11 },
    { "low_hz": 2000,  "high_hz": 8000,  "reference_db": -14.36, "source_db": -16.33, "deviation_db": -1.97 },
    { "low_hz": 8000,  "high_hz": 20000, "reference_db": -14.54, "source_db": -16.54, "deviation_db": -2.00 }
  ]
}
```

`deviation_db` は `source_db - reference_db` です。プラスならその帯域でミックスのほうが出ているということです。表を上から下へ読むと形ははっきりしています。ミックスは低域が約 2 dB 出すぎ、ローミッドはほぼ揃っていて、2 kHz より上は全体に約 2 dB 足りません。これは 4 つの別々の問題ではなく、1 つの問題が 4 つの窓越しに見えているだけです。

4 帯域より細かく見たい場合は、`match.tonalBalanceLogBands` が同じ偏差を対数間隔の 32 帯域で返します。`match.matchEqCurve` は帯域サマリーではなく周波数応答の補正カーブそのものを返します。[リファレンス一致](../glossary/mastering/reference-match.md)のブラウザデモが直接使っているのはこの形です。

## ステップ 4 — ティルトか、シェルフか、フル EQ か

片端でプラス、もう片端でマイナスへなめらかに振れ、ゼロを一度だけ横切る偏差は**ティルト**です。1 つのピボットを境に、低域側と高域側が逆方向に動く形です。それはまさに [`eq.tilt`](../mastering-processors.md) の仕事で、`tiltDb` と `pivotHz`（既定 1000 Hz）の 1 つまみを [`mastering-processor`](../mastering-processors.md) 経由で適用します。

ティルト量は両端の帯域から読み取れます。低域は約 -2 dB、高域は約 +2 dB 必要なので、`tiltDb ≈ (低域の偏差) - (高域の偏差) = 2.00 - (-2.00) = 4.0` です。これは出発点であって最終解ではありません。ステップ 6 で計算を信じるのではなく確認するのが、この手順全体の要点です。

ここで使える処理は他に 2 つあり、それぞれ違う偏差の形に向いています。

- **`eq.shelving`** は独立したローシェルフとハイシェルフを持ち、それぞれ別のコーナー周波数とゲインを設定できます。低域側と高域側が 1 つの妥当なピボットを共有しないとき、たとえば低域は 250 Hz 以下を削りたいが持ち上げは 1 kHz ではなく 8 kHz より上から始めたいときに向きます。この素材に対して（`lowFrequencyHz=250, lowGainDb=-2, highFrequencyHz=2000, highGainDb=2`）を実行すると、差は 0.27 / 0.12 / -0.13 / -0.001 dB まで詰まりました。悪くはありませんが、2 つのシェルフでは連続した 1 本の傾斜を正確には再現できないぶん、ティルトほどきれいには収まりません。
- **`eq.equalizer`** は最大 24 バンド（`band0.*` から `band23.*`）を持つフルパラメトリック EQ で、各バンドをピーク・シェルフ・ティルトのいずれかに個別に設定できます。偏差がティルト型でもシェルフ型でもない、たとえば 4 帯域のうちの 1 つの中に狭いディップやピークが埋まっているような形のとき、1 つのピボットでも 2 つのシェルフでも切り出せないので、ここに手を伸ばします。

この素材の偏差はきれいなティルト型なので、`eq.tilt` が適切な選択であり、このページもそれで通します。

## ステップ 5 — ステレオペアのまま適用する

```bash
sonare mastering-processor mix.wav --processor eq.tilt \
  --params "tiltDb=4" -o tilted.wav --json
```

```json
{ "processor": "eq.tilt", "input_lufs": -19.61, "output_lufs": -21.31,
  "applied_gain_db": 0.0, "sample_rate": 48000, "output": "tilted.wav",
  "stereo": true }
```

確認すべきは `"stereo": true` です。`mastering-processor` はソースファイル自体のチャンネル数からエントリーポイントを決めます。ステレオの `mix.wav` なら、`eq.tilt` に限らずどのソロプロセッサでも自動的にステレオ経路を通ります。フラグを覚えておく必要はありません。

::: danger `mastering-pair-processor` はモノラルへ畳む。`mastering-processor` は畳まない
ペア系コマンドは別のコード経路で、無条件にダウンミックスします。

```bash
sonare mastering-pair-processor mix.wav --processor match.applyMatchEq \
  --reference reference.wav -o matched.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"processor": "match.applyMatchEq", "input_lufs": -22.86, "output_lufs": -24.40, ...}
```

`matched.wav` は `channels: 1` で出てきます。`matched.wav` に対して `match.tonalBalance` を測り直すと、カーブフィット自体の精度は高く 0.29 / -0.02 / -0.001 / -0.07 dB まで収束します。ただしその精度と引き換えにモノラルファイルになっています。

CLI 上で `match.applyMatchEq` を使うのは、納品物が本当にモノラルのとき、たとえばポッドキャストや音声トラックのときです。ステレオの納品物では、上のように形の合った単体プロセッサを `mastering-processor` 経由で使うか、ライブラリを直接叩きます。`mastering_pair_process()` は 1 回の呼び出しにつき 1 本のフラット配列しか取らないので、左チャンネルをリファレンスの左チャンネルに対して 1 回、右チャンネルを右チャンネルに対してもう 1 回呼ぶと、[リファレンス一致](../glossary/mastering/reference-match.md)のブラウザデモと同じやり方で、チャンネルを保ったままフィット済みのカーブが得られます。呼び出しの形は [Python API](../python-api.md) を参照してください。
:::

## ステップ 6 — 収束を確認する

```bash
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.tonalBalance --json
# 4 帯域すべての deviation_db が 0.00

sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
# {"gain_to_match_db": 0, "reference_lufs": -24.56, "source_lufs": -24.56}
```

この素材では、音色の補正がラウドネスの差まで一緒に詰めてくれました。ただしこれはこの素材固有の事情であって、一般則ではありません。ここでの `reference.wav` は `mix.wav` にたった 1 つの編集、EQ ティルトを掛けただけの差分です。ラウドネスの計測カーブは周波数に対して平坦ではないため、スペクトルを傾けるだけでラウドネス値も一緒に動きます。その 1 つの編集を打ち消したことで、両方の効果が同時に解消されました。一般には音色の補正とラウドネスの補正は独立な操作で、正しい順番は「音色を補正してから、その結果に対して `match.referenceLoudness` を測り直す」ことです。手つかずのミックスに対してではありません。音色の補正自体が値を動かすからです。

## リファレンス一致で直せないもの

::: warning 合わせたカーブが動かすのは音色であって、判断ではない
このページで扱っているのは EQ とゲインの調整だけです。アレンジ、演奏、ミックスバランスにはいっさい触れません。サビが持ち上がらない、ダブリングしたギターがボーカルを埋めている、アレンジがリファレンスより薄い。そうした問題は、音色を合わせても直りません。同じ薄いミックス、同じ埋もれたボーカルが、少し明るくなるだけです。[リファレンス一致](../glossary/mastering/reference-match.md)がはっきり述べているとおり、リファレンスは較正するものであって、移植するものではありません。マッチングが薄いトラックを密度の高いトラックへ寄せすぎて、そのトラック自身の個性が失われ始めたら、直すのはマッチングを強めることではなく弱めることです。
:::

## 次に読むもの

- この補正が組み込まれる先の全体像 — [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md)。
- 最終的なラウドネスと True Peak を合否判定に変える — [納品前チェックを CI で回す](./delivery-check.md)。
- ここで名前が出た各プロセッサの判断ルール — [マスタリングアシスタント](../mastering-assistant.md)と[マスタリングプロセッサ](../mastering-processors.md)。
