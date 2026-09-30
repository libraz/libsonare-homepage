---
title: 音源分離
description: HPSS による調波・打撃成分の分離、NMF 成分の確認、共通マスクによるマルチチャンネルの分解。
---

# 音源分離

音源分離は、1つの録音から複数の音声信号を作る処理です。持続音とトランジェントを分けるなら HPSS、スペクトルの特徴を学習して成分に分けるなら NMF、複数チャンネルに同じマスクを使うなら linked NMF を選びます。これらの処理は楽器名を判定するものではなく、ボーカルだけを取り出せる保証もありません。

## 方式を選ぶ

ルートは 3 つあり、それぞれ別の問いに答えます。

<SonareDemo id="stem-decompose" />

上のデモは倍音成分と打撃成分の分割です。パッドの和音の上に拍ごとの広帯域の打点が乗っており、B 側はその打撃成分だけです。持続するスペクトル線は押し出され、打点は短い縦方向のイベントとして残ります。これは 2 分割の片側であって、複数楽器への分離ではありません。

```typescript
import { hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare';

// 固定された軸での 2 分割：持続音か過渡音か。
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

| | HPSS | `decomposeStems(...)` |
|---|-------------|------------------------|
| 分割を決めるもの | 固定された軸。時間方向のメディアンフィルタが持続音を、周波数方向が過渡音を残す | 非負値行列因子分解が、素材そのものから `nComponents` 個の反復するスペクトル形状を学習する |
| 返るもの | `hpss` は調波成分と打撃成分の 2 信号を返す。`hpssWithResidual` は残差も返す | 成分ごとの信号 1 本ずつと、成分行列 `w`・アクティベーション行列 `h` |
| ラベル | あらかじめ分かっている | 無い。`w` と `h` を見てどの成分が何かを判断する |
| 再構成 | 既定のソフトマスクでは調波成分と打撃成分の和が入力に戻る。ハードマスクでは残差が生じることがある | モデルにエネルギーがある領域でマスクの和が 1 になるため、成分を足すと入力に戻る |
| 位相 | 元のまま | 元のまま。複素スペクトログラムにマスクを掛けるので、各成分がそのまま聴ける |

以下の NMF デモでは 4 つの成分を個別に再生できます。操作中の処理時間を抑えるため、反復回数は 30 回です。成分に楽器名は付いていません。

<SonareDemo id="nmf-stems" />

覚えておくとよい既定値。メディアンフィルタのカーネルはどちらも 31 で、既定のソフトマスクでは 2 つのマスクの和がすでに 1 になるため `hpssWithResidual(...)` の残差は無音です。どちらの成分にも割り当てられなかった帯域を残差として得たい場合は `hardMask: true` を渡します。`decomposeStems(...)` と `decomposeStemsLinked(...)` の NMF の既定値は同じで、成分 4 個、`nFft: 2048`、`hopLength: 512`、反復 100 回、`beta: 2`（Frobenius。Kullback-Leibler なら `1`）、`init: 'random'`、`maskPower: 1`（振幅比）です。`decomposeStemsLinked(...)` は `sampleRate` を省略すると `22050` を使います。

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

どのルートも学習済みの楽器分離器ではなく、密なミックスからきれいなボーカルだけを取り出すものでもありません。得意なのは後段の推定器の仕事を楽にすることです。打撃成分でビート追跡、倍音成分でクロマとキー、リードが分離できた成分でピッチ追跡、またはステレオの定位を保ったマルチチャンネル処理、といった使い方になります。

## 関連ページ

[楽曲解析](./analysis.md)、[音声から音符へ](./audio-to-notes.md)、[メロディとピッチ](./glossary/analysis/melody-pitch.md)
