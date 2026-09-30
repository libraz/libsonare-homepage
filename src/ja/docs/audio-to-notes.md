---
title: 音を MIDI ノートに変換する
description: モノラル音声を MIDI イベントへ変換し、Project のテンポマップにノートを書き込みます。
---

# 音を MIDI ノートに変換する

録音を記号的な MIDI 表現にしたいときはトランスクリプションを使います。どちらの入口もモノラル音声を解析してノートオン／ノートオフの対を生成します。違うのは使うクロックと、イベントを書き込む場所です。

| 目的 | 呼び出し | PPQ のクロック | 結果 |
|---|---|---|---|
| トランスクリプションを確認、後処理する | `transcribe({ samples, sampleRate, tempoBpm? })` | この呼び出しだけの一定テンポ。`tempoBpm` を指定するか検出します | `{ events, noteCount, tempoBpm }`。プロジェクトは変更しません |
| 既存アレンジへノートを書き込む | `project.transcribeToClip({ clipId, samples, sampleRate, ... })` | プロジェクトのテンポマップ | 対象 MIDI クリップのイベントリストを置き換え、書き込んだノート数を返します |

出力は記号的な `ProjectMidiEvent[]` です。トランスクリプションは入力音声を変更しません。イベントはそのまま `setMidiEvents` に渡せます。1 つのノートは 2 イベントになり、同じ PPQ 位置ではノートオンより先にノートオフが並びます。

<SonareDemo id="audio-to-notes" />

## 音声を MIDI クリップへ変換する

スタンドアロンの `transcribe(...)` は任意の `tempoBpm` を受け取り、独自の一定テンポのグリッド上で `{ events, noteCount, tempoBpm }` を返します。`Project.transcribeToClip(...)` はプロジェクトのテンポマップを使います。`autoTempo(...)` でマップを設定したあとに呼ぶと、クリップのイベント一覧を置き換え、書き込んだノート数を返します。こちらのリクエストには `tempoBpm` がありません。

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

既定のモノフォニック経路は、pYIN から得た 1 本のピッチラインを追跡してノートへ分割します。重なったノートには `polyphonic: true` を指定し、複数 F0 の経路を使います。ポリフォニック経路には固有のフレーミングと音域があります。モノフォニック用の `fmin` と `fmax` はポリフォニック経路の調整には使われません。

スタンドアロン関数の `tempoBpm` は座標系です。省略するとテンポ検出を実行し、使えるテンポが見つからなければ 120 BPM を使います。`Project.transcribeToClip` にテンポ引数がないのは、プロジェクトのマップを読むためです。録音に合わせたマップを使う場合は、先に `autoTempo` を呼んでからクリップへ変換します。

チューニング基準は既定で 440 Hz です。トランスクリプション中に測定は行いません。A440 から外れて録音されたテイクでは別途測定し、`referenceHz` を渡してください。音声は空でない有限値のモノラルサンプルで、サンプルレートは `[8000, 384000]` の範囲が必要です。ノートが見つからない場合も成功であり、イベントリストは空、`noteCount` は `0` になります。

## オプションと制限

| オプション | 意味 |
|---|---|
| `polyphonic` | `false` はモノフォニック pYIN 分割、`true` は複数 F0 の追跡を使います |
| `referenceHz` | MIDI ノート番号のチューニング基準。正の値で、既定は `440`。自動測定はしません |
| `fmin`・`fmax` | モノフォニック探索の Hz 範囲。正の値で、`fmax > fmin` が必要です |
| `minNoteMs` | 保持するモノフォニックノートの最短長。既定は `30` ms です |
| `segmentationThresholdCents` | モノフォニックノートを分けるピッチ移動。既定は `50` cents です |
| `velocityFloorDb`・`fixedVelocity` | RMS レベルを負の dBFS 下限からマップするか、`1..127` の固定ベロシティを使います |
| `group`・`channel` | UMP グループと MIDI チャンネル。どちらも `0..15` です |

`velocityFloorDb` と `fixedVelocity` は一方を選びます。両方を省略するとレベルを測定し、負の下限を設定するとマップし、`fixedVelocity` を設定するとレベル測定を省略します。正の値が必要なオプションへ無効な `0` を渡すと、既定値へ黙って置き換えず拒否します。

## 後処理を追加する

イベントリストの検証、ルーティング、変換、任意の焼き込みは[MIDI クリップを編集する](./midi-editing.md)で扱います。次の処理で 16 ビットベロシティ、32 ビットコントローラ、パーノートメッセージが必要なら、[MIDI 2.0・UMP・クリップファイル](./midi2.md)を参照してください。

## 関連

- [音声内の音符を編集する](./note-editing.md) — 計測した音符を編集し、音声へレンダリングします
- [プロジェクト MIDI](./project-editing-midi.md) — テンポマップ、注釈、コンパイル、保存を扱います
