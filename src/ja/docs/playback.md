---
title: 再生レンダラー
description: PlaybackRenderer は、デコード済みの mono/stereo/5.1/7.1 の映画音声を、バイノーラルヘッドホン出力または調整済みスピーカー出力に変換します。アップミックス、ラウドネス整合、ナイトモード、台詞レベル、低音管理、ヘッドトラッキング、部屋のモデリングを備え、音声と映像の同期のために遅延を固定値として報告します。
---

# 再生レンダラー

`PlaybackRenderer` は、デコード済みの映画音声をリスナーが実際に聴く音に変換します。受け付けるのは mono・stereo・5.1・7.1 の PCM だけです — ビットストリームのデコードもコンテナの解釈も映像も扱いません。出力先はヘッドホン（バイノーラル化、ヘッドトラッキング、部屋のモデル）か、stereo・5.1・7.1 のスピーカー（アップミックス、スピーカー補正、低音管理）です。ラウドネス整合、ナイトモードのダイナミクスカーブ、台詞レベルの静的ゲインはどの出力先でも適用されます。

自前のデコーダーが PCM を出力した後で使ってください — WebCodecs のパイプライン、`<video>` 要素の `MediaElementAudioSourceNode`、ディスクから読み込んだデコード済みファイルなどです。このページが前提とする入出力のチャンネル規約は [チャンネル形式](./channel-formats.md) を参照してください。

## 段のパイプライン

処理は 12 個の名前付きステージを通ります。最初の 6 段は*入力側*のチャンネル構成だけに依存し、出力先によらず一度だけ動きます。残り 2 系統は出力先で分岐し、共通の出力リミッターに合流します。

<FlowDiagram
  title="再生レンダラーの段構成"
  direction="TB"
  :nodes="[
    { id: 'reorder', label: '並べ替え', col: 0, row: 0, group: 'front' },
    { id: 'dialogue', label: '台詞レベル', col: 0, row: 1, group: 'front' },
    { id: 'upmix', label: 'アップミックス', col: 0, row: 2, group: 'front' },
    { id: 'loudness', label: 'ラウドネス', col: 0, row: 3, group: 'front' },
    { id: 'night', label: 'ナイトモード', col: 0, row: 4, group: 'front' },
    { id: 'convert', label: 'レイアウト変換', col: 0, row: 5, group: 'front' },
    { id: 'calibration', label: 'スピーカー補正', col: 0, row: 6, group: 'speakers' },
    { id: 'bass', label: '低音管理', col: 0, row: 7, group: 'speakers' },
    { id: 'binaural', label: 'バイノーラル化 (HRTF)', col: 1, row: 6, group: 'headphones' },
    { id: 'early', label: '部屋・初期反射', col: 1, row: 7, group: 'headphones' },
    { id: 'late', label: '部屋・後部残響', col: 1, row: 8, group: 'headphones' },
    { id: 'limiter', label: '出力リミッター', col: 0, row: 9, variant: 'success' }
  ]"
  :edges="[
    { from: 'reorder', to: 'dialogue' },
    { from: 'dialogue', to: 'upmix' },
    { from: 'upmix', to: 'loudness' },
    { from: 'loudness', to: 'night' },
    { from: 'night', to: 'convert' },
    { from: 'convert', to: 'calibration', label: 'スピーカー出力' },
    { from: 'convert', to: 'binaural', label: 'ヘッドホン出力' },
    { from: 'calibration', to: 'bass' },
    { from: 'binaural', to: 'early' },
    { from: 'early', to: 'late' },
    { from: 'bass', to: 'limiter' },
    { from: 'late', to: 'limiter' }
  ]"
  :groups="[
    { id: 'front', label: '入力側に依存' },
    { id: 'speakers', label: 'スピーカーのみ' },
    { id: 'headphones', label: 'ヘッドホンのみ' }
  ]"
  caption="現在の設定が使わない段は飛ばされ、diagnostics().inactive_stages にその段自身の遅延内訳とともに名前が載ります。"
/>

台詞レベルは 5.1 / 7.1 入力の離散センターチャンネルにだけ作用し、mono / stereo 入力では何もしません。アップミックスは stereo 入力かつ `upmix.enabled` のときだけ動き、チャンネル間の位相相関から直接音とアンビエンスを分離して、アンビエンス成分を捨てずにサラウンドへ送ります（mono 和にパン則を掛けるのではありません）。レイアウト変換は入力側のチャンネル構成を出力先のチャンネル数に合わせて狭める・広げるを行います — 変換規則は [チャンネル形式](./channel-formats.md) を参照してください。ある設定でどの段が動くか（スピーカー出力では `binaural`・`room_early`・`room_late` が飛ばされ、mono 入力では `dialogue_level`・`upmix` が飛ばされる、など）は常に `diagnostics()` から読み取れ、設定から推測する必要はありません。

