---
title: ピアノの録音を MIDI にする
description: ピアノ曲の WAV や MP3 を CLI だけで Standard MIDI File に採譜し、譜面と照合して精度を測り、調整し、バンドのミックスでは先にステム分離が要る理由を確かめます。
---

# ピアノの録音を MIDI にする

手元にピアノ曲の録音が WAV か MP3 であり、その音符を MIDI ファイルとして取り出したいとします。シーケンサーに読み込む、ピアノロールで眺める、練習の材料にする、といった用途です。このページでは `sonare transcribe` で採譜し、結果が譜面にどれだけ近いかを測り、オプションで調整します。最後に、録音にピアノ以外の楽器が入っている場合に何が起きるかを確かめます。

最後の部分の結論を先に書いておきます。採譜は、ファイルの中で音高を持つ音をすべて拾います。ピアノの独奏ならそれはピアノですが、バンドのミックスならベースもパッドも歌も拾います。libsonare は楽器ごとの分離を行いません。先に音源分離モデルを通し、そこで得たピアノのステムを採譜してください。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- ピアノ曲の WAV や MP3 を、1 つのコマンドで Standard MIDI File に採譜できる。
- 採譜した結果を基準の MIDI ファイルと照合し、適合率・再現率・F1 を読める。
- 2 つのオプションで再現率と引き換えに適合率を上げ、それでも残る誤りの種類を説明できる。
- バンドのミックスには採譜の前に楽器のステムが要ること、倍音成分／打撃成分の分離ではそのステムにならないことを説明できる。

## 素材

このページの数値はすべて 1 つのファイルから取っています。ゴルトベルク変奏曲のアリアの冒頭 16 小節（223 音、70 BPM、約 42 秒）を エンジン内蔵のピアノで描画し、128 kbps の MP3 にした `aria.mp3` です。描画元の譜面 `aria-score.mid` が正解になります。もう 1 つの `aria-band.mp3` は、同じピアノにベースライン、小節ごとの和音を伸ばすストリングスのパッド、ドラムキットをピアノとほぼ同じ音量で重ねたものです。

::: tip 自分で検証用の組を作る
正解の分かっている録音を手早く用意するには、手元の MIDI ファイルを描画するのが近道です。`sonare project import-smf --smf score.mid -o score.json` のあとに `sonare midi-render --in score.json -o score.wav` を実行します。描画したピアノは部屋で録ったマイク録音よりきれいなので、得られる数値は実際の録音での上限と考えてください。
:::

## 全体のスクリプト

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. 採譜する。MP3 も WAV もそのまま読める。
sonare transcribe aria.mp3 --polyphonic -o aria.mid --json

# 2. 照合する譜面があれば、結果を測る（スクリプトは後述）。
python score.py aria-score.mid aria.mid

# 3. 余分な音を減らす。フレームごとの下限を上げ、最短ノートを長くする。
sonare transcribe aria.mp3 --polyphonic \
  --min-frame-peak-ratio 0.4 --min-note-ms 90 -o aria-tuned.mid --json
python score.py aria-score.mid aria-tuned.mid
```

<FlowDiagram
  title="録音から MIDI ファイルまで"
  direction="LR"
  :nodes="[
    { id: 'solo', label: 'ピアノ独奏（WAV / MP3）', col: 0, row: 0, variant: 'muted' },
    { id: 'band', label: 'バンドのミックス', col: 0, row: 1, variant: 'muted' },
    { id: 'sep', label: '音源分離モデル', col: 1, row: 1 },
    { id: 'stem', label: 'ピアノのステム', col: 2, row: 1 },
    { id: 'tr', label: 'transcribe --polyphonic', col: 3, row: 0, variant: 'accent' },
    { id: 'mid', label: 'MIDI ファイル', col: 4, row: 0, variant: 'success' },
    { id: 'score', label: 'score.py で基準と照合', col: 4, row: 1 }
  ]"
  :edges="[
    { from: 'solo', to: 'tr' },
    { from: 'band', to: 'sep' },
    { from: 'sep', to: 'stem' },
    { from: 'stem', to: 'tr' },
    { from: 'tr', to: 'mid' },
    { from: 'mid', to: 'score' }
  ]"
  caption="独奏の録音はそのまま採譜へ。ミックスは先に楽器の分離を通します。その分離モデルは libsonare には含まれていません。"
/>

## ステップ 1 — 採譜する

::: code-group

```bash [CLI]
sonare transcribe aria.mp3 --polyphonic -o aria.mid --json
```

```typescript [Node]
import { transcribe } from '@libraz/libsonare-native';

// samples: aria.mp3 をデコードしたモノラル Float32Array
const { events, noteCount, tempoBpm } = transcribe({ samples, sampleRate, polyphonic: true });
```

```python [Python]
import libsonare as sonare

