---
title: GM／GS フォールバックバンク
description: NativeSynth の GM フォールバックバンクのリファレンスです。GS バリエーション音色、GM/GS ドラムキットバリエーション、GM プログラムチェンジへの追従、GS アーキテクチャ層と挿入エフェクト、SoundFont フォールバックのルーティングを扱います。
---

# GM／GS フォールバックバンク

このページは[内蔵シンセサイザー](./native-synth.md)の General MIDI／GS 側を扱います。データ不要の GM フォールバックバンクとその GS バリエーション音色・ドラムキットバリエーション、バウンスが GM プログラムチェンジに追従する仕組み、[SoundFont プレイヤー](./soundfont-player.md)が実装する Roland-GS のアーキテクチャ層と挿入エフェクト、そして SoundFont からバンクへ落ちる条件です。プログラムごとの音色一覧は [GM 音色マップ](./gm-tone-map.md) にあります。

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

### `drum-kit` プリセットと GM ドラムマップ

`drum-kit` は `percussion` エンジンを選び、入ってくる MIDI ノートを **General MIDI ドラムマップ**へ割り当てます。ノート番号をピッチとして扱うのではなく、ノート 36 はキック、ノート 38 はアコースティックスネア、というように対応づけます。ドラムパターンのノートを `drum-kit` をバインドしたデスティネーションへ送ると、各ノートが対応するパーツを鳴らします。

### GS / GM ドラムキットバリエーション

`drum-kit` は GS 系のドラムキット選択（GS は Roland による General MIDI の拡張セット。キットはバンク 128 のリズムパートのプログラム番号で指定します）も認識し、ノートオンの時点で Standard キットをセットごとに作り変えます。Room ならシェルの鳴りを増やし、Power なら音を下げて長くする、といった具合です。

各行には 2 つの番号が並びますが、これらは互換ではありません。**プログラム**はファイルが送る番号で、リズムパートのプログラムチェンジ番号、つまり規格が定めるアドレスです。**インデックス**はこのバンク内部のスロット番号です。インデックスは**追加のみ**で、あとから追加されたセットは空いている次の番号を取ります。そのため、セットを追加しても既存のセットの番号が付け替わることはなく、すでに正しく鳴っていたものが別の音になることもありません。

