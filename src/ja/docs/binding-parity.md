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
- 同じ失敗が各ランタイムでどのエラークラス・コード・CLI の終了コードになるかを対応付けられる。
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

DSP の実装は C++ コアに 1 つだけあり、どのランタイムもそれを呼び出します。そのため、同じ入力なら Python でも WASM でも同じ結果になります。違うのはコアを包む API サーフェスで、こちらはバインディングごとに手で書かれています。

libsonare リポジトリは、この差を主張ではなく計測で示します。`tools/parity/surface-coverage.md` は生成される対応表で、行は機能ドメイン（関数が宣言されている公開 C ヘッダー）ごと、列はランタイムごとです。Python、Node、WASM に加え、Python の `sonare` CLI とネイティブの `sonare-cli` は別の列になります。コマンドの集合が異なるためです。各セルは、そのドメインの C ABI 入口のうちランタイムが到達できる本数です。数値はここに転記していません。表は `make surface-coverage` で再生成され、追跡コピーがヘッダーとずれると `make surface-coverage-check` が CI で失敗します。

セルの値は品質ではなく到達範囲として読んでください。どちらの CLI も設計上絞り込まれており、WASM はホストのファイルシステムもスレッドを必要とする機能も公開できません。parity チェッカーがそのランタイム固有の命名で入口を見つけられれば到達として数えます（クラスのメソッド、ハンドル接頭辞を付け替えた名前、検証済みの別名）。許可リストに載っている欠落も、欠落として数えます。特定の呼び出しを確かめたいときは、ドメインの行で範囲を絞り、[検証時の根拠](#検証時の根拠)で確定させてください。

以下の表は、その対応表に対応する読み物側の一覧です。**対応**は、セルが範囲を限定していなければ、WASM、Node、Python、C ABI のすべてで使えることを表します。CLI 列にはコマンド名を書くか、非対応または一部のみと書きます。名前の違いは[命名規則](#命名規則)に従います。

### 解析・特徴量・メータリング

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| バッチ解析 | 対応 | 対応 |
| 低レベル特徴量と librosa 互換ヘルパー | 対応 | 主要コマンド |
| 定Qクロマ（`chromaCqt` / `chroma_cqt`） | 対応 | 非対応 |
| コード機能（`chordFunctions` / `chord_functions`。`chordFunctionalAnalysis` も同じエントリを返す） | 対応（`sonare_chord_functions`） | 非対応 |
| コードとキーの注釈変換（`chordSymbolFromAnalysis` / `keyModeFromAnalysis`） | 対応（`sonare_chord_symbol_from_analysis`、`sonare_key_mode_from_analysis`） | 非対応 |
| 測定したチューニング（`tuning: 'auto'`、`referenceHz: 'auto'`、`tuningToReferenceHz` / `referenceHzToTuning`） | 対応 | 非対応 |
| 採譜（`transcribe`、`transcribeToClip`）。ポリフォニックトラッカーの上限、`minNoteDivision`、`referenceHz: 'auto'` を含む | 対応。ポリフォニックの上限（`maxPolyphony`、`minFramePeakRatio`、`minRidgePeakRatio`、`reattackRatio`）はポリフォニックの経路にだけ効きます。[音声から MIDI](./audio-to-notes.md#オプションと制限)を参照 | 両 CLI の `transcribe`。`--max-polyphony` と `--min-note-division` を受け付ける |
| NMF ステム分離（`decomposeStems` / `decomposeStemsLinked`） | 対応 | `decompose-stems`（モノラル入力のみ） |
| Mel/MFCC 逆再構成 | 対応 | ネイティブ CLI のみ: `mel-to-audio`、`mfcc-to-audio` |
| ストリーミングアナライザーと処理器（`StreamAnalyzer`、`StreamingEqualizer`、`StreamingMasteringChain`） | 対応 | 非対応 |
| メータリング（計測、クリッピング、ダイナミックレンジ、ステレオイメージ、スペクトル） | 対応 | ネイティブ CLI のみ: `meter`、`clipping`、`dynamic-range` |
| ステレオ版クレストファクター（`meteringCrestFactorDbStereo`） | 対応（`sonare_metering_crest_factor_db_stereo`） | 非対応 |
| スケール量子化とスケールマスク（`scaleMaskForMode`） | 対応 | 両 CLI の `scale-quantize`。これと `pitch-correct-timevarying` はモード名か 12 ビットのマスクを受け付ける。スケールマスク専用コマンドはなし |

### 編集・リペア・マスタリング

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| 編集 DSP | 対応 | 対応 |
| 領域ベースのスペクトル編集（`spectralEdit`） | 対応。[スペクトル編集](./spectral-editing.md)を参照 | 非対応 |
| 検出したキーまたは指定したキーへの自動ピッチ補正（`autoTune` / `auto_tune`） | 対応（`sonare_auto_tune`） | 非対応 |
| オフラインのボーカル編集（`VocalEditSession` と、プロジェクトに保存されるボーカル編集） | `VocalEditSession` は WASM、Node、Python。プロジェクト側のボーカル呼び出しは一部のみ（10 入口のうち 5）。[オフラインモノフォニックボーカル編集](./vocal-editing.md)を参照 | 両 CLI の `vocal-notes` がセッションのノートを一覧表示する。編集とレンダリングはなし |
| 1 回の呼び出しで行うリペア（`masteringRepairAnalyze` / `masteringRepairApply`） | 対応。チャンネル数は任意で、段の順序は固定、進捗とキャンセルに対応。[オーディオリペアの流れ](./audio-repair.md)を参照 | 非対応（ネイティブの `repair` コマンドは別経路） |
| マスタリングのプリセット・チェーン・プロセッサ | 対応 | 一部のみ |
| マスタリングアシスタント／プロファイル／プレビュー JSON | 対応 | 両 CLI の `mastering-suggest`、`mastering-profile`、`mastering-streaming`（モノラルまたはダウンミックス） |
| ステレオ版アシスタント／プロファイル／プレビュー JSON（`masteringAudioProfileStereo`、`masteringAssistantSuggestStereo`、`masteringStreamingPreviewStereo`） | 対応。左右のペアを測定します。ダウンミックスは無相関の素材で積分ラウドネスを約 6 dB 低く読みます。[ステレオ素材](./mastering-assistant.md#ステレオ素材)を参照 | 専用コマンドなし |
| ストリーミング用ラウドネスゲイン（`streamingLoudnessGain` / `streamingLoudnessGainStereo`） | 対応（`sonare_streaming_loudness_gain[_stereo]`） | 非対応 |
| 固有のサンプルレートを持つリファレンス（ペアプロセッサ、ペア解析、A/B ラウドネスマッチ、EQ マッチの `referenceSampleRate`） | 対応（`reference_sample_rate` 引数、`sonare_eq_match_ex`） | `mastering-pair-analyze` と `mastering-pair-processor` は任意のレートのリファレンスファイルを読む |
| 長時間のオフライン呼び出しの協調キャンセル | 対応。Node と WASM は `cancel?: () => boolean`、Python は `cancel=`、C ABI は `SonareCancelCallback`。キャンセルされた呼び出しはエラーコード 8 を返し、出力を確保しない | 非対応 |

### ミキシングとリアルタイムエンジン

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| ミキシングエンジンとシーン | 対応 | 両 CLI の `mix-strip`。Python CLI にはシーンの `mix` もあります。[CLI](./cli.md)を参照 |
| ミキシングアシスタント（`suggestMixScene` / `suggest_mix_scene`） | 対応（`sonare_mixing_assistant_suggest`）。`BUILD_MIXING_ASSISTANT`（既定 ON。Node アドオンの通常ビルドは ON を強制し、`SONARE_WASM_ANALYSIS_ONLY` は無効にする）がないビルドでも入口は残り、`NotSupported` を返します。シンボルの有無ではなく機能カタログで判定してください。[ミキシングアシスタント](./mixing-assistant.md)を参照 | `suggest-mix` |
| サラウンド・マルチチャンネルミキシング | プロジェクトのグラフ、プロジェクトバウンス、リアルタイムエンジンは 5.1/7.1 出力に対応します。エンジンのレーンはストリップの `surroundPan` に従って 5.1/7.1 グループバスへパンされます。単体の `Mixer.processStereo` はステレオ専用で、エンジンのトラックレーンもステレオのソースしか受け付けません（[チャンネルフォーマット](./channel-formats.md#モジュール別のチャンネル対応)を参照）。[サラウンドとマルチチャンネル](./mixing.md#サラウンドとマルチチャンネル)も参照 | `project bounce` は 1/2/6/8 チャンネルを書き出す |
| リアルタイムエンジン | 対応 | 非対応 |
| エンジンのレーンミキサー（レーン、バス、センド、チャンネルストリップ）と MIDI クリップスケジュール | 対応。[リアルタイムエンジン](./realtime-engine.md#レーンミキサー)を参照 | 非対応 |
| スコープとワイドメーターのテレメトリ | 対応。[リアルタイムエンジン](./realtime-engine.md#サラウンドグループバスとワイドメーター)を参照 | 非対応 |
| トラックごとの PFL/AFL（フェーダー前／フェーダー後）キューモニタリング | 対応。[リアルタイムエンジン](./realtime-engine.md#トラックモニタータップ-off・pfl・afl)を参照。WASM の AudioWorklet からも到達できる | 非対応 |
| レーンごとの `setTrackSends` / `setTrackOutputBus` と、オフラインの `Mixer.setOutputBus` | 対応（`sonare_engine_set_track_sends`、`sonare_engine_set_track_output_bus`、`sonare_mixer_set_output_bus`） | 非対応 |
| ライブ MIDI 入力、および外部 MIDI 出力とクロック／トランスポート転送 | 対応。[MIDI 入力](./midi-input.md)を参照。ブラウザの worklet では MIDI 1.0 に変換済みのメッセージを `onMidiOut` で受け取る | 非対応 |
| ライブプログラムチェンジ（`pushMidiProgram`、`pushMidiInputProgram`） | 対応（`sonare_engine_push_midi_program`）。SoundFont プレイヤー、GM プログラムを付けて割り当てた NativeSynth、ドラムキットの NativeSynth（GS ドラムセットの選択として）が従います。内蔵シンセとほかの NativeSynth パッチは無視します | 非対応 |

### プロジェクト・インストゥルメント・MIDI

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| プロジェクト・アレンジ編集（ヘッドレス DAW） | 対応。[プロジェクト編集](./project-editing.md)を参照 | 対応 |
| 型付きオートメーションターゲット（トラックフェーダーとパン） | 対応。[プロジェクト編集](./project-editing.md#オートメーションレーン)を参照 | 非対応 |
| オーディオソースの所有メタデータ（`contentHash` / `externalStemRole`） | 対応。[プロジェクト編集](./project-save-load.md#モデルを読み戻し、読み込み後に音声を再バインドする)を参照 | 非対応 |
| 内蔵シンセサイザー（NativeSynth）のプリセットとパッチ | 対応。[内蔵シンセサイザー](./native-synth.md)を参照 | `project bounce --synth <preset>` でプリセットを固定できる（一覧は `project synth-presets`）。値なしの `--synth` は GM プログラムに追従する |
| シンセバウンスでの GM プログラム追従 | C ABI の `use_gm_programs`、Python の `auto_select_gm=`、WASM／Node の `useGmPrograms`。明示したパッチはフォールバックになる | 値なしの `--synth` フラグ |
| シンセのパラメータ記述子（`synthEngineParamInfo` / `synthPatchParamInfo`）とパッチの `engineParams` | 対応（`sonare_synth_engine_param_info`、`sonare_synth_patch_param_info`、`SonareSynthPatch.engine_params`） | 非対応 |
| サンプルバンク（`SampleBank`。`sample` エンジンの音源） | 対応。[内蔵シンセサイザー](./native-synth.md)を参照 | 一部のみ |
| パートリグ（`setPartRig` / `getPartRig` / `clearPartRig`） | 対応。[GM と GS](./gm-gs.md#パートリグと-efx-の直列ルーティング)を参照 | 非対応 |
| コンポジションアシスト | 設計上、C ABI と C++ のみ | 非対応 |
| SoundFont 2 プレイヤー | 対応。[SoundFont 2 プレイヤー](./soundfont-player.md)を参照 | 非対応（Project API のみ） |
| 外部楽器バウンスプロトコル（`ExternalInstrument`） | Node と WASM は `bounceWithInstruments` / `bounceWithInstrument`、Python は `bounce_with_instruments`、C ABI は `sonare_project_bounce_with_instruments`。[プロジェクトバウンス](./project-bounce.md)を参照 | 非対応 |
| [再生レンダラー](./playback.md)（`PlaybackRenderer`、`renderPlayback` / `render_playback`） | 対応。モノラル、ステレオ、5.1、7.1 のスピーカー出力とバイノーラル出力 | 両 CLI の `playback` |

### ルーム・ファイル・ブラウザ専用

| 機能ファミリー | ライブラリ系 | CLI |
|----------------|------|-----|
| ルーム音響解析（`estimateRoom` の結果を `synthesizeRir` の入力へ変換する `roomGeometryFromEstimate` を含む） | 対応（`sonare_room_geometry_from_estimate`） | `acoustic [--ir]`、`estimate-room`、`synthesize-rir`、`room-morph` |
| ステレオのルームモーフ（`roomMorphStereo` / `room_morph_stereo`） | 対応（`sonare_room_morph_stereo`） | 2 チャンネルファイルに対する両 CLI の `room-morph` |
| 機能カタログとビルド診断 | すべてのサーフェスで `capabilityCatalog()` / `capability_catalog()` と `capabilities()`。正規 JSON は C ABI 経由 | `doctor` |
| ファイルデコード | ネイティブ: WAV/MP3（FFmpeg ビルドで追加形式）。WASM: 多くの API はデコード済みサンプルを受け取り、`Audio.fromMemory(...)` は WAV/MP3 バイト列をデコードでき、ブラウザ側デコードでは対応形式も読める | ネイティブビルドに準拠 |
| マルチチャンネルのデコードと折りたたみ（`decodeChannels` / `decode_channels`、`downmix`） | 対応（`sonare_decode_channels`、`sonare_downmix`）。折りたたみの規則は[チャンネルフォーマット](./channel-formats.md)にあります | 非対応 |
| Web MIDI ブリッジ（`bindWebMidi`）とマイク接続（`bindMicrophoneInput`） | WASM／ブラウザ専用 | 非対応 |
| OPFS へのクリップ書き込みと取り込み（`writeOpfsClip`、`importOpfsClip`） | WASM／ブラウザ専用 | 非対応 |
| オーディオグラフノードとしてのストリームアナライザー（`SonareStreamAnalyzerNode`） | WASM／ブラウザ専用（`@libraz/libsonare/worklet`） | 非対応 |

## 形の違い

同じ機能でも、引数の形・設定のレイアウト・戻り値がバインディングごとに違うことがあります。移植時に一番バグりやすいのは、計算式そのものではなく「行列をどう平坦化しているか」「オプションをオブジェクトで渡すかキーワード引数で渡すか」「返ってくる値の名前が違うか」です。

### 関数・引数の形

次の関数はライブラリ系バインディングに共通して存在しますが、引数の渡し方が異なります。名前は[命名規則](#命名規則)（camelCase と `snake_case`）に従います。

| 関数 | WASM | Node ネイティブ | Python |
|------|------|----------------|--------|
| `detectChords` / `detect_chords` | オプションオブジェクト | オプションオブジェクトまたは従来の位置引数 | 位置引数 / キーワード引数 |
| `decomposeStemsLinked` / `decompose_stems_linked` | `channels` を持つプレーナー形式のリクエストオブジェクト | `channels` を持つプレーナー形式のリクエストオブジェクト | プレーナー形式のチャンネル列または 2 次元配列と、位置／キーワードオプション |
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
| `StreamingMasteringChain` の対象 | ブロック処理できるステージ専用。前後の文脈やファイル全体が必要なリペア段は拒否する。`loudness` 段は、事前計算した静的ゲインを `loudnessStaticGainDb`（JS）/ `loudness_static_gain_db`（Python）で渡せば利用でき、音源の True Peak も任意で指定できる。静的ゲインを指定しない場合はコンストラクタが拒否する |
| `analyze(...)` の戻り値 | C ABI・Python・Node ネイティブ・WASM のいずれも完全な `analyze` 結果を返す。コード、セクション、音色、ダイナミクス、リズム、メロディー、フォーム、ビートごとの強さが含まれる。専用関数（`detect_chords`、`analyze_sections` …）は、追加パラメータが必要なときや、全パイプラインを通さず 1 ファミリーだけ欲しいときに引き続き使える |
| 正規化の既定値と戻り値 | WASM、Node、Python で、ピーク正規化は `0.0` dBFS、RMS 正規化は `-20.0` dBFS が既定です。Node と WASM のモノラル `normalize` とステレオ `normalizeStereo` も同じです。C ABI では目標値を明示する必要があります。ステレオ版はペア全体でレベルを 1 つ測り、同じゲインを両チャンネルへ適用してバランスを保ちます。戻り値は単一の `appliedGainDb` / `applied_gain_db` で、無音のペアは変更せずゲイン `0` を返します。Python の `NormalizeStereoResult` は共有の `length` も持ちます |
| `bounceOffline(...)` の LUFS | C API と WASM で LUFS 正規化の既定値が揃っている（LUFS はフルスケール基準のラウドネス単位。詳細は[LUFS](./glossary/lufs.md)）。古いコードを移植するときは、意図が重要なら `normalizeLufs` / `normalize_lufs` を明示する |
| `mfcc` の lifter | `mfcc(...)` / `mfcc` はどのバインディングでも末尾に `lifter` / `lifter` 引数を取る（ケプストラルリフタリング。既定は `0` でリフタリングなし）。C ABI の明示レンジ入口は `sonare_mfcc_ex` |
| `trim` と `trimSilence` | `trim(...)` は単純な `thresholdDb` で音声だけを返す。`trimSilence(...)` / `trim_silence(...)` は `librosa.effects.trim` 互換で、`topDb`・フレーム RMS・元音源上のサンプル範囲を扱う |
| オートメーションカーブ | ミキシング API とエンジン API では、カーブ型の名前が別々です。ミキシングの `AutomationCurve` は `'linear'`・`'exponential'`・`'hold'`・`'s-curve'` を取ります。エンジン／プロジェクト API はこれとは別の型（`EngineAutomationPointCurve`（Node）／`ProjectAutomationCurve`（WASM。序数 `0`〜`3` も受け取る））を使い、s-curve の値はミキシングの `'s-curve'` ではなく `'scurve'`（ハイフンなし）と綴ります。両者で名前も綴りも共通だと考えないでください |
| オートメーション対象の種別 | 上のカーブ形状の軸とは別の軸です。`SonareAutomationTargetKind` / `ProjectAutomationTargetKind`（WASM）は、プロジェクトのオートメーションレーンが何を駆動するかを分類します。種別は、中身をエンジンが解釈しない従来のホスト定義ターゲットか、型付きのトラックフェーダー（`TRACK_FADER_DB`）／パン（`TRACK_PAN`）ターゲットのどちらかです。Node は `targetKind`、Python はキーワード引数 `target_kind`（または序数 `0`/`1`/`2`）で公開します。型付きレーンを追加すると、プロジェクト JSON はスキーマバージョン `2` に上がります。従来のレーンだけのプロジェクトはスキーマバージョン `1` のまま、既存のバイト列を保ちます。[プロジェクト編集](./project-editing.md#オートメーションレーン)を参照 |
| Scene JSON | 永続ミキサーの交換形式。実行時に編集した状態を保存する場合は、手書き JSON より WASM/Node の `Mixer.toSceneJson()`、Python の `Mixer.to_scene_json()` を優先する |
| クリップループのクロスフェード | `setClipLoop` / `set_clip_loop` は全バインディングで `loopCrossfadePpq` / `loop_crossfade_ppq` を受け取る（ppq は 4 分音符あたりのパルス数）。ループ継ぎ目の equal-power クロスフェードで、プリロールとループ長の半分を上限にクランプされ、ワープ時は無視され、0 でないときだけシリアライズされる |
| プロジェクトバウンスの種類 | ヘッドレス DAW の `Project` は各バインディングで音声へバウンスできる。楽器バインド付きバウンス（`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`）と、テイク／コンプのアレンジモデルは共通です。[プロジェクトバウンス](./project-bounce.md)と[録音とテイク](./recording-and-takes.md)を参照してください。`ExternalInstrument` バウンスプロトコルは Node・WASM・Python で共通 |
| マスタリングチェーン JSON | チェーン JSON と名前付きプロセッサのパラメータマップは同じフィールド集合を持ち、相互に変換しても欠落しない。対象は `repair.declip` の `lpcBlend`、multiband のバンド別パラメータ、コンプレッサーの detector / sidechain HPF / PDR 設定、リアルタイムボイスチェンジャーのサンプル間ピーク（ISP）リミッター設定。このドキュメント自体も独自のスキーマバージョンを持つ。バージョン `1` はフラットな固定 3 バンド（low/mid/high）のマルチバンドコンプレッサー形式。バージョン `2` は、マルチバンドコンプレッサーがクロスオーバーの本数やスロープ／モード、バンド数を変える必要が生じたときに自動選択され、`dynamics.multibandComp` を厳密なフィールド検証を伴う構造化オブジェクトとしてシリアライズします。[マスタリングプロセッサ](./mastering-processors.md#チェーン設定-json-スキーマ)を参照 |
| マスタリングリミッター設定 | `releaseMs` / `release_ms` と `applyGainAtInputRate` / `apply_gain_at_input_rate` をマスタリング helper API で使える。単発 helper ではリリースが 0 のときに 50 ms のライブラリ既定値を保ち、プリセット／チェーンの上書き値はそのまま適用される |
| 音響解析 | 測定とブラインド推定の入口は `AcousticResult` を返す。幾何ベースのルーム音響では等価ルーム推定、RIR 合成、ルームモーフィングも使える（ブラインド推定と等価ルーム推定は信頼度と一緒に表示する） |
| エンジンのレーンミキサー / MIDI クリップ | コンパイル済みの形はどのバインディングでも同一（`EngineTrackLane` / `EngineTrackSend` / `EngineBus`。MIDI イベントは絶対サンプルの `renderFrame` と UMP（Universal MIDI Packet）ワードを持つ）。Python は `EngineMidiClipSchedule` / `EngineMidiEvent` の dataclass を使い、JS/Node はプレーンオブジェクトを渡す。素のエンジンの `setSoloMute` は固定のレーンインデックスを取るが、ブラウザの `SonareEngine` Worklet API はトラック id *または名前*を受け取る。ストリップ EQ バンドはどちらの API でも `EqBand` オブジェクトまたはバンド JSON 文字列で渡せる（`setTrackStripEqBand` / `setMasterStripEqBand`、生 JSON 用に `…EqBandJson` 系もある） |
| 自己類似度系の命名 | Python は JavaScript の `segment_` 接頭辞を落とします。`cross_similarity` / `recurrence_matrix` / `recurrence_to_lag` / `lag_to_recurrence` / `path_enhance` / `subsegment` / `agglomerative` が、`segmentCrossSimilarity` などに対応します |
| `Audio` のサンプル取得 | WASM の `audio.data`、Node の `audio.getData()`、Python の `audio.data` はすべてコピーを返す。返り値に書き込んでもインスタンスは変わらず、取得するたびに確保が発生する |
| 配布形態 | 公開されている成果物は WebAssembly の npm パッケージ、Python ホイール、ネイティブ CLI のアーカイブです。Node ネイティブバインディングは private 指定でローカル依存として使う前提のため、常にソースからビルドします |
| ABI バージョンの照合 | どのバインディングも、読み込んだライブラリのインターフェースバージョンを自分で検査します。[ABI バージョン](#abi-バージョン)を参照 |
| 指定しないパラメータ | JavaScript と Python のバインディングでは、指定しないパラメータは不在（`undefined`、`None`、省略したフィールド）として扱われ、`-1` のような代用値は使いません |
| ルームの帯域別配列 | JavaScript は `bandAbsorption` / `bandScattering`、Python は `band_absorption` / `band_scattering`、C ABI と CLI の `--json` 出力は `absorption_bands` / `scattering_bands` |
| 編集位置 | すべての編集リクエストとパンチインの範囲は、サンプル数のほかに秒でも指定できます（`startSec` / `endSec`、`onsetSec` / `offsetSec`、`timeOffsetSec`、`paddingSec`。Python は snake_case）。両方の書き方を同時に渡すと拒否されます |
| エラー | 失敗ごとの数値コードはどのバインディングでも同じです。コードを運ぶクラスと、ライブラリへ届く前にバインディングが引数を拒否するかどうかはランタイムごとに異なります。[エラー契約](#エラー契約)を参照 |
| WASM のオブジェクト戻り値 | 名前一覧ヘルパー（`*Names()`）、プリセット名ヘルパー、`synthPresetPatch`、セクション結果、キー候補ヘルパー、さらにミキサーのメータースナップショット（`meterTap`、`stripMeter`、`busMeter`）とゴニオメーターのサンプル（`readGoniometerLatest`）が返す WASM の配列／オブジェクトは、呼び出し側の JavaScript realm へ再ルートされるため、通常のオブジェクトと同様に `structuredClone()` / `postMessage()` へそのまま渡せる。`Mixer` や `StreamAnalyzer` のようにネイティブメソッドを持つハンドル自体は clone できないため、プレーンな戻り値のデータを渡す |
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

## ABI バージョン

どのバインディングも、読み込んだライブラリのインターフェースバージョンを読めます。そのうち 4 つは 1 つの集約値にパックされます。

| インターフェース | バージョン | 読み取り方 |
|------------------|------------|------------|
| Feature（フラットな解析・特徴量の構造体と、公開する一般 C 関数の契約） | 7 | `abiVersion()` にパックされる |
| Project | 2 | パックされる。`projectAbiVersion()` |
| ボイスチェンジャー | 3 | パックされる。`voiceChangerAbiVersion()` |
| Acoustic | 5 | パックされる |
| 集約値 | `0x05030207` | `abiVersion()`。WASM では `EXPECTED_ABI_VERSION`。C では `sonare_abi_version()` をコンパイル時の `SONARE_ABI_VERSION` と比較する |
| Engine | 3 | `engineAbiVersion()`。パック値には含まれないため、各 `RealtimeEngine` コンストラクターが別に照合する |

Node、WASM、Python はパック値を自分でも比較し、不一致を `AbiMismatch`（10）で拒否します。どこで送出するかは[エラー契約](#エラー契約)にあります。Node と WASM は `EXPECTED_PROJECT_ABI_VERSION` をエクスポートします。WASM は `EXPECTED_ENGINE_ABI_VERSION` もエクスポートし、`engineCapabilities().abiCompatible` がエンジンの照合結果です。Node のアドオンは `RealtimeEngine` を構築するときにエンジン ABI を検査します。不一致のとき Python CLI は 13 で終了します。[ABI バージョン](./native-bindings.md#abi-バージョン)も参照してください。

## エラー契約

どのバインディングも、失敗を同じ数値コード（C ABI の `SonareError` の値）で報告します。そのため、メッセージの文面ではなく原因で分岐できます。ランタイムごとに異なるのは 2 点で、コードを運ぶクラスと、ライブラリへ届く前にバインディングが引数を拒否するかどうかです。下の表は失敗の種類ごとに 1 行ずつ並べています。コード付きの行では、WASM と Node は表の名前を `codeName` に持つ `SonareError` をスローし、Python は表の `ErrorCode` メンバーを `.code` に持つ `SonareError` を送出します。

| 失敗 | コード | WASM と Node | Python | C ABI | CLI の終了コード |
|------|--------|--------------|--------|-------|------------------|
| 型の違う引数、または欠けた引数 | — | `TypeError` | `SonareValueError`、コード 4 | — | 2 |
| バインディングが拒否する引数（空または非有限のオーディオ、整数を読む箇所の小数（サンプルレートを含む）、バインディング自身が解決する名前（`keyRoot: 'H'`）、揃うべき長さの不一致、NUL を含む文字列） | — | `RangeError` | `SonareValueError`、コード 4 | `SONARE_ERROR_INVALID_PARAMETER` | 2 または 3 |
| 8000〜384000 Hz の外にあるサンプルレート | 4 | `RangeError` | `INVALID_PARAMETER` | `SONARE_ERROR_INVALID_PARAMETER` | 3 |
| ライブラリが拒否する値（`nFft` が 0、未知のプリセット名、未知の insert を指すシーンなど） | 4 | `InvalidParameter` | `INVALID_PARAMETER` | `SONARE_ERROR_INVALID_PARAMETER` | 3 |
| 存在しないファイル | 1 | `FileNotFound`（Node。WASM はファイルパスを扱わない） | `FILE_NOT_FOUND` | `SONARE_ERROR_FILE_NOT_FOUND` | 4 |
| 壊れたプロジェクト・シーン・プリセットの文書 | 2 | `InvalidFormat` | `INVALID_FORMAT`。プロジェクト文書では `SonareValueError` として送出 | `SONARE_ERROR_INVALID_FORMAT` | 5 |
| デコードできないオーディオ | 3 | `DecodeFailed` | `DECODE_FAILED` | `SONARE_ERROR_DECODE_FAILED` | 6。FFmpeg なしのビルドでは 5 |
| メモリ確保の失敗 | 5 | `OutOfMemory` | `OUT_OF_MEMORY` | `SONARE_ERROR_OUT_OF_MEMORY` | 7 |
| このビルドに含まれない機能 | 6 | `NotSupported` | `NOT_SUPPORTED` | `SONARE_ERROR_NOT_SUPPORTED` | 8 |
| 解放済み・クローズ済み・未初期化のオブジェクト、`init()` 前の WASM 呼び出し | 7 | `InvalidState` | `INVALID_STATE` | `SONARE_ERROR_INVALID_STATE` | 9 |
| 進捗コールバックからキャンセルした処理 | 8 | `Cancelled` | `CANCELLED` | `SONARE_ERROR_CANCELLED` | 11 |
| 書き出せない出力ファイル | 9 | `EncodeFailed` | `ENCODE_FAILED` | `SONARE_ERROR_ENCODE_FAILED` | 12 |
| バインディングと別のビルドのネイティブコード | 10 | `AbiMismatch`。Node はアドオン読み込み時、WASM は `init()` | 最初のライブラリ使用時に `ABI_MISMATCH` | 返さない | 13（Python CLI のみ） |
| その他 | 99 | `Unknown` | `UNKNOWN` | `SONARE_ERROR_UNKNOWN` | 10 |

各列の読み方は次のとおりです。

- **WASM と Node**: `TypeError` と `RangeError` はバインディング自身の拒否でコードを持たないため、`isSonareError` は一致しません。ユーザー入力を検証するハンドラーでは両方の形を捕捉してください。`ErrorCode` enum と実例は[エラーハンドリング](./js-api.md#エラーハンドリング)にあります。
- **Python**: `SonareValueError` は `SonareError` と `ValueError` の両方を継承するので、どちらの `except` でも捕捉できます。`.code` を持つため、コードで分岐するコードからは、代わりに立っているライブラリ側の拒否と同じに見えます。Python は範囲外のサンプルレートをそのままライブラリへ渡すので、その行は JavaScript では `RangeError`、Python ではコード付きの `SonareError` です。[Python の例外](./python-api-types.md#例外)を参照してください。
- **C ABI**: `SonareError` を返す関数は戻り値で報告します。検証による早期リターンはメッセージを記録しないため、読める文面は `sonare_error_message(code)` で得ます。ハンドルを返す関数は `NULL` を返し、コードを `sonare_last_error_code()`、詳細を `sonare_last_error_message()` に残します。[C++ のエラーハンドリング](./cpp-api.md#エラーハンドリング)を参照してください。
- **CLI**: 両 CLI がこの対応を使います。終了コード 2 は引数パーサーのもので、パーサーが拒否した引数は 2、コマンドの処理側が拒否した引数は 3 で終了します。13 は Python CLI にしかありません。ネイティブ CLI はライブラリを静的リンクするためです。`SONARE_LEGACY_EXIT=1` を設定すると、すべての失敗が `1` にまとまります。[終了コード](./cli.md#終了コード)を参照してください。

コードが同じでも詳細メッセージはランタイムごとに異なります。壊れたシーンは、WASM と Node では `failed to build mixer from scene JSON: …`、Python ではコードを接頭辞に付けた `[2] failed to build mixer from scene JSON: …` になります。

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
