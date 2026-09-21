# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

CLI は、アプリケーションコードを書かずに、簡易確認、バッチ処理、スクリプト向け JSON 出力を行いたい場合に使います。UI を作る場合は、[WebAssembly ガイド](./wasm.md)、[Python API](./python-api.md)、[ミキシングエンジン](./mixing.md) から始めてください。

このページはコマンド単位のリファレンスです。ステムから完成マスターまで、リファレンス曲への追い込み、CI での納品前チェックといった、シェルで完結させる作業単位の手順は [実践ユースケース](./use-cases.md) にあります。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- PyPI の `sonare` コマンドを導入し、ネイティブ CLI との違いを理解できる。
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

この 4 つのコマンドは pip でインストールした CLI から実行できます。以降のセクションでは、ネイティブ CLI が必要なコマンドに印を付けています。コマンドが見つからないときは、入力ミスを疑う前にまずその表示を確認してください。

::: info CLI とは？
CLI は Command Line Interface の略で、ターミナルから実行するコマンド形式の入口です。アプリに組み込む前の確認、複数ファイルのバッチ処理、JSON を別スクリプトへ渡す用途に向いています。画面 UI やライブ処理を作る場合は、WASM / Python / C++ API の方が扱いやすいことが多いです。
:::

## どの CLI を使っているか

コマンドラインの入口は 2 つあります。

| CLI | コマンド名 | 入手方法 | 向いている用途 |
|-----|-----------|----------|----------------|
| Python CLI | `sonare` | `pip install libsonare` | 多くのユーザー向け。バッチ解析、特徴量サマリー、編集、マスタリング、簡単なミキシング |
| ネイティブ CLI | `sonare-cli` | リリースアーカイブ、または `BUILD_CLI=ON` でソースビルド | 低レベルユーティリティ、信号生成、librosa 互換ヘルパー、追加のシーン書き出し |

ネイティブ実行ファイルは、FFmpeg なしの Linux / macOS リリースアーカイブに
`sonare-cli` という名前で（それぞれ SHA-256 チェックサム付きで）同梱されます。
そのため Python の `sonare` コマンドと衝突せず、並べてインストールできます。
このページの例は `sonare` と書いていますが、ネイティブ専用コマンドを実行するときは
`sonare-cli` に読み替えてください。

対応するコマンドでは、どちらの CLI も同じ `snake_case` のキーとペイロード形状を使うため、同じスクリプトで読めます。ただし、バイト単位で同一の出力には依存しないでください。各フロントエンドは個別にシリアライズし、JSON の値はネイティブの精度を保ちます。人間向けの単機能サマリーでは、丸めが行われる場合があります。

このページで明示的に「ネイティブ CLI」と書いていない限り、PyPI の Python CLI で使えるコマンドとして読んでください。

::: tip pip で簡単インストール
`sonare` CLI は PyPI の Python パッケージに含まれます。

```bash
pip install libsonare
sonare analyze music.mp3
```

npm の WebAssembly パッケージ `@libraz/libsonare` ではインストールされません。

標準の PyPI ホイールは WAV/MP3 をデコードします。M4A/AAC/FLAC/OGG/Opus を直接読むには FFmpeg 有効ビルドが必要です。
:::

