# 編集 DSP

libsonare は、解析やマスタリング API に加えて、編集向けの DSP も公開しています。デコード済みのモノラル `Float32Array` や Python のサンプル列に対して使え、簡単なボーカル補正、ノート編集、声質設計に向いています。

このページは、すでに音声サンプルを持っていて、その音自体を変えたい場合に読むページです。BPM、キー、コード、特徴量を測りたいだけなら、先に [はじめに](./getting-started.md) を読んでください。

*半音*、*MIDI ノート番号*、*フォルマント*になじみがなければ、先に [編集の基礎](./glossary/concepts/editing-basics.md) を読んでください。本ページはその用語を前提とし、どの関数を呼ぶかに焦点を当てます。

::: info DSP と「編集」の違い
DSP は Digital Signal Processing の略で、音声信号を数値として測定・変形する処理全般を指します。このページの編集 DSP は、BPM やキーを測るだけでなく、ピッチ、長さ、声質など音そのものを書き換える API です。
:::

## このページで身につくこと

下の表から編集を選び、該当する節を読んでください。表だけでは決まらない判断は次のとおりです。

- オフラインの `voiceChange(...)` と、ブロック継続用のリアルタイムボイスチェンジャーの使い分け
- 秒、サンプル位置、半音、MIDI ノート番号と、その変換
- 大きなピッチ／フォルマント変更でアーティファクトが出る理由と、自然に保つための範囲

## どの編集を使うか

| 目的 | 使う処理 | 初学者向けメモ |
|------|----------|----------------|
| 音の高さを変えずに長さを変える | タイムストレッチ | `rate` は再生速度の倍率です。`rate=2.0` なら 2 倍速で再生され、長さは半分になります。`rate=0.5` なら半分の速度で 2 倍の長さになります。ピッチは変わりません。（`noteStretch` の `stretchRatio` は長さの倍率なので、向きが逆になります。） |
| クリップ全体の音高を上下する | ピッチシフト | `semitones=12` は 1 オクターブ上、`-12` は 1 オクターブ下です |
| ボーカルの音程を目標音へ寄せる | ピッチ補正 | 補正前に現在のピッチを推定または指定する必要があります |
| 1 つのノート区間を伸ばす／縮める | ノートストレッチ | 区間はサンプル位置または秒（`onsetSec` / `offsetSec`）で指定し、負の位置は指定できません。`stretchRatio > 1` で置換区間が長くなり、クリップ全体の移動量は区間長の差分に従います |
| 時間 × 周波数の領域を弱める／補修する | スペクトル編集 | サンプル位置と Hz で矩形を指定し、`gain`、`attenuate`、`mute`、`heal` を適用します |
| 声のキャラクターを変える | ボイスチェンジ | ピッチは音高、フォルマントは声の太さや質感に影響します |
| プリセット付きでライブ音声ブロックを処理する | リアルタイムボイスチェンジャー | AudioWorklet、モニタリング、チャンク処理など、ブロック間の DSP 状態を保ちたい場合に使います |

::: details フォルマントとは？
フォルマントは、声道の共鳴によって生じる特定の周波数帯のエネルギーのピークです。

母音の響きや声の太さ・キャラクターを決めますが、ピッチ（実際に歌っている音高）とは独立しています。

