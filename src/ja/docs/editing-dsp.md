# 編集 DSP

libsonare は、解析やマスタリング API に加えて、編集向けの DSP も公開しています。デコード済みのモノラル `Float32Array` や Python のサンプル列に対して使え、簡単なボーカル補正、ノート編集、声質設計に向いています。

このページは、すでに音声サンプルを持っていて、その音自体を変えたい場合に読むページです。BPM、キー、コード、特徴量を測りたいだけなら、先に [はじめに](./getting-started.md) を読んでください。

*半音*、*MIDI ノート番号*、*フォルマント*になじみがなければ、先に [編集の基礎](./glossary/concepts/editing-basics.md) を読んでください。本ページはその用語を前提とし、どの関数を呼ぶかに焦点を当てます。

::: info DSP と「編集」の違い
DSP は Digital Signal Processing の略で、音声信号を数値として測定・変形する処理全般を指します。このページの編集 DSP は、BPM やキーを測るだけでなく、ピッチ、長さ、声質など音そのものを書き換える API です。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 信号を書き換える編集 API と、測定だけを行う解析 API を区別できる。
- 音楽的な目的に応じて、タイムストレッチ、ピッチシフト、ピッチ補正、ノートストレッチ、スペクトル編集、ボイスチェンジを選べる。
- オフラインの `voiceChange(...)` と、ブロック継続用のリアルタイムボイスチェンジャーを使い分けられる。
- 秒、サンプル位置、半音、MIDI ノート番号を推測ではなく明示的に変換できる。
- 大きなピッチ／フォルマント変更でアーティファクトが出る理由と、自然に保つための範囲を理解できる。

## どの編集を使うか

| 目的 | 使う処理 | 初学者向けメモ |
|------|----------|----------------|
| 音の高さを変えずに長さを変える | タイムストレッチ | `rate` は再生速度の倍率です。`rate=2.0` なら 2 倍速で再生され、長さは半分になります。`rate=0.5` なら半分の速度で 2 倍の長さになります。ピッチは変わりません。（`noteStretch` の `stretchRatio` は長さの倍率なので、向きが逆になります。） |
| クリップ全体の音高を上下する | ピッチシフト | `semitones=12` は 1 オクターブ上、`-12` は 1 オクターブ下です |
| ボーカルの音程を目標音へ寄せる | ピッチ補正 | 補正前に現在のピッチを推定または指定する必要があります |
| 1 つのノート区間を伸ばす／縮める | ノートストレッチ | 区間は秒ではなくサンプル位置で指定します。`stretchRatio > 1` で長くなります |
| 時間 x 周波数の領域を弱める／補修する | スペクトル編集 | サンプル位置と Hz で矩形を指定し、`gain`、`attenuate`、`mute`、`heal` を適用します |
| 声のキャラクターを変える | ボイスチェンジ | ピッチは音高、フォルマントは声の太さや質感に影響します |
| プリセット付きでライブ音声ブロックを処理する | リアルタイムボイスチェンジャー | AudioWorklet、モニタリング、チャンク処理など、ブロック間の DSP 状態を保ちたい場合に使います |

::: details フォルマントとは？
フォルマントは、声道の共鳴によって生じる特定の周波数帯のエネルギーのピークです。

母音の響きや声の太さ・キャラクターを決めますが、ピッチ（実際に歌っている音高）とは独立しています。

`voiceChange` がこの 2 つを分けて扱うのはこのためです。フォルマント係数を下げると声は大きく暗く、上げると小さく明るく聞こえます。ピッチは指定した位置のまま保たれます。
:::

<SonareDemo id="pitch-shift" />

<SonareDemo id="time-stretch" />

## 関数

