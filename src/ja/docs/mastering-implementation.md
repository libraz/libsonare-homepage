---
title: マスタリング実装
description: ブラウザ内マスタリングデモが UI の判断を libsonare WASM 処理へどう対応させるか。オフラインのリペア、リアルタイムエンジン上の固定インサート列、3 レーンの A/B を扱います。
---

# マスタリング実装

このページは、`/ja/mastering` デモが少数の UI 上の判断を、決定的な libsonare マスタリングレンダリングへどう変換するかを説明します。自動生成したパラメータ一覧ではなく、UI・ワーカー・リアルタイムエンジン・WASM の各エクスポート・機能群ごとの用語集ガイドをつなぐ実装マップとして使います。

ブラウザデモでは、長い解説は VitePress のドキュメントを正本にしています。アプリケーション UI には短いラベルと、このドキュメントへの導線だけを置いています。

::: info ワーカー・transferable バッファ・object URL
**ワーカー**は、UI を動かすメインスレッドとは別に JavaScript を実行する仕組みです。**transferable バッファ**は、音声メモリをコピーせずワーカーへ渡すための受け渡し方式です。**object URL** は、生成した音声やレポートを再生・ダウンロードするための一時的なブラウザ内 URL です。
:::

## このページで身につくこと

このページを読むと、次のことを追跡・説明できるようになります。

- ブラウザ内マスタリングデモが、ファイル入力からリペアの前処理、ライブのインサート列、メーター、書き出し、レポート生成へ進む流れを追える。
- 長い説明をドキュメント側に置き、アプリ UI を短いラベル中心に保つ理由を理解できる。
- UI コントロールをインサートのスロットと用語集ページへ対応づけられる。
- After・Before・Reference の 3 レーンが、ギャップのないラウドネス合わせの A/B/R になる仕組みを理解できる。
- WASM 宣言とマスタリング API ドキュメントの整合を保つ検証コマンドを把握できる。

## レンダリングフロー

<FlowDiagram
  title="レンダリングフロー"
  :nodes="[
    { id: 'file', label: '音声ファイル', col: 0, row: 0 },
    { id: 'decode', label: 'Web Audio でデコード', col: 1, row: 0 },
    { id: 'buffers', label: 'Float32 バッファ', col: 2, row: 0 },
    { id: 'worker', label: 'リペアの前処理（ワーカー）', col: 3, row: 0, variant: 'accent' },
    { id: 'lanes', label: 'SonareEngine: After / Before / Reference レーン', col: 4, row: 0, variant: 'accent' },
    { id: 'meters', label: 'ライブメーターと A/B/R', col: 5, row: 0 },
    { id: 'export', label: '書き出しレンダリング（ワーカー、同じ操作）', col: 5, row: 1, variant: 'accent' },
    { id: 'wav', label: 'ディザ付き WAV', col: 6, row: 1, variant: 'success' },
    { id: 'json', label: 'JSON report', col: 7, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'file', to: 'decode' },
    { from: 'decode', to: 'buffers' },
    { from: 'buffers', to: 'worker' },
    { from: 'worker', to: 'lanes' },
    { from: 'lanes', to: 'meters' },
    { from: 'worker', to: 'export' },
    { from: 'export', to: 'wav' },
    { from: 'export', to: 'json' }
  ]"
  caption="リペアはオフラインで一度だけ走ります。試聴と書き出しは同じエンジン操作を使うので、ファイルにはレーンで鳴っていた音がそのまま入ります。"
/>

デコードはブラウザ API で行います。リペアの各ステージ（declip、declick、decrackle、dehum、denoise、dereverb）はオフライン専用なので、最初にワーカーで実行してエンジンが再生するプログラムのクリップを作ります。再実行されるのはリペア設定を変えたときだけです。それ以降はリアルタイムエンジンの仕事で、ページは AudioWorklet 上の `SonareEngine` ファサードを postMessage モードで再生します。このため、サイトは SharedArrayBuffer を使わずに済んでいます。

エンジンには 3 つのレーンがあります。**After** はプログラムをインサート列と 8 バンドのストリップ EQ に通したもの、**Before** は同じプログラムを無加工で流したもの、**Reference** は任意のリファレンスファイルです。A/B/R の切り替えはレーンのフェーダーを動かすだけなので、3 レーンは常に動き続け、切り替えにギャップは生じません。各レーンは出力側でラウドネスが揃えられます。大きいレーンは最も静かなレーンに合わせて下げられ、上げられるレーンはありません。ラウドネス合わせをオフにすると、どのレーンも 0 dB のままです。

