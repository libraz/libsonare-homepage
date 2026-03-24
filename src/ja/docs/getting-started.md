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

::: warning パッケージ未公開
npm パッケージ `@libraz/libsonare` は現在ベータ版で、まだ公開されていません。[インストール](/ja/docs/installation)で代替オプションを確認してください。
:::

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

### Python / Node.js（ネイティブ）

Python（ctypes）とNode.js（N-API）向けのネイティブバインディングが利用可能です。インストールとAPIリファレンスは[ネイティブバインディング](/ja/docs/native-bindings)を参照してください。

## 今すぐ試す

[デモ](/ja/)にアクセスして、ブラウザでlibsonareを試してみてください。音声ファイルをドラッグ&ドロップするだけで解析結果が表示されます。
