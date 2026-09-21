# Node.js ネイティブ API

Node ネイティブバインディングの概要と選び方については、[ネイティブバインディング](./native-bindings.md) を参照してください。

このページは `@libraz/libsonare-native` アドオンの関数ごとのリファレンスです。import パスが明示的に `@libraz/libsonare` でない限り、例はネイティブパッケージを使います。

## 使用例

```typescript
import {
  Audio, analyze, detectBpm, detectKey, detectBeats, version
} from '@libraz/libsonare-native';

// 音声を読み込み
const audio = Audio.fromFile('music.mp3');
const samples = audio.getData();
const sampleRate = audio.getSampleRate();

// 個別の解析
const bpm = detectBpm(samples, sampleRate);
const key = detectKey(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);

// フル解析
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.name}`);     // "C major" など
console.log(`ビート数: ${result.beatTimes.length}`);
```

上のアナライザーはどれも同じスペクトログラムを共有して読み出します。下のデモがたどるのがその変換で、BPM とキーをまとめて求めても片方だけの場合とコストがほとんど変わらないのは、これが理由です。

<SonareDemo id="stft-basics" />

### オーディオエフェクト

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// 倍音成分／打撃成分の分離（HPSS）
const hpssResult = audio.hpss();
const harmonic = audio.harmonic();
const percussive = audio.percussive();

// タイムストレッチ／ピッチシフト
const stretched = audio.timeStretch(1.5);      // 1.5 倍速
const shifted = audio.pitchShift(2.0);         // 2 半音上げ

// ノーマライズと無音トリム
const normalized = audio.normalize(0.0);        // 0 dB
const trimmed = audio.trim(-60.0);
```

### 特徴抽出

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// スペクトログラム特徴量
const stftResult = audio.stft(2048, 512);
const mel = audio.melSpectrogram(2048, 512, 128);
const mfcc = audio.mfcc(2048, 512, 128, 13);
const chroma = audio.chroma(2048, 512);

// スペクトル特徴量
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();

// ピッチ検出
const pitchYin = audio.pitchYin();
const pitchPyin = audio.pitchPyin();
console.log(`Median F0: ${pitchPyin.medianF0.toFixed(1)} Hz`);
```

### 単位変換

```typescript
import {
  hzToMel, melToHz, hzToMidi, midiToHz,
  hzToNote, noteToHz, framesToTime, timeToFrames
} from '@libraz/libsonare-native';

hzToMel(440);        // → Mel スケール値
melToHz(549.64);     // → Hz
hzToMidi(440);       // → 69
midiToHz(69);        // → 440
hzToNote(440);       // → "A4"
noteToHz('A4');      // → 440

framesToTime(100, 22050, 512);  // → 秒
timeToFrames(2.32, 22050, 512); // → フレームインデックス
```

## API リファレンス

### 単発 API のリクエストオブジェクト

トップレベルの単発解析・エフェクト・マスタリング・メータリング・特徴量・ミキサー・ボイスチェンジャー関数は、Node でも名前付きリクエストオブジェクトを標準の呼び出し形式として受け取れます。新規コードではこちらを優先してください。位置引数のオーバーロードも互換性のため残り、同じ検証、既定値、結果、エラー、進捗処理へ正規化されます。

```ts
const bpm = detectBpm({ samples, sampleRate });
const result = masterAudio({ samples, sampleRate, preset: 'pop' });
```

対応する `*Request` TypeScript 型もパッケージからエクスポートされます。

### エラー

ライブラリ側の失敗は `SonareError` として投げられます。`name` が `'SonareError'` の
標準 `Error` に、数値の `code`（`ErrorCode` の値）と正規名の `codeName`（例:
`'InvalidParameter'`）が付いたものです。

`SonareError` は型宣言だけの存在ではなく実行時のクラスです。そのため値として
import しても実体が得られ、このパッケージでも WASM パッケージでも同じ種類のものが
返ります。共通の TypeScript モジュールがどちらの面から import しても、実行時に同じ
ものを受け取れます。

`instanceof SonareError` はプロトタイプではなく形状（ブランド）で判定します。その
ため、形状だけを備えてクラスを生成しないアドオン由来のエラーも、Worker や
`structuredClone` の境界を越えてプロトタイプを失ったエラーも絞り込めます。
`isSonareError(value)` は同じ判定を型ガードとして書いたもので、両者は互いに結び付いて
いるため食い違いません。どちらを使っても構いません。

```typescript
import { Audio, ErrorCode, isSonareError } from '@libraz/libsonare-native';

try {
  const audio = Audio.fromFile('missing.wav');
  audio.destroy();
} catch (err) {
  if (isSonareError(err)) {
    console.error(err.codeName, err.code === ErrorCode.FileNotFound);
  }
}
```

ライブラリへ届く前に弾かれる引数の形の問題（長さの食い違う 2 本の配列、許可されて
いない文字列の `mode` など）は素の `RangeError` や `TypeError` で投げられるため、
`isSonareError` では捕捉できません。

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.fromFile(path)` | WAV/MP3 ファイルを読み込み。FFmpeg 有効ビルドでは FFmpeg 対応形式も読み込めます |
| `Audio.fileChannelCount(path)` | デコードせずに音声ファイルのチャンネル数を取得。モノラルへダウンミックスする `fromFile` とは別物 |
| `Audio.fromBuffer(samples, sampleRate?)` | `Float32Array` から作成。`sampleRate` の既定値は `48000` |
| `Audio.fromMemory(data)` | `fromFile` と同じ形式対応で、`Buffer` / `Uint8Array` をデコード |
| `audio.getData()` | サンプルのコピーを `Float32Array` で返します |
| `audio.getSampleRate()` | サンプルレート（Hz） |
| `audio.getDuration()` | 長さ（秒） |
| `audio.getLength()` | サンプル数 |
| `audio.destroy()` | ネイティブハンドルを解放。GC でも回収されますが、長時間動くプロセスで確実に解放したい場合に呼び出します |

`Audio` インスタンスは、以下の解析・エフェクト・特徴量関数を同じデフォルト値で
メソッドとしても呼び出せます（例: `audio.detectBpm()`、`audio.masteringChain(config)`）。

`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` などの一部の詳細ヘルパーは
スタンドアロン関数のままです。これらには `audio.getData()` と `audio.getSampleRate()` を渡します。

::: warning `getData()` はコピーを返します
呼び出すたびに新しい `Float32Array` を確保するため、返された配列に書き込んでも
インスタンスが保持する音声は変わりません。あとから `audio.detectBpm()` や
`audio.masteringChain(...)` を呼んでも、読み取られるのは元のサンプルです。
編集後のサンプルを処理するには `Audio.fromBuffer(edited, sampleRate)` で
新しいインスタンスを作ってください。ループ内で読む場合は配列を自分でキャッシュします。
WASM でも同じ挙動です。
:::

### `using` によるクリーンアップ（Node 22 以上）

ネイティブハンドルを持つクラス（`Audio`、`RealtimeEngine`、`Project`、`Mixer`、
`ClipPageProvider`）はすべて `[Symbol.dispose]` を実装しています。そのため
Node 22 以上では `using` キーワードを使うと、スコープを抜けるときに例外発生時でも
安全に自動でクリーンアップできます。

```typescript
import { RealtimeEngine } from '@libraz/libsonare-native';

function render() {
  using engine = new RealtimeEngine(48000, 128);
  engine.setTempo(120);
  // 例外が起きても、このスコープを抜けるときにハンドルが解放されます。
}
```

Node 22 未満では、これまでどおり `try/finally` で明示的に解放するパターンを使ってください。
すべてのハンドルクラスでネイティブの正規の解放メソッドは `destroy()` です。`Project` と
`Mixer` は WASM 互換のエイリアスとして `delete()` も公開します。ハンドルは最終的に GC でも
回収されますが、`using` や明示的な解放のほうが決定的なクリーンアップになるため、
長時間動くプロセスではそちらを推奨します。

