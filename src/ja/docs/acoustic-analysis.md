---
title: ルーム音響解析
description: libsonare のルーム音響解析、ルーム推定、RIR 合成、ルームモーフィング API の使い方。
---

# ルーム音響解析

libsonare には、部屋や録音環境の響きを説明するためのルーム音響 API があります。

このページは、次の目的で使います。

- 拍手やインパルスレスポンスの録音を測る。
- 通常の録音から大まかな部屋の傾向を推定する。
- 単純な部屋寸法からルームインパルスレスポンスを作る。
- 目標ルームの響きをオフライン効果として音声に適用する。

これは楽曲解析とは別物です。`detectBpm(...)` や `analyze(...)` は曲を説明します。ルーム音響 API は、録音空間を説明・合成・適用します。

::: info インパルスレスポンスとは？
インパルスレスポンス（IR）は、拍手、風船破裂音、スターターピストル音、スイープなどの短い励振音に対して、部屋がどう響いて減衰するかを記録したものです。楽曲そのものではなく「部屋の反応」を見るため、RT60 や明瞭度のようなルーム音響指標を測りやすくなります。
:::

::: info 初出の用語
- **等価ルーム** は、測定された響きに近い単純な部屋モデルです。実際の部屋を正確にスキャンした結果ではありません。
- **RIR** は room impulse response の略で、部屋が短い音にどう反応するかを表す音声サンプルです。
- **シューボックス形状** は、長さ・幅・高さで表す直方体の部屋モデルです。
- **DRR** は直接音対残響音比です。音源から直接届く音と、部屋で反射して届く音の比を表します。
- **ルームモーフィング** は、目標ルームの響きを音作り効果として足す処理です。残響を取り除く残響除去とは別物です。
:::

::: tip ブラウザで試す
[空間ルームスキャナー](/ja/spatial) のデモは、この一連の処理をすべてローカルで実行します。録音をドロップする（またはサンプルルームを選ぶ）と、推定された形状・RT60・明瞭度・音源までの距離をインタラクティブな 3D シーンとして再構成します。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 入力録音に応じて、インパルスレスポンス解析とブラインド音響推定を選べる。
- シューボックス寸法からモノラルのルームインパルスレスポンスを合成できる。
- 録音から等価なルームを推定し、体積、代表寸法、吸音率、DRR、信頼度を読める。
- ルームモーフィングを音作りの効果として使い、残響除去と混同しない。
- RT60、EDT、C50、C80、D50、オクターブバンド、信頼度、`isBlind` を実用上の意味で説明できる。
- ブラインド推定を認証レベルの測定値として扱う誤りを避けられる。
- JavaScript、Python、CLI から同じ音響解析ワークフローを呼び出せる。

## どちらを使うか

| 入力 | 使う API | 期待できること |
|------|----------|----------------|
| 測定済み IR、拍手、風船破裂音、スターターピストル音、スイープ由来 IR などの短い励振音 | `analyzeImpulseResponse(...)` / `analyze_impulse_response(...)` | 最も精度が出ます。減衰が部屋由来である前提です。 |
| 通常の音楽・音声録音で、単独のインパルスがない | `detectAcoustic(...)` / `detect_acoustic(...)` | ブラインド推定です。順位付けや UI 上の目安向きで、認証測定向きではありません。 |
| 録音や IR から実用的な等価ルームモデルがほしい | `estimateRoom(...)` / `estimate_room(...)` | 体積、代表寸法、DRR、バンド別吸音率／RT60、信頼度。 |
| ルーム寸法と音源／聴取位置がある | `synthesizeRir(...)` / `synthesize_rir(...)` | 指定した部屋と位置から、再現性のあるモノラル RIR を作ります。 |
| 録音を目標ルームの響きへ寄せたい | `roomMorph(...)` / `room_morph(...)` | オフラインの音作り効果です。既存の残響を取り除く処理ではありません。 |

`analyzeImpulseResponse(...)` と `detectAcoustic(...)` は `AcousticResult` を返します。結果には、全帯域の値とオクターブバンドごとの配列が含まれます。`estimateRoom(...)` は `RoomEstimateResult`、`synthesizeRir(...)` は `RirResult`、`roomMorph(...)` は処理後サンプルを返します。