# samples: aria.mp3 をデコードしたモノラルのサンプル
result = sonare.transcribe(samples, sample_rate, polyphonic=True)
print(result.note_count, result.tempo_bpm)
```

:::

```json
{"output": "aria.mid", "note_count": 282, "tempo_bpm": 142.3509979248047, "bytes": 3513}
```

ライブラリの呼び出しはファイルではなくノートイベント（`events`、`noteCount`、`tempoBpm`）を返します。`.mid` ファイルは CLI の出力です。同じオプションは `minFramePeakRatio`、`minNoteMs`、`maxPolyphony`（Python は `min_frame_peak_ratio`、`min_note_ms`、`max_polyphony`）として受け付けます。ピアノでは `--polyphonic` が欠かせません。既定の経路は一度に 1 つの音高を追うもので、歌やモノフォニックの素材には合いますが、ピアノ曲では旋律とバスが同時に鳴ります。stderr には `warning: 2-channel input is downmixed to mono` が出ます。採譜は 1 チャンネルを読むので、これは想定どおりです。

ファイルはそのままデコードされ、MP3 のための変換は要りません。MP3 の元になった WAV を採譜すると、音数は 282 ではなく 286 で、譜面との F1 は MP3 の 0.75 に対して 0.74 でした。128 kbps なら、エンコードは結果を左右しません。

下のデモは、短いフレーズで同じ考え方を示します。音声が入り、時刻付きの音符の一覧が出てきます。

<SonareDemo id="audio-to-notes" />

`tempo_bpm` は、MIDI ファイルの小節を組むテンポです。70 BPM の曲に対してここでは 142.35 と出ています。検出器が 8 分音符の層を拍に選んだので、シーケンサーでは譜面の倍の小節数に見えます。音の位置はどちらでも正しく、`--tempo-bpm 70` を渡しても同じ 282 音が同じ時刻に書かれます。テンポが決めるのはシーケンサーでの見え方だけなので、分かっているなら渡してください。

## ステップ 2 — 譜面と照合する

その曲の基準となる MIDI ファイルがあれば、libsonare の Python バインディングを使った数行のスクリプトで採譜を採点できます。採譜した音は、譜面のどれかの音と MIDI ノート番号が同じで、開始が 50 ms 以内なら正解とします。譜面の 1 音に対応づけるのは 1 回だけです。

```python
"""採譜した SMF を譜面と照合する: 開始が 50 ms 以内で、MIDI ノート番号が同じ。"""
import sys
from libsonare import note_targets_from_smf

def notes(path):
    with open(path, "rb") as f:
        return [(n.start_sec, round(n.target_midi)) for n in note_targets_from_smf(f.read())]

score, found = notes(sys.argv[1]), notes(sys.argv[2])
unused = list(found)
hits = 0
for onset, midi in score:
    near = [n for n in unused if n[1] == midi and abs(n[0] - onset) <= 0.05]
    if near:
        unused.remove(min(near, key=lambda n: abs(n[0] - onset)))
        hits += 1
precision, recall = hits / len(found), hits / len(score)
f1 = 2 * precision * recall / (precision + recall) if hits else 0.0
print(f"score {len(score)}  found {len(found)}  matched {hits}  "
      f"precision {precision:.2f}  recall {recall:.2f}  F1 {f1:.2f}")
```

```bash
python score.py aria-score.mid aria.mid
```

```text
score 223  found 282  matched 189  precision 0.67  recall 0.85  F1 0.75
```

再現率（recall）は、譜面のうちどれだけ見つかったかです。223 音中 189 音で 0.85 です。適合率（precision）は、見つけた音のうちどれだけが譜面にあるかで、282 音中 189 音の 0.67 です。曲の大半は聞き取れていますが、書き出した音の約 3 分の 1 は譜面にない音です。F1 はこの 2 つをまとめた値です。`note_targets_from_smf` は各ファイルをそれぞれのテンポマップで読むので、比較は秒単位で行われ、採譜が 142 BPM の格子で書かれていても影響しません。

## ステップ 3 — 余分な音を減らす

ポリフォニックの既定値は密な素材を残す設定です。1 フレームに最大 10 声部、60 ms 以上のノート、同じ音高の弾き直しは新しいノートとして扱います。声部が 2〜3 本のピアノ曲には余裕がありすぎるので、2 つのオプションで絞ります。

```bash
sonare transcribe aria.mp3 --polyphonic \
  --min-frame-peak-ratio 0.4 --min-note-ms 90 -o aria-tuned.mid --json
