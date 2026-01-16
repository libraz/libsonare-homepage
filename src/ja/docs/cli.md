# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

## 概要

sonare CLI は、コマンドラインから包括的な音楽解析、オーディオ処理、特徴抽出機能を提供します。

```bash
sonare <command> [options] <audio_file> [-o output]
```

## グローバルオプション

| オプション | 説明 |
|--------|-------------|
| `--json` | JSON 形式で結果を出力 |
| `--quiet`, `-q` | 進捗出力を抑制 |
| `--help`, `-h` | コマンドのヘルプを表示 |
| `-o`, `--output` | 出力ファイルパス |
| `--n-fft <int>` | FFT サイズ（デフォルト: 2048） |
| `--hop-length <int>` | ホップ長（デフォルト: 512） |
| `--n-mels <int>` | Mel バンド数（デフォルト: 128） |
| `--fmin <float>` | 最小周波数（Hz） |
| `--fmax <float>` | 最大周波数（Hz） |

## 解析コマンド

### analyze

BPM、キー、ビート、コード、セクション、音色、ダイナミクス、リズムを含む完全な音楽解析。

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

**出力:**
```
BPM: 120.5 (confidence: 0.95)
Key: C major (confidence: 0.85)
Time Signature: 4/4
Beats: 240
Sections: Intro (0-8s), Verse (8-32s), Chorus (32-48s)
Form: IABABCO
```

**JSON 出力:**
```json
{
  "bpm": 120.5,
  "bpmConfidence": 0.95,
  "key": {
    "root": 0,
    "mode": 0,
    "confidence": 0.85,
    "name": "C major"
  },
  "timeSignature": {
    "numerator": 4,
    "denominator": 4,
    "confidence": 0.9
  },
  "beats": [...],
  "chords": [...],
  "sections": [...],
  "form": "IABABCO"
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
BPM: 128.0
```

### key

音楽キーを検出。

```bash
sonare key music.mp3
sonare key music.mp3 --json
```

**出力:**
```
Key: A minor (confidence: 0.82)
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
0.52, 1.02, 1.52, 2.02, 2.52, 3.02, 3.52, 4.02, ...
```

### onsets

オンセット時刻（音の立ち上がり）を検出。

```bash
sonare onsets music.mp3
sonare onsets music.mp3 --json
```

### chords

コード進行を検出。

```bash
sonare chords music.mp3
sonare chords music.mp3 --min-duration 0.5 --threshold 0.3
sonare chords music.mp3 --triads-only
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--min-duration` | 0.3 | 最小コード持続時間（秒） |
| `--threshold` | 0.5 | 最小信頼度閾値 |
| `--triads-only` | false | 三和音のみ検出（major/minor/dim/aug） |

**出力:**
```
Chord progression: C - G - Am - F
Duration: 180.5s, 48 chord changes

Time      Chord    Confidence
0.00s     C        0.85
4.02s     G        0.78
8.04s     Am       0.82
12.06s    F        0.80
```

### sections

楽曲構造（イントロ、バース、コーラスなど）を検出。

```bash
sonare sections music.mp3
sonare sections music.mp3 --min-duration 4.0 --threshold 0.3
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--min-duration` | 4.0 | 最小セクション持続時間（秒） |
| `--threshold` | 0.3 | 境界検出閾値 |

**出力:**
```
Form: IABABCO
Duration: 180.5s, 7 sections

Section   Type         Start    End      Energy
1         Intro        0.00s    8.52s    0.45
2         Verse        8.52s    32.10s   0.62
3         Chorus       32.10s   48.20s   0.85
```

### timbre

音色特性を解析。

```bash
sonare timbre music.mp3
sonare timbre music.mp3 --json
```

**出力:**
```
Timbre Analysis:
  Brightness:  0.65 (bright)
  Warmth:      0.42 (neutral)
  Density:     0.78 (rich)
  Roughness:   0.25 (smooth)
  Complexity:  0.55 (moderate)
```

### dynamics

ダイナミクスとラウドネスを解析。

```bash
sonare dynamics music.mp3
sonare dynamics music.mp3 --window-sec 0.4
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--window-sec` | 0.4 | 解析ウィンドウ（秒） |