`f0Hz`（フレームごとのピッチ輪郭）、`hopLength`、`voiced` などのパラメータは、後述の [時間変化するピッチ補正](#時間変化するピッチ補正) で説明します。

| 目的 | WASM / ブラウザ JavaScript | Python |
|------|---------------------------|--------|
| 長さを変えずに全体のピッチを動かす | `pitchShift(samples, sampleRate, semitones)` | `pitch_shift(samples, sample_rate, semitones)` |
| ピッチを変えずに全体の長さを変える | `timeStretch(samples, sampleRate, rate)` | `time_stretch(samples, sample_rate, rate)` |
| ある MIDI ノートから別の MIDI ノートへ補正する | `pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` | `pitch_correct_to_midi(samples, sample_rate, current_midi, target_midi)` |
| フレームごとのピッチ輪郭をたどって目標音へ寄せる | `pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sampleRate, hopLength, voiced?, voicedProb?)` | `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate, hop_length, voiced?, voiced_prob?)` |
| ノート区間だけをストレッチする | `noteStretch(samples, sampleRate, { onsetSample, offsetSample, stretchRatio })` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| 時間 x 周波数の領域を編集する | `spectralEdit(samples, sampleRate, ops, options?)` | `spectral_edit(samples, sample_rate, ops, ...)` |
| ピッチとフォルマントを別々に動かす | `voiceChange(samples, sampleRate, { pitchSemitones, formantFactor })` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor)` |
| 状態を持つリアルタイム音声プリセットチェーン | `RealtimeVoiceChanger` | `RealtimeVoiceChanger` |
| リアルタイム音声プリセットを 1 回でレンダリング | Node ネイティブ: `voiceChangeRealtime(samples, sampleRate, preset)` | `voice_change_realtime(samples, sample_rate, preset)` |

::: tip Node ネイティブの引数順
Node ネイティブでは `timeStretch(samples, rate, sampleRate?)`、`pitchShift(samples, semitones, sampleRate?)` の順です。上の WASM / ブラウザ関数は `sampleRate` を編集量の前に置きます。
:::

## 使い方

::: code-group

```typescript [ブラウザ]
import { init, noteStretch, pitchCorrectToMidi, voiceChange } from '@libraz/libsonare';

await init();

const tuned = pitchCorrectToMidi(vocal, sampleRate, 68.7, 69);
const heldNote = noteStretch(vocal, sampleRate, { onsetSample: 12000, offsetSample: 24000, stretchRatio: 1.25 });
const character = voiceChange(vocal, sampleRate, { pitchSemitones: 5, formantFactor: 1.1 });
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

笛鳴りの減衰や短いアーティファクト補修のように、時間／周波数の矩形を直接編集したい場合は [スペクトル編集](./spectral-editing.md) を参照してください。

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

### 時間変化するピッチ補正

::: info F0・フレーム・有声とは
**F0** は基本周波数、つまりピッチのことで、Hz で測ります。ピッチ検出器は短い時間区切り（**フレーム**。ここではサンプル `hopLength` 個分）ごとに F0 を 1 つ返し、ピッチの動きをたどる F0 **輪郭**を作ります。フレームが**有声**とは、歌い手が息や無音ではなく実際に音高のある音（歌われた母音など）を出している状態で、補正する価値があるのは有声フレームだけです。
:::

`pitchCorrectToMidi(...)` は一定量のトランスポーズを 1 回かけるだけなので、テイクのビブラートや揺らぎは均されてしまいます。その表情を保ちつつ目標音へ寄せたいときは `pitchCorrectToMidiTimevarying(...)` を使います。現在ピッチを 1 つの数値で渡す代わりに、呼び出し側が用意した**フレームごとの F0 輪郭**をたどり、有声フレームごとに `targetMidi` へ補正するため、自然なピッチの動きを均さずに追従します。

```typescript
import { init, pitchPyin, pitchCorrectToMidiTimevarying } from '@libraz/libsonare';

await init();

const frameLength = 512;
const hopLength = 512;

// 1. フレームごとの F0 輪郭を測定する（hop ごとに F0 を 1 つ返す検出器なら何でもよい）。
const pitch = pitchPyin(vocal, sampleRate, frameLength, hopLength, 65, 1000, 0.3);

// 2. 輪郭を保ったまま、有声フレームを A3（MIDI 57）へ寄せる。
const tuned = pitchCorrectToMidiTimevarying(
  vocal,
  pitch.f0,          // Float32Array、解析フレームごとに F0 (Hz) を 1 つ
  57,                // 目標 MIDI ノート
  sampleRate,
  hopLength,         // フレーム i はサンプル i * hopLength を表す
  pitch.voicedFlag,  // 任意: 有声フレームだけ補正する
  pitch.voicedProb,  // 任意: [0, 1] の有声確率
);
```

`voiced`（非ゼロ＝有声）と `voicedProb` は任意で、省略するとすべてのフレームを有声として扱います。F0 輪郭を生成したときと同じ `hopLength` を使い、フレーム `i` がサンプル `i * hopLength` に対応するようにしてください。

