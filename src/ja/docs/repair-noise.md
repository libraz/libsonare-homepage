---
title: 広帯域ノイズとハムのリペア
description: ノイズフロアまたは電源ハムを検出し、対応する古典的リペア段を選び、libsonare でチャンネル間の関係を保つ方法です。
---

# 広帯域ノイズとハムのリペア

広帯域ノイズと電源ハムは別の欠陥です。デノイズは時間変化するスペクトルを推定してゲインマスクを適用します。デハムは基音と倍音を追跡します。実際に聴こえる欠陥に対応する検出器を使い、持続する音楽的な音がノイズと誤認されていないか確認してください。

## 段を選ぶ

| 欠陥 | 検出 | リペア | 主なリスク |
|---|---|---|---|
| 定常的なヒス、マイクのノイズフロア、テープノイズ | `masteringRepairDetectNoiseFloor` | `masteringRepairDenoiseClassical` | 静かな音楽も推定ノイズフロアと一緒に下がることがある。 |
| 50/60 Hz の音と倍音 | `masteringRepairDetectHum` | `masteringRepairDehum` | 同じ周波数にある意図した音楽成分もノッチで削ることがある。 |

どちらの段もラウドネスプロセッサではありません。完成したミックスから音源を分離する処理でも、クリック、クリップ、部屋の残響を直す処理でもありません。

## 先に検出してから適用する

リクエストオブジェクト形式にすると、サンプルレートとオプションが明示されます。`decodedMonoPcm` は `Float32Array` とします。`nFft` より短いバッファは解析のためにパディングされ、元の長さで返ります。

```ts
import {
  init,
  masteringRepairDenoiseClassical,
  masteringRepairDehum,
  masteringRepairDetectHum,
  masteringRepairDetectNoiseFloor,
} from '@libraz/libsonare';

await init();

const sampleRate = 48_000;
const samples = decodedMonoPcm;
const noise = masteringRepairDetectNoiseFloor({
  samples,
  sampleRate,
  nFft: 1024,
});
const hum = masteringRepairDetectHum({ samples, sampleRate });

console.log(noise.floorDbfs, noise.bandFloorDbfs);
console.log(hum.fundamentalHz, hum.harmonics, hum.harmonicDbfs);

// レポートと試聴で根拠を確認した段だけを残す。
const dehummed = masteringRepairDehum({
  samples,
  sampleRate,
  adaptive: true,
});
const cleaned = masteringRepairDenoiseClassical({
  samples: dehummed,
  sampleRate,
  reductionDb: 26,
});
```

この例は固定されたリペア順、つまりデハムをデノイズより先に置く順序に従っています。アプリケーションでは、値が正だったというだけで全量を除去せず、レポートと試聴で判断して各呼び出しを条件分岐してください。

## デノイズ設定

`masteringRepairDenoiseClassical` は STFT 領域で動く古典的デノイザーです。オプションは公開 TypeScript の `DenoiseClassicalOptions` です。オーバーロードの全体は API リファレンスを参照してください。

| オプション | 値または既定値 | 用途 |
|---|---|---|
| `mode` | 既定は `logMmse`、ほかに `mmseStsa`、`spectralSubtraction` | ゲイン関数を選ぶ。スペクトルサブトラクションでは `overSubtraction` と `spectralFloor` も読む。 |
| `noiseEstimator` | 既定は `quantile`、ほかに `mcra`、`imcra`、`spp` | ノイズスペクトルの追跡方法を選ぶ。チェーンの上書きも同じ名前を受け付ける（`repair.denoise.noiseEstimator`、`repair.denoise.mode`、`repair.dehum.mode`）。ストリーミングのマスタリングチェーンは既定が `spp` で、`quantile` は名前を示して拒否する。機能カタログが記述するのはこのリアルタイムインサートなので、既定値は `spp` と書かれ、`quantile` は含まれない。 |
| `nFft` / `hopLength` | 既定は `1024` / `256` | STFT の窓長とホップ幅を設定する。制約は下記を参照。 |
| `reductionDb` | 既定は `26`、有限で `[0, 120]` | ゲインマスクの各ビンに許す最大減衰を設定する。ラウドネス目標ではなく残留ノイズの下限。 |
| `noiseEstimationQuantile` | 既定は `0.1` | ノイズスペクトルの推定に使う、静かなフレームの割合。 |
| `ddAlpha`、`speechPresenceGain`、`gainSmoothing` | API 型を参照 | decision-directed 平滑化と MMSE ゲイン経路を制御する。 |

`reductionDb: 26` のとき、マスクのゲイン下限は約 `0.0501`、つまりビンごとの最大減衰量 26 dB です。広帯域ノイズ自体が 26 dB 下がることを保証する値ではありません。大きな値ならより深く減衰できますが、推定の信頼性が上がるわけではありません。レポートの `maxReductionDb` と `floorLimitedFraction` で、この上限が結果を決めたかを確認できます。

`nFft` は `4` から `524288` までの 2 のべき乗です。`hopLength` は `(0, nFft / 2]` に入り、周期 Hann の解析窓と対称 Hann の合成窓で、すべてのオーバーラップ位置が覆われる必要があります。覆われない位置が残る組み合わせは拒否されます。オフラインのモノラル、ステレオ、リンク形式のリペアと `StreamingDenoise`（`StreamingMasteringChain` のライブ経路を含む）は、このチェックを共有します。ストリーミングではさらに、再帰的な推定器（`mcra`、`imcra`、`spp`）が必要です。

## デハム設定

`masteringRepairDehum` は基音とその倍音を除去します。すべてのオプションに上限があり、超えると `InvalidParameter` を投げます。

