---
title: 音源分離
description: HPSS による倍音成分・打撃成分の分離、NMF 成分の確認、共通マスクによるマルチチャンネルの分解。
---

# 音源分離

音源分離は、1 つの録音から複数の音声信号を作る処理です。持続音とトランジェント（打撃的な成分）を分けるなら HPSS、録音から少数のラベルなしスペクトル成分を分解して取り出すなら NMF、複数チャンネルに同じマスクを使うなら linked NMF を選びます。これらの処理は楽器名を判定するものではなく、ボーカルだけを取り出せる保証もありません。

## 信号処理と学習済みモデルの違い

録音を複数のパートに分ける方法には大きく 2 つの系統があり、得意なことが違います。libsonare が実装しているのは 1 つ目だけです。

- **信号処理による分離**は、信号そのものの性質に基づく規則で分けます。スペクトログラム上で持続音は横線、打撃は縦線になる性質を使う方法（HPSS）や、スペクトログラムを少数の非負のスペクトル形状とその活性度に分解する方法（NMF）がこれにあたります。何も学習しないので、結果はモデルが過去にどんな音楽を見たかに左右されません。
- **学習済みの分離モデル**は、ミックスとその個別ステムの組を大量に使って訓練したニューラルネットワークです。声、ドラムキット、ベースがどう聞こえるかを学習し、名前の付いたステムを返します。完成したミックスからボーカル、ドラム、ベースを取り出す用途では、このページの方式を含むどの信号処理よりも、一般にずっときれいなステムが得られます。

| | 信号処理（このページ） | 学習済みの分離モデル |
|---|---|---|
| 出てくるもの | 構造上のパート。倍音成分と打撃成分、またはラベルのない成分 | ボーカル、ドラム、ベース、その他といった名前付きのステム |
| 密なミックスで重なった楽器 | 混ざったまま残る。ボーカルだけを取り出すルートはない | 多くの場合こちらが有利 |
| 再現性 | 同じ入力と設定からは同じ出力が得られる。乱数は使わない | モデルの重みと推論ランタイムに依存し、モデルの版が変わると結果も変わりうる |
| 必要なもの | エンジンだけ。CPU で動き、ブラウザでも動く | モデルの重み（数十〜数百 MB のことが多い）と推論ランタイム。速度のために GPU を使うことが多い |
| 結果の理由 | マスクや `w`・`h` の行列から読み取れる | 訓練データから学習したもので、失敗する場面を予測しにくい |

使い分けは次のとおりです。

