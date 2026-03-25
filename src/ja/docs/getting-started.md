# はじめに

libsonareは、音楽情報検索（MIR）のためのC++17音声解析ライブラリです。

## 機能

- **BPM検出** - テンポグラムと自己相関を使用した正確なテンポ推定
- **キー検出** - Krumhansl-Schmucklerアルゴリズムによる調性検出
- **ビート検出** - 動的計画法に基づくビート抽出
- **コード認識** - 108種類のコードタイプに対応したテンプレートマッチング
- **セクション検出** - 構造的セグメンテーション（イントロ、Aメロ、サビなど）
- **メロディ / ピッチ検出** - YIN / pYIN アルゴリズムによる基本周波数検出
- **音響特性** - 音色、ダイナミクス、リズム分析
- **スペクトル特徴量** - メルスペクトログラム、MFCC、クロマ、CQT/VQT、スペクトル重心/平坦度
- **オーディオエフェクト** - HPSS、タイムストレッチ、ピッチシフト、ノーマライズ、トリム
- **ストリーミング解析** - リアルタイムのチャンク単位処理とプログレッシブBPM/キー/コード推定

## クイックスタート

### ブラウザ（WebAssembly）

```typescript
import { init, analyze } from '@libraz/libsonare';

// WASMモジュールを初期化
await init();

// 音声サンプルを解析
const result = analyze(samples, sampleRate);

console.log('BPM:', result.bpm);
console.log('キー:', result.key.name);
console.log('コード:', result.chords);
```

### Python

```bash
pip install libsonare
```

```python
from libsonare import Audio, analyze

# 音声ファイルを解析
audio = Audio.from_file("music.mp3")
result = analyze(audio.data, audio.sample_rate)

print(f"BPM: {result.bpm}")
print(f"キー: {result.key}")
print(f"ビート数: {len(result.beat_times)}")
```

### CLI（コマンドライン）

`pip install libsonare` で `sonare` コマンドが使えるようになります。

```bash
# BPM とキーをすばやく確認
sonare bpm music.mp3
sonare key music.mp3

# JSON 形式で完全解析
sonare analyze music.mp3 --json
```

### Node.js（ネイティブ）

Node.js（N-API）向けのネイティブバインディングも利用可能です。インストールとAPIリファレンスは[ネイティブバインディング](/ja/docs/native-bindings)を参照してください。

## 今すぐ試す

[デモ](/ja/)にアクセスして、ブラウザでlibsonareを試してみてください。音声ファイルをドラッグ&ドロップするだけで解析結果が表示されます。
