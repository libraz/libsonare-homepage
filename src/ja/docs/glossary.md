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
| [ミキシングの基礎](./glossary/concepts/mixing-basics.md) | トラック、ステム、トリム、フェーダー、パン、ステレオ幅、ミュート、ソロ、極性、ヘッドルーム、バウンス。 |
| [編集の基礎](./glossary/concepts/editing-basics.md) | ピッチと時間、半音とセント、MIDI ノート番号、フォルマント、サンプルと秒。 |
| [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md) | ブラウザ内マスタリングで何がローカルに残り、何がネットワーク経由で読み込まれ、WASM 処理にどんな制約があるか。 |

## 解析ガイド

アナライザー、リアルタイム表示、特徴抽出 API で使う MIR 用語を掘り下げます。

| ガイド | 扱う内容 |
|--------|----------|
| [スペクトログラムと STFT](./glossary/analysis/spectrogram-stft.md) | FFT、STFT 窓、`nFft`、`hopLength`、スペクトログラム、CQT、VQT。 |
| [オンセット検出](./glossary/analysis/onset-detection.md) | オンセット、トランジェント、オンセット強度エンベロープ、テンポ推定との関係。 |
| [テンポと BPM](./glossary/analysis/tempo-bpm.md) | BPM 推定、テンポグラム、自己相関、信頼度、半分／2 倍テンポの曖昧さ。 |
| [ビートとダウンビート](./glossary/analysis/beats-downbeats.md) | ビート追跡、動的計画法、拍子位相、ダウンビート推定。 |
| [クロマ特徴量](./glossary/analysis/chroma-features.md) | ピッチクラス、クロマグラム、キー／コード解析でクロマが使われる理由。 |
| [キー検出](./glossary/analysis/key-detection.md) | クロマプロファイルによるキー推定、候補キー、プロファイルファミリー、信頼度。 |
| [コード認識](./glossary/analysis/chord-recognition.md) | コードテンプレート、ビート同期クロマ、スムージング、HMM オプション、区間信頼度。 |
| [メル・MFCC・音色](./glossary/analysis/mel-mfcc-timbre.md) | メル尺度、MFCC、スペクトル重心、平坦度、音色記述子。 |
| [メロディとピッチ](./glossary/analysis/melody-pitch.md) | F0、YIN、pYIN、単音ピッチ追跡、voicing、メロディ輪郭。 |
| [セクションと構成](./glossary/analysis/section-structure.md) | 境界検出、自己類似度、反復、エネルギー、セクションラベル。 |

## ミキシングガイド

[ミキシングエンジン](./mixing.md) ガイドで使う、チャンネルストリップ・ルーティング・イメージ・メーターの用語を掘り下げます。

| ガイド | 扱う内容 |
|--------|----------|
| [チャンネルストリップ](./glossary/mixing/channel-strip.md) | 固定された信号順と、それが各コントロールの働きを決める理由。 |
| [バスとセンド](./glossary/mixing/buses-sends.md) | master/aux/submix のロール、プリ／ポストフェーダーセンド、FX バス、VCA グループ。 |
| [パンとステレオ幅](./glossary/mixing/pan-width.md) | パンモード、パンロー、ステレオ幅とモノラル互換性。 |
| [オートメーションとメーター](./glossary/mixing/automation-metering.md) | オートメーションカーブ、ゴニオメーター、相関、トゥルーピークメーター。 |

## 編集ガイド

[編集 DSP](./editing-dsp.md) ガイドの背後にある編集 DSP の用語を掘り下げます。

| ガイド | 扱う内容 |
|--------|----------|
| [タイムストレッチとピッチシフト](./glossary/editing/phase-vocoder-stretch.md) | フェーズボコーダ、リサンプリング、時間／ピッチのトレード、アーティファクト。 |
| [ピッチ補正とノート編集](./glossary/editing/pitch-correction.md) | MIDI 目標への補正、ノート区間、サンプル精度の編集。 |
| [ボイスとフォルマント](./glossary/editing/voice-formant.md) | フォルマント、声道、ピッチとフォルマントの独立。 |

## 楽器と MIDI

