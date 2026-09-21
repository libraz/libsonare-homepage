# WebAssembly ガイド

libsonare は WebAssembly にコンパイルでき、ブラウザで直接オーディオ解析が可能です。重要な原則として、その API が扱うのは生の `.mp3`/`.wav` ファイルではなく、デコード済みのオーディオサンプル（数値が並んだモノラルの `Float32Array`）です。サンプルを得る方法は 2 通りで、Web Audio API や別の JavaScript デコーダで自分でファイルをデコードするか、エンコード済みバイト列を `Audio.fromMemory*` ヘルパーに渡してデコードを任せます。全体の流れは下の表のとおりです。

このページは、ブラウザアプリを作る人向けです。Python スクリプト、ターミナルのバッチ処理、ネイティブデスクトップツールを作る場合は、先に [はじめに](./getting-started.md) で別の利用環境を選んでください。

このページでは、セットアップ、単発呼び出しの API、マスタリングを扱います。Web Worker との連携、パフォーマンスチューニング、React の例は [WASM の応用的な使い方](./wasm-advanced.md) を、ライブのストリーミング解析、逆再構成、リアルタイムボイスチェンジャーは [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md) を参照してください。

## ブラウザでの考え方

| 手順 | 内容 |
|------|------|
| 1. ファイルを取得する | `fetch`、`<input type="file">`、ドラッグ & ドロップ、その他のブラウザ入力を使う |
| 2. 音声をデコードする | `Audio.fromMemory(...)`、`Audio.fromMemoryWithBrowserFallback(...)`、`AudioContext.decodeAudioData(...)`、または独自のデコーダを使う |
| 3. サンプルを選ぶ | 1 つのモノラルチャンネルを渡す、ステレオを自分でダウンミックスする、または対応するステレオ API を使う |
| 4. libsonare を呼ぶ | サンプルと `sampleRate` を解析、編集、マスタリング、ミキシング API に渡す |

初学者がつまずきやすい点は、MP3 の `ArrayBuffer` をそのまま解析関数へ渡してしまうことです。先にデコードしてください。ブラウザ版 libsonare が扱うのは、圧縮ファイルのバイト列ではなく PCM サンプルです。

セットアップで問題が起きたときは、まず次の 3 点を確認してください。

- DSP 関数を呼ぶ前に `await init()` が完了している。
- `sampleRate` には、デコードしたサンプルのレート（通常は `audioBuffer.sampleRate`）を渡している。
- サンプル配列は PCM 音声（`Float32Array`）であり、エンコード済みファイルのバイト列ではない。

::: details Float32Array・PCM・モノラル・ダウンミックスとは？
- **PCM サンプル** は、圧縮されていない生の波形 — 振幅値の長い列です。MP3/WAV の*ファイル*は圧縮・梱包されたバイト列で、デコードすると PCM になります。
- **`Float32Array`** は、そのサンプルを 32bit 浮動小数点（通常 −1〜1 の範囲）で 1 サンプル 1 要素として保持する、Web Audio API が使う JavaScript の typed array です。libsonare のブラウザ API はこれをそのまま受け取ります。
- **モノラル／ダウンミックス** — モノラルは 1 チャンネルです。ステレオは左右の独立したチャンネルを持ち、*ダウンミックス*はそれらを 1 つにまとめます（通常は平均）。これでモノラル API に 1 チャンネルを渡せます。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- WASM パッケージを正しくインストールし、初期化できる。
- ブラウザ上のファイルを PCM へデコードし、正しいチャンネルとサンプルレートの組を libsonare に渡せる。
- 1 回呼び出しの関数、`Audio`、`StreamAnalyzer`、`StreamingMasteringChain`、`Mixer`、`RealtimeEngine` を使い分けられる。
- ブラウザアプリとして出す前に、バンドルサイズ、Worker、AudioWorklet のトレードオフを理解できる。

## インストール

### npm/yarn

::: code-group

