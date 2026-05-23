---
title: マスタリング
description: マスタリングの役割と libsonare ブラウザデモでの考え方。
---

# マスタリング

マスタリングはリリース前の最終処理です。聴感上の音量、広い音色バランス、ダイナミクス、ステレオ感、ピーク安全性を整えます。

libsonare のデモでは、マスタリング処理は WebAssembly としてブラウザ内で実行されます。音源はブラウザでデコードされ、設定されたチェーンを通り、サーバーへアップロードされずに WAV として書き出されます。

## 何を調整するか

| 項目 | 目的 |
|------|------|
| Loudness | -14 LUFS や -16 LUFS などのターゲットに合わせる。 |
| Tone | 個別トラックを触らず、広い音色バランスを整える。 |
| Dynamics | 動きを残しながらピークと密度を制御する。 |
| Stereo | モノラル互換性を崩さず有用な広がりを保つ。 |
| Peaks | 変換後や配信再生でのクリップを避ける。 |

Quick Master はプリセット中心、Studio はコンプレッサーのスレッショルド・Air バンド量・ステレオ幅・リミッターシーリング・ルックアヘッドなどを直接調整するモードです。

## 処理チェーン

ブラウザデモの UI は少数の音楽的な判断に整理していますが、レンダリング自体は決定的な DSP 経路として実行されます。

```mermaid
flowchart LR
  A[Decoded source] --> B[Repair and input]
  B --> C[Tone and air]
  C --> D[Dynamics]
  D --> E[Stereo image]
  E --> F[True-peak limiter]
  F --> G[Loudness target]
  G --> H[WAV and JSON report]
```

各パラメータを薄いページへ分割せず、以下の機能群ガイドで実装上の詳細までまとめています。

- [リペアと入力コントロール](./mastering/repair.md)
- [トーンと Air コントロール](./mastering/tone-air.md)
- [ダイナミクスコントロール](./mastering/dynamics.md)
- [ステレオ、リミッター、ラウドネスコントロール](./mastering/stereo-limiter-loudness.md)
- [リファレンスマッチ](./mastering/reference-match.md)
- [マスタリングメーターの読み方](./mastering/meter-reading.md)

:::: details 実装メモ

チェーンは、補正系から最終納品系へ進む順序にしています。クリック、ノイズ、DC オフセット、入力レベル不足は後段の検出器を誤らせるため、リペアとインプットゲインを先に置きます。トーン整形はダイナミクスより前に置き、コンプレッサーが最終的に聴かせる音色バランスへ反応するようにします。ステレオ処理はピーク関係やモノラル互換性を変えるため、リミッターとメーターがその影響を見られるよう後段に置きます。

最終ラウドネスステージは単純なゲインノブではありません。Integrated LUFS はレンダリング後の素材に対して測定し、True Peak はオーバーサンプリングされた信号経路で確認し、リミッターのシーリングは別の安全制約として残します。これらが衝突する場合は、LUFS ターゲットよりピーク安全性を優先します。そうしないと、LUFS だけは合っていてもコーデック変換後にクリップするマスターになってしまいます。

::::

関連: [LUFS](./lufs.md), [True Peak](./true-peak.md), [A/B 比較](./ab-comparison.md), [ブラウザ内ローカル処理](./concepts/browser-local-processing.md), [マスタリング実装](../mastering-implementation.md)
