# バインディング対応表

libsonare は単一の C++ コアを、C、Python、Node ネイティブ、WASM、CLI から公開しています。機能セットはできるだけ揃えていますが、言語ごとに命名規則や設定オブジェクトの形が異なります。

[機能マップ](./api-surface.md) で機能ファミリーを確認したあと、どのランタイムを使うか、別バインディングへコードを移すときに何が変わるかを確認するためのページです。

「バインディング」は、同じ C++ 実装を別の言語から呼べるようにする薄い接続層です。たとえば `detect_bpm` と `detectBpm` は、名前の書き方は違っても、同じ種類の処理を呼びます。このページでは、その名前・引数・戻り値の違いを見比べます。

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

| 機能ファミリー | WASM | Python | Node ネイティブ | C++ | C ABI | CLI |
|----------------|------|--------|-------------|-----|-------|-----|
| バッチ解析 | 対応 | 対応 | 対応 | 対応 | 対応 | 対応 |
| 低レベル特徴量と librosa 互換ヘルパー | 対応 | 対応 | 対応 | 対応 | 対応 | 主要コマンドに対応 |
| ストリーミングアナライザー | 対応 | 対応 | 対応 | 対応 | 対応 | 非対応 |
| Mel/MFCC 逆再構成 | 対応 | 対応 | 対応 | 対応 | 対応 | 非対応 |
| リアルタイムエンジン | 対応 | 対応 | 対応 | 対応 | 対応 | 非対応 |
| マスタリング preset/chain/processor | 対応 | 対応 | 対応 | 対応 | 対応 | 一部コマンド対応 |
| マスタリングアシスタント／プロファイル／プレビュー JSON | 対応 | 対応 | 対応 | 対応 | 対応 | 専用 CLI はなし |
| ミキシングエンジンとシーン | 対応 | 対応 | 対応 | 対応 | 対応 | `mix`。C++ CLI ではシーンプリセット書き出しも対応 |
| 編集 DSP | 対応 | 対応 | 対応 | 対応 | 対応 | 対応 |
| メータリング（オフライン計測、クリッピング／ダイナミックレンジ、ステレオイメージ、スペクトル） | 対応 | 対応 | 対応 | 対応 | 対応 | C++ CLI `meter`／`clipping`／`dynamic-range`。Python CLI コマンドはなし |
| スケール量子化 | 対応 | 対応 | 対応 | 対応 | 対応 | 非対応 |
| 室内音響解析 | `analyzeImpulseResponse`, `detectAcoustic` | `analyze_impulse_response`, `detect_acoustic`, `Audio.detect_acoustic()` | 対応 | `quick::analyze_impulse_response`, `quick::detect_acoustic` | `sonare_analyze_impulse_response`, `sonare_detect_acoustic` | `sonare acoustic [--ir]` |
| ファイルデコード | ブラウザでは非対応。デコード済みサンプルを渡す | 標準は WAV/MP3、FFmpeg ビルドで追加形式 | 標準は WAV/MP3、FFmpeg ビルドで追加形式 | ビルド設定に依存 | ビルド設定に依存 | Python/C++ 実行ファイルのビルドに依存 |

## 形の違い

同じ機能でも、配列や設定の渡し方が違うことがあります。移植時に一番バグりやすいのは、計算式そのものではなく「行列をどう平坦化しているか」「オプションをオブジェクトで渡すかキーワード引数で渡すか」「返ってくる値の名前が違うか」です。

