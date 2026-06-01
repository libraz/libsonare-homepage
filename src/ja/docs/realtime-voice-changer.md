# リアルタイムボイスチェンジャー

`RealtimeVoiceChanger` は、libsonare のプリセット駆動のライブ音声チェーンです。マイク入力、リアルタイムモニタリング、または音声を繰り返しブロックで処理し、呼び出し間で DSP 状態を保ちたい場面で使います。

半音値とフォルマント係数で 1 回だけオフライン変換するなら [`voiceChange(...)`](./editing-dsp.md#オフライン-voicechange-と-realtimevoicechanger) を使います。ライブ処理やチャンク処理のプリセットチェーンが必要なら、このページを読んでください。

::: info なぜ関数ではなくクラスなのか
ライブ音声処理には「前のブロックから続く状態」があります。ゲート、コンプレッサー、リバーブ、滑らかなピッチ／フォルマント変化は、前後のブロックをまたいで動く必要があります。`RealtimeVoiceChanger` はその状態を保持するため、ブロックごとに作り直すと音が不自然になり、準備コストも増えます。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 単純なオフライン `voiceChange(...)` ではなく `RealtimeVoiceChanger` を選ぶべき場面を判断できる。
- ブロック処理のためにクラスを準備し、WASM ハンドルを正しく解放できる。
- 組み込みプリセット JSON を確認し、ユーザー作成プリセットを受け入れる前に検証できる。
- ブラウザ、Python、Node ネイティブ、CLI のどの入口を使うべきか選べる。

## いつ使うか

| 作りたいもの | 使う入口 | 入力 | 出力 |
|------------|----------|------|------|
| ブラウザでマイク音声をライブ加工する | `RealtimeVoiceChanger` | `AudioWorklet` などから届く短い `Float32Array` ブロック | 同じ長さの加工済みブロック |
| ブラウザで 1 つの録音クリップを半音値とフォルマント値だけで変換する | `voiceChange(...)` | デコード済みモノラル `Float32Array` 全体 | 加工済み `Float32Array` |
| Python でファイルや配列全体をプリセットチェーンに通す | `voice_change_realtime(...)` | モノラル配列と `sample_rate` | 加工済み配列 |
| Node ネイティブでサーバー／デスクトップ側の一括処理を行う | `voiceChangeRealtime(...)` | モノラル配列とサンプルレート | 加工済み配列 |
| ターミナルで WAV/MP3 をプリセット加工して書き出す | `sonare voice-change --preset ...` | 音声ファイル | 書き出しファイル |
| プリセット設定を UI で表示・保存・検証する | `realtimeVoiceChangerPresetJson(...)` と検証 API | プリセット ID または JSON | 設定 JSON と検証結果 |

## 実装の全体像

ブラウザのライブ処理では、最初に `init()` と `prepare(sampleRate, maxBlockSize, channels)` を済ませ、その後は届いた音声ブロックごとに `processMono(...)` または `processMonoInto(...)` を呼びます。`RealtimeVoiceChanger` は内部状態を持つため、ブロックごとに作り直さず、ストリームが続く間は同じインスタンスを再利用します。

| 実装で決めること | 目安 |
|------------------|------|
| `sampleRate` | `AudioContext.sampleRate` や入力ファイルの実サンプルレートを使います。推測で 44100 / 48000 を固定しないでください。 |
| `maxBlockSize` | `processMono(...)` に渡す最大ブロック長です。AudioWorklet の標準レンダークォンタムなら `128` が出発点です。 |
| `channels` | このページの例はモノラルなので `1` です。インターリーブ入力なら `processInterleaved(...)` を使います。 |
| 出力バッファ | 単純な実装は `processMono(...)`、AudioWorklet のホットパスでは事前確保した出力へ `processMonoInto(...)` または WASM ヒープバッファ経路を使います。 |
| 後始末 | Vue / React コンポーネントの unmount、Worklet 停止、録音停止時に `delete()` を 1 回だけ呼びます。 |

::: warning ライブ処理と一括レンダーを混同しない
`RealtimeVoiceChanger` は「短いブロックを順番に処理し、ゲートやコンプの状態を保つ」ためのクラスです。Python / CLI の例は同じプリセットチェーンをファイル全体へ適用する入口で、ブラウザの AudioWorklet コールバック内でそのまま使うコードではありません。
:::

## 信号チェーン

リアルタイムチェーンは単なるピッチシフターではありません。組み込みプリセットは次の段を組み合わせます。

| 段 | 役割 |
|----|------|
| リチューン | プリセットの狙いに合わせてピッチを寄せる |
| フォルマント | 音高とは独立に、声の大きさやキャラクターの印象を変える |
| EQ | ダイナミクスや空間処理の前に音色を整える |
| ゲート | 小さな部屋ノイズやマイクノイズを抑える |
| コンプレッサー | ブロックをまたいでレベルを安定させる |
| ディエッサー | 刺さりやすい歯擦音を抑える |
| リバーブ | 空間を足す、または整える |
| リミッター | チェーン末尾でピークを捕まえる |

標準プリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。これらは出発点であり、ジャンルや話者属性のラベルとして固定的に扱うものではありません。

## ブラウザ / WASM

```typescript
import {
  init,
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetNames,
} from '@libraz/libsonare';

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

AudioWorklet 形式のループでは、[ブラウザ / WASM](./wasm.md#リアルタイムボイスチェンジャー) で説明している WASM ヒープ上のリアルタイムバッファを使います。レンダークォンタムごとに新しい出力配列を確保せずに済みます。

## プリセット JSON

プリセット JSON は、音声チェーン設定を確認・保存・検証したいときに使います。

```typescript
import {
  realtimeVoiceChangerPresetJson,
  validateRealtimeVoiceChangerPresetJson,
} from '@libraz/libsonare';

const json = realtimeVoiceChangerPresetJson('bright-idol');
const validation = validateRealtimeVoiceChangerPresetJson(json);

if (!validation.ok) {
  throw new Error(validation.errors.join('\n'));
}
```

現在の組み込みプリセット JSON はスキーマバージョン `1` を使います。ネイティブ POD 設定の ABI は別物です。FFI やネイティブ境界をまたぐ場合は `voiceChangerAbiVersion()` で確認してください。

正規のプリセット ID や解決済みのフラットなネイティブ設定だけが必要なら、JSON を往復せず `voiceCharacterPresetId(...)` と `realtimeVoiceChangerPresetConfig(...)` を使います。Python では同じネイティブ設定取得経路を `realtime_voice_changer_preset_pod(...)` として公開しています。

## Python

```python
import libsonare as sonare

print(sonare.voice_character_preset_id(1))
preset_config = sonare.realtime_voice_changer_preset_pod("bright-idol")

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), preset_config, changer.latency_samples())

processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

コンテキストマネージャーを使うか、`close()` を呼んでネイティブハンドルを解放してください。

## Node ネイティブ

```typescript
import {
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetNames,
  voiceChangeRealtime,
} from '@libraz/libsonare-native';

const changer = new RealtimeVoiceChanger({
  sampleRate: 48000,
  maxBlockSize: 128,
  channels: 1,
  preset: 'bright-idol',
});

const blockOut = changer.processMono(inputBlock);
const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
console.log(realtimeVoiceChangerPresetNames(), blockOut, rendered);
```

ネイティブのファイルデコード、サーバー側バッチ処理、デスクトップ統合が必要なら Node ネイティブを使います。マイクと UI がブラウザ内にある場合はブラウザ / WASM を使います。

## CLI

`sonare voice-change` には 2 つのモードがあります。

| モード | オプション |
|--------|------------|
| 単純なピッチ／フォルマント変換 | `--pitch-semitones`、`--formant-factor` |
| リアルタイムプリセットチェーンでのレンダリング | `--preset`、`--preset-json`、`--preset-pack`、`--set PATH=VALUE` |

```bash
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

リアルタイムプリセット系のオプションを渡した場合、コマンドはプリセットチェーンを使い、単純なピッチ／フォルマント指定は参照しません。詳細なコマンド表は [CLI リファレンス](./cli.md#リアルタイムボイスプリセット) を参照してください。

## 実用上の注意

リアルタイム音声処理は状態を持ちます。同じ changer をブロック間で再利用し、ブロックサイズは `prepare(...)` した最大値以内に保ち、コンポーネントやストリーム停止時にはハンドルを解放してください。

大きなピッチ、フォルマント、空間処理の変更はサウンドデザインには有効ですが、自然さは下がります。自然なモニタリングではプリセット編集を控えめにし、`latencySamples()` でレイテンシも確認してください。

## 関連ページ

- [編集 DSP](./editing-dsp.md)
- [ブラウザ / WASM](./wasm.md#リアルタイムボイスチェンジャー)
- [JavaScript API](./js-api.md#realtimevoicechanger)
- [Python API](./python-api.md#リアルタイムボイスチェンジャー)
- [Node.js ネイティブ](./native-bindings.md)
