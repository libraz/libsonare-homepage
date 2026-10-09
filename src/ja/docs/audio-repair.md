---
title: オーディオリペアの流れ
description: libsonare のリペア段で、ノイズ、ハム、過渡的な損傷、拡散残響を選別・測定・処理する方法です。
---

# オーディオリペアの流れ

リペアは、録音の症状を確認してから処理を選びます。クリック、クリップしたピーク、電源ハム、定常的なノイズフロア、拡散した部屋の余韻には、それぞれ別の測定とアルゴリズムが必要です。まず元のバッファを測定し、根拠のある段だけを選び、同じ再生ゲインで結果をもう一度聴きます。

6 つのリペア段は古典的な DSP です。信号の一部を再構成または減衰させる処理であり、録音されなかった元の音を復元するものではありません。マスタリングチェーン内では段の順序が固定され、1 回ずつ API を組み合わせる場合も同じ順序を適用します。

## 症状に合わせて処理を選ぶ

| 聴こえる／見える状態 | 先に測るもの | 候補となる段 | この段で扱わないもの |
|---|---|---|---|
| 定常的な広帯域ヒス、マイクのノイズフロア | `masteringRepairDetectNoiseFloor` | `denoise` | トーン性のハムやクリップしたピークの除去 |
| 狭帯域の 50/60 Hz 音と倍音 | `masteringRepairDetectHum` | `dehum` | スペクトル全体への広帯域デノイズ |
| 孤立した不連続やポップ | `masteringRepairDetectClicks` | `declick` | 平らに潰れた波形の修復 |
| 平らな頂部を持つピークやデジタル上限 | `masteringRepairDetectClipping` | `declip` | 長時間上書きされたサンプルの復元 |
| サンプル単位の表面損傷が多数ある | `masteringRepairDetectCrackle` | `decrackle` | 定常的なノイズフロアの除去 |
| 直接音の後ろに続く拡散した余韻 | `masteringRepairDetectReverb` | `dereverb` | ルームインパルス応答のデコンボリューション |
| 冒頭または末尾の不要な無音 | `masteringRepairDetectTrimRange` | `masteringRepairTrimSilence`（別のユーティリティ） | 6 つのリペア段には含まれない。[CLI の録音クリーンアップ手順](./use-cases/recording-cleanup.md) を参照。 |

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

正確なプリセットパラメータは [マスタリングプロセッサ](./mastering-processors.md) にあります。プリセットは出発点なので、素材とレポートを確認してから出力を採用してください。

## 測定と修復を 1 回の呼び出しで行う

`masteringRepairAnalyze` は 6 つの検出器をすべてのチャンネルで実行し、チャンネルごとの欠陥、全体の集計、測定したフラットレベルでの declip がそれより大きい音に手を触れないかどうか (`declipThresholdSafe`)、根拠のある段とその設定を `recommended` として返します。デリバーブは推奨しません。後期減衰の統計量では、持続する直接音と残響を区別できないためです。`masteringRepairApply` は推奨された段、または自分で選んだ段を、任意のチャンネル数に対して実行します。

```ts
import { init, masteringRepairAnalyze, masteringRepairApply } from '@libraz/libsonare';

await init();

const analysis = masteringRepairAnalyze({ channels: [left, right], sampleRate });
console.log(analysis.recommended.map((s) => s.stage), analysis.explanation);

const { channels, reports } = masteringRepairApply({
  channels: [left, right],
  sampleRate,
  stages: analysis.recommended,
  onProgress: (fraction, stage) => console.log(stage, fraction), // "repair.declick", 0.5
  cancel: () => userPressedStop,
});
```

- `stages` は `[{ stage, ...settings }]` の配列です。設定はその段のカタログパラメータ (`repair.declick`、`repair.dehum`、`repair.denoiseClassical` など) で、省略すると既定値になります。未知の設定、同じ段の重複、範囲外の値は `InvalidParameter` で拒否されます。
- 段は、配列の順序にかかわらず上記の固定順序で実行されます。
- declip、declick、dehum はチャンネル全体で判断します。1 つのチャンネルで見つかった欠陥はすべてのチャンネルで修復され、dehum は基本周波数を 1 つだけ追跡します。decrackle は各チャンネルを単独で処理します。denoise と dereverb は 1 つのリンクしたマスクを適用します。前者の 3 つはチャンネルごとにレポートし (`scope: 'channel'`)、リンクした段は全体で 1 つだけレポートします (`scope: 'linked'`)。
- `onProgress` は各段の後に、完了した割合と `repair.<stage>` で呼ばれます。レポートの後に `cancel` が true を返すと、`SonareError` (コード `Cancelled`) を投げて中断します。