`voiceChange` がこの 2 つを分けて扱うのはこのためです。フォルマント係数を下げると声は大きく暗く、上げると小さく明るく聞こえます。フォルマント段が動かすのはスペクトル包絡だけなので、音程は `pitchSemitones` で指定した位置に残ります。
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
| ピッチ輪郭を最も近い音階音へ寄せる（自動ピッチ補正） | `pitchCorrectTimevarying(samples, f0Hz, sampleRate, hopLength, options)` | `pitch_correct_timevarying(samples, f0_hz, sample_rate, hop_length, *, mode=..., scale_root=..., ...)` |
| 録音全体を検出した（または指定した）キーに合わせる | `autoTune({ samples, sampleRate, key, strength })` | `auto_tune(samples, sample_rate, key, strength=...)` |
| ノート区間だけをストレッチする | `noteStretch(samples, sampleRate, { onsetSample, offsetSample, stretchRatio })` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| 時間 × 周波数の領域を編集する | `spectralEdit(samples, sampleRate, ops, options?)` | `spectral_edit(samples, sample_rate, ops, ...)` |
| ピッチとフォルマントを別々に動かす | `voiceChange(samples, sampleRate, { pitchSemitones, formantFactor, formantMode? })` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor, formant_mode="relative")` |
| 状態を持つリアルタイム音声プリセットチェーン | `RealtimeVoiceChanger` | `RealtimeVoiceChanger` |
| リアルタイム音声プリセットを 1 回でレンダリング | `voiceChangeRealtime(samples, sampleRate, preset, options?)` | `voice_change_realtime(samples, sample_rate, preset)` |

::: tip 位置引数かリクエストオブジェクトか
WASM と Node は、位置引数（サンプル、サンプルレート、編集量またはプリセットの順）と、同じ名前を持つ 1 つのリクエストオブジェクトのどちらでも受け付けます。1 つのファイルではどちらかに統一してください。
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

::: warning `formantFactor` はピッチシフトの*後*に掛かる
`voiceChange` は先に移調を行いますが、移調そのものでフォルマントもすでに一緒に動きます。フォルマント段はその移動済みの信号に対して動くため、`formantFactor` は既存の移動量にさらに掛け算されます。つまり `formantFactor: 1.0` は「フォルマントを保つ」ではなく「追加で動かさない」という意味です。上の `{ pitchSemitones: 5, formantFactor: 1.1 }` では、フォルマントはおよそ 2<sup>5/12</sup> × 1.1（約 1.47 倍）まで上がるので、透明な移調ではなく意図的なキャラクター変更になります。

自然に聞こえる移調にしたい場合は、ピッチ比の逆数を渡して移調によるフォルマント移動を打ち消してください。

```typescript
const pitchSemitones = 5;
const transposed = voiceChange(vocal, sampleRate, {
  pitchSemitones,
  formantFactor: 2 ** (-pitchSemitones / 12), // 0.749 — 声道を元の位置に保つ
});
```

`formantMode: 'absolute'` を指定すると、この計算を任せられます。`formantFactor` はピッチシフトにかかわらず*入力*に対するフォルマントの移動量になり、`1` ならフォルマントは元の位置のままです。実際に掛かるワープは `formantFactor / 2^(pitchSemitones / 12)` です。既定の `'relative'` は上で説明した動作です。

```typescript
const natural = voiceChange(vocal, sampleRate, {
  pitchSemitones: 5,
  formantFactor: 1,       // フォルマントは入力の位置のまま
  formantMode: 'absolute',
});
```

フォルマントワープの範囲は 0.55〜1.65 なので、絶対指定が届くのは `formantFactor / 2^(pitchSemitones / 12)` がこの範囲に入る場合だけです。範囲外では、そのピッチシフトで届く `formantFactor` の範囲を示した `RangeError` を投げ、値を丸めることはしません（+12 半音では `[1.1, 3.3]`）。Python と `voice-change` CLI（`--formant-mode`）も同様に拒否します。
:::

笛鳴りの減衰や短いアーティファクト補修のように、時間／周波数の矩形を直接編集したい場合は [スペクトル編集](./spectral-editing.md) を参照してください。

### `pitchCorrectToMidi(...)` の考え方

`pitchCorrectToMidi(...)` は、「今の音高」と「寄せたい音高」を MIDI ノート番号で渡します。関数の中で現在のピッチを自動検出するのではなく、呼び出し側が `currentMidi` / `current_midi` を指定する設計です。

そのため、通常は次の流れで使います。

1. [`pitchYin(...)` や `pitchPyin(...)`](./js-api-features.md#ピッチ検出)、または独自の検出器で現在のピッチを推定する。
2. 推定したピッチを MIDI ノート番号として `currentMidi` に渡す。
3. 目標の音を `targetMidi` に渡す。

```typescript
const currentMidi = 68.7; // A4 より少し低い音
const targetMidi = 69;    // A4
const tuned = pitchCorrectToMidi(vocal, sampleRate, currentMidi, targetMidi);
```

### 時間変化するピッチ補正

::: info F0・フレーム・有声とは
**F0** は基本周波数、つまりピッチのことで、Hz で測ります。ピッチ検出器は短い時間区切り（**フレーム**。ここではサンプル `hopLength` 個分）ごとに F0 を 1 つ返し、ピッチの動きをたどる F0 **輪郭**を作ります。フレームが**有声**とは、歌い手が息や無音ではなく実際に音高のある音（歌われた母音など）を出している状態で、補正の対象になるのは有声フレームだけです。
:::

`pitchCorrectToMidi(...)` は、要求したトランスポーズ量をただちに適用し、入力の長さを保ちます。時間とともに変わるピッチ輪郭には追従しません。

::: warning 輪郭追従の補正は既定で ±12 半音
`pitchCorrectToMidiTimevarying(...)` は、測定した各フレームに対して補正器の既定値である ±12 半音の上限を使います。`pitchCorrectToMidi(...)` は MIDI の端点を検証したうえで、呼び出し側が指定した `targetMidi - currentMidi` を全量適用するため、`pitchCorrectToMidi(vocal, sampleRate, 48, 72)` は +24 半音動かします。

輪郭追従の補正を広い範囲で行う場合は `maxCorrectionSemitones` を明示した `pitchCorrectTimevarying(...)` を使い、単純な移調には `pitchShift(...)` を使ってください。
:::

フレームごとに補正を変えたいときは `pitchCorrectToMidiTimevarying(...)` を使います。呼び出し側が用意した**フレームごとの F0 輪郭**に従い、有声フレームを `targetMidi` へ補正します。

```typescript
import { init, pitchPyin, pitchCorrectToMidiTimevarying } from '@libraz/libsonare';

