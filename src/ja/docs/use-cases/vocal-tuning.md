---
title: 歌のピッチを直す
description: 歌のテイクのどの音がどれだけずれているかを測り、CLI でテイク全体をキーに合わせ、それで崩れる音を確かめ、ビブラートを残したまま音符単位で直します。
---

# 歌のピッチを直す

手元に、ほぼ歌えている歌のテイクがあるとします。何音かが低かったり高かったりするので、そこだけを正しい音程に直したい。ただし、強い補正をかけたときの段のついた平板な声にはしたくない。どの音がどれだけ動いたかも知っておきたい。このページではテイクを測り、CLI の 1 コマンドで直す方法を試し、それで崩れる音を確かめてから、音符単位で直します。

結論を先に書いておきます。`sonare pitch-correct-timevarying --mode scale` は、解析フレームごとに目標の音を選び直します。たいていの音は正しい音程の近くに収まります。ところが、キーの隣り合う 2 音のちょうど中間あたりで歌われ、しかもビブラートのかかった音は、両方の音へ引っ張られます。Python バインディングのボーカル編集セッションは音符を丸ごと動かすので、ビブラートは歌ったまま一緒に移ります。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- 歌のテイクの音符を、それぞれ歌われた音程と一緒に CLI で一覧できる。
- テイク全体を 1 コマンドでキーに合わせ、それで崩れる音を見分けられる。
- ボーカル編集セッションで音符単位に直し、ビブラートを歌ったまま残せる。
- 最も近い半音への補正が推測にすぎない理由と、意図した音を指定すべき場面を説明できる。

## 素材

このページの数値はすべて 1 つのファイル `take.wav` から取っています。約 6 秒の「あー」という歌で、44.1 kHz のモノラルです。フレーズはド・レ・ミ・ファ・ソ・ラ・ソ・ミ・レ・ドで、各音へは 60 ms かけて滑らかに移り、5.5 Hz・±25 セントのビブラートが各音の最初の 200 ms で深くなります。各音は、次の表の分だけ音程を外して歌われています。

| 音 | ド | レ | ミ | ファ | ソ | ラ | ソ | ミ | レ | ド |
|------|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 歌ったずれ（セント） | 0 | −35 | +10 | −45 | +20 | −15 | +38 | −25 | +5 | −30 |

テイクは合成したもので、ノコギリ波を母音の 3 つのフォルマントに通しています。合成にしたのは、結果をすべて実際に歌ったずれと照らし合わせられるようにするためです。以下の表で「測定」とある列は、libsonare の外で独立に測った値です。各音の基音の瞬時周波数を、ビブラートのちょうど 1 周期にわたって平均しています。元のテイクでは、この測定は上の表と 0.1 セント以内で一致します。実際の声には子音や息があり、ビブラートも不規則なので、ここでの数値は最良の場合と考えてください。

::: info 用意するもの
- **インストール:** `pip install libsonare`（Python 3.11 以降）で、`sonare` コマンドと `tune.py` が使う Python バインディングが入ります。
- **歌のテイク:** 1 本の歌のラインで、リバーブのかかっていないもの。WAV か MP3 です。ツールは一度に 1 つの音程を追うので、ステレオのテイクはモノラルにまとめられます。
- **このページを再現するには:** `take.wav` は合成音です。下のスクリプトで同等のテイクを書き出せます。`--segmentation-threshold-cents 40` を付けると、`vocal-notes` はここに載せた数値と 2 セント程度以内で読み取ります。既定のしきい値では、くっついた E の値が数セント違って出ます。
:::

::: details テスト用のテイクを書き出すスクリプト
`make_take.py` として保存し、`python make_take.py` を実行します（NumPy は `pip install libsonare` で一緒に入ります）。

