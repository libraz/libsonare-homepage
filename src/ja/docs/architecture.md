# アーキテクチャ

libsonare の内部アーキテクチャについて説明します。

## モジュール概要

```mermaid
graph TB
    subgraph "API レイヤー"
        WASM["WASM バインディング<br/>(Embind)"]
        CAPI["C API<br/>(sonare_c.h)"]
        QUICK["Quick API<br/>(quick.h)"]
        UNIFIED["統合ヘッダー<br/>(sonare.h)"]
    end

    subgraph "ストリーミングレイヤー"
        STREAM["StreamAnalyzer"]
        FRAME["StreamFrame"]
        BUFFER["FrameBuffer<br/>(SOA/量子化)"]
    end

    subgraph "解析レイヤー"
        MUSIC["MusicAnalyzer"]
        BPM["BpmAnalyzer"]
        KEY["KeyAnalyzer"]
        BEAT["BeatAnalyzer"]
        CHORD["ChordAnalyzer"]
        SECTION["SectionAnalyzer"]
        BOUNDARY["BoundaryDetector"]
        TIMBRE["TimbreAnalyzer"]
        DYNAMICS["DynamicsAnalyzer"]
        RHYTHM["RhythmAnalyzer"]
        MELODY["MelodyAnalyzer"]
    end

    subgraph "エフェクトレイヤー"
        HPSS["HPSS"]
        TIMESTRETCH["タイムストレッチ"]
        PITCHSHIFT["ピッチシフト"]
        NORMALIZE["ノーマライズ"]
        TTS["TTS ユーティリティ"]
    end

    subgraph "特徴レイヤー"
        MEL["MelSpectrogram"]
        CHROMA["Chroma"]
        CQT["CQT"]
        VQT["VQT"]
        SPECTRAL["スペクトル特徴"]
        ONSET["オンセット検出"]
        PITCH["ピッチ追跡"]
    end

    subgraph "コアレイヤー"
        AUDIO["Audio"]
        SPECTRUM["Spectrogram<br/>(STFT/iSTFT)"]
        FFT["FFT<br/>(KissFFT)"]
        WINDOW["窓関数"]
        CONVERT["単位変換"]
        RESAMPLE["リサンプリング<br/>(r8brain)"]
        AUDIO_IO["オーディオ I/O<br/>(dr_libs, minimp3)"]
    end

    WASM --> QUICK
    WASM --> STREAM
    CAPI --> QUICK
    UNIFIED --> MUSIC
    QUICK --> MUSIC

    STREAM --> FRAME
    STREAM --> BUFFER
    STREAM --> FFT
    STREAM --> MEL
    STREAM --> CHROMA

    MUSIC --> BPM
    MUSIC --> KEY
    MUSIC --> BEAT
    MUSIC --> CHORD
    MUSIC --> SECTION
    MUSIC --> BOUNDARY
    MUSIC --> TIMBRE
    MUSIC --> DYNAMICS
    MUSIC --> RHYTHM
    MUSIC --> MELODY

    BPM --> ONSET
    KEY --> CHROMA
    BEAT --> ONSET
    CHORD --> CHROMA
    SECTION --> MEL
    BOUNDARY --> MEL
    MELODY --> PITCH

    HPSS --> SPECTRUM
    TIMESTRETCH --> SPECTRUM
    PITCHSHIFT --> TIMESTRETCH
    PITCHSHIFT --> RESAMPLE

    MEL --> SPECTRUM
    CHROMA --> SPECTRUM
    CQT --> FFT
    VQT --> CQT
    SPECTRAL --> SPECTRUM
    ONSET --> MEL

    SPECTRUM --> FFT
    SPECTRUM --> WINDOW
    AUDIO --> AUDIO_IO
    AUDIO --> RESAMPLE
```

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
│   ├── fft.h           # KissFFT ラッパー
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
│   └── tts.h
│
├── analysis/           # レベル 6: 音楽解析
│   ├── music_analyzer.h
│   ├── bpm_analyzer.h
│   ├── key_analyzer.h
│   ├── beat_analyzer.h
│   ├── chord_analyzer.h
│   ├── section_analyzer.h
│   ├── boundary_detector.h
│   ├── melody_analyzer.h
│   ├── rhythm_analyzer.h
│   ├── timbre_analyzer.h
│   ├── dynamics_analyzer.h
│   └── ...
│
├── streaming/          # レベル 6: リアルタイムストリーミング
│   ├── stream_analyzer.h   # メインストリーミングアナライザー
│   ├── stream_config.h     # 設定オプション
│   └── stream_frame.h      # フレームとバッファ型
│
├── quick.h             # シンプル関数 API
├── sonare.h            # 統合インクルードヘッダー
├── sonare_c.h          # C API ヘッダー
└── wasm/
    └── bindings.cpp    # Embind バインディング
