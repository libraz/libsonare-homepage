# CLI リファレンス

`sonare` コマンドラインインターフェースの完全なリファレンス。

CLI は、アプリケーションコードを書かずに、簡易確認、バッチ処理、スクリプト向け JSON 出力を行いたい場合に使います。UI を作る場合は、[WebAssembly ガイド](./wasm.md)、[Python API](./python-api.md)、[ミキシングエンジン](./mixing.md) から始めてください。

このページは CLI リファレンスの索引です。どちらの CLI にどのコマンドがあるか、グローバルオプション、終了コード、対応形式を扱います。コマンド単位のリファレンスは [CLI コマンド](./cli-commands.md)、マスタリングとリペアのコマンドはこのページ、シェルでのワークフロー例は [CLI 使用例](./cli-examples.md) にあります。ステムから完成マスターまで、リファレンス曲への追い込み、CI での納品前チェックといった、シェルで完結させる作業単位の手順は [実践ユースケース](./use-cases.md) にあります。

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
| ネイティブ CLI | `sonare-cli` | リリースアーカイブ、または `BUILD_CLI=ON` でソースビルド | 低レベルユーティリティ、信号生成、librosa 互換ヘルパー |

ネイティブ実行ファイルは、FFmpeg なしの Linux / macOS リリースアーカイブに `sonare-cli` という名前で（それぞれ SHA-256 チェックサム付きで）同梱されます。そのため Python の `sonare` コマンドと衝突せず、並べてインストールできます。このページの例は `sonare` と書いていますが、ネイティブ専用コマンドを実行するときは `sonare-cli` に読み替えてください。

対応するコマンドでは、どちらの CLI も同じ `snake_case` のキーとペイロード形状を使うため、同じスクリプトで読めます。ただし、バイト単位で同一の出力には依存しないでください。各フロントエンドは個別にシリアライズし、JSON の値はネイティブの精度を保ちます。人間向けの単機能サマリーでは、丸めが行われる場合があります。`--json` のペイロードは 2 つの CLI で一致しますが、テキスト出力のレイアウトは異なります（ネイティブ CLI は結果行の先頭に `> ` を付け、Python CLI が `Wrote:` と出す場所に `Saved:` と出します）。ここに載せているサンプルは Python CLI のものです。

ページに「ネイティブ CLI」と明記されていない限り、PyPI の Python CLI で使えるコマンドとして読んでください。

::: tip pip で簡単インストール
`sonare` CLI は PyPI の Python パッケージに含まれます。

```bash
pip install libsonare
sonare analyze music.mp3
```

npm の WebAssembly パッケージ `@libraz/libsonare` ではインストールされません。

標準の PyPI ホイールは WAV/MP3 をデコードします。M4A/AAC/FLAC/OGG/Opus を直接読むには FFmpeg 有効ビルドが必要です。
:::

## コマンドの提供範囲