`RealtimeVoiceChanger` も明示的な `destroy()` に加えて `[Symbol.dispose]` を実装しているため、
`using` を使えます。`StreamingMasteringChain`、`StreamingEqualizer`、`StreamAnalyzer` も同様に
冪等な `destroy()` と `[Symbol.dispose]` を公開しており、決定的に解放できます。

### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detectBpm(samples, sampleRate?)` | `number` | テンポ（BPM） |
| `detectKey(samples, sampleRate?)` | `Key` | ルート、モード、確信度 |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | ビート位置 |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | オンセット位置 |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?, useHmm?, hmmBeamWidth?, useKeyContext?, keyRoot?, keyMode?, detectInversions?, chromaMethod?)` | `ChordAnalysisResult` | コード進行（開始／終了時刻付き）。`threshold` 未満のフレームは明示的な `N.C.` 区間として返ります。末尾の引数で HMM 平滑化・キーコンテキスト・転回形・クロマ手法（既定 `'stft'`）を制御 |
| `detectDownbeats(samples, sampleRate?)` | `Float32Array` | 小節頭（ダウンビート）の位置 |
| `detectKeyCandidates(samples, sampleRate?, options?)` | `KeyCandidate[]` | 相関スコア付きのキー候補ランキング |
| `analyze(samples, sampleRate?, options?)` | `AnalysisResult` | 1 回の呼び出しで、BPM と順位付き BPM 仮説、キー、拍子と順位付き拍子候補、ビート、コード、セクション、音色、ダイナミクス、リズム、メロディ、フォームを解析。以下の専用 `detect*`／`analyze*` 関数は、個別解析やパラメータ指定の解析向けに引き続き利用できます |
| `analyzeWithProgress(samples, sampleRate?, onProgress?)` | `AnalysisResult` | `analyze` と同じ。長尺入力向けに `(progress, stage)` コールバックを受け取ります |
| `estimateMeter(request)` | `MeterEstimate` | 呼び出し側が渡したビート列に対して拍子を採点します。音声も再解析も不要。リクエスト専用で `EstimateMeterRequest` を受け取ります |
| `analyzeBpm(samples, sampleRate?, options?)` | `BpmAnalysisResult` | 確信度と候補付きテンポ。`options`: `bpmMin`、`bpmMax`、`startBpm`、`nFft`、`hopLength`、`maxCandidates` |
| `analyzeRhythm(samples, sampleRate?, options?)` | `RhythmResult` | 拍子・グルーブ・シンコペーション。`options`: `bpmMin`、`bpmMax`、`startBpm`、`nFft`、`hopLength` |
| `analyzeDynamics(samples, sampleRate?, options?)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター。`options`: `windowSec`、`hopLength`、`compressionThreshold` |
| `analyzeTimbre(samples, sampleRate?, options?)` | `TimbreResult` | 明るさ・暖かさ・密度・粗さ・複雑さと、窓ごとの `timbreOverTime`。`options`: `nFft`、`hopLength`、`nMels`、`nMfcc`、`windowSec` |
| `analyzeSections(samples, sampleRate?, options?)` | `Section[]` | 構造セクション（イントロ／Aメロ／サビなど）と時刻。`options`: `nFft`、`hopLength`、`minSectionSec`。長尺入力では境界グリッドがプーリングされる場合があるため、配置には各セクションの `start` / `end` を使います |
| `detectBoundaries(request)` | `BoundaryResult` | 構造の転換点と、それを拾い出した元のノヴェルティ曲線、および両者が乗るグリッド。`request`: `samples`、`sampleRate`、`nFft`、`hopLength`、`kernelSize`、`threshold`、`absoluteThreshold`、`nMfcc`、`nChroma`、`peakDistance`、`useMfcc`、`useChroma`。`analyzeSections` のラベル付き区間ではなく、自前のしきい値を当てたいときに使います |
| `analyzeMelody(samples, sampleRate?, options?)` | `MelodyResult` | 主旋律の輪郭（フレームごとの F0）。`options`: `fmin`、`fmax`、`frameLength`、`hopLength`、`threshold`、`usePyin`、`center` |
| `detectAcoustic(samples, sampleRate?, options?)` | `AcousticResult` | 録音からのルーム音響（残響が 60 dB 減衰するまでの時間である RT60 など）。`options`: `nOctaveBands`、`nThirdOctaveSubbands`、`minDecayDb`、`noiseFloorMarginDb` |
| `analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?, minDecayDb?)` | `AcousticResult` | 測定済みインパルス応答（IR）からのルーム音響。`minDecayDb` は減衰フィットのしきい値（既定 `30`） |
| `estimateRoom(samples, sampleRate?, options?)` | `RoomEstimateResult` | 体積、寸法、DRR（直接音と残響音のエネルギー比）、吸音率バンド、RT60 バンド、信頼度を含む等価ルーム推定 |
| `synthesizeRir(options?)` | `RirResult` | シューボックス形状からのモノラル RIR（ルームインパルス応答） |
| `roomMorph(samples, sampleRate, options?)` | `Float32Array` | 目標ルームへ寄せるオフラインのルームモーフィング |
| `lufs(samples, sampleRate?)` | `LufsResult` | 統合値、最後のモーメンタリー／ショートターム窓、EBU R128 の最大値（Max-M / Max-S）、ラウドネスレンジ |
| `lufsInterleaved(samples, channels, sampleRate?)` | `LufsResult` | インターリーブサンプルからチャンネル重み付きマルチチャンネルラウドネスを測定 |
| `ebur128LoudnessRange(samples, sampleRate?)` | `number` | EBU R128 準拠のラウドネスレンジ（LRA、LU 単位） |
| `momentaryLufs(samples, sampleRate?)` | `Float32Array` | モーメンタリーラウドネス（400ms）の時系列 |
| `shortTermLufs(samples, sampleRate?)` | `Float32Array` | ショートタームラウドネス（3s）の時系列 |
| `version()` | `string` | ライブラリバージョン |
| `voiceChangerAbiVersion()` | `number` | リアルタイムボイスチェンジャー POD 設定の ABI バージョン。プリセット JSON の `schemaVersion` とは別 |
| `voiceCharacterPresetId(preset)` | `VoicePresetId \| null` | 正規の voice-character プリセット ID。未知の数値序数は `null`、未知の文字列 ID は例外 |
| `realtimeVoiceChangerPresetConfig(preset)` | `RealtimeVoiceChangerConfig` | JSON 解析なしで、組み込みボイスプリセットの解決済みフラット POD 設定を返す。未知のプリセット名や範囲外の序数では例外を投げる |
| `hasFfmpegSupport()` | `boolean` | 読み込まれたネイティブアドオンが FFmpeg デコードに対応しているか |

デフォルトの `sampleRate` は、ヘルパーの種類によって異なります。

| ヘルパー | デフォルト `sampleRate` |
|----------|-------------------------|
| 楽曲解析、エフェクト、特徴量、ラウドネス系ヘルパー | `22050` |
| ネイティブ版の `analyzeImpulseResponse`、`detectAcoustic`、`estimateRoom`、`synthesizeRir` | `48000` |

主要なヘルパーは `Audio` インスタンスメソッドとしても利用できます。ただし、`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` など一部の詳細ヘルパーは、スタンドアロン関数として `audio.getData()` と `audio.getSampleRate()` を渡します。

下の表は Node ネイティブ版のシグネチャです。WASM パッケージも同じ camelCase 名を使いますが、`sampleRate` の後ろに必須引数がある関数では、その `sampleRate` 位置も渡す必要があります。ブラウザ向けの正確なシグネチャは [JavaScript API](./js-api.md) を参照してください。

#### `analyze()` のオプション

