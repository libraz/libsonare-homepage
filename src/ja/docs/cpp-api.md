# C++ API リファレンス

libsonare C++ インターフェースの API リファレンス。

## 概要

libsonare は C++ アプリケーション向けに、オーディオ解析、メーター、特徴抽出、編集 DSP、リアルタイムストリーミング、マスタリング、ミキシングを提供します。

`sonare.h` は解析・特徴量系の広い入口です。マスタリング、ミキシング、エンジン、グラフ、編集モジュールは、必要なサブシステムだけをインクルードしたい場合の専用ヘッダーも持っています。 ブロック単位のストリーミングは [C++ ストリーミング API](./cpp-api-streaming.md) で、特徴抽出・ピッチ追跡・主要な結果型は [C++ 解析 API](./cpp-api-analysis.md) で、オーディオエフェクト・ミキシングエンジン・編集ヘルパー・C ABI は [C++ エフェクト API](./cpp-api-effects.md) で扱います。

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- クイックヘルパー（`sonare::quick::*`）、`MusicAnalyzer`、`StreamAnalyzer`、各モジュールヘッダー、C ABI を使い分けられる。
- どの C++ 側の入口が各言語バインディングの土台になっているかを理解できる。
- 音声読み込み、解析、ストリーミングフレーム、マスタリング、ミキシング、FFI に必要な struct / class を探せる。
- 目的別ガイドを読んだ後のリファレンスとして、このページを使える。

| コンポーネント | 目的 | 主なクラス/関数 |
|-----------|---------|----------------------|
| **コア** | オーディオI/Oと信号処理 | `Audio`, `Spectrogram` |
| **Quick API** | 一行解析とルーム音響の入口 | `quick::detect_bpm()`, `quick::detect_key()`, `quick::detect_beats()`, `quick::detect_acoustic()` |
| **幾何ベースのルーム音響** | 等価ルーム推定、RIR 合成、ルームモーフィング | `estimate_room()`, `acoustic::synthesize_rir()`, `effects::acoustic::room_morph()` |
| **MusicAnalyzer** | コールバック付きの楽曲解析 | `MusicAnalyzer`, `AnalysisResult` |
| **ストリーミング** | ブロック単位の MIR（音楽情報検索）フレームと更新されていく推定 | `StreamAnalyzer`, `StreamConfig`, `FrameBuffer` |
| **特徴量** | 低レベル特徴抽出と逆変換特徴量 | `MelSpectrogram`, `Chroma`, `cqt()`, `vqt()`, `mel_to_audio()` |
| **エフェクト／編集** | オーディオ処理と小さな編集部品 | `hpss()`, `time_stretch()`, `pitch_shift()`, pitch editor / voice changer モジュール |
| **マスタリング** | プリセット、チェーン、名前付きプロセッサ、assistant/profile JSON | `mastering::MasteringChain`, `mastering::api::*` |
| **ミキシング／エンジン** | シーンベースのミキサーと DAW 風リアルタイムトランスポート | `mixing::api::Scene`, `mixing::ChannelStrip`, `mixing::FxBus`, `RealtimeEngine` |
| **C ABI** | バインディング向けの安定 FFI | `sonare_c.h` |

## C++ でどの入口を使うか

| 目的 | インクルード / API |
|------|---------------|
| BPM、キー、ビート、オンセット、音響指標を単発で見る | `#include <sonare.h>` と `sonare::quick::*` |
| 幾何ベースのルーム推定、RIR 合成、ルームモーフィング | `#include <analysis/room_estimator.h>`, `#include <acoustic/rir_synthesizer.h>`, `#include <effects/acoustic/room_morph.h>` |
| 同じ音声から複数の楽曲解析結果を得る | `MusicAnalyzer`。中間特徴量を再利用できます |
| ライブビジュアライザや更新されていく推定 | `#include <streaming/stream_analyzer.h>` |
| マスタリングプリセットや名前付きプロセッサ | `src/mastering/api/*` ヘッダー。[マスタリングプロセッサ](./mastering-processors.md) も参照 |
| ステムミキサー / シーン JSON | `src/mixing/api/scene.h` と `src/mixing/api/scene_json.cpp` の概念。[ミキシングエンジン](./mixing.md) も参照 |
| 言語バインディングやプラグイン境界 | C++ クラスではなく `sonare_c.h` |