**トーンマップ**の列は、そのセットを最初に定義した世代です。これは [バンクセレクト LSB](#gs-アーキテクチャ層) が選ぶマップと同じものです。古いマップを指定したファイルは、それより後に追加されたセットには到達せず、それらは Standard へフォールバックします。その世代のモジュールの動作そのままです。

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
4 つのセット（**SFX**、**Rhythm FX**、**Cymbal & Claps**、**Rhythm FX 2**）は、実機の GS では音色を作り変えたキットではなく、個別のワンショット録音を集めたバンクです。膜モデルが作り変える対象がそもそも存在しないため、アドレスと名前は認識されますが Standard キットの音色で鳴ります。GM のサウンドエフェクト・プログラム（120-127、[GM 音色マップ](./gm-tone-map.md)を参照）も同じ立場で、共通の汎用ノイズ音色を共有します。これらのアドレスに実際のサンプルを持つ SoundFont を読み込めば、SF2 プレイヤー経由で通常どおり再生されます。
:::

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

## GS アーキテクチャ層

[SoundFont プレイヤー](./soundfont-player.md)は GM の上に、GS でオーサリングされたアレンジが期待する Roland-GS 拡張を実装します。

- **バリエーションバンクフォールバック** — SoundFont がカバーしない GS バリエーションバンクは、キャピタル（バンク 0）の音色へフォールバックします。欠けたバリエーションでも無音にならず、正しいファミリーを鳴らします。
- **チャンネル 10 のバンク 128 ドラムキット** — ドラムプログラムはバンク 128 にあり、慣習でチャンネル 10（インデックス 9）がドラムパートです。
- **NRPN パート編集** — TVF カットオフ／レゾナンス、TVA エンベロープ、ビブラートを NRPN でパートごとに編集でき、さらに個別のドラム音用の**ドラムごとの NRPN** も使えます。
- **GS／GM SysEx** — **GS Reset**、**GM System On**、「リズムパートに使用」の SysEx を認識します。ホストからのものと、アレンジ内に埋め込まれた SysEx イベントの両方に対応します。
- **センドリターン方式のシステムエフェクト** — 16 パート共通の 1 つのセンドリターンバスに、リバーブ・コーラス・ディレイの 3 ユニットが載っています。各パートの送信量は 2 つの経路の合算です。チャンネル CC センドでは、**CC91** がリバーブ送信、**CC93** がコーラス送信、**CC94** がディレイ送信を担い、リバーブとコーラスにはさらに SF2 ゾーンジェネレーター `reverbEffectsSend`／`chorusEffectsSend` の値が上乗せされます（GS のディレイ送信は CC 専用で、対応する SF2 ジェネレーターはありません）。パワーオン時は、音楽的に聞き取れる既定のルーム感（リバーブ送信 40、コーラス送信 8）から始まるため、リセット SysEx を送らない SMF でも空間の響きが残ります。これとは別に、パートごとの**ドライブ**インサート（ゲイン補正付きサチュレーション）もこのバスに並んで存在し、後述する GS の**挿入エフェクト**（EFX）という共有の別ユニットとは異なります。
- **MIDI 2.0／GM2** — MIDI 2.0 のバンク付きプログラムチェンジをデコードします。**バンクセレクト LSB（CC#32）** の解釈は MSB によって 2 通りに分かれます。
  - **GM2 のアドレッシング** — MSB が GM2 のメロディックバンク（`0x79`）またはパーカッションバンク（`0x78`）のとき、LSB はそのままバリエーション番号（またはパーカッションセット番号）で、GM2 の定義どおりです。
  - **GS のトーンマップ選択** — それ以外の MSB では、LSB は MSB のバリエーション番号が**どの世代の音色セットに届くか**を選びます。`0` はモジュール自身の（最新の）マップ、`1` は SC-55、`2` は SC-88、`3` は SC-88Pro、`4` は SC-8850 です。これ以外の値は `0` として読まれます。このメッセージを受け取っていないモジュールは、すでに自分のマップで鳴っているからです。選ばれたマップより後に追加された音色やキットは、キャピタル音色または Standard キットへフォールバックします。これはその世代の実機がする動作と同じです。

::: warning LSB は 2 つの意味を持つ
これは `Project.midiBankProgram(...)` に `bankLsb` として渡すバイトで、最も間違えやすい値です。GM2 の MSB のもとでは**バリエーション**を選び、GS の MSB のもとでは**トーンマップ**を選びます（バリエーション番号は MSB 側にあります）。GS のバリエーション MSB と並べて `bankLsb: 1` と書いてもバリエーション 1 にはならず、そのパートが SC-55 の音色セットに固定されます。
:::

::: warning SFX キットと GM サウンドエフェクトプログラムはまだ個別合成されていません
GS 系の **SFX ドラムキット**（リズムパートのプログラム 56）と GM の **サウンドエフェクト**プログラム（120〜127、Guitar Fret Noise から Gunshot まで）は、プレイヤー側でアドレスと名前は認識されますが、データ非依存の NativeSynth フォールバックではその音色はまだ個別に合成されていません。ワンショット系の GS リズムセット（SFX、Rhythm FX、Cymbal & Claps、Rhythm FX 2）は現状 Standard キットの音色で鳴り、プログラム120〜127は共通の汎用ノイズ系音色を共有します。これらのアドレスに実際のサンプルを持つ SoundFont を読み込めば、この SF2 プレイヤー経由で通常どおり再生されます — 制約があるのはフォールバックのみです。内蔵のフォールバック音作りは前述の [GM フォールバックバンク](#gm-フォールバックバンク) を参照してください。
:::

## GS 挿入エフェクト（EFX）

::: info 独自の DSP による再現であり、ハードウェアのデータを同梱するものではありません
libsonare の挿入エフェクトは、公開されている情報をもとに再構成した libsonare 独自のアルゴリズムの組み合わせで、GS の EFX の SysEx とタイプ番号体系に対応づけた独自の DSP による再現です。これにより GS 準拠で作られた MIDI が作曲者の意図したエフェクトを選べます。ただしアルゴリズムは独立しているため、同じアドレス指定とエフェクト構成には従いますが、特定のハードウェアモジュールの音そのものを再現するものでは**ありません**。1:1 のエミュレーションではなく、互換性のある再構成として捉えてください。サンプル・ROM データ・ファームウェアの同梱は一切なく、いかなるハードウェアメーカーとの提携や承認を意味するものでもありません。この互換性の背景にある標準や文献については、[アルゴリズム根拠](./algorithm-references.md)を参照してください。
:::

前述のリバーブ・コーラス・ディレイのセンドリターンバスとは別に、GS はもう1つ、**挿入エフェクト**（EFX）を定義しています。センドリターンバスと異なり、ギターのエフェクターのようにパートの信号経路へ直接挿入されるエフェクトです。libsonare は元のハードウェアと同じ設計で、プレイヤー全体で共有する**単一の挿入ユニット**として実装しており、16パートそれぞれに独立したエフェクトを持つわけではありません。16パートのどれでも、パートごとのオン／オフスイッチでこの1つのユニットへルーティングできます。オフのパートはこのユニットを完全にバイパスし、ドライのままミックスへ届きます。

どのバインディングにも「EFX を設定する」といった専用の型付き API はありません。実際の GS ハードウェアと同じように、EFX のタイプとパラメータは生の SysEx を送ることでのみプログラムします。ライブでは `RealtimeEngine.pushMidiSysex()` でそのバイト列を送り、オフラインではアレンジの MIDI に埋め込まれた SysEx がバウンス中にインラインで実現されます。

### EFX タイプ → 挿入エフェクト

各 EFX タイプ番号が 1 つの挿入エフェクトを選びます。タイプ `0` は Thru（エフェクトなし）です。

| EFX タイプ | GS EFX 名 | libsonare の挿入エフェクト |
|---|---|---|
| 0x0100 | Stereo EQ | パラメトリック EQ |
| 0x0101 | Spectrum | グラフィック EQ |
| 0x0102 | Enhancer | プレゼンスエンハンサー |
| 0x0110 | Overdrive | アンプシミュレーター（クランチ系） |
| 0x0111 | Distortion | アンプシミュレーター（ハイゲイン系） |
| 0x0120 | Phaser | フェイザー |
| 0x0121 | Auto Wah | エンベロープ追従型レゾナントバンドパス |
| 0x0122 | Rotary | 2ローターのロータリースピーカーモデル |
| 0x0123 | Stereo Flanger | フランジャー |
| 0x0124 | Step Flanger | フランジャー |
| 0x0126 | Auto Pan | オートパン |
| 0x0130 | Compressor | コンプレッサー |
| 0x0131 | Limiter | リミッター |
| 0x0140 | Hexa Chorus | 6声アンサンブル |
| 0x0141 | Tremolo Chorus | コーラス |
| 0x0142 | Stereo Chorus | コーラス |
| 0x0143 | Space-D | コーラス（変調なし） |
| 0x0144 | 3D Chorus | コーラス（広がりを付加） |
| 0x0150 | Stereo Delay | ステレオディレイ |
| 0x0151 | Modulation Delay | ステレオディレイ |
| 0x0152–0x0154 | 3-tap／4-tap／Time-Control Delay | ステレオディレイ |
| 0x0155 | Reverb | プレートリバーブ |
| 0x0156 | Gate Reverb | プレートリバーブ（ゲートテールは未実装） |
| 0x0157 | 3D Delay | ステレオディレイ |
| 0x0160 | 2-voice Pitch Shifter | ピッチシフター |
| 0x0161 | Feedback Pitch Shifter | ピッチシフター（フィードバックループは未モデル化） |
| 0x0172／0x0173 | Lo-Fi 1／2 | ビットクラッシャー |

Humanizer・Tremolo・3D Auto／Manual など一部の GS タイプには、まだ忠実な既製インサートがなく、ドライのまま通過します。Overdrive／Distortion のドライブとレベル、ピッチシフターの粗ピッチとバランスは、生の EFX パラメータから変換されます。それ以外の単一エフェクトタイプは、各インサート自身の既定値で動作します。

### 複合 EFX タイプ（多段チェーン）

複合 EFX タイプは、ハードウェアのブロック構成に合わせて、上記と同じ DSP インサートを直列につないだ**チェーン**として実現されます。たとえばギター用マルチエフェクトも、個々のアンプシミュレーター／コーラス／ディレイのインサートをつないで動作します。下の表は代表例で、実際のマップは `0x0200`〜`0x020C` の 2 段マトリクス（Overdrive／Distortion／Enhancer を Chorus・Flanger・Delay に通す組み合わせ）と、`0x0400`〜`0x0500` のギター／ベース／ローズ／キーボード用マルチプリセットまでを網羅します。

| EFX タイプ | GS EFX 名 | チェーン（信号順） |
|---|---|---|
| 0x0200 | OD → Chorus | アンプシミュレーター → コーラス |
| 0x0202 | OD → Delay | アンプシミュレーター → ステレオディレイ |
| 0x0400 | Guitar Multi 1 | コンプレッサー → アンプシミュレーター → コーラス → ディレイ |
| 0x0405 | Bass Multi | コンプレッサー → アンプシミュレーター（ベースキャビネット） → EQ → コーラス |
| 0x0406 | Rhodes Multi | エンハンサー → フェイザー → コーラス → オートパン |
| 0x0500 | Keyboard Multi | リングモジュレーター → EQ → ピッチシフター → フェイザー → ディレイ |

### ライブとオフラインでの実現方式

- **オフライン**（バウンス） — アレンジに埋め込まれた EFX の SysEx はレンダー中にインラインで適用されます。バウンスの途中で EFX が変わっても、次のブロックから反映されます。
- **ライブ** — `pushMidiSysex()` はオーディオスレッドの外で新しいエフェクトチェーンを構築し、ウェイトフリーに引き渡すため、ライブエンジンは再生を**止めずに** EFX の変化を聞き取れます。

下のデモは、同じ持続和音を GS 互換プレイヤーで鳴らしながら挿入エフェクトを切り替えて、それぞれがトーンをどう変えるかをドライ音と聴き比べられます。

<SonareDemo id="gs-efx" />

::: tip MIDI ヘルパーで GS バンクをオーサリングする
`Project.midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program)` は、バンクセレクトとプログラムチェンジを `setMidiEvents` が受け付ける MIDI イベントへ展開します。GS バリエーションやドラムキットを選ぶ正しい方法です。`Project.gmInstrumentName(program)`、`Project.gmDrumName(note)`、`Project.gm2InstrumentName(bankLsb, program)`、`Project.midiCcName(controller)` のような静的ヘルパーがスロットに名前を付けるので、オーサリングコードが読みやすくなります。逆方向も対称です。`Project.gmProgramForName(name)`、`Project.gmDrumNoteForName(name)`、`Project.midiCcIndexForName(name)` は正規名から番号を返し（未知の名前は `-1`）、`Project.gmFamilyName(family)` と `Project.gmFamilyFirstProgram(family)` は 16 の GM 楽器ファミリーを列挙します。`Project.gm2DrumSetName(bankLsb)` と `Project.gm2DrumName(bankLsb, note)` は GM2 のドラムセットバリエーションに名前を付けます。
:::

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

General MIDI の各プログラムは、音作りエンジンのいずれかに解決されます。全128プログラム分の楽器名・エンジン・備考をまとめた表は分量が大きいため、独立したページに置いています。各プログラムの正式名称は実行時に `Project.gmInstrumentName(program)` からも取得できます。

完全な表は [GM 音色マップ](./gm-tone-map.md) を参照してください。
