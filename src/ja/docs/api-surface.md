# 機能マップ

このページは libsonare の最上位マップです。やりたいことは決まっているが、どのランタイム、API ページ、実装解説を読むべきか迷うときの入口として使います。

初めて libsonare を使う場合は、先に [学習順ガイド](./learning-path.md) を読んでください。このページは全体像を確認するための地図なので、最初のチュートリアルより広い範囲を扱います。

## このページで身につくこと

このページを読むと、次のことを判断・確認できるようになります。

- すべての API リファレンスを眺めずに、必要な機能ファミリーを見つけられる。
- ブラウザ、Python、Node ネイティブ、CLI、C++、C ABI のどの実行環境ページへ進むべきか選べる。
- ある話題が目的別ガイド、API リファレンス、実装／根拠ページのどこに属するかを判断できる。
- 公開 API を検証する必要があるとき、ここに挙げたソースファイルを最終根拠として使える。

## このページの読み方

このページは「全部を覚える」ための一覧ではありません。まず自分の目的を 1 つ選び、その行からリンク先へ進むための索引として使ってください。

迷ったら、次の順で考えると選びやすくなります。

1. **何をしたいか**を決める。例: BPM を出したい、ブラウザで音声を可視化したい、マスタリングを書き出したい。
2. **どこで動かすか**を決める。例: ブラウザ、Python スクリプト、C++ アプリ、CLI。
3. 下の表で、目的に近い「機能ファミリー」と実行環境の入口を選ぶ。

「特徴量」「MIR」「DSP」などの言葉が分からなくても問題ありません。

- **特徴量** は、音声そのものではなく、音声から取り出した数値の要約です。
- **MIR** は Music Information Retrieval の略で、BPM、キー、コード、ビートなど、音楽から情報を読み取る処理全般を指します。
- **DSP** は Digital Signal Processing の略で、音声を測ったり変形したりする信号処理のことです。