- WASM の `masteringChain(...)` と `StreamingMasteringChain` はネストした設定を使い、`masterAudio(...)` の上書き値はフラットなドット記法を使います。
- `StreamingMasteringChain` はブロック処理できるステージ用です。前後文脈やファイル全体が必要な repair 段と `loudness` 段は拒否されるため、それらは 1 回呼び出しのマスタリング API を使います。
- `analyze(...)` の戻り値はバインディング間で完全には同じではありません。WASM は `quick::analyze` 由来の完全な形を返し、コード、セクション、音色、ダイナミクス、リズム、フォームを含みます。Python、Node ネイティブ、C ABI は C API のコンパクトな結果（`bpm`、キー、拍子、ビート時刻）を公開します。詳細な項目は `detect_chords` / `detectChords`、`analyze_sections` / `analyzeSections`、`analyze_timbre` / `analyzeTimbre`、`analyze_dynamics` / `analyzeDynamics`、`analyze_rhythm` / `analyzeRhythm` を呼び出してください。
- WASM の `detectChords(...)` はオプションオブジェクトを取りますが、Node ネイティブと Python は同じ制御項目を位置引数 / キーワード引数として公開します。
- `mfccToAudio(...)` の引数順は JavaScript ランタイム間で異なります。WASM は `(mfcc, nMfcc, nFrames, nMels, sampleRate, ...)`、Node ネイティブは `(mfcc, nMfcc, nFrames, sampleRate, nFft, hopLength, nMels, ...)` です。Python は C API に近く、`n_mels` を `sample_rate` より前に置きます。
- Python の `mix_stereo(...)` は `[(left, right), ...]` の strips と、`fader_db`、`pan`、`width`、`input_trim_db` などの keyword 配列を受け取ります。
- WASM の `mixStereo(...)` は、左右別々の `leftChannels` / `rightChannels` 配列と `MixOptions` object を受け取ります。
- 永続 `Mixer` のストリップ参照には少し差があります。WASM の mixer メソッドは数値のストリップインデックスを取り、ID からは `stripById(id)` で引きます。Node ネイティブと Python は、多くの mixer 制御メソッドで数値インデックスとストリップ ID 文字列の両方を受け取ります。メーターでプリ / ポストフェーダーのタップを明示したい場合は `meterTap(strip, tap)` を使います。Node の `stripMeter(strip)` はポストフェーダーの簡易入口です。
- ストリーミングアナライザーは CLI 以外のすべてのバインディングに同梱されています。WASM は `StreamAnalyzer.process(...)`、`readFrames(...)`、`stats()` を公開し、Node ネイティブは float の Structure-of-Arrays 読み出しを `readFramesSoa(...)` と呼びます。Python は `process(...)`、`read_frames(...)`、`stats()` を使います。いずれも量子化版の `readFramesI16`／`readFramesU8`（Python では `read_frames_i16`／`read_frames_u8`）と `StreamConfig.outputFormat`／`output_format` フィールドを備えています。
- `normalize(...)` の既定値は呼び出し口で異なります。Python のモジュール関数 `normalize(...)`、WASM、Node ネイティブはいずれも `0.0`（フルスケール）が既定で、Python の `Audio.normalize()` 便利メソッドのみ `target_db=-3.0` が既定のままです。
- `trim(...)` と `trimSilence(...)` は別のヘルパーです。`trim(...)` は単純な `thresholdDb` で音声だけを返します。`trimSilence(...)` / Python `trim_silence(...)` は `librosa.effects.trim` 互換で、`topDb`、フレーム RMS、元音源上のサンプル範囲を扱います。
- 永続ミキサーの交換形式は Scene JSON です。実行時に編集した状態を保存する場合は、手書き JSON より WASM/Node の `Mixer.toSceneJson()`、Python の `Mixer.to_scene_json()` を優先してください。
- 音響解析は、測定済みインパルスレスポンス用の解析と、通常音声からのブラインド推定の 2 つの入口があります。ブラインド推定は信頼度と一緒に表示してください。
- CLI の提供範囲は、PyPI の Python CLI か、ソースビルドの C++ CLI かで異なります。詳細は [CLI](./cli.md) を参照してください。

## 移植時の確認手順

JavaScript の例を Python に移す、Python の検証コードを C++ に移す、という作業では次の順で確認してください。

1. 関数名を対応表で読み替える。`detectBpm` なら `detect_bpm`、`melSpectrogram` なら `mel_spectrogram` のように探します。
2. 入力音声の形をそろえる。多くの API は、デコード済みのモノラルサンプル列と `sampleRate` を受け取ります。
3. オプション名と既定値を確認する。特に `nFft` / `n_fft`、`hopLength` / `hop_length`、`nMels` / `n_mels` は結果に直結します。
4. 戻り値の行列の読み方を確認する。`[rows x nFrames]` の row-major 配列を、別の言語で列優先として読まないようにします。
5. 数値が完全一致しなくても、許容範囲と用途を確認する。浮動小数点、窓関数、デコード差で小さな差が出る場合があります。

## 検証時の根拠

対応状況を確認するときは、`bindings/wasm/src/index.ts`、`bindings/python/src/libsonare/analyzer.pyi`、`bindings/node/src/index.ts`、`src/sonare_c.h`、`src/sonare.h`、`tools/sonare_cli.cpp` を公開 API の根拠として扱ってください。
