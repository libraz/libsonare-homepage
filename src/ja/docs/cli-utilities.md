---
title: CLI ユーティリティ
description: librosa 互換のためにネイティブ sonare CLI が持つ低レベルの数値・フレーム・変換ヘルパーと、tune-to-midi、system-info のリファレンス。
---

# CLI ユーティリティ

ネイティブの `sonare-cli` には、`librosa.util` と librosa の変換関数に対応する低レベルのヘルパーがあります。フレーム／サンプル変換、4 種のデシベル変換、フレーム分割、パディング、長さ調整、ピーク検出、ベクトル正規化です。librosa から移植したスクリプトの数値を、バインディングを書かずにエンジン側と突き合わせるためのもので、想定する読者は [CLI コマンド](./cli-commands.md) とは異なります。曲を解析する人ではなく、計算を再現する人向けです。このページの例は `sonare` と書いていますが、ネイティブ CLI のみと記したコマンドは `sonare-cli` に読み替えてください。

12 個の数値ヘルパーはオーディオファイルを取りません。`frames-to-samples --frames N` と `samples-to-frames --samples N` の 2 つは整数を 1 つ受け取り、残りの 10 個は `--values` でカンマ区切りの数列を受け取ります。`--values` は必須で、空の列や解釈できない要素は拒否されます（`invalid float value in --values: x`）。通常の出力は結果をカンマ区切りで 1 行に並べたもので、`--json` は素の JSON 配列を返します。例外は各表に記しています。ページ末尾の 2 つはさらに性格が違い、`tune-to-midi` はオーディオファイルを取って両方の CLI にあり、`system-info` は引数を一切取りません。

## フレームとサンプルの変換

| コマンド | 結果 | オプション |
|----------|------|-----------|
| `sonare frames-to-samples --frames 10` | フレーム `N` のサンプル位置: `N * hop + n_fft / 2` | `--frames`（省略時は 0）, `--n-fft`（2048）, `--hop-length`（512） |
| `sonare samples-to-frames --samples 6144` | サンプル `N` を含むフレーム番号: `floor((N - n_fft / 2) / hop)` | `--samples`（省略時は 0）, `--n-fft`（2048）, `--hop-length`（512） |

中心オフセットは既定で有効です。CLI の `--n-fft` の既定値が 2048 なのに対し、librosa の `n_fft` 引数は省略時に無効になるためです。素の `N * hop` で変換したい場合は `--n-fft 0` を渡してください。`--json` は素の配列ではなく、`{"samples": N}` または `{"frames": N}` の形で数値を返します。

```bash
sonare frames-to-samples --frames 10              # 6144
sonare frames-to-samples --frames 10 --n-fft 0    # 5120
sonare samples-to-frames --samples 6144 --json    # {"frames": 10}
```

## デシベル変換

| コマンド | 結果 | オプション |
|----------|------|-----------|
| `sonare power-to-db --values 1,0.1` | `10 * log10(max(v, amin)) - 10 * log10(max(ref, amin))` を計算し、`max - top_db` を下限として切り上げる | `--ref`（1.0）, `--amin`（1e-10）, `--top-db`（80.0） |
| `sonare amplitude-to-db --values 1,0.1` | 入力を 2 乗して同じ計算をする。つまり振幅の `20 * log10` | `--ref`（1.0）, `--amin`（1e-5）, `--top-db`（80.0） |
| `sonare db-to-power --values 0,-10` | `ref * 10^(v / 10)` | `--ref`（1.0） |
| `sonare db-to-amplitude --values 0,-20` | `ref * 10^(v / 20)` | `--ref`（1.0） |

`--ref` に 0 以下を渡すと、列の中で最大の絶対値が基準になり、最も大きい要素が 0 dB になります。`--top-db` に負の値を渡すと下限が無効になります。`--amin` は正の値でなければなりません。2 つの `--amin` の既定値が異なるのは意図的で、振幅側の下限はパワー側の下限の平方根です。これにより、2 乗した値に対する `power-to-db` と `amplitude-to-db` の結果が一致します。

```bash
sonare amplitude-to-db --values 1,0.1          # 0,-20
sonare db-to-amplitude --values 0,-20 --json   # [1, 0.1]
```

## フレーム分割、パディング、長さ調整

| コマンド | 結果 | オプション |
|----------|------|-----------|
| `sonare frame-signal --values ... --frame-length 4 --hop-length 2` | 列を重なりのあるフレームに切り、行ごとに平坦化する。フレーム `i` は `[i * L, (i + 1) * L)` の要素 | `--frame-length`（`--n-fft` の値。2048）, `--hop-length`（512） |
| `sonare pad-center --values 1,2,3 --size 7` | 列を `size` 要素の中央に置き、左側に `(size - n) / 2` 個のパディングを入れる | `--size`（**必須**。列の長さ以上）, `--pad-value`（0.0） |
| `sonare fix-length --values 1,2,3 --size 5` | ちょうど `size` 要素にする。右側を切り詰めるか、右側にパディングする | `--size`（**必須**）, `--pad-value`（0.0） |
| `sonare fix-frames --values 0,3,3,7 --x-max 6` | 整数のフレーム番号列から `[x-min, x-max]` の外にある要素を落とし、境界値を挿入し、重複を除く | `--x-min`（0）, `--x-max`（-1。上限なし）, `--no-pad`（境界値を挿入しない） |

