# リアルタイムボイスチェンジャー

`RealtimeVoiceChanger` は、libsonare のプリセット式ライブ音声チェーンです。マイク入力、リアルタイムモニタリング、または音声を繰り返しブロックで処理し、呼び出し間で DSP 状態を保ちたい場面で使います。

半音値とフォルマント係数で 1 回だけオフライン変換するなら [`voiceChange(...)`](./editing-dsp.md#オフライン-voicechange-と-realtimevoicechanger) を使います。ライブ処理やチャンク処理のプリセットチェーンが必要なら、このページを読んでください。

::: info ブロック・サンプルレート・DSP 状態
リアルタイム音声は、小さな**ブロック**（サンプルのまとまり）を次々に処理します。ブラウザでは AudioWorklet が 128 サンプルの固定**レンダークォンタム**を 1 回ずつ渡します。**サンプルレート**（例: 48000）は 1 秒が何サンプルでできているかです。**DSP 状態**は、エフェクトがブロック間で持ち越すメモリ（リバーブの残響、コンプレッサーの現在のゲインなど）です。だからこそボイスチェンジャーは 1 回限りの関数ではなく、再利用するオブジェクトになっています。
:::

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

「インターリーブ」とは、複数チャンネルを 1 つの配列に交互に並べたもの（L, R, L, R…）で、「モノラル」は 1 チャンネルです。前者には `processInterleaved(...)`、後者には `processMono(...)` を使います。

::: warning ライブ処理と一括レンダーを混同しない
`RealtimeVoiceChanger` は「短いブロックを順番に処理し、ゲートやコンプの状態を保つ」ためのクラスです。Python / CLI の例は同じプリセットチェーンをファイル全体へ適用する入口で、ブラウザの AudioWorklet コールバック内でそのまま使うコードではありません。
:::

## 信号チェーン

リアルタイムチェーンは単なるピッチシフターではありません。組み込みプリセットは次の段を組み合わせます。

<SonareDemo id="pitch-shift" />

上のデモは**リチューン**段（ピッチシフト）だけを取り出して、その効果を単体で聞けるようにしたものです。実際のプリセットでは、ピッチシフトの*前*にクリーンアップ用ハイパスとノイズゲートが動き、その*後*に EQ・ダイナミクス・空間処理が続きます。全体の順序は下の図のとおりです。

<FlowDiagram
  title="プリセットの信号チェーン"
  direction="TB"
  :nodes="[
    { id: 'hpf', label: 'ハイパス', col: 0, row: 0, group: 'input' },
    { id: 'gate', label: 'ゲート', col: 0, row: 1, group: 'input' },
    { id: 'retune', label: 'リチューン', col: 0, row: 2, variant: 'accent', group: 'block' },
    { id: 'formant', label: 'フォルマント', col: 0, row: 3, group: 'block' },
    { id: 'eq', label: 'EQ', col: 0, row: 4, group: 'output' },
    { id: 'comp', label: 'コンプレッサー', col: 0, row: 5, group: 'output' },
    { id: 'deesser', label: 'ディエッサー', col: 0, row: 6, group: 'output' },
    { id: 'reverb', label: 'リバーブ', col: 0, row: 7, group: 'output' },
    { id: 'limiter', label: 'リミッター', col: 0, row: 8, variant: 'success', group: 'output' }
  ]"
  :edges="[
    { from: 'hpf', to: 'gate' },
    { from: 'gate', to: 'retune' },
    { from: 'retune', to: 'formant' },
    { from: 'formant', to: 'eq' },
    { from: 'eq', to: 'comp' },
    { from: 'comp', to: 'deesser' },
    { from: 'deesser', to: 'reverb' },
    { from: 'reverb', to: 'limiter' }
  ]"
  :groups="[
    { id: 'input', label: '入力段' },
    { id: 'block', label: 'ピッチ・フォルマント' },
    { id: 'output', label: '出力段' }
  ]"
  caption="各ブロックは上から下へこの順で流れます。入力段（ハイパス、ゲート）と出力段（EQ〜リミッター）はサンプル単位で処理し、その間のリチューンとフォルマントはブロック全体に対して処理します。ドライ／ウェットのミックス後にはトゥルーピークリミッター（既定で有効）が続きます。"
/>

| 段 | 役割 |
|----|------|
| ハイパス | 低域のランブルや DC を最初に取り除くクリーンアップ用プリフィルター（`eq.highpassHz`） |
| ゲート | フレーズの合間の小さな部屋ノイズやマイクノイズを抑える |
| リチューン | プリセットが指定する半音値だけピッチを上下させ（例: 声を高く／低く）、プリセットが有効にしている場合は持続音を最も近い音階音へ寄せる。チェーンの中のピッチシフト段 |
| フォルマント | 音高とは独立に、声の大きさやキャラクターの印象を変える |
| EQ | ボディ・プレゼンス・エアの音色調整（`eq.bodyDb`／`presenceDb`／`airDb`） |
| コンプレッサー | ブロックをまたいでレベルを安定させる |
| ディエッサー | 刺さりやすい歯擦音を抑える |
| リバーブ | 空間を足す、または整える |
| リミッター | ピークを捕まえる。ドライ／ウェットのミックス後に 4 倍オーバーサンプリングのトゥルーピークリミッターが続く（既定で有効） |

