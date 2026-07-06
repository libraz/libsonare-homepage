# アーキテクチャ

libsonare の内部アーキテクチャについて説明します。

このページは、[はじめに](./getting-started.md)と各言語の実行環境ページに慣れてから開く内部地図です。libsonare を拡張したり、より大きなシステムに組み込んだりする人向けで、チュートリアルではありません。API を呼びたいだけなら、まず[はじめに](./getting-started.md)から始めてください。ここでは、公開 API が C++ コアのどこにつながるかを示します。

::: info レイヤー図の読み方
外側の API レイヤーはアプリが呼ぶ入口です。コアレイヤーと特徴レイヤーは、再利用される信号処理の実体です。バインディングはできるだけ薄く保ち、各言語の形を同じ C++ の挙動へ橋渡しする役割に留めます。
:::

## このページで身につくこと

このページを読むと、次のことを判断・追跡できるようになります。

- WASM、C、quick API、`sonare.h` からの公開呼び出しが、解析、ストリーミング、エフェクト、マスタリング、ミキシング、エンジンの各モジュールへどう流れるかを追える。
- 各サブシステムを所有するソースディレクトリを特定できる。
- 共有 DSP、特徴抽出、リアルタイム処理、言語バインディングがどこで接続するかを理解できる。
- 変更をコアモジュール、言語バインディング、デモコンポーネント、ドキュメントのどこに入れるべきか判断できる。

## モジュール概要

以下のレイヤーは上から下へ流れます。API レイヤーはアプリが呼び出す入り口で、あらゆる呼び出しは最終的に共有の `Spectrogram`／`FFT` コアへ集約されるため、どのアナライザーもエフェクトもマスタリングプロセッサも同じ変換を二重に計算しません。各グループは後述の「ディレクトリ構造」セクションの `src/` サブディレクトリに対応しており、グループ内のノードは代表的なメンバーであって網羅的なクラス一覧ではありません — 各サブシステムの完全な API がどこに書かれているかは「ページ対応表」を参照してください。

