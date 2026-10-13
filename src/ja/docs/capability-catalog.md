# 機能カタログ

このページでは、ビルドが自分のプロセッサについて返す JSON ドキュメントを扱います。どのサーフェスが返すか、パラメータ記述子に何が入っているか、ホストがそれを使って何を組み立てられるかを説明します。ほかの API ファミリーとの位置関係は [機能マップ](./api-surface.md) を参照してください。

各ビルドは、自身が備えるプロセッサとそのパラメータを機械可読な形で報告できます。Node と WASM の `capabilityCatalog()`、Python の `capability_catalog()`、C ABI の `sonare_capability_catalog_json` は同じ JSON 文書を返します。内容は、ビルドのバージョンと ABI 番号、パラメータとスロットメタデータを持つ全プロセッサ、組み込みプリセット名一覧、マスタリングプリセットのメタデータです。どちらの CLI にもこのカタログはなく、`doctor` が出すのは別物のビルド診断レポートです。

現行ビルドは **95 個のプロセッサと 5,579 個のパラメータ記述子** を公開します。うち 84 個のプロセッサはリアルタイムインサート可能で、どのプロセッサも `category` を報告します。これらの数も鵜呑みにせず数え直せます。libsonare リポジトリは生成物を `tools/capability-catalog.json` として追跡しており、共有ライブラリが実際に返す内容とずれると `make capability-catalog-check` が失敗し、`schemas/capability-catalog.schema.json` が形を固定しています。

## パラメータ記述子のフィールド

各パラメータ記述子は同じ 18 個のフィールドを持ちます。

| フィールド | 内容 |
|------------|------|
| `name` | 構築時に読まれるキー。`releaseMs` や `band0.frequencyHz` など |
| `id` | Mixer のインサートオートメーションと MIDI CC 紐付けに使う整数 id。構築時専用キーは `null` です。リアルタイムのインサート設定 API は `name` で対象を解決し、整数の id はオートメーション順に `0..n-1` です |
| `rtSafe` | オーディオスレッドから稼働中に値を変えられるか |
| `type` | 設定ビルダーが読む値の型。`number`、`boolean`、`enum`、`string`、`array` のいずれかです |
| `default` | 設定構造体のフィールドの初期化子。フォールバックがない場合は `null` です |
| `min`、`max` | 探索時に構築が受け入れた区間。その側の制限をカタログが知らなければ `null` |
| `minExclusive`、`maxExclusive` | その境界の値自体が拒否されるか。その側が `null` のときは `false` |
| `maxRelativeTo` | 実効上限が `max` とホストのナイキストの低いほうになるとき `'nyquist'`、それ以外は `null` |
| `unit` | プロセッサがキーに宣言する単位。閉じた集合 `dB`、`dBFS`、`LUFS`、`Hz`、`ms`、`s`、`samples`、`m`、`cm`、`deg`、`percent`、`degC`、`V`、`inPerSec`、`dBPerOct`、`semitones`、`cents`、`ratio`、`bits`、`count`、`none` のいずれか。boolean、enum、string、array のキーには単位がなく `null` です |
| `uiMin`、`uiMax` | コントロールが描画すべき範囲（`min` / `max` の内側）。受け入れ範囲がそのまま表示範囲なら `null` |
| `scale` | コントロールが値を描く軸。`linear` または `log` |
| `choices` | 名前付き数値選択肢の閉じた集合。間隔のある離散値も含み、閉じた集合を公開しない場合は `null` です |
| `slot` | キーが属するプロセッサのスロット群。どの群にも属さないキーは `null` です |
| `dependsOn` | 自分の値を（ライブの値で）制約する兄弟キー。`{ key, relation, factor }` の配列で、`relation` は `lt`、`le`、`gt`、`ge` のいずれかを `this <relation> factor * sibling` として読みます（単純な大小関係では `factor` は 1）。独立したキーでは空です |
| `coupledWith` | `dependsOn` のほかに、単一の関係では表せない形でこのキーの受け入れ範囲を動かす兄弟キー（`effects.reverb.room` の `receiverSpacingM` なら `lengthM`、`widthM`、`listenerX`、`listenerY`、`sourceX`、`sourceY`）。独立したキーでは空です。`min` / `max` はこれらの兄弟を既定値にして測った値です |

