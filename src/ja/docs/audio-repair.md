---
title: オーディオリペアの流れ
description: libsonare のリペア段で、ノイズ、ハム、過渡的な損傷、拡散残響を選別・測定・処理する方法です。
---

# オーディオリペアの流れ

リペアは、録音の症状を確認してから処理を選びます。クリック、クリップしたピーク、電源ハム、定常的なノイズフロア、拡散した部屋の余韻には、それぞれ別の測定とアルゴリズムが必要です。まず元のバッファを測定し、根拠のある段だけを選び、同じ再生ゲインで結果をもう一度聴きます。

「dBFS」「ノイズフロア」「クリッピング」に馴染みがなければ、先に [オーディオ基礎](./glossary/concepts/audio-basics.md) を読んでください。本ページは用語を前提に、どのリペア段を使うかに絞って説明します。

6 つのリペア段は古典的な DSP です。信号の一部を再構成または減衰させる処理であり、録音されなかった元の音を復元するものではありません。マスタリングチェーン内では段の順序が固定され、1 回ずつ API を組み合わせる場合も同じ順序を適用します。

::: info このページの用語
- **検出器**：ひとつの欠陥について根拠（個数、レベル、割合）を報告する測定。音声は変えません。
- **リンク**：すべてのチャンネルからまとめて求めたゲインマスクひとつを、各チャンネルに適用すること。チャンネル間のレベルとタイミングの関係が動きません。
- **因果的**：すでに受け取った音声と一定の遅れだけで処理できる段。ライブのストリームで動かせます。因果的でない段はバッファ全体を必要とします。
- **レイテンシとテール**：レイテンシはリアルタイムの段の出力が何サンプル遅れるか、テールは入力が止まった後も何サンプル出力が続くかです。
- **ストリーミング安全なノイズ推定器**：`spp` 推定器のこと。ファイル全体を並べ替えずにフレームごとにノイズを追跡するので、同じデノイズをオフラインでもライブでも動かせます。
:::

## 症状に合わせて処理を選ぶ

| 聴こえる／見える状態 | 先に測るもの | 候補となる段 | この段で扱わないもの |
|---|---|---|---|
| 定常的な広帯域ヒス、マイクのノイズフロア | `masteringRepairDetectNoiseFloor` | `denoise` | トーン性のハムやクリップしたピークの除去 |
| 狭帯域の 50/60 Hz 音と倍音 | `masteringRepairDetectHum` | `dehum` | スペクトル全体への広帯域デノイズ |
| 孤立した不連続やポップ | `masteringRepairDetectClicks` | `declick` | 平らに潰れた波形のリペア |
| 平らな頂部を持つピークやデジタル上限 | `masteringRepairDetectClipping` | `declip` | 長時間上書きされたサンプルの復元 |
| サンプル単位の表面損傷が多数ある | `masteringRepairDetectCrackle` | `decrackle` | 定常的なノイズフロアの除去 |
| 直接音の後ろに続く拡散した余韻 | `masteringRepairDetectReverb` | `dereverb` | ルームインパルス応答のデコンボリューション |

