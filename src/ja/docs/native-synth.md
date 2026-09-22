---
title: 内蔵シンセサイザー (NativeSynth)
description: libsonare のデータ不要なパッチ駆動シンセ NativeSynth を解説。17 種類の音作りエンジン、SynthPatch オブジェクト、名前付きプリセットカタログ、GM フォールバックバンク、オフライン／ライブでの鳴らし方を、そのまま使えるレシピつきで紹介します。
---

# 内蔵シンセサイザー (NativeSynth)

**NativeSynth は MIDI を単体で音にします** — ダウンロードするサンプルも、同梱する SoundFont も要りません。libsonare に組み込まれているので、MIDI トラックは何もしなくても最初から音が鳴ります。

最初に押さえることは 3 つだけです。

1. `acoustic-piano`、`warm-pad`、`drum-kit` のような名前付きプリセットを選ぶ。
2. そのプリセットを使う送出先（デスティネーション）へ MIDI ノートを送る。
3. 必要なら `cutoffHz`、`ampAttackMs`、`stereoSpread` など、聞いて分かりやすい項目だけを上書きする。

内部的には、NativeSynth は **17 個の差し替え可能な音作りエンジン**を備えた 1 台のシンセです。それぞれ、元になる音の作り方が異なります。アコースティック楽器系のいくつかは、まだ仮実装の物理モデルです。データ不要のプレビューやフォールバックには使えますが、最終的な音色調整／キャリブレーションは完了していません。

- バーチャルアナログ減算合成（定番のシンセリードやパッド）
- FM（エレクトリックピアノ、ベル、クラビネット）
- Karplus-Strong 撥弦（ギター、ベース、ハープ）
- モーダル打楽器（マリンバ、ビブラフォン）
- 加算ドローバーオルガン
- 膜打楽器（ドラムキット）
- 拡張導波路アコースティックピアノ
- 持続型フルーパイプオルガン
- ボウイング弦の導波路
- リード木管の導波路
- 金管リップリード導波路
- エアジェットフルート導波路
- バズブリッジの撥弦（箏、シタール、タンプーラ）
- ソースフィルター方式のボイス（合唱・ソロ）
- フリーリード（アコーディオン、ハーモニカ、バンドネオン）
- ジャック＆プレクトラム式ハープシコード（実際の弦のクワイアを備える）
- 利用者が用意した PCM を鳴らすサンプルプレイヤー

17 個すべてが、モジュレーション、エンベロープ、フィルター、ステレオ幅、ポリフォニーを扱う共通の制御層を通るため、違う音色でも同じパッチ項目で調整できます。音を出すには、プリセットを名前で選ぶか、プリセットを出発点に `SynthPatch` で必要な項目だけを上書きします。鳴らし始めるのにエンジン内部へ触れる必要はありません。

::: info 音作りの用語をまとめて把握
以下のエンジン名は、音色を*生成する*方式の違いです。最初から全部を知る必要はありません（プリセットを選んで鳴らせば十分です）。それぞれを 1 行で説明します。

- **subtractive**（減算合成） — 明るい波形から始め、フィルターで削っていく古典的なアナログシンセの手法です。
- **FM／位相変調** — 1 つのオシレーターの出力をもう 1 つの位相に加えます（DX 系が採る FM の実装方式です）。金属的で鐘のような音色になります。
- **Karplus-Strong** — 撥弦をモデル化する短い遅延ループです。
- **modal**（モーダル） — 叩いたバーや鐘をモデル化する、チューニングされた共鳴器のバンクです。
- **additive／drawbar**（加算／ドローバー） — ハモンドオルガンのドローバーのように、倍音のサイン波成分を足し合わせます。
- **（拡張）waveguide（導波路）** — 振動する弦や管をモデル化する遅延ラインです。
- **reed／brass／flute waveguide** — 木管・金管のための、息で励起される持続音モデルです。
- **バズブリッジ撥弦** — ブリッジを弦に触れさせて上部倍音へエネルギーを撒ける撥弦ループです。`buzz` が 0 ならクリーンに終端し（ハープ、箏）、`buzz` を上げるほどきらめきとびりつきが強くなります（シタール、タンプーラ）。
- **ソースフィルター方式のボイス** — 声門音源（ノコギリ波＋スペクトルティルト）を母音フォルマント共鳴のバンクに通し、合唱やソロの声を作ります。
- **フリーリード** — 駆動される金属リードの発振器（アコーディオン、ハーモニカ、バンドネオン）です。ミュゼットデチューンで 2 枚のうなるリードにもできます。
- **ジャック＆プレクトラム** — ハープシコード自身の機構です。クイルが独立した弦のクワイアからなるレジストレーションを弾くため、打鍵の速さが音量をほとんど変えません。
- **サンプル** — 合成はしません。利用者が渡した PCM フレームを鍵盤上にマッピングし、他のボイスと同じフィルターとモッドマトリクスを通して鳴らします。

パッチ操作でよく出てくる用語が 2 つあります。**ADSR エンベロープ**（attack／decay／sustain／release。音量などが、ノートの間にどう立ち上がり減衰するか）と、**モッドマトリクス**（LFO やエンベロープなどの変化の元を、ピッチやフィルターカットオフなどの送り先へつなぐ表）です。
:::

::: info MIDI は決して無音にならない
NativeSynth は [SoundFont プレイヤー](./soundfont-player.md)の**データ不要な土台**でもあります。SF2 経由でプロジェクトをバウンスしたとき、あるプログラム（または SoundFont 全体）が欠けていると、その音は NativeSynth の **GM フォールバックバンク**へ落ちます。128 種すべての General MIDI プログラムとドラムマップを備えているため、いずれにせよ音は出ます。バンクそのもの — GS バリエーション音色、ドラムキットバリエーション、GM プログラム追従 — は専用ページ [GM／GS フォールバックバンク](./gm-gs.md) で解説し、全 128 プログラムの音色は [GM 音色マップ](./gm-tone-map.md) にまとめています。
:::

