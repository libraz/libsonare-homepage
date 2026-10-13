---
title: CLI 使用例
description: sonare CLI をシェルで通しで使うワークフロー例。基本解析、特徴量サマリーの書き出し、バッチ処理、ミキシング、プロジェクト＆ MIDI の手順をまとめます。
---

# CLI 使用例

`sonare` CLI をシェルで通しで使うワークフロー例を、索引である [CLI リファレンス](./cli.md) から分けたページです。マスタリングとリペアの手順は、索引の [マスタリングとリペア](./cli.md#マスタリングとリペア) にあります。

## 基本解析ワークフロー

```bash
# クイック BPM とキーチェック
sonare bpm song.mp3
sonare key song.mp3

# スクリプト用に JSON で総合解析
sonare analyze song.mp3 --json > analysis.json
```

### analyze の JSON

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

## 特徴量サマリーの書き出し

```bash
# コンパクトな特徴量サマリーを書き出す
sonare mel song.mp3 --json > mel_features.json
sonare spectral song.mp3 --json > spectral_features.json
sonare chroma song.mp3 --json > chroma_features.json
```

## バッチ処理

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

## ミキシングワークフロー

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

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--scene FILE` | — | ミキサーシーンの JSON。`--scene` と `--preset` のどちらか一方を必ず指定する |
| `--preset NAME` | — | 組み込みのシーンプリセット（一覧は `mixing-presets`） |
| `--input [ID=]WAV` | — | ストリップごとの入力。繰り返し可。詳細は後述 |
| `-o`, `--output` | — | レンダリングしたステレオ WAV |
| `--sample-rate` | 48000 | ミキサーのサンプルレート。入力はこのレートへリサンプリングされる |
| `--block-size` | 512 | ミキサーの最大ブロックサイズ（フレーム数） |

`--scene` と `--preset` は排他です。両方渡すと使用方法エラーになり、どちらも省略した場合も既定のシーンにフォールバックせず終了コード 2 になります。Python CLI は、リーダーが読まないシーンのキー（たとえば綴りを誤った `faderDB`）ごとに stderr へ `warning:` 行を出力し、そのままレンダリングします。`$` または `x-` で始まるキーは対象外です。

`--input` は `[ID=]WAV` の形式で、繰り返し指定できます。`ID=` を付けるとそのストリップに割り当てられ、パスだけを渡した場合はファイルのベース名が ID になります。どのエントリからも名前を指定されなかったストリップは、削除されるのではなく無音が供給されます。アシスタントが提案したシーンのようにエフェクトリターンをセンドで受けるストリップがあっても、リターンごとに無音 WAV を用意せずレンダリングできるのはこのためです。ストリップ名を一切指定しない書き方をした場合は位置指定として扱われ、シーン順に 1 つずつ割り当てられます。この 2 つの書き方を 1 回の実行で混ぜることはできません。長さが足りない入力は、最も長いものに合わせてパディングされます（短い方に切り詰められることはありません）。

`--input` と `-o/--output` はセットで、どちらか片方だけは指定できません。どちらも省略した場合、`mix` はシーンを読み込んでストリップ数を報告するだけです。

### suggest-mix

`suggest-mix` は逆方向のコマンドです。個々のトラックを渡すと[ミキシングアシスタント](./mixing-assistant.md)がミキサーシーンを提案し、それを `mix --scene` でレンダリングできます。

```bash
sonare suggest-mix \
  --input vocal=vocal.wav \
  --input drums=drums.wav \
  --tempo-bpm auto \
  --scene-out scene.json
```

| オプション | 既定値 | 説明 |
|------------|------------|------|
| `--input [ID=]WAV` | — | トラックごとに 1 つ、繰り返し可。ステレオファイルは 2 チャンネルのまま読み込まれ、アシスタントが音像を読み取れる。3 チャンネル以上はダウンミックスされる。いずれも各ファイルを本来のレートのまま読み込み、`--sample-rate` へリサンプリングする。`ID` の既定はファイルのベース名 |
| `--sample-rate` | 48000 | 解析に使う共通サンプルレート |
| `--tempo-bpm BPM\|auto` | — | 提案するディレイタイムの基準テンポ。`auto` は最初の `--input` から検出する。省略するとトランスポートの既定テンポを使う |
| `--params k=v,...` | — | アシスタントのパラメータ上書き |
| `--scene-out FILE` | — | 提案されたシーンだけを、`mix --scene` が読める形式で書き出す |

提案の全体は JSON として標準出力に出力されます。`mix` に渡すのは `--scene-out` で書き出したファイルです。

### チャンネルストリップ

単一入力のチャンネルストリップは役割の異なる別コマンドで、名前は `mix-strip` です。両方のフロントエンドが持っており、オプションも共通です。

```bash
sonare-cli mix-strip vocal.wav -o strip.wav \
  --input-trim-db -2 --fader-db 1.5 --pan 0.2 --pan-mode balance --width 1.4
```

| オプション | 既定値 | 説明 |
|------------|------------|------|
| `--input-trim-db` | 0.0 | ストリップ手前で適用するゲイン |
| `--fader-db` | 0.0 | フェーダーのゲイン |
| `--pan` | 0.0 | パン位置。-1 〜 1 |
| `--pan-mode` | balance | `balance`、`stereo-pan`、`dual-pan`（大文字小文字は区別しない） |
| `--width` | 1.0 | ステレオ幅。0 でモノラルに収束し、1 より大きくすると広がる |

ストリップは真のステレオで読み書きするため、ステレオ素材は音像を保ったまま処理されます。モノラル素材に対して `--width` は作用する対象がないので、1.0 以外を指定すると黙って無視されるのではなくエラーになります。

::: warning `sonare-cli mix` は存在しません
ネイティブ CLI に `mix` コマンドは存在しません。ストリップコマンドの名前は `mix-strip` だけなので、`sonare-cli mix` を呼ぶスクリプトはオプションの誤りではなく、未知のコマンドとして失敗します。チャンネルストリップには `mix-strip` を使ってください。

同じ綴りが 2 つの異なるものを指すことを避けるため、この名前は共有していません。ネイティブ側ではチャンネルストリップ、Python CLI 側ではシーンミキサーです。Python CLI の `sonare mix` はシーンミキサーです。
:::

関連: [ミキシングエンジン](./mixing.md)。

## プロジェクト＆ MIDI ワークフロー

`sonare project` コマンドグループは、JSON プロジェクトファイルを使ったヘッドレスのプロジェクト処理や、Standard MIDI File（SMF）／MIDI 2.0 のワークフローを実行します。`project bounce --synth` はクリップ音声の代わりに、プロジェクトの MIDI トラックを内蔵シンセサイザー（NativeSynth）でレンダリングします。このフラグは 2 通りの使い方があります。

- **値なしの `--synth`** — プロジェクトのチャンネルごとの General MIDI プログラムチェンジに追従し、チャンネル 10 は GM ドラムキットマップへルーティングします。プロジェクトが実際の GM プログラムを持っている場合はこちらを使います。
- **`--synth <preset>`** — すべての送出先（デスティネーション）を 1 つの NativeSynth プリセットに固定します。名前の一覧は `sonare project synth-presets` で確認できます。

`project bounce` は `--channels` で指定したチャンネル数で書き出します。正の出力幅は `1`、`2`、`6`、`8` から選びます。省略するか `0` 以下を指定すると、既定の 2 チャンネルになります。マスターが `"5.1"` なら最大 6 チャンネル、`"7.1"` なら最大 8 チャンネルです。モノラル／ステレオのマスター、またはマスターのないシーンでは最大 2 チャンネルまで書き出せます。

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

# 5.1 マスターを 6 チャンネル WAV にレンダリング
sonare project bounce --in project-51.json --sample-rate 48000 --channels 6 -o bounce-51.wav

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
| `sonare project bounce` | プロジェクトを WAV にレンダリング（`sample_rate` が整数ヘルツでないプロジェクトは終了コード 5）。正の `--channels` 出力幅は `1`、`2`、`6`、`8`（既定は `2`）で、マスターレイアウトが上限。モノラル／ステレオ／マスターなしでは最大 2 チャンネル | `--in`, `--sample-rate`, `--frames`, `--block-size`, `--channels`, `--instrument-latency`, `--synth`, `--audio`, `--resolve-audio`, `-o` |
| `sonare project export-smf` | プロジェクトを Standard MIDI File に書き出し | `--in`, `-o` |
| `sonare project import-smf` | Standard MIDI File からプロジェクトを構築 | `--smf`, `-o` |
| `sonare project export-midi2` | プロジェクトを MIDI 2.0 Clip File に書き出し | `--in`, `-o` |
| `sonare project import-midi2` | MIDI 2.0 Clip File からプロジェクトを構築 | `--midi2`, `-o` |

プロジェクトドキュメントは、オーディオクリップのソースを URI 参照としてしか保持しません。デコード済みの PCM は持たないため、オーディオクリップを含むドキュメントは、ソースをバインドするまで無音のままレンダリングされます。`project bounce` にはバインドする方法が 2 つあります。`--audio SOURCE_ID=WAV` は 1 回につき 1 つのソースをバインドし、ソースごとに繰り返し指定します。`--resolve-audio` は代わりに、ドキュメント自身が持つ未解決ソースの `file://` URI を開きます。それ以外のスキームは、そのスキーム名を示すエラーで拒否します。両方を適用してもまだ未解決のソースがあれば、その id と URI、それを解決できたはずのオプション名とともに報告されます。どちらのフロントエンドも両方のオプションを受け付けます。

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

どちらの CLI にも `midi-render` があります。これは常にシンセ経路を使う `project bounce` の別名で、`--synth` を省略すると GM プログラムに追従します。`--channels` の指定値とシーンのマスターによる上限も同じです。オプションの詳細は、このセクション前半の `sonare project` の表を参照してください。

### transcribe

`transcribe` は逆方向のコマンドで、音声を受け取って Standard MIDI File を書き出します（[音を MIDI ノートに変換する](./audio-to-notes.md) を参照）。どちらの CLI にもあります。

```bash
sonare transcribe solo.wav -o solo.mid
sonare transcribe chords.wav -o chords.mid --polyphonic --tempo-bpm 120
```

| オプション | 説明 |
|------------|------|
| `--tempo-bpm` | PPQ グリッドの基準テンポ。省略するとテイクから検出する |
| `--polyphonic` | 重なり合うノートを検出するマルチ F0 経路を使う |
| `--reference-hz` | MIDI ノート番号の基準となるチューニング周波数（既定 440） |
| `--fmin`, `--fmax` | どちらの経路にも使う F0 範囲（Hz）。端点を省略するとモノフォニックは 65/2093、ポリフォニックは 55/1760 になり、明示した端点は選択した経路の既定値を上書きする |
| `--max-polyphony` | ポリフォニックのみ。1 フレームで保持する声数（1〜64、既定 10） |
| `--min-frame-peak-ratio` | ポリフォニックのみ。フレーム内の探索を、そのフレームの最初のピークに対するこの割合を下回った時点で打ち切る（既定 0.20）。有限の 0 以上で、`0` は本当にゼロを意味する |
| `--min-ridge-peak-ratio` | ポリフォニックのみ。リッジ自身のピークに対するこの割合を下回る減衰でリッジを切る（既定 0.10）。値の範囲は同じ |
| `--reattack-ratio` | ポリフォニックのみ。鳴っている最中に同じ音高が再び打たれたとき、サリエンスが直前のレベルのこの倍率を超えて上がると新しいノートとして分ける（既定 2.0）。`0` で分割をやめ、それ以外は 1 より大きい値が必要 |
| `--min-note-division N` | 最短ノートを音価で指定（1〜128）。`32` なら 32 分音符以上のノートを採譜テンポで残す。両方の経路に効き、`--min-note-ms` との併用は拒否される |
| `--min-note-ms` | ノートとして残す最短の長さ（ms。既定はモノフォニック 30、ポリフォニック 60）。`--min-note-division` との併用は拒否される |
| `--segmentation-threshold-cents` | モノフォニックでノートを分割する音高変化量（既定 50 セント）。ポリフォニック経路ではリッジを分割せず、報告する F0 安定度だけに使う |
| `--velocity-floor-db` | ベロシティ 1 に対応するレベル。これで音が捨てられることはない（テイクの大きな音より 36 dB 以上小さい音と -80 dBFS 未満の音は、この値に関係なく捨てる）。負の値である必要がある（既定 -48） |
| `--fixed-velocity N` | すべてのノートをベロシティ N（1〜127）にする。減衰の残りやゴーストはこの場合もレベルゲートで捨てる |
| `--group`, `--channel` | イベントを出力する UMP グループと MIDI チャンネル（既定 0） |

「ポリフォニックのみ」のオプションは、`--polyphonic` なしで指定すると拒否されます（終了コード 3）。

検出したノートはプロジェクトのテンポマップ上に置かれるため、`--tempo-bpm` を明示した場合はトランスクライバへ渡されるのではなく、そのテンポマップとして設定されます。`-o` は必須です。

SoundFont（SF2）とデスティネーションごとのシンセ JSON はこれらの CLI コマンドには接続されていません。SoundFont を使ったバウンスには Project API を使ってください。

関連: [プロジェクト編集](./project-editing.md)、[プロジェクトバウンス](./project-bounce.md)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)。

