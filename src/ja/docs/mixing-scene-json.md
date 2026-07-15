---
title: ミキシングシーン JSON
description: ミキサーシーンの交換形式を解説。ストリップ・インサート・センド・バス・VCA・接続の全フィールドを、注釈つきの組み込みプリセットとともに示します。
---

# ミキシングシーン JSON

**シーン**は、ミキサー全体をプレーンデータで記述したものです。`Mixer.fromSceneJson(...)` が読み、`toSceneJson()` が書き出す形式（Python では `from_scene_json(...)` / `to_scene_json()`）で、WASM・Python・Node・C ABI・C++ で同一です。プレーンな JSON なので、プロジェクトと一緒に保存し、git で差分を取り、手で編集し、あとから読み直せます。

ストリップ・センド・バスにまだ馴染みがなければ、先に [ミキシングの基礎](./glossary/concepts/mixing-basics.md) と [ミキシングエンジン](./mixing.md) を読んでください。本ページはフィールドごとのリファレンスです。

下のデモでは、同じルーティングの考え方を JSON なしで確認できます。レーンが小さなミキサーへ入り、センドやレベルを変えると出力とメーターがすぐ変わります。シーンのフィールドが抽象的に感じる場合は、先にここで信号の流れをつかんでからスキーマへ戻ってください。

<SonareDemo id="engine-lane-mixer" />

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- シーン最上位の形と、ストリップ、バス、VCA グループ、接続の役割を見分けられる。
- ストリップ制御、インサート、センド、ルーティング辺を混同せずにシーンを編集・生成できる。
- どのフィールドに既定値があり、どの識別子をグラフ内で一致させる必要があるかを理解できる。
- 組み込みプリセットを、カスタム Scene JSON の安全な出発点として使える。

