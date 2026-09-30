---
title: クリップ、クリック、クラックルのリペア
description: libsonare の declip、declick、decrackle 段で過渡的な欠陥を検出・修復し、ステレオの契約を守る方法です。
---

# クリップ、クリック、クラックルのリペア

クリップ、クリック、クラックルはいずれも短時間の欠陥ですが、根拠は別々です。クリップは上限付近の連続区間を作り、クリックは孤立した不連続、クラックルはサンプル単位の偏差が密集したものです。修復方法を選ぶ前に、それぞれの欠陥を検出してください。

## 検出器を選ぶ

| 欠陥 | 検出器 | リペア段 | 確認するもの |
|---|---|---|---|
| 平らな頂部または上限を超えたピーク | `masteringRepairDetectClipping` | `masteringRepairDeclip` | `sampleCount`、`runCount`、`longestRunSamples`。長い区間は補間フォールバックを使う。 |
| 孤立したインパルス状の不連続 | `masteringRepairDetectClicks` | `masteringRepairDeclick` | `count`、`rejected`、`longestRunSamples`、`perSecond`。 |
| 密集したサンプル単位の表面損傷 | `masteringRepairDetectCrackle` | `masteringRepairDecrackle` | `sampleCount`、`sampleFraction`、`perSecond`。 |

検出は素材に依存します。矩形波、パルス列、完全にリミットされた信号は平らな頂部に見える一方、ダウンミックス、リサンプリング、非可逆圧縮は本当の平頂を消すことがあります。ダウンミックス前の元チャンネルをそれぞれ検査してください。

## リペア順に検出する

次のモノラル例は、選択した段を適用した後に検出をやり直します。そのため後の測定は、前のリペアが作った波形に対して行われます。

```ts
import {
  init,
  masteringRepairDeclick,
  masteringRepairDeclip,
  masteringRepairDecrackle,
  masteringRepairDetectClicks,
  masteringRepairDetectClipping,
  masteringRepairDetectCrackle,
} from '@libraz/libsonare';

await init();

let repaired = samples;
const clipping = masteringRepairDetectClipping(repaired, sampleRate);
if (clipping.sampleCount > 0) {
  repaired = masteringRepairDeclip(repaired, sampleRate);
}

const clicks = masteringRepairDetectClicks(repaired, sampleRate);
if (clicks.count > 0) {
  repaired = masteringRepairDeclick(repaired, sampleRate);
}

const crackle = masteringRepairDetectCrackle(repaired, sampleRate);
if (crackle.sampleCount > 0) {
  repaired = masteringRepairDecrackle(repaired, sampleRate);
}
```

件数が 0 より大きいかで分けるだけでは出発点にすぎません。波形を確認して各変更を試聴してください。検出器は、クリップに見える波形が意図したものかどうかを判断できません。

## 過渡的なリペア A/B を聴く

<SonareDemo id="repair-clicks" />

この A/B は、損傷したビニール盤風クリップに実際の WASM デクリック処理を適用します。ノイズの注入、ラウドネス整合、declip／decrackle／dehum は行いません。素材にはハム、ヒス、クラックル、音楽的なアタックが残るため、すべての欠陥が消える例ではなく、局所的なクリック修復を聴く例として使ってください。

## ステレオ像を保つ

ステレオでは左右のチャンネルをペア形式へ渡します。各チャンネルにモノラル関数を別々に呼ぶと、一方だけを直して対応するイベントをもう一方に残すことがあります。

```ts
import {
  masteringRepairDeclickStereo,
  masteringRepairDeclipStereo,
  masteringRepairDecrackleStereo,
} from '@libraz/libsonare';

const declipped = masteringRepairDeclipStereo({
  left,
  right,
  sampleRate,
});
const declicked = masteringRepairDeclickStereo({
  left: declipped.left,
  right: declipped.right,
  sampleRate,
});
const decrackled = masteringRepairDecrackleStereo({
  left: declicked.left,
  right: declicked.right,
  sampleRate,
});
console.log(decrackled.leftReport, decrackled.rightReport);
```

`declipStereo` は左右のクリップ区間の和集合を使います。和集合の区間にクリップしたサンプルがないチャンネルは、その区間を変更しません。各チャンネルは自身の再構成とレポートを持ちます。`declickStereo` はどちらかのチャンネルが選んだ区間を両方で修復しますが、補間には各チャンネル自身のサンプルと LPC モデルを使います。表面傷は共通イベントにならないため、`decrackleStereo` はチャンネルごとに独立して処理します。

## レポートを読む

| 段 | 役立つレポートフィールド | 解釈 |
|---|---|---|
| Declip | `lpcReconstructedRuns`、`interpolatedRuns`、`repairedSamples` | 512 サンプルを超える区間は三次または線形補間を使う。そのフォールバックには LPC オプションは効かない。 |
| Declick | `detected.rejected`、`repairedRuns`、`linkedRuns`、`lpcModelUsed` | `rejected` が多い場合、素材がきれいなのではなく `maxClickSamples` または `neighborRatio` が厳しすぎることが多い。 |
| Decrackle | `replacedSamples` または `shrunkCoefficients` | 検出器は常に中央値の基準を使う。ウェーブレットモードは各除去サンプルをクラックルと宣言せず、詳細係数を取り除く。 |

検出器とリペアは信号レベルのしきい値を使い、損傷したすべてのサンプルを復元できるとは約束しません。クリップは情報を捨てているため、再構成は近傍サンプルから形を推定します。未処理素材を保存し、一定の再生ゲインで比較してください。

## 限界と共通の順序

完全なリペア順は `declip → declick → decrackle → dehum → denoise → dereverb` です。平らな区間はクリックを隠すことがあるためクリップ修復を先に置き、残りの過渡的な段をスペクトルノイズと残響の推定より前に置きます。ここでの関数はオフラインの全バッファ処理で、LUFS 整合は行いません。判断の流れは [オーディオリペアの流れ](./audio-repair.md)、正確なオプション型は [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。
