---
title: 内蔵シンセサイザー (NativeSynth)
description: libsonare のデータ不要なパッチ駆動シンセ NativeSynth を解説。17 種類の音作りエンジン、SynthPatch オブジェクト、名前付きプリセットカタログ、GM フォールバックバンク、オフライン／ライブでの鳴らし方を、そのまま使えるレシピつきで紹介します。
---

# 内蔵シンセサイザー (NativeSynth)

**NativeSynth は MIDI を単体で音にします。** ダウンロードするサンプルも、同梱する SoundFont も要りません。libsonare に組み込まれているので、MIDI トラックは何もしなくても最初から音が鳴ります。

最初に押さえることは 3 つだけです。

1. `acoustic-piano`、`warm-pad`、`drum-kit` のような名前付きプリセットを選ぶ。
2. そのプリセットを使うデスティネーションへ MIDI ノートを送る。
3. 必要なら `cutoffHz`、`ampAttackMs`、`stereoSpread` など、聞いて分かりやすい項目だけを上書きする。

内部的には、NativeSynth は **17 個の差し替え可能な音作りエンジン**を備えた 1 台のシンセです。それぞれ、元になる音の作り方が異なります。各エンジンが何に向くかは[一覧表](#_17-個の音作りエンジン)にまとめています。

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: '較正の状況',
    body: '参照録音に合わせて較正済みなのは、アコースティックピアノだけです。ハープシコード、モーダル、膜鳴を含むそのほかの物理モデルは暫定で、データ不要のプレビューとフォールバックの土台として使うものです。音はパッチリリースごとに変わることがあります。'
  }"
/>

17 個すべてが、モジュレーション、エンベロープ、フィルター、ステレオ幅、ポリフォニーを扱う共通の制御層を通るため、違う音色でも同じパッチ項目で調整できます。音を出すには、プリセットを名前で選ぶか、プリセットを出発点に `SynthPatch` で必要な項目だけを上書きします。鳴らし始めるのにエンジン内部へ触れる必要はありません。