```python
"""Write take.wav: a synthetic sung "ah", C D E F G A G E D C, each note off pitch by a known amount."""
import wave

import numpy as np

SR = 44100
MIDI = [60, 62, 64, 65, 67, 69, 67, 64, 62, 60]
CENTS = [0, -35, 10, -45, 20, -15, 38, -25, 5, -30]
SECONDS = [0.5, 0.5, 0.53, 0.45, 0.75, 0.49, 0.5, 0.5, 0.5, 1.05]
FORMANTS = [(700, 110), (1220, 120), (2600, 160)]  # an "ah" vowel: center Hz, bandwidth Hz

lead = int(0.15 * SR)
pitch = [np.full(lead, MIDI[0] + CENTS[0] / 100)]
for i, (m, c, s) in enumerate(zip(MIDI, CENTS, SECONDS)):
    n = int(s * SR)
    t = np.arange(n) / SR
    target = m + c / 100
    prev = MIDI[i - 1] + CENTS[i - 1] / 100 if i else target
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.minimum(1.0, t / 0.06))
    glide = prev + (target - prev) * ramp  # 60 ms glide into the note
    depth = 0.25 * np.minimum(1.0, t / 0.2)  # +-25 cents, built up over 200 ms
    pitch.append(glide + depth * np.sin(2 * np.pi * 5.5 * t))
midi = np.concatenate(pitch)
f0 = 440.0 * 2 ** ((midi - 69) / 12)
phase = 2 * np.pi * np.cumsum(f0) / SR

voice = np.zeros_like(f0)
for k in range(1, 60):  # sawtooth harmonics, weighted by the vowel's formants
    fk = k * f0
    gain = (1.0 + 2.0 * sum(np.exp(-0.5 * ((fk - fc) / bw) ** 2) for fc, bw in FORMANTS)) / k
    voice += np.where(fk < SR / 2, gain * np.sin(k * phase), 0.0)
voice[:lead] = 0.0
env = np.minimum(1.0, np.arange(len(voice)) / (0.02 * SR)) * np.minimum(1.0, (len(voice) - np.arange(len(voice))) / (0.05 * SR))
voice = 0.5 * voice * env / np.max(np.abs(voice))
voice = np.concatenate([voice, np.zeros(int(0.13 * SR))])

with wave.open("take.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((voice * 32767).astype("<i2").tobytes())
```
:::

## 全体のスクリプト

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. どの音がどれだけずれているか。
sonare vocal-notes take.wav --segmentation-threshold-cents 40

# 2. 1 コマンドで直す。フレームごとに C メジャーへ寄せる。
sonare pitch-correct-timevarying take.wav --mode scale --scale-root 0 \
  -o take-scale.wav --json
sonare vocal-notes take-scale.wav

# 3. 代わりに音符単位で直し、ビブラートを残す。先にステップ 3 の
#    スクリプトを tune.py として保存しておく。
python tune.py take.wav take-tuned.wav
sonare vocal-notes take-tuned.wav --segmentation-threshold-cents 40
```

## ステップ 1 — テイクを測る

`sonare vocal-notes` は、ボーカル編集セッションと同じやり方でテイクを音符に分け、各音符の音程を、最も近い音名とそこからのずれ（セント）で表示します。読み取るだけで、何も書き出しません。

```bash
sonare vocal-notes take.wav
```

```text
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.3 cents  midi 60.00  261.67 Hz  stability 0.777
  [1] 0.650-1.149 s  D4    -35.3 cents  midi 61.65  287.73 Hz  stability 0.664
  [2] 1.149-1.846 s  E4    +18.6 cents  midi 64.19  333.19 Hz  stability 0.550
  [3] 1.846-2.136 s  F4    -41.7 cents  midi 64.58  340.91 Hz  stability 0.725
  [4] 2.136-2.902 s  G4    +20.1 cents  midi 67.20  396.56 Hz  stability 0.621
  [5] 2.902-3.390 s  A4    -15.4 cents  midi 68.85  436.10 Hz  stability 0.672
  [6] 3.390-3.889 s  G4    +38.4 cents  midi 67.38  400.78 Hz  stability 0.676
  [7] 3.889-4.389 s  E4    -24.1 cents  midi 63.76  325.06 Hz  stability 0.432
  [8] 4.389-4.876 s  D4     +5.3 cents  midi 62.05  294.56 Hz  stability 0.663
  [9] 4.876-5.921 s  C4    -29.5 cents  midi 59.70  257.20 Hz  stability 0.615