```bash [npm]
npm install @libraz/libsonare
```

```bash [yarn]
yarn add @libraz/libsonare
```

```bash [pnpm]
pnpm add @libraz/libsonare
```

:::

### CDN

```html
<script type="module">
  import { init, detectBpm } from 'https://unpkg.com/@libraz/libsonare';
</script>
```

## 基本的な使い方

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';

async function analyzeAudio() {
  // WASM モジュールを初期化
  await init();

  // AudioContext からオーディオデータを取得
  const audioCtx = new AudioContext();
  const response = await fetch('music.mp3');
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 1 つのモノラルチャンネルを取得。ステレオ両方を反映したい場合は明示的にダウンミックスします。
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // BPM を検出
  const bpm = detectBpm(samples, sampleRate);
  console.log(`BPM: ${bpm}`);

  // キーを検出
  const key = detectKey(samples, sampleRate);
  console.log(`キー: ${key.name}`);

  // まとめて解析
  const result = analyze(samples, sampleRate);
  console.log(result);
}
```

同じ 1 ファイル確認を CLI で行う場合:

```bash
sonare bpm music.mp3
sonare key music.mp3
sonare analyze music.mp3 --json
```

下のデモは、同じデータの流れを視覚化したものです。デコード済みサンプルを入力し、時間 × 周波数の表示を出力します。ブラウザページでこの種の結果を描画できれば、WASM パッケージの読み込み、初期化、デコード、サンプルレートの受け渡しがつながっていると確認できます。

<SonareDemo id="stft-basics" />

ブラウザビルドには librosa 互換ヘルパーも含まれます。これは Python で広く使われる音声ライブラリ librosa に対応する関数群で、既存の librosa のレシピをそのまま移植できます。ざっくり次の用途別に分かれます。

- **前処理**（波形） — `preemphasis` / `deemphasis`、`trimSilence` / `splitSilence`
- **フレーミング／サイズ揃え** — `frameSignal`、`padCenter`、`fixLength`、`fixFrames`
- **後処理**（1 次元信号） — `peakPick`、`vectorNormalize`
- **特徴量** — `pcen`（メルの動的レンジ圧縮）、`tonnetz`（ハーモニック空間射影）、`tempogram` / `plp`（テンポ表現）
- **単位変換** — `powerToDb` / `amplitudeToDb` / `dbToPower` / `dbToAmplitude`、`framesToSamples` / `samplesToFrames`

シグネチャは [JS API リファレンス](./js-api-analysis.md) を、librosa との対応関係は [librosa 互換性](./librosa-compatibility.md) を参照してください。

## ブラウザ内ミキシング

WASM パッケージからミキシングエンジンも使えます。ステムを一括でレンダーするだけなら `mixStereo(...)`、バス、センド、インサートオートメーション、ゴニオメーター、ストリップメーターが必要ならシーン JSON から作る `Mixer` を使います。

```typescript
import { init, Mixer, mixStereo, mixingScenePresetJson } from '@libraz/libsonare';

await init();

const rendered = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.scheduleFaderAutomation(0, sampleRate * 4, -6, 's-curve');
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');
mixer.delete();
```

詳しくは [ミキシングエンジン](./mixing.md) を参照してください。

組み込みミキサーシーンを CLI でレンダーする場合:

```bash
sonare mix \
  --preset vocalReverbSend \
  --input vocal.wav \
  --input music.wav \
  -o mixed.wav
```

## Audio クラス

スタンドアロン関数の代わりに、`Audio` クラスをオブジェクト指向的に使うこともできます。サンプルとサンプルレートを内部で保持するため、毎回の呼び出しで渡し直す必要がありません。

```typescript
import { init, Audio } from '@libraz/libsonare';

await init();

