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
| マスタリングチェーン設定 | WASM の `masteringChain(...)` はネストした object を取り、同じオブジェクト内でドット記法のリーフキーも受け付ける | フラットなドット記法の上書き値と dict 設定 | C++ struct、C ABI struct／JSON ヘルパー |
| プリセット上書き | `masterAudio(...)` はフラットなドット記法 | フラットなドット記法 | フラットなパラメータまたは C++ 設定の変更 |
| ミキサーシーン | JSON 文字列と `Mixer` | JSON 文字列と `Mixer` | `mixing::api::Scene` と JSON ヘルパー |

## 機能対応

DSP コアは 1 つで、その周りのランタイムは手書きです。コアの実装は 1 つきりで、どのランタイムもそこへ呼び込むため、Python で計算した結果と WASM で計算した結果は同じコードから出てきます。一方、コアを包む API サーフェスはバインディングごとに手で書かれており、同一ではありません。

libsonare リポジトリは、その差を主張ではなく計測で示します。`tools/parity/surface-coverage.md` は生成される対応表で、行は機能ドメインごと（ドメインは関数が宣言されている公開 C ヘッダーなので、ヘッダーが増えれば行も自動的に増えます）、列はランタイムごとです。Python、Node、WASM に加え、2 つのコマンドラインフロントエンドは別々の列になります。Python の `sonare` CLI とネイティブの `sonare-cli` は別のバイナリで、コマンドの集合も異なるためです。各セルはそのドメインの C ABI 入口のうちランタイムが到達できる本数で、最終行が全ドメインの合計です。ここに数値を転記していないのは意図的です。この対応表は parity チェッカーの抽出器から `make surface-coverage` で再生成され、追跡しているコピーがヘッダーからずれると `make surface-coverage-check` が CI で失敗するので、古くなりようがないのはファイル本体だけだからです。