### この API を切り分けるビルドフラグ

解析、特徴量、エフェクト、メータリングは常にビルドされます。以下のサブシステムは
個別の CMake オプションで、ソースビルドではすべて既定 `ON` ですが、絞ったビルドでは
外すことができ、そのとき該当するシンボルはすべて消えます。

| オプション | 対象 |
|------------|------|
| `BUILD_MASTERING` | `sonare::mastering::*`、マスタリングの C ABI |
| `BUILD_MIXING` | `sonare::mixing::*`、ミキサーの C ABI |
| `BUILD_MIXING_ASSISTANT` | オフラインのミキシングアシスタント |
| `BUILD_GRAPH` | ルーティンググラフライブラリ |
| `BUILD_FX` | クリエイティブ系リアルタイム FX プロセッサと、SoundFont プレイヤーが送る GS システムエフェクト |
| `BUILD_ACOUSTIC_SIM` | 幾何ベースのルーム音響（RIR 合成、ルーム推定、ルームモーフ） |
| `BUILD_VOICE_CHANGER` | リアルタイムボイスチェンジャー |
| `BUILD_PITCH_EDITOR` | スケールクオンタイズとノートセグメンテーション |
| `BUILD_ARRANGEMENT` | MIDI とインストゥルメントのサブシステム（NativeSynth、GM フォールバックバンク、SoundFont プレイヤー）、およびヘッドレスのアレンジメント／DAW プロジェクト（`sonare_c_project.h`） |
| `BUILD_ASSIST` | 作曲アシストの差し込み口（制御／オフラインのみ） |

一部のオプションは独立しておらず、configure の段階で矛盾を解消します。いずれもステータス行を出力するので、意図どおりに削れなかった場合は configure の出力に現れます。

- `BUILD_MIXING_ASSISTANT` は `BUILD_MIXING` を ON に戻します。
- `BUILD_MIXING` は `BUILD_MASTERING` と `BUILD_GRAPH` を ON に戻します。
- `BUILD_VOICE_CHANGER` は `BUILD_MASTERING` が OFF のとき、自分自身を OFF にします。
- `SONARE_WASM_ANALYSIS_ONLY` は `BUILD_MIXING_ASSISTANT` を OFF にします。解析専用の WebAssembly モジュールにミキシングアシスタントは含まれません。

はじめの 2 つは連鎖します。そしてこれが、削ったつもりが削れていない原因になりがちな組み合わせです。`BUILD_MIXING_ASSISTANT` を既定の `ON` のままにすると、ミキサー・マスタリングライブラリ・ルーティンググラフは、いくつ `OFF` を渡していても再び取り込まれます。

C ABI はプロジェクト系のシンボルを常に *エクスポート* します。`BUILD_ARRANGEMENT`
なしでビルドした場合、それらは `SONARE_ERROR_NOT_SUPPORTED` を返し、
`sonare_project_abi_version()` は 0 を返します。

`BUILD_PITCH_EDITOR` も同じ扱いです。`-DBUILD_PITCH_EDITOR=OFF` でビルドすると、
`sonare_scale_quantize_midi`、`sonare_scale_correction_semitones`、
`sonare_scale_pitch_class_enabled`、`sonare_note_segments` はエクスポートされたまま
`SONARE_ERROR_NOT_SUPPORTED` を返します。出力引数は判定の前にゼロクリアされるので、
この経路で返されたポインタを解放しても安全です。ライブラリはこのオプションを OFF にした
状態で configure・ビルドできますが、ネイティブ CLI はできません。5 つのコマンドが
ピッチエディタを直接呼んでいるためです。

### リンクターゲット

インストール済みの libsonare は、サブシステムごとの CMake ターゲットと、そのインストールに含まれるものをまとめて張る集約ターゲットをエクスポートします。

```cmake
find_package(sonare REQUIRED)
target_link_libraries(app PRIVATE sonare::sonare)
```