<FlowDiagram
  title="モジュール概要"
  direction="TB"
  :nodes="[
    { id: 'wasm', label: 'WASM バインディング (Embind)', col: 0, row: 0, group: 'api', variant: 'accent' },
    { id: 'capi', label: 'C API (sonare_c*.h)', col: 1, row: 0, group: 'api' },
    { id: 'quick', label: 'Quick API (quick.h)', col: 2, row: 0, group: 'api' },
    { id: 'unified', label: 'sonare.h（統合ヘッダー）', col: 3, row: 0, group: 'api' },
    { id: 'stream', label: 'StreamAnalyzer', col: 0, row: 1, group: 'streaming', variant: 'accent' },
    { id: 'frameBuf', label: 'StreamFrame / FrameBuffer', col: 1, row: 1, group: 'streaming' },
    { id: 'music', label: 'MusicAnalyzer', col: 0, row: 2, group: 'analysis', variant: 'accent' },
    { id: 'coreAnalyzers', label: 'BPM・キー・ビート・コード・セクション・境界', col: 1, row: 2, group: 'analysis' },
    { id: 'moreAnalyzers', label: '音色・ダイナミクス・リズム・メロディ', col: 2, row: 2, group: 'analysis' },
    { id: 'acousticAnalysis', label: 'AcousticAnalyzer / RoomEstimator', col: 3, row: 2, group: 'analysis' },
    { id: 'spectralFx', label: 'HPSS・タイムストレッチ・ピッチシフト', col: 0, row: 3, group: 'effects', variant: 'accent' },
    { id: 'editFx', label: 'ノーマライズ・無音トリム・プリ／ディエンファシス', col: 1, row: 3, group: 'effects' },
    { id: 'creativeFx', label: '分解・リバーブ・クリエイティブ FX', col: 2, row: 3, group: 'effects' },
    { id: 'roomFx', label: 'Room Morph・ボイス変換', col: 3, row: 3, group: 'effects' },
    { id: 'nativeSynth', label: 'NativeSynth（15 エンジン）', col: 0, row: 4, group: 'instruments', variant: 'accent' },
    { id: 'soundfont', label: 'SoundFont プレーヤー（SF2）', col: 1, row: 4, group: 'instruments' },
    { id: 'midiSeq', label: 'MIDI・シーケンサー・SMF/UMP', col: 2, row: 4, group: 'instruments' },
    { id: 'instrumentRack', label: 'インストゥルメントラック', col: 3, row: 4, group: 'instruments' },
    { id: 'masterChain', label: 'MasteringChain', col: 0, row: 5, group: 'mastering', variant: 'accent' },
    { id: 'streamMaster', label: 'StreamingMasteringChain / EQ', col: 1, row: 5, group: 'mastering' },
    { id: 'mixerEngine', label: 'Mixer（ストリップ／バス／センド）', col: 2, row: 5, group: 'mastering' },
    { id: 'rtEngine', label: 'RealtimeEngine', col: 3, row: 5, group: 'mastering' },
    { id: 'metering', label: 'メータリング（LUFS/トゥルーピーク）', col: 4, row: 5, group: 'mastering' },
    { id: 'specFeatures', label: 'Mel・Chroma・CQT/VQT', col: 0, row: 6, group: 'feature', variant: 'accent' },
    { id: 'otherFeatures', label: 'スペクトル・オンセット・ピッチ', col: 1, row: 6, group: 'feature' },
    { id: 'inverseFeatures', label: '逆変換特徴量（再構成）', col: 2, row: 6, group: 'feature' },
    { id: 'audio', label: 'Audio', col: 0, row: 7, group: 'core' },
    { id: 'spectrum', label: 'Spectrogram（STFT/iSTFT）', col: 1, row: 7, group: 'core', variant: 'accent' },
    { id: 'primitives', label: 'FFT・窓関数・リサンプリング・I/O', col: 2, row: 7, group: 'core' },
    { id: 'roomModel', label: 'Room Model', col: 0, row: 8, group: 'acoustic-sim' },
    { id: 'rir', label: 'RIR Synthesizer', col: 1, row: 8, group: 'acoustic-sim' },
    { id: 'materials', label: 'Material Presets', col: 2, row: 8, group: 'acoustic-sim' }
  ]"
  :edges="[
    { from: 'wasm', to: 'stream' },
    { from: 'capi', to: 'stream' },
    { from: 'unified', to: 'music' },
    { from: 'quick', to: 'music' },
    { from: 'quick', to: 'acousticAnalysis' },
    { from: 'stream', to: 'frameBuf' },
    { from: 'stream', to: 'primitives' },
    { from: 'music', to: 'coreAnalyzers' },
    { from: 'music', to: 'moreAnalyzers' },
    { from: 'coreAnalyzers', to: 'specFeatures' },
    { from: 'moreAnalyzers', to: 'otherFeatures' },
    { from: 'acousticAnalysis', to: 'spectrum' },
    { from: 'acousticAnalysis', to: 'rir' },
    { from: 'spectralFx', to: 'spectrum' },
    { from: 'spectralFx', to: 'primitives' },
    { from: 'creativeFx', to: 'rir' },
    { from: 'roomFx', to: 'spectralFx' },
    { from: 'roomFx', to: 'rir' },
    { from: 'midiSeq', to: 'nativeSynth' },
    { from: 'nativeSynth', to: 'instrumentRack' },
    { from: 'soundfont', to: 'instrumentRack' },
    { from: 'instrumentRack', to: 'mixerEngine' },
    { from: 'streamMaster', to: 'masterChain' },
    { from: 'masterChain', to: 'spectrum' },
    { from: 'mixerEngine', to: 'metering' },
    { from: 'rtEngine', to: 'mixerEngine' },
    { from: 'specFeatures', to: 'spectrum' },
    { from: 'specFeatures', to: 'primitives' },
    { from: 'otherFeatures', to: 'spectrum' },
    { from: 'otherFeatures', to: 'specFeatures' },
    { from: 'inverseFeatures', to: 'spectrum' },
    { from: 'spectrum', to: 'primitives' },
    { from: 'audio', to: 'spectrum' },
    { from: 'rir', to: 'roomModel' },
    { from: 'roomModel', to: 'materials' }
  ]"
  :groups="[
    { id: 'api', label: 'API レイヤー' },
    { id: 'streaming', label: 'ストリーミングレイヤー' },
    { id: 'analysis', label: '解析レイヤー' },
    { id: 'effects', label: 'エフェクトレイヤー' },
    { id: 'instruments', label: 'インストゥルメント＆MIDI' },
    { id: 'mastering', label: 'マスタリング＆ミキシング' },
    { id: 'feature', label: '特徴レイヤー' },
    { id: 'core', label: 'コアレイヤー' },
    { id: 'acoustic-sim', label: '音響シミュレーション' }
  ]"
  caption="バインディングは薄く保たれています。WASM／C／Quick／sonare.h はすべて同じ C++ コアに集約され、バインディングごとに DSP を再実装することはありません。"
