---
title: Node.js ネイティブ 解析・エフェクト API
description: '@libraz/libsonare-native パッケージの解析関数・エフェクト関数・特徴抽出関数のリファレンスです。'
---

# Node.js ネイティブ 解析・エフェクト API

このページは `@libraz/libsonare-native` パッケージの解析・エフェクト・特徴抽出関数を扱います。使用例、エラー、`Audio` クラス、クリーンアップ、変換、メータリング、マスタリング解析、ストリーミングクラスについては [Node.js ネイティブ API](./node-api.md) を、エクスポートされる TypeScript の型については [Node.js ネイティブ 型定義](./node-api-types.md) を参照してください。

## 解析関数

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

### `analyze()` のオプション

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

### `estimateMeter(...)`

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

`beatStrengths` の入力元として想定しているのは 2 つです。`beatObservations.onsetStrength`
（ライブラリ自身のダウンビート推定が採点している窓付きの値）と、`beats[].strength`
（同じ包絡線の窓なし 1 フレーム）です。各ビートについて `onsetEnvelope(...)` を
`timeToFrames(...)` の位置で読む方法は 3 つ目にはなりません。サンプル数で数えるホップは
レートごとに異なる長さの時間を 1 フレームに収めるため、同じ波形を 32000 Hz・44100 Hz・
48000 Hz で（ビート時刻は同一のまま）採点すると、勝者の分子は 6、3、4 と変わりました。
各ビートの周辺を窓で読んでもこの依存は消えません。

結果が意味を持つかどうかは、次の 2 点で決まります。

- **既定の候補集合は `{3, 4, 6}` です。** 分子を明示的に挙げたときだけその拍子が
  報告されるため、7 拍子を検出したいなら候補に 7 を入れる必要があります。
- **ビート列が 8 ビート未満のとき `searched` は `false` になります。** このとき
  ほかのフィールドはすべて測定結果ではなく固定のフォールバック値で、
  `timeSignature.confidence` は `0` です。確認せずに読んだ場合は中程度の検出ではなく
  「判断不能」の側に倒れます。短い区間の答えを検出結果として扱う前に `searched` を
  確認してください。

`grouping` は小節がアクセントのグループへどう分かれるかを表すため、7 拍子は素の 7 では
なく `[3, 2, 2]` のように返り、合計は必ず分子に一致します。要素が 1 つだけの場合は
内部の分割が解決できなかったことを意味します。`candidateScores` は標準化された符号
付きの値で、リクエストで分子を並べた順に格納されます。拍子を持たないビートに対して
分子が到達する水準が 0 なので、意味を持つのは順序と値の差だけです。またスコアは
採点したビート数の平方根に比例して大きくなります。一方 `candidates` は支持の高い順に
並ぶため、両者は添字ではなく `numerator` で突き合わせてください。
`confidence` も現れる場所で意味が変わります。`timeSignature` 側は次点との差から導かれる値、
`candidates` の各要素ではその候補が支持の総和に占める割合（要素の合計は 1）なので、
両者に同じしきい値を使ってはいけません。

### 非同期版（Node 専用）

Node アドオンは、Promise 返却版も公開しています。これらは DSP パイプラインを libuv のワーカースレッドで実行するため、JS イベントループをブロックしません。

戻り値の形は同期版と同じで、これらの関数自体は Node ネイティブ専用です。ブラウザでは `@libraz/libsonare/worker` の `OfflineWorkerClient` を使うと、同名関数ではなくタスク形式の API で解析とマスタリングを Web Worker 上へ移せます。

非同期版では進捗コールバックを使えません。進捗が必要な場合は `onProgress` 付きの同期版を使います。並行実行だけが目的なら、複数の非同期呼び出しを同時に走らせます。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `analyzeAsync(samples, sampleRate?)` | `Promise<AnalysisResult>` | `analyze(...)` の非同期版 |
| `masterAudioAsync(samples, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainResult>` | `masterAudio(...)` の非同期版 |
| `masterAudioStereoAsync(left, right, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainStereoResult>` | `masterAudioStereo(...)` の非同期版 |

## エフェクト関数

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

### `remix` でステレオ素材を切る

ゼロクロスへのスナップは信号ごとの判断です。そのため `remix(...)` をチャンネル
ごとに呼ぶと、各チャンネルが別々のフレームへスナップし、ステレオ素材の左右が
ずれていきます。片方のチャンネルから `remixAlignedIntervals(...)` で切り貼り位置を
1 組だけ決め、それを全チャンネルへ適用してください。既定値は両者で逆向きです。
`remix` の `alignZeros` は false、`remixAlignedIntervals` は true です。

スナップで区間が消えないように、2 つのガードがあります。符号の変化がまったくない
信号（無音、DC オフセット、あらゆる定数）はスナップされません。また、内容が
あったのにスナップ後に空へ潰れる区間は、スナップ前の境界を保ちます。

### ステレオペアのノーマライズ

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

## 特徴抽出関数

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

### `decompose` と `decomposeStems` の違い

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

### `noteSegments`

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

