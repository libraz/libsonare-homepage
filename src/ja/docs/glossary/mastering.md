---
title: マスタリング
description: マスタリングの役割と libsonare ブラウザデモでの考え方。
---

# マスタリング

マスタリングはリリース前の最終処理です。体感上の音量、広い音色バランス、ダイナミクス、ステレオ感、ピーク安全性を整えます。

libsonare のデモでは、マスタリング処理は WebAssembly としてブラウザ内で実行されます。音源はブラウザでデコードされ、設定されたチェーンを通り、サーバーへアップロードされずに WAV として書き出されます。

## 何を調整するか

| 項目 | 目的 |
|------|------|
| ラウドネス | -14 LUFS や -16 LUFS などのターゲットに合わせる。 |
| トーン | 個別トラックを触らず、広い音色バランスを整える。 |
| ダイナミクス | 動きを残しながらピークと密度を制御する。 |
| ステレオ | モノラル互換性を崩さず、有効な広がりを保つ。 |
| ピーク | 変換後や配信再生でのクリップを避ける。 |

クイックマスターはプリセット中心、Studio はコンプレッサーのスレッショルド・Air バンド量・ステレオ幅・リミッターシーリング・ルックアヘッドなどを直接調整するモードです。

## 処理チェーン

ブラウザデモの UI は少数の音楽的な判断に整理していますが、レンダリング自体は決定的な DSP 経路として実行されます。各ステージは、それより前のすべてのステージの処理が終わった音声だけを受け取るため、補正系の処理(リペア、トーン)は、整った信号を前提とする後続の処理(ダイナミクス、ステレオ、リミッティング、ラウドネス)より必ず先に行われます。

<FlowDiagram
  title="マスタリングチェーン"
  :nodes="[
    { id: 'decode', label: 'デコード済み音源', col: 0, row: 0 },
    { id: 'repair', label: 'リペアと入力', col: 1, row: 0 },
    { id: 'tone', label: 'トーンと Air', col: 2, row: 0 },
    { id: 'dynamics', label: 'ダイナミクス', col: 3, row: 0 },
    { id: 'stereo', label: 'ステレオイメージ', col: 4, row: 0 },
    { id: 'limiter', label: 'True Peak リミッター', col: 5, row: 0 },
    { id: 'loudness', label: 'ラウドネスターゲット', col: 6, row: 0 },
    { id: 'export', label: 'WAV とレポート', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'decode', to: 'repair' },
    { from: 'repair', to: 'tone' },
    { from: 'tone', to: 'dynamics' },
    { from: 'dynamics', to: 'stereo' },
    { from: 'stereo', to: 'limiter' },
    { from: 'limiter', to: 'loudness' },
    { from: 'loudness', to: 'export' }
  ]"
  caption="補正系のステージを先に実行し、ピーク安全性とラウドネスは最後に確定します。"
/>

各パラメータを細かいページへ分けず、以下の機能群ガイドで実装上の詳細までまとめています。

- [リペアと入力コントロール](./mastering/repair.md)
- [トーンと Air コントロール](./mastering/tone-air.md)
- [ダイナミクスコントロール](./mastering/dynamics.md)
- [ステレオ、リミッター、ラウドネスコントロール](./mastering/stereo-limiter-loudness.md)
- [リファレンスマッチ](./mastering/reference-match.md)
- [マスタリングメーターの読み方](./mastering/meter-reading.md)

:::: details 実装メモ

チェーンは、補正系から最終納品系へ進む順序にしています。

| 段階 | その位置に置く理由 |
|------|--------------------|
| リペアとインプットゲイン | クリック、ノイズ、DC オフセット、入力レベル不足は後段の検出器を誤らせるため |
| 大まかなトーン整形 | コンプレッサーが、最終的に聴かせる音色バランスへ反応するようにするため |
| ステレオ処理 | 広がりがピーク関係やモノラル互換性を変えるため、リミッターとメーターがその影響を見られるようにするため |

最終ラウドネスステージは単純なゲインノブではありません。Integrated LUFS はレンダリング後の素材に対して測定し、True Peak はオーバーサンプリングされた信号経路で確認し、リミッターのシーリングは別の安全制約として残します。これらが衝突する場合は、LUFS ターゲットよりピーク安全性を優先します。そうしないと、LUFS だけは合っていてもコーデック変換後にクリップするマスターになってしまいます。

::::

関連: [LUFS](./lufs.md), [True Peak](./true-peak.md), [A/B 比較](./ab-comparison.md), [ブラウザ内ローカル処理](./concepts/browser-local-processing.md), [マスタリング実装](../mastering-implementation.md)