::: tip NativeSynth の位置づけ
NativeSynth パッチは**インストゥルメント**です。MIDI デスティネーションへバインドすると、そのデスティネーションへルーティングされたトラックの MIDI が内蔵シンセサイザーで鳴ります。オフラインでは [`bounceWithSynthInstrument`](./project-bounce.md) でバインドし、ライブでは `engine.setSynthInstrument` でバインドして [MIDI 入力](./midi-input.md)を送ります。サンプルベースのマルチサンプル音色が必要なら、代わりに [SoundFont プレイヤー](./soundfont-player.md) を使ってください。
:::

どのノートにも、NativeSynth の中を 1 本のシグナルパスが流れます。MIDI ノートが 17 個のうち 1 つのエンジンを選び、そのエンジンがチェーン先頭のオシレーターの位置に入ります。その後ろのフィルター、アンプエンベロープ、ボディ共鳴は全エンジン共通で、モッドマトリクスは送り先が名指しする段へ直接届きます。図は、先頭のブロックに減算合成のオシレーターを置いた 1 つのボイスです。

<SynthSignalPathFigure
  title="1 つのボイスと、モッドマトリクスが届く先"
  :labels="{
    osc: 'オシレーター',
    oscSub1: '波形を 1 つ選ぶ:',
    oscSub2: 'sine saw square',
    oscSub3: 'triangle noise',
    oscSub4: 'unison 1–7 · detune',
    filter: 'フィルター',
    filterSub1: '4 モデルから 1 つ:',
    filterSub2: 'svf · moog-ladder',
    filterSub3: 'diode-ladder',
    filterSub4: 'sallen-key',
    amp: 'アンプ',
    ampSub1: 'ADSR エンベロープ',
    body: 'ボディ共鳴',
    bodySub1: 'guitar violin',
    bodySub2: 'wood-tube brass-bell',
    bodySub3: 'vocal · none',
    bodySub4: 'bodyMix 0–1',
    out: '出力',
    matrix: 'モッドマトリクス',
    matrixSub: '12 のソース × 12 の送り先・同時に有効なルーティングは最大 8 本',
    sources: 'ソース',
    noDest: '送り先ではない',
    loopNote: 'ソースへ戻る',
    legendChain: 'ボイスチェーン',
    legendBody: 'アンプ後段のボディ共鳴',
    legendRoute: 'モッドルーティング（同時に最大 8 本）',
  }"
/>

## このページで身につくこと

このページを読むと、次のことができるようになります。

- 音色に合った音作りエンジンと、適切な名前付きプリセットを選べる。
- プリセットを出発点に、`SynthPatch` で個々のフィールドを上書きできる。
- プリセット名と enum 名を推測せず、ランタイムから**実際の名前**を取得できる。
- `va:` ルーティング接頭辞と、`drum-kit` の GM ドラムマップを理解できる。
- `bounceWithSynthInstrument` でオフライン、`setSynthInstrument` でライブに MIDI を音声化できる。
- ある音が NativeSynth で鳴るのか、読み込んだ SoundFont で鳴るのかを判断できる。

::: tip まず鳴らしてみる
[シンセプレイグラウンド](/ja/synth) では、このシンセサイザーをブラウザで動かせます。キーボード、プリセットカタログ全体、パッチのライブ編集が揃っています。使っているのはインストゥルメントだけで、解析もマスタリングも動いていません。[クラシックシンセ](/ja/classic-synth) のほうは、減算合成エンジンを章ごとに分解していきます。4 種類のフィルタモデルを同じ音で聴き比べ、モジュレーション行列を手で結線し、ボディ共鳴を重ねる構成です。ADSR エンベロープ、フィルター、GS エフェクトといった個別の挙動は [インストゥルメントのデモ](/ja/demos) が扱います。
:::

## 17 個の音作りエンジン

各プリセットは 1 つの `engineMode` を選びます。共通部分（フィルター、エンベロープ、LFO、モッドマトリクス、ボディ共鳴、ポリフォニー）は、選択中のどのエンジンの上にも適用されます。エンジン固有の深いパラメータ（FM オペレータスタック、モーダルのモードテーブル、ドローバー設定、キットの各パーツ、ピアノの弦、パイプランク、ボウイング摩擦、リード／金管の管体、フルートのジェット形状）は、パッチではなく**名前付きプリセットの中**に収まっています。

::: warning プリセット経由でしか鳴らないエンジンが 4 つある
`fm`、`modal`、`percussion`、`sample` は、`engineMode` を指定しただけのパッチからは**無音**をレンダリングします。音を決めるのはパッチが持たないテーブル — FM オペレータのレベル、モーダルのモード一覧、キットと膜のモード、サンプルバンク — で、モードだけを名指ししたパッチにはそれがありません。代わりにプリセットから始めてください。`{ preset: 'e-piano' }`、`'marimba'`、`'drum-kit'`、あるいは `SampleBank` をバインドした `'sample'` パッチです。残り 13 個のエンジンはモード指定だけでも鳴りますが、音量はそろっていません。既定パッチに `engineMode: 'harpsichord'` を指定するとピークが他のエンジンの数倍になる一方、`harpsichord` プリセットは隣の音色と同じ高さに収まります。エンジンの生の出力を正規化する仕組みはありません。その差を埋めているのは各パッチ自身の `gain` で、しかもこの値は楽器ごとではなくエンジンごとにまとまっています。ハープシコードのパッチはバンクの最下段にあり、撥弦のパッチはその 4〜5 倍です。そのため GM ファイルは音量のそろった状態で鳴りますが、API で自分で組み立てたパッチには、指定した `gain` しか乗りません。
:::