/>

## ページ対応表

| 見ている領域 | 読むページ |
|--------------|------------|
| `analysis/` と `feature/` | [JavaScript API](./js-api.md)、[Python API](./python-api.md)、[librosa 互換性](./librosa-compatibility.md) |
| `analysis/acoustic_analyzer.*`、`analysis/room_estimator.*`、`src/acoustic/`、`effects/acoustic/` | [ルーム音響解析](./acoustic-analysis.md)、[アルゴリズム根拠](./algorithm-references.md#スコープの境界) |
| `streaming/` | [リアルタイムとストリーミング](./realtime-streaming.md) |
| `mastering/` | [マスタリングプロセッサ](./mastering-processors.md)、[DSP 実装解説](./dsp-implementation.md)、[マスタリングアシスタント](./mastering-assistant.md) |
| `mixing/` | [ミキシングエンジン](./mixing.md)、[ミキシングシーン JSON](./mixing-scene-json.md) |
| `engine/`, `transport/`, `automation/`, `graph/`, `rt/` | [リアルタイムとストリーミング](./realtime-streaming.md)、特に `RealtimeEngine` |
| `midi/` と `midi/synth/` | [ネイティブシンセ](./native-synth.md)、[SoundFont プレーヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md) |
| `arrangement/`（編集モデル） | [プロジェクト編集](./project-editing.md)、[録音とテイク](./recording-and-takes.md)、[プロジェクトバウンス](./project-bounce.md) |
| `mir/`（ワープ・グリッドスナップ・キーコンテキスト） | [ワープとテンポ](./glossary/arrangement/warp-and-tempo.md)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| `editing/` と `effects/` | [編集 DSP](./editing-dsp.md)、[DSP 実装解説](./dsp-implementation.md#エフェクトと編集-dsp) |
| `sonare_c*.h` と binding フォルダ | [バインディング対応表](./binding-parity.md)、[ネイティブバインディング](./native-bindings.md)、[C++ API](./cpp-api.md) |

## ディレクトリ構造

```
src/
├── util/               # レベル 0: 基本ユーティリティ
│   ├── types.h         # MatrixView, ErrorCode, 列挙型
│   ├── exception.h     # SonareException
│   └── math_utils.h    # mean, variance, argmax 等
│
├── core/               # レベル 1-3: コア DSP
│   ├── convert.h       # Hz/Mel/MIDI 変換
│   ├── window.h        # Hann, Hamming, Blackman
│   ├── fft.h           # KissFFT アダプター
│   ├── spectrum.h      # STFT/iSTFT
│   ├── audio.h         # オーディオバッファ
│   ├── audio_io.h      # WAV/MP3 読み込み、任意で FFmpeg 対応形式
│   └── resample.h      # r8brain リサンプリング
│
├── filters/            # レベル 4: フィルターバンク
│   ├── mel.h           # Mel フィルターバンク
│   ├── chroma.h        # Chroma フィルターバンク
│   ├── dct.h           # MFCC 用 DCT
│   └── iir.h           # IIR フィルター
│
├── feature/            # レベル 4: 特徴抽出
│   ├── mel_spectrogram.h
│   ├── chroma.h
│   ├── cqt.h
│   ├── vqt.h
│   ├── inverse.h
│   ├── spectral.h
│   ├── onset.h
│   └── pitch.h
│
├── effects/            # レベル 5: オーディオエフェクト
│   ├── hpss.h
│   ├── phase_vocoder.h
│   ├── time_stretch.h
│   ├── pitch_shift.h
│   ├── normalize.h
│   ├── preemphasis.h
│   ├── silence.h
│   ├── decompose.h
│   ├── remix.h
│   ├── delay/ modulation/ reverb/
│   ├── acoustic/       # room_morph
│   └── common/
│
├── acoustic/           # 幾何ベースのルーム音響
│   ├── room_model.* room_types.* material.*
│   ├── image_source.*  # 初期反射
│   ├── late_reverb.*   # 決定的な後期テール
│   └── rir_synthesizer.*
│
├── analysis/           # レベル 6: 音楽解析
│   ├── music_analyzer.h
│   ├── bpm_analyzer.h
│   ├── key_analyzer.h
│   ├── beat_analyzer.h
│   ├── downbeat_analyzer.h
│   ├── meter_analyzer.h
│   ├── chord_analyzer.h
│   ├── section_analyzer.h
│   ├── boundary_detector.h
│   ├── melody_analyzer.h
│   ├── rhythm_analyzer.h
│   ├── timbre_analyzer.h
│   ├── dynamics_analyzer.h
│   ├── acoustic_analyzer.h
│   ├── room_estimator.h
│   └── ...
│
├── streaming/          # レベル 6: リアルタイムストリーミング
│   ├── stream_analyzer.h   # メインストリーミングアナライザー
│   ├── stream_config.h     # 設定オプション
│   └── stream_frame.h      # フレームとバッファ型
│
├── mastering/          # マスタリングエンジン
│   ├── api/            # チェーン・レジストリ・25 プリセット・76 solo processors ＋ pair/stereo registries
│   ├── eq/ dynamics/ spectral/ stereo/ final/
│   ├── maximizer/ multiband/ saturation/ repair/
│   ├── match/ assistant/                 # リファレンスマッチ＋アシスタント/プロファイル
│   └── common/        # 共有 biquad/ラウドネスヘルパー
│
├── mixing/             # ミキシングエンジン
│   ├── channel_strip.* # ストリップ: トリム/インサート/パン/幅/センド
│   ├── bus.* sends.* vca_group.* panner.*
│   └── api/            # シーン JSON ＋シーンプリセット
│
├── midi/               # MIDI 入出力と内蔵インストゥルメント
│   ├── synth/          # NativeSynth のボイス群＋SoundFont プレーヤー
│   │   ├── native_synth.*      # 12 物理モデル＋サブトラクティブ/FM/アディティブ
│   │   ├── ks_/piano_/pipe_organ_/bowed_string_/reed_/brass_/flute_/... voice.*
│   │   ├── sf2_player.* sf2_file.* sf2_voice.*   # SoundFont（SF2）再生
│   │   └── synth_presets.* gm_fallback_map.* gs_layer.* gs_effects.*
│   ├── sequencer.* smf.* smf2.* ump.*   # シーケンサー・SMF・MIDI 2.0（UMP）
│   └── program_map.* cc_map.* midi_fx.* routing.*
│
├── arrangement/        # 非破壊の編集モデル・編集コンパイラ・編集履歴
├── engine/             # リアルタイムエンジン: トランスポート・クリップ・インストゥルメントラック・トラックミキサー・メトロノーム・テレメトリ
├── automation/         # オートメーションレーン＋カーブ形状
├── metering/           # LUFS・トゥルーピーク・位相スコープ/ゴニオメーター
├── mir/                # ワープ・グリッドスナップ・キーコンテキスト・テンポ推定ブリッジ
├── graph/  rt/  transport/   # DSP グラフ・RT セーフ基盤・トランスポート
├── editing/            # ピッチエディター・ボイスチェンジャー・ノートストレッチ
├── serialize/          # プロジェクトの直列化／復元
├── host/               # オーディオデバイス／MIDI 入出力／プラグインホストのバックエンド（ネイティブのみ）
│
├── quick.h             # シンプル関数 API
├── sonare.h            # 統合インクルードヘッダー
├── c_api/              # C API 実装（公開ヘッダーは include/sonare/sonare_c*.h）
└── wasm/
    └── bindings.cpp    # Embind バインディング
```

## データフロー

### オーディオ解析パイプライン

どのアナライザーも同じ STFT／Spectrogram の出力を再計算せずに分岐して使います。オンセット強度は BPM とビート追跡を駆動し、クロマグラムはキーとコード認識を駆動します。そして `MusicAnalyzer.analyze()` は、実際に計算されたものだけをまとめて 1 つの `AnalysisResult` に収めます。

<FlowDiagram
  title="オーディオ解析パイプライン"
  :nodes="[
    { id: 'file', label: 'オーディオファイル (WAV/MP3)', col: 0, row: 0, group: 'input' },
    { id: 'buffer', label: '生バッファ (float*)', col: 0, row: 1, group: 'input' },
    { id: 'audio', label: 'Audio', col: 1, row: 0, group: 'core' },
    { id: 'stft', label: 'STFT', col: 2, row: 0, group: 'core' },
    { id: 'spec', label: 'Spectrogram', col: 3, row: 0, group: 'core', variant: 'accent' },
    { id: 'mel', label: 'Mel Spectrogram', col: 4, row: 0, group: 'features' },
    { id: 'chroma', label: 'Chromagram', col: 4, row: 1, group: 'features' },
    { id: 'onset', label: 'オンセット強度', col: 4, row: 2, group: 'features' },
    { id: 'bpm', label: 'BPM 検出', col: 5, row: 0, group: 'analysis' },
    { id: 'key', label: 'キー検出', col: 5, row: 1, group: 'analysis' },
    { id: 'beat', label: 'ビート追跡', col: 5, row: 2, group: 'analysis' },
    { id: 'chord', label: 'コード認識', col: 5, row: 3, group: 'analysis' },
    { id: 'result', label: 'AnalysisResult', col: 6, row: 1, group: 'output', variant: 'success' }
  ]"
  :edges="[
    { from: 'file', to: 'audio' },
    { from: 'buffer', to: 'audio' },
    { from: 'audio', to: 'stft' },
    { from: 'stft', to: 'spec' },
    { from: 'spec', to: 'mel' },
    { from: 'spec', to: 'chroma' },
    { from: 'mel', to: 'onset' },
    { from: 'onset', to: 'bpm' },
    { from: 'onset', to: 'beat' },
    { from: 'chroma', to: 'key' },
    { from: 'chroma', to: 'chord' },
    { from: 'bpm', to: 'result' },
    { from: 'key', to: 'result' },
    { from: 'beat', to: 'result' },
    { from: 'chord', to: 'result' }
  ]"
  :groups="[
    { id: 'input', label: '入力' },
    { id: 'core', label: 'コア' },
    { id: 'features', label: '特徴' },
    { id: 'analysis', label: '解析' },
    { id: 'output', label: '出力' }
  ]"
  caption="ファイル経由とメモリ上バッファ経由の両方のパスは Audio に収束し、そこから先はすべての特徴量とアナライザーが同じ Spectrogram を共有します。"
