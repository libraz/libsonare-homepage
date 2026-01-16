# はじめに

libsonareは、音楽情報検索（MIR）のためのC++17音声解析ライブラリです。

## 機能

- **BPM検出** - テンポグラムと自己相関を使用した正確なテンポ推定
- **キー検出** - Krumhansl-Schmucklerアルゴリズムによる調性検出
- **ビート検出** - 動的計画法に基づくビート抽出
- **コード認識** - 84種類のコードタイプに対応したテンプレートマッチング
- **セクション検出** - 構造的セグメンテーション（イントロ、Aメロ、サビなど）
- **音響特性** - 音色、ダイナミクス、リズム分析

## クイックスタート

::: warning パッケージ未公開
npm パッケージ `@libraz/sonare` は現在ベータ版で、まだ公開されていません。[インストール](/ja/docs/installation)で代替オプションを確認してください。
:::

### ブラウザ（WebAssembly）

```typescript
import { init, analyze } from '@libraz/sonare';

// WASMモジュールを初期化
await init();

// 音声サンプルを解析
const result = analyze(samples, sampleRate);

console.log('BPM:', result.bpm);
console.log('キー:', result.key.name);
console.log('コード:', result.chords);
```

### Node.js / C++

ネイティブでの使用方法は[インストール](/ja/docs/installation)を参照してください。

## 今すぐ試す

[デモ](/ja/)にアクセスして、ブラウザでlibsonareを試してみてください。音声ファイルをドラッグ&ドロップするだけで解析結果が表示されます。