### `subtractive` — バーチャルアナログ

オシレーター → フィルター → アンプという古典的なボイスです。デチューンユニゾン、ドリフト、フィルター前段のドライブ、4 種のフィルターモデルにより、太いソウリードから広がりのあるパッドまで作れます。**リード・ベース・パッド・プラック**、つまりアナログシンセで作りたいものに向きます。プリセット: `sine`、`saw`、`square`、`triangle`、`saw-lead`、`square-lead`、`sub-bass`、`warm-pad`。

<SonareDemo id="synth-note" />

「キャラクター」の核はフィルターモデルです。`filterModel` で 4 種の古典モデルを選べます。

| モデル | 回路トポロジー | 備考 |
|--------|----------------|------|
| `svf` | TPT ステートバリアブル | クリーン。`filterOutput`（lowpass / bandpass / highpass）を選べる唯一のモデル |
| `moog-ladder` | 4 ポールトランジスタラダー | ゼロディレイフィードバック、飽和ループ、自己発振する |
| `diode-ladder` | ダイオードラダー | 結合段 ZDF、自己発振する |
| `sallen-key` | ザレンキー | 自己発振する |

4 種とも、サンプル単位のカットオフ／レゾナンス変調下でも安定しジッパーノイズがなく、自己発振も決定論的です。

<SonareDemo id="synth-filter" />

### `fm` — 周波数変調

小さなアルゴリズムテーブルを持つ位相変調オペレータスタック（1 つのオシレーターの出力をもう 1 つの位相に加える → 金属的・鐘的な音色）で、指数エンベロープ、フィードバックオペレータ、ベロシティ → インデックス（明るさ）スケーリングを備えます。**エレクトリックピアノ・ベル・マレット・クラビネット・ブラス**、つまり減算合成が苦手な金属的・鐘的・非整数次倍音の音に向きます。**プリセット専用です。** `engineMode: 'fm'` だけを指定したパッチにはオペレータのレベルがなく、無音になります。`e-piano` から始めてください。

### `karplus-strong` — 撥弦

位相が正確にチューニングされた分数遅延導波路ループ（撥弦をモデル化する短い遅延ループ）に、ピック位置コム、ベロシティ駆動の明るさ、ディケイストレッチ、ノートオフ時のループダンピング（フィンガー／パームミュート）を加えたものです。ギター、ハープ、ベース系プリセットでは、仮実装の物理的な細部として、ピックアップ位置、ボディ結合、スチール弦の分散、開放弦の共鳴、弦の張りによるベンド、2 方向の振動による減衰差も使います。アコースティックなリアリティは**調整中**であり、完成済みの楽器モデルではありません。**撥弦・ストローク弦**、すなわちギター・ベース・ハープ・撥弦系民族楽器に向きます（ハープシコードは「明るいギター」ではなく、専用エンジンを持ちます。後述）。プリセット: `classical-guitar`、`steel-guitar`、`electric-guitar`、`harp`、`bass-acoustic`、`bass-fingered`、`bass-picked`、`bass-fretless`、`bass-slap`。

### `modal` — マレット打楽器

物理的なモード比（一様バーのグロッケン、深いアーチのマリンバ／ビブラフォン）に合わせたモーダル共鳴バンク（叩いたバーや鐘をモデル化する、チューニングされた共鳴器のバンク）で、マレット硬さのベロシティ重みづけとモードごとのディケイを持ちます。**音程のあるマレット楽器**、グロッケン・ビブラフォン・マリンバ・シロフォンに向きます。**プリセット専用です。** `engineMode: 'modal'` だけを指定したパッチはモード一覧が空で、無音になります。`marimba`、`glass`、`bell` のいずれかから始めてください。

### `additive` — ドローバーオルガン

9 本のハモンドドローバーのピッチ（倍音のサイン波成分を、ドローバー 1 本につき 1 成分として足し合わせる）をステップ状のストップレベルで鳴らし、フリーランの倍音位相とキークリックの接点トランジェントを備えます。**オルガン**、すなわち持続して倍音成分が豊かなレジストレーションに向きます。プリセット: `organ`。

### `percussion` — 膜打楽器

レイリーの円形膜モードに、下降するストライクピッチのエンベロープとフィルタードノイズを重ねたものです。このエンジンが **GM ドラムキット**（キック、スネアの胴とスナッピー、タム、ハット、非整数次倍音のリングモードを持つシンバル）を支えます。ワンショットで決定論的です。**プリセット専用です。** `engineMode: 'percussion'` だけを指定したパッチにはキットも膜のモードもなく、無音になります。`drum-kit` から始めてください。

### `piano` — 拡張導波路アコースティックピアノ

データ不要のグランドピアノのスケッチで、ピアノを定義する 4 要素を備えます。剛性弦の分散（鍵盤を上がるほど倍音成分がシャープに伸びる）、非線形フェルトハンマー（強打ほど短く明るい）、2-3 本の微デチューンユニゾン弦、響板共鳴バンクです。さらに音域ごとに音作りを変えるため、低音、中央の和音、高音が同じ単純な明るさカーブにはなりません。

その輪郭に加えて、聞こえ方を決める構造的な要素が 3 つあります。

