---
title: ルーム音響解析
description: libsonare のルーム音響解析、ルーム推定、RIR 合成、ルームモーフィング API の使い方。
---

# ルーム音響解析

libsonare には、部屋や録音環境の響きを説明するためのルーム音響 API があります。

このページは、次の目的で使います。

- 拍手やインパルス応答の録音を測る。
- 通常の録音から大まかな部屋の傾向を推定する。
- 単純な部屋寸法からルームインパルス応答を作る。
- 目標ルームの響きをオフライン効果として音声に適用する。

これは楽曲解析とは別物です。`detectBpm(...)` や `analyze(...)` は曲を説明します。ルーム音響 API は、録音空間を説明・合成・適用します。

::: info インパルス応答とは？
インパルス応答（IR）は、拍手や風船破裂音などの短い励振音に対して、部屋がどう響いて減衰するかを記録したものです。サインスイープの録音は、解析前に既知のスイープ信号で逆畳み込みして IR に変換します。IR は楽曲や励振信号そのものではなく「部屋の反応」を見るため、RT60 や明瞭度のようなルーム音響指標を測りやすくなります。
:::

<SonareDemo id="room-decay" />

::: info 初出の用語
- **等価ルーム** は、測定された響きに近い単純な部屋モデルです。実際の部屋を正確にスキャンした結果ではありません。
- **RIR** は room impulse response の略で、部屋が短い音にどう反応するかを表す音声サンプルです。
- **シューボックス形状** は、長さ・幅・高さで表す直方体の部屋モデルです。
- **DRR** は直接音対残響音比です。音源から直接届く音と、部屋で反射して届く音の比を表します。
- **ルームモーフィング** は、目標ルームの響きを音作り効果として足す処理です。残響を取り除く残響除去とは別物です。

以下に登場する各指標の詳しい解説は[ルーム音響の用語集](./glossary.md#ルーム音響)を参照してください。
:::

::: tip ブラウザで試す
[空間ルームスキャナー](/ja/spatial) のデモは、この一連の処理をすべてローカルで実行します。録音をドロップする（またはサンプルルームを選ぶ）と、推定された形状・RT60・明瞭度・音源までの距離をインタラクティブな 3D シーンとして再構成します。再構成した部屋はコンボリューション用のインパルス応答として、推定値は JSON として保存できます。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- 入力録音に応じて、インパルス応答解析とブラインド音響推定を選べる。
- シューボックス寸法からモノラルのルームインパルス応答を合成できる。
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

`analyzeImpulseResponse(...)` と `detectAcoustic(...)` は `AcousticResult` を返します。結果には、全帯域の値とオクターブバンドごとの配列が含まれます。`estimateRoom(...)` は `RoomEstimateResult`、`synthesizeRir(...)` は `RirResult`、`roomMorph(...)` は `RoomMorphResult` を返します。モーフ後のサンプルは `audio` に入り、あわせて目標ルームの合成が報告した診断情報が付きます。

::: info なぜバンド別（オクターブバンド）なのか？
部屋はすべての周波数を均等に吸音するわけではなく、低音は高音より長く響くことがよくあります。解析をオクターブバンド（各バンドでおよそ周波数が倍になる: 125、250、500、1k、2k、4k Hz）に分けると、RT60 や明瞭度を 1 つの平均値ではなくバンドごとに別々に報告できます。1/3 オクターブのサブバンドは、ブラインド推定の内部で使うより細かい分割です。
:::

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

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,            // オクターブバンド数
  nThirdOctaveSubbands: 24,   // ブラインド推定で使う 1/3 オクターブ相当のサブバンド数
  minDecayDb: 30,             // 有効な減衰として扱う最小 dB
  noiseFloorMarginDb: 10,     // ノイズフロアに対する余裕 dB
});
console.log(blind.confidence, blind.isBlind);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.length, estimate.width, estimate.height);
console.log(estimate.drrDb, estimate.confidence, estimate.absorptionBands, estimate.rt60Bands);

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