## ノート編集ワークフロー

### ノート単位の編集

`polyphonic-notes` と `polyphonic-render` は対で使います。前者はポリフォニー解析が見つけたノートを 0 から番号付きで表示し、後者はその番号を使って編集を指定し、テイクを再レンダリングします。どちらも解析を同じ既定値で実行し、フレーミングを変えるオプションを持たないため、一方で読んだ番号がそのまま他方の対象になります。

```bash
sonare polyphonic-notes chord.wav --json
sonare polyphonic-render chord.wav -o out.wav \
  --edit 0.pitch_shift_semitones=2 --edit 3.muted=1
```

`--edit` は 1 回につき 1 つの `NOTE.FIELD=VALUE` を指定し、繰り返し渡せます。指定できるフィールドは `pitch_shift_semitones`、`gain_db`、`time_offset_samples`、`time_stretch_ratio`、`formant_shift_semitones`、`vibrato_depth_change`、`drift_change`、`muted` です。未知のフィールドは無視されるのではなくエラーになります。`polyphonic-render` は `-o` が必須で、`polyphonic-notes` は標準出力に表示するだけなので出力ファイルを取りません。

### スケール補正とボーカルのノート一覧

`pitch-correct-timevarying --mode scale` は、解析フレームごとに目標を選びます。目標は、そのフレームの音程に最も近い音階の音です。目標から `--vibrato-threshold-cents` 以内のフレームはそのまま残し、それ以外のフレームは `--retune-speed-ms` の時定数で目標へ寄せます。そのため、音階の 2 音の中間あたりで歌われ、ビブラートのかかった音は両方の音へ引っ張られ、ビブラートが収まらずに広がります。

