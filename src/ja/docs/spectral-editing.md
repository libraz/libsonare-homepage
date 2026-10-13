---
title: スペクトル編集
description: "libsonare の領域指定 STFT 編集。JavaScript/WASM と Python から、時間 × 周波数の矩形を attenuate、mute、gain、heal で処理します。"
---

# スペクトル編集

`spectralEdit(...)` は、libsonare の領域指定 STFT エディタです。モノラルクリップ内の「時間 × 周波数」の矩形を変えたいときに使います。笛鳴りを弱める、短いハムを消す、狭い帯域を持ち上げる、小さな欠落を近傍フレームから補修する、といった用途向けです。

STFT（短時間フーリエ変換）は、信号を時間と周波数のグリッドに切り分ける表現で、周波数ごとの編集はこの上で行います。詳しくは[用語集](./glossary/analysis/spectrogram-stft.md)を参照してください。

これはオフライン変換です。出力は入力と同じサンプルレート・同じ長さになり、複数の領域操作は同じ STFT バッファへ順番に適用されます。

<SonareDemo id="spectral-edit" />

## 使い分け

| 目的 | モード |
|------|--------|
| 選択した帯域を指定量だけ上下する | `gain` |
| 選択した帯域を弱める。`gain` と同じ式で、慣例的に負の `gainDb` を渡す | `attenuate` |
| 矩形内のビンをすべて 0 にする | `mute` |
| 小さなアーティファクトを近傍フレームから補う | `heal` |

`gain` と `attenuate` は内部の計算がまったく同じで、呼び出し側のコードから意図が読み取れるように名前が 2 つあります。持ち上げたいときは `gain` を、下げたいときは（負の `gainDb` を渡して）`attenuate` を使ってください。

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

秒で指定した領域:

```typescript
const muted = spectralEdit(samples, sampleRate, [
  { startSec: 0.5, endSec: 1.5, lowHz: 0, highHz: 0, mode: 'mute' },
]);
```

## オプション

<SonareDemo id="stft-basics" />

領域はサンプル位置と Hz で指定しますが、実際の編集は次の 2 つのオプションが作る STFT のグリッド上で行われます。

<StftFramingFigure
  title="nFft と hopLength が作るもの"
  :labels="{
    signal: '入力サンプル',
    windows: '窓掛けされたフレーム',
    frames: 'スペクトログラムの列',
    nfft: 'nFft — 窓の長さ',
    hop: 'hopLength',
    overlap: '同じサンプルを再び解析する範囲',
    column: '1 フレームにつき 1 回の FFT、1 列',
    continues: '…',
  }"
  caption="nFft は 1 つの解析窓の長さ、hopLength は次の窓を何サンプル先から始めるかで、既定値では窓が 4 分の 3 ずつ重なります。1 つの窓がスペクトログラムの 1 列になり、この縦の列に時間範囲が、その列を分割した周波数ビンに lowHz/highHz の範囲が対応します。"
/>

| フィールド | 意味 |
|------------|------|
| `startSample` / `endSample` | 入力サンプル位置で指定する時間矩形。開始の既定値は `0` です。`endSample` を省略する（Python では `end_sample` を `None` のままにする）と末尾まで及びます。`endSample: 0` は、どのサーフェスでも全体ではなく空の領域です。負の位置は拒否されます（JavaScript では `RangeError`、Python では `SonareValueError`）。`-1` は「末尾まで」を表すセンチネルではありません。 |
| `startSec` / `endSec` | 同じ境界を秒で指定します（Python は `start_sec` / `end_sec`）。呼び出しのサンプルレートで最も近いサンプルに丸められます。境界ごとにどちらか一方の表記だけを指定してください。`startSample` と `startSec`（または終了側の両表記）を併用すると拒否されます。 |
| `lowHz` / `highHz` | Hz で指定する周波数矩形。値は `[0, Nyquist]` に丸められ、`highHz <= 0` は Nyquist 扱い。 |
| `gainDb` | dB 単位のゲイン量。`gain` と `attenuate` のどちらも `magnitude *= 10^(gainDb/20)` という同じ式で適用され、弱めるには負値を渡します。`mute`/`heal` では無視されます。 |
| `nFft` | `[4, 262144]` の範囲の 2 のべき乗の FFT サイズ。既定値は `2048`。それ以外の正の値は、`nFft` と規則を示すエラーで拒否されます。JavaScript では `0` または省略で既定値になります（Python は `0` を拒否します）。 |
| `hopLength` | STFT の hop。既定値は `512`。`0 < hopLength <= nFft / 2` を満たす必要があります（JavaScript では `0` が既定値として扱われます）。 |
| `window` | `hann`、`hamming`、`blackman`、`rectangular`（Python は `rect` も受け付けます）。 |
| `healRadiusFrames` | `heal` が参照する左右の近傍フレーム数。既定値は `2`。`1` 以上を指定します。`0` は既定値として扱われ、負の値は拒否されます。 |

## 解像度と境界

矩形は STFT のセル単位で適用されるので、境界の鋭さは `nFft` で決まります。

| 48 kHz での `nFft` | ビン間隔 | 窓の長さ | 向いている対象 |
|--------------------|----------|----------|----------------|
| `1024` | 46.9 Hz | 21 ms | 短いクリックや速い出来事 |
| `2048`（既定） | 23.4 Hz | 43 ms | 一般的な用途 |
| `4096` | 11.7 Hz | 85 ms | 口笛やハムのような、安定した細い音 |

- **周波数方向の境界**：`lowHz` から `highHz` までのビンだけが変わり、外側のビンは変わりません。間をなだらかにつなぐ処理はありません。境界ちょうどにある音は窓の漏れで隣のビンにも広がるため、`mute` しても一部が残ることがあります。消したい帯域の周りに数ビンの余裕を取ってください。
- **時間方向の境界**：編集されるのは、中心が時間範囲に入るフレーム（`hopLength` の格子に切り捨て）ですが、各フレームは `nFft` サンプルにわたります。そのため再合成後の変化は、指定したサンプルからきっちり始まるのではなく、両側で窓の半分ほど（既定値で約 21 ms）かけて現れたり消えたりします。
- **`heal` の動作**：矩形内の各ビンについて、両側で最大 `healRadiusFrames` 個の未編集フレームの振幅を平均し、その 2 つのレベルの間を隙間にわたって直線的につなぎます。位相は、隙間の直前のフレームから、そのビンがもともと進んでいた速さで延長します（信号の先頭にある隙間では直後のフレームから）。持続音は隙間を通してつながり、クリックのように隙間の中だけにあった音は消えます。

小さな領域ほど自然に仕上がります。これは音源分離ではなく STFT 表現上の編集なので、広い範囲、長い範囲、`heal` の多用は、位相のにじんだアーティファクトを生むことがあります。