```

歌った 10 音に対して、見つかった音符も 10 個です。音の移り目やビブラートで音符が割れることはなく、8 音の読み取りは歌ったずれと 1 セント以内で一致しています。

例外はミとファです。ミは +10 ではなく +18.6 と読まれ、ファの始まりは 1.65 秒ではなく 1.846 秒になっています。新しい音符は、音程が区切りのしきい値（既定値 50 セント）を超えて動いたところから始まります。+10 で歌ったミと −45 で歌ったファの差は 45 セントしかないので、2 音の境目が遅れて見つかり、ファの頭がミの終わりとして読まれます。隣り合う 2 音が近い音程で歌われているときは、しきい値を下げます。

```bash
sonare vocal-notes take.wav --segmentation-threshold-cents 40
```

```text
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.3 cents  midi 60.00  261.67 Hz  stability 0.722
  [1] 0.650-1.149 s  D4    -35.3 cents  midi 61.65  287.73 Hz  stability 0.580
  [2] 1.149-1.683 s  E4    +10.1 cents  midi 64.10  331.55 Hz  stability 0.553
  [3] 1.683-2.136 s  F4    -44.8 cents  midi 64.55  340.30 Hz  stability 0.699
  [4] 2.136-2.891 s  G4    +20.1 cents  midi 67.20  396.56 Hz  stability 0.536
  [5] 2.891-3.379 s  A4    -15.4 cents  midi 68.85  436.10 Hz  stability 0.547
  [6] 3.379-3.878 s  G4    +38.4 cents  midi 67.38  400.78 Hz  stability 0.563
  [7] 3.878-4.377 s  E4    -24.1 cents  midi 63.76  325.06 Hz  stability 0.129
  [8] 4.377-4.876 s  D4     +5.3 cents  midi 62.05  294.56 Hz  stability 0.515
  [9] 4.876-5.921 s  C4    -29.5 cents  midi 59.70  257.20 Hz  stability 0.519
```

これで、すべての読み取りが表と 1 セント以内で一致します。いちばん外れているのはファで、45 セント低くなっています。2 つ目のソは 38 セント高く、レと最後のドは約 30 セント低くなっています。`--json` を付けると、同じ音符を開始・終了のサンプル位置付きで出力するので、スクリプトからそのまま扱えます。各音符のエントリにはフレームごとの `amplitude` 配列も入るため、出力は大きくなります。音符の切り出し元になるピッチ解析は、`--frame-length-samples`、`--hop-length-samples`、`--yin-threshold`、`--voiced-threshold`、`--no-centered` で設定します。フレームごとの生のピッチ曲線をグラフにしたいときは、`sonare pitch --json --frames` を使います。

## ステップ 2 — テイク全体をキーに合わせる

```bash
sonare pitch-correct-timevarying take.wav --mode scale --scale-root 0 \
  -o take-scale.wav --json
```

```json
{"length": 266805, "sample_rate": 44100, "duration": 6.05, "output": "take-scale.wav"}
```

`--scale-root 0` は C で、スケールの既定値はメジャーです。ほかのスケールには `--scale-mode-mask` にモード名を渡します。A マイナーなら `--scale-root 9 --scale-mode-mask minor` です。出力の長さは入力と同じで、変わるのは音程だけです。

10 音のうち 8 音は正しい音程から 4.4 セント以内に収まります。残る 2 音は収まりません。

| 音 | 歌ったずれ（セント） | `--mode scale` の後 | 補正後のビブラート（歌は ±25） |
|------|-----:|-----:|-----:|
| ファ | −45 | −49.8 | ±41.8 |
| 最後のド | −30 | −23.1 | ±40.2 |
| ほかの 8 音 | −35〜+38 | −3.9〜+4.4 | ±19.4〜±22.7 |

この 2 音は直っておらず、揺れ幅も歌ったときのほぼ 2 倍に広がっています。出力に `vocal-notes` をかけると、直っていない 2 音がそのまま見えます。

```text
  [3] 1.695-2.136 s  F4    -49.4 cents  midi 64.51  339.40 Hz  stability 0.527
  [9] 4.888-5.921 s  C4    -25.1 cents  midi 59.75  257.86 Hz  stability 0.587
