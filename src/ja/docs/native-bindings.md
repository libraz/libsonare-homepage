# ネイティブバインディング

libsonareはデスクトップ環境向けのネイティブバインディングを提供しています。各言語の詳細は個別のAPIページを参照してください:

- **[Python API](/ja/docs/python-api)** — cffi ベースのバインディング、PyPI でビルド済みホイールを配布
- **Node.js（N-API）** — C++の性能を直接活用するネイティブアドオン（以下に記載）

## 比較

| | WebAssembly | Python | Node.js（N-API） |
|---|---|---|---|
| **プラットフォーム** | ブラウザ | デスクトップ | デスクトップ |
| **配布** | npm | PyPI / ソース | ソース |
| **ビルド** | Emscripten | ビルド済みホイール（または CMake + pip） | CMake + cmake-js |
| **パフォーマンス** | ネイティブに近い | ネイティブ | ネイティブ |
| **ストリーミング** | 対応 | 非対応 | 非対応 |
| **ファイルI/O** | 非対応 | 対応 | 対応 |
| **エフェクト** | 対応 | 対応 | 対応 |
| **特徴抽出** | 対応 | 対応 | 対応 |
| **単位変換** | 対応 | 対応 | 対応 |

---

## Node.js（N-API）

Node.jsバインディングは**N-API**を使用したネイティブアドオンで、WebAssemblyのオーバーヘッドなしにC++の性能を直接活用できます。

### 要件

- Node.js 22以上
- CMake 3.16以上
- C++17対応コンパイラ
- Yarn 4以上

### インストール

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

### 使用例

```typescript
import {
  Audio, analyze, detectBpm, detectKey, detectBeats, version
} from '@libraz/libsonare-native';

// 音声を読み込み
const audio = Audio.fromFile('music.mp3');
const samples = audio.getData();
const sampleRate = audio.getSampleRate();

// 個別の解析
const bpm = detectBpm(samples, sampleRate);
const key = detectKey(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);

// フル解析
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.root} ${result.key.mode}`);
console.log(`ビート数: ${result.beatTimes.length}`);

// メモリ解放
audio.destroy();
```

### APIリファレンス

#### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.fromFile(path)` | WAV/MP3ファイルを読み込み |
| `Audio.fromBuffer(samples, sampleRate?)` | `Float32Array`から作成 |
| `Audio.fromMemory(data)` | `Buffer` / `Uint8Array`をデコード |
| `audio.getData()` | サンプルの`Float32Array` |
| `audio.getSampleRate()` | サンプルレート（Hz） |
| `audio.getDuration()` | 長さ（秒） |
| `audio.getLength()` | サンプル数 |
| `audio.destroy()` | ネイティブメモリを解放 |

#### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detectBpm(samples, sampleRate?)` | `number` | テンポ（BPM） |
| `detectKey(samples, sampleRate?)` | `Key` | ルート、モード、確信度 |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | ビート位置 |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | オンセット位置 |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | フル解析 |
| `version()` | `string` | ライブラリバージョン |

デフォルトの`sampleRate`は`22050`です。すべての関数は `Audio` インスタンスメソッドとしても利用可能です。

#### 型定義

```typescript
interface Key {
  root: string;        // "C", "C#", "D", ...
  mode: string;        // "major" | "minor"
  confidence: number;
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;
}
```
