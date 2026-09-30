---
title: プロジェクトのコンパイル・保存・読み込み
description: Project をコンパイルし、決定的な JSON として保存し、音声ソースを再バインドし、分離済みステムを取り込みます。
---

# プロジェクトのコンパイル・保存・読み込み

プロジェクトには 3 つの境界があります。`compile()` はアレンジをレンダリング可能なタイムラインへ変換できるか確認します。`toJson()` / `fromJson()` はアレンジモデルを保存します。読み込みは PCM を復元しないため、バウンス前にデコード済み音声を再バインドします。ホスト側で分離したステムは、通常のオーディオトラックとクリップを作る全件成功または全件失敗のインポートで追加します。

| 目的 | API |
|---|---|
| アレンジを確認する | `project.compile()` |
| モデルを保存する | `project.toJson()` と `Project.fromJson(...)` |
| 読み込み警告を回収する | `Project.fromJsonWithDiagnostics(...)` |
| デコード済み音声を戻す | `unresolvedAudioSourceIds()` と `setSourceAudio(...)` |
| 分離済みステムを追加する | `importExternalStems(...)` |

<FlowDiagram
  title="コンパイル、保存、再バインド、レンダリング"
  :nodes="[
    { id: 'edit', label: 'Project の編集', col: 0, row: 0 },
    { id: 'compile', label: 'compile()', col: 1, row: 0, variant: 'accent' },
    { id: 'json', label: '決定的な JSON', col: 2, row: 0 },
    { id: 'load', label: 'fromJson()', col: 3, row: 0 },
    { id: 'rebind', label: 'PCM を再バインド', col: 4, row: 0 },
    { id: 'bounce', label: 'バウンス', col: 5, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'edit', to: 'compile' },
    { from: 'compile', to: 'json' },
    { from: 'json', to: 'load' },
    { from: 'load', to: 'rebind' },
    { from: 'rebind', to: 'bounce' }
  ]"
  caption="保存したモデルはアレンジを復元します。レンダリング前にホストがデコード済み PCM をもう一度渡します。"
/>

## アレンジをコンパイルする

`compile()` は編集済みプロジェクトを**再生可能なタイムライン**へ変換し、構造化された**診断**を報告します。エラー（重大度 `0`）はタイムラインを構築できなかったことを意味し、警告（重大度 `1`）は致命的でなく、タイムラインは依然として再生可能です。

```typescript
const result = project.compile();
// result.hasTimeline     -> エラーなしで再生可能なタイムラインが生成されたとき true
// result.diagnosticCount -> 診断の数
// result.diagnostics     -> [{ code, severity, targetId, message }, …]
// result.messages        -> 改行で連結した人間可読の詳細

if (!result.hasTimeline) {
  for (const d of result.diagnostics) {
    if (d.severity === 0) console.error(`コンパイルエラー (clip/track ${d.targetId}): ${d.message}`);
  }
}
```

よくある**致命的でない**警告として、MIDI クリップを含むが楽器がバインドされていないプロジェクトは正常にコンパイルされますが、無音でバウンスされます。バウンス後に、そのレンダリングが生成した警告を `lastBounceCompileResult()` で読めます。

```typescript
project.bounce({ numChannels: 2 });
const last = project.lastBounceCompileResult();
// last.diagnostics[0].message ->
//   "project contains MIDI clips; bounce is silent unless an instrument is bound"  (重大度 1)
```

Python では `project.compile()` が同じ形（`has_timeline`・`diagnostic_count`・`diagnostics`・`messages`）を返します。

## 保存と読み込み: 決定的な JSON

`toJson()` はプロジェクト全体（トラック、クリップ、MIDI の内容、ループクロスフェード、テンポマップ、拍子、マーカー、注釈、ワープマップ、オートメーション）を**決定的な JSON** にシリアライズします。同じプロジェクトは常にバイト単位で同一のテキストになります。`Project.fromJson(...)` で復元します。ループクロスフェードは 0 のときフィールドを省略するため、従来のハードループプロジェクトは同じ JSON 形状を保ちます。

```typescript
const json = project.toJson();
// … `json` をディスク・データベース・postMessage に保存 …

const restored = Project.fromJson(json);
try {
  // restored.toJson() === json
} finally {
  restored.delete();
}
```

致命的でない読み込み警告（たとえば修復のために保持された宙ぶらりんのソース参照）を取得したい場合は `Project.fromJsonWithDiagnostics(json)` を使います。

```typescript
const { project: loaded, diagnostics } = Project.fromJsonWithDiagnostics(json);
try {
  if (diagnostics) console.warn(diagnostics);
} finally {
  loaded.delete();
}
```

Python では `project.to_json()`・`Project.from_json(json)`・`Project.from_json_with_diagnostics(json)` が対応します。

### モデルを読み戻し、読み込み後に音声を再バインドする

プロジェクト JSON が保存するのは**アレンジ**であって PCM ではありません。そのため読み込んだプロジェクトはソースの存在は分かっていても、その実体となるサンプルを持っていません。読み取り専用のディスクリプタ 3 系統と PCM／ソースメタデータのセッターを使えば、読み込んだプロジェクトに音声を戻せます。

