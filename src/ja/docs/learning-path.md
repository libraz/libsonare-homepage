# 学習順ガイド

このページは、libsonare のドキュメントを初学者向けに読むための道案内です。DSP、MIR、WebAssembly、マスタリング用語を最初から理解している必要はありません。

ドキュメントを先頭から順に読む場合は、次の順序で読むと前提が積み上がります。

1. [イントロダクション](./introduction.md) で用語と音声解析パイプラインの全体像を読む。
2. [学習順ガイド](./learning-path.md) で、解析・ストリーミング・編集・ミキシング・マスタリング・研究用途のどれを作るか決める。
3. [はじめに](./getting-started.md)、[インストール](./installation.md)、[使用例](./examples.md) で小さなプログラムを 1 つ動かす。
4. [機能マップ](./api-surface.md) で必要な API ファミリーを探す。
5. **作りたいもの別** から該当する機能ガイドを 1 つ読む。
6. **利用環境別 API** から実行環境に合うリファレンスを 1 つ読む。
7. 実装詳細、アルゴリズム根拠、検証範囲、性能が必要になったときだけ、詳説ページを読む。

## 作りたいものから選ぶ

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| BPM、キー、コード、セクションを表示するブラウザアプリ | [はじめに](./getting-started.md) | [WebAssembly ガイド](./wasm.md)、[JavaScript API](./js-api.md) |
| 音声解析を行う Python スクリプトやノートブック | [はじめに](./getting-started.md#python) | [Python API](./python-api.md) |
| ターミナルでの簡易確認やバッチ解析 | [はじめに](./getting-started.md) | [CLI リファレンス](./cli.md) |
| ライブ可視化、リズムゲーム補助、AudioWorklet ツール | [リアルタイムとストリーミング](./realtime-streaming.md) | [WebAssembly ガイド](./wasm.md#ストリーミング解析) |
| ブラウザまたはネイティブのミキサー | [ミキシングエンジン](./mixing.md) | [ミキシングシーン JSON](./mixing-scene-json.md) |
| マスタリング UI や自動マスタリング | [マスタリングアシスタント](./mastering-assistant.md) | [マスタリングプロセッサ](./mastering-processors.md) |
| ピッチ、長さ、声質、音源分離の編集 | [編集 DSP](./editing-dsp.md) | [JavaScript API](./js-api.md#オーディオエフェクト) |
| 残響時間、明瞭度、ブラインド音響推定 | [室内音響解析](./acoustic-analysis.md) | [JavaScript API](./js-api.md#ルーム音響解析)、[Python API](./python-api.md#ルーム音響解析) |
| メル／MFCC 特徴量をプレビューやデバッグ用に逆変換する | [逆変換特徴量](./inverse-features.md) | [librosa 互換性](./librosa-compatibility.md) |
| librosa からの移行 | [librosa 互換性](./librosa-compatibility.md) | [機能マップ](./api-surface.md) |

## 4 つの層で考える

libsonare は、4 つの層に分けて読むと理解しやすくなります。

| 層 | 内容 | ページ |
|----|------|--------|
| 概念 | BPM、キー、STFT、クロマ、LUFS、トゥルーピークなどの意味 | [イントロダクション](./introduction.md)、[用語集](./glossary.md) |
| 目的 | 解析、ストリーミング、編集、ミキシング、マスタリングなど、作りたい機能 | [機能マップ](./api-surface.md)、各機能ガイド |
| 実行環境 | ブラウザ、Python、Node、CLI、C++ のどこで動かすか | [はじめに](./getting-started.md)、利用環境別リファレンス |
| 根拠 | 実装の構造、アルゴリズム、検証状況 | [DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[実装検証](./implementation-validation.md) |

多くの利用者は、最初に概念、目的、実行環境の 3 つを読めば十分です。実装と根拠のページは、必要になった時点で開いてください。

## 最初のプロジェクトまでの最短ルート

1. [イントロダクション](./introduction.md) で基本用語を確認する。
2. [はじめに](./getting-started.md) で利用環境を選ぶ。
3. [使用例](./examples.md) から小さなサンプルを 1 つ動かす。
4. 必要な API ファミリーを探すときは [機能マップ](./api-surface.md) を使う。
5. 実行環境をまたいでコードを移すときだけ [バインディング対応表](./binding-parity.md) を確認する。

## 深掘りページを読むタイミング

DSP のパラメータを UI に出す、レンダリングレポートを説明する、リアルタイム用途に向く処理か確認する、アルゴリズム上の根拠を確認する、といった場面で実装ページを開きます。最初の組み込みでは必須ではありません。