`vocal-notes` は、ボーカル編集セッションと同じやり方でテイクを読み、何も書き出しません。各ノートについて、開始と終了（秒とサンプル）、MIDI 値での中心音程、周波数の中央値、`f0_stability`、最も近い音名とそこからのずれ（セント）を出力します。オプションはセッションの解析設定で、省略したものはライブラリの既定値を使います。隣り合う 2 音が 50 セント未満の差で歌われていると境目が遅れて見つかるので、そのときは `--segmentation-threshold-cents` を下げます。セッションの編集とレンダーはバインディングから行います。[オフラインモノフォニックボーカル編集](./vocal-editing.md)と[歌のピッチを直す](./use-cases/vocal-tuning.md)を参照してください。

## 無音でテイクを分割する

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

## 合成

ネイティブ CLI では簡単なテスト信号を生成でき、MIDI プロジェクトを内蔵シンセでレンダリングするコマンドは両方の CLI にあります。

| コマンド | 必須または主なオプション |
|----------|--------------------------|
| `sonare tone -o tone.wav` | `--frequency`; 任意で `--sr`（22050）, `--duration`（1.0）, `--phase`（0.0）, `--amplitude`（1.0） |
| `sonare chirp -o sweep.wav` | `--fmax`; 任意で `--fmin`, `--exponential`, `--sr`（22050）, `--duration`（1.0） |
| `sonare clicks -o clicks.wav` | 秒単位のカンマ区切り `--times`; 任意で `--sr`（22050）, `--length`, `--frequency`（1000.0）, `--click-duration`（0.1） |
| `sonare midi-render --in project.json -o render.wav` | `--in`, `-o`; `--synth PRESET`（省略時は GM プログラムに追従）, `--sample-rate`, `--frames`, `--block-size`, `--channels`（正の出力幅は `1`、`2`、`6`、`8`; 既定は `2`）, `--instrument-latency`。両方の CLI にあり、常にシンセ経路を使う `project bounce` なので、`--audio` と `--resolve-audio` は受け付けない |

`project bounce` とその短縮形 `midi-render` で指定できる正の出力幅は `1`、`2`、`6`、`8` です。`--channels` を省略するか `0` 以下を渡すと、既定の 2 チャンネルになります。要求した出力幅はシーンのマスターのレイアウト幅を超えられません。ただしモノラル／ステレオのマスターと、マスターを持たないシーンは最大 2 チャンネルまで許容します。`"5.1"` は 6 チャンネルまで、`"7.1"` は 8 チャンネルまでです。
