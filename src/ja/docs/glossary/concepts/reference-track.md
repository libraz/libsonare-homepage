---
title: リファレンストラック
description: 他のマスターを盲目的にコピーせず、比較基準として使う方法。
---

# リファレンストラック

リファレンストラックは、比較基準として使う完成済みの曲やマスターです。仕上がりがどんな感触であるべきかを確かめるために使います。

聴いた音の記憶は当てになりません。しばらく同じ曲を触っていると、今の音が普通に感じられてきます。リファレンスは、ラウドネス、明るさ、低域バランス、ステレオ幅、ボーカルの存在感、密度を判断するための外部基準になります。

## リファレンスの役割

良いリファレンスは、コピーする対象ではなく較正済みの比較対象です。

次のような大まかな差を見つけるために使います。

| 領域 | 確認したい問い |
|------|----------------|
| ラウドネス | 実用的な範囲に収まっているか、作業環境で大きく聞こえているだけではないか。 |
| 低域 | 低域が制御されているか、グルーヴを濁していないか。 |
| 中域 | ボーカルや主役の要素が安定しているか。 |
| 高域 | 高域が開いているか、刺さるか、鈍いか。 |
| ステレオ | 広がりが楽曲を助けているか、[モノラル](./mono-compatibility.md)の芯を弱めていないか。 |
| 密度 | 動きを潰さずに、求められる仕上げ密度に達しているか。 |

リファレンスは、目指すスタイル、アレンジ密度、リリース文脈が近いものを選びます。余白の多いアコースティック曲を、密度の高いダンス系のマスターに寄せる必要はありません。

## よくある失敗

一番多い失敗は、[ラウドネスを揃えず](./loudness-matching.md)にリファレンスと比べることです。商用リファレンスは自分のミックスより大きく、密度も高いことが多く、それだけで良く聞こえてしまいます。

もう 1 つの失敗は、アレンジが違いすぎる曲を選ぶことです。楽器数、ボーカルの明るさ、ベースの役割が違うリファレンスのスペクトル形状をコピーしても、自分の曲には合いません。

リファレンスは判断の助けであって、元の音源の個性を消す道具ではありません。

## リファレンスマッチ EQ

リファレンスマッチ EQ は、元音源とリファレンスのスペクトルを比較し、元音源を近づけるための制限付き EQ カーブを適用します。学習や穏やかなトーン合わせには有効です。

ただし、強くはかけません。大きなリファレンスマッチ EQ のカーブが必要になるなら、元音源とリファレンスの性質が根本的に違っています。その場合は完全なマッチングより、広めの手動 EQ やミックスの修正のほうが安全です。

<SonareDemo id="tilt-eq" />

## libsonare で測る

比較は、[LUFS](../lufs.md) と[クレストファクター](./crest-factor.md)の読み値から始め、次にスペクトルへ進みます。`match.tonalBalance` は両トラックの帯域別レベルを返し、`match.matchEqCurve` は元音源をリファレンスへ近づけるゲインカーブを返します。どちらも、ペア解析の呼び出しから JSON で返ります。

::: code-group

```typescript [Browser]
import { init, lufs, meteringCrestFactorDb, masteringPairAnalyze } from '@libraz/libsonare';

await init();

const sourceLufs = lufs(source, sampleRate).integratedLufs;
const referenceLufs = lufs(reference, referenceSampleRate).integratedLufs;
const lufsGap = referenceLufs - sourceLufs;
const crestGap = meteringCrestFactorDb(reference, referenceSampleRate)
  - meteringCrestFactorDb(source, sampleRate);

const curve = JSON.parse(masteringPairAnalyze({
  analysisName: 'match.matchEqCurve',
  source,
  reference,
  sampleRate,
  referenceSampleRate,   // sampleRate と異なる場合は sampleRate にリサンプルされます
}));
// curve.frequencies と curve.gainDb
```

```python [Python]
import json
import libsonare as sonare

source_lufs = sonare.lufs(source, sample_rate).integrated_lufs
reference_lufs = sonare.lufs(reference, reference_sample_rate).integrated_lufs
lufs_gap = reference_lufs - source_lufs

curve = json.loads(sonare.mastering_pair_analyze(
    "match.matchEqCurve", source, reference, sample_rate,
    reference_sample_rate=reference_sample_rate,
))
```

```bash [CLI]
sonare mastering-pair-analyze source.wav --analysis match.matchEqCurve --reference reference.wav
sonare mastering-pair-analyze source.wav --analysis match.tonalBalance --reference reference.wav
```

:::

## libsonare デモでの扱い

デモでは、比較用のリファレンストラックを読み込めます。基本的なリファレンス指標を表示し、ローカルの WebAssembly ワーカー上でリファレンスマッチ EQ を実行できます。

マッチ処理には意図的に制限を入れています。返ってきたカーブを約 1/6 オクターブで平滑化し、最大 ±6 dB のピークバンド 4 本で近似するので、リファレンスのスペクトルをそのままコピーするのではなく、マスタリングとして扱える穏やかな範囲に収まります。

:::: details 実装メモ

リファレンスファイルもソースと同じようにブラウザ内でデコードされます。リファレンスのサンプルレートがソースと異なる場合は、ワーカーが読み込み時にエンジンの `resample` でソースのレートへリサンプルします。マッチ関数を直接呼ぶ場合は、`referenceSampleRate` を渡せば関数側でリサンプルします。

リファレンスマッチ EQ の経路では、ソースとリファレンスをモノラルにミックスしてスペクトルを比較し、その差を平滑化したうえで、最大ゲイン変化量を制限します。生のスペクトル差分には、マスタリング処理としては不要な狭いスパイクやノッチが入りやすいため、この制限を入れています。

::::

関連: [ラウドネスマッチング](./loudness-matching.md)、[ダイナミックレンジ](./dynamic-range.md)、[モノラル互換性](./mono-compatibility.md)、[LUFS](../lufs.md)
