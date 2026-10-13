---
title: 練習用トラックを作る
description: 1 本の録音から、ピッチを保ったままのスロー版、キーを移した版、倍音成分と打撃成分の分離、コード・ビート・セクションのチャートまで、CLI だけで練習キットを作ります。
---

# 練習用トラックを作る

耳コピをしているとき、必要なのはマルチトラックではありません。ピッチを保ったままのスロー版、自分の楽器や声域に合わせて移調した版、グルーヴだけまたはハーモニーだけで練習できる版、そして演奏しながら読める資料です。このページでは、その 4 つを `sonare` だけで 1 本の録音から作ります。ステップ 1 から 3 には Node と Python のタブもあります。ライブラリの呼び出しはモノラルのサンプル配列を受け取って配列を返すので、ファイルは書き出さず、後述のステレオに関する警告も出ません。ステップ 1 のタブで `song.wav` を読み込み、ステップ 2 と 3 ではその `samples`、`sampleRate`、`harmonic` を使い回します。

ここで扱うのは楽器ごとの分離ではありません。それには実際のステムかソース分離モデルが必要です。倍音成分／打撃成分の分離は、1 本のミックスをピッチのある成分とリズムの成分の 2 つに分けるだけで、バンド全体からベースラインだけを取り出してくれるわけではありません。それでも、グルーヴだけ、あるいはコードだけをループさせて練習するには十分で、録音を相手に練習するときに必要なことの大半をカバーします。

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）で `sonare` コマンドが入ります。Node のタブには `npm install @libraz/libsonare`（Node.js 22.12 以降）が必要です。
- **録音 1 本（`song.wav`）:** 曲の WAV か MP3 で、モノラルでもステレオでも、一般的なサンプルレートなら何でもかまいません。どのコマンドもステレオをモノラルにまとめるため（後述）、練習用ファイルはモノラルで書き出されます。
- **このページの数値**は、[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md) が 6 秒のテスト用ステム 4 本から書き出す 11.5 秒（553053 フレーム）、48 kHz ステレオの `mix.wav` を `song.wav` にコピーして測ったものです。ステムは 6 秒で終わり、その後はリバーブとディレイのテールです。自分の曲では別の数値が出ます。
:::

## このページで身につくこと

このページを読むと、次のことができるようになります。

- CLI から、ピッチを保ったスロー版と移調版を録音から作れる。
- ミックスを倍音成分と打撃成分に分割し、どちらか一方だけを相手に練習できる。
- 同じファイルからコード・ビート・ダウンビート・セクションのチャートを生成し、どの数値を信じるべきか判断できる。
- 分離してから伸縮する順序を守り、逆にするとなぜ分離結果が気付かないうちに劣化するのかを説明できる。

## 全体のスクリプト

以下がこの作業の全体です。耳コピ対象の録音である `song.wav` に対して実行します。まず実行し、そのうえで各段階が何をしていて、なぜこの順序なのかを読んでください。

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. 倍音成分（ピッチのある成分）と打撃成分（リズムの成分）に分割する。
#    他の処理より先に行う理由はステップ1を参照。
sonare hpss song.wav -o kit --json

# 2. ピッチを保ったスロー版を作る。全体・ハーモニーのみ・グルーヴのみ。
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
sonare time-stretch kit_harmonic.wav --rate 0.75 -o kit_harmonic_slow.wav --json
sonare time-stretch kit_percussive.wav --rate 0.75 -o kit_percussive_slow.wav --json

# 3. 移調版を作る。録音とは違う音域の楽器や声のために。
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json