## 直接計測とブラインド推定の違い

`analyzeImpulseResponse(...)` は、部屋に短い励振音を入れた後の減衰を直接見ます。拍手、風船破裂音、スターターピストル音、スイープ由来 IR のように、最初の音とその後の残響が分かれている入力に向いています。

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
import {
  init,
  analyzeImpulseResponse,
  detectAcoustic,
  estimateRoom,
  synthesizeRir,
  roomMorph,
} from '@libraz/libsonare';

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

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.length, estimate.width, estimate.height);
console.log(estimate.drrDb, estimate.confidence, estimate.absorptionBands);

const { rir, hasError } = synthesizeRir({
  lengthM: 7,
  widthM: 5,
  heightM: 3,
  sourceX: 1,
  sourceY: 1,
  sourceZ: 1.2,
  listenerX: 5,
  listenerY: 4,
  listenerZ: 1.7,
  absorption: 0.2,
  sampleRate,
});

const morphed = roomMorph(dryVoice, sampleRate, {
  lengthM: 12,
  widthM: 9,
  heightM: 4,
  wet: 0.6,
});
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

estimate = sonare.estimate_room(audio.data, audio.sample_rate, n_octave_bands=6)
print(estimate.volume, estimate.length, estimate.width, estimate.height)
print(estimate.drr_db, estimate.confidence, estimate.absorption_bands)

rir = sonare.synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
print(rir.sample_rate, len(rir.rir), rir.has_error)

morphed = sonare.room_morph(
    audio.data,
    audio.sample_rate,
    12.0,
    9.0,
    4.0,
    wet=0.6,
)
```

```bash [CLI]
# 通常の録音からのブラインド推定（バンド数・閾値はデフォルト）
sonare acoustic room-recording.wav

# インパルス応答モード（拍手／風船破裂音／スターターピストル音／スイープ由来 IR）
sonare acoustic room-clap.wav --ir

# --json で機械可読のサマリを出力
sonare acoustic room-clap.wav --ir --json

# 録音から等価ルームを推定
sonare estimate-room room-recording.wav --json

# 形状からモノラルのルームインパルスレスポンスを合成
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav

# 録音を目標ルームへモーフィング
sonare room-morph dry.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

Python の `Audio` からも同じ処理を呼べます: `audio.analyze_impulse_response(...)` と `audio.detect_acoustic(...)`。新しい幾何ベースのルーム音響ヘルパーは、Python ではモジュールレベル関数、WASM ラッパーではスタンドアロン関数です。

## 幾何ベースのルーム音響

ここは、録音を測るだけでなく、部屋モデルを作る・適用する API の説明です。

`synthesizeRir(...)` は、直方体の部屋からモノラル RIR を作ります。寸法はメートル、壁は一様な吸音率、音源と聴取位置は部屋の内側の座標で指定します。形状が不正な場合、JavaScript は `hasError: true` と空の `rir` を返し、Python では同じ状態を `has_error` として読めます。

`estimateRoom(...)` は、録音から等価ルームを推定します。正確な実空間を復元するものではありません。通常録音には部屋の減衰がはっきり出ていないことがあるため、必ず `confidence` を確認してください。

`roomMorph(...)` はオフラインの音作り効果です。合成した目標ルームの響きを足し、既存の残響尾部を少し弱めることがあります。残響除去として説明・提供すべきものではありません。

### 壁の吸音率と材質

`synthesizeRir(...)` と `roomMorph(...)` は共通のシューボックス形状を取るため、壁の指定フィールドも同じです。壁の指定は、粗い順に 3 段階で表せます。

| フィールド | 型 | 意味 |
|------------|----|------|
| `absorption` | number | 全バンド一様の壁吸音率。`[0, 0.999]` にクランプされます。最も単純で後方互換のコントロールです。 |
| `bandAbsorption` | `Float32Array` / `number[]` | オクターブバンド別の壁吸音率（125 / 250 / 500 / 1k / 2k / 4k… Hz）。指定すると `absorption` を上書きします（ただし `materialPreset` が設定されている場合を除く）。 |
| `bandScattering` | `Float32Array` / `number[]` | バンド別の壁の散乱。指定のないバンドは `0` になります。 |
| `materialPreset` | number | 名前付きの壁材質プリセット。非ゼロのプリセットは `bandAbsorption` と `absorption` の両方より優先されます。 |