::: tip
`eq` ブロックはチェーンの両端を設定します。`highpassHz` は先頭のクリーンアップ用ハイパスで、`bodyDb`／`presenceDb`／`airDb` はフォルマント処理の後に置かれる音色シェルフです。
:::

::: info ボイスチェーンの用語をまとめて把握
- **ハイパス** — 信号の最初で低域のランブルや DC を取り除くクリーンアップフィルターです。
- **ゲート** — 信号がしきい値を下回ると無音にし、フレーズの合間の小さなマイク／部屋ノイズを取り除きます。
- **リチューン** — 歌った音そのものを高く／低くピッチで上下させます。音を動かさずに声のキャラクターを変えるフォルマントとは別物です。
- **フォルマント** — 声を大きく／小さく、男性的／女性的に聞かせる共鳴です。これをずらすと、音程を変えずに声のキャラクターが変わります。
- **コンプレッサー** — 大きい部分と小さい部分を自動でならし、レベルを安定させます。
- **ディエッサー** — 耳に刺さる「s」「sh」の音（歯擦音）を抑えます。
- **リミッター** — チェーン末尾でピークがクリップしないよう止める安全装置です。
:::

標準プリセット ID には `neutral-monitor`、`bright-idol`、`soft-whisper`、`deep-narrator`、`robot-mascot`、`dark-villain` があります。これらは出発点であり、ジャンルや話者属性のラベルとして固定的に扱うものではありません。

## どの言語でも同じ流れ

どのバインディングも同じ流れで動きます。changer を**生成**し、サンプルレートとブロックサイズで**準備**し、ブロックごとに **`processMono(...)`** を呼び、`setConfig(...)` でプリセットをライブ差し替えし、`latencySamples()` を読むだけです。違うのはコンストラクタの形と後始末の呼び出しだけで、それを下のタブに並べています。

::: code-group

```typescript [Browser]
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
  changer.delete(); // WASM ハンドルの解放
}
```

```python [Python]
import libsonare as sonare

print(sonare.voice_character_preset_id(1))
preset_config = sonare.realtime_voice_changer_preset_config("bright-idol")

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), preset_config, changer.latency_samples())

# 同じプリセットチェーンで配列全体をレンダーする:
processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

```typescript [Node]
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

try {
  const blockOut = changer.processMono(inputBlock);
  changer.setConfig('soft-whisper');
  // 同じプリセットチェーンで配列全体をレンダーする:
  const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
  console.log(realtimeVoiceChangerPresetNames(), changer.latencySamples(), blockOut, rendered);
} finally {
  changer.destroy(); // ネイティブハンドルの解放（WASM は delete()）
}
```

```bash [CLI]
# sonare voice-change はファイル全体をプリセットチェーンに通してレンダーします。
# ブロック単位のリアルタイムループではありません。
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

:::

::: warning 後始末はバインディングごとに違う
生成と処理の流れは共通ですが、ネイティブハンドルの解放方法は言語ごとに異なります。解放は必ず 1 回だけ行ってください。

- **ブラウザ / WASM** — `delete()` を呼びます（`finally` 内、コンポーネントの unmount 時、Worklet 停止時など）。
- **Node ネイティブ** — `destroy()` を呼びます。`using`（Node 22 以降）を使えば自動で解放できます。
- **Python** — `with` ブロックを抜けるとハンドルを解放します。`with` を使わない場合は `close()` を呼びます。
:::

