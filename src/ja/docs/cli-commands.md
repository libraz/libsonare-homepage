---
title: CLI コマンド
description: sonare CLI のコマンド単位リファレンス。解析、特徴、その他のコマンド群と、それぞれのオプションと出力をまとめます。
---

# CLI コマンド

`sonare` CLI のコマンド単位リファレンスです。各コマンドの役割、オプションと既定値、出力を説明します。グローバルオプション、終了コード、ステレオの扱い、どちらの CLI にどのコマンドがあるかは [CLI リファレンス](./cli.md) にあります。シェルでの通しの手順は [CLI 使用例](./cli-examples.md) にあります。

## 目的別のコマンド

| やりたいこと | コマンド | 参照先 |
|--------------|----------|--------|
| テンポ、キー、全体の要約を得る | `analyze`、`bpm`、`key`、`beats` | [解析コマンド](#解析コマンド) |
| 曲のセクションを見つける | `sections`、`boundaries` | [sections](#sections)、[boundaries](#boundaries) |
| コード進行を読む | `chords` | [chords](#chords) |
| ラウドネスを測る | `lufs`、`dynamics`、`meter`（ネイティブ CLI のみ） | [その他の解析](#その他の解析) |
| スペクトル特徴を要約する | `mel`、`chroma`、`spectral` | [特徴量コマンド](#特徴量コマンド) |
| メロディを追う、歌のノートを一覧する | `pitch`、`vocal-notes` | [pitch](#pitch)、[スケール補正とボーカルのノート一覧](./cli-examples.md#スケール補正とボーカルのノート一覧) |
| ミックスを分ける | `hpss`、`decompose-stems` | [hpss](#hpss)、[decompose-stems](#decompose-stems) |
| 音声を MIDI ファイルにする | `transcribe` | [CLI 使用例](./cli-examples.md#transcribe) |
| 傷んだ録音を直す | `repair`、`declip` | [repair](./cli.md#repair) |
| 納品用にマスタリングする | `mastering`、`master`、`eq` | [マスタリングとリペア](./cli.md#マスタリングとリペア) |
| ファイルのピッチ、テンポ、レベルを変える | `pitch-shift`、`time-stretch`、`normalize`、`trim-silence` | [編集](#編集) |
| テイクを無音で切る | `split-silence` | [split-silence](#split-silence) |
| 部屋を推定・シミュレートする | `acoustic`、`estimate-room`、`synthesize-rir`、`room-morph` | [ルームコマンド](#acoustic-と-estimate-room) |
| ステムをシーンにミックスする | `suggest-mix`、`mix`、`mix-strip` | [ミキシングワークフロー](./cli-examples.md#ミキシングワークフロー) |
| プロジェクトや MIDI を内蔵シンセでレンダリングする | `project bounce`、`midi-render` | [合成](./cli-examples.md#合成) |
| 映画音声をスピーカーやヘッドホン向けにレンダリングする | `playback` | [再生レンダラー](./playback.md#どの言語でも同じ流れ) |
| 数値や変換を確かめる | `power-to-db`、`frames-to-samples` など | [CLI ユーティリティ](./cli-utilities.md) |

## 解析コマンド

### analyze

BPM、キー、拍子、ビートを含む音楽解析。

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

| オプション | 既定値 | 説明 |
|--------|---------|-------------|
| `--with-seventh` | 無効 | トライアドだけでなく、コードテンプレート全体を探索する |
| `--no-hpss` | 無効 | 倍音／打撃成分分離を無効化する |
| `--chroma-highpass` | 80.0 | クロマ解析用のハイパスカットオフ周波数（Hz） |
| `--meter-candidates` | `3,4,6` | 探索する拍子の分子。カンマ区切り |
| `--meter-denominator` | 4 | 検出した拍子を報告するときの音符単位 |

`--with-seventh` を指定しない場合、コード認識はメジャー・マイナー・ディミニッシュ・オーギュメントのトライアドだけを照合します。指定すると、ルートごとに 24 種類のコードクオリティすべてが対象になります。セブンスやナインスに加えて、シックスス、`7sus4`、イレブンス、サーティーンス、オルタードドミナントが含まれます。

拍子の探索は、指定された分子しか報告しません。既定の候補は `3,4,6` なので、5/4 や 7/8、11/8 の曲もこの 3 つのいずれかとして返ってきます。`--meter-candidates 3,4,5,7` のように候補を広げて初めて検出できます。候補リストは 1〜16 個で、各値は 2〜32 の範囲です。`--meter-denominator` は結果を報告するときの音符単位を決めるだけで、探索そのものには影響しません。2 つの数字の意味は [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) で説明しています。

**出力:**
```
  > Estimated BPM : 120.50 BPM  (conf 95.0%)
  > Estimated Key : C major  (conf 85.0%)
  > Time Signature: 4/4
  > Beats: 240
```

`--json` を付けると、`analyze` は上の結果に音色、ダイナミクス、リズム、形式を加えた 1 つのオブジェクトを出力します。各フィールドは [analyze の JSON](./cli-examples.md#analyze-の-json) で説明しています。

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

### sections

曲をセクション（イントロ、Aメロ、サビなど）に分け、全体の形式を報告します。ラベルの意味は [セクションと構成](./glossary/analysis/section-structure.md) を参照してください。

```bash
sonare sections music.mp3
sonare sections music.mp3 --json
```

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--min-duration` | 4.0 | 残す最短のセクション長（秒） |
| `--threshold` | 0.3 | ネイティブ CLI のみ。境界検出のしきい値 |
| `--n-fft`, `--hop-length` | 2048, 512 | 解析のフレーミング |

**JSON 出力:**
```json
{"form": "?", "count": 1, "sections": [{"type": "unknown", "start": 0, "end": 6, "energy": 1, "confidence": 0}]}
```

`form` は全体の構成を表す文字列で、繰り返し構造が見つからなかった場合は `?` になります。`count` は `sections` の要素数で、各要素は `type`、秒単位の `start` と `end`、`energy`、`confidence` を持ちます。

## 特徴量コマンド

### mel

メルスペクトログラムを計算し、その次元を表示。

```bash
sonare mel music.mp3
sonare mel music.mp3 --n-mels 80
sonare mel music.mp3 --fmin 40 --fmax 16000 --htk
```

| オプション | 既定値 | 説明 |
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

| オプション | 既定値 | 説明 |
|--------|---------|-------------|
| `--algorithm` | pyin | ピッチアルゴリズム: "yin" または "pyin" |
| `--threshold` | 0.1 | YIN のしきい値（0 より大きく 1 以下） |
| `--fmin` | 65.0 | 追跡する最低周波数（Hz） |
| `--fmax` | 2093.0 | 追跡する最高周波数（Hz） |
| `--hop-length` | 512 | ホップ長（サンプル数）。グローバルの `--hop-length` とは別に、範囲チェック付きでこのコマンド用に再定義されています |
| `--frames` | なし | `--json` と併用すると、要約にフレームごとの `times`・`f0`・`voiced_flag`・`voiced_prob` の配列を加えます |

**出力:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

HPSS（Harmonic / Percussive Source Separation、[音源分離](./source-separation.md) を参照）。倍音成分（ボーカル／メロディ）と打撃成分（ドラム）を分離します。

```bash
sonare hpss music.mp3 -o separated
sonare hpss music.mp3 -o separated --json
```

| オプション | 既定値 | 説明 |
|--------|---------|-------------|
| `--kernel-harmonic <int>` | 31 | 倍音成分側のメディアンフィルターカーネルサイズ |
| `--kernel-percussive <int>` | 31 | 打撃成分側のメディアンフィルターカーネルサイズ |
| `--harmonic-only` | 無効 | 倍音成分のみを書き出す |
| `--percussive-only` | 無効 | 打撃成分のみを書き出す |
| `--with-residual` | 無効 | 残差成分も分離して書き出す |
| `--hard-mask` | 無効 | 既定のソフトマスクの代わりにハードマスクを使う |

`--harmonic-only`、`--percussive-only`、`--with-residual` は同時に指定できません。

**出力:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
  Wrote: separated_harmonic.wav, separated_percussive.wav
```

`--json` では、各成分のレベルは `harmonic_mean_abs` と `percussive_mean_abs`（`--with-residual` のときは `residual_mean_abs` も）で、いずれもその成分のサンプル絶対値の平均です。

### decompose-stems

ミックスを非負値行列因子分解（NMF）の成分に分けます（[音源分離](./source-separation.md) を参照）。`hpss` のように倍音／打撃という固定の分け方をするのではなく、繰り返し現れるスペクトルパターンをデータから見つけて分離します。

```bash
sonare decompose-stems band.wav -o stems.wav
sonare decompose-stems band.wav -o stems.wav --n-components 6 --init nndsvd --json
```

| オプション | 既定値 | 説明 |
|--------|---------|-------------|
| `--n-components <int>` | 4 | 分解する成分の数 |
| `--n-iter <int>` | 100 | NMF の更新反復回数 |
| `--beta` | 2.0 | ベータダイバージェンス。2 は Frobenius、1 は Kullback-Leibler |
| `--init` | random | NMF の初期化方法。`random` または `nndsvd` |
| `--mask-power` | 1.0 | ソフトマスクの指数（1 以上）。2 は Wiener 型のパワー比になる |

`-o` は 1 つのファイルではなく、ファイル群の名前として扱われます。どちらの CLI も `<base>_component1.wav` 〜 `<base>_componentN.wav` を書き出し、渡したパス末尾の `.wav` は取り除かれます。各成分は元音声の位相を保つため、すべて足し合わせると入力に戻り、成分単体でもそのまま聴けます。ここがライブラリの `decompose` との違いです。`decompose` は振幅スペクトログラムの因子を返すだけなので、音として聴くには位相推定が必要になります。

**出力:**
```
  Stems: 4 components
     1. energy 0.031200  stems_component1.wav
     2. energy 0.018400  stems_component2.wav
     3. energy 0.009100  stems_component3.wav
     4. energy 0.004700  stems_component4.wav
```

## その他のコマンド

上記のコア以外にも、両方の CLI に多くのサブコマンドがあります。「ネイティブ CLI のみ」と書かれたものは `sonare-cli` が必要です。音声ファイルを解析・特徴量抽出するコマンドは、共通オプション（`--json`、`--n-fft` など）とファイル引数を取ります。一覧表示やプリセット参照のコマンドは、より小さい専用のオプションセットを持ちます。編集系コマンドは `-o/--output` を渡すと WAV を書き出します。

### その他の解析

::: info ルーム音響コマンドの用語
**等価ルーム** は、音声から推定した実用上の部屋モデルで、正確な実寸ではありません。**RIR** は room impulse response（部屋のインパルス応答）の略です。**ルームモーフィング**は音作り向けのルーム効果であり、残響除去ではありません。

これらのコマンドが返す指標は、残響の減衰と明瞭度を表す値です。**RT60** は残響時間、**EDT** は初期減衰時間、**C50**／**C80** は明瞭度の比、**DRR** は直接音と残響音の比です。各フィールドの定義は [ルーム音響解析](./acoustic-analysis.md) にあります。
:::

| コマンド | 説明 | 主なオプション |
|----------|------|----------------|
| `sonare downbeats music.mp3` | ダウンビート時刻（秒） | — |
| `sonare chords music.mp3` | コード進行 | [chords](#chords) を参照 |
| `sonare rhythm music.mp3` | リズム特性（シンコペーション、グルーヴ、規則性） | `--start-bpm`（120.0）, `--bpm-min`（60.0）, `--bpm-max`（200.0） |
| `sonare dynamics music.mp3` | ダイナミクス／ラウドネスの要約 | `--window-sec`（0.4） |
| `sonare timbre music.mp3` | 音色／スペクトル形状の要約 | — |
| `sonare lufs music.mp3` | EBU R128 ラウドネス。単位は LUFS（Loudness Units relative to Full Scale。聴感上の音量を表す標準単位。[配信ターゲット](./glossary/mastering/delivery-targets.md) を参照） | `--series`（momentary／short-term の系列も出力） |
| `sonare acoustic room.wav` | ルーム音響推定（RT60／EDT／C50／C80） | [acoustic と estimate-room](#acoustic-と-estimate-room) を参照 |
| `sonare estimate-room room.wav` | 等価ルーム推定（体積、寸法、吸音率、DRR、信頼度） | [acoustic と estimate-room](#acoustic-と-estimate-room) を参照 |
| `sonare synthesize-rir --length 7 --width 5 --height 3 -o rir.wav` | シューボックス形状からモノラル RIR を合成 | [synthesize-rir と room-morph](#synthesize-rir-と-room-morph) を参照 |
| `sonare room-morph dry.wav --length 12 --width 9 --height 4 -o wet.wav` | 目標ルームへ寄せる音作り向けのルームモーフィング | [synthesize-rir と room-morph](#synthesize-rir-と-room-morph) を参照 |
| `sonare boundaries music.mp3` | 構造の転換点と、それを拾い出した元のノヴェルティ曲線 | ネイティブ CLI のみ。[boundaries](#boundaries) を参照 |
| `sonare melody music.mp3` | メロディ輪郭の要約。メロディの有無、音域（オクターブ）、平均周波数、ピッチの安定度、ビブラート速度、ピッチ点の数 | ネイティブ CLI のみ。`--threshold`（0.1）, `--hop-length`（512）, `--fmin`（80.0）, `--fmax`（1000.0） |
| `sonare meter music.wav` | ピーク、RMS、クレスト、True Peak、クリッピング率、無音率、DC オフセット | ネイティブ CLI のみ。`--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | クリップしたサンプルと区間を検出 | ネイティブ CLI のみ。`--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | percentile RMS ベースのダイナミックレンジ | ネイティブ CLI のみ。`--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | 左右ファイルからステレオ相関と幅を測定 | ネイティブ CLI のみ |
| `sonare phase left.wav --reference right.wav` | 左右ファイルからフェーズスコープ要約を測定 | ネイティブ CLI のみ |

#### chords

コード進行を、時刻付きのコード記号として出力します。既定値はポップスやロックの多くの素材に合います。進行が隣り合うコードの間でちらつくときは、HMM とキーコンテキストのオプションを使ってください。

```bash
sonare chords music.mp3 --json
sonare chords music.mp3 --use-hmm --key-context --key-root C --key-mode major
```

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--min-duration` | 0.3 | 残す最短のコード長（秒） |
| `--smoothing-window` | 2.0 | クロマの平滑化窓（秒。0 より大きい値） |
| `--threshold` | 0.5 | コード検出の信頼度しきい値 |
| `--triads-only` | 無効 | 出力をトライアドのクオリティに限定する |
| `--nnls` | 無効 | STFT クロマの代わりに NNLS クロマを使う |
| `--no-beat-sync` | 無効 | ビート同期のクロマプーリングを無効にする |
| `--use-hmm` | 無効 | コード列を隠れマルコフモデルでデコードする |
| `--hmm-beam-width` | 24 | HMM デコーダーのビーム幅。`0` なら全探索 |
| `--key-context` | 無効 | キーコンテキストで検出を補正する |
| `--key-root` | C | `--key-context` のルート（たとえば `F#`） |
| `--key-mode` | major | `--key-context` のモード（たとえば `minor`） |
| `--detect-inversions` | 無効 | 転回形（ベース音）を報告する |

#### boundaries

ネイティブ CLI のみ。`boundaries` は構造境界の検出器をそのまま公開しているので、拾い出した境界に加えて、元になったノヴェルティ曲線も出力します。

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--threshold` | 0.3 | 相対しきい値。`--reference-window` 内で最大のノヴェルティイベントに対する割合 |
| `--absolute-threshold` | 0.005 | ノヴェルティの絶対下限 |
| `--kernel-size` | 64 | ノヴェルティカーネルのフレーム数 |
| `--n-mfcc` | 13 | 特徴ストリームの MFCC 係数の数 |
| `--n-chroma` | 12 | 特徴ストリームのクロマビンの数 |
| `--peak-distance` | 2.0 | 境界どうしの最小間隔（秒） |
| `--reference-window` | 60 | 相対しきい値の片側の幅（秒）。`0` で相対しきい値を無効化 |
| `--no-mfcc`, `--no-chroma` | 無効 | 特徴ストリームを 1 つ落とす |
| `--n-fft`, `--hop-length` | 2048, 512 | 解析のフレーミング |

2 つのしきい値は役割が違います。`--threshold` は相対値なので、「そもそも変化があったのか」を問えません。それを問えるのが下限の `--absolute-threshold` です。両者の関係と、下限を下げても何が拾えて何が拾えないかは [`detectBoundaries(request)`](./js-api-analysis.md#detectboundaries-request) で説明しています。`--no-mfcc` と `--no-chroma` の同時指定は拒否されます。2 つのストリームはフレーム単位で結合されるため、どちらも無効では結合する対象がなくなるからです。

#### acoustic と estimate-room

`acoustic` は録音から減衰と明瞭度を測ります。`estimate-room` はさらに進んで、等価ルームを推定します。

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--ir` | 無効 | `acoustic`: 入力をインパルス応答として扱う |
| `--n-bands` | 6 | `acoustic`: 報告するオクターブバンドの数 |
| `--min-decay-db` | 30.0 | `acoustic`: 最小の減衰量（dB） |
| `--noise-floor-margin-db` | 10.0 | `acoustic`: ノイズフロアに対する余裕（dB） |
| `--aspect-lw` | 1.0 | `estimate-room`: 長さ対幅の事前値 |
| `--aspect-lh` | 1.0 | `estimate-room`: 長さ対高さの事前値 |
| `--reference-absorption` | 0.15 | `estimate-room`: 吸音率の事前値 |
| `--sabine` | 無効 | `estimate-room`: 既定の Eyring モデルの代わりに Sabine モデルを使う |
| `--n-octave-bands`（別名 `--n-bands`） | ライブラリ既定 | `estimate-room`: アナライザーのオクターブバンド数。`0` はライブラリ既定 |

#### synthesize-rir と room-morph

`synthesize-rir` はシューボックス形状からモノラルの部屋のインパルス応答を作ります。`room-morph` は、ドライな録音を目標ルームへ寄せる音作り向けの効果です。どちらも同じルームオプションを取ります。

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--length`, `--width`, `--height` | 7.0, 5.0, 3.0 | 部屋の寸法（m） |
| `--absorption` | 0.2 | 壁全体で一様な吸音率（0〜1） |
| `--source-x`, `--source-y`, `--source-z` | 1.0, 1.0, 1.2 | 音源の位置（m） |
| `--listener-x`, `--listener-y`, `--listener-z` | 5.0, 4.0, 1.7 | リスナーの位置（m） |
| `--ism-order` | 3 | 虚像法の反射次数 |
| `--seed` | 1 | 後部残響のシード。同じ値なら毎回同じ結果になる |
| `--max-seconds` | 0 | RIR または残響の長さの上限（秒）。`0` は自然な長さ |
| `--sabine` | 無効 | 既定の Eyring モデルの代わりに Sabine の後部残響モデルを使う |
| `--sample-rate` | 48000 | `synthesize-rir` のみ。出力サンプルレート |
| `--wet` | 0.5 | `room-morph` のみ。目標ルームのミックス量（0〜1） |
| `--suppression` | 0.5 | `room-morph` のみ。元の部屋の残響をどれだけ抑えるか（0〜1） |
| `--receiver-spacing` | 0.5 | `room-morph` のみ。2 つのレシーバーの間隔（m。0 より大きく 4 まで）。2 チャンネルファイルで使われ、ステレオペアとしてモーフィングしてステレオファイルで書き出す |

### その他の特徴量

| コマンド | Python CLI | ネイティブ CLI | 説明 |
|----------|------------|------------------------|------|
| `sonare onset-envelope music.mp3` | 対応 | 対応 | オンセット強度の包絡線（音の立ち上がりの強さの時間変化）。ネイティブ CLI の `--json` は `values` 配列全体と mean/std/min/max を返す |
| `sonare onset-env music.mp3` | 非対応 | 対応 | 同じ包絡線の要約のみ。フレーム数・ピーク時刻・ピーク強度・平均で、配列は返さない |
| `sonare tempogram music.mp3` | 対応 | 対応 | 自己相関テンポグラム |
| `sonare plp music.mp3` | 対応 | 対応 | 主要局所パルス |
| `sonare nnls-chroma music.mp3` | 対応 | 対応 | NNLS クロマグラム |
| `sonare cqt music.mp3` | 非対応 | 対応 | Constant-Q 変換のサマリー。`--n-bins`, `--bins-per-octave`, `--hop-length`, `--fmin` |
| `sonare vqt music.mp3` | 非対応 | 対応 | Variable-Q 変換のサマリー。`--n-bins`, `--bins-per-octave`, `--gamma`, `--filter-scale`, `--hop-length`, `--fmin` |
| `sonare mel-to-audio music.mp3 -o recon.wav` | 非対応 | 対応 | 計算したメルスペクトログラムから Griffin-Lim で音声を再構成。`--n-iter`, `--n-mels`, `--fmin`, `--fmax` |
| `sonare mfcc-to-audio music.mp3 -o recon.wav` | 非対応 | 対応 | 計算した MFCC からメル、Griffin-Lim 経由で音声を再構成。`--n-mfcc`, `--n-iter`, `--n-mels`, `--fmin`, `--fmax` |
| `sonare tonnetz music.mp3` | 非対応 | 対応 | Tonal centroid 特徴。`--n-fft`, `--hop-length` |
| `sonare pcen --values ... --n-bins 128 --n-frames 10` | 非対応 | 対応 | 平坦化した行列への per-channel energy normalization。[数値ヘルパー](./cli-utilities.md) と同じく `--values` を取り、ほかに `--n-bins`, `--n-frames`, `--sample-rate`, `--time-constant`, `--gain`, `--bias`, `--power`, `--eps`, `--hop-length` を取る |
| `sonare fourier-tempogram music.mp3` | 非対応 | 対応 | Fourier tempogram |
| `sonare tempogram-ratio music.mp3` | 非対応 | 対応 | テンポ比特徴量 |

Python CLI は行列特徴量の全データをそのまま出力せず、サマリーを表示します。完全な特徴量行列が必要な場合は [Python API](./python-api.md) または [JavaScript API](./js-api-analysis.md) を使ってください。

### 編集

音声を変換し、`-o` で WAV を書き出します。ノート単位の編集とスケール補正の手順は [CLI 使用例](./cli-examples.md#ノート編集ワークフロー) にあります。

| コマンド | 説明 | オプション |
|----------|------|-----------|
| `sonare pitch-correct vocal.wav -o out.wav` | 目標 MIDI ノートへピッチ補正 | `--current-midi`（69.0）, `--target-midi`（69.0） |
| `sonare pitch-correct-timevarying vocal.wav -o out.wav` | pYIN 輪郭を追跡し、1 音または音階へ補正 | `--mode midi\|scale`, `--target-midi`, `--scale-root`, `--scale-mode-mask`（12 ビットのマスク、または `minor` などのモード名）, `--reference-midi`, `--hop-length`, `--retune-amount`（1.0）, `--max-correction-semitones`（12）, `--retune-speed-ms`（50）, `--vibrato-threshold-cents`（20） |
| `sonare note-move take.wav --target-onset 48000 -o out.wav` | ノート区間を指定サンプル位置へ移動 | `--onset`, `--offset`, `--target-onset`（サンプル位置） |
| `sonare note-stretch take.wav -o out.wav` | 単一ノート区間をストレッチ | `--onset`, `--offset`（サンプル位置）, `--ratio`（1.0） |
| `sonare scale-quantize 68.7` | MIDI 値を音階へ量子化 | `--root`, `--mode-mask`（12 ビットのマスク、またはモード名）, `--reference-midi` |
| `sonare voice-change vocal.wav -o out.wav` | ボイスチェンジ（ピッチ＋フォルマント） | `--pitch-semitones`（0.0）, `--formant-factor`（1.0）, `--formant-mode relative\|absolute`（relative） |
| `sonare pitch-shift vocal.wav --semitones 3 -o out.wav` | 長さを変えずに移調 | `--semitones`（**必須**） |
| `sonare time-stretch take.wav --rate 1.2 -o out.wav` | ピッチを変えずに長さを変更 | `--rate`（**必須**） |
| `sonare normalize mix.wav -o out.wav` | ピークまたは RMS ノーマライズ | `--mode peak\|rms`, `--target-db` |
| `sonare trim-silence take.wav -o out.wav` | 前後の無音をトリム。既定では絶対値 `-60` dBFS を下回る部分を削り、ライブラリの `trim` と同じ規則になる。`--top-db` を付けると、ピーク基準の `trimSilence` と同じ規則になる | `--top-db`, `--threshold-db`（-60） |
| `sonare resample music.wav --target-sr 44100 -o out.wav` | リサンプリング | `--target-sr` |
| `sonare polyphonic-notes chord.wav` | ポリフォニー解析が見つけたノートを一覧表示 | — |
| `sonare vocal-notes vocal.wav` | ボーカル編集セッションがモノフォニックのテイクから見つけるノートを、最も近い音からのずれ（セント）付きで一覧表示 | `--segmentation-threshold-cents`（50）, `--min-note-ms`（30）, `--fmin-hz`（65）, `--fmax-hz`（2093）, `--reference-hz`（440）, `--frame-length-samples`, `--hop-length-samples`, `--yin-threshold`, `--voiced-threshold`, `--no-centered` |
| `sonare polyphonic-render chord.wav -o out.wav` | その解析結果をノート単位で編集して再レンダリング | `--edit NOTE.FIELD=VALUE`（繰り返し可） |
| `sonare project align-takes --in project.json --reference-source 1 -o aligned.json` | プロジェクト内のすべてのテイクを 1 つの参照ソースに揃え、テイクごとのワープマップを付けてプロジェクトを書き戻す。ソースファイルを直接読む。参照と異なるレートで録音されたテイクは参照のグリッドへリサンプリングされ、アンカーはプロジェクトのレートで書き込まれる（[録音とテイク](./recording-and-takes.md) を参照） | `--in`, `--reference-source`（**必須**）, `--audio SOURCE_ID=WAV`（繰り返し可）, `--resolve-audio`, `--hop-length`, `--bins-per-octave` |

`--top-db` と `--threshold-db` は同時に指定できない、択一の無音判定方式です。どちらも省略すると `--threshold-db` が `-60` として扱われ、`--top-db` を指定するとピーク相対のトップ dB 方式に切り替わります。

両方の CLI が、上のファイル書き出し編集コマンドを提供します。`hpss` も `-o` が必須で、エネルギー要約を表示しながら `<base>_harmonic.wav` と `<base>_percussive.wav` を書き出します。

::: warning 何もしない既定値はありません
`--semitones` と `--rate` に既定値はありません。既定値があると、省略したときにコマンドが何もしない状態になるためです。どちらかを省略すると終了コード 3 で終了します。`pitch-correct-timevarying` の `--mode` も同じ考え方で、`midi` か `scale` だけを受け付け、それ以外は既定値へフォールバックせず使用方法エラー（終了コード 2）になります。
:::

ネイティブ CLI では、共通の編集コマンドに加えて、低レベルの処理コマンドも使えます。

| ネイティブコマンド | 必須または主なオプション |
|--------------------|--------------------------|
| `sonare gain music.wav -o out.wav` | `-o`, `--gain-db`（**必須**） |
| `sonare fade music.wav -o out.wav` | `-o`, `--fade-in` または `--fade-out`（秒） |
| `sonare filter music.wav -o out.wav` | `-o`, `--type hp\|lp\|bp\|notch`; hp/lp は `--cutoff`、bp/notch は `--center` + `--bandwidth`; `--order`（2）, `--zero-phase` |
| `sonare preemphasis speech.wav -o out.wav`, `sonare deemphasis speech.wav -o out.wav` | `-o`; `--coef`（0.97） |

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

`--report` を付けると JSON は `{"intervals": [...], "report": {...}}` というオブジェクトになります。

| オプション | 既定値 | 説明 |
|------------|------------|------|
| `--input WAV` | — | 同じパートの別テイク。繰り返し指定可 |
| `--top-db` | 60.0 | ピークからの無音しきい値（dB） |
| `--write-takes PREFIX` | — | 各テイクを各区間で切り出して書き出す |
| `--report` | 無効 | `--json` と併用すると `report` オブジェクトを加える。`silence_ceiling_db`（無音がまだ見つかる最大の `--top-db`。複数テイクでは余裕が最も小さいテイクの値）、`max_signal_intervals` と `min_signal_intervals`（最も細かく分かれたテイクと最も粗いテイクの区間数） |
| `--n-fft`, `--hop-length` | 2048, 512 | 解析のフレーミング |

テイクを複数渡すと、すべてのテイクが無音になっている場所だけがカット位置になります。複数テイクの指定、`--write-takes`、エラーの出方は [無音でテイクを分割する](./cli-examples.md#無音でテイクを分割する) で順に説明しています。

`-o`／`--output` は使用方法エラー（終了コード 2）です。このコマンドの結果は区間の一覧か切り出したテイクファイルであり、単一のレンダリング済み出力ファイルではありません。

### リアルタイムボイスプリセット

リアルタイムボイスチェンジャープリセットの参照、検証、レンダリングを行うコマンドです。

| コマンド | 説明 | オプション |
|----------|------|------------|
| `sonare voice-change vocal.wav -o out.wav` | `--preset`、`--preset-json`、`--preset-pack`、`--set` を渡した場合はリアルタイム音声プリセットチェーンでレンダリング | `--preset`、`--preset-json`、`--preset-pack`、`--set PATH=VALUE` |
| `sonare voice-presets` | リアルタイムボイスチェンジャーのプリセット ID を一覧表示 | `--json` |
| `sonare voice-preset` | 1 つのプリセット設定を JSON で出力 | `--preset`（既定: `neutral-monitor`）、`--json` |
| `sonare voice-preset-validate preset.json` | プリセット JSON ファイルまたはプリセットパックを検証・正規化 | パック検証時は `--preset`、`--set PATH=VALUE`、`--json` |

リアルタイムプリセット系のオプションを渡さない場合、`voice-change` は `--pitch-semitones`、`--formant-factor`、`--formant-mode` で制御する単純なピッチ／フォルマント変換を使います。`relative`（既定）ではフォルマント係数はピッチシフトの後に掛かるワープで、フォルマントはピッチに追従します。`absolute` では入力に対するフォルマントシフトとなり、ピッチシフトの量に関わらず `1.0` でフォルマントが元の位置に留まります。フォルマントワープが届かない指定は、届く範囲を示して拒否されます。プリセット系のオプションを渡した場合はリアルタイム音声チェーンを使い、この 3 つの単純な指定との併用は無効パラメータとして拒否されます。

プリセットの選択は明示的に行います。組み込みの `--preset ID`、`--preset-json FILE`、または `--preset-pack FILE --preset ID` の組み合わせから 1 つを選びます。パックファイルとエントリ ID はセットで 1 つの指定として扱われるため、`--preset-pack` だけを渡すと拒否されます（先頭エントリへのフォールバックはありません）。`--preset-json` とパックは併用できません。`--set PATH=VALUE` を使うには、いずれかのプリセット指定が必要です。

### Playback

`playback` は映画音声（モノラル、ステレオ、5.1、7.1）をスピーカーレイアウトまたはバイノーラルヘッドホン向けにレンダリングするコマンドで、5.1 と 7.1 のチャンネルを保つ唯一のコマンドです。オプション: `--target`（`headphones`、`stereo`、`5.1`、`7.1`）、`--input-layout`（`auto`、`mono`、`stereo`、`5.1`、`7.1`）、`--config FILE`、`--no-upmix`、`--night`（0〜1）、`--dialogue-db`（-12〜12）、`--program-lufs`（-70〜0。省略すると入力から測定）、`--target-lufs`（-40〜-5）、`--room`（`none`、`living_room`、`home_theater`、`screening_room`）、`--hrtf FILE`。ステージ、設定キー、例は [再生レンダラー](./playback.md#どの言語でも同じ流れ) にあります。