Node でも同じ名前で使えます。Python では `mastering_repair_analyze(channels, sample_rate)` と `mastering_repair_apply(channels, sample_rate, stages=[...], on_progress=..., cancel=...)` で、2 次元の `(channels, frames)` 配列も受け取ります。結果は `.channels` と `.reports` を持ちます。個々の検出器と段も Python では `mastering_repair_` 接頭辞に揃っています (`mastering_repair_detect_hum`、`mastering_repair_declick_stereo`、`mastering_repair_denoise_classical_linked`、`mastering_repair_dereverb_config_for_room`、`mastering_repair_noise_band_bins`)。

## リアルタイムインサート

4 つの段は因果的で、カタログ ID のリアルタイムミキサーインサートとして動作します。`repair.decrackle` (メディアンモード)、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical` (減算マスク) です。同じ設定ならオフライン関数と同じ結果を、インスタンスが報告するレイテンシー分だけ遅らせて出力します。信号全体を必要とする設定 (ウェーブレット decrackle、WPE、quantile ノイズ推定器) は名前を挙げて拒否され、インサートのデノイズ推定器は既定値で `spp` です。デノイズとデリバーブは、インサートのチャンネル間でマスクをリンクします。

`repair.declick`、`repair.declip`、`repair.trimSilence` はオフライン専用で、機能カタログでは `causal: false` になっています。ホストがカタログを読む方法は [エフェクトインサート](./effects-inserts.md) を参照してください。

## 無音のトリミング

`masteringRepairTrimSilence` は信号の周囲に余白を残します。サンプル数なら `paddingSamples`、同じ余白を秒で指定するなら `paddingSec` (最も近いサンプルに丸められます) です。どちらか一方だけを指定してください。22.05 kHz で、前後に 1 秒ずつ無音を付けた 1 秒のトーンに `paddingSec: 0.1` を指定すると 26460 サンプル (1.2 秒) が返り、余白なしなら 22050 サンプルです。負の余白は `RangeError` になります。

受け付ける範囲は、`threshold` が `[0, 1]`、`paddingSamples` が `960000` まで、`windowMs` が `(0, 10000]`、`lufsGated` モードの `gateLufs` が `[-144, 0]` です。範囲外の値は `InvalidParameter` を投げます。

## オフライン処理の条件

- `masteringRepair*` 関数は完全なバッファを受け取り、新しいバッファ、または新しいチャンネルバッファを含む結果を返します。上記の 4 つのリアルタイムインサートを除き、オフライン処理です。
- 6 つのリペア段はモノラル・ステレオ形式で入力長を保ちます。デノイズとデリバーブには、3 チャンネル以上を扱うリンク形式もあります。別の `masteringRepairTrimSilence` ユーティリティだけは、バッファを短くする境界処理です。
- デノイズとデリバーブは `nFft` 未満の入力を解析のためにパディングし、入力と同じ長さで返します。どの段も上限を超える設定を拒否します。上限は各段のページに一覧があります。その他の検証規則は [JavaScript マスタリング API](./js-api-mastering.md) にあります。
- リペアは LUFS を整合させたり、結果を同じ音量に見せるゲインを加えたりしません。ラウドネスは別に測定し、一定の再生ゲインで比較してください。

[DSP 実装解説](./dsp-implementation.md) に古典的アルゴリズムとリアルタイム処理との境界をまとめています。正確なオーバーロードとレポートのフィールドは [JavaScript マスタリング API](./js-api-mastering.md) を参照してください。

<SonareDemo id="repair-denoise" />

この埋め込み A/B は古典的デノイザーを使い、ラウドネス整合を追加しません。オフライン比較の流れを聴くためのもので、素材を確認してからリペア段を選んでください。