await init();

const hopLength = 512;

// 1. フレームごとの F0 輪郭を測定する（hop ごとに F0 を 1 つ返す検出器なら何でもよい）。
const pitch = pitchPyin({ samples: vocal, sampleRate, hopLength });

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

`voiced` と `voicedProb` は任意です。省略するとすべてのフレームを有声として扱います。F0 輪郭を生成したときと同じ `hopLength` を使い、フレーム `i` がサンプル `i * hopLength` に対応するようにしてください。

`voiced` の型は `VoicedFlags` で、`Int32Array`、`Uint8Array`、`Float32Array`、`readonly number[]`、`readonly boolean[]` を受け付けます。各要素は大きさではなくフラグとして読まれ、真と評価される値がすべて有声を意味します。そのため `pitchPyin` が `boolean[]` として返す `pitch.voicedFlag` を、変換せずそのまま渡せます。

`voiced` の長さは `f0Hz` と一致させます。`voiced` を省略する場合は、`voicedProb` を一致させます。一致しない場合は `SonareError` ではなく `RangeError` が投げられるため、`isSonareError` によるガードでは捕捉できません。

有声フレームの `f0Hz` は有限の正の値で、ナイキスト周波数（`sampleRate / 2`）以下である必要があります。有声フレームに 0・負の値・有限でない値を指定すると拒否されます。無声フレームには `NaN`、または 0 以上ナイキスト周波数以下の有限値を指定できます。ピッチ解析の無声フレームに `NaN` が含まれる場合は、その解析の `voiced` フラグも渡してください。