既定は `sonare::sonare` で問題ありません。これはインストールに含まれる**静的アーカイブ**すべてを束ねた集約ターゲットなので、どのアーカイブが必要でどの順に並べるかを自分で考える必要はありません。ただし `sonare::shared` は意図的に含みません。これは FFI バインディングが読み込む C ABI の共有ライブラリで、それ自身がすべての静的アーカイブをリンク済みです。両方を 1 つのリンク行に並べると、各シンボルが二重に定義されてしまいます。

リンクを絞りたい場合は、アーカイブを直接指定します（`sonare::core`、`sonare::rt`、`sonare::mastering`、`sonare::mixing`、`sonare::midi`、`sonare::engine` など、上の表のサブシステムに対応）。どれが存在するかはインストール時の構成によって変わるため、`if(TARGET sonare::mixing)` かパッケージ設定が定義する `SONARE_WITH_*` 変数で分岐してください。コンポーネントとして指定すると、欠けている場合にリンク時の未定義シンボルではなく configure 時のエラーになります。

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
```

::: warning コンポーネント名はオプション名ではなくターゲット名
コンポーネントはエクスポートされたターゲット名と 1 対 1 に対応します。これは内部のターゲット名から `sonare_` の接頭辞を取り除いたもので、それを制御する `BUILD_*` オプションの名前ではありません。`BUILD_ACOUSTIC_SIM` が作るのは `sonare::acoustic` なので、コンポーネント名は `acoustic` です。同様に `mixing_assistant`、`pitch_editor`、`voice_changer` となります。どの綴りでも存在しないコンポーネントを要求すると「libsonare was installed without the '…' component」というエラーになり、本当にサブシステムが欠けている場合と区別がつきません。
:::

エイリアス名は `add_subdirectory()` ビルドでも同じなので、リンク行に libsonare の入手経路が現れることはありません。

インストール済みビルドについて、計画を立てる前に知っておく価値のある性質が 2 つあります。

- **Eigen は利用側の要件ではありません。** インストールされるヘッダーはどれも Eigen を include しないため、利用側に必要なのは C++17 コンパイラと解決可能なスレッドライブラリだけです。パッケージ設定が宣言するのは `Threads`（および FFmpeg 付きでビルドされた場合の FFmpeg）のみです。
- **同梱の FFT アーカイブは接頭辞付きのファイル名でインストールされます。** `libsonare_kissfft.a` と `libsonare_pffft.a` であり、利用側のライブラリディレクトリで一般的な名前を占有することはありません。CMake のターゲット名は変わりません。

`sonare.pc` は共有ライブラリ構成でのみインストールされます。pkg-config が正しく記述できるのはその構成だけだからです。静的ライブラリのみのインストールでは生成されません。

エクスポートされる各ターゲットは、専用のゲートで検証されています。プレフィックスにインストールしたうえで別の利用側プロジェクトを configure・ビルドし、各アーカイブを丸ごと強制ロードして、そのアーカイブ自身が宣言するリンクインターフェースに照らして確かめるものです。インストール規則の漏れや、リンクインターフェースの記述不足はこれで捕まります。どちらもソースツリーの内側からは見えません。ツリー内ではすべてのターゲットが全アーカイブをリンクしているからです。

#### 内蔵インストゥルメントだけをリンクする

シンセサイザー、GM フォールバックバンク、SoundFont プレイヤーはいずれも `sonare::midi` にあります。MIDI を音声にレンダリングするだけで解析もマスタリングも行わないアプリケーション（プレイヤー、ゲーム、MIDI 駆動のツールなど）は、制作系のサブシステムを外してこのアーカイブだけをリンクできます。`BUILD_TESTING` と `BUILD_CLI` はどちらも既定が `ON` なので、これらをそのままにした構成ではテストツリーとコマンドラインツールも一緒にコンパイルされます。

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_ARRANGEMENT=ON \
  -DBUILD_MASTERING=OFF -DBUILD_MIXING=OFF -DBUILD_MIXING_ASSISTANT=OFF \
  -DBUILD_GRAPH=OFF -DBUILD_ACOUSTIC_SIM=OFF \
  -DBUILD_VOICE_CHANGER=OFF -DBUILD_ASSIST=OFF
cmake --build build --parallel
cmake --install build --prefix /your/prefix
```

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
target_link_libraries(app PRIVATE sonare::midi)
```

```cpp
#include <midi/synth/native_synth.h>
#include <midi/synth/synth_presets.h>
#include <midi/ump.h>