const audioCtx = new AudioContext();
const response = await fetch('music.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

// Audio インスタンスを作成
const audio = Audio.fromBuffer(
  audioBuffer.getChannelData(0),
  audioBuffer.sampleRate
);

// 解析
const bpm = audio.detectBpm();
const key = audio.detectKey();
const result = audio.analyze();

// エフェクト
const { harmonic, percussive } = audio.hpss();
const stretched = audio.timeStretch(1.5);
const shifted = audio.pitchShift(2);

// 特徴量
const mel = audio.melSpectrogram();
const mfcc = audio.mfcc();
const chroma = audio.chroma();
const pitch = audio.pitchPyin();

console.log(`BPM: ${bpm}, キー: ${key.name}`);
console.log(`中央値ピッチ: ${pitch.medianF0.toFixed(1)} Hz`);
```

上の呼び出しに対応する CLI 例です。4 つとも Python CLI で使えます。

```bash
sonare analyze music.mp3 --json
sonare hpss music.mp3 -o separated --json
sonare pitch-shift music.wav --semitones 2 -o shifted.wav
sonare pitch music.mp3 --algorithm pyin --json
```

インスタンスメソッドの一覧は [JS API リファレンス](/ja/docs/js-api-audio#audio-クラス) を参照してください。

## ブラウザ内マスタリング

`/ja/mastering` デモは、このページで説明しているものと同じ WASM パッケージを使用しています。音源のデコードはブラウザで行い、マスタリング処理は Web Worker で実行し、レンダリング後の WAV と JSON レポートはローカルで生成されます。

実装の詳細は [マスタリング実装](./mastering-implementation.md), [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md), [マスタリング](./glossary/mastering.md), [ステレオ、リミッター、ラウドネスコントロール](./glossary/mastering/stereo-limiter-loudness.md) を参照してください。

マスタリング API には、JSON ベースのアシスタント出力、音源プロファイル、配信プラットフォーム別のプレビューを返す `masteringAssistantSuggest(...)`、`masteringAudioProfile(...)`、`masteringStreamingPreview(...)` も含まれます。

シンプルなラウドネス正規化マスターを CLI で行う場合:

```bash
sonare mastering track.wav --target-lufs -14 --ceiling-db -1 -o master.wav
```

## ファイル入力

WASM の多くの API はデコード済み PCM サンプルを受け取ります。エンコード済みバイト列を使う場合、WAV/MP3 なら `Audio.fromMemory(...)` を使います。AAC、OGG、FLAC など同梱デコーダが読めない形式も扱いたい場合は、`Audio.fromMemoryWithBrowserFallback(...)` を使うと、必要に応じて `AudioContext.decodeAudioData()` によるブラウザ側デコードへ切り替わります。

```typescript
async function analyzeFile(file: File) {
  await init();
  const audioCtx = new AudioContext();

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const samples = audioBuffer.getChannelData(0);

  return analyze(samples, audioBuffer.sampleRate);
}

// ファイル入力での使用
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await analyzeFile(file);
  console.log(`BPM: ${result.bpm}`);
});
```

## 進捗レポート

```typescript
import { init, analyzeWithProgress } from '@libraz/libsonare';

await init();

const result = analyzeWithProgress(samples, sampleRate, (progress, stage) => {
  const percent = Math.round(progress * 100);
  console.log(`${stage}: ${percent}%`);

  // UI を更新
  progressBar.style.width = `${percent}%`;
  statusText.textContent = stage;
});
```

## キャンセル

時間のかかるオフラインの解析・マスタリング呼び出しは `cancel` コールバックを受け取ります。
`onProgress` が進捗を報告するのと同じ境界でポーリングされるため、間違ったファイルを
読み込んでしまったユーザーがレンダリングの完了を待つ必要はありません。

```typescript
import {
  ErrorCode,
  init,
  isSonareError,
  masteringChainWithProgress,
} from '@libraz/libsonare';

await init();

let abandoned = false;
cancelButton.onclick = () => { abandoned = true; };