セルの値は品質ではなく到達範囲についての記述として読んでください。どちらの CLI も設計上絞り込まれていますし、WASM はホストのファイルシステムもスレッドを必要とする機能も公開できません。これらの列の不足は欠陥ではなく想定どおりの形です。入口が「到達できる」と数えられるのは、parity チェッカーがそのランタイム固有の命名で見つけられたときで、クラスのメソッド、ハンドル接頭辞を付け替えた名前、検証済みの別名はいずれも到達として数えます。ファサードがコンストラクタや RAII で肩代わりするライフサイクルヘルパーは、構造上到達できるものとして数えます。許可リストに載っている差も差として数えます。許可リストの項目は「その欠落を検討済み」という記録であって、「埋まっている」という意味ではありません。特定の 1 つの呼び出しがあるランタイムから到達できるかを知りたいときは、ドメインごとの行で範囲を絞り、下の[検証時の根拠](#検証時の根拠)で確定させてください。

下の表は、その対応表に対応する読み物側の一覧です。各機能ファミリーについて、ライブラリ系での対応状況と CLI の対応範囲を示します。行に断りがなければ、ライブラリ系バインディングすべてにその機能があります。バインディングごとの名前の違いは上の[命名規則](#命名規則)に従います。

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| バッチ解析 | 対応 | 対応 |
| 低レベル特徴量と librosa 互換ヘルパー | 対応 | 主要コマンド |
| NMF ステム分離（`decomposeStems` / `decomposeStemsLinked`、`decompose_stems` / `decompose_stems_linked`） | 対応 — WASM、Node、Python、C ABI | モノラル入力の `decompose-stems` のみ |
| 定Qクロマ（`chromaCqt` / `chroma_cqt`） | 対応 — WASM、Node、Python、C ABI | 非対応 |
| ストリーミングアナライザーと処理器（`StreamAnalyzer`、`StreamingEqualizer`、`StreamingMasteringChain`） | 対応 | 非対応 |
| Mel/MFCC 逆再構成 | 対応 | 非対応 |
| リアルタイムエンジン | 対応 | 非対応 |
| エンジンのレーンミキサー（レーン、バス、センド、チャンネルストリップ）と MIDI クリップスケジュール | 対応 — [リアルタイムエンジン](./realtime-engine.md#レーンミキサー)を参照 | 非対応 |
| リアルタイムスコープとワイドメーターのテレメトリ | 対応 — [リアルタイムエンジン](./realtime-engine.md#サラウンドグループバスとワイドメーター)を参照 | 非対応 |
| トラックごとの PFL/AFL（フェーダー前／フェーダー後）キューモニタリング | 対応 — [リアルタイムエンジン](./realtime-engine.md#トラックモニタータップ-off・pfl・afl)を参照。WASM の AudioWorklet からも到達可能 | 非対応 |
| マスタリング preset/chain/processor | 対応 | 一部のみ |
| マスタリングアシスタント／プロファイル／プレビュー JSON | 対応 | 専用コマンドなし |
| ステレオ版アシスタント／プロファイル／プレビュー JSON（`masteringAudioProfileStereo`、`masteringAssistantSuggestStereo`、`masteringStreamingPreviewStereo`） | 対応 — WASM、Node、Python（`mastering_audio_profile_stereo` ほか）、C ABI（`sonare_mastering_audio_profile_stereo` ほか）。ダウンミックスではなく左右のペアを測定する。ダウンミックスは無相関素材で積分ラウドネスを約 6 dB 過小に読む — [ステレオ素材](./mastering-assistant.md#ステレオ素材)を参照 | 専用コマンドなし |
| ステレオ版クレストファクター（`meteringCrestFactorDbStereo` ／ `metering_crest_factor_db_stereo`） | 対応 — WASM、Node、Python、C ABI（`sonare_metering_crest_factor_db_stereo`） | 非対応 |
| ミキシングエンジンとシーン | 対応 | `mix`（C++ CLI はシーンプリセット書き出しも対応） |
| ミキシングアシスタント（`suggestMixScene` / `suggest_mix_scene`） | 対応 — WASM、Node、Python、C ABI（`sonare_mixing_assistant_suggest`）。一般の CMake ビルドでは `BUILD_MIXING_ASSISTANT`（既定 ON）を切り替えられますが、Node ネイティブアドオンの通常ビルドはキャッシュ値にかかわらず ON を強制します。`SONARE_WASM_ANALYSIS_ONLY` を指定すると強制的に無効になります。無効なビルドでも入口はエクスポートされたまま `NotSupported` を返すため、シンボルの有無ではなく機能カタログで判定してください — [ミキシングアシスタント](./mixing-assistant.md)を参照 | 対応 — `suggest-mix` |
| サラウンド・マルチチャンネルミキシング | プロジェクトのグラフ／バウンスとリアルタイムエンジンは 5.1/7.1 出力に対応します。リアルタイムエンジンでは、ストリップの `surroundPan` 位置に従ってレーンを 5.1/7.1 グループバスへパンし、ワイドメーターも取得できます。単体のオフライン `Mixer.processStereo` はステレオ専用です。`sourceChannelLayout` はメタデータとして保存されるだけで、レーン入力をマルチチャンネルのまま保持するものではありません。[サラウンドとマルチチャンネル](./mixing.md#サラウンドとマルチチャンネル)を参照してください。 | 対応 — `project bounce` は 1/2/6/8 チャンネル出力に対応 |
| プロジェクト・アレンジ編集（ヘッドレス DAW） | 対応 — [プロジェクト編集](./project-editing.md)を参照 | 対応 |
| 型付きオートメーションターゲット（トラックフェーダー／パン） | 対応 — [プロジェクト編集](./project-editing.md#オートメーションレーン)を参照 | 非対応 |
| オーディオソースの所有メタデータ（`contentHash` / `externalStemRole`） | 対応 — [プロジェクト編集](./project-editing-midi.md#モデルを読み戻し、読み込み後に音声を再バインドする)を参照 | 非対応 |
| 内蔵シンセサイザー（NativeSynth）のプリセット／パッチ | 対応 — [内蔵シンセサイザー](./native-synth.md)を参照 | 対応 — `project bounce --synth <preset>` で NativeSynth プリセットを固定でき（一覧は `project synth-presets`）、値なしの `--synth` は GM プログラムに追従する |
| シンセバウンスでの GM プログラム追従 | C ABI（`use_gm_programs`）、Python（`auto_select_gm=`）、WASM／Node のシンセバウンスバインディング（`useGmPrograms`）で、入力された GM バンク／プログラム変更に追従できる。明示したパッチはフォールバックになる | 対応 — 値なしの `--synth` フラグ |
| 機能カタログとビルド診断 | 対応 — すべてのサーフェスで `capabilityCatalog()` / `capability_catalog()` と `capabilities()`。正規 JSON は C ABI 経由 | 対応 — `doctor` |
| 長時間のオフライン呼び出しの協調キャンセル | 対応 — Node と WASM は `cancel?: () => boolean`、Python は `cancel=`、C ABI は `SonareCancelCallback`。キャンセルされた呼び出しはエラーコード 8 を返し、出力を確保しない | 非対応 |
| SoundFont 2 プレイヤー | 対応 — [SoundFont 2 プレイヤー](./soundfont-player.md)を参照 | 非対応（Project API のみ） |
| リアルタイムエンジンのライブ MIDI 入力 | 対応 — [MIDI 入力](./midi-input.md)を参照 | 非対応 |
| 外部 MIDI 出力とクロック／トランスポート転送 | 対応 — WASM、Node、Python、C ABI。ブラウザのワークレットでは MIDI 1.0 に変換済みのメッセージを `onMidiOut` で受け取る | 非対応 |
| Web MIDI ブリッジ（`bindWebMidi`）とマイク接続（`bindMicrophoneInput`） | WASM／ブラウザ専用 | 非対応 |
| 外部楽器バウンスプロトコル（`ExternalInstrument`） | Python 専用 — [プロジェクトバウンス](./project-bounce.md)を参照 | 非対応 |
| 編集 DSP | 対応 | 対応 |
| 領域ベースのスペクトル編集（`spectralEdit`） | 対応 — [スペクトル編集](./spectral-editing.md)を参照 | 非対応 |
| メータリング（計測、クリッピング／ダイナミックレンジ、ステレオイメージ、スペクトル） | 対応 | C++ CLI のみ（`meter`／`clipping`／`dynamic-range`） |
| スケール量子化 | 対応 | 非対応 |
| ルーム音響解析 | 対応 | `sonare acoustic [--ir]`、`estimate-room`、`synthesize-rir`、`room-morph` |
| ファイルデコード | ネイティブ: WAV/MP3（FFmpeg ビルドで追加形式）。WASM: 多くの API はデコード済みサンプルを受け取り、`Audio.fromMemory(...)` は WAV/MP3 バイト列をデコードでき、ブラウザ側デコードでは対応形式も読めます | ネイティブビルドに準拠 |

## 形の違い

同じ機能でも、引数の形・設定のレイアウト・戻り値がバインディングごとに違うことがあります。移植時に一番バグりやすいのは、計算式そのものではなく「行列をどう平坦化しているか」「オプションをオブジェクトで渡すかキーワード引数で渡すか」「返ってくる値の名前が違うか」です。

### 関数・引数の形

次の関数はライブラリ系バインディングに共通して存在しますが、引数の渡し方が異なります。名前は[命名規則](#命名規則)（camelCase と `snake_case`）に従います。

| 関数 | WASM | Node ネイティブ | Python |
|------|------|----------------|--------|
| `detectChords` / `detect_chords` | オプションオブジェクト | オプションオブジェクトまたは従来の位置引数 | 位置引数 / キーワード引数 |
| `decomposeStemsLinked` / `decompose_stems_linked` | `channels` を持つ平面チャンネルのリクエストオブジェクト | `channels` を持つ平面チャンネルのリクエストオブジェクト | 平面チャンネル列または 2 次元配列と、位置／キーワードオプション |
| ストリーミング読み出し | `process`、`readFrames`、`stats` | float の Structure-of-Arrays 読み出しは `readFramesSoa` | `process`、`read_frames`、`stats` |
| 量子化ストリーム読み出し | `readFramesI16` / `readFramesU8`（レガシーの `StreamConfig.outputFormat` は `0`） | WASM と同じ | `read_frames_i16` / `read_frames_u8`（レガシーの `output_format` は `0`） |
| `Mixer` のストリップ参照 | 数値インデックス。ID 参照は `stripById(id)` | 数値インデックスまたはストリップ ID 文字列 | 数値インデックスまたはストリップ ID 文字列 |
| ステレオミックス（`mixStereo` / `mix_stereo`） | 左右別々の `leftChannels` / `rightChannels` 配列と `MixOptions` オブジェクト | WASM と同じ | `[(left, right), …]` の strips と、`fader_db`・`pan`・`width`・`input_trim_db` などのキーワード配列 |
| `timeStretch` / `pitchShift` | `(samples, sampleRate, rate/semitones)` | WASM と同じ | `(samples, sample_rate, rate/semitones)` |
| メータータップ（`meterTap` / `stripMeter`） | 明示的なプリ／ポストフェーダータップは `meterTap(strip, tap)`。`stripMeter(strip)` はポストフェーダーの簡易入口 | WASM と同じ | `meter_tap(strip, tap)` / `strip_meter(strip)` |
| ピーク／RMS 正規化 | 関数は 2 つで、統計量は `mode: 'peak' \| 'rms'` で選びます。`normalize(...)`（リクエストオブジェクトまたは位置引数）と `normalizeStereo(request)`（リクエストのみ）です。リクエストは `validate?` を受け取り、長さの揃わないペアはコアへ届く前に JavaScript 側で `RangeError` として拒否されます | 同じ 2 つの関数と同じ `mode` ですが、ステレオ版のリクエストは `validate` を持たず、JavaScript 側の長さ検査もありません。長さの揃わないペアはコアから `ErrorCode.InvalidParameter` の `SonareError` として返ります | 関数は 4 つで `mode` 引数はありません。モノラルは `normalize` / `normalize_rms`、ペアは `normalize_stereo` / `normalize_rms_stereo` で、いずれもキーワード引数 `validate=` を取ります |

### 設定・戻り値・データの形

| 項目 | 違いの内容 |
|------|-----------|
| マスタリングチェーン設定 | `masteringChain(...)` と `StreamingMasteringChain` はネストした設定オブジェクトを取り、`masterAudio(...)` の上書き値はフラットなドット記法を使う。`MasteringChainConfig` では両方の書き方が型付きでサポートされており、`'loudness.targetLufs'` のようなドット記法のリーフキーは、対応するネスト形式と並べても置き換えても構わない。動的に組み立てる上書き値にはこちらが扱いやすく、C ABI が運ぶ形式でもある。手で書くコードでは正準なネスト形式を選ぶこと。ネスト形式はフィールド単位で型検査されるが、ドット記法のキーは実行時にしか検査されない |
| ステレオ版アシスタント／メータリングのリクエスト型 | モノラル版と並んで追加されたステレオ版の入口は、どの JS 系サーフェスでも**リクエストオブジェクト専用**で、位置引数のオーバーロードはありません。リクエスト型の名前もバインディングごとに異なり、WASM はプロファイルと提案で `MasteringStereoParamsRequest` を共有するのに対し、Node は `MasteringAssistantSuggestStereoRequest` と `MasteringAudioProfileStereoRequest` に分かれる（後者は前者を継承し、フィールドの追加はない）。Python は通常の位置引数／キーワード引数（`left, right, sample_rate=…`）を取り、C ABI は `const float* left, const float* right, size_t length` を取る |
| `StreamingMasteringChain` の対象 | ブロック処理できるステージ専用。前後文脈やファイル全体が必要な repair 段は拒否する。`loudness` 段は、事前計算した静的ゲインを `loudnessStaticGainDb`（JS）/ `loudness_static_gain_db`（Python）で渡せば利用でき、音源の True Peak も任意で指定できる。静的ゲインを指定しない場合はコンストラクタが拒否する |
| `analyze(...)` の戻り値 | C ABI・Python・Node ネイティブ・WASM のいずれも完全な `analyze` 結果を返す。コード、セクション、音色、ダイナミクス、リズム、メロディー、フォーム、ビートごとの強さが含まれる。専用関数（`detect_chords`、`analyze_sections` …）は、追加パラメータが必要なときや、全パイプラインを通さず 1 ファミリーだけ欲しいときに引き続き使える |
| 正規化の既定値と戻り値 | モノラルのピーク正規化は、Python・WASM・Node ネイティブのいずれでも `0.0` dBFS が既定です（モジュール関数 `normalize(...)` と `Audio.normalize()` 便利メソッドの両方）。これはゲイン 0 を適用するのではなく、ピークをフルスケールへ正規化する意味です。RMS の既定は `-20.0` dBFS で、Python の `normalize_rms` / `normalize_rms_stereo` と、CLI が従うライブラリ既定値がこれにあたります。JS 系の 2 サーフェスはここで自分のモノラル版と食い違います。`normalizeStereo` の `targetDb` は**モードごとに**既定が変わり、`'peak'` では `0`、`'rms'` では `-20` です。一方 `normalize` はどちらのモードでも `0` を既定にします。RMS 目標を `0` dBFS にすると事実上すべてのピークがフルスケールを超えるためです。ステレオ版の入口は 4 つとも、ペア全体でレベルを 1 つ測り、同じゲインを両チャンネルへ適用します。したがってステレオバランスは保たれ、戻り値もペアではなく単一の `appliedGainDb` / `applied_gain_db` を報告します。無音のペアは手を加えずに `0` で返ります。Python の `NormalizeStereoResult` には JS 側の戻り値にない 4 つめのフィールド、共有される `length` があります |
| `bounceOffline(...)` の LUFS | C API と WASM で LUFS 正規化の既定値が揃っている（LUFS はフルスケール基準のラウドネス単位。詳細は[LUFS](./glossary/lufs.md)）。古いコードを移植するときは、意図が重要なら `normalizeLufs` / `normalize_lufs` を明示する |
| `mfcc` の lifter | `mfcc(...)` / `mfcc` はどのバインディングでも末尾に `lifter` / `lifter` 引数を取る（ケプストラルリフタリング。既定は `0` でリフタリングなし）。C ABI の明示レンジ入口は `sonare_mfcc_ex` |
| `trim` と `trimSilence` | `trim(...)` は単純な `thresholdDb` で音声だけを返す。`trimSilence(...)` / `trim_silence(...)` は `librosa.effects.trim` 互換で、`topDb`・フレーム RMS・元音源上のサンプル範囲を扱う |
| オートメーションカーブ | ミキシング API とエンジン API では、カーブ型の名前が別々です。ミキシングの `AutomationCurve` は `'linear'`・`'exponential'`・`'hold'`・`'s-curve'` を取ります。エンジン／プロジェクト API はこれとは別の型 — `EngineAutomationPointCurve`（Node）／`ProjectAutomationCurve`（WASM。序数 `0`〜`3` も受け取る）— を使い、s-curve の値はミキシングの `'s-curve'` ではなく `'scurve'`（ハイフンなし）と綴ります。両者で名前も綴りも共通だと考えないでください |
| オートメーション対象の種別 | 上のカーブ形状の軸とは別の軸です。`SonareAutomationTargetKind` / `ProjectAutomationTargetKind`（WASM）は、プロジェクトのオートメーションレーンが何を駆動するかを分類します — 中身をエンジンが解釈しない従来のホスト定義ターゲット、または型付きのトラックフェーダー（`TRACK_FADER_DB`）／パン（`TRACK_PAN`）ターゲットです。Node は `targetKind`、Python はキーワード引数 `target_kind`（または序数 `0`/`1`/`2`）で公開します。型付きレーンを追加すると、プロジェクト JSON はスキーマバージョン `2` に上がります。従来のレーンだけのプロジェクトはスキーマバージョン `1` のまま、既存のバイト列を保ちます — [プロジェクト編集](./project-editing.md#オートメーションレーン)を参照 |
| Scene JSON | 永続ミキサーの交換形式。実行時に編集した状態を保存する場合は、手書き JSON より WASM/Node の `Mixer.toSceneJson()`、Python の `Mixer.to_scene_json()` を優先する |
| クリップループのクロスフェード | `setClipLoop` / `set_clip_loop` は全バインディングで `loopCrossfadePpq` / `loop_crossfade_ppq` を受け取る（ppq は 4 分音符あたりのパルス数）。ループ継ぎ目の equal-power クロスフェードで、プリロールとループ長の半分を上限にクランプされ、ワープ時は無視され、0 でないときだけシリアライズされる |
| プロジェクトバウンスの種類 | ヘッドレス DAW の `Project` は各バインディングで音声へバウンスできる。楽器バインド付きバウンス（`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`）と、テイク／コンプのアレンジモデルは共通 — [プロジェクトバウンス](./project-bounce.md)と[録音とテイク](./recording-and-takes.md)を参照。`ExternalInstrument` バウンスプロトコルは Python 専用 |
| マスタリングチェーン JSON | チェーン JSON と named processor のパラメータマップは同じフィールド集合を持ち、相互に変換しても欠落しない。対象は `repair.declip` の `lpcBlend`、multiband のバンド別パラメータ、コンプレッサーの detector / sidechain HPF / PDR 設定、リアルタイムボイスチェンジャーのサンプル間ピーク（ISP）リミッター設定。このドキュメント自体も独自のスキーマバージョンを持つ。バージョン `1` はフラットな固定 3 バンド（low/mid/high）のマルチバンドコンプレッサー形式。バージョン `2` は、マルチバンドコンプレッサーがクロスオーバーの本数やスロープ／モード、バンド数を変える必要が生じたときに自動選択され、`dynamics.multibandComp` を厳密なフィールド検証を伴う構造化オブジェクトとしてシリアライズする — [マスタリングプロセッサ](./mastering-processors.md#チェーン設定-json-スキーマ)を参照 |
| マスタリングリミッター設定 | `releaseMs` / `release_ms` と `applyGainAtInputRate` / `apply_gain_at_input_rate` をマスタリング helper API で使える。単発 helper ではリリースが 0 のときに 50 ms のライブラリ既定値を保ち、プリセット／チェーンの上書き値はそのまま適用される |
| 音響解析 | 測定とブラインド推定の入口は `AcousticResult` を返す。幾何ベースのルーム音響では等価ルーム推定、RIR 合成、ルームモーフィングも使える（ブラインド推定と等価ルーム推定は信頼度と一緒に表示する） |
| エンジンのレーンミキサー / MIDI クリップ | コンパイル済みの形はどのバインディングでも同一（`EngineTrackLane` / `EngineTrackSend` / `EngineBus`。MIDI イベントは絶対サンプルの `renderFrame` と UMP（Universal MIDI Packet）ワードを持つ）。Python は `EngineMidiClipSchedule` / `EngineMidiEvent` の dataclass を使い、JS/Node はプレーンオブジェクトを渡す。素のエンジンの `setSoloMute` は固定のレーンインデックスを取るが、ブラウザの `SonareEngine` Worklet API はトラック id *または名前*を受け取る。ストリップ EQ バンドはどちらの API でも `EqBand` オブジェクトまたはバンド JSON 文字列で渡せる（`setTrackStripEqBand` / `setMasterStripEqBand`、生 JSON 用に `…EqBandJson` 系もある） |
| 自己類似度系の命名 | Python は JavaScript の `segment_` 接頭辞を落とします。`cross_similarity` / `recurrence_matrix` / `recurrence_to_lag` / `lag_to_recurrence` / `path_enhance` / `subsegment` / `agglomerative` が、`segmentCrossSimilarity` などに対応します |
| `Audio` のサンプル取得 | WASM の `audio.data`、Node の `audio.getData()`、Python の `audio.data` はすべてコピーを返す。返り値に書き込んでもインスタンスは変わらず、取得するたびに確保が発生する |
| 配布形態 | 公開されている成果物は WebAssembly の npm パッケージ、Python ホイール、ネイティブ CLI のアーカイブです。Node ネイティブバインディングは private 指定でローカル依存として使う前提のため、常にソースからビルドします |
| ABI バージョンの照合 | どのバインディングも読み込んだライブラリのインターフェースバージョン（Feature 5、Project 2、Voice changer 2、Acoustic 4、Engine 3）を読めますが、不一致を自動でエラーにするのは Python だけです。import 時に `sonare_abi_version()` のパック値を比較し、`RuntimeError` を送出します。Node と WASM は `projectAbiVersion()` / `engineAbiVersion()` と並べて `EXPECTED_PROJECT_ABI_VERSION` / `EXPECTED_ENGINE_ABI_VERSION` をエクスポートし、比較は利用側に委ねます（エンジンについては WASM の `engineCapabilities().abiCompatible` が比較済みの値です）。C の呼び出し側は `sonare_abi_version()` をコンパイル時の `SONARE_ABI_VERSION` と比較します。[ABI バージョン](./native-bindings.md#abi-バージョン)を参照 |
| エラーの型 | どのバインディングも、同じ C ABI 数値コードを持つ構造化された `SonareError` を送出します。WASM と Node は `code` と `codeName` を持つ `Error` サブクラスをスローし、どちらのパッケージも `ErrorCode` enum と `isSonareError(value)` ガードをエクスポートします。Python は `.code` を持つ `RuntimeError` サブクラスを送出します。両 CLI は失敗を安定した終了コードへ対応付けます（使用方法エラー 2、無効パラメータ 3、キャンセル 11。[CLI](./cli.md)を参照）。バインディング固有の追加が 2 つあります。Python には `SonareValueError` があり、`SonareError` と `ValueError` の両方を継承するため、引数検証の失敗をどちらの `except` でも捕捉できます。C ABI へ到達していない失敗でも `ErrorCode.INVALID_PARAMETER` を持ちます。Node の `SonareError` は実行時のクラスで、`instanceof` はブランド判定です。アドオンがクラスを構築せずに送出したエラーも、ワーカー境界を越えてプロトタイプを失ったエラーも、そのまま絞り込めます。`isSonareError` は同じダックタイピング判定で、両者の結果が食い違うことはありません |
| 同じ失敗の現れ方 | 上の行は、バインディング自身が送出する型についての説明です。バインディング層より下で発生した失敗は、ランタイムごとに違う形で届くことがあります。もっとも分かりやすいのが、未知の insert を指すシーンを `Mixer.fromSceneJson` に渡した場合です。WASM はファサードが包んだメッセージ付きの `InvalidState` を送出し、Node は型のない `Napi::Error`（`code` を持たない素の `Error` なので `isSonareError` は false）を送出し、Python は内側の理由を落とした素の `RuntimeError` を送出し、C ABI は `nullptr` を返して詳細を `sonare_last_error_message()` に残します。呼び出しごとに確認せずに、バインディングをまたいでエラー型で制御を分岐させないでください |
| WASM のオブジェクト戻り値 | 名前一覧ヘルパー（`*Names()`）、プリセット名ヘルパー、`synthPresetPatch`、セクション結果、キー候補ヘルパー、さらにミキサーのメータースナップショット（`meterTap`、`stripMeter`、`busMeter`）とゴニオメーターのサンプル（`readGoniometerLatest`）が返す WASM の配列／オブジェクトは、呼び出し元の JavaScript realm へ再ルートされるため、通常のオブジェクトと同様に `structuredClone()` / `postMessage()` へそのまま渡せる。`Mixer` や `StreamAnalyzer` のようにネイティブメソッドを持つハンドル自体は clone できないため、プレーンな戻り値のデータを渡す |
| CLI の提供範囲 | PyPI の Python CLI か、ソースビルドの C++ CLI かで異なる。詳細は [CLI](./cli.md) を参照 |

::: info 詳細な解析フィールド
C ABI・Python・Node ネイティブ・WASM のいずれも、`analyze(...)` の結果にコード、セクション、音色、ダイナミクス、リズム、メロディー、フォーム、ビートごとの強さが含まれます。

1 つのファミリーだけが必要なとき、または一括解析では調整できないパラメータを触りたいときは、どのランタイムでも個別のヘルパーを使えます。

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

::: tip 行優先と列優先
行優先（row-major）は各行の要素を連続して（1 行ずつ順に）並べ、列優先（column-major）は各列を連続して並べます。libsonare が返す `[rows x nFrames]` 行列は行優先で、最初の 1 行分をすべて並べてから次の行へ進むため、要素は `row * nFrames + frame` で参照します。
:::

## 検証時の根拠

対応状況を確認するときは、次のソースを公開 API の根拠として扱ってください。

- `bindings/wasm/src/index.ts`
- `bindings/python/src/libsonare/analyzer.pyi`
- `bindings/node/src/index.ts`
- `include/sonare/sonare_c.h`
- `include/sonare/sonare_c_acoustic.h`
- `src/sonare.h`
- `tools/sonare_cli.cpp`

libsonare リポジトリには、C++、C ABI、Python、Node、WASM 間の既定値、定数／enum、パラメータ名を確認する `tools/parity` もあります。ランタイム対応表 `tools/parity/surface-coverage.md` もここで生成されます。