::: tip 一定補正と輪郭追従補正
1 回のトランスポーズで十分な、安定して伸ばすノートには `pitchCorrectToMidi(...)` を使います。ビブラートやスライド、揺らぎを保ちながら音程へ寄せたいテイクには `pitchCorrectToMidiTimevarying(...)` を選んでください。
:::

### 音階に合わせる補正

上の 2 つの関数は 1 つの音へ寄せます。ボーカルライン全体を**キー**に沿わせたい、つまり各音を C メジャーなどの最も近い構成音へ丸めたいときは `pitchCorrectTimevarying(...)` を使います。同じフレームごとの F0 輪郭を取りますが、目標と補正の効き方はオプションオブジェクトから読みます。`mode: 'scale'` が一般にいう自動ピッチ補正で、1 つの固定音ではなく、有声フレームごとに最も近い音階音へ引き寄せます。

<SonareDemo id="pitch-correct" />

::: code-group

```typescript [ブラウザ]
import { init, pitchPyin, pitchCorrectTimevarying } from '@libraz/libsonare';

await init();

const hopLength = 256;
const pitch = pitchPyin({ samples: vocal, sampleRate, hopLength });

// 有声フレームを C メジャーへ、緩やかに、ビブラートを残して寄せる。
const tuned = pitchCorrectTimevarying({
  samples: vocal,
  f0Hz: pitch.f0,
  sampleRate,
  hopLength,
  mode: 'scale',
  scaleRoot: 0,              // 0 = C .. 11 = B
  scaleModeMask: 0xab5,      // 12 ビットの度数マスク: C メジャー = {0,2,4,5,7,9,11}
  retuneAmount: 0.8,         // 0 = バイパス、1 = 完全に寄せる
  retuneSpeedMs: 15,         // 大きいほど音程へ乗るグライドが遅い
  maxCorrectionSemitones: 2, // 1 フレームあたりの移動量を制限（既定 12）
  voiced: pitch.voicedFlag,  // pitchPyin が返す boolean[] をそのまま渡す
});
```

```python [Python]
import libsonare as sonare

hop_length = 256
pitch = sonare.pitch_pyin(vocal, sample_rate, hop_length=hop_length)
tuned = sonare.pitch_correct_timevarying(
    vocal,
    pitch.f0,
    sample_rate,
    hop_length,
    mode="scale",
    scale_root=0,
    scale_mode_mask=0xAB5,
    retune_amount=0.8,
    retune_speed_ms=15,
    max_correction_semitones=2,
    voiced=pitch.voiced_flag,
)
```

```bash [CLI]
# CLI は pYIN 輪郭を自分で測定します
sonare pitch-correct-timevarying vocal.wav --mode scale --scale-root 0 --scale-mode-mask major --retune-amount 0.8 -o tuned.wav
```

:::

Node はブラウザと同じ呼び出しです。Python ではオプション辞書の代わりに、同じコントロールをキーワード専用引数として渡します。CLI で扱えるのは `pitchCorrectTimevarying` までで、`autoTune` と `spectralEdit` に対応するコマンドはありません。

