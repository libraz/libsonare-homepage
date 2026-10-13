---
title: ブラウザでミキシングアプリを作る
description: ミキシングスタジオを参考に、1 つのプロジェクト状態でライブのエンジンと書き出しを動かし、ステレオ音声の読み込みとプロジェクトファイルを組み合わせる Web アプリの実装ガイド。
---

# ブラウザでミキシングアプリを作る

ミキシング専用の Web アプリには、ファイル読み込み、同期再生、トラック操作、ミックスの書き出しが必要です。libsonare が DSP とルーティングを提供し、アプリが画面、音源の保存、WAV への変換を担当します。MIDI 編集、音源、録音を組み込む必要はありません。

[ミキシングスタジオ](/ja/mixing)は、その実装例です。ローカルのステムを読み込み、クリップの配置とフェード、トリム、6 バンド EQ、ゲート、コンプレッサー、ディエッサー、ダッキング、パン、幅、プレートリバーブとディレイへのセンド、各トラックの出力先（マスターか 2 つのサブグループバスのどれか）、マスターのグルーコンプレッサーとリミッターを操作して、ステレオ WAV を書き出せます。**デモを読み込む**から始め、**再生**してフェーダーを動かし、**WAV をバウンス**します。音声処理はブラウザ内で完結します。下の 3 本のレーンはエンジン自身のチャンネルストリップで、スタジオはこの操作子を組み合わせて作られています。

<SonareDemo id="engine-lane-mixer" />

## 再生とレンダリングの API を選ぶ

