# ベンチマーク

libsonareとlibrosa (Python) の音声解析タスクにおける性能比較。

::: info 計測方法
以下の数値はすべて **「raw audio から standalone」** で計測しています。各呼び出しは必要な中間状態 (STFT、Melなど) を元のサンプルから毎回再構築します。これは両APIを単発で使うユーザーが体験するのと同じコードパスなので、フェアな比較になっています。ベンチマークのソースと結果JSONは libsonare リポジトリの [`benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) にあります。
:::

::: info ハードウェア
Apple M5 Max (16コア、128GBユニファイドメモリ) で計測。絶対値はハードウェアでスケールしますが、相対差は安定しています。
:::

## フルパイプライン解析

完全な楽曲解析: BPM + キー + ビート + コード + セクション + 音色 + ダイナミクス + リズム + メロディ。

テスト音声: 合成WAV、73秒、44100 Hz ステレオ (`benchmarks/generate_audio.py` で生成)。

<BenchChart
  title="Full Analysis Latency (lower is better)"
  :data="[
    { label: 'Full analyze', librosa: 36400, libsonare: 674 },
  ]"
/>

| ライブラリ | 言語 | 時間 | 相対 |
|---------|----------|------|----------|
| libsonare | C++ | 0.67秒 | 1倍 |
| bpm-detector `--comprehensive` (librosaベース) | Python | 36.4秒 | 約54倍遅い |

フルパイプライン値は libsonare の設計が最も活きる場面です: スペクトログラム共有、特徴量計算の並列化、44.1→22.05 kHz への自動ダウンサンプリング、そしてパイプライン内に Python 境界がないこと。

## 機能別比較

同じ73秒の音声 (22050 Hz にリサンプリング後) における個別の特徴抽出。librosa は `time.perf_counter`、libsonare は `sonare_bench` バイナリ内の `chrono::steady_clock` で計測。

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 13.3, libsonare: 13.85 },
    { label: 'Mel Spectrogram', librosa: 20.35, libsonare: 23.01 },
    { label: 'HPSS', librosa: 1761.85, libsonare: 89.35 },
    { label: 'Onset Strength', librosa: 21.46, libsonare: 23.54 },
    { label: 'Chroma', librosa: 44.55, libsonare: 15.36 },
    { label: 'Beat Track', librosa: 35.64, libsonare: 23.77 },
    { label: 'MFCC', librosa: 21.55, libsonare: 23.82 },
    { label: 'pYIN', librosa: 5824.64, libsonare: 474.22 },
    { label: 'Spectral Centroid', librosa: 24.76, libsonare: 16.54 },
  ]"
/>

| 機能 | librosa | libsonare | 高速化 |
|---------|---------|-----------|---------|
| STFT (2048, hop 512) | 13.3ms | 13.9ms | 0.96倍 (同等) |
| メルスペクトログラム (128バンド) | 20.4ms | 23.0ms | 0.88倍 (同等) |
| HPSS (カーネルサイズ 31) | 1,762ms | 89ms | **19.7倍** |
| オンセット強度 | 21.5ms | 23.5ms | 0.91倍 (同等) |
| クロマ (STFTベース) | 44.6ms | 15.4ms | **2.9倍** |
| ビートトラック | 35.6ms | 23.8ms | 1.5倍 |
| MFCC (13係数) | 21.6ms | 23.8ms | 0.90倍 (同等) |
| pYIN | 5,825ms | 474ms | **12.3倍** |
| スペクトル重心 | 24.8ms | 16.5ms | 1.5倍 |

::: tip 率直な評価
STFTが支配的な軽量な特徴量 (STFT、Mel、Onset、MFCC) では、libsonare は librosa と **ほぼ同等** です。librosa は FFT を scipy.fft (高度に最適化された C/Fortran) に委譲しているため、FFT コストを差し引くと一回呼ぶだけでは差を作る余地があまりありません。

明確な勝ち筋は (1) **計算量の重い処理** で、libsonare のマルチスレッドメディアンフィルタ (HPSS) と並列ビタビ復号 (pYIN) が Python パイプラインを大きく引き離します。そして (2) **パイプライン全体の解析** で、中間結果の共有と Python 境界の排除が支配的になります。
:::

## 大きな差がつく場所

### フルパイプライン (54倍): 共有中間結果 + Python 境界なし

libsonare の `analyze()` は STFT と Mel スペクトログラムを **一度だけ** 計算し、下流のすべてのアナライザで再利用します。コード検出は key アナライザと同じクロマグラムを読み、ビートトラッカーはセクション検出器が消費するのと同じオンセットエンベロープを読みます。独立したパスは CPU コア間で並列実行されます。これらはどれも Python 境界を跨がないため、呼び出しごとのディスパッチオーバーヘッドが消えます。

bpm-detector (および他の librosa ベースのパイプライン) は各アナライザでこれらの中間結果を再構築し、Python から全体をオーケストレーションします。コストが積み重なります。

### HPSS (19.7倍): キャッシュフレンドリーなマルチスレッドメディアンフィルタ

librosa の HPSS は `scipy.ndimage.median_filter` を水平方向と垂直方向に1回ずつ呼びます。これは各ピクセルを逐次処理する汎用 C 実装です。

libsonare はこれをカスタムスライディングメディアンに置き換えています:
- **ソート済みフラット配列** (O(log k) の二分探索 + O(k) の memmove) — 一般的なカーネルサイズで L1 キャッシュに収まる、ツリー構造ではなく
- **マルチスレッド実行** — 行と列がすべてのコアで並列処理される
- 結果: このハードウェアで scipy 版の約 20 倍高速

### pYIN (12.3倍): ネイティブのビタビ + 候補並列化

pYIN のボトルネックはフレームごとの候補評価とビタビ復号です。libsonare は両方を C++ でフレーム処理を並列化して実装し、librosa の Numba-JIT 内ループを置き換えています。特に候補評価は C++ の密なループと Eigen3 経由の SIMD ベクトル化の恩恵を受けます。

### クロマ (2.9倍): STFT → フィルタバンクの密なパス

クロマはスペクトログラムから 12 ピッチクラス表現を constant-Q 風のフィルタバンク経由で導出します。libsonare の STFT とフィルタバンク乗算は単一の連続バッファ上の Eigen3 ベクトル化行列演算として動くため、librosa の NumPy 演算スタックのディスパッチオーバーヘッドを回避できます。

## 速くならない箇所 (とその理由)

- **STFT 単体**: librosa は `scipy.fft` に委譲しており、これは C/Fortran 実装。両者の差はノイズの範囲内。
- **Mel / MFCC / オンセット強度**: 基底の STFT コストに支配される。STFT 後のフレームごとの Mel フィルタバンク乗算や DCT は、別言語で書いても差が出るほど重くない。
- **パイプライン内での利用**: `analyze()` 内ではこれらの特徴量は <1ms で動きます。STFT/Mel が一度だけ計算され共有されるためです。上記の standalone 値は「単体で呼んだときのコスト」を示すもので、パイプライン内コストではありません。

## 自分で再現する

ベンチマークは [`libsonare/benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) にあり完全に再現可能です:

