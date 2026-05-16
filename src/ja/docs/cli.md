# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

::: tip pip で簡単インストール
`sonare` CLI は PyPI の Python パッケージに含まれます。

```bash
pip install libsonare
sonare analyze music.mp3
```

npm の WebAssembly パッケージ `@libraz/libsonare` ではインストールされません。

標準の PyPI ホイールは WAV/MP3 をデコードします。M4A/AAC/FLAC/OGG/Opus を直接読むには FFmpeg 有効ビルドが必要です。
:::

::: info C++ CLI
ソースからビルドすると、追加コマンドを含む C++ CLI が利用できます: `chords`, `sections`, `timbre`, `dynamics`, `rhythm`, `melody`, `boundaries`, `pitch-shift`, `time-stretch`, `onset-env`, `cqt`, `system-info`。[ソースからビルド](/ja/docs/installation#ソースからビルド)を参照してください。
:::

## 概要

`sonare` CLI は、ターミナルでの簡易確認、バッチ解析、スクリプト向け JSON サマリー出力のためのツールです。重い解析処理は Python 実装ではなく、Python パッケージからネイティブ C++ パイプラインを呼び出して実行します。

```bash
sonare <command> [options] <audio_file>
```

## グローバルオプション

| オプション | 説明 |
|--------|-------------|
| `--json` | JSON 形式で結果を出力 |
| `--help`, `-h` | コマンドのヘルプを表示 |
| `-o`, `--output` | Python CLI のパーサーでは受け付けますが、解析・特徴抽出コマンドは現在 stdout に出力します |
| `--n-fft <int>` | FFT サイズ（デフォルト: 2048） |
| `--hop-length <int>` | ホップ長（デフォルト: 512） |
| `--n-mels <int>` | Mel バンド数（デフォルト: 128） |

`--json` はスクリプトで扱いやすい要約JSONを出力します。Python CLI の
`mel` や `chroma` は特徴量の全行列をそのまま出力するのではなく、次元や
要約値を出力します。

## 解析コマンド

### analyze

BPM、キー、拍子、ビートを含む音楽解析。

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

**出力:**
```
  > Estimated BPM : 120.50 BPM  (conf 95.0%)
  > Estimated Key : C major  (conf 85.0%)
  > Time Signature: 4/4
  > Beats: 240
```

**JSON 出力:**
```json
{
  "bpm": 120.5,
  "bpm_confidence": 0.95,
  "key": {
    "root": 0,
    "mode": 0,
    "confidence": 0.85,
    "name": "C major"
  },
  "time_signature": {
    "numerator": 4,
    "denominator": 4
  },
  "beats": 240
}
```

### bpm

テンポ（BPM）のみを検出。

```bash
sonare bpm music.mp3
sonare bpm music.wav --json
```

**出力:**
```
  BPM: 128.00
```

### key

音楽キーを検出。

```bash
sonare key music.mp3
sonare key music.mp3 --json
```

**出力:**
```
  Key: A minor (confidence: 82.0%)
```

**JSON 出力:**
```json
{"root": 9, "mode": 1, "confidence": 0.82, "name": "A minor"}
```

### beats

ビート時刻を検出。

```bash
sonare beats music.mp3
sonare beats music.mp3 --json
```

**出力:**
```
  Beat times (240 beats):
    1. 0.520s
    2. 1.020s
    3. 1.520s
    ... (237 more)
```

### onsets

オンセット時刻（音の立ち上がり）を検出。

```bash
sonare onsets music.mp3
sonare onsets music.mp3 --json
```

## 特徴コマンド

### mel

メルスペクトログラムを計算し、その次元を表示。

```bash
sonare mel music.mp3
sonare mel music.mp3 --n-mels 80
```

**出力:**
```
  Mel Spectrogram:
    Shape: 128 mels x 8520 frames
```

### chroma

クロマグラム（ピッチクラス分布）を計算。

```bash
sonare chroma music.mp3
sonare chroma music.mp3 --json
```

**出力:**
```
  Chromagram: 12 bins x 8520 frames
  Mean energy per pitch class:
    C  0.1250 #############
    C# 0.0450 #####
    D  0.0820 ########
    ...
```

### spectral

スペクトル特徴（セントロイド、帯域幅、ロールオフ、フラットネス、ZCR、RMS）を計算。

```bash
sonare spectral music.mp3
sonare spectral music.mp3 --json
```

**出力:**
```
  Spectral Features:
  Feature          Mean       Std        Min        Max
  centroid         2150.5     850.2      120.5      8500.0
  bandwidth        1850.2     520.8       50.2      4200.5
  rolloff          4520.8    1200.5      200.0     10000.0
  flatness         0.0250     0.0180     0.0010     0.1520
  zcr              0.0850     0.0420     0.0020     0.2500
  rms              0.0520     0.0280     0.0001     0.1850
```

### pitch

YIN または pYIN アルゴリズムでピッチを追跡。

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm yin
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--algorithm` | pyin | ピッチアルゴリズム: "yin" または "pyin" |

**出力:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

Harmonic-Percussive Source Separation（調和-打楽器分離）。

```bash
sonare hpss music.mp3
sonare hpss music.mp3 --json
```

**出力:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
```

## ユーティリティコマンド

### info

オーディオファイル情報を表示。

```bash
sonare info music.mp3
sonare info music.wav --json
```

**出力:**
```
  Duration:    3:00 (180.5s)
  Sample Rate: 22050 Hz
  Samples:     3980000
```

### version

バージョン情報を表示。

```bash
sonare version
sonare version --json
```

**出力:**
```
libsonare 1.0.4 (Python CLI)
```

## 使用例

### 基本解析ワークフロー

```bash
# クイック BPM とキーチェック
sonare bpm song.mp3
sonare key song.mp3

# スクリプト用に JSON で完全解析
sonare analyze song.mp3 --json > analysis.json
```

### 特徴量サマリーの書き出し

```bash
# コンパクトな特徴量サマリーを書き出す
sonare mel song.mp3 --json > mel_features.json
sonare spectral song.mp3 --json > spectral_features.json
sonare chroma song.mp3 --json > chroma_features.json
```

### バッチ処理

```bash
# ディレクトリ内のすべての MP3 ファイルを解析
for f in *.mp3; do
  echo "Processing: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done

# すべてのファイルから BPM を抽出
for f in *.wav; do
  bpm=$(sonare bpm "$f" --json | jq -r '.bpm')
  echo "$f: $bpm BPM"
done
```

## 対応オーディオ形式

| 形式 | 拡張子 | 備考 |
|--------|-----------|-------|
| WAV | `.wav` | 非圧縮 PCM |
| MP3 | `.mp3` | minimp3 でデコード |
| M4A / AAC / FLAC / OGG / Opus | 形式により異なる | FFmpeg 有効ビルドのみ対応 |

現在のビルドが FFmpeg デコードに対応しているかは、Python から `libsonare.has_ffmpeg_support()` で確認できます。

## 終了コード

| コード | 説明 |
|------|-------------|
| 0 | 成功 |
| 1 | エラー（無効な引数、ファイル未検出、処理エラー） |

## パフォーマンスのヒント

1. **大きなファイル**: 10分を超えるファイルは、セグメントを解析することを検討:
   ```bash
   # 最初の60秒のみ解析（ffmpeg使用）
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT サイズ**: 小さい FFT サイズ（`--n-fft 1024`）は高速だが周波数解像度が低い。

3. **ホップ長**: 大きいホップ長（`--hop-length 1024`）は高速だが時間解像度が低い。