各プロセッサ項目は `causal` も持ちます。`causal` は、リアルタイムインサート可能なプロセッサすべてと、因果的な 4 つのリペア段（`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical`）で `true` です。`repair.declick`、`repair.declip`、`repair.trimSilence` は、あるサンプルの出力がそれ以前の入力だけで決まる構成を持たないため `false` で、インサートではないオフライン専用プロセッサ（`final.*`、`match.*`、`maximizer.loudnessOptimize`）も `false` です。各項目は `category` も持ち、値は `dynamics`、`effects`、`eq`、`final`、`reference`（`match.*` プロセッサ）、`maximizer`、`multiband`、`repair`、`saturation`、`spectral`、`stereo`、`utility`、`voice` のいずれかです。

`id` が整数の項目はオートメーション対象で、構築時専用の項目は `id: null` かつ `rtSafe: false` です。`id` があっても `rtSafe: false` ならライブオートメーションへ渡せません。`choices` は名前付き数値の閉じた集合を示し、間隔のある離散値も含みます。`slot` はキーが属するスロット群を示し、`null` はどのスロットにも属さないことを示します。`slot` が非 null でも必ず条件付きとは限りません。各プロセッサの `slots` 配列にある `activation`（`anyKey` または `always`）、親スロットを示す `parent`、存在条件となる `minCrossoverCutoffs` を組み合わせて、スロットの有無を判断します。

既定値は書き写したものではなくコードから読み取りますが、構築用キーにフォールバックがなければ `null` になります。`uiMin` / `uiMax`、`dependsOn`、`coupledWith` はコントロールの描き方と順序の手がかりで、受け入れ範囲はあくまで `min` / `max` です。範囲は実測です。候補値を呼び出し側と同じ構築経路に通し、そのプロセッサの他のパラメータは既定値のまま、検証が受け入れた区間をカタログが報告します。`null` の境界が意味するのは、その側ではどんな値も通る、または構築がそのキーを検証していない、のどちらかです。制限があるのに測っていない、という意味ではありません。スライダーを直結する前に押さえておきたい性質が 2 つあります。互いに制約し合う制御は相手の既定値を境界として報告すること、そして開区間の境界は除外される値そのものとして報告されることです。具体例は [JavaScript API](./js-api.md#capabilitycatalog) が順に追い、各フィールドは[インサートエフェクト](./effects-inserts.md#パラメータ記述子)にまとまっています。

## チェーンとプリセットの項目

トップレベルの `chain` セクションは、マスタリングチェーン設定のフラットなキーを記述します。`stages` は各ステージのキー接頭辞、そのキーがパラメータとなるプロセッサ（なければ `null`）、`enabled` キーを列挙し、`lists` はインデックス付きリスト（マルチバンドステージの `cutoffsHz` と `bands`）を項目数つきで挙げ、`params` はどのプロセッサにも属さないキー（`enabled` スイッチ、`loudness.*`、`repair.denoise.gainFloor`、クロスオーバー FIR カーネルサイズとカットオフリスト）の記述子をチェーン自身の検証器で測って収め、`aliases` はキーの別名表記すべてを返します。Node、WASM、Python では `CapabilityCatalogChain` として宣言されています。`presets` には `playbackRoom` も含まれ、常に存在し、再生機能がビルドから除かれている場合は空になります。

`presets.mastering` はマスタリングプリセット名の簡潔な配列です。トップレベルの `masteringPresets` は各名前について `kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を持つオブジェクトを返します。レストレーション用の項目では、後ろ 3 つの数値が `null` です。選択したプリセットを展開した数値／真偽値のパラメータマップが必要なときは、バインディングの `masteringPresetParams` を使います。

## 何に使えるか

この記述子が役に立つ場面は 2 つあります。

- **手書きの表を持たないコントロールサーフェス。** 各パラメータを `type`、`default`、`min`、`max`、`uiMin`、`uiMax`、`scale`、`unit` から組み立てれば、新しいプロセッサや番号の振り直された帯域は、誰かが表を直したときではなくビルドが変わったときに UI へ現れます。
- **境界を越える前の値チェック。** 公開された範囲の外の数値は構築時に拒否されます。先にカタログと突き合わせておけば、その実行時エラーは、ユーザーが値を入力した場所での検証メッセージに変わります。

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max); // max is null: no upper bound is published
}
```

カタログが外側から示すのは、どのプロセッサがあり、それぞれが何を受け付けるか、です。同じ id のプロセッサがどのランタイムにもある理由は、[アーキテクチャ](./architecture.md)の層構成にあります。