| オプション | 既定値 | 受け付ける範囲 | 用途 |
|---|---|---|---|
| `fundamentalHz` | `50` | `(0, 5000]` | 除去する電源周波数。電源が 60 Hz の地域では `60` にする。 |
| `harmonics` | `4` | `[1, 16]` | 基音を含む倍音の数。 |
| `mode` | `subtract` | `subtract`、`notch` | 追跡した正弦波を打ち消すか、ノッチで除去するか。 |
| `q` | `20` | `(0, 100]` | 各キャンセラーまたはノッチの選択度。 |
| `adaptive` | `false` | 真偽値 | `fundamentalHz` を信用せず、実際の基音を探索する。 |
| `searchRangeHz` | `2` | `[0, 100]` | `fundamentalHz` を中心とする適応探索の片側幅。 |
| `adaptation`、`pllBandwidth` | `0.25`、`0.01` | `[0, 1]` | 適応追跡の速さ。 |
| `frameSize` | `2048` | `[16, 16384]` | 適応トラッカーの解析フレーム。 |

`subtract` モードでは、各倍音キャンセラーを 0 から始めず、冒頭の窓で全倍音の参照信号を使った 1 回の最小二乗フィットから始めます。そのため短いクリップでも最初のサンプルから減衰します。窓が短くて倍音を区別できない場合は、キャンセラーを初期化しません。22.05 kHz で 440 Hz のトーンに 50 Hz と 100 Hz のハムが重なった 0.25 秒のクリップでは、先頭 1000 サンプルの RMS が 0.1675 から 0.0355 に下がり、トーンだけが残りました。

<SonareDemo id="repair-dehum" />

## チャンネルの扱い

1 チャンネルにはモノラル形式、左右のペアにはステレオ形式、複数チャンネルに 1 つのマスクを使う場合はリンク形式を使います。

```ts
import {
  masteringRepairDenoiseClassicalLinked,
  masteringRepairDenoiseClassicalStereo,
} from '@libraz/libsonare';

const stereo = masteringRepairDenoiseClassicalStereo({
  left,
  right,
  sampleRate,
  reductionDb: 26,
});

const linked = masteringRepairDenoiseClassicalLinked({
  channels: [frontLeft, frontRight, center],
  sampleRate,
  reductionDb: 26,
});
```

ステレオ形式とリンク形式はチャンネルの合算パワーからマスクを作り、すべてのチャンネルへ同じマスクを適用します。そのためチャンネル間のレベル差と位相差は動きません。レポートはペアまたは集合について 1 つです。`floorDbfs` は絶対レベルで、同じチャンネルを 2 本入れるとモノラルより約 3.01 dB、3 本なら約 4.77 dB 高くなります。同じチャンネル数で測った値どうしだけを比較してください。すべての入力チャンネルは同じ長さでなければならず、`nFft` より短い入力は解析のためにパディングされます。

`masteringRepairDehumStereo` はチャンネルごとに独立したフィルターまたはキャンセラー状態を持ちますが、`adaptive: true` では 2 チャンネルで 1 つの基音を追跡します。ハムが強いチャンネルを追跡の参照に選び、元の左右チャンネルの投影エネルギーを合算して周波数を探索し、追跡した 1 つの基音を両方の経路へ渡します。そのため片側だけのハムや逆位相のハムも追跡器に見え、各チャンネルの振幅と位相はそれぞれの状態で処理されます。既定の `adaptive: false` では、各チャンネルが設定した周波数を独立に処理します。

## 結果を読む

`masteringRepairDetectNoiseFloor` はゲインマスクを適用する前の `floorDbfs` と 32 帯域の `bandFloorDbfs` を返します。減衰量は返しません。`masteringRepairNoiseBandBins({ nFft, sampleRate })` はこの 32 帯域の 33 個のビン境界を返し、帯域 `k` は `bins[k]` から `bins[k + 1]` までです。境界が一致する帯域は空で、その値は測定値ではなく、帯域が空であることを示す固定値です。

モノラルのデノイズ呼び出しはサンプルだけを返します。減衰量が必要なときは、`masteringRepairDenoiseClassicalStereo`、`masteringRepairDenoiseClassicalLinked`（1 チャンネルのリンク呼び出しも可）、または `masteringRepairApply` を使ってください。そのレポートには次があります。

- `meanReductionDb` はマスクの平均減衰量です。
- `maxReductionDb` は実際に適用した最大減衰量です。
- `floorLimitedFraction` は `reductionDb` に到達したマスクセルの割合です。

これらはプロセッサが行ったことを表します。LUFS の整合ではなく、残ったノイズが聴こえないことの証明でもありません。納品目標に必要なら、統合ラウドネスを別に測定してください。

## デノイズ A/B を聴く

<SonareDemo id="repair-denoise" />

この A/B は古典的デノイザーを使い、ラウドネス整合を行わないため、ノイズと音色の変化をそのまま確認できます。

## 限界

デノイザーはバッファ自身からノイズを推定します。較正音、ドローン、長く伸ばした音はノイズと見なされ、ノイズフロアと一緒に減衰することがあります。古典的デノイズは学習済みモデルでもありません。音声強調用のニューラルネットワークは、とくに時間とともに変わるノイズを声から一般によりきれいに取り除きます。一方、このデノイザーは決定論的で、モデルの重みを必要としません。詳しくは [信号処理と学習済みモデルの違い](./source-separation.md#信号処理と学習済みモデルの違い) を参照してください。検出器と古典的なヘルパー呼び出しはオフラインです。`StreamingDenoise` と `StreamingMasteringChain` では `mcra`、`imcra`、`spp` によるデノイズをブロック処理できますが、全信号を必要とする `quantile` は拒否されます。共通の順序は [オーディオリペアの流れ](./audio-repair.md)、正確なレポート型は [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。
