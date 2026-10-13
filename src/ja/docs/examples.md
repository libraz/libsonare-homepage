# 使用例

このページは [はじめに](./getting-started.md) の後に読むページです。例は意図的に目的別に並べています。作りたいものに最も近いワークフローを選び、詳細な API はリンク先の実行環境別リファレンスで確認してください。このページは目的別の手早いパターンを扱い、実行環境ごとの機能別の詳しいレシピは [機能別レシピ](./examples-recipes.md) にあります。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- 自分の実行環境で、一括解析やサーバーサイドの解析を動かせる。
- 同じ処理が実行環境ごとにどう変わるかを見比べられる。
- 「音声を読み込む／デコードする」処理と「libsonare を呼ぶ」処理を区別できる。
- オプションや戻り値の形が必要になったときに、レシピから該当 API リファレンスへ移れる。

## ユースケース別

ファイル 1 つを解析する最初のプログラムは、実行環境ごとに [はじめに](./getting-started.md#最初の結果) にあります。以下のパターンはその次の一歩です。素材ファイルから納品物まで、制作作業をまるごと通した手順（ステムから完成マスターまで、CI で回る納品前チェック、テイクの一括整音など）は [実践ユースケース](./use-cases.md) にあります。

### 音楽フォルダを一括解析する

どの版もファイルごとに、名前、BPM、キーを 1 行ずつ表示します。CLI 版は代わりにファイルごとの JSON サマリーを書き出します。

::: code-group

```bash [CLI]
pip install libsonare

for f in *.mp3; do
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

```python [Python]
from pathlib import Path
from libsonare import Audio

for path in sorted(Path(".").glob("*.mp3")) + sorted(Path(".").glob("*.wav")):
    with Audio.from_file(str(path)) as audio:
        result = audio.analyze()
    print(f"{path.name}\t{result.bpm:.1f}\t{result.key.name}")
```

```js [Node.js（WASM）]
import { readdirSync, readFileSync } from 'node:fs';
import { init, Audio } from '@libraz/libsonare';

await init();
for (const name of readdirSync('.').filter((f) => /\.(mp3|wav)$/i.test(f))) {
  const result = Audio.fromMemory(new Uint8Array(readFileSync(name))).analyze();
  console.log(`${name}\t${result.bpm.toFixed(1)}\t${result.key.name}`);
}
```

:::

### サーバーでアップロード音源を解析する

WASM パッケージはアップロードされたバイト列をメモリ内でデコードするので、ディスクには何も書きません。ネイティブアドオンはパスから読み込み、ソースからビルドします（[ネイティブバインディング](./native-bindings.md)）。

::: code-group

```js [Node.js（WASM）]
import { init, Audio } from '@libraz/libsonare';

await init();

// body はアップロードされた WAV または MP3 ファイル（Buffer か Uint8Array）
export function analyzeUpload(body) {
  const result = Audio.fromMemory(new Uint8Array(body)).analyze();
  return { bpm: result.bpm, key: result.key.name, chords: result.chords.length };
}
```

```typescript [Node.js（ネイティブ）]
import { Audio } from '@libraz/libsonare-native';

const result = Audio.fromFile('/tmp/upload.wav').analyze();
console.log(result.bpm, result.key.name);
```

:::

## C++

これらのプログラムがインクルードする `<sonare.h>` は、ソースツリーでも `cmake --install` 後でも解決できます。インストールされた `sonare::` ターゲットが `include/sonare/cpp` をインクルードパスに加えるためです。`<sonare/cpp/sonare.h>` は、名前空間付きのパスで同じヘッダーを指す書き方です（[C++ ライブラリのインストール](./installation.md#c-ライブラリのインストール)）。

### 基本的な使い方

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  float bpm = sonare::quick::detect_bpm(
    audio.data(), audio.size(), audio.sample_rate()
  );

  std::cout << "BPM: " << bpm << std::endl;
  return 0;
}
```

### MusicAnalyzer での総合解析

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");
  sonare::MusicAnalyzer analyzer(audio);

  // 進捗コールバック
  analyzer.set_progress_callback([](float progress, const char* stage) {
    std::cout << stage << ": " << (progress * 100) << "%\n";
  });

  auto result = analyzer.analyze();

  std::cout << "BPM: " << result.bpm << std::endl;
  std::cout << "キー: " << result.key.to_string() << std::endl;

  std::cout << "\nコード:" << std::endl;
  for (const auto& chord : result.chords) {
    std::cout << "  " << chord.to_string()
              << " [" << chord.start << "秒 - " << chord.end << "秒]"
              << std::endl;
  }

  return 0;
}
```

### 特徴抽出

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // メルスペクトログラム
  sonare::MelConfig config;
  config.n_mels = 128;
  config.n_fft = 2048;
  config.hop_length = 512;

  auto mel = sonare::MelSpectrogram::compute(audio, config);
  std::cout << "Mel 形状: " << mel.n_mels() << " x " << mel.n_frames() << std::endl;

  // MFCC
  auto mfcc = mel.mfcc(13);
  std::cout << "MFCC 係数: " << mfcc.size() / mel.n_frames() << std::endl;

  return 0;
}
```