using namespace sonare::midi;

const synth::SynthPreset* preset = synth::find_synth_preset("acoustic-piano");
synth::NativeSynth instrument(preset->config);
instrument.prepare(48000.0, 512);

MidiEvent note_on{};
note_on.ump = make_midi1_note_on(/*group=*/0, /*channel=*/0, /*note=*/60, /*velocity=*/100);
instrument.on_event(/*destination_id=*/0, note_on);

float* channels[2] = {left, right};
instrument.process(channels, 2, 512);
```

インストールされたヘッダは 2 通りの書き方で解決します。上の例のようなツリー内と同じパスと、インクルードルート経由の `<sonare/cpp/midi/synth/native_synth.h>` です。

この構成を前提に設計する前に、3 つの制限を押さえてください。

- **解析は外せません。** 解析、特徴量、エフェクト、メータリングにはビルドフラグがなく、`sonare::midi` は `sonare::core` をリンクするため、呼び出すかどうかにかかわらずバイナリに入ります。トリムで外れるのはマスタリング、ミキシング、ルーム音響、ボイスチェンジャーです。
- **`BUILD_ARRANGEMENT` は 1 つのスイッチで 2 つのものを制御します。** インストゥルメントのために ON にすると、アレンジメント／MIR／シリアライズのアーカイブもビルドされます。リンクする必要はありませんが、コンパイルはされます。
- **`BUILD_FX=OFF` にすると SoundFont プレイヤーはドライで鳴ります。** GS システムエフェクト（リバーブ、コーラス、ディレイの送り）がコンパイルから外れ、送りは無効になります。それを望まない限り `BUILD_FX=ON` のままにしてください。

このトリムは C++ のソースビルドでのみ可能です。npm パッケージは解析専用バンドルを公開していますが（[インストール](./installation.md#wasm-パッケージのサブパス) を参照）、インストゥルメント専用のものはなく、Python ホイールはフルビルド 1 種類です。

インストゥルメント自体で何ができるかは、[内蔵シンセサイザー](./native-synth.md) と [SoundFont 2 プレイヤー](./soundfont-player.md) を参照してください。

::: tip 用語について
オーディオ解析が初めてですか？[用語集](/ja/docs/glossary) で BPM、STFT、Chroma、HPSS などの用語の説明をご覧ください。
:::

## 名前空間

すべての libsonare 機能は `sonare` 名前空間に含まれています。

```cpp
#include <sonare.h>

using namespace sonare;
```

## コアクラス

### Audio

共有所有権とゼロコピースライシングを持つオーディオバッファ。

#### ファクトリメソッド

```cpp
// 生サンプルバッファから（コピー）
static Audio Audio::from_buffer(const float* samples, size_t size, int sample_rate);

// ベクターから（ムーブ）
static Audio Audio::from_vector(std::vector<float> samples, int sample_rate);

// ファイルから（標準は WAV/MP3。SONARE_WITH_FFMPEG 有効ビルドでは FFmpeg 対応形式）
// デコード失敗時は SonareException
static Audio Audio::from_file(const std::string& path);

// メモリ上のエンコード済み音声から。対応形式は from_file() と同じ
// デコード失敗時は SonareException
static Audio Audio::from_memory(const uint8_t* data, size_t size);
```

#### プロパティ

```cpp
const float* data() const;        // サンプルへのポインタ
size_t size() const;              // サンプル数
int sample_rate() const;          // サンプルレート (Hz)
float duration() const;           // 長さ (秒)
int channels() const;             // 常に 1 (モノラル)
bool empty() const;               // サンプルがない場合 true
```

#### 操作

```cpp
// 時間によるゼロコピースライス
Audio slice(float start_time, float end_time = -1.0f) const;

// サンプルインデックスによるゼロコピースライス
Audio slice_samples(size_t start_sample, size_t end_sample = -1) const;

// サンプルアクセス
float operator[](size_t index) const;

