# ネイティブバインディング

libsonare には 3 つのバインディングがあります。ブラウザ向けの **WASM**、**Python**、そして **Node.js ネイティブアドオン** です。このページでは 3 つすべてを比較して選べるようにします。Node ネイティブの関数リファレンスは専用ページにあります。各言語の詳細は個別の API ページを参照してください。

- **[Python API](/ja/docs/python-api)** — ctypes ベースのバインディング、PyPI でホイールを配布
- **[Node.js Native API](/ja/docs/node-api)** — C++ の性能を直接活用するネイティブアドオン

初学者向けには、選び方は単純です。スクリプトやノートブックなら Python、ブラウザアプリなら WASM、Node.js からネイティブのファイルデコードや実行性能が必要な場合だけ Node ネイティブを選びます。

| 作りたいもの | 使う | パッケージ |
|--------------|------|-----------|
| ブラウザアプリ | WASM | `@libraz/libsonare` |
| Python スクリプトやノートブック | Python | `pip install libsonare` |
| ネイティブデコードや性能が必要な Node.js アプリ | Node ネイティブ | `@libraz/libsonare-native` |

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ WASM、Python、Node ネイティブを、同じものとしてではなく用途で選べる。
- ネイティブデコードや実行性能が必要なときに、Node N-API アドオンをビルドして import できる。
- どの例が `@libraz/libsonare` を使い、どの例が `@libraz/libsonare-native` を使うかを区別できる。
- ネイティブアドオンの関数を、JavaScript、Python、マスタリング、ミキシングの広いドキュメントへ対応づけられる。

## 比較

| | WebAssembly | Python | Node.js（N-API） |
|---|---|---|---|
| **プラットフォーム** | ブラウザ | デスクトップ | デスクトップ |
| **配布** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | ソース (`bindings/node`) |
| **ビルド** | Emscripten | ビルド済みホイール（または CMake + pip） | CMake + cmake-js |
| **パフォーマンス** | ネイティブに近い | ネイティブ | ネイティブ |
| **ストリーミング** | 対応 | 対応 | 対応 |
| **ファイル I/O** | サンプルベース API。`Audio.fromMemory(...)` は WAV/MP3 バイト列をデコードでき、ブラウザ側デコード経路では追加の対応形式も読めます | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 |
| **エフェクト** | 対応 | 対応 | 対応 |
| **特徴抽出** | 対応 | 対応 | 対応 |
| **逆再構成** | 対応 | 対応 | 対応 |
| **単位変換** | 対応 | 対応 | 対応 |
| **マスタリング** | 対応 | 対応 | 対応 |
| **ミキシング** | 対応 | 対応 | 対応 |

---

## Node.js（N-API）

Node.js バインディングは **N-API** を使用したネイティブアドオンで、WebAssembly のオーバーヘッドなしに C++ の性能を直接活用できます。

::: details N-API と「ネイティブアドオン」とは？
**ネイティブアドオン** は、Node が通常のパッケージのように読み込むコンパイル済み C/C++ モジュールで、JavaScript や WebAssembly ではなく実際の機械語で動きます。

**N-API**（Node-API） は、こうしたアドオンを作るために Node が提供する安定したインターフェースで、V8 エンジンの内部実装からアドオンを隔離します。そのため、コンパイル済みバイナリ 1 つが再ビルドなしで Node の各バージョンで動き続けます。

利点はネイティブ速度と Node からの直接ファイルデコードです。一方で、WASM パッケージのようにどこでも同じバイナリが動くわけではないため、プラットフォームごとにビルド／インストールが必要です。
:::

## Node パッケージの選び方

| パッケージ | 初期化 | 使いどころ |
|------------|--------|------------|
| `@libraz/libsonare` | 使う前に `await init()` を呼ぶ | ブラウザ互換の WASM パッケージ、またはブラウザデモと同じ API が必要な場合 |
| `@libraz/libsonare-native` | WASM 初期化は不要。import して直接呼び出す | ネイティブのファイルデコード、ネイティブ実行性能、ソースツリー内アドオン開発が必要な場合 |

