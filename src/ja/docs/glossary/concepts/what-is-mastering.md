---
title: マスタリングとは?
description: マスタリングでできること、できないこと、libsonare デモでの扱いを実用的に説明します。
---

# マスタリングとは?

マスタリングは、ミックスが終わった後に行う最終的な品質確認と配信用の仕上げです。完成したミックスを、配信サービス、スマートフォン、ヘッドホン、スピーカー、車内再生、コーデック変換をまたいでも意図どおりに聴こえる状態、つまり再生互換性のある状態に整えます。

重要なのは、マスタリングが「完成したステレオミックス」に対する処理だという点です。全体の音色、ラウドネス、密度、ステレオイメージ、ピーク安全性は調整できますが、すでに混ざった後のボーカル、キック、ギター、スネアを個別に自由に直す工程ではありません。

## マスタリングで行うこと

マスタリングでは、主に次の 5 つを確認します。

| 問い | マスタリングでの処理 | libsonare での対応 |
|------|----------------------|--------------------|
| 公開先に対して音が小さすぎる、または大きすぎないか | [ラウドネス](../lufs.md)測定と正規化 | `lufs`、`loudness.targetLufs` |
| 全体の音色が暗い、刺さる、薄い、膨らみすぎていないか | 帯域幅の広い EQ、Tilt EQ、トーン補正 | `eq.tilt` |
| 動きが大きすぎる、または平坦すぎないか | 穏やかなダイナミクス制御とリミッター | `dynamics.compressor`、`maximizer.truePeakLimiter` |
| ステレオの広がりが有効で、[モノラル再生でも崩れないか](./mono-compatibility.md) | ステレオ幅、Mid/Side（中央成分とサイド成分）、相関の確認 | `stereo.imager`、`meteringStereoCorrelation` |
| 変換や再生時にクリップしないか | [True Peak](../true-peak.md) リミッターとシーリング管理 | `maximizer.truePeakLimiter`、`meteringTruePeakDb` |

良いマスタリングは、多くの場合かなり控えめです。EQ が 1〜2 dB、少しのコンプレッション、ピークを捕まえるリミッターだけで十分なこともあります。強い処理が必要な場合もありますが、すべての曲をただ大きくするためではなく、具体的な問題を解くために使います。

## マスタリングで直せないこと

マスタリングはミックスの代わりではありません。リードボーカルが埋もれている、スネアが大きすぎる、ベースの音程ごとの音量差が激しい、といった問題は、多くの場合ミックスに戻って直すほうが自然です。

マスタリングでできるのは、次のような全体的な調整です。

- 低域全体を引き締める。
- 全体を少し明るく、または暖かくする。
- 過剰なピークを抑える。
- 配信時のラウドネスを予測しやすくする。

ミックス済みの音源から 1 つの楽器だけをきれいに取り出して調整することはできません。極端なマスタリングが必要に見えるなら、多くの場合は元のミックスに戻るサインです。

## libsonare での扱い

libsonare の[マスタリングデモ](/ja/mastering)は、WebAssembly を使ってブラウザ内でチェーン全体を実行します。音声ファイルはローカルでデコードされ、ローカルで処理され、WAV としてローカルで書き出されます。アップロード処理はありません。

クイックマスターは、最初の 1 回を実用的に済ませるための流れです。

1. 元音源を読み込む。
2. 音源の種類を選ぶ。
3. 配信先のラウドネスターゲットを選ぶ。
4. レンダリングし、ラウドネスマッチ付きで処理前 / 処理後を比較する。

Studio モードでは、同じチェーンを段ごとに確認できます。段は常に下の順序で実行されます。プリセットや Studio の設定が決めるのはどの段を有効にするかだけで、順序は変わりません。

<MasteringChainFigure
  title="チェーンを、エンジンの実行順に"
  :labels="{
    repair: 'リペア',
    eq: 'EQ',
    dynamics: 'ダイナミクス',
    saturation: 'サチュレーション',
    spectral: 'スペクトル',
    stereo: 'ステレオ',
    maximizer: 'マキシマイザー',
    loudness: 'ラウドネス',
    output: '出力',
    enabled: 'この設定で有効',
    available: '存在するが無効',
    fixedOrder: '順序は固定です。設定が選ぶのはどのスロットを動かすかであって、位置ではありません。',
  }"
/>

同じチェーンはコードからも使えます。プリセットは出発点で、配信ターゲットがラウドネスとシーリングを決めます。

::: code-group

```typescript [Browser]
import { init, masterAudio, masteringPresetNames, masteringPlatformNames } from '@libraz/libsonare';

await init();

const presets = masteringPresetNames();       // 'pop'、'edm'、'acoustic' など
const targets = masteringPlatformNames();     // 'streaming'、'broadcast'、'club' など

const master = masterAudio(samples, sampleRate, 'pop');
console.log(master.inputLufs, master.outputLufs, master.outputTruePeakDbtp);
```

```python [Python]
import libsonare as sonare

presets = sonare.mastering_preset_names()
targets = sonare.mastering_platform_names()

master = sonare.master_audio(samples, sample_rate, "pop")
print(master.input_lufs, master.output_lufs, master.output_true_peak_dbtp)
```

```bash [CLI]
sonare mastering track.wav --preset pop -o master.wav
```

:::

## マスターの判断方法

処理が良くなったか判断するときは、[ラウドネスマッチング](./loudness-matching.md)を効かせた A/B 比較を使います。音が大きいほうは、数秒聴いただけなら良く聞こえてしまうからです。

そのうえで、次の 3 つを確認します。

- **再生互換性:** 小さなスピーカーやヘッドホンでも成立しているか。
- **ピーク安全性:** True Peak シーリングに変換用の余裕があるか。
- **意図:** その音源らしさを保っているか、チェーンが別のスタイルに押し込んでいないか。

最良のマスターは、一番大きいものでも一番明るいものでもありません。音楽的な意図を保ったまま、リリースに耐える信頼性を備えたものです。

:::: details 実装メモ

ブラウザデモでは、マスタリングという幅広い作業を固定されたチェーン設定に落とし込んでいます。必要に応じたリペア、全体的なトーン整形、ダイナミクス、Air バンド／エキサイター、ステレオイメージング、True Peak リミッティング、ラウドネス最適化という順序です。

クイックマスターはこのチェーンに実用的な初期値を入れます。Studio は同じチェーンをモジュールとして直接編集できるようにします。どちらも最後は同じレンダリングフローに入るため、違いは処理エンジンではなく、触れる深さです。

::::

関連: [LUFS](../lufs.md)、[True Peak](../true-peak.md)、[ラウドネスマッチングと A/B 比較](./loudness-matching.md)