# 4. チャートを作る。キー、トライアドのみのコード、ビート、ダウンビート、セクション。
sonare key song.wav --json > kit_key.json
sonare chords song.wav --triads-only --json > kit_chords.json
sonare beats song.wav --json > kit_beats.json
sonare downbeats song.wav --json > kit_downbeats.json
sonare sections song.wav --json > kit_sections.json
```

<FlowDiagram
  title="1 本の録音から練習キットまで"
  direction="LR"
  :nodes="[
    { id: 'song', label: '録音 (song.wav)', col: 0, row: 2, variant: 'muted' },
    { id: 'hpss', label: 'hpss', col: 1, row: 0, variant: 'accent' },
    { id: 'harmonic', label: '倍音成分', col: 2, row: 0 },
    { id: 'percussive', label: '打撃成分', col: 2, row: 1 },
    { id: 'stretchH', label: 'time-stretch', col: 3, row: 0, variant: 'accent' },
    { id: 'stretchP', label: 'time-stretch', col: 3, row: 1, variant: 'accent' },
    { id: 'slowH', label: '倍音成分（スロー）', col: 4, row: 0, variant: 'success' },
    { id: 'slowP', label: '打撃成分（スロー）', col: 4, row: 1, variant: 'success' },
    { id: 'stretchFull', label: 'time-stretch', col: 1, row: 2, variant: 'accent' },
    { id: 'slowFull', label: '全体ミックス（スロー）', col: 2, row: 2, variant: 'success' },
    { id: 'shift', label: 'pitch-shift', col: 1, row: 3, variant: 'accent' },
    { id: 'transposed', label: '移調したミックス', col: 2, row: 3, variant: 'success' },
    { id: 'chart', label: 'キー・コード・ビート・セクション', col: 1, row: 4, variant: 'accent' },
    { id: 'chartOut', label: '練習用チャート', col: 2, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'song', to: 'hpss' },
    { from: 'hpss', to: 'harmonic' },
    { from: 'hpss', to: 'percussive' },
    { from: 'harmonic', to: 'stretchH' },
    { from: 'percussive', to: 'stretchP' },
    { from: 'stretchH', to: 'slowH' },
    { from: 'stretchP', to: 'slowP' },
    { from: 'song', to: 'stretchFull' },
    { from: 'stretchFull', to: 'slowFull' },
    { from: 'song', to: 'shift' },
    { from: 'shift', to: 'transposed' },
    { from: 'song', to: 'chart' },
    { from: 'chart', to: 'chartOut' }
  ]"
  caption="hpss は加工前の録音に対して実行し、その出力だけを time-stretch にかけるため、分離結果はきれいなまま保たれます。"
/>

このスクリプトのどのコマンドも、標準エラー出力に `warning: 2-channel input is downmixed to mono by this CLI command` を出します。`hpss`、`time-stretch`、`pitch-shift`、`key`、`chords`、`beats`、`downbeats`、`sections` はすべて、モノラルの 1 チャンネルで解析または再合成を行うためです。練習キットとしてはこれが正しいトレードオフです。目的はミックスの納品ではなく曲を覚えることなので、この警告は直すべき問題ではなく、想定どおりに動いている印と捉えてください。チャンネルを保ったまま処理したい場合は、[ステレオとモノラルの扱い](../cli.md#ステレオとモノラルの扱い)にどのコマンドがペアを保つかがまとまっています。

## ステップ 1 — 伸縮する前に分離する

`hpss` は信号を倍音成分（ピッチのある素材。コード、ベース、メロディ）と打撃成分（過渡的な素材。ドラム、弾いた瞬間のアタック）に分けます。

::: code-group

```bash [CLI]
sonare hpss song.wav -o kit --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { Audio, hpss, init } from '@libraz/libsonare';

await init();
// Audio.fromMemory は WAV と MP3 をデコードし、CLI と同じくステレオをモノラルにまとめる
const song = Audio.fromMemory(new Uint8Array(readFileSync('song.wav')));
const samples = song.data;
const sampleRate = song.sampleRate;
const { harmonic, percussive } = hpss(samples, sampleRate);
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# Audio.from_file は WAV と MP3 をデコードし、CLI と同じくステレオをモノラルにまとめる
with Audio.from_file("song.wav") as song:
    samples, sample_rate = song.data, song.sample_rate
split = sonare.hpss(samples, sample_rate)
harmonic, percussive = split.harmonic, split.percussive
```

:::

```json
{"length": 553053, "sample_rate": 48000,
 "harmonic_mean_abs": 0.026357, "percussive_mean_abs": 0.006618,
 "harmonic": "kit_harmonic.wav", "percussive": "kit_percussive.wav"}
