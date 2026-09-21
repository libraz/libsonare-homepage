# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

CLI は、アプリケーションコードを書かずに、簡易確認、バッチ処理、スクリプト向け JSON 出力を行いたい場合に使います。UI を作る場合は、[WebAssembly ガイド](./wasm.md)、[Python API](./python-api.md)、[ミキシングエンジン](./mixing.md) から始めてください。

このページは CLI リファレンスの索引です。コマンド単位のリファレンスは [CLI コマンド](./cli-commands.md)、シェルでのワークフロー例は [CLI 使用例](./cli-examples.md) にあります。ステムから完成マスターまで、リファレンス曲への追い込み、CI での納品前チェックといった、シェルで完結させる作業単位の手順は [実践ユースケース](./use-cases.md) にあります。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- PyPI の `sonare` コマンドを導入し、ネイティブ CLI との違いを理解できる。
- 簡易解析、特徴量サマリー、編集、マスタリング、音響チェック、簡単なミキシングに合うコマンドを選べる。
- 人が読む出力と、スクリプト向けの `--json` 出力を使い分けられる。
- CLI ではなく Python、WASM、ネイティブ API へ移るべきワークフローを判断できる。

## 最初に試すコマンド

| 目的 | コマンド |
|------|----------|
| 全体の要約を見る | [`sonare analyze music.mp3`](./cli-commands.md#analyze) |
| テンポだけを見る | [`sonare bpm music.mp3`](./cli-commands.md#bpm) |
| キーだけを見る | [`sonare key music.mp3`](./cli-commands.md#key) |
| スクリプトで扱いやすい出力にする | [`sonare analyze music.mp3 --json`](./cli-commands.md#analyze) |

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

`master`、`mastering-chain`、`declip`、そしてシーンミキサーの `mix`（[ミキシングワークフロー](./cli-examples.md#ミキシングワークフロー) を参照）です。

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

マスタリングのワークフローはこのページに残しています。基本解析、特徴量サマリーの書き出し、バッチ処理、ミキシング、プロジェクト＆ MIDI の手順は [CLI 使用例](./cli-examples.md) にあります。

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

## 各節の移動先

| 節 | 移動先 |
|----|--------|
| 解析コマンド | [CLI コマンド](./cli-commands.md#解析コマンド) |
| 特徴コマンド | [CLI コマンド](./cli-commands.md#特徴コマンド) |
| その他のコマンド | [CLI コマンド](./cli-commands.md#その他のコマンド) |
| 基本解析ワークフロー | [CLI 使用例](./cli-examples.md#基本解析ワークフロー) |
| 特徴量サマリーの書き出し | [CLI 使用例](./cli-examples.md#特徴量サマリーの書き出し) |
| バッチ処理 | [CLI 使用例](./cli-examples.md#バッチ処理) |
| ミキシングワークフロー | [CLI 使用例](./cli-examples.md#ミキシングワークフロー) |
| プロジェクト＆ MIDI ワークフロー | [CLI 使用例](./cli-examples.md#プロジェクト-midi-ワークフロー) |