try {
  const result = masteringChainWithProgress({
    samples,
    sampleRate,
    config,
    onProgress: (progress, stage) => updateUi(progress, stage),
    cancel: () => abandoned,
  });
  render(result);
} catch (error) {
  if (!(isSonareError(error) && error.code === ErrorCode.Cancelled)) throw error;
  // ユーザーが中止を指示した場合。想定内です。
}
```

`cancel` が `true` を返すと呼び出しは中断され、`SONARE_ERROR_CANCELLED`（エラーコード 8）
で例外になります。キャンセルされた呼び出しは出力を確保しません。途中結果を読むことは
できないので、「マスターが途中まで出来た」ではなく「何も起きなかった」として扱ってください。

## ステレオからモノラルへの変換

```typescript
async function getMonoSamples(audioBuffer: AudioBuffer): Promise<Float32Array> {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // ステレオをモノラルにミックス
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);

  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }

  return mono;
}
```

## ブラウザ互換性

| ブラウザ | 最小バージョン |
|---------|---------------|
| Chrome | 57+ |
| Firefox | 52+ |
| Safari | 11+ |
| Edge | 16+ |

要件:
- WebAssembly サポート
- Web Audio API
- ES2017+ (async/await)

## パッケージの構成物

公開パッケージには、連携するいくつかの構成物が含まれます。

- **メインモジュール** — `sonare.js` と `sonare.wasm`。解析・マスタリング・ミキシング・編集の各 API を支える Emscripten ビルドです。
- **メイン API エントリ** — パッケージの `index`（`index.js` / `index.d.ts`）は `import ... from '@libraz/libsonare'` を支える tsup バンドルです。解析・マスタリング・ミキシング・編集の全 API を公開します。
- **AudioWorklet エントリ** — `worklet.js` / `worklet.d.ts`。独立した自己完結型の tsup バンドル（コード分割なし、`AudioWorkletGlobalScope` への移植を想定）で、`SonareEngine` API、worklet プロセッサクラスとその登録ヘルパー、リングバッファプロトコルを収録します。worklet レルムが独自の WASM インスタンスを初期化できるよう、メインエントリから `init` / `isInitialized` のみを再エクスポートします。
- **解析専用モジュール** — `@libraz/libsonare/analysis` エントリの背後にある `sonare-analysis.js` / `sonare-analysis.wasm`。マスタリング・ミキシング・リアルタイム・プロジェクトのバインディングを外してコンパイルしています。CI はサイズをレポートに記録しますが、増加だけでビルドを失敗させません。
- **オフライン Worker エントリ** — `@libraz/libsonare/worker` の背後にある `worker.js`。`OfflineWorkerClient` の Worker 側です。
- **ボイスチェンジャーの JSON Schema** — 2 つのプリセットスキーマが `schemas/` 以下に同梱されるため、ホストは何も取得せずにプリセット文書を検証できます。

### モジュールを自分でインスタンス化する場合

`sonare.js` / `sonare.wasm` は、パッケージがラップしている Emscripten モジュールそのものです。通常のアプリケーションがこれに直接触れる必要はありません。`@libraz/libsonare` から import すればモジュールは初期化され、レルムごとに 1 インスタンスが保たれます。こちらがサポート対象の入口です。独自ローダー、非標準のバンドル先、ヒープを自前で管理するホストなど、モジュールを自分でインスタンス化する場合にかぎり、知っておくべき入力形式がひとつあります。

::: warning マスタリングチェーンのバインディングはフラット化済みの形式だけを受け取ります
モジュールのマスタリングチェーンのエントリが受け付ける設定形式はひとつだけです。コア自身のパラメータパーサが読む、フラット化されたパラメータ列です。代わりにネストした設定オブジェクトを渡すと、呼び出しは**名指しで拒否されます** — 認識できた部分だけを適用して残りを落とすのではなく、読めない設定を明示したエラーが返ります。

**npm パッケージの利用には影響しません。** `masteringChain` と `masterAudio` は、ネストした `MasteringChainConfig` を（リペア段や denoise の設定も含めて）モジュールへ渡す前にフラット化します。したがって `@libraz/libsonare` から import しているコードは、JavaScript API の記述どおりネストした設定を渡し続けられます。該当するのは、モジュールを直接インスタンス化してネストしたオブジェクトをバインディングにそのまま渡す呼び出し側だけで、その場合も得られるのは、一部だけ適用されたチェーンではなく明確なエラーです。
:::

## バンドルサイズ

このサイズ表が対象とするのはメインモジュールとメイン API エントリです。解析専用モジュール、
realtime ランタイム、worklet バンドルは別の構成物で、ここには記載していません。解析専用
モジュールは、マスタリング・ミキシング・リアルタイム・プロジェクトの各サーフェスを含まない分、
`sonare.wasm` よりかなり小さくなります。

| ファイル | サイズ | Gzip |
|---------|--------|------|
| `sonare.js` | ~{{ wasmMeta.sonareJs.sizeKB }} KB | ~{{ wasmMeta.sonareJs.gzipKB }} KB |
| `index.js` | ~{{ wasmMeta.indexJs.sizeKB }} KB | ~{{ wasmMeta.indexJs.gzipKB }} KB |
| `sonare.wasm` | ~{{ wasmMeta.wasm.sizeKB }} KB | ~{{ wasmMeta.wasm.gzipKB }} KB |
| **合計** | ~{{ wasmMeta.total.sizeKB }} KB | ~{{ wasmMeta.total.gzipKB }} KB |

## トラブルシューティング

### AudioContext が許可されない

モダンブラウザは AudioContext を作成する前にユーザー操作が必要:

```typescript
document.addEventListener('click', async () => {
  const audioCtx = new AudioContext();
  await audioCtx.resume();
});
```

### クロスオリジンの問題

他のドメインからオーディオを読み込む場合:

```typescript
const response = await fetch(url, {
  mode: 'cors',
  credentials: 'omit'
});
```

### メモリの問題

非常に長いオーディオファイルの場合、チャンクで解析を検討:

```typescript
const CHUNK_DURATION = 60; // 秒