[JavaScript API](./js-api.md) の例は WASM パッケージを使います。ネイティブアドオンを使う例は `@libraz/libsonare-native` の import パスを持ちます。ネイティブの完全なリファレンスは [Node.js Native API](./node-api.md) を参照してください。

### 要件

- Node.js 22 以上
- CMake 3.16 以上
- C++17 対応コンパイラ
- Yarn 4 以上

### インストール

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

### ABI バージョン

バインディングと、それが読み込む共有ライブラリは、同じツリーから作られている必要があります。C ABI はサブシステムごとにバージョンを持ち、それぞれがそのサブシステムのフラットな POD 構造体のサイズとメンバーオフセットを保証します。バインディングは読み込み時にこれを照合するため、レイアウトの不一致は 1 バイトもやり取りする前に検出されます。運用上の指針は単純で、バインディングを再ビルドするときは必ずライブラリも再ビルドし、別のチェックアウトにある共有ライブラリをバインディングから参照させないことです。

| ABI | 現在の値 | 対象 |
|-----|---------|------|
| Feature | 5 | フラットな解析・特徴量の結果構造体（`SonareKey`、`SonareAnalysisResult`、`SonareChordDetectionOptions` など） |
| Project | 2 | ヘッドレス DAW のプロジェクト・アレンジ構造体。アレンジ機能なしのビルドでは `0` を返します |
| Voice changer | 2 | リアルタイムボイスチェンジャーの設定構造体 |
| Acoustic | 4 | ルーム音響の構造体 |
| Engine | 3 | リアルタイムコマンドキュー |

`sonare_abi_version()` は上の 4 つを 1 つの `uint32_t` に詰めて返します。ビット 0〜7 が Feature、8〜15 が Project、16〜23 が Voice changer、24〜31 が Acoustic で、1 回の比較で全体を照合できます。Engine の ABI はここに含めず、専用のアクセサ `sonare_engine_abi_version()` を持ちます。POD 構造体ではなく SharedArrayBuffer のレコードレイアウトをバージョン管理しているためです。各サブシステムのヘッダーが自分のマクロ（`SONARE_FEATURE_ABI_VERSION`、`SONARE_PROJECT_ABI_VERSION`、`SONARE_VOICE_CHANGER_ABI_VERSION`、`SONARE_ACOUSTIC_ABI_VERSION`）を持ち、保証対象の構造体のレイアウトが変わるたびに値を進めます。Project のバージョンだけは、レイアウトが変わったリリースごとに 1 回進みます。したがって値が等しければレイアウトは同一であり、保証対象の構造体へのフィールド追加は「追加的な変更」ではなくバージョンの更新です。

この値をどう使うかはバインディングごとに異なり、古いライブラリがどこで露見するかもそれで決まります。

