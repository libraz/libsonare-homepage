---
title: ミキシングシーン JSON
description: ミキサーシーンの交換形式を解説。ストリップ・インサート・センド・バス・VCA・接続の全フィールドと、同梱の JSON Schema、注釈つきの組み込みプリセットを示します。
---

# ミキシングシーン JSON

**シーン**は、ミキサー全体をプレーンデータで記述したものです。`Mixer.fromSceneJson(...)` が読み、`toSceneJson()` が書き出す形式（Python では `from_scene_json(...)` / `to_scene_json()`）で、WASM・Python・Node・C ABI・C++ で同一です。プレーンな JSON なので、プロジェクトと一緒に保存し、git で差分を取り、手で編集し、あとから読み直せます。この形式の JSON Schema `mixer-scene.schema.json` が npm と Python のパッケージに同梱されているので、手書きや生成したシーンをミキサーへ渡す前に検査できます — [スキーマでシーンを検証する](#スキーマでシーンを検証する) を参照してください。

ストリップ・センド・バスにまだ馴染みがなければ、先に [ミキシングの基礎](./glossary/concepts/mixing-basics.md) と [ミキシングエンジン](./mixing.md) を読んでください。本ページはフィールドごとのリファレンスです。

下のデモでは、同じルーティングの考え方を JSON なしで確認できます。レーンが小さなミキサーへ入り、センドやレベルを変えると出力とメーターがすぐ変わります。シーンのフィールドが抽象的に感じる場合は、先にここで信号の流れをつかんでからスキーマへ戻ってください。

<SonareDemo id="engine-lane-mixer" />

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- シーン最上位の形と、ストリップ、バス、VCA グループ、接続の役割を見分けられる。
- ストリップ制御、インサート、センド、ルーティング辺を混同せずにシーンを編集・生成できる。
- どのフィールドに既定値があり、どの識別子をグラフ内で一致させる必要があるかを理解できる。
- 同梱の JSON Schema でシーンを検証し、どの誤りはローダーにしか捕まえられないかを知っている。
- 組み込みプリセットを、カスタム Scene JSON の安全な出発点として使える。

::: tip 実例で形式を学ぶ
形式を理解する最速の方法は、組み込みプリセットを出力して読むことです。`mixingScenePresetJson('vocalReverbSend')` の出力には以下のすべてのフィールドが現れるので、各キーを実際の値と対応づけられます。ページ末尾の[注釈つきシーン](#注釈つきの完全なシーン)がまさにそれです。
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
| `version` | integer | 形式のバージョン。現在は**必ず `1`**。他の値は拒否されます。スキーマではこのキーは必須ですが、ローダーは `version` の欠落を `1` として扱います。 |
| `strips` | array | トラックレーン（[ストリップ](#ストリップ)参照） |
| `buses` | array | 共有の行き先。`master` を含む（[バス](#バス)参照） |
| `vcaGroups` | array | 複数ストリップを一括調整するレベルグループ（[VCA グループ](#vca-グループ)参照） |
| `connections` | array | ルーティンググラフの辺（[接続](#接続)参照） |

::: warning ローダーは未知のキーを読み飛ばすが、スキーマは飛ばさない
パーサーは認識しないシーンフィールドを無視するため、前方互換のプロデューサは古いリーダーを壊さずにメタデータを追加できます。裏を返せば、**綴り間違いのシーンキーは黙って捨てられます** — `processorName`（誤）と `processor`（正）、あるいは `faderDb` のつもりの `faderDB` は、エラーも出さずにフェーダーを既定値のまま据え置きます。同梱のスキーマはまさにこの穴を塞ぎます。スキーマ内のすべてのオブジェクトが `additionalProperties: false` なので、バリデータがファイルの読み込み前に綴り間違いを報告します。

インサートの `params` キーには別のセーフティネットがあります。シーンの読み込み後、どのプロセッサも消費しなかったパラメータキーは**非致命的な警告**として `Mixer.sceneWarnings()`（Python は `scene_warnings()`）から読み出せます。シーン自体は読み込まれ、未知のキーは単に効果を持たないだけです — 「効かないつまみ」を探し回る代わりに、読み込み直後に警告を確認してタイプミスを見つけてください。インサートが実際に読むキーの一覧は `masteringInsertParamNames(name)`（Python は `mastering_insert_param_names(name)`）で列挙できます。
:::

## ストリップ

各ストリップオブジェクトは 1 つのチャンネルレーンを表します。数値フィールドには妥当な既定値があるので、最小のストリップは `{ "id": "vocal" }` だけです。

| フィールド | 型 | 既定 | 意味 |
|-----------|----|------|------|
| `id` | string | —（必須） | 接続・センド・VCA メンバーが参照する一意の識別子 |
| `inputTrimDb` | number | `0` | 処理前のゲイン（[ストリップ信号フロー](./mixing.md#チャンネルストリップを信号順にたどる)の最初の段） |
| `faderDb` | number | `0` | メインフェーダーのレベル |
| `vcaOffsetDb` | number | `0` | フェーダー段に加算されるストリップごとの VCA トリム（`setVcaOffsetDb(...)` のライブ値。[VCA グループ](#vca-グループ)の `gainDb` とは別で、そちらはデルタとして上乗せされこのフィールドには書き込まれません） |
| `pan` | number | `0` | パン位置。`-1`（左）…`+1`（右）。ローダーはこの範囲へクランプし、スキーマは範囲外の値を拒否します |
| `width` | number | `1` | ステレオ幅／サイド倍率（`0` = モノラル、`1` = 変化なし、`2` = 2 倍）。読み込み時に `0` … `2` へクランプされ、スキーマは範囲外の値を拒否します |
| `muted` | boolean | `false` | ストリップを無音化 |
| `soloed` | boolean | `false` | 他の（ソロセーフでない）ストリップを暗黙ミュート |
| `soloSafe` | boolean | `false` | 他ストリップのソロで暗黙ミュートされない |
| `panMode` | integer | `0` | `0` = バランス、`1` = ステレオパン、`2` = デュアルパン。それ以外は読み込み時に**拒否**されます |
| `dualPanLeft` | number | `-1` | デュアルパン時の左位置（既定はハード L の恒等ルーティングでステレオ像を保持）。`-1` … `+1` へクランプ |
| `dualPanRight` | number | `1` | デュアルパン時の右位置（既定はハード R の恒等ルーティング）。`-1` … `+1` へクランプ |
| `sourceLayout` | string | `"stereo"` | ストリップへ入るソースのチャンネルレイアウト。`"mono"`、`"stereo"`、`"5.1"`、`"7.1"` のいずれか。ライターは既定のステレオでは省略し、それ以外の文字列は読み込み時に拒否されます |
| `surroundPan` | object | identity | ステレオより広いホスト向けのサラウンドパン位置。`azimuth`・`divergence`・`lfe` は[リアルタイムエンジンの 5.1/7.1 グループバスパンナー](./realtime-engine.md#サラウンドグループバスとワイドメーター)に反映され、`elevation` と `distance` は予約です。値は読み込み時にクランプされ、シーン JSON を往復します。ライターは中央の既定値ではオブジェクトごと省略します。単体のオフライン `Mixer` はステレオのため適用しません |
| `metering` | object | すべて有効 | ストリップが計算するメーターの選択。`enabled`・`lufs`・`truePeak`（boolean、既定 `true`）と `truePeakOversample`（integer、既定 `4`、`1` … `16` の範囲）。すべてのメーターが既定のとき、ライターはオブジェクトごと省略します |
| `polarityInvertLeft` | boolean | `false` | 左チャンネルの極性反転 |
| `polarityInvertRight` | boolean | `false` | 右チャンネルの極性反転 |
| `panLaw` | integer | `0` | `0` = 定 3 dB、`1` = 定 4.5 dB、`2` = 定 6 dB、`3` = リニア 0 dB。それ以外は読み込み時に**拒否**されます |
| `channelDelaySamples` | integer | `0` | ストリップごとの遅延。`0` … `192000`。[PDC](./mixing.md#レイテンシとプラグインディレイ補償-pdc) にも寄与。範囲外は読み込み時に拒否されます |
| `inserts` | array | `[]` | 直列のプロセッサ（[インサート](#インサート)参照） |
| `sends` | array | `[]` | バスへの並列センド（[センド](#センド)参照） |

::: info enum はファイルでは整数、API では文字列
シーン**ファイル**は `panMode` と `panLaw` を整数で保存しますが、インサートの `slot` とセンドの `timing` は短い文字列トークン `"pre"` / `"post"` で保存します。JavaScript の実行時**メソッド**は分かりやすい文字列を受け付けます — `setPanLaw(strip, 'const3dB')`、`addSend(..., 'postFader')`。Python はセンド／メータータップでは同じ名前を受け付けますが、パンロー文字列は `'const-3db'`、`'const-4.5db'`、`'const-6db'`、`'linear-0db'` のような正規化名（または enum/int 値）を使います。どちらも同じ内部値に対応し、違いはファイル形式か使いやすい API かだけです。

実行時にパンを編集したあとでシーンを書き出しても、ストリップの現在の `panMode` は保持されます。パン関連フィールドを手で組み直すのではなく、`Mixer.toSceneJson()` / `Mixer.to_scene_json()` を使ってください。

インサートの `slot` とセンドの `timing` は**必ず文字列で指定してください**。`"timing": 1` のような文字列以外の値は、読み込み時に `send timing must be a string ("pre" or "post")` という理由で拒否されます。常に `"pre"` か `"post"` と書いてください。
:::

::: warning シーンが拒否されたときの届き方は実行環境ごとに異なります
シーンの構築を止める要因 — 壊れた JSON、範囲外のフィールド、文字列でない `timing` — は、同じ実行環境の中ではすべて同じ形で失敗します。ただし実行環境どうしでは形が揃っていません。具体的な理由はメッセージに載りますが、エラーの型で分岐する価値はありません。

| 実行環境 | 受け取るもの | 内側の理由 |
|----------|--------------|------------|
| WASM | `InvalidState`、メッセージは `failed to build mixer from scene JSON: <reason>` | 保持される |
| Node ネイティブ | 型のない `Napi::Error`、メッセージは同じ | 保持される |
| Python | 素の `RuntimeError` | **落ちる** — メッセージは `failed to build mixer from scene JSON` のみ |
| C ABI | `sonare_mixer_from_scene_json` が `nullptr` を返す | `sonare_last_error_message()` を読む |

例外にフィールド名を言わせるのではなく、ミキサーへ渡す前にシーンを検証してください。Python では例外と一緒にシーンそのものをログへ残してください。メッセージだけでは、どのフィールドが不正だったかは分かりません。
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
| `slot` | `"pre"` \| `"post"` | フェーダーの前か後で動く。省略時は `"pre"`。**短いトークン**に注意 — `preFader`/`postFader` ではありません。 |
| `processor` | string | *必須。* プロセッサ id（例 `eq.parametric`、`dynamics.compressor`、`effects.reverb.plate`）。ソロプロセッサは [マスタリングプロセッサ](./mastering-processors.md)、クリエイティブ FX のカタログは [エフェクトインサート](./effects-inserts.md) を参照。レジストリにない id を拒否するのはスキーマではなく、ミキサーの構築時です。 |
| `params` | object | プロセッサのパラメータをパラメータ名をキーにしたオブジェクトで。例 `{ "thresholdDb": -18, "ratio": 2.5 }`。値は数値か boolean で、プロセッサ固有の例外が 2 つあります。名前付きリグや埋め込みインパルス応答には文字列、音響ルームモーフにはバンドごとの配列です。 |
| `sidechainKey` | string | *任意。* このインサートの外部サイドチェインへ送るストリップ id（ダッキングなど）。空のときは省略されます。 |

::: info サイドチェインとダッキング
通常、プロセッサは自分を通過する音声に反応します。**サイドチェイン**を使うと、代わりに*別の*トラックに反応させられます。`sidechainKey` がその別ストリップを指定します。定番の用途は**ダッキング**です。音楽側にかけたコンプが、指定した声のストリップが大きいときに音楽を下げ、音楽ベッドの上で話声をクリアに保ちます。
:::

::: warning `params` はオブジェクト。エスケープ文字列の形はレガシー
`toSceneJson()` は `params` をネストしたオブジェクト — `"params": { "ratio": 2.5 }` — として書き出し、スキーマが認めるのもこの形だけです。ローダーは古い形であるエスケープした JSON 文字列（`"params": "{\"ratio\":2.5}"`）も引き続き受け付けるので、以前のリリースで保存したシーンはそのまま読み込めますが、バリデータは `is not object` として拒否します。シーンを手で書くときはオブジェクト形を使ってください。オブジェクトでも文字列でもない値は、読み込み時に `insert params must be a JSON object (or the legacy JSON string)` で拒否されます。
:::

## センド

センドは、ストリップ信号の*コピー*を行き先バスへ送ります。フェーダーの前（`"pre"`）でタップするか後（`"post"`）でタップするかは `timing` フィールドで選びます — [チャンネルストリップの信号フロー](./mixing.md#チャンネルストリップを信号順にたどる)を参照してください。

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | センド識別子。ストリップ内で一意 |
| `destinationBusId` | string | *必須。* 対象バスの `id`。同じドキュメント内のバスを指していなければならず、そうでなければミキサーの構築が `send destination is not a bus` で拒否します |
| `sendDb` | number | センドレベル（dB）。既定 `0` |
| `timing` | `"pre"` \| `"post"` | フェーダーの前か後でタップ（こちらも短いトークン）。省略時は `"post"` |

## バス

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | *必須。* バス識別子（慣習上 1 つは `"master"`） |
| `role` | string | `"master"`、`"aux"`（既定）、または `"submix"` などのグループバス |
| `layout` | string | バスのチャンネルレイアウト。`"mono"`、`"stereo"`（既定）、`"5.1"`、`"7.1"` のいずれか。マスターバスはプロジェクトの出力レイアウトを持ちます。ライターは既定のステレオでは省略します |
| `inputTrimDb` | number | バス入力のゲイン。既定 `0` |
| `width` | number | バスのステレオ幅。既定 `1`。ストリップと同じく `0` … `2` へクランプ。`layout` がステレオより広いと拒否されます ── サラウンドベッドには狭めたり広げたりするステレオ像がありません |
| `polarityInvertLeft` / `polarityInvertRight` | boolean | バスのチャンネルごとの極性反転。既定 `false` |
| `inserts` | array | バス自体のプロセッサ（ストリップと同じ[インサート](#インサート)形式） |

ライターは `layout`・`inputTrimDb`・`width`・両方の極性フラグを既定値のときは省略するので、素のステレオバスは `id`・`role`・`inserts` だけでシリアライズされます。

::: info 特別なロールトークンは `master` と `aux` だけ
エンジンが特別扱いするのは `master` と `aux` だけで、**それ以外のロール文字列は単なるマスター以外のバス**です。つまり「ドラムバス」は、ロールが `submix` でも `subgroup` でも `group` でも同じように動きます。トークンは挙動を切り替えるスイッチではなくラベルです。組み込みの `drumBusSubgroup` プリセットは `subgroup` を使うので、出力する（`mixingScenePresetJson('drumBusSubgroup')`）と `"role": "submix"` ではなく `"role": "subgroup"` が表示されます。その帰結として、`"mastre"` と綴り間違えてもエラーにはならず、マスターバスのないシーンになります。
:::

## VCA グループ

VCA グループは、複数ストリップの音声を再ルーティングせずにレベルだけをまとめて調整する 1 本のフェーダーです（VCA は voltage-controlled amplifier＝電圧制御アンプの略）。

| フィールド | 型 | 意味 |
|-----------|----|------|
| `id` | string | *必須。* グループ識別子 |
| `gainDb` | number | 各メンバーのフェーダーに加算するオフセット。既定 `0` |
| `members` | string[] | グループが統括するストリップ id |

## 接続

| フィールド | 型 | 意味 |
|-----------|----|------|
| `source` | string | *必須。* 信号が出るストリップ／バス id |
| `destination` | string | *必須。* 信号が入るストリップ／バス id |

接続はグラフの辺です。`master` へ送るストリップは `{ "source": "vocal", "destination": "master" }` です。センドのバスは、バス（またはそのリターンストリップ）から `master` への接続を通じてマスターへ届きます。両端ともドキュメント内のストリップかバスを指していなければならず、そうでなければミキサーの構築が `connection references unknown node` で拒否します。

出ていく接続を持たないストリップは、グラフ構築時に自動でマスターバスへ配線されます。明示的に宣言したバスはそうなりません。出ていく接続のない AUX バスやグループバスは未接続のまま残り、これがシーンで意図的にバスを黙らせておく方法です。

## スキーマでシーンを検証する

シーン形式は `MixSceneDocument` という題の JSON Schema（draft 2020-12）で記述されています。対象は `Mixer.fromSceneJson` が読み、`toSceneJson` が書き、[`suggestMixScene`](./mixing-assistant.md) が返し、`sonare mix --scene` が読み込むドキュメントです。エンジン自身のテストがスキーマをライターの公開フィールド一覧と突き合わせ、すべての組み込みプリセットをスキーマで検証しているので、ライターが書き出すキーがスキーマに欠けていることはありません。

| 場所 | パス |
|------|------|
| エンジンのソースツリー | `schemas/mixer-scene.schema.json` |
| npm `@libraz/libsonare` | exports サブパス `@libraz/libsonare/schemas/mixer-scene.schema.json` |
| Python ホイール | インストール済みパッケージ内の `libsonare/schemas/mixer-scene.schema.json` |
| Python sdist | `schemas/mixer-scene.schema.json` |

`$id`（`https://libraz.net/schemas/libsonare/mixer-scene.schema.json`）は識別子であってダウンロード先ではありません。バリデータにはインストール済みのコピーを指定してください。`@libraz/libsonare-native` パッケージと CMake インストールはこのファイルを含まないので、上記のパッケージのいずれかから取ってください。

::: warning シーンファイルに `$schema` キーは置けない
最上位オブジェクトは `additionalProperties: false` で、列挙するのは `version`・`strips`・`buses`・`vcaGroups`・`connections` だけです。そのため、エディタにスキーマを見つけさせる常套手段であるシーン内の `"$schema": "..."` 行は、宣言されていないキーとして検証に失敗します（ローダーは無視します）。代わりに外側からスキーマを関連づけてください。エディタのファイルマッチ規則か、下記のようなバリデータのスキーマ引数です。
:::

::: code-group

```typescript [ブラウザ / Node]
import Ajv from 'ajv/dist/2020';
import schema from '@libraz/libsonare/schemas/mixer-scene.schema.json' with { type: 'json' };

const validate = new Ajv().compile(schema);
const scene = JSON.parse(sceneText);
if (!validate(scene)) {
  throw new Error(JSON.stringify(validate.errors, null, 2));
}
const mixer = Mixer.fromSceneJson(sceneText, 48000, 512);
```

```bash [コマンドライン]
# npm: ajv-cli。スキーマが宣言するドラフトを指定する
npx ajv-cli validate --spec=draft2020 \
  -s node_modules/@libraz/libsonare/schemas/mixer-scene.schema.json \
  -d my-scene.json

# Python: check-jsonschema。インストール済みホイール内のコピーを読む
check-jsonschema \
  --schemafile "$(python -c 'from importlib.resources import files; print(files("libsonare") / "schemas/mixer-scene.schema.json")')" \
  my-scene.json
```

```json [VS Code settings.json]
{
  "json.schemas": [
    {
      "fileMatch": ["*.scene.json"],
      "url": "./node_modules/@libraz/libsonare/schemas/mixer-scene.schema.json"
    }
  ]
}
```

:::

### スキーマとローダーの食い違い

スキーマは、ローダーが誤りを黙って受け入れてしまう箇所ではローダーより**厳しく**なるように書かれています。逆方向では、スキーマが開けたままにしている境界をローダーがいくつか強制し、スキーマでは表現できない参照をミキサーの構築が検査します。まず検証し、次に読み込み、それから `sceneWarnings()` を読む — 各層は前の層が捕まえられないものを捕まえます。

| 入力 | スキーマ | ローダー |
|------|----------|----------|
| 未知または綴り間違いのキー（`faderDB`） | 拒否（`additionalProperties: false`） | 黙って無視。フィールドは既定値のまま |
| レガシーの snake_case キー（`fader_db`、`params_json`、`processor_name`、`destination_bus_id`、`vca_groups` など） | 拒否 | 受理。ライターはこの綴りを書き出さない |
| エスケープした JSON 文字列の `params` | 拒否（`type: object`） | レガシー形として受理 |
| `version` の欠落 | 拒否（`required`） | `1` とみなす |
| 型違いのスカラー（`"faderDb": "loud"`、`"muted": 1`） | 拒否 | 黙って無視。フィールドは既定値のまま |
| −1 … 1 の外の `pan`・`dualPanLeft`・`dualPanRight`、0 … 2 の外の `width` | 拒否（`minimum`/`maximum`） | 範囲内へクランプ |
| `id`・`processor`・`destinationBusId`・`source`・`destination` の欠落 | 拒否（`required`、`minLength: 1`） | 空として読み、あとでミキサーの構築が拒否 |
| `strips`/`buses`/`vcaGroups`/`connections`/`inserts`/`sends` のオブジェクトでない要素、`members` の文字列でない要素 | 拒否 | 黙って読み飛ばす |
| `2` を超える `panMode`、`3` を超える `panLaw` | 受理（`minimum: 0` のみ） | 拒否: `panMode enum is out of range` / `panLaw enum is out of range` |
| `192000` を超える `channelDelaySamples` | 受理（`minimum: 0` のみ） | 拒否: `channelDelaySamples must be in [0, 192000]` |
| `16` を超える `metering.truePeakOversample` | 受理（`minimum: 1` のみ） | 拒否: `metering.truePeakOversample must be in [1, 16]` |
| 32 ビット float の範囲外の数値（`1e40`） | 受理 | 拒否: `floating-point field is non-finite or out of float range` |
| 未知のプロセッサ id、ドキュメントにないバスへのセンド、未知のノードを指す接続や `sidechainKey`、id の重複 | 受理（表現できない） | ミキサーの構築が拒否 |

両者が一致する点 — `version` はあれば `1`、`slot` と `timing` は `"pre"`/`"post"` の文字列、`sourceLayout` と `layout` は 4 つのレイアウトトークンのいずれか、integer フィールドは整数 — では、バリデータのメッセージが単に先に届き、パスを名指しするだけの違いです。

## 組み込みプリセット

| プリセット | 意図 |
|-----------|------|
| `vocalReverbSend` | ボーカルストリップ（EQ + コンプのインサート）と、プレートリバーブリターンへのポストフェーダー AUX センド |
| `drumBusSubgroup` | キック／スネア／オーバーヘッドをグループバス（ロール `subgroup`）へ送り、パラレルコンプとテープで一体感を出し、「drums」VCA で調整 |
| `commentaryDucking` | host／guest の話声（ディエス + コンプ）と、host をキーにした `dynamics.sidechainRouter` でダッキングする音楽ベッド |

実行時には `mixingScenePresetNames()` で一覧を取得し、`mixingScenePresetJson(name)` で 1 つを取得します。

## 注釈つきの完全なシーン

これは `mixingScenePresetJson('vocalReverbSend')` の実際の出力です（読みやすさのため既定値は省略。省略したキーはすべて任意なので、短くした形もそのまま検証を通ります）。すべての関係が現れます。2 つのプリフェーダーインサートとポストフェーダーセンドを持つボーカルストリップ、リバーブリターンストリップ、2 つのバス、それらをマスターへ配線する接続です。

```json
{
  "version": 1,
  "strips": [
    {
      "id": "vocal",
      "faderDb": -3,
      "inserts": [
        { "slot": "pre", "processor": "eq.parametric",
          "params": { "band0.type": 4, "band0.frequencyHz": 80, "band1.frequencyHz": 4000, "band1.gainDb": 2 } },
        { "slot": "pre", "processor": "dynamics.compressor", "params": { "thresholdDb": -18, "ratio": 2.5 } }
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
        { "slot": "post", "processor": "effects.reverb.plate", "params": { "decaySec": 1.8, "preDelayMs": 25 } }
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
`eq.parametric` インサートが読むのは**バンドインデックス指定のキー**です — `band{N}.type`、`band{N}.frequencyHz`、`band{N}.gainDb`、`band{N}.q`、およびバンドごとのダイナミック EQ フィールド。このプリセットでは `band0` が 80 Hz のハイパス（`"band0.type": 4` は EQ バンドタイプ enum の `HighPass`）、`band1` が 4 kHz の +2 dB プレゼンスベルで、実際に機能するハイパス＋プレゼンスブーストになっています。

キーの全一覧は `masteringInsertParamNames('eq.parametric')` で取得できます。一覧外のキー（たとえばフラットな `highPassHz`）も読み込みは通りますが効果を持たず、シーン読み込み後に `Mixer.sceneWarnings()` が報告します。

つまみ 1 つのトーン調整には、より単純なインサートも使えます。明暗を広く傾けるなら `eq.tilt`（`tiltDb`、`pivotHz`）、高域シェルフの「エア」を持ち上げるなら `spectral.airBand`（`amount`、`shelfFrequencyHz`）です。
:::

## 編集して保存し直す

::: code-group

```typescript [ブラウザ]
const json = mixingScenePresetJson('vocalReverbSend');
const mixer = Mixer.fromSceneJson(json, 48000, 512);

mixer.sceneWarnings();  // [] — タイプミスした insert パラメータがあれば非致命的にここへ並ぶ

mixer.addSend(0, 'more-verb', 'vocal-verb', -18, 'postFader');  // トポロジー変更
mixer.compile();                                                 // タイミングが重要な処理の前に再構築

const saved = mixer.toSceneJson();   // 同じ形式へラウンドトリップ
```

```python [Python]
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json('vocalReverbSend')
with sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512) as mixer:
    mixer.scene_warnings()  # [] — タイプミスした insert パラメータがあれば非致命的にここへ並ぶ

    mixer.add_send(0, 'more-verb', 'vocal-verb', -18, 'post_fader')  # トポロジー変更
    mixer.compile()                                                  # タイミングが重要な処理の前に再構築

    saved = mixer.to_scene_json()   # 同じ形式へラウンドトリップ
```

```bash [Python CLI]
# 組み込みシーンを書き出し、JSON を編集してからレンダーする。
sonare mixing-preset --preset vocalReverbSend > my-scene.json
sonare mix --scene my-scene.json --input vocal.wav --input reverb-return.wav -o master.wav
```

:::

::: info `mix --scene` でのストリップごとの入力指定は Python CLI 限定
JSON ファイルからシーン全体をレンダーし、ストリップごとに `--input` を 1 つずつ渡す機能は Python CLI が実装しています。ネイティブ CLI に `mix` コマンドは存在しません。ストリップコマンドの名前は `sonare-cli mix-strip` だけなので、`sonare-cli mix` を呼ぶスクリプトは未知のコマンドとして失敗します。`mix-strip` 自体は両方の CLI にありますが、`--scene` 非対応の単一ストリップ・単一入力プロセッサです。フルシーンのレンダーではなく、ストリップ単位の手早い確認に使ってください。[チャンネルストリップ](./cli-examples.md#チャンネルストリップ) も参照してください。
:::

::: tip いつ再コンパイルするか
構造的な編集 — バス・センド・接続の追加／削除 — はグラフを dirty にし、次のタイミングが重要なブロックの前に `compile()` が必要です。パラメータ操作（`setSendDb` / Python `set_send_db`、`setPanLaw`）、VCA グループの変更（追加・削除・ゲイン調整。メンバーストリップへのコントロール専用ゲインオフセットとして即時反映されます）、スケジュール済みオートメーションには再コンパイルは不要です。
:::

## 関連

- [ミキシングデモのプロジェクト JSON](./mixing-demo-project-json.md) — `/mixing` デモの UI プロジェクトファイル。ミキサーシーン*ではない*トラックごとのアレンジ形式
- [ミキシングエンジン](./mixing.md) — API ガイドと信号フロー
- [ミキシングアシスタント](./mixing-assistant.md) — `suggestMixScene` が解析結果からこの形式のシーンを書き出す
- [ミキシングの基礎](./glossary/concepts/mixing-basics.md) — 用語
- [マスタリングプロセッサ](./mastering-processors.md) — マスタリングレジストリの有効な `processor` id
- [エフェクトインサート](./effects-inserts.md) — 追加のクリエイティブ FX ミキサーインサート名
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの差分
