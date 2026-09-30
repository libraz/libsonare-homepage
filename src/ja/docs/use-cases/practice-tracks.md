---
title: 練習用トラックを作る
description: 1 本の録音から、ピッチを保ったままのスロー版、キーを移した版、倍音成分と打撃成分の分離、コード・ビート・セクションのチャートまで — CLI だけで練習キットを作ります。
---

# 練習用トラックを作る

耳コピをしているとき、必要なのはマルチトラックではありません。ピッチを保ったままのスロー版、自分の楽器や声域に合わせて移調した版、グルーヴだけまたはハーモニーだけで練習できる版、そして演奏しながら読める資料です。このページでは、その 4 つを `sonare` だけで 1 本の録音から作ります。

ここで扱うのは楽器ごとの分離ではありません。それには実際のステムかソース分離モデルが必要です。倍音成分／打撃成分の分離は、1 本のミックスをピッチのある成分とリズムの成分の 2 つに分けるだけで、バンド全体からベースラインだけを取り出してくれるわけではありません。それでも、グルーヴだけ、あるいはコードだけをループさせて練習するには十分で、録音を相手に練習するときに必要なことの大半をカバーします。

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

`hpss` は信号を倍音成分（ピッチのある素材 — コード、ベース、メロディ）と打撃成分（過渡的な素材 — ドラム、弾いた瞬間のアタック）に分けます。

```bash
sonare hpss song.wav -o kit --json
```

```json
{"length": 494549, "sample_rate": 48000,
 "harmonic_energy": 0.03774, "percussive_energy": 0.004027,
 "harmonic": "kit_harmonic.wav", "percussive": "kit_percussive.wav"}
```

::: tip `-o` はファイル名ではなくプレフィックス
`-o kit` は `kit_harmonic.wav` と `kit_percussive.wav` の 2 ファイルを書き出します。この値はどちらかのファイル名ではなく、両方の出力名の元になるプレフィックスです。`-o kit.wav` を渡すと `kit.wav_harmonic.wav` になります。これはエラーにはなりませんが、たいていの人が意図した結果ではありません。
:::

既定値（`--n-fft 2048`、`--hop-length 512`、2 成分をブレンドするソフトマスク）は妥当な出発点です。練習相手として分離のにじみが気になるときは、耳で聴き比べながら 2 つのオプションを試してみてください。`--hard-mask` は各時間-周波数セルを、ブレンドせずに支配的なほうへ完全に割り当てます。このファイルでは `harmonic_energy: 0.03774, percussive_energy: 0.004027` から `harmonic_energy: 0.039008, percussive_energy: 0.002892` へ変化しました。相互のにじみは減りますが、打撃成分の音はより人工的になります。`--kernel-harmonic` と `--kernel-percussive` は分離の土台になるメディアンフィルタのカーネル幅を広げるもので、サステインの長い音が多い素材で分離を鋭くできます。

次は順序の話です。`song.wav` — つまり伸縮も移調もしていない、録音されたままのファイル — に対して `hpss` を実行するのは、好みの問題ではありません。タイムストレッチは短い重なり合った解析フレームを再配置する仕組みで、これは隣接フレームへ過渡成分をにじませます。`hpss` の打撃成分検出器が探しているのは、まさにそのにじみによって壊される短く鋭いエネルギーです。この 2 つの操作を逆順で行うと、その劣化を数値で確認できます。

```bash
sonare hpss song.wav -o order_a --json
sonare time-stretch song.wav --rate 0.75 -o order_b_slow.wav --json
sonare hpss order_b_slow.wav -o order_b --json
```

先に分離した場合は `percussive_energy: 0.004027`。先に伸縮してから分離すると `percussive_energy: 0.003373` — 約 16% 低くなりました。一方 `harmonic_energy` はほとんど動きません（`0.03774` に対して `0.037546`）。倍音成分がどちらの順序でも保たれるのは、持続するピッチ素材こそフェイズボコーダーが得意とする対象だからです。打撃成分がそうならないのは、そのエネルギーがフェイズボコーダーのにじませる過渡成分そのものに宿っているからです。

::: warning 分離は必ず最初に
一度伸縮または移調したファイルに `hpss` をかけると、すでに打撃成分らしさの一部を失った打撃成分が返ってきます。必ず加工前の録音を分離してから、出力された 2 ファイルをそれぞれ伸縮・移調してください。上のスクリプトはそうなっています。
:::

## ステップ 2 — ピッチを保ったスロー版

```bash
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
```

```json
{"length": 659399, "sample_rate": 48000, "duration": 13.737479166666667, "rate": 0.75, "output": "kit_full_slow.wav"}
```