- **Python** は import 時、個々のシンボルを設定する前に、詰め込まれた値をビルド時に想定した値と比較し、`libsonare ABI mismatch` で始まるメッセージの `RuntimeError` を送出します。別のチェックアウトの共有ライブラリは最初の呼び出しではなく `import libsonare` の時点で失敗します。
- **Node ネイティブと WASM** は `EXPECTED_PROJECT_ABI_VERSION` と `EXPECTED_ENGINE_ABI_VERSION`、および問い合わせ関数 `abiVersion()`・`projectAbiVersion()`・`engineAbiVersion()`・`voiceChangerAbiVersion()` をエクスポートします。`projectAbiVersion()` はアレンジ機能がコンパイルされていれば想定定数と等しく、そうでなければ `0` です。WASM の `engineCapabilities()` は `engineAbiVersion`・`expectedEngineAbiVersion`・`abiCompatible` を報告します。これらは関門ではなく問い合わせなので、`Project` や `RealtimeEngine` を構築する前の比較は利用側の仕事です。
- **C の呼び出し側** は `sonare_abi_version()` をコンパイル時の `SONARE_ABI_VERSION` と一度だけ比較します。JSON の入口（ボイスチェンジャーの JSON 設定、機能カタログ）はレイアウトのずれを許容するので関門は不要です。[C ABI のバージョン](./cpp-api.md#c-abi-のバージョン) も参照してください。

構造体へのフィールド追加は、構造体ごとの `struct_version` で段階的に有効化されるため、既存の C 呼び出し側はソースレベルでも呼び出しレベルでも影響を受けません。覚えておくとよい例が `SonareNoteSegmenterConfig` です。末尾の `voiced_threshold` は `struct_version` が `2` のときだけ読まれるので、従来どおりに埋めた設定はそのまま同じ挙動になり、ゼロ初期化した設定は既定値 0.5 を保ちます。変わるのはライブラリが報告するバージョンのほうです。自分のコードに手を入れていなくてもライブラリをバインディングと一緒に再ビルドする必要があるのは、このためです。

## マスタリング API

Node.js では WASM npm パッケージとネイティブアドオンの 2 経路があります。

| パッケージ | 使いどころ |
|-----------|------------|
| `@libraz/libsonare` | ブラウザデモと同じ API を使いたい、または Web 互換の WASM が必要な場合。 |
| `@libraz/libsonare-native` | Node.js でネイティブのファイルデコードやネイティブ実行性能が必要な場合。 |

```typescript
import {
  masterAudioStereo,
  masteringChainStereo,
  masteringAssistantSuggest,
  masteringAssistantSuggestStereo,
  masteringAudioProfile,
  masteringAudioProfileStereo,
  masteringPresetNames,
  masteringPairAnalyze,
  masteringProcessorNames,
  masteringStreamingPreview,
  masteringStreamingPreviewStereo,
} from '@libraz/libsonare-native'

console.log(masteringProcessorNames())
console.log(masteringPresetNames())

const mastered = masteringChainStereo(left, right, sampleRate, {
  dynamics: {
    compressor: {
      thresholdDb: -18,
      ratio: 2.2,
      autoMakeup: true,
    },
  },
  loudness: {
    targetLufs: -14,
    ceilingDb: -1,
    truePeakOversample: 4,
  },
})
console.log(mastered.outputLufs, mastered.stages)

const presetMaster = masterAudioStereo(left, right, sampleRate, 'pop', {
  loudness: { targetLufs: -14 },
})
console.log(presetMaster.outputLufs, presetMaster.stages)

const matchReport = JSON.parse(
  masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate),
)

const masteredWithProgress = masteringChainStereo(left, right, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
}, (progress, stage) => {
  console.log(`render ${(progress * 100).toFixed(0)}%: ${stage}`)
})
console.log(masteredWithProgress.outputLufs)

const profile = JSON.parse(masteringAudioProfile(samples, sampleRate, {
  nFft: 2048,
  hopLength: 512,
  truePeakOversample: 4,
}))
const suggestions = JSON.parse(masteringAssistantSuggest(samples, sampleRate, {
  targetLufs: -14,
  ceilingDb: -1,
  preferStreamingSafe: true,
}))
const deliveryPreview = JSON.parse(masteringStreamingPreview(samples, sampleRate, [
  { name: 'Streaming', targetLufs: -14, ceilingDb: -1 },
]))
console.log(profile, suggestions, deliveryPreview)

// The stereo entry points are request-object only — there is no positional
// overload, so a positional call throws.
const stereoProfile = JSON.parse(masteringAudioProfileStereo({
  left,
  right,
  sampleRate,
  params: { nFft: 2048, hopLength: 512, truePeakOversample: 4 },
}))
const stereoSuggestions = JSON.parse(masteringAssistantSuggestStereo({
  left,
  right,
  sampleRate,
  params: { targetLufs: -14, ceilingDb: -1, preferStreamingSafe: true },
}))
// Omitting platforms uses the built-in Spotify / Apple Music / YouTube set.
const stereoPreview = JSON.parse(masteringStreamingPreviewStereo({ left, right, sampleRate }))
console.log(stereoProfile, stereoSuggestions, stereoPreview)
```

2 チャンネルの素材を扱うときは、ステレオ入口を使ってください。モノラル側は `0.5 * (left + right)` のダウンミックスを測定するため、相関の低いステレオ素材では約 6 dB 低く出ます。その分だけ、インテグレーテッドラウドネス、そこから導かれるノーマライズゲイン、ピーク余裕の判定がまとめて過小評価されます。ここで使う LUFS はフルスケール基準のラウドネス単位（Loudness Units relative to Full Scale）で、配信プラットフォームが音量を揃える基準でもあります。詳細は[LUFS](./glossary/lufs.md)を参照してください。

48 kHz・4 秒のピンクノイズのペアで測ると次のようになります。

| ペアの種類 | ダウンミックス経由とステレオ経由 | 差 |
|------------|----------------------------------|-----|
| 相関が低い | -22.55 LUFS と -16.44 LUFS | 6.11 dB。うち 3.01 dB はダウンミックスで振幅が半分になる分、残りの約 3 dB が相関の低さによる分 |
| 相関が高い | 振幅が半分になる分のみ | 3.01 dB |

相関の低いペアでは、この差が Spotify の `normalizationGainDb` を +2.44 から +8.55 に押し上げます。

ステレオプロファイルのうち両チャンネルから測るのは `loudness` ブロックだけです。インテグレーテッド LUFS と LRA（ラウドネスレンジ。曲中の静かな部分と大きな部分の開き）はチャンネルを合算したプログラムから求め、True Peak は左右のうち大きい方を採ります。スペクトル・ダイナミクス・テンポの各フィールドは絶対レベルではなく形と時間構造を表すため、ダウンミックス基準のまま据え置き、モノラル呼び出しの結果とそのまま比較できます。

呼び出し規約の違いに注意してください。上のマスタリング例が位置引数なのに対し、この 4 つはリクエストオブジェクト 1 つだけを取ります。メータリング側の `meteringCrestFactorDbStereo({ left, right, sampleRate })` も同じリクエストオブジェクト形式で、`number` を返します。リクエスト型の名前は Node ネイティブと WASM で異なります。Node は `MasteringAssistantSuggestStereoRequest` と `MasteringAudioProfileStereoRequest` を宣言し（後者は前者を継承するだけで何も追加しません）、WASM は共通の `MasteringStereoParamsRequest` 1 つを使います。

アシスタント／プロファイル系ヘルパーは、WASM 入口と同じオプション名を受け取ります。プロファイル設定は `nFft`、`hopLength`、`truePeakOversample`、アシスタント設定は `targetLufs`、`ceilingDb`、`enableRepair`、`preferStreamingSafe`、`speechMonoAmount` です。共有ネイティブパーサーを通るため、snake_case の別名も受け付けます。

長尺のオフラインレンダリングでは、`masteringChain(...)`、`masteringChainStereo(...)`、`masterAudio(...)`、`masterAudioStereo(...)` の最後に進捗コールバックを渡し、そこから Node UI を更新します。

WASM パッケージは、ブラウザデモと同じ camelCase のマスタリング API を公開しています。主なグループは次の通りです。

| グループ | API 名 |
|----------|--------|
| プリセットと簡易入口 | `mastering()`、`masteringPresetNames()`、`masteringPlatformNames()`、`masterAudio()`、`masterAudioStereo()`、`masterAudioWithProgress()`、`masterAudioStereoWithProgress()` |
| フルチェーン | `masteringChain()`、`masteringChainStereo()`、`masteringChainWithProgress()`、`masteringChainStereoWithProgress()` |
| オフラインのダイナミクス（単発） | `masteringDynamicsCompressor()`、`masteringDynamicsGate()`、`masteringDynamicsTransientShaper()` |
| オフラインのリペア — モノラル | `masteringRepairDeclick()`、`masteringRepairDeclip()`、`masteringRepairDecrackle()`、`masteringRepairDehum()`、`masteringRepairDenoiseClassical()`、`masteringRepairDereverbClassical()`、`masteringRepairTrimSilence()` |
| オフラインのリペア — ステレオペア | `masteringRepairDeclickStereo()`、`masteringRepairDeclipStereo()`、`masteringRepairDecrackleStereo()`、`masteringRepairDehumStereo()`、`masteringRepairDenoiseClassicalStereo()`、`masteringRepairDereverbClassicalStereo()`、`masteringRepairTrimSilenceStereo()` |
| オフラインのリペア — チャンネルリンク（任意のチャンネル数） | `masteringRepairDenoiseClassicalLinked()`、`masteringRepairDereverbClassicalLinked()` |
| リペアの計測（音声を返さない） | `masteringRepairDetectClicks()`、`masteringRepairDetectClipping()`、`masteringRepairDetectCrackle()`、`masteringRepairDetectHum()`、`masteringRepairDetectNoiseFloor()`、`masteringRepairDetectReverb()`、`masteringRepairDetectTrimRange()`、`masteringRepairDetectTrimRangeStereo()`、`masteringRepairNoiseBandBins()`、`masteringRepairDereverbConfigForRoom()` |
| アシスタントとプロファイル | `masteringAudioProfile()`、`masteringAssistantSuggest()`、`masteringAssistantSuggestChain()`、`masteringStreamingPreview()`、`masteringAudioProfileStereo()`、`masteringAssistantSuggestStereo()`、`masteringAssistantSuggestChainStereo()`、`masteringStreamingPreviewStereo()`、`masteringAbMatchLoudness()` |
| 名前付きプロセッサ | `masteringProcessorNames()`、`masteringProcessorCatalog()`、`masteringInsertNames()`、`masteringInsertParamNames(name)`、`masteringInsertParamInfo(name)`、`masteringProcess()`、`masteringProcessStereo()` |
| ペア処理とステレオ解析 | `masteringPairProcessorNames()`、`masteringPairProcess()`、`masteringPairAnalysisNames()`、`masteringPairAnalyze()`、`masteringStereoAnalysisNames()`、`masteringStereoAnalyze()` |
| ストリーミングレンダー | `StreamingMasteringChain` |

Node ネイティブは同じ基本名を使いますが、進捗は個別の `*WithProgress` ヘルパー関数ではなく、最後のオプション引数に渡すコールバックとして受け取ります。

### リペアの入口

リペア系の関数はいずれも、リクエストオブジェクトと位置引数のどちらでも呼べます。これは両パッケージ共通です。違うのは入力の数と戻り値です。

| 形 | 呼び出し | 戻り値 |
|----|---------|--------|
| モノラル | `masteringRepairDeclick(samples, sampleRate, options?)` | 修復後の `Float32Array` |
| ステレオペア | `masteringRepairDeclickStereo(left, right, sampleRate, config?)` | 修復後のペアとレポートのフィールド |
| チャンネルリンク | `masteringRepairDenoiseClassicalLinked(channels, sampleRate, config?)` | `{ channels, report }`。入力順に 1 チャンネルずつ出力を返します |
| 計測 | `masteringRepairDetectClicks(samples, sampleRate, options?)` | 検出レポートのみで、音声は返しません |

ステレオ版は、モノラル版を 2 回呼ぶのとは別物です。そこがステレオ版を選ぶ理由でもあります。ステレオイメージを動かしてしまう判断はペア全体で共有し、安全に変えられる部分だけをチャンネルごとに処理します。したがって、どちらかのチャンネルの検出が選んだ同相のクリックは両チャンネルで修復され、ノイズ低減のマスクは両チャンネルを合算したパワーから作って、そのまま両側へ適用します。

戻り値のレポートもこの切り分けに従うので、次のように読んでください。

| 関数 | レポートのフィールド |
|------|--------------------|
| `masteringRepairDeclickStereo()`、`masteringRepairDeclipStereo()`、`masteringRepairDecrackleStereo()`、`masteringRepairDehumStereo()` | `leftReport` と `rightReport`。各チャンネルは自分のサンプルから補間・フィルタされるため、2 つの内容は実際に異なります |
| `masteringRepairDenoiseClassicalStereo()`、`masteringRepairDereverbClassicalStereo()` | 共有の `report` が 1 つ。マスクが 1 つなので、報告する対象も 1 つです |
| `masteringRepairTrimSilenceStereo()` | 共有の `report` に加えて `leftRange` と `rightRange` |

`*Linked` の 2 つは、左右のペアではなく `channels: Float32Array[]` を取り、マスクを 1 つにするという同じ考え方を任意のチャンネル数（1 チャンネルを含む）へ広げたものです。リンク版のレポートの `detected` はチャンネル集合全体の値で、チャンネル数とともに動きます。同一内容の N チャンネルは 1 チャンネルより `10*log10(N)`（ペアなら約 3 dB）高く読まれます。それ以外のフィールドは比率なので動きません。

計測用のヘルパーは、対応するリペアと同じオプション型を取ります。これから実行しようとしている設定そのままで計測できるということです。このうち 2 つは、信号ごとの計測ではありません。

- `masteringRepairNoiseBandBins(nFft?, sampleRate?)` は、`masteringRepairDetectNoiseFloor()` が `bandFloorDbfs` を報告するときのバンド分割を表す 33 個のビン番号を `Int32Array` で返します。32 バンドそれぞれの先頭ビンと、最後のバンドの終端の次のビンです。分割を決めるのは解析のジオメトリだけなので、ノイズ低減の設定は取りません。連続する 2 つの値が等しいところはバンドが空で、そのレベルは計測値ではなくセンチネルです。
- `masteringRepairDereverbConfigForRoom(estimate, config?)` は、`estimateRoom(...)` の結果からディリバーブ設定一式を埋めます。手で調整した数値ではなく、実測した部屋の特性でリペアを駆動できます。

残る 2 つは、リペアではなくアシスタント側の入口です。`masteringPlatformNames()` は、アシスタントが `targetPlatform` として受け付ける配信先の一覧を返します。バインディング側に持った一覧ではなくライブラリから読むため、コアに配信先が増えてもバインディングを変更せずに見つけられます。`masteringAbMatchLoudness({ source, reference, sampleRate })` は A/B 試聴のために `source` を `reference` のラウドネスへ合わせ、合わせた後のサンプルとあわせて `referenceLufs`、`sourceLufs`、`appliedGainDb`、`matchedTruePeakDbtp` を返します。リファレンス側は計測するだけで、そのまま返ります。ゲインには意図的に上限を設けていないため、`matchedTruePeakDbtp` が 0 dBTP を超えることがあります。ヘッドルームに合わせてクランプすると、フルスケール近くの音源だけが自分のラウドネスのまま取り残されることになり、それはラウドネスマッチが最もやってはいけないことだからです。マッチよりピークのほうが重要な場面では、後段でリミットしてください。

## ミキシング API

ネイティブアドオンと WASM パッケージのどちらからも、ミキシング API を使えます。入口は `mixStereo(...)`、`mixingScenePresetNames()`、`mixingScenePresetJson()`、保持して使う `Mixer` クラスです。

チャンネルストリップ処理、シーンプリセット、センド、バス、オートメーション、メーター、オフラインのステムレンダーに使います。

ランタイム横断の説明は [ミキシングエンジン](./mixing.md) を参照してください。

永続ミキサーでは、Node ネイティブは多くのストリップ制御メソッドで `StripRef`（`number | string`）を受け取ります。WASM メソッドは数値のストリップインデックスを使い、ID からは `stripById(id)` で引きます。

Node の `stripMeter(strip)` はポストフェーダーメーターを読みます。タップを明示したい場合は `meterTap(strip, 'preFader' | 'postFader')` を使います。シーン JSON の読み込み後は、`mixer.sceneWarnings()` がどのプロセッサも消費しなかった insert パラメータ（典型的にはタイプミス）を非致命的な警告として一覧します。

## プロジェクト・インストゥルメント・ライブ MIDI

Node ネイティブアドオンは、WASM や Python と同じヘッドレス DAW 向け API を公開しています。`Project` クラス（トラック、クリップ、テンポ、undo/redo、SMF／MIDI 2.0 入出力）と、インストゥルメント付きバウンス（`bounceWithSynthInstrument(s)` と SoundFont のロード）が使えます。NativeSynth プリセットカタログ（`synthPresetNames()`／`synthPresetPatch()`／`SynthPatch`）、`chordFunctionalAnalysis(...)`、ライブ MIDI 入力付きの `RealtimeEngine` も使えます。

エンジンには他のバインディングと同じレーンミキサーと MIDI クリップスケジュールが載っています。`setTrackLanes` / `setTrackBuses`、トラック／マスター／バスのストリップ JSON とインサート操作、インサートオートメーション id の解決、`setParamSmoothingMs`、ワイド／スコープテレメトリ、`setMidiClips`、`sampleAtPpq` を、WASM と同じ camelCase 名で使えます。外部機器へのルーティングも `setMidiDestinationExternal`、`setExternalMidiClockEnabled`、`drainExternalMidi`、`externalMidiDroppedCount` から利用できます（[リアルタイムエンジン](./realtime-engine.md#トラックを外部-midi-機器へ送る)を参照）。ブラウザ専用のつなぎ込み（`bindWebMidi`、`bindMicrophoneInput`）は WASM 固有で、ネイティブアドオンには含まれません。

詳細は各ガイドを参照してください: [プロジェクト編集](./project-editing.md)、[プロジェクトのバウンス](./project-bounce.md)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md)。

## エラーハンドリング

WASM パッケージと同じく、ネイティブアドオンもネイティブ側の失敗をすべて構造化された `SonareError` としてスローします。`Error` のサブクラスで、C ABI のエラー enum を映した数値の `code` と正準名 `codeName` を持ちます。両パッケージとも `ErrorCode`・`SonareError`・型ガード `isSonareError(value)` をエクスポートし、同じ失敗はどのバインディングでも同じ数値コードを報告します。コード表と使用例は[エラーハンドリング](./js-api-types.md#エラーハンドリング)を参照してください。

`SonareError` は両パッケージとも実行時のクラスです。値としてインポートすればコンストラクタが得られ、共有の TypeScript モジュールがどちらのパッケージからインポートしても同じ種類のものが手に入ります。`instanceof` はプロトタイプ判定ではなくブランド判定で、`SonareError` という名前を持ち数値の `code` を持つ `Error` であれば絞り込めます。

```typescript
import { ErrorCode, isSonareError, SonareError } from '@libraz/libsonare-native'

try {
  // ...
} catch (err) {
  if (err instanceof SonareError && err.code === ErrorCode.InvalidParameter) {
    console.error(err.codeName, err.message)
  }
}
```

これが効くのは、プロトタイプ判定では取り逃がす 2 つの場合です。アドオンはクラスを構築せず、同じ形を持つ素の `Error` を送出します。また、ワーカー境界や `structuredClone()` を越えたエラーはプロトタイプを失っています。どちらもこの判定なら絞り込めます。`isSonareError(value)` は同じダックタイピング判定を型ガードとして書いたもので、`instanceof` はこれに委譲するため両者が食い違うことはなく、どちらを使っても構いません。プロトタイプを保持しない境界の向こうへネイティブの失敗を投げ直す用途のために、`SonareError` を直接構築することもできます。

## Audio メソッドの違い

WASM の `Audio` クラスは、よく使う単発ヘルパーをメソッド形式で呼ぶための入口です。使用頻度が低い、または呼び出し方が異なるヘルパーはスタンドアロン関数のままです。

| `Audio` メソッドとして使える | WASM でスタンドアロンのまま |
|------------------------------|------------------------------|
| BPM／キー／ビート／コードなどの基本解析 | `analyzeSections(...)` |
| HPSS／編集ヘルパー | `analyzeMelody(...)` |
| マスタリングヘルパー | `analyzeDynamics(...)` |
| 特徴量抽出 | `analyzeTimbre(...)` |
| ラウドネス、リサンプリング | ルーム音響ヘルパー、セクション／メロディ／ダイナミクス／音色ヘルパー |

Node ネイティブの `Audio` オブジェクトは、ネイティブアドオンへ直接委譲できるためメソッドの範囲が広くなっています。

| 機能 | Node ネイティブ | WASM |
|------|-----------------|------|
| 追加の `Audio` メソッド | より詳細な解析・ルーム音響系メソッドをインスタンスメソッドとして持つ | 使えるところはスタンドアロンの詳細ヘルパーを使う |
| ファイル構築 | `Audio.fromFile(...)`、`Audio.fromMemory(...)` | `Audio.fromBuffer(...)`、`Audio.fromMemory(...)`、`Audio.fromMemoryWithBrowserFallback(...)` |
| サンプル取得 | `audio.getData()` はコピーを返す | `audio.data` はインスタンスが持つ可変な `Float32Array` そのもの |

共通メソッドに加えて、用途を絞った次のヘルパーも `Audio` のメソッドとして持ちます。`analyzeBpm(...)`、`analyzeImpulseResponse(...)`、`detectAcoustic(...)`、`analyzeRhythm(...)`、`analyzeDynamics(...)`、`analyzeTimbre(...)`。ルーム系ヘルパーの `estimateRoom(...)`、`synthesizeRir(...)`、`roomMorph(...)` はスタンドアロン関数のままです。

メソッドと関数の完全なリファレンスは [Node.js Native API](./node-api.md) を参照してください。

### StreamingMasteringChain

ネイティブアドオン（および WASM パッケージ）は、ブロック単位でレンダリングする `StreamingMasteringChain` クラスも公開しています。Electron アプリや Worker、音声入力パイプラインなどから、`masteringChain()` と同じネスト構造の設定に `loudnessStaticGainDb` と任意の `loudnessStaticGainPeakDb` を加えて、ブロックごとに処理を進められます。

```typescript
import { StreamingMasteringChain } from '@libraz/libsonare-native';

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames(), chain.latencySamples());
chain.reset();   // 状態だけクリア（prepare し直さない）
```

`numChannels === 1` のときはステレオ専用ステージはスキップされます。ストリーミングチェーンはオフライン専用の repair 段を拒否します。`loudness` 段を使うには事前計算した静的ゲインを `loudnessStaticGainDb` で指定し、必要に応じて音源の True Peak を `loudnessStaticGainPeakDb` で渡します。後者を指定すると、静的ゲインは設定したシーリングを超えないように制限されます。WASM ビルドは `chain.delete()` でハンドルを解放します。ネイティブアドオンは冪等な `destroy()` を公開し、`[Symbol.dispose]` も実装しているので Node 22+ では `using` が使えます。ネイティブハンドルは最終的には GC でも回収されますが、リクエストごとにチェーンを生成するような長寿命プロセスでは明示的に解放しないとネイティブメモリが積み上がります。

関連するマスタリングガイド: [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md)、[リファレンスマッチ](./glossary/mastering/reference-match.md)、[品質チェックリスト](./glossary/mastering/quality-checklist.md)。

### StreamingEqualizer

`StreamingEqualizer` は Node ネイティブ、Python、WASM で使えます。

`processMono` / `processStereo` の呼び出しをまたいで EQ の状態を保持し、スペクトラムスナップショットを出せます。リファレンスマッチからバンドを設定することもできます。

Node ネイティブと WASM は同じフェーズモード値を受け取ります。Python はさらにコンテキストマネージャ構文もサポートします。

| ランタイム | フェーズモード |
|---------|------------|
| Node ネイティブ | `'zero'`, `'natural'`, `'linear'`, または `1`/`2`/`3` |
| WASM | `'zero'`, `'natural'`, `'linear'`, または `1`/`2`/`3`（Node ネイティブと同じ） |
| Python | 文字列または数値モード |

Python では `with StreamingEqualizer(...) as eq:` / `eq.close()` で解放できます。

```typescript
import { StreamingEqualizer } from '@libraz/libsonare-native';

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
eq.setBand(0, { type: 'HighShelf', frequencyHz: 8000, gainDb: 4, enabled: true });
eq.setPhaseMode('natural');
eq.setAutoGain(true);

const { left, right } = eq.processStereo(leftBlock, rightBlock);
console.log(eq.spectrum(), eq.latencySamples(), left, right);
```

`@libraz/libsonare-native` は現在、ソースツリー内の `bindings/node` でビルドして使う前提です。別プロジェクトから使う場合は、ビルド済みのローカルパッケージをワークスペースや `file:` 依存として参照してください。

ネイティブビルドは `pkg-config` で FFmpeg 開発ライブラリを自動検出します。
FFmpeg がない場合は WAV/MP3 のみをデコードします。明示的に指定する場合は次の環境変数を使います。

```bash
SONARE_FFMPEG=1 yarn build  # FFmpeg デコードを必須にする
SONARE_FFMPEG=0 yarn build  # WAV/MP3 のみに固定する
```

## 関数リファレンス全体

Node ネイティブの関数ごとの完全なリファレンスは専用ページにあります: [Node.js Native API](./node-api.md)。解析、エフェクト、特徴抽出、逆再構成、librosa 互換、変換、メータリング、スケール量子化の各関数、ストリーミング／リアルタイムクラス、エクスポートされる TypeScript 型を掲載しています。