```

`harmonic_mean_abs` と `percussive_mean_abs` は、各成分のサンプル値の絶対値をファイル全体で平均したレベルです。ミックスが 2 つの成分にどう分かれたかはわかりますが、分離の音質を表す値ではありません。

::: tip `-o` はファイル名ではなくプレフィックス
`-o kit` は `kit_harmonic.wav` と `kit_percussive.wav` の 2 ファイルを書き出します。この値はどちらかのファイル名ではなく、両方の出力名の元になるプレフィックスです。`-o kit.wav` を渡すと `kit.wav_harmonic.wav` になります。これはエラーにはなりませんが、たいていの人が意図した結果ではありません。
:::

下のデモは、バンドのフレーズに同じ分離を行います。倍音成分は持続するラインを、打撃成分はアタックを受け持ちます。

<SonareDemo id="hpss-separation" />

既定値（`--n-fft 2048`、`--hop-length 512`、2 成分をブレンドするソフトマスク）は妥当な出発点です。練習相手として分離のにじみが気になるときは、耳で聴き比べながら 2 つのオプションを試してみてください。`--hard-mask` は各時間-周波数セルを、ブレンドせずに支配的なほうへ完全に割り当てます。このファイルでは `harmonic_mean_abs: 0.026357, percussive_mean_abs: 0.006618` から `harmonic_mean_abs: 0.028465, percussive_mean_abs: 0.005901` へ変化しました。両方を聴き比べてください。ハードマスクでは成分間のにじみは減りますが、打撃成分の音はより人工的になります。`--kernel-harmonic` と `--kernel-percussive` は分離の土台になるメディアンフィルタのカーネル幅を広げるもので、サステインの長い音が多い素材で分離を鋭くできます。

次は順序の話です。`song.wav`（伸縮も移調もしていない、録音されたままのファイル）に対して `hpss` を実行するのは、好みの問題ではありません。タイムストレッチは短い重なり合った解析フレームを再配置する仕組みで、これは隣接フレームへ過渡成分をにじませます。`hpss` の打撃成分検出器が探しているのは、まさにそのにじみによって壊される短く鋭いエネルギーです。隣のフレームまで広がったアタックは持続音のようにも見えるため、その一部が倍音成分の側に入ります。2 つの順序を耳で比べてみてください。

```bash
sonare hpss song.wav -o order_a --json
sonare time-stretch song.wav --rate 0.75 -o order_b_slow.wav --json
sonare hpss order_b_slow.wav -o order_b --json
```

`order_a_percussive.wav`（比べやすいように後から伸縮してもかまいません）と `order_b_percussive.wav` を聴き比べます。注目するのはドラムのアタックと、`order_b_harmonic.wav` に取り残されたドラムの鋭さです。にじんだアタックを分離がもう打撃音と認識できないとき、その音はそこへ行きます。倍音成分がどちらの順序でも保たれるのは、持続するピッチ素材こそ[フェイズボコーダー](../glossary/editing/phase-vocoder-stretch.md)が保つように設計された対象だからです。

::: tip JSON のレベルでは判定できない理由
先に伸縮すると `percussive_mean_abs` は `0.006618` から `0.005323` に下がります。ただし、これはにじみの証拠になりません。0.75 倍に伸ばすと同じ打撃音が 3 分の 1 長い時間に散らばるので、過渡成分が完全に残っていても、ファイル全体の平均は下がります。順序の良し悪しはアタックを聴いて判断してください。
:::

::: warning 分離は必ず最初に
一度伸縮または移調したファイルに `hpss` をかけると、すでに打撃成分らしさの一部を失った打撃成分が返ってきます。必ず加工前の録音を分離してから、出力された 2 ファイルをそれぞれ伸縮・移調してください。上のスクリプトはそうなっています。
:::

## ステップ 2 — ピッチを保ったスロー版

::: code-group

```bash [CLI]
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
```

```typescript [Node]
import { timeStretch } from '@libraz/libsonare';