```

原因は、このコマンドがフレーム単位で動くことにあります。`--help` にもそう書かれています。解析フレームごとに、そのフレームの音程に最も近いキーの音を目標にします。目標から 20 セント以内のフレームはそのまま残し（`--vibrato-threshold-cents`）、それ以外は 50 ms の時定数で目標へ寄せます（`--retune-speed-ms`）。ファは 45 セント低く、±25 セントのビブラートで歌われているので、ファより 70 セント低いところから 20 セント低いところまで揺れます。これはミより 30〜80 セント高い範囲です。揺れの谷では最も近いキーの音がミになり、山ではファになります。補正は谷をミへ、山をファへ寄せるので、ビブラートが広がります。最後のドも、ドとシのあいだで同じことが起きています。揺れの谷がドより 55 セント低いところまで下がり、そこではシのほうが近くなります。補正された音のほうも、20 セントの不感帯のせいでビブラートが ±25 から ±21 セント前後まで浅くなっています。

2 つの補正オプションで変わるのはこの現象の程度で、現象そのものは消えません。

| オプション | ファ | 最後のド | 10 音の正しい音程からの平均距離 |
|---------|-----:|-----:|-----:|
| 既定値 | −49.8、±41.8 | −23.1、±40.2 | 9.5 |
| `--vibrato-threshold-cents 0` | −49.7、±41.8 | −19.8、±41.6 | 7.7 |
| `--vibrato-threshold-cents 60` | −44.8、±25.2 | −29.9、±25.3 | 21.7 |
| `--retune-speed-ms 200` | −48.5、±27.9 | −19.2、±29.2 | 14.7 |
| `--retune-speed-ms 500` | −44.9、±26.3 | −23.5、±25.9 | 19.8 |

不感帯を広げても補正を遅くしても、ビブラートが残るのは補正しなくなるからです。60 セントにするとほとんど何も動かず、平均は補正前の 22.3 近くまで戻ります。大きく外れ、しかもビブラートのかかった音こそ直したかった音です。ですから、これはフレーム単位で補正する方法の限界で、設定を探せば解決するものではありません。

下のデモは、同じ 2 つの操作子（補正の強さと補正の速さ）を、わざと音程を外した旋律に当てます。元のテイクと補正後を聴き比べてください。

<SonareDemo id="pitch-correct" />

## ステップ 3 — 音符単位で直す

ボーカル編集セッションは、音符を 1 つの単位として補正します。`center` を目標にすると、測った音符の中心音程から目標までの差の分だけ音符全体を動かし、音符の中のゆらぎやビブラートは歌ったまま残します。次のスクリプトは、ステップ 1 と同じ 40 セントのしきい値で音符を見つけ、それぞれを最も近い半音へ直します。`tune.py` として保存してください。

```python
"""歌った各音を丸ごと最も近い半音へ寄せる。ビブラートは残す。"""
import sys
import wave
from dataclasses import replace

import numpy as np
from libsonare import Audio, VocalCreateOptions, VocalSetNoteEdit, VocalTargetMode, create_vocal_edit_session


def save(path, samples, sr):
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())


# Audio.from_file は WAV と MP3 をデコードし、ステレオはモノラルにまとめる
with Audio.from_file(sys.argv[1]) as audio:
    samples, sr = audio.data, audio.sample_rate
options = VocalCreateOptions(segmentation_threshold_cents=40.0)
with create_vocal_edit_session(samples, sr, options=options) as session:
    notes, _ = session.notes()
    edits = [
        VocalSetNoteEdit(n.id, replace(n.edit, target_mode=VocalTargetMode.CENTER,
                                       target_midi=float(round(n.center_midi)), amount=1.0))
        for n in notes if n.has_pitch
    ]
    draft = session.begin_edit()
    draft.apply(edits, draft.token().generation)
    draft.commit()
    print(f"retuned {len(edits)} of {len(notes)} notes")
    save(sys.argv[2], session.render().samples, sr)
```

```bash
python tune.py take.wav take-tuned.wav
sonare vocal-notes take-tuned.wav --segmentation-threshold-cents 40
```

```text
retuned 10 of 10 notes
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.1 cents  midi 60.00  261.64 Hz  stability 0.710
  [1] 0.650-1.149 s  D4     +0.8 cents  midi 62.01  293.80 Hz  stability 0.577
  [2] 1.149-1.672 s  E4     -0.3 cents  midi 64.00  329.56 Hz  stability 0.579
  [3] 1.672-2.148 s  F4     -0.1 cents  midi 65.00  349.20 Hz  stability 0.679
  [4] 2.148-2.891 s  G4     +0.2 cents  midi 67.00  392.04 Hz  stability 0.599
  [5] 2.891-3.379 s  A4     -0.0 cents  midi 69.00  440.00 Hz  stability 0.517
  [6] 3.379-3.889 s  G4     +0.1 cents  midi 67.00  392.01 Hz  stability 0.547
  [7] 3.889-4.377 s  E4     -0.1 cents  midi 64.00  329.61 Hz  stability 0.316
  [8] 4.377-4.888 s  D4     -0.1 cents  midi 62.00  293.65 Hz  stability 0.511
  [9] 4.888-5.921 s  C4     +0.1 cents  midi 60.00  261.64 Hz  stability 0.572