libsonare が MIDI を音に変える仕組み — 内蔵の [NativeSynth](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)、そして両者が共有する MIDI の語彙を解説します。

| ガイド | 扱う内容 |
|--------|----------|
| [シンセの音作りの基礎](./glossary/instruments/synthesis-basics.md) | オシレーター、フィルター、NativeSynth が使う音作り方式（減算・FM・物理モデリング・モーダル・加算）。 |
| [エンベロープとモジュレーション](./glossary/instruments/envelopes-modulation.md) | ADSR エンベロープ、LFO、ベロシティ、キートラック、モッドマトリクス。 |
| [MIDI の基礎](./glossary/instruments/midi-basics.md) | ノート、ベロシティ、チャンネル、CC、プログラムチェンジ、バンク、General MIDI、ピッチベンド、MIDI 2.0。 |
| [SoundFont とサンプル音源](./glossary/instruments/soundfont.md) | サンプル音源と合成音源の違い、SF2 のバンクとプログラム、General MIDI の補完。 |

## アレンジとプロジェクト

[プロジェクト編集](./project-editing.md)、[録音・テイク](./recording-and-takes.md)、[プロジェクトバウンス](./project-bounce.md)で使うヘッドレス DAW の用語を掘り下げます。

| ガイド | 扱う内容 |
|--------|----------|
| [クリップとトラック](./glossary/arrangement/clips-and-tracks.md) | プロジェクトの構造 — トラック、クリップ、タイムライン、MIDI 宛先、クリップ編集。 |
| [テイクとコンピング](./glossary/arrangement/takes-and-comping.md) | クリップ内の複数テイク、アクティブテイク、コンプセグメント、ループ録音。 |
| [ワープとテンポ同期](./glossary/arrangement/warp-and-tempo.md) | ワープモード、アンカー、テンポマップ、拍子、ピッチを保つストレッチ。 |
| [バウンスとレンダリング](./glossary/arrangement/bounce-and-rendering.md) | アレンジを音声へ書き出す、ミキサーシーン、楽器バウンス、レイテンシ補償。 |

## リアルタイムガイド

`StreamAnalyzer`、`RealtimeEngine`、AudioWorklet 経路で使うリアルタイム／ストリーミングの用語を掘り下げます。

| ガイド | 扱う内容 |
|--------|----------|
| [ストリーミング解析](./glossary/realtime/streaming-analysis.md) | ブロック、フレーム、ホップ、更新されていく推定、フレームのまとめ読み。 |
| [リアルタイムエンジン](./glossary/realtime/realtime-engine.md) | トランスポート、クリップスケジュール、メトロノーム、メーター情報。 |
| [リアルタイム安全性](./glossary/realtime/realtime-safety.md) | 音声コールバックの締め切り、確保なし／ロックフリーの規則、AudioWorklet。 |

## 室内音響

[空間ルームスキャナー](/ja/spatial) と [音響解析](./acoustic-analysis.md) で使う室内音響の用語を掘り下げます。部屋の減衰が、その大きさ・面・音源までの距離について何を明かすか。

| ガイド | 扱う内容 |
|--------|----------|
| [残響時間（RT60 と EDT）](./glossary/acoustics/reverberation-time.md) | RT60、初期減衰時間、T20／T30 外挿、2 つの指標が食い違う理由。 |
| [明瞭度と明瞭性（C50・C80・D50）](./glossary/acoustics/clarity-definition.md) | 音声と音楽の初期／後期エネルギー比、割合としての明瞭性。 |
| [音源距離と DRR](./glossary/acoustics/source-distance.md) | 直接音／残響音比、臨界距離、1 チャンネルが距離は解けても方向は解けない理由。 |
| [部屋の形状と容積](./glossary/acoustics/room-geometry.md) | 等価なシューボックス、容積、サビーンの容積／吸音のトレードオフ。 |
| [帯域別の減衰と吸音](./glossary/acoustics/absorption-bands.md) | 帯域別 RT60、吸音係数、高域のロールオフ。 |
| [逆問題による部屋推定](./glossary/acoustics/inverse-estimation.md) | インパルス応答とブラインドの推定、信頼度スコアの読み方。 |

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