```

## データフロー

### オーディオ解析パイプライン

```mermaid
flowchart LR
    subgraph 入力
        FILE[オーディオファイル<br/>WAV/MP3<br/>+ FFmpeg 有効時の対応形式]
        BUFFER[生バッファ<br/>float*]
    end

    subgraph コア
        AUDIO[Audio]
        STFT[STFT]
        SPEC[Spectrogram]
    end

    subgraph 特徴
        MEL[Mel Spectrogram]
        CHROMA[Chromagram]
        ONSET[オンセット強度]
    end

    subgraph 解析
        BPM[BPM 検出]
        KEY[キー検出]
        BEAT[ビート追跡]
        CHORD[コード認識]
    end

    subgraph 出力
        RESULT[AnalysisResult]
    end

    FILE --> AUDIO
    BUFFER --> AUDIO
    AUDIO --> STFT
    STFT --> SPEC
    SPEC --> MEL
    SPEC --> CHROMA
    MEL --> ONSET
    ONSET --> BPM
    ONSET --> BEAT
    CHROMA --> KEY
    CHROMA --> CHORD
    BPM --> RESULT
    KEY --> RESULT
    BEAT --> RESULT
    CHORD --> RESULT
```

### オーディオエフェクトパイプライン

```mermaid
flowchart TB
    subgraph 入力
        AUDIO[Audio]
    end

    subgraph 共通変換
        STFT[STFT]
        SPEC[Complex<br/>Spectrogram]
        ISTFT[iSTFT]
    end

    subgraph スペクトルエフェクト
        HPSS[HPSS]
        PV[Phase Vocoder]
    end

    subgraph ピッチシフト
        TS[タイムストレッチ]
        RESAMPLE[リサンプル]
    end

    subgraph 出力
        OUT[処理後オーディオ]
    end

    AUDIO --> STFT
    STFT --> SPEC
    SPEC --> HPSS
    SPEC --> PV
    HPSS --> ISTFT
    PV --> ISTFT
    AUDIO --> TS
    TS --> RESAMPLE
    ISTFT --> OUT
    RESAMPLE --> OUT
```

### ストリーミングパイプライン

ストリーミングパイプラインは、チャンク間のオーバーラップ状態を維持しながらリアルタイムで音声を処理します。

```mermaid
flowchart LR
    subgraph 入力
        CHUNK[音声チャンク<br/>128-512 サンプル]
    end

    subgraph バッファリング
        OVERLAP[オーバーラップバッファ<br/>n_fft - hop_length]
        FRAME[完全フレーム<br/>n_fft サンプル]
    end

    subgraph 処理
        FFT[FFT]
        MAG[マグニチュード]
        MEL[Mel フィルターバンク]
        CHROMA[Chroma フィルターバンク]
        SPECTRAL[スペクトル特徴]
    end

    subgraph 出力
        STREAMFRAME[StreamFrame]
        RING[リングバッファ]
        QUANT{量子化?}
        SOA[FrameBuffer<br/>Float32]
        U8[QuantizedU8<br/>Uint8]
        I16[QuantizedI16<br/>Int16]
    end

    CHUNK --> OVERLAP
    OVERLAP --> FRAME
    FRAME --> FFT
    FFT --> MAG
    MAG --> MEL
    MAG --> CHROMA
    MAG --> SPECTRAL
    MEL --> STREAMFRAME
    CHROMA --> STREAMFRAME
    SPECTRAL --> STREAMFRAME
    STREAMFRAME --> RING
    RING --> QUANT
    QUANT -->|なし| SOA
    QUANT -->|8-bit| U8
    QUANT -->|16-bit| I16
```

::: info プログレッシブ推定
ストリーミングパイプラインは、プログレッシブ BPM/キー推定のためにクロマとオンセットデータを蓄積します。推定は定期的に更新され（デフォルト: BPM は 10 秒ごと、キーは 5 秒ごと）、時間とともに信頼度が向上します。
:::

## 主要な設計判断

### 遅延初期化

MusicAnalyzer は個別のアナライザーを遅延初期化します:

```cpp
// BPM のみ計算
float bpm = analyzer.bpm();

// キー検出はクロマ計算をトリガー
Key key = analyzer.key();

// 完全解析はすべてを計算
AnalysisResult result = analyzer.analyze();
```

### ゼロコピースライシング

Audio は `shared_ptr` とオフセット/サイズでゼロコピースライシングを実現:

```cpp
auto full = Audio::from_file("song.mp3");

// 両方とも同じバッファを共有
auto intro = full.slice(0, 30);     // 0-30 秒
auto chorus = full.slice(60, 90);   // 60-90 秒
```

### WASM 互換性

npm / WebAssembly パッケージはサンプルベースの API を公開しています。デコード済みのモノラル `Float32Array` サンプルを受け取り、ファイルデコード機能は同梱しません。ブラウザアプリでは、通常 Web Audio API や別の JavaScript デコーダでファイルをデコードしてから libsonare に渡します。

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
出力: 現在のサイト同梱版では ~457KB WASM + ~50KB JS
ビルド: Emscripten + Embind
フラグ: -sWASM=1 -sMODULARIZE=1 -sEXPORT_ES6=1
```
