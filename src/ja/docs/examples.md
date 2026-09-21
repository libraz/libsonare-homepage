# 使用例

このページは [はじめに](./getting-started.md) の後に読むページです。例は意図的に目的別に並べています。作りたいものに最も近いワークフローを選び、詳細な API はリンク先の実行環境別リファレンスで確認してください。このページは目的別の手早いパターンを扱い、実行環境ごとの機能別の詳しいレシピは [機能別レシピ](./examples-recipes.md) にあります。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ、Python、CLI、Node ネイティブの小さな動作パターンを 1 つコピーして試せる。
- 同じ処理が実行環境ごとにどう変わるかを見比べられる。
- 「音声を読み込む／デコードする」処理と「libsonare を呼ぶ」処理を区別できる。
- オプションや戻り値の形が必要になったときに、レシピから該当 API リファレンスへ移れる。

## ユースケース別

以下はいずれも小さな出発点のパターンです。素材ファイルから納品物まで、制作作業をまるごと通した手順 — ステムから完成マスターまで、CI で回る納品前チェック、テイクの一括整音など — は [実践ユースケース](./use-cases.md) にあります。

### ブラウザアプリで BPM とキーを表示する

音声をブラウザ内で扱う場合は、npm の WebAssembly パッケージを使います。ファイルは先に Web Audio API でデコードし、モノラルの `Float32Array` サンプルを libsonare に渡します。

```typescript
import { init, detectBpm, detectKey } from '@libraz/libsonare';

await init();

const audioCtx = new AudioContext();
const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
const samples = decoded.getChannelData(0);

const bpm = detectBpm(samples, decoded.sampleRate);
const key = detectKey(samples, decoded.sampleRate);
```

### ターミナルで音楽フォルダを一括解析する

CLI は、ターミナルでの確認やスクリプト向け JSON サマリー出力に向いています。CLI は npm ではなく PyPI からインストールします。

```bash
pip install libsonare

for f in *.mp3; do
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

### Python でメタデータを抽出する

Python は、スクリプト、ノートブック、librosa に近いワークフローでネイティブ C++ バックエンドを使いたい場合に向いています。

```python
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    result = audio.analyze()

print(result.bpm, result.key, len(result.beat_times))
```

### Node.js でアップロード音源を解析する

サーバーサイドでファイル読み込みやネイティブ性能が必要な場合は、Node.js ネイティブバインディングを使います。現在はソースビルド前提です。

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('/tmp/upload.wav');
const result = audio.analyze();

console.log(result.bpm, result.key.name);
```

## C++

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
           key.mode == SONARE_MODE_MAJOR ? "major" : "minor",
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

### バッチ処理

```bash
# すべての MP3 ファイルを解析
for f in *.mp3; do
  echo "処理中: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

## 各節の移動先

| 節 | 移動先 |
|---|---|
| 機能別レシピ | [機能別レシピ](./examples-recipes.md) |