/>

### オーディオエフェクトパイプライン

HPSS とフェーズボコーダーはどちらも同じ複素 STFT 上で動作し、共有の iSTFT を通して再構成するため、変換パラメータが食い違うことはありません。一方タイムストレッチとピッチシフトは `Audio` から直接分岐する別経路をたどります。ピッチシフトは同じタイムストレッチのコアの上にリサンプラーを重ねているためです。

<FlowDiagram
  title="オーディオエフェクトパイプライン"
  direction="TB"
  :nodes="[
    { id: 'audio', label: 'Audio', col: 1, row: 0, group: 'input' },
    { id: 'stft', label: 'STFT', col: 1, row: 1, group: 'shared' },
    { id: 'ts', label: 'タイムストレッチ', col: 2, row: 1, group: 'pitch' },
    { id: 'spec', label: '複素 Spectrogram', col: 1, row: 2, group: 'shared' },
    { id: 'resample', label: 'リサンプル', col: 2, row: 2, group: 'pitch' },
    { id: 'hpss', label: 'HPSS', col: 0, row: 3, group: 'spectral' },
    { id: 'pv', label: 'Phase Vocoder', col: 1, row: 3, group: 'spectral' },
    { id: 'istft', label: 'iSTFT', col: 1, row: 4 },
    { id: 'out', label: '処理後オーディオ', col: 1, row: 5, group: 'output', variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'stft' },
    { from: 'audio', to: 'ts' },
    { from: 'stft', to: 'spec' },
    { from: 'spec', to: 'hpss' },
    { from: 'spec', to: 'pv' },
    { from: 'ts', to: 'resample' },
    { from: 'hpss', to: 'istft' },
    { from: 'pv', to: 'istft' },
    { from: 'istft', to: 'out' },
    { from: 'resample', to: 'out' }
  ]"
  :groups="[
    { id: 'input', label: '入力' },
    { id: 'shared', label: '共通変換' },
    { id: 'pitch', label: 'ピッチシフト' },
    { id: 'spectral', label: 'スペクトルエフェクト' },
    { id: 'output', label: '出力' }
  ]"
