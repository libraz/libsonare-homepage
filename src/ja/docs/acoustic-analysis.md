---
title: ルーム音響解析
description: libsonare のルーム音響解析 API の使い方。インパルスレスポンスと通常録音から RT60、EDT、明瞭度、定義度、信頼度を読む方法。
---

# ルーム音響解析

libsonare には、部屋や録音環境の響きを測るための音響解析 API があります。入力がインパルスレスポンス、手拍子やポップ音の録音、または通常の音楽・音声録音で、空間の響き具合を知りたいときに使います。

これは楽曲解析とは別物です。`detectBpm(...)` や `analyze(...)` は曲を説明します。`analyzeImpulseResponse(...)` / `analyze_impulse_response(...)` と `detectAcoustic(...)` / `detect_acoustic(...)` は部屋や再生環境を説明します。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 入力録音に応じて、インパルスレスポンス解析とブラインド音響推定を選べる。
- RT60、EDT、C50、C80、D50、オクターブバンド、信頼度、`isBlind` を実用上の意味で説明できる。
- ブラインド推定を認証レベルの測定値として扱う誤りを避けられる。
- JavaScript、Python、CLI から同じ音響解析ワークフローを呼び出せる。

## どちらを使うか

| 入力 | 使う API | 期待できること |
|------|----------|----------------|
| 測定済み IR、スターターピストル、風船、スイープ由来 IR、きれいな手拍子 | `analyzeImpulseResponse(...)` / `analyze_impulse_response(...)` | 最も精度が出ます。減衰が部屋由来である前提です。 |
| 通常の音楽・音声録音で、単独のインパルスがない | `detectAcoustic(...)` / `detect_acoustic(...)` | ブラインド推定です。順位付けや UI 上の目安向きで、認証測定向きではありません。 |

どちらも `AcousticResult` を返し、全帯域の値とオクターブバンドごとの配列を含みます。

## 直接計測とブラインド推定の違い

`analyzeImpulseResponse(...)` は、部屋に短い音を入れた後の減衰を直接見ます。手拍子、破裂音、スイープから作った IR のように、最初の音とその後の残響が分かれている入力に向いています。

`detectAcoustic(...)` は、通常の音楽や会話から部屋の響きを推定します。入力の中に単独のインパルスがないため、録音の中から「音が止まり、残響だけが自然に減っているように見える区間」を探します。

この違いにより、結果の扱いも変わります。

| 観点 | `analyzeImpulseResponse(...)` | `detectAcoustic(...)` |
|------|-------------------------------|-----------------------|
| 入力の前提 | 部屋の反応が分かりやすい | 音楽や声が混ざっている |
| 主な用途 | 測定、比較、検証 | UI の目安、タグ付け、警告 |
| 信頼度 | 入力がきれいなら高く扱いやすい | 入力に左右されるため `confidence` が重要 |
| 低信頼度の意味 | IR が汚い、短い、クリップしている可能性 | 自由減衰区間が見つからない、または残響以外の要素が混ざっている可能性 |

**自由減衰区間**とは、音源が新しい音を出しておらず、部屋の残響だけが自然に小さくなっている区間です。ブラインド推定では、この区間が見つからないと信頼できる値を出せません。

## 使い方

::: code-group

```typescript [ブラウザ]
import { init, analyzeImpulseResponse, detectAcoustic } from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate, 6);
console.log(measured.rt60, measured.edt, measured.c50, measured.c80);

const blind = detectAcoustic(
  roomRecording,
  sampleRate,
  6,     // オクターブバンド数
  24,    // ブラインド推定で使う 1/3 オクターブ相当のサブバンド数
  30,    // 有効な減衰として扱う最小 dB
  10,    // ノイズフロアに対する余裕 dB
);
console.log(blind.confidence, blind.isBlind);
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("room-clap.wav")

measured = sonare.analyze_impulse_response(audio.data, audio.sample_rate, n_octave_bands=6)
print(measured.rt60, measured.edt, measured.c50, measured.c80)

blind = sonare.detect_acoustic(
    audio.data,
    audio.sample_rate,
    n_octave_bands=6,
    n_third_octave_subbands=24,
    min_decay_db=30.0,
    noise_floor_margin_db=10.0,
)
print(blind.confidence, blind.is_blind)
```

```bash [CLI]
# 通常の録音からのブラインド推定（バンド数・閾値はデフォルト）
sonare acoustic room-recording.wav

# インパルス応答モード（拍手／破裂音／スイープ由来の IR）
sonare acoustic room-clap.wav --ir

# --json で機械可読のサマリを出力
sonare acoustic room-clap.wav --ir --json
```

:::

Python の `Audio` からも同じ処理を呼べます: `audio.analyze_impulse_response(...)` と
`audio.detect_acoustic(...)`。WASM wrapper では、`audio.data` と
`audio.sampleRate` を渡してスタンドアロンの `analyzeImpulseResponse(...)` /
`detectAcoustic(...)` を呼び出します。

## 結果の読み方

| フィールド | 意味 |
|------------|------|
| `rt60` | 残響が 60 dB 減衰するまでの推定時間。大きいほど響きが長い部屋です。 |
| `edt` | 初期減衰時間。体感上の残響感に近いことがあります。 |
| `c50` | 音声向けの明瞭度。高いほど子音や会話が聞き取りやすい傾向があります。 |
| `c80` | 音楽向けの明瞭度。直接音・初期反射が後期残響に対してどれだけ強いかを示します。 |
| `d50` | 定義度。最初の 50 ms に含まれるエネルギー比率です。 |
| `rt60Bands`, `edtBands`, `c50Bands`, `c80Bands` | 各測定値のバンド別配列。Python では snake_case 名も使えます。 |
| `confidence` | `0` から `1` の信頼度。低い場合は、十分にきれいな減衰が取れていません。 |
| `isBlind` / `is_blind` | インパルスレスポンス前提ではなくブラインド推定で得た結果かどうか。 |

::: details RT60・EDT・C50/C80・D50 は何を測る？
いずれも、音が止まったあとに空間でどう減衰するかから求める標準的な室内音響指標です。

- **RT60** — 残響が 60 dB 減衰するまでの秒数。「どれだけ響くか」を表す代表値で、小さな部屋なら約 0.3 秒、大聖堂なら数秒になります。
- **EDT（早期減衰時間）** — 減衰の最初の部分から測った減衰速度を 60 dB 降下に換算したもの。体感上の響きの豊かさは、RT60 より EDT の方がよく一致することが多いです。
- **C50 / C80（明瞭度）** — 初期エネルギー（最初の 50 ms / 80 ms）と、その後の残響との比を dB で表したもの。高いほど明瞭で直接音的です。C50 は会話、C80 は音楽の基準です。
- **D50（定義）** — 全エネルギーのうち最初の 50 ms に到達する割合（0〜1）。高いほど直接音的で、ぼやけが少なくなります。
:::

## 実用上の注意

信頼できる値が必要なら、静かな環境で、クリップしないレベルで、インパルス後の無音を十分に残して録音してください。ブラインド推定は「このテイクは響きすぎているかも」といった比較や警告には便利ですが、建築音響の正式な測定値として扱うものではありません。

ライブ表示や段階的な BPM/キー/コード推定が必要なら [リアルタイムとストリーミング](./realtime-streaming.md) を使います。楽曲メタデータが必要なら [JavaScript API](./js-api.md) または [Python API](./python-api.md) を参照してください。
