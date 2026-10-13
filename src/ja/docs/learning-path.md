# 学習順ガイド

このページは、「何を作りたいか」から libsonare のドキュメントを辿るための道案内です。DSP、MIR、WebAssembly、マスタリング用語を最初から理解している必要はありません。

::: info 最初に出る略語
**DSP**（digital signal processing、デジタル信号処理）は音を数値として測定・加工する処理、**MIR**（Music Information Retrieval、音楽情報検索）は BPM・キー・コードなどを音楽から読み取る処理です。**WASM / WebAssembly** はブラウザで使う実行形式、**API** はアプリから呼ぶ関数やクラス、**CLI** はターミナルで使うコマンドです。ここでは用語を完全に覚えるより、「どの種類のページへ進むか」を選べれば十分です。
:::

サイドバーのガイドは 10 の分野に分かれています。解析、楽器と MIDI、ミキシング、マスタリング、編集、リペア、アレンジとプロジェクト、リアルタイム、ルーム音響、再生の 10 個です。以下の見出しも同じ分野名を使っているので、目的を見つけた分野が、そのガイドが並ぶサイドバーのグループでもあります。分野のあとには実行環境別のリファレンスと根拠のページが続きます。

まだ何も動かしていない場合は、[はじめに](./getting-started.md) から始めてください。実行環境ごとに、インストール行 1 つと短いプログラム 1 つを載せています。

::: details ドキュメントを先頭から順に読む場合
1. [イントロダクション](./introduction.md) で用語と音声解析パイプラインの全体像を読む。
2. サンプル、サンプルレート、デシベル（dBFS、RMS、LUFS）、周波数と倍音、ステレオのどれかが初めてなら、[オーディオ基礎](./glossary/concepts/audio-basics.md) を読む。
3. [MIR の全体像](./glossary/concepts/mir-overview.md) で、スペクトログラム、クロマ、オンセット、解析結果がどう積み上がるかを読む。
4. このページで、目的がどの分野に属するかを見つける。
5. [はじめに](./getting-started.md)、[インストール](./installation.md)、[使用例](./examples.md) で小さなプログラムを 1 つ動かす。
6. [機能マップ](./api-surface.md) で必要な API ファミリーを探す。
7. 組み込みではなく完成した成果物が目的なら、[実践ユースケース](./use-cases.md) から通し手順を 1 つ読む。
8. 下の一覧から、目的に合う分野のガイドを 1 つ読む。ミキシング、編集、マスタリングには先に読む基礎のページがあります（[ミキシングの基礎](./glossary/concepts/mixing-basics.md)、[編集の基礎](./glossary/concepts/editing-basics.md)、[マスタリングとは?](./glossary/concepts/what-is-mastering.md)）。
9. **実行環境別 API** から実行環境に合うリファレンスを 1 つ読む。
10. 実装詳細、アルゴリズム根拠、検証範囲、性能が必要になったときだけ、根拠のページを読む。
:::

## 作りたいものから選ぶ

作りたいものを、それが属する分野の中から探してください。**最初に読むページ** はその目的のために書かれたページ、**次に読むページ** は最初のページが腑に落ちたあとに詳細を追う場所です。[実践ユースケース](./use-cases.md) から始まる行は、実行できるコマンド付きの通し手順です。

### 解析

この分野の結果はテンポもキーもコードもセクションも、すべて同じ最初の一歩から読み取られます。音声を短い窓に区切って少しずつずらしながら、窓ごとにスペクトルを求めると、録音全体が「どの瞬間にどの周波数が鳴っているか」の一枚の絵になります。その絵を見たことがなければ、下のデモで確かめてください。