材質プリセットは整数コードに対応します。`0` なし、`1` コンクリート、`2` 木材、`3` カーテン、`4` カーペット、`5` ガラスです。コンクリートとガラスは反射的で高域のテールが残りやすく、カーテンとカーペットは吸音的でテールが短くなります。非ゼロの `materialPreset` はバンド配列より優先されるため、自分の `bandAbsorption`／`bandScattering` を効かせたいときは `materialPreset: 0` を指定してください。

```typescript
// コンクリートのシューボックス: 明るく長いテール
const concrete = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 1, // concrete
  sampleRate,
});

// バンド別の壁指定（6 オクターブバンド）と散乱
const custom = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 0, // バンド配列を有効にする
  bandAbsorption: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5],
  bandScattering: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3],
  sampleRate,
});
```

### 後期残響モデルとテールのコントロール

共通形状には後期テールの挙動も含まれます。`RirSynthOptions` と `RoomMorphOptions` のどちらも次を持ちます。

| フィールド | 意味 |
|------------|------|
| `preferEyring` | 統計的な後期残響モデルの選択。`true`（既定）は Eyring、`false` は Sabine を使います。 |
| `mixingTimeMs` | 初期／後期の切り替え時刻（ミリ秒）。`0` でおおよそ `sqrt(volume)` ミリ秒を自動選択します。 |
| `crossfadeMs` | 混合時刻まわりの等パワークロスフェード幅（ミリ秒）。`0` で既定値です。 |
| `ismOrder` | 初期反射部の鏡像音源の反射次数。 |
| `seed`, `maxSeconds` | 後期テールの乱数シードと、生成する RIR の最大長。 |

**混合時刻**は、応答が離散的な鏡像音源の初期反射から決定論的な統計的後期テールへ移る点で、**クロスフェード**はその境目が聞こえないよう両者をなじませます。Sabine と Eyring は後期テールの背後にある 2 つの古典的な RT60 推定法で、Eyring はより吸音的な部屋で精度が高い傾向があります。

::: details ルーム合成の実装メモ
`synthesizeRir(...)` は、鏡像音源法による初期反射と、決定論的な後期テールを組み合わせます。`acoustic::RirSynthConfig` では、反射次数、Sabine/Eyring の後期テールモデル、シード、RIR の最大長、混合時刻、クロスフェード幅を指定できます。
:::

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
いずれも、音が止まったあとに空間でどう減衰するかから求める標準的なルーム音響指標です。

- **RT60** — 残響が 60 dB 減衰するまでの秒数。「どれだけ響くか」を表す代表値で、小さな部屋なら約 0.3 秒、大聖堂なら数秒になります。
- **EDT（早期減衰時間）** — 減衰の最初の部分から測った減衰速度を 60 dB 降下に換算したもの。体感上の響きの豊かさは、RT60 より EDT の方がよく一致することが多いです。
- **C50 / C80（明瞭度）** — 初期エネルギー（最初の 50 ms / 80 ms）と、その後の残響との比を dB で表したもの。高いほど明瞭で直接音的です。C50 は会話、C80 は音楽の基準です。
- **D50（定義）** — 全エネルギーのうち最初の 50 ms に到達する割合（0〜1）。高いほど直接音的で、ぼやけが少なくなります。
:::

## 実用上の注意

信頼できる値が必要なら、きれいなインパルスレスポンスを録音してください。

- 静かな環境で録る。
- クリップしないレベルにする。
- インパルス後の無音を十分に残す。
- 解析前に不要なノイズをトリムする。

ブラインド推定は「このテイクは響きすぎているかも」といった比較や警告には便利です。ただし、建築音響の正式な測定値として扱うものではありません。

ライブ表示や段階的な BPM/キー/コード推定が必要なら [リアルタイムとストリーミング](./realtime-streaming.md) を使います。楽曲メタデータが必要なら [JavaScript API](./js-api.md) または [Python API](./python-api.md) を参照してください。