書き出しは、ワーカー内の素の `RealtimeEngine` で、ライブのエンジンが受けたものと同じ操作を使って lane 1 をレンダリングします。試聴と書き出しは同じ状態からビット単位で一致して出力されます。ワーカーが返した PCM を 16 ビット・24 ビット・32 ビット float の WAV にエンコードし、ディザを選べます。32 ビット float にはディザをかけません。

## インサート列

lane 1 には 13 スロットのインサートが固定の並びで入っています。モジュールの ON/OFF はバイパスなので、スロット番号やオートメーション ID は動きません。

| スロット | プロセッサ |
|------|-----------|
| Input | `utility.gain` |
| Tone | `eq.tilt` |
| De-esser | `dynamics.deesser` |
| Transient | `dynamics.transientShaper` |
| Compressor | `dynamics.compressor` |
| Multiband | `multiband.compressor` |
| Tape | `saturation.tape` |
| Exciter | `saturation.exciter` |
| Air | `spectral.airBand` |
| Stereo | `stereo.imager` |
| Mono bass | `stereo.monoMaker` |
| Drive | `utility.gain`（リミッターの直前） |
| Limiter | `maximizer.truePeakLimiter` |

連続値のコントロールはパラメータのセッターでエンジンに渡すので、つまみを回してもプロセッサの内部状態は保たれます。マルチバンドのニーやリミッターのルックアヘッドなど、構築時にしか決められない一部のパラメータは、そのストリップのインサートを作り直します。UI はそれらをコントロールを離したときに適用します。

ラウドネスフィットが動かすのはリミッター前の Drive ゲインだけで、ダイナミクス系ステージへの入力レベルは変わりません。レンダリングは最大 3 回で、選んだシーリングではリミッターが目標に届かない場合は「届かなかった」と報告します。

メーターブリッジには、聴いているレーンのピーク、True Peak（再生開始からの保持値）、モーメンタリー・ショートターム・インテグレーテッドのラウドネス、PLR、チェーン全体のゲインリダクション、相関値、ゴニオメーター、スペクトラムが表示されます。ラウドネスレンジは直近の書き出しレンダリングの値です。編集はすべて 1 件の履歴になるので、取り消しややり直しも通常の編集と同じようにエンジンへ届きます。

## データの所有

音源はユーザーの端末上に残ります。ソースファイル、任意のリファレンスファイル、レンダリング後の WAV、JSON レポート、書き出した設定はすべてブラウザ内のローカルオブジェクトとして扱われ、レンダリングのためにアップロードされることはありません。

これは実装上も重要です。UI はサーバー側のリトライ、リモートキュー、アカウント状態に依存できません。エラー処理はローカルでの復旧を前提にします。具体的には、ブラウザが対応する別の形式を試す、ソースの長さを短くする、強すぎる設定を下げる、ワーカー失敗後に書き出しをやり直す、といった流れです。

## UI とチェーンの対応

クイックマスターは音楽的な判断だけを見せ、Studio は機能群ごとにまとめたコントロールを見せます。どちらも同じプロジェクト状態を編集し、その状態が上のインサート列に対応づけられます。

| UI 上のエリア | チェーン上のエリア | 主なガイド |
|---------|------------|-----------|
| リペアの各ステージ、インプットゲイン | オフラインのリペアと Input スロット | [リペアと入力コントロール](./glossary/mastering/repair.md) |
| トーン、エキサイター、Air | トーンと Air | [トーンと Air コントロール](./glossary/mastering/tone-air.md) |
| スレッショルド、レシオ、アタック、リリース | ダイナミクス | [ダイナミクスコントロール](./glossary/mastering/dynamics.md) |
| 幅、シーリング、目標 LUFS | Stereo・Drive・Limiter スロット | [ステレオ・リミッター・ラウドネスコントロール](./glossary/mastering/stereo-limiter-loudness.md) |
| ソース／リファレンスの比較 | ペア解析 | [リファレンスマッチ](./glossary/mastering/reference-match.md) |
| LUFS、True Peak、クレスト、相関値 | メーター | [マスタリングメーターの読み方](./glossary/mastering/meter-reading.md) |

::: info 相関値の読み方
相関値（位相相関、おおよそ −1〜+1）は、左右チャンネルがどれだけ似ているかを表します。+1 に近いとモノラルでも安全、0 に近いと広がりがあり、負の値はモノラルに合算したときミックスの一部が打ち消し合う恐れを示します。
:::

機能群ごとのページは意図的に広めにしてあります。たとえばコンプレッサーのページではスレッショルド・レシオ・アタック・リリース・ニー・ディテクター挙動・ゲインリダクションの読み方をまとめて説明できます。1 パラメータ 1 ページに分けると、実際にどの判断をしているかが見えにくくなります。