// samples、sampleRate、harmonic はステップ 1 のもの
const slowFull = timeStretch(samples, sampleRate, 0.75);
const slowHarmonic = timeStretch(harmonic, sampleRate, 0.75); // harmonic はステップ 1 のもの
```

```python [Python]
# samples、sample_rate、harmonic はステップ 1 のもの
slow_full = sonare.time_stretch(samples, sample_rate, rate=0.75)
slow_harmonic = sonare.time_stretch(harmonic, sample_rate, rate=0.75)  # harmonic はステップ 1 のもの
```

:::

```json
{"length": 737404, "sample_rate": 48000, "duration": 15.362583333333333, "rate": 0.75, "output": "kit_full_slow.wav"}
```

`--rate` は再生速度の倍率です。実測がそれを裏づけています。入力は 11.522 秒、`--rate 0.75` の出力は 15.363 秒で、元の 4 分の 3 の速さで、より長くなっています。`--rate` が 1 より大きいと速く短くなり、1 より小さいと遅く長くなります。どちらの場合もピッチは変わりません。単に再生を遅くするのではなくこちらを使う理由はそこにあります。

短いクリップで同じ変化を聴けます。テンポを落としたときの、タイミングとアタックの明瞭さの変化に耳を向けてください。

<SonareDemo id="time-stretch" />

同じコマンドを `kit_harmonic.wav` と `kit_percussive.wav` に対して実行すれば、スローなハーモニーのみのトラックとスローなグルーヴのみのトラックが手に入ります。操作自体は同じで、対象を元のミックスではなくステップ 1 の出力に変えているだけです。今練習している側だけテンポを落とせます。

伸縮にはどの倍率でも代償があり、`--rate` が 1.0 から離れるほどそれは大きくなります。フェイズボコーダーが埋めなければならない距離が広がるためで、これは[Editing DSP](../editing-dsp.md#実用上の注意)で説明されているピッチシフトのアーティファクトと同じ、短い重なり合ったフレームという仕組みによるものです。`--rate 0.75` での練習はほとんど代償がありませんが、`--rate 0.5` まで落とすとエンジンが埋める隙間が倍になり、過渡成分の多い素材ではっきり柔らかく輪郭のぼやけた音になります。まずはそのフレーズを弾ける最も緩やかな倍率から始め、それでも無理なときだけさらに遅くしてください。

## ステップ 3 — 移調版を作る

::: code-group

```bash [CLI]
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json
```

```typescript [Node]
import { pitchShift } from '@libraz/libsonare';

