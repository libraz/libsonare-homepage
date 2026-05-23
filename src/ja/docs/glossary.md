---
title: 用語集
description: libsonare のオーディオ解析、MIR、ブラウザ内マスタリング用語への編集済み索引です。
---

# 用語集

この用語集は、自動生成した用語の羅列ではなく、手で整えた解説ページへの索引です。まず機能群ごとのガイドを読み、実装上の詳細は各ページ内の折りたたみメモを参照してください。

::: tip オーディオ解析が初めての場合
まず [オーディオ基礎](./glossary/concepts/audio-basics.md)、次に [MIR の全体像](./glossary/concepts/mir-overview.md) を読んでください。マスタリングデモから来た場合は [マスタリングとは?](./glossary/concepts/what-is-mastering.md) から始めると全体像をつかみやすくなります。
:::

## 基礎

API、CLI、WASM、ブラウザデモで共通して出てくる信号処理と解析の土台です。

| ガイド | 扱う内容 |
|--------|----------|
| [オーディオ基礎](./glossary/concepts/audio-basics.md) | サンプルレート、ビット深度、モノラル／ステレオ、振幅、dB、クリッピング、ヘッドルーム、レイテンシ。 |
| [MIR の全体像](./glossary/concepts/mir-overview.md) | BPM、ビート、オンセット、キー、コード、クロマ、FFT、STFT、スペクトログラム、MFCC、CQT、VQT、HPSS、ピッチ、セクション。 |
| [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md) | ブラウザ内マスタリングで何がローカルに残り、何がネットワーク経由で読み込まれ、WASM 処理にどんな制約があるか。 |

## マスタリング概念

マスタリングデモの判断に必要な聴感・計測の考え方です。

| ガイド | 扱う内容 |
|--------|----------|
| [マスタリング](./glossary/mastering.md) | ラウドネス、音色、ダイナミクス、ステレオ感、ピーク安全性をまとめる最終工程。 |
| [マスタリングとは?](./glossary/concepts/what-is-mastering.md) | リリース前の最終処理としてのマスタリング全体像。 |
| [LUFS](./glossary/lufs.md) | Integrated ラウドネスと代表的な配信ターゲット。 |
| [True Peak](./glossary/true-peak.md) | サンプル間ピークと `dBTP` がサンプルピークと異なる理由。 |
| [A/B 比較](./glossary/ab-comparison.md) | 処理前後を同じラウドネスに揃えて聴く手法。 |
| [ラウドネスマッチング](./glossary/concepts/loudness-matching.md) | 大きい方が良く聞こえる判断バイアスを避けるための比較手順。 |
| [リファレンストラック](./glossary/concepts/reference-track.md) | 完成済みリリースをトーン／ラウドネスの基準として使う方法。 |
| [True Peak 安全性](./glossary/concepts/true-peak-safety.md) | エンコードや再生変換後にも耐えるシーリングの考え方。 |
| [ダイナミックレンジ](./glossary/concepts/dynamic-range.md) | ラウドネスだけでは読み取れない動きと密度。 |
| [クレストファクター](./glossary/concepts/crest-factor.md) | ピークと平均の差からパンチを読み取る方法。 |
| [モノラル互換性](./glossary/concepts/mono-compatibility.md) | ステレオ幅がモノラル再生に耐えるかの確認。 |
| [ゲインステージング](./glossary/concepts/gain-staging.md) | 処理前・処理中・処理後の信号レベルを適切に保つ考え方。 |
| [Air Band](./glossary/air-band.md) | 高域の開放感と、足しすぎないための判断軸。 |

## マスタリング機能ガイド

チェーン上で一緒に判断するコントロール群ごとにまとめています。個別パラメータを薄い自動生成ページに分割することはしません。

| ガイド | 扱う内容 |
|--------|----------|
| [リペアと入力コントロール](./glossary/mastering/repair.md) | インプットゲイン、ディノイズ、ソースのクリッピング、メイン処理前の準備。 |
| [ダイナミクスコントロール](./glossary/mastering/dynamics.md) | スレッショルド、レシオ、アタック、リリース、ニー、ゲインリダクション、パンチ。 |
| [トーンと Air コントロール](./glossary/mastering/tone-air.md) | Tilt EQ、エキサイター量、Air バンド量、明るさの判断。 |
| [ステレオ、リミッター、ラウドネスコントロール](./glossary/mastering/stereo-limiter-loudness.md) | ステレオ幅、リミッターのシーリング、ラウドネス目標、最終レンダリング。 |
| [リファレンスマッチ](./glossary/mastering/reference-match.md) | リファレンスの読み込み、レベルマッチング、スペクトル比較、マッチ強度。 |
| [配信ターゲット](./glossary/mastering/delivery-targets.md) | ストリーミング、ポッドキャスト、クラブ、アーカイブ向けの LUFS／True Peak 目標。 |
| [マスタリングメーターの読み方](./glossary/mastering/meter-reading.md) | LUFS、ピーク、クレストファクター、相関値、位相、ステレオイメージをまとめて読む方法。 |
| [マスタリングプリセットの選び方](./glossary/mastering/preset-selection.md) | プリセットを「完成品」ではなく出発点として選ぶ方法。 |
| [マスタリング品質チェックリスト](./glossary/mastering/quality-checklist.md) | 書き出しを信用する前の最終確認。 |
| [エラー復旧](./glossary/mastering/error-recovery.md) | デコード・レンダリング・リファレンスマッチ・再生確認で問題が出たときの対処。 |

## 関連ドキュメント

- [イントロダクション](./introduction.md)
- [マスタリング実装](./mastering-implementation.md)
- [JavaScript API](./js-api.md)
- [Python API](./python-api.md)
- [CLI](./cli.md)
- [WASM](./wasm.md)
