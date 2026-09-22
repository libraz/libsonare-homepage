# libsonare ホームページ

外部依存のない C++ 音声エンジン [libsonare](https://libsonare.libraz.net) の
ドキュメントとデモ。解析、マスタリング、ミキシング、編集、室内音響、内蔵音源、
ヘッドレス DAW ランタイムを扱います。

VitePress 製。**デモはすべてブラウザ内でエンジンを動かします** — WebAssembly
で手元の音声を処理し、アップロードも呼び出すサーバーもありません。英語を
`src/docs/`、日本語を `src/ja/docs/` に置く二言語構成です。

## デモ

| デモ | 内容 |
| --- | --- |
| [ビジュアルプレイヤー](https://libsonare.libraz.net/ja/analyzer) | クロマとスペクトルをリアルタイム可視化するオーディオプレイヤー |
| [マスタリングスタジオ](https://libsonare.libraz.net/ja/mastering) | プリセットで配信向けラウドネスへ。WAV 書き出し対応 |
| [楽曲分析スタジオ](https://libsonare.libraz.net/ja/music-analysis) | 構造・ハーモニー・メロディ・ラウドネスとスペクトル表示 |
| [ミキシングスタジオ](https://libsonare.libraz.net/ja/mixing) | 最大 8 トラックのステムミキサー。シーン JSON とバウンス |
| [リアルタイムボイスチェンジャー](https://libsonare.libraz.net/ja/realtime-fx) | マイク入力のボイスチェンジャー。キャラクタープリセット付き |
| [空間ルームスキャナー](https://libsonare.libraz.net/ja/spatial) | 録音から部屋の形状・残響・音源までの距離を推定 |
| [シンセプレイグラウンド](https://libsonare.libraz.net/ja/synth) | 内蔵ポリフォニックシンセを PC キーボードや USB MIDI 鍵盤で演奏 |
| [スタジオミニ](https://libsonare.libraz.net/ja/studio) | 3 トラックをステップ入力し、ミックスしてループをバウンス |
| [ピアノ練習](https://libsonare.libraz.net/ja/practice) | 落下ノート、光る鍵盤、MIDI 入力による採点 |
| [GS 音源モジュール](https://libsonare.libraz.net/ja/gs-module) | 16 パート、インサーションエフェクト 1 系統、そして手持ちの .mid |
| [ステップベース](https://libsonare.libraz.net/ja/step-bass) | 16 ステップ・1 ボイス。ダイオードラダー・ローパスにステップごとのアクセントとスライド |

デモの id とルートとディレクトリを結び付けている表は `src/demos/manifest.ts`
の 1 か所だけです。この一覧がそこからずれると `tests/readme.test.ts` が落ちます。

## 開発

```bash
yarn install
yarn dev                 # 開発サーバー
yarn build               # 本番ビルド
yarn preview             # 本番ビルドの確認
yarn copy:wasm           # ../libsonare/bindings/wasm/dist から WASM を取り込む
```

## チェック

```bash
yarn check               # 下記すべてのゲート
yarn verify              # リリース前: check + test + build + built-route check

yarn check:docs          # ドキュメントのリンクとアンカー
yarn check:glossary      # 用語集の網羅
yarn check:i18n          # en/ja の対応
yarn check:demos         # インラインデモの id・アーキタイプ・クリップ
yarn check:mastering-docs
yarn check:mastering     # マスタリングプリセットが目標値に到達するか
yarn check:sweep         # ドキュメントが挙げるシンボルがエンジンに実在するか
yarn check:terms         # 用語の統一
yarn check:gs-data       # 生成した GS データが取得元のエンジンと一致するか
yarn check:built-routes  # ビルド後のルート成果物
```

## ライセンス

Apache-2.0 — [LICENSE](LICENSE) を参照してください。
