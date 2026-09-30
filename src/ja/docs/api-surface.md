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
| C ABI | `sonare_c.h` と `sonare_c_acoustic.h` などのモジュール別ヘッダー | [C++ API](./cpp-api-effects.md#c-api)、[バインディング対応表](./binding-parity.md) |

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
- **PFL / AFL** — pre-fader listen（フェーダー前）と after-fader listen（フェーダー後）。本線の出力を変えずに 1 トラックだけを試聴するためのキュータップです。
- **RIR** — room impulse response（部屋のインパルス応答）。詳細は[部屋の形状と容積](./glossary/acoustics/room-geometry.md)。
- **等価ルーム推定** — 音声から実用上の部屋モデルを推定する処理。詳細は[逆問題による部屋推定](./glossary/acoustics/inverse-estimation.md)。
- **ルームモーフィング** — 目標ルームの響きを音作り効果として適用する処理。
:::

| ファミリー | 対象 | 主なページ |
|------------|------|------------|
| 解析 | BPM、キー、キー候補、ビート、ダウンビート、オンセット、コード、セクション、メロディ、音色、ダイナミクス、リズム、音響解析 | [JavaScript API](./js-api-analysis.md)、[Python API](./python-api.md)、[C++ API](./cpp-api.md) |
| 拍子推定 | すでに手元にあるビート列に対して、拍子記号・ダウンビート位相・アクセントのグルーピングを採点します：`estimateMeter` / `estimate_meter` / `sonare_estimate_meter_json`。音声は受け取らず、どちらの CLI にも専用サブコマンドはありません | [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) |
| 特徴量 | STFT、メル、MFCC、クロマ、定Qクロマ（`chromaCqt`）、spectral contrast/poly features、zero crossings、ピッチとチューニング、CQT/VQT、NNLS クロマ、NMF 分解、近傍フィルタリング、テンポグラム、Fourier tempogram、cyclic tempogram、PLP、LUFS/LRA | [JavaScript API](./js-api-features.md#特徴抽出)、[librosa 互換性](./librosa-compatibility.md) |
| メータリング | レベル、ラウドネス、クレストファクター（モノラルとステレオペアの両方）、True Peak、DC オフセットのオフライン計測；クリッピング／ダイナミックレンジレポート；ステレオ相関・幅；ベクトルスコープ、フェーズスコープ、スペクトルスナップショット | [JavaScript API](./js-api-audio.md#メータリング)、[Python API](./python-api.md)、[ネイティブバインディング](./native-bindings.md) |
| スケール量子化 | MIDI ノートをスケールにスナップし、補正量をセミトーンで測定、ピッチクラスの所属を判定 | [JavaScript API](./js-api-analysis.md#スケール量子化)、[Python API](./python-api.md) |
| エフェクトと編集 | HPSS、残差付き HPSS、倍音成分／打撃成分の抽出、正規化、トリム、リミックス、フェーズボコーダー、タイムストレッチ、ピッチシフト、ピッチ補正、ノートストレッチ、ノート抽出とレンダリング、領域指定スペクトル編集、ボイスのピッチ／フォルマント変更、リアルタイム音声プリセット | [編集 DSP](./editing-dsp.md)、[音声内のノート編集](./note-editing.md)、[スペクトル編集](./spectral-editing.md)、[JavaScript API](./js-api-effects.md#オーディオエフェクト) |
| ステム分解 | ソフトマスクによる分離。各成分がソース自身の位相を保ち、足し合わせると入力に戻ります：`decomposeStems` / `decompose_stems` / `sonare_decompose_stems`。マルチチャンネルを連動させる `decomposeStemsLinked` / `decompose_stems_linked` / `sonare_decompose_stems_linked` と、両方の CLI の `decompose-stems` も使えます | [音源分離](./source-separation.md)、[逆変換特徴量](./inverse-features.md)、[連動ステム](./js-api-features.md#decomposestemslinked-request)、[Python API](./python-api.md) |
| リペア | 広帯域ノイズ、ハム、クリッピング、クリック、クラックル、拡散残響の検出器とオフラインリペア段 | [オーディオリペアの流れ](./audio-repair.md)、[広帯域ノイズとハムのリペア](./repair-noise.md)、[クリップ、クリック、クラックルのリペア](./repair-transients.md)、[拡散残響のリペア](./repair-reverb.md) |
| ゼロ交差に揃えたリミックス区間 | カット位置をゼロ交差に一度だけスナップして解決し、テイクの全チャンネルを同じフレームで切り出せるようにします：`remixAlignedIntervals` / `remix_aligned_intervals` / `sonare_remix_aligned_intervals`。API のみで、どちらの CLI にもありません | [JavaScript API](./js-api-analysis.md)、[Python API](./python-api.md) |
| ステレオ正規化 | 左右ペアのピークまたは RMS 正規化。JavaScript 側は `mode` を持つ `normalizeStereo` 1 つ、Python は `normalize_stereo` と `normalize_rms_stereo` の 2 関数です | [JavaScript API](./js-api-effects.md)、[Python API](./python-api.md) |
| ルーム音響解析 | インパルス応答からの残響時間（RT60 / EDT）、明瞭度（C50 / C80）、定義度（D50）、ブラインド音響推定、等価ルーム推定、幾何ベースの RIR 合成、ルームモーフィング | [ルーム音響解析](./acoustic-analysis.md)、[JavaScript API](./js-api-effects.md#ルーム音響解析)、[Python API](./python-api-effects.md#ルーム音響解析) |
| ミキシング | チャンネルストリップ、バス、センド、VCA グループ、シーンプリセット、オートメーション、ステレオ／デュアルパン、リアルタイムエンジンの 5.1/7.1 サラウンドパン、メーター、ゴニオメーター、オフラインレンダー | [ミキシングエンジン](./mixing.md)、[ミキシングシーン JSON](./mixing-scene-json.md) |
| ミキシングアシスタント | 複数トラックを計測し、判断ごとの理由を添えたミキサーシーンを返します。適用は一切行いません：`suggestMixScene` / `suggest_mix_scene` / `sonare_mixing_assistant_suggest_scene_json`、および両方の CLI の `suggest-mix` | [ミキシングアシスタント](./mixing-assistant.md) |
| マスタリングアシスタント | 音源プロファイル、チェーン提案 JSON、配信プラットフォーム別プレビュー JSON、およびダウンミックスではなく左右のペアを測定する 3 つのステレオ版 | [マスタリングアシスタント](./mastering-assistant.md) |
| マスタリング | プリセット、フルチェーン、名前付きプロセッサ、プロセッサカタログメタデータ、インサートパラメータメタデータ、ペアプロセッサ、ペア解析、ステレオ解析、ストリーミングチェーン、任意バンド数の構造化マルチバンドコンプレッサー（チェーン設定スキーマバージョン 2） | [マスタリングプロセッサ](./mastering-processors.md)、[DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[マスタリング実装](./mastering-implementation.md) |
| ストリーミング MIR | ライブのメル／クロマ／オンセットフレーム、時間とともに更新される BPM／キー／コード推定、コード進行、パターンスコア | [リアルタイムとストリーミング](./realtime-streaming.md)、[WASM](./wasm-streaming.md#ストリーミング解析) |
| リアルタイムエンジン | トランスポート、テンポ、構造化マーカー、メトロノーム、オートメーションレーン（`resolveInstrumentAutomationId` / `sonare_engine_resolve_instrument_automation_id` で解決するホスト側インストゥルメントのパラメータ対象を含む）、予約パラメータのメタデータを返す `parameterInfo` / `parameterInfoByIndex`、タイムストレッチのボイスプールを設定する `setWarpVoiceCapacity` / `warpVoiceCapacity`、グラフトポロジー、クリップページの先読み幅を設定できるクリップ（`setClipPagePrefetchFrames` / `clipPagePrefetchFrames`）、MIDI クリップスケジュール、トラックごとのレーンミキサー（レーン、バス、センド、チャンネルストリップ、サラウンドパン、インサートパラメータ）、外部 MIDI 出力／クロック、キャプチャ、トラックごとの PFL/AFL キューモニタリング、名前付きテレメトリエラー序数を伴うステレオ／ワイドメーターテレメトリ、スコープテレメトリと Worklet スコープリング、バウンス／フリーズ | [リアルタイムエンジン](./realtime-engine.md#パラメータオートメーション)、[ボイス予算](./realtime-engine.md#time-stretch-のボイス予算)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| プロジェクトとアレンジ | オーディオ／MIDI トラックとクリップ、メモリ上でのプロジェクト作成、上限付き履歴メモリを備えたアンドゥ/リドゥ、テイク／コンピング、ワープ（クリップのモードは `off`、`repitch`、`tempo-sync`、`time-stretch`）、MIDI シーケンス、SMF および MIDI 2.0 クリップファイル（`SMF2CLIP`）の入出力、JSON 保存／読込、アシストサイドカー、オフラインバウンス | [プロジェクト編集](./project-editing.md)、[音声から MIDI](./audio-to-notes.md)、[プロジェクトの MIDI](./project-editing-midi.md)、[プロジェクトの保存と読み込み](./project-save-load.md)、[プロジェクトバウンス](./project-bounce.md)、[録音・テイク](./recording-and-takes.md)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| インストゥルメントと MIDI | GM フォールバックバンクを備えたマルチエンジンシンセ、GS 互換 SoundFont 2 プレイヤー、ライブ MIDI 再生、ライブ SysEx で選択する GS インサーションエフェクト（EFX） | [内蔵シンセサイザー](./native-synth.md)、[SoundFont 2 プレイヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md#ライブイベントのキューイング)、[MIDI クリップ編集](./midi-editing.md)、[MIDI 2.0 と UMP](./midi2.md) |
| 逆変換特徴量 | メルから STFT／音声、MFCC からメル／音声、CQT/VQT 振幅から音声 | [逆変換特徴量](./inverse-features.md) |
| ユーティリティ / librosa 互換 | フレーム／サンプル／時間変換、dB 変換、pre/de-emphasis、無音 trim/split、frame/pad/fix、peak pick、vector normalize、PCEN、tonnetz、テスト信号生成（tone / chirp / clicks） | [librosa 互換性](./librosa-compatibility.md) |
| 構造とセグメンテーション | クロス類似度、再帰行列／ラグ行列、パス強調、サブセグメンテーション、凝集型クラスタリング、F0 トラックからのノートセグメンテーション | [JavaScript API](./js-api-helpers.md#librosa-互換ヘルパー)、[Python API](./python-api-analysis.md#特徴抽出) |
| ビルド機能の照会 | 機械可読な機能カタログ（プロセッサ、パラメータの範囲と既定値、プリセット一覧）とビルド診断レポート | [JavaScript API](./js-api.md#capabilitycatalog)、[Python API](./python-api.md#このビルドで何ができるか)、[CLI](./cli.md#doctor) |

この表が示すのは「何があるか」であり、「どのランタイムがどれだけ公開しているか」ではありません。ランタイムごとに各ドメインの機能をどれだけ呼び出せるかを実測した内訳は、[バインディング対応表](./binding-parity.md)を参照してください。

## 機能カタログが返すもの

各ビルドは、自身が備えるプロセッサとそのパラメータを機械可読な形で報告できます。Node と WASM の `capabilityCatalog()`、Python の `capability_catalog()`、C ABI の `sonare_capability_catalog_json` は同じ JSON 文書を返します。内容は、ビルドのバージョンと ABI 番号、パラメータとスロットメタデータを持つ全プロセッサ、組み込みプリセット名一覧、マスタリングプリセットのメタデータです。どちらの CLI にもこのカタログはなく、`doctor` が出すのは別物のビルド診断レポートです。

現行ビルドは **89 個のプロセッサと 5,352 個のパラメータ記述子** を公開します。どちらの数も鵜呑みにせず数え直せます。libsonare リポジトリは生成物を `tools/capability-catalog.json` として追跡しており、共有ライブラリが実際に返す内容とずれると `make capability-catalog-check` が失敗し、`schemas/capability-catalog.schema.json` が形を固定しています。

各パラメータ記述子は同じ 10 個のフィールドを持ちます。

| フィールド | 内容 |
|------------|------|
| `name` | 構築時に読まれるキー。`releaseMs` や `band0.frequencyHz` など |
| `id` | Mixer のインサートオートメーションと MIDI CC 紐付けに使う整数 id。構築時専用キーは `null` です。リアルタイムのインサート設定 API は `name` で対象を解決し、整数の id はオートメーション順に `0..n-1` です |
| `rtSafe` | オーディオスレッドから稼働中に値を変えられるか |
| `type` | 設定ビルダーが読む値の型。`number`、`boolean`、`enum`、`string`、`array` のいずれかです |
| `default` | 設定構造体のフィールドの初期化子。フォールバックがない場合は `null` です |
| `min`、`max` | 探索時に構築が受け入れた区間。その側の制限をカタログが知らなければ `null` |
| `unit` | `dB`、`Hz`、`ms`、`samples`、`referenceSamples@29761Hz`、またはキーに既知の単位がない場合の `null`。`null` でも無次元とは限りません |
| `choices` | 名前付き数値選択肢の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null` です |
| `slot` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` です |

`id` が整数の項目はオートメーション対象で、構築時専用の項目は `id: null` かつ `rtSafe: false` です。`id` があっても `rtSafe: false` ならライブオートメーションへ渡せません。`choices` は名前付き数値の閉じた集合を示し、間隔のある離散値も含みます。`slot` はキーが属するスロット群を示し、`null` はどのスロットにも属さないことを示します。`slot` が非 null でも必ず条件付きとは限りません。各プロセッサの `slots` 配列にある `activation`（`anyKey` または `always`）、親スロットを示す `parent`、存在条件となる `minCrossoverCutoffs` を組み合わせて、スロットの有無を判断します。

既定値は書き写したものではなくコードから読み取りますが、構築用キーにフォールバックがなければ `null` になります。範囲は実測です。候補値を呼び出し側と同じ構築経路に通し、そのプロセッサの他のパラメータは既定値のまま、検証が受け入れた区間をカタログが報告します。`null` の境界が意味するのは、その側ではどんな値も通る、または構築がそのキーを検証していない、のどちらかです。制限があるのに測っていない、という意味ではありません。スライダーを直結する前に押さえておきたい性質が 2 つあります。互いに制約し合う制御は相手の既定値を境界として報告すること、そして開区間の境界は除外される値そのものとして報告されることです。具体例は [JavaScript API](./js-api.md#capabilitycatalog) が順に追っています。

`presets.mastering` は従来どおりマスタリングプリセット名の簡潔な配列です。トップレベルの `masteringPresets` は各名前について `kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を持つオブジェクトを返します。レストレーション用の項目では、後ろ 3 つの数値が `null` です。選択したプリセットを展開した数値／真偽値のパラメータマップが必要なときは、バインディングの `masteringPresetParams` を使います。

この記述子が役に立つ場面は 2 つあります。

- **手書きの表を持たないコントロールサーフェス。** 各パラメータを `type`、`default`、`min`、`max`、`unit` から組み立てれば、新しいプロセッサや番号の振り直された帯域は、誰かが表を直したときではなくビルドが変わったときに UI へ現れます。
- **境界を越える前の値チェック。** 公開された範囲の外の数値は構築時に拒否されます。先にカタログと突き合わせておけば、その実行時エラーは、ユーザーが値を入力した場所での検証メッセージに変わります。

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max);
}
```

カタログが外側から示すのは、どのプロセッサがあり、それぞれが何を受け付けるか、です。なぜ同じ id のプロセッサをどのランタイムからも呼べるのか、それらの既定値を決めている設定ビルダーが、呼び出し元のバインディングから見てどの層にあるのかは、カタログからは分かりません。それを整理しているのが[アーキテクチャ](./architecture.md)です。C++ コア、その上の機能モジュール、言語ごとの形を同じ呼び出しに翻訳する薄いバインディング、という層構成を示しており、カタログを見て構造が気になった読者に向けたページです。

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

CLI は 2 種類あります。Python CLI は一般的な利用者向けコマンド（解析、特徴量サマリー、ファイルを書き出す編集、音響／ルーム処理、基本的なマスタリング／ミキシング）を扱います。ソースビルドの C++ CLI は、さらに低レベルなコマンド群（セクション／メロディユーティリティ、追加の特徴量ヘルパー、マスタリングのペア／ステレオ一覧やミキシングシーン書き出し）を加えます。最新の完全なコマンド一覧と例は [CLI](./cli.md) にあります。ランタイム差分は [バインディング対応表](./binding-parity.md) を参照してください。