// samples、sampleRate はステップ 1 のもの
const down2 = pitchShift(samples, sampleRate, -2);
```

```python [Python]
# samples、sample_rate はステップ 1 のもの
down2 = sonare.pitch_shift(samples, sample_rate, semitones=-2)
```

:::

```json
{"length": 553053, "sample_rate": 48000, "duration": 11.5219375, "semitones": -2.0, "output": "kit_down2.wav"}
```

長さは保たれます。11.522 秒入れて 11.522 秒出てきて、どちらも 553053 サンプルです。変わるのはピッチだけで、ここでは半音 2 つ分下がっています。録音が歌い手の声域や固定チューニング楽器のキーから外れているときに使う機能です。

`--rate` を大きくすると代償が増えるのと同じ仕組みが `--semitones` にも働き、しかも全体ミックスと単一楽器とでは効き方が違います。[Editing DSP](../editing-dsp.md#実用上の注意)では単一の声について、シフト幅が解析フレームで表現できる範囲を超えると「水っぽい」ロボットのような質感になると説明されています。全体ミックスでは、同時に鳴っている倍音的な音源すべてが同じ量だけピッチを動かされるため、それぞれのにじみやうなりが打ち消し合うのではなく積み重なります。単独のギターならほとんど気にならないシフトでも、バンド全体にかけると目立つことがあります。全体ミックスに対する `--semitones` は控えめにし、大きくシフトしたいときは分離した倍音成分やステムがあればそちらに対して行ってください。

::: warning 移調した声はキャラクターが変わる
`pitch-shift` は音声をタイムストレッチしてからリサンプリングするので、声をその人の声らしく聞かせる共鳴である[フォルマント](../glossary/editing/voice-formant.md)もピッチと一緒に動きます。下げた歌声は大きく暗く、上げた歌声は小さく細く聞こえます。練習用トラックなら音が取れれば十分なので、たいていは問題になりません。声のキャラクターを保つ必要があるときは、[Editing DSP](../editing-dsp.md) のフォルマント関連の操作を参照してください。
:::

## ステップ 4 — チャートを読む

以下の解析コマンドは、すべて加工前の `song.wav` に対して実行します。分割やスロー版を必要としないため、このステップはステップ 1〜3 と並行して実行できます。

```bash
sonare key song.wav --json
```

```json
{"root": 7, "mode": 0, "confidence": 0.946937084197998, "name": "G major"}
```

G major、信頼度 0.947 です。ただし、これはテスト用ステムを書いたときのキーではありません。コードは A、F、C、G で、演奏される音に F♯ はひとつもありません。ボーカルのステムは上の倍音が強いブザーのような音で、B の第 3 倍音が F♯、A の第 5 倍音が C♯ になります。キー検出が見るのは書かれた音符ではなく音に含まれるピッチクラスなので、これらの倍音がミックスを G major の側へ傾けます。`stems/gtr.wav` だけを解析すると C major（0.954）です。信頼度が表すのは、ひとつのキーのプロファイルがほかのプロファイルをどれだけはっきり上回ったかであり、答えが音楽的に正しいかどうかではありません。実際の録音でも、信じる前にコードと照らし合わせてください。`root` と `mode` が何を表すかは[Key Detection](../glossary/analysis/key-detection.md)を参照してください。

```bash
sonare chords song.wav --triads-only --json
```

```json
{"progression": "A - Am - C - Em - G - D# - Em - G - Em - G - N.C.", "count": 11,
 "chords": [
   {"name": "A", "start": 0.0, "end": 1.525, "confidence": 0.823},
   {"name": "Am", "start": 1.525, "end": 3.019, "confidence": 0.784},
   {"name": "C", "start": 3.019, "end": 3.520, "confidence": 0.731},
   {"name": "Em", "start": 3.520, "end": 4.523, "confidence": 0.779},
   {"name": "G", "start": 4.523, "end": 6.027, "confidence": 0.815},
   {"name": "D#", "start": 6.027, "end": 7.029, "confidence": 0.655},
   {"name": "Em", "start": 7.029, "end": 7.531, "confidence": 0.643},
   {"name": "G", "start": 7.531, "end": 8.032, "confidence": 0.858},
   {"name": "Em", "start": 8.032, "end": 8.533, "confidence": 0.704},
   {"name": "G", "start": 8.533, "end": 9.035, "confidence": 0.861},
   {"name": "N.C.", "start": 9.035, "end": 11.522, "confidence": 0.0}
 ]}