```

独立した測定でも同じ結果です。

| 音 | 歌ったずれ | `--mode scale` | 音符単位 | 音符単位のビブラート |
|------|-----:|-----:|-----:|-----:|
| ド | 0 | +3.9 | −0.3 | ±25.2 |
| レ | −35 | −2.5 | +1.0 | ±25.3 |
| ミ | +10 | +2.8 | 0.0 | ±25.3 |
| ファ | −45 | −49.8 | −0.3 | ±25.4 |
| ソ | +20 | +4.4 | +0.3 | ±24.8 |
| ラ | −15 | −0.4 | +0.6 | ±25.0 |
| ソ | +38 | +3.4 | −0.4 | ±25.6 |
| ミ | −25 | −3.9 | −1.0 | ±25.1 |
| レ | +5 | +0.4 | −0.1 | ±25.2 |
| ド | −30 | −23.1 | −0.8 | ±25.4 |
| 正しい音程からの平均距離 | 22.3 | 9.5 | 0.5 | |

すべての音が 1 セント以内に入り、ビブラートはどれも ±25 セントのままです。しきい値はここでもステップ 1 と同じくらい効きます。既定値の 50 セントのままだと、同じスクリプトでもミが −8.8 に残り、平均は 1.6 セントになります。ミの音符が、ステップ 1 で +18.6 と読まれたミからファにまたがる区間になっているからです。セッションが動かせるのは渡された音符だけなので、補正の前に `vocal-notes` で確かめてください。

## ステップ 4 — 各音が本来どの音かを決める

ここまでの 2 つの方法は、どちらも歌い手が最も近い音を狙っていたと仮定しています。50 セントより大きく外れた音は隣の音として読まれ、どちらの方法でも隣の音へ寄せられます。CLI が知っているのはキーだけで、`tune.py` は丸めているだけです。メロディが分かっているなら、丸めた音の代わりに意図した音をセッションに渡します。たとえば、テイクがド・レ・ミ・ファ・ソ・ラ・ソ・ミ・レ・ドであるはずなら、次のようにします。

```python
melody = [60, 62, 64, 65, 67, 69, 67, 64, 62, 60]
sung = [n for n in notes if n.has_pitch]
edits = [
    VocalSetNoteEdit(n.id, replace(n.edit, target_mode=VocalTargetMode.CENTER,
                                   target_midi=float(midi), amount=1.0))
    for n, midi in zip(sung, melody, strict=True)
]
```

`strict=True` は、見つかった音符の数がメロディの音数と合わないときにエラーにします。そのときは違う音を直してしまう前に、`vocal-notes` の結果を見直してください。同じ編集で `amount` を 1 未満にすると音を途中まで寄せ、`speed_ms` を 0 より大きくすると、音の最初のフレームから一気に補正せず徐々に寄せます。どちらも、アンドゥ、セッションの保存、結果をプロジェクトに取り付ける方法と合わせて、[オフラインモノフォニックボーカル編集](../vocal-editing.md) で説明しています。

## 次に読むもの

- [オフラインモノフォニックボーカル編集](../vocal-editing.md) は、セッション API の全体を扱います。音符の分割と結合、タイミングとフォルマントの編集、アンドゥ／リドゥ、JavaScript からの同じ呼び出し方です。
- [CLI コマンド](../cli-commands.md#編集) に、`vocal-notes`、`pitch-correct-timevarying`、`pitch-correct`、`scale-quantize` とそのオプションがあります。
- [練習用トラックを作る](./practice-tracks.md) は録音全体を移調します。外れているのが個々の音ではなくキーのときに使います。
- [ピッチ補正とノート編集](../glossary/editing/pitch-correction.md) は、目標の音への補正と、測定した補正量にかかる制限を説明しています。
- [音を MIDI ノートに変換する](../audio-to-notes.md) は、単音の採譜経路で歌の旋律を MIDI の音符にします。