`analyze(...)` は第 3 引数にオプションオブジェクトを受け取ります。リクエスト
オブジェクト形式では同じフィールドを直接指定できます。パイプライン全体の設定が
ここにまとまっています。

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `nFft` / `hopLength` | `2048` / `512` | パイプライン全体で共有する STFT 解像度 |
| `bpmMin` / `bpmMax` / `startBpm` | `60` / `200` / `120` | テンポ探索範囲と事前推定値 |
| `useTriadsOnly` | `true` | コード探索を三和音に限定します |
| `useHpss` | `true` | コード／キー検出で倍音成分のみのクロマを使います |
| `chromaHighpassHz` | `80` | クロマのハイパスカットオフ（Hz、`0` で無効） |
| `useBassWeighted` | `true` | 低音重み付きのクロマ合成 |
| `chromaHopMultiplier` | `4` | クロマのホップ倍率。大きいほど高速 |
| `useChordHmm`、`useChordKeyContext`、`chordHmmBeamWidth`、`detectChordInversions` | — | コードの後処理。`detectChords(...)` の末尾引数と同じ内容です |
| `adaptiveTempo` | `false` | ビートトラッキングで局所的に更新されるテンポ事前分布を追従します |
| `tempoUpdateIntervalBeats` | `8` | 局所テンポの文脈長（ビート数）。`adaptiveTempo` を有効にしたときだけ参照されます |
| `computeTempoCurve` | `false` | ビートごとの局所テンポ曲線を `beatLocalBpm` へデコードします |
| `meterCandidateNumerators` | `[3, 4, 6]` | 拍子推定が採点する分子。最大 16 個、各値は `[2, 32]`。空リストは既定値へ戻らずエラーになり、候補を広げても広い拍子が選ばれやすくなるわけではありません |
| `meterDenominator` | `4` | 検出された拍子の分母。`[1, 32]` の 2 の冪。複合拍子と判定した場合は推定側が自分で 8 を報告します |

::: warning ここでは `useTriadsOnly` の既定値が逆向きです
統合された `analyze()` の経路では `useTriadsOnly` が **`true`** で、スタンドアロンの
`detectChords(...)` では `false` です。つまり `analyze()` は呼び出し側が
`useTriadsOnly: false` を渡すまで三和音だけを探索し、7th やテンションは報告しません。
:::

`computeTempoCurve` が既定で無効なのは、この曲線が解析の精度を上げるものではなく
追加の出力だからです。ほかのフィールドは何も変わらないため、曲線を読まない
呼び出し側はビートグリッド全体のデコードを無駄に払うことになります。また曲線は
デコード元のビートグリッドを記述したものであり、ビートトラッキングは
`adaptiveTempo` を併用しない限り固定のテンポ事前分布を保持します。実際に動くテンポを
測るには両方のオプションが必要です。

#### `estimateMeter(...)`

`estimateMeter(...)` は、**呼び出し側が渡したビート列**に対して拍子を採点します。
読むのはビートごとの時刻とアクセント値だけで音声は読まないため、既存の解析結果
（あるいはその任意の区間）をパイプラインを再実行せずに採点し直せます。概念的な
背景は [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) を参照して
ください。

```typescript
const result = analyze(samples, sampleRate);

const meter = estimateMeter({
  beatTimes: result.beats.map((beat) => beat.time),
  beatStrengths: result.beatObservations.onsetStrength,
  candidateNumerators: [3, 4, 5, 6, 7],
});

console.log(meter.searched, meter.timeSignature.numerator, meter.grouping);
```

| フィールド | 既定値 | 説明 |
|------------|--------|------|
| `beatTimes` | — | ビート位置（秒）。単調非減少であること |
| `beatStrengths` | — | ビートごとのアクセント値。`beatTimes` と同じ長さ。採点前に系列自身の最大値で割られるため、事前のスケーリングは不要です |
| `candidateNumerators` | `[3, 4, 6]` | 採点する分子。最大 16 個、各値は `[2, 32]` |
| `denominator` | `4` | 検出された拍子として報告する分母 |
| `downbeatWeight` / `measureWeight` / `subdivisionWeight` | `1` / `0.5` / `0.15` | 小節頭のアクセント、小節間のアクセント一致、細分化パターンに対する重み |

`beatStrengths` には `beatObservations.onsetStrength` を渡してください。これは
ライブラリ自身のダウンビート推定が採点している窓付きの値です。`beats[].strength`
でも動きますが、こちらは同じ包絡線の窓なし 1 フレームです。

結果が意味を持つかどうかは、次の 2 点で決まります。

- **既定の候補集合は `{3, 4, 6}` です。** 分子を明示的に挙げたときだけその拍子が
  報告されるため、7 拍子を検出したいなら候補に 7 を入れる必要があります。
- **ビート列が 8 ビート未満のとき `searched` は `false` になります。** このとき
  ほかのフィールドはすべて測定結果ではなく固定のフォールバック値で、
  `timeSignature.confidence` もフォールバック自身の値です。短い区間の答えを検出
  結果として扱う前に `searched` を確認してください。

`grouping` は小節がアクセントのグループへどう分かれるかを表すため、7 拍子は素の 7 では
なく `[3, 2, 2]` のように返り、合計は必ず分子に一致します。要素が 1 つだけの場合は
内部の分割が解決できなかったことを意味します。`candidateScores` は標準化された符号
付きの値で、リクエストで分子を並べた順に格納されます。拍子を持たないビートに対して
分子が到達する水準が 0 なので、意味を持つのは順序と値の差だけです。またスコアは
採点したビート数の平方根に比例して大きくなります。一方 `candidates` は支持の高い順に
並ぶため、両者は添字ではなく `numerator` で突き合わせてください。

#### 非同期版（Node 専用）

Node アドオンは、Promise 返却版も公開しています。これらは DSP パイプラインを libuv のワーカースレッドで実行するため、JS イベントループをブロックしません。

戻り値の形は同期版と同じで、これらの関数自体は Node ネイティブ専用です。ブラウザでは `@libraz/libsonare/worker` の `OfflineWorkerClient` を使うと、同名関数ではなくタスク形式の API で解析とマスタリングを Web Worker 上へ移せます。

非同期版では進捗コールバックを使えません。進捗が必要な場合は `onProgress` 付きの同期版を使います。並行実行だけが目的なら、複数の非同期呼び出しを同時に走らせます。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `analyzeAsync(samples, sampleRate?)` | `Promise<AnalysisResult>` | `analyze(...)` の非同期版 |
| `masterAudioAsync(samples, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainResult>` | `masterAudio(...)` の非同期版 |
| `masterAudioStereoAsync(left, right, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainStereoResult>` | `masterAudioStereo(...)` の非同期版 |

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS）。既定は `nFft=2048`、`hopLength=512`、`hardMask=false` |
| `hpssWithResidual(samples, sr?, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` | `HpssWithResidualResult` | 倍音、打撃、残差を返す HPSS。同じ STFT／マスクオプションを受け取ります |
| `harmonic(samples, sr?)` | `Float32Array` | 倍音成分の抽出 |
| `percussive(samples, sr?)` | `Float32Array` | 打撃成分の抽出 |
| `timeStretch(samples, sampleRate, rate, nFft?, hopLength?)` | `Float32Array` | ピッチを変えずにテンポを変更。既定は `nFft=2048`、`hopLength=512` |
| `phaseVocoder(samples, sampleRate, rate, nFft?, hopLength?)` | `Float32Array` | 直接のフェーズボコーダー時間伸縮 |
| `pitchShift(samples, sampleRate, semitones, nFft?, hopLength?)` | `Float32Array` | 長さを変えずにピッチを変更。既定は `nFft=2048`、`hopLength=512` |
| `remix(samples, intervals, sr?, alignZeros?)` | `Float32Array` | サンプル区間の並べ替え／連結 |
| `remixAlignedIntervals(samples, intervals, sr?, alignZeros?)` | `Int32Array` | `remix` が使う切り貼り位置を、切らずに返します。入力区間ごとにクランプ済みの `(start, end)` を 1 組ずつ並べた平坦な配列。ここでは `alignZeros` の既定値が `true` |
| `normalize(samples, sr?, targetDb?, mode?)` | `Float32Array` | 目標ピーク／RMS dB にノーマライズ（`mode`: `'peak'` または `'rms'`、既定 `'peak'`） |
| `normalizeStereo(request)` | `NormalizeStereoResult` | 両チャンネルにまたがって測ったレベルでステレオペアをノーマライズ。リクエスト専用で `NormalizeStereoRequest` を受け取ります |
| `trim(samples, sr?, thresholdDb?, frameLength?, hopLength?)` | `Float32Array` | 無音区間をトリム（既定: `-60.0` dB、`frameLength=2048`、`hopLength=512`） |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | 目標サンプルレートへリサンプリング |
| `pitchCorrectToMidi(samples, sr, currentMidi, targetMidi)` | `Float32Array` | 保持された音を MIDI ピッチ間で補正 |
| `pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sr?, hopLength?, voiced?, voicedProb?)` | `Float32Array` | 追跡したピッチ輪郭を、フレーム単位で固定の音へリチューン。`voiced` は `VoicedFlags` を受け取る |
| `pitchCorrectTimevarying(samples, f0Hz, sr?, hopLength?, options?)` | `Float32Array` | 追跡したピッチ輪郭をスケールまたは固定音へスナップ。`options` は `PitchCorrectOptions` で、その `voiced` フィールドも `VoicedFlags` を受け取る |
| `noteStretch(samples, sr?, options?)` | `Float32Array` | 1 つの音の区間をその場でタイムストレッチ。`options` は `{ onsetSample, offsetSample, stretchRatio }` |
| `voiceChange(samples, sr?, options?)` | `Float32Array` | ボイス変換のためのピッチ＋フォルマントシフト。`options` は `{ pitchSemitones, formantFactor }` |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の `trimSilence(...)` は
librosa 互換のフレーム RMS ベースのヘルパーで、元音源上のサンプル範囲も返します。

