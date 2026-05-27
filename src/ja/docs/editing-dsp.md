# 編集 DSP

libsonare は、解析やマスタリング API に加えて、編集向けの DSP も公開しています。デコード済みのモノラル `Float32Array` や Python のサンプル列に対して使え、簡単なボーカル補正、ノート編集、声質設計に向いています。

このページは、すでに音声サンプルを持っていて、その音自体を変えたい場合に読むページです。BPM、キー、コード、特徴量を測りたいだけなら、先に [はじめに](./getting-started.md) を読んでください。

*半音*、*MIDI ノート番号*、*フォルマント*になじみがなければ、先に [編集の基礎](./glossary/concepts/editing-basics.md) を読んでください。本ページはその用語を前提とし、どの関数を呼ぶかに焦点を当てます。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 信号を書き換える編集 API と、測定だけを行う解析 API を区別できる。
- 音楽的な目的に応じて、タイムストレッチ、ピッチシフト、ピッチ補正、ノートストレッチ、ボイスチェンジを選べる。
- 秒、サンプル位置、半音、MIDI ノート番号を推測ではなく明示的に変換できる。
- 大きなピッチ／フォルマント変更でアーティファクトが出る理由と、自然に保つための範囲を理解できる。

## どの編集を使うか

| 目的 | 使う処理 | 初学者向けメモ |
|------|----------|----------------|
| 音の高さを変えずに長さを変える | タイムストレッチ | `rate` が `1.0` より大きいと短くなり、小さいと長くなります |
| クリップ全体の音高を上下する | ピッチシフト | `semitones=12` は 1 オクターブ上、`-12` は 1 オクターブ下です |
| ボーカルの音程を目標音へ寄せる | ピッチ補正 | 補正前に現在のピッチを推定または指定する必要があります |
| 1 つのノート区間を伸ばす／縮める | ノートストレッチ | 区間は秒ではなくサンプル位置で指定します。`stretchRatio > 1` で長くなります |
| 声のキャラクターを変える | ボイスチェンジ | ピッチは音高、フォルマントは声の太さや質感に影響します |

::: details フォルマントとは？
フォルマントは、声道の共鳴によって生じる特定の周波数帯のエネルギーのピークです。母音の響きや声の太さ・キャラクターを決めますが、ピッチ（実際に歌っている音高）とは独立しています。`voiceChange` がこの 2 つを分けて扱うのはこのためで、フォルマント係数を下げると声は大きく暗く、上げると小さく明るく聞こえ、ピッチは指定した位置のまま保たれます。
:::

## 関数

| 目的 | JavaScript | Python |
|------|------------|--------|
| 長さを変えずに全体のピッチを動かす | `pitchShift(samples, sampleRate, semitones)` | `pitch_shift(samples, sample_rate, semitones)` |
| ピッチを変えずに全体の長さを変える | `timeStretch(samples, sampleRate, rate)` | `time_stretch(samples, sample_rate, rate)` |
| ある MIDI ノートから別の MIDI ノートへ補正する | `pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` | `pitch_correct_to_midi(samples, sample_rate, current_midi, target_midi)` |
| ノート区間だけをストレッチする | `noteStretch(samples, sampleRate, onsetSample, offsetSample, stretchRatio)` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| ピッチとフォルマントを別々に動かす | `voiceChange(samples, sampleRate, pitchSemitones, formantFactor)` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor)` |

## 使い方

::: code-group

```typescript [ブラウザ]
import { init, noteStretch, pitchCorrectToMidi, voiceChange } from '@libraz/libsonare';

await init();

const tuned = pitchCorrectToMidi(vocal, sampleRate, 68.7, 69);
const heldNote = noteStretch(vocal, sampleRate, 12000, 24000, 1.25);
const character = voiceChange(vocal, sampleRate, 5, 1.1);
```

```python [Python]
import libsonare as sonare

tuned = sonare.pitch_correct_to_midi(vocal, sample_rate, current_midi=68.7, target_midi=69)
held_note = sonare.note_stretch(vocal, sample_rate, onset_sample=12000, offset_sample=24000, stretch_ratio=1.25)
character = sonare.voice_change(vocal, sample_rate, pitch_semitones=5, formant_factor=1.1)
```

```bash [CLI]
# sonare CLI は WAV/MP3 を直接読み書きします
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o tuned.wav
sonare note-stretch vocal.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 5 --formant-factor 1.1 -o character.wav
```

:::

### `pitchCorrectToMidi(...)` の考え方

`pitchCorrectToMidi(...)` は、「今の音高」と「寄せたい音高」を MIDI ノート番号で渡します。関数の中で現在のピッチを自動検出するのではなく、呼び出し側が `currentMidi` / `current_midi` を指定する設計です。

そのため、通常は次の流れで使います。

1. `pitchYin(...)`、`pitchPyin(...)`、または独自の検出器で現在のピッチを推定する。
2. 推定したピッチを MIDI ノート番号として `currentMidi` に渡す。
3. 目標の音を `targetMidi` に渡す。

```typescript
const currentMidi = 68.7; // A4 より少し低い音
const targetMidi = 69;    // A4
const tuned = pitchCorrectToMidi(vocal, sampleRate, currentMidi, targetMidi);
```

### MIDI ノート番号

MIDI ノート番号は、音の高さを半音単位の番号で表す方法です。整数 1 つが 1 半音に対応し、小数も使えます。

覚えておく基準は次の 2 つです。

| 音 | MIDI ノート番号 | 周波数 |
|----|-----------------|--------|
| C4（中央のド） | `60` | 約 261.63 Hz |
| A4 | `69` | 440 Hz |

オクターブが 1 つ上がると、MIDI ノート番号は 12 増えます。たとえば C4 が `60` なので、C5 は `72` です。

対応表全体と `freq ↔ midi` の式は [編集の基礎](./glossary/concepts/editing-basics.md#midi-ノート番号) を参照してください。

### `noteStretch(...)` の区間指定

`noteStretch(...)` は、伸ばしたい区間を秒ではなく**サンプル位置**で指定します。

秒で指定したい場合は、次のように変換します。

```typescript
const onsetSample = Math.round(onsetSeconds * sampleRate);
const offsetSample = Math.round(offsetSeconds * sampleRate);
const heldNote = noteStretch(vocal, sampleRate, onsetSample, offsetSample, 1.25);
```

`stretchRatio` は、区間の長さを何倍にするかを表します。

| `stretchRatio` | 結果 |
|----------------|------|
| `1.25` | 区間を 25% 長くする |
| `1.0` | 長さを変えない |
| `0.8` | 区間を 20% 短くする |

### `Audio` ラッパーから使う場合

`Audio` ラッパーにも同じ操作がインスタンスメソッドとして用意されています。Python でファイルを読み込むワークフローでは、音声の読み込みを一度だけ行い、その `Audio` オブジェクトに対して編集を適用できます。

## 実用上の注意

これらは軽量な編集ツールであり、完全なノンデストラクティブピッチエディタではありません。自然なボーカル補正ではピッチ補正量を小さく保ち、極端なフォルマント係数は避けてください。サウンドデザイン用途では大きな `pitchSemitones` や `formantFactor` も有効ですが、アーティファクトは強くなります。