**出力:**
```
Dynamics Analysis:
  Peak Level:       -0.5 dB
  RMS Level:        -12.3 dB
  Dynamic Range:    15.2 dB
  Crest Factor:     11.8 dB
  Loudness Range:   8.5 LU
  Compression:      No (natural)
```

### rhythm

リズム特徴を解析。

```bash
sonare rhythm music.mp3
sonare rhythm music.mp3 --bpm-min 60 --bpm-max 200
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--start-bpm` | 120.0 | 初期 BPM 推定値 |
| `--bpm-min` | 60.0 | BPM 検索範囲の最小値 |
| `--bpm-max` | 200.0 | BPM 検索範囲の最大値 |

**出力:**
```
Rhythm Analysis:
  Time Signature:    4/4 (confidence: 0.92)
  BPM:               128.0
  Groove Type:       straight
  Syncopation:       0.35 (moderate)
  Pattern Regularity: 0.85 (regular)
  Tempo Stability:   0.92 (stable)
```

### melody

メロディとピッチ輪郭を追跡。

```bash
sonare melody music.mp3
sonare melody music.mp3 --fmin 80 --fmax 1000 --threshold 0.1
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--fmin` | 80.0 | 最小周波数（Hz） |
| `--fmax` | 1000.0 | 最大周波数（Hz） |
| `--threshold` | 0.1 | 有声判定閾値 |

**出力:**
```
Melody Analysis:
  Has Melody:      Yes
  Pitch Range:     1.52 octaves
  Mean Frequency:  320.5 Hz
  Pitch Stability: 0.78
  Vibrato Rate:    5.2 Hz
```

### boundaries

オーディオの構造境界を検出。

```bash
sonare boundaries music.mp3
sonare boundaries music.mp3 --threshold 0.3 --min-distance 2.0
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--threshold` | 0.3 | 検出閾値 |
| `--kernel-size` | 64 | チェッカーボードカーネルサイズ |
| `--min-distance` | 2.0 | 境界間の最小距離（秒） |

**出力:**
```
Structural Boundaries (6 detected):
Time      Strength
8.52s     0.85
32.10s    0.92
48.20s    0.78
```

## 処理コマンド

### pitch-shift

テンポを変えずにピッチを変更。

```bash
sonare pitch-shift --semitones 3 input.wav -o output.wav
sonare pitch-shift --semitones -5 input.mp3 -o lower.wav
```

| オプション | 必須 | 説明 |
|--------|----------|-------------|
| `--semitones` | はい | 半音数（正=上げる、負=下げる） |

### time-stretch

ピッチを変えずにテンポを変更。

```bash
sonare time-stretch --rate 0.5 input.wav -o slower.wav  # 半速
sonare time-stretch --rate 2.0 input.wav -o faster.wav  # 倍速
sonare time-stretch --rate 1.25 input.mp3 -o output.wav # 25%速く
```

| オプション | 必須 | 説明 |
|--------|----------|-------------|
| `--rate` | はい | 伸縮率（0.5=半速、2.0=倍速） |

### hpss

Harmonic-Percussive Source Separation（調和-打楽器分離）。

```bash
sonare hpss input.wav -o separated
# 作成: separated_harmonic.wav, separated_percussive.wav

sonare hpss input.wav -o output --with-residual
# 追加作成: output_residual.wav

sonare hpss input.wav -o harmonic.wav --harmonic-only
sonare hpss input.wav -o percussive.wav --percussive-only
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--kernel-harmonic` | 31 | 水平カーネルサイズ（時間） |
| `--kernel-percussive` | 31 | 垂直カーネルサイズ（周波数） |
| `--hard-mask` | false | ソフトマスクの代わりにハードマスクを使用 |
| `--with-residual` | false | 残差成分も出力 |
| `--harmonic-only` | false | 調和成分のみ出力 |
| `--percussive-only` | false | 打楽器成分のみ出力 |

## 特徴コマンド

### mel

メルスペクトログラム統計を計算。

```bash
sonare mel music.mp3
sonare mel music.mp3 --n-mels 80 --fmin 50 --fmax 8000
```

