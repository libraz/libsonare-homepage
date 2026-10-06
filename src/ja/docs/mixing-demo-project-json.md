---
title: ミキシングデモのプロジェクト JSON
description: ブラウザの /mixing デモが保存・再読み込みするプロジェクトファイル（v2）を解説。音源を含まないミックス全体の状態と v1 からの変換を扱い、ミキサーシーンの交換形式とは別物です。
---

# ミキシングデモのプロジェクト JSON

[ミキシングスタジオ](/ja/mixing)は、ミックス全体の状態を `libsonare-mix-project.json` に保存します。クリップを含むトラック、ストリップ、センド、オートメーション、2 本の AUX バス、マスター、VCA ゲイン、ループ範囲が入り、デコード済み音源は含みません。**プロジェクト JSON を保存**で書き出し、**プロジェクト JSON を開く**で読み込みます。開いた直後のトラックは音声待ちの状態で、追加したファイルは同じ名前のトラックへ、なければ次のトラックへ順に割り当てられます。アプリの構成と参考にするソースは、[ブラウザでミキシングアプリを作る](./use-cases/browser-mixer.md)を参照してください。

::: warning これはミキサーシーンの形式ではありません
これは [ミキシングシーン JSON](./mixing-scene-json.md) リファレンスとは別の交換形式です。*シーン*はストリップ・バス・VCA グループ・接続からなるミキサーグラフ全体を記述し、`Mixer.toSceneJson()` / `fromSceneJson()` で往復します。以下のデモのプロジェクトファイルは、構成が固定されたコンソールの状態で、ブラウザデモだけが読みます。エンジンの `fromSceneJson(...)` は受け付けず、デモもシーンファイルを拒否します。
:::

下のデモは `/ja/mixing` ページではなくエンジン自身のレーンミキサーですが、プロジェクトのトラックが記述しているものを鳴らしています。フェーダーとミュートを持つトラックが 3 本あり、各バンドが `tracks[]` の 1 要素にあたります。フェーダーはその要素の `faderDb`、ミュートは `muted` で、デモはこの 2 つをシーン形式のストリップ（`strips[].faderDb`）と `setSoloMute` でエンジンに渡しています。デモに対応物がないのは `clip.startSec` です。デモのクリップはすべて 0 秒から始まります。エンジンがすでに扱えるストリップ設定に対して、プロジェクトファイルが追加しているのは、トラックをタイムライン上で後ろにずらす情報です。

<SonareDemo id="engine-lane-mixer" />

## 固定の構成

どのトラックも同じストリップを持ちます。6 バンドの EQ、続いて `trim`、`gate`、`comp`、`deess`、`duck`、`width` の順に並ぶ 6 つのインサートスロット、そして `reverb` と `delay` の 2 本のバスへのセンドです。マスターのスロットは `glue` と `limiter` の 2 つです。バイパスしたスロットもファイルに残るので、スロットの位置は変わりません。ファイル内の位置は秒で、エンジンは 60 bpm で動くため 1 秒が 4 分音符 1 つに当たります。

## 形（バージョン 2）

以下の例は省略版です。実際のファイルには 6 バンドすべての EQ と、各スロットのパラメータがすべて入ります。

```json
{
  "version": 2,
  "tracks": [
    {
      "id": 1,
      "name": "Lead Vocal",
      "sourceDurationSec": 42.5,
      "clip": { "startSec": 1.5, "trimStartSec": 0, "lengthSec": null, "fadeInSec": 0.02, "fadeOutSec": 0.5 },
      "faderDb": -3,
      "pan": 0,
      "panLaw": 0,
      "panMode": 0,
      "dualPanLeft": -1,
      "dualPanRight": 1,
      "channelDelayMs": 0,
      "polarityLeft": false,
      "polarityRight": false,
      "muted": false,
      "soloed": false,
      "soloSafe": false,
      "vcaGroup": null,
      "eq": [
        { "type": "HighPass", "frequencyHz": 30, "gainDb": 0, "q": 0.707, "enabled": false }
      ],
      "slots": {
        "trim": { "bypassed": false, "params": { "levelDb": 0 } },
        "comp": { "bypassed": true, "params": { "thresholdDb": -18, "ratio": 2 } },
        "width": { "bypassed": false, "params": { "width": 1 } }
      },
      "duckKeyTrackId": null,
      "sends": {
        "reverb": { "levelDb": -18, "timing": "postFader" },
        "delay": { "levelDb": -60, "timing": "postFader" }
      },
      "automation": {
        "fader": [{ "id": "p1", "timeSec": 8, "value": -6, "curve": "linear" }],
        "pan": [],
        "width": []
      }
    }
  ],
  "buses": {
    "reverb": { "gainDb": 0, "params": { "decay": 0.566, "damping": 0.5, "preDelayMs": 20, "dryWet": 1 } },
    "delay": { "gainDb": 0, "params": { "delayTimeLMs": 250, "delayTimeRMs": 250, "feedback": 0.25, "pingPong": 0, "dryWet": 1 } }
  },
  "master": {
    "faderDb": 0,
    "slots": {
      "glue": { "bypassed": true, "params": {} },
      "limiter": { "bypassed": false, "params": { "ceilingDb": -1, "releaseMs": 50 } }
    }
  },
  "vcaGains": { "A": 0, "B": 0, "C": 0 },
  "loop": { "enabled": false, "startSec": 0, "endSec": 0 }
}
```

