---
title: GM／GS フォールバックバンク
description: NativeSynth の GM フォールバックバンクのリファレンスです。GS バリエーション音色、GM/GS ドラムキットバリエーション、GM プログラムチェンジへの追従、SoundFont フォールバックのルーティング、全128プログラムの音色マップを扱います。
---

# GM／GS フォールバックバンク

このページは[内蔵シンセサイザー](./native-synth.md)の General MIDI／GS 側を扱います。データ不要の GM フォールバックバンクとその GS バリエーション音色・ドラムキットバリエーション、バウンスが GM プログラムチェンジに追従する仕組み、SoundFont からバンクへ落ちる条件、そして全128プログラムの音色マップです。

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