// イテレータサポート
const float* begin() const;
const float* end() const;
```

::: tip 大きなファイルの処理
非常に大きなファイルを扱う場合は、読み込み後に `slice()` でセグメントに分割して処理することを検討してください。
:::

#### 使用例

```cpp
auto audio = sonare::Audio::from_file("song.mp3");
std::cout << "Duration: " << audio.duration() << "s\n";

// ゼロコピースライシング
auto intro = audio.slice(0.0f, 30.0f);
auto chorus = audio.slice(60.0f, 90.0f);
```

### Spectrogram

オーディオ信号の短時間フーリエ変換（STFT）。

```cpp
struct StftConfig {
  int n_fft = 2048;
  int hop_length = 512;
  int win_length = 0;  // 0 = n_fft
  WindowType window = WindowType::Hann;
  bool center = true;
  PadMode pad_mode = PadMode::Constant;
};

// STFT を計算
auto spec = Spectrogram::compute(audio, config);

// プロパティ
spec.n_bins();      // 周波数ビン (n_fft/2 + 1)
spec.n_frames();    // 時間フレーム
spec.n_fft();
spec.hop_length();
spec.sample_rate();

// データアクセス
spec.complex_view();  // [n_bins x n_frames]
spec.magnitude();     // キャッシュ済み
spec.power();         // キャッシュ済み
spec.to_db();         // dB に変換

// 再構成
auto reconstructed = spec.to_audio();
```

::: warning スレッドセーフティ
`Spectrogram` オブジェクトは**スレッドセーフではありません**。キャッシュされた `magnitude()` および `power()` の結果は遅延初期化を使用します。複数のスレッドから同じ `Spectrogram` にアクセスする必要がある場合は、別々のコピーを作成するか、外部で同期を行ってください。
:::

<SonareDemo id="stft-basics" />

## Quick API

一般的な解析タスクのためのシンプルな関数群です。1 回限りの BPM・キー・ビート・ダウンビート・オンセット検出やルーム音響解析に向きます。

::: info Quick API と MusicAnalyzer の使い分け
- **Quick API**（`sonare::quick::...`） — 1 つの結果だけが欲しいとき。内部で必要なステージだけを走らせます。
- **MusicAnalyzer** — 同じ音源から BPM・キー・コード・セクションなど複数の結果が必要なとき。中間特徴量（STFT・クロマ・オンセット包絡線）を共有して二重計算を避けます。
:::

```cpp
namespace sonare::quick {
  // BPM 検出
  float detect_bpm(const float* samples, size_t length, int sample_rate);

  // キー検出
  Key detect_key(const float* samples, size_t length, int sample_rate);
  Key detect_key(const float* samples, size_t length, int sample_rate, const KeyConfig& config);
  std::vector<KeyCandidate> detect_key_candidates(const float* samples, size_t length, int sample_rate,
                                                  const KeyConfig& config = KeyConfig());

  // ビート時刻（秒）
  std::vector<float> detect_beats(const float* samples, size_t length, int sample_rate);

  // ダウンビート時刻（秒）
  std::vector<float> detect_downbeats(const float* samples, size_t length, int sample_rate);

  // オンセット時刻（秒）
  std::vector<float> detect_onsets(const float* samples, size_t length, int sample_rate);

  // 総合解析
  AnalysisResult analyze(const float* samples, size_t length, int sample_rate);

  // ルーム音響
  AcousticParameters detect_acoustic(const float* samples, size_t length, int sample_rate);
  AcousticParameters analyze_impulse_response(const float* samples, size_t length, int sample_rate);
}
```

## 幾何ベースのルーム音響

これらの API は、部屋モデルを推定・合成・適用するためのものです。専用モジュールヘッダーにあり、`BUILD_ACOUSTIC_SIM=ON` ビルドで使えます（ソースビルドの既定値です）。

::: info このセクションの用語
- **等価ルーム** は、音声から推定した実用上の部屋モデルです。実際の部屋の正確な形状ではありません。
- **RIR** は room impulse response（ルームインパルス応答）の略で、部屋が短い音にどう反応するかを表すサンプル列です。
- **RT60** は残響時間です。残響が 60 dB 減衰するまでの長さを指します。
- **DRR (direct-to-reverberant ratio)** は直接音と残響の音量比を dB で表します。値が大きいほど、乾いた近い音になります。
- **ルームモーフィング** は、部屋の響きを足す音作り効果です。残響除去ではありません。
:::

```cpp
#include <acoustic/rir_synthesizer.h>
#include <analysis/room_estimator.h>
#include <effects/acoustic/room_morph.h>