<SonareDemo id="stft-basics" />

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| BPM、キー、コード、セクションを表示するブラウザアプリ | [はじめに](./getting-started.md) | [楽曲解析](./analysis.md)、[WebAssembly ガイド](./wasm.md) |
| 音声解析を行う Python スクリプトやノートブック | [はじめに](./getting-started.md#最初の結果) | [Python API](./python-api.md)、[楽曲解析](./analysis.md) |
| ターミナルでの簡易確認やバッチ解析 | [はじめに](./getting-started.md#最初の結果) | [CLI リファレンス](./cli.md)、[CLI コマンド](./cli-commands.md) |
| 曲構造、自己類似度、ノート区間を解析するツール | [楽曲解析](./analysis.md) | [JavaScript API](./js-api-helpers.md#librosa-互換ヘルパー)、[Python API](./python-api-analysis.md#特徴抽出) |
| すでに手元にあるビート列から小節と拍子記号を求める | [楽曲解析](./analysis.md#拍子-estimatemeter) | [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) |
| librosa からの移行 | [librosa 互換性](./librosa-compatibility.md) | [楽曲解析](./analysis.md#このページか、互換レイヤーか) |
| librosa の数値（フレーム／サンプル変換、デシベル、ピーク検出）をシェルからエンジンと突き合わせる | [CLI ユーティリティ](./cli-utilities.md) | [librosa 互換性](./librosa-compatibility.md) |
| 倍音成分と打撃成分を分け、編集にも使える音源分離ビュー | [音源分離](./source-separation.md) | [楽曲解析](./analysis.md)、[編集 DSP](./editing-dsp.md) |

### 楽器と MIDI

この分野では、録音を再生するものは何もありません。エンジンはサンプルデータを一切同梱せず、どの楽器も発音中に計算で音を作ります。その判断と、そこから何が導かれるかを説明するのが [音源方式](./sound-sources.md) です。合成方式を選び終えた前提で書かれているページを開く前に、まずこのページを読んでください。

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| 物理モデル、FM、減算合成、持ち込みの SoundFont のどれにするかを決める | [音源方式](./sound-sources.md) | [内蔵シンセサイザー](./native-synth.md)、[物理モデル](./physical-models.md) |
| MIDI を音声にレンダリングするシンセ／インストゥルメントアプリ | [内蔵シンセサイザー](./native-synth.md) | [MIDI 入力](./midi-input.md)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| MIDI 1.0 と MIDI 2.0 のイベントを扱う MIDI クリップエディタやシーケンサー | [MIDI クリップ編集](./midi-editing.md) | [MIDI 2.0 と UMP](./midi2.md)、[プロジェクトの MIDI](./project-editing-midi.md) |
| ピアノ、擦弦、リード、金管、フルートといったアコースティック音源を聴き比べたり、コードから音作りする | [物理モデル](./physical-models.md) | [内蔵シンセサイザー](./native-synth.md#名前付きプリセットカタログ) |
| SoundFont にないプログラムで、General MIDI の各プログラムがどのエンジンと音作りに落ちるかを調べる | [GM 音色マップ](./gm-tone-map.md) | [GM／GS フォールバックバンク](./gm-gs.md) |
| 内蔵プレイヤーでの SoundFont（SF2）再生 | [SoundFont 2 プレイヤー](./soundfont-player.md) | [GM／GS フォールバックバンク](./gm-gs.md)、[MIDI 入力](./midi-input.md) |
| 解析やマスタリングは使わず、インストゥルメントだけが必要な C++ アプリ | [リンクターゲット](./cpp-api.md#リンクターゲット) | [内蔵シンセサイザー](./native-synth.md)、[SoundFont 2 プレイヤー](./soundfont-player.md) |

### ミキシング

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| ブラウザまたはネイティブのミキサー | [ミキシングエンジン](./mixing.md) | [ミキシングシーン JSON](./mixing-scene-json.md) |
| 動作するデモのソースを読みながら作るブラウザのミキシングアプリ | [ブラウザでミキシングアプリを作る](./use-cases/browser-mixer.md) | [ミキシングエンジン](./mixing.md)、[ミキシングデモのプロジェクト JSON](./mixing-demo-project-json.md) |
| トラックそのものを計測してミックスの出発点を提案させ、判断ごとの理由も受け取る | [ミキシングアシスタント](./mixing-assistant.md) | [ミキシングシーン JSON](./mixing-scene-json.md)、[ミキシングエンジン](./mixing.md) |
| ストリップやバスに挿すリバーブ、モジュレーション、ディレイ | [エフェクトインサート](./effects-inserts.md) | [ミキシングシーン JSON](./mixing-scene-json.md) |
| 手書きの表を持たず、エンジン自身のパラメータ記述子から描くインサートのコントロール | [パラメータ記述子からコントロールを組み立てる](./use-cases/parameter-controls.md) | [エフェクトインサート](./effects-inserts.md#パラメータ記述子)、[リアルタイムエンジン](./realtime-engine.md#パラメータオートメーション) |
| 声の下で BGM をダッキングし、ラウドネス規定に合わせて納品するトーク番組 | [トーク番組を仕上げる](./use-cases/spoken-word-show.md) | [ミキシングエンジン](./mixing.md)、[CLI リファレンス](./cli.md) |

### マスタリング

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| マスタリング UI や自動マスタリング | [マスタリングアシスタント](./mastering-assistant.md) | [マスタリングプロセッサ](./mastering-processors.md) |
| ステムのフォルダから仕上げたマスターを、ターミナルだけで作る | [CLI だけでミックスからマスタリングまで](./use-cases/cli-mix-and-master.md) | [CLI リファレンス](./cli.md)、[マスタリングプロセッサ](./mastering-processors.md) |
| ミックスの音色とラウドネスを、リファレンス曲と同じ範囲に寄せる | [リファレンス曲に寄せる](./use-cases/reference-master.md) | [マスタリングアシスタント](./mastering-assistant.md) |
| 納品前のマスターに対する合否判定を CI で回す | [納品前チェックを CI で回す](./use-cases/delivery-check.md) | [CLI リファレンス](./cli.md#終了コード) |
| マスタリングチェーン自体のパラメータを操作する UI、あるいは処理内容を説明できるレンダリングレポート | [マスタリング実装](./mastering-implementation.md) | [マスタリングプロセッサ](./mastering-processors.md)、[パラメータ記述子からコントロールを組み立てる](./use-cases/parameter-controls.md#マスタリングチェーンの画面を組む) |

### 編集

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| ピッチ、長さ、声質、音源分離の編集 | [編集 DSP](./editing-dsp.md) | [JavaScript API](./js-api-effects.md#オーディオエフェクト) |
| 音声の採譜、クリップ置換、テンポに沿った MIDI 配置 | [音声から MIDI](./audio-to-notes.md) | [MIDI クリップ編集](./midi-editing.md)、[プロジェクトの MIDI](./project-editing-midi.md) |
| ピアノの録音を MIDI ファイルにし、譜面と照合する | [ピアノの録音を MIDI にする](./use-cases/audio-to-midi.md) | [音声から MIDI](./audio-to-notes.md) |
| 音声クリップへレンダリングし直すノート単位の編集 | [音声内のノート編集](./note-editing.md) | [編集 DSP](./editing-dsp.md) |
| 領域指定のスペクトル編集（時間×周波数の矩形を減衰・ミュート・ゲイン・修復） | [スペクトル編集](./spectral-editing.md) | [編集 DSP](./editing-dsp.md) |
| 曲を減速・移調・パート分離した練習用トラック | [練習用トラックを作る](./use-cases/practice-tracks.md) | [編集 DSP](./editing-dsp.md)、[音源分離](./source-separation.md) |
| 録音したテイクを MIDI ファイルのメロディに合わせてシェルから補正する | [CLI ユーティリティ](./cli-utilities.md#tune-to-midi) | [プロジェクトの MIDI](./project-editing-midi.md) |

### リペア

欠陥を測定してからリペア段を選びます。広帯域ノイズ、電源ハム、クリップしたピーク、衝撃的なクリック、クラックル、拡散残響には、それぞれ異なる根拠と再構成の限界があります。

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| 測定した欠陥から段を選ぶリペアワークフロー | [オーディオリペアの流れ](./audio-repair.md) | [広帯域ノイズとハムのリペア](./repair-noise.md)、[クリップ、クリック、クラックルのリペア](./repair-transients.md)、[拡散残響のリペア](./repair-reverb.md) |
| 荒い録音素材をまとめて整音し、素材ごとに何が問題だったかを記録する | [録音素材をまとめて整音する](./use-cases/recording-cleanup.md) | [オーディオリペアの流れ](./audio-repair.md) |

### アレンジとプロジェクト

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| DAW、アレンジ、MIDI シーケンスツール | [プロジェクト編集](./project-editing.md) | [プロジェクトの MIDI](./project-editing-midi.md)、[プロジェクトのバウンス](./project-bounce.md) |
| 歌のテイクをノートごとに（ピッチ、フォルマント、レベル）元に戻せる形で補正し、結果をプロジェクトに置く | [ボーカル編集](./vocal-editing.md) | [歌のピッチを直す](./use-cases/vocal-tuning.md) |
| プロジェクトをファイルに保存し、再び開く | [プロジェクトの保存と読み込み](./project-save-load.md) | [プロジェクト編集](./project-editing.md) |
| マイク録音、ループ録音のテイク、クリップへのコンピング | [録音とテイク](./recording-and-takes.md) | [プロジェクト編集](./project-editing.md) |
| 内蔵シンセの有無を問わず、プロジェクトをオーディオに書き出す | [プロジェクトのバウンス](./project-bounce.md) | [内蔵シンセサイザー](./native-synth.md)、[SoundFont 2 プレイヤー](./soundfont-player.md) |

### リアルタイム

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| ライブ可視化、リズムゲーム補助、AudioWorklet ツール | [リアルタイムとストリーミング](./realtime-streaming.md) | [WebAssembly ガイド](./wasm-streaming.md#ストリーミング解析) |
| トランスポート、トラックレーン、ライブ MIDI、オートメーションを備えた再生エンジン | [リアルタイムエンジン](./realtime-engine.md) | [リアルタイムとストリーミング](./realtime-streaming.md) |
| マイク入力のリアルタイムボイスチェンジャー | [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) | [WebAssembly ガイド](./wasm-streaming.md#リアルタイムボイスチェンジャー) |

### ルーム音響

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| ルームの響き、推定、生成された部屋らしさ | [ルーム音響解析](./acoustic-analysis.md) | [JavaScript API](./js-api-effects.md#ルーム音響解析)、[Python API](./python-api-effects.md#ルーム音響解析) |
| メル／MFCC 特徴量をプレビューやデバッグ用に逆変換する | [逆変換特徴量](./inverse-features.md) | [librosa 互換性](./librosa-compatibility.md) |

### 再生

| 作りたいもの | 最初に読むページ | 次に読むページ |
|--------------|------------------|----------------|
| 映像作品の音声を、バイノーラルのヘッドホン出力や較正済みのステレオ／5.1／7.1 スピーカー出力にする | [再生レンダラー](./playback.md) | [チャンネル形式](./channel-formats.md) |
| モノラル、ステレオ、5.1、7.1 の入力を各モジュールがどう扱うかを確認する | [チャンネル形式](./channel-formats.md) | [再生レンダラー](./playback.md) |

::: tip 目的別ページの読み方
各分野の目的別ページは、判断基準、最小のコード例、注意点と関連ページの順に並んでいます。ブラウザ / WASM、Python、CLI で同じワークフローを動かせる場合は、`::: code-group` で 3 つを併記しています。リアルタイムエンジンや AudioWorklet ブリッジのように WASM / C++ 側に寄る API では、Python / CLI に同じライブコールバック API があるかのようには書かず、代替となるバッチ API を案内します。
:::

## リファレンス

### 実装前のチェックポイント

目的別ページを読んだあと、実装に入る前に次を確認してください。

| 確認すること | 見る場所 | 判断のしかた |
|--------------|----------|--------------|
| 入力がファイルか、エンコード済みバイト列か、デコード済みサンプルか、ライブブロックか | 各ページの「いつ使うか」「どちらを使うか」 | ブラウザ / WASM は多くの場合 `Float32Array` と `sampleRate` を受け取ります。エンコード済みバイト列には `Audio.fromMemory*` やブラウザのコーデックを使います。Python / CLI はファイル入力を直接扱えます。 |
| 同じ処理をどの実行環境で呼ぶか | `::: code-group` のブラウザ / Python / CLI 例 | 3 つを併記しているページでは、API 名、引数名、戻り値の形の違いを見比べてください。 |
| 用語を UI や実装コメントで説明できるか | ページ内の `::: tip` / `::: info` / `::: warning` / `::: details` と [用語集](./glossary.md) | 実装判断に効く用語は本文に短く置き、長い背景は補足ボックスや用語集に回しています。 |
| 実行環境ごとの差があるか | [バインディング対応表](./binding-parity.md) と各 API リファレンス | 目的別ページにその実行環境の例がない場合、対応 API が公開されていないか、実行環境が用途に合っていない可能性があります。 |

### 4 つの層

| 層 | 内容 | ページ |
|----|------|--------|
| 概念 | サンプル、デシベル、BPM、キー、STFT、クロマ、LUFS、True Peak などの意味 | [イントロダクション](./introduction.md)、[オーディオ基礎](./glossary/concepts/audio-basics.md)、[用語集](./glossary.md) |
| 目的 | 上の 10 分野のどれで、何を作りたいか | [機能マップ](./api-surface.md)、[楽曲解析](./analysis.md) から [再生レンダラー](./playback.md) までの各分野ガイド |
| 実行環境 | ブラウザ、Python、Node、CLI、C++ のどこで動かすか | [はじめに](./getting-started.md)、実行環境別リファレンス |
| 根拠 | 実装の構造、アルゴリズム、検証状況 | [DSP 実装解説](./dsp-implementation.md)、[アルゴリズム根拠](./algorithm-references.md)、[実装検証](./implementation-validation.md) |

多くの利用者に必要なのは最初の 3 つです。DSP のパラメータを UI に出す、レンダリングレポートを説明する、リアルタイム用途に向く処理か確かめる、アルゴリズムの根拠を示す、といった場面で根拠のページを開いてください。
