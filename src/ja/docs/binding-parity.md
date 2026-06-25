# バインディング対応表

libsonare は単一の C++ コアを、C、Python、Node ネイティブ、WASM、CLI から公開しています。機能セットはできるだけ揃えていますが、言語ごとに命名規則や設定オブジェクトの形が異なります。

[機能マップ](./api-surface.md) で機能ファミリーを確認したあと、どのランタイムを使うか、別バインディングへコードを移すときに何が変わるかを確認するためのページです。

「バインディング」は、同じ C++ 実装を別の言語から呼べるようにする薄い接続層です。たとえば `detect_bpm` と `detectBpm` は、名前の書き方は違っても、同じ種類の処理を呼びます。このページでは、その名前・引数・戻り値の違いを見比べます。

::: info 対応している＝同じ書き方ではない
このページの「対応」は、同じ機能が各ランタイムから使えるという意味です。関数名、引数順、戻り値の形、既定値まで同一とは限りません。コードを移植するときは、機能行だけでなく [形の違い](#形の違い) も確認してください。
:::

## このページで身につくこと

このページを読むと、次のことを判断・確認できるようになります。

- JavaScript、Python、C++、C ABI、Node ネイティブ、CLI の命名規則を相互に読み替えられる。
- 各バインディングにある機能と、CLI からは使えない機能を見分けられる。
- ネスト設定とフラット設定、行優先行列、Scene JSON、ストリーミングフレームバッファなどの形の違いを把握できる。
- ドキュメントと実行時を確認するとき、どのソースファイルを正本として見るべきかを選べる。

## 命名規則

最初に見るべき違いは、関数名の書き方です。JavaScript は `detectBpm` のような camelCase、Python は `detect_bpm` のような snake_case を使います。機能名が完全に同じ文字列で見つからないときは、まずこの書き換えを疑ってください。

| 概念 | WASM / Node JS | Python | C / C++ |
|------|----------------|--------|---------|
| 関数名 | camelCase。例: `detectBpm`, `masterAudioStereo` | snake_case。例: `detect_bpm`, `master_audio_stereo` | C ABI は `sonare_*`、C++ は namespace/class |
| マスタリングチェーン設定 | WASM の `masteringChain(...)` はネストした object | フラットなドット記法の上書き値と dict 設定 | C++ struct、C ABI struct／JSON ヘルパー |
| プリセット上書き | `masterAudio(...)` はフラットなドット記法 | フラットなドット記法 | フラットなパラメータまたは C++ 設定の変更 |
| ミキサーシーン | JSON 文字列と `Mixer` | JSON 文字列と `Mixer` | `mixing::api::Scene` と JSON ヘルパー |

## 機能対応

ライブラリ系バインディングは同じ機能ファミリーを公開しています。対象は WASM、Python、Node ネイティブ、C++、C ABI です。

実質的な差が出るのは主に CLI です。下の表は各ファミリーについて、ライブラリ系での対応状況と CLI の対応範囲を短く示します。行に断りがなければ、ライブラリ系バインディングすべてで使えると考えてください。バインディングごとの名前の違いは上の[命名規則](#命名規則)に従います。

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| バッチ解析 | 対応 | 対応 |
| 低レベル特徴量と librosa 互換ヘルパー | 対応 | 主要コマンド |
| ストリーミングアナライザー | 対応 | 非対応 |
| Mel/MFCC 逆再構成 | 対応 | 非対応 |
| リアルタイムエンジン | 対応 | 非対応 |
| エンジンのレーンミキサー（レーン、バス、センド、チャンネルストリップ）と MIDI クリップスケジュール | 対応 — [リアルタイムとストリーミング](./realtime-streaming.md#レーンミキサー)を参照 | 非対応 |
| リアルタイムスコープとワイドメーターのテレメトリ | 対応 — [リアルタイムとストリーミング](./realtime-streaming.md#サラウンドグループバスとワイドメーター)を参照 | 非対応 |
| マスタリング preset/chain/processor | 対応 | 一部のみ |
| マスタリングアシスタント／プロファイル／プレビュー JSON | 対応 | 専用コマンドなし |
| ミキシングエンジンとシーン | 対応 | `mix`（C++ CLI はシーンプリセット書き出しも対応） |
| サラウンド・マルチチャンネルミキシング | 対応 — シーン／パンの往復に加え、リアルタイムの[サラウンドグループバス](./mixing.md#サラウンドとマルチチャンネル)。ただしサラウンドの**パン**は staged で、`setSurroundPan` の位置は Scene JSON を往復するものの、サラウンド DSP パスが入るまでは音には反映されない（機能しているのはサラウンドグループバスとワイドメーターのテレメトリ） | 非対応 |
| プロジェクト・アレンジ編集（ヘッドレス DAW） | 対応 — [プロジェクト編集](./project-editing.md)を参照 | 対応 |
| 組み込み楽器（NativeSynth の preset/patch） | 対応 — [組み込み楽器](./native-synth.md)を参照 | 一部のみ — `project bounce --synth` は簡易内蔵シンセの波形指定だけを公開し、NativeSynth の preset/patch カタログは公開しない |
| SoundFont 2 プレイヤー | 対応 — [SoundFont 2 プレイヤー](./soundfont-player.md)を参照 | 非対応（Project API のみ） |
| リアルタイムエンジンのライブ MIDI 入力 | 対応 — [MIDI 入力](./midi-input.md)を参照 | 非対応 |
| Web MIDI ブリッジ（`bindWebMidi`）とマイク接続（`bindMicrophoneInput`） | WASM／ブラウザ専用 | 非対応 |
| 外部楽器バウンスプロトコル（`ExternalInstrument`） | Python 専用 — [プロジェクトバウンス](./project-bounce.md)を参照 | 非対応 |
| 編集 DSP | 対応 | 対応 |
| 領域ベースのスペクトル編集（`spectralEdit`） | 対応 — [スペクトル編集](./spectral-editing.md)を参照 | 非対応 |
| メータリング（計測、クリッピング／ダイナミックレンジ、ステレオイメージ、スペクトル） | 対応 | C++ CLI のみ（`meter`／`clipping`／`dynamic-range`） |
| スケール量子化 | 対応 | 非対応 |
| ルーム音響解析 | 対応 | `sonare acoustic [--ir]`、`estimate-room`、`synthesize-rir`、`room-morph` |
| ファイルデコード | ネイティブ: WAV/MP3（FFmpeg ビルドで追加形式）。WASM: デコード済みサンプルを渡す | ネイティブビルドに準拠 |

## 形の違い

同じ機能でも、引数の形・設定のレイアウト・戻り値がバインディングごとに違うことがあります。移植時に一番バグりやすいのは、計算式そのものではなく「行列をどう平坦化しているか」「オプションをオブジェクトで渡すかキーワード引数で渡すか」「返ってくる値の名前が違うか」です。

### 関数・引数の形

次の関数はライブラリ系バインディングに共通して存在しますが、引数の渡し方が異なります。名前は[命名規則](#命名規則)（camelCase と `snake_case`）に従います。

| 関数 | WASM | Node ネイティブ | Python |
|------|------|----------------|--------|
| `detectChords` / `detect_chords` | オプションオブジェクト | 位置引数 / キーワード引数 | 位置引数 / キーワード引数 |
| ストリーミング読み出し | `process`、`readFrames`、`stats` | float の Structure-of-Arrays 読み出しは `readFramesSoa` | `process`、`read_frames`、`stats` |
| 量子化ストリーム読み出し | `readFramesI16` / `readFramesU8`、`StreamConfig.outputFormat` | WASM と同じ | `read_frames_i16` / `read_frames_u8`、`output_format` |
| `Mixer` のストリップ参照 | 数値インデックス。ID 参照は `stripById(id)` | 数値インデックスまたはストリップ ID 文字列 | 数値インデックスまたはストリップ ID 文字列 |

3 バインディングで形がそろわないものは次のとおりです。

- **ステレオミックス**：WASM の `mixStereo(...)` は左右別々の `leftChannels` / `rightChannels` 配列と `MixOptions` オブジェクトを取り、Python の `mix_stereo(...)` は `[(left, right), …]` の strips と、`fader_db`・`pan`・`width`・`input_trim_db` などのキーワード配列を取ります。
- **`timeStretch(...)` / `pitchShift(...)`**：WASM は `samples, sampleRate, rateOrSemitones`、Node ネイティブは `samples, rateOrSemitones, sampleRate?` の順です。両者を移植するときは数値引数をすべて明示してください。
- **メータータップ**：プリ / ポストフェーダーのタップを明示したい場合は `meterTap(strip, tap)` を使います。Node の `stripMeter(strip)` はポストフェーダーの簡易入口です。

### 設定・戻り値・データの形

| 項目 | 違いの内容 |
|------|-----------|
| マスタリングチェーン設定 | `masteringChain(...)` と `StreamingMasteringChain` はネストした設定オブジェクトを使い、`masterAudio(...)` の上書き値はフラットなドット記法を使う |
| `StreamingMasteringChain` の対象 | ブロック処理できるステージ専用。前後文脈やファイル全体が必要な repair 段と `loudness` 段は拒否されるため、それらは 1 回呼び出しのマスタリング API を使う |
| `analyze(...)` の戻り値 | C ABI・Python・Node ネイティブ・WASM のいずれも完全な `analyze` 結果を返す。コード、セクション、音色、ダイナミクス、リズム、メロディー、フォーム、ビートごとの強さが含まれる。専用関数（`detect_chords`、`analyze_sections` …）は、追加パラメータが必要なときや、全パイプラインを通さず 1 ファミリーだけ欲しいときに引き続き使える |
| `normalize(...)` の既定値 | モジュール関数 `normalize(...)`（Python・WASM・Node ネイティブ）はいずれも `0.0`（フルスケール）が既定。Python の `Audio.normalize()` 便利メソッドのみ `target_db=-3.0` が既定のまま |
| `bounceOffline(...)` の LUFS | C API と WASM で LUFS 正規化の既定値が揃っている。古いコードを移植するときは、意図が重要なら `normalizeLufs` / `normalize_lufs` を明示する |
| `trim` と `trimSilence` | `trim(...)` は単純な `thresholdDb` で音声だけを返す。`trimSilence(...)` / `trim_silence(...)` は `librosa.effects.trim` 互換で、`topDb`・フレーム RMS・元音源上のサンプル範囲を扱う |
| オートメーションカーブ | エンジン API とミキシング API で共有の `AutomationCurve`（`linear`・`exponential`・`hold`・`s-curve`）。古いコードのモジュール別 enum 名はこの共有名に読み替える |
| Scene JSON | 永続ミキサーの交換形式。実行時に編集した状態を保存する場合は、手書き JSON より WASM/Node の `Mixer.toSceneJson()`、Python の `Mixer.to_scene_json()` を優先する |
| プロジェクトバウンスの種類 | ヘッドレス DAW の `Project` は各バインディングで音声へバウンスできる。楽器バインド付きバウンス（`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`）と、テイク／コンプのアレンジモデルは共通 — [プロジェクトバウンス](./project-bounce.md)と[録音とテイク](./recording-and-takes.md)を参照。`ExternalInstrument` バウンスプロトコルは Python 専用 |
| マスタリングチェーン JSON | チェーン JSON と named processor のパラメータマップは同じフィールド集合を round-trip する。対象は `repair.declip` の `lpcBlend`、multiband のバンド別パラメータ、コンプレッサーの detector / sidechain HPF / PDR 設定、リアルタイムボイスチェンジャーの ISP limiter 設定 |
| 音響解析 | 測定とブラインド推定の入口は `AcousticResult` を返す。幾何ベースのルーム音響では等価ルーム推定、RIR 合成、ルームモーフィングも使える（ブラインド推定と等価ルーム推定は信頼度と一緒に表示する） |
| エンジンのレーンミキサー / MIDI クリップ | コンパイル済みの形はどのバインディングでも同一（`EngineTrackLane` / `EngineTrackSend` / `EngineBus`。MIDI イベントは絶対サンプルの `renderFrame` と UMP ワードを持つ）。Python は `EngineMidiClipSchedule` / `EngineMidiEvent` の dataclass を使い、JS/Node はプレーンオブジェクトを渡す。素のエンジンの `setSoloMute` は固定のレーンインデックスを取るが、ブラウザの `SonareEngine` Worklet ファサードはトラック id *または名前*を受け取る。ストリップ EQ バンドはどちらの面でも `EqBand` オブジェクトまたはバンド JSON 文字列で渡せる（`setTrackStripEqBand` / `setMasterStripEqBand`、生 JSON 用に `…EqBandJson` 系もある） |
| エラー | どのバインディングも同じ C ABI 数値コードを持つ構造化 `SonareError` を送出する。WASM と Node は `code` + `codeName` 付きの `Error` サブクラスをスロー（`ErrorCode` enum と `isSonareError` ガードをエクスポート）。Python は `.code` 付きの `RuntimeError` サブクラスを送出。Python CLI はコードを終了コードへ対応付ける（C++ CLI は従来どおり `0`/`1`） |
| CLI の提供範囲 | PyPI の Python CLI か、ソースビルドの C++ CLI かで異なる。詳細は [CLI](./cli.md) を参照 |

::: info 詳細な解析フィールド
C ABI・Python・Node ネイティブ・WASM のいずれも、`analyze(...)` の結果にコード、セクション、音色、ダイナミクス、リズム、メロディー、フォーム、ビートごとの強さが含まれます。

1 つのファミリーだけが必要なとき、または all-in-one では調整できないパラメータを触りたいときは、ランタイム共通で focused helper も使えます。

| 目的 | ヘルパー |
|------|----------|
| コード | `detectChords` / `detect_chords` |
| セクション | `analyzeSections` / `analyze_sections` |
| 音色 | `analyzeTimbre` / `analyze_timbre` |
| ダイナミクス | `analyzeDynamics` / `analyze_dynamics` |
| リズム | `analyzeRhythm` / `analyze_rhythm` |
:::

## 移植時の確認手順

JavaScript の例を Python に移す、Python の検証コードを C++ に移す、という作業では次の順で確認してください。

1. 関数名を対応表で読み替える。`detectBpm` なら `detect_bpm`、`melSpectrogram` なら `mel_spectrogram` のように探します。
2. 入力音声の形をそろえる。多くの API は、デコード済みのモノラルサンプル列と `sampleRate` を受け取ります。
3. オプション名と既定値を確認する。特に `nFft` / `n_fft`、`hopLength` / `hop_length`、`nMels` / `n_mels` は結果に直結します。
4. 戻り値の行列の読み方を確認する。`[rows x nFrames]` の row-major 配列を、別の言語で列優先として読まないようにします。
5. 数値が完全一致しなくても、許容範囲と用途を確認する。浮動小数点、窓関数、デコード差で小さな差が出る場合があります。

## 検証時の根拠

対応状況を確認するときは、次のソースを公開 API の根拠として扱ってください。

- `bindings/wasm/src/index.ts`
- `bindings/python/src/libsonare/analyzer.pyi`
- `bindings/node/src/index.ts`
- `src/sonare_c.h`
- `src/sonare_c_acoustic.h`
- `src/sonare.h`
- `tools/sonare_cli.cpp`

libsonare リポジトリには、C++、C ABI、Python、Node、WASM 間の既定値、定数／enum、パラメータ名を確認する `tools/parity` もあります。