::: info コンプレッサーの用語
*スレッショルド*は圧縮が始まるレベル、*レシオ*は超過分の入出力の傾き（たとえば 4:1 なら入力が 4 dB 増えても出力は 1 dB 増加）、*アタック*／*リリース*はゲインの追従と復帰の速さ、*ニー*はスレッショルド付近で傾きが切り替わる幅、*ゲインリダクション*は現在信号を何 dB 下げているかを表します。
:::

## アルゴリズムの境界

デモはマスタリングアルゴリズムを Vue 側で再実装しません。Vue が担当するのはインタラクション、入力検証、ローカルな再生状態、表示です。DSP は libsonare 側が担当します。

:::: details 実装メモ
状態は 1 つのシリアライズ可能なオブジェクトで、音声は含まず設定だけを持ちます。編集は純粋な mutator が次の状態を作り、2 つの状態の差分が最小のエンジン操作列になります。`src/utils/engineApply.ts` がその操作列を、ライブのファサードと書き出しワーカーの素のエンジンの両方に対して解釈します。2 つが食い違わないのはこのためです。

書き出した結果は不変です。ラウドネス合わせが変えるのはモニター側のレーンゲインだけで、書き出した WAV には入りません。ラウドネスフィットが古くなっているときは、書き出しの前に再フィットし、得られた Drive を状態に書き戻します。これでファイルと試聴が同じ状態に保たれます。レポートには UI の既定値ではなく、実際のレンダリングで得たメトリクス・プリセット名・ターゲット値・チューニング値を記録します。
::::

## WASM 公開 API

ドキュメントは、`src/wasm/index.d.ts` が公開しているマスタリング API と一致するように保たれています。検証スクリプトは宣言ファイルから現在の `mastering*` / `masterAudio*` 関数を抽出し、JavaScript／ネイティブバインディングのドキュメントに記載があることを確認します。

マスタリングワーカー、WASM 宣言、プロセッサドキュメント、またはこの実装マップを変更した後は `yarn check:mastering-docs` を実行してください。このチェックにより、このページ、JavaScript API ページ、ネイティブバインディングページが現在の公開 API と揃っていることを確認できます。

目的別には次のように使い分けます。

| 目的 | API ファミリ |
|--------|------------|
| プリセットを使う | `masterAudio()`、`masterAudioStereo()`、`masteringPresetNames()` |
| フルチェーンを実行する | `masteringChain()`、`masteringChainStereo()` |
| 進捗を表示する | `masteringChainWithProgress()`、`masteringChainStereoWithProgress()` |
| ブロック単位でレンダリングする | `StreamingMasteringChain`（`prepare` / `processMono` / `processStereo` / `flushMono` / `flushStereo` / `setParameter` / `reset` / `latencySamples` / `stageNames`） |
| 名前付きプロセッサを単体で実行する | `masteringProcessorNames()`、`masteringProcess()`、`masteringProcessStereo()` |
| ソースとリファレンスを比較する | `masteringPairProcessorNames()`、`masteringPairProcess()`、`masteringPairAnalysisNames()`、`masteringPairAnalyze()` |
| ステレオ出力を解析する | `masteringStereoAnalysisNames()`、`masteringStereoAnalyze()` |
| プロファイル・提案・プレビュー | `masteringAudioProfile()`、`masteringAssistantSuggest()`、`masteringStreamingPreview()` |

最後の入力ブロックを処理した後は、空のバッファが返るまで `flushMono()` または `flushStereo()` を呼びます。フラッシュしないと、チェーンの遅延分と有限長のプロセッサテールが出力から欠落します。

::: info 進捗コールバックが数えているもの
`masteringChainWithProgress()` と `masteringChainStereoWithProgress()` は、**有効な DSP ステージ**のうち完了した割合と、直前に完了したステージ名を返します。無効なステージは数に入らないため、分母は全ステージ一覧ではなく実際に構成したチェーンです。

割合が 1.0 に達するのは最後の DSP ステージが返った時点です。それに続く出力の測定、スペクトル、返却レポートに載るバンド差分の算出はその後に走り、進捗を報告しません。つまりバーが満たされた後も呼び出しはしばらく続きます。プログレスバーはコールバックで動かして構いませんが、UI の処理中表示は割合が 1.0 になった時点ではなく、呼び出し自体が完了した時点まで維持してください。
:::

関連: [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md)、[マスタリング](./glossary/mastering.md)、[JavaScript API](./js-api-mastering.md)、[WASM](./wasm.md)

名前付きプロセッサ、プリセット、ペア解析、ステレオ解析の完全な一覧は [マスタリングプロセッサ](./mastering-processors.md) を参照してください。提案生成とプロファイル構築は [マスタリングアシスタント](./mastering-assistant.md) にまとめています。
