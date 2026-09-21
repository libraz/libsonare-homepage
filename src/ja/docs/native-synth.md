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
NativeSynth は [SoundFont プレイヤー](./soundfont-player.md)の**データ不要な土台**でもあります。SF2 経由でプロジェクトをバウンスしたとき、あるプログラム（または SoundFont 全体）が欠けていると、その音は NativeSynth の **GM フォールバックバンク**へ落ちます。128 種すべての General MIDI プログラムとドラムマップを備えているため、いずれにせよ音は出ます。
:::

::: tip NativeSynth の位置づけ
NativeSynth パッチは**インストゥルメント**です。MIDI デスティネーションへバインドすると、そのデスティネーションへルーティングされたトラックの MIDI が内蔵シンセサイザーで鳴ります。オフラインでは [`bounceWithSynthInstrument`](./project-bounce.md) でバインドし、ライブでは `engine.setSynthInstrument` でバインドして [MIDI 入力](./midi-input.md)を送ります。サンプルベースのマルチサンプル音色が必要なら、代わりに [SoundFont プレイヤー](./soundfont-player.md) を使ってください。
:::

どのノートにも、NativeSynth の中を 1 本のシグナルパスが流れます。MIDI ノートが 17 個のうち 1 つのエンジンを選び、そのエンジンの素の音色が共通の制御層を通ってからステレオ出力へ届きます。

<FlowDiagram
  title="NativeSynth のシグナルパス"
  :nodes="[
    { id: 'note', label: 'MIDI ノート', col: 0, row: 0 },
    { id: 'engine', label: 'エンジン選択', col: 1, row: 0, variant: 'decision', group: 'engines' },
    { id: 'filter', label: 'フィルター', col: 2, row: 0, group: 'control' },
    { id: 'env', label: 'アンプ／フィルターの ADSR', col: 3, row: 0, group: 'control' },
    { id: 'lfo', label: 'LFO／モッドマトリクス', col: 4, row: 0, group: 'control' },
    { id: 'body', label: 'ボディ共鳴', col: 5, row: 0, group: 'control' },
    { id: 'spread', label: 'ステレオスプレッド', col: 6, row: 0, group: 'control' },
    { id: 'out', label: 'ステレオ音声出力', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'note', to: 'engine' },
    { from: 'engine', to: 'filter' },
    { from: 'filter', to: 'env' },
    { from: 'env', to: 'lfo' },
    { from: 'lfo', to: 'body' },
    { from: 'body', to: 'spread' },
    { from: 'spread', to: 'out' }
  ]"
  :groups="[
    { id: 'engines', label: '17 個のうち 1 つ' },
    { id: 'control', label: '共通の制御層' }
  ]"
  caption="どのエンジンが選ばれても、その後は同じ共通の制御層とパッチ項目が適用されます。"
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
[シンセプレイグラウンド](/ja/synth) では、このシンセサイザーをブラウザで動かせます。キーボード、プリセットカタログ全体、パッチのライブ編集が揃っています。使っているのはインストゥルメントだけで、解析もマスタリングも動いていません。ADSR エンベロープ、フィルター、GS エフェクトといった個別の挙動は [インストゥルメントのデモ](/ja/demos) が扱います。
:::

## 17 個の音作りエンジン

各プリセットは 1 つの `engineMode` を選びます。共通部分（フィルター、エンベロープ、LFO、モッドマトリクス、ボディ共鳴、ポリフォニー）は、選択中のどのエンジンの上にも適用されます。エンジン固有の深いパラメータ（FM オペレータスタック、モーダルのモードテーブル、ドローバー設定、キットの各パーツ、ピアノの弦、パイプランク、ボウイング摩擦、リード／金管の管体、フルートのジェット形状）は、パッチではなく**名前付きプリセットの中**に収まっています。

### `subtractive` — バーチャルアナログ

オシレーター → フィルター → アンプという古典的なボイスです。デチューンユニゾン、ドリフト、フィルター前段のドライブ、4 種のフィルターモデルにより、太いソウリードから広がりのあるパッドまで作れます。**リード・ベース・パッド・プラック**、つまりアナログシンセで作りたいものに向きます。プリセット: `sine`、`saw`、`square`、`triangle`、`saw-lead`、`square-lead`、`sub-bass`、`warm-pad`。

<SonareDemo id="synth-note" />

「キャラクター」の核はフィルターモデルです。`filterModel` で 4 種の古典モデルを選べます。

| モデル | 模した音色 | 備考 |
|--------|------------|------|
| `svf` | TPT ステートバリアブル（SEM 系） | クリーン。`filterOutput`（lowpass / bandpass / highpass）を選べる唯一のモデル |
| `moog-ladder` | 4 ポールトランジスタラダー | ゼロディレイフィードバック、飽和ループ、自己発振する |
| `diode-ladder` | ダイオードラダー（VCS3 / TB-303 系） | 結合段 ZDF、自己発振する |
| `sallen-key` | Korg35 ザレンキー（MS-10 / 初期 MS-20） | 自己発振する |

4 種とも、サンプル単位のカットオフ／レゾナンス変調下でも安定しジッパーノイズがなく、自己発振も決定論的です。

<SonareDemo id="synth-filter" />

### `fm` — 周波数変調

小さなアルゴリズムテーブルを持つ位相変調オペレータスタック（1 つのオシレーターの出力をもう 1 つの位相に加える → 金属的・鐘的な音色）で、指数エンベロープ、フィードバックオペレータ、ベロシティ → インデックス（明るさ）スケーリングを備えます。**エレクトリックピアノ・ベル・マレット・クラビネット・ブラス**、つまり減算合成が苦手な金属的・鐘的・非整数次倍音の音に向きます。プリセット: `e-piano`。

### `karplus-strong` — 撥弦