**出力:**
```
Mel Spectrogram:
  Shape:       128 bands x 8520 frames
  Duration:    180.52s
  Sample Rate: 22050 Hz
  Stats:       min=0.0001, max=0.8520, mean=0.0452
```

### chroma

クロマグラム（ピッチクラス分布）を計算。

```bash
sonare chroma music.mp3
sonare chroma music.mp3 --json
```

**出力:**
```
Chromagram:
  Shape:    12 bins x 8520 frames
  Duration: 180.52s

Mean Energy by Pitch Class:
  C : 0.125 *************
  C#: 0.045 *****
  D : 0.082 ********
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
Spectral Features (8520 frames):
  Feature          Mean       Std        Min        Max
  centroid         2150.5     850.2      120.5      8500.0
  bandwidth        1850.2     520.8      50.2       4200.5
  rolloff          4520.8     1200.5     200.0      10000.0
  flatness         0.0250     0.0180     0.0010     0.1520
  zcr              0.0850     0.0420     0.0020     0.2500
  rms              0.0520     0.0280     0.0001     0.1850
```

### pitch

YIN または pYIN アルゴリズムでピッチを追跡。

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm pyin --fmin 65 --fmax 2093
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--algorithm` | pyin | ピッチアルゴリズム: "yin" または "pyin" |
| `--fmin` | 65.0 | 最小周波数（Hz） |
| `--fmax` | 2093.0 | 最大周波数（Hz） |
| `--threshold` | 0.3 | 信頼度閾値 |

**出力:**
```
Pitch Tracking (pyin):
  Frames:    8520
  Voiced:    6250 (73.4%)
  Median F0: 285.5 Hz
  Mean F0:   302.8 Hz
```

### onset-env

オンセット強度エンベロープを計算。

```bash
sonare onset-env music.mp3
sonare onset-env music.mp3 --json
```

**出力:**
```
Onset Strength Envelope:
  Frames:        8520
  Duration:      180.52s
  Peak Time:     45.28s
  Peak Strength: 0.952
  Mean:          0.125
```

### cqt

Constant-Q 変換を計算。

```bash
sonare cqt music.mp3
sonare cqt music.mp3 --fmin 32.7 --n-bins 84 --bins-per-octave 12
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--fmin` | 32.7 | 最小周波数（Hz）- デフォルトは C1 |
| `--n-bins` | 84 | 周波数ビン数 |
| `--bins-per-octave` | 12 | オクターブあたりのビン数（12 = 半音解像度） |

**出力:**
```
Constant-Q Transform:
  Shape:          84 bins x 8520 frames
  Frequency Range: 32.7 - 4186.0 Hz (7 octaves)
  Duration:       180.52s
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
Audio File: music.mp3
  Duration:    3:00.5 (180.52s)
  Sample Rate: 22050 Hz
  Samples:     3980000
  Peak Level:  -0.5 dB
  RMS Level:   -12.3 dB
```

### version

バージョン情報を表示。

```bash
sonare version
sonare version --json
```

**出力:**
```
sonare-cli version 1.0.0
libsonare version 1.0.0
```

## 使用例

### 基本解析ワークフロー

```bash
# クイック BPM とキーチェック
sonare bpm song.mp3
sonare key song.mp3

# スクリプト用に JSON で完全解析
sonare analyze song.mp3 --json > analysis.json

# コード進行を検出
sonare chords song.mp3 --min-duration 0.5
```

### オーディオ処理ワークフロー

```bash
# 2半音上に移調
sonare pitch-shift --semitones 2 original.wav -o transposed.wav

# 練習用にスローダウン（80%速度）
sonare time-stretch --rate 0.8 song.wav -o practice.wav

# ドラムとメロディを分離
sonare hpss song.wav -o separated
# 作成: separated_harmonic.wav, separated_percussive.wav
```

### ML 用特徴抽出

```bash
# 機械学習用に特徴を抽出
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

2. **バッチ処理**: `--quiet` で出力オーバーヘッドを削減:
   ```bash
   sonare analyze song.mp3 --quiet --json > result.json
   ```

3. **FFT サイズ**: 小さい FFT サイズ（`--n-fft 1024`）は高速だが周波数解像度が低い。

4. **ホップ長**: 大きいホップ長（`--hop-length 1024`）は高速だが時間解像度が低い。
