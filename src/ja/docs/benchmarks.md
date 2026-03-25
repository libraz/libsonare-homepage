# ベンチマーク

libsonareとlibrosa (Python) の音声解析タスクにおける性能比較。

::: info 再現可能
すべてのベンチマークはローカルで再現できます。ページ下部の[ベンチマークを実行する](#ベンチマークを実行する)を参照してください。
:::

::: info ハードウェアについて
Apple M4 Max (16コア、128GBユニファイドメモリ) で計測。ハードウェアが異なれば絶対値は変わりますが、相対的な性能差は一貫しています。
:::

## フル解析

完全な楽曲解析: BPM + キー + ビート + コード + セクション + 音色 + ダイナミクス。

テスト音声: MP3、73秒、44100 Hz ステレオ。

<BenchChart
  title="Full Analysis Latency (lower is better)"
  :data="[
    { label: 'Full analyze', librosa: 43940, libsonare: 810 },
  ]"
/>

| ライブラリ | 言語 | 時間 | 相対速度 |
|---------|----------|------|----------|
| libsonare | C++ | 0.81秒 | 1倍 |
| bpm-detector (librosaベース) | Python | 44秒 | 約54倍遅い |

## 機能別比較

同じ73秒の音声 (リサンプリング後22050 Hz) における個別の特徴抽出。

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 19, libsonare: 17 },
    { label: 'Mel Spectrogram', librosa: 36, libsonare: 10 },
    { label: 'HPSS', librosa: 2207, libsonare: 70 },
    { label: 'Onset Strength', librosa: 25, libsonare: 1 },
    { label: 'Chroma', librosa: 50, libsonare: 1 },
    { label: 'Beat Track', librosa: 527, libsonare: 26 },
    { label: 'MFCC', librosa: 24, libsonare: 1 },
    { label: 'pYIN', librosa: 7033, libsonare: 510 },
    { label: 'Spectral Centroid', librosa: 28, libsonare: 1 },
  ]"
/>

| 機能 | librosa | libsonare | 高速化 |
|---------|---------|-----------|---------|
| STFT (2048, hop 512) | 19ms | 17ms | 1.1倍 |
| メルスペクトログラム (128バンド) | 36ms | 10ms | 3.6倍 |
| HPSS (カーネルサイズ 31) | 2,207ms | 70ms | 32倍 |
| オンセット強度 | 25ms | 1ms | 25倍 |
| クロマ (STFTベース) | 50ms | 1ms | 50倍 |
| ビートトラック / BPM | 527ms | 26ms | 20倍 |
| MFCC (13係数) | 24ms | 1ms | 24倍 |
| pYIN | 7,033ms | 510ms | 14倍 |
| スペクトル重心 | 28ms | 1ms | 28倍 |

::: tip STFT
STFTがほぼ同等なのは、librosaがscipy.fft (C/Fortran) に処理を委譲しているためです。STFTを基盤とする高レベル操作で差が顕著になります。
:::

::: tip HPSS
HPSSが最大の高速化 (32倍) を示しているのは、libsonareがキャッシュフレンドリーなソート済み配列によるマルチスレッドメディアンフィルタを使用し、librosaの逐次処理である scipy.ndimage.median_filter を置き換えているためです。
:::

::: tip pYIN
pYINはlibrosaの14倍高速になり、以前の1.9倍から大幅に改善しました。最適化されたC++のビタビデコーディングと並列化された候補評価により、librosaのNumba JITに対しても大きな優位性を持ちます。
:::

## なぜlibsonareは速いのか

### 1. インタプリタのオーバーヘッドがない

librosaはPythonインタプリタ上で動作します。重い計算はNumPy/SciPy (C/Fortran) に委譲されますが、すべての関数呼び出し、配列生成、制御フローの判断はPythonを経由します。libsonareはネイティブマシンコードに直接コンパイルされます。

```
librosa:   Python → NumPy dispatch → BLAS/LAPACK (C) → result → Python
libsonare: C++ → Eigen3 SIMD → result
```

### 2. STFT: フレーミングと窓関数

librosaのSTFT (`librosa.core.spectrum.stft`) は `numpy.lib.stride_tricks` によるフレーミングとNumPy演算による窓関数適用を行います。各ステップでPythonレベルの配列ディスパッチが発生します。