位相が正確にチューニングされた分数遅延導波路ループ（撥弦をモデル化する短い遅延ループ）に、ピック位置コム、ベロシティ駆動の明るさ、ディケイストレッチ、ノートオフ時のループダンピング（フィンガー／パームミュート）を加えたものです。ギター、ハープ、ベース系プリセットでは、仮実装の物理的な細部として、ピックアップ位置、ボディ結合、スチール弦の分散、開放弦の共鳴、弦の張りによるベンド、2 方向の振動による減衰差も使います。アコースティックなリアリティは**調整中**であり、完成済みの楽器モデルではありません。**撥弦・ストローク弦**、すなわちギター・ベース・ハープ・撥弦系民族楽器に向きます（ハープシコードは「明るいギター」ではなく、専用エンジンを持ちます。後述）。プリセット: `classical-guitar`、`steel-guitar`、`electric-guitar`、`harp`、`bass-acoustic`、`bass-fingered`、`bass-picked`、`bass-fretless`、`bass-slap`。

### `modal` — マレット打楽器

物理的なモード比（一様バーのグロッケン、深いアーチのマリンバ／ビブラフォン）に合わせたモーダル共鳴バンク（叩いたバーや鐘をモデル化する、チューニングされた共鳴器のバンク）で、マレット硬さのベロシティ重みづけとモードごとのディケイを持ちます。**音程のあるマレット楽器**、グロッケン・ビブラフォン・マリンバ・シロフォンに向きます。プリセット: `marimba`、`glass`、`bell`。

### `additive` — ドローバーオルガン

9 本のハモンドドローバーのピッチ（倍音のサイン波成分を、ドローバー 1 本につき 1 成分として足し合わせる）をステップ状のストップレベルで鳴らし、フリーランの倍音位相とキークリックの接点トランジェントを備えます。**オルガン**、すなわち持続して倍音成分が豊かなレジストレーションに向きます。プリセット: `organ`。

### `percussion` — 膜打楽器

レイリーの円形膜モードに、下降するストライクピッチのエンベロープとフィルタードノイズを重ねたものです。このエンジンが **GM ドラムキット**（キック、スネアの胴とスナッピー、タム、ハット、非整数次倍音のリングモードを持つシンバル）を支えます。ワンショットで決定論的です。プリセット: `drum-kit`。

### `piano` — 拡張導波路アコースティックピアノ

データ不要のグランドピアノのスケッチで、ピアノを定義する 4 要素を備えます。剛性弦の分散（鍵盤を上がるほど倍音成分がシャープに伸びる）、非線形フェルトハンマー（強打ほど短く明るい）、2-3 本の微デチューンユニゾン弦、響板共鳴バンクです。さらに音域ごとに音作りを変えるため、低音、中央の和音、高音が同じ単純な明るさカーブにはなりません。

その輪郭に加えて、聞こえ方を決める構造的な要素が 3 つあります。

- **弦の縦振動モード**をモデル化し、出力へ加算しています。打弦された弦は、横方向だけでなく長さ方向にも振動します。このモード群は横振動そのものが生む張力に駆動され、低音のアタックのおよそ 200 Hz〜3 kHz を埋めます。これがないと、低音は聞こえるというより体に感じるだけの音になります。
- **インハーモニシティは U 字カーブ**を描き、単調には増えません。剛性から予想されるとおり高音側へ向かって増えますが、低音のブレークより下では巻線弦が再び増加へ転じるため、鍵盤の最低部はそのすぐ上の音より非調和的です。
- **ストレッチチューニングは非対称なレイルズバックカーブ**です。A4 を基点として 2 本のべき乗則の枝が接続し、最低音でおよそ 10 セント低く、最高音で 50 セント高くなります。中央に対する奇関数 1 本では表せないのはこのためです。カーブはフィットした鍵盤の両端で保持し、その外側へ外挿はしません。

このボイスは**キャプチャーしたコンサートグランドに対して較正した明示的な出力レベル**も持ちます。物理モデルはそれ自体の出力レベルを持ちません。弦・ハンマー・響板がそれぞれ別の基準で較正され、その積は誰も選んでいない数値になるからです。この較正を行う前は、ピアノはフォールバックバンクの他の音色よりかなり下に沈んでいました。現在はヴァイオリンとアルトサックスの間に位置しており、グランドピアノが収まるべき場所です。