- **弦の縦振動モード**をモデル化し、出力へ加算しています。打弦された弦は、横方向だけでなく長さ方向にも振動します。このモード群は横振動そのものが生む張力に駆動され、低音のアタックのおよそ 200 Hz〜3 kHz を埋めます。これがないと、低音は聞こえるというより体に感じるだけの音になります。
- **インハーモニシティは U 字カーブ**を描き、単調には増えません。剛性から予想されるとおり高音側へ向かって増えますが、低音のブレークより下では巻線弦が再び増加へ転じるため、鍵盤の最低部はそのすぐ上の音より非調和的です。
- **ストレッチチューニングは非対称なレイルズバックカーブ**です。A4 を基点として 2 本のべき乗則の枝が接続し、最低音でおよそ 10 セント低く、最高音で 50 セント高くなります。中央に対する奇関数 1 本では表せないのはこのためです。カーブはフィットした鍵盤の両端で保持し、その外側へ外挿はしません。

このボイスは**キャプチャーしたコンサートグランドに対して較正した明示的な出力レベル**も持ちます。物理モデルはそれ自体の出力レベルを持ちません。弦・ハンマー・響板がそれぞれ別の基準で較正され、その積は誰も選んでいない数値になるからです。この較正を行う前は、ピアノはフォールバックバンクの他の音色よりかなり下に沈んでいました。現在はヴァイオリンとアルトサックスの間に位置しており、グランドピアノが収まるべき場所です。

