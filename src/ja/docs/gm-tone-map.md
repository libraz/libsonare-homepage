---
title: GM 音色マップ
description: General MIDI の全128プログラムについて、NativeSynth のデータ不要なフォールバック音色を一覧します。楽器名、合成エンジン、音色の備考をファミリーごとにまとめています。
---

# GM 音色マップ

このページは、General MIDI の 128 プログラムそれぞれについて、SoundFont がそのプログラムを持たないときに NativeSynth が使うデータ非依存のフォールバック音色を、楽器名・エンジン・備考の形で一覧にしたものです。土台となるバンクの挙動（GS バリエーション音色、ドラムキットバリエーション、SoundFont フォールバックのルーティング）は [GM／GS フォールバックバンク](./gm-gs.md) にあり、各プログラムの正式名称は実行時に `Project.gmInstrumentName(program)` からも取得できます。「暫定」と付いた行は、較正が続いているアコースティック系の物理モデルを使います。

**モデルの状態** — **安定**: 減算合成、FM、モーダル、加算、パーカッションの各コアは成熟しています。**暫定**: ピアノ、Karplus-Strong、パイプオルガン、擦弦、リード、金管、フルート、撥弦（バズブリッジ）、ボイス、フリーリードの各物理モデルはまだ較正が続いています。ハープシコードは減衰とストレッチをキャプチャー音源に対して回帰しているため、暫定とはしていません。

## ピアノ（0-7）

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

## クロマチックパーカッション（8-15）

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

## オルガン（16-23）

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

## ギター（24-31）

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

## ベース（32-39）

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

## 弦（40-47）

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

## アンサンブル（48-55）

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

## 金管（56-63）

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

## リード（64-71）

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

## パイプ（72-79）— エアジェットフルートエンジン

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

## シンセリード（80-87）— 減算合成のオシレーター

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

## シンセパッド（88-95）— 減算合成のオシレーター

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

## シンセエフェクト（96-103）— すべて減算合成

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

## エスニック（104-111）— バズブリッジ撥弦 + karplus-strong

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

## パーカッシブ（112-119）— すべてパーカッション

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

## サウンドエフェクト（120-127）— 汎用プレースホルダー

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