using namespace sonare;

acoustic::ShoeboxRoom room = acoustic::uniform_shoebox({7.0f, 5.0f, 3.0f}, 0.2f);
acoustic::SourceListener placement{{1.0f, 1.0f, 1.2f}, {5.0f, 4.0f, 1.7f}};
auto rir = acoustic::synthesize_rir(room, placement, 48000);
if (!rir.rir.empty()) {
  RoomEstimate estimate = estimate_room(rir.rir);
}

effects::acoustic::RoomMorphConfig morph_config;
morph_config.target = room;
morph_config.placement = placement;
morph_config.wet = 0.6f;
Audio morphed = effects::acoustic::room_morph(recording, morph_config);
```

3 つの呼び出しは、ワークフローの別々の部分を担当します。

- `estimate_room(...)` は、体積、代表寸法、吸音率バンド、RT60 バンド、DRR、信頼度を返します。
- `synthesize_rir(...)` は、形状問題を診断情報で報告します。音源／聴取位置が不正な場合は空の RIR を返します。
- `room_morph(...)` は、入力音声に目標ルームの響きを付けてレンダーします。

::: details 設定項目の詳細
`acoustic::RirSynthConfig` では、RIR 生成の設定を指定できます。

- 鏡像音源法の反射次数
- Sabine/Eyring の後期テールモデル
- 決定的なシード
- RIR の最大長
- 初期反射と後期テールの混合時刻
- クロスフェード幅

`RoomEstimateConfig` は、`AcousticConfig` 経由で解析設定を渡します。主な項目は、解析モード、オクターブバンド数、最小減衰幅、ノイズフロア余裕です。

アスペクトヒントと `reference_absorption` は、等価ルームの事前条件を決めます。
:::

### 大空間での空気吸収

大きなホールでは、長い伝搬経路での空気損失を考慮しない幾何学のみの RT60 推定は、高域の残響を長く見積もりすぎることがあります。C++ の音響コアでは、Sabine/Eyring 計算に ISO 9613-1 の大気吸収項を加えられます。これはオプトインです。最後の引数を省略すれば、従来の幾何学のみの結果がそのまま得られます。

```cpp
#include <acoustic/late_reverb.h>

acoustic::AirAbsorption air;
air.temperature_c = 20.0f;
air.humidity_percent = 50.0f;

const auto rt60 = acoustic::shoebox_reverb_time(
    room, acoustic::ReverbModel::Eyring, &air);
// rt60.rt60_bands: 空気損失により、とくに高域が短くなる。
```

`AirAbsorption` の既定値は 20 ℃・相対湿度 50% です。この低レベル C++ 計算は C ABI、Node、Python、WASM のシューボックスヘルパーには含まれません。これらの公開ヘルパーは引き続き幾何学のみのモデルを使います。

## MusicAnalyzer <Badge type="warning" text="Heavy" />

複数の音楽解析をまとめて扱う、遅延初期化のクラスです。

::: tip パフォーマンス
総合解析は計算負荷が高いです。長い音声ファイル（3分以上）の場合は、進捗コールバックで進み具合を表示するか、必要な区間だけを解析することを検討してください。
:::

```cpp
MusicAnalyzerConfig config;
config.bpm_min = 80.0f;
config.bpm_max = 180.0f;

MusicAnalyzer analyzer(audio, config);

// 進捗コールバックを設定
analyzer.set_progress_callback([](float progress, const char* stage) {
  std::cout << stage << ": " << (progress * 100) << "%\n";
});

// 個別の結果
float bpm = analyzer.bpm();
Key key = analyzer.key();
auto beats = analyzer.beat_times();
auto chords = analyzer.chords();

// 総合解析
auto result = analyzer.analyze();
```

## 列挙型

```cpp
enum class PitchClass {
  C = 0, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
};

enum class Mode {
  Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian
};