ただし、これは内蔵プレビュー向けの仮モデルであり、サンプルピアノの代替ではありません。**アコースティックピアノ**に向きます。プリセット: `acoustic-piano`。GM プログラム 0-3 と、ピアノ派生の 5 種類の [GS バリエーション音色](./gm-gs.md#gs-バリエーション音色)がこのエンジンを使います。

### `pipe-organ` — 持続型フルーパイプ

共有風圧、複数ランクのレジストレーション、リードパイプ色、マウス／放射補正を備えた、仮実装の導波路フルーパイプモデルです。プリンシパルやブルドンからフルート、トランペットランクまでの**教会オルガン系プレビュー音色**に向きます。プリセット: `church-organ`、`church-flute`、`church-bourdon`、`church-trumpet`。

### `bowed-string` — 摩擦励起の弦

ボウ速度／圧力／位置の制御、共鳴弦、第二偏波のうなり、ヴァイオリン属のボディ共鳴を備えた、持続型のボウイング弦導波路です。モデルは仮実装で、参照音源に対する調整は継続中です。**ヴァイオリン属のプレビュー**に向きます。プリセット: `violin`、`viola`、`cello`、`contrabass`。

### `reed` — リード木管

円筒管／円錐管の違い、トーンホール／成長円錐のふるまい、音域に応じた音作り、ライブの息・明るさ制御を備えたリード管体導波路です。キャリブレーション中の、GM フォールバック／プレビュー用の仮ボイスです。**シングルリード／ダブルリード木管とサックスのプレビュー**に向きます。プリセット: `clarinet`、`soprano-sax`、`alto-sax`、`tenor-sax`、`baritone-sax`、`oboe`、`english-horn`、`bassoon`。

### `brass` — リップリード金管

リップテンション、金管ベルのボディ共鳴、円筒／円錐の音色差、音域に応じた音作り、大音量時の明るい cuivré エッジを備えた金管導波路です。これは仮実装の物理モデルなので、完成済みの金管シミュレーションではなく、内蔵の金管フォールバックとして扱ってください。プリセット: `brass`、`trumpet`、`trombone`、`tuba`、`french-horn`、`muted-trumpet`、`cornet`、`flugelhorn`、`euphonium`。

### `flute` — エアジェットフルート

ジェット／反射の明るさ、息ノイズとチフ、オーバーブローの挙動、ビブラート制御を備えた、息駆動のエアジェット／開管モデルです。現在は**フルート、笛、オカリナ系のエッジトーン楽器**向けの仮フォールバックボイスです。プリセット: `concert-flute`、`piccolo`、`recorder`、`pan-flute`、`shakuhachi`、`tin-whistle`、`ocarina`、`blown-bottle`。

### `plucked-string` — バズブリッジ撥弦

ブリッジのモデルが弦をこすり続け、エネルギーを上部倍音へ撒き戻すことで、鳴っている間ずっと音がきらめき、うなる撥弦導波路です。`buzz` コントロールは、バズのないクリーンなハープや箏から、シタールの湾曲したジャワリブリッジや三味線のサワリが生む明るく持続するびりつきまでを連続的に変化させます。クリーンに終端する撥弦をモデル化する `karplus-strong` とは別物です。**箏／シタール系のバズブリッジ撥弦**に向きます（名前付きの `harp` プリセットは `karplus-strong` のままです。`pluck`、`bell`、`brass` は GM フォールバックのエイリアスで、名前から連想されるエンジンとは実際のエンジンが異なります）。プリセット: `pluck`、`harp-plucked`、`koto`、`sitar`、`tanpura`。

### `vocal` — ソースフィルター方式のボイス

2 段構成のボイスです。声門音源（1 次のスペクトルティルトで整形されたノコギリ波に、気息ノイズを加えたもの）が、歌唱母音に合わせた 5 つの共鳴バンドパスフォルマントのバンクを駆動します。この音源のノコギリ波は帯域制限**されていない**素のノコギリ波です。ソースフィルターの経路はフィードフォワードなので、生のノコギリ波が持つエイリアスは、オシレーターの段で防がれるのではなく、狭いフォルマントバンドパスによって減衰されます。`vowel` フィールドがフォルマントテーブル（/a/、/e/、/i/、/o/、/u/）を選び、`brightness` が音源を傾けて上部フォルマントを開き、ボイスごとのビブラートがピッチを変調します。**合唱・ソロの声のプレビュー**に向きます。プリセット: `choir-aah`、`choir-ooh`、`voice-eeh`。

### `free-reed` — 駆動されるフリーリード

駆動される金属リードの発振器（非対称サチュレーターとボディローパスで整形された位相アキュムレータ）で、アコーディオン・ハーモニカ・バンドネオンのフリーリードをモデル化します。リード自身のピッチがノートを決め、連成する気柱はありません。`detune` コントロールは、1 枚目より数セント高い 2 枚目のリードを加えます。この 2 枚が生むうなりが、きらめくミュゼットの響きです（`detune` が 0 なら 1 枚のリードに戻ります）。**アコーディオン・ハーモニカ・リードオルガンのプレビュー**に向きます。プリセット: `accordion`、`harmonica`、`bandoneon`、`reed-organ`。

### `harpsichord` — ジャック＆プレクトラム

音色つまみではなく機構そのものを軸に組み立てた、クイル撥弦のモデルです。この機構が生む 3 つの帰結は、つまみ付きの撥弦エンジンでは再現できません。**打鍵の速さが音量をほとんど変えません** — 楽器全体で数 dB の幅しかなく、しかも単調ですらありません。ある速さを超えるとプレクトラムが早く外れ、音はかえって*小さく*なるからです。このエンジンはベロシティカーブから完全に降りています。**レジストレーションは独立した弦のクワイア**であり、1 本の弦とミックスつまみではありません。2 組の 8′ ユニゾンと 1 組の 4′ オクターブは、3 つの周期を持つ 3 本の独立した遅延ラインです。そして**非調和的なきらめきは駒の後ろにある短い無制動の区間**から来るもので、弦の剛性からではありません。そのため発音する倍音成分は数セントの範囲で調和的なままです。**ハープシコード**に向きます。プリセット: `harpsichord`。

### `sample` — ホストが用意した PCM

唯一、何も合成しないエンジンです。モノラルの float フレームと鍵盤／ベロシティのゾーンからなる `SampleBank` を自分で構築し、パッチと一緒にバインドすると、エンジンがノートオン時にゾーンを解決して読み進めます。このエンジンは減算合成チェーンの*オシレーターの位置*に座るため、自前の音声が合成音とまったく同じ共鳴マルチモードフィルター、エンベロープ、LFO、モッドマトリクスの手前に届きます。これが [SoundFont プレイヤー](./soundfont-player.md) との違いです。あちらはコンテナを解析し、独自のジェネレーターモデルを持ち込む別のインストゥルメントです。**自前の録音やワンショットのドラム素材**に向きます。**バンク専用です。** プリセットはなく、`SampleBank` をバインドせずに `engineMode: 'sample'` だけを指定したパッチは無音をレンダリングします。パッチのフィールドは [ホストの PCM: `sample` エンジン](#ホストの-pcm-sample-エンジン)を参照してください。

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
//   unison: 7, detuneCents: 18, cutoffHz: 2800, ampAttackMs: 400, ... }
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
#            unison=7, detune_cents=18.0, cutoff_hz=2800.0, ...)
```

:::

カタログとエンジンの対応は次のとおりです（各エンジンの感触は 1 行で十分つかめます）。

| プリセット | エンジン | 向いている用途 |
|------------|----------|----------------|
| `sine` `saw` `square` `triangle` `saw-lead` `square-lead` `sub-bass` `warm-pad` | `subtractive` | リード・ベース・パッド |
| `e-piano` | `fm` | エレピ・ベル・ブラス |
| `classical-guitar` `steel-guitar` `electric-guitar` `harp` `bass-acoustic` `bass-fingered` `bass-picked` `bass-fretless` `bass-slap` | `karplus-strong` | 撥弦とベース |
| `marimba` `glass` `bell` | `modal` | 音程のあるマレット |
| `organ` | `additive` | ドローバーオルガン |
| `drum-kit` | `percussion` | GM ドラムマップ |
| `acoustic-piano` | `piano` | アコースティックピアノ |
| `church-organ` `church-flute` `church-bourdon` `church-trumpet` | `pipe-organ` | パイプオルガンのランク |
| `violin` `viola` `cello` `contrabass` | `bowed-string` | ボウイング弦 |
| `clarinet` `soprano-sax` `alto-sax` `tenor-sax` `baritone-sax` `oboe` `english-horn` `bassoon` | `reed` | リード木管 |
| `brass` `trumpet` `trombone` `tuba` `french-horn` `muted-trumpet` `cornet` `flugelhorn` `euphonium` | `brass` | 金管 |
| `concert-flute` `piccolo` `recorder` `pan-flute` `shakuhachi` `tin-whistle` `ocarina` `blown-bottle` | `flute` | エアジェットフルートと笛 |
| `pluck` `harp-plucked` `koto` `sitar` `tanpura` | `plucked-string` | バズブリッジの撥弦 |
| `choir-aah` `choir-ooh` `voice-eeh` | `vocal` | 合唱・ソロの声 |
| `accordion` `harmonica` `bandoneon` `reed-organ` | `free-reed` | アコーディオン、ハーモニカ、リードオルガン |
| `harpsichord` | `harpsichord` | ハープシコード |

下のロールは1つの3声フレーズをシーケンスし、`bounceWithSynthInstrument(presetName, …)` でバウンスします。楽器セレクタは、ピアノ、FM、撥弦、モーダル、オルガン、ボウイング弦、リード、金管、フルートの代表プリセットをまたぐので、同じ音符がそれぞれのエンジンの性格を帯びるのが聞き取れます。

<SonareDemo id="midi-piano-roll" />

### `va:` ルーティング接頭辞

プリセット名には `va:` 接頭辞を付けられます（例: `va:saw-lead`、`va:e-piano`）。この接頭辞はプリセット名を受け取るすべての場所 — `synthPresetPatch`、`bounceWithSynthInstrument`、`setSynthInstrument` — で**受け付けられ**、接頭辞なしと同じパッチに解決されます。これは「このデスティネーションはバーチャルアナログの NativeSynth を鳴らす」と印を付けるためにホストが使うルーティング規約で、シンセは検索前に取り除きます。

## `SynthPatch` オブジェクト

`SynthPatch` は「プリセット + あなたの調整」と考えてください。**ベース**（名前付き `preset`。省略すると既定の減算合成 init パッチ）から始まり、設定した各フィールドがそのベースを上書きします。フィールドを省けば、ベース値がそのまま残ります。

初学者には、小さく戻しやすい調整から始めるのがおすすめです。たとえば `warm-pad` を選び、`ampAttackMs` を長くしてゆっくり立ち上がる音にする、`cutoffHz` を下げて暗い音にする、`stereoSpread` を上げて広がりを出す、という具合です。オブジェクト全体を埋める必要はありません。

::: warning 「省略」と「0」は別物
ベースを上書きするかどうかを決めるのは、値ではなく**設定されたかどうか**です。数値フィールドを省けばベース値が残り、設定すれば可聴域にクランプされたうえでベースを上書きします。これは明示的な `0` も同じで、`ampSustain: 0` と書けばサスティンは本当に 0 まで下がり、`stereoSpread: 0` と書けば本当に中央へ寄ります。enum フィールドは従来どおり `'default'` が「保つ」を意味します。

パッチはフィールドごとの「設定済みか」の記録を構造体バージョンとともに持っており、これが「省略」と「0」を区別しています。以前のビルドは両者を区別できず 0 を「未変更」として扱うほかなかったため、古いコードでは本当の 0 に近づけるために `ampSustain: 0.001` のような便宜的な値を書くことがありました。この回避策はもう不要です。意図した `0` をそのまま書いてください。

もう 1 つのルールとして、空でない `modRoutings` 配列は、ベースのモッドマトリクスへ追加するのではなく、**まるごと置き換え**ます。空配列は消去し、キーを省略した場合はベースのマトリクスが保たれます。
:::

パッチは、すべてのエンジンが共有する共通部分を公開します。

<SonareDemo id="synth-adsr" />

::: info セント・ベロシティ・キートラッキング
- **セント**（cent） — 半音の 1/100 です。100 セントでピアノの 1 鍵分、1200 で 1 オクターブです。ピッチやデチューンの量はセントで表します。
- **ベロシティ** — ノートをどれだけ強く弾いたか（0〜127）です。プリセットはこれで明るさや音量を制御します。
- **キートラッキング** — フィルターカットオフなどのパラメータを、鍵盤を上がるほどノートの音高に追従させることです。
:::

| グループ | フィールド |
|----------|------------|
| オシレーター | `engineMode`、`waveform`、`unison`（1-7）、`detuneCents`、`driftCents`、`drive`（0-1） |
| フィルター | `filterModel`、`filterOutput`（SVF のみ）、`cutoffHz`、`resonanceQ`、`keyTrack`（0-1）、`envToCutoffCents`、`velToCutoffCents` |
| アンプエンベロープ | `ampAttackMs`、`ampDecayMs`、`ampSustain`、`ampReleaseMs` |
| フィルターエンベロープ | `filterAttackMs`、`filterDecayMs`、`filterSustain`、`filterReleaseMs` |
| LFO とグライド | `lfoRateHz`、`lfoToPitchCents`、`lfo2RateHz`、`glideMs` |
| ボディ共鳴 | `body`（`none` / `guitar` / `violin` / `wood-tube` / `brass-bell` / `vocal`）、`bodyMix`（0-1） |
| ステレオと出力 | `stereoSpread`（0-1）、`gain`（リニア）、`polyphony`（1-64）、`busDrive`（0-1） |
| モッドマトリクス | `modRoutings`（最大 8 本） |
| バインディング（JS のみ） | `destinationId`（既定 `0`） |

（**ポリフォニー**は同時に鳴らせるノート数、**ボイス**は鳴っている 1 つのノートで、**ボイススティール**は足りなくなったとき最も古いノートを止めることです。）

::: info LFO 2 にはルーティングが必要
2 つの LFO は挙動が異なります。LFO 1（`lfoRateHz` + `lfoToPitchCents`）はピッチへ固定配線されており、単独でビブラートを生みます。LFO 2 はマトリクス経由専用で、`modRoutings` のエントリが `source: 'lfo2'` で送り先を指定するまで、`lfo2RateHz` を設定しても何も起きません。
:::

各**モッドルーティング**は `{ source, destination, depth }` です。マトリクスは 12 のソース — 2 つのエンベロープ、2 つの LFO、ベロシティ、キートラッキング、モッドホイール、シード付きのボイスごとランダムソース、ブレス、アフタータッチ、エクスプレッション、ピッチベンド — を 12 の送り先へつなぎます。送り先はピッチ、ビブラート深さ、カットオフ、レゾナンス、フィルターエンベロープ深さ、音量、パン、LFO 1 のレート、そして物理モデル系エンジンが持つ 4 つの励振軸です。`depth` はソースが最大振れたときの destination 単位です。

<SonareDemo id="synth-tremolo" />

`body` フィールドは NativeSynth のボディ／フォルマント共鳴層 — 楽器の物理的な筐体や声道がもつ共鳴的なキャラクターです。アコースティックギター、ハープ、ヴァイオリン属、木管、金管、合唱／声のフォールバックはこの層を使います。ソリッドボディのエレキは `body` を `none` のままにできます。

`body: 'vocal'` は母音フォルマントのバンクで、`vocal` エンジン専用ではなく**どのパッチからでも**使えます。減算合成のオシレーターをこれに通すと、フィルターをかけたノコギリ波ではなく歌声の音色になります。GM フォールバックバンクが Lead 6 (voice) と Pad 4 (choir) を鳴らしているのがまさにこの方法で、この 2 つが周囲のシンセリードやパッドと違って聞こえるのはそのためです。

::: info ピッチベンド・コントローラーリセット・チャンネル単位の状態
NativeSynth は**ピッチベンド**メッセージに反応し、ベンドレンジは **RPN 0**（ピッチベンドレンジの標準パラメータ。**CC6／CC38** の Data Entry MSB／LSB 微細バイトペアで設定、既定は ±2 半音）に従います。MIDI の **Reset All Controllers** メッセージは、演奏系コントローラー（モッドホイール、エクスプレッション、ピッチベンド値、各ペダル）と RPN／NRPN の選択状態を既定へ戻しますが、ベンドレンジは設定した値のまま意図的に残します。±2 半音へ戻したいときは、RPN 0 をあらためて送ってください。必要なのは通常の MIDI イベントです。ピッチベンドイベント（オフラインなら `Project.midiPitchBend(...)` など）と、ストリーム中の RPN 0／Data Entry／リセットの各 CC です。

この状態は**チャンネル単位で管理され、ノート単位ではありません**。NativeSynth はポリフォニック（ノートごと）圧力もチャンネルプレッシャーも一切追跡せず、MIDI 2.0 のノートベロシティは 16 ビットのフル解像度ではなく通常の 7 ビットへ丸められます。MPE（MIDI Polyphonic Expression）スタイルのノートごとピッチベンド／プレッシャーやフル 16 ビットのベロシティが必要な場合は、代わりによりシンプルな内蔵の波形シンセ（`setBuiltinInstrument`）を使ってください。詳しくは[MIDI 入力](./midi-input.md)を参照してください。

ピアノ系のペダル操作も通常の MIDI CC としてデコードされます。ただし、サスティンペダル **CC64** のハーフペダルダンピングが効くのは `piano` エンジンだけです。そこでは 64〜126 の中間値が、鍵を離して鳴り続けているノートを値に応じて減衰させます。他のエンジンでは CC64 は 64 を境にした単純なオン／オフのサスティンで、64 でも 126 でも 127 と同じ鳴り方になります。**CC66** はソステヌート、**CC67** は対応プリセットで una corda／ソフトペダルの音色として働きます。
:::

### enum 名テーブル

各 enum フィールドは、名前文字列または C の序数のどちらも受け付けます。名前と序数がずれないよう、`synthEnumTables()` でランタイムから正規のテーブルを取得してください。

```typescript
import { init, synthEnumTables } from '@libraz/libsonare';

await init();
synthEnumTables();
// {
//   engineModes:      ['default', 'subtractive', 'fm', 'karplus-strong',
//                      'modal', 'additive', 'percussion', 'piano',
//                      'pipe-organ', 'bowed-string', 'reed', 'brass', 'flute',
//                      'plucked-string', 'vocal', 'free-reed', 'harpsichord',
//                      'sample'],
//   waveforms:        ['default', 'sine', 'saw', 'square', 'triangle', 'noise'],
//   builtinWaveforms: ['sine', 'saw', 'sawtooth', 'square', 'triangle'],
//   filterModels:     ['default', 'svf', 'moog-ladder', 'diode-ladder', 'sallen-key'],
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
// }
```

同じ配列は名前付き定数（`SYNTH_ENGINE_MODES`、`SYNTH_OSC_WAVEFORMS`、`SYNTH_FILTER_MODELS`、`SYNTH_FILTER_OUTPUTS`、`SYNTH_BODY_TYPES`、`SYNTH_MOD_SOURCES`、`SYNTH_MOD_DESTINATIONS`、および `BUILTIN_SYNTH_WAVEFORMS`）としてもエクスポートされます。多くのテーブルでインデックス 0 は `'default'`（ベース値を保つ）で、`modSources` / `modDestinations` は代わりに `'none'` を使います。

`builtinWaveforms` / `BUILTIN_SYNTH_WAVEFORMS` は別系統のリストです。これは NativeSynth の `waveform` フィールドではなく、最小構成の内蔵オシレーターシンセ（`setBuiltinInstrument`）が受け付ける名前を表します。`'default'` を持たず、`'saw'` に加えて `'sawtooth'` も受け付け、`'noise'` は受け付けません。

### ホストの PCM: `sample` エンジン

`sample` エンジンは、自分で構築した `SampleBank` から音声を読み出します。手順は 3 つです。モノラルの float フレームを追加し、それに鍵盤／ベロシティの矩形を対応づけ、`engineMode` が `'sample'` のパッチと一緒にバンクをバインドします。

```typescript
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

**ゾーン**は 1 つのサンプルを指す鍵盤／ベロシティの矩形です。境界はそれぞれ独立に既定値を持つため、`{}` はあらゆるベロシティでの鍵盤全体を意味し、片方の軸を狭めてももう片方は全体のまま残ります。ゾーンは番号付きの**セット**に属し、パッチは `sampleSet` で鳴らすセットを指定します。バンクはバインドするバウンスが始まる前に完成させてください。サンプルプールは連続領域で、拡張時に移動するため、何かが鳴っている最中に追加すると、それを読んでいるボイスが無効になります。

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

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const engine = new RealtimeEngine(48000, 128);
try {
  engine.setSynthInstrument('va:saw-lead', 7);   // 出力先 7 へバインド
  engine.pushMidiNoteOn(7, 0, 0, 60, 100);       // 出力先, グループ, チャンネル, ノート, ベロシティ

  const out = engine.process([new Float32Array(128), new Float32Array(128)]);
  // out[0] / out[1] がレンダー済みのステレオブロック。無音ではない

  engine.midiInstrumentCount();                   // 1
} finally {
  engine.destroy();   // ネイティブハンドルを解放
}
```

実際のアプリではライブキーボードから `pushMidiNoteOn` / `pushMidiNoteOff` / `pushMidiCc` を呼ぶか、エンジン所有の MIDI 入力ソースを有効にしてイベントを到着順に送ります。詳しくは [MIDI 入力](./midi-input.md) を参照してください。`setSynthInstrument` はプリセット名や `SynthPatch` を `bounceWithSynthInstrument` とまったく同じように解決するため、オフラインで作り込んだ音色がライブでも同一に鳴ります。

## 現状と制限

**物理モデルの多くは暫定であり、較正は継続中です。** 10 個のエンジン（ピアノ、撥弦（Karplus-Strong）、擦弦、リード木管、金管、エアジェット・フルート、パイプオルガン、バズブリッジ撥弦、ソースフィルターボイス、フリーリード）はアコースティック楽器の暫定的な物理モデルです（モーダル、膜鳴パーカッション、ハープシコードも物理モデルですが、こちらは音作りが確定しています。後述）。これらはデータ非依存のプレビューおよび GM フォールバックの土台を目的としており、サンプル音源の完成版を置き換えるものではありません。音作りは、参照 SoundFont と比較する開発者向けの A/B ハーネスで調整していますが、これは手動かつ継続中の作業であり、自動較正でも参照楽器に対する検証済みでもなく、調整は完了していません。ピアノ・オルガン・金管・リード・ヴァイオリン属の音作りの調整は継続しています。

**ピアノとバンク内の他音色とのバランスが変わりました。** アコースティックピアノは、物理から偶然決まった出力レベルではなく、キャプチャーしたコンサートグランドに対して測定した出力レベルを持つようになりました。以前のバランスを前提にしていたもの（保存したミックス、バウンス済みのレンダー、そのハッシュなど）は結果が変わります。

**一部の高度な物理は実装済みですが、まだ到達できません。** 擦弦・リード・金管・フルートの各エンジンには、より高度な非線形の要素（弾塑性の弓摩擦、トーンホール散乱、金管の「キュイヴレ」の輝き、フルートのオーバーブロー等）が含まれます。これらはコアに存在しますが既定でオフで、有効化するスイッチを公開しているバインディングはまだありません。したがって現状の音は、より単純な線形モデルです。今後のリリースで到達可能になり、音作りも改善が続く見込みです。

**自己発振する一部のモデルにはわずかな残留音程誤差があります。** エアジェット・フルートとフルー式パイプオルガンは素朴なチューニングからわずかにずれてロックするため、較正係数で補正していますが、音域に依存する小さな残差が残ります。

**残るエンジンは安定しています。** 減算（バーチャルアナログ）、FM、加算（ドローバーオルガン）は信号ベース（非物理）で、モーダル（マレット／ベル）、膜鳴（パーカッション）、ジャック＆プレクトラム式ハープシコードは音作りが確定した物理モデルです。`sample` エンジンは渡されたものをそのまま鳴らすため、自身の音作りを持ちません。いずれも暫定的な注意書きはありません。

**音の出どころについて**。各合成エンジンは、公開されている合成・物理モデリングのアルゴリズム系統を独自に実装したものであり、GM/GS の挙動は公開されている General MIDI／GS のアドレス指定に従います。サンプリングや録音による楽器音は同梱しておらず、特定機器の複製ではなく独立した再構成です。各エンジンの背景にある標準や論文については、[アルゴリズム根拠](./algorithm-references.md)を参照してください。

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
各ノートはピッチとしてではなく、対応する GM のパーツを鳴らします。
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

- [プロジェクトバウンス](./project-bounce.md) — すべての `bounceWith*` インストゥルメントが共有するオフラインレンダーのオプション
- [SoundFont プレイヤー](./soundfont-player.md) — サンプルベースの音色。NativeSynth が GM フォールバックの土台
- [MIDI 入力](./midi-input.md) — バインドしたインストゥルメントへライブ／スケジュール MIDI を送る
- [プロジェクト編集](./project-editing.md) — レンダーする MIDI アレンジを組み立てる
- [録音とテイク](./recording-and-takes.md) — 演奏をプロジェクトへ取り込む
- [リンクターゲット](./cpp-api.md#リンクターゲット) — C++ からこのシンセサイザーを鳴らす方法と、インストゥルメントだけに絞ったビルド

## 各節の移動先

| 節 | 移動先 |
|---|---|
| GM フォールバックバンク（GS バリエーション音色を含む） | [GM／GS フォールバックバンク](./gm-gs.md) |
| `drum-kit` プリセットと GM ドラムマップ | [GM／GS フォールバックバンク](./gm-gs.md) |
| GS / GM ドラムキットバリエーション | [GM／GS フォールバックバンク](./gm-gs.md) |
| パッチを固定せず GM プログラムに追従させる | [GM／GS フォールバックバンク](./gm-gs.md) |
| NativeSynth と SoundFont フォールバック（GM フォールバックのプログラムルーティングを含む） | [GM／GS フォールバックバンク](./gm-gs.md) |
| GM 音色マップ — 全128プログラム | [GM 音色マップ](./gm-tone-map.md) |