```bash
# ローカルの libsonare チェックアウト内で
cmake -B build-bench -DCMAKE_BUILD_TYPE=Release \
                     -DBUILD_BENCH=ON -DBUILD_TESTING=OFF -DBUILD_CLI=OFF
cmake --build build-bench -j

rye sync --pyproject benchmarks/pyproject.toml
rye run --pyproject benchmarks/pyproject.toml python benchmarks/generate_audio.py

./build-bench/bin/sonare_bench \
    benchmarks/fixtures/bench_73s_44100.wav \
    benchmarks/results_cpp.json

rye run --pyproject benchmarks/pyproject.toml python benchmarks/run_bench.py
```

統合された `benchmarks/results.json` には C++ 計測の libsonare 値と librosa 値、そして `bpm-detector` が `PATH` にあれば bpm-detector のフルパイプライン時間も含まれます。

::: tip libsonare を Python から呼ぶ場合
上記の数値は libsonare のネイティブ C++ 性能です。個別の特徴量関数を Python `cffi` バインディング経由で呼ぶ場合 (例: `libsonare.stft(samples, sr)`)、各呼び出しでサンプルバッファが FFI 境界を跨いでマーシャリングされ、軽量な特徴量ではこれが実行時間を支配します。フルパイプラインの `analyze()` は影響を受けません — エンドツーエンドで C++ 内で動き、小さな結果構造体のみが境界を越えます。
:::

## 備考

- 数値はハードウェア依存。ここでは Apple M5 Max。相対差はマシン間で安定しています。
- 合成テスト音声 (決定論的なコード進行 + 打楽器バースト) はリポジトリにコミットせずローカルで生成します。
- WASM ビルドはシングルスレッドです。HPSS と pYIN の倍率は縮みますが、パイプラインレベルの勝ち筋は残ります。