::: info どちらの CLI にどのコマンドがあるか
ほとんどのコマンドは両方の CLI にあり、オプションも共通です。`sonare-cli` には
PyPI パッケージにない低レベルユーティリティと信号生成コマンドがあり、Python CLI
にはシーンミキサーとプリセット駆動のマスタリングコマンドがあります。ネイティブの
実行ファイルはリリースアーカイブから入手するか、[ソースからビルド](/ja/docs/installation#ソースからビルド) を参照してください。

**ネイティブ CLI のみ**

- 解析: `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase`, `system-info`
- エフェクト／変換: `preemphasis`, `deemphasis`, `gain`, `fade`, `filter`
- 合成: `tone`, `chirp`, `clicks`
- 特徴量: `cqt`, `vqt`, `mel-to-audio`, `mfcc-to-audio`, `tonnetz`, `pcen`, `onset-env`（onset-envelope の要約版。ピーク時刻・ピーク強度・平均）, `fourier-tempogram`, `tempogram-ratio`
- librosa 互換ユーティリティ: `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`
- マスタリング: `mastering-stereo-analyses`

**Python CLI のみ**

`master`、`mastering-chain`、`declip`、そしてシーンミキサーの `mix`（[ミキシングワークフロー](#ミキシングワークフロー) を参照）です。

`sections` は両方にありますが、オプションが異なります。共通の `--min-duration`
に加えて、ネイティブ CLI には `--threshold` があります。
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
| `-o`, `--output` | 出力 WAV パス。編集・マスタリング・`eq`・`mix` コマンドはここに WAV を書き出します。解析・特徴抽出コマンドは stdout に出力し、このオプションを受け付けません |
| `--n-fft <int>` | FFT サイズ（デフォルト: 2048） |
| `--hop-length <int>` | ホップ長（デフォルト: 512） |
| `--n-mels <int>` | Mel バンド数（デフォルト: 128） |
| `--quiet`, `-q` | ネイティブ CLI のみ。進捗出力を抑制する |

`sonare <command> --help` は、そのコマンドが実際に受け付けるオプションだけを
表示します。個々のコマンドについてはヘルプが正解です。上記の DSP オプション
（`--n-fft`・`--hop-length`・`--n-mels`）は、それを使うコマンドだけが受け付けます。
使わないコマンドに渡すと、黙って無視されるのではなく使用方法エラー（終了コード 2）で
終了します。

色付けは起動時に一度だけ設定されます。環境変数 `NO_COLOR` を設定するか、
標準出力をファイルやパイプにリダイレクトすると、実行全体で ANSI エスケープが無効になります。

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

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--with-seventh` | 無効 | トライアドだけでなく、コードテンプレート全体を探索する |
| `--no-hpss` | 無効 | 倍音／打撃成分分離を無効化する |
| `--chroma-highpass` | 80.0 | クロマ解析用のハイパスカットオフ周波数（Hz） |
| `--meter-candidates` | `3,4,6` | 探索する拍子の分子。カンマ区切り |
| `--meter-denominator` | 4 | 検出した拍子を報告するときの音符単位 |

`--with-seventh` を指定しない場合、コード認識はメジャー・マイナー・ディミニッシュ
・オーギュメントのトライアドだけを照合します。指定すると、ルートごとに 24 種類の
コードクオリティすべてが対象になります。セブンスやナインスに加えて、シックスス、
`7sus4`、イレブンス、サーティーンス、オルタードドミナントが含まれます。

拍子の探索は、指定された分子しか報告しません。デフォルトの候補は `3,4,6` なので、
5/4 や 7/8、11/8 の曲もこの 3 つのいずれかとして返ってきます。`--meter-candidates
3,4,5,7` のように候補を広げて初めて検出できます。候補リストは 1〜16 個で、各値は
2〜32 の範囲です。`--meter-denominator` は結果を報告するときの音符単位を決めるだけ
で、探索そのものには影響しません。2 つの数字の意味は
[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) で説明しています。

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
    "denominator": 4,
    "confidence": 0.91
  },
  "beats": [
    {"time": 0.52, "strength": 0.84},
    {"time": 1.02, "strength": 0.78}
  ],
  "downbeat_indices": [0, 4, 8],
  "downbeat_phase": 0,
  "chords": [
    {"name": "C", "start": 0.0, "end": 2.0, "confidence": 0.88}
  ],
  "sections": [
    {"type": "intro", "start": 0.0, "end": 8.0}
  ],
  "timbre": {
    "brightness": 0.61,
    "warmth": 0.47,
    "density": 0.72,
    "roughness": 0.18,
    "complexity": 0.56
  },
  "dynamics": {
    "dynamic_range_db": 9.4,
    "loudness_range_db": 6.8,
    "crest_factor": 7.2,
    "is_compressed": false
  },
  "rhythm": {
    "syncopation": 0.32,
    "groove_type": "straight",
    "pattern_regularity": 0.89
  },
  "form": "IAB"
}
```

上の配列は省略した例です。特に `beats` はビート数ではなく、検出したビートごとの `{"time", "strength"}` オブジェクトを保持します。

`downbeat_indices` は独自の時刻を持たず、`beats` のインデックスを保持します。つまりダウンビートかどうかは、この配列に含まれるかどうかで判定します（`i` が `downbeat_indices` にあれば `beats[i]` がダウンビートです）。`downbeat_phase` は最初のダウンビートが何番目のビートに来るかを表し、テイクが小節の途中から始まっている量を示します。

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
| `--modes NAME` | 候補モードを制限する |
| `--profile NAME` | キープロファイルの系統を選ぶ |
| `--genre-hint HINT` | ジャンルヒントからプロファイルを選ばせる |

::: details キープロファイル・ジャンルヒント・`--high-pass-hz` とは？
- **キープロファイル** — あるキーで 12 のピッチクラスがそれぞれどれくらい目立ちやすいかのテンプレートです。検出器は曲のクロマをこれらと比べ、最も一致するものを選びます。

  系統（`ks` / `krumhansl`、`temperley`、`shaath` / `keyfinder`、Faraldo EDM 系、`bellman` / `bellman-budge`）はそれぞれ別の素材で調整されています。そのため、ジャンルによって相性が変わります。
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
sonare mel music.mp3 --fmin 40 --fmax 16000 --htk
```

| オプション | デフォルト | 説明 |
|------------|------------|------|
| `--fmin FREQ` | 0 | メルバンドの最低周波数（Hz） |
| `--fmax FREQ` | 0 | メルバンドの最高周波数（Hz）。0 ならナイキスト周波数を使う |
| `--htk` | 無効 | Slaney スケールではなく HTK メルスケールを使う |

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

スペクトル特徴を計算します。セントロイド、帯域幅、ロールオフ、フラットネス、ZCR（zero-crossing rate、ゼロ交差率）、RMS（root mean square、実効値レベル）を出力します。

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

YIN または pYIN の基本周波数推定器で、ピッチの時間変化を追跡します。

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm yin
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--algorithm` | pyin | ピッチアルゴリズム: "yin" または "pyin" |
| `--threshold` | 0.1 | YIN のしきい値（0 より大きく 1 以下） |
| `--fmin` | 65.0 | 追跡する最低周波数（Hz） |
| `--fmax` | 2093.0 | 追跡する最高周波数（Hz） |
| `--hop-length` | 512 | ホップ長（サンプル数）。グローバルの `--hop-length` とは別に、範囲チェック付きでこのコマンド用に再定義されています |

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
sonare hpss music.mp3 -o separated
sonare hpss music.mp3 -o separated --json
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--kernel-harmonic <int>` | 31 | 倍音成分側のメディアンフィルターカーネルサイズ |
| `--kernel-percussive <int>` | 31 | 打撃成分側のメディアンフィルターカーネルサイズ |
| `--harmonic-only` | 無効 | 倍音成分のみを書き出す |
| `--percussive-only` | 無効 | 打撃成分のみを書き出す |
| `--with-residual` | 無効 | 残差成分も分離して書き出す |
| `--hard-mask` | 無効 | デフォルトのソフトマスクの代わりにハードマスクを使う |

`--harmonic-only`、`--percussive-only`、`--with-residual` は同時に指定できません。

**出力:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
  Wrote: separated_harmonic.wav, separated_percussive.wav
```

### decompose-stems

ミックスを非負値行列因子分解（NMF）の成分に分けます。`hpss` のように倍音／打撃という固定の分け方をするのではなく、繰り返し現れるスペクトルパターンをデータから見つけて分離します。

```bash
sonare decompose-stems band.wav -o stems.wav
sonare decompose-stems band.wav -o stems.wav --n-components 6 --init nndsvd --json
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--n-components <int>` | 4 | 分解する成分の数 |
| `--n-iter <int>` | 100 | NMF の更新反復回数 |
| `--beta` | 2.0 | ベータダイバージェンス。2 は Frobenius、1 は Kullback-Leibler |
| `--init` | random | NMF の初期化方法。`random` または `nndsvd` |
| `--mask-power` | 1.0 | ソフトマスクの指数（1 以上）。2 は Wiener 型のパワー比になる |

`-o` は 1 つのファイルではなく、ファイル群の名前として扱われます。どちらの CLI も
`<base>_component1.wav` 〜 `<base>_componentN.wav` を書き出し、渡したパス末尾の
`.wav` は取り除かれます。各成分は元音声の位相を保つため、すべて足し合わせると入力に
戻り、成分単体でもそのまま聴けます。ここがライブラリの `decompose` との違いです。
`decompose` は振幅スペクトログラムの因子を返すだけなので、音として聴くには位相推定が
必要になります。

**出力:**
```
  Stems: 4 components
     1. energy 0.031200  stems_component1.wav
     2. energy 0.018400  stems_component2.wav
     3. energy 0.009100  stems_component3.wav
     4. energy 0.004700  stems_component4.wav
```

## その他のコマンド

Python CLI には、上記のコア以外にも多くのサブコマンドがあります。

音声ファイルを解析・特徴抽出するコマンドは、共通オプション（`--json`、`--n-fft` など）とファイル引数を取ります。

一覧表示やプリセット参照のコマンドは、より小さい専用のオプションセットを持ちます。編集系コマンドは `-o/--output` を渡すと WAV を書き出します。

### その他の解析

::: info ルーム音響コマンドの用語
**等価ルーム** は、音声から推定した実用上の部屋モデルで、正確な実寸ではありません。**RIR** は room impulse response（部屋のインパルス応答）の略です。**ルームモーフィング**は音作り向けのルーム効果であり、残響除去ではありません。

これらのコマンドが返す指標は、残響の減衰と明瞭度を表す値です。**RT60** は残響時間、**EDT** は初期減衰時間、**C50**／**C80** は明瞭度の比、**DRR** は直接音と残響音の比です。各フィールドの定義は [ルーム音響解析](./acoustic-analysis.md) にあります。
:::

| コマンド | 説明 | 主なオプション |
|----------|------|----------------|
| `sonare downbeats music.mp3` | ダウンビート時刻（秒） | — |
| `sonare chords music.mp3` | コード進行 | `--min-duration`, `--smoothing-window`, `--threshold`, `--triads-only`, `--nnls`, `--no-beat-sync`, `--use-hmm`, `--hmm-beam-width`, `--key-context`, `--key-root`, `--key-mode`, `--detect-inversions` |
| `sonare rhythm music.mp3` | リズム特性（シンコペーション、グルーヴ、規則性） | `--start-bpm`（120.0）, `--bpm-min`（60.0）, `--bpm-max`（200.0） |
| `sonare dynamics music.mp3` | ダイナミクス／ラウドネスの要約 | `--window-sec`（0.4） |
| `sonare timbre music.mp3` | 音色／スペクトル形状の要約 | — |
| `sonare lufs music.mp3` | EBU R128 ラウドネス。単位は LUFS（Loudness Units relative to Full Scale。聴感上の音量を表す標準単位。[配信ターゲット](./glossary/mastering/delivery-targets.md) を参照） | `--series`（momentary／short-term の系列も出力） |
| `sonare acoustic room.wav` | ルーム音響推定（RT60／EDT／C50／C80） | `--ir`（入力をインパルス応答として扱う）, `--n-bands`（6）, `--min-decay-db`（30.0）, `--noise-floor-margin-db`（10.0） |
| `sonare estimate-room room.wav` | 等価ルーム推定（体積、寸法、吸音率、DRR、信頼度） | `--json`, `--aspect-lw`, `--aspect-lh`, `--reference-absorption`, `--sabine`, `--n-octave-bands` |
| `sonare synthesize-rir --length 7 --width 5 --height 3 -o rir.wav` | シューボックス形状からモノラル RIR を合成 | `--source-x`, `--source-y`, `--source-z`, `--listener-x`, `--listener-y`, `--listener-z`, `--absorption`, `--sample-rate`, `--ism-order`, `--seed`, `--max-seconds` |
| `sonare room-morph dry.wav --length 12 --width 9 --height 4 -o wet.wav` | 目標ルームへ寄せる音作り向けのルームモーフィング | `--wet`, `--suppression`, 形状・配置オプション、`--max-seconds` |
| `sonare boundaries music.mp3` | 構造の転換点と、それを拾い出した元のノヴェルティ曲線 | ネイティブ CLI のみ。`--threshold`（0.3）, `--absolute-threshold`（0.005）, `--kernel-size`（64）, `--n-mfcc`（13）, `--n-chroma`（12）, `--peak-distance`（2.0）, `--no-mfcc`, `--no-chroma`, `--n-fft`（2048）, `--hop-length`（512） |
| `sonare meter music.wav` | ピーク、RMS、クレスト、True Peak（トゥルーピーク）、クリッピング率、無音率、DC オフセット | ネイティブ CLI のみ。`--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | クリップしたサンプルと区間を検出 | ネイティブ CLI のみ。`--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | percentile RMS ベースのダイナミックレンジ | ネイティブ CLI のみ。`--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | 左右ファイルからステレオ相関と幅を測定 | ネイティブ CLI のみ |
| `sonare phase left.wav --reference right.wav` | 左右ファイルからフェーズスコープ要約を測定 | ネイティブ CLI のみ |

`boundaries` は検出器の全パラメータを公開しており、2 つのしきい値は役割が違います。`--threshold` はノヴェルティ曲線自身の最大値に対する相対値なので、「そもそも変化があったのか」を問えません。それを問えるのが下限の `--absolute-threshold` です。両者の関係と、下限を下げても何が拾えて何が拾えないかは [`detectBoundaries(request)`](./js-api-analysis.md#detectboundaries-request) で説明しています。`--no-mfcc` と `--no-chroma` はそれぞれ特徴量ストリームを 1 つ落としますが、両方の指定は拒否されます。2 つはフレーム単位で結合されるため、どちらも無効では結合する対象がなくなるからです。

### その他の特徴量

| コマンド | Python CLI | ネイティブ CLI | 説明 |
|----------|------------|------------------------|------|
| `sonare onset-envelope music.mp3` | 対応 | 対応 | オンセット強度の包絡線（音の立ち上がりの強さの時間変化）。ネイティブ CLI の `--json` は `values` 配列全体と mean/std/min/max を返す |
| `sonare onset-env music.mp3` | 非対応 | 対応 | 同じ包絡線の要約のみ。フレーム数・ピーク時刻・ピーク強度・平均で、配列は返さない |
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

Python CLI は行列特徴量の全データをそのまま出力せず、サマリーを表示します。完全な特徴量行列が必要な場合は [Python API](./python-api.md) または [JavaScript API](./js-api-analysis.md) を使ってください。

### 編集

音声を変換し、`-o` で WAV を書き出します。

| コマンド | 説明 | オプション |
|----------|------|-----------|
| `sonare pitch-correct vocal.wav -o out.wav` | 目標 MIDI ノートへピッチ補正 | `--current-midi`（69.0）, `--target-midi`（69.0） |
| `sonare pitch-correct-timevarying vocal.wav -o out.wav` | pYIN 輪郭を追跡し、1 音または音階へ補正 | `--mode midi\|scale`, `--target-midi`, `--scale-root`, `--scale-mode-mask`, `--reference-midi`, `--hop-length` |
| `sonare note-move take.wav --target-onset 48000 -o out.wav` | ノート区間を指定サンプル位置へ移動 | `--onset`, `--offset`, `--target-onset`（サンプル位置） |
| `sonare note-stretch take.wav -o out.wav` | 単一ノート区間をストレッチ | `--onset`, `--offset`（サンプル位置）, `--ratio`（1.0） |
| `sonare scale-quantize 68.7` | MIDI 値を音階へ量子化 | `--root`, `--mode-mask`, `--reference-midi` |
| `sonare voice-change vocal.wav -o out.wav` | ボイスチェンジ（ピッチ＋フォルマント） | `--pitch-semitones`（0.0）, `--formant-factor`（1.0） |
| `sonare pitch-shift vocal.wav --semitones 3 -o out.wav` | 長さを変えずに移調 | `--semitones`（**必須**） |
| `sonare time-stretch take.wav --rate 1.2 -o out.wav` | ピッチを変えずに長さを変更 | `--rate`（**必須**） |
| `sonare normalize mix.wav -o out.wav` | ピークまたは RMS ノーマライズ | `--mode peak\|rms`, `--target-db` |
| `sonare trim-silence take.wav -o out.wav` | 前後の無音をトリム | `--top-db`, `--threshold-db`（-60） |
| `sonare resample music.wav --target-sr 44100 -o out.wav` | リサンプリング | `--target-sr` |
| `sonare polyphonic-notes chord.wav` | ポリフォニー解析が見つけたノートを一覧表示 | — |
| `sonare polyphonic-render chord.wav -o out.wav` | その解析結果をノート単位で編集して再レンダリング | `--edit NOTE.FIELD=VALUE`（繰り返し可） |

`--top-db` と `--threshold-db` は同時に指定できない、択一の無音判定方式です。
どちらも省略すると `--threshold-db` が `-60` として扱われ、`--top-db` を指定すると
ピーク相対のトップ dB 方式に切り替わります。

Python CLI は、上のファイル書き出し編集コマンドを提供します。`hpss` も `-o` が必須で、エネルギー要約を表示しながら `<base>_harmonic.wav` と `<base>_percussive.wav` を書き出します。

#### ノート単位の編集

`polyphonic-notes` と `polyphonic-render` は対で使います。前者はポリフォニー解析が見つけたノートを 0 から番号付きで表示し、後者はその番号を使って編集を指定し、テイクを再レンダリングします。どちらも解析を同じ既定値で実行し、フレーミングを変えるオプションを持たないため、一方で読んだ番号がそのまま他方の対象になります。

```bash
sonare polyphonic-notes chord.wav --json
sonare polyphonic-render chord.wav -o out.wav \
  --edit 0.pitch_shift_semitones=2 --edit 3.muted=1
```

`--edit` は 1 回につき 1 つの `NOTE.FIELD=VALUE` を指定し、繰り返し渡せます。指定できるフィールドは `pitch_shift_semitones`、`gain_db`、`time_offset_samples`、`time_stretch_ratio`、`formant_shift_semitones`、`vibrato_depth_change`、`drift_change`、`muted` です。未知のフィールドは無視されるのではなくエラーになります。`polyphonic-render` は `-o` が必須で、`polyphonic-notes` は標準出力に表示するだけなので出力ファイルを取りません。

::: warning 何もしないデフォルトはエラーになりました
`--semitones` と `--rate` には以前デフォルト値があり、省略するとコマンドが何もしない
状態になっていました。現在はどちらも必須です。また、ピッチシフトの未知の
`--algorithm` やピッチ補正の未知の `--mode` も、既定値へフォールバックせずエラーになります。
:::

ネイティブ CLI では、共通の編集コマンドに加えて、低レベルの処理コマンドも使えます。

| ネイティブコマンド | 必須または主なオプション |
|--------------------|--------------------------|
| `gain` | `-o`, `--gain-db` |
| `fade` | `-o`, `--fade-in` または `--fade-out` |
| `filter` | `-o`, `--type hp\|lp\|bp\|notch`; hp/lp は `--cutoff`、bp/notch は `--center` + `--bandwidth`; `--order`（2）, `--zero-phase` |
| `preemphasis`, `deemphasis` | 処理後のファイルを書き出す場合は `-o`。`--coef`（0.97） |

`filter --order` は 2 か 4 を取り、4 は `hp`／`lp` でのみ使えます（`bp` や `notch` に 4 を指定するとエラーになります）。`--zero-phase` はフィルターを順方向と逆方向に 1 回ずつかけ（filtfilt）、位相のずれをなくします。その代わり実効的な傾きが 2 倍になり、ファイル全体が揃っている必要があります。

#### split-silence

`split-silence` はテイクを変更せず、どこが無音かを調べるコマンドです。非無音区間をサンプル範囲として表示するだけで、区間で切り出すよう指定したときだけ音声を書き出します。両方の CLI にあり、オプションも共通です。

```bash
sonare split-silence take1.wav
sonare split-silence take1.wav --json
```

**出力:**
```
Non-silent intervals: 3
  28160 - 116224
  153088 - 241152
  287232 - 394752
```

**JSON 出力:**
```json
[{"start_sample": 28160, "end_sample": 116224}, {"start_sample": 153088, "end_sample": 241152}, {"start_sample": 287232, "end_sample": 394752}]
```

| オプション | デフォルト | 説明 |
|------------|------------|------|
| `--input WAV` | — | 同じパートの別テイク。繰り返し指定可 |
| `--top-db` | 60.0 | ピークからの無音しきい値（dB） |
| `--write-takes PREFIX` | — | 各テイクを各区間で切り出して書き出す |

テイクを複数渡すと、区間はテイクごとの区間の和集合になり、接する区間は結合されます。つまりカットが入るのは、すべてのテイクが無音になっている場所だけです。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav
```
```
Non-silent intervals: 3
  23040 - 121344
  147968 - 246272
  282624 - 399872
```

`--write-takes PREFIX` は、各テイクを各区間で切り出して `PREFIX{take:02d}_{interval:03d}.wav`（どちらも 1 始まり）として書き出します。テイク 3 つ・区間 3 つなら 9 ファイルです。

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav \
  --write-takes cut_
```
```
Wrote 9 take files with prefix cut_
```

他より早く終わるテイクは短縮されず、パディングされます。そのため 1 つの区間のファイルはどのテイクでも同じ長さになり、そのまま比較できます。先頭のテイクとサンプルレートが異なるテイクは、リサンプルされずに名前付きで拒否されます。

```
Error: take sample rate differs: t3_44.wav is 44100 Hz, the first take is 48000 Hz
```

`-o`／`--output` は今も使用方法エラー（終了コード 2）です。このコマンドの結果は区間の一覧か切り出したテイクファイルであり、単一のレンダリング済み出力ファイルではありません。

### リアルタイムボイスプリセット

リアルタイムボイスチェンジャープリセットの参照、検証、レンダリングを行うコマンドです。

| コマンド | 説明 | オプション |
|----------|------|------------|
| `sonare voice-change vocal.wav -o out.wav` | `--preset`、`--preset-json`、`--preset-pack`、`--set` を渡した場合はリアルタイム音声プリセットチェーンでレンダリング | `--preset`、`--preset-json`、`--preset-pack`、`--set PATH=VALUE` |
| `sonare voice-presets` | リアルタイムボイスチェンジャーのプリセット ID を一覧表示 | `--json` |
| `sonare voice-preset` | 1 つのプリセット設定を JSON で出力 | `--preset`（既定: `neutral-monitor`）、`--json` |
| `sonare voice-preset-validate preset.json` | プリセット JSON ファイルまたはプリセットパックを検証・正規化 | パック検証時は `--preset`、`--set PATH=VALUE`、`--json` |

リアルタイムプリセット系のオプションを渡さない場合、`voice-change` は `--pitch-semitones` と `--formant-factor` で制御する単純なピッチ／フォルマント変換を使います。プリセット系のオプションを渡した場合はリアルタイム音声チェーンを使い、単純なピッチ／フォルマント指定との併用は無効パラメータとして拒否されます。

プリセットの選択は明示的に行います。組み込みの `--preset ID`、`--preset-json FILE`、または `--preset-pack FILE --preset ID` の組み合わせから 1 つを選びます。パックファイルとエントリ ID はセットで 1 つの指定として扱われるため、`--preset-pack` だけを渡すと拒否されます（先頭エントリへのフォールバックはありません）。`--preset-json` とパックは併用できません。`--set PATH=VALUE` を使うには、いずれかのプリセット指定が必要です。

### 合成

ネイティブ CLI では、簡単なテスト信号も生成できます。

| ネイティブコマンド | 必須または主なオプション |
|--------------------|--------------------------|
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
libsonare {{ wasmMeta.version }} (Python CLI)
```

### doctor

そのビルドで何ができるかを表示します。機能が見当たらない、ファイルがデコードできない
といったときに最初に実行するコマンドです。2 つの CLI どちらにもあり、バインディングが
`capabilities` として公開しているのと同じビルド診断レポートを出力します。

```bash
sonare doctor
sonare doctor --json
```

**出力:**
```
libsonare {{ wasmMeta.version }}
  Library:              /path/to/libsonare.so
  Platform:             linux-x86_64
  ABI:                  project=…, engine=…
  Features:             mastering=true, mixing=true, fx=true, ffmpeg=false
  Decode (built-in):    wav, mp3
  Decode (FFmpeg):      none
  SIMD:                 …
  Hardware concurrency: 8
```

`ffmpeg=false` のビルドなら M4A/AAC/FLAC/OGG のデコード失敗はそれが原因です。
`mastering`／`mixing`／`fx` は、どのコマンド群がビルドに含まれているかを示します。

## 使用例

### 基本解析ワークフロー

```bash
# クイック BPM とキーチェック
sonare bpm song.mp3
sonare key song.mp3

# スクリプト用に JSON で総合解析
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
マスタリング系のコマンドはほとんどが両方の CLI にあります。`mastering`、`eq`、`repair`、プロセッサ系とペア解析系の各コマンド、`mastering-pair-processor`、`mastering-stereo-analyze`、そして 3 つのアシスタントコマンドが該当します。

`master`、`mastering-chain`、`declip` は Python CLI のみ、`mastering-stereo-analyses` はネイティブ CLI のみです。

[ソースからビルド](/ja/docs/installation#ソースからビルド) を参照してください。
:::

```bash
# 目標ラウドネスと True Peak 上限でノーマライズし、WAV を書き出す
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

# 名前付きマスタリングプリセットを適用（デフォルトのプリセット: pop）
sonare master track.wav --preset pop -o mastered.wav

# JSON 設定から構成可能なマスタリングチェーンを実行
sonare mastering-chain track.wav --config-file chain.json -o chained.wav

# 利用可能なマスタリングプリセット名を一覧表示
sonare mastering-presets

# LPC 再構成でクリップしたオーディオを修復
sonare declip clipped.wav -o fixed.wav

# リファレンスを使ったラウドネス／トーン解析
sonare mastering-pair-analyses
sonare mastering-pair-analyze track.wav \
  --reference reference.wav \
  --analysis match.referenceLoudness \
  --json > mastering-report.json
```

ペア解析では、リファレンスがあらかじめソースと同じサンプルレートである必要があります。
食い違いは黙ってリサンプリングされるのではなくエラーになるため、書き換えられた音声どうしを
比較してしまうことがありません。先にリファレンスをリサンプリングするか（`sonare resample
reference.wav --target-sr <sr> -o reference-matched.wav`）、比較前のリサンプリングやトリムを
細かく制御したい場合は Python API を使ってください。

`/ja/mastering` ブラウザデモも同じマスタリングプロセッサ群を呼び出しています。デモから書き出したレポートを CLI 自動化の起点として活用できます。

名前付きマスタリングコマンド:

| 目的 | コマンド | 提供 |
|------|---------|------|
| 目標ラウドネス＋True Peak 上限でノーマライズ | `sonare mastering` | 両方 |
| 統合イコライザを適用 | `sonare eq` | 両方 |
| 欠陥を測定して修復 | `sonare repair` | 両方 |
| モノラル／ステレオプロセッサ一覧 | `sonare mastering-processors` | 両方 |
| 名前付きプロセッサを適用 | `sonare mastering-processor` | 両方 |
| ペアプロセッサ一覧 | `sonare mastering-pair-processors` | 両方 |
| 名前付きペアプロセッサを適用 | `sonare mastering-pair-processor` | 両方 |
| ペア解析一覧 | `sonare mastering-pair-analyses` | 両方 |
| ソース／リファレンスのペア解析 | `sonare mastering-pair-analyze` | 両方 |
| ステレオペアを解析 | `sonare mastering-stereo-analyze` | 両方 |
| マスタリングプリセット名を一覧表示 | `sonare mastering-presets` | 両方 |
| オーディオプロファイル解析（JSON を出力） | `sonare mastering-profile` | 両方 |
| アシスタントによるチェーン提案（JSON を出力） | `sonare mastering-suggest` | 両方 |
| ストリーミングプラットフォームのノーマライズプレビュー（JSON を出力） | `sonare mastering-streaming` | 両方 |
| 名前付きマスタリングプリセットを適用 | `sonare master` | Python |
| 構成可能なマスタリングチェーンを実行 | `sonare mastering-chain` | Python |
| クリップしたオーディオを修復（LPC＝線形予測符号化による再構成） | `sonare declip` | Python |
| ステレオ解析一覧 | `sonare mastering-stereo-analyses` | ネイティブ |

3 つのアシスタントコマンドはいずれもオーディオファイルを受け取り、JSON オブジェクトを標準出力に出力します。

| コマンド | 主なオプション | 出力 |
|---------|--------------|------|
| `sonare mastering-profile track.wav` | `--params key=val,...` | オーディオプロファイル JSON（ラウドネス・ダイナミクス・スペクトル特性） |
| `sonare mastering-suggest track.wav` | `--params key=val,...` | 推奨マスタリングチェーン JSON |
| `sonare mastering-streaming track.wav` | `--platforms '[...]'`, `--platforms-file f.json` | プラットフォームごとのノーマライズプレビュー JSON |

`--platforms` は `{name, targetLufs, ceilingDb}` オブジェクトの JSON 配列を受け取ります。`--params` はカンマ区切りの `key=value` 浮動小数点ペアをアシスタント呼び出しに渡します。

プリセット・チェーン・修復系のコマンドはオーディオファイルを受け取り、`-o` で WAV を書き出します。ただし `mastering-presets` は名前を一覧表示するだけです。

| コマンド | 主なオプション | 備考 |
|---------|--------------|------|
| `sonare master track.wav -o out.wav` | `--preset NAME`（デフォルト `pop`）, `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | 名前付きマスタリングプリセットを適用する。`--config`／`--config-file`／`--params` でプリセット値を上書きできる。`--report` はマスタリングレポート JSON ファイルを書き出す |
| `sonare mastering-chain track.wav -o out.wav` | `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | JSON 設定から構成可能なマスタリングチェーンを実行する |
| `sonare mastering-presets` | グローバルの `--json` フラグに対応 | 利用可能なマスタリングプリセット名を一覧表示する |
| `sonare declip clipped.wav -o out.wav` | `--clip-threshold`（0.98）, `--lpc-order`（36）, `--iterations`（2）, `--lpc-blend`（0.65） | LPC 再構成でクリップしたオーディオを修復する |

#### repair

`declip` が直すのは 1 種類の欠陥だけです。`repair` はテイクを測定し、必要な修復ステージ（declip、declick、decrackle、dehum、denoise、dereverb をこの順で）を実行します。録音の何が悪いのかまだ分かっていないときは、このコマンドから始めます。

```bash
# 測定と報告のみ。ファイルは書き出さない
sonare repair noisy.wav --detect --json

# 測定し、ステージを選び、修復し、選んだ理由も出力する
sonare repair noisy.wav -o clean.wav --explain

# 自動で選ばせず、名前付きプリセットの設定を使う
sonare repair noisy.wav --preset broadcast -o clean.wav
```

| オプション | 説明 |
|------------|------|
| `--detect` | 測定と報告のみ。処理は行わず、`-o` も不要 |
| `--preset NAME` | 自動選択の代わりに、名前付きプリセットの修復ステージを使う（名前は `sonare mastering-presets` で確認） |
| `--params` | ステージ設定の上書き。`repair.<stage>.<field>=value,...` の形式 |
| `--explain` | 各ステージを選んだ理由を出力する |
| `--bits` | 出力ビット深度。16 または 24 |

`--detect` を指定しない場合、`-o` は必須です。`--explain` は実際に行われた判断についてしか説明できないため、`--preset` や `--detect` との併用は無効パラメータとして拒否されます。

`repair` は意図的にリミッターを通しません。ディクリップはクリッパーが削ったピークを復元するので、結果はしばしばフルスケールを超えます。そこでサンプルごとにクランプするのではなく、ファイル全体に 1 つのゲインを掛けて収めます。クランプしてしまうと、復元したばかりのサンプルを元の天井へ押し戻すことになるからです。適用されたゲインは `output_gain_db` として必ず出力され、ピークがそのまま収まっていた場合は `0` になります。

関連するマスタリングガイド: [配信ターゲット](./glossary/mastering/delivery-targets.md)、[メーターの読み方](./glossary/mastering/meter-reading.md)、[エラー復旧](./glossary/mastering/error-recovery.md)。

RT60、EDT、C50、C80、D50、体積、寸法、吸音率バンド、DRR、RIR 合成時のエラー状態、信頼度などのルーム音響フィールドは [ルーム音響解析](./acoustic-analysis.md) で説明しています。

### ミキシングワークフロー

::: info コマンドの提供範囲
JSON ファイルまたは組み込みプリセットからミキサーシーンを読み込み、必要ならストリップごとの入力 WAV をレンダリングする `mix` は、Python CLI のみです。

`mixing-presets`、`mixing-preset`、`suggest-mix`、`mix-strip` は両方の CLI にあります。シーン一覧の確認、WASM／Python／Node／C++ のミキサー API に読み込ませるシーン JSON の出力、複数トラックからのシーン提案、単一入力チャンネルストリップの実行に使えます。
:::

```bash
# 組み込みミキサーシーンプリセットを一覧表示
sonare mixing-presets

# 1 つのプリセットのシーンを JSON で出力
# （--preset は vocalReverbSend, drumBusSubgroup, commentaryDucking のいずれか。
#   省略時は vocalReverbSend）
sonare mixing-preset --preset vocalReverbSend > scene.json

# 組み込みシーンプリセットを読み込み、ストリップ入力をステレオ WAV にレンダリング
sonare mix \
  --preset vocalReverbSend \
  --input vocal.wav \
  --input music.wav \
  --sample-rate 48000 \
  -o mixed.wav

# または JSON からシーンを読み込む（例: `mixing-preset` で出力したもの）
sonare mix --scene scene.json --input vocal.wav --input music.wav -o mixed.wav
```

`--scene` と `--preset` は排他かつ必須のペアで、どちらか一方を必ず指定します。両方渡すと使用方法エラーになり、どちらも省略した場合も既定のシーンにフォールバックせず終了コード 2 になります。

`--input` は `[ID=]WAV` の形式で、繰り返し指定できます。`ID=` を付けるとそのストリップに割り当てられ、パスだけを渡した場合はファイルのベース名が ID になります。どのエントリからも名前を指定されなかったストリップは、削除されるのではなく無音が供給されます。アシスタントが提案したシーンのようにエフェクトリターンをセンドで受けるストリップがあっても、リターンごとに無音 WAV を用意せずレンダリングできるのはこのためです。ストリップ名を一切指定しない書き方をした場合は位置指定として扱われ、シーン順に 1 つずつ割り当てられます。この 2 つの書き方を 1 回の実行で混ぜることはできません。長さが足りない入力は、最も長いものに合わせてパディングされます（短い方に切り詰められることはありません）。

`--input` と `-o/--output` はセットで、どちらか片方だけは指定できません。どちらも省略した場合、`mix` はシーンを読み込んでストリップ数を報告するだけです。

#### suggest-mix

`suggest-mix` は逆方向のコマンドです。個々のトラックを渡すとミキサーシーンを提案し、それを `mix --scene` でレンダリングできます。

```bash
sonare suggest-mix \
  --input vocal=vocal.wav \
  --input drums=drums.wav \
  --tempo-bpm auto \
  --scene-out scene.json
```

| オプション | デフォルト | 説明 |
|------------|------------|------|
| `--input [ID=]WAV` | — | トラックごとに 1 つ、繰り返し可。ステレオファイルは 2 チャンネルのまま読み込まれ、アシスタントが音像を読み取れる。3 チャンネル以上はダウンミックスされる。いずれも `--sample-rate` へリサンプリングする。`ID` の既定はファイルのベース名 |
| `--sample-rate` | 48000 | 解析に使う共通サンプルレート |
| `--tempo-bpm BPM\|auto` | — | 提案するディレイタイムの基準テンポ。`auto` は最初の `--input` から検出する。省略するとトランスポートの既定テンポを使う |
| `--params k=v,...` | — | アシスタントのパラメータ上書き |
| `--scene-out FILE` | — | 提案されたシーンだけを、`mix --scene` が読める形式で書き出す |

提案の全体は JSON として標準出力に出力されます。`mix` に渡すのは `--scene-out` で書き出したファイルです。

#### チャンネルストリップ

単一入力のチャンネルストリップは役割の異なる別コマンドで、名前は `mix-strip` です。両方のフロントエンドが持っており、オプションの組み合わせにかかわらずバイト単位で同一の出力を書きます。

```bash
sonare-cli mix-strip vocal.wav -o strip.wav \
  --input-trim-db -2 --fader-db 1.5 --pan 0.2 --pan-mode balance --width 1.4
```

| オプション | デフォルト | 説明 |
|------------|------------|------|
| `--input-trim-db` | 0.0 | ストリップ手前で適用するゲイン |
| `--fader-db` | 0.0 | フェーダーのゲイン |
| `--pan` | 0.0 | パン位置。-1 〜 1 |
| `--pan-mode` | balance | `balance`、`stereo-pan`、`dual-pan`（大文字小文字は区別しない） |
| `--width` | 1.0 | ステレオ幅。0 でモノラルに収束し、1 より大きくすると広がる |

ストリップは真のステレオで読み書きするため、ステレオ素材は音像を保ったまま処理されます。モノラル素材に対して `--width` は作用する対象がないので、1.0 以外を指定すると黙って無視されるのではなくエラーになります。

::: warning `sonare-cli mix` はもうありません
ネイティブ CLI に `mix` コマンドは存在しません。ストリップコマンドの名前は `mix-strip` だけなので、`sonare-cli mix` を呼ぶスクリプトはオプションの誤りではなく、未知のコマンドとして失敗します。コマンド名を書き換えてください。オプションはそのまま使えます。

同じ綴りが 2 つの異なるものを指していたため、この名前はなくなりました。ネイティブ側ではチャンネルストリップ、Python CLI 側ではシーンミキサーです。Python CLI の `sonare mix` は今もシーンミキサーで、こちらは変わりません。
:::

関連: [ミキシングエンジン](./mixing.md)。

### プロジェクト＆ MIDI ワークフロー

`sonare project` コマンドグループは、JSON プロジェクトファイルを使ったヘッドレスのプロジェクト処理や、Standard MIDI File（SMF）／MIDI 2.0 のワークフローを実行します。`project bounce --synth` はクリップ音声の代わりに、プロジェクトの MIDI トラックを内蔵シンセサイザー（NativeSynth）でレンダリングします。このフラグは 2 通りの使い方があります。

- **値なしの `--synth`** — プロジェクトのチャンネルごとの General MIDI プログラムチェンジに追従し、チャンネル 10 は GM ドラムキットマップへルーティングします。プロジェクトが実際の GM プログラムを持っている場合はこちらを使います。
- **`--synth <preset>`** — すべての送出先（デスティネーション）を 1 つの NativeSynth プリセットに固定します。名前の一覧は `sonare project synth-presets` で確認できます。

`project bounce` は `--channels` で指定したチャンネル数で書き出します。

```bash
# プロジェクトの ABI バージョンを表示
sonare project abi

# 指定サンプルレートで空のプロジェクト JSON を作成
sonare project new --sample-rate 48000 -o project.json

# プロジェクト JSON を検証（診断を表示。-o を付けると正規化 JSON も書き出す）
sonare project validate --in project.json
sonare project validate --in project.json -o canonical.json

# 修復診断が 1 件でも出たら失敗扱いにする（CI 向け）
sonare project validate --in project.json --strict

# プロジェクト JSON をコンパイルチェック（診断を表示。エラー時は非ゼロで終了。ファイルは書き出さない）
sonare project compile --in project.json

# --synth が受け付ける NativeSynth プリセットを一覧表示
sonare project synth-presets

# 指定したチャンネル数で WAV にレンダリング
sonare project bounce --in project.json --sample-rate 48000 --channels 2 -o bounce.wav

# MIDI トラックを内蔵シンセサイザーでレンダリング（GM プログラムに追従）
sonare project bounce --in project.json --synth -o gm-bounce.wav

# あるいはすべてのデスティネーションを 1 つのプリセットに固定
sonare project bounce --in project.json --synth saw-lead -o synth-bounce.wav
```

| コマンド | 説明 | 主なオプション |
|----------|------|----------------|
| `sonare project abi` | プロジェクトの ABI バージョンを表示 | — |
| `sonare project new` | 空のプロジェクト JSON を作成 | `--sample-rate`, `-o` |
| `sonare project validate` | プロジェクト JSON を検証。正規化 JSON の書き出しも可 | `--in`, `-o`, `--strict`（診断が 1 件でもあれば失敗） |
| `sonare project compile` | プロジェクト JSON をコンパイルチェック。診断を表示し、エラー時は非ゼロで終了（ファイルは書き出さない） | `--in`, `--json` |
| `sonare project synth-presets` | `--synth` が受け付ける NativeSynth プリセット名を一覧表示 | `--json` |
| `sonare project bounce` | 指定チャンネル数で WAV にレンダリング | `--in`, `--sample-rate`, `--frames`, `--block-size`, `--channels`, `--instrument-latency`, `--synth`, `--audio`, `--resolve-audio`, `-o` |
| `sonare project export-smf` | プロジェクトを Standard MIDI File に書き出し | `--in`, `-o` |
| `sonare project import-smf` | Standard MIDI File からプロジェクトを構築 | `--smf`, `-o` |
| `sonare project export-midi2` | プロジェクトを MIDI 2.0 Clip File に書き出し | `--in`, `-o` |
| `sonare project import-midi2` | MIDI 2.0 Clip File からプロジェクトを構築 | `--midi2`, `-o` |

プロジェクトドキュメントは、オーディオクリップのソースを URI 参照としてしか保持しません。デコード済みの PCM は持たないため、オーディオクリップを含むドキュメントは、ソースをバインドするまで無音のままレンダリングされます。`project bounce` にはバインドする方法が 2 つあります。`--audio SOURCE_ID=WAV` は 1 回につき 1 つのソースをバインドし、ソースごとに繰り返し指定します。`--resolve-audio` は代わりに、ドキュメント自身が持つ未解決ソースの `file://` URI を開きます。それ以外のスキームは名前を挙げて拒否します。両方を適用してもまだ未解決のソースがあれば、その id と URI、それを解決できたはずのオプション名とともに報告されます。どちらのフロントエンドも両方のオプションを受け付けます。

```bash
# 2 つのオーディオソースを id でバインドしてからレンダリング
sonare project bounce --in project.json \
  --audio 1=vocal-take.wav --audio 2=harmony-take.wav \
  -o bounce.wav

# または、各ソースを個別に指定せず、ドキュメント自身の file:// URI を解決する
sonare project bounce --in project.json --resolve-audio -o bounce.wav
```

```bash
# プロジェクトを Standard MIDI File 形式でラウンドトリップ
sonare project export-smf --in project.json -o project.mid
sonare project import-smf --smf project.mid -o roundtrip.json

# MIDI 2.0 Clip File 形式でラウンドトリップ
sonare project export-midi2 --in project.json -o project.midi2
sonare project import-midi2 --midi2 project.midi2 -o roundtrip2.json

# プロジェクトの MIDI トラックを内蔵シンセサイザーでレンダリング
sonare project bounce --in project.json --synth --sample-rate 48000 -o render.wav
```

どちらの CLI にも `midi-render` があります。これは常にシンセ経路を使う `project bounce` の別名で、`--synth` を省略すると GM プログラムに追従します。オプションの詳細は、このセクション前半の `sonare project` の表を参照してください。

#### transcribe

`transcribe` は逆方向のコマンドで、音声を受け取って Standard MIDI File を書き出します。どちらの CLI にもあります。

```bash
sonare transcribe solo.wav -o solo.mid
sonare transcribe chords.wav -o chords.mid --polyphonic --tempo-bpm 120
```

| オプション | 説明 |
|------------|------|
| `--tempo-bpm` | PPQ グリッドの基準テンポ。省略するとテイクから検出する |
| `--polyphonic` | 重なり合うノートを検出するマルチ F0 経路を使う |
| `--reference-hz` | MIDI ノート番号の基準となるチューニング周波数（既定 440） |
| `--fmin`, `--fmax` | モノフォニック追跡が探す音高範囲（Hz。既定は 65 と 2093） |
| `--min-note-ms` | ノートとして残す最短の長さ（ms。既定 30） |
| `--segmentation-threshold-cents` | 1 つのノートを終わらせて次を始める音高変化量（既定 50） |
| `--velocity-floor-db` | ベロシティ 1 に対応するレベル。負の値である必要がある（既定 -48） |
| `--fixed-velocity N` | すべてのノートをベロシティ N（1〜127）にし、レベル測定を省く |
| `--group`, `--channel` | イベントを出力する UMP グループと MIDI チャンネル（既定 0） |

検出したノートはプロジェクトのテンポマップ上に置かれるため、`--tempo-bpm` を明示した場合はトランスクライバへ渡されるのではなく、そのテンポマップとして設定されます。`-o` は必須です。

SoundFont（SF2）とデスティネーションごとのシンセ JSON はこれらの CLI コマンドには接続されていません。SoundFont を使ったバウンスには Project API を使ってください。

関連: [プロジェクト編集](./project-editing.md)、[プロジェクトバウンス](./project-bounce.md)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)。

## ステレオとモノラルの扱い

CLI のコマンドの多くは、性質上モノラルです。実行する解析や報告するメーターが 1 チャンネルで定義されているためです。そうしたコマンドでは、どちらのフロントエンドもマルチチャンネル入力をモノラルへダウンミックスして読み込み、そのとき同じ警告を標準エラー出力に表示します。ステレオファイルが黙ってチャンネルを失うことはありません。

ダウンミックスすると結果が悪くなるコマンドは、ステレオのまま扱います。

| コマンド | ステレオ入力の扱い |
|----------|--------------------|
| `mastering` | ステレオのままマスタリングし、音像を最後まで保つ |
| `mastering-processor` | `--stereo` フラグは無く、2 チャンネル入力は自身でステレオ経路をたどる。モノラル形式を持たないプロセッサは、入力にかかわらずステレオ経路をたどる。両チャンネルを処理し、両方を書き出す |
| `mix`（Python）, `mix-strip` | ステレオのまま処理する。モノラルファイルは左右両方へ、ステレオファイルは自身の 2 チャンネルをそのまま使う |
| `suggest-mix` | 各 `--input` は、ステレオファイルをダウンミックスせずペアのまま保持する。アシスタントの中で両チャンネルを測定するのは音像解析だけだから |
| `normalize`, `master`, `mastering-chain`, `declip`（Python CLI） | ステレオのまま扱い、ゲインは両チャンネルをまたいで 1 つだけ求める。音像が中央へ寄らない |
| 上記以外 | モノラルへダウンミックスし、警告を表示する |

3 チャンネル以上の素材は常にダウンミックスされます。オフライン処理にはモノラル版とステレオ版しかなく、それより広いものがないためです。サラウンドファイルのチャンネル 0 だけを残して「元の音」と称するよりは、ダウンミックスしたと明示する方が正確です。

CLI にないチャンネル保持処理が必要な場合は、[Python API](./python-api.md) や [JavaScript API](./js-api.md) のステレオ向けエントリポイントを使ってください。

## 対応オーディオ形式

| 形式 | 拡張子 | 備考 |
|--------|-----------|-------|
| WAV | `.wav` | 非圧縮 PCM |
| MP3 | `.mp3` | minimp3 でデコード |
| M4A / AAC / FLAC / OGG / Opus | 形式により異なる | FFmpeg 有効ビルドのみ対応 |

現在のビルドが FFmpeg デコードに対応しているかは、Python から `libsonare.has_ffmpeg_support()` で確認できます。

## 終了コード

Python CLI とネイティブ CLI は、C ABI のエラー分類に揃えた次のプロセス終了コード対応表を共通で使います。

| コード | 説明 |
|------|-------------|
| 0 | 成功 |
| 2 | 使用方法エラー（不正な引数） |
| 3 | 無効なパラメータ |
| 4 | ファイル未検出 |
| 5 | 無効なフォーマット |
| 6 | デコード失敗 |
| 7 | メモリ不足 |
| 8 | 非対応 |
| 9 | 無効な状態 |
| 10 | その他のエラー |
| 11 | キャンセル |
| 12 | エンコード失敗 |

使用方法／解析エラーは終了コード 2、意味上の無効パラメータは 3、キャンセルは 11 です。終了コード 12 は出力ファイルを作る全段階をカバーするため、最も多い原因は書き込めない `-o` のパス（とくにディレクトリを指している場合）です。どちらの CLI でも `SONARE_LEGACY_EXIT=1` を設定すると、「失敗はすべて `1`」という旧来の挙動に戻せます（終了コード 1 を前提に書かれたスクリプト向け）。

特定のコードで分岐する前に、次の 2 点を押さえておいてください。

- **5 と 6 は 1 つのカテゴリとして扱う。** デコードできない入力に対してどちらが返るかは、ファイルではなくビルドが FFmpeg を含むかどうかで決まります。FFmpeg なしのビルドが 5 を返す場面で、FFmpeg ありのビルドは 6 を返します。壊れたプロジェクト JSON やプリセット文書は常に 5 です。
- **Python CLI では、コマンドラインの誤りが 2 ではなく 3 になることがある。** 終了コード 2 は argparse のもので、パーサーが拒否した範囲をカバーします。ハンドラー側で捕捉される誤り（`--input` のない `mix --output`、因子分解が知らない `--init` など）は素の `ValueError` として扱われ、コマンドラインの書き間違いであっても終了コード 3 になります。そもそも目の前のビルドにそのコマンドが含まれているか怪しいときは `sonare doctor` を実行してください。

## パフォーマンスのヒント

1. **大きなファイル**: 10 分を超えるファイルは、先に一部を切り出してから解析することを検討してください。
   ```bash
   # 最初の 60 秒のみ解析（ffmpeg を使用）
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT サイズ**: 小さい FFT サイズ（`--n-fft 1024`）は高速ですが、周波数解像度が下がります。

3. **ホップ長**: 大きいホップ長（`--hop-length 1024`）は高速ですが、時間解像度が下がります。