/>

::: details フェーズボコーダーとは？
フェーズボコーダーは、目立ったアーティファクトを抑えながら音声をタイムストレッチする標準的な手法です。リサンプリングと組み合わせれば、ピッチシフトにも使えます。

まず STFT を取り、再構成の前に各周波数ビンの*位相を新しい時間軸に合わせて進めます*。これにより、ピッチやスペクトルの質感を保ったまま音を長く・短くできます。

libsonare は `timeStretch` / `pitchShift` や、編集 DSP のボイス系ツールでこの方法を使っています。
:::

<SonareDemo id="time-stretch" />

### ストリーミングパイプライン

ストリーミングパイプラインは、チャンク間のオーバーラップ状態を維持しながらリアルタイムで音声を処理します。1 フレーム分の特徴量がリングバッファに到達すると、量子化はオプトインのトレードオフになります — デフォルトでは `Float32` のフル精度を保ちますが、8-bit／16-bit へのパッキングを選ぶと、精度と引き換えにバッファを転送用に縮小できます。

<FlowDiagram
  title="ストリーミングパイプライン"
  :nodes="[
    { id: 'chunk', label: '音声チャンク (128–512 サンプル)', col: 0, row: 1, group: 'input' },
    { id: 'overlap', label: 'オーバーラップバッファ', col: 1, row: 1, group: 'buffering' },
    { id: 'frame', label: '完全フレーム (n_fft)', col: 2, row: 1, group: 'buffering' },
    { id: 'fft', label: 'FFT', col: 3, row: 1, group: 'processing' },
    { id: 'mag', label: 'マグニチュード', col: 4, row: 1, group: 'processing' },
    { id: 'mel', label: 'Mel フィルターバンク', col: 5, row: 0, group: 'processing' },
    { id: 'chroma', label: 'Chroma フィルターバンク', col: 5, row: 1, group: 'processing' },
    { id: 'spectral', label: 'スペクトル特徴', col: 5, row: 2, group: 'processing' },
    { id: 'streamframe', label: 'StreamFrame', col: 6, row: 1, group: 'output' },
    { id: 'ring', label: 'リングバッファ', col: 7, row: 1, group: 'output' },
    { id: 'quant', label: '量子化?', col: 8, row: 1, group: 'output', variant: 'decision' },
    { id: 'soa', label: 'FrameBuffer (Float32)', col: 9, row: 0, group: 'output' },
    { id: 'u8', label: 'QuantizedU8', col: 9, row: 1, group: 'output' },
    { id: 'i16', label: 'QuantizedI16', col: 9, row: 2, group: 'output' }
  ]"
  :edges="[
    { from: 'chunk', to: 'overlap' },
    { from: 'overlap', to: 'frame' },
    { from: 'frame', to: 'fft' },
    { from: 'fft', to: 'mag' },
    { from: 'mag', to: 'mel' },
    { from: 'mag', to: 'chroma' },
    { from: 'mag', to: 'spectral' },
    { from: 'mel', to: 'streamframe' },
    { from: 'chroma', to: 'streamframe' },
    { from: 'spectral', to: 'streamframe' },
    { from: 'streamframe', to: 'ring' },
    { from: 'ring', to: 'quant' },
    { from: 'quant', to: 'soa', label: 'なし' },
    { from: 'quant', to: 'u8', label: '8-bit', style: 'dashed' },
    { from: 'quant', to: 'i16', label: '16-bit', style: 'dashed' }
  ]"
  :groups="[
    { id: 'input', label: '入力' },
    { id: 'buffering', label: 'バッファリング' },
    { id: 'processing', label: '処理' },
    { id: 'output', label: '出力' }
  ]"