| オプション | Python | CLI フラグ | 範囲 | 既定値 | 効果 |
|------------|--------|------------|------|--------|------|
| `mode` | `mode` | `--mode` | `'midi'`、`'scale'` | `'midi'` | `'midi'` は `targetMidi` へ、`'scale'` はキーの音階へ寄せる |
| `targetMidi` | `target_midi` | `--target-midi` | `[0, 127]` | `69` | `'midi'` モードの固定の目標音 |
| `scaleRoot` | `scale_root` | `--scale-root` | `0`（C）〜 `11`（B） | `0` | 音階のルートのピッチクラス |
| `scaleModeMask` | `scale_mode_mask` | `--scale-mode-mask` | 12 ビットマスクまたはモード名 | C メジャー（`0xab5`） | 有効にする音階の度数。ビット `i` が `scaleRoot` の `i` 半音上 |
| `referenceMidi` | `reference_midi` | `--reference-midi` | 有限値 | `69` | 音階グリッドの基準音。各度数はこの音から測る |
| `retuneAmount` | `retune_amount` | `--retune-amount` | `[0, 1]` | `1` | `0` でバイパス、`1` で完全に寄せる。低いと自然な揺れが残る |
| `retuneSpeedMs` | `retune_speed_ms` | `--retune-speed-ms` | `>= 0` | `50` | リチューンの時定数。大きいほど音程へ乗るグライドが遅い |
| `vibratoThresholdCents` | `vibrato_threshold_cents` | `--vibrato-threshold-cents` | `>= 0` | `20` | これより小さい補正はビブラート保持のためスキップ |
| `maxCorrectionSemitones` | `max_correction_semitones` | `--max-correction-semitones` | `>= 0` | `12` | 1 フレームの移動量の上限 |
| `voiced` / `voicedProb` | `voiced` / `voiced_prob` | （CLI が測定） | フラグ／`[0, 1]` | 全フレームが有声 | 補正するフレーム。`voiced` が `voicedProb` より優先 |

セントは半音の 100 分の 1 なので、既定の `vibratoThresholdCents` の `20` は、半音の 5 分の 1 に満たない補正をそのまま残します。自然なビブラートの揺れはこの範囲にあります。`retuneAmount: 1` に短い `retuneSpeedMs` を合わせると、硬いロボット的な効果になります。`maxCorrectionSemitones` は、検出器が 1 フレームだけオクターブを取り違えても、そのフレームがまるまる 1 オクターブ引っ張られないよう上限で抑えます。検出が不安定なときは値を下げてください。

C ナチュラルマイナー `{0,2,3,5,7,8,10}` は `0x5ad` です。`mode: 'midi'` では、この関数は `pitchCorrectToMidiTimevarying(...)` と同じく `targetMidi` へ補正します。オプションの考え方は[ピッチ補正の用語集](./glossary/editing/pitch-correction.md)で説明しています。

### 録音全体をキーに合わせる: `autoTune(...)`

ここまでの関数は、自分で測った F0 輪郭を必要とします。`autoTune(...)` は、モノフォニックの録音に対してオフラインの処理一式を行います。解析のフレームは 2048 サンプル、ホップは 512 サンプルに固定です。出力は入力と同じ長さで、無声区間や補正器が再ピッチできない音はそのまま通ります。

<FlowDiagram
  title="autoTune が実行する処理"
  :nodes="[
    { id: 'audio', label: 'モノラル音声', col: 0, row: 0 },
    { id: 'key', label: 'キー検出', col: 1, row: 0 },
    { id: 'mask', label: '音階マスク', col: 2, row: 0 },
    { id: 'f0', label: 'pYIN F0', col: 3, row: 0 },
    { id: 'corr', label: '音階補正器', col: 4, row: 0, variant: 'accent' },
    { id: 'out', label: '補正済み音声', col: 5, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'key' },
    { from: 'key', to: 'mask' },
    { from: 'mask', to: 'f0' },
    { from: 'f0', to: 'corr' },
    { from: 'corr', to: 'out' }
  ]"
  caption="キーを指定した場合、キー検出は省略されます。補正器は pitchCorrectTimevarying と同じオプションを取り、strength が retuneAmount に当たります。"
/>

::: code-group

```typescript [ブラウザ]
import { autoTune, init } from '@libraz/libsonare';

await init();

// キーを検出し、そのキーへ補正する。
const { samples: tuned, key } = autoTune({ samples: vocal, sampleRate, key: 'detect', strength: 0.8 });
console.log(key.name, key.confidence); // 実際に使われたキー

// キーを指定する場合: confidence は 1 で、検出は行われません。
const inD = autoTune({ samples: vocal, sampleRate, key: { root: 2, mode: 'dorian' } });
```