ただし、これは内蔵プレビュー向けの仮モデルであり、サンプルピアノの代替ではありません。**アコースティックピアノ**に向きます。プリセット: `acoustic-piano`。GM プログラム 0-3 と、ピアノ派生の 5 種類の [GS バリエーション音色](#gs-バリエーション音色)がこのエンジンを使います。

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

唯一、何も合成しないエンジンです。モノラルの float フレームと鍵盤／ベロシティのゾーンからなる `SampleBank` を自分で構築し、パッチと一緒にバインドすると、エンジンがノートオン時にゾーンを解決して読み進めます。このエンジンは減算合成チェーンの*オシレーターの位置*に座るため、自前の音声が合成音とまったく同じ共鳴マルチモードフィルター、エンベロープ、LFO、モッドマトリクスの手前に届きます。これが [SoundFont プレイヤー](./soundfont-player.md) との違いです。あちらはコンテナを解析し、独自のジェネレーターモデルを持ち込む別のインストゥルメントです。**自前の録音やワンショットのドラム素材**に向きます。プリセットはありません。バンクをバインドしない `sample` パッチは無音をレンダリングします。パッチのフィールドは [ホストの PCM: `sample` エンジン](#ホストの-pcm-sample-エンジン)を参照してください。

## GM フォールバックバンク

GM フォールバックは、最後の手段として単純なサイン波を鳴らすだけのバンクではありません。SoundFont が未読み込み、または一部のプログラムを持たないとき、NativeSynth は要求された GM プログラムに近い内蔵の合成音源を選びます。その一部は、まだキャリブレーション中の仮実装物理モデルです。目的は、データ不要のプレビューと欠けたプログラムのカバーであり、完成済みのサンプル楽器並みのリアリティではありません。

| GM 領域 | データ不要のフォールバック音源 |
|---------|-------------------------------|
| プログラム 0-7、鍵盤 | 拡張導波路グランドピアノ、FM エレピ／クラビ、3 種のレジストレーションを持つジャック＆プレクトラム式ハープシコード |
| プログラム 8-15、クロマチックパーカッション | モーダルのチェレスタ、グロッケン、オルゴール、ビブラフォン、マリンバ、シロフォン、チューブラーベル、それに Karplus-Strong のダルシマー |
| プログラム 16-23、オルガン | 加算ドローバーオルガン（16-18）、物理モデルの教会オルガンのフルーパイプ（19）、フリーリードエンジンのリードオルガン／アコーディオン、ハーモニカ、バンドネオン（20-23） |
| プログラム 24-37、ギター／ベース | Karplus-Strong のナイロン、スチール、エレキ、ミュート／オーバードライブ／ディストーションギター、ベース各種 |
| プログラム 40-47、弦／オーケストラ | ボウイング弦、トレモロ弦のパッド、Karplus-Strong のピチカート弦とハープ、ティンパニのフォールバック |
| プログラム 52-54、合唱／声 | 専用のソースフィルター方式のボーカルエンジンで鳴らす choir、voice ooh、synth voice |
| プログラム 56-79、金管／リード／フルート | 仮実装のリップリード金管（56-60）と FM 金管（61-63）、リード木管／サックス、エアジェットフルート |
| プログラム 104-107、エスニック撥弦 | バズブリッジ撥弦のシタール（104）、三味線（106）、箏（107）。バンジョー（105）は Karplus-Strong のまま |
| プログラム 112-119、パーカッシブ | パーカッションエンジンのチンクルベル、アゴゴ、スティールドラム、ウッドブロック、太鼓、メロディックタム、シンセドラム、リバースシンバル |
| ドラムと GS バリエーション | GM/GS ドラムキットのバリエーション、GM2/GS バンクフォールバック。利用可能な場合は GS EFX を内蔵インサートチェーンへルーティング |

あらかじめ知っておきたい点が 1 つあります。`bourdon` や `trumpet-rank` のような名前付きパイプオルガン色は名前付きプリセットカタログにのみ存在し、GM プログラムルーティングには現れません（プログラム19は教会オルガンのフルーパイプで、プログラム20-23はフリーリードのリードオルガン、ハーモニカ、バンドネオンです）。

初学者向けに言い換えると、**正確な音色や本番向けのサンプル楽器が必要なら SoundFont を使い、軽量で常に鳴るプレビューや欠けたプログラムの保険には NativeSynth フォールバックを使う**、という使い分けです。

### GS バリエーション音色

GM のプログラム番号が選ぶのは*キャピタル*音色です。GS と GM2 はどちらも、プログラムチェンジの前に Bank Select を送ることで、そのキャピタルの**バリエーション**（ワイドピアノ、デチューンオルガン、12 弦ギターなど）へ到達する手段を用意しています。フォールバックバンクは、17 のキャピタルプログラムのもとに 30 のバリエーションを音色として持ちます。

各バリエーションは**1 つの音色に対して 2 つのアドレス**を持ちます。GS のバンクセレクト MSB 番号と、GM2 の番号です。そのため、GS でオーサリングされたファイルと GM2 でオーサリングされたファイルは同じ音色で鳴ります。片方が相手の規格の番号を使ったせいでキャピタルに落ちる、ということが起きません。

| キャピタルプログラム | バリエーション | GS MSB | GM2 |
|---|---|---|---|
| 0 Acoustic Grand Piano | ワイド | 8 | 1 |
| 0 Acoustic Grand Piano | ダーク | 16 | 2 |
| 1 Bright Acoustic Piano | ワイド | 8 | 1 |
| 2 Electric Grand Piano | ワイド | 8 | 1 |
| 3 Honky-tonk Piano | ワイド | 8 | 1 |
| 4 Electric Piano 1 | デチューン | 8 | 1 |
| 4 Electric Piano 1 | ベロシティ切り替え | 16 | 2 |
| 4 Electric Piano 1 | 60年代 | 24 | 3 |
| 5 Electric Piano 2 | デチューン | 8 | 1 |
| 5 Electric Piano 2 | ベロシティ切り替え | 16 | 2 |
| 6 Harpsichord | カップルド（8′＋4′ オクターブ） | 8 | 1 |
| 6 Harpsichord | ワイド（2 クワイアのステレオ） | 16 | 2 |
| 6 Harpsichord | キーオフのジャックノイズ | 24 | 3 |
| 11 Vibraphone | ワイド | 8 | 1 |
| 12 Marimba | ワイド | 8 | 1 |
| 14 Tubular Bells | チャーチベル | 8 | 1 |
| 14 Tubular Bells | カリヨン | 9 | 2 |
| 16 Drawbar Organ | デチューン | 8 | 1 |
| 16 Drawbar Organ | 60年代 | 16 | 2 |
| 16 Drawbar Organ | Organ 4 | 32 | 3 |
| 17 Percussive Organ | デチューン | 8 | 1 |
| 17 Percussive Organ | Organ 5 | 32 | 2 |
| 19 Church Organ | フルートレジストレーション | 8 | 1 |
| 19 Church Organ | フルオルガン | 16 | 2 |
| 21 Accordion | イタリアンチューニング | 8 | — |
| 24 Acoustic Guitar (nylon) | ウクレレ | 8 | 1 |
| 24 Acoustic Guitar (nylon) | キーオフノイズ | 16 | 2 |
| 25 Acoustic Guitar (steel) | 12 弦 | 8 | 1 |
| 25 Acoustic Guitar (steel) | マンドリン | 16 | 2 |
| 40 Violin | スローアタック | 8 | 1 |

イタリアンアコーディオンを GS 専用としているのは意図的です。GM2 はプログラム 21 のバリエーション 1 を*フレンチ*アコーディオンに割り当てており、それはキャピタルがすでに鳴らしているドライなチューニングです。GM2 のアドレスをここで採用すると、2 つの規格が互いに矛盾することになります。

::: info どのバリエーションも指さないバンク番号でも音は鳴る
この表にないバリエーションを指す Bank Select の値は、**キャピタル音色**へ解決されます。これは、持っていないバリエーションを要求されたときに実機のモジュールがする動作と同じです。バンクがまだ持っていない音色を要求したせいでファイルが音を失うことはありませんし、あとからバリエーションを追加しても、変わるのはすでにそれを要求していたファイルだけです。
:::

各バリエーションは、別録りの音源ではなく**キャピタル自身の物理モデル**から音色を作ります。そのため、キャピタルの音色を作り直すとバリエーションもそれに追随し、取り残されることがありません。3 つのピアノのキャピタルがグランドのワイド音色を共有せず、それぞれ自前のワイドバリエーションを持つのもこのためです。共有すると、どれかがキャピタルより鈍く、小さく、あるいは音程が整いすぎた「バリエーション」になってしまいます。

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

### `drum-kit` プリセットと GM ドラムマップ

`drum-kit` は `percussion` エンジンを選び、入ってくる MIDI ノートを **General MIDI ドラムマップ**へ割り当てます。ノート番号をピッチとして扱うのではなく、ノート 36 はキック、ノート 38 はアコースティックスネア、というように対応づけます。ドラムパターンのノートを `drum-kit` をバインドしたデスティネーションへ送ると、各ノートが対応するパーツを鳴らします。

### GS / GM ドラムキットバリエーション

`drum-kit` は GS 系のドラムキット選択（GS は Roland による General MIDI の拡張セット。キットはバンク 128 のリズムパートのプログラム番号で指定します）も認識し、ノートオンの時点で Standard キットをセットごとに作り変えます。Room ならシェルの鳴りを増やし、Power なら音を下げて長くする、といった具合です。

各行には 2 つの番号が並びますが、これらは互換ではありません。**プログラム**はファイルが送る番号で、リズムパートのプログラムチェンジ番号、つまり規格が定めるアドレスです。**インデックス**はこのバンク内部のスロット番号です。インデックスは**追加のみ**で、あとから追加されたセットは空いている次の番号を取ります。そのため、セットを追加しても既存のセットの番号が付け替わることはなく、すでに正しく鳴っていたものが別の音になることもありません。

**トーンマップ**の列は、そのセットを最初に定義した世代です。これは [バンクセレクト LSB](./soundfont-player.md#gs-アーキテクチャ層) が選ぶマップと同じものです。古いマップを指定したファイルは、それより後に追加されたセットには到達せず、それらは Standard へフォールバックします。その世代のモジュールの動作そのままです。

どのセットも、**共有された 1 つのパーカッションモデルを作り直したもの**であり、モデルの複製ではありません。キック、スネア、タム、ハット、シンバルのパラメーターがノートオン時に作り変えられます。つまり、土台のモデルを良くすれば 26 セットすべてが同時に良くなり、逆にセットどうしの差はモデルがパラメーターを持つ範囲にとどまります。

| プログラム | インデックス | GS 名 | トーンマップ | Standard との音色差 |
|---|---|---|---|---|
| 0 | 0 | Standard | SC-55 | — |
| 8 | 1 | Room | SC-55 | シェルの鳴りが増え、残響の尾が長くなる |
| 16 | 2 | Power | SC-55 | シェルが大きく／低く／長くなる |
| 24 | 3 | Electronic | SC-55 | サイン波化し、乾いた膜音になる |
| 25 | 4 | TR-808（GM2: Analog） | SC-55 | 減衰サイン波のキック、単一音のスネアとタム |
| 32 | 5 | Jazz | SC-55 | タイトで高め、柔らかい |
| 40 | 6 | Brush | SC-55 | スネアが持続するスウィッシュ音になる |
| 48 | 7 | Orchestra | SC-55 | 膜／シンバルの尾が長くなる |
| 56 | 8 | SFX | SC-55 | ワンショットのセット — Standard の音色で鳴る |
| 127 | 9 | CM-64/32L | SC-55 | 短く薄く明るい、LA 音源時代の質感 |
| 1 | 10 | Standard 2 | SC-88 | より乾いてタイトな響き。スナッピーが強め |
| 26 | 11 | Dance | SC-88 | サイン波キック、クラップ寄りのスネア、詰めたハット |
| 49 | 12 | Ethnic | SC-88 | ハンドドラム。リーム寄りを叩き、シェルは薄い |
| 50 | 13 | Kick & Snare | SC-88 | 動くのはキックとスネアだけで、残りは Standard |
| 57 | 14 | Rhythm FX | SC-88 | ワンショットのセット — Standard の音色で鳴る |
| 2 | 15 | Standard 3 | SC-88Pro | 中心を外して叩き、より開いた響き |
| 9 | 16 | Hip Hop | SC-88Pro | 低く短く、押しつぶした質感 |
| 10 | 17 | Jungle | SC-88Pro | すべてを早めに切り、明るい方向へ寄せる |
| 11 | 18 | Techno | SC-88Pro | 完全に合成的な膜と、硬く明るい高域 |
| 27 | 19 | CR-78 | SC-88Pro | フィルタードノイズのチック。スナッピーのないスネア |
| 28 | 20 | TR-606 | SC-88Pro | 薄く金属的 — アナログ機の中でも最小 |
| 29 | 21 | TR-707 | SC-88Pro | アナログではなくサンプル。歯切れよく乾いて短い |
| 30 | 22 | TR-909 | SC-88Pro | 長く減衰するサイン波キックの上にクリック |
| 52 | 23 | Asia | SC-88Pro | ゴングや太鼓。大きく低く、長く鳴る |
| 53 | 24 | Cymbal & Claps | SC-88Pro | ワンショットのセット — Standard の音色で鳴る |
| 58 | 25 | Rhythm FX 2 | SC-88Pro | ワンショットのセット — Standard の音色で鳴る |

::: warning ワンショットのセットとサウンドエフェクト・プログラムはアドレスのみで未モデル化
4 つのセット（**SFX**、**Rhythm FX**、**Cymbal & Claps**、**Rhythm FX 2**）は、実機の GS では音色を作り変えたキットではなく、個別のワンショット録音を集めたバンクです。膜モデルが作り変える対象がそもそも存在しないため、アドレスと名前は認識されますが Standard キットの音色で鳴ります。GM のサウンドエフェクト・プログラム（120-127、後述の GM 音色マップを参照）も同じ立場で、共通の汎用ノイズ音色を共有します。これらのアドレスに実際のサンプルを持つ SoundFont を読み込めば、SF2 プレイヤー経由で通常どおり再生されます。
:::

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

各**モッドルーティング**は `{ source, destination, depth }` です。モッドマトリクスにより、エンベロープ・LFO・ベロシティ・キートラッキング・モッドホイール・シード付きのボイスごとランダムソースが、ピッチ・フィルターカットオフ・音量・パンを変調できます。`depth` はソースが最大振れたときの destination 単位です。

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
//                      'velocity', 'key-track', 'mod-wheel', 'random'],
//   modDestinations:  ['none', 'pitch-cents', 'cutoff-cents', 'amp-gain', 'pan-units'],
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

### パッチを固定せず GM プログラムに追従させる

バインディングは通常、1 つのデスティネーションに 1 つのパッチを固定します。MIDI にどんな
プログラムチェンジが入っていても、そのデスティネーションを通る音はすべて同じ音色で鳴ります。一般的な MIDI
ファイルではこれは望ましくありません。チャンネルごとに自分の楽器を選んでほしいからです。

GM プログラム追従を有効にすると、シンセはメロディックなボイスを、追跡しているバンクと
プログラムチェンジから解決し、MIDI チャンネル 10 は GM ドラムキットマップへルーティング
します。マップが対応しない部分にはバインドしたパッチがフォールバックとして残るので、
音が消えることはありません。モードを切っていれば、上記の固定パッチの挙動は変わりません。

```python
# Python
audio = project.bounce_with_synth_instrument(
    "acoustic-piano",          # マップ外プログラムのフォールバック
    auto_select_gm=True,
    sample_rate=48000,
)
```

```typescript [WASM / Node]
// JS バインディングのオプションは SynthPatch オブジェクトに指定する（文字列には指定できない）。
const audio = project.bounceWithSynthInstrument(
  { preset: 'acoustic-piano', useGmPrograms: true },
  { totalFrames: 48000, numChannels: 2 },
);
```

このフラグは C ABI の `SonareSynthInstrumentBinding` では `use_gm_programs`、Python では
`auto_select_gm`、WASM／Node の JavaScript では `SynthPatch` 記述子の `useGmPrograms` です。
いずれも既定値は `false` で、固定パッチをフォールバックにする挙動を保ちます。
`useGmPrograms` は JS バインディングの便宜機能で、NativeSynth パッチのフィールドではありません。
2 つの CLI では値なしの `--synth` フラグがこれにあたります
（`sonare project bounce --in project.json --synth -o out.wav`）。プリセット名を渡した場合は
そのパッチに固定されます。

::: code-group

```typescript [ブラウザ]
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
project.setSampleRate(48000);

// MIDI クリップ 1 つ: 出力先 0 へルーティングした 2 拍の C4 ノート
const { trackId, clipId } = project.addMidiClip(0, 4);
project.setTrackMidiDestination(trackId, 0);
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 0, 60, 100),
  Project.midiNoteOff(2, 0, 0, 60, 0),
]);

try {
  // 名前付きプリセットを出力先 0 へバインドしてステレオでレンダー
  const audio = project.bounceWithSynthInstrument('va:saw-lead', {
    totalFrames: 48000,
    numChannels: 2,
  });
  // audio はインターリーブの Float32（frames * channels）。無音ではない
} finally {
  project.delete();   // WASM ハンドルは GC されない — 必ず解放する
}
```

```python [Python]
import libsonare as sonare

project = sonare.Project()
project.set_sample_rate(48000)

track_id, clip_id = project.add_midi_clip(0, 4)
project.set_track_midi_destination(track_id, 0)
project.set_midi_events(clip_id, [
    sonare.Project.midi_note_on(0, 0, 0, 60, 100),
    sonare.Project.midi_note_off(2, 0, 0, 60, 0),
])

# 名前付きプリセットを出力先 0 へバインドしてレンダー -> (frames, channels) float32
audio = project.bounce_with_synth_instrument(
    "va:saw-lead", total_frames=48000, num_channels=2,
)
project.close()
```

```bash [CLI]
# --synth <preset> はオシレーター波形に限らず、NativeSynth プリセットカタログの
# どの名前でも受け付けます。全一覧は `sonare project synth-presets` で取得できます。
# 値なしの --synth はプロジェクトの GM プログラムチェンジに追従します。
# プリセット名ではなくカスタムの SynthPatch オブジェクトを渡せるのはバインディング
# 専用です（上のブラウザ／Python を参照）。
sonare project bounce --in song.json -o synth.wav --synth saw
sonare project bounce --in song.json -o pad.wav --synth warm-pad
```

:::

カスタマイズするには、名前の代わりに `SynthPatch` を渡します。プリセットを出発点に上書きしてください。

```typescript
const audio = project.bounceWithSynthInstrument(
  {
    preset: 'warm-pad',
    cutoffHz: 1200,                // プリセットの 2800 Hz より暗く
    resonanceQ: 3,
    modRoutings: [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }],
  },
  { totalFrames: 48000, numChannels: 2 },
);
```

`totalFrames` を 0 のままにすると、アレンジとパッチのリリーステイルから長さを自動導出します。未知のプリセット名は例外を投げます。`bounceWith*` が共有するチャンネル・サンプルレート・レイテンシなどは [プロジェクトバウンス](./project-bounce.md) を参照してください。

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

## NativeSynth と SoundFont フォールバック

NativeSynth は [SoundFont プレイヤー](./soundfont-player.md)の下にあるセーフティネットです。`bounceWithSf2Instrument` でレンダーする（またはライブで SF2 をバインドする）と、libsonare はアレンジが実際に鳴らす各 `(channel, bank, program)` を解決します。

- 読み込んだ SoundFont がそのプログラムをカバーしていれば、そのノートは **SF2** から鳴ります（GS バリエーションとドラムフォールバックを含む）。
- そうでなければ — SoundFont を一切読み込んでいない場合も含めて — そのノートは **NativeSynth の GM フォールバックバンク**（128 種すべてのプログラムとドラムマップ）で鳴ります。

レンダー前にプログラムごとのバックエンドを確認するには `soundFontManifest()` を使います。最初に使われる順に、各プログラムについて `'sf2'` か `'synth'` を報告します。

```typescript
project.loadSoundFont(sf2Bytes);
const manifest = project.soundFontManifest();
// [{ channel, bank, program, backend: 'sf2' | 'synth', presetName }, ...]
```

GM フォールバックバンクが常に存在するため、データがないという理由で MIDI が無音になることはありません。SF2 データの読み込みやチャンネル／プログラムごとの解決は [SoundFont プレイヤー](./soundfont-player.md) を参照してください。

### GM フォールバックのプログラムルーティング

フォールバックバンクは、GM プログラムのファミリーごとに最も近い NativeSynth エンジンを使います。楽器の挙動の違いが重要な箇所では、プログラム単位の上書きがあります。アコースティック楽器系の行はまだキャリブレーション対象の仮実装なので、完成済みのサンプル楽器並みのリアリティではなく、ルーティング上の対応範囲として読んでください。

| GM プログラム | 楽器 | フォールバックエンジン | 理由 |
|---------------|------|------------------------|------|
| 4-5 | Electric Piano 1 / 2 | `fm` | タイン／ベル的な明るさを位相変調で表現 |
| 6 | Harpsichord | `harpsichord` | ジャック＆プレクトラム。打鍵の速さが音量をほとんど変えない |
| 7 | Clavi | `fm` | 打弦とピックアップの色づけを、現状は FM で近似 |
| 8, 10, 14 | Celesta, Music Box, Tubular Bells | `modal` | フェルトで打つスティールバー、ツインティースによるタインの揺らぎ、基音を持たない打撃ピッチ |
| 9, 11-13 | Glockenspiel, Vibraphone, Marimba, Xylophone | `modal` | 調律されたバーの共鳴 |
| 15 | Dulcimer | `karplus-strong` | 暫定実装。撥弦ではなく打弦 |
| 16-23 | Organ family | `additive` / `pipe-organ` / `free-reed` | ドローバー系レジストレーション（16-18）、仮実装の教会オルガンのフルーパイプ（19）、フリーリードのリードオルガン、ハーモニカ、バンドネオン（20-23） |
| 24-31 | Guitar family | `karplus-strong` | 撥弦の導波路モデル |
| 32-37 | Acoustic, electric, fretless, slap bass | `karplus-strong` | ベース弦導波路。スラップ／偏波はプログラム別 |
| 40-43 | Violin, Viola, Cello, Contrabass | `bowed-string` | 仮実装の摩擦励起型・持続弦導波路 |
| 44 | Tremolo Strings | `subtractive` | デチューンしたのこぎり波セクションにアンプトレモロ LFO を重ねたもので、擦弦モデルではない |
| 45-46 | Pizzicato Strings, Orchestral Harp | `karplus-strong` | ヴァイオリンボディまたはスチール弦のコーパスへの短い撥弦 |
| 47 | Timpani | `percussion` | ノートトラッキングするケトルドラムのフォールバックボイス |
| 48 | String Ensemble 1 | `subtractive` | ソロ弓弦ではなく、パッド的なアンサンブル音色 |
| 52-54 | Choir Aahs, Voice Oohs, Synth Voice | `vocal` | ソースフィルター方式のボイス（声門音源＋母音フォルマントバンク）で、減算合成のパッドではない |
| 56-60 | Trumpet, Trombone, Tuba, Muted Trumpet, French Horn | `brass` | 仮実装のリップリード金管導波路 |
| 61-63 | Brass Section, Synth Brass 1 / 2 | `fm` | 金管導波路ではなく、設計上 FM |
| 64-71 | Saxophones, Oboe, English Horn, Bassoon, Clarinet | `reed` | 仮実装のリードと管体の導波路 |
| 72-79 | Piccolo, Flute, Recorder, Pan Flute, Bottle, Shakuhachi, Whistle, Ocarina | `flute` | 仮実装のエアジェット／開管導波路 |
| 104, 106, 107 | Sitar, Shamisen, Koto | `plucked-string` | バズブリッジ（ジャワリ／サワリ）の撥弦。バンジョー（105）は `karplus-strong` のまま |
| 112-119 | Tinkle Bell, Agogo, Steel Drums, Woodblock, Taiko Drum, Melodic Tom, Synth Drum, Reverse Cymbal | `percussion` | ノートトラッキングするパーカッションエンジンのボイスで、ドラムキットのマップとは別 |

Bank Select は、フォールバックがバリエーションを持つキャピタルプログラムすべてで読み取られます。全体の対応は前述の [GS バリエーション音色](#gs-バリエーション音色)を参照してください。

このルーティングは名前付きプリセットカタログとは別です。`synthPresetNames()` が返すのは手で設計されたプリセット（`e-piano`、`harp`、`drum-kit` など）であり、GM フォールバックバンクは SF2 フォールバック時に MIDI プログラム番号ごとの内部パッチを選びます。

## GM 音色マップ — 全128プログラム

General MIDI の各プログラムは、音作りエンジンのいずれかに解決されます。下表は、SoundFont がそのプログラムを持たないときに NativeSynth が使うデータ非依存のフォールバック音色です（各プログラムの正式名称は実行時に `Project.gmInstrumentName(program)` からも取得できます）。「暫定」と付いた行は、較正が続いているアコースティック系の物理モデルを使います。

::: details 全128プログラムの音色マップを表示
**モデルの状態** — **安定**: 減算合成、FM、モーダル、加算、パーカッションの各コアは成熟しています。**暫定**: ピアノ、Karplus-Strong、パイプオルガン、擦弦、リード、金管、フルート、撥弦（バズブリッジ）、ボイス、フリーリードの各物理モデルはまだ較正が続いています。ハープシコードは減衰とストレッチをキャプチャー音源に対して回帰しているため、暫定とはしていません。

#### ピアノ（0-7）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | 暫定。共有のモーダル響板 |
| 1 | Bright Acoustic Piano | `piano` | 暫定 |
| 2 | Electric Grand Piano | `piano` | 暫定（FM ではなくアコースティック導波路） |
| 3 | Honky-tonk Piano | `piano` | 暫定 |
| 4 | Electric Piano 1 | `fm` | タイン／ベルの FM |
| 5 | Electric Piano 2 | `fm` | EP1 と同じ音作り |
| 6 | Harpsichord | `harpsichord` | ジャック＆プレクトラム。バンクで選ぶ 3 種のレジストレーション |
| 7 | Clavi | `fm` | 明るい高比率の FM |

#### クロマチックパーカッション（8-15）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 8 | Celesta | `modal` | 柔らかいフェルト打撃のスティールバー |
| 9 | Glockenspiel | `modal` | 一様バーのモード比 |
| 10 | Music Box | `modal` | ツインティースのうなりでタインの揺らぎを表現 |
| 11 | Vibraphone | `modal` | モーターによるトレモロ（LFO → 音量） |
| 12 | Marimba | `modal` | 深いアーチのバー、木管ボディ |
| 13 | Xylophone | `modal` | 短く乾いた深いアーチのバー |
| 14 | Tubular Bells | `modal` | 基音を持たない打撃ピッチ、長い残響 |
| 15 | Dulcimer | `karplus-strong` | 暫定。撥弦ではなく打弦 |

#### オルガン（16-23）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 16 | Drawbar Organ | `additive` | 9ドローバーのハモンド |
| 17 | Percussive Organ | `additive` | |
| 18 | Rock Organ | `additive` | |
| 19 | Church Organ | `pipe-organ` | 暫定。マルチランクのプレナム |
| 20 | Reed Organ | `free-reed` | 暫定。ハルモニウム — 柔らかなプレート、柔らかいリード |
| 21 | Accordion | `free-reed` | 暫定。リードオルガンの音作りを共有 |
| 22 | Harmonica | `free-reed` | 暫定。小さく明るい硬いリード＋ハンドビブラート |
| 23 | Tango Accordion | `free-reed` | 暫定。バンドネオン、ミュゼット（うなりのある）デチューン |

#### ギター（24-31）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 24 | Acoustic Guitar (nylon) | `karplus-strong` | 暫定。柔らかい撥弦、分散なし |
| 25 | Acoustic Guitar (steel) | `karplus-strong` | 暫定。スチール弦の分散＋共鳴弦 |
| 26 | Electric Guitar (jazz) | `karplus-strong` | 暫定。ブリッジ寄りピックアップ、ボディなし |
| 27 | Electric Guitar (clean) | `karplus-strong` | 暫定。jazz と同じ音作り |
| 28 | Electric Guitar (muted) | `karplus-strong` | 暫定。ミュート（パームミュート）による減衰 |
| 29 | Overdriven Guitar | `karplus-strong` | 暫定。フィルター前段のドライブ |
| 30 | Distortion Guitar | `karplus-strong` | 暫定。より強いドライブ |
| 31 | Guitar Harmonics | `karplus-strong` | 暫定 |

#### ベース（32-39）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 32 | Acoustic Bass | `karplus-strong` | 暫定。大きく共鳴するボディ |
| 33 | Electric Bass (finger) | `karplus-strong` | 暫定。ピックアップ＋2偏波のうなり |
| 34 | Electric Bass (pick) | `karplus-strong` | 暫定。ブリッジ寄りの明るいアタック |
| 35 | Fretless Bass | `karplus-strong` | 暫定。丸くグライドしやすい |
| 36 | Slap Bass 1 | `karplus-strong` | 暫定。サムスラップ＋フレットスラップのバズ |
| 37 | Slap Bass 2 | `karplus-strong` | 暫定。より鋭いポップ |
| 38 | Synth Bass 1 | `subtractive` | 設計上のシンセベース |
| 39 | Synth Bass 2 | `subtractive` | 設計上のシンセベース |

#### 弦（40-47）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 40 | Violin | `bowed-string` | 暫定 |
| 41 | Viola | `bowed-string` | 暫定。より暗く遅い |
| 42 | Cello | `bowed-string` | 暫定 |
| 43 | Contrabass | `bowed-string` | 暫定。最も暗く遅い |
| 44 | Tremolo Strings | `subtractive` | デチューンしたのこぎり波セクション＋アンプトレモロ LFO |
| 45 | Pizzicato Strings | `karplus-strong` | 暫定。ヴァイオリンボディへの短い撥弦 |
| 46 | Orchestral Harp | `karplus-strong` | 暫定。長く減衰しにくい響き |
| 47 | Timpani | `percussion` | ノートトラッキングするケトルドラム |

#### アンサンブル（48-55）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 48 | String Ensemble 1 | `subtractive` | セクションビブラートを持つ幅広のスーパーソウパッド |
| 49 | String Ensemble 2 | `subtractive` | |
| 50 | SynthStrings 1 | `subtractive` | |
| 51 | SynthStrings 2 | `subtractive` | |
| 52 | Choir Aahs | `vocal` | 暫定。開いた /a/ 母音、声門音源＋フォルマント |
| 53 | Voice Oohs | `vocal` | 暫定。より暗く口を閉じた /u/ 母音 |
| 54 | Synth Voice | `vocal` | 暫定。より明るく安定した合成母音 |
| 55 | Orchestra Hit | `subtractive` | 明るいデチューンのこぎり波のスタブ |

#### 金管（56-63）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 56 | Trumpet | `brass` | 暫定。リップリード導波路 |
| 57 | Trombone | `brass` | 暫定 |
| 58 | Tuba | `brass` | 暫定。暗く円錐管 |
| 59 | Muted Trumpet | `brass` | 暫定。物理的なミュートモデル |
| 60 | French Horn | `brass` | 暫定。より丸い円錐管 |
| 61 | Brass Section | `fm` | 設計上 FM（金管導波路ではない） |
| 62 | SynthBrass 1 | `fm` | 設計上 FM |
| 63 | SynthBrass 2 | `fm` | 設計上 FM |

#### リード（64-71）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 64 | Soprano Sax | `reed` | 暫定。円錐管 |
| 65 | Alto Sax | `reed` | 暫定。円錐管 |
| 66 | Tenor Sax | `reed` | 暫定。円錐管 |
| 67 | Baritone Sax | `reed` | 暫定。円錐管、サックスの中で最も暗い |
| 68 | Oboe | `reed` | 暫定。円錐管、明るく鼻にかかった音 |
| 69 | English Horn | `reed` | 暫定。円錐管 |
| 70 | Bassoon | `reed` | 暫定。円錐管、低音 |
| 71 | Clarinet | `reed` | 暫定。円筒管（奇数次倍音） |

#### パイプ（72-79）— エアジェットフルートエンジン

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 72 | Piccolo | `flute` | 暫定。最も明るい |
| 73 | Flute | `flute` | 暫定 |
| 74 | Recorder | `flute` | 暫定 |
| 75 | Pan Flute | `flute` | 暫定。息っぽい渦流 |
| 76 | Blown Bottle | `flute` | 暫定。暗く高いダンピング |
| 77 | Shakuhachi | `flute` | 暫定。最も息っぽい |
| 78 | Whistle | `flute` | 暫定 |
| 79 | Ocarina | `flute` | 暫定。閉じた容器の質感 |

#### シンセリード（80-87）— 減算合成のオシレーター

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | Moog ラダーフィルターを通す3オシレーターのデチューンリード |
| 81 | Lead 2 (sawtooth) | `subtractive` | |
| 82 | Lead 3 (calliope) | `subtractive` | |
| 83 | Lead 4 (chiff) | `subtractive` | |
| 84 | Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | 歌うリード。オシレーターを**母音フォルマントのボディ**に通す。モデルの本体はフォルマント側で、オシレーターはそれを駆動できる倍音成分があれば足りる |
| 86 | Lead 7 (fifths) | `subtractive` | |
| 87 | Lead 8 (bass + lead) | `subtractive` | |

#### シンセパッド（88-95）— 減算合成のオシレーター

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 88 | Pad 1 (new age) | `subtractive` | 7オシレーターのスーパーソウパッド |
| 89 | Pad 2 (warm) | `subtractive` | |
| 90 | Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | Lead 6 と同じ**母音フォルマントのボディ**をより多く混ぜ、リードではなくパッドのエンベロープに乗せる |
| 92 | Pad 5 (bowed) | `subtractive` | |
| 93 | Pad 6 (metallic) | `subtractive` | |
| 94 | Pad 7 (halo) | `subtractive` | |
| 95 | Pad 8 (sweep) | `subtractive` | |

#### シンセエフェクト（96-103）— すべて減算合成

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 96 | FX 1 (rain) | `subtractive` | 揺らぐデチューン三角波 |
| 97 | FX 2 (soundtrack) | `subtractive` | |
| 98 | FX 3 (crystal) | `subtractive` | |
| 99 | FX 4 (atmosphere) | `subtractive` | |
| 100 | FX 5 (brightness) | `subtractive` | |
| 101 | FX 6 (goblins) | `subtractive` | |
| 102 | FX 7 (echoes) | `subtractive` | |
| 103 | FX 8 (sci-fi) | `subtractive` | |

#### エスニック（104-111）— バズブリッジ撥弦 + karplus-strong

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 104 | Sitar | `plucked-string` | 暫定。ジャワリブリッジのバズ、長くきらめく響き |
| 105 | Banjo | `karplus-strong` | 暫定。共有の撥弦スケッチ |
| 106 | Shamisen | `plucked-string` | 暫定。サワリのバズ、シタールより乾いて硬い |
| 107 | Koto | `plucked-string` | 暫定。ブリッジバズの撥弦 |
| 108 | Kalimba | `karplus-strong` | 暫定。共有の撥弦スケッチ |
| 109 | Bag pipe | `karplus-strong` | 暫定。共有の撥弦スケッチ（リードドローンはまだない） |
| 110 | Fiddle | `karplus-strong` | 暫定。共有の撥弦スケッチ（擦弦ではまだない） |
| 111 | Shanai | `karplus-strong` | 暫定。共有の撥弦スケッチ（リードモデルはまだない） |

#### パーカッシブ（112-119）— すべてパーカッション

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 112 | Tinkle Bell | `percussion` | まばらな非調和モード |
| 113 | Agogo | `percussion` | 2音のメタルベル |
| 114 | Steel Drums | `percussion` | ほぼ調和的なモード |
| 115 | Woodblock | `percussion` | 非常に短く、スティックのクリック音付き |
| 116 | Taiko Drum | `percussion` | 強いピッチドロップ＋シェルの鳴り |
| 117 | Melodic Tom | `percussion` | ノートトラッキング、シェルボディ付き |
| 118 | Synth Drum | `percussion` | 減衰するサイン波の電子ドラム |
| 119 | Reverse Cymbal | `percussion` | 長く立ち上がるスウェル（逆再生を模擬） |

#### サウンドエフェクト（120-127）— 汎用プレースホルダー

<SonareDemo id="gm-sfx" />

上のデモでは、GM のサウンドエフェクト・プログラム8個を実際に試聴できます。これらが現状1つの音色を共有していることを、手早く確認できます。

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 120 | Guitar Fret Noise | `subtractive` | 汎用の共鳴ノイズプレースホルダー（下の注記を参照） |
| 121 | Breath Noise | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 122 | Seashore | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 123 | Bird Tweet | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 124 | Telephone Ring | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 125 | Helicopter | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 126 | Applause | `subtractive` | 汎用の共鳴ノイズプレースホルダー |
| 127 | Gunshot | `subtractive` | 汎用の共鳴ノイズプレースホルダー |

120-127についての注記: データ非依存フォールバックでは、この8プログラムは現状、共通の「ノイズ→共鳴バンドパス」音色を1つ共有しており、鳴らすノートによってのみ違いが出ます。個別の効果音を作るプロシージャルモデルはまだありません。これらのプログラムをカバーする SoundFont を読み込めば、そちらのサンプルが再生されます。
:::

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