::: tip 実例で形式を学ぶ
スキーマを理解する最速の方法は、組み込みプリセットを出力して読むことです。`mixingScenePresetJson('vocalReverbSend')` の出力には以下のすべてのフィールドが現れるので、各キーを実際の値と対応づけられます。ページ末尾の[注釈つきシーン](#注釈つきの完全なシーン)がまさにそれです。
:::

## 最上位の形

```json
{
  "version": 1,
  "strips": [],
  "buses": [],
  "vcaGroups": [],
  "connections": []
}
```

| フィールド | 型 | 意味 |
|-----------|----|------|
| `version` | integer | スキーマバージョン。現在は**必ず `1`**。他の値は拒否されます。 |
| `strips` | array | トラックレーン（[ストリップ](#ストリップ)参照） |
| `buses` | array | 共有の行き先。`master` を含む（[バス](#バス)参照） |
| `vcaGroups` | array | 複数ストリップを一括調整するレベルグループ（[VCA グループ](#vca-グループ)参照） |
| `connections` | array | ルーティンググラフの辺（[接続](#接続)参照） |

::: warning 未知のキーは無視されるが、insert パラメータは監査される
パーサーは認識しないシーンフィールドを無視するため、前方互換のプロデューサは古いリーダーを壊さずにメタデータを追加できます。裏を返せば、**綴り間違いのシーンキーは黙って捨てられます** — `processorName`（誤）と `processor`（正）が典型です。設定が効かないように見えたら、以下の表と綴りを照合してください。

インサートの `params` キーにはセーフティネットがあります。シーンの読み込み後、どのプロセッサも消費しなかったパラメータキーは**非致命的な警告**として `Mixer.sceneWarnings()`(Python は `scene_warnings()`)から読み出せます。シーン自体は読み込まれ、未知のキーは単に効果を持たないだけです — 「効かないつまみ」を探し回る代わりに、読み込み直後に警告を確認してタイプミスを見つけてください。インサートが実際に読むキーの一覧は `masteringInsertParamNames(name)`(Python は `mastering_insert_param_names(name)`)で列挙できます。
:::

## ストリップ

各ストリップオブジェクトは 1 つのチャンネルレーンを表します。数値フィールドには妥当な既定値があるので、最小のストリップは `{ "id": "vocal" }` だけです。

| フィールド | 型 | 既定 | 意味 |
|-----------|----|------|------|
| `id` | string | —（必須） | 接続・センド・VCA メンバーが参照する一意の識別子 |
| `inputTrimDb` | number | `0` | 処理前のゲイン（[ストリップ信号フロー](./mixing.md#チャンネルストリップを信号順にたどる)の最初の段） |
| `faderDb` | number | `0` | メインフェーダーのレベル |
| `vcaOffsetDb` | number | `0` | フェーダー段に加算されるストリップごとの VCA トリム（`setVcaOffsetDb(...)` のライブ値。[VCA グループ](#vca-グループ)の `gainDb` とは別で、そちらはデルタとして上乗せされこのフィールドには書き込まれません） |
| `pan` | number | `0` | パン位置。`-1`（左）…`+1`（右） |
| `width` | number | `1` | ステレオ幅／サイド倍率（`0` = モノラル、`>1` = より広い） |
| `muted` | boolean | `false` | ストリップを無音化 |
| `soloed` | boolean | `false` | 他の（ソロセーフでない）ストリップを暗黙ミュート |
| `soloSafe` | boolean | `false` | 他ストリップのソロで暗黙ミュートされない |
| `panMode` | integer | `0` | `0` = バランス、`1` = ステレオパン、`2` = デュアルパン |
| `dualPanLeft` | number | `-1` | デュアルパン時の左位置（既定はハード L の恒等ルーティングでステレオ像を保持） |
| `dualPanRight` | number | `1` | デュアルパン時の右位置（既定はハード R の恒等ルーティング） |
| `surroundPan` | object | identity | ステレオより広いホスト向けのサラウンドパン位置。`azimuth`・`divergence`・`lfe` は[リアルタイムエンジンの 5.1/7.1 グループバスパンナー](./realtime-engine.md#サラウンドグループバスとワイドメーター)に反映され、`elevation` と `distance` は予約です。値は検証されシーン JSON を往復します。単体のオフライン `Mixer` はステレオのため適用しません |
| `polarityInvertLeft` | boolean | `false` | 左チャンネルの極性反転 |
| `polarityInvertRight` | boolean | `false` | 右チャンネルの極性反転 |
| `panLaw` | integer | `0` | `0` = 定 3 dB、`1` = 定 4.5 dB、`2` = 定 6 dB、`3` = リニア 0 dB |
| `channelDelaySamples` | integer | `0` | ストリップごとの遅延。[PDC](./mixing.md#レイテンシとプラグインディレイ補償-pdc) にも寄与 |
| `inserts` | array | `[]` | 直列のプロセッサ（[インサート](#インサート)参照） |
| `sends` | array | `[]` | バスへの並列センド（[センド](#センド)参照） |

::: info enum はファイルでは整数、API では文字列
シーン**ファイル**は `panMode` と `panLaw` を整数で保存しますが、インサートの `slot` とセンドの `timing` は短い文字列トークン `"pre"` / `"post"` で保存します。JavaScript の実行時**メソッド**は分かりやすい文字列を受け付けます — `setPanLaw(strip, 'const3dB')`、`addSend(..., 'postFader')`。Python はセンド／メータータップでは同じ名前を受け付けますが、パンロー文字列は `'const-3db'`、`'const-4.5db'`、`'const-6db'`、`'linear-0db'` のような正規化名（または enum/int 値）を使います。どちらも同じ内部値に対応し、違いはファイル形式か使いやすい API かだけです。

実行時にパンを編集したあとでシーンを書き出しても、ストリップの現在の `panMode` は保持されます。パン関連フィールドを手で組み直すのではなく、`Mixer.toSceneJson()` / `Mixer.to_scene_json()` を使ってください。

インサートの `slot` とセンドの `timing` は**必ず文字列で指定してください**。`"timing": 1` のような文字列以外の値は、読み込み時に `InvalidParameter` エラー(`send timing must be a string ("pre" or "post")`)として拒否されます。常に `"pre"` か `"post"` と書いてください。
:::

::: details フィールド用語: デュアルパン・ポラリティ反転・パンロー・PDC
- **デュアルパン**（`panMode: 2`） — 信号全体をまとめて動かすのではなく、左右チャンネルを*独立した*位置にパンします。すでにステレオの素材を狭めたり配置し直したりするのに便利です。
- **ポラリティ反転** — チャンネルを −1 倍して波形を反転します。別トラックと逆相で録れてしまった場合の補正に使います。位相関係を変えるもので、それ自体は体感ラウドネスを変えません。
- **パンロー**（pan law） — パンしてもラウドネスが一定に保たれるよう、中央を左右いっぱいに対してどれだけ下げるか。`定 3/4.5/6 dB` は定パワー系、`リニア 0 dB` は合算レベルを一定に保ちます。[ミキシングエンジン](./mixing.md#パンモードとパンロー) を参照してください。
- **PDC**（プラグインディレイ補償） — ある経路がルックアヘッド処理で遅れるとき、エンジンが短い経路を合わせて遅らせ、マスターで揃えます。`channelDelaySamples` はこの計算に入ります。
:::

## インサート

インサートは、ストリップ（またはバス）内で直列に動く名前付きプロセッサです。

| フィールド | 型 | 意味 |
|-----------|----|------|
| `slot` | `"pre"` \| `"post"` | フェーダーの前か後で動く。**短いトークン**に注意 — `preFader`/`postFader` ではありません。 |
| `processor` | string | プロセッサ id（例 `eq.parametric`、`dynamics.compressor`、`effects.reverb.plate`）。ソロプロセッサは [マスタリングプロセッサ](./mastering-processors.md)、クリエイティブ FX のカタログは [エフェクトインサート](./effects-inserts.md) を参照。 |
| `params` | string | プロセッサのパラメータを **JSON 文字列**（エスケープしたオブジェクト）で。例 `"{\"thresholdDb\":-18,\"ratio\":2.5}"`。 |
| `sidechainKey` | string | *任意。* このインサートの外部サイドチェインへ送るストリップ id（ダッキングなど）。空のときは省略されます。 |

::: info サイドチェインとダッキング
通常、プロセッサは自分を通過する音声に反応します。**サイドチェイン**を使うと、代わりに*別の*トラックに反応させられます。`sidechainKey` がその別ストリップを指定します。定番の用途は**ダッキング**です。音楽側にかけたコンプが、指定した声のストリップが大きいときに音楽を下げ、音楽ベッドの上で話声をクリアに保ちます。
:::

::: warning `params` はオブジェクトではなく文字列
シーン JSON 内では `params` はネストしたオブジェクトではなく、**エスケープした JSON 文字列**を保持します — `"params": "{\"ratio\":2.5}"`。これにより各プロセッサのパラメータスキーマをシーンパーサーから不透明に保てます。個別の値を読むには自分でパースしてください。
:::

## センド

センドは、ストリップ信号の*コピー*を行き先バスへ送ります。フェーダーの前（`"pre"`）でタップするか後（`"post"`）でタップするかは `timing` フィールドで選びます — [チャンネルストリップの信号フロー](./mixing.md#チャンネルストリップを信号順にたどる)を参照してください。

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | センド識別子 |
| `destinationBusId` | string | 対象バスの `id` |
| `sendDb` | number | センドレベル（dB） |
| `timing` | `"pre"` \| `"post"` | フェーダーの前か後でタップ（こちらも短いトークン） |

## バス

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | バス識別子（慣習上 1 つは `"master"`） |
| `role` | string | `"master"`、`"aux"`、または `"submix"` などのグループバス |
| `inserts` | array | バス自体のプロセッサ（ストリップと同じ[インサート](#インサート)形式） |

::: info 特別なロールトークンは `master` と `aux` だけ
エンジンが特別扱いするのは `master` と `aux` だけで、**それ以外のロール文字列は単なるマスター以外のバス**です。つまり「ドラムバス」は、ロールが `submix` でも `subgroup` でも `group` でも同じように動きます。トークンは挙動を切り替えるスイッチではなくラベルです。組み込みの `drumBusSubgroup` プリセットは `subgroup` を使うので、出力する（`mixingScenePresetJson('drumBusSubgroup')`）と `"role": "submix"` ではなく `"role": "subgroup"` が表示されます。
:::

## VCA グループ

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | グループ識別子 |
| `gainDb` | number | 各メンバーのフェーダーに加算するオフセット |
| `members` | string[] | グループが統括するストリップ id |

## 接続

| フィールド | 型 | 意味 |
|-----------|----|------|
| `source` | string | 信号が出るストリップ／バス id |
| `destination` | string | 信号が入るストリップ／バス id |

接続はグラフの辺です。`master` へ送るストリップは `{ "source": "vocal", "destination": "master" }` です。センドのバスは、バス（またはそのリターンストリップ）から `master` への接続を通じてマスターへ届きます。

## 組み込みプリセット

| プリセット | 意図 |
|-----------|------|
| `vocalReverbSend` | ボーカルストリップ（EQ + コンプのインサート）と、プレートリバーブリターンへのポストフェーダー AUX センド |
| `drumBusSubgroup` | キック／スネア／オーバーヘッドをグループバス（ロール `subgroup`）へ送り、パラレルコンプとテープで一体感を出し、「drums」VCA で調整 |
| `commentaryDucking` | host／guest の話声（ディエス + コンプ）と、host をキーにした `dynamics.sidechainRouter` でダッキングする音楽ベッド |

実行時には `mixingScenePresetNames()` で一覧を取得し、`mixingScenePresetJson(name)` で 1 つを取得します。

## 注釈つきの完全なシーン

これは `mixingScenePresetJson('vocalReverbSend')` の実際の出力です（読みやすさのため既定値は省略）。すべての関係が現れます。2 つのプリフェーダーインサートとポストフェーダーセンドを持つボーカルストリップ、リバーブリターンストリップ、2 つのバス、それらをマスターへ配線する接続です。

```json
{
  "version": 1,
  "strips": [
    {
      "id": "vocal",
      "faderDb": -3,
      "inserts": [
        { "slot": "pre", "processor": "eq.parametric",
          "params": "{\"band0.type\":4,\"band0.frequencyHz\":80,\"band1.frequencyHz\":4000,\"band1.gainDb\":2}" },
        { "slot": "pre", "processor": "dynamics.compressor", "params": "{\"thresholdDb\":-18,\"ratio\":2.5}" }
      ],
      "sends": [
        { "id": "vocal-to-verb", "destinationBusId": "vocal-verb", "sendDb": -14, "timing": "post" }
      ]
    },
    {
      "id": "vocal-verb-return",
      "faderDb": -10,
      "width": 1.25,
      "inserts": [
        { "slot": "post", "processor": "effects.reverb.plate", "params": "{\"decaySec\":1.8,\"preDelayMs\":25}" }
      ]
    }
  ],
  "buses": [
    { "id": "master",     "role": "master" },
    { "id": "vocal-verb", "role": "aux" }
  ],
  "vcaGroups": [],
  "connections": [
    { "source": "vocal",             "destination": "master" },
    { "source": "vocal-verb",        "destination": "vocal-verb-return" },
    { "source": "vocal-verb-return", "destination": "master" }
  ]
}
```

リバーブの経路を下の図でたどれます。リバーブは 1 インスタンスで、ドライのボーカルとウェットのリターンは **master** への別経路として分離されたままです。

<FlowDiagram
  title="リバーブセンドの信号経路"
  direction="LR"
  :nodes="[
    { id: 'vocal', label: 'vocal（ストリップ）', col: 0, row: 0 },
    { id: 'bus', label: 'vocal-verb（AUX バス）', col: 1, row: 1 },
    { id: 'return', label: 'vocal-verb-return（プレートリバーブ）', col: 2, row: 1, variant: 'accent' },
    { id: 'master', label: 'master', col: 3, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'vocal', to: 'master', label: 'ドライ' },
    { from: 'vocal', to: 'bus', label: 'ポストフェーダーセンド' },
    { from: 'bus', to: 'return' },
    { from: 'return', to: 'master', label: 'ウェット' }
  ]"
  caption="vocal ストリップは master へ直接つながり（ドライ）、同時にポストフェーダーセンドで vocal-verb AUX バスへ送られます。そのバスはプレートリバーブを置いた vocal-verb-return ストリップへ入り、master へ戻ります（ウェット）。"
/>

::: tip `eq.parametric` インサートはバンドインデックス指定のキーを使う
`eq.parametric` インサートが読むのは**バンドインデックス指定のキー**です — `band{N}.type`、`band{N}.frequencyHz`、`band{N}.gainDb`、`band{N}.q`、およびバンドごとのダイナミック EQ フィールド。このプリセットでは `band0` が 80 Hz のハイパス(`"band0.type": 4` は EQ バンドタイプ enum の `HighPass`)、`band1` が 4 kHz の +2 dB プレゼンスベルで、実際に機能するハイパス＋プレゼンスブーストになっています。

キーの全一覧は `masteringInsertParamNames('eq.parametric')` で取得できます。一覧外のキー(たとえばフラットな `highPassHz`)も読み込みは通りますが効果を持たず、シーン読み込み後に `Mixer.sceneWarnings()` が報告します。

つまみ 1 つのトーン調整には、より単純なインサートも使えます。明暗を広く傾けるなら `eq.tilt`(`tiltDb`、`pivotHz`)、高域シェルフの「エア」を持ち上げるなら `spectral.airBand`(`amount`、`shelfFrequencyHz`)です。
:::

## 編集して保存し直す

::: code-group

```typescript [ブラウザ]
const json = mixingScenePresetJson('vocalReverbSend');
const mixer = Mixer.fromSceneJson(json, 48000, 512);

mixer.sceneWarnings();  // [] — タイプミスした insert パラメータがあれば非致命的にここへ並ぶ

mixer.addSend(0, 'more-verb', 'vocal-verb', -18, 'postFader');  // トポロジー変更
mixer.compile();                                                 // タイミングが重要な処理の前に再構築

const saved = mixer.toSceneJson();   // 同じスキーマへラウンドトリップ
```

```python [Python]
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json('vocalReverbSend')
mixer = sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512)

mixer.scene_warnings()  # [] — タイプミスした insert パラメータがあれば非致命的にここへ並ぶ

mixer.add_send(0, 'more-verb', 'vocal-verb', -18, 'post_fader')  # トポロジー変更
mixer.compile()                                                  # タイミングが重要な処理の前に再構築

saved = mixer.to_scene_json()   # 同じスキーマへラウンドトリップ
mixer.close()                   # ネイティブハンドルを解放
```

```bash [Python CLI]
# 組み込みシーンを書き出し、JSON を編集してからレンダーする。
sonare mixing-preset --preset vocalReverbSend > my-scene.json
sonare mix --scene my-scene.json --input vocal.wav --input reverb-return.wav -o master.wav
```

:::

::: info `mix --scene` でのストリップごとの入力指定は Python CLI 限定
JSON ファイルからシーン全体をレンダーし、ストリップごとに `--input` を 1 つずつ渡す機能は Python CLI が実装しています。C++ CLI の `mix` コマンドは単一ストリップ・単一入力のプロセッサ（`--scene` 非対応）です。フルシーンのレンダーではなく、ストリップ単位の手早い確認に使ってください。
:::

::: tip いつ再コンパイルするか
構造的な編集 — バス・センド・接続の追加／削除 — はグラフを dirty にし、次のタイミングが重要なブロックの前に `compile()` が必要です。パラメータ操作（`setSendDb` / Python `set_send_db`、`setPanLaw`）、VCA グループの変更（追加・削除・ゲイン調整。メンバーストリップへのコントロール専用ゲインオフセットとして即時反映されます）、スケジュール済みオートメーションには再コンパイルは不要です。
:::

## 関連

- [ミキシングデモのプロジェクト JSON](./mixing-demo-project-json.md) — `/mixing` デモの UI プロジェクトファイル。ミキサーシーン*ではない*トラックごとのアレンジ形式
- [ミキシングエンジン](./mixing.md) — API ガイドと信号フロー
- [ミキシングの基礎](./glossary/concepts/mixing-basics.md) — 用語
- [マスタリングプロセッサ](./mastering-processors.md) — マスタリングレジストリの有効な `processor` id
- [エフェクトインサート](./effects-inserts.md) — 追加のクリエイティブ FX ミキサーインサート名
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの差分