| アプリの動作 | 入口 | アプリ側の担当 |
|---|---|---|
| ステレオ配列を一括でミックス | [`mixStereo`](../mixing.md#一括ミックス-mixstereo) | デコード、入力の位置合わせとパディング、結果のファイル化 |
| 独自の再生処理でステムミキサーを動かす | [`Mixer`](../mixing.md#シーンベースのミックス-mixer) | ブロック供給、再生位置の管理、UI 操作の伝達、同じグラフのオフライン処理 |
| タイムライン再生、操作、オートメーション、書き出しをまとめて扱う | `@libraz/libsonare/worklet` の [`SonareEngine`](../realtime-streaming.md#audioworklet-での使い分け) | クリップ読み込み、レーンとルーティングの設定、出力接続、UI と保存 |

新しく試聴と書き出しを備えたアプリを作る場合は、[SonareEngine の設定例と操作一覧](../realtime-streaming.md#audioworklet-での使い分け)から始めてください。この API は操作を AudioWorklet 内のエンジンとオフライン用エンジンに反映します。`renderOffline` が返すのは PCM で、`bounceOffline` は素のエンジンと同じオプションでインターリーブバッファを返します（[オフライン書き出しの API](../realtime-streaming.md#オフライン書き出しの-api) を参照）。WAV への変換とダウンロードはアプリが担当します。長いオフライン処理には Worker の設計も必要です。メソッドが async でも、計算が自動でメインスレッドの外へ移るわけではありません。

ミキシングスタジオは表の 3 行目の構成です。ファサードがプロジェクトをライブで再生し、ワーカーが同じプロジェクトを素の `RealtimeEngine` でバウンスします。連続値の操作は setter でエンジンに渡すので、再生中にフェーダーを動かしてもリバーブの残響などプロセッサの状態は保たれます。ゲートのホールド時間のように構築時にしか決められないパラメータは、ストリップのインサートを作り直すため、コントロールを離したときに適用します。トラックの出力先（マスターかサブグループバス）は `setTrackOutputBus` で設定し、これも同じ操作リストの 1 つなので、プレビューとバウンスのルーティングは一致します。

## 1 回の呼び出しでミックスを書き出す

::: info 用意するもの
- **インストール:** ES モジュールと `.wasm` ファイルを配信できるバンドラー（Vite など）を使った Web プロジェクトで `npm install @libraz/libsonare` を実行します。パッケージの読み込みは [WebAssembly ガイド](../wasm.md) で解説しています。
- **ファイル選択:** `<input type="file" accept="audio/*" multiple>`。その `files` が、下のコードが読む `File[]` です。
- **ユーザー操作:** `AudioContext` はクリックのハンドラーの中で作るか再開してください。ユーザー操作なしに作った `AudioContext` はブラウザが停止状態のままにするので、結果を再生できません。
- **ステム:** 同じセッションから書き出し、頭がそろった WAV か MP3。
:::

最小のミキサーは `mixStereo` です。ステムをデコードして長さを揃え、ミックスし、結果を WAV に変換します。フェーダー、パン、トリム、幅はステムごとに 1 つずつ値を渡し、`mix.meters[i]` には各ステムのメーターが入ります。`files` はファイル選択で得た `File[]` で、ゼロの部分は UI の値に置き換えます。

```typescript
import { init, mixStereo } from '@libraz/libsonare';

await init();
const ctx = new AudioContext();

// コンテキストのレートでデコードし、最長のステムに合わせて埋める。
const buffers = await Promise.all(
  files.map(async (f) => ctx.decodeAudioData(await f.arrayBuffer())),
);
const length = Math.max(...buffers.map((b) => b.length));
const channel = (b: AudioBuffer, i: number) => {
  const out = new Float32Array(length);
  out.set(b.getChannelData(Math.min(i, b.numberOfChannels - 1))); // モノラルは左右の両方に使う
  return out;
};

const mix = mixStereo(
  buffers.map((b) => channel(b, 0)),
  buffers.map((b) => channel(b, 1)),
  ctx.sampleRate,
  { faderDb: buffers.map(() => 0), pan: buffers.map(() => 0) },
);

// 16 ビットのステレオ WAV。
function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const n = left.length;
  const view = new DataView(new ArrayBuffer(44 + n * 4));
  const tag = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, 36 + n * 4, true); tag(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, n * 4, true);
  const s16 = (x: number) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
  for (let i = 0; i < n; i++) {
    view.setInt16(44 + i * 4, s16(left[i]), true);
    view.setInt16(46 + i * 4, s16(right[i]), true);
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

// 合計にはリミッターがかからない。0 dB のステムを足すとフルスケールを超えることがあり、
// その場合は上のエンコーダーが平らにクランプしてしまう。エンコード前にピークを確かめる
let peak = 0;
for (const ch of [mix.left, mix.right]) for (const x of ch) peak = Math.max(peak, Math.abs(x));
if (peak > 1) console.warn(`mix peaks at ${(20 * Math.log10(peak)).toFixed(1)} dBFS; lower the faders`);

const url = URL.createObjectURL(encodeWav(mix.left, mix.right, mix.sampleRate));
```

警告が出たら、フェーダーを下げて（あるいは両チャンネルに同じゲインをかけて）からミックスし直してください。0 dB の 3 本のステムが同相で重なると、フルスケールの 3 倍に達することもあります。サンプルピークがフルスケール未満でも、納品前には[インターサンプルピーク](../glossary/true-peak.md)の確認が残ります。

このページの以降の内容は、この呼び出しの周りにアプリが足すもの、つまりライブ再生、書き出しと同期した編集、プロジェクトファイルです。

## 音源、プロジェクト状態、エンジン操作を分ける

<FlowDiagram
  title="1 つの状態、1 つの操作列、2 つのエンジン"
  direction="TB"
  :nodes="[
    { id: 'state', label: 'プロジェクト状態', col: 1, row: 0 },
    { id: 'diff', label: 'mixingEngine.ts の差分', col: 1, row: 1 },
    { id: 'ops', label: 'EngineOp[]', col: 1, row: 2, variant: 'accent' },
    { id: 'live', label: 'SonareEngine（AudioWorklet）', col: 0, row: 3, variant: 'accent' },
    { id: 'worker', label: 'RealtimeEngine（Worker）', col: 2, row: 3, variant: 'accent' },
    { id: 'preview', label: 'ライブ試聴', col: 0, row: 4, variant: 'success' },
    { id: 'bounce', label: 'バウンスした PCM', col: 2, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'state', to: 'diff', label: '前 → 次' },
    { from: 'diff', to: 'ops' },
    { from: 'ops', to: 'live', label: 'createFacadeTarget' },
    { from: 'ops', to: 'worker', label: 'createRawTarget' },
    { from: 'live', to: 'preview' },
    { from: 'worker', to: 'bounce' }
  ]"
  caption="engineApply.ts が同じ操作列を、ライブ用のファサードと書き出し用 Worker の素のエンジンの両方で解釈します。そのため試聴とバウンスは同じレンダリングになります。"
/>

1. すべてのファイルを 1 つの `AudioContext` でデコードします。モノラル入力は左右へ複製します。5.1 と 7.1 のファイルはエンジンの `downmix` でステレオへ畳み込み（センターとサラウンドは −3 dB、LFE は捨てる）、それ以外の 3 チャンネル以上の入力はモノラルへ畳み込みます。サラウンドのチャンネルを分けたまま扱うアプリには、独自のチャンネル割り当てが必要です。デモはそのコンテキストのサンプルレートで左右のチャンネルを保持します。解析用のモノラル配列ではステレオ再生を再現できません。
2. PCM 配列は、プロジェクト状態とは別の、トラック ID をキーにした音声レジストリに保存します。クリップは開始位置、ソース内のトリム、長さ、フェードを持ちます。読み込んだステムはすべて 0 秒から始まり、移動は明示的なタイムライン操作で行います。
3. プロジェクトは、トラック、バス、マスター、VCA ゲイン、ループをまとめた 1 つのシリアライズ可能なオブジェクトとして持ちます。編集はすべて、ある状態から次の状態を作る純粋な関数です。2 つの状態の差分がエンジン操作の列になり、取り消しとやり直しも同じ経路を通ります。[ミキサーシーン](../mixing-scene-json.md)は単体の `Mixer` グラフを記述する形式で、デモはこれを使わず、リアルタイムエンジンを直接操作します。
4. [プロジェクト JSON](../mixing-demo-project-json.md)を別に保存します。音源を含まない状態だけを持つので、開き直したプロジェクトのトラックは音声待ちになり、追加したファイルは同じ名前のトラックへ、なければ次のトラックへ順に割り当てられます。
5. PCM をレンダリングし、WAV に変換してダウンロードします。デモは 16 ビット・24 ビット・32 ビット float の WAV を書き出し、整数形式では TPDF またはノイズシェイプのディザを選べます。バウンス後にピークと True Peak を確認してください。レベルを下げる場合は操作値を調整し、再度バウンスしてからダウンロードします。

セッション全体を開き直せるアプリには、保存した音声ファイルと安定した音源 ID など、アプリ独自の音源保存が必要です。ミキサーシーン JSON もデモのプロジェクトファイルも、音源を含むプロジェクトアーカイブではありません。

## 参考実装を読む

デモは[ホームページのソースディレクトリ](https://github.com/libraz/libsonare-homepage/tree/main/src/demos/mixing)にあります。次の順序で読むと各処理を辿れます。

| ファイル | 担当 |
|---|---|
| [`useMixingStudio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/useMixingStudio.ts) | ファイル読み込みと音声の予算、履歴、エンジンとの同期、オートミックスの A/B、Worker の実行、プロジェクトファイル |
| [`mixingState.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingState.ts) | プロジェクト状態、既定値、mutator、v2 の読み込み |
| [`mixingEngine.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingEngine.ts) | 状態からエンジン操作への変換。全体の構築、差分、書き出しの長さ |
| [`engineApply.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/utils/engineApply.ts) | 操作の集合と 2 つのアダプタ（ライブのファサード用、素のエンジン用） |
| [`useSonareEngine.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/composables/useSonareEngine.ts) | `SonareEngine` ファサードの起動、再生位置、メーター、後片付け |
| [`mixingBounce.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingBounce.ts) | Worker の管理、要求の振り分け、PCM バッファの転送 |
| [`mixing.worker.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixing.worker.ts) | バウンス、オートミックスの解析、A/B 用のラウドネス測定 |
| [`mixAssistantMap.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixAssistantMap.ts) | ミックスの提案を固定のストリップ構成へ写す処理 |
| [`mixingProjectV1.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingProjectV1.ts) | v1 プロジェクトファイルの変換 |
| [`audio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/utils/audio.ts) | デコードの補助、波形の要約、形式とディザを選べる WAV への変換 |
| [`MixingStudio.vue`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/MixingStudio.vue) | アレンジ、コンソール、マスターセクション |

デモはコピー済みのエンジンを `@/wasm` から読み込みます。別のアプリでは完全版の `@libraz/libsonare` パッケージを使ってください。小さい解析用エントリーはミキシングを含みません。パッケージの読み込みは [WebAssembly ガイド](../wasm.md)、独自 Worklet の初期化は [WASM ストリーミングとリアルタイム](../wasm-streaming.md)で解説しています。

## 試聴で確認できる範囲

| 動作 | ミキシングスタジオ |
|---|---|
| トラック操作、EQ、ダイナミクス、センド、VCA | 再生中も setter でライブに反映 |
| クリップの移動・トリム・フェード、オートメーションレーン | 再生でもバウンスでも反映 |
| ストリップ、バス、マスターのメーター | ライブ表示。ラウドネスレンジは直近のバウンスの値 |
| チャンネルディレイ | 停止中だけ適用。再生中の変更は停止するまで保留 |
| オートミックスの A/B | 自分のミックスと提案をライブで切り替える。ラウドネスはモニター段だけで揃え、大きい側を下げる。バウンスにもプロジェクトにも入らない |
| 試聴とバウンス | 同じ状態からビット単位で一致して出力 |
| 残響とグラフのレイテンシ | バウンスは、最後のクリップの終わりに、エンジンが報告するグラフのレイテンシ（`graphLatencySamplesQ8`）とテール（`tailSamples()`）を足した長さまで |
| プロジェクトファイル | v2 は音源を含まない状態を保存。v1 は開くときに変換 |

Worker には PCM をレジストリから転送するため、バウンス、解析、ラウドネス測定の実行中は配列が切り離され、編集はロックされます。ジョブが終わるとレジストリに戻ります。各ソースはページ、エンジン、バウンス用 Worker の 3 か所に保持されるため、ピーク時のメモリ使用量が増えます。

8 トラック、1 トラック 5 分、合計 20 分の制限はデモ側の上限で、エンジンの上限ではありません。引き上げる場合は対象端末でメモリと音声スレッドの負荷を計測してください。長いセッションでは[クリップ音声のページストリーミング](../wasm-streaming.md#クリップ音声のページストリーミング)を参照してください。Worklet エンジンへの OPFS ページングは SharedArrayBuffer とクロスオリジン分離の有無にかかわらず動作し、デモの再生もそれらを使わずに動きます。

## ミックスに使う前に確認する

- 同じセッションから書き出したステムを読み込み、開始位置が揃っていることを確認します。
- 試聴した状態をそのままバウンスし、オートメーションとリバーブの残響を含めてライブの試聴と比較します。
- モノラルとステレオ、異なるファイルサンプルレート、ミュートとソロ、クリップの開始位置、フェード、末尾のリバーブ残響を確認します。
- プロジェクトを保存し、対応する音源を開き直してからプロジェクトファイルを開きます。各トラックに音源が割り当てられ、操作値が復元されることを確認します。
- 読み込み中やバウンス中に再生を停止し、画面を閉じます。エンジン、Worker、AudioContext、ダウンロード URL を解放します。

## 関連

- [ミキシングエンジン](../mixing.md)：DSP 操作、シーン処理、オートメーション、メーター
- [リアルタイムエンジン](../realtime-engine.md)：タイムライン、ルーティング、オフラインレンダリング
- [ミキシングデモのプロジェクト JSON](../mixing-demo-project-json.md)：デモで使うプロジェクトファイル
- [ミキシングシーン JSON](../mixing-scene-json.md)：エンジンのグラフ形式
