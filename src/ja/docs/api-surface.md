# 機能マップ

このページは libsonare の最上位マップです。やりたいことは決まっているが、どのランタイム、API ページ、実装解説を読むべきか迷うときの入口として使います。

初めて libsonare を使う場合は、先に [学習順ガイド](./learning-path.md) を読んでください。このページは全体像を確認するための地図なので、最初のチュートリアルより広い範囲を扱います。

## このページで身につくこと

このページを読むと、次のことを判断・確認できるようになります。

- すべての API リファレンスを眺めずに、必要な機能ファミリーを見つけられる。
- ブラウザ、Python、Node ネイティブ、CLI、C++、C ABI のどの実行環境ページへ進むべきか選べる。
- ある話題が目的別ガイド、API リファレンス、実装／根拠ページのどこに属するかを判断できる。
- 公開サーフェスを検証する必要があるとき、ここに挙げたソースファイルを最終根拠として使える。

## このページの読み方

このページは「全部を覚える」ための一覧ではありません。まず自分の目的を 1 つ選び、その行からリンク先へ進むための索引として使ってください。

迷ったら、次の順で考えると選びやすくなります。

1. **何をしたいか**を決める。例: BPM を出したい、ブラウザで音声を可視化したい、マスタリングを書き出したい。
2. **どこで動かすか**を決める。例: ブラウザ、Python スクリプト、C++ アプリ、CLI。
3. 下の表で、目的に近い「機能ファミリー」と実行環境の入口を選ぶ。

「特徴量」「MIR」「DSP」などの言葉が分からなくても問題ありません。特徴量は、音声そのものではなく、音声から取り出した数値の要約です。MIR は Music Information Retrieval の略で、BPM、キー、コード、ビートなど、音楽から情報を読み取る処理全般を指します。DSP は Digital Signal Processing の略で、音声を測ったり変形したりする信号処理のことです。

