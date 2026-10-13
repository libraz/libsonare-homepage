# 機能マップ

このページは libsonare の最上位マップです。やりたいことは決まっているが、どのランタイム、API ページ、実装解説を読むべきか迷うときの入口として使います。最初のチュートリアルが必要なら [学習順ガイド](./learning-path.md) を先に読んでください。このページは API 全体を扱います。

目的を 1 つ選び、その行からリンク先へ進んでください。

| 知りたいこと | 読むページ |
|--------------|------------|
| 機能が存在するか | [機能ファミリー](#機能ファミリー) |
| 呼び出しの名前をバインディングごとに知りたい | [バインディング別の名前](#バインディング別の名前) |
| ランタイムを選びたい | [ランタイム別の入口](#ランタイム別の入口) と [バインディング対応表](./binding-parity.md) |
| DSP の内部挙動と制約 | [DSP 実装解説](./dsp-implementation.md) |
| アルゴリズムや論文上の根拠 | [アルゴリズム根拠](./algorithm-references.md) |
| テストや検証状況 | [実装検証](./implementation-validation.md) |

::: details このページで使う用語
- **ランタイム**は「どこで動くか」（ブラウザ、Python、CLI、Node、C++）です。**API** は呼び出す関数やクラスの形、**バインディング**は同じ C++ コアを別言語から呼ぶための橋渡しです。先にランタイムを 1 つ選び、そのランタイムの API ページだけを読んでください。
- **特徴量**は、音声そのものではなく、音声から取り出した数値の要約です。**MIR**（Music Information Retrieval）は、BPM、キー、コード、ビートなど、音楽から情報を読み取る処理全般を指します。**DSP**（Digital Signal Processing）は、音声を測ったり変形したりする信号処理です。
:::

## ランタイム別の入口

コアの計算は C++ で実装されています。ブラウザでは WASM、Python では Python パッケージ、コマンドラインでは CLI を通して使います。アプリの実行場所に合うランタイムを選び、まずその API ページだけを読めば十分です。

| ランタイム | パッケージ／ヘッダー | 主な資料 |
|------------|----------------------|-----------|
| ブラウザ / Node WASM | `@libraz/libsonare` と Worklet サブパス | [WASM](./wasm.md)、[JavaScript API](./js-api.md) |
| Python / CLI | `pip install libsonare` | [Python API](./python-api.md)、[CLI](./cli.md) |
| Node ネイティブ | `@libraz/libsonare-native` ソースビルド | [ネイティブバインディング](./native-bindings.md) |
| C++ | `sonare.h` と各モジュールヘッダー | [C++ API](./cpp-api.md) |
| C ABI | `sonare_c.h` と `sonare_c_acoustic.h` などのモジュール別ヘッダー | [C ABI](./cpp-api-c-abi.md)、[バインディング対応表](./binding-parity.md) |

## 機能ファミリー

機能ファミリーは「何をする機能か」で分け、目的の順に並べています。API 名を知らない段階では、ここから探すのが一番早いです。

::: details 表に出る略語
- **STFT**: スペクトログラムの元になる短時間フーリエ変換。詳細は[スペクトログラムと STFT](./glossary/analysis/spectrogram-stft.md)。
- **MFCC**: 音色を小さな特徴量に圧縮したもの。詳細は[メル・MFCC・音色](./glossary/analysis/mel-mfcc-timbre.md)。
- **CQT / VQT**: 音楽のピッチ間隔に合わせた周波数変換。詳細は[クロマ特徴量](./glossary/analysis/chroma-features.md)。
- **NNLS / NMF**: 音の成分を非負の部品へ分解する行列分解系の手法。詳細は[クロマ特徴量](./glossary/analysis/chroma-features.md)。
- **PLP**: リズムの主な脈動を推定する特徴量。
- **LUFS / LRA**: ラウドネスとラウドネスレンジの指標。詳細は[LUFS](./glossary/lufs.md)。
- **VCA**: 複数ストリップの音量をまとめて動かすグループ制御。詳細は[バスとセンド](./glossary/mixing/buses-sends.md)。
- **PFL / AFL**: pre-fader listen（フェーダー前）と after-fader listen（フェーダー後）。本線の出力を変えずに 1 トラックだけを試聴するためのキュータップです。
- **RIR**: room impulse response（部屋のインパルス応答）。詳細は[部屋の形状と容積](./glossary/acoustics/room-geometry.md)。
- **等価ルーム推定**: 音声から実用上の部屋モデルを推定する処理。詳細は[逆問題による部屋推定](./glossary/acoustics/inverse-estimation.md)。
- **ルームモーフィング**: 目標ルームの響きを音作り効果として適用する処理。
:::

### 解析

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| 解析 | BPM、キーとキー候補、ビート、ダウンビート、オンセット、コードとコード機能、セクション、メロディ、音色、ダイナミクス、リズム、測定したチューニング | [JavaScript API](./js-api-analysis.md)、[Python API](./python-api.md)、[C++ API](./cpp-api.md) |
| 拍子推定 | すでに手元にあるビート列に対して、拍子記号、ダウンビート位相、アクセントのグルーピングを採点します。音声は受け取りません | [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) |
| 特徴量 | STFT、メル、MFCC、クロマ、CQT/VQT、テンポグラム、PLP、スペクトル系／ピッチ系の特徴量、NNLS クロマ、NMF 分解、LUFS/LRA | [JavaScript API](./js-api-features.md#特徴抽出)、[librosa 互換性](./librosa-compatibility.md) |
| メータリング | レベル、ラウドネス、クレストファクター、True Peak、DC オフセットの計測。クリッピングとダイナミックレンジのレポート。ステレオ相関と幅。ベクトルスコープ、フェーズスコープ、スペクトルスナップショット | [JavaScript API](./js-api-audio.md#メータリング)、[Python API](./python-api.md)、[ネイティブバインディング](./native-bindings.md) |
| 構造とセグメンテーション | クロス類似度、再帰行列／ラグ行列、パス強調、サブセグメンテーション、凝集型クラスタリング、F0 トラックからのノートセグメンテーション | [JavaScript API](./js-api-helpers.md#librosa-互換ヘルパー)、[Python API](./python-api-analysis.md#特徴抽出) |
| ストリーミング MIR | ライブのメル／クロマ／オンセットフレーム、時間とともに更新される BPM／キー／コード推定、コード進行とパターンスコア | [リアルタイムとストリーミング](./realtime-streaming.md)、[WASM](./wasm-streaming.md#ストリーミング解析) |
| 音声からノートへ | モノフォニックとポリフォニックの採譜による MIDI クリップ化、ポリフォニックトラッカーの上限、最短ノートを音価で指定する方法、測定した基準ピッチ | [音声から MIDI](./audio-to-notes.md) |
| ルーム音響解析 | インパルス応答からの残響時間と明瞭度、ブラインド推定と等価ルーム推定、幾何ベースの RIR 合成、ルームモーフィング（ステレオのモーフを含む） | [ルーム音響解析](./acoustic-analysis.md)、[JavaScript API](./js-api-effects.md#ルーム音響解析)、[Python API](./python-api-effects.md#ルーム音響解析) |

### 編集とリペア

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| エフェクトと編集 | HPSS、正規化、トリム、リミックス、タイムストレッチ、ピッチシフト、ピッチ補正（キーへの自動ピッチ補正を含む）、ノート編集、領域指定スペクトル編集、ボイスのピッチ／フォルマント変更 | [編集 DSP](./editing-dsp.md)、[音声内のノート編集](./note-editing.md)、[スペクトル編集](./spectral-editing.md)、[JavaScript API](./js-api-effects.md#オーディオエフェクト) |
| ステム分解 | ソフトマスクによる分離。各成分がソース自身の位相を保ち、足し合わせると入力に戻ります。マルチチャンネル用の連動版もあります | [音源分離](./source-separation.md)、[逆変換特徴量](./inverse-features.md)、[連動ステム](./js-api-features.md#decomposestemslinked-request) |
| リペア | 広帯域ノイズ、ハム、クリッピング、クリック、クラックル、拡散残響の検出器とリペア段。任意のチャンネル数に対して 1 回の呼び出しで実行できます。デクラックル、デハム、クラシック方式のデノイズとデリバーブの各段はリアルタイムインサートにもなります | [オーディオリペアの流れ](./audio-repair.md)、[広帯域ノイズとハムのリペア](./repair-noise.md)、[クリップ、クリック、クラックルのリペア](./repair-transients.md)、[拡散残響のリペア](./repair-reverb.md) |
| ゼロ交差に揃えたリミックス区間 | カット位置をゼロ交差に一度だけスナップして解決し、テイクの全チャンネルを同じフレームで切り出せるようにします。API のみで、CLI にはありません | [JavaScript API](./js-api-analysis.md)、[Python API](./python-api.md) |
| ステレオ正規化 | 左右ペアのピークまたは RMS 正規化 | [JavaScript API](./js-api-effects.md)、[Python API](./python-api.md) |
| スケール量子化 | MIDI ノートをスケールに丸め、補正量をセミトーンで測定し、ピッチクラスの所属を判定します | [JavaScript API](./js-api-helpers.md#スケール量子化)、[Python API](./python-api.md) |
| 逆変換特徴量 | メルから STFT／音声、MFCC からメル／音声、CQT/VQT 振幅から音声 | [逆変換特徴量](./inverse-features.md) |

### マスタリングとミキシング

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| マスタリング | プリセット、フルチェーン、名前付きプロセッサとそのメタデータ、ペアプロセッサとペア解析、A/B ラウドネスマッチと EQ マッチ、ステレオ解析、ストリーミングチェーン、構造化マルチバンドコンプレッサー | [マスタリングプロセッサ](./mastering-processors.md)、[DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[マスタリング実装](./mastering-implementation.md) |
| マスタリングアシスタント | 音源プロファイル、チェーン提案 JSON、配信プラットフォーム別プレビュー JSON。左右のペアを測定するステレオ版もあります | [マスタリングアシスタント](./mastering-assistant.md) |
| ミキシング | チャンネルストリップ、バス、センド、VCA グループ、シーンプリセット、オートメーション、ステレオ／サラウンドパン、メーター、ゴニオメーター、オフラインレンダリング | [ミキシングエンジン](./mixing.md)、[ミキシングシーン JSON](./mixing-scene-json.md) |
| ミキシングアシスタント | 複数トラックを計測し、判断ごとの理由を添えたミキサーシーンを返します。シーンの適用は行いません | [ミキシングアシスタント](./mixing-assistant.md) |

### プロジェクトとインストゥルメント

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| プロジェクトとアレンジ | オーディオ／MIDI トラックとクリップ、アンドゥ/リドゥ、テイク／コンピング、ワープ、MIDI シーケンス、SMF および MIDI 2.0 クリップファイルの入出力、JSON 保存／読込、オフラインバウンス | [プロジェクト編集](./project-editing.md)、[プロジェクトの MIDI](./project-editing-midi.md)、[プロジェクトの保存と読み込み](./project-save-load.md)、[プロジェクトバウンス](./project-bounce.md)、[録音・テイク](./recording-and-takes.md) |
| インストゥルメントと MIDI | GM フォールバックバンクを備えたマルチエンジンシンセ、パラメータ記述子、ライブプログラムチェンジ、GS 互換 SoundFont 2 プレイヤー、ライブ MIDI 再生、GS インサーションエフェクト（EFX） | [内蔵シンセサイザー](./native-synth.md)、[SoundFont 2 プレイヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md#ライブイベントのキューイング)、[MIDI クリップ編集](./midi-editing.md)、[MIDI 2.0 と UMP](./midi2.md) |

### 再生とレンダリング

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| リアルタイムエンジン | トランスポート、テンポ、マーカー、メトロノーム、オートメーションレーン、クリップと MIDI クリップスケジュール、トラックごとのレーンミキサー、外部 MIDI 出力とクロック、キャプチャ、PFL/AFL キューモニタリング、メーターとスコープのテレメトリ、オフラインレンダリング、バウンス／フリーズ | [リアルタイムエンジン](./realtime-engine.md)、[パラメータオートメーション](./realtime-engine.md#パラメータオートメーション)、[ボイス予算](./realtime-engine.md#time-stretch-のボイス予算)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| 音声の読み込み | デコード済みサンプルを受け取る入口と `Audio.fromMemory*`。元の全チャンネルを保持し、ITU-R BS.775 の規則で折りたたみます。WASM ではブラウザデコードと Origin Private File System のクリップも扱えます | [JavaScript API](./js-api-audio.md)、[チャンネルフォーマット](./channel-formats.md)、[WASM](./wasm.md#ファイル入力) |

### リファレンスと照会

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| ユーティリティ / librosa 互換 | フレーム／サンプル／時間変換、dB 変換、pre/de-emphasis、無音の trim/split、peak pick、PCEN、tonnetz、テスト信号生成 | [librosa 互換性](./librosa-compatibility.md) |
| ビルド機能の照会 | 機械可読な機能カタログ（プロセッサ、パラメータの範囲と既定値、プリセット一覧）とビルド診断レポート | [JavaScript API](./js-api.md#capabilitycatalog)、[Python API](./python-api.md#このビルドで何ができるか)、[CLI](./cli.md#doctor) |

この表が示すのは「何があるか」であり、「どのランタイムがどれだけ公開しているか」ではありません。ドメインごとの内訳は[バインディング対応表](./binding-parity.md)を参照してください。

## バインディング別の名前

同じ呼び出しでも、綴りはランタイムごとに違います。次の表には、単純な camelCase と snake_case の置き換えでは済まない呼び出しと、知っておく価値のある C の名前を並べています。CLI 列の `なし` は、その呼び出しを持つコマンドがないことを表します。

### 解析と編集

| 分野 | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| 手元のコードにコード機能を付ける | `chordFunctions`（`roman` と `function` を追加） | `chord_functions` | `sonare_chord_functions` | なし |
| コードやキーをアレンジ注釈へ変換 | `chordSymbolFromAnalysis`、`keyModeFromAnalysis` | `chord_symbol_from_analysis`、`key_mode_from_analysis` | `sonare_chord_symbol_from_analysis`、`sonare_key_mode_from_analysis` | なし |
| ビート列からの拍子推定 | `estimateMeter` | `estimate_meter` | `sonare_estimate_meter_json` | なし |
| 測定したチューニング | `tuning: 'auto'`、`estimateTuning` | `tuning="auto"`、`estimate_tuning` | `sonare_estimate_tuning` | なし |
| ステム分解 | `decomposeStems`、`decomposeStemsLinked` | `decompose_stems`、`decompose_stems_linked` | `sonare_decompose_stems`、`sonare_decompose_stems_linked` | 両 CLI の `decompose-stems` |
| ゼロ交差に揃えたリミックス区間 | `remixAlignedIntervals` | `remix_aligned_intervals` | `sonare_remix_aligned_intervals` | なし |
| ステレオ正規化 | `mode` を持つ `normalizeStereo` | `normalize_stereo`、`normalize_rms_stereo` | `sonare_normalize_stereo`、`sonare_normalize_rms_stereo` | なし |
| キーへの自動ピッチ補正 | `autoTune` | `auto_tune` | `sonare_auto_tune` | なし |

### マスタリング・ミキシング・ルーム

| 分野 | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| 1 回の呼び出しで行うリペア | `masteringRepairAnalyze`、`masteringRepairApply` | `mastering_repair_analyze`、`mastering_repair_apply` | `sonare_mastering_repair_analyze`、`sonare_mastering_repair_apply` | なし |
| ストリーミングチェーンの静的ゲイン | `streamingLoudnessGain` | `streaming_loudness_gain` | `sonare_streaming_loudness_gain` | なし |
| 固有のサンプルレートを持つリファレンス | `referenceSampleRate` | `reference_sample_rate` | `reference_sample_rate` 引数 | `mastering-pair-*` は任意のレートを読む |
| ミキシングアシスタント | `suggestMixScene` | `suggest_mix_scene` | `sonare_mixing_assistant_suggest_scene_json` | `suggest-mix` |
| アシスタントのトラックごとのサンプルレート | `MixAssistantTrack` の `sampleRate` | `MixTrackInput` の `sample_rate` | `track_sample_rates` | なし |
| ストリップやバスをサブミックスへルーティング | `Mixer.setOutputBus` | `set_output_bus` | `sonare_mixer_set_output_bus` | なし |
| 推定結果を合成の入力へ変換 | `roomGeometryFromEstimate` | `room_geometry_from_estimate` | `sonare_room_geometry_from_estimate` | なし |
| ステレオのルームモーフ | `roomMorphStereo` | `room_morph_stereo` | `sonare_room_morph_stereo` | 両 CLI の `room-morph` |

### リアルタイムエンジンとインストゥルメント

| 分野 | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| 1 本のレーンのセンドや出力バスの編集 | `setTrackSends`、`setTrackOutputBus` | `set_track_sends`、`set_track_output_bus` | `sonare_engine_set_track_sends`、`sonare_engine_set_track_output_bus` | なし |
| ホスト側インストゥルメント、レーン、バスのオートメーション id | `resolveInstrumentAutomationId`、`resolveTrackLaneAutomationId`、`resolveBusAutomationId` | `resolve_instrument_automation_id`、`resolve_track_lane_automation_id`、`resolve_bus_automation_id` | `sonare_engine_resolve_instrument_automation_id`、`sonare_engine_resolve_track_lane_automation_id`、`sonare_engine_resolve_bus_automation_id` | なし |
| サイドチェイン接続を適用せずに確認 | `canSetLaneSidechain`、`canSetBusSidechain`、`canSetMasterSidechain` | `can_set_lane_sidechain`、`can_set_bus_sidechain`、`can_set_master_sidechain` | `sonare_engine_can_set_lane_sidechain` ほか | なし |
| オフラインレンダリングとテール | `renderOffline`、`finishOfflineRender`、`bounceOffline`、`freezeOffline`、`tailSamples`、`graphLatencySamplesQ8` | `finish_offline_render`、`tail_samples`、`graph_latency_samples_q8` | `sonare_engine_tail_samples` | なし |
| 動作中のエンジンでのクリップ編集 | `upsertClip`、`removeClip` | `upsert_clip`、`remove_clip` | `sonare_engine_upsert_clip`、`sonare_engine_remove_clip` | なし |
| 予約パラメータのメタデータ | `parameterInfo`、`parameterInfoByIndex` | `parameter_info`、`parameter_info_by_index` | `sonare_engine_parameter_info`、`sonare_engine_parameter_info_by_index` | なし |
| タイムストレッチのボイスプール、クリップページの先読み | `setWarpVoiceCapacity`、`setClipPagePrefetchFrames` | `set_warp_voice_capacity`、`set_clip_page_prefetch_frames` | `sonare_engine_set_warp_voice_capacity`、`sonare_engine_set_clip_page_prefetch_frames` | なし |
| シンセパッチのエンジンモデルフィールド | `engineParams`、`synthEngineParamInfo`、`synthPatchParamInfo` | `engine_params`、`synth_engine_param_info`、`synth_patch_param_info` | `SonareSynthPatch.engine_params`、`sonare_synth_engine_param_info` | なし |
| バンク指定つきのライブプログラムチェンジ | `pushMidiProgram`、`pushMidiInputProgram` | `push_midi_program`、`push_midi_input_program` | `sonare_engine_push_midi_program` | なし |

## 実装と根拠のページ

| ページ | 役割 |
|--------|------|
| [マスタリングプロセッサ](./mastering-processors.md) | プリセット名、プロセッサ ID、ペアプロセッサ、ペア解析、ステレオ解析の公開レジストリ |
| [DSP 実装解説](./dsp-implementation.md) | DSP ファミリーごとの内部挙動、リアルタイム境界、共通構成要素 |
| [アルゴリズム根拠](./algorithm-references.md) | ソース、テスト、README から確認できる標準規格、論文、アルゴリズムファミリー、互換性参照 |
| [実装検証](./implementation-validation.md) | 機能グループごとのテストと検証状況、librosa 参照値、リアルタイム安全性の整理 |

## WASM のエクスポート系統

ここから先は、実装や公開 API を厳密に確認したい人向けです。ブラウザで「まず動かす」だけなら、`init()` して必要な関数を import する、という理解で十分です。

メインの `@libraz/libsonare` TypeScript パッケージのエクスポートは、いくつかの系統に分かれます。初期化と ABI 確認、`engineCapabilities` による互換性確認、音声処理の関数群（高レベル解析、エフェクト／編集、マスタリング、ミキシング、特徴量抽出、逆変換特徴量、変換ヘルパー）、そして状態を持つオブジェクト API（`Audio`、`StreamAnalyzer`、`Mixer`、`RealtimeEngine`、およびストリーミング／ボイスチェンジャー系のクラス）です。最新の完全なエクスポート一覧は [JavaScript API](./js-api.md) に反映されており、その根拠は libsonare リポジトリの `bindings/wasm/src/index.ts` です。エクスポート名を厳密に確認したい場合は、この TypeScript 側の入口を最も具体的な参照として扱ってください。

::: tip ABI バージョン関数の用途
`abiVersion`、`engineAbiVersion`、`projectAbiVersion`、`voiceChangerAbiVersion` は、各サブシステムがビルド時に対象とした ABI（バイナリインターフェース）のバージョンを返します。自分のコードが想定するバージョンと突き合わせることで、オブジェクトを使い始める前に、不一致や古い WASM ビルドを検出できます。各バインディングは、読み込んだネイティブモジュールの集約 ABI バージョン（`0x05030207`、WASM では `EXPECTED_ABI_VERSION` としてエクスポート）も読み込み時に自分で検査し、不一致をエラーコード `AbiMismatch`（10）で拒否します。Node はアドオンの require 時、WASM は `init()`、Python はライブラリの初回使用時です。
:::

同じ npm パッケージは、AudioWorklet ブリッジ用の `@libraz/libsonare/worklet` と、バンドラーや独自ローダー向けの生 WASM アセット用サブパス `@libraz/libsonare/wasm`（解析専用モジュール用の `@libraz/libsonare/wasm/analysis` も）も公開します。全サブパスは[インストール](./installation.md#wasm-パッケージのサブパス)にあります。

## CLI コマンド系統

CLI は、プログラムを書かずにファイルを指定して解析・変換したいときの入口です。自動処理や検証には便利ですが、リアルタイム UI や細かい対話的制御には JavaScript / Python / C++ API の方が向いています。

CLI は 2 種類あります。Python CLI は一般的な利用者向けコマンド（解析、特徴量サマリー、ファイルを書き出す編集、音響／ルーム処理、基本的なマスタリング／ミキシング）を扱います。ソースビルドの C++ CLI は、さらに低レベルなコマンド群（セクション／メロディユーティリティ、追加の特徴量ヘルパー、マスタリングのペア／ステレオ一覧やミキシングシーン書き出し）を加えます。最新の完全なコマンド一覧と例は [CLI](./cli.md) にあります。ランタイム差分は [バインディング対応表](./binding-parity.md) を参照してください。

## 機能カタログが返すもの

各ビルドは、自身が備えるプロセッサとそのパラメータを機械可読な形で報告できます。Node と WASM の `capabilityCatalog()`、Python の `capability_catalog()`、C ABI の `sonare_capability_catalog_json` は同じ JSON 文書を返します。内容は、ビルドのバージョンと ABI 番号、パラメータとスロットメタデータを持つ全プロセッサ、組み込みプリセット名一覧、マスタリングプリセットのメタデータです。どちらの CLI にもこのカタログはなく、`doctor` が出すのは別物のビルド診断レポートです。

現行ビルドは **95 個のプロセッサと 5,579 個のパラメータ記述子** を公開します。うち 84 個のプロセッサはリアルタイムインサート可能で、どのプロセッサも `category` を報告します。これらの数も鵜呑みにせず数え直せます。libsonare リポジトリは生成物を `tools/capability-catalog.json` として追跡しており、共有ライブラリが実際に返す内容とずれると `make capability-catalog-check` が失敗し、`schemas/capability-catalog.schema.json` が形を固定しています。

各パラメータ記述子は同じ 18 個のフィールドを持ちます。

| フィールド | 内容 |
|------------|------|
| `name` | 構築時に読まれるキー。`releaseMs` や `band0.frequencyHz` など |
| `id` | Mixer のインサートオートメーションと MIDI CC 紐付けに使う整数 id。構築時専用キーは `null` です。リアルタイムのインサート設定 API は `name` で対象を解決し、整数の id はオートメーション順に `0..n-1` です |
| `rtSafe` | オーディオスレッドから稼働中に値を変えられるか |
| `type` | 設定ビルダーが読む値の型。`number`、`boolean`、`enum`、`string`、`array` のいずれかです |
| `default` | 設定構造体のフィールドの初期化子。フォールバックがない場合は `null` です |
| `min`、`max` | 探索時に構築が受け入れた区間。その側の制限をカタログが知らなければ `null` |
| `minExclusive`、`maxExclusive` | その境界の値自体が拒否されるか。その側が `null` のときは `false` |
| `maxRelativeTo` | 実効上限が `max` とホストのナイキストの低いほうになるとき `'nyquist'`、それ以外は `null` |
| `unit` | プロセッサがキーに宣言する単位。閉じた集合 `dB`、`dBFS`、`LUFS`、`Hz`、`ms`、`s`、`samples`、`m`、`cm`、`deg`、`percent`、`degC`、`V`、`inPerSec`、`dBPerOct`、`semitones`、`cents`、`ratio`、`bits`、`count`、`none` のいずれか。boolean、enum、string、array のキーには単位がなく `null` です |
| `uiMin`、`uiMax` | コントロールが描画すべき範囲（`min` / `max` の内側）。受け入れ範囲がそのまま表示範囲なら `null` |
| `scale` | コントロールが値を描く軸。`linear` または `log` |
| `choices` | 名前付き数値選択肢の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null` です |
| `slot` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` です |
| `dependsOn` | 自分の値を（ライブの値で）制約する兄弟キー。`{ key, relation, factor }` の配列で、`relation` は `lt`、`le`、`gt`、`ge` のいずれかを `this <relation> factor * sibling` として読みます（単純な大小関係では `factor` は 1）。独立したキーでは空です |
| `coupledWith` | `dependsOn` のほかに、単一の関係では表せない形でこのキーの受け入れ範囲を動かす兄弟キー（`effects.reverb.room` の `receiverSpacingM` なら `lengthM`、`widthM`、`listenerX`、`listenerY`、`sourceX`、`sourceY`）。独立したキーでは空です。`min` / `max` はこれらの兄弟を既定値にして測った値です |

各プロセッサ項目は `causal` も持ちます。`causal` は、リアルタイムインサート可能なプロセッサすべてと、因果的な 4 つのリペア段（`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical`）で `true` です。`repair.declick`、`repair.declip`、`repair.trimSilence` は、あるサンプルの出力がそれ以前の入力だけで決まる構成を持たないため `false` で、インサートではないオフライン専用プロセッサ（`final.*`、`match.*`、`maximizer.loudnessOptimize`）も `false` です。各項目は `category` も持ち、値は `dynamics`、`effects`、`eq`、`final`、`reference`（`match.*` プロセッサ）、`maximizer`、`multiband`、`repair`、`saturation`、`spectral`、`stereo`、`utility`、`voice` のいずれかです。

`id` が整数の項目はオートメーション対象で、構築時専用の項目は `id: null` かつ `rtSafe: false` です。`id` があっても `rtSafe: false` ならライブオートメーションへ渡せません。`choices` は名前付き数値の閉じた集合を示し、間隔のある離散値も含みます。`slot` はキーが属するスロット群を示し、`null` はどのスロットにも属さないことを示します。`slot` が非 null でも必ず条件付きとは限りません。各プロセッサの `slots` 配列にある `activation`（`anyKey` または `always`）、親スロットを示す `parent`、存在条件となる `minCrossoverCutoffs` を組み合わせて、スロットの有無を判断します。

既定値は書き写したものではなくコードから読み取りますが、構築用キーにフォールバックがなければ `null` になります。`uiMin` / `uiMax`、`dependsOn`、`coupledWith` はコントロールの描き方と順序の手がかりで、受け入れ範囲はあくまで `min` / `max` です。範囲は実測です。候補値を呼び出し側と同じ構築経路に通し、そのプロセッサの他のパラメータは既定値のまま、検証が受け入れた区間をカタログが報告します。`null` の境界が意味するのは、その側ではどんな値も通る、または構築がそのキーを検証していない、のどちらかです。制限があるのに測っていない、という意味ではありません。スライダーを直結する前に押さえておきたい性質が 2 つあります。互いに制約し合う制御は相手の既定値を境界として報告すること、そして開区間の境界は除外される値そのものとして報告されることです。具体例は [JavaScript API](./js-api.md#capabilitycatalog) が順に追い、各フィールドは[インサートエフェクト](./effects-inserts.md#パラメータ記述子)にまとまっています。

トップレベルの `chain` セクションは、マスタリングチェーン設定のフラットなキーを記述します。`stages` は各ステージのキー接頭辞、そのキーがパラメータとなるプロセッサ（なければ `null`）、`enabled` キーを列挙し、`lists` はインデックス付きリスト（マルチバンドステージの `cutoffsHz` と `bands`）を項目数つきで挙げ、`params` はどのプロセッサにも属さないキー（`enabled` スイッチ、`loudness.*`、`repair.denoise.gainFloor`、クロスオーバー FIR カーネルサイズとカットオフリスト）の記述子をチェーン自身の検証器で測って収め、`aliases` はキーの別名表記すべてを返します。Node、WASM、Python では `CapabilityCatalogChain` として宣言されています。`presets` には `playbackRoom` も含まれ、常に存在し、再生機能がビルドから除かれている場合は空になります。

`presets.mastering` はマスタリングプリセット名の簡潔な配列です。トップレベルの `masteringPresets` は各名前について `kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を持つオブジェクトを返します。レストレーション用の項目では、後ろ 3 つの数値が `null` です。選択したプリセットを展開した数値／真偽値のパラメータマップが必要なときは、バインディングの `masteringPresetParams` を使います。

この記述子が役に立つ場面は 2 つあります。

- **手書きの表を持たないコントロールサーフェス。** 各パラメータを `type`、`default`、`min`、`max`、`uiMin`、`uiMax`、`scale`、`unit` から組み立てれば、新しいプロセッサや番号の振り直された帯域は、誰かが表を直したときではなくビルドが変わったときに UI へ現れます。
- **境界を越える前の値チェック。** 公開された範囲の外の数値は構築時に拒否されます。先にカタログと突き合わせておけば、その実行時エラーは、ユーザーが値を入力した場所での検証メッセージに変わります。

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max); // max is null: no upper bound is published
}
```

カタログが外側から示すのは、どのプロセッサがあり、それぞれが何を受け付けるか、です。同じ id のプロセッサがどのランタイムにもある理由は、[アーキテクチャ](./architecture.md)の層構成にあります。