- `id` は正の整数で、ファイル内で重複できません。`-60` dB 以下のセンドはルーティングされません。`lengthSec: null` はソースの残りをすべて再生します。
- `eq` はちょうど 6 バンドです。`type` はエンジンの EQ バンド種別（`Peak`、`LowShelf`、`HighShelf`、`LowPass`、`HighPass`、`BandPass`、`Notch`、`TiltShelf`、`FlatTilt`、`AllPass`）のいずれかです。
- `curve` は `linear`、`exponential`、`hold`、`s-curve` のいずれかで、次のポイントまでの区間の形を決めます。レーンは `fader`（dB）、`pan`、`width` の 3 種類です。
- `vcaGroup` は `"A"`、`"B"`、`"C"`、`null` のいずれかです。`duckKeyTrackId` は `duck` スロットのキーにするトラックを指し、`null` ならそのトラック自身の入力をキーにします。
- ファイルに入るトラックは最大 8 本です。

省略したフィールドにはデモの既定値が入ります。型の違うフィールド、そのスロットにないスロットパラメータ、重複したトラック ID、存在しないトラックを指す `duckKeyTrackId`、キーをたどると自分自身に戻る `duckKeyTrackId`、6 バンドでない `eq` 配列があると、何も変更せずファイル全体を拒否します。数値は有限の数でなければならず、`"-6"` のような文字列は拒否されます。

v2 のファイルを開くと、プロジェクト全体が置き換わります。この操作は取り消せます。

## バージョン 1 のファイルを読む

v1 のファイルは、`"version": 1`（または `version` なし）の、トラックごとのフラットな設定ファイルです。デモはこれを、いま読み込まれているトラックに変換して適用するので、先に対応する音声を読み込んでおきます。変換したことは通知で知らせます。

```json
{
  "version": 1,
  "masterFaderDb": 0,
  "tracks": [
    { "id": "track-id", "name": "Lead Vocal", "offsetSeconds": 1.5, "inputTrimDb": 0, "faderDb": -3, "pan": 0, "width": 1, "muted": false, "soloed": false }
  ]
}
```

v1 のファイルには `masterFaderDb`、`reverb`、`vcaGains`、`tracks` のうち少なくとも 1 つが必要です。`tracks` の各要素には `id` か `name` が必要で、指定したコントロールはすべて期待する型でなければなりません。エンジンのシーン（`strips`、`buses`、`connections`）は拒否します。有効な v1 でも v2 でもないファイルは読み込めません。

変換は次の規則に従います。

- トラックは `id` または `name` で照合します。読み込み済みのトラックに一致しない v1 のトラックは破棄し、その名前を通知に挙げます。省略したトップレベルの設定は現在の値のまま残り、指定したトラックで省略した項目には既定値が入ります。
- `offsetSeconds` は `clip.startSec` になり、タイムラインに収まる範囲に丸められます。`inputTrimDb` は `trim` のレベル、`width` は `width` スロットになります。
- トーンはストリップ EQ になります。チルトが *t* dB なら、1 kHz の低域シェルフ −*t*/2 と高域シェルフ +*t*/2 の組です。Air は 12 kHz の高域シェルフで、2 つ目の Peak スロットに入ります。`eqEnabled: false` のトラックは、既定の無効な EQ になります。
- `reverbSendDb` は `reverb` バスへのポストフェーダーセンドになります。v1 の `reverb.enabled: false` はそれらのセンドをオフにします。`reverb.decaySec` と `reverb.preDelayMs` はプレートのディケイとプリディレイを決めます。
- v1 のオートメーションは、全パラメータを `param` で区別して 1 つの配列に入れていました。これを `fader`、`pan`、`width` の 3 レーンに分け、時間順に並べます。未知のカーブは `linear` になります。
- 値は v1 の範囲に丸められます。`faderDb` は −60〜+12 dB、`masterFaderDb` と各 `vcaGains` は −24〜+12 dB、`inputTrimDb` は ±24 dB、`pan` は ±1、`width` は 0〜2、`channelDelayMs` は 0〜50、センドは −60〜0 dB です。

## 関連

- [ミキシングシーン JSON](./mixing-scene-json.md) — エンジンのミキサーシーン交換形式（`fromSceneJson` で読み込むのはこちら）
- [ミキシングエンジン](./mixing.md) — API ガイドと信号フロー