### オーディオエフェクト

```cpp
#include <sonare.h>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // HPSS
  auto hpss_result = sonare::hpss(audio);
  // hpss_result.harmonic
  // hpss_result.percussive

  // タイムストレッチ（50% にスローダウン）
  auto slow = sonare::time_stretch(audio, 0.5f);

  // ピッチシフト（+2 半音）
  auto higher = sonare::pitch_shift(audio, 2.0f);

  return 0;
}
```

### ゼロコピースライシング

```cpp
#include <sonare.h>
#include <iostream>

int main() {
  auto full = sonare::Audio::from_file("song.mp3");
  std::cout << "全体の長さ: " << full.duration() << "秒\n";

  // ゼロコピースライス（同じバッファを共有）
  auto intro = full.slice(0.0f, 30.0f);
  auto chorus = full.slice(60.0f, 90.0f);

  // 各セクションを解析
  auto intro_key = sonare::quick::detect_key(
    intro.data(), intro.size(), intro.sample_rate()
  );
  auto chorus_key = sonare::quick::detect_key(
    chorus.data(), chorus.size(), chorus.sample_rate()
  );

  std::cout << "イントロのキー: " << intro_key.to_string() << "\n";
  std::cout << "サビのキー: " << chorus_key.to_string() << "\n";

  return 0;
}
```

## C API

```c
#include <sonare/sonare_c.h>
#include <stdio.h>

static const char* kPitchNames[] = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
// SonareMode の値で引く。SONARE_MODE_MAJOR (0) から SONARE_MODE_LOCRIAN (6) まで
static const char* kModeNames[] = {
    "major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian"};

int main() {
  SonareAudio* audio = NULL;
  SonareError err;

  // 音声を読み込む
  err = sonare_audio_from_file("music.mp3", &audio);
  if (err != SONARE_OK) {
    printf("Error: %s\n", sonare_error_message(err));
    return 1;
  }

  // BPM を検出（audio ハンドルを直接使うため、余分なデータコピーは発生しない）
  float bpm;
  err = sonare_audio_detect_bpm(audio, &bpm);
  if (err == SONARE_OK) {
    printf("BPM: %.1f\n", bpm);
  }

  // キーを検出（SonareKey はルート・モード・信頼度を保持）
  SonareKey key;
  err = sonare_audio_detect_key(audio, &key);
  if (err == SONARE_OK) {
    printf("Key: %s %s (confidence: %.0f%%)\n",
           kPitchNames[key.root],
           kModeNames[key.mode],
           key.confidence * 100);
  }

  // ビートを検出
  float* beat_times = NULL;
  size_t beat_count = 0;
  err = sonare_audio_detect_beats(audio, &beat_times, &beat_count);
  if (err == SONARE_OK) {
    printf("Beats: %zu\n", beat_count);
    sonare_free_floats(beat_times);
  }

  sonare_audio_free(audio);
  return 0;
}
```

::: tip サンプルベースのバリアント
すでに生のサンプル（別の音声ソースから取得したものなど）を持っている場合は、`SonareAudio` ハンドルを構築する代わりにサンプルベースのバリアントを使えます。

```c
sonare_detect_bpm(samples, length, sample_rate, &out_bpm);
sonare_detect_key(samples, length, sample_rate, &out_key);
sonare_detect_beats(samples, length, sample_rate, &out_times, &out_count);
sonare_analyze(samples, length, sample_rate, &out_result);
```
:::

## CLI 例

### クイック解析

```bash
# BPM 検出
sonare bpm song.mp3

# キー検出
sonare key song.mp3

# 総合解析 (JSON)
sonare analyze song.mp3 --json > analysis.json
```

### オーディオ処理

::: info
`pip install libsonare` でインストールされる Python CLI は、`pitch-shift`、`time-stretch`、ファイル書き出しを行う `hpss` を提供します。ネイティブ実行ファイルの名前は `sonare-cli` なので、リリースアーカイブまたはソースビルドのネイティブ CLI を使う場合はコマンド名を読み替えてください。
:::

```bash [Python CLI]
# 2 半音上に移調
sonare pitch-shift --semitones 2 input.wav -o output.wav

# 練習用にスローダウン
sonare time-stretch --rate 0.8 song.wav -o practice.wav

# ドラムとメロディを分離
sonare hpss song.wav -o separated
```
