# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

CLI は、アプリケーションコードを書かずに、簡易確認、バッチ処理、スクリプト向け JSON 出力を行いたい場合に使います。UI を作る場合は、[WebAssembly ガイド](./wasm.md)、[Python API](./python-api.md)、[ミキシングエンジン](./mixing.md) から始めてください。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- PyPI の `sonare` コマンドを導入し、ソースビルドの C++ CLI との違いを理解できる。
- 簡易解析、特徴量サマリー、編集、マスタリング、音響チェック、簡単なミキシングに合うコマンドを選べる。
- 人が読む出力と、スクリプト向けの `--json` 出力を使い分けられる。
- CLI ではなく Python、WASM、ネイティブ API へ移るべきワークフローを判断できる。

## 最初に試すコマンド

| 目的 | コマンド |
|------|----------|
| 全体の要約を見る | `sonare analyze music.mp3` |
| テンポだけを見る | `sonare bpm music.mp3` |
| キーだけを見る | `sonare key music.mp3` |
| スクリプトで扱いやすい出力にする | `sonare analyze music.mp3 --json` |

::: info CLI とは？
CLI は Command Line Interface の略で、ターミナルから実行するコマンド形式の入口です。アプリに組み込む前の確認、複数ファイルのバッチ処理、JSON を別スクリプトへ渡す用途に向いています。画面 UI やライブ処理を作る場合は、WASM / Python / C++ API の方が扱いやすいことが多いです。
:::

## どの CLI を使っているか

ソースツリーには 2 種類の `sonare` コマンドライン入口があります。

| CLI | 入手方法 | 向いている用途 | コマンド範囲 |
|-----|----------|----------------|--------------|
| Python CLI | `pip install libsonare` | 多くのユーザー向け。バッチ解析、特徴量サマリー、編集、マスタリング、簡単なミキシング | 広く安定しており、ファイルデコードも扱いやすい |
| C++ CLI | `BUILD_CLI=ON` でソースビルド | 開発、互換性確認、低レベルユーティリティ、追加のシーン書き出し | 一部の特徴量・ユーティリティは Python CLI より多い |

このページで明示的に「ソースビルドの C++ CLI」と書いていない限り、PyPI の Python CLI で使えるコマンドとして読んでください。

::: tip pip で簡単インストール
`sonare` CLI は PyPI の Python パッケージに含まれます。

```bash
pip install libsonare
sonare analyze music.mp3
```

npm の WebAssembly パッケージ `@libraz/libsonare` ではインストールされません。

標準の PyPI ホイールは WAV/MP3 をデコードします。M4A/AAC/FLAC/OGG/Opus を直接読むには FFmpeg 有効ビルドが必要です。
:::