::: info 音作りの用語
エンジン名を知らなくても、プリセットを選んで鳴らせば始められます。各方式の 1 行説明は[シンセの音作りの基礎](./glossary/instruments/synthesis-basics.md#_17-種類の音作り方式)にあります。パッチ操作でよく出てくる用語が 2 つあります。**ADSR エンベロープ**（attack／decay／sustain／release。音量などが、ノートの間にどう立ち上がり減衰するか）と、**モッドマトリクス**（LFO やエンベロープなどの変化の元を、ピッチやフィルターカットオフなどの送り先へつなぐ表）です。
:::

::: info MIDI は決して無音にならない
NativeSynth は [SoundFont プレイヤー](./soundfont-player.md)の**データ不要な土台**でもあります。SF2 経由でプロジェクトをバウンスしたとき、あるプログラム（または SoundFont 全体）が欠けていると、その音は NativeSynth の **GM フォールバックバンク**へ落ちます。128 種すべての General MIDI プログラムとドラムマップを備えているため、いずれにせよ音は出ます。バンクそのもの（GS バリエーション音色、ドラムキットバリエーション、GM プログラム追従）は専用ページ [GM／GS フォールバックバンク](./gm-gs.md) で解説し、全 128 プログラムの音色は [GM 音色マップ](./gm-tone-map.md) にまとめています。
:::

::: tip NativeSynth の位置づけ
NativeSynth パッチは**インストゥルメント**です。MIDI デスティネーションへバインドすると、そのデスティネーションへルーティングされたトラックの MIDI が内蔵シンセサイザーで鳴ります。オフラインでは [`bounceWithSynthInstrument`](./project-bounce.md) でバインドし、ライブでは `engine.setSynthInstrument` でバインドして [MIDI 入力](./midi-input.md)を送ります。サンプルベースのマルチサンプル音色が必要なら、代わりに [SoundFont プレイヤー](./soundfont-player.md) を使ってください。
:::

どのノートにも、NativeSynth の中を 1 本のシグナルパスが流れます。MIDI ノートが 17 個のうち 1 つのエンジンを選び、そのエンジンがチェーン先頭のオシレーターの位置に入ります。その後ろのフィルター、アンプエンベロープ、ボディ共鳴は全エンジン共通で、モッドマトリクスは送り先に指定した段へ直接作用します。図は、先頭のブロックに減算合成のオシレーターを置いた 1 つのボイスです。

エンジンがオシレーターの位置に入るので、`waveform` が効くのは subtractive エンジンだけです。ほかのエンジンは、どの値にしても同じ音を出します。共通の段から外れる唯一の例外は percussion エンジンです。キットの各ピースを自分で鳴らしており、パッチのフィールドのうち出力を変えるのは `gain`・`busDrive`・`polyphony` だけです。

<SynthSignalPathFigure
  title="1 つのボイスと、モッドマトリクスが届く先"
  :labels="{ osc: 'オシレーター', oscSub1: '波形を 1 つ選ぶ:', oscSub2: 'sine saw square', oscSub3: 'triangle noise', oscSub4: 'unison 1–7 · detune', filter: 'フィルター', filterSub1: '4 モデルから 1 つ:', filterSub2: 'svf · sallen-key', filterSub3: 'transistor-ladder', filterSub4: 'diode-ladder', amp: 'アンプ', ampSub1: 'ADSR エンベロープ', body: 'ボディ共鳴', bodySub1: 'guitar violin', bodySub2: 'wood-tube brass-bell', bodySub3: 'vocal · none', bodySub4: 'bodyMix 0–1', out: '出力', matrix: 'モッドマトリクス', matrixSub: '12 のソース × 12 の送り先・同時に有効なルーティングは最大 8 本', sources: 'ソース', noDest: '送り先ではない', loopNote: 'ソースへ戻る', legendChain: 'ボイスチェーン', legendBody: 'アンプ後段のボディ共鳴', legendRoute: 'モッドルーティング（同時に最大 8 本）' }"
/>

::: tip まず鳴らしてみる
[シンセプレイグラウンド](/ja/synth) では、このシンセサイザーをブラウザで動かせます。キーボード、プリセットカタログ全体、パッチのライブ編集が揃っています。使っているのはインストゥルメントだけで、解析もマスタリングも動いていません。[ステップベース](/ja/step-bass) のほうは、減算合成エンジンを 1 台の楽器として鳴らします。ダイオードラダーを積んだ 16 ステップのモノフォニック・ベースマシンで、アクセントとスライドをステップごとに打ち込み、鳴っている音の上でカットオフを動かせます。ADSR エンベロープ、フィルター、GS エフェクトといった個別の挙動は [インストゥルメントのデモ](/ja/demos) が扱います。
:::

## 17 個の音作りエンジン

各プリセットは 1 つの `engineMode` を選びます。共通部分（フィルター、エンベロープ、LFO、モッドマトリクス、ボディ共鳴、ポリフォニー）は、選択中のどのエンジンの上にも適用されます。各エンジン固有のモデルフィールドは名前付きプリセットに付属しており、パッチからは [`engineParams`](#エンジンパラメータ) で 1 つずつ上書きできます。

| エンジン | 種類 | 向いている用途 | `engineParams` のキー数（ゲート付き） |
|----------|------|----------------|--------------------------------------|
| `subtractive` | 信号ベース | リード・ベース・パッド・プラック | 0 |
| `fm` | 信号ベース | エレクトリックピアノ・ベル・マレット | 49 |
| `additive` | 信号ベース | ドローバーオルガン | 24（2） |
| `karplus-strong` | 物理モデル・暫定 | ギター・ベース・ハープ | 23 |
| `modal` | 物理モデル・暫定 | グロッケン・ビブラフォン・マリンバ | 30 |
| `percussion` | 物理モデル・暫定 | GM ドラムキット | 93（92） |
| `piano` | 物理モデル・較正済み | アコースティックピアノ | 14 |
| `pipe-organ` | 物理モデル・暫定 | 教会オルガンのランク | 63（52） |
| `bowed-string` | 物理モデル・暫定 | ヴァイオリン属 | 17（3） |
| `reed` | 物理モデル・暫定 | クラリネット・サックス・オーボエ・ファゴット | 21（4） |
| `brass` | 物理モデル・暫定 | トランペット・トロンボーン・ホルン・チューバ | 21（1） |
| `flute` | 物理モデル・暫定 | フルート・笛・オカリナ | 18 |
| `plucked-string` | 物理モデル・暫定 | 箏・シタール・タンプーラ | 8 |
| `vocal` | 物理モデル・暫定 | 合唱・ソロの声 | 7 |
| `free-reed` | 物理モデル・暫定 | アコーディオン・ハーモニカ・バンドネオン | 12（3） |
| `harpsichord` | 物理モデル・暫定 | ハープシコード | 29（5） |
| `sample` | ホストの PCM | 自前の録音 | 0 |

キー数は `synthEngineParamInfo(engineMode)` が返す件数で、括弧内はそのうち [`activeWhen`](#ゲートされるフィールド-activewhen) のゲートを持つキーの数です。以下の各節では、エンジンごとに固有の点だけを説明します。

::: info モードだけを指定すると、そのエンジンの基本プリセットが鳴る
`engineMode` だけを指定したパッチは、選んだエンジンを使う名前付き `preset` があればそのエンジンセクションを、なければエンジンの基本プリセットのセクションを使います。`fm` は e-piano、`modal` はベル、`percussion` は GM ドラムキット、というように決まります。`sample` 以外のエンジンはどれもモード指定だけで鳴ります。`sample` は `SampleBank` をバインドするまで鳴らす対象がなく、バンクなしでは無音のままです。生のエンジン出力のレベルはそろっていません。名前付きプリセットには固有の `gain` があり、API で組み立てたパッチには指定した `gain` だけが適用されます。モードだけの比較や自作パッチでは、明示的にゲインを設定して試聴してください。
:::

### `subtractive`（バーチャルアナログ）

オシレーター → フィルター → アンプという古典的なボイスです。デチューンユニゾン、ドリフト、フィルター前段のドライブ、4 種のフィルターモデルにより、太いソウリードから広がりのあるパッドまで作れます。**リード・ベース・パッド・プラック**、つまりアナログシンセで作りたいものに向きます。プリセット: `sine`、`saw`、`square`、`triangle`、`saw-lead`、`square-lead`、`sub-bass`、`warm-pad`。

<SonareDemo id="synth-note" />

「キャラクター」の核はフィルターモデルです。`filterModel` で 4 種の古典モデルを選べます。*ポール*はフィルターの 1 次の段 1 つ分で、1 つ増えるごとに、カットオフより上で応答が下がる傾きが 1 オクターブあたり 6 dB 急になります。4 ポールのフィルターは 2 ポールより、ずっと急に音を暗くします。

| モデル | 回路トポロジー | ポール数（ローパスの傾き） | 備考 |
|--------|----------------|----------------------------|------|
| `svf` | TPT ステートバリアブル | 2（12 dB/オクターブ） | クリーン。`filterOutput`（lowpass / bandpass / highpass）を選べる唯一のモデル |
| `transistor-ladder` | 4 ポールトランジスタラダー | 4（24 dB/オクターブ） | ゼロディレイフィードバック、飽和ループ、自己発振する |
| `diode-ladder` | ダイオードラダー | 結合した 4 段（カットオフより十分上で 24 dB/オクターブ） | 結合段 ZDF、自己発振する |
| `sallen-key` | ザレンキー | 2（12 dB/オクターブ） | 自己発振する |

4 種とも、サンプル単位のカットオフ／レゾナンス変調下でも安定しジッパーノイズがなく、自己発振も決定論的です。

<SonareDemo id="synth-filter" />

### `fm`（周波数変調）

小さなアルゴリズムテーブルを持つ位相変調オペレータスタック（1 つのオシレーターの出力をもう 1 つの位相に加える → 金属的・鐘的な音色）で、指数エンベロープ、フィードバックオペレータ、ベロシティ → インデックス（明るさ）スケーリングを備えます。**エレクトリックピアノ・ベル・マレット・クラビ系の鍵盤音・ブラス**、つまり減算合成が苦手な金属的・鐘的・非整数次倍音の音に向きます。`engineMode: 'fm'` だけを指定すると、`e-piano` のエンジンセクションを使います。共通段の設定も含めて使うには、名前付きプリセットを選んでください。

### `karplus-strong`（撥弦）

位相が正確にチューニングされた分数遅延導波路ループ（撥弦をモデル化する短い遅延ループ）に、ピック位置コム、ベロシティ駆動の明るさ、ディケイストレッチ、ノートオフ時のループダンピング（フィンガー／パームミュート）を加えたものです。ギター、ハープ、ベース系プリセットでは、物理的な細部として、ピックアップ位置、ボディ結合、スチール弦の分散、開放弦の共鳴、弦の張りによるベンド、2 方向の振動による減衰差も使います。**撥弦・ストローク弦**、すなわちギター・ベース・ハープ・撥弦系民族楽器に向きます（ハープシコードは「明るいギター」ではなく、専用エンジンを持ちます。後述）。プリセット: `classical-guitar`、`steel-guitar`、`electric-guitar`、`harp`、`bass-acoustic`、`bass-fingered`、`bass-picked`、`bass-fretless`、`bass-slap`。

### `modal`（マレット打楽器）

物理的なモード比（一様バーのグロッケン、深いアーチのマリンバ／ビブラフォン）に合わせたモーダル共鳴バンク（叩いたバーや鐘をモデル化する、チューニングされた共鳴器のバンク）で、マレット硬さのベロシティ重みづけとモードごとのディケイを持ちます。**音程のあるマレット楽器**、グロッケン・ビブラフォン・マリンバ・シロフォンに向きます。`engineMode: 'modal'` だけを指定すると、`bell` のエンジンセクションを使います。名前付きプリセットには `marimba`、`glass`、`bell` があります。

### `additive`（ドローバーオルガン）

トーンホイールオルガンの 9 本のドローバーのピッチ（倍音のサイン波成分を、ドローバー 1 本につき 1 成分として足し合わせる）をステップ状のストップレベルで鳴らし、フリーランの倍音位相とキークリックの接点トランジェントを備えます。**オルガン**、すなわち持続して倍音成分が豊かなレジストレーションに向きます。プリセット: `organ`。

### `percussion`（膜打楽器）

レイリーの円形膜モードに、下降するストライクピッチのエンベロープとフィルタードノイズを重ねたものです。このエンジンが **GM ドラムキット**（キック、スネアの胴とスナッピー、タム、ハット、非整数次倍音のリングモードを持つシンバル）を支えます。ワンショットで決定論的です。`engineMode: 'percussion'` だけを指定すると、`drum-kit` のエンジンセクションを使います。名前付きの `drum-kit` プリセットには、共通段の設定も含まれます。

### `piano`（拡張導波路アコースティックピアノ）

データ不要のグランドピアノのスケッチで、ピアノを定義する 4 要素を備えます。剛性弦の分散（鍵盤を上がるほど倍音成分がシャープに伸びる）、非線形フェルトハンマー（強打ほど短く明るい）、2-3 本の微デチューンユニゾン弦、響板共鳴バンクです。さらに音域ごとに音作りを変えるため、低音、中央の和音、高音が同じ単純な明るさカーブにはなりません。

その輪郭に加えて、聞こえ方を決める構造的な要素が 3 つあります。

- **弦の縦振動モード**をモデル化し、出力へ加算しています。打弦された弦は、横方向だけでなく長さ方向にも振動します。このモード群は横振動そのものが生む張力に駆動され、低音のアタックのおよそ 200 Hz〜3 kHz を埋めます。これがないと、低音は聞こえるというより体に感じるだけの音になります。
- **インハーモニシティは U 字カーブ**を描き、単調には増えません。剛性から予想されるとおり高音側へ向かって増えますが、低音のブレークより下では巻線弦が再び増加へ転じるため、鍵盤の最低部はそのすぐ上の音より非調和的です。
- **ストレッチチューニングは非対称なレイルズバックカーブ**です。A4 を基点として 2 本のべき乗則の枝が接続し、最低音でおよそ 10 セント低く、最高音で 50 セント高くなります。中央に対する奇関数 1 本では表せないのはこのためです。カーブはフィットした鍵盤の両端で保持し、その外側へ外挿はしません。

このボイスは**明示的な出力レベル**も持つため、弦・ハンマー・響板の寄与から推測せず、ミックス内の位置を直接設定できます。

内蔵のモデルであり、サンプルピアノの代替ではありません。**アコースティックピアノ**に向きます。プリセット: `acoustic-piano`。GM プログラム 0-3 と、ピアノ派生の 5 種類の [GS バリエーション音色](./gm-gs.md#gs-バリエーション音色)がこのエンジンを使います。

### `pipe-organ`（持続型フルーパイプ）

共有風圧、複数ランクのレジストレーション、リードパイプ色、マウス／放射補正を備えた、導波路のフルーパイプモデルです。プリンシパルやブルドンからフルート、トランペットランクまでの**教会オルガン系プレビュー音色**に向きます。プリセット: `church-organ`、`church-flute`、`church-bourdon`、`church-trumpet`。

### `bowed-string`（摩擦励起の弦）

ボウ速度／圧力／位置の制御、共鳴弦、第二偏波のうなり、ヴァイオリン属のボディ共鳴を備えた、持続型の擦弦導波路です。**ヴァイオリン属のプレビュー**に向きます。プリセット: `violin`、`viola`、`cello`、`contrabass`。

### `reed`（リード木管）

円筒管／円錐管の違い、トーンホール／成長円錐のふるまい、音域に応じた音作り、ライブの息・明るさ制御を備えたリード管体導波路です。**シングルリード／ダブルリード木管とサックスのプレビュー**に向きます。プリセット: `clarinet`、`soprano-sax`、`alto-sax`、`tenor-sax`、`baritone-sax`、`oboe`、`english-horn`、`bassoon`。

### `brass`（リップリード金管）

リップテンション、金管ベルのボディ共鳴、円筒／円錐の音色差、音域に応じた音作り、大音量時の明るい cuivré エッジ（強く吹いたときに金管が帯びる、金属的でざらついた音色）を備えた金管導波路です。**金管のフォールバックとプレビュー**に向きます。プリセット: `brass`、`trumpet`、`trombone`、`tuba`、`french-horn`、`muted-trumpet`、`cornet`、`flugelhorn`、`euphonium`。

### `flute`（エアジェットフルート）

ジェット／反射の明るさ、息ノイズとチフ、オーバーブローの挙動、ビブラート制御を備えた、息駆動のエアジェット／開管モデルです。**フルート、笛、オカリナ系のエッジトーン楽器**に向きます。プリセット: `concert-flute`、`piccolo`、`recorder`、`pan-flute`、`shakuhachi`、`tin-whistle`、`ocarina`、`blown-bottle`。

### `plucked-string`（バズブリッジ撥弦）

ブリッジのモデルが弦をこすり続け、エネルギーを上部倍音へ撒き戻すことで、鳴っている間ずっと音がきらめき、うなる撥弦導波路です。`buzz` コントロールは、バズのないクリーンなハープや箏から、シタールの湾曲したジャワリブリッジや三味線のサワリが生む明るく持続するびりつきまでを連続的に変化させます。クリーンに終端する撥弦をモデル化する `karplus-strong` とは別物です。**箏／シタール系のバズブリッジ撥弦**に向きます（名前付きの `harp` プリセットは `karplus-strong` のままで、`pluck` は名前に反してこのエンジンで鳴ります）。プリセット: `pluck`、`harp-plucked`、`koto`、`sitar`、`tanpura`。

### `vocal`（ソースフィルター方式のボイス）

2 段構成のソース・フィルターボイスです。声門音源をスペクトルティルトと気息ノイズで整え、歌唱母音に合わせた 5 つの共鳴フォルマントへ通します。`vowel` フィールドがフォルマントテーブル（/a/、/e/、/i/、/o/、/u/）を選び、`brightness` が音源を傾けて上部フォルマントを開き、ボイスごとのビブラートがピッチを変調します。**合唱・ソロの声のプレビュー**に向きます。プリセット: `choir-aah`、`choir-ooh`、`voice-eeh`。

### `free-reed`（駆動されるフリーリード）

駆動される金属リードの発振器（非対称サチュレーターとボディローパスで整形された位相アキュムレータ）で、アコーディオン・ハーモニカ・バンドネオンのフリーリードをモデル化します。リード自身のピッチがノートを決め、連成する気柱はありません。`detune` コントロールは、1 枚目より数セント高い 2 枚目のリードを加えます。この 2 枚が生むうなりが、きらめくミュゼットの響きです（`detune` が 0 なら 1 枚のリードに戻ります）。**アコーディオン・ハーモニカ・リードオルガンのプレビュー**に向きます。プリセット: `accordion`、`harmonica`、`bandoneon`、`reed-organ`。

### `harpsichord`（ジャック＆プレクトラム）

音色つまみではなく機構そのものを軸に組み立てた、クイル撥弦のモデルです。この機構が生む 3 つの帰結は、つまみ付きの撥弦エンジンでは再現できません。**打鍵の速さが音量をほとんど変えません。** 楽器全体で数 dB の幅しかなく、しかも単調ですらありません。ある速さを超えるとプレクトラムが早く外れ、音はかえって*小さく*なるからです。このエンジンはベロシティカーブをまったく使いません。**レジストレーションは独立した弦のクワイア**であり、1 本の弦とミックスつまみではありません。2 組の 8′ ユニゾンと 1 組の 4′ オクターブは、3 つの周期を持つ 3 本の独立した遅延ラインです。そして**非調和的なきらめきは駒の後ろにある短い無制動の区間**から来るもので、弦の剛性からではありません。そのため発音する倍音成分は数セントの範囲で調和的なままです。**ハープシコード**に向きます。プリセット: `harpsichord`。

### `sample`（ホストが用意した PCM）

このエンジンだけは音を合成しません。モノラルの float フレームとノート番号・ベロシティの範囲からなる `SampleBank` を自分で構築し、パッチと一緒にバインドすると、エンジンがノートオン時に範囲を解決して読み進めます。このエンジンは減算合成チェーンの*オシレーターの位置*に入るため、自前の音声は合成音とまったく同じ共鳴マルチモードフィルター、エンベロープ、LFO、モッドマトリクスを通ります。これが [SoundFont プレイヤー](./soundfont-player.md) との違いです。あちらはコンテナを解析し、独自のジェネレーターモデルを持ち込む別のインストゥルメントです。**自前の録音やワンショットのドラム素材**に向きます。**バンク専用です。** プリセットはなく、`SampleBank` をバインドせずに `engineMode: 'sample'` だけを指定したパッチは無音をレンダリングします。パッチのフィールドは [ホストの PCM: `sample` エンジン](#ホストの-pcm-sample-エンジン)を参照してください。

## 名前付きプリセットカタログ

NativeSynth は名前付きプリセットカタログを同梱します。**プリセット名をハードコードしないでください**。ランタイムから `synthPresetNames()` で一覧し、`synthPresetPatch(name)` で各プリセットを `SynthPatch` として確認します。

<SonareDemo id="synth-presets" />

::: code-group

```typescript [ブラウザ]
import { init, synthPresetNames, synthPresetPatch } from '@libraz/libsonare';

await init();

synthPresetNames();
// ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', 'sub-bass',
//  'warm-pad', 'e-piano', 'bell', 'brass', 'pluck', 'classical-guitar',
//  'steel-guitar', 'electric-guitar', 'harp', 'bass-acoustic', ...,
//  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...,
//  'harp-plucked', 'koto', 'sitar', 'tanpura', ...]

const pad = synthPresetPatch('warm-pad');
// { preset: 'warm-pad', engineMode: 'subtractive', waveform: 'saw',
//   unison: 7, detuneCents: 18, cutoffHz: 1800, ampAttackMs: 620, ... }
```

```python [Python]
import libsonare as sonare

sonare.synth_preset_names()
# ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', 'sub-bass',
#  'warm-pad', 'e-piano', 'bell', 'brass', 'pluck', 'classical-guitar',
#  'steel-guitar', 'electric-guitar', 'harp', 'bass-acoustic', ...,
#  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...,
#  'harp-plucked', 'koto', 'sitar', 'tanpura', ...]

pad = sonare.synth_preset_patch("warm-pad")
# SynthPatch(preset='warm-pad', engine_mode='subtractive', waveform='saw',
#            unison=7, detune_cents=18.0, cutoff_hz=1800.0, ...)
```

:::

カタログとエンジンの対応は次のとおりです（各エンジンの感触は 1 行で十分つかめます）。

| プリセット | エンジン | 向いている用途 | 弾いてみる |
|------------|----------|----------------|------------|
| `sine` `saw` `square` `triangle` `saw-lead` `square-lead` `sub-bass` `warm-pad` | `subtractive` | リード・ベース・パッド | [saw-lead](/ja/synth?preset=saw-lead) |
| `e-piano` | `fm` | エレピ・ベル・ブラス | [e-piano](/ja/synth?preset=e-piano) |
| `classical-guitar` `steel-guitar` `electric-guitar` `harp` `bass-acoustic` `bass-fingered` `bass-picked` `bass-fretless` `bass-slap` | `karplus-strong` | 撥弦とベース | [classical-guitar](/ja/synth?preset=classical-guitar) |
| `marimba` `glass` `bell` | `modal` | 音程のあるマレット | [marimba](/ja/synth?preset=marimba) |
| `organ` | `additive` | ドローバーオルガン | [organ](/ja/synth?preset=organ) |
| `drum-kit` | `percussion` | GM ドラムマップ | [drum-kit](/ja/synth?preset=drum-kit) |
| `acoustic-piano` | `piano` | アコースティックピアノ | [acoustic-piano](/ja/synth?preset=acoustic-piano) |
| `church-organ` `church-flute` `church-bourdon` `church-trumpet` | `pipe-organ` | パイプオルガンのランク | [church-organ](/ja/synth?preset=church-organ) |
| `violin` `viola` `cello` `contrabass` | `bowed-string` | 擦弦 | [cello](/ja/synth?preset=cello) |
| `clarinet` `soprano-sax` `alto-sax` `tenor-sax` `baritone-sax` `oboe` `english-horn` `bassoon` | `reed` | リード木管 | [clarinet](/ja/synth?preset=clarinet) |
| `brass` `trumpet` `trombone` `tuba` `french-horn` `muted-trumpet` `cornet` `flugelhorn` `euphonium` | `brass` | 金管 | [trumpet](/ja/synth?preset=trumpet) |
| `concert-flute` `piccolo` `recorder` `pan-flute` `shakuhachi` `tin-whistle` `ocarina` `blown-bottle` | `flute` | エアジェットフルートと笛 | [concert-flute](/ja/synth?preset=concert-flute) |
| `pluck` `harp-plucked` `koto` `sitar` `tanpura` | `plucked-string` | バズブリッジの撥弦 | [koto](/ja/synth?preset=koto) |
| `choir-aah` `choir-ooh` `voice-eeh` | `vocal` | 合唱・ソロの声 | [choir-aah](/ja/synth?preset=choir-aah) |
| `accordion` `harmonica` `bandoneon` `reed-organ` | `free-reed` | アコーディオン、ハーモニカ、リードオルガン | [accordion](/ja/synth?preset=accordion) |
| `harpsichord` | `harpsichord` | ハープシコード | [harpsichord](/ja/synth?preset=harpsichord) |

下のロールは1つの3声フレーズをシーケンスし、`bounceWithSynthInstrument(presetName, …)` でバウンスします。楽器セレクタは、ピアノ、FM、撥弦、モーダル、オルガン、擦弦、リード、金管、フルートの代表プリセットをまたぐので、同じ音符がそれぞれのエンジンの性格を帯びるのが聞き取れます。

<SonareDemo id="midi-piano-roll" />

### `va:` ルーティング接頭辞

プリセット名には `va:` 接頭辞を付けられます（例: `va:saw-lead`、`va:e-piano`）。この接頭辞はプリセット名を受け取るすべての場所（`synthPresetPatch`、`bounceWithSynthInstrument`、`setSynthInstrument`）で**受け付けられ**、接頭辞なしと同じパッチに解決されます。これは「このデスティネーションはバーチャルアナログの NativeSynth を鳴らす」と印を付けるためにホストが使うルーティング規約で、シンセは検索前に取り除きます。

## `SynthPatch` オブジェクト

`SynthPatch` は「プリセット + 自分の調整」と考えてください。**ベース**（名前付き `preset`。省略すると既定の減算合成 init パッチ）から始まり、設定した各フィールドがそのベースを上書きします。フィールドを省けば、ベース値がそのまま残ります。

初学者には、小さく戻しやすい調整から始めるのがおすすめです。たとえば `warm-pad` を選び、`ampAttackMs` を長くしてゆっくり立ち上がる音にする、`cutoffHz` を下げて暗い音にする、`stereoSpread` を上げて広がりを出す、という具合です。オブジェクト全体を埋める必要はありません。

::: warning 「省略」と「0」は別物
ベースを上書きするかどうかを決めるのは、値ではなく**設定されたかどうか**です。数値フィールドを省けばベース値が残り、設定すれば可聴域にクランプされたうえでベースを上書きします。これは明示的な `0` も同じで、`ampSustain: 0` と書けばサスティンは本当に 0 まで下がり、`stereoSpread: 0` と書けば本当に中央へ寄ります。enum フィールドは従来どおり `'default'` が「保つ」を意味します。

パッチはフィールドごとの「設定済みか」の記録を構造体バージョンとともに持っており、これが「省略」と「0」を区別しています。そのため 0 が「未変更」として扱われることはなく、本当の 0 に近づけるために `ampSustain: 0.001` のような便宜的な値を書く必要もありません。意図した `0` をそのまま書いてください。

もう 1 つのルールとして、空でない `modRoutings` 配列は、ベースのモッドマトリクスへ追加するのではなく、**まるごと置き換え**ます。空配列は消去し、キーを省略した場合はベースのマトリクスが保たれます。
:::

パッチは、すべてのエンジンが共有する共通部分を公開します。

<SonareDemo id="synth-adsr" />

::: info セント・ベロシティ・キートラッキング
- **セント**（cent）：半音の 1/100 です。100 セントでピアノの 1 鍵分、1200 で 1 オクターブです。ピッチやデチューンの量はセントで表します。
- **ベロシティ**：ノートをどれだけ強く弾いたか（0〜127）です。プリセットはこれで明るさや音量を制御します。
- **キートラッキング**：フィルターカットオフなどのパラメータを、鍵盤を上がるほどノートの音高に追従させることです。
:::

範囲は `synthPatchParamInfo()` が返す値で、範囲外の値はクランプされます（`gain` は例外で、[0, 4] の外や有限でない値はフィールド名つきで拒否されます）。同じ呼び出しで各フィールドの既定値も取得できます。

| グループ | フィールド |
|----------|------------|
| オシレーター | `unison`（1-7）と `detuneCents`（0-200）は subtractive のみ。`driftCents`（0-100）、`driftRateHz`（0.01-20）、`drive`（0-1）、`pitchOffsetCents`（-4800〜4800） |
| フィルター | `cutoffHz`（10-22000）、`resonanceQ`（0.5-30）、`keyTrack`（0-1）、`envToCutoffCents` と `velToCutoffCents`（-9600〜9600）、`hpCutoffHz`（0-22000。0 でオフ） |
| 出力段 | `sampleHoldHz`（0-192000。0 でオフ）、`bitDepth`（0-24。0 でオフ） |
| アンプ／フィルターエンベロープ | `ampDelayMs`／`ampHoldMs` と `filter*` の対（0-5000）、アタック・ディケイ・リリース時間（最大 20000 ms。ディケイとリリースは時定数 3 つ分なので、設定時間では約 26 dB 下がった位置にあります）、`ampSustain`／`filterSustain`（0-1）、`oneShot`（アンプのみ。真偽値） |
| LFO とグライド | `lfoRateHz`、`lfo2RateHz`（0-40）、`lfoToPitchCents`（0-1200）、`glideMs`（0-5000） |
| ボディ共鳴 | `body`（`none` / `guitar` / `violin` / `wood-tube` / `brass-bell` / `vocal`）、`bodyMix`（0-1） |
| ステレオと出力 | `stereoSpread`（0-1）、`gain`（リニア、0-4）、`polyphony`（1-64）、`busDrive`（0-1） |
| enum | `engineMode`、`waveform`（subtractive のみ）、`filterModel`、`filterOutput`（SVF のみ）。`synthEnumTables()` の名前、またはベースを保つ `'default'` |
| ボイスの開始状態 | `retrigger`（`'default'` / `'free'` / `'note'`） |
| エンジンセクション | `engineParams`（キーと数値のレコード） |
| モッドマトリクス | `modRoutings`（最大 8 本） |
| サンプルエンジン | `sampleBank`、`sampleSet`、`sampleLevel`（0-8）、`sampleLoop`、`sampleStartOffset`（0-0.999）、`sampleKeyTrack`。[`sample` エンジン](#ホストの-pcm-sample-エンジン)を参照 |
| バインディング | `destinationId`（JS のみ。既定 `0`）。`useGmPrograms`（Python では `use_gm_programs`）は、GM のバンクとプログラムの変更に追従します。[GM／GS フォールバックバンク](./gm-gs.md#パッチを固定せず-gm-プログラムに追従させる)を参照 |

（**ポリフォニー**は同時に鳴らせるノート数、**ボイス**は鳴っている 1 つのノートで、**ボイススティール**は足りなくなったとき最も古いノートを止めることです。）

ディレイ段はアタックが始まるまでエンベロープをゼロに保ち、ホールド段はディケイの前にピークを保ちます。どちらもミリ秒単位です（[ディレイとホールド: DAHDSR](./glossary/instruments/envelopes-modulation.md#ディレイとホールド-dahdsr)）。`driftRateHz` はボイスごとのピッチドリフトが揺れる速さ、`driftCents` はその深さです（どう聞こえるかは[エンベロープとモジュレーション](./glossary/instruments/envelopes-modulation.md#ドリフト-ボイスごとにわずかにずれる音程)を参照）。4 つのディレイ／ホールド時間とドリフトの周波数は、ライブのインストゥルメントでオートメーションできます。ディレイやホールドの変更は、そのステージが次に始まるときに反映されます。

`oneShot` はノートオフを無視します。アンプのサステインがゼロなら、エンベロープが無音まで減衰した時点でボイスが終わります。サステインが正の値なら、有限の FM エンベロープ、打楽器の打撃音、ループしないサンプルなど、エンジン自身が発音を終える設定が必要です。自然に終わらない持続型のワンショットパッチはテールが無制限になるため、[長さを自動導出するバウンス](./project-bounce.md#長さを省略する) では正の `totalFrames` を指定してください。

`retrigger` は、各ボイスの開始時に使うシードを選びます。`'default'` はベースパッチの設定を保ちます。カタログのプリセットはすべて `'free'` です。`'free'` はボイスプールのスロットとノートごとに増えるカウントから、オシレーターの開始位相、ユニゾンの揺らぎ、ドリフト、各エンジンのノイズストリームを変化させるため、同じノートを繰り返しても通常は異なる音になります。`'note'` はこれらを MIDI ノート番号だけから導くため、テイルが終わったあとに同じノートを鳴らすと同じサンプル列をレンダリングします。この設定が制御するのは各ボイスの開始状態です。コントローラー、バスの DC ブロッカー、ピアノの共有サウンドボード、撥弦の共鳴ハロー、オルガンのウィンドチェスト、エフェクトのテイルはリセットしません。`drum-kit` プリセットの各ドラム音は独自のモードを保ちます。

::: info LFO 2 にはルーティングが必要
2 つの LFO は挙動が異なります。LFO 1（`lfoRateHz` + `lfoToPitchCents`）はピッチへ固定配線されており、単独でビブラートを生みます。LFO 2 はマトリクス経由専用で、`modRoutings` のエントリが `source: 'lfo2'` で送り先を指定するまで、`lfo2RateHz` を設定しても何も起きません。
:::

各**モッドルーティング**は `{ source, destination, depth }` です。マトリクスは 12 のソース（2 つのエンベロープ、2 つの LFO、ベロシティ、キートラッキング、モッドホイール、シード付きのボイスごとランダムソース、ブレス、アフタータッチ、エクスプレッション、ピッチベンド）を 12 の送り先へつなぎます。送り先はピッチ、ビブラート深さ、カットオフ、レゾナンス、フィルターエンベロープ深さ、音量、パン、LFO 1 のレート、そして物理モデル系エンジンが持つ 4 つの励振軸です。`depth` は、ソースが最大まで振れたときの変化量を送り先の単位で表したものです。

<SonareDemo id="synth-tremolo" />

`body` フィールドは NativeSynth のボディ／フォルマント共鳴層で、楽器の物理的な筐体や声道がもつ共鳴的なキャラクターを表します。アコースティックギター、ハープ、ヴァイオリン属、木管、金管、合唱／声のフォールバックはこの層を使います。ソリッドボディのエレキは `body` を `none` のままにできます。

`body: 'vocal'` は母音フォルマントのバンクで、`vocal` エンジン専用ではなく**どのパッチからでも**使えます。減算合成のオシレーターをこれに通すと、フィルターをかけたノコギリ波ではなく歌声の音色になります。GM フォールバックバンクが Lead 6 (voice) と Pad 4 (choir) を鳴らしているのがまさにこの方法で、この 2 つが周囲のシンセリードやパッドと違って聞こえるのはそのためです。

::: info ピッチベンド・コントローラーリセット・表現の状態
NativeSynth は**ピッチベンド**メッセージに反応し、ベンドレンジは **RPN 0**（ピッチベンドレンジの標準パラメータ。**CC101 = 0** と **CC100 = 0** で選び、**CC6** で半音、**CC38** でセントを書きます。既定は ±2 半音。手順の全体は [MIDI の基礎](./glossary/instruments/midi-basics.md#ピッチベンド・rpn・nrpn)にあります）に従います。MIDI の **Reset All Controllers** メッセージは、演奏系コントローラー（モッドホイール、エクスプレッション、ピッチベンド値、各ペダル）と RPN／NRPN の選択状態を既定へ戻しますが、ベンドレンジは設定した値のまま意図的に残します。±2 半音へ戻したいときは、RPN 0 をあらためて送ってください。**CC 120 All Sound Off** は鳴っているノートを止め、**CC 123 All Notes Off** はキーを離した状態にしますが、どちらもサスティン（**CC64**）とソステヌート（**CC66**）の状態をリセットしません。そのため CC 123 の後もペダルに保持されたノートが残ることがあります。**CC 121 Reset All Controllers** は両方のペダル状態をリセットします。必要なのは通常の MIDI イベントです。ピッチベンドイベント（オフラインなら `Project.midiPitchBend(...)` など）と、ストリーム中の RPN 0／Data Entry／リセットの各 CC です。

NativeSynth は通常のコントローラー状態をチャンネルごとに、ノートを指定する表現を発音中のボイスごとに保持します。MIDI 2.0 のノートベロシティ、コントローラー、プレッシャー、ピッチベンドの入力はフル解像度を保ち、NativeSynth はチャンネルプレッシャー、ポリフォニックキープレッシャー、ノート単位のピッチベンドを処理します。MPE ゾーン（[説明](./glossary/instruments/midi-basics.md#midi-ファイルと-midi-2-0)）を設定してメンバーチャンネルの表現を送ることも、MIDI 2.0 のノート単位メッセージを直接送ることもできます。RPN 0 がベンドレンジを設定し、汎用の高分解能パラメータマッピングはエンジンの `bindMidiCcBinding(...)` 層で行います。

ピアノ系のペダル操作も通常の MIDI CC としてデコードされます。ただし、サスティンペダル **CC64** のハーフペダルダンピングが効くのは `piano` エンジンだけです。そこでは 64〜126 の中間値が、鍵を離して鳴り続けているノートを値に応じて減衰させます。他のエンジンでは CC64 は 64 を境にした単純なオン／オフのサスティンで、64 でも 126 でも 127 と同じ鳴り方になります。**CC66** はソステヌート、**CC67** は対応プリセットで una corda／ソフトペダルの音色として働きます。
:::

### エンジンパラメータ

`engineParams` は、選択中のエンジン固有のモデルセクションのフィールドをキーで設定します。弓の力、ブレス圧、リップの張り、打撃位置、FM オペレータのレベル、モード比などです。キーはセクションのフィールド名を lowerCamelCase にしたもの（`bowForce`、`ops0.level`、`ranks2.level`）で、指定しなかったキーはベースのセクションの値を保ちます。

::: code-group

```typescript [ブラウザ／Node]
const audio = project.bounceWithSynthInstrument(
  { engineMode: 'bowed-string', engineParams: { bowForce: 0.9, bowPosition: 0.08 } },
  { totalFrames: 48000, numChannels: 2 },
);
```

```python [Python]
audio = project.bounce_with_synth_instrument(
    sonare.SynthPatch(
        engine_mode="bowed-string",
        engine_params={"bowForce": 0.9, "bowPosition": 0.08},
    ),
    total_frames=48000,
    num_channels=2,
)
```

:::

ラッパーのフィールドと違い、ここでは何もクランプされません。未知のキー、別のエンジンのセクションのキー、有限でない値、整数フィールドへの小数、フィールドの範囲外の値は、キー名を示すエラーで拒否されます（`engine param 'bowForce': out of range [0, 1]`）。Python のフィールド名は `engine_params` で、キーは lowerCamelCase のままです。コマンドラインの `--synth` はプリセット名しか受け取らないため、パッチと `engineParams` を使えるのはバインディングだけで、CLI では使えません。

`synthEngineParamInfo(engineMode)` はそのエンジンが受け付けるキーを、`synthPatchParamInfo()` は数値のラッパーフィールドすべてを返します。どちらも [インサートのパラメータ記述子](./effects-inserts.md#パラメータ記述子)と同じ形の `SynthParamInfo[]` で、`name`、`type`（`'number'` か、0 または 1 で与えるスイッチの `'boolean'`）、`integer`、`min`、`max`、`default`、`unit`、そしてゲートされたフィールドには `activeWhen` を持ちます。エンジンのフィールドでは `default` が基本プリセットの値、ラッパーのフィールドでは初期パッチの値です。`default` は `number` で、スイッチでは `boolean` です（打楽器の `gmKit` は `true`）。計算に使う前に型を絞り込んでください。`synthEngineParamInfo` は `default`、`subtractive`、`sample` に対して `[]` を返します。Python では `synth_engine_param_info` と `synth_patch_param_info` です。

```typescript
synthEngineParamInfo('fm').slice(0, 2);
// [{ name: 'algorithm', type: 'number', integer: true, min: 0, max: 5, default: 3, unit: 'none' },
//  { name: 'ops0.ratio', type: 'number', min: 0, max: 64, default: 1, unit: 'ratio' }]
```

Python では同じキーを持つ dict のリストが返り、ゲートは camelCase のキー `activeWhen` のままです。

FM のオペレータアルゴリズムは `fm` セクションの `algorithm` キーです。コントロールパネルは、範囲を書き写さずにこれらの記述子から組み立ててください。

#### ゲートされるフィールド: `activeWhen`

フィールドは受け付けられても、別のフィールドがそのセクションをオフにしているために効果がない場合があります。`activeWhen` は、そのフィールドがボイスに届く条件を「選択肢の一覧」で表します。各選択肢は条件の一覧で、その条件がすべて成り立てばその選択肢が成り立ちます。どれか 1 つの選択肢が成り立てば、フィールドは効きます。各条件は `{ key, scope, relation, value }` で、`scope` が `'engine'` のときは同じ `synthEngineParamInfo` の表から、`'patch'` のときは `SynthPatch` から `key` を読みます。`relation` は `'eq'`、`'ne'`、`'gt'`、`'ge'`、`'lt'`、`'le'` のいずれかです。`activeWhen` を持たないフィールドはゲートされません。値を設定しても音が変わらないときは、そのフィールドの `activeWhen` を読んでください。`percussion` セクションでは 93 フィールドのうち 92 がゲートされており、たとえば `gmKit` がオンの間、`noiseBurstCount` は何もしません。

```typescript
synthEngineParamInfo('percussion').find((p) => p.name === 'noiseBurstCount')?.activeWhen;
// [[{ key: 'gmKit',     scope: 'engine', relation: 'eq', value: false },
//   { key: 'noiseGain', scope: 'engine', relation: 'gt', value: 0 }]]
```

`percussion` セクションでは、`gmKit` 以外のすべてのフィールドが `gmKit` オフを必要とします。GM キットは鳴らすパーツを自分で選ぶためです。レイヤーのフィールドはさらに独自のゲートを持ちます（`noiseBurstCount` は `noiseGain > 0`、`shellNumModes` は `shellMix > 0` が必要です）。`pipe-organ` では、単一パイプのフィールド（`stopped`、`brightness`、`reed`）は `rankCount` が `0` のときだけ、`ranks0.*` のフィールドは `rankCount` が `0` より大きいときだけ効きます。リード、ブラス、フリーリード、ハープシコード、擦弦、加算の各セクションも同じ方式でフィールドをゲートします。

パネルを作るときは、現在の値で各ゲートを評価し、どの選択肢も成り立たないコントロールは無効にするか隠してください。値は保存され検証もされますが、音は変わりません。数値は `relation` どおりに比較し、ブールのスイッチやラッパーの enum 名（`body: 'violin'`）は `eq` / `ne` で比較します。演奏（ベロシティ、コントローラー、重なったノート）に依存するフィールドや、ある値を超えると飽和するだけのフィールドには `activeWhen` が付かないので、`activeWhen` がないことは常に聞こえるという保証ではありません。

エンジンパラメータとパッチフィールドの違い（拒否されるか丸められるか、どこに置かれるか）は[シンセの音作りの基礎](./glossary/instruments/synthesis-basics.md#パッチフィールドとエンジンパラメータ)で説明しています。

[シンセプレイグラウンド](/ja/synth)のモデル用コントロールはこの方法で作られています。ゲートが成り立つフィールドだけを表示するので、`percussion` エンジンで `gmKit` がオンなら `gmKit` だけが、キットをオフにすると該当するモーダル系のフィールドが表示されます。

### enum 名テーブル

各 enum フィールドは、名前文字列または C の序数のどちらも受け付けます。名前と序数がずれないよう、`synthEnumTables()` でランタイムから正規のテーブルを取得してください。

```typescript
import { init, synthEnumTables } from '@libraz/libsonare';

await init();
synthEnumTables();
// {
//   engineModes:      ['default', 'subtractive', 'fm', ..., 'harpsichord', 'sample'],
//   waveforms:        ['default', 'sine', 'saw', 'square', 'triangle', 'noise'],
//   builtinWaveforms: ['sine', 'saw', 'sawtooth', 'square', 'triangle'],
//   filterModels:     ['default', 'svf', 'transistor-ladder', 'diode-ladder', 'sallen-key'],
//   filterOutputs:    ['default', 'lowpass', 'bandpass', 'highpass'],
//   bodyTypes:        ['default', 'none', 'guitar', 'violin', 'wood-tube',
//                      'brass-bell', 'vocal'],
//   modSources:       ['none', 'amp-env', 'filter-env', 'lfo1', 'lfo2',
//                      'velocity', 'key-track', 'mod-wheel', 'random', 'breath',
//                      'aftertouch', 'expression-cc', 'pitch-bend'],
//   modDestinations:  ['none', 'pitch-cents', 'cutoff-cents', 'amp-gain', 'pan-units',
//                      'resonance-q', 'vibrato-depth-cents', 'filter-env-depth',
//                      'lfo1-rate-scale', 'excitation-force', 'excitation-position',
//                      'excitation-brightness', 'spectrum-morph'],
//   // ...ほかに controllerInputs、controllerAxes、articulations、
//   //    mpeDimensions、noteTrackings
// }
```

Python では `synth_enum_tables()` で、同じテーブルが snake_case のキーで返ります。

同じ配列は名前付き定数（`SYNTH_ENGINE_MODES`、`SYNTH_OSC_WAVEFORMS`、`SYNTH_FILTER_MODELS`、`SYNTH_FILTER_OUTPUTS`、`SYNTH_BODY_TYPES`、`SYNTH_MOD_SOURCES`、`SYNTH_MOD_DESTINATIONS`、および `BUILTIN_SYNTH_WAVEFORMS`）としてもエクスポートされます。多くのテーブルでインデックス 0 は `'default'`（ベース値を保つ）で、`modSources` / `modDestinations` は代わりに `'none'` を使います。

Node と WASM の `SynthPatch` はこのフィールドを `retrigger` として公開し、Python も `SynthPatch.retrigger` という属性名を使います。TypeScript のユニオン型は `SynthRetrigger`、名前の配列は `SYNTH_RETRIGGERS`（`['default', 'free', 'note']`）です。この配列は `synthEnumTables()` の戻り値とは別に公開されています。C API では対応する enum が `SonareSynthRetrigger` で、値は `SONARE_SYNTH_RETRIGGER_BASE`、`SONARE_SYNTH_RETRIGGER_FREE`、`SONARE_SYNTH_RETRIGGER_NOTE` です。

`builtinWaveforms` / `BUILTIN_SYNTH_WAVEFORMS` は別系統のリストです。これは NativeSynth の `waveform` フィールドではなく、最小構成の内蔵オシレーターシンセ（`setBuiltinInstrument`）が受け付ける名前を表します。`'default'` を持たず、`'saw'` に加えて `'sawtooth'` も受け付け、`'noise'` は受け付けません。ADSR の時間は設定時間かけて進むリニアなランプで、`SynthPatch` のディケイとリリース（時定数 3 つ分）とは異なります。

### ホストの PCM: `sample` エンジン

`sample` エンジンは、自分で構築した `SampleBank` から音声を読み出します。手順は 3 つです。モノラルの float フレームを追加し、それにノート番号とベロシティの範囲を対応づけ、`engineMode` が `'sample'` のパッチと一緒にバンクをバインドします。

::: code-group

```typescript [ブラウザ／Node]
import { init, Project, SampleBank } from '@libraz/libsonare';

await init();

const bank = new SampleBank();
try {
  const index = bank.addSample(pcm, { rootKey: 60, sourceRate: 44100 });
  bank.addZone({ sampleIndex: index });          // 空のゾーンは鍵盤全体を意味する
  const audio = project.bounceWithSynthInstrument(
    { engineMode: 'sample', sampleSet: 0, sampleBank: bank },
    { totalFrames: 24000 },
  );
} finally {
  bank.delete();   // WASM ハンドルは GC されない
}
```

```python [Python]
import libsonare as sonare

with sonare.SampleBank() as bank:                      # ネイティブハンドルを閉じる
    index = bank.add_sample(pcm, root_key=60, source_rate=44100.0)
    bank.add_zone(0, sample_index=index)               # セット 0 の鍵盤全体
    audio = project.bounce_with_synth_instrument(
        sonare.SynthPatch(engine_mode="sample", sample_set=0, sample_bank=bank),
        total_frames=24000,
    )
```

:::

**ゾーン**は 1 つのサンプルを指すノート番号とベロシティの範囲です。境界はそれぞれ独立に既定値を持つため、`{}` はあらゆるベロシティでの鍵盤全体を意味し、片方の軸を狭めてももう片方は全体のまま残ります。ゾーンは番号付きの**セット**に属し、パッチは `sampleSet` で鳴らすセットを指定します。バンクは、それをバインドしたバウンスが始まる前に完成させてください。サンプルプールは連続領域で、拡張時に移動するため、何かが鳴っている最中に追加すると、それを読んでいるボイスが無効になります。

このエンジンが追加するパッチのフィールドは次のとおりです。

| フィールド | 意味 |
|------------|------|
| `sampleBank` | PCM を読み出すバンク。`destinationId` と同じく JS バインディングの便宜機能でパッチ自体の一部ではありません。これを指定しない `'sample'` パッチは無音をレンダリングします |
| `sampleSet` | そのバンク内のキーマップセット（負値は「選択しない」） |
| `sampleLevel` | ボイス自身のアンプ段に入る前の、サンプルへのリニアゲイン |
| `sampleLoop` | バンクがそのサンプルに記録しているループモードを上書きします |
| `sampleStartOffset` | アタックのスキップ量。対応領域に対する割合（0 以上 1 未満） |
| `sampleKeyTrack` | サンプルを弾いた鍵に追従させるか、どの鍵でも録音時のピッチで鳴らすか。後者はワンショットのドラム向けです |

`sampleLoop` は `'default'`（バンクの記録を保つ）・`'none'`・`'continuous'`・`'key-down'` を取ります。`sampleKeyTrack` は `'default'`・`'on'`・`'off'` です。どちらも C の序数も受け付けます。

::: warning この 2 つは `synthEnumTables()` には現れません
上記の取得レシピが返すのは、C ABI が名前を供給している enum だけです。サンプルのループモードとキートラッキングには C ABI 側に対応する種別がないため、どちらも `synthEnumTables()` には現れず、そこを探しても見つかりません。上に挙げた名前がその一覧です。JavaScript では定数 `SAMPLE_LOOP_MODES` と `SAMPLE_KEY_TRACKS` としてもエクスポートされています。
:::

サンプル自身のループ点とループモードは*録音*の性質であり、`addSample` に渡す `SampleDesc` に属します。`sampleLoop` はその上に重ねるパッチ単位の上書きです。クランプの結果ループが空になった場合は破棄されるため、壊れたループは何もない区間を繰り返すのではなく、ループなしのサンプルとして鳴ります。

## オフラインでレンダー: `bounceWithSynthInstrument`

MIDI アレンジを音声化するには、NativeSynth インストゥルメントを MIDI デスティネーションへバインドしてバウンスします。プリセット名の文字列、`SynthPatch`、またはそのどちらかの配列を渡して、複数のデスティネーションを一度にバインドできます。配列を渡すと、各 `SynthPatch` は `destinationId`（既定 `0`）でバインドする MIDI デスティネーションを選べます。たとえば `[{ preset: 'saw-lead', destinationId: 0 }, { preset: 'drum-kit', destinationId: 1 }]` なら、1 回のレンダー呼び出しで 2 つのデスティネーションをレンダリングします。`destinationId` は JS のバインディング用の便宜機能で、NativeSynth パッチそのものの一部ではありません（Python ではデスティネーションを別の引数として渡します）。明示的に空の配列 `[]`（または実行時の `null`）を渡すとバインディングは 0 件になります。引数を省略した場合や `undefined` を渡した場合は `{}` にフォールバックするため、既定パッチのバインディングが 1 件作られます。レンダーはプロジェクト・オプション・パッチが固定なら決定論的です。

## ライブでレンダー: `setSynthInstrument` + MIDI 入力

対話的な再生では、`RealtimeEngine` のデスティネーションにシンセをバインドして MIDI を送ります。次のスニペットは制御スレッドだけで動き（AudioWorklet 不要）、非ゼロのサンプルを生成します。

::: code-group

```typescript [ブラウザ／Node]
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const engine = new RealtimeEngine(48000, 128);
try {
  engine.setSynthInstrument('va:saw-lead', 7);   // デスティネーション 7 へバインド
  engine.pushMidiNoteOn(7, 0, 0, 60, 100);       // デスティネーション, グループ, チャンネル, ノート, ベロシティ

  const out = engine.process([new Float32Array(128), new Float32Array(128)]);
  // out[0] / out[1] がレンダー済みのステレオブロック。無音ではない

  engine.midiInstrumentCount();                   // 1
} finally {
  engine.destroy();   // ネイティブハンドルを解放
}
```

```python [Python]
import libsonare as sonare

engine = sonare.RealtimeEngine(sample_rate=48000.0, max_block_size=128)
try:
    engine.set_synth_instrument("va:saw-lead", destination_id=7)
    engine.push_midi_note_on(7, 0, 0, 60, 100)     # デスティネーション, グループ, チャンネル, ノート, ベロシティ
    out = engine.process([[0.0] * 128, [0.0] * 128])
    # out[0] / out[1] がレンダー済みのステレオブロック。無音ではない
    engine.midi_instrument_count()                 # 1
finally:
    engine.close()
```

:::

同じデスティネーションに `setSynthInstrument` をもう一度呼ぶと、再生中でも楽器が差し替わります。鳴っていた側は 10 ms でフェードアウトし、新しい楽器はコントローラーやプログラムが既定の状態から始まるため、必要なプログラムやコントローラーの状態は送り直してください（差し替えとクリアは[リアルタイムエンジン](./realtime-engine.md)で説明しています）。`tailSamples()` は保守的な上限値で、実際に鳴った長さではありません。まだ叩いていない `drum-kit` のデスティネーションは約 29.5 秒、`useGmPrograms` のデスティネーションは最初のノートの前で約 42.7 秒を報告します。GM プログラムに追従するオフラインバウンスは、実際に鳴らしたプログラムだけを測ります（[長さを省略する](./project-bounce.md#長さを省略する)）。

実際のアプリではライブキーボードから `pushMidiNoteOn` / `pushMidiNoteOff` / `pushMidiCc` を呼ぶか（`pushMidiProgram` はバンク指定つきのプログラムチェンジを同じ要領でキューに入れます。どのシンセが従うかは次の段落を参照してください）、エンジン側の MIDI 入力ソースを有効にしてイベントを到着順に送ります。詳しくは [MIDI 入力](./midi-input.md) を参照してください。`setSynthInstrument` はプリセット名や `SynthPatch` を `bounceWithSynthInstrument` とまったく同じように解決するため、オフラインで作り込んだ音色がライブでも同一に鳴ります。

プログラムを選ぶ受け手は、SoundFont プレイヤー（RX PROGRAM CHANGE と RX BANK SELECT の条件のもとで）、`useGmPrograms: true` でバインドした NativeSynth（Python では `use_gm_programs`。バンクとプログラムから各チャンネルの音色を決めます）、そして GM キットを鳴らす NativeSynth（`drum-kit` プリセット、または `gmKit` をオンにした打楽器パッチ。プログラムが全チャンネルで GS ドラムセットの選択になります）です。それ以外の受け手は、受け付けたうえで無視します。内蔵シンセ、ほかの NativeSynth パッチ、RX PROGRAM CHANGE をオフにしたパート、MPE のメンバーチャンネルがこれにあたります。

## 制限

**方式固有の深いフィールドはパッチ単位で設定し、ライブでは動かせません。** `engineParams` はパッチをバインドするときに値を固定します。発音中のライブ操作には、各エンジンが宣言する励振軸を使います。

**自己発振する一部のモデルにはわずかな残留音程誤差があります。** エアジェット・フルートとフルー式パイプオルガンは素朴なチューニングからわずかにずれてロックするため、較正係数で補正していますが、音域に依存する小さな残差が残ります。

**較正の状況が当てはまるのは一部のエンジンだけです。** 減算（バーチャルアナログ）、FM、加算は信号ベースなので、上記の状況は当てはまりません。モーダル（マレット／ベル）、膜鳴（パーカッション）、ジャック＆プレクトラム式ハープシコードは物理モデルで、ほかの物理モデルと同じく暫定です。`sample` エンジンは渡されたものをそのまま鳴らすため、自身の音作りを持ちません。

**音の出どころについて。** 各合成エンジンは、公開されている合成・物理モデリングのアルゴリズム系統を独自に実装したものであり、GM/GS の挙動は公開されている General MIDI／GS のアドレス指定に従います。サンプリングや録音による楽器音は同梱しておらず、特定機器の複製ではなく独立した再構成です。各エンジンの背景にある標準や論文については、[アルゴリズム根拠](./algorithm-references.md)を参照してください。

## レシピ

:::: details 1 つのプロジェクトで全エンジンを試聴
同じ MIDI クリップを、エンジンごとに 1 プリセットでバウンスして各ボイスを聴き比べます。

```typescript
const project = new Project();
project.setSampleRate(48000);
const { trackId, clipId } = project.addMidiClip(0, 4);
project.setTrackMidiDestination(trackId, 0);
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 0, 60, 100),
  Project.midiNoteOff(2, 0, 0, 60, 0),
]);
try {
  for (const preset of ['saw-lead', 'e-piano', 'electric-guitar',
                         'marimba', 'organ', 'drum-kit', 'acoustic-piano',
                         'church-organ', 'violin', 'clarinet', 'trumpet',
                         'concert-flute']) {
    const audio = project.bounceWithSynthInstrument(preset, { totalFrames: 48000 });
    // 各プリセットの音声をレンダー／確認
  }
} finally {
  project.delete();
}
```
::::

:::: details GM ドラムマップでドラムパターンを鳴らす
ドラムノート（キック 36、スネア 38、ハット 42、...）を `drum-kit` をバインドしたデスティネーションへ送ります。

```typescript
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 9, 36, 110),   // キック
  Project.midiNoteOff(1, 0, 9, 36, 0),
  Project.midiNoteOn(0, 0, 9, 38, 100),   // スネア
  Project.midiNoteOff(1, 0, 9, 38, 0),
]);
const audio = project.bounceWithSynthInstrument('drum-kit', { totalFrames: 24000 });
```
各ノートはピッチとしてではなく、対応する GM のパーツを鳴らします。長さ自動のバウンス（`totalFrames` なし）は、キット内でもっとも長いパーツではなく、実際に叩いたパーツが鳴り終わった時点で終わります。キック 1 発だけのクリップなら、クリップの終端から約 0.69 秒後です。
::::

:::: details LFO ワブルを足したカスタムパッチ
`warm-pad` を出発点に、フィルターを暗くし、LFO 1 でカットオフをゆらします。

```typescript
const audio = project.bounceWithSynthInstrument(
  {
    preset: 'warm-pad',
    cutoffHz: 1200,
    resonanceQ: 3,
    lfoRateHz: 6,
    modRoutings: [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }],
  },
  { totalFrames: 48000, numChannels: 2 },
);
```
空でない `modRoutings` は、プリセットのモッドマトリクスをまるごと置き換えます。
::::

## 関連

- [プロジェクトバウンス](./project-bounce.md)：すべての `bounceWith*` インストゥルメントが共有するオフラインレンダーのオプション
- [SoundFont プレイヤー](./soundfont-player.md)：サンプルベースの音色。NativeSynth が GM フォールバックの土台
- [MIDI 入力](./midi-input.md)：バインドしたインストゥルメントへライブ／スケジュール MIDI を送る
- [プロジェクト編集](./project-editing.md)：レンダーする MIDI アレンジを組み立てる
- [録音とテイク](./recording-and-takes.md)：演奏をプロジェクトへ取り込む
- [リンクターゲット](./cpp-api.md#リンクターゲット)：C++ からこのシンセサイザーを鳴らす方法と、インストゥルメントだけに絞ったビルド
