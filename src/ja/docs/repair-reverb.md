---
title: 拡散残響のリペア
description: 後期の拡散した余韻を測定し、libsonare のオフライン古典的デリバーブを設定し、ルーム推定の限界を理解します。
---

# 拡散残響のリペア

`masteringRepairDereverbClassical` は、直接音を覆う持続的で拡散した余韻を対象にします。STFT 領域のスペクトルサブトラクションを使い、任意で WPE の前段を実行できます。オフラインのリペア段であり、ルームインパルス応答のデコンボリューションでも、完全にドライな音源を復元する方法でもありません。

::: info このページの用語
- **直接音、初期反射、後部残響**：部屋の中では、まず音源からまっすぐ届く音が聞こえ、次に近くの面からのいくつかのはっきりした反射、その後に密で拡散した減衰（後部残響、テール）が続きます。デリバーブが対象にするのは後部残響です。
- **RT60**：後部残響が 60 dB 減衰するまでの時間で、部屋の響きの長さを表す一般的な指標です。[残響時間](./glossary/acoustics/reverberation-time.md)を参照してください。
- **混合時刻**：反射が拡散したテールに溶け込んだ後の時点。`lateDelayMs` がこれを表します。
- **スペクトル減算**：各 STFT ビンのテールのパワーを、同じビンの遅延分だけ前のパワーを `t60Sec` の速さで減衰させて推定し、差し引く処理。デノイザーがノイズを差し引くのと同じ考え方です。
- **WPE**（weighted prediction error）：各ビンの後部残響を前のフレームから予測し、その予測を差し引く任意の前段です。
:::

<SonareDemo id="room-decay" />

## デリバーブ前に検出する

検出器はデリバーブが使う統計量を返します。ISO 3382 の RT60 を計算するものではありません。等価ルームの推定が必要な場合は `estimateRoom`（[ルーム音響](./acoustic-analysis.md) を参照）を使い、リペアの設定に使う前に信頼度を確認してください。

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

`configForRoom` はルーム推定を読み、完全なデリバーブ設定を返します（Python では `mastering_repair_dereverb_config_for_room`）。それでも試聴は必要です。信頼度の低い推定や、実際には音楽的な余韻であるものは、リペアを正当化しない場合があります。

## ルーム設定が変えるもの

`masteringRepairDereverbConfigForRoom` が `estimateRoom` の結果から読むのは `volume` と `rt60Bands` だけです。2 つの時間パラメータを変更し、除去量は呼び出し側に残します。

| オプション | 使い方 |
|---|---|
| `t60Sec` | 中域 RT60 の推定から決まる。該当帯域が収束しなかった場合は、利用できる帯域による文書化されたフォールバックを使う。受け付ける範囲は `(0, 10]` 秒（既定 `0.4`）。 |
| `lateDelayMs` | 推定容積から混合時刻に相当する遅延として決まり、後期の拡散領域を示す。受け付ける範囲は `[0, 500]` ms（既定 `50`）。 |
| `attenuation`、`threshold`、`overSubtraction`、`spectralFloor` | 量とゲートの設定は維持または上書きする。ルーム形状で置き換わるものではない。`threshold`、`attenuation`、`spectralFloor` は `[0, 1]`、`overSubtraction` は `[0, 16]` の範囲で検証される。 |
| `nFft`、`hopLength` | STFT の窓長とホップ幅を設定する。制約は下記を参照。 |
| `wpeEnabled`、`wpeIterations`、`wpeTaps`、`wpeStrength` | 任意の WPE 前段を有効にし、形を設定する。指定しない場合、WPE 解析は無効。`wpeIterations` は `[1, 16]`、`wpeTaps` は `[1, 32]`、`wpeStrength` は `[0, 1]`。 |

[ルーム音響](./acoustic-analysis.md) で、等価ルーム推定、RT60 帯域、信頼度を説明しています。`roomMorph` は目標ルームの音色を加える効果であり、デリバーブとは別の処理です。

`nFft` は `4` から `524288` までの 2 のべき乗です。`hopLength` は `(0, nFft / 2]` に入り、周期 Hann の解析窓と対称 Hann の合成窓で、すべてのオーバーラップ位置が覆われる必要があります。覆われない位置が残る組み合わせは、オフラインのモノラル、ステレオ、リンク形式のいずれでも拒否されます。`nFft` 未満の入力は解析のためにパディングされますが、この検証は緩和されません。

WPE を有効にすると、各 STFT ビンで遅延フレームから 1 つの複素予測器を推定します。リンク形式では全チャンネルをまとめて推定します。予測係数の L1 ノルムが `0.98` を超えると係数を縮小し、各反復で共通の予測器を `wpeStrength` で重みづけして各チャンネルから減算します。

## チャンネルをリンクする

マルチチャンネル素材では、1 つのマスクで集合を制御するステレオ形式またはリンク形式を使います。共通のスペクトルマスクにより、チャンネル間のレベルと位相の関係を保ちます。WPE を有効にした場合は、予測器の集合もリンクした全チャンネルから共通に推定し、それぞれへ適用します。

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
  channels: [frontLeft, frontRight, center],
  sampleRate,
  attenuation: 0.7,
});
console.log(stereo.report.meanReductionDb, linked.report.suppressedFraction);
```

デリバーブの検出とリペアは `nFft` 未満の入力を解析のためにパディングします。ステレオまたはリンク形式の全チャンネルは同じ長さでなければなりません。レポートは比率と割合なので、デノイズのフロア測定のようなチャンネル数によるオフセットは生じません。

## デリバーブ A/B を聴く

<SonareDemo id="mastering-restoration" />

この A/B が適用するのは古典的デリバーブだけで、デクリック、デハム、デノイズ段もラウドネス整合も行いません。余韻と音色が変わることがあります。

## 限界

残響検出器は、モジュール固有の後期減衰と、任意で有効にする予測可能性の測定です。ルーム音響の規格ではありません。デリバーブは拡散した持続エネルギーを減衰させますが、すべての初期反射を除去したり、ルームインパルス応答を再構成したり、重なった音源を分離したりはしません。伸ばした音などの持続する音楽素材を余韻と誤認することがあります。未処理信号を保存し、同じ再生ゲインで比較し、ほかのリペアを先に済ませてからデリバーブを最後に置くには [オーディオリペアの流れ](./audio-repair.md) を参照してください。

正確なオーバーロードとレポートのフィールドは [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。