for (let start = 0; start < totalDuration; start += CHUNK_DURATION) {
  const chunk = samples.slice(
    start * sampleRate,
    (start + CHUNK_DURATION) * sampleRate
  );
  // チャンクを解析
}
```

### ネイティブ側の失敗は `SonareError` をスロー

C++ コアが入力を拒否したとき、WASM バインディングは数値の `code` と `codeName` を持つ構造化された `SonareError` をスローします。生の Emscripten ポインタ番号や不透明な `[object Object]` が漏れることはありません。エクスポートされた `isSonareError(...)` ガードで捕捉し、`ErrorCode` で分岐してください。詳細は[エラーハンドリング](./js-api-types.md#エラーハンドリング)を参照。

これはミキシングとプロジェクトのエントリポイントにも当てはまります。いずれも、下位の C++ 例外がそのまま表に出るのではなく、対応する C エントリポイントが定めているエラーコードを報告します。未知のインサートを指すシーンを `Mixer.fromSceneJson` に渡した場合は、コア側のメッセージを伴う `InvalidState` がスローされ、壊れたシーン JSON も同じく `InvalidState` になります（不明なエラーコードにはなりません）。成功だけを見て分岐しているコードに変更は不要です。特定のコードで分岐しているコードは、ここに挙げたコードで分岐してください。

## 各節の移動先

| 節 | ページ |
|---|---|
| Web Worker の使用 | [WASM の応用的な使い方](./wasm-advanced.md) |
| パフォーマンスのヒント | [WASM の応用的な使い方](./wasm-advanced.md) |
| React の例 | [WASM の応用的な使い方](./wasm-advanced.md) |
| ストリーミング解析 | [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md) |
| 逆再構成 | [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md) |
| Streaming Retune | [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md) |
| リアルタイムボイスチェンジャー | [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md) |
