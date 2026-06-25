---
title: スペクトル編集
description: "libsonare の領域指定 STFT 編集。JavaScript/WASM と Python から、時間 x 周波数の矩形を attenuate、mute、gain、heal で処理します。"
---

# スペクトル編集

`spectralEdit(...)` は、libsonare の領域指定 STFT エディタです。モノラルクリップ内の「時間 x 周波数」の矩形を変えたい場合に使います。笛鳴りを弱める、短いハムを消す、狭い帯域を持ち上げる、小さな欠落を近傍フレームから補修する、といった用途向けです。

これはオフライン変換です。出力は入力と同じサンプルレート・同じ長さになり、複数の領域操作は同じ STFT バッファへ順番に適用されます。

<SonareDemo id="spectral-edit" />

## 使い分け

| 目的 | モード |
|------|--------|
| 選択した帯域を指定量だけ上下する | `gain` |
| 選択した帯域を弱める。`gain` と同じ式で、慣例的に負の `gainDb` を渡す | `attenuate` |
| 選択した矩形を完全に消す | `mute` |
| 小さなアーティファクトを近傍フレームから補う | `heal` |

`gain` と `attenuate` は内部の計算がまったく同じで、コードを意図どおりに読ませるために名前が 2 つあります。持ち上げたいときは `gain` を、下げたいときは（負の `gainDb` を渡して）`attenuate` を使ってください。

ピッチ、時間、ノート、声質の編集は [編集 DSP](./editing-dsp.md) を参照してください。曲全体のトーン、ダイナミクス、リペア、配信向け処理は [マスタリングプロセッサ](./mastering-processors.md) を使います。

## 使い方

::: code-group

```typescript [ブラウザ / WASM]
import { init, spectralEdit } from '@libraz/libsonare';

await init();

const repaired = spectralEdit(samples, sampleRate, [
  {
    startSample: Math.round(1.25 * sampleRate),
    endSample: Math.round(1.55 * sampleRate),
    lowHz: 7600,
    highHz: 8300,
    mode: 'attenuate',
    gainDb: -18,
  },
  {
    startSample: Math.round(2.1 * sampleRate),
    endSample: Math.round(2.18 * sampleRate),
    lowHz: 0,
    highHz: 400,
    mode: 'heal',
  },
], {
  nFft: 2048,
  hopLength: 512,
  window: 'hann',
  healRadiusFrames: 2,
});
```

```python [Python]
import libsonare as sonare

repaired = sonare.spectral_edit(
    samples,
    sample_rate,
    [
        sonare.SpectralRegionOp(
            start_sample=int(1.25 * sample_rate),
            end_sample=int(1.55 * sample_rate),
            low_hz=7600,
            high_hz=8300,
            gain_db=-18,
            mode="attenuate",
        ),
        sonare.SpectralRegionOp(
            start_sample=int(2.1 * sample_rate),
            end_sample=int(2.18 * sample_rate),
            low_hz=0,
            high_hz=400,
            mode="heal",
        ),
    ],
    n_fft=2048,
    hop_length=512,
    window="hann",
    heal_radius_frames=2,
)
```

:::

## オプション

| フィールド | 意味 |
|------------|------|
| `startSample` / `endSample` | 入力サンプル位置で指定する時間矩形。`endSample` を省略すると末尾まで（Python では `end_sample` を既定値の `-1` センチネルのままにする）。Python の `end_sample=0` は全体ではなく空の領域になります。 |
| `lowHz` / `highHz` | Hz で指定する周波数矩形。値は `[0, Nyquist]` に丸められ、`highHz <= 0` は Nyquist 扱い。 |
| `gainDb` | dB 単位のゲイン量。`gain` と `attenuate` のどちらも `magnitude *= 10^(gainDb/20)` という同じ式で適用され、弱めるには負値を渡します。`mute`/`heal` では無視されます。 |
| `nFft` | 2 のべき乗の FFT サイズ。既定値は `2048`。 |
| `hopLength` | STFT の hop。既定値は `512`。`0 < hopLength <= nFft / 2` を満たす必要があります。 |
| `window` | `hann`、`hamming`、`blackman`、`rectangular`。 |
| `healRadiusFrames` | `heal` が参照する左右の近傍フレーム数。既定値は `2`。`1` 以上を指定する必要があります。 |

小さな領域ほど自然に効きやすくなります。広い範囲、長い範囲、または `heal` の多用は、音源分離ではなく STFT 表現上の編集であるため、位相感のあるアーティファクトにつながることがあります。
