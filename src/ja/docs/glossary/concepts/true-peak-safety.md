---
title: True Peak 安全性
description: 再構成、コーデック変換、配信再生の後にクリッピングさせないための True Peak マージンの取り方。
---

# True Peak 安全性

True Peak 安全性とは、マスター済みファイルが再構成、コーデック変換、配信再生の後にクリップしないよう、十分な余裕を残す考え方です。

サンプルピークは、デジタルファイルに保存された値だけを示します。再生機器やエンコーダーは、そのサンプル間を補間して連続した波形に戻します。この再構成された波形が、保存されたサンプルピークを超えることがあります。サンプルの上にはみ出すこの部分を、サンプル間ピーク（ISP、inter-sample peak）と呼びます。つまり、サンプル上は安全に見えるマスターでも、変換後に歪む可能性があります。

<SonareDemo id="inter-sample-peak" />

## なぜサンプルピークだけでは足りないのか

デジタル音声ファイルは滑らかな曲線ではなく、離散的なサンプル点の列です。DAC（デジタル／アナログ変換器）やエンコーダーはその点を補間して連続波形に戻し、戻した波形は保存された点より高くなることがあります。

True Peak 計測では、信号をオーバーサンプリングしてからピークを調べることで、このリスクを推定します。2 つの読み値がどれだけ離れるかは、素材によって変わります。

| 信号 | サンプルピーク（dBFS） | True Peak（dBTP） |
|------|------------------------|-------------------|
| サンプルレートの 1/4 の周波数で位相 45° のサイン波 | -3.01 | -0.09 |
| 矩形波（振幅 0.5） | -6.02 | -4.11 |
| `mixed-stems.wav` | -1.1 | +0.2 |
| `drum.wav` | -0.7 | +1.4 |

下の 2 行は、サンプル上は 0 を下回っていても、再構成すると 0 を超えるファイルです。`drum.wav` は -0.7 で安全に見えますが、再構成するとおよそ 2 dB 高くなります。

特に問題になりやすい場面は次のとおりです。

| 状況 | リスク |
|------|--------|
| 不可逆エンコード | MP3・AAC・Opus などへの変換で新しいピークが生まれることがある。 |
| 強いリミッティング | 密度の高いマスターほど、再構成時の飛び出しに弱い。 |
| ストリーミング側の正規化 | 配信プラットフォーム側で再エンコード／再処理を通る場合がある。 |
| 再生機器側 | 0 dBFS ぎりぎりの素材を苦手とする再生チェーンが存在する。 |

## 実用的なシーリング

**シーリング**は、リミッターが通過を許す最大レベルです。一般的なリリース時のシーリングは `-1 dBTP` 前後です。dBTP は decibels true peak の略で、dBFS と同じデシベル尺度を再構成後の波形上で測ったものです。コーデック変換に対する余裕を広く取りたい場合は `-2 dBTP` を使うこともあります。逆に、納品先が明確で管理された環境であれば、もう少しタイトなシーリングを採用することもあります。エンジンの `club` と `cd` ターゲットは、-9 LUFS と `-0.3 dBTP` の組み合わせです。コーデックへの余裕を削って密度を取る設定で、streaming・broadcast・podcast は `-1` です。

シーリングはラウドネスのターゲット値ではなく、あくまで安全マージンです。静かなファイルでもピークが危険なことはありますし、大きいファイルでも True Peak の範囲内に収まっている例は珍しくありません。

<SonareDemo id="loudness-meter" />

## リミッターのルックアヘッド

True Peak リミッターは、ピークが到達する前に動き出す必要があります。ルックアヘッドはそのための先読み時間です。短すぎると速いピークを取り逃しやすく、長すぎるとレイテンシが増え、トランジェント感も変わってきます。

オフラインのマスタリングであれば、数 ms 程度のルックアヘッドは通常問題になりません。ライブ処理やインタラクティブ用途では、レイテンシの影響が大きくなる点に注意します。

リミッターの既定値は次のとおりです。

| 設定 | 既定値 |
|------|--------|
| `ceilingDb` | -1 |
| `lookaheadMs` | 1.0 |
| `releaseMs` | 50 |
| `oversampleFactor` | 4 |

## libsonare で測る

True Peak メーターもリミッターも、既定は 4 倍オーバーサンプリングで、1・2・4・8・16 を指定できます。シーリングへのリミッティングは、チェーンのステージ `maximizer.truePeakLimiter` が行います。

::: code-group

```typescript [Browser]
import { init, meteringPeakDb, meteringTruePeakDb, masteringChain } from '@libraz/libsonare';

await init();

const samplePeak = meteringPeakDb(samples, sampleRate);
const truePeak = meteringTruePeakDb(samples, sampleRate);      // 4 倍オーバーサンプリング
const finer = meteringTruePeakDb(samples, sampleRate, 8);      // 1、2、4、8、16 から指定

const limited = masteringChain(samples, sampleRate, {
  maximizer: { truePeakLimiter: { ceilingDb: -1, lookaheadMs: 1, oversampleFactor: 4 } },
});
// 結果は limited.samples に入ります。drum.wav では limited.outputTruePeakDbtp が -1.0 になります
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("song.wav")
sample_peak = audio.peak_db()
true_peak = audio.true_peak_db()                      # oversample_factor=4
finer = audio.true_peak_db(oversample_factor=8)

limited = sonare.mastering_chain(
    audio.data, audio.sample_rate,
    {"maximizer": {"truePeakLimiter": {"ceilingDb": -1, "lookaheadMs": 1, "oversampleFactor": 4}}},
)
```

```bash [CLI]
sonare meter song.wav   # ネイティブ CLI のみ: サンプルピークと True Peak（--oversample で倍率を指定）
sonare mastering-processor song.wav --processor maximizer.truePeakLimiter \
  --params ceilingDb=-1,lookaheadMs=1 -o limited.wav
```

:::

マスタリングデモの Studio モードでも、同じシーリングとルックアヘッドを調整できます。

:::: details 実装メモ

安全確認の考え方は True Peak メータリングと同じです。オーバーサンプリングで再構成波形を近似し、密になった格子上で最大値を評価します。元のサンプル点だけをクランプするリミッターでは、サンプル間オーバーが残ってしまうため、ガードは入力バッファではなくオーバーサンプリング後の信号経路を監視する必要があります。

ルックアヘッドとリリースは独立には決められません。ルックアヘッドはピーク到達前に減衰を始める時間を与え、リリースはユニティゲイン（増減なしの状態）に戻る速さを決めます。リリースが短すぎるとモジュレーション（音色の揺れ）が出やすく、長すぎるとトランジェントが鈍り、稼げるラウドネスヘッドルームも減ります。実用値は、コーデック変換への安全性、トランジェント保持、体感上のゲイン変化の折り合いで決まります。

::::

関連: [True Peak](../true-peak.md)、[LUFS](../lufs.md)、[ラウドネスマッチング](./loudness-matching.md)