libsonareのSTFTはKissFFTによる直接ポインタ演算とEigen3のベクトル化された窓関数処理を使用し、中間配列の割り当てやPythonディスパッチがありません。

### 3. HPSS: メディアンフィルタの最適化

librosaは `scipy.ndimage.median_filter` を使用しています。これは各ピクセルを独立に処理する汎用的なC実装です。

libsonareはカスタムスライディングメディアンを使用しています:
- **ソート済みフラット配列** (O(log k) の二分探索 + O(k) の memmove) -- ツリーベースの構造ではなく、一般的なカーネルサイズでCPUキャッシュに収まります
- **マルチスレッド実行**: 行と列がすべてのCPUコアで並列処理されます
- 結果: オリジナル実装より11倍高速、scipyより32倍高速

### 4. 並列特徴量前計算

librosaは特徴量を逐次的に処理します。libsonareは独立した計算パスを同時に実行します:

```
libsonare (並列処理):
  スレッド1: STFT → メルスペクトログラム → オンセット強度
  スレッド2: HPSS → CQT → 調波クロマ
  (両方が完了してから解析開始)
```

### 5. 自動ダウンサンプリング

libsonareはMusicAnalyzerのコンストラクタで44100 Hzの入力を22050 Hzに一度だけダウンサンプリングし、すべてのスペクトル解析パスのデータ量を半減させます。librosaはユーザーが明示的にリサンプリングしない限り、元のサンプルレートで処理します。

### 6. Eigen3 SIMDベクトル化

すべての行列演算 (メルフィルタバンク、クロマ畳み込み、スペクトル特徴量) はEigen3を使用し、SSE/AVX/NEON命令に自動ベクトル化されます。librosaはNumPyのeinsumを使用しますが、最適化されているとはいえ追加のディスパッチオーバーヘッドが発生します。

### 7. ゼロコピーアーキテクチャ

libsonareのスペクトログラム、メル特徴量、オンセット強度は一度だけ計算され、`unique_ptr` メンバとしてキャッシュされます。下流のアナライザはそれらを参照でアクセスします。librosaは各関数呼び出しごとに特徴量を再計算します (`@cache` デコレータが一部のケースで役立ちますが)。

## ベンチマークを実行する

### フル解析

```bash
pip install libsonare
time sonare analyze path/to/audio.mp3 --json > /dev/null
```

### 機能別比較

```python
import time
import librosa
from libsonare import Audio, resample, stft, mel_spectrogram, mfcc, chroma
from libsonare import hpss, detect_beats, pitch_pyin, spectral_centroid, analyze

audio = Audio.from_file("audio.mp3")
samples = resample(audio.data, audio.sample_rate, 22050)
sr = 22050
y, _ = librosa.load("audio.mp3", sr=22050, mono=True)

def bench(name, fn, runs=3):
    times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000)
    import statistics
    print(f"{name:<30s} {statistics.median(times):>8.1f}ms")

print("--- libsonare ---")
bench("Full Analyze", lambda: analyze(samples, sr))
bench("HPSS", lambda: hpss(samples, sr))
bench("pYIN", lambda: pitch_pyin(samples, sr))
bench("Beat Track", lambda: detect_beats(samples, sr))

print("--- librosa ---")
bench("HPSS", lambda: librosa.effects.hpss(y))
bench("pYIN", lambda: librosa.pyin(y, fmin=65, fmax=2093, sr=sr))
bench("Beat Track", lambda: librosa.beat.beat_track(y=y, sr=sr))
```

::: tip
表の機能別数値は C++ 内部タイミング（`chrono::steady_clock`）で計測されています。Python cffi バインディング経由で個別関数を呼び出す場合、データのマーシャリングによるオーバーヘッドが加わります。フル解析（`analyze()`）はパイプライン全体を C++ で実行し結果のみを返すため、C++ CLI と同等の性能を示します。
:::

## 備考

- librosaの計測は `time.perf_counter`、libsonare の機能別計測は `chrono::steady_clock` を使用
- 結果はハードウェア、音声の長さ、コンテンツの複雑さによって異なります
- WASMビルドはシングルスレッド（並列化なし）ですが、それでもPythonより大幅に高速です