::: info C++ CLI にはさらにコマンドがあります
Python CLI はすでに解析・特徴量・編集・マスタリング・`mix` をカバーしています
（下の [その他のコマンド](#その他のコマンド) を参照）。ソースからビルドすると、PyPI
パッケージにはない追加コマンドを含む C++ CLI が利用できます。[ソースからビルド](/ja/docs/installation#ソースからビルド) を参照してください。

- 解析: `sections`, `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase`, `system-info`
- エフェクト／変換: `pitch-shift`, `time-stretch`, `preemphasis`, `deemphasis`, `trim-silence`, `split-silence`, `normalize`, `gain`, `fade`, `filter`, `resample`
- 合成: `tone`, `chirp`, `clicks`
- 特徴量: `cqt`, `vqt`, `mel-to-audio`, `mfcc-to-audio`, `tonnetz`, `pcen`, `onset-env`（`onset-envelope` の短縮エイリアス）, `fourier-tempogram`, `tempogram-ratio`
- librosa 互換ユーティリティ: `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`
- マスタリング: `mastering-pair-processor`（ソース／リファレンスのペア処理）, `mastering-stereo-analyses`, `mastering-stereo-analyze`
- ミキシングシーンツール: `mixing-presets`, `mixing-preset`（一覧／シーン JSON 書き出し）
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
| `-o`, `--output` | 出力 WAV パス。編集・マスタリング・`eq`・`mix` コマンドはここに WAV を書き出します。解析・特徴抽出コマンドは stdout に出力します |
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
sonare key music.mp3 --candidates 5 --profile temperley --modes major-minor
```

**出力:**
```
  Key: A minor (confidence: 82.0%)
```

**JSON 出力:**
```json
{"root": 9, "mode": 1, "confidence": 0.82, "name": "A minor"}
```

主なオプション:

| オプション | 用途 |
|------------|------|
| `--candidates N` | 最上位だけでなく上位 `N` 個のキー候補を表示 |
| `--use-hpss` | ドラムが強い素材で、倍音成分を使ってキーを見やすくする |
| `--loudness-weighted` | RMS でクロマフレームを重み付けし、静かな箇所の影響を下げる |
| `--high-pass-hz FREQ` | キー解析前に低域を無視する |
| `--modes major-minor\|all\|...` | 候補モードを制限する |
| `--profile ks\|krumhansl\|temperley\|shaath\|keyfinder\|faraldo-edmt\|edmt\|faraldo-edma\|edma\|faraldo-edmm\|edmm\|bellman-budge\|bellman` | キープロファイルの系統を選ぶ |
| `--genre-hint auto\|edm\|electronic\|dance\|pop\|classical\|jazz` | ジャンルヒントからプロファイルを選ばせる |

::: details キープロファイル・ジャンルヒント・`--high-pass-hz` とは？
- **キープロファイル** — あるキーで 12 のピッチクラスがそれぞれどれくらい目立ちやすいかのテンプレートです。検出器は曲のクロマをこれらと比べ、最も一致するものを選びます。系統（`ks` / `krumhansl`、`temperley`、`shaath` / `keyfinder`、Faraldo EDM 系、`bellman` / `bellman-budge`）はそれぞれ別の素材で調整されているため、ジャンルによって相性が変わります。
- **ジャンルヒント** — プロファイルを直接指定する代わりに、おおまかなスタイルを伝えると CLI が合うプロファイルを選びます（例: EDM ヒントなら EDM 向けに調整したプロファイル）。
- **`--high-pass-hz`** — ハイパスフィルターで、キー解析の前に指定周波数より下のエネルギーを除きます。低域のランブルやサブキックがクロマを歪めるのを防ぎます。80〜120 Hz 程度が一般的です。
:::

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

HPSS（Harmonic / Percussive Source Separation）。倍音成分（ボーカル／メロディ）と打撃成分（ドラム）を分離します。

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

## その他のコマンド

Python CLI には、上記のコア以外にも多くのサブコマンドがあります。音声ファイルを解析・特徴抽出するコマンドは共通オプション（`--json`、`--n-fft` など）とファイル引数を取ります。一覧表示やプリセット参照のコマンドは、より小さい専用のオプションセットを持ちます。編集系コマンドは `-o/--output` を渡すと WAV を書き出します。

### その他の解析

| コマンド | 説明 | 主なオプション |
|----------|------|----------------|
| `sonare downbeats music.mp3` | ダウンビート時刻（秒） | — |
| `sonare chords music.mp3` | コード進行 | `--min-duration`, `--smoothing-window`, `--threshold`, `--triads-only`, `--nnls`, `--no-beat-sync`, `--use-hmm`, `--hmm-beam-width`, `--key-context`, `--key-root`, `--key-mode`, `--detect-inversions` |
| `sonare rhythm music.mp3` | リズム特性（シンコペーション、グルーヴ、規則性） | — |
| `sonare dynamics music.mp3` | ダイナミクス／ラウドネスの要約 | — |
| `sonare timbre music.mp3` | 音色／スペクトル形状の要約 | — |
| `sonare lufs music.mp3` | EBU R128 ラウドネス | `--series`（momentary／short-term の系列も出力） |
| `sonare acoustic room.wav` | 室内音響推定（RT60／EDT／C50／C80） | `--ir`（入力をインパルス応答として扱う） |
| `sonare meter music.wav` | ピーク、RMS、クレスト、トゥルーピーク、クリッピング率、無音率、DC オフセット | ソースビルド C++ CLI のみ。`--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | クリップしたサンプルと区間を検出 | ソースビルド C++ CLI のみ。`--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | percentile RMS ベースのダイナミックレンジ | ソースビルド C++ CLI のみ。`--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | 左右ファイルからステレオ相関と幅を測定 | ソースビルド C++ CLI のみ |
| `sonare phase left.wav --reference right.wav` | 左右ファイルからフェーズスコープ要約を測定 | ソースビルド C++ CLI のみ |

### その他の特徴量

| コマンド | Python CLI | ソースビルド C++ CLI | 説明 |
|----------|------------|------------------------|------|
| `sonare onset-envelope music.mp3` | 対応 | 対応 | オンセット強度包絡 |
| `sonare onset-env music.mp3` | 非対応 | 対応 | オンセット強度包絡の短縮エイリアス |
| `sonare tempogram music.mp3` | 対応 | 対応 | 自己相関テンポグラム |
| `sonare plp music.mp3` | 対応 | 対応 | 主要局所パルス |
| `sonare nnls-chroma music.mp3` | 対応 | 対応 | NNLS クロマグラム |
| `sonare cqt music.mp3` | 非対応 | 対応 | Constant-Q 変換のサマリー |
| `sonare vqt music.mp3` | 非対応 | 対応 | Variable-Q 変換のサマリー |
| `sonare mel-to-audio music.mp3 -o recon.wav` | 非対応 | 対応 | 計算したメルスペクトログラムから Griffin-Lim で音声を再構成 |
| `sonare mfcc-to-audio music.mp3 -o recon.wav` | 非対応 | 対応 | 計算した MFCC からメル、Griffin-Lim 経由で音声を再構成 |
| `sonare tonnetz music.mp3` | 非対応 | 対応 | Tonal centroid 特徴 |
| `sonare pcen --values ... --n-bins 128 --n-frames 10` | 非対応 | 対応 | 平坦化した行列への per-channel energy normalization |
| `sonare fourier-tempogram music.mp3` | 非対応 | 対応 | Fourier tempogram |
| `sonare tempogram-ratio music.mp3` | 非対応 | 対応 | テンポ比特徴量 |

Python CLI は行列特徴量の全データをそのまま出力せず、サマリーを表示します。完全な特徴量行列が必要な場合は [Python API](./python-api.md) または [JavaScript API](./js-api.md) を使ってください。

### 編集

音声を変換し、`-o` で WAV を書き出します。

| コマンド | 説明 | オプション |
|----------|------|-----------|
| `sonare pitch-correct vocal.wav -o out.wav` | 目標 MIDI ノートへピッチ補正 | `--current-midi`（69.0）, `--target-midi`（69.0） |
| `sonare note-stretch take.wav -o out.wav` | 単一ノート区間をストレッチ | `--onset`, `--offset`（サンプル位置）, `--ratio`（1.0） |
| `sonare voice-change vocal.wav -o out.wav` | ボイスチェンジ（ピッチ＋フォルマント） | `--pitch-semitones`（0.0）, `--formant-factor`（1.0） |

Python CLI は、上の 3 つのファイル書き出し編集コマンドと HPSS サマリーを中心に提供します。

ソースビルドの C++ CLI では、同じ 3 つの編集コマンドに加えて、低レベルの処理コマンドも使えます。

| C++ コマンド | 必須または主なオプション |
|--------------|--------------------------|
| `pitch-shift` | `--semitones` |
| `time-stretch` | `--rate` |
| `normalize` | `-o`; `--mode peak\|rms`, `--target-db` |
| `gain` | `-o`, `--gain-db` |
| `fade` | `-o`, `--fade-in` または `--fade-out` |
| `filter` | `-o`, `--type hp\|lp\|bp\|notch`; hp/lp は `--cutoff`、bp/notch は `--center` + `--bandwidth` |
| `resample` | `-o`, `--target-sr` |
| `preemphasis`, `deemphasis`, `trim-silence`, `split-silence` | 処理後のファイルを書き出す場合は `-o` |

### リアルタイムボイスプリセット

リアルタイムボイスチェンジャープリセットの参照、検証、レンダリングを行うコマンドです。

| コマンド | 説明 | オプション |
|----------|------|------------|
| `sonare voice-change vocal.wav -o out.wav` | `--preset`、`--preset-json`、`--preset-pack`、`--set` を渡した場合はリアルタイム音声プリセットチェーンでレンダリング | `--preset`、`--preset-json`、`--preset-pack`、`--set PATH=VALUE` |
| `sonare voice-presets` | リアルタイムボイスチェンジャーのプリセット ID を一覧表示 | `--json` |
| `sonare voice-preset` | 1 つのプリセット設定を JSON で出力 | `--preset`（既定: `neutral-monitor`）、`--json` |
| `sonare voice-preset-validate preset.json` | プリセット JSON ファイルまたはプリセットパックを検証・正規化 | パック検証時は `--preset`、`--set PATH=VALUE`、`--json` |

リアルタイムプリセット系のオプションを渡さない場合、`voice-change` は `--pitch-semitones` と `--formant-factor` で制御する単純なピッチ／フォルマント変換を使います。プリセット系のオプションを渡した場合はリアルタイム音声チェーンを使い、これらの単純なピッチ／フォルマント指定は参照しません。

### 合成

ソースビルドの C++ CLI では、簡単なテスト信号も生成できます。

| C++ コマンド | 必須または主なオプション |
|--------------|--------------------------|
| `tone -o tone.wav` | `--frequency`; 任意で `--sr`, `--duration`, `--phase`, `--amplitude` |
| `chirp -o sweep.wav` | `--fmax`; 任意で `--fmin`, `--exponential`, `--sr`, `--duration` |
| `clicks -o clicks.wav` | 秒単位のカンマ区切り `--times`; 任意で `--sr`, `--length`, `--frequency`, `--click-duration` |

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
libsonare 1.2.2 (Python CLI)
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

### マスタリングのワークフロー

::: info コマンドの提供範囲
PyPI の Python CLI には `mastering`、`mastering-processor`、`eq`、`mastering-processors`、および下記のペア解析コマンドが含まれます。ソースからビルドした C++ CLI では、ソース／リファレンスを処理する `mastering-pair-processor`、ステレオ解析一覧、ステレオ解析実行などの追加マスタリングコマンドも利用できます。[ソースからビルド](/ja/docs/installation#ソースからビルド) を参照してください。
:::

```bash
# 目標ラウドネスとトゥルーピーク上限でノーマライズし、WAV を書き出す
sonare mastering track.wav --target-lufs -14 --ceiling-db -1 -o master.wav

# このビルドに含まれるマスタリングプロセッサを確認
sonare mastering-processors

# 名前付きマスタリングプロセッサを実行して WAV を書き出す
sonare mastering-processor track.wav \
  --processor spectral.airBand \
  --params amount=0.4,shelfFrequencyHz=14000 \
  -o libsonare-master.wav

# 統合イコライザを適用（1 回に 1 バンド、または --params で複数指定）
sonare eq track.wav --type 2 --frequency-hz 12000 --gain-db 2.5 --q 0.7 -o eq.wav

# リファレンスを使ったラウドネス／トーン解析
sonare mastering-pair-analyses
sonare mastering-pair-analyze track.wav \
  --reference reference.wav \
  --analysis match.referenceLoudness \
  --json > mastering-report.json
```

Python CLI のペア解析では、ソースとリファレンスが同じサンプル数にデコードされている必要があり、サンプルレートも事前に揃えておくべきです。長さが違う場合、CLI はエラーとして表示します。比較前にリサンプリングやトリムが必要な場合は Python API を使ってください。

`/ja/mastering` ブラウザデモも同じマスタリングプロセッサ群を呼び出しています。デモから書き出したレポートを CLI 自動化の起点として活用できます。

Python CLI の名前付きマスタリングコマンド:

| 目的 | コマンド |
|------|---------|
| 目標ラウドネス＋トゥルーピーク上限でノーマライズ | `sonare mastering` |
| 統合イコライザを適用 | `sonare eq` |
| モノラル／ステレオプロセッサ一覧 | `sonare mastering-processors` |
| 名前付きプロセッサを適用 | `sonare mastering-processor` |
| ペアプロセッサ一覧 | `sonare mastering-pair-processors` |
| ペア解析一覧 | `sonare mastering-pair-analyses` |
| ソース／リファレンスのペア解析 | `sonare mastering-pair-analyze` |

ソースビルド C++ CLI のみ: `sonare mastering-pair-processor`、`sonare mastering-stereo-analyses`、`sonare mastering-stereo-analyze`。

関連するマスタリングガイド: [配信ターゲット](./glossary/mastering/delivery-targets.md)、[メーターの読み方](./glossary/mastering/meter-reading.md)、[エラー復旧](./glossary/mastering/error-recovery.md)。

RT60、EDT、C50、C80、D50、信頼度などのルーム音響フィールドは [ルーム音響解析](./acoustic-analysis.md) で説明しています。

### ミキシングワークフロー

::: info コマンドの提供範囲
PyPI の Python CLI には `mix` が含まれ、JSON ファイルまたは組み込みプリセットからミキサーシーンを読み込み、必要ならストリップごとの入力 WAV をレンダリングします。ソースからビルドした C++ CLI では `mixing-presets` と `mixing-preset` も利用でき、シーン一覧の確認や、WASM／Python／Node／C++ のミキサー API に読み込ませるシーン JSON の書き出しに使えます。
:::

```bash
# 組み込みシーンプリセットを読み込み、ストリップ入力をステレオ WAV にレンダリング
sonare mix \
  --preset vocalReverbSend \
  --input vocal.wav \
  --input music.wav \
  --sample-rate 48000 \
  -o mixed.wav

# または JSON からシーンを読み込む（例: C++ の `mixing-preset` で書き出したもの）
sonare mix --scene scene.json --input vocal.wav --input music.wav -o mixed.wav
```

`mix` は `--scene` か `--preset` のいずれか一方が必須です。ストリップごとに
`--input` を 1 つ渡し、ファイルへのレンダリングには `-o/--output` が必要です。

関連: [ミキシングエンジン](./mixing.md)。

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