AudioWorklet 形式のループでは、[ブラウザ / WASM](./wasm.md#リアルタイムボイスチェンジャー) で説明している WASM ヒープ上のリアルタイムバッファを使います。ブラウザ例の素の `processMono(...)` と違い、レンダークォンタムごとに新しい出力配列を確保せずに済みます。

## CLI のモード

`sonare voice-change` には 2 つのモードがあります。

| モード | オプション |
|--------|------------|
| 単純なピッチ／フォルマント変換 | `--pitch-semitones`、`--formant-factor` |
| リアルタイムプリセットチェーンでのレンダリング | `--preset`、`--preset-json`、`--preset-pack`、`--set PATH=VALUE` |

リアルタイムプリセット系のオプションを渡した場合、コマンドはプリセットチェーンを使います。単純なピッチ／フォルマント指定との併用は無効パラメータとして拒否されます。`--preset-pack FILE` にはエントリ選択用の `--preset ID` が必須で、先頭エントリへのフォールバックはありません。selector の規則とコマンド表は [CLI リファレンス](./cli.md#リアルタイムボイスプリセット) を参照してください。

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
  throw new Error(validation.error);
}
```

現在の組み込みプリセット JSON はスキーマバージョン `1` を使います。ネイティブ POD 設定の ABI は別物です。FFI やネイティブ境界をまたぐ場合は `voiceChangerAbiVersion()` で確認してください。2 つの JSON Schema は npm パッケージに同梱されているので、ホスト側はオフラインで文書を検証できます。

```typescript
import schema from '@libraz/libsonare/schemas/realtime-voice-changer-preset.schema.json';
```

正規のプリセット ID や解決済みのフラットなネイティブ設定だけが必要なら、JSON を往復せず `voiceCharacterPresetId(...)` と `realtimeVoiceChangerPresetConfig(...)` を使います。WASM の `voiceCharacterPresetId(...)` は正規 ID または整数の序数を受け取り、未知の数値序数は `null` を返し、未知の文字列 ID は throw します。`realtimeVoiceChangerPresetConfig(...)` は無効な序数で throw します。Python では同じネイティブ設定取得経路を `realtime_voice_changer_preset_config(...)` として公開しています。

::: warning プリセット文書は完全である必要があります
有効な文書には必須のスキーマメタデータと、完全な `dsp` または `macros` のどちらか
1 つが必要です。部分的な文書は、無関係な既定値で黙って埋められるのではなく拒否され、
`deesser.ratio` も必須です。プリセットを手で書く場合は、変更したいフィールドだけを書く
のではなく `realtimeVoiceChangerPresetJson('neutral-monitor')` を出発点にして編集して
ください。`configJson()` で設定を読み出し、編集して `setConfig(...)` で書き戻す往復は
安全です。トップレベルや各セクション内の未知のキーも拒否されます。
:::

### `macros` — 省略記法のセクション

「この声をもっと明るく」というだけのために `dsp` セクション全体を手で書くのは大がかりです。
プリセットは代わりに `macros` オブジェクトを持てます。7 つの値が通常の DSP 設定にマッピングされます。

| マクロ | 範囲 | 動かす対象 |
|--------|------|------------|
| `pitch` | −24 〜 24 | リチューン（半音） |
| `formant` | 0.55 〜 1.65 | フォルマントのスケール係数 |
| `brightness` | 0 〜 1 | フォルマントの明るさ、EQ のプレゼンスとエア |
| `space` | 0 〜 1 | リバーブミックス（チェーンの上限 0.45 まで） |
| `intensity` | 0 〜 1 | コンプレッサーのレシオ |
| `noiseControl` | 0 〜 1 | ゲートとノイズ処理 |
| `sibilance` | 0 〜 1 | ディエッサーの量 |

マクロは**入力専用**です。共有パーサーがコントロールスレッド上で通常の DSP 設定へ展開するため、
正規化された出力には現れません。設定を読み戻すと、書いたマクロではなく展開後の `dsp` セクションが
返ります。同じパラメータを対象にする場合、明示的な `dsp` セクションが常に優先されます。

0〜1 のマクロは、そのままの値が書き込まれるのではなく対象の有効範囲へマッピングされます。
`macros.space` を `1.0` にするとリバーブミックスの上限 `0.45` に到達します。範囲外の
`1.0` がパラメータに書き込まれるわけではありません。

## 実用上の注意

リアルタイム音声処理は状態を持ちます。同じ changer をブロック間で再利用し、ブロックサイズは `prepare(...)` した最大値以内に保ち、コンポーネントやストリーム停止時にはハンドルを解放してください。

大きなピッチ、フォルマント、空間処理の変更はサウンドデザインには有効ですが、自然さは下がります。自然なモニタリングではプリセット編集を控えめにし、`latencySamples()` でレイテンシを一度確認しておいてください。

::: info ここでいう「レイテンシ」とは
**レイテンシ**は、音が入ってから加工後の音が出てくるまでの遅れで、チェーンが行う解析によって生じます。`latencySamples()` はこれをサンプル数で報告するので、サンプルレートで割れば秒になります。

prepare 済みのチェーンでは値は**固定**です。リチューン経路とチェーン全体のドライ経路が
オーバーラップアド分のレイテンシに揃えられているため、ウェットやリチューンのミックスを
動かしても報告値は変わりません。したがってコントロールを動かすたびに読み直す必要はなく、
`prepare(...)` の後に一度読んで補正すれば済みます。支配的な項はリチューン段がピッチシフトの
ために解析する窓の大きさで、グレインが大きいほど 1 ステップで解析する音が増え遅延も増えます
（[StreamingRetune](./js-api.md#streamingretune) の `grainSize` フィールドを参照）。
ISP リミッターが有効な場合は、その遅延が加わります。
:::

ライブのコントロールはすべてサンプル単位でスムージングされるため、`setConfig(...)` で
新しい設定スナップショットを適用してもブロック境界で段差になりません。フォルマント量に
比例して変化するのは周波数の変位だけなので、量が 0 でもボディ・ブライトネス・ナザルは効きます。

## 関連ページ

- [編集 DSP](./editing-dsp.md)
- [ブラウザ / WASM](./wasm.md#リアルタイムボイスチェンジャー)
- [JavaScript API](./js-api.md#realtimevoicechanger)
- [Python API](./python-api.md#リアルタイムボイスチェンジャー)
- [Node.js ネイティブ API](./node-api.md#ストリーミング／リアルタイムクラス)