冒頭または末尾の不要な無音は別のユーティリティで扱います。`masteringRepairTrimSilence`（検出は `masteringRepairDetectTrimRange`）を使います。[無音のトリミング](#無音のトリミング) と [CLI の録音クリーンアップ手順](./use-cases/recording-cleanup.md) を参照してください。

検出器が返すのは、それぞれのアルゴリズムが測った内容です。万能な損傷スコアではなく、値が 0 でない場合も試聴が必要です。特に、フルスケールの正弦波や矩形波は意図した信号でも時間領域の検出器からクリップと見なされることがあります。

## リペア前に測る

以下の検出器は WebAssembly パッケージから利用できます。ここでの `samples` はデコード済みモノラル `Float32Array`、`sampleRate` は元のサンプルレートです。検出のためだけにリサンプリングしないでください。

```ts
import {
  init,
  masteringRepairDetectClipping,
  masteringRepairDetectClicks,
  masteringRepairDetectCrackle,
  masteringRepairDetectHum,
  masteringRepairDetectNoiseFloor,
  masteringRepairDetectReverb,
} from '@libraz/libsonare';

await init();

const reports = {
  clipping: masteringRepairDetectClipping(samples, sampleRate),
  clicks: masteringRepairDetectClicks(samples, sampleRate),
  crackle: masteringRepairDetectCrackle(samples, sampleRate),
  hum: masteringRepairDetectHum(samples, sampleRate),
  noise: masteringRepairDetectNoiseFloor(samples, sampleRate),
  reverb: masteringRepairDetectReverb(samples, sampleRate),
};

console.log(reports);
```

デノイズ検出器とデリバーブ検出器は、`nFft` より短いバッファを解析のためにパディングします。短い素材も拒否されずに測定できます。512 サンプルの入力を `masteringRepairDenoiseClassical` に渡すと、512 サンプルの結果が返ります。

## 固定された段の順序

複数の欠陥がある場合も、根拠のある段だけを次の順に適用します。`masterAudio` と `masteringChain` のリペアスロットもこの順で実行します。

<RepairStagesFigure
  title="実行順に並べたリペア段"
  caption="検出器ごとに有効にする段が 1 つ決まります。短時間の欠陥を先に、持続する欠陥を後に直すので、どの検出器と推定も、前の段が処理した後の素材を見ます。"
  :labels="{
    shortTime: '短時間の欠陥',
    sustained: '持続する欠陥',
    declipFix: '平らに潰れたピーク、デジタル上限',
    declickFix: '孤立した不連続やポップ',
    decrackleFix: '密集したサンプル単位の表面損傷',
    dehumFix: '50/60 Hz の基音とその倍音',
    denoiseFix: '定常的な広帯域のノイズフロア',
    dereverbFix: '直接音の後ろに続く拡散した余韻',
    detectorHead: '検出器',
    stageHead: '段（実行順）',
    fixHead: 'リペアする欠陥',
    note: '段は有効にしたときだけ実行されます。有効にしても位置は変わりません。',
  }"
/>

| 順序 | 段 | この位置にある理由 |
|---:|---|---|
| 1 | `declip` | 平らに潰れた区間は、クリック検出に必要な過渡変化を隠すことがあるため。 |
| 2 | `declick` | クリップしたピークを再構成してから、孤立した不連続を直すため。 |
| 3 | `decrackle` | 大きなインパルスを処理した後に、密集したサンプル単位の損傷を滑らかにするため。 |
| 4 | `dehum` | 広帯域ノイズを推定する前に、追跡した基音と倍音を取り除くため。 |
| 5 | `denoise` | 残った定常的なスペクトルノイズフロアを推定し、減衰させるため。 |
| 6 | `dereverb` | 広帯域のノイズフロアが持続する後期残響に見えることがあるため最後に行う。 |

すべての段を実行するという意味ではありません。きれいな録音では、検出器が根拠を示さない段を省きます。強いリペアを行ったら該当する検出器を再実行し、処理前後のレポートをレンダリング済みファイルと一緒に保存してください。

## レストレーション用プリセット

レストレーション用プリセットは名前付きのチェーン設定であり、新しいアルゴリズムではありません。リペア段だけを有効にし、ラウドネス正規化、目標値、最終リミッターは追加しません。現在の段の選択は次のとおりです。

| プリセット | 想定する素材 | 有効にするリペア段 |
|---|---|---|
| `vinyl` | クリック、クラックル、ノイズフロアを含む LP 取り込み | `declick`、`decrackle`、`denoise` |
| `tapeHiss` | 主な欠陥が広帯域ヒスであるテープ取り込み | `denoise` |
| `fieldRecording` | ノイズ、場合によってはハム、部屋の余韻を含むロケーション録音 | `denoise`、適応型 `dehum`、`dereverb` |
| `voiceMemo` | クリップ、ノイズ、部屋の余韻があり得るスマートフォン／ノート PC 録音 | `declip`、`denoise`、`dereverb` |
| `shellac78` | クリックの幅が広く、表面ノイズが密な 78 回転盤の取り込み | `declick`、`decrackle`、より深い `denoise` |

