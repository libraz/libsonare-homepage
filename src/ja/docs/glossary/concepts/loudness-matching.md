---
title: ラウドネスマッチング
description: マスタリングの処理前 / 処理後比較で音量差のバイアスを避ける理由。
---

# ラウドネスマッチング

ラウドネスマッチングは、2 つの音源を同じくらいの聴感音量で比較することです。マスタリング判断を良くするための、もっとも基本的で効果の大きい方法の 1 つです。

ラウドネスマッチングをしないと、最初の印象では大きい方が良く聞こえやすくなります。最終的な納品レベルを確認する場面では音量差そのものも重要ですが、EQ、コンプレッション、ステレオ幅、サチュレーション、リミッターが本当に改善になっているか判断するには不向きです。

## なぜ大きい方が良く聞こえるのか

似た音を違う音量で再生すると、大きい方がより明瞭で、明るく、広く、迫力があるように感じやすくなります。実際にはゲインしか変わっていない場合でも起こります。

このバイアスは、マスタリングでは特に危険です。多くのプロセッサは副作用としてラウドネスを変えるからです。

| プロセッサ | 比較が偏る理由 |
|-----------|----------------|
| EQ | ブーストによって処理後の方が大きく、良く聞こえることがある。 |
| コンプレッション | ピークを抑えつつ平均レベルが上がる。 |
| サチュレーション | 倍音が増え、体感上の音量が上がる。 |
| リミッティング | ピークを抑えた後、メイクアップで密度が上がる。 |
| ステレオワイドニング | 音像が広がると、センターの芯（モノラルでも崩れない成分）が弱まっていても、大きく迫力があるように感じられることがある。 |

ラウドネスマッチングは比較を完璧にするものではありません。それでも、「大きいから良い」という一番わかりやすい落とし穴を避けられます。

## 使い方

処理の良し悪しを判断するときは、ラウドネスマッチングを有効にします。

1. 処理後のバージョンをレンダリングする。
2. ラウドネスマッチした A/B 再生を有効にする。
3. 同じフレーズで処理前 / 処理後を切り替える。
4. 音色、パンチ、ボーカルの安定、低域の制御、ステレオイメージ、アーティファクトを聴く。
5. 実際の最終納品レベルを確認するときだけマッチングを外す。

マッチングを外したときだけ処理後が良く聞こえるなら、それは主に音量が上がっただけかもしれません。その場合は処理量を下げて、もう一度比較します。

<SonareDemo id="loudness-meter" />

## これだけでは判断できないこと

ラウドネスマッチングは納品ターゲットではありません。A/B では公平に比較できても、ファイル自体が大きすぎる、小さすぎる、またはリリースに対してピークが危険ということはあります。

また、メーターの代わりにもなりません。[LUFS](../lufs.md)（Loudness Units relative to Full Scale。放送・配信で使われる聴感ラウドネスの単位）と [True Peak](../true-peak.md) で配信上の制約を確認し、そのうえでラウドネスマッチした聴取で音楽的に有効な処理かを判断します。

## libsonare で測る

それぞれのバージョンの Integrated LUFS を測り、大きい方を小さい方に合わせて下げます。ゲインが正になることはないので、マッチングは常に下げる方向にしか働きません。サイトの `comp-take-a.wav`（-8.3 LUFS）と `comp-take-b.wav`（-10.8 LUFS）なら、テイク A が 2.5 dB 下がり、テイク B はそのままです。

::: code-group

```typescript [Browser]
import { init, lufs, masteringAbMatchLoudness } from '@libraz/libsonare';

await init();

const a = lufs(samplesA, sampleRate).integratedLufs;
const b = lufs(samplesB, sampleRate).integratedLufs;
const anchor = Math.min(a, b);
const gainA = anchor - a;   // A にかける dB
const gainB = anchor - b;   // B にかける dB

// エンジンに、片方をもう片方のラウドネスへ合わせさせることもできます:
const { samples: matched, appliedGainDb, matchedTruePeakDbtp } = masteringAbMatchLoudness({
  source: samplesB,
  reference: samplesA,
  sampleRate,
});
```