ほとんどのコマンドは両方の CLI にあり、オプションも共通です。`sonare-cli` には PyPI パッケージにない低レベルユーティリティと信号生成コマンドがあり、Python CLI にはシーンミキサーとプリセット駆動のマスタリングコマンドがあります。ネイティブの実行ファイルはリリースアーカイブから入手するか、[ソースからビルド](/ja/docs/installation#ソースからビルド) を参照してください。

| 分類 | 両方の CLI | ネイティブ CLI のみ | Python CLI のみ |
|------|-----------|--------------------|----------------|
| 解析 | `analyze`, `bpm`, `key`, `beats`, `downbeats`, `onsets`, `sections`, `chords`, `rhythm`, `dynamics`, `timbre`, `lufs` | `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase` | — |
| 特徴量 | `mel`, `chroma`, `spectral`, `pitch`, `onset-envelope`, `tempogram`, `plp`, `nnls-chroma` | `cqt`, `vqt`, `tonnetz`, `pcen`, `onset-env`, `fourier-tempogram`, `tempogram-ratio`, `mel-to-audio`, `mfcc-to-audio` | — |
| 音源分離 | `hpss`, `decompose-stems` | — | — |
| ノートと採譜 | `transcribe`, `polyphonic-notes`, `polyphonic-render`, `vocal-notes`, `tune-to-midi` | — | — |
| 編集 | `pitch-correct`, `pitch-correct-timevarying`, `note-move`, `note-stretch`, `scale-quantize`, `voice-change`, `pitch-shift`, `time-stretch`, `normalize`, `trim-silence`, `split-silence`, `resample` | `gain`, `fade`, `filter`, `preemphasis`, `deemphasis` | — |
| ボイスプリセット | `voice-presets`, `voice-preset`, `voice-preset-validate` | — | — |
| ルーム音響 | `acoustic`, `estimate-room`, `synthesize-rir`, `room-morph` | — | — |
| マスタリングとリペア | `mastering`, `eq`, `repair`, `mastering-presets`, `mastering-profile`, `mastering-suggest`, `mastering-streaming`, `mastering-processors`, `mastering-processor`, `mastering-pair-processors`, `mastering-pair-processor`, `mastering-pair-analyses`, `mastering-pair-analyze`, `mastering-stereo-analyze` | `mastering-stereo-analyses` | `master`, `mastering-chain`, `declip` |
| ミキシング | `mixing-presets`, `mixing-preset`, `suggest-mix`, `mix-strip` | — | `mix`（シーンミキサー。[ミキシングワークフロー](./cli-examples.md#ミキシングワークフロー) を参照） |
| プロジェクトと MIDI | `project`（`abi`, `new`, `validate`, `compile`, `synth-presets`, `bounce`, `export-smf`, `import-smf`, `export-midi2`, `import-midi2`, `align-takes`）, `midi-render` | — | — |
| 再生 | `playback` | — | — |
| 合成 | — | `tone`, `chirp`, `clicks` | — |
| 数値ヘルパー（[CLI ユーティリティ](./cli-utilities.md)） | — | `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`, `system-info` | — |
| ユーティリティ | `info`, `version`, `doctor` | — | — |

`sections` は両方にありますが、オプションが異なります。共通の `--min-duration` に加えて、ネイティブ CLI には `--threshold` があります。

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
| `-o`, `--output` | 出力 WAV パス。編集・マスタリング・`eq`・`mix` コマンドはここに WAV を書き出します。解析・特徴量コマンドは stdout に出力し、このオプションを受け付けません |
| `--n-fft <int>` | FFT サイズ（既定値: 2048） |
| `--hop-length <int>` | ホップ長（既定値: 512） |
| `--n-mels <int>` | Mel バンド数（既定値: 128） |
| `--quiet`, `-q` | ネイティブ CLI のみ。進捗出力を抑制する |

`sonare <command> --help` は、そのコマンドが実際に受け付けるオプションだけを表示します。個々のコマンドについてはヘルプの表示を正としてください。上記の DSP オプション（`--n-fft`・`--hop-length`・`--n-mels`）は、それを使うコマンドだけが受け付けます。使わないコマンドに渡すと、黙って無視されるのではなく使用方法エラー（終了コード 2）で終了します。

色付けは起動時に一度だけ設定されます。環境変数 `NO_COLOR` を設定するか、標準出力をファイルやパイプにリダイレクトすると、実行全体で ANSI エスケープが無効になります。

`--json` はスクリプトで扱いやすい要約 JSON を出力します。Python CLI の `mel` や `chroma` は特徴量の全行列をそのまま出力するのではなく、次元や要約値を出力します。

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
sonare --version
```

**出力:**
```
libsonare {{ wasmMeta.version }} (Python CLI)
```

### doctor

そのビルドで何ができるかを表示します。機能が見当たらない、ファイルがデコードできないといったときに最初に実行するコマンドです。2 つの CLI どちらにもあり、バインディングが `capabilities` として公開しているのと同じビルド診断レポートを出力します。`--json` のフィールドは 2 つの CLI で一致します。ネイティブ CLI のテキスト出力はレイアウトが異なり（先頭が `libsonare Doctor` で、`Version:` と `ABI: project 2, engine 3` が続きます）、下のサンプルは Python CLI のものです。

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

`ffmpeg=false` のビルドなら M4A/AAC/FLAC/OGG のデコード失敗はそれが原因です。`mastering`／`mixing`／`fx` は、どのコマンド群がビルドに含まれているかを示します。

## マスタリングとリペア

仕上げのマスターを書き出すコマンドと、傷んだテイクを直すコマンドです。以下は、行に Python CLI のみ、ネイティブ CLI のみと書かれたものを除いて両方の CLI にあります。全体の一覧は上の提供範囲の表にあり、オプションはコマンドごとに下に載せています。

| やりたいこと | コマンド |
|--------------|----------|
| ラウドネス目標を True Peak 上限のもとで満たす | `sonare mastering` |
| 名前付きプリセットを使う | `sonare mastering --preset NAME`（Python CLI には `master` もあります） |
| 音声からアシスタントにチェーンを選ばせる | `sonare mastering --assistant`。先にチェーンを見たいときは [`mastering-suggest`](#アシスタントコマンド) |
| 自分で組んだチェーンを実行する | `sonare mastering --chain-config chain.json`（Python CLI には `mastering-chain` もあります） |
| イコライザー 1 台で音色を整える | `sonare eq` |
| クリップ、クリック、ハム、ノイズを直す | `sonare repair`。クリップだけなら `declip`（Python CLI） |
| 名前付きプロセッサを 1 つ実行する | `sonare mastering-processor` |
| トラックをリファレンスと比べる | `sonare mastering-pair-analyze`、`mastering-pair-processor` |
| プラットフォームのラウドネス正規化をプレビューする | `sonare mastering-streaming` |
| ステレオファイルのモノラル互換性を調べる | `sonare mastering-stereo-analyze`（解析の一覧は `sonare mastering-stereo-analyses`。ネイティブ CLI のみ） |
| リファレンスを取るプロセッサを一覧表示する | `sonare mastering-pair-processors` |

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

# 統合イコライザーを適用: ハイシェルフ 1 バンド（--type 2）
sonare eq track.wav --type 2 --frequency-hz 12000 --gain-db 2.5 --q 0.7 -o eq.wav

# 名前付きマスタリングプリセットを適用（既定のプリセットは pop）
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

`master`、`mastering-chain`、`declip` は Python CLI のみ、`mastering-stereo-analyses` はネイティブ CLI のみです。`mastering-pair-analyze` と `mastering-pair-processor` は、リファレンスを本来のサンプルレートのまま読み込み、ソースのレートへリサンプリングします。レートが等しい場合は、この処理がない場合とまったく同じ結果になります。`mastering-stereo-analyze` だけは例外で、2 つのファイルとも入力と同じレートである必要があり、食い違いはエラーになります。比較前のリサンプリングやトリムを細かく制御したい場合は Python API を使ってください。

`/ja/mastering` ブラウザデモも同じマスタリングプロセッサ群を呼び出しています。デモから書き出したレポートを CLI 自動化の起点として活用できます。

### mastering

`mastering` は、True Peak 上限のもとでラウドネスをノーマライズします。チェーンの選び方は高々 1 つです。何も指定しない（ラウドネスのノーマライズのみ）、`--preset`、`--chain-config`、`--assistant` のいずれかです。

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--target-lufs` | -14 | 統合ラウドネスの目標 |
| `--ceiling-db` | -1 | True Peak の上限（dBTP） |
| `--true-peak-oversample` | 4 | True Peak リミッターのオーバーサンプリング。1、2、4、8、16 のいずれか |
| `--bits` | 16 | 出力ビット深度。16 または 24 |
| `--preset NAME` | — | 名前付きプリセットから始める（一覧は `mastering-presets`） |
| `--chain-config FILE`（別名 `--config`） | — | 完全なチェーン文書を実行する。`--preset` や `--assistant` とは併用できない |
| `--params k=v,...` | — | 選んだプリセット・文書・提案への上書き。3 つのいずれかが必要 |
| `--assistant` | 無効 | [マスタリングアシスタント](./mastering-assistant.md)が提案するチェーンでマスタリングする。`--preset` はその土台の指定になる |
| `--target-platform` | `streaming` | `--assistant` と併用。`streaming`、`youtube`、`broadcast`、`podcast`、`audiobook`、`cinema`、`club`、`cd` |
| `--enable-repair` | 無効 | `--assistant` と併用。測定に基づくリペアのステージを提案に含める |
| `--no-streaming-safe` | 無効 | `--assistant` と併用。ストリーミング向けの安全なデノイズ推定器を優先しない |
| `--speech-mono-amount` | 1 | `--assistant` と併用。スピーチ用プリセットが低域のサイドエネルギーをどれだけモノラルに寄せるか（0〜1） |
| `--explain` | 無効 | `--assistant` と併用。各ステージを選んだ理由を出力する |
| `--report FILE` | — | マスタリングレポートの JSON ファイルを書き出す |

`--target-lufs`、`--ceiling-db`、`--true-peak-oversample` はラウドネスステージを単独で設定するため、`--preset` や `--chain-config` と併用すると拒否されます。プリセットや文書を上書きするには `--params` を使います。アシスタント用の 5 つのオプションは、`--assistant` なしでは拒否されます。

### eq

`eq` は統合イコライザーを適用します。1 回の呼び出しで、`--type`、`--frequency-hz`、`--gain-db`、`--q` から 1 バンドを設定します。複数のバンドを設定するときは `--params` を使います。`--placement` と `--output-pan` はファイル自身のチャンネルに作用し、2 チャンネルのファイルはペアのまま処理されます。ダイナミック、サイドチェイン、位相のオプションは `sonare eq --help` で確認できます。

| `--type` | バンド | `--type` | バンド |
|----------|--------|----------|--------|
| 0 | ピーク | 5 | バンドパス |
| 1 | ローシェルフ | 6 | ノッチ |
| 2 | ハイシェルフ | 7 | ティルトシェルフ |
| 3 | ローパス | 8 | フラットティルト |
| 4 | ハイパス | | |

### アシスタントコマンド

3 つのアシスタントコマンドはいずれもオーディオファイルを受け取り、JSON オブジェクトを標準出力に出力します。結果のフィールドは [マスタリングアシスタント API](./mastering-assistant.md) で説明しています。

| コマンド | 主なオプション | 出力 |
|---------|--------------|------|
| `sonare mastering-profile track.wav` | `--params key=val,...` | オーディオプロファイル JSON（ラウドネス・ダイナミクス・スペクトル特性） |
| `sonare mastering-suggest track.wav` | `--preset`, `--target-lufs`, `--ceiling-db`, `--target-platform`, `--enable-repair`, `--no-streaming-safe`, `--speech-mono-amount`（意味は `mastering --assistant` と同じ）, `--params key=val,...`, `--config-out FILE` | 推奨マスタリングチェーン JSON |
| `sonare mastering-streaming track.wav` | `--platforms '[...]'`, `--platforms-file f.json` | プラットフォームごとのノーマライズプレビュー JSON |

`mastering-suggest --config-out chain.json` は、提案したチェーンを完全な文書としても書き出します。これを編集してから、`sonare mastering track.wav --chain-config chain.json -o out.wav`（Python CLI では `master --chain-config` も可）で実行できます。オプションと `--params` の両方で同じ設定を渡すと拒否されます。`--platforms` は `{name, targetLufs, ceilingDb}` オブジェクトの JSON 配列を受け取ります。`mastering-profile` の `--params` は、カンマ区切りの `key=value` 浮動小数点ペアを呼び出しに渡します。

### プリセット・チェーン・declip のコマンド

オーディオファイルを受け取り、`-o` で WAV を書き出します。ただし `mastering-presets` は名前を一覧表示するだけです。

| コマンド | 主なオプション | 備考 |
|---------|--------------|------|
| `sonare master track.wav -o out.wav`（Python） | `--preset NAME`（既定値 `pop`）, `--config '{...}'`, `--config-file f.json`, `--chain-config f.json`, `--assistant`, `--params k=v,...`, `--report FILE` | 名前付きマスタリングプリセットを適用する。`--config`／`--config-file`／`--params` でプリセット値を上書きできる。`--chain-config` はプリセットを完全なチェーン文書で置き換え、`--assistant` は提案されたチェーンでマスタリングする。`--report` はマスタリングレポート JSON ファイルを書き出す |
| `sonare mastering-chain track.wav -o out.wav`（Python） | `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | JSON 設定から構成可能なマスタリングチェーンを実行する |
| `sonare mastering-presets` | グローバルの `--json` フラグに対応 | 利用可能なマスタリングプリセット名を一覧表示する |
| `sonare declip clipped.wav -o out.wav`（Python） | `--clip-threshold`（0.98）, `--lpc-order`（36）, `--iterations`（2）, `--lpc-blend`（0.65） | LPC 再構成でクリップしたオーディオを修復する |

どの CLI でも、`--chain-config`（または `--config`）の文書と `--params` は 1 つのパラメータ一覧として読まれます。同じフィールドが文書と `--params` の両方に別の綴りで書かれていると、両方のキー名を挙げて拒否されます。文書の `<stage>.enabled: false` は、`--params` がその段のフィールドを指定しても無効のままです。バンドが 1 つのマルチバンドの段は拒否され（`multiband stage needs at least two bands; one band is the compressor stage`）、バンド数は 2〜64 です。

列挙値のパラメータは、数値のほかに選択肢の名前でも指定できます。

| キー | 指定できる名前 |
|------|----------------|
| `repair.denoise.mode` | `logMmse`, `mmseStsa`, `spectralSubtraction` |
| `repair.denoise.noiseEstimator` | `mcra`, `imcra`, `spp` |
| `repair.dehum.mode` | `subtract`, `notch` |
| `repair.decrackle.mode` | `median`, `waveletShrinkage` |

`repair.decrackle.mode` は 0（`median`）と 1（`waveletShrinkage`）以外の数値を拒否します。`wavelet` のような名前の一部だけの指定も、有効な名前を示して拒否されます。

### repair

`declip` が直すのは 1 種類の欠陥だけです。[`repair`](./audio-repair.md) はテイクを測定し、必要な修復の段（declip、declick、decrackle、dehum、denoise、dereverb をこの順で）を実行します。録音の何が悪いのかまだ分かっていないときは、このコマンドから始めます。

```bash
# 測定と報告のみ。ファイルは書き出さない
sonare repair noisy.wav --detect --json

# 測定し、段を選び、修復し、選んだ理由も出力する
sonare repair noisy.wav -o clean.wav --explain

# 自動で選ばせず、名前付きプリセットの設定を使う
sonare repair noisy.wav --preset broadcast -o clean.wav
```

| オプション | 説明 |
|------------|------|
| `--detect` | 測定と報告のみ。処理は行わず、ファイルも書き出さない。Python CLI では `-o`、`--preset`、`--params`、`--bits` との併用が拒否される |
| `--preset NAME` | 自動選択の代わりに、名前付きプリセットのリペア段を使う（名前は `sonare mastering-presets` で確認） |
| `--params` | 段の設定の上書き。`repair.<stage>.<field>=value,...` の形式 |
| `--explain` | 各段を選んだ理由を出力する |
| `--bits` | 出力ビット深度。16 または 24 |

`--detect` を指定しない場合、`-o` は必須です。`--explain` は実際に行われた判断についてしか説明できないため、`--preset` や `--detect` との併用は無効なパラメータとして拒否されます（終了コード 3）。検出器にかけるには短すぎるファイルは、`"defects": {"measured": false}` だけを返します。

`repair` は意図的にリミッターを通しません。デクリップはクリッパーが削ったピークを復元するので、結果はしばしばフルスケールを超えます。そこでサンプルごとにクランプするのではなく、ファイル全体に 1 つのゲインを掛けて収めます。クランプしてしまうと、復元したばかりのサンプルを元のクリップレベルへ押し戻すことになるからです。適用されたゲインは `output_gain_db` として必ず出力され、ピークがそのまま収まっていた場合は `0` になります。

関連するマスタリングガイド: [配信ターゲット](./glossary/mastering/delivery-targets.md)、[メーターの読み方](./glossary/mastering/meter-reading.md)、[エラー復旧](./glossary/mastering/error-recovery.md)。

RT60、EDT、C50、C80、D50、体積、寸法、吸音率バンド、DRR、RIR 合成時のエラー状態、信頼度などのルーム音響フィールドは [ルーム音響解析](./acoustic-analysis.md) で説明しています。

## ステレオとモノラルの扱い

CLI のコマンドの多くは、性質上モノラルです。実行する解析や報告するメーターが 1 チャンネルで定義されているためです。そうしたコマンドでは、どちらのフロントエンドもマルチチャンネル入力をモノラルへダウンミックスして読み込み、そのとき同じ警告を標準エラー出力に表示します。ステレオファイルが黙ってチャンネルを失うことはありません。

ダウンミックスすると結果が悪くなるコマンドは、ステレオのまま扱います。

| コマンド | ステレオ入力の扱い |
|----------|--------------------|
| `mastering` | ステレオのままマスタリングし、音像を最後まで保つ |
| `eq`, `room-morph` | 2 チャンネル入力はステレオのまま処理し、ステレオファイルとして書き出す。`eq` の `--placement` と `--output-pan` はファイル自身のチャンネルに作用する。`room-morph` は目標ルームを `--receiver-spacing` メートル（既定 0.5、0 より大きく 4 まで）離した 2 つのレシーバーで聴いたものとして扱う。JSON レポートには `stereo` が含まれる |
| `mastering-processor` | 2 チャンネル入力はステレオのまま処理し、結果もステレオファイルとして書き出す。モノラル形式を持たないプロセッサ（`stereo.imager`、`eq.midSide`、`multiband.*` 系）は入力にかかわらずステレオ経路をたどり、モノラルファイルは左右両方に流し込んだうえでステレオとして書き出す |
| `mix`（Python）, `mix-strip` | ステレオのまま処理する。モノラルファイルは左右両方へ、ステレオファイルは自身の 2 チャンネルをそのまま使う |
| `suggest-mix` | 各 `--input` は、ステレオファイルをダウンミックスせずペアのまま保持する。アシスタントの中で両チャンネルを測定するのは音像解析だけだから。各ファイルは本来のサンプルレートのまま読み込まれる |
| `normalize` | ステレオのまま扱う。ゲインは両チャンネルをまたいで 1 つだけ求め、両方に同じ値を掛ける。`--mode peak` では大きい方のチャンネルが `--target-db` に届き、もう一方はそれとの差を保つ。`--mode rms` も同じくペア全体で測る。チャンネルごとに別々にノーマライズすると、小さい方が持ち上がって左右の差が消える。それはレベル調整ではなくバランス変更になってしまう |
| `playback` | 5.1 や 7.1 の入力を含め、チャンネルをそのまま保つ。そうするのはこのコマンドだけ |
| `master`, `mastering-chain`, `declip`（Python CLI） | ステレオのまま扱い、ゲインは両チャンネルをまたいで 1 つだけ求める。音像が中央へ寄らない |
| 上記以外 | モノラルへダウンミックスし、警告を表示する |

ステレオ経路を選ぶオプションはありません。ファイル自身のチャンネル数と、プロセッサ自身がモノラル形式を持つかどうかで決まります。`mastering-processor` に `--stereo` フラグを付けると、どちらの CLI でも未知のオプションとして拒否されます（終了コード 2）。フラグを外してください。2 チャンネルのファイルは、何も指定しなくてもステレオ経路をたどります。JSON レポートは `stereo` フィールドでどちらの経路を通ったかを示し、`normalize --json` の `length` はチャンネルあたりの値です。

`playback` を除き、3 チャンネル以上の素材は常にダウンミックスされます。オフライン処理にはモノラル版とステレオ版しかなく、それより広いものがないためです。サラウンドファイルのチャンネル 0 だけを残して「元の音」と称するよりは、ダウンミックスしたと明示する方が正確です。

CLI にないチャンネル保持処理が必要な場合は、[Python API](./python-api.md) や [JavaScript API](./js-api.md) のステレオ向けエントリポイントを使ってください。

## 対応オーディオ形式

| 形式 | 拡張子 | 備考 |
|--------|-----------|-------|
| WAV | `.wav` | 非圧縮 PCM |
| MP3 | `.mp3` | minimp3 でデコード |
| M4A / AAC / FLAC / OGG / Opus | 形式により異なる | FFmpeg 有効ビルドのみ対応 |

現在のビルドが FFmpeg デコードに対応しているかは、Python から `libsonare.has_ffmpeg_support()` で確認できます。

## 終了コード

Python CLI とネイティブ CLI は、C ABI のエラー分類に揃えた次のプロセス終了コード対応表を共通で使います。同じ失敗を各ライブラリバインディングがどう報告するかは[エラー契約](./binding-parity.md#エラー契約)にあります。

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
| 13 | ABI 不一致（Python CLI のみ） |

使用方法／解析エラーは終了コード 2、意味上の無効パラメータは 3、キャンセルは 11 です。終了コード 13 は Python CLI にだけあります。pip パッケージはネイティブライブラリを実行時に読み込むため、パッケージのビルド時と ABI バージョンが異なるライブラリは、処理を始める前に拒否されます。ネイティブ CLI はライブラリを静的にリンクしているので、ずれは起こりません。13 への対処は[インストール](./installation.md#ライブラリ読み込み時の-abimismatch)を参照してください。終了コード 12 は出力ファイルを作る全段階をカバーするため、最も多い原因は書き込めない `-o` のパス（とくにディレクトリを指している場合）です。どちらの CLI でも `SONARE_LEGACY_EXIT=1` を設定すると、「失敗はすべて `1`」という旧来の挙動に戻せます（終了コード 1 を前提に書かれたスクリプト向け）。

特定のコードで分岐する前に、次の 2 点を押さえておいてください。

- **5 と 6 は 1 つのカテゴリとして扱う。** デコードできない入力に対してどちらが返るかは、ファイルではなくビルドが FFmpeg を含むかどうかで決まります。FFmpeg なしのビルドが 5 を返す場面で、FFmpeg ありのビルドは 6 を返します。壊れたプロジェクト JSON やプリセット文書は、どちらの CLI でも常に 5 です。`sample_rate` が整数ヘルツでないプロジェクトも同じ 5 で、`project bounce` は丸めません。
- **Python CLI では、コマンドラインの誤りが 2 ではなく 3 になることがある。** 終了コード 2 は argparse のもので、パーサーが拒否した範囲をカバーします。ハンドラー側で捕捉される誤り（`--input` のない `mix --output`、因子分解が対応していない `--init` など）は素の `ValueError` として扱われ、コマンドラインの書き間違いであっても終了コード 3 になります。そもそも目の前のビルドにそのコマンドが含まれているか怪しいときは `sonare doctor` を実行してください。

## パフォーマンスのヒント

1. **大きなファイル**: 10 分を超えるファイルは、先に一部を切り出してから解析することを検討してください。
   ```bash
   # 最初の 60 秒のみ解析（ffmpeg を使用）
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT サイズ**: 小さい FFT サイズ（`--n-fft 1024`）は高速ですが、周波数解像度が下がります。

3. **ホップ長**: 大きいホップ長（`--hop-length 1024`）は高速ですが、時間解像度が下がります。

## 次に読むページ

| ページ | 内容 |
|--------|------|
| [CLI コマンド](./cli-commands.md) | 解析・特徴量・編集・ルーム・合成の各コマンドのオプションと出力 |
| [CLI 使用例](./cli-examples.md) | シェルでの手順: 解析、バッチ、ミキシング、プロジェクトと MIDI |
| [CLI ユーティリティ](./cli-utilities.md) | 数値ヘルパー、`tune-to-midi`、`system-info` |
| [実践ユースケース](./use-cases.md) | ステムから完成マスターまで、シェルで完結させる作業単位の手順 |