## 設定

設定は `schemas/playback-renderer-config.schema.json` に従う 1 つの JSON 文書で、コンストラクタと `setConfig`/`set_config` の両方に渡します。各キーは、生成時に固定される**prepare**キーか、次に処理するブロックから反映される**realtime**キーのどちらかです。`setConfig` は完全な文書を受け取り、現在値と異なる prepare キーは拒否されます。省略したキーは以下の既定値になります。

### prepare キー

| キー | 型・範囲 | 既定値 | 備考 |
|---|---|---|---|
| `input.layout` | `"auto"` \| `"mono"` \| `"stereo"` \| `"5.1"` \| `"7.1"` | `"auto"` | `auto` は各ブロック自身のチャンネル数（1・2・6・8）に追従します。[入力レイアウトの自動切り替え](#入力レイアウトの自動切り替え) を参照 |
| `input.channel_map` | 役割名の配列、または `null` | `null` | 固定の `input.layout` が必須。`null` は canonical 順を意味します |
| `target.kind` | `"headphones"` \| `"speakers"` | `"headphones"` | |
| `target.layout` | `"stereo"` \| `"5.1"` \| `"7.1"` | — | `speakers` では必須、`headphones` では禁止 |
| `target.speakers.<role>.distance_m` | 数値 [0.1, 30]、または `null` | `null` | 出力レイアウトの LFE 以外の役割のみ。`null` はそのスピーカーの距離補正を無効化します |
| `target.speakers.<role>.size` | `"large"` \| `"small"` | `"large"` | `"small"` は、低音管理が有効なときクロスオーバー周波数でハイパスされます |
| `target.bass_management.enabled` | 真偽値 | `false` | |
| `target.bass_management.crossover_hz` | 数値 [40, 200] | `80` | Linkwitz-Riley 4次のクロスオーバー |
| `target.bass_management.subwoofer` | 真偽値 | `true` | `false` は低域和と LFE チャンネルを large の L/R ペアへ折り込みます |
| `room.preset` | `"none"` \| `"living_room"` \| `"home_theater"` \| `"screening_room"` | `"living_room"` | ヘッドホンのみ。[部屋プリセット](#部屋プリセット) を参照 |

### realtime キー

| キー | 型・範囲 | 既定値 | 備考 |
|---|---|---|---|
| `target.speakers.<role>.trim_db` | 数値 [-20, 20] | `0` | |
| `target.bass_management.lfe_gain_db` | 数値 [-10, 15] | `10` | サブウーファーへ供給する際に LFE チャンネルへ掛けるゲイン |
| `lfe_mix_db` | 数値 [-60, 10] | `0` | 出力に LFE チャンネルが無い、または低音管理にサブウーファーが無いときに L/R へ折り込む LFE レベル |
| `upmix.enabled` | 真偽値 | `true` | stereo 入力のみに作用。切り替えても報告される遅延は変わりません |
| `upmix.center_width` | 数値 [0.05, 1] | `0.2` | パンニングインデックス上のセンター抽出窓の幅 |
| `upmix.front_ambience` | 数値 [0, 1] | `0.5` | アンビエンス成分のうちサラウンドへ送らず前方ペアに残す電力比 |
| `upmix.lfe_from_upmix` | 真偽値 | `false` | ローパス後の前方和から LFE 信号を生成します |
| `dialogue_level_db` | 数値 [-12, 12] | `0` | 5.1 / 7.1 入力の離散センターチャンネルへの静的ゲイン。mono / stereo では何もしません |
| `loudness.program_lufs` | 数値 [-70, 0]、または `null` | `null` | 測定済みの番組ラウドネス。`null` は整合ゲインを適用しません |
| `loudness.target_lufs` | 数値 [-40, -5] | `-24` | |
| `night_mode.amount` | 数値 [0, 1] | `0` | `0` でダイナミクスカーブを完全に無効化します |
| `room.mix_db` | 数値 [-30, 6] | `-6` | 初期反射と後部残響を合わせたレベル |
| `room.enabled` | 真偽値 | `true` | |
| `head_tracking.enabled` | 真偽値 | `true` | `false` は頭部姿勢をゼロとして扱います |
| `output_limiter.enabled` | 真偽値 | `true` | 切り替えても報告される遅延は変わりません |
| `output_limiter.ceiling_db` | 数値 [-12, 0] | `-1` | |

::: tip 番組ラウドネスは事前に測定する
`loudness.program_lufs` はレンダラーがライブに測定する値ではなく、呼び出し側が渡す値です — リアルタイムのラウドネス追従はシーンの切り替わりでポンピングを起こします。`PlaybackLoudnessMeter`（後述）は番組全体の統合ラウドネスを、オフラインで、あるいは再生前に一度だけ測定するので、ゲインは再生中ずっと固定されます。
:::

## 遅延

`latencySamples()` / `latency_samples()` は出力先・サンプルレート・スピーカーの距離補正だけで決まり、realtime キーにも、現在有効な入力レイアウトにも依存しません。

| 出力先 | 44.1 kHz | 48 kHz |
|---|---|---|
| stereo スピーカー | 265 sample（6.0 ms） | 288 sample（6.0 ms） |
| 5.1 / 7.1 スピーカー、またはヘッドホン | 1289 sample（29.2 ms） | 1312 sample（27.3 ms） |

アップミックス段を持ち得る出力先は、`upmix.enabled` の現在値に関わらずこの広い方の値になります。必要になり得る解析窓を常に確保しているためで、ライブセッション中にアップミックスを on/off しても遅延は動きません。スピーカー出力の距離補正は、この値の上にサンプル単位に丸めた独自の遅延を加えます。

## 入力レイアウトの自動切り替え

既定の `input.layout: "auto"` では、レンダラーは処理する各ブロックのチャンネル数（1・2・6・8）に追従し、ブロック境界で入力レイアウトを切り替えます。音の欠落や重複は起きず、遅延も変わりません。内部では、切り替え前のレイアウトの 6 段（入力側依存の段）が、自身の状態が減衰しきるまで出力への排出を続ける一方、新しいレイアウトの段は最初から動き始めます。両者は加算されるので、継ぎ目で音が失われることも重複することもありません。`input_channels()` / `inputChannels()` は現在有効なレイアウトのチャンネル数を返し（最初の呼び出し前は 2）、固定（非 `auto`）レイアウトで対応しないチャンネル数を渡すと、状態を進めずに拒否されます。

`diagnostics()` は `active_input_layout`、`layout_switches`（累計回数）、`truncated_drains` を返します。`truncated_drains` は、前の排出が終わる前にレイアウトが再度切り替わったときに増え、その際は中断された排出を 2 ms かけてフェードアウトさせてから打ち切ります。

## 音声と映像の同期

レンダラーは映像について何も知りません。音声と映像を揃えるためにホストへ渡せるのは、固定で報告可能な遅延、音の欠落や重複の無い入力レイアウト切り替え、シーク用の `reset()` であって、それ自体の同期機構ではありません。

- **レンダラー自身の遅延**: `latencySamples() / sampleRate`。
- **ホスト側の出力遅延がこれに加わります。** ブラウザでは `AudioContext.baseLatency + outputLatency`（`outputLatency` が無いブラウザではその項を 0 として扱う）。出力デバイスが変わると値も変わるため、`devicechange` / `sinkchange` のたびに読み直してください。ネイティブでは、デバイスが報告する遅延値を使います。
- **合計遅延が変わるのは、レンダラー自体を作り直したときだけです** — 出力先、サンプルレート、距離補正のいずれかを変えたとき。realtime キーの変更や入力レイアウトの切り替えでは変わりません。
- **シークの直後には `reset()` を呼んでください。** `process*` を呼ぶスレッドから呼ぶか（またはストリームを止めてから）、パイプラインに残っていた分を破棄します。worklet では、メディア要素の `seeking` イベントで `{ type: 'reset' }` を送ってください — port のハンドラーはレンダリングの合間に走るので、`process()` と競合しません。
- **2 つの組み方。** `<video>` 要素に再生を任せ、音声だけを `MediaElementAudioSourceNode` 経由でレンダラーに通す構成では、提示されるフレームの時刻が分からないため、表現できるのは*相対的な*遅れだけです — 音声は要素を直接鳴らした場合よりレンダラー自身の遅延（プラス最大 1 render quantum）だけ遅れて出てきますが、映像側を遅らせて合わせる手段はありません。自前の再生時計を持つ WebCodecs ベースのパイプラインであれば、各映像フレームの提示をレンダラーの遅延とホスト側の出力遅延の合計だけ遅らせることで、実際に同期を取れます。
- 参考までに、ITU-R BT.1359 は視聴者が音声の遅れに気付き始める閾値をおよそ 125 ms としています。レンダラー自身の遅延（27〜29 ms）はその一部でしかなく、ホスト側の出力遅延（通常 10〜50 ms、無線出力ではさらに大きくなります）の方が支配的になるのが普通です。
- ブラウザ内蔵のデコーダーは、libsonare 自身がデコードしない方式でも多チャンネル PCM を返せます。PCM になった時点で、他のデコード済みチャンネル構成と同じ経路でレンダラーに入ります — 元のストリームが持っていた高さやオブジェクトの情報は、その時点で既に失われています。

## ヘッドトラッキング

`setHeadOrientation(yaw, pitch, roll)` — 度数、右手系です。正の yaw で頭を右に、正の pitch で上を向き、正の roll で右耳を下げ、この順で適用します。スピーカー出力では無視されます。レンダラー自身にセンサーフュージョンはなく、アプリケーションが自前の IMU や device-orientation API を読み、更新のたびにこれを呼び出します。`head_tracking.enabled: false` は、このセッターを呼び続けたままでも姿勢をゼロとして扱います。

## HRTF セット

ヘッドホン出力は、各仮想スピーカー方向を頭部伝達関数（HRTF）で畳み込みます。この HRTF は `HrtfSet` ハンドルに保持され、**SHRF v1** というデータ形式で作られます — HRTF の測定データが通常公開される HDF5 ベースの SOFA 形式ではなく、最小位相インパルス応答と両耳間時間差を規則格子の方位・仰角ごとに持つ、小さく自己完結した独自形式です。

WASM 以外の全サーフェスは、既定の HRTF セット — SADIE II の被験者 D1（KU100 ダミーヘッドによる測定）を 504 方向に間引いたもの — をファイル無しで 1 回の呼び出しから構築できます。WASM はモジュールのダウンロードサイズを抑えるため HRTF データを埋め込まず、パッケージ自身の既定アセットを取得してバイト列を `HrtfSet.fromBytes` に渡します。

```typescript
const bytes = new Uint8Array(await (await fetch(hrtfUrl)).arrayBuffer());
const hrtf = HrtfSet.fromBytes(bytes);
```

ライブラリのソースツリーにある `tools/playback/sofa_to_shrf.py` は、SOFA 形式の HRIR 測定データを SHRF v1 ファイルに変換し、独自の HRTF セットを作れます。`HrtfSet` から生成したレンダラーはデータ自身のコピーを保持するので、生成直後にセットを解放しても構いません。

## 部屋プリセット

ヘッドホン出力では、直接音（HRTF で畳み込んだ音）の周りに合成された部屋を加えられます — 部屋に固定した水平リングからの初期反射と、減衰していく後部残響で、どちらも直接音と同じバイノーラル経路を通るため頭の回転に追従します。`room.preset` は固定の直方体の部屋を選び（`none` で無効化）、`room.mix_db` は初期反射と後部残響を合わせたレベルを、`room.enabled` は報告される遅延を変えずにライブで切り替えます。部屋プリセットはスピーカー出力では使えません — スピーカー出力は既に実在の部屋の中で鳴っているためです。

| プリセット | 特徴 |
|---|---|
| `none` | 部屋を加えない。直接の HRTF 音のみ |
| `living_room` | 小さめ、中程度の吸音 |
| `home_theater` | より大きく、より吸音的 |
| `screening_room` | 最大、最も吸音的 |

## ラウドネス整合とメーター

`loudness.program_lufs` と `loudness.target_lufs` は 1 つの静的ゲインを適用します（target より上は +12 dB、下は -40 dB でクランプ）。ライブな圧縮がシーンの切り替わりでポンピングを起こすことなく、番組素材を一定のレベルに揃えます。`PlaybackLoudnessMeter`（1・2・6・8 チャンネル、BS.1770 のチャンネル重み）は、再生前に番組全体の統合ラウドネスを測定します。`pushInterleaved`/`push_interleaved` でインターリーブ済みのチャンクを流し込み、番組を最後まで流し終えたら `integratedLufs()`/`integrated_lufs()` を読み、その値を `loudness.program_lufs` として渡してください。

## どの言語でも同じ流れ

どのバインディングも同じ形です — 設定文書（とヘッドホン出力用の `HrtfSet`）からレンダラーを生成し、ブロックを処理し、ハンドルを解放します。CLI だけはファイル全体を 1 回の呼び出しでレンダーします。

::: code-group

```c [C]
#include <sonare/sonare_c_playback.h>

SonareHrtfSet* hrtf = NULL;
sonare_hrtf_set_create_default(&hrtf);  // ネイティブビルドのみ。WASM には存在しない

SonarePlaybackRenderer* renderer = NULL;
SonareError err = sonare_playback_renderer_create_json(
    "{\"target\":{\"kind\":\"headphones\"}}", hrtf, 48000, 1024, &renderer);
if (err != SONARE_OK) return err;

err = sonare_playback_renderer_process_interleaved(renderer, in, in_channels, out, 2, frames);

int latency = 0;
sonare_playback_renderer_latency_samples(renderer, &latency);

sonare_playback_renderer_destroy(renderer);
sonare_hrtf_set_destroy(hrtf);
```

```python [Python]
import libsonare as sonare

with sonare.HrtfSet.default() as hrtf, sonare.PlaybackRenderer(
    {"target": {"kind": "headphones"}}, hrtf=hrtf, sample_rate=48000
) as renderer:
    out = renderer.process_interleaved(samples, in_channels=6)
    print(renderer.latency_samples(), renderer.diagnostics())

# 同じ設定で配列全体をレンダーする:
rendered = sonare.render_playback(samples, channels=6, sample_rate=48000, config={"target": {"kind": "headphones"}})
```

```typescript [Node]
import { HrtfSet, PlaybackRenderer } from '@libraz/libsonare-native';

using hrtf = HrtfSet.default();
using renderer = new PlaybackRenderer({
  config: { target: { kind: 'headphones' } },
  hrtf,
  sampleRate: 48000,
});

const out = renderer.processInterleaved(samples, 6);
console.log(renderer.latencySamples(), renderer.diagnostics());
```

```typescript [WASM / Worklet]
// AudioWorklet 上でのリアルタイム利用 — このレンダラーの主用途です。
// 動画要素自身の多チャンネルデコードを、そのままバイノーラルヘッドホンへ。
// ブラウザ自身のデコーダーが出す 5.1 入力は仕様で定義済みで libsonare の
// canonical 順と一致しますが、7.1 のチャンネル順はブラウザ間でまだ確認が
// 取れていません（チャンネル形式を参照）。確認が済むまで worklet の入力は
// mono/stereo/5.1 に留めてください。
await context.audioWorklet.addModule(playbackWorkletUrl);
const hrtf = await (await fetch(hrtfUrl)).arrayBuffer();
const node = createSonarePlaybackNode(context, {
  config: { input: { layout: 'auto' }, target: { kind: 'headphones' } },
  hrtf,
});
context.createMediaElementSource(video).connect(node).connect(context.destination);
video.addEventListener('seeking', () => node.port.postMessage({ type: 'reset' }));
```

```bash [CLI]
# ファイル全体を 1 回の呼び出しでレンダーします。--program-lufs を省略すると
# 入力自体からラウドネスを測定します。
sonare playback movie-5.1.wav -o headphones.wav --target headphones
sonare playback movie-5.1.wav -o out-7.1.wav --target 7.1 --room home_theater --night 0.5
```

:::

ワンショット形式 — `renderPlayback`/`render_playback`/`sonare_playback_render_interleaved`/`sonare playback` — は内部でレンダラーを生成して信号全体を流し、レンダラー自身の遅延を結果の先頭から取り除くので、出力は入力とサンプル単位で揃います。

## 非対象

- 圧縮サラウンド形式・コンテナ・映像のデコード。レンダラーが受け付けるのはデコード済みの PCM のみです。
- 圧縮音声を無加工のまま外部の受信機へ渡すこと。
- 高さチャンネルやオブジェクトベースの音声。チャンネルレイアウトは mono・stereo・5.1・7.1 に限られます。
- 適応型の台詞強調 — 音声検出、台詞に応じたダッキング、了解度モデルなど。台詞レベルは離散センターチャンネルへの静的ゲインのみで、そのチャンネルを持つ入力にしか作用しません。
- マイク測定やテストトーンによる自動音場補正。部屋プリセットは固定モデルで、スピーカーの距離・トリム・クロスオーバーは呼び出し側が指定します。
- 番組内容や周囲騒音に連動するリアルタイムのラウドネス追従。ラウドネス整合は、呼び出し側が渡す（あるいは別途事前測定した）番組ラウドネスから計算する静的ゲインです。
- クロストークキャンセル、HRTF の個人化、任意形状・任意寸法の部屋。
- SOFA ファイルを直接読み込むこと。まずオフラインで SHRF v1 に変換してください。
- 頭部姿勢のセンサーフュージョン。yaw/pitch/roll はアプリケーション自身が渡します。

## 関連ページ

- [チャンネル形式](./channel-formats.md)
- [サラウンドグループバスとワイドメーター](./realtime-engine.md#サラウンドグループバスとワイドメーター)
- [音響解析](./acoustic-analysis.md)
- [CLIリファレンス](./cli.md)
- [JavaScript API](./js-api.md)
- [Python API](./python-api.md)
- [Node.js ネイティブ API](./node-api.md)