`hpss(...)` と `hpssWithResidual(...)` は、メディアンフィルターのカーネルを既定で
`kernelHarmonic=31`、`kernelPercussive=31` とします。リクエストオブジェクト形式でも
位置引数形式と同じ `nFft`、`hopLength`、`hardMask` の名前を使います。

#### `remix` でステレオ素材を切る

ゼロクロスへのスナップは信号ごとの判断です。そのため `remix(...)` をチャンネル
ごとに呼ぶと、各チャンネルが別々のフレームへスナップし、ステレオ素材の左右が
ずれていきます。片方のチャンネルから `remixAlignedIntervals(...)` で切り貼り位置を
1 組だけ決め、それを全チャンネルへ適用してください。既定値は両者で逆向きです。
`remix` の `alignZeros` は false、`remixAlignedIntervals` は true です。

スナップで区間が消えないように、2 つのガードがあります。符号の変化がまったくない
信号（無音、DC オフセット、あらゆる定数）はスナップされません。また、内容が
あったのにスナップ後に空へ潰れる区間は、スナップ前の境界を保ちます。

#### ステレオペアのノーマライズ

`normalizeStereo({ left, right, sampleRate?, targetDb?, mode? })` は、両チャンネルへ
**1 つの**ゲインを適用するため、ステレオイメージが保たれます。チャンネルごとの
ゲインは、小さいほうを持ち上げて左右のレベルを揃えてしまうため、ノーマライズでは
なくバランス変更になります。結果が `appliedGainDb` を 1 つだけ返し、ペアが無音の
ときはちょうど `0` を返して何も変えないのはこのためです。`mode: 'peak'`（既定）は
ペアのピークを `targetDb` へ合わせるため、大きいほうのチャンネルが `targetDb` に
届き、もう一方はその差を保ちます。`mode: 'rms'` は両チャンネルのサンプルをまとめた
二乗平均平方根（チャンネルごとの値の平均ではなく二乗平均）を合わせ、結果を
[-1, 1] にハードクリップします。

モノラルの `normalize(...)` は `targetDb` の既定値がどちらのモードでも `0` ですが、
`normalizeStereo` は **モードによって既定値が変わります**。`'peak'` では `0`、
`'rms'` では `-20` です。0 dBFS の RMS は実用的な目標ではありません。ピークは RMS
よりはるかに上にあるため、事実上すべてのピークがクリップします。

`VoicedFlags` は `Int32Array | Uint8Array | Float32Array | readonly number[] |
readonly boolean[]` です。`PitchResult.voicedFlag` が返す `boolean[]` を、変換なしで
そのままピッチ補正へ渡せます。

```typescript
const pitch = pitchPyin(samples, sampleRate);
const tuned = pitchCorrectToMidiTimevarying(
  samples,
  pitch.f0,
  69,
  sampleRate,
  512,
  pitch.voicedFlag,   // boolean[] is accepted as-is
);
```

`voicedProb` から有声判定を導くのは、`voiced` を省略したときだけです（0.5 以上の
フレームを有声とみなします）。`voiced` を渡した場合、`voicedProb` は完全に無視され
ます。特にフレームごとの補正量へ重みを掛けることはないため、両方渡しても `voiced`
だけを渡した場合と結果は同じです。`pitchCorrectTimevarying(...)` の
`PitchCorrectOptions.voicedProb` も同じ挙動です。

::: warning 補正の強さは `voicedProb` で重み付けされません
補正が `voicedProb` でスケールされる前提のコードは、**低音域でより強く補正される**
ことになります。pYIN の有声確率は、確信度ではなく基音の高さとともに増える周波数依存
の観測量です。これを重みとして使うと、低音域の補正が気付かないうちに弱まっていました。
:::