/>

::: info 更新される推定
音声がストリーミングされるほど、パイプラインはクロマとオンセットのデータを蓄積していき、BPM/キー推定が根拠にできる材料が増えます。推定は定期的に更新され（デフォルト: BPM は 10 秒ごと、キーは 5 秒ごと）、ストリームが長く続くほど信頼度が高まります。
:::

## 主要な設計判断

### 遅延初期化

MusicAnalyzer は個別のアナライザーを遅延初期化します。必要になったタイミングで初めて中間特徴量（STFT、クロマ、オンセットなど）を計算し、その後の問い合わせでは結果を再利用します。

```cpp
// BPM のみ計算（オンセット包絡線まで）
float bpm = analyzer.bpm();

// キー検出はクロマ計算をトリガー
Key key = analyzer.key();

// 総合解析は残りの項目をまとめて計算
AnalysisResult result = analyzer.analyze();
```

::: tip 何が嬉しいか
キーだけ欲しい呼び出しでコード認識やセクション検出まで計算しないので、無駄な処理が発生しません。逆に `analyze()` を 1 回呼ぶと、すでに計算済みの中間結果がそのまま使われます。
:::

### ゼロコピースライシング

Audio は `shared_ptr` とオフセット/サイズでゼロコピースライシングを実現:

```cpp
auto full = Audio::from_file("song.mp3");

// 両方とも同じバッファを共有
auto intro = full.slice(0, 30);     // 0-30 秒
auto chorus = full.slice(60, 90);   // 60-90 秒
```