python score.py aria-score.mid aria-tuned.mid
```

```text
score 223  found 221  matched 174  precision 0.79  recall 0.78  F1 0.78
```

| 実行 | 見つけた音 | 適合率 | 再現率 | F1 |
|------|----------:|-------:|-------:|---:|
| 既定値 | 282 | 0.67 | 0.85 | 0.75 |
| `--max-polyphony 4` | 275 | 0.69 | 0.85 | 0.76 |
| `--min-note-ms 90` | 254 | 0.73 | 0.83 | 0.78 |
| `--min-frame-peak-ratio 0.4` | 232 | 0.77 | 0.80 | 0.78 |
| `--min-frame-peak-ratio 0.4 --min-note-ms 90` | 221 | 0.79 | 0.78 | 0.78 |

`--min-frame-peak-ratio` は、次のピークがそのフレームの最初のピークに対してこの割合を下回った時点で、そのフレームでの音高探しを止めます（既定 0.20）。強い候補の下に隠れた弱い候補がこれで消えます。`--min-note-ms` はそれより短い音を捨てます。どちらも再現率と引き換えに適合率を上げますが、F1 は 0.75 から 0.78 に動くだけで、どちらがはっきり良いとは言えません。後でどちらの手直しをしたいかで選んでください。既定値では消すべき余分な音が多く残り、調整後は足すべき取りこぼしが多く残ります。`--max-polyphony` の効きが小さいのは、余分な音の多くが同時に鳴る声部の増加ではなく、同じ音高をもう一度拾ったものだからです。

調整後に残る誤りを原因別に分けると、次のとおりです。音高が合っていて、開始が譜面の音から 50 ms 以内なら見つかったものとし、残りを次のように分類しています。

- 余分な 47 音のうち 33 音は、伸ばしている音の重複です。譜面の音が鳴っているあいだに、同じ音高をもう一度拾っています。
- 9 音は音高は合っていても、開始が譜面から 50〜150 ms ずれています。これらは取りこぼしと余分な音の両方に 1 回ずつ数えられます。
- 余分な音のうち 5 音は倍音で、鳴っている譜面の音の 1 オクターブ、12 度、2 オクターブ上に出ています。
- 譜面の 40 音は、その音高ではまったく見つかっていません。そのうち 6 音は 1 オクターブずれた位置で見つかっていて、15 音は 150 ms より短い音です。

きれいなピアノ録音で現実的に得られるのは、曲の音高とリズムの大部分を備え、まだピアノロールでの手直しが要る MIDI ファイルです。伸ばした音の重複を消し、取りこぼした短い音を足す作業が残ります。[ピアノ採譜](/ja/transcribe)のデモはブラウザで同じ検出器を動かし、オプションごとにどの音が増減するかを見せます。

## ステップ 4 — バンドのミックスには先にステムが要る

同じコマンドをバンド版に実行します。

```bash
sonare transcribe aria-band.mp3 --polyphonic -o band.mid --json
python score.py aria-score.mid band.mid
```

```text
score 223  found 542  matched 165  precision 0.30  recall 0.74  F1 0.43
```

ピアノの音は相変わらず見つかっています（再現率 0.74）。ただし、ほかの 377 音に埋もれています。ベースライン、パッドの和音構成音、ドラムの部分音が、ピアノと同じように忠実に採譜されるからです。調整後の設定を使っても F1 は 0.55（316 音）で、同じオプションをピアノ単体に使ったときの 0.78 には遠く届きません。

倍音成分／打撃成分の分離は、少し効くだけです。

```bash
sonare hpss aria-band.mp3 -o band --json
sonare transcribe band_harmonic.wav --polyphonic -o band-harmonic.mid --json
python score.py aria-score.mid band-harmonic.mid
```

```text
score 223  found 492  matched 172  precision 0.35  recall 0.77  F1 0.48
```

下のデモは、分離後に各側へ何が残るかを示します。倍音成分には持続するライン、打撃成分にはアタックが入ります。

<SonareDemo id="hpss-separation" />

HPSS はドラムを取り除き、F1 は 0.05 上がりますが、ドラムは主な原因ではありませんでした。ベースとパッドは持続する音高のある音なので、ピアノと一緒に倍音成分の側に残ります。これが、libsonare の[音源分離](../source-separation.md)（倍音成分／打撃成分、またはラベルのない NMF 成分）と楽器の分離との違いです。libsonare のどちらの方式も、ピアノが何であるかを知りません。

::: warning 先に分離し、それから採譜する
ほかの楽器が入った曲では、ピアノ（または「その他」）のステムを出力する音源分離モデルを先に通し、そのステムを `sonare transcribe` に渡してください。そのようなモデルは libsonare には含まれていません。どこまで近づけるかはステムのきれいさで決まります。完全なステムなら上の独奏の場合（既定値で F1 0.75、調整後 0.78）と同じになり、ステムに残ったベースやパッドの分だけ、結果はバンドの数値に近づきます。
:::

## 次に読むもの

- [音を MIDI ノートに変換する](../audio-to-notes.md)は、採譜のオプションをすべて挙げ、歌や単独の楽器のためのモノフォニック経路と、JavaScript・Python から同じ処理を呼ぶ方法を説明しています。
- [ピアノ採譜](/ja/transcribe)は、ピアノ曲や手元のファイルにポリフォニック経路をブラウザで実行し、結果を再生します。
- [音源分離](../source-separation.md)は、HPSS と NMF が何を分けて何を分けないのかを説明しています。
- [練習用トラックを作る](./practice-tracks.md)は、同じく録音から素材一式を作る考え方で、スロー版や移調版を作ります。