`frame-signal` は `librosa.util.frame` と同じ動作です。フレーム数は `floor((n - L) / hop) + 1` で、フレーム長より短い列からは何も出ません。`--json` は他のヘルパーが返す素の配列ではなく、`{"n_frames": N, "frames": [...]}` というオブジェクトです。フレーム長の既定値は CLI の `--n-fft` なので、手で打った短い列に対しては必ず `--frame-length` を渡すことになります。

`fix-frames` は整数を読む唯一のヘルパーで、この CLI が librosa から離れる唯一の箇所でもあります。列は単調非減少でなければならず、`--x-min` が負でない限り負の要素は拒否されます。空の列は `[x-min]` にパディングされるのではなくエラーになります。検出器が出したわけではないフレーム 0 は、本物のフレームと区別がつかないからです。

```bash
sonare frame-signal --values 1,2,3,4,5,6 --frame-length 4 --hop-length 2 --json
# {"n_frames": 2, "frames": [1, 2, 3, 4, 3, 4, 5, 6]}
sonare pad-center --values 1,2,3 --size 7        # 0,0,1,2,3,0,0
sonare fix-length --values 1,2,3 --size 5        # 1,2,3,0,0
sonare fix-frames --values 0,3,3,7 --x-max 6     # 0,3,6
```

## ピーク検出と正規化

| コマンド | 結果 | オプション |
|----------|------|-----------|
| `sonare peak-pick --values ...` | `librosa.util.peak_pick` と同じ規則で局所最大の位置を返す。`x[i]` が `[i - pre_max, i + post_max)` の最大値で、`[i - pre_avg, i + post_avg)` の平均に `delta` を足した値以上で、直前のピークから `wait` 要素以上離れているときにピーク | `--pre-max`（1）, `--post-max`（1）, `--pre-avg`（1）, `--post-avg`（1）, `--delta`（0.0）, `--wait`（0） |
| `sonare vector-normalize --values 3,4 --norm-type 2` | 列をそのノルムで割る | `--norm-type`（0）: 0 は最大絶対値、1 は L1、2 は L2、3 はパワー（2 乗和）; `--threshold`（1e-12） |

`peak-pick` は整数の位置を返すので、`--json` は整数配列です。`--norm-type` が 0〜3 の外なら、最大絶対値ノルムへ黙って戻るのではなく無効パラメータとして拒否されます。`--threshold` は、ノルムがこの値を下回ったときに 0 近くの値で割る代わりに列をそのまま返すしきい値で、librosa の `fill=None` と同じ動作です。

```bash
sonare vector-normalize --values 3,4 --norm-type 2   # 0.6,0.8
```

## tune-to-midi

`tune-to-midi` は、標準 MIDI ファイルが持つメロディに合わせて録音テイクを補正します。テイクのピッチをライブラリ既定の設定の pYIN で追跡してノートに分割し、各ノートに最も長く重なる参照ノートのピッチシフトを割り当ててレンダリングします。ノートとターゲットを対応付ける規則は [`noteTargetsFromSmf` と `assignNoteTargets`](./project-editing-midi.md#smf-を参照メロディにする-ノートターゲット) と同じで、このコマンドはその組をシェルから使うものです。両方の CLI にあり、テイクをファイル引数として受け取ります。

```bash
sonare tune-to-midi take.wav --reference-smf melody.mid -o tuned.wav
sonare tune-to-midi take.wav --reference-smf song.mid --track 2 --unmatched-policy mute -o tuned.wav --json
```

| オプション | 既定値 | 説明 |
|------------|--------|------|
| `--reference-smf FILE` | **必須** | 参照メロディを持つ SMF |
| `--track N` | 0 | ファイルの何番目の MIDI トラックをメロディとするか。該当するトラックがない番号は、解析を始める前に拒否される |
| `--unmatched-policy` | `leave` | どのターゲットにも届かないノートの扱い。`leave` は録音のまま、`mute` はその区間を無音に、`nearest` は時間的に最も近いターゲットを距離に関係なく採用する |
| `--min-overlap-ratio` | 0.5 | ターゲットとして数えるために必要な、ノートとの重なりの割合（0〜1） |
| `--max-correction-semitones` | 12 | 割り当てられたシフトはここで飽和し、拒否はされない |
| `-o` | **必須** | 補正後の WAV |

`--json` は `output`、`assigned_count`、`note_count`、`length`、`sample_rate`、`duration` を返します。`assigned_count` が 0 でもエラーにはなりません。参照がテイクと噛み合わなかったという結果なので、出力ファイルを使う前に確認してください。

## system-info

`system-info` は、マシンの資源とこのビルドの並列スケジューラがそれをどう使うかを表示します。論理／物理コア数、メモリの合計と空き、並列実行が有効かどうか、そしてコア数から導いたワーカー数と戦略です。ネイティブ CLI のみで、引数は取りません。

```bash
sonare system-info
sonare system-info --json
```

**出力:**
```
System Information
  CPU Cores: 8 logical, 4 physical
  Memory: 16.0 GB total, 9.3 GB available

Parallel Configuration
  Parallel Enabled: yes
  Workers: 6
  Strategy: aggressive_parallel
```

戦略は `sequential_only`、`conservative_parallel`、`balanced_parallel`、`aggressive_parallel` のいずれかで、論理コア数 1、2、4、8 を境に選ばれます。`--json` は同じ値を `cpu`、`memory`、`parallel` の下に入れ子で返します。バッチが想定より遅いときや、`sonare` プロセスをいくつ並べて走らせるか決める前に実行してください。ビルドが何をデコードでき、どの機能群がコンパイルされているかを知るコマンドは [`doctor`](./cli.md#doctor) です。