`--rate` は再生速度の倍率です。実測がそれを裏づけています。入力は 10.303 秒、`--rate 0.75` の出力は 13.737 秒 — 元の 4 分の 3 の速さで、より長くなっています。`--rate` が 1 より大きいと速く短くなり、1 より小さいと遅く長くなります。どちらの場合もピッチは変わりません。単に再生を遅くするのではなくこちらを使う理由はそこにあります。

同じコマンドを `kit_harmonic.wav` と `kit_percussive.wav` に対して実行すれば、スローなハーモニーのみのトラックとスローなグルーヴのみのトラックが手に入ります。操作自体は同じで、対象を元のミックスではなくステップ 1 の出力に変えているだけです。今練習している側だけテンポを落とせます。

伸縮にはどの倍率でも代償があり、`--rate` が 1.0 から離れるほどそれは大きくなります。フェイズボコーダーが埋めなければならない距離が広がるためで、これは[Editing DSP](../editing-dsp.md#実用上の注意)で説明されているピッチシフトのアーティファクトと同じ、短い重なり合ったフレームという仕組みによるものです。`--rate 0.75` での練習はほとんど代償がありませんが、`--rate 0.5` まで落とすとエンジンが埋める隙間が倍になり、過渡成分の多い素材ではっきり柔らかく輪郭のぼやけた音になります。まずはそのフレーズを弾ける最も緩やかな倍率から始め、それでも無理なときだけさらに遅くしてください。

## ステップ 3 — 移調版を作る

```bash
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json
```

```json
{"length": 494552, "sample_rate": 48000, "duration": 10.303166666666666, "semitones": -2.0, "output": "kit_down2.wav"}
```

長さは保たれます。10.303 秒入れて 10.303 秒出てきます（再合成の丸めによる数サンプルの差はあります）。変わるのはピッチだけで、ここでは半音 2 つ分下がっています。録音が歌い手の声域や固定チューニング楽器のキーから外れているときに使う機能です。

`--rate` を大きくすると代償が増えるのと同じ仕組みが `--semitones` にも働き、しかも全体ミックスと単一楽器とでは効き方が違います。[Editing DSP](../editing-dsp.md#実用上の注意)では単一の声について、シフト幅が解析フレームで表現できる範囲を超えると「水っぽい」ロボットのような質感になると説明されています。全体ミックスでは、同時に鳴っている倍音的な音源すべてが同じ量だけピッチを動かされるため、それぞれのにじみやうなりが打ち消し合うのではなく積み重なります。単独のギターならほとんど気にならないシフトでも、バンド全体にかけると目立つことがあります。全体ミックスに対する `--semitones` は控えめにし、大きくシフトしたいときは分離した倍音成分やステムがあればそちらに対して行ってください。

## ステップ 4 — チャートを読む

以下の解析コマンドは、すべて加工前の `song.wav` に対して実行します。分割やスロー版を必要としないため、このステップはステップ 1〜3 と並行して実行できます。

```bash
sonare key song.wav --json
```

```json
{"root": 9, "mode": 1, "confidence": 0.9829027056694031, "name": "A minor"}
```

A minor、信頼度 0.983。そのまま信じてよい高さです。`root` と `mode` が何を表すかは[Key Detection](../glossary/analysis/key-detection.md)を参照してください。

```bash
sonare chords song.wav --triads-only --json
```

```json
{"progression": "Am - F#dim - Am - F - Am", "count": 5,
 "chords": [
   {"name": "Am", "start": 0.0, "end": 1.899, "confidence": 0.651},
   {"name": "F#dim", "start": 1.899, "end": 3.627, "confidence": 0.613},
   {"name": "Am", "start": 3.627, "end": 6.112, "confidence": 0.690},
   {"name": "F", "start": 6.112, "end": 9.333, "confidence": 0.768},
   {"name": "Am", "start": 9.333, "end": 10.304, "confidence": 0.803}
 ]}
```

演奏しながら読むチャートには、`--triads-only` を常に付けておくとよいでしょう。このオプションなしだと同じ箇所が `Amadd9 - Gmaj9 - Amadd9 - Am - F - Am - AmM7` という、和声的には精密でも密度の高い 7 つのコードで返ってきます。`--triads-only` ならテンポの中で読める 5 つになります。`--min-duration` は、検出器が一瞬だけ 2 つのコードの間で揺れ動くときに試してみてください。指定した値より短い区間を隣に統合してくれます。

ビートとダウンビートは小節の位置を示します。

```bash
sonare beats song.wav --json
sonare downbeats song.wav --json
```

```json
[0.279, 1.022, 1.788, 2.531, 3.274, 4.017, 4.783, 5.526]
[1.022, 4.017]
```

2 つのダウンビートは 2.996 秒離れています。これは、この録音の実測テンポである約 80 BPM（`sonare bpm song.wav --json` は `{"bpm": 80.0}` を返します）での 4 拍分にあたり、上のビート間隔（約 0.75 秒）とも一致します。最初のダウンビートより前の区間は不完全な小節です。合わせて弾くときに感じる最初のダウンビートは 0.0 秒ではなく 1.022 秒です。

その計算が下のグリッドです。80 BPM の 4/4 に設定すると、読み出しは 1 拍 0.75 秒、1 小節 3.0 秒を示し、いま報告されたビートとダウンビートの間隔と一致します。120 までドラッグすると、同じ 6 秒に 1.5 倍の小節が入ります。これが次のヒントで注意しているもう 1 つの拍のレベルで、その数値を採用した場合に練習で鳴らすクリックの速さです。

<SonareDemo id="tempo-grid" />

::: tip メトロノームを設定する前に拍のレベルを確かめる
テンポの推定値は、どのパルスを拍と呼ぶかの選択でもあります。8 分音符が一定で刻まれていると、トラッカーには筋の通った答えが複数生まれます。半分、倍、あるいは同じグルーヴを付点で読む解釈です。このクリップでは `sonare mastering-profile song.wav --json` が同じ音声を 119.9 BPM と読みます。テンポが違うのではなく、拍のレベルが違います。確定する前に、報告されたビート時刻に合わせて 1 小節数えてみてください。その数値が体感と噛み合わないなら、ずれているのはタイミングではなく拍のレベルです。
:::

```bash
sonare sections song.wav --json
```

```json
{"count": 2, "sections": [
  {"type": "unknown", "start": 0.0, "end": 6.223, "energy": 1.0, "confidence": 0.0},
  {"type": "outro", "start": 6.223, "end": 10.303, "energy": 0.018, "confidence": 0.895}
]}
```

`--min-duration`（既定値 4.0 秒）は検出器が報告する最短のセクション長を決めます。この短いクリップでは結果は変わりませんが、実際の楽曲では 4 小節のブリッジが前後のヴァースへ吸収されてしまうのを防ぎます。セクションの種類が何を意味するかは[Section Structure](../glossary/analysis/section-structure.md)を参照してください。ここでの `unknown` は、検出器が「終わりではない」以上の強いラベルを見つけられなかったというだけで、大半が 1 つのグルーヴでできた 10 秒のクリップとしては妥当な結果です。

まとめると、このチャートは次のように読めます。A minor、80 BPM で 4 拍子、最初の 2 小節は `Am — F#dim — Am`、`F` はダウンビートの 6.11 秒から始まり（セクション検出器自身の境界である 6.22 秒のわずかに手前です。両方の検出器は独立に動くため、サンプル単位までは一致しません）、その後 `Am` が最後まで続きます。

::: info コードチャートは読解の補助であって、正解そのものではありません
すべてのコードオブジェクトが `confidence` を持つのはまさにこのためです。この進行の中で最も信頼度が低いのは 0.613 の `F#dim` です。経過的な減三和音はいくつかの妥当な読み方の間で本質的にあいまいで、検出器はそのうちの 1 つに決めなければなりません。信頼度の低いコードは「バグ」ではなく「ここは耳で確認する場所」として読んでください。
:::

::: warning ハ長調とイ短調の食い違いは平行調の曖昧さであって、検出器の不具合ではありません
`sonare analyze song.wav --json` にも `key` フィールドがあり、このファイルでは `{"root": 0, "mode": 0, "confidence": 0.995, "name": "C major"}` を返します。一方、専用の `sonare key` は信頼度 0.983 で `A minor` を返します。この 2 つは平行調で、7 音すべてを共有します。クロマプロファイルが選んでいるのは音の集合ではなく回転位置なので、重みづけ次第でどちらにも転びます。理由と、平行調の取り違えが主音まで動かすのに対し同主調（ハ長調とハ短調）の取り違えは旋法しか動かさないことは、[キー検出](../glossary/analysis/key-detection.md)にあります。

決め手は信頼度の数値ではなくコード進行です。この進行は冒頭も末尾も `Am` に落ち、ベースも A に着地します。練習の基準にすべき主音はイ短調です。2 つの答えが平行調どうしなら、コードとベースを信じてください。平行調でない食い違いが出たときこそ、耳で確かめるべきです。
:::

## 次に読むもの

- 練習キットの元になるミックスをこれから作る段階なら — [CLI だけでミックスからマスタリングまで](./cli-mix-and-master.md)は同じシェルスクリプトの発想をステムに対して適用したものです。
- 倍音成分／打撃成分の分割やチャート用データをスクリプトではなくアプリに組み込みたいなら — [CLI リファレンス](../cli.md)と[Editing DSP](../editing-dsp.md)が同じ処理を Python / JavaScript の API 経由で示しています。
- チャートに出てくるコード・ビート・キーの数値の背景は、[Chord Recognition](../glossary/analysis/chord-recognition.md)、[Beats and Downbeats](../glossary/analysis/beats-downbeats.md)、[Key Detection](../glossary/analysis/key-detection.md)にまとまっています。