```python [Python]
import libsonare as sonare

a = sonare.lufs(samples_a, sample_rate).integrated_lufs
b = sonare.lufs(samples_b, sample_rate).integrated_lufs
anchor = min(a, b)
gain_a = anchor - a   # A にかける dB
gain_b = anchor - b   # B にかける dB

# エンジンに、片方をもう片方のラウドネスへ合わせさせることもできます:
matched, match = sonare.mastering_ab_match_loudness(samples_b, samples_a, sample_rate)
```

```bash [CLI]
sonare lufs take-a.wav   # A の Integrated LUFS
sonare lufs take-b.wav   # B の Integrated LUFS
# 小さい方の値を各値から引くと、2 つのゲインが求まります
```

:::

`masteringAbMatchLoudness` は、ヘッドルームの制限なしにソースをリファレンスのレベルまで持ち上げるため、ピークが 0 dBTP を超えることがあります。返ってきた音声を書き出す前に、`matchedTruePeakDbtp` を確認してください。

### エンジンの配信ターゲット

マスタリングアシスタントは、次のターゲットを名前で扱います（`masteringPlatformNames()` で一覧できます）。これはエンジン自身の設定であり、各配信サービスが現在採用している基準ではありません。

| `targetPlatform` | Integrated ラウドネス | True Peak シーリング |
|------------------|-----------------------|----------------------|
| `streaming`、`youtube` | 独自の値はなく、アシスタントの既定の -14 LUFS を使う | -1 dBTP |
| `broadcast` | -23 LUFS | -1 dBTP |
| `podcast` | -16 LUFS | -1 dBTP |
| `club`、`cd` | -9 LUFS | -0.3 dBTP |
| `audiobook`、`cinema` | なし。渡した値がそのまま使われる | なし |

`club` と `cd` は、ヘッドルームを削って密度を取る設定です。-0.3 dBTP は、ほかの行が残している余裕の一部を手放します。`masteringStreamingPreview` は逆に、各プラットフォームの正規化があなたのマスターに何をするかを見せます。既定では Spotify と YouTube が -14 LUFS、Apple Music が -16 LUFS で、いずれもシーリングは -1 dBTP です。結果として、プラットフォームごとの `normalizationGainDb` と `ceilingRisk` が返ります。

## libsonare デモでの扱い

マスタリングデモでは、A/B 再生の「ラウドネスを揃える」が既定で有効です。切り替えた先のバージョンは、読み込んでいるバージョンのうちもっとも小さいものに合わせて下げられるため、単純な音量差でどれかが有利になることはありません。リファレンストラックを読み込んでいる場合はリファレンスが基準になることもあり、そのときはソースとレンダリング後マスターの両方が下げられて再生されます。

この設定は書き出し音声には影響しません。WAV のダウンロードはレンダリングされたレベルのままです。ラウドネスマッチングは、ブラウザプレイヤーで 2 つのバージョンを比較するときだけ使われます。

:::: details 実装メモ

デモは、ソース・レンダリング後マスター・（読み込んでいれば）リファレンストラックの Integrated LUFS を取り、そのうちもっとも小さい値を基準にします。再生中の側には、その基準まで下げるための再生時だけのゲインオフセットがかかります。オフセットが正になることはなく、マッチングは常に下げる方向にしか働きません。

この方式ではどちらのバッファも書き換えません。書き出される WAV が正式な結果であり、レポートや CLI／API で再現する場合は、ブラウザプレイヤーの一時的な比較ゲインではなく、レンダリング後 LUFS とチェーン設定を見ます。

::::

関連: [A/B 比較](../ab-comparison.md)、[LUFS](../lufs.md)、[マスタリングとは?](./what-is-mastering.md)
