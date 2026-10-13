---
title: 音を MIDI ノートに変換する
description: モノラル音声を MIDI イベントへ変換し、Project のテンポマップにノートを書き込みます。
---

# 音を MIDI ノートに変換する

録音を記号的な MIDI 表現にしたいときは、採譜用の [`transcribe`](./js-api-analysis.md#transcribe-request) を使います。どちらの入口もモノラル音声を解析してノートオン／ノートオフの対を生成します。違うのは使うクロックと、イベントを書き込む場所です。

| 目的 | 呼び出し | PPQ のクロック | 結果 |
|---|---|---|---|
| 採譜結果を確認、後処理する | `transcribe({ samples, sampleRate, tempoBpm? })` | この呼び出しだけの一定テンポ。`tempoBpm` を指定するか検出します | `{ events, noteCount, tempoBpm, tuning }`。プロジェクトは変更しません |
| 既存アレンジへノートを書き込む | `project.transcribeToClip({ clipId, samples, sampleRate, ... })` | プロジェクトのテンポマップ | 対象 MIDI クリップのイベントリストを置き換え、書き込んだノート数を返します |

::: info このページの用語
- **PPQ 位置**：秒ではなく、先頭から四分音符いくつ分かで数える音楽的な時刻です（プロジェクトのタイムラインの単位）。秒を PPQ に直すにはテンポが要るので、各入口は使うクロックを明示しています。
- **UMP のグループとチャンネル**：MIDI 2.0 の Universal MIDI Packet のアドレス指定です。グループとチャンネルの組で、最大 256 の MIDI チャンネルのどれにノートを送るかを表します。
- **F0**：音高を持つ音の基本周波数で、その音の高さとして聞こえる周波数です（[メロディとピッチ](./glossary/analysis/melody-pitch.md#基本周波数-f0)）。**複数 F0** 推定は、同時に鳴っている複数の F0 を探します。
:::

出力は記号的な `ProjectMidiEvent[]` です。採譜は入力音声を変更しません。イベントはそのまま `setMidiEvents` に渡せます。1 つのノートは 2 イベントになり、同じ PPQ 位置ではノートオンより先にノートオフが並びます。

<SonareDemo id="audio-to-notes" />

::: tip ピアノの録音で試す
[ピアノ採譜](/ja/transcribe) では、ピアノ曲 1 曲分（または手元の録音）にポリフォニックの処理を通し、波形の下のピアノロールに音符を並べます。このページの検出オプションはそこでつまみになっています。つまみを変えてもう一度採譜すると、前回から増えた音と消えた音に印が付き、結果は内蔵のアコースティックピアノで鳴らせます。3 チャンネル以上のファイルは、先にエンジンの `downmix` でモノラルへ畳み込みます（5.1 と 7.1 はステレオを経由します）。
:::

## 音声を MIDI クリップへ変換する

スタンドアロンの `transcribe(...)` は任意の `tempoBpm` を受け取り、独自の一定テンポのグリッド上で `{ events, noteCount, tempoBpm, tuning }` を返します。`Project.transcribeToClip(...)` はプロジェクトのテンポマップを使います。`autoTempo(...)` でマップを設定したあとに呼ぶと、クリップのイベント一覧を置き換え、書き込んだノート数を返します。こちらのリクエストには `tempoBpm` がありません。

::: code-group

```typescript [Browser / WASM]
import { Project, init, transcribe } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // デコード済みの 48 kHz モノラル PCM に置き換える
const standalone = transcribe({ samples, sampleRate, tempoBpm: 120, polyphonic: true });
const project = new Project();
try {
  project.setSampleRate(sampleRate);
  const bpm = project.autoTempo(samples, sampleRate);
  const { clipId } = project.addMidiClip(0, 16);
  const noteCount = project.transcribeToClip({ clipId, samples, sampleRate, polyphonic: true });
  console.log(standalone.tempoBpm, standalone.noteCount, bpm, noteCount);
} finally {
  project.delete();
}
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # デコード済みの 48 kHz モノラル PCM に置き換える
standalone = sonare.transcribe(samples, sample_rate, tempo_bpm=120, polyphonic=True)
with sonare.Project() as project:
    project.set_sample_rate(sample_rate)
    bpm = project.auto_tempo(samples, sample_rate=sample_rate)
    _track_id, clip_id = project.add_midi_clip(0.0, 16.0)
    note_count = project.transcribe_to_clip(clip_id, samples, sample_rate, polyphonic=True)
    print(standalone.tempo_bpm, standalone.note_count, bpm, note_count)
```

:::

## 解析モードを選ぶ

既定のモノフォニック経路は、[pYIN](./glossary/analysis/melody-pitch.md#yin-と-pyin) から得た 1 本のピッチラインを追跡してノートへ分割します。重なったノートには `polyphonic: true` を指定し、複数 F0 の経路を使います。`fmin` または `fmax` を省略すると、その端点には選んだ経路の既定値（モノフォニックは `65..2093 Hz`、ポリフォニックは `55..1760 Hz`）を使います。明示する端点は正の値にし、どちらの経路でもその値を使います。JavaScript と Python のバインディングは明示した `0` を拒否します。ポリフォニックでは解決した範囲をサリエンス推定器の F0 軸へ適用します。`fmin` がセントスペクトル自体の下限より低い場合はその下限も下げるので、低い基音も読み取れます。セントスペクトルの上限は独立したままです。`fmax` より上で見つかった音は、1 オクターブ下の音として報告せずに捨てます。

::: details ポリフォニック経路がノートを見つける手順
1. **サリエンス**：STFT の各フレームを*セントスペクトル*に描き直します。1 半音を 100 セントとする対数周波数の軸です。この軸の上で、候補となる F0 ごとにその倍音（F0、2·F0、3·F0、…）のエネルギーを合計し、1 つの*サリエンス*値にします。そのフレームがその音高のノートをどれだけ強く支持しているかを表す値です。
2. **フレームごとの声部**：最も強いサリエンスのピークを 1 つの声部とし、その倍音を差し引いてから探し直します。次のピークがそのフレーム最初のピークの `minFramePeakRatio` 未満になるか、声部が `maxPolyphony` 個に達したところで止まります。
3. **リッジ**：声部をフレームからフレームへたどり、持続する音高ごとに 1 本の*リッジ*にします。サリエンスが自分のこれまでのピークの `minRidgePeakRatio` 未満になるとリッジは終わり、直前の値の `reattackRatio` 倍を超えて上がった位置（打ち直し）で 2 本に分かれます。
4. **ノート**：各リッジが 1 つのノートになり、[捨てられるノート](#捨てられるノート)の長さ・レベル・範囲の規則を通ったものが残ります。
:::

スタンドアロン関数の `tempoBpm` は座標系です。省略するとテンポ検出を実行し、使えるテンポが見つからなければ 120 BPM を使います。`Project.transcribeToClip` にテンポ引数がないのは、プロジェクトのマップを読むためです。録音に合わせたマップを使う場合は、先に `autoTempo` を呼んでからクリップへ変換します。

[チューニング](./glossary/analysis/chroma-features.md)基準は既定で 440 Hz です。A440 から外れて録音されたテイクには、`referenceHz: 'auto'`（Python は `reference_hz="auto"`）を渡すと、ピッチを追跡する前に音声から基準を測定します。Hz で直接指定することもできます。結果の `tuning`（A440 からのセミトーン端数）は、どちらの場合も使われた基準を報告するので、半音の端数だけずれた採譜結果の原因をたどれます。この単位と Hz は `tuningToReferenceHz` と `referenceHzToTuning` で相互に変換できます。音声は空でない有限値のモノラルサンプルで、サンプルレートは `[8000, 384000]` の範囲が必要です。ノートが見つからない場合も成功であり、イベントリストは空、`noteCount` は `0` になります。

## オプションと制限

::: info 学習済みの採譜器ではなく信号処理です
ここでの採譜は決定論的な信号処理です。モノフォニックな旋律は pYIN のピッチ追跡を音符に区切り、重なった音は複数 F0 の推定系で読みます。乱数を使わないので、同じ音声と設定からはいつも同じ音符が得られます。録音と楽譜の組で訓練したニューラルネットワーク、つまり学習済みの採譜モデルは、ピアノ独奏のような密なポリフォニーで一般に高い音符精度を出します。そうした素材で精度を最優先するなら学習済みの採譜器のほうが合う場合があり、その MIDI も libsonare のプロジェクトに読み込めます。分離での同じトレードオフは [信号処理と学習済みモデルの違い](./source-separation.md#信号処理と学習済みモデルの違い) で説明しています。
:::

| オプション | 意味 |
|---|---|
| `polyphonic` | `false` はモノフォニック pYIN 分割、`true` は複数 F0 の追跡を使います |
| `referenceHz` | MIDI ノート番号のチューニング基準。Hz 単位の正の値、または音声から測定する `'auto'`。既定は `440` |
| `fmin`・`fmax` | どちらの経路にも使う F0 探索の Hz 範囲。端点を省略すると選択経路の既定値を使い、明示する場合は正の値にします。解決後の範囲は `fmax > fmin` が必要です |
| `minNoteMs` | 保持するノートの最短長（ミリ秒）。既定はモノフォニックが `30`、ポリフォニックが `60` で、どちらもテンポに依りません |
| `minNoteDivision` | 最短ノートを音価で指定します（Python は `min_note_division`、CLI は `--min-note-division`）。`n` は採譜テンポでの `1/n` 音符で、`1..128` の整数です。`32` なら 32 分音符以上を残します。両方の経路に効き、`minNoteMs` との併用は拒否されます。テンポは指定または検出したもので、`transcribeToClip` ではプロジェクト先頭のテンポです。テンポを読む設定はこれだけなので、渡す `tempoBpm` が曲のテンポではなく時間グリッドのための値なら、代わりに `minNoteMs` を指定してください |
| `segmentationThresholdCents` | モノフォニックノートを分けるピッチ移動。既定は `50` cents です |
| `maxPolyphony` | ポリフォニック専用。1 フレームが保持できる声部数（`1..64`）。既定は `10` |
| `minFramePeakRatio` | ポリフォニック専用。フレームの探索を、最初のピークに対するこの割合を下回った時点で止めます（`0..1`）。既定は `0.20` |
| `minRidgePeakRatio` | ポリフォニック専用。リッジを、自身の走査中のピークに対するこの割合を下回った時点で終えます（`0..1`）。既定は `0.10` |
| `reattackRatio` | ポリフォニック専用。リッジのサリエンスが直前のレベルのこの倍数を超えて上がった位置（鳴っている間に同じ音高を弾き直した箇所）で、2 つのノートに分けます。`1` より大きい値で、既定は `2.0`、`0` で分割を無効にします |
| `velocityFloorDb`・`fixedVelocity` | RMS レベルを負の dBFS 下限からマップするか、`1..127` の固定ベロシティを使います。どちらも、どの音を残すかには関わりません |
| `group`・`channel` | UMP グループと MIDI チャンネル。どちらも `0..15` です |

正の値が必要なオプションへ無効な `0` を渡すと、既定値へ黙って置き換えず拒否します。2 つのピーク比率では `0` は実際の 0（カットなし）です。ポリフォニックの 4 つの上限は、Python では snake_case（`max_polyphony`・`min_frame_peak_ratio`・`min_ridge_peak_ratio`・`reattack_ratio`）、両 CLI では同名のフラグで、モノフォニック経路ではフィールド名を挙げて拒否されます。

ポリフォニック経路は既定で密な素材を残します（1 フレーム最大 10 声部、60 ms 以上のノート、同じ音高の弾き直しは新しいノート）。既知の制限として、オクターブ重ねの上側の音は多くの場合失われ、直前のノートよりずっと弱い弾き直しは分割されず、広帯域ノイズは短いノートを生みます。ノイズの多い入力では `minNoteMs` または `minNoteDivision` を上げてください。

ノートだけが必要なら `transcribe` を使います。ポリフォニック経路は STFT を固定サイズの区画で 2 回読み、スペクトログラム全体の代わりに、ノートのマスク、そのマスクが選んだスペクトルのセル、音高候補、ノートを保持します。メモリ使用量は録音の長さとノート密度に応じて増えます。ノートを編集して音声に戻す場合は [`analyzePolyphonic`](./note-editing.md#保持する解析で重なった声を編集する) を使います。解析ハンドルを解放するまで、スペクトル全体とマスクを保持します。

### 捨てられるノート

| ルール | ノートを捨てる条件 | 決めるもの |
|---|---|---|
| レベルゲート | ピークがテイクの大きな音より 36 dB 以上小さい | 固定。テイクとの相対値 |
| 下限 | ピークが -80 dBFS に届かない | 固定 |
| 長さ | `minNoteMs`（または `minNoteDivision` に相当する長さ）より短い | `minNoteMs`、`minNoteDivision` |
| 音域 | 音高が `fmax` より上 | `fmin`、`fmax` |

レベルゲートがあるので、減衰の残りやゴーストはベロシティ 1 の音として出てきませんし、小さく録音したテイクでも音は残ります。基準は、最も大きな音を何個か除いた後の最大の音です（4 音につき 1 個、最大 3 個を除く）。突出した 1 打が基準を決めてしまうことはありません。`velocityFloorDb` が決めるのは、ベロシティ 1 に対応するレベルだけで、これより小さいレベルはベロシティ 1 になります。`fixedVelocity` はマップしたベロシティを 1 つの値に置き換えます。どちらも、どの音を残すかは決めず、ゲートはどちらの場合も働きます。

## 後処理を追加する

イベントリストの検証、ルーティング、変換、任意の焼き込みは[MIDI クリップを編集する](./midi-editing.md)で扱います。次の処理で 16 ビットベロシティ、32 ビットコントローラ、パーノートメッセージが必要なら、[MIDI 2.0・UMP・クリップファイル](./midi2.md)を参照してください。

## 関連

- [音声内の音符を編集する](./note-editing.md)：計測した音符を編集し、音声へレンダリングします
- [プロジェクト MIDI](./project-editing-midi.md)：テンポマップ、注釈、コンパイル、保存を扱います
- [ピアノの録音を MIDI にする](./use-cases/audio-to-midi.md)：CLI で WAV や MP3 を採譜し、元の演奏と照合します。バンドのミックスに先に[ステム](./source-separation.md)が要る理由も扱います