```

演奏しながら読むチャートには、`--triads-only` を常に付けておくとよいでしょう。このオプションなしだと、最初の 6 秒は `A - A7b9 - Amaj7 - Am - Cmaj7 - Gmaj9 - G7b9` という、和声的には精密でも密度の高い 7 つのコードで返ってきます。`--triads-only` なら `A - Am - C - Em - G` の、テンポの中で読める 5 つになります。`--min-duration` は、検出器が一瞬だけ 2 つのコードの間で揺れ動くときに試してみてください。指定した値より短い区間を隣に統合してくれます。

ビートとダウンビートは小節の位置を示します。

```bash
sonare beats song.wav --json
sonare downbeats song.wav --json
```

```json
[0.534, 1.022, 1.533, 2.020, 2.531, 3.042, 3.529, 4.040, 4.528, 5.039, 5.526, 6.037, 6.548]
[1.533, 3.529, 5.526]
```

下のデモで、検出器がビートの並びから小節頭だけを選び出す様子を確認できます。ダウンビートはビートのうち小節の先頭に当たるものです。

<SonareDemo id="downbeat-tracking" />

3 つのダウンビートは 1.997 秒ずつ離れています。これは、この録音の実測テンポである約 120 BPM（`sonare bpm song.wav --json` は `{"bpm": 120.04}` を返します）での 4 拍分にあたり、上のビート間隔（約 0.5 秒）とも一致します。最初のダウンビートより前の区間は不完全な小節です。合わせて弾くときに感じる最初のダウンビートは 0.0 秒ではなく 1.533 秒です。

その計算が下のグリッドです。120 BPM の 4/4 に設定すると、読み出しは 1 拍 0.5 秒、1 小節 2.0 秒を示し、いま報告されたビートとダウンビートの間隔と一致します。60 までドラッグすると、同じ 6 秒に入る小節は半分になります。これが次のヒントで注意しているハーフタイムの読みで、その数値を採用した場合に練習で鳴らすクリックの速さです。

<SonareDemo id="tempo-grid" />

::: tip メトロノームを設定する前に拍のレベルを確かめる
テンポの推定値は、どのパルスを拍と呼ぶかの選択でもあります。8 分音符が一定で刻まれていると、トラッカーには筋の通った答えが複数生まれます。半分、倍、あるいは同じグルーヴを付点で読む解釈です。このクリップでは `sonare mastering-profile song.wav --json` も同じ音声を 119.9 BPM と読むので、拍のレベルの曖昧さはありませんが、ほかの素材では 2 つのコマンドが別のレベルに落ち着くことがあります。確定する前に、報告されたビート時刻に合わせて 1 小節数えてみてください。その数値が体感と噛み合わないなら、ずれているのはタイミングではなく拍のレベルです。
:::

```bash
sonare sections song.wav --json
```

```json
{"count": 2, "sections": [
  {"type": "unknown", "start": 0.0, "end": 6.060, "energy": 1.0, "confidence": 0.0},
  {"type": "outro", "start": 6.060, "end": 11.522, "energy": 0.0, "confidence": 0.900}
]}
```

ネイティブ CLI の JSON には `form` キーも含まれます。`--min-duration`（既定値 4.0 秒）は検出器が報告する最短のセクション長を決めます。この短いクリップでは結果は変わりませんが、実際の楽曲では 4 小節のブリッジが前後のヴァースへ吸収されてしまうのを防ぎます。セクションの種類が何を意味するかは[Section Structure](../glossary/analysis/section-structure.md)を参照してください。ここでの `unknown` は、検出器が「終わりではない」以上の強いラベルを見つけられなかったというだけで、大半が 1 つのグルーヴでできた 11 秒のクリップとしては妥当な結果です。

まとめると、このチャートは次のように読めます。G major、120 BPM で 4 拍子、小節はダウンビートの 1.533 秒、3.529 秒、5.526 秒から始まります。テスト用ステムは 1.5 秒ごとに 4 つのコードを巡り、コードの境界 1.525、3.019、4.523、6.027 秒はその切り替わりに重なります。ただし 2 つ目のラベルは、ベースが弾いている `F` ではなく `Am` と読まれています。演奏は 6 秒で終わるので、拍のリスト末尾の 6.037 秒と 6.548 秒、およびそれ以降はこのミックスのリバーブとディレイのテールです。6.03 秒からの `D#`、その後の `Em` と `G`、6.06 秒からの `outro` セクションは、演奏された音ではなく鳴り残ったテールから読み取ったもので、9.03 秒からの `N.C.`（コードなし、信頼度 0.0）は検出器がテールの解釈を諦めた結果です。どんな録音でも、演奏が終わった後に報告されるコードやセクションは同じように疑ってかかってください。

::: info コードチャートは読解の補助であって、正解そのものではありません
すべてのコードオブジェクトが `confidence` を持つのはまさにこのためです。この進行の中で最も信頼度が低いのは 7.03 秒からの `Em`（0.643）で、そのすぐ前の `D#`（0.655）がそれに続きます。どちらもはっきりした和声の読み取れないテールの中にあり、検出器はそれでも 1 つの読み方に決めなければなりません。信頼度の低いコードは「バグ」ではなく「ここは耳で確認する場所」として読んでください。
:::

## 次に読むもの

- 練習キットの元になるミックスをこれから作る段階なら、[CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md)は同じシェルスクリプトの発想をステムに対して適用したものです。
- 倍音成分／打撃成分の分割やチャート用データをスクリプトではなくアプリに組み込みたいなら、[CLI リファレンス](../cli.md)と[Editing DSP](../editing-dsp.md)が同じ処理を Python / JavaScript の API 経由で示しています。
- チャートに出てくるコード・ビート・キーの数値の背景は、[Chord Recognition](../glossary/analysis/chord-recognition.md)、[Beats and Downbeats](../glossary/analysis/beats-downbeats.md)、[Key Detection](../glossary/analysis/key-detection.md)にまとまっています。