正確なプリセットパラメータは [マスタリングプロセッサ](./mastering-processors.md#レストレーション用プリセット) にあります。プリセットは出発点なので、素材とレポートを確認してから出力を採用してください。

## 測定とリペアを 1 回の呼び出しで行う

`masteringRepairAnalyze` は 6 つの検出器をすべてのチャンネルで実行し、測定結果が裏づける段を、それぞれの設定つきで返します。`masteringRepairApply` は、その段または自分で選んだ段を、任意のチャンネル数に対して実行します。推奨される内容は、[マスタリングアシスタント](./mastering-assistant.md#masteringassistantsuggest-—-チェーンを提案) で `enableRepair` を有効にしたときのリペア選択と同じです。

::: code-group

```ts [Browser]
import { ErrorCode, init, isSonareError, masteringRepairAnalyze, masteringRepairApply } from '@libraz/libsonare';

await init();

const analysis = masteringRepairAnalyze({ channels: [left, right], sampleRate });
console.log(analysis.recommended.map((s) => s.stage), analysis.explanation);

let userPressedStop = false; // 停止ボタンから設定する
try {
  const { channels, reports } = masteringRepairApply({
    channels: [left, right],
    sampleRate,
    stages: analysis.recommended,
    onProgress: (fraction, stage) => console.log(stage, fraction), // "repair.declick", 0.33
    cancel: () => userPressedStop,
  });
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.Cancelled) {
    // ユーザーが停止した。結果は返らない。
  } else {
    throw error;
  }
}
```

```python [Python]
import libsonare

analysis = libsonare.mastering_repair_analyze([left, right], 48000)
print([s["stage"] for s in analysis["recommended"]], analysis["explanation"])

result = libsonare.mastering_repair_apply(
    [left, right], 48000, stages=analysis["recommended"]
)
print(result.reports[0].stage)  # 最初に実行された段。例: "declick"
cleaned = result.channels
```

```bash [CLI]
# 測定してレポートするだけ。何も書き出さない
sonare repair noisy.wav --detect --json

# 測定し、段を選び、リペアして、各段を選んだ理由も報告する
sonare repair noisy.wav -o clean.wav --explain
```

:::

Node でもブラウザ版と同じ名前で使えます。`masteringRepairAnalyze` の戻り値は次のとおりです。

| フィールド | 意味 |
|---|---|
| `defects` | 各チャンネルの検出結果を集約したもの |
| `channels` | チャンネルごとの `defects`（入力順） |
| `declipThresholdSafe` | 測定したフラットレベルでの declip が、それより大きい未クリップ部分に手を触れないかどうか。`false` のときは、平坦区間が見つかっても declip を `recommended` から外す |
| `integratedLufs` | ノイズフロアの比較対象となる全体のラウドネス |
| `recommended` | 根拠のある段を適用順に並べ、それぞれにすべての設定を付けたもの。そのまま `masteringRepairApply` に渡せる |
| `explanation` | 各段を選んだ、または選ばなかった理由 |

デリバーブは推奨しません。後期減衰の統計量では、持続する直接音と残響を区別できないためです。デノイズを推奨する場合は、`preferStreamingSafe: false`（Python では `prefer_streaming_safe=False`）を渡さない限りストリーミングに安全なノイズ推定器を使います。

`stages` とレポートの表記は次のとおりです。

| 場所 | 表記 |
|---|---|
| `stages` の `stage`、および `reports[].stage` | 接頭辞のない名前（`declick`）。`repair.declick` は拒否される |
| `stage` と並べる設定名 | 対応するカタログプロセッサのパラメータ名（`repair.declick` なら `maxClickSamples`）。省略した設定は既定値になり、未知の設定、同じ段の重複、範囲外の値は `InvalidParameter` で拒否される |
| `onProgress` の段の引数 | `repair.<stage>` |

- 段は、配列の順序にかかわらず上記の固定順序で実行されます。
- declip、declick、dehum はチャンネル全体で判断します。1 つのチャンネルで見つかった欠陥はすべてのチャンネルでリペアされ、dehum は基本周波数を 1 つだけ追跡します。decrackle は各チャンネルを単独で処理します。denoise と dereverb は 1 つのリンクしたマスクを適用します。前者の 3 つはチャンネルごとにレポートし（`scope: 'channel'`）、リンクした段は全体で 1 つだけレポートします（`scope: 'linked'`）。
- `onProgress` は各段の後に、完了した割合で呼ばれます。レポートの後に `cancel` が true を返すと、`SonareError`（コード `Cancelled`）を投げて中断します。

個々の検出器と段も、Python では `mastering_repair_` 接頭辞に揃っています（`mastering_repair_detect_hum`、`mastering_repair_declick_stereo`、`mastering_repair_denoise_classical_linked`、`mastering_repair_dereverb_config_for_room`、`mastering_repair_noise_band_bins`）。CLI コマンドは [CLI リファレンス](./cli.md#repair) と [録音クリーンアップの流れ](./use-cases/recording-cleanup.md) にあります。

## リアルタイムインサート

4 つの段は因果的で、カタログ ID のリアルタイムミキサーインサートとして動作します。同じ設定ならオフライン関数と同じ結果を、インスタンスが報告するレイテンシ分だけ遅らせて出力します。デノイズとデリバーブは、インサートのチャンネル間でマスクをリンクします。

| インサート | レイテンシ | テール | コスト |
|---|---:|---:|---|
| `repair.decrackle`（メディアンモード） | 1 | 1 | 低 |
| `repair.dehum` | 0 | 146567 | 低 |
| `repair.denoiseClassical` | 1279 | 1023 | 中 |
| `repair.dereverbClassical`（減算マスク） | 1023 | 1023 | 中 |

レイテンシとテールの単位はサンプルで、48 kHz・既定設定の値です。自分の設定での値は `masteringInsertTiming(name, params, sampleRate)` で取得できます。バウンスでは、入力が終わった後も `tailSamples` 分だけ出力を取り続けないとテールが切れます（`repair.dehum` は約 3 秒鳴り続けます）。

信号全体を必要とする設定は名前を挙げて拒否されます。ウェーブレット decrackle（`mode: 1`）、WPE、quantile ノイズ推定器（`noiseEstimator: 0`）が該当し、インサートのデノイズ推定器は既定値で `spp` です。ミキサーシーンでは、列挙型の設定に名前ではなく選択肢の数値を書きます。

```json
{ "processor": "repair.denoiseClassical", "slot": "pre", "params": { "reductionDb": 20, "noiseEstimator": 3 } }
```

`repair.declick`、`repair.declip`、`repair.trimSilence` はオフライン専用で、機能カタログでは `causal: false` になっています。ホストがカタログを読む方法は [エフェクトインサート](./effects-inserts.md) を参照してください。

## 無音のトリミング

`masteringRepairTrimSilence` は信号の周囲に余白を残します。サンプル数なら `paddingSamples`、同じ余白を秒で指定するなら `paddingSec`（最も近いサンプルに丸められます）です。どちらか一方だけを指定してください。22.05 kHz で、前後に 1 秒ずつ無音を付けた 1 秒のトーンに `paddingSec: 0.1` を指定すると 26460 サンプル（1.2 秒）が返り、余白なしなら 22050 サンプルです。負の余白は `RangeError` になります。

受け付ける範囲は、`threshold` が `[0, 1]`、`paddingSamples` が `960000` まで、`windowMs` が `(0, 10000]`、`lufsGated` モードの `gateLufs` が `[-144, 0]` です。範囲外の値は `InvalidParameter` を投げます。

## オフライン処理の条件

- `masteringRepair*` 関数は完全なバッファを受け取り、新しいバッファ、または新しいチャンネルバッファを含む結果を返します。上記の 4 つのリアルタイムインサートを除き、オフライン処理です。
- 6 つのリペア段はモノラル・ステレオ形式で入力長を保ちます。デノイズとデリバーブには、3 チャンネル以上を扱うリンク形式もあります。別の `masteringRepairTrimSilence` ユーティリティだけは、バッファを短くする境界処理です。
- デノイズとデリバーブは `nFft` 未満の入力を解析のためにパディングし、入力と同じ長さで返します。どの段も上限を超える設定を拒否します。上限は各段のページに一覧があります。その他の検証規則は [JavaScript マスタリング API](./js-api-mastering.md) にあります。
- リペアは LUFS を整合させたり、結果を同じ音量に見せるゲインを加えたりしません。ラウドネスは別に測定し、一定の再生ゲインで比較してください。

[DSP 実装解説](./dsp-implementation.md) に古典的アルゴリズムとリアルタイム処理との境界をまとめています。正確なオーバーロードとレポートのフィールドは [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。

<SonareDemo id="repair-denoise" />

この埋め込み A/B は古典的デノイザーを使い、ラウドネス整合を追加しません。オフライン比較の流れを聴くためのもので、素材を確認してからリペア段を選んでください。