- **ミックスから単独のボーカルやドラムのステムがほしい**: 学習済みの分離モデルを使ってください。libsonare には含まれていません。
- **解析の手がかり、再現できる分割、モデルをダウンロードしないブラウザ内処理がほしい**: このページの方式が合います。打撃成分からビートを、倍音成分からキーを取るのが典型的な使い方です。
- **両方を組み合わせる**: 学習済みモデルで分離し、そのステムを libsonare に渡して解析、採譜、編集、ミキシングを行います。どの呼び出しも単なるサンプル列を受け取るので、どの分離器のステムでも使えます。バンドのミックスを採譜する前にステムが要る理由は [音声を MIDI に](./use-cases/audio-to-midi.md#ステップ-4-—-バンドのミックスには先にステムが要る) で説明しています。

## 方式を選ぶ

ルートは 3 つあり、それぞれ別の問いに答えます。

| ルート | 入力 | 出力 | 入力に戻るか | 向いている用途 |
|--------|------|------|--------------|----------------|
| `hpss(...)` | モノラル信号 1 本 | 倍音成分と打撃成分の信号 | 既定のソフトマスクなら戻る | 持続音と打撃的な成分の分離。たとえば打撃成分からビートを取る |
| `decomposeStems(...)` | モノラル信号 1 本 | `nComponents` 本の信号と、`w`・`h` の行列 | 戻る | ラベルのない成分を 1 つずつ聴いて確かめる |
| `decomposeStemsLinked(...)` | 同じ長さの複数チャンネル | 各成分をチャンネルごとに | 戻る | マルチチャンネル録音のチャンネル間バランスと位相を保った成分 |

<SonareDemo id="stem-decompose" />

デモは倍音成分と打撃成分の分割です。パッドの和音の上に拍ごとの広帯域の打点が乗っており、B 側はその打撃成分だけです。持続するスペクトル線は押し出され、打点は短い縦方向のイベントとして残ります。これは 2 分割の片側であって、複数楽器への分離ではありません。

::: code-group

```typescript [ブラウザ]
import { init, hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare';

await init();

// 固定された軸での 2 分割：持続音かトランジェントか。
const { harmonic, percussive } = hpss({ samples, sampleRate });

// 同じ分割で、残差を表に出す。
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });

// 教師なしの成分分解。どの成分もそのまま聴ける。
const { components, w, h } = decomposeStems({
  samples,
  sampleRate,
  nComponents: 4,
  maskPower: 2, // Wiener 型。分離は強いが、共有する倍音でアーティファクトが増える
});
```

```typescript [Node]
import { hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare-native';

const { harmonic, percussive } = hpss({ samples, sampleRate });
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });
const { components, w, h } = decomposeStems({ samples, sampleRate, nComponents: 4, maskPower: 2 });
```

```python [Python]
import libsonare as sonare

split = sonare.hpss(samples, sample_rate=sample_rate)
harmonic, percussive = split.harmonic, split.percussive
hard = sonare.hpss_with_residual(samples, sample_rate=sample_rate, hard_mask=True)
stems = sonare.decompose_stems(samples, sample_rate=sample_rate, n_components=4, mask_power=2)
components, w, h = stems["components"], stems["w"], stems["h"]
```

```bash [CLI]
sonare hpss recording.wav -o separated.wav
sonare hpss recording.wav --hard-mask --with-residual -o hard.wav
sonare decompose-stems recording.wav --n-components 4 --mask-power 2 -o stems.wav
```

:::

HPSS の `nFft` は 4 以上の偶数です。混合基数 FFT なので、2 のべき乗である必要はありません。`hopLength` は `(0, nFft / 2]` の整数、両方のメディアンカーネルは 524287 以下の正の奇数を指定します。C++ で独自の STFT 設定を渡す場合は、`winLength` と窓関数の組み合わせによって重ね合わせに隙間ができないことも必要です。不正な設定は、周期的な音抜けを生む代わりに拒否します。

| | HPSS | `decomposeStems(...)` |
|---|-------------|------------------------|
| 分割を決めるもの | 固定された軸。時間方向のメディアンフィルタが持続音を、周波数方向がトランジェントを残す | 非負値行列因子分解が、素材そのものから `nComponents` 個の反復するスペクトル形状を学習する |
| 返るもの | `hpss` は倍音成分と打撃成分の 2 信号を返す。`hpssWithResidual` は残差も返す | 成分ごとの信号 1 本ずつと、成分行列 `w`・アクティベーション行列 `h` |
| ラベル | あらかじめ分かっている | 無い。`w` と `h` を見てどの成分が何かを判断する |
| 再構成 | 既定のソフトマスクでは倍音成分と打撃成分の和が入力に戻る。ハードマスクでは残差が生じることがある | モデルにエネルギーがある領域でマスクの和が 1 になるため、成分を足すと入力に戻る |
| 位相 | 元のまま | 元のまま。複素スペクトログラムにマスクを掛けるので、各成分がそのまま聴ける |

以下の NMF デモでは 4 つの成分を個別に再生できます。操作中の処理時間を抑えるため、反復回数は 30 回です。成分に楽器名は付いていません。

<SonareDemo id="nmf-stems" />

主な既定値を挙げます。メディアンフィルタのカーネルはどちらも 31 で、既定のソフトマスクでは 2 つのマスクの和がすでに 1 になるため `hpssWithResidual(...)` の残差は無音です。どちらの成分にも割り当てられなかった帯域を残差として得たい場合は `hardMask: true` を渡します。`decomposeStems(...)` と `decomposeStemsLinked(...)` の NMF の既定値は同じで、成分 4 個、`nFft: 2048`、`hopLength: 512`、反復 100 回、`beta: 2`（Frobenius。Kullback-Leibler なら `1`）、`init: 'random'`、`maskPower: 1`（振幅比）です。どちらのステム関数も `sampleRate` を省略すると `22050` を使うため、録音の実際のレートを渡してください。

マルチチャンネルの録音には `decomposeStemsLinked(...)` を使います。各チャンネルの振幅スペクトログラムを平均して 1 つの NMF モデルと成分マスクを作り、そのマスクを各チャンネルの元の複素スペクトログラムへ同じまま適用します。各時間・周波数ビン内のチャンネル間のレベル差と位相差を保ち、左右で別々のマスクを選ぶことを避けます。ただし、各成分に残る内容はフルミックスと異なるため、分離した成分のステレオの広がりや定位がフルミックスと同じになる保証はありません。

入力は同じ長さの `Float32Array` を少なくとも 1 つ渡し、チャンネル数を 64 以下にします。結果の `components[k][c]` は成分 `k` のチャンネル `c` の信号です。`w`、`h`、`sampleRate` の意味は `decomposeStems(...)` と同じです。1 チャンネルだけ渡すと、同じオプションの `decomposeStems(...)` とビット単位で一致します。

::: code-group

```typescript [Browser]
import { init, decomposeStemsLinked } from '@libraz/libsonare';

await init();

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // 同じ長さの Float32Array
  sampleRate,
  nComponents: 4,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
console.log(linked.w.length, linked.h.length);
```

```typescript [Node]
import { decomposeStemsLinked } from '@libraz/libsonare-native';

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // 同じ長さの Float32Array
  sampleRate,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
```

```python [Python]
import libsonare as sonare

linked = sonare.decompose_stems_linked(
    [left_channel, right_channel], sample_rate=sample_rate, n_components=4
)
first_left = linked["components"][0][0]
first_right = linked["components"][0][1]
print(linked["w"].shape, linked["h"].shape)
```

```bash [CLI]
# CLI はモノラルの `decompose-stems` だけを提供します。
# 複数チャンネルで 1 つの NMF モデルを共有する場合はライブラリ API を使います。
```

:::

どのルートも、密なミックスからボーカルだけを取り出すものではありません（[信号処理と学習済みモデルの違い](#信号処理と学習済みモデルの違い)を参照）。得意なのは後段の推定器の仕事を楽にすることです。打撃成分でビート追跡、倍音成分でクロマとキー、リードが分離できた成分でピッチ追跡、またはステレオの定位を保ったマルチチャンネル処理、といった使い方になります。

## 関連ページ

[楽曲解析](./analysis.md)、[音声から音符へ](./audio-to-notes.md)、[メロディとピッチ](./glossary/analysis/melody-pitch.md)