| 知りたいこと | 読むページ |
|--------------|------------|
| 機能が存在するか | [機能ファミリー](#機能ファミリー) |
| どの API で使えるか | [ランタイム別の入口](#ランタイム別の入口) と [バインディング対応表](./binding-parity.md) |
| DSP の内部挙動と制約 | [DSP 実装解説](./dsp-implementation.md) |
| アルゴリズムや論文上の根拠 | [アルゴリズム根拠](./algorithm-references.md) |
| テストや検証状況 | [実装検証](./implementation-validation.md) |

## ランタイム別の入口

ランタイムは「同じ libsonare を、どの環境から呼ぶか」という違いです。コアの計算は C++ で実装されていますが、ブラウザでは WASM、Python では Python パッケージ、コマンドラインでは CLI という形で使います。初めてなら、アプリの実行場所に合わせて 1 つだけ読めば十分です。

| ランタイム | パッケージ／ヘッダー | 主な資料 |
|------------|----------------------|-----------|
| ブラウザ / Node WASM | `@libraz/libsonare` と Worklet サブパス | [WASM](./wasm.md)、[JavaScript API](./js-api.md) |
| Python / CLI | `pip install libsonare` | [Python API](./python-api.md)、[CLI](./cli.md) |
| Node ネイティブ | `@libraz/libsonare-native` ソースビルド | [ネイティブバインディング](./native-bindings.md) |
| C++ | `sonare.h` と各モジュールヘッダー | [C++ API](./cpp-api.md) |
| C ABI | `sonare_c.h` | [C++ API](./cpp-api.md#c-api)、[バインディング対応表](./binding-parity.md) |

## 機能ファミリー

機能ファミリーは「何をする機能か」で大きく分けたものです。API 名を知らない段階では、ここから探すのが一番早いです。

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| 解析 | BPM、キー、キー候補、ビート、ダウンビート、オンセット、コード、セクション、メロディ、音色、ダイナミクス、リズム、音響解析 | [JavaScript API](./js-api.md)、[Python API](./python-api.md)、[C++ API](./cpp-api.md) |
| 特徴量 | STFT、メル、MFCC、クロマ、spectral contrast/poly features、zero crossings、ピッチとチューニング、CQT/VQT、NNLS クロマ、NMF 分解、近傍フィルタ、テンポグラム、Fourier tempogram、cyclic tempogram、PLP、LUFS/LRA | [JavaScript API](./js-api.md#特徴抽出)、[librosa 互換性](./librosa-compatibility.md) |
| メータリング | オフラインのレベル／ラウドネス／クレストファクター／トゥルーピーク／DC オフセット計測、クリッピング・ダイナミックレンジレポート、ステレオ相関／幅、ベクトルスコープ・位相スコープ・スペクトルスナップショット | [JavaScript API](./js-api.md#メータリング)、[Python API](./python-api.md)、[ネイティブバインディング](./native-bindings.md) |
| スケール量子化 | MIDI ノートをスケールにスナップし、補正量をセミトーンで測定、ピッチクラスの所属を判定 | [JavaScript API](./js-api.md#スケール量子化)、[Python API](./python-api.md) |
| エフェクトと編集 | HPSS、残差付き HPSS、倍音／打撃成分抽出、ノーマライズ、トリム、リミックス、フェーズボコーダー、タイムストレッチ、ピッチシフト、ピッチ補正、ノートストレッチ、ピッチ／フォルマント変更、リアルタイム音声プリセット | [編集 DSP](./editing-dsp.md)、[JavaScript API](./js-api.md#オーディオエフェクト) |
| ルーム音響解析 | インパルスレスポンスの RT60/EDT/C50/C80/D50 解析、通常録音からのブラインド音響推定 | [ルーム音響解析](./acoustic-analysis.md)、[JavaScript API](./js-api.md#ルーム音響解析)、[Python API](./python-api.md#ルーム音響解析) |
| ミキシング | チャンネルストリップ、バス、センド、VCA グループ、シーンプリセット、オートメーション、メーター、ゴニオメーター、オフラインレンダー | [ミキシングエンジン](./mixing.md)、[ミキシングシーン JSON](./mixing-scene-json.md) |
| マスタリングアシスタント | 音源プロファイル、チェーン提案 JSON、配信プラットフォーム別プレビュー JSON | [マスタリングアシスタント](./mastering-assistant.md) |
| マスタリング | プリセット、フルチェーン、名前付きプロセッサ、ペアプロセッサ、ペア解析、ステレオ解析、ストリーミングマスタリングチェーン | [マスタリングプロセッサ](./mastering-processors.md)、[DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[マスタリング実装](./mastering-implementation.md) |
| ストリーミング MIR | ライブのメル／クロマ／オンセットフレーム、逐次 BPM／キー／コード推定、コード進行、パターンスコア | [リアルタイムとストリーミング](./realtime-streaming.md)、[WASM](./wasm.md#ストリーミング解析) |
| リアルタイムエンジン | トランスポート、テンポ、マーカー、メトロノーム、オートメーションレーン、グラフトポロジー、クリップ、キャプチャ、モニターバス、テレメトリ、バウンス／フリーズ | [リアルタイムとストリーミング](./realtime-streaming.md) |
| 逆変換特徴量 | メルから STFT／音声、MFCC からメル／音声 | [逆変換特徴量](./inverse-features.md) |
| ユーティリティ / librosa 互換 | フレーム／サンプル／時間変換、dB 変換、pre/de-emphasis、無音 trim/split、frame/pad/fix、peak pick、vector normalize、PCEN、tonnetz | [librosa 互換性](./librosa-compatibility.md) |

## 実装と根拠のページ

| ページ | 役割 |
|--------|------|
| [マスタリングプロセッサ](./mastering-processors.md) | プリセット名、プロセッサ ID、ペアプロセッサ、ペア解析、ステレオ解析の公開レジストリ |
| [DSP 実装解説](./dsp-implementation.md) | DSP ファミリーごとの内部挙動、リアルタイム境界、共通構成要素 |
| [アルゴリズム根拠](./algorithm-references.md) | ソース、テスト、README から確認できる標準規格、論文、アルゴリズムファミリー、互換性参照 |
| [実装検証](./implementation-validation.md) | 機能グループごとのテストと検証状況、librosa 参照値、リアルタイム安全性の整理 |

## WASM のエクスポート系統

ここから先は、実装や公開 API を厳密に確認したい人向けです。ブラウザで「まず動かす」だけなら、`init()` して必要な関数を import する、という理解で十分です。

メインの `@libraz/libsonare` TypeScript ラッパーは、複数の系統をエクスポートします。

| 系統 | 例 |
|------|----|
| 初期化 | `init`, `isInitialized`, `version` |
| エンジン能力確認 | `engineAbiVersion`, `voiceChangerAbiVersion`, `engineCapabilities` |
| 音声処理 | 高レベル解析、エフェクト／編集、マスタリング、ミキシング、特徴量抽出、逆変換特徴量、変換ヘルパー |
| オブジェクト API | `Audio`, `StreamAnalyzer`, `StreamingMasteringChain`, `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger`, `Mixer`, `RealtimeEngine` |

同じ npm パッケージは、AudioWorklet ブリッジ用の `@libraz/libsonare/worklet`、軽量な `sonare-rt` リアルタイムモジュールファクトリ用の `@libraz/libsonare/rt`、バンドラーや独自ローダー向けの生 WASM アセット用サブパス（`@libraz/libsonare/wasm`、`@libraz/libsonare/rt-wasm`）も公開します。

完全な関数一覧は libsonare リポジトリの `bindings/wasm/src/index.ts` が根拠で、[JavaScript API](./js-api.md) に反映しています。WASM のエクスポート名を厳密に確認したい場合は、このラッパーソースを最も具体的な参照として扱ってください。

## CLI コマンド系統

CLI は、プログラムを書かずにファイルを指定して解析・変換したいときの入口です。自動処理や検証には便利ですが、リアルタイム UI や細かい対話的制御には JavaScript / Python / C++ API の方が向いています。

Python CLI は次の用途を扱います。

- version/info
- コア解析
- 主要な特徴量サマリー
- ファイルを書き出す編集コマンド（`pitch-correct`、`note-stretch`、`voice-change`）
- 音響／リズム／ダイナミクス／音色サマリー
- LUFS、マスタリングプロセッサ入口、簡単なミキシング

ソースビルドの C++ CLI はさらに低レベルなコマンド群を持ちます。セクション／メロディ／境界ユーティリティ、CQT／tonnetz／PCEN／Fourier tempogram／tempogram-ratio ヘルパー、追加の時間／ピッチ加工コマンド（`time-stretch`、`pitch-shift`）、マスタリングのペア／ステレオ一覧、ミキシングシーンプリセット書き出しを提供します。

例は [CLI](./cli.md)、ランタイム差分は [バインディング対応表](./binding-parity.md) を参照してください。