::: tip 一定補正と輪郭追従補正
1 回のトランスポーズで十分な、安定して伸ばすノートには `pitchCorrectToMidi(...)` を使います。ビブラートやスライド、揺らぎを保ちながら音程へ寄せたいテイクには `pitchCorrectToMidiTimevarying(...)` を選んでください。
:::

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
const heldNote = noteStretch(vocal, sampleRate, { onsetSample, offsetSample, stretchRatio: 1.25 });
```

`stretchRatio` は、区間の長さを何倍にするかを表します。

| `stretchRatio` | 結果 |
|----------------|------|
| `1.25` | 区間を 25% 長くする |
| `1.0` | 長さを変えない |
| `0.8` | 区間を 20% 短くする |

### オフライン `voiceChange(...)` と `RealtimeVoiceChanger`

`voiceChange(...)` は、デコード済みモノラルクリップに半音値とフォルマント係数を渡し、処理済みバッファを受け取る簡単なオフラインヘルパーです。

`RealtimeVoiceChanger` は、ライブ入力やチャンク処理向けの状態付きプリセットチェーンです。

リチューン、フォルマント、EQ、ゲート、コンプレッサー、ディエッサー、リバーブ、リミッターの各段をまとめて扱います。

標準プリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。

同じ処理を複数ブロックに分けて呼び、呼び出し間で状態を保つ必要がある場合はリアルタイムクラスを使います。WASM では `prepare(...)` と `delete()` を明示的に呼びます。Python ではコンテキストマネージャーまたは `close()` を使えます。

::: code-group

```typescript [ブラウザ]
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';

await init();

const changer = new RealtimeVoiceChanger('bright-idol');
changer.prepare(48000, 128, 1);

try {
  const out = changer.processMono(inputBlock);
  changer.setConfig('soft-whisper');
  console.log(realtimeVoiceChangerPresetNames(), changer.latencySamples(), out);
} finally {
  changer.delete();
}
```

```python [Python]
import libsonare as sonare

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), changer.latency_samples())
```

```bash [CLI]
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

:::

### `Audio` ラッパーから使う場合

`Audio` ラッパーにも同じ操作がインスタンスメソッドとして用意されています。Python でファイルを読み込むワークフローでは、音声の読み込みを一度だけ行い、その `Audio` オブジェクトに対して編集を適用できます。

### 創造的なエフェクトインサート

ピッチや時間の変換だけでなく、ミキサー／マスタリングのインサートプロセッサのうち 2 つは、声や楽器の色づけに手軽に使えるツールです。

- `effects.modulation.ensemble` — BBD 方式（アナログのバケツリレー素子ディレイによるコーラス）のストリングマシン・アンサンブル。薄いソースを広がりのある、コーラスのかかったパッドに厚くします。
- `saturation.ampSim` — ドライブとスピーカーキャビネットの質感を加えるギターアンプシミュレーション。

これらは生バッファに対する単独関数ではなく、ストリップのインサートとして読み込みます（[ミキシングエンジン](./mixing.md)参照）。

::: info オフライン変換とアレンジ時のワープの違い
このページの関数は**オフライン**変換です。バッファを渡すと新しいバッファが返ります。これは**アレンジ時のワープ**、つまりプロジェクト内でのクリップのリピッチやテンポ同期とは別物です。後者ではクリップが一度焼き込まれるのではなく、タイムラインに追従します。そのプロジェクトレベルのワークフローは [プロジェクト編集](./project-editing.md) を参照してください。
:::

## 実用上の注意

これらは軽量な編集ツールであり、完全なノンデストラクティブピッチエディタではありません。自然なボーカル補正ではピッチ補正量を小さく保ち、極端なフォルマント係数は避けてください。サウンドデザイン用途では大きな `pitchSemitones` や `formantFactor` も有効ですが、アーティファクトは強くなります。

::: info 大きく動かすほど音が悪くなる理由
これらの変換は、音を短く重なり合うフレームに分解し、それらを並べ直したり音高を付け替えたりして動作します。小さな移動では元のフレームに近いままなのでクリーンに聞こえますが、大きな移動ではエンジンが録音されていない音を作り出さざるを得ず、にじみや「水っぽい」あるいはロボット的な質感、自然さの欠けた声として聞こえます。透明な結果のために補正量を小さく保つよう勧めているのはこのためです。
:::