```python [Python]
import libsonare as sonare

# キーを検出し、そのキーへ補正する。
result = sonare.auto_tune(vocal, sample_rate, key="detect", strength=0.8)
print(result.key.name, result.key.confidence)  # 実際に使われたキー

# キーを指定する場合。
in_d = sonare.auto_tune(vocal, sample_rate, key=(2, "dorian"))
```

:::

`key` は `'detect'`（既定）または `{ root, mode }` で、`root` はピッチクラス（0 = C 〜 11 = B）、`mode` は `'major'`・`'minor'`・`'dorian'` などの名前または `Mode` の序数です。結果は `{ samples, key }` で、`key.mode` は [`detectKey`](./js-api-analysis.md#detectkey-samples-samplerate) と同じく名前で返り、検出ではクロマを標準の A440 で読みます。`strength`（既定 `1`）、`retuneSpeedMs`、`vibratoThresholdCents`、`maxCorrectionSemitones`、`referenceMidi` は `pitchCorrectTimevarying(...)` と同じ意味で、`strength` が `retuneAmount` に相当します。Python はキーを文字列、`Key`、マッピング、`(root, mode)` のタプルのいずれかで受け取り、`samples` と `key` を持つ `AutoTuneResult` を返します。

自分で測った輪郭を音階に合わせたい場合は、`scaleMaskForMode(root, mode)` でマスクを作り、`scaleModeMask` に渡します。教会旋法の 12 ビットマスクを返し（`scaleMaskForMode(0, 'major')` は `0b101010110101`）、`pitchCorrectTimevarying(...)` は `scaleModeMask` にモード名を直接渡すこともできます。

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

`noteStretch(...)` は、伸ばしたい区間をサンプル位置（`onsetSample`、`offsetSample`）または秒（`onsetSec`、`offsetSec`）で指定します（[サンプル指定と秒指定](#サンプル指定と秒指定)を参照）。`onsetSample` の既定値は入力の先頭、`offsetSample` の既定値は入力の末尾なので、区間が端まで続く場合はその境界を省略できます。

```typescript
const heldNote = noteStretch(vocal, sampleRate, { onsetSec: 0.25, offsetSec: 0.5, stretchRatio: 1.25 });
```

`noteMove(...)` も同じ境界に加えて、ノートの開始位置の移動先を表す `targetOnsetSample` / `targetOnsetSec` を、同じ規則で受け取ります。

`stretchRatio` は、選択区間を置き換えるストレッチ後の長さの倍率です。`noteStretch` は置換区間の始端と終端で元のサンプルを 等電力クロスフェードで混ぜます。クロスフェードは置換区間内で完結し、隣接音声のサンプルを重ねて消費しません。そのため出力全体の長さと区間後の音声の移動量は、置換区間の長さの差分に従います。`stretchRatio: 1.0` ではクリップ全体の長さは変わりません。他の比率では時間ストレッチのサンプル丸めにより数サンプルの差が出ることがあります。入力の端に接する側には隣接音声がないため、その側のクロスフェードはありません。

| `stretchRatio` | 結果 |
|----------------|------|
| `1.25` | 置換区間を 25% 長くする。後続音声は区間長の増加分だけ後ろへ移動します（サンプル丸めを除く） |
| `1.0` | 置換区間とクリップ全体の長さを維持します |
| `0.8` | 置換区間を 20% 短くする。後続音声は区間長の短縮分だけ前へ移動します（サンプル丸めを除く） |

### サンプル指定と秒指定

編集位置はすべて、サンプルまたは秒で指定できます。境界ごとにどちらか一方の表記だけを渡してください。両方を渡すと拒否されます。

| 呼び出し | サンプル | 秒 | Python（秒） |
|----------|----------|----|--------------|
| `spectralEdit` の領域 | `startSample` / `endSample` | `startSec` / `endSec` | `start_sec` / `end_sec` |
| `noteStretch`、`noteMove` | `onsetSample` / `offsetSample`。`noteMove` はさらに `targetOnsetSample` | `onsetSec` / `offsetSec`、`targetOnsetSec` | `onset_sec` / `offset_sec`、`target_onset_sec` |
| `renderNotes`、`renderPercussiveEvents` | `onsetSample` / `offsetSample`、編集の `timeOffsetSamples` | `onsetSec` / `offsetSec`、`timeOffsetSec` | `onset_sec` / `offset_sec`、`time_offset_sec` |
| ボーカルの `setSourceSpan` | `sourceStartSample`、`sourceEndSample`、`destinationStartSample`、`destinationLengthSamples` | 末尾を `Sec` にした同名のフィールド | `source_start_sec` と対応するフィールド |
| ボーカルの `split` | `sourceSample` | `sourceSec` | `cut_source_sample` / `cut_source_sec` |
| ボーカルのレンダリング `range` | `startSample` / `endSample` | `startSec` / `endSec` | `start_sec` / `end_sec` キーワード |

- 秒は、呼び出しのサンプルレート（ボーカルの行ではセッション自身のレート）で最も近いサンプルに丸められます。
- 負の位置は拒否されます。WASM と Node は `RangeError`、Python は `SonareValueError` です。
- `-1` は「末尾まで」を表す値ではありません。終端の境界を省略すると入力の端が使われます（Python は `None`）。

位置が解析から得られた値なら、サンプル値のまま渡すと、丸めが 2 回かかりません。

### オフライン `voiceChange(...)` と `RealtimeVoiceChanger`

`voiceChange(...)` は、デコード済みモノラルクリップに半音値とフォルマント係数を渡し、処理済みバッファを受け取る簡単なオフラインヘルパーです。

`RealtimeVoiceChanger` は、ライブ入力やチャンク処理向けの状態付きプリセットチェーンです。

ハイパス、ゲート、リチューン、フォルマント、EQ、コンプレッサー、ディエッサー、リバーブ、リミッターの各段をまとめて扱います。

標準プリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。

同じ処理を複数ブロックに分けて呼び、呼び出し間で状態を保つ必要がある場合はリアルタイムクラスを使います。WASM では `prepare(...)` と `delete()` を明示的に呼びます。Python ではコンテキストマネージャーまたは `close()` を使えます。同じチェーンは、モノラル／ステレオのミキサーストリップ上の `voice.changer` インサートとしても使えます（[リアルタイムボイスチェンジャー](./realtime-voice-changer.md#ミキサーインサートとして)）。

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

クラスを自分で管理せず、プリセットをバッファ全体に 1 回で適用したいときは `voiceChangeRealtime(samples, sampleRate, preset, options?)` を使います。既定では `samples` をモノラルとして扱いますが、ステレオソースには `{ channels: 2 }` を渡してインターリーブされたステレオバッファ（`L0, R0, L1, R1, ...`）を入力できます。内部レンダリングのブロックサイズは共有 C ABI レンダラー側で固定されており、WASM・Node・Python のいずれでも同じ結果になります。旧来の `blockSize` オプションは非推奨で、指定しても無視されます。返るバッファは入力と同じ並びと長さを保ちます。

### `Audio` メソッドから使う場合

`Audio` オブジェクトにも同じ操作がメソッドとして用意されています。Python でファイルを読み込むワークフローでは、音声の読み込みを一度だけ行い、その `Audio` オブジェクトに対して編集を適用できます。毎回サンプル配列と `sample_rate` を渡す必要がありません。

### 創造的なエフェクトインサート

ピッチや時間の変換のほかに、ミキサー／マスタリングのインサートプロセッサのうち 2 つが、声や楽器の色づけに使えます。

- `effects.modulation.ensemble` — BBD 方式（アナログのバケツリレー素子ディレイによるコーラス）のストリングマシン・アンサンブル。薄いソースを広がりのある、コーラスのかかったパッドに厚くします。
- `saturation.ampSim` — プリアンプドライブ、トーンスタック、任意のパワーアンプ sag／トランス／NFB（負帰還）、ギター 4x12 またはベース 8x10 キャビネット音色を持つ、ギター／ベースアンプ系の色付けインサート。

これらは生バッファに対する単独関数ではなく、ストリップのインサートとして読み込みます（[ミキシングエンジン](./mixing.md)参照）。

::: info オフライン変換とアレンジ時のワープの違い
このページの関数は**オフライン**変換です。バッファを渡すと新しいバッファが返ります。これは**アレンジ時のワープ**、つまりプロジェクト内でのクリップのリピッチやテンポ同期とは別物です。後者ではクリップが一度焼き込まれるのではなく、タイムラインに追従します。そのプロジェクトレベルのワークフローは [プロジェクト編集](./project-editing.md) を参照してください。
:::

ノート単位の編集を音声へレンダリングし直す場合は、[音声内のノート編集](./note-editing.md) を参照してください。プロジェクトの MIDI クリップを変更する場合は、[MIDI クリップ編集](./midi-editing.md) を参照してください。

同じオフラインとリアルタイムの違いは、上の [`voiceChange(...)` と `RealtimeVoiceChanger`](#オフライン-voicechange-と-realtimevoicechanger) の区別にも表れます。処理の形は 2 つです。

<FlowDiagram
  title="オフラインのバッファ変換とリアルタイムのブロックループ"
  :nodes="[
    { id: 'off-in', label: 'バッファ全体を入力', col: 0, row: 0, group: 'offline' },
    { id: 'off-fn', label: 'voiceChange() / pitchShift()', col: 1, row: 0, group: 'offline' },
    { id: 'off-out', label: '新しいバッファを出力', col: 2, row: 0, variant: 'success', group: 'offline' },
    { id: 'rt-in', label: 'オーディオブロックを入力', col: 0, row: 1, group: 'realtime' },
    { id: 'rt-fn', label: 'prepare() → processMono() ループ', col: 1, row: 1, variant: 'accent', group: 'realtime' },
    { id: 'rt-out', label: 'ブロックを出力', col: 2, row: 1, variant: 'success', group: 'realtime' }
  ]"
  :edges="[
    { from: 'off-in', to: 'off-fn', label: '一括' },
    { from: 'off-fn', to: 'off-out' },
    { from: 'rt-in', to: 'rt-fn', label: 'ブロックごと' },
    { from: 'rt-fn', to: 'rt-out' },
    { from: 'rt-out', to: 'rt-fn', label: '状態を保持', style: 'dashed' }
  ]"
  :groups="[
    { id: 'offline', label: 'オフライン（ステートレス）' },
    { id: 'realtime', label: 'リアルタイム／アレンジ時（ステートフル）' }
  ]"
  caption="オフラインは信号全体を関数に渡して 1 つのバッファを受け取ります。リアルタイム経路はブロックごとに処理し、ブロック間で DSP の状態を保つため、あるブロックの末尾が次のブロックへ引き継がれます。"
/>

## 実用上の注意

これらは軽量な編集ツールであり、DAW のように後から何度でも編集内容を差し替える本格的なピッチエディタではありません。自然なボーカル補正ではピッチ補正量を小さく保ち、極端なフォルマント係数は避けてください。サウンドデザイン用途では大きな `pitchSemitones` や `formantFactor` も有効ですが、アーティファクトは強くなります。

::: info 大きく動かすほど音が悪くなる理由
これらの変換は、音を短く重なり合うフレームに分解し、それらを並べ直したり音高を付け替えたりして動作します。小さな移動では元のフレームに近いままなのでクリーンに聞こえますが、大きな移動ではエンジンが録音されていない音を作り出さざるを得ず、にじみや「水っぽい」あるいはロボット的な質感、自然さの欠けた声として聞こえます。補正量を小さく保つよう勧めるのはこのためです。
:::
