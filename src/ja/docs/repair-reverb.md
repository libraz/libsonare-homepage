---
title: 拡散残響のリペア
description: 後期の拡散した余韻を測定し、libsonare のオフライン古典的デリバーブを設定し、ルーム推定の限界を理解します。
---

# 拡散残響のリペア

`masteringRepairDereverbClassical` は、直接音を覆う持続的で拡散した余韻を対象にします。STFT 領域のスペクトルサブトラクションを使い、任意で WPE の前段を実行できます。オフラインのリストレーション段であり、ルームインパルス応答のデコンボリューションでも、完全にドライな音源を復元する方法でもありません。

## デリバーブ前に検出する

検出器はデリバーブが使う統計量を返します。ISO 3382 の RT60 を計算するものではありません。等価ルームの推定が必要な場合は `estimateRoom` を使い、リペアの設定に使う前に信頼度を確認してください。

```ts
import {
  estimateRoom,
  init,
  masteringRepairDereverbClassical,
  masteringRepairDereverbConfigForRoom,
  masteringRepairDetectReverb,
} from '@libraz/libsonare';

await init();

const detection = masteringRepairDetectReverb({
  samples,
  sampleRate,
});
const estimate = estimateRoom(samples, sampleRate, { nOctaveBands: 6 });
console.log(detection.lateDecayRatioDb, detection.latePredictability);
console.log(estimate.confidence, estimate.rt60Bands, estimate.volume);

const config = masteringRepairDereverbConfigForRoom(estimate, {
  attenuation: 0.7,
});
const cleaned = masteringRepairDereverbClassical({
  samples,
  sampleRate,
  ...config,
});
```

`configForRoom` はルーム推定を読み、完全なデリバーブ設定を返します。それでも試聴は必要です。信頼度の低い推定や、実際には音楽的な余韻であるものは、リペアを正当化しない場合があります。

## ルーム設定が変えるもの

`masteringRepairDereverbConfigForRoom` が `estimateRoom` の結果から読むのは `volume` と `rt60Bands` だけです。2 つの時間パラメータを変更し、除去量は呼び出し側に残します。

| オプション | 使い方 |
|---|---|
| `t60Sec` | 中域 RT60 の推定から決まる。該当帯域が収束しなかった場合は、利用できる帯域による文書化されたフォールバックを使う。 |
| `lateDelayMs` | 推定容積から混合時刻に相当する遅延として決まり、後期の拡散領域を示す。 |
| `attenuation`、`threshold`、`overSubtraction`、`spectralFloor` | 量とゲートの設定は維持または上書きする。ルーム形状で置き換わるものではない。`threshold` と `attenuation` は `[0, 1]` の範囲で検証される。 |
| `nFft`、`hopLength` | STFT の幾何を設定する。 |
| `wpeEnabled`、`wpeIterations`、`wpeTaps`、`wpeStrength` | 任意の WPE 前段を有効にし、形を設定する。指定しない場合、WPE 解析は無効。 |

[室内音響](./acoustic-analysis.md) で、等価ルーム推定、RT60 帯域、信頼度を説明しています。`roomMorph` は目標ルームの音色を加える効果であり、デリバーブとは別の処理です。

## チャンネルをリンクする

マルチチャンネル素材では、1 つのマスクで集合を制御するステレオ形式またはリンク形式を使います。共通マスクにより、チャンネル間のレベルと位相の関係を保ちます。

```ts
import {
  masteringRepairDereverbClassicalLinked,
  masteringRepairDereverbClassicalStereo,
} from '@libraz/libsonare';

const stereo = masteringRepairDereverbClassicalStereo({
  left,
  right,
  sampleRate,
  attenuation: 0.7,
});

const linked = masteringRepairDereverbClassicalLinked({
  channels: [frontLeft, frontRight, centre],
  sampleRate,
  attenuation: 0.7,
});
console.log(stereo.report.meanReductionDb, linked.report.suppressedFraction);
```

デリバーブの検出とリペアは `nFft` 未満の入力を解析のためにパディングします。ステレオまたはリンク形式の全チャンネルは同じ長さでなければなりません。レポートは比率と割合なので、デノイズのフロア測定のようなチャンネル数によるオフセットは生じません。

## 既存デモを聴く

<SonareDemo id="mastering-restoration" />

この埋め込みレストレーション例が適用するのは古典的デリバーブだけです。専用のデクリック、デハム、デノイズ段は実行しません。余韻と音色が変わることがあり、比較時にラウドネス整合は追加しません。

## 限界

残響検出器は、モジュール固有の後期減衰と、任意で有効にする予測可能性の測定です。室内音響の規格ではありません。デリバーブは拡散した持続エネルギーを減衰させますが、すべての初期反射を除去したり、ルームインパルス応答を再構成したり、重なった音源を分離したりはしません。伸ばした音などの持続する音楽素材を余韻と誤認することがあります。未処理信号を保存し、同じ再生ゲインで比較し、ほかのリペアを先に済ませてからデリバーブを最後に置くには [オーディオリペアの流れ](./audio-repair.md) を参照してください。

正確なオーバーロードとレポートのフィールドは [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。