### WASM 互換性

「デコード済みサンプル」とは、`.mp3` や `.wav` ファイルのバイト列ではなく、生のオーディオ振幅値（`Float32Array`）を指します。デコードとは、圧縮されたファイルをその値へ変換する工程のことです。ほとんどの WASM 呼び出しは、すでにデコードされたサンプルを受け取ります。

npm / WebAssembly パッケージは主にサンプルベースの API を公開しています。多くの呼び出しはデコード済みのモノラル `Float32Array` サンプルを受け取ります。エンコード済みバイト列については、`Audio.fromMemory(...)` が WAV/MP3 をメモリ内でデコードし、`Audio.fromMemoryWithBrowserFallback(...)` は同じサンプルベース API に渡す前に Web Audio API などのブラウザコーデックへ切り替えられます。

WASM ビルドでは、ネイティブのファイル I/O や FFmpeg ベースのデコードは使いません。将来ブラウザスレッドを明示的に有効化したビルドを用意しない限り、実行はシングルスレッドです。

### librosa 互換性

多くの DSP パラメータは librosa で一般的な値に寄せていますが、libsonare は librosa の完全なドロップイン置き換えではありません。特に libsonare は通常、呼び出し側がサンプルレートを渡します。`librosa.load()` のように標準で 22050 Hz へ暗黙にリサンプルするわけではありません。

| パラメータ | デフォルト |
|-----------|---------|
| sample_rate | ユーザー指定 |
| n_fft | 2048 |
| hop_length | 512 |
| n_mels | 128 |
| fmin | 0 |
| fmax | sr/2 |

## サードパーティライブラリ

| ライブラリ | 用途 | ライセンス |
|---------|---------|---------|
| KissFFT | FFT | BSD-3-Clause |
| Eigen3 | 行列演算 | MPL-2.0 |
| dr_libs | WAV デコード | Public Domain |
| minimp3 | MP3 デコード | CC0-1.0 |
| FFmpeg | 任意の拡張ファイルデコード | リンクするビルドにより LGPL/GPL |
| r8brain | リサンプリング | MIT |

## WASM コンパイル

```
出力: WASM 単体 ~{{ wasmMeta.wasm.sizeKB }} KB（gzip ~{{ wasmMeta.wasm.gzipKB }} KB）＋ JS バインディングコード。
      合計 ~{{ wasmMeta.total.sizeKB }} KB（gzip ~{{ wasmMeta.total.gzipKB }} KB）— src/wasm/meta.json を参照
ビルド: Emscripten + Embind
フラグ: -sWASM=1 -sMODULARIZE=1 -sEXPORT_ES6=1
```

バンドルサイズはマスタリング＋ミキシング＋解析の全機能を含むためで、解析のみのビルドはより小さくなります。