const { audio: morphed, diagnostics } = roomMorph(dryVoice, sampleRate, {
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
print(estimate.drr_db, estimate.confidence, estimate.absorption_bands, estimate.rt60_bands)

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

# 形状からモノラルのルームインパルス応答を合成
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav

# 録音を目標ルームへモーフィング
sonare room-morph dry.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

Python の `Audio` からも同じ処理を呼べます: `audio.analyze_impulse_response(...)` と `audio.detect_acoustic(...)`。幾何ベースのルーム音響ヘルパー（`synthesizeRir`・`estimateRoom`・`roomMorph`）は、Python ではモジュールレベル関数、WASM パッケージではスタンドアロン関数です。

## 幾何ベースのルーム音響

ここは、録音を測るだけでなく、部屋モデルを作る・適用する API の説明です。

`synthesizeRir(...)` は、直方体の部屋からモノラル RIR を作ります。寸法はメートル、壁は一様な吸音率、音源と聴取位置は部屋の内側の座標で指定します。形状が不正な場合、JavaScript は `hasError: true` と空の `rir` を返し、Python では同じ状態を `has_error` として読めます。

`estimateRoom(...)` は、録音から等価ルームを推定します。正確な実空間を復元するものではありません。通常録音には部屋の減衰がはっきり出ていないことがあるため、必ず `confidence` を確認してください。

::: warning `estimateRoom(...)` が実際に解いているもの
この関数が解くのは、呼び出し側が与えた形状と吸音率の事前値のもとでの**スケール**で、形そのものではありません。

- 奥行き : 幅 : 高さの比は `aspectHintLw` ／ `aspectHintLh` から来ます（既定はどちらも `1`）。これらを省いた呼び出しは常に 3 つとも同じ寸法 — 立方体 — を返すので、ヒントを渡していない限り `length`・`width`・`height` を「復元された比率」として提示しないでください。
- 1 本の減衰が拘束するのは、等価吸音面積 `A` に対する容積 `V` の比 `V / A` で、容積と吸音率を別々には決められません。形状を固定すると、表面積は線寸法の 2 乗、容積は 3 乗で増えるため、同じ RT60 を保つには大きい部屋ほど平均吸音率を高くする必要があります。足りない情報を事前値 `referenceAbsorption`（既定 `0.15`）で補って容積を決めます。サビーンでは報告される容積が事前値のおおむね 3 乗で変わります。既定のアイリングでは対応する `-ln(1 − α)` の項を使うため、3 乗の規則はサビーンでの近似として扱ってください。録音どうしを比較するときは、この値を固定してください。

この事前値は拒否されず `[0.01, 0.99]` にクランプされます。範囲外の値を渡しても推定は成功しますが、計算に使われるのはクランプ後の値です。低い側では、報告される容積が 3 桁ずれることになります。
:::

::: info C では事前値の 0 は「既定値を使う」の意味です
`SonareRoomEstimateConfig` の float はすべて `0` を「未設定」として読み、`reference_absorption` も例外ではありません。`0` はライブラリ既定値の `0.15` を選びます。C ヘッダが想定している書き方は `SonareRoomEstimateConfig cfg = {};` です。ここで 0 をそのまま値として扱うと、解析側の下限 `0.01` に張り付きます。事前値が解く部屋のスケールを決めるため、普通の広さの部屋が 1 立方メートル未満として、しかも confidence は最大のまま報告され、その推定値を `sonare_synthesize_rir` に渡すと無関係な残響ができてしまいます。サビーンではこの容積が事前値の **3 乗**に近い形で変わり、既定のアイリングでは `-ln(1 − α)` の項で変わります。Node・Python・WASM は `0.15` を明示的に渡しており、動作は同じです。ほぼ剛壁の事前値が本当に必要な場合は、`0` ではなく `0.01` を指定してください。
:::

`roomMorph(...)` はオフラインの音作り効果です。合成した目標ルームの響きを足し、既存の残響尾部を少し弱めることがあります。この出力を残響除去として扱ったり説明したりしないでください。ルームの響きを足す処理であり、既存の残響を取り除く処理ではありません。

### ルームモーフの結果を読む

`roomMorph(...)` は `RoomMorphResult` を返します。モーフ後のサンプルは `audio`（入力長に目標ルームの残響テイルを足した長さで、足した残響が途中で切れることはありません）、そのサンプルレートは `sampleRate`、そして目標ルームの合成が結果を出すために変更した内容の一覧が `diagnostics` です。モーフは `synthesizeRir(...)` と同じコードで目標ルームを合成するため、同じ警告を報告します。どの警告も「指定したのとは別の部屋を通った」ことを意味し、音を聴いただけでは分かりません。分かるのはこの一覧だけです。

| `code` | 起きたこと | 対処 |
|--------|-----------|------|
| `acoustic.ism_order_clamped` | `ismOrder` が安全上限の `12` を超えていたため、上限まで下げられました。 | `12` 以下を指定して、要求とレンダリング結果を一致させます。 |
| `acoustic.rir_length_clamped` | 部屋本来の応答が上限より長く、テイルが切られました。どの上限かはメッセージが示します。`maxSeconds`、または `maxSeconds` が `0` のときは RIR の共有リソース上限です。 | `maxSeconds` を指定していたなら上げます。指定していないなら、その部屋の減衰は予算に収まらない長さなので、部屋を小さくするか吸音率を上げます。 |
| `acoustic.rir_length_floored` | `maxSeconds` が直接音の到達より前に終わるため、直接音が収まるまで延長されました。結果は要求より長くなります。 | `maxSeconds` を上げるか、聴取位置を音源に近づけます。 |
| `acoustic.no_late_tail` | 混合時刻の時点で使える拡散テイルがなく、目標ルームは初期反射だけになりました。全バンドで吸音率が `0` の完全な剛壁か、逆に吸音が強すぎてクロスオーバーの前にテイルが終わっているかのどちらかです。 | 吸音率を両極端から離すか、`mixingTimeMs` を下げます。 |

`RirResult` と違って `hasError` はありません。生成できないモーフ — 不正な形状、部屋の外にある聴取位置、物理的にありえない気象条件 — は `InvalidParameter` として例外になるため、`diagnostics` に入るのは「結果は得られたが注意が要る」警告だけです。分岐は `code` で行ってください。`message` は人が読むための文字列で、返ってきたモーフに付く `severity` はすべて `'warning'` です。

この形はどのサーフェスでも同じです。Node とブラウザは [JavaScript API の型](./js-api-types.md#roommorphresult) にある `RoomMorphResult` を返します。Python は `RoomMorphResult` データクラスを返し、その `diagnostics` は `RirDiagnostic` のリストです。C ABI では `sonare_room_morph` が成功したあとに `sonare_last_diagnostic_count()` / `sonare_last_diagnostic_code(i)` からエントリを読めます（[C++ API](./cpp-api.md#c-abi-からのルームモーフ) 参照）。`sonare room-morph` コマンドは各警告を `warning: <code>: <message>` の形で stderr に出力し、出力ファイルと `--json` のサマリは stdout 側に残ります。

### 壁の吸音率と材質

`synthesizeRir(...)` と `roomMorph(...)` は共通のシューボックス形状を取るため、壁の指定フィールドも同じです。壁の指定は、粗い順に 3 段階で表せます。

| フィールド | 型 | 意味 |
|------------|----|------|
| `absorption` | number | 全バンド一様の壁吸音率。`[0, 1]` の範囲内である必要があり、受理された値はさらに `[0, 0.999]` にクランプされます。最も単純なコントロールです。 |
| `bandAbsorption` | `Float32Array` / `number[]` | オクターブバンド別の壁吸音率（125 / 250 / 500 / 1k / 2k / 4k… Hz）。指定すると `absorption` を上書きします（ただし `materialPreset` が設定されている場合を除く）。 |
| `bandScattering` | `Float32Array` / `number[]` | バンド別の壁の散乱。指定のないバンドは `0` になります。吸音率のフィールドが選んだ壁材質に対して適用されます。 |
| `materialPreset` | number | 名前付きの壁材質プリセット。`1` コンクリート、`2` 木、`3` カーテン、`4` カーペット、`5` ガラス。1 つの材質がすべての面を覆うため、できる部屋は極端になります。全面カーペットの部屋は 125 Hz をほとんど吸音しません。非ゼロのプリセットは `bandAbsorption` と `absorption` の両方より優先されます。`bandScattering` とは優先順位を競いません。 |

優先順位が決めるのは**吸音率**だけです。高い順に、非ゼロの `materialPreset` がすべてに優先し、それ以外では `bandAbsorption`（バンド別）が `absorption`（一様）に優先します。したがって、自分のバンド別吸音率を効かせたいときは `materialPreset` を `0` のままにしてください。

`bandScattering` はこの優先順位の外にあります。吸音率の優先順位が選んだ壁材質に対して適用されるので、プリセットと散乱配列を同時に渡す指定も成り立ちます。プリセットの吸音率に、指定した粗さが重なります。

::: warning 散乱配列は必ず壁に届きます
`bandScattering` が無視されることはありません。`materialPreset` と併用した場合も同じです。散乱は鏡面的な初期反射からエネルギーを拡散させるため、ミキシングタイムと初期／後期のバランスが動きます。つまり、渡せばレンダリング結果は変わります。`synthesizeRir(...)` や `roomMorph(...)` に、実際には効かせたくない散乱配列を渡しているコードがあるなら、プリセットで打ち消されることを当てにせず、配列そのものを外してください。
:::

::: warning 範囲外の吸音率はクランプされず拒否されます
スカラーの `absorption` が非有限値、または `[0, 1]` の範囲外の場合は `InvalidParameter` で失敗します。クランプされるのは受理された値だけで、`[0, 0.999]` に収められます。完全な剛壁では減衰が有限時間で終わらないためです。`bandAbsorption` と `bandScattering` も同じ検証を通るため、壁の指定フィールドはどれも不正な値に対して同じ答えを返します。1 つだけが黙って別の部屋を組み立てることはありません。
:::

材質プリセットは整数コードに対応します。`0` なし、`1` コンクリート、`2` 木材、`3` カーテン、`4` カーペット、`5` ガラスです。コンクリートとガラスは反射的で高域のテールが残りやすく、カーテンとカーペットは吸音的でテールが短くなります。

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
  materialPreset: 0, // プリセットなし。吸音率は bandAbsorption が決める
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
| `airAbsorptionEnabled`, `airTemperatureC`, `airHumidityPercent` | 反射経路に沿った空気吸収を、後期テールのバンド別 RT60 に加えます。既定は OFF。[空気吸収](#空気吸収) を参照。 |

**混合時刻**は、応答が離散的な鏡像音源の初期反射から決定論的な統計的後期テールへ移る点で、**クロスフェード**はその境目が聞こえないよう両者をなじませます。Sabine と Eyring は後期テールの背後にある 2 つの古典的な RT60 推定法で、Eyring はより吸音的な部屋で精度が高い傾向があります。

::: tip Sabine と Eyring（普段は気にしなくてよい）
どちらも、部屋の大きさと表面の吸音具合から RT60 を予測する古典的な公式です。Eyring は吸音処理がよく効いた部屋でより正確になる傾向があり、Sabine はより古くて単純な方です。特定のリファレンスに合わせる場合を除いて、既定のままで構いません。
:::

::: details 鏡像音源の反射とは？
音が壁で反射するとき、各反射は「壁の向こう側にある音源の鏡像コピーから届いた音」としてモデル化できます。`ismOrder` は、この方法で何回の反射まで計算するかを決めます。次数を上げるほど初期エコーが増えますが、1 つ 1 つは弱くなり、CPU コストも上がります。拡散的な後期テールは別に生成されます。
:::

::: details ルーム合成の実装メモ
`synthesizeRir(...)` は、鏡像音源法による初期反射と、決定論的な後期テールを組み合わせます。`acoustic::RirSynthConfig` では、反射次数、Sabine/Eyring の後期テールモデル、シード、RIR の最大長、混合時刻、クロスフェード幅、そして任意の空気吸収の気象条件を指定できます。
:::

### 空気吸収

空気そのものも音を吸収します。低音よりはるかに高音を吸い、反射が進む距離に応じて損失が積み上がります。次の 3 つのオプションは、その損失を ISO 9613-1 の大気吸収モデルで計算し、後期テールのバンド別 RT60 に加えます。読むのは `synthesizeRir(...)`、`roomMorph(...)`、そして形状から RIR を作る `effects.reverb.room` インサートです。逆方向の `estimateRoom(...)` は受け取らず、CLI の `synthesize-rir` / `room-morph` コマンドにも対応するフラグはありません。

| オプション | 既定 | 受理範囲 | 意味 |
|------------|------|----------|------|
| `airAbsorptionEnabled` | `false` | boolean | 空気吸収項を加えます。OFF のとき RIR はこの機能なしでレンダリングしたものと同一なので、同じ記述の部屋は同じようにレンダリングされ続けます。 |
| `airTemperatureC` | `20` | −273.15 °C より上 | 気温。`0` または省略で ISO 基準の 20 °C を選ぶため、`0 °C` そのものは未指定と区別できません。氷点の部屋は `0.01` で指定してください。吸収量は同じです。 |
| `airHumidityPercent` | `50` | `0`〜`100` | 相対湿度。`0` または省略で ISO 基準の 50 % を選びます。 |

気象条件の 2 つは `airAbsorptionEnabled` が ON のときだけ読まれます。非有限値や範囲外の値は、周囲のジオメトリ検査と同じく範囲へ丸めるのではなく拒否されます。`synthesizeRir(...)` は `acoustic.invalid_air_absorption` を付けて `hasError` を返し、`roomMorph(...)` は `InvalidParameter` を投げます。気圧は入力ではなく、モデルは海面気圧で評価されます。

```typescript
const hall = synthesizeRir({
  lengthM: 30, widthM: 20, heightM: 12,
  absorption: 0.2,
  airAbsorptionEnabled: true,
  airTemperatureC: 20,        // 0 でも 20 の意味になる
  airHumidityPercent: 30,     // 基準より乾燥: 高域が早く減衰する
  sampleRate,
});
```

ON にすると主に大きな部屋の高域が短くなり、小さな部屋はほとんど変わりません。この項は周波数だけでなく部屋の容積にも比例して大きくなるためです。乾いた空気や冷たい空気ほど高域をよく吸います。各バンドがどちらへどれだけ動くかは [帯域別の減衰と吸音](./glossary/acoustics/absorption-bands.md#経路上の空気吸収) で追っています。

::: warning 壁の吸音の代わりにはなりません
空気吸収がモデル化するのは、伝搬経路上、つまり空気の中での損失です。境界での損失をモデル化する `absorption`・`bandAbsorption`・`materialPreset` の代わりにはならず、鏡像音源による初期反射にはまったく触れません。変わるのは統計的テールの減衰速度だけです。壁が反射的なせいで高域が鳴りすぎる部屋に必要なのは、より吸音的な壁材です。湿度では直りませんし、空気吸収項が無視できるほど小さい低域は動きません。
:::

## 結果の読み方

| フィールド | 意味 |
|------------|------|
| `rt60` | 残響が 60 dB 減衰するまでの推定時間。大きいほど響きが長い部屋です。 |
| `edt` | 最初の 10 dB に当てはめた初期減衰時間。体感上の残響感に近いことがあります。独立に当てはめられるのはインパルス応答モードのときだけです。 |
| `c50` | 音声向けの明瞭度。高いほど子音や会話が聞き取りやすい傾向があります。インパルス応答モード専用です。 |
| `c80` | 音楽向けの明瞭度。直接音・初期反射が後期残響に対してどれだけ強いかを示します。インパルス応答モード専用です。 |
| `d50` | 定義度。最初の 50 ms に含まれるエネルギーの割合（`0`〜`1`）です。インパルス応答モード専用です。 |
| `rt60Bands`, `edtBands`, `c50Bands`, `c80Bands` | 各測定値のバンド別配列。Python では snake_case 名も使えます。 |
| `confidence` | `0` から `1` の信頼度。低い場合は、十分にきれいな減衰が取れていません。 |
| `isBlind` / `is_blind` | インパルス応答前提ではなくブラインド推定で得た結果かどうか。 |

::: warning ブラインド解析が返すのは減衰だけです
`detectAcoustic(...)` は常にブラインド経路で動き、その経路が復元するのは後期減衰の速さだけです。`c50`・`c80`・`d50` は `NaN` で返り、`c50Bands` と `c80Bands` は空で返ります。直接音の到達時刻がなく、0 から −10 dB の独立した当てはめができないため、`edt` は `NaN` です。`edtBands` は要求したバンド数を保ちますが、全要素が `NaN` になります。明瞭度の数値や本来の EDT が必要なときは、手拍子・破裂音・逆畳み込み済みのスイープ由来 IR に対して `analyzeImpulseResponse(...)` を呼んでください。また、これらのフィールドを UI に表示する前に `NaN` を必ず確認してください。
:::

::: details RT60・EDT・C50/C80・D50 は何を測る？
いずれも、音が止まったあとに空間でどう減衰するかから求める標準的なルーム音響指標です。

- **RT60** — 残響が 60 dB 減衰するまでの秒数。「どれだけ響くか」を表す代表値で、小さな部屋なら約 0.3 秒、大聖堂なら数秒になります。
- **EDT**（早期減衰時間） — 減衰の最初の部分から測った減衰速度を 60 dB 降下に換算したもの。体感上の響きの豊かさは、RT60 より EDT の方がよく一致することが多いです。
- **C50 / C80**（明瞭度） — 初期エネルギー（最初の 50 ms / 80 ms）と、その後の残響との比を dB で表したもの。高いほど明瞭で直接音的です。C50 は会話、C80 は音楽の基準です。
- **D50**（定義） — 全エネルギーのうち最初の 50 ms に到達する割合（0〜1）。高いほど直接音的で、ぼやけが少なくなります。
:::

## 実用上の注意

信頼できる値が必要なら、きれいなインパルス応答を録音してください。

- 静かな環境で録る。
- クリップしないレベルにする。
- インパルス後の無音を十分に残す。
- 解析前に不要なノイズをトリムする。

ブラインド推定は「このテイクは響きすぎているかも」といった比較や警告には便利です。ただし、建築音響の正式な測定値として扱うものではありません。

ライブ表示や段階的な BPM/キー/コード推定が必要なら [リアルタイムとストリーミング](./realtime-streaming.md) を使います。楽曲メタデータが必要なら [JavaScript API](./js-api-analysis.md) または [Python API](./python-api.md) を参照してください。

## 関連

- [残響時間（RT60 と EDT）](./glossary/acoustics/reverberation-time.md) · [明瞭度と明瞭性（C50・C80・D50）](./glossary/acoustics/clarity-definition.md) — 主要な減衰・明瞭度の数値が表すもの
- [音源距離と DRR](./glossary/acoustics/source-distance.md) · [部屋の形状と容積](./glossary/acoustics/room-geometry.md) — 距離・等価シューボックス・Sabine の容積／吸音のトレードオフ
- [帯域別の減衰と吸音](./glossary/acoustics/absorption-bands.md) · [逆問題による部屋推定](./glossary/acoustics/inverse-estimation.md) — オクターブ帯域ごとの減衰と、インパルス応答／ブラインド推定と信頼度スコア
- [空間ルームスキャナー](/ja/spatial) — このパイプライン全体をローカルでインタラクティブな 3D シーンとして実行