enum class ChordQuality {
  Major, Minor, Diminished, Augmented,
  Dominant7, Major7, Minor7, Sus2, Sus4, Unknown,
  Add9, MinorAdd9, Dim7, HalfDim7, Major9, Dominant9, Sus2Add4
};

enum class SectionType {
  Intro, Verse, PreChorus, Chorus, Bridge, Instrumental, Outro, Unknown
};

enum class WindowType {
  Hann, Hamming, Blackman, Rectangular
};
```

## 単位変換

```cpp
// Hz <-> Mel (Slaney 式)
float hz_to_mel(float hz);
float mel_to_hz(float mel);

// Hz <-> MIDI ノート番号
float hz_to_midi(float hz);      // A4 = 440Hz = 69
float midi_to_hz(float midi);

// Hz <-> ノート名
std::string hz_to_note(float hz);    // "A4", "C#5"
float note_to_hz(const std::string& note);

// 時間 <-> フレーム
float frames_to_time(int frames, int sr, int hop_length);
int time_to_frames(float time, int sr, int hop_length);

// フレーム <-> サンプル（librosa.frames_to_samples / samples_to_frames）
int frames_to_samples(int frames, int hop_length, int n_fft = 0);
int samples_to_frames(int samples, int hop_length, int n_fft = 0);

// dB 変換（librosa.power_to_db / amplitude_to_db とその逆）。
// 宣言は <core/db_convert.h>。<sonare.h> には含まれない。
std::vector<float> power_to_db(const std::vector<float>& values,
                               float ref = 1.0f, float amin = 1e-10f, float top_db = 80.0f);
std::vector<float> amplitude_to_db(const std::vector<float>& values,
                                   float ref = 1.0f, float amin = 1e-5f, float top_db = 80.0f);
std::vector<float> db_to_power(const std::vector<float>& values, float ref = 1.0f);
std::vector<float> db_to_amplitude(const std::vector<float>& values, float ref = 1.0f);
```

## マスタリング

高レベルのマスタリング API は `sonare::mastering::api` にあります。`master_audio_mono` / `master_audio_stereo` は組み込みの `Preset`（必要に応じてフラットなドット記法の上書き値付き）を適用し、チェーン結果を返します。`preset_*` ヘルパーはプリセット識別子の列挙と解決を行います。

```cpp
#include <mastering/api/presets.h>

namespace api = sonare::mastering::api;

// 25 個の組み込みプリセット: Pop, EDM, Acoustic, HipHop, AIMusic, Speech, Streaming,
// YouTube, Broadcast, Podcast, Audiobook, Cinema, JPop, Ambient, Lofi, Classical,
// DrumAndBass, Techno, Metal, Trap, RnB, Jazz, KPop, Trance, GameOst。
std::vector<std::string> names = api::preset_names();
api::Preset preset = api::preset_from_string("aiMusic");

// 任意のフラットな上書き値（チェーン設定 params と同じドット記法）
api::Param overrides[] = {{"loudness.targetLufs", -13.0f}};
// リミッターは "maximizer.truePeakLimiter.releaseMs" と
// "maximizer.truePeakLimiter.applyGainAtInputRate" も直接上書き値として受け取ります。

api::MonoChainResult result = api::master_audio_mono(
  preset, samples.data(), samples.size(), sample_rate, overrides, 1);
// result にはレンダリング後のサンプルと各ステージの指標が含まれます。

// ステレオ版:
// api::master_audio_stereo(preset, left, right, length, sample_rate, overrides, 1);
```

`preset_to_string(Preset)` は正規の識別子を返します。例外を投げず、不正値には `"unknown"` を返します。

`preset_config(Preset)` は、チェーン実行前に確認・調整できる可変の `MasteringChainConfig` を返します。

名前付きプロセッサのレジストリやアシスタント／プロファイルの JSON ヘルパーは、[マスタリングプロセッサ](./mastering-processors.md) と [マスタリングアシスタント](./mastering-assistant.md) を参照してください。

C ABI レベルでは、`SonareMasteringConfig` が同じリミッター制御を追加フィールドの `release_ms` と `apply_gain_at_input_rate` として公開します。呼び出し側は引き続き実際の `target_lufs` と `ceiling_db` を渡す必要があります。追加されたリミッターフィールドを 0 のままにすると従来動作を保ち、`release_ms == 0` は 50 ms の既定値、`apply_gain_at_input_rate == 0` は入力レートでのゲイン適用をオフのまま保ちます。

### ステレオのプロファイル・アシスタント・プレビュー

プロファイル、アシスタント、配信プレビューの各 JSON ヘルパーには、両チャンネルを読むステレオ入口があります。ステレオのクレストファクターメーターも同じ系統です。

```c
#include <sonare/sonare_c_mastering.h>
#include <sonare/sonare_c_metering.h>