`voiced` と `voicedProb` は、どちらも `f0Hz` と同じ長さである必要があります。長さが
食い違うと `RangeError`（`'voiced must have the same length as f0Hz'`）を投げます。
`SonareError` ではないため `isSonareError` では捕捉できません。

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sr?, nFft?, hopLength?)` | `StftResult` | 短時間フーリエ変換 |
| `stftDb(samples, sr?, nFft?, hopLength?)` | `StftDbResult` | dB 単位の STFT |
| `melSpectrogram(samples, sr?, nFft?, hopLength?, nMels?)` | `MelSpectrogramResult` | メルスペクトログラム |
| `mfcc(samples, sr?, nFft?, hopLength?, nMels?, nMfcc?, fmin?, fmax?, htk?, lifter?)` | `MfccResult` | メル周波数ケプストラム係数（`lifter` 既定 0 = リフタリングなし） |
| `chroma(samples, sr?, nFft?, hopLength?)` | `ChromaResult` | クロマ特徴量 |
| `spectralCentroid(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル重心 |
| `spectralBandwidth(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル帯域幅 |
| `spectralRolloff(samples, sr?, nFft?, hopLength?, rollPercent?)` | `Float32Array` | フレームごとのスペクトルロールオフ |
| `spectralFlatness(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル平坦度 |
| `spectralContrast(samples, sr?, nFft?, hopLength?, nBands?, fmin?, quantile?)` | `Matrix2dResult` | スペクトルコントラスト。形状は `(nBands + 1) x nFrames` |
| `spectralEdit(samples, sr, ops?, options?)` | `Float32Array` | `gain`、`attenuate`、`mute`、`heal` を使う領域指定 STFT 編集 |
| `polyFeatures(samples, sr?, nFft?, hopLength?, order?)` | `Matrix2dResult` | フレームごとの多項式スペクトル係数 |
| `zeroCrossingRate(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | フレームごとのゼロ交差率 |
| `zeroCrossings(samples, threshold?, refMagnitude?, pad?, zeroPos?)` | `Int32Array` | ゼロ交差サンプル位置 |
| `rmsEnergy(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | フレームごとの RMS エネルギー |
| `pitchYin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | YIN ピッチ推定。無声音の `f0` は `fillNa` が true でない限り `NaN` |
| `pitchPyin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | pYIN ピッチ推定。無声音の `f0` は `fillNa` が true でない限り `NaN` |
| `pitchTuning(frequencies, resolution?, binsPerOctave?)` | `number` | 周波数列からチューニングずれを推定 |
| `estimateTuning(samples, sr?, nFft?, hopLength?, resolution?, binsPerOctave?)` | `number` | 音声からチューニングずれを推定 |
| `cqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | 定 Q 変換の振幅 |
| `vqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?, gamma?)` | `CqtResult` | 可変 Q 変換の振幅（`gamma` で Q を制御） |
| `chromaCqt(samples, sr?, hopLength?, nChroma?)` | `{ nChroma, nFrames, data }` | Constant-Q クロマグラム（`librosa.feature.chroma_cqt` 相当） |
| `nnlsChroma(samples, sr?, options?)` | `{ nChroma, nFrames, data }` | NNLS クロマグラム（音符活性化クロマ）。`options.hopLength` の既定値は `512` |
| `decompose(s, nFeatures, nFrames, nComponents, nIter?, beta?, init?)` | `DecomposeResult` | 行優先スペクトログラムから NMF（非負値行列因子分解）の分解行列を返す。`init` を選択できる（`'random'` 既定、`'nndsvd'`） |
| `decomposeStems(request)` | `DecomposeStemsResult` | 元の位相を保持する NMF 分離。各成分をそのまま音として再生できます。リクエスト専用で `DecomposeStemsRequest` を受け取ります |
| `noteSegments(request)` | `NoteSegment[]` | 呼び出し側が渡した単旋律の F0 系列を、安定した音符区間へ分割します。リクエスト専用で `NoteSegmentsRequest` を受け取ります |
| `hybridCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | ハイブリッド CQT 振幅（低域は真の CQT、高域は擬似 CQT） |
| `pseudoCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | 近似（擬似）CQT 振幅（単一 FFT） |
| `bassChroma(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | 低域重視クロマ（低音域のピッチクラス分布） |
| `chromaCens(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | CENS エネルギー正規化・平滑化クロマ |
| `onsetStrengthMulti(samples, sr?, nFft?, hopLength?, nMels?, nBands?)` | `{ nBands, nFrames, data }` | マルチバンドオンセット強度（`nBands` 既定 3、`data` は行優先 `[nBands x nFrames]`） |
| `nnFilter(s, nFeatures, nFrames, aggregate?, k?, width?)` | `Matrix2dResult` | 近傍フィルタ |
| `onsetEnvelope(samples, sr?, nFft?, hopLength?, nMels?)` | `Float32Array` | オンセット強度の包絡線。フレームごとにエネルギーがどれだけ急に立ち上がったかを表し、テンポグラム系の入力になります |

主な既定値は、`nFft=2048`、`hopLength=512`、`nMels=128`、`nMfcc=20`、ピッチ検出の `fmin=65.0`、`fmax=2093.0`、`threshold=0.1`、`rollPercent=0.85` です。

CQT/VQT は `fmin=32.70319566` Hz（C1）、`nBins=84`、`binsPerOctave=12` を使います。VQT の既定 `gamma=-1` は ERB 由来の帯域幅を自動選択します。`chromaCqt` の既定は `nChroma=12`、`nBins=252`、`binsPerOctave=36` です。`bassChroma` と `chromaCens` は `nChroma=12`、`onsetStrengthMulti` は `nBands=3`、`decompose` は `nIter=50`・`beta=2`・`init='random'` が既定です。

#### `decompose` と `decomposeStems` の違い

`decompose(...)` が返すのは*振幅*スペクトログラムの W／H 因子です。この因子は位相を
持たないため、そこから再構成するには位相推定が必要で、推定した位相ではステムとして
使える品質になりません。`decomposeStems(...)` は同じ因子分解から成分ごとのソフト
マスクを作り、それを**元の複素**スペクトログラムへ適用します。そのため各成分は元音源の
位相をそのまま保ちます。マスクはモデルにエネルギーがある場所で総和が 1 になり、逆 STFT
は線形なので、成分を足し合わせると入力へ戻ります。

`maskPower` は分離の強さを決めます。`1`（既定）は振幅比、`2` は Wiener 型のパワー比で、
より強く分離する代わりに倍音が重なる箇所でアーティファクトが増えます。
`decomposeStems` の既定値は `nComponents=4`、`nFft=2048`、`hopLength=512`、`nIter=100`、
`beta=2`、`init='random'` です。戻り値は成分ごとの信号 `components`（それぞれ入力と同じ
長さ）と、`w`／`h` 行列、`sampleRate` です。

::: warning NNDSVD の因子は保存済みのものと一致しません
NNDSVD の初期化は倍精度で計算されます。振幅スペクトログラムの末尾の特異ベクトルは
単精度のノイズフロアに埋もれているため、単精度の初期化は加算順序に依存し、wasm32 と
arm64 とで異なる成分が返っていました。倍精度の初期化により、ビルドをまたいで再現する
結果になります。形状、非負性、再構成品質には影響しません（精度ではなく再現性の話です）。
ただし**保存済みの因子**を持っている場合や、以前に書き出したステムと比較する場合は、
`init: 'nndsvd'` の結果が異なります。
:::

#### `noteSegments`

`noteSegments({ f0Hz, voicedProb, frameRate, ... })` は、呼び出し側が渡した単旋律の F0
系列を安定した音符区間へ分割し、区間ごとに `frameStart`、`frameEnd`、`startSeconds`、
`endSeconds`、`medianCents` を持つ `NoteSegment` を返します。調整用のフィールドは
`segmentationThresholdCents`（既定 `50`）、`minNoteMs`（既定 `30`）、`referenceHz`
（既定 `440`）、そして `voicedThreshold`（既定 `0.5`）で、最後のものはフレームを有声と
みなす `voicedProb` の下限です。

::: warning pYIN の `voicedProb` をそのまま渡さないでください
`voicedProb` はフレームの有声**観測量**であり、フレーム長が固定なら F0 とともに増え、
確信度を表しません。そのため固定のしきい値では、低音域の素材に対して気付かないうちに
**区間がまったく返らなくなります**。`pitchPyin` の `voicedFlag` を `0`／`1` へ変換して
渡すか、`voicedThreshold` を下げてください。
:::

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため往復はロスを伴います。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `melToStft(mel, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | メルスペクトログラムから線形 STFT パワーへ |
| `melToAudio(mel, nMels, nFrames, sr?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | メルスペクトログラムから音声へ（Griffin-Lim） |
| `mfccToMel(mfcc, nMfcc, nFrames, nMels?, lifter?)` | `InverseMelResult` | MFCC 係数からメルスペクトログラムへ |
| `mfccToAudio(mfcc, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | MFCC 係数から音声へ |
| `cqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, nIter?)` | `Float32Array` | row-major CQT 振幅行列から音声へ（Griffin-Lim） |
| `vqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, gamma?, nIter?)` | `Float32Array` | row-major VQT 振幅行列から音声へ（Griffin-Lim） |

### librosa 互換ヘルパー

対応する `librosa` 関数の挙動に
合わせています。マッピングの全体像は
[librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trimSilence` / `splitSilence`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frameSignal` / `padCenter` / `fixLength` / `fixFrames`** — 固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peakPick` / `vectorNormalize`** — 1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`** — クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `preemphasis(samples, coef?, zi?)` | `Float32Array` | プリエンファシス |
| `deemphasis(samples, coef?, zi?)` | `Float32Array` | ディエンファシス |
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim`。しきい値 `trim(...)` とは別物 |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split`。`[start0, end0, start1, end1, ...]` のフラット配列 |
| `splitSilenceCommon(request)` | `Int32Array` | 同じパートの複数テイクが揃って無音だと認める切れ目。`request`: `signals`、`topDb`、`frameLength`、`hopLength`。配列の形は同じで、テイクの長さが揃っていなくてもパディングは不要 |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame`（row-major） |
| `padCenter(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`。`normType`: 0=inf, 1=L1, 2=L2, 3=power。Node wrapper の `threshold` 既定値は `0.0`、WASM は `1e-12` |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen`（row-major のメル入力） |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz`（`[6 x nFrames]`） |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?, mode?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram`。`mode` は `'autocorrelation'`（既定）または `'cosine'` |
| `fourierTempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nBins: number; nFrames: number; data: Float32Array }` | `librosa.feature.fourier_tempogram` |
| `cyclicTempogram(onsetEnvelope, sr?, hopLength?, winLength?, center?, norm?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | 巡回（テンポオクターブ不変）テンポグラム |
| `tempogramRatio(tempogramData, winLength?, sr?, hopLength?, factors?)` | `Float32Array` | `librosa.feature.tempogram_ratio`。factors の既定値は `[0.5, 1, 2, 3, 4]` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

### 変換関数

| 関数 | 説明 |
|------|------|
| `hzToMel(hz)` | ヘルツ → Mel スケール |
| `melToHz(mel)` | Mel スケール → ヘルツ |
| `hzToMidi(hz)` | ヘルツ → MIDI ノート番号 |
| `midiToHz(midi)` | MIDI ノート番号 → ヘルツ |
| `hzToNote(hz)` | ヘルツ → 音名（例: "A4"） |
| `noteToHz(note)` | 音名 → ヘルツ |
| `framesToTime(frames, sr?, hopLength?)` | フレームインデックス → 秒（`sr` 既定 `22050`、`hopLength` 既定 `512`） |
| `timeToFrames(time, sr?, hopLength?)` | 秒 → フレームインデックス（`sr` 既定 `22050`、`hopLength` 既定 `512`） |
| `framesToSamples(frames, hopLength?, nFft?)` | フレームインデックス → サンプルインデックス（`librosa.frames_to_samples`） |
| `samplesToFrames(samples, hopLength?, nFft?)` | サンプルインデックス → フレームインデックス（`librosa.samples_to_frames`） |
| `powerToDb(values, ref?, amin?, topDb?)` | パワー → dB（`librosa.power_to_db`） |
| `amplitudeToDb(values, ref?, amin?, topDb?)` | 振幅 → dB（`librosa.amplitude_to_db`） |
| `dbToPower(values, ref?)` | dB → パワー |
| `dbToAmplitude(values, ref?)` | dB → 振幅 |

### メータリング関数

レベル・ダイナミクス・ステレオイメージを測る単体メーターです。各関数は `validate` フラグ（既定 `true`）を持つ `options` を任意で受け取ります。ホットパスでは `{ validate: false }` を渡して NaN/Inf 入力チェックを省略できます。ステレオメーターは `left` と `right` が同じ長さである必要があります。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `meteringPeakDb(samples, sr?, options?)` | `number` | サンプルピーク（dBFS） |
| `meteringRmsDb(samples, sr?, options?)` | `number` | RMS レベル（dBFS） |
| `meteringCrestFactorDb(samples, sr?, options?)` | `number` | クレストファクター（ピーク − RMS、dB）。値が大きいほどピークとレベルの差が大きく、圧縮されていない信号を意味します |
| `meteringCrestFactorDbStereo(request)` | `number` | チャンネルペアのクレストファクター（dB）。ピークは左右をまたいで取り、RMS は左右まとめて測ります。リクエスト専用で、`MeteringStereoRequest`（`{ left, right, sampleRate?, validate? }`）だけを受け取り、位置引数のオーバーロードはありません |
| `meteringDcOffset(samples, sr?, options?)` | `number` | 平均（DC）オフセット、リニア振幅 |
| `meteringTruePeakDb(samples, sr?, oversampleFactor?, options?)` | `number` | サンプル間ピーク（ISP、いわゆる True Peak。サンプル点の間で波形が到達する最大値、dBFS）。`oversampleFactor` は 1..16 の 2 の冪（既定 4） |
| `meteringDetectClipping(samples, sr?, options?)` | `ClippingReport` | クリップしたサンプルの連続区間。`options` で `threshold`（既定 `0.999`）と `minRegionSamples`（既定 `1`）を指定 |
| `meteringDynamicRange(samples, sr?, options?)` | `DynamicRangeReport` | スライディングウィンドウのダイナミックレンジ。`options` で `windowSec`・`hopSec`・`lowPercentile`・`highPercentile` を指定（省略時は既定値の窓 3 秒・ホップ 1 秒・low 0.10・high 0.95） |
| `meteringStereoCorrelation(left, right, sr?, options?)` | `number` | 非中心化相関（コサイン類似度）、−1..1 |
| `meteringStereoWidth(left, right, sr?, options?)` | `number` | サイド／ミッドのエネルギー比。0 = モノラル、約 1 = 広いステレオ。上限なし（ミッドが無音なら `Infinity`） |
| `meteringVectorscope(left, right, sr?, options?)` | `VectorscopeReport` | サンプルごとのミッド/サイド点列 |
| `meteringPhaseScope(left, right, sr?, options?)` | `PhaseScopeReport` | フェーズスコープの点列と要約統計 |
| `meteringSpectrum(samples, sr?, options?)` | `SpectrumReport` | 信号全体に対する Welch 平均の振幅/パワー/dB スペクトラム（50% 重複する Hann フレームで平均）。`options` で `nFft`・`applyOctaveSmoothing`・`octaveFraction`・`dbRef`・`dbAmin` を指定 |
| `meteringSpectrumFrame(samples, sr?, frameOffset?, options?)` | `SpectrumReport` | 単一フレーム（Hann 窓 1 回分）の振幅/パワー/dB スペクトラム。`meteringSpectrum` と異なり時間平均しません。`frameOffset` で解析フレームの開始位置を指定 |
| `meteringSilenceRatio(samples, sr?, thresholdDb?, frameLength?, hopLength?, options?)` | `number` | RMS が `thresholdDb` を下回るフレームの割合（既定: `-45` dBFS、`frameLength=1024`、`hopLength=256`） |
| `waveformPeaks(samples, channels, options?)` | `WaveformPeaksReport` | インターリーブ音声からチャンネルごとの min/max 波形バケットを算出。`options.samplesPerBucket` の既定値は `512` |
| `waveformPeakPyramid(samples, channels, options?)` | `WaveformPeaksReport[]` | 複数のズームレベル向けの波形ピークバケット。`options.samplesPerBucketLevels` の既定値は `[512, 1024, 2048, 4096]` |

左右が逆相になりうる素材では `meteringCrestFactorDbStereo(...)` を使ってください。逆相のペアは `meteringCrestFactorDb(...)` が必要とする `0.5 * (left + right)` のダウンミックスで打ち消し合い、RMS が小さく出るぶんクレストファクターが過大に出ます。完全な逆相ペアでの実測値は、ステレオ版が 11.64 dB、ダウンミックス経由が 0.00 dB でした。

### マスタリング解析関数

説明可能なマスタリングのヘルパーは JSON 文字列を返します。正確な形は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。下のステレオ版はいずれもリクエスト専用で、リクエストオブジェクト 1 つだけを受け取ります。位置引数のオーバーロードはなく、位置引数で呼ぶと例外になります。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `masteringAudioProfileStereo(request)` | `string` | チャンネルペアのマスタリングアシスタントプロファイルを JSON で返す。`MasteringAudioProfileStereoRequest` を受け取る |
| `masteringAssistantSuggestStereo(request)` | `string` | チャンネルペアに対するマスタリングの提案を JSON で返す。`MasteringAssistantSuggestStereoRequest` を受け取る |
| `masteringStreamingPreviewStereo(request)` | `string` | チャンネルペアの配信ラウドネスのプレビューを JSON で返す。`MasteringStreamingPreviewStereoRequest` を受け取る。`platforms` を省略するか空配列を渡すと、例外ではなく組み込みの Spotify / Apple Music / YouTube のセット（3 行）にフォールバックする |

```typescript
import { masteringAudioProfileStereo, masteringStreamingPreviewStereo } from '@libraz/libsonare-native';

const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
const preview = JSON.parse(
  masteringStreamingPreviewStereo({
    left,
    right,
    sampleRate,
    platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
  }),
);
```

ステレオ素材ならステレオ版を使ってください。モノラル版は `0.5 * (left + right)` のダウンミックスを計測するため、相関の低い素材では約 6 dB 低く出ます。積分ラウドネス、そこから導かれる正規化ゲイン、天井に当たるリスクの判断が、そろって同じぶんだけ過小に報告されます。相関の低いピンクノイズのペア（48 kHz、4 秒）での実測値は、ダウンミックス経由が -22.55 LUFS、ステレオ版が -16.44 LUFS で、差は 6.11 dB でした。Spotify の `normalizationGainDb` もダウンミックス経由が +8.55、ステレオ版が +2.44 です。

ステレオプロファイルのうち、左右両チャンネルから計測されるのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから求め、True Peak は左右の大きいほうを採ります。スペクトル、ダイナミクス、テンポの各フィールドはダウンミックス上で計測されるため、`masteringAudioProfile` の値とそのまま比較できます。

::: warning リクエスト型の名前がバインディングごとに違います
Node はプロファイル用と提案用で 2 つの型名を宣言しています。`MasteringAudioProfileStereoRequest` は `MasteringAssistantSuggestStereoRequest` を継承し、フィールドを追加しません。WASM パッケージは両方に共通の `MasteringStereoParamsRequest` を使います。フィールドは同一なので、両者の間でコードを移植するときに変えるのは型名だけです。
:::

### スケール量子化

ピッチ補正ターゲットを構築するための 12-TET（12 平均律）スケールヘルパーです。

`modeMask` は 12 ビットのマスクです。ビット *i* が、`root`（`PitchClass`、C = 0）を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。

`referenceMidi` はチューニング基準音です。A4 = 69 にするには `0` を渡します。`pitchCorrectToMidi(...)` と組み合わせて最も近いスケール構成音へリチューンします。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `scaleQuantizeMidi(root, modeMask, midi, referenceMidi?)` | `number` | 小数を含む MIDI 番号を最も近い有効なピッチクラスへスナップ |
| `scaleCorrectionSemitones(root, modeMask, midi, referenceMidi?)` | `number` | 補正量（量子化後 − 入力）をセミトーンで返す |
| `scalePitchClassEnabled(root, modeMask, pitchClass)` | `boolean` | `pitchClass`（0..11）が `root` を基準に有効か |

### ストリーミング／リアルタイムクラス

一括処理の関数に加えて、ネイティブアドオンは WASM ビルドと同じストリーミング／リアルタイムクラスを公開します。

| クラス | 用途 |
|--------|------|
| `StreamAnalyzer` | ブロック単位の解析。時間とともに更新される BPM/キー推定と `readFramesSoa`／`readFramesI16`／`readFramesU8`。[リアルタイムストリーミング](./realtime-streaming.md) を参照。 |
| `StreamingEqualizer` | リアルタイムセーフなブロック EQ。 |
| `StreamingMasteringChain` | ブロックごとに進めるマスタリングレンダリング（[ネイティブバインディング](./native-bindings.md#streamingmasteringchain) で解説）。 |
| `RealtimeVoiceChanger` | プリセット式のライブ音声チェーン。ブロック処理向け。 |
| `Mixer` | JSON シーンから構築する永続マルチストリップミキサー。[ミキシングエンジン](./mixing.md) を参照。 |
| `RealtimeEngine` | DAW 風ホスティング向けのトランスポート／クリップ／オートメーションエンジン。 |

```typescript
import { StreamAnalyzer } from '@libraz/libsonare-native';

const analyzer = new StreamAnalyzer({ sampleRate: 48000, computeMel: true, computeOnset: true });
analyzer.process(block);                 // Float32Array のブロックを渡す
const frames = analyzer.readFramesSoa(analyzer.availableFrames());
const stats = analyzer.stats();          // stats.estimate.bpm / .key（PitchClass の整数）
```

Node ネイティブでは float の Structure-of-Arrays 読み出しの正式名は `readFramesSoa(...)` です。バインディング間の命名を揃えるためのエイリアス `readFrames(...)` も公開しており、これは WASM パッケージが同じ操作に使う名前と一致します。

Node ネイティブの `RealtimeVoiceChanger` は `{ sampleRate, maxBlockSize, channels, preset }` で構築します。

処理には `processMono(...)`、`processMonoInto(...)`、`processInterleaved(...)`、`processPlanarStereo(...)` を使います。

オフラインの便利用途では、`voiceChangeRealtime(...)` が同じプリセットチェーンでモノラルバッファ全体を 512 サンプルブロック単位に処理します。

```typescript
import {
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetNames,
  voiceCharacterPresetId,
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
const presetConfig = realtimeVoiceChangerPresetConfig('bright-idol');
console.log(
  voiceCharacterPresetId(1),
  realtimeVoiceChangerPresetNames(),
  presetConfig,
  changer.latencySamples(),
  blockOut,
  rendered,
);
changer.destroy();
```

`RealtimeEngine` はクラスとしては共有されていますが、実行環境ごとに細部が異なります。

| Runtime | 違い |
|---------|------|
| WASM | `engineCapabilities()` を追加し、構築前に ABI 互換性を確認します。キャプチャバッファは正規形の `setCaptureBuffer(numChannels, capacityFrames)` で設定します。 |
| Node ネイティブ | `engineAbiVersion()` を公開します。ブラウザ向けの機能確認ヘルパーはありません。キャプチャバッファは WASM と同じ正規形 `setCaptureBuffer(numChannels, capacityFrames)` に加えて、後方互換のために非推奨の `setCaptureBuffer(channels: Float32Array[])` も残しています。 |

`Project.create()` は空のプロジェクトを作成します。`setAssistSidecar(...)` と
`assistSidecars()` でモジュール固有の不透明なメタデータを保持でき、
`ProjectAutomationTargetKind` と `targetKind` でオートメーションレーンの対象種別を付けられます。
`RealtimeEngine.setTrackMonitorMode(laneIndex, mode, renderFrame?)` は `'off'`、
`'pfl'`（pre-fader listen＝フェーダー前で試聴）、`'afl'`（after-fader listen＝フェーダー後で試聴）、
および対応する数値序数を受け取ります。トラック／ミキサーのパン則セッターは、下記の
`PanLawInput` エイリアスを受け取ります。

### 型定義

```typescript
interface Key {
  root: string;        // ピッチクラス名。例: "C"、"C#"、"A"
  mode: string;        // モード名。例: "major"、"minor"
  confidence: number;  // 採点した全候補にわたるソフトマックス。[0, 1)
  name: string;        // "C major"、"A minor" など
  shortName: string;   // "C"、"Am" など
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
}

interface BpmHypothesis {
  value: number;
  confidence: number;
  relation: 'primary' | 'half' | 'double' | 'other';
}

// detectChords(...) が返すコード。root／bass／quality は文字列ラベルで、
// rootName／bassName にはすべての言語バインディングで共通の正規表記が入ります。
// quality のユニオンはバインディング側の表記です（C++ の enum は同じ 25 種類を
// 別の名前で呼びます）。
interface Chord {
  root: string;
  bass: string;
  rootName: string;
  bassName: string;
  quality:
    | 'major' | 'minor' | 'diminished' | 'augmented'
    | 'dominant7' | 'major7' | 'minor7'
    | 'sus2' | 'sus4' | 'add9' | 'minorAdd9'
    | 'dim7' | 'halfDim7'
    | 'major9' | 'dominant9' | 'sus2Add4'
    | 'major6' | 'minor6' | 'minorMajor7' | 'dominant7Sus4'
    | 'dominant11' | 'dominant13' | 'dominant7Flat9' | 'dominant7Sharp9'
    | 'unknown';
  name: string;        // 正規のコードシンボル。例: "Cmaj7"、"Am/C"、"N.C."
  start: number;       // 秒
  end: number;         // 秒
  duration: number;    // 秒（end - start）
  confidence: number;
}

interface ChordAnalysisResult {
  chords: Chord[];
}

// 0=Intro、1=Verse、2=PreChorus、3=Chorus、4=Bridge、5=Instrumental、
// 6=Outro、7=Unknown。
type SectionTypeOrdinal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// analyzeSections(...) が返すセクション。
interface Section {
  type: SectionTypeOrdinal;
  name: string;        // 可読名。例: "Chorus"
  start: number;       // 秒
  end: number;         // 秒
  energyLevel: number; // 相対エネルギー。[0, 1]
  confidence: number;  // [0, 1]
}

// AnalysisResult の中のコード。上記のスタンドアロン Chord とは異なり、
// root と bass はピッチクラスの序数（0..11、C = 0）、quality は ChordQuality の
// 序数です。可読なシンボルはどちらでも `name` に入ります。
interface AnalysisChord {
  root: number;
  bass: number;
  quality: number;
  start: number;
  end: number;
  confidence: number;
  name: string;        // 例: "Cmaj7"
}

// AnalysisResult の中のセクション。フィールドは Section と同じです。
interface AnalysisSection {
  type: SectionTypeOrdinal;
  start: number;
  end: number;
  energyLevel: number;
  confidence: number;
  name: string;
}

interface AnalysisBeat {
  time: number;        // 秒
  strength: number;    // このビートに最も近いオンセット包絡線の生の値（上限なし）
}

// ダウンビートと拍子の判定が採点しているビート単位の根拠。判定の結果ではなく
// 入力です。各系列は beats と並行し、ビート 1 つにつき 1 値。空の系列は、すべての
// ビートが 0 だったのではなく、解析がその系列を作れなかったことを意味します。
interface BeatObservations {
  onsetStrength: number[];       // 各ビート周辺で窓をかけたオンセットの集約値
  lowFrequencyEnergy: number[];  // 音声なしで解析した場合は空
  chordChange: number[];         // コード解析が走るまでは空
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: BpmHypothesis[];
  key: Key;
  timeSignature: TimeSignature;
  timeSignatureCandidates: TimeSignature[];
  beatTimes: Float32Array;                       // beats[].time から導出
  beats: AnalysisBeat[];
  beatObservations: BeatObservations;            // ビート単位の根拠
  beatLocalBpm: number[];                        // computeTempoCurve を有効にしない限り空
  downbeatIndices: number[];                     // beats への添字
  downbeatPhase: number;                         // 最初の小節が始まるビートの添字
  chords: AnalysisChord[];                       // 検出したコード進行
  sections: AnalysisSection[];                   // 楽曲構造セクション
  timbre: AnalysisTimbre;                        // 音色の集約サマリー
  dynamics: AnalysisDynamics;                    // ダイナミクスの集約サマリー
  rhythm: AnalysisRhythm;                        // リズムの集約サマリー
  melody: AnalysisMelody;                        // 旋律輪郭のサマリー
  form: string;                                  // 楽曲形式ラベル。例: "AABA"
}
// analyze() は上記のフル結果を返します。専用の detect*／analyze* 関数は、
// 個別解析やパラメータ指定の解析向けに引き続き利用できます。

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;  // nBins × nFrames, row-major
  power: Float32Array;      // nBins × nFrames, row-major
}

interface StftDbResult {
  nBins: number;
  nFrames: number;
  db: Float32Array;         // dB 単位のパワー
}

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  coefficients: Float32Array;  // nMfcc × nFrames, row-major
}

interface ChromaResult {
  nChroma: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;   // nChroma × nFrames, row-major
  meanEnergy: number[];     // nChroma 個の値
}

interface PitchResult {
  f0: Float32Array;         // フレームごとの基本周波数（Hz）
  voicedProb: Float32Array; // フレームごとの有声確率（0–1）
  voicedFlag: boolean[];    // フレームごとの有声／無声判定
  nFrames: number;
  medianF0: number;
  meanF0: number;
}

// Per-frame voicing decision, one entry per f0Hz frame. Accepted by the
// `voiced` argument and by PitchCorrectOptions.voiced.
type VoicedFlags =
  | Int32Array
  | Uint8Array
  | Float32Array
  | readonly number[]
  | readonly boolean[];

interface MasteringAssistantSuggestStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: Record<string, number | boolean>;
}

// Same fields; a distinct name for the profile entry point.
interface MasteringAudioProfileStereoRequest extends MasteringAssistantSuggestStereoRequest {}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}

interface MeteringStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  validate?: boolean;
}
```

#### `Key.confidence` が表すもの

`Key.confidence` は、採点したすべての候補のプロファイル相関に対するソフトマックス
です。範囲は `[0, 1)` で、候補全体の confidence の合計は 1 になるため、24 候補のうちの
1 つが 1 に到達することはありません。次点が迫るほど値は下がるので、根拠が割れる 2 つの
キー（多くは平行調どうし）はそれぞれおよそ半分を報告します。

この値は、**当たる頻度ではなく**、クロマが候補集合の中からどれだけはっきり 1 つを
選んだかを表すものとして読んでください。注釈付き音源に対してキャリブレーションされて
いないため、確信度が高くても誤ることは十分あり得ます。この値で分岐するパイプラインは、
自分の素材に合わせてしきい値を自分で決める必要があります。

#### 同じ構成音になるコード

::: warning 6th と 7th は同じ構成音を綴ることがあります
`major6` は短 3 度下の `minor7` と、`minor6` は短 3 度下の `halfDim7` と、
`dominant7Sus4` は完全 4 度下の `sus2Add4` と、それぞれ同じ 4 つのピッチクラスを
綴ります。クロマグラムにはこの組を区別する手がかりがないため、既定では慣用的な読み方の
ままになり、6th へ寄せられるのは低音の根拠がある場合だけです。
:::

#### ビート関連フィールドの読み方

`downbeatIndices` は `beats` への添字です。独立した時系列ではなくビートグリッド上の
所属判定なので、`beats` と同じ長さにはなりません。`downbeatPhase` は最初の小節が
始まるビートの添字です。

各ビートの `strength` は、オンセット包絡線の**生の 1 フレーム**（上限なし）です。
スケールは素材に依存し、ビート位置の揺れでも値が動きます。ビート周辺で何も平均して
いないためです。`beatObservations.onsetStrength` はライブラリ自身のダウンビート推定が
採点している窓付きの値で、アクセントを読むもの（上記の `estimateMeter(...)` や、ビートの
強弱を描画する処理など）はこちらを使うのが本来の形です。

ネイティブパッケージは、オプション、コールバック、ストリーミングスナップショット、リアルタイムエンジンメッセージ用の TypeScript 補助型もエクスポートしています。アプリ側で同じ構造を再定義せず、これらの型名を使ってください。

| 分野 | エクスポートされる型 |
|------|----------------|
| 解析オプション／結果 | `AnalysisProgressCallback`, `AnalysisBeat`, `BeatObservations`, `BpmCandidate`, `Chord`, `ChordAnalysisResult`, `AnalysisChord`, `AnalysisSection`, `ChordChromaMethod`, `EstimateMeterRequest`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `MeterEstimate`, `Section`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode` |
| 特徴抽出 | `DecomposeStemsRequest`, `DecomposeStemsResult`, `NoteSegment`, `NoteSegmentsRequest` |
| ストリーミング解析 | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| マスタリングとメータリング | `MasteringPreset`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot`, `NormalizeMode` |
| ステレオのマスタリング／メータリングのリクエスト | `MasteringAssistantSuggestStereoRequest`, `MasteringAudioProfileStereoRequest`, `MasteringStreamingPreviewStereoRequest`, `MeteringStereoRequest`, `NormalizeStereoRequest`, `NormalizeStereoResult` |
| ピッチ補正 | `PitchCorrectOptions`, `VoicedFlags` |
| ミキシング | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanLawName`, `PanLawInput`, `PanMode`, `SendTiming` |
| リアルタイム音声 | `VoicePresetId`, `VoicePresetCategory`, `RealtimeVoiceChangerPresetMetadata`, `RealtimeVoiceChangerPreset`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| リアルタイムエンジングラフ | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| リアルタイムエンジントランスポート | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig`, `EngineTrackMonitorMode` |
| プロジェクトのメタデータ／オートメーション | `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `ProjectAutomationLaneDesc` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |
