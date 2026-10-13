---
title: GM 音色マップ
description: General MIDI の全128プログラムについて、NativeSynth のデータ不要なフォールバック音色を一覧します。楽器名、合成エンジン、音色の備考をファミリーごとにまとめています。
---

# GM 音色マップ

このページは、General MIDI の 128 プログラムそれぞれについて、SoundFont がそのプログラムを持たないときに NativeSynth が使うデータ非依存のフォールバック音色を、楽器名・エンジン・備考の形で一覧にしたものです。プログラムごとの表はこのページだけにあります。土台となるバンクの挙動（GS バリエーション音色、ドラムキットバリエーション、SoundFont フォールバックのルーティング）は [GM／GS フォールバックバンク](./gm-gs.md) にあり、各プログラムの正式名称は実行時に `Project.gmInstrumentName(program)` からも取得できます。

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: '較正の状況',
    body: '参照録音に合わせて較正済みなのは、アコースティックピアノ（プログラム 0-3）だけです。ハープシコード、モーダル、パーカッションを含むそのほかの物理モデルのエンジンで鳴るプログラムは暫定で、パッチリリースごとに音が変わることがあります。減算合成、FM、加算のプログラムは信号ベースなので、較正の状況は当てはまりません。'
  }"
/>

## エンジン別のプログラム

| エンジン | プログラム | 数 |
|----------|------------|----|
| `subtractive` | 38-39、44、50-51、55、80-103、120-127 | 38 |
| `karplus-strong` | 15、24-37、45-46、105 | 18 |
| `reed` | 64-71、109、111 | 10 |
| `percussion` | 47、112-119 | 9 |
| `modal` | 8-14、108 | 8 |
| `flute` | 72-79 | 8 |
| `bowed-string` | 40-43、48-49、110 | 7 |
| `brass` | 56-61 | 6 |
| `fm` | 4-5、7、62-63 | 5 |
| `piano` | 0-3 | 4 |
| `free-reed` | 20-23 | 4 |
| `additive` | 16-18 | 3 |
| `plucked-string` | 104、106-107 | 3 |
| `vocal` | 52-54 | 3 |
| `harpsichord` | 6 | 1 |
| `pipe-organ` | 19 | 1 |

## ピアノ（0-7）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | 共有のモーダル響板 |
| 1 | Bright Acoustic Piano | `piano` | 同じグランドを硬く鳴らす音作り |
| 2 | Electric Grand Piano | `piano` | FM ではなくアコースティック導波路 |
| 3 | Honky-tonk Piano | `piano` | ユニゾンをずらしてうなりを出す |
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
| 15 | Dulcimer | `karplus-strong` | 撥弦ではなく打弦 |

## オルガン（16-23）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 16 | Drawbar Organ | `additive` | 9 ドローバーのトーンホイールオルガン |
| 17 | Percussive Organ | `additive` | |
| 18 | Rock Organ | `additive` | |
| 19 | Church Organ | `pipe-organ` | マルチランクのプレナム |
| 20 | Reed Organ | `free-reed` | ハルモニウム。柔らかなプレート、柔らかいリード |
| 21 | Accordion | `free-reed` | リードオルガンの音作りを共有 |
| 22 | Harmonica | `free-reed` | 小さく明るい硬いリード＋ハンドビブラート |
| 23 | Tango Accordion | `free-reed` | バンドネオン、ミュゼット（うなりのある）デチューン |

## ギター（24-31）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 24 | Acoustic Guitar (nylon) | `karplus-strong` | 柔らかい撥弦、分散なし |
| 25 | Acoustic Guitar (steel) | `karplus-strong` | スチール弦の分散＋共鳴弦 |
| 26 | Electric Guitar (jazz) | `karplus-strong` | ブリッジ寄りピックアップ、ボディなし |
| 27 | Electric Guitar (clean) | `karplus-strong` | jazz と同じ音作り |
| 28 | Electric Guitar (muted) | `karplus-strong` | ミュート（パームミュート）による減衰 |
| 29 | Overdriven Guitar | `karplus-strong` | フィルター前段のドライブ |
| 30 | Distortion Guitar | `karplus-strong` | より強いドライブ |
| 31 | Guitar Harmonics | `karplus-strong` | 開放弦ではなく、軽く触れたノード |

## ベース（32-39）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 32 | Acoustic Bass | `karplus-strong` | 大きく共鳴するボディ |
| 33 | Electric Bass (finger) | `karplus-strong` | ピックアップ＋2偏波のうなり |
| 34 | Electric Bass (pick) | `karplus-strong` | ブリッジ寄りの明るいアタック |
| 35 | Fretless Bass | `karplus-strong` | 丸くグライドしやすい |
| 36 | Slap Bass 1 | `karplus-strong` | サムスラップ＋フレットスラップのバズ |
| 37 | Slap Bass 2 | `karplus-strong` | より鋭いポップ |
| 38 | Synth Bass 1 | `subtractive` | 設計上のシンセベース |
| 39 | Synth Bass 2 | `subtractive` | 設計上のシンセベース |

## 弦（40-47）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 40 | Violin | `bowed-string` | |
| 41 | Viola | `bowed-string` | より暗く遅い |
| 42 | Cello | `bowed-string` | |
| 43 | Contrabass | `bowed-string` | 最も暗く遅い |
| 44 | Tremolo Strings | `subtractive` | デチューンしたのこぎり波セクション＋アンプトレモロ LFO |
| 45 | Pizzicato Strings | `karplus-strong` | ヴァイオリンボディへの短い撥弦 |
| 46 | Orchestral Harp | `karplus-strong` | 長く減衰しにくい響き |
| 47 | Timpani | `percussion` | ノートトラッキングするケトルドラム |

## アンサンブル（48-55）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 48 | String Ensemble 1 | `bowed-string` | セクションで弓を使う音作り |
| 49 | String Ensemble 2 | `bowed-string` | 同じ音作りで、より遅い |
| 50 | SynthStrings 1 | `subtractive` | |
| 51 | SynthStrings 2 | `subtractive` | |
| 52 | Choir Aahs | `vocal` | 開いた /a/ 母音、声門音源＋フォルマント |
| 53 | Voice Oohs | `vocal` | より暗く口を閉じた /u/ 母音 |
| 54 | Synth Voice | `vocal` | より明るく安定した合成母音 |
| 55 | Orchestra Hit | `subtractive` | 明るいデチューンのこぎり波のスタブ |

## 金管（56-63）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 56 | Trumpet | `brass` | リップリード導波路 |
| 57 | Trombone | `brass` | |
| 58 | Tuba | `brass` | 暗く円錐管 |
| 59 | Muted Trumpet | `brass` | 物理的なミュートモデル |
| 60 | French Horn | `brass` | より丸い円錐管 |
| 61 | Brass Section | `brass` | 同じリップリード導波路をセクションで鳴らす |
| 62 | SynthBrass 1 | `fm` | 設計上 FM |
| 63 | SynthBrass 2 | `fm` | 設計上 FM |

## リード（64-71）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 64 | Soprano Sax | `reed` | 円錐管 |
| 65 | Alto Sax | `reed` | 円錐管 |
| 66 | Tenor Sax | `reed` | 円錐管 |
| 67 | Baritone Sax | `reed` | 円錐管、サックスの中で最も暗い |
| 68 | Oboe | `reed` | 円錐管、明るく鼻にかかった音 |
| 69 | English Horn | `reed` | 円錐管 |
| 70 | Bassoon | `reed` | 円錐管、低音 |
| 71 | Clarinet | `reed` | 円筒管（奇数次倍音） |

## パイプ（72-79）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 72 | Piccolo | `flute` | 最も明るい |
| 73 | Flute | `flute` | |
| 74 | Recorder | `flute` | |
| 75 | Pan Flute | `flute` | 息っぽい渦流 |
| 76 | Blown Bottle | `flute` | 暗く高いダンピング |
| 77 | Shakuhachi | `flute` | 最も息っぽい |
| 78 | Whistle | `flute` | |
| 79 | Ocarina | `flute` | 閉じた容器の質感 |

## シンセリード、パッド、エフェクト（80-103）

24 プログラムすべてが `subtractive` のオシレーターで鳴ります。

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | 4 ポールのトランジスタラダーフィルターを通す 3 オシレーターのデチューンリード |
| 81-84 | Lead 2 (sawtooth) から Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | 歌うリード。オシレーターを**母音フォルマントのボディ**に通す。モデルの本体はフォルマント側で、オシレーターはそれを駆動できる倍音成分があれば足りる |
| 86-87 | Lead 7 (fifths)、Lead 8 (bass + lead) | `subtractive` | |
| 88 | Pad 1 (new age) | `subtractive` | 7 オシレーターのスーパーソウパッド |
| 89-90 | Pad 2 (warm)、Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | Lead 6 と同じ**母音フォルマントのボディ**をより多く混ぜ、リードではなくパッドのエンベロープに乗せる |
| 92-95 | Pad 5 (bowed) から Pad 8 (sweep) | `subtractive` | |
| 96 | FX 1 (rain) | `subtractive` | 揺らぐデチューン三角波 |
| 97-103 | FX 2 (soundtrack) から FX 8 (sci-fi) | `subtractive` | |

## エスニック（104-111）

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 104 | Sitar | `plucked-string` | ジャワリブリッジのバズ、長くきらめく響き |
| 105 | Banjo | `karplus-strong` | スチール弦の振動を膜のヘッドが吸い取る |
| 106 | Shamisen | `plucked-string` | サワリのバズ、シタールより乾いて硬い |
| 107 | Koto | `plucked-string` | ブリッジバズの撥弦 |
| 108 | Kalimba | `modal` | 撥いたスチールのタイン、木管ボディ |
| 109 | Bag pipe | `reed` | 固定のバッグ圧で鳴る円錐ボアのダブルリード。ドローンはない |
| 110 | Fiddle | `bowed-string` | ヴァイオリンの音作りをフォークの弾き方で擦る |
| 111 | Shanai | `reed` | 金管ベルのボディへ吹き込むダブルリード |

## パーカッシブ（112-119）

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

## サウンドエフェクト（120-127）

<SonareDemo id="gm-sfx" />

上のデモでは、GM のサウンドエフェクト・プログラム 8 個を試聴できます。どれも、ノイズ、フィルター、エンベロープで作った減算合成の個別のジェスチャーです。

| Prog | 楽器 | エンジン | 備考 |
|---|---|---|---|
| 120 | Guitar Fret Noise | `subtractive` | 音程のない、短く明るいこすれ音 |
| 121 | Breath Noise | `subtractive` | ゆるやかに立ち上がる、柔らかいローパスのバースト |
| 122 | Seashore | `subtractive` | ハイパスの縁が引いていく、長いノイズのうねり |
| 123 | Bird Tweet | `subtractive` | エンベロープで上へスイープする三角波 |
| 124 | Telephone Ring | `subtractive` | 鍵に追従する共鳴矩形波 |
| 125 | Helicopter | `subtractive` | 周期的に音量が変わる低域のノイズ帯 |
| 126 | Applause | `subtractive` | ランダムに散らばる、広帯域で明るいノイズ |
| 127 | Gunshot | `subtractive` | 圧縮したノイズのインパルスと、明るい破裂音 |

サンプルを使わずに組んだ近似です。これらのプログラムをカバーする SoundFont を読み込めば、そちらの録音が再生されます。