::: info ランタイム・API・バインディングの違い
**ランタイム**は「どこで動くか」（ブラウザ、Python、CLI、C++）です。**API** は呼び出す関数やクラスの形です。**バインディング**は同じ C++ コアを別言語から呼ぶための橋渡しです。迷ったら、先にランタイムを 1 つ選び、そのランタイムの API ページだけを読んでください。
:::

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
| C ABI | `sonare_c.h` と `sonare_c_acoustic.h` などのモジュール別ヘッダー | [C++ API](./cpp-api.md#c-api)、[バインディング対応表](./binding-parity.md) |

## 機能ファミリー

機能ファミリーは「何をする機能か」で大きく分けたものです。API 名を知らない段階では、ここから探すのが一番早いです。

::: details 機能表に出る略語
各項目は一行の要約です。詳しい説明はリンク先の用語集ページを参照してください。

- **STFT** — スペクトログラムの元になる短時間フーリエ変換。詳細は[スペクトログラムと STFT](./glossary/analysis/spectrogram-stft.md)。
- **MFCC** — 音色を小さな特徴量に圧縮したもの。詳細は[メル・MFCC・音色](./glossary/analysis/mel-mfcc-timbre.md)。
- **CQT / VQT** — 音楽のピッチ間隔に合わせた周波数変換。詳細は[クロマ特徴量](./glossary/analysis/chroma-features.md)。
- **NNLS / NMF** — 音の成分を非負の部品へ分解する行列分解系の手法。詳細は[クロマ特徴量](./glossary/analysis/chroma-features.md)。
- **PLP** — リズムの主な脈動を推定する特徴量。
- **LUFS / LRA** — ラウドネスとラウドネスレンジの指標。詳細は[LUFS](./glossary/lufs.md)。
- **VCA** — 複数ストリップの音量をまとめて動かすグループ制御。詳細は[バスとセンド](./glossary/mixing/buses-sends.md)。
- **RIR** — room impulse response（部屋のインパルス応答）。詳細は[部屋の形状と容積](./glossary/acoustics/room-geometry.md)。
- **等価ルーム推定** — 音声から実用上の部屋モデルを推定する処理。詳細は[逆問題による部屋推定](./glossary/acoustics/inverse-estimation.md)。
- **ルームモーフィング** — 目標ルームの響きを音作り効果として適用する処理。
:::

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| 解析 | BPM、キー、キー候補、ビート、ダウンビート、オンセット、コード、セクション、メロディ、音色、ダイナミクス、リズム、音響解析 | [JavaScript API](./js-api.md)、[Python API](./python-api.md)、[C++ API](./cpp-api.md) |
| 特徴量 | STFT、メル、MFCC、クロマ、定Qクロマ（`chromaCqt`）、spectral contrast/poly features、zero crossings、ピッチとチューニング、CQT/VQT、NNLS クロマ、NMF 分解、近傍フィルタ、テンポグラム、Fourier tempogram、cyclic tempogram、PLP、LUFS/LRA | [JavaScript API](./js-api.md#特徴抽出)、[librosa 互換性](./librosa-compatibility.md) |
| メータリング | レベル、ラウドネス、クレストファクター、トゥルーピーク、DC オフセットのオフライン計測；クリッピング／ダイナミックレンジレポート；ステレオ相関・幅；ベクトルスコープ、フェーズスコープ、スペクトルスナップショット | [JavaScript API](./js-api.md#メータリング)、[Python API](./python-api.md)、[ネイティブバインディング](./native-bindings.md) |
| スケール量子化 | MIDI ノートをスケールにスナップし、補正量をセミトーンで測定、ピッチクラスの所属を判定 | [JavaScript API](./js-api.md#スケール量子化)、[Python API](./python-api.md) |
| エフェクトと編集 | HPSS、残差付き HPSS、倍音成分／打撃成分の抽出、正規化、トリム、リミックス、フェーズボコーダー、タイムストレッチ、ピッチシフト、ピッチ補正、ノートストレッチ、領域指定スペクトル編集、ボイスのピッチ／フォルマント変更、リアルタイム音声プリセット | [編集 DSP](./editing-dsp.md)、[スペクトル編集](./spectral-editing.md)、[JavaScript API](./js-api.md#オーディオエフェクト) |
| ルーム音響解析 | IR 解析、ブラインド音響推定、等価ルーム推定、RIR 合成、ルームモーフィング | [ルーム音響解析](./acoustic-analysis.md)、[JavaScript API](./js-api.md#ルーム音響解析)、[Python API](./python-api.md#ルーム音響解析) |
| ミキシング | チャンネルストリップ、バス、センド、VCA グループ、シーンプリセット、オートメーション、ステレオ／デュアルパン、リアルタイムエンジンの 5.1/7.1 サラウンドパン、メーター、ゴニオメーター、オフラインレンダー | [ミキシングエンジン](./mixing.md)、[ミキシングシーン JSON](./mixing-scene-json.md) |
| マスタリングアシスタント | 音源プロファイル、チェーン提案 JSON、配信プラットフォーム別プレビュー JSON | [マスタリングアシスタント](./mastering-assistant.md) |
| マスタリング | プリセット、フルチェーン、名前付きプロセッサ、プロセッサカタログメタデータ、インサートパラメータメタデータ、ペア解析、ステレオ解析、ストリーミングチェーン | [マスタリングプロセッサ](./mastering-processors.md)、[DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[マスタリング実装](./mastering-implementation.md) |
| ストリーミング MIR | ライブのメル／クロマ／オンセットフレーム、時間とともに更新される BPM／キー／コード推定、コード進行、パターンスコア | [リアルタイムとストリーミング](./realtime-streaming.md)、[WASM](./wasm.md#ストリーミング解析) |
| リアルタイムエンジン | トランスポート、テンポ、構造化マーカー、メトロノーム、オートメーションレーン、グラフトポロジー、クリップ、MIDI クリップスケジュール、トラックごとのレーンミキサー（レーン、バス、センド、チャンネルストリップ、サラウンドパン、インサートパラメータ）、外部 MIDI 出力／クロック、キャプチャ、モニターバス、ステレオ／ワイドメーターテレメトリ、スコープテレメトリと Worklet スコープリング、バウンス／フリーズ | [リアルタイムとストリーミング](./realtime-streaming.md) |
| プロジェクトとアレンジ | オーディオ／MIDI トラックとクリップ、アンドゥ/リドゥ、テイク／コンピング、ワープ、MIDI シーケンス、SMF および MIDI 2.0 クリップファイル（`SMF2CLIP`）の入出力、JSON 保存／読込、オフラインバウンス | [プロジェクト編集](./project-editing.md)、[プロジェクトバウンス](./project-bounce.md)、[録音・テイク](./recording-and-takes.md)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| インストゥルメントと MIDI | GM フォールバックバンクを備えたマルチエンジンシンセ、GS 互換 SoundFont 2 プレイヤー、ライブ MIDI 再生、ライブ SysEx で選択する GS インサーションエフェクト（EFX） | [組み込み楽器](./native-synth.md)、[SoundFont 2 プレイヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md#ライブイベントのキューイング) |
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

メインの `@libraz/libsonare` TypeScript パッケージのエクスポートは、いくつかの系統に分かれます。初期化と ABI 確認、`engineCapabilities` による互換性確認、音声処理の関数群（高レベル解析、エフェクト／編集、マスタリング、ミキシング、特徴量抽出、逆変換特徴量、変換ヘルパー）、そして状態を持つオブジェクト API（`Audio`、`StreamAnalyzer`、`Mixer`、`RealtimeEngine`、およびストリーミング／ボイスチェンジャー系のクラス）です。最新の完全なエクスポート一覧は [JavaScript API](./js-api.md) に反映されており、その根拠は libsonare リポジトリの `bindings/wasm/src/index.ts` です。エクスポート名を厳密に確認したい場合は、この TypeScript 側の入口を最も具体的な参照として扱ってください。

::: tip ABI バージョン関数の用途
`abiVersion`、`engineAbiVersion`、`projectAbiVersion`、`voiceChangerAbiVersion` は、各サブシステムがビルド時に対象とした ABI（バイナリインターフェース）のバージョンを返します。自分のコードが想定するバージョンと突き合わせることで、オブジェクトを使い始める前に、不一致や古い WASM ビルドを検出できます。
:::

同じ npm パッケージは、AudioWorklet ブリッジ用の `@libraz/libsonare/worklet` と、バンドラーや独自ローダー向けの生 WASM アセット用サブパス `@libraz/libsonare/wasm` も公開します。

## CLI コマンド系統

CLI は、プログラムを書かずにファイルを指定して解析・変換したいときの入口です。自動処理や検証には便利ですが、リアルタイム UI や細かい対話的制御には JavaScript / Python / C++ API の方が向いています。

CLI は 2 種類あります。Python CLI は一般的な利用者向けコマンド（解析、特徴量サマリー、ファイルを書き出す編集、音響／ルーム処理、基本的なマスタリング／ミキシング）を扱い、ソースビルドの C++ CLI はさらに低レベルなコマンド群（セクション／メロディユーティリティ、追加の特徴量ヘルパー、マスタリングのペア／ステレオ一覧やミキシングシーン書き出し）を加えます。最新の完全なコマンド一覧と例は [CLI](./cli.md) にあります。ランタイム差分は [バインディング対応表](./binding-parity.md) を参照してください。