SonareError sonare_mastering_audio_profile_stereo(const float* left, const float* right,
                                                  size_t length, int sample_rate,
                                                  const SonareMasteringParam* params,
                                                  size_t param_count, char** json_out);
SonareError sonare_mastering_assistant_suggest_stereo(const float* left, const float* right,
                                                      size_t length, int sample_rate,
                                                      const SonareMasteringParam* params,
                                                      size_t param_count, char** json_out);
SonareError sonare_mastering_streaming_preview_stereo(const float* left, const float* right,
                                                      size_t length, int sample_rate,
                                                      const SonareStreamingPlatform* platforms,
                                                      size_t platform_count, char** json_out);
SonareError sonare_metering_crest_factor_db_stereo(const float* left, const float* right,
                                                   size_t length, int sample_rate, float* out_db);
```

`*json_out` はヒープ確保されるので、モノラル入口と同じ契約で `sonare_free_string` により解放します。`platforms` に `NULL` ／ `0` を渡すとエラーにはならず、組み込みの Spotify ／ Apple Music ／ YouTube のリストが使われます。

2 チャンネルの素材を扱うときは、常にステレオ側を使ってください。モノラル入口は `0.5 * (left + right)` のダウンミックスを測定するため、相関の低いステレオ素材では約 6 dB 低く出ます。その分だけ、インテグレーテッドラウドネス、そこから導かれるノーマライズゲイン、ピーク余裕の判定がまとめて過小評価されます。相関を落としたピンクノイズのペア（48 kHz・4 秒）では、ダウンミックス経由が -22.55 LUFS、ステレオ経由が -16.44 LUFS で、差は 6.11 dB でした。同じ差が Spotify の `normalizationGainDb` を +2.44 から +8.55 に押し上げます。相関の高いペアでは差は 3.01 dB にとどまり、これはダウンミックスで振幅が半分になる分です。残りの約 3 dB が相関の低さによるものです。

ステレオプロファイルのうち、両チャンネルから測るのは `loudness` ブロックだけです。インテグレーテッド LUFS と LRA はチャンネルを合算したプログラムから求め、True Peak（トゥルーピーク）は 2 つのうち大きい方を採ります。スペクトル・ダイナミクス・テンポの各フィールドは絶対レベルではなく形と時間構造を表すため、ダウンミックス基準のまま据え置き、モノラル呼び出しの結果とそのまま比較できます。

`sonare_metering_crest_factor_db_stereo` は逆向きの誤差を正します。ピークは両チャンネルにまたがって取り、RMS は両チャンネルをまとめて計算します。ダウンミックスでは逆相のペアが打ち消し合い、RMS を小さく見積もる分だけクレストファクターが大きく出てしまうためです。位相を反転させたペアでは、ステレオメーターが `11.64` dB、ダウンミックス経由が `0.00` dB になります。

## エラーハンドリング

```cpp
class SonareException : public std::runtime_error {
public:
  explicit SonareException(ErrorCode code);
  SonareException(ErrorCode code, const std::string& message);
  ErrorCode code() const;
};

try {
  auto audio = Audio::from_file("nonexistent.mp3");
} catch (const SonareException& e) {
  if (e.code() == ErrorCode::FileNotFound) {
    // ファイルが見つからない場合の処理
  }
}
```

## 各節の移動先

| セクション | 移動先 |
|---|---|
| StreamAnalyzer | [C++ ストリーミング API](./cpp-api-streaming.md) |
| 特徴抽出、型 | [C++ 解析 API](./cpp-api-analysis.md) |
| エフェクト、ミキシングエンジン、C API | [C++ エフェクト API](./cpp-api-effects.md) |