```typescript
const loaded = Project.fromJson(json);

for (let i = 0; i < loaded.trackCount(); i++) {
  const track = loaded.trackByIndex(i);      // { id, kind, midiDestinationId, gain, pan, mute, solo, name }
  console.log(track.id, track.name);
}
for (let i = 0; i < loaded.clipCount(); i++) {
  const clip = loaded.clipByIndex(i);        // { id, trackId, sourceId, startPpq, lengthPpq, … }
  console.log(clip.id, clip.startPpq, clip.lengthPpq);
}
const unresolvedAudioIds = new Set(loaded.unresolvedAudioSourceIds());
for (let i = 0; i < loaded.sourceCount(); i++) {
  const source = loaded.sourceByIndex(i);    // { id, kind, channelCount, sampleRateHint,
                                             //   nameOrUri, contentHash, externalStemRole }
  if (source.kind !== 0 || !unresolvedAudioIds.has(source.id)) continue; // 0 = audio、MIDI は除外
  const pcm = await decodeFromYourStorage(source.nameOrUri);
  loaded.setSourceAudio(source.id, pcm, source.channelCount, source.sampleRateHint);
  loaded.setAudioSourceMetadata(source.id, 'sha256:...', 'lead-vocal');
}

const audio = loaded.bounce({ sampleRate: 48000 });
```

`trackByIndex` / `clipByIndex` / `sourceByIndex` は保存順に対する 0 始まりのインデックスで、`trackCount()` / `clipCount()` / `sourceCount()` と対になります。返るのはハンドルではなくディスクリプタなので、返り値を書き換えても何も変わりません。ホストがディスクから読み込んだプロジェクトをレンダリングしたいときや、自前のコードが構築したのではないプロジェクトに対して UI を組むときに使います。

`setSourceAudio(sourceId, samples, channels, sampleRate)` は、バウンス前にデコード済み PCM をソースへ再バインドします。「読み込んだだけのアレンジ」を「レンダリングできるプロジェクト」に変えるのがこの一手です。

`unresolvedAudioSourceIds()` は、デシリアライズ後もデコード済み PCM が必要なソース ID の公開リストです。ディスクリプタを走査するときの上の `kind !== 0` ガードは防御的なもので、`0` がオーディオ、`1` が MIDI です。MIDI ソースにはバインドする PCM も更新するソースメタデータもありません。オーディオソースのディスクリプタには所有メタデータ `contentHash` と `externalStemRole` もあり、MIDI ソースでは空文字列です。`setAudioSourceMetadata(sourceId, contentHash, externalStemRole)` は両方の文字列を 1 つのアンドゥ可能な編集として置き換え、空文字列で個別にクリアできます。WASM はこの位置引数形式を使い、Node は第 2 引数に `{ contentHash, externalStemRole }` のオブジェクトも受け付けます。Python は `set_audio_source_metadata(source_id, content_hash, external_stem_role)`（C ABI は `sonare_project_set_audio_source_metadata`）です。Python には `unresolved_audio_source_ids()` があり、ソースディスクリプタの名前は `content_hash` と `external_stem_role` です。C の getter が返すヒープ文字列は対応する free 関数で解放します。

### ホスト側で分離したステムを取り込む

アプリ側ですでに音源分離を済ませている場合（あるいは単に楽器ごとの WAV がある場合）、`importExternalStems` はそれらを 1 トランザクションで、それぞれ 1 本のオーディオトラックとクリップに変換します。

```typescript
const { trackIds, clipIds } = project.importExternalStems({
  sampleRate: 48000,
  stems: [
    { name: 'vocals', layout: 'stereo', planarSamples: [vocalL, vocalR], startFrame: 0 },
    { name: 'drums',  layout: 'stereo', planarSamples: [drumL, drumR],   startFrame: 0 },
    { name: 'bass',   layout: 'mono',   planarSamples: [bassMono],       startFrame: 0, role: 'bass' },
  ],
});
```

取り込みは**全件成功か全件失敗**です。1 つでも拒否されればプロジェクトは中途半端に埋まらず、まったく変更されません。リサンプリング・タイミング調整・ゲイン補正は一切行いません。すべてのステムはあらかじめ `sampleRate` に揃っている必要があり、`startFrame` はそのままの値でプロジェクトのタイムライン上に配置されます。ステムごとの任意の `role` はホスト用メタデータで、シリアライザーを往復しますが DSP には影響しません。

## レンダリングへ進む

プロジェクトにタイムラインがあり、必要なオーディオソースをすべてバインドできたら、[プロジェクトのバウンス](./project-bounce.md)へ進みます。このページでは楽器のバインドやレンダーオプションの詳細を重複して説明しません。

## 関連

- [プロジェクト編集](./project-editing.md) — トラック、クリップ、テンポ、マーカー、ワープ、オートメーションを扱います
- [プロジェクト MIDI](./project-editing-midi.md) — 注釈、アシストサイドカー、自動テンポ、SMF の概要を扱います
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — MIDI 2.0 クリップファイルの忠実度を保つ交換を扱います
