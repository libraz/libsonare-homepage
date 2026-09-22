<script setup lang="ts">
/**
 * The body of whichever chapter is open: its prose, its comparison strips, and
 * the button that adopts a compared variant into the shared voice.
 *
 * A variant is the reader's own patch with only the chapter's fields
 * overridden, so what is compared is always their voice and never a stock one.
 * Auditioning a variant never writes the patch; adopting is a separate button,
 * so a reader can click across four filter models without losing the voice they
 * were shaping.
 *
 * Every number the prose states about the engine is a measurement made by
 * rendering and comparing samples on this build (a difference under 1e-7 is no
 * change). The copy is kept as one object keyed by chapter id so the English
 * and Japanese of a chapter sit side by side and drift is visible.
 *
 * This is the body of the chapter display in the lower deck. The display
 * strip above it already prints the chapter's number and name, so the body
 * begins with the prose.
 */
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { Chapter } from './classicSynthChapters';
import {
  BODY_NAMES,
  FILTER_MODEL_NAMES,
  FILTER_OUTPUT_NAMES,
  WAVEFORM_NAMES,
} from './classicSynthCopy';
import {
  BODIES,
  type BodyName,
  type ClassicPatch,
  detuneHasEffect,
  FILTER_MODELS,
  FILTER_OUTPUTS,
  type FilterModelName,
  type FilterOutputName,
  offersFilterOutput,
  phraseOf,
  WAVEFORMS,
  type WaveformName,
} from './classicSynthState';
import { type RenderStatus, renderKey } from './useClassicSynth';

const props = defineProps<{
  chapter: Chapter;
  patch: ClassicPatch;
  status: RenderStatus;
  playingKey: string | null;
}>();

const emit = defineEmits<{
  /** Adopt a suggestion into the shared voice. */
  apply: [change: Partial<ClassicPatch>];
  /** Play a variant without adopting it: a full patch plus a phrase id. */
  audition: [variant: ClassicPatch, phraseId: string];
  play: [];
  stop: [];
}>();

const { isLocale, localizedValue } = useI18n();
const ja = computed(() => isLocale('ja'));

/** One button of a comparison strip. */
interface Variant {
  id: string;
  name: string;
  note: string;
  /** The fields this variant overrides on the current patch. */
  change: Partial<ClassicPatch>;
  /** Why it cannot play on the patch as it stands, or null when it can. */
  blocked: string | null;
}

/** A row of variants that compare one axis, and the button that adopts one. */
interface Strip {
  id: string;
  title: string;
  variants: Variant[];
  /** False for a pure A/B whose variants are not settings to carry away. */
  adopt: boolean;
  /** Why this comparison will not tell the reader much where the panel sits. */
  hint?: string | null;
}

/** The four waveforms the first chapter compares; noise waits for the next. */
const PLAIN_WAVEFORMS: readonly WaveformName[] = ['sine', 'saw', 'square', 'triangle'];
/** The bodies that are a body; `none` is the reference the play button gives. */
const REAL_BODIES: readonly BodyName[] = BODIES.filter((body) => body !== 'none');
/** The mix every body variant plays at: where the strongest and weakest were measured. */
const BODY_AUDITION_MIX = 0.6;
/**
 * Above this cutoff the high-pass tap has so little left above it that the three
 * outputs differ in level rather than in character. Measured on a saw at C4: the
 * high-pass sits 2.9 dB under the low-pass at 6 kHz, 8.0 dB at 10 kHz and 16.7 dB
 * at the top of the range, where it reads as a dead button rather than a filter.
 */
const OUTPUT_COMPARISON_CEILING_HZ = 10_000;

const copy = computed(() =>
  localizedValue({
    en: {
      shared: {
        play: 'Play the voice',
        stop: 'Stop',
        playPrefix: 'Play',
        playing: 'playing now',
        inVoice: 'this is the voice as it stands',
        adopt: (name: string) => `Use ${name}`,
        adoptNone: 'Audition a variant, then adopt it here',
        rendering: 'Rendering…',
        failed: 'The render failed. Try the variant again.',
      },
      sound: {
        intro: [
          'A voice here is one oscillator, one filter, two envelopes and a body. The oscillator makes a raw waveform; the filter takes harmonics away from it; the amp envelope shapes how loud a note is over its length and the filter envelope how bright; the body puts what is left through a resonance. Everything on this page is one of those five being changed.',
          'Start with the waveform. The four below are the same note through the voice exactly as it stands on the deck, and only the waveform differs. Click one to hear it, another to compare, then adopt the one you want to carry on with.',
        ],
        aside:
          'The deck above is the voice. It stays there for the rest of the page: each chapter dims the sections it is not about, but what you hear and edit is always this one voice.',
        strip: 'The plain waveforms',
        notes: {
          sine: 'the fundamental alone, no harmonics',
          saw: 'every harmonic, the brightest of the four',
          square: 'odd harmonics only, hollow',
          triangle: 'odd harmonics falling away fast, soft',
        } as Partial<Record<WaveformName, string>>,
      },
      waveform: {
        intro: [
          'Five waveforms, each a different starting stock of harmonics for the filter to work on. Sine is the fundamental alone, so the filter has nothing to remove. Saw has every harmonic and shows a filter best. Square has only the odd ones and rings hollow. Triangle has the odd ones falling away fast, so it stays soft even with the filter open.',
          'Noise is a waveform here, not a separate generator. The filter and both envelopes act on it exactly as they act on the other four: a filter sweep over noise is the same control doing the same job, and a plucked amp envelope on noise is a hit.',
        ],
        strip: 'The five waveforms',
        notes: {
          sine: 'for clean bass and pure tones',
          saw: 'for brass, strings, anything the filter will carve',
          square: 'for hollow leads and woody bass',
          triangle: 'for soft flutes and mellow keys',
          noise: 'for breath, hits and wind',
        } as Record<WaveformName, string>,
      },
      filter: {
        intro: [
          'Four filter models, one cutoff, one resonance. The names describe topologies, not machines: a state-variable filter, two ladders of different construction, and a Sallen-Key stage. Which one is in the voice decides what the same cutoff and the same resonance sound like.',
          'That the four differ is a measurement on this build, not a claim. At 1200 Hz and resonance 4 the pairwise maximum sample difference runs from 3.99e-2 to 2.07e-1, and across cutoffs of 200, 600, 1200, 3000 and 8000 Hz at resonances of 0.707, 2, 6 and 12 no pair ever converges. The closest two anywhere are the two ladders, at 2.93e-2 — far above the 1e-7 that would mean no change.',
          'The output mode belongs to the state-variable model alone. Low-, band- and high-pass are its three taps; the other three models render bit-identical to their own lowpass whatever the output is set to, so the second row below only comes alive with the state-variable filter in the voice.',
        ],
        aside:
          'The comparison runs at the cutoff and resonance the panel shows. The measurement was made at 1200 Hz and resonance 4; the button below puts the voice there.',
        setup: 'Set the measured point: 1200 Hz, resonance 4',
        cutoffTooHigh:
          'With the cutoff this high the high-pass tap has almost nothing left above it — measured on this build, it sits 8 dB under the low-pass at 10 kHz and 17 dB under it at the top of the range, so the three below will differ in level rather than in character. Set the measured point above first.',
        models: 'The four models',
        outputs: 'The three outputs',
        modelNotes: {
          svf: 'the only model with a choice of output',
          'moog-ladder': 'a ladder; renders its lowpass whatever the output',
          'diode-ladder': 'a ladder; closest to the transistor ladder, at 2.93e-2',
          'sallen-key': 'renders its lowpass whatever the output',
        } as Record<FilterModelName, string>,
        outputNotes: {
          lowpass: 'keeps what lies below the cutoff',
          bandpass: 'keeps what lies around the cutoff',
          highpass: 'keeps what lies above the cutoff',
        } as Record<FilterOutputName, string>,
        blocked: (model: string) =>
          `Only the state-variable model has this output. With the ${model} in the voice it renders its lowpass regardless; choose State variable above first.`,
      },
      envelope: {
        intro: [
          'Two envelopes, and they are separate. The amp envelope shapes loudness over a note: attack, decay, sustain, release. The filter envelope has the same four stages but shapes brightness — it moves the cutoff, by up to the envelope amount.',
          'That amount is the whole link between the two. Measured on this build: with the envelope amount at zero the filter envelope does nothing at all, whatever its stages are set to. It scales the amount, and with nothing to scale it is silent. The last two variants below have identical filter envelopes and differ only in the amount.',
          'The phrase is four short notes. A shape is heard at the edges of a note, not in its middle.',
        ],
        aside:
          'The sweep climbs from the cutoff on the panel by the envelope amount, so it wants a cutoff low enough to leave room above it. The button below starts the voice from 500 Hz.',
        setup: 'Start from 500 Hz',
        strip: 'Four shapes',
        names: {
          pluck: 'Pluck',
          swell: 'Swell',
          sweep: 'Filter sweep',
          'sweep-zero': 'Sweep, amount 0',
        },
        notes: {
          pluck: 'attack 1 ms, sustain 0, release 120 ms',
          swell: 'attack 250 ms, sustain 1, release 900 ms',
          sweep: 'envelope amount +3600 ¢; attack 2 ms, decay 260 ms, sustain 0',
          'sweep-zero': 'the same filter envelope with the amount at 0: nothing moves',
        },
      },
      body: {
        intro: [
          'A body is a resonance the voice is played through: six of them counting none, with one mix control. Guitar, violin, wood tube, brass bell and vocal each colour the voice their own way, and the mix decides how much of that colour is heard.',
          'The mix is a true gate, measured on this build. At 0 every body type renders bit-identical to no body, so a body left selected at mix 0 is not faintly there — it is absent. From 0 to 1 the body’s share rises monotonically and close to linearly.',
          'The bodies are not equally loud. At mix 0.6 the wood tube is the strongest, about 0.19 RMS relative to the dry voice; the brass bell is the faintest at about 0.017. The five below all play at mix 0.6, so what differs between them is the body alone.',
        ],
        aside:
          'The play button plays the voice as it is on the panel. With Body at None, that is the dry reference every body here is measured against.',
        strip: 'The five bodies at mix 0.6',
        notes: {
          guitar: 'mix 0.60',
          violin: 'mix 0.60',
          'wood-tube': 'the strongest: about 0.19 RMS against the dry voice',
          'brass-bell': 'the faintest: about 0.017 RMS against the dry voice',
          vocal: 'mix 0.60',
        } as Partial<Record<BodyName, string>>,
      },
      thickness: {
        intro: [
          'Thickness is more than one voice per note, and width is where those voices sit. Unison stacks copies of the oscillator; detune spreads the stack apart in pitch; drift lets each voice wander on its own; width places the result across the stereo field.',
          'One dependency matters, and it is measured: detune does nothing whatsoever at unison 1. Every detune value renders bit-identical, because detune spreads a stack and there is one voice in it. Drift is per voice and does act at unison 1. Unison steps differ from each other even with detune at zero, and width acts on a single voice and scales linearly.',
          'The phrase is a chord across three octaves. Width and drift are heard between notes as much as within one.',
        ],
        dead: 'On the voice as it stands, Unison is 1, so Detune is a dead control: every value renders the same. Give it a stack first.',
        alive: (unison: number) =>
          `On the voice as it stands, Unison is ${unison}, so Detune spreads ${unison} voices.`,
        strip: 'One voice, a stack, and the difference between them',
        names: {
          single: 'Single voice',
          'single-detuned': 'Detune on a single voice',
          drift: 'Drifting single voice',
          stack: 'Detuned stack',
          wide: 'Wide stack',
        },
        notes: {
          single: 'unison 1, detune 0, drift 0, width 0',
          'single-detuned': 'unison 1, detune 18 ¢: identical to the single voice, measured',
          drift: 'unison 1, drift 12 ¢',
          stack: 'unison 4, detune 18 ¢',
          wide: 'unison 4, detune 18 ¢, width 1',
        },
      },
      modulation: {
        intro: [
          'Every source down the left is a signal that moves while a note sounds; every destination along the top is a field of the voice it can push. A cell is one routing: this source, into that destination, by this much. The matrix holds eight at once, and the voice comes with some wiring of its own — the mod wheel, expression and pitch bend all do something with the grid empty. Breath and aftertouch do not. They reach nothing until a routing gives them somewhere to go, which is the plainest case for the matrix existing.',
          'Depth is in the destination’s own units, not a normalized percentage, so the ranges differ by orders of magnitude: pitch in cents, level as a gain multiplier that stops changing past about 3, pan on a scale where a hard pan takes about 1000. Each slider below carries the range its destination was measured to be useful over. The random source is seeded, so a render repeats exactly — which is why every comparison on this page is the same render or a different one, never merely close.',
          'All 96 cells here move the sound; each was measured on the same phrase with every gesture source deflecting. Two destinations depend on something else being set first — a filter-envelope amount, an audible LFO 1 — and while it is not, the column says so and offers the fix. A routing into it can still be made; it is just honest about being silent.',
        ],
        aside:
          'The engine names twelve destinations; this voice reaches eight. excitation-force, excitation-position and excitation-brightness reach a physical model’s exciter, and spectrum-morph travels between two spectral tables. The subtractive voice has neither, and every routing into them — all 48 — renders bit-identical to no routing at all, so they are not drawn.',
        strip: 'Hear the matrix switched off',
        names: {
          with: 'As it stands',
          without: 'Matrix off',
        },
        notes: {
          with: 'Every routing in the grid, on the gesture phrase.',
          without: 'The same voice with no routings. Nothing else changes.',
        },
      },
    },
    ja: {
      shared: {
        play: 'ボイスを再生',
        stop: '停止',
        playPrefix: '再生：',
        playing: '再生中',
        inVoice: 'いまのボイスの設定',
        adopt: (name: string) => `${name} を採用`,
        adoptNone: '聴いてから、ここで採用する',
        rendering: 'レンダリング中…',
        failed: 'レンダーに失敗した。もう一度押す。',
      },
      sound: {
        intro: [
          'ここでのボイスは、オシレータ 1 つ、フィルタ 1 つ、エンベロープ 2 つ、それにボディでできている。オシレータが生の波形を出し、フィルタがそこから倍音を削り、アンプエンベロープが 1 音のなかの音量の変化を、フィルタエンベロープが明るさの変化を決め、ボディは残った音を共鳴体に通す。このページで起きることはすべて、この 5 つのどれかを変える操作だ。',
          'まず波形から。下の 4 つは、デッキにあるボイスそのままで同じ音を鳴らしたもので、違うのは波形だけ。1 つ押して聴き、別のものを押して比べ、続けたいものをボイスに採用する。',
        ],
        aside:
          '上に広がるデッキがボイスそのものだ。このページの最後までそこに居続ける。章が変わるとその章に関係ないセクションは薄くなるが、聴いているのも編集しているのも常にこの 1 つのボイスだ。',
        strip: '基本の波形',
        notes: {
          sine: '基音だけ。倍音なし',
          saw: '全倍音。4 つのうち最も明るい',
          square: '奇数次倍音のみ。中空な響き',
          triangle: '奇数次倍音が急に減衰。柔らかい',
        } as Partial<Record<WaveformName, string>>,
      },
      waveform: {
        intro: [
          '波形は 5 種類。それぞれが、フィルタに渡す倍音の初期在庫にあたる。正弦波は基音だけなので、フィルタには削るものがない。のこぎり波は全倍音を含み、フィルタの効きが最もよくわかる。矩形波は奇数次倍音だけで中空に響く。三角波も奇数次だが急に減衰するので、フィルタを開けたままでも柔らかい。',
          'ノイズはここでは波形のひとつで、別のジェネレータではない。フィルタも 2 つのエンベロープも、他の 4 波形とまったく同じようにノイズに作用する。ノイズへのフィルタスイープは同じ制御の同じ仕事であり、プラック型のアンプエンベロープをかければ打撃音になる。',
        ],
        strip: '5 つの波形',
        notes: {
          sine: 'クリーンなベース、純音に',
          saw: 'ブラス、ストリングス、フィルタで削る音全般に',
          square: '中空なリード、木質のベースに',
          triangle: '柔らかいフルート、穏やかな鍵盤音に',
          noise: '息、打撃、風に',
        } as Record<WaveformName, string>,
      },
      filter: {
        intro: [
          'フィルタモデルは 4 つ。カットオフもレゾナンスも同じ値で比べる。名前が指すのは機械ではなくトポロジーで、ステートバリアブル、構造の異なる 2 種のラダー、それにザレンキー段。ボイスにどれが入っているかで、同じカットオフと同じレゾナンスの鳴り方が決まる。',
          '4 つが別物であることは、このビルドでの測定であって主張ではない。カットオフ 1200 Hz・レゾナンス 4 で、任意の 2 モデル間のサンプル差の最大値は 3.99e-2 から 2.07e-1。カットオフ 200・600・1200・3000・8000 Hz とレゾナンス 0.707・2・6・12 の全組み合わせを掃引しても、収束する組は 1 つもない。全域で最も近いのは 2 つのラダーで 2.93e-2。変化なしを意味する 1e-7 からは遠い。',
          '出力モードはステートバリアブル専用だ。ローパス・バンドパス・ハイパスはこのモデルの 3 つのタップで、他の 3 モデルは出力を何に設定しても自身のローパスとビット単位で同一のレンダーを返す。下の 2 段目が生きるのは、ボイスにステートバリアブルが入っているときだけになる。',
        ],
        aside:
          '比較はパネルに表示されているカットオフとレゾナンスで行う。測定は 1200 Hz・レゾナンス 4 で行ったもので、下のボタンでボイスをその点に置ける。',
        setup: '測定点に置く：1200 Hz、レゾナンス 4',
        cutoffTooHigh:
          'カットオフがここまで高いと、ハイパスのタップに残るものがほとんどない。このビルドでの実測で、ローパスに対して 10 kHz で 8 dB、レンジ上端では 17 dB 下。下の 3 つは音色ではなく音量の差になる。先に上の測定点に置くとよい。',
        models: '4 つのモデル',
        outputs: '3 つの出力',
        modelNotes: {
          svf: '出力を選べる唯一のモデル',
          'moog-ladder': 'ラダー構造。出力の設定にかかわらず自身のローパスを返す',
          'diode-ladder': 'ラダー構造。トランジスタラダーに最も近く、差は 2.93e-2',
          'sallen-key': '出力の設定にかかわらず自身のローパスを返す',
        } as Record<FilterModelName, string>,
        outputNotes: {
          lowpass: 'カットオフより下を残す',
          bandpass: 'カットオフ周辺を残す',
          highpass: 'カットオフより上を残す',
        } as Record<FilterOutputName, string>,
        blocked: (model: string) =>
          `この出力を持つのはステートバリアブルだけだ。${model} は設定にかかわらず自身のローパスをレンダーする。先に上でステートバリアブルを選ぶ。`,
      },
      envelope: {
        intro: [
          'エンベロープは 2 つあり、互いに独立している。アンプエンベロープは 1 音のなかの音量を、アタック・ディケイ・サステイン・リリースの 4 段で形づくる。フィルタエンベロープも同じ 4 段を持つが、こちらが動かすのは明るさで、カットオフをエンベロープ量の分まで動かす。',
          'その量が、2 つをつなぐ唯一の接点だ。このビルドでの測定では、エンベロープ量が 0 のときフィルタエンベロープは各段の設定にかかわらず何もしない。エンベロープは量をスケールするものなので、スケールする対象がなければ無音のままになる。下の最後の 2 つはフィルタエンベロープの形が同一で、違うのは量だけだ。',
          'フレーズは短い 4 音。形は音の中ほどではなく、立ち上がりと消え際に聞こえる。',
        ],
        aside:
          'スイープはパネルのカットオフからエンベロープ量の分だけ上へ登るので、上に余地のある低いカットオフでこそ聞こえる。下のボタンでボイスを 500 Hz から始められる。',
        setup: '500 Hz から始める',
        strip: '4 つの形',
        names: {
          pluck: 'プラック',
          swell: 'スウェル',
          sweep: 'フィルタスイープ',
          'sweep-zero': 'スイープ、量 0',
        },
        notes: {
          pluck: 'アタック 1 ms、サステイン 0、リリース 120 ms',
          swell: 'アタック 250 ms、サステイン 1、リリース 900 ms',
          sweep: 'エンベロープ量 +3600 ¢。アタック 2 ms、ディケイ 260 ms、サステイン 0',
          'sweep-zero': '同じフィルタエンベロープで量だけ 0。何も動かない',
        },
      },
      body: {
        intro: [
          'ボディはボイスを通す共鳴体で、なしを含めて 6 種類、制御はミックス 1 つ。ギター、バイオリン、木管、金管ベル、声のそれぞれがボイスに固有の色をつけ、その色をどれだけ聞かせるかをミックスが決める。',
          'ミックスは本物のゲートで、これはこのビルドでの測定だ。0 では全ボディタイプがボディなしとビット単位で同一にレンダーされるので、ボディを選んだままミックスを 0 にしたとき、ボディはかすかに残るのではなく存在しない。0 から 1 へはボディの割合が単調に、ほぼ直線的に増える。',
          'ボディの音量は揃っていない。ミックス 0.6 で最も強いのは木管で、ドライなボイスに対して約 0.19 RMS。最も弱いのは金管ベルで約 0.017。下の 5 つはすべてミックス 0.6 で鳴るので、差はボディそのものだけだ。',
        ],
        aside:
          '再生ボタンはパネルのボイスをそのまま鳴らす。ボディがなしなら、それが各ボディの比較基準になるドライ音だ。',
        strip: 'ミックス 0.6 での 5 つのボディ',
        notes: {
          guitar: 'ミックス 0.60',
          violin: 'ミックス 0.60',
          'wood-tube': '最も強い。ドライに対して約 0.19 RMS',
          'brass-bell': '最も弱い。ドライに対して約 0.017 RMS',
          vocal: 'ミックス 0.60',
        } as Partial<Record<BodyName, string>>,
      },
      thickness: {
        intro: [
          '厚みとは 1 音あたりのボイスが 1 つより多いことで、広がりとはそれらをどこに置くかだ。ユニゾンはオシレータの複製を積み、デチューンはそのスタックをピッチ方向に開き、ドリフトは各ボイスを個別にゆらし、広がりは結果をステレオ空間に配置する。',
          '依存関係が 1 つあり、これは測定済みだ。ユニゾン 1 のときデチューンは一切何もしない。どの値でもビット単位で同一にレンダーされる。デチューンが開くのはスタックであり、そこにボイスが 1 つしかないからだ。ドリフトはボイスごとに働くので、ユニゾン 1 でも効く。ユニゾンの各段はデチューン 0 でも互いに異なり、広がりは単一ボイスにも効いて直線的にスケールする。',
          'フレーズは 3 オクターブにわたるコード。広がりとドリフトは、1 音のなかと同じくらい音と音のあいだに聞こえる。',
        ],
        dead: 'いまのボイスはユニゾン 1 なので、デチューンは死んだ制御だ。どの値も同じ音になる。先にスタックを作る。',
        alive: (unison: number) =>
          `いまのボイスはユニゾン ${unison} なので、デチューンは ${unison} ボイスを開く。`,
        strip: '単一ボイスとスタック、その差',
        names: {
          single: '単一ボイス',
          'single-detuned': '単一ボイスにデチューン',
          drift: 'ドリフトする単一ボイス',
          stack: 'デチューンしたスタック',
          wide: '広いスタック',
        },
        notes: {
          single: 'ユニゾン 1、デチューン 0、ドリフト 0、広がり 0',
          'single-detuned': 'ユニゾン 1、デチューン 18 ¢。単一ボイスと同一、測定済み',
          drift: 'ユニゾン 1、ドリフト 12 ¢',
          stack: 'ユニゾン 4、デチューン 18 ¢',
          wide: 'ユニゾン 4、デチューン 18 ¢、広がり 1',
        },
      },
      modulation: {
        intro: [
          '左に並ぶソースは、ノートが鳴っているあいだに動く信号。上に並ぶデスティネーションは、その信号で押せるボイスのパラメータです。セル 1 つが結線 1 本で、「このソースを、このデスティネーションへ、この深さで」を表します。同時に持てるのは 8 本まで。ボイスには最初から配線されているものもあり、モジュレーションホイール、エクスプレッション、ピッチベンドは行列が空でも効きます。ブレスとアフタータッチは違います。結線してやるまでどこにも届かないので、この行列がある理由はまずここにあります。',
          '深さはデスティネーション自身の単位で、正規化された割合ではありません。だからレンジは桁違いに開きます。ピッチはセント、レベルは 3 前後で変化が止まるゲイン倍率、パンはハードパンに 1000 前後が要る目盛りです。下のスライダーには、それぞれのデスティネーションで実測した有効レンジをそのまま載せています。ランダムソースはシードが固定なので、レンダリングは毎回同じ波形になります。このページの比較がすべて「近い」ではなく「同一か違うか」で語れるのはそのためです。',
          'ここにある 96 のセルはどれも音を変えます。ジェスチャーソースをすべて動かした同じフレーズで、1 つずつ確かめました。2 つのデスティネーションは別の設定が先に必要で、フィルタエンベロープ量と、聴こえる LFO 1 です。満たされていないときは列がそう告げて、直すボタンを出します。そこへの結線は作れます。ただ、無音であることを隠しません。',
        ],
        aside:
          'エンジンが名前を持つデスティネーションは 12 ありますが、このボイスから届くのは 8 つです。excitation-force、excitation-position、excitation-brightness は物理モデルの励振部へ、spectrum-morph は 2 枚のスペクトルテーブルの間を移動します。減算ボイスにはどちらもなく、そこへ向かう 48 通りの結線はすべて、結線なしとビット単位で同一にレンダリングされます。だから描いていません。',
        strip: '行列を切って聴く',
        names: {
          with: 'この結線で',
          without: '行列を空にして',
        },
        notes: {
          with: '行列の結線をすべて生かして、ジェスチャーフレーズを鳴らします。',
          without: '同じボイスから結線だけを外したもの。ほかは何も変わりません。',
        },
      },
    },
  }),
);

function label(entry: { en: string; ja: string }): string {
  return ja.value ? entry.ja : entry.en;
}

function waveformVariants(
  list: readonly WaveformName[],
  notes: Partial<Record<WaveformName, string>>,
) {
  return list.map<Variant>((waveform) => ({
    id: waveform,
    name: label(WAVEFORM_NAMES[waveform]),
    note: notes[waveform] ?? '',
    change: { waveform },
    blocked: null,
  }));
}

/** The prose of the open chapter, in paragraphs. */
const intro = computed<string[]>(() => {
  const c = copy.value;
  switch (props.chapter.id) {
    case 'sound':
      return c.sound.intro;
    case 'waveform':
      return c.waveform.intro;
    case 'filter':
      return c.filter.intro;
    case 'envelope':
      return c.envelope.intro;
    case 'body':
      return c.body.intro;
    case 'thickness':
      return c.thickness.intro;
    case 'modulation':
      return c.modulation.intro;
    default:
      return [];
  }
});

/** The chapter's aside; thickness reads the live patch so a dead Detune is named as such. */
const aside = computed<string | null>(() => {
  const c = copy.value;
  switch (props.chapter.id) {
    case 'sound':
      return c.sound.aside;
    case 'filter':
      return c.filter.aside;
    case 'envelope':
      return c.envelope.aside;
    case 'body':
      return c.body.aside;
    case 'thickness':
      return detuneHasEffect(props.patch)
        ? c.thickness.alive(props.patch.unison)
        : c.thickness.dead;
    case 'modulation':
      return c.modulation.aside;
    default:
      return null;
  }
});

/** A chapter's one-off change to the voice that sets up its comparison. */
const setup = computed<{ label: string; change: Partial<ClassicPatch> } | null>(() => {
  const c = copy.value;
  switch (props.chapter.id) {
    case 'filter':
      return { label: c.filter.setup, change: { cutoffHz: 1200, resonanceQ: 4 } };
    case 'envelope':
      return { label: c.envelope.setup, change: { cutoffHz: 500 } };
    default:
      return null;
  }
});

const strips = computed<Strip[]>(() => {
  const c = copy.value;
  switch (props.chapter.id) {
    case 'sound':
      return [
        {
          id: 'waveform',
          title: c.sound.strip,
          variants: waveformVariants(PLAIN_WAVEFORMS, c.sound.notes),
          adopt: true,
        },
      ];
    case 'waveform':
      return [
        {
          id: 'waveform',
          title: c.waveform.strip,
          variants: waveformVariants(WAVEFORMS, c.waveform.notes),
          adopt: true,
        },
      ];
    case 'filter': {
      const outputOffered = offersFilterOutput(props.patch.filterModel);
      const blocked = outputOffered
        ? null
        : c.filter.blocked(label(FILTER_MODEL_NAMES[props.patch.filterModel]));
      return [
        {
          id: 'model',
          title: c.filter.models,
          variants: FILTER_MODELS.map<Variant>((filterModel) => ({
            id: filterModel,
            name: label(FILTER_MODEL_NAMES[filterModel]),
            note: c.filter.modelNotes[filterModel],
            change: { filterModel },
            blocked: null,
          })),
          adopt: true,
        },
        {
          id: 'output',
          title: c.filter.outputs,
          variants: FILTER_OUTPUTS.map<Variant>((filterOutput) => ({
            id: filterOutput,
            name: label(FILTER_OUTPUT_NAMES[filterOutput]),
            note: c.filter.outputNotes[filterOutput],
            change: { filterOutput },
            blocked,
          })),
          adopt: true,
          hint:
            outputOffered && props.patch.cutoffHz >= OUTPUT_COMPARISON_CEILING_HZ
              ? c.filter.cutoffTooHigh
              : null,
        },
      ];
    }
    case 'envelope': {
      const sweep: Partial<ClassicPatch> = {
        filterAttackMs: 2,
        filterDecayMs: 260,
        filterSustain: 0,
        filterReleaseMs: 200,
      };
      const changes: Record<keyof typeof c.envelope.names, Partial<ClassicPatch>> = {
        pluck: { ampAttackMs: 1, ampDecayMs: 180, ampSustain: 0, ampReleaseMs: 120 },
        swell: { ampAttackMs: 250, ampDecayMs: 400, ampSustain: 1, ampReleaseMs: 900 },
        sweep: { ...sweep, envToCutoffCents: 3600 },
        'sweep-zero': { ...sweep, envToCutoffCents: 0 },
      };
      return [
        {
          id: 'shape',
          title: c.envelope.strip,
          variants: (Object.keys(changes) as (keyof typeof changes)[]).map<Variant>((id) => ({
            id,
            name: c.envelope.names[id],
            note: c.envelope.notes[id],
            change: changes[id],
            blocked: null,
          })),
          adopt: true,
        },
      ];
    }
    case 'body':
      return [
        {
          id: 'body',
          title: c.body.strip,
          variants: REAL_BODIES.map<Variant>((body) => ({
            id: body,
            name: label(BODY_NAMES[body]),
            note: c.body.notes[body] ?? '',
            change: { body, bodyMix: BODY_AUDITION_MIX },
            blocked: null,
          })),
          adopt: true,
        },
      ];
    case 'thickness': {
      const changes: Record<keyof typeof c.thickness.names, Partial<ClassicPatch>> = {
        single: { unison: 1, detuneCents: 0, driftCents: 0, stereoSpread: 0 },
        'single-detuned': { unison: 1, detuneCents: 18, driftCents: 0, stereoSpread: 0 },
        drift: { unison: 1, detuneCents: 0, driftCents: 12, stereoSpread: 0 },
        stack: { unison: 4, detuneCents: 18, driftCents: 0, stereoSpread: 0 },
        wide: { unison: 4, detuneCents: 18, driftCents: 0, stereoSpread: 1 },
      };
      return [
        {
          id: 'stack',
          title: c.thickness.strip,
          variants: (Object.keys(changes) as (keyof typeof changes)[]).map<Variant>((id) => ({
            id,
            name: c.thickness.names[id],
            note: c.thickness.notes[id],
            change: changes[id],
            blocked: null,
          })),
          adopt: true,
        },
      ];
    }
    case 'modulation':
      // A pure A/B: the voice with its routings, and the same voice with none.
      return [
        {
          id: 'matrix',
          title: c.modulation.strip,
          variants: [
            {
              id: 'with',
              name: c.modulation.names.with,
              note: c.modulation.notes.with,
              change: {},
              blocked: null,
            },
            {
              id: 'without',
              name: c.modulation.names.without,
              note: c.modulation.notes.without,
              change: { modRoutings: [] },
              blocked: null,
            },
          ],
          adopt: false,
        },
      ];
    default:
      return [];
  }
});

const phrase = computed(() => phraseOf(props.chapter.phraseId));

/** The current patch with a variant's fields laid over it, as a plain object. */
function variantPatch(variant: Variant): ClassicPatch {
  const routings = variant.change.modRoutings ?? props.patch.modRoutings;
  return {
    ...props.patch,
    ...variant.change,
    modRoutings: routings.map((routing) => ({ ...routing })),
  };
}

/** True when the voice already has every field this variant would set. */
function isInVoice(variant: Variant): boolean {
  return (Object.keys(variant.change) as (keyof ClassicPatch)[]).every((key) => {
    if (key === 'modRoutings') {
      return JSON.stringify(props.patch.modRoutings) === JSON.stringify(variant.change.modRoutings);
    }
    return props.patch[key] === variant.change[key];
  });
}

function isPlaying(variant: Variant): boolean {
  return (
    props.playingKey !== null && props.playingKey === renderKey(variantPatch(variant), phrase.value)
  );
}

/** Last-auditioned variant per strip, so the adopt button knows which one. */
const chosen = ref<Record<string, string>>({});

function audition(strip: Strip, variant: Variant) {
  if (variant.blocked) return;
  chosen.value = { ...chosen.value, [strip.id]: variant.id };
  emit('audition', variantPatch(variant), props.chapter.phraseId);
}

function chosenOf(strip: Strip): Variant | null {
  const id = chosen.value[strip.id];
  return strip.variants.find((variant) => variant.id === id) ?? null;
}

/** Adopting is offered once something has been heard that the voice does not already have. */
function canAdopt(strip: Strip): boolean {
  const variant = chosenOf(strip);
  return variant !== null && !variant.blocked && !isInVoice(variant);
}

function adoptLabel(strip: Strip): string {
  const variant = chosenOf(strip);
  return variant ? copy.value.shared.adopt(variant.name) : copy.value.shared.adoptNone;
}

function adopt(strip: Strip) {
  const variant = chosenOf(strip);
  if (variant && !variant.blocked) emit('apply', variant.change);
}

function reasonId(strip: Strip, variant: Variant): string {
  return `cs-chapter-${props.chapter.id}-${strip.id}-${variant.id}-note`;
}
</script>

<template>
  <div class="chapter">
    <article class="cs-card">
      <p v-for="(paragraph, index) in intro" :key="index" class="cs-card__prose">{{ paragraph }}</p>
      <p v-if="aside" class="cs-card__aside">{{ aside }}</p>
    </article>

    <section v-for="strip in strips" :key="strip.id" class="cs-card" :aria-label="strip.title">
      <h3 class="cs-card__label">{{ strip.title }}</h3>
      <p v-if="strip.hint" class="cs-card__hint">{{ strip.hint }}</p>
      <div class="cs-variants">
        <button
          v-for="variant in strip.variants"
          :key="variant.id"
          type="button"
          class="cs-variant"
          :class="{
            'cs-variant--on': isInVoice(variant),
            'cs-variant--playing': isPlaying(variant),
          }"
          :aria-disabled="variant.blocked ? 'true' : undefined"
          :aria-describedby="reasonId(strip, variant)"
          @click="audition(strip, variant)"
        >
          <span class="cs-variant__lamp" aria-hidden="true" />
          <span class="cs-variant__name">
            <span class="chapter__sr">{{ copy.shared.playPrefix }} </span>
            <span>{{ variant.name }}</span>
            <span v-if="isPlaying(variant)" class="chapter__sr">, {{ copy.shared.playing }}</span>
            <span v-else-if="isInVoice(variant)" class="chapter__sr">, {{ copy.shared.inVoice }}</span>
          </span>
          <span
            :id="reasonId(strip, variant)"
            class="cs-variant__note"
            :class="{ 'chapter__note--blocked': variant.blocked }"
          >
            {{ variant.blocked ?? variant.note }}
          </span>
        </button>
      </div>
      <div v-if="strip.adopt" class="cs-actions">
        <button
          type="button"
          class="cs-button cs-button--primary"
          :disabled="!canAdopt(strip)"
          @click="adopt(strip)"
        >
          {{ adoptLabel(strip) }}
        </button>
      </div>
    </section>

    <!-- Play and Stop live once, on the deck's own transport. -->
    <div class="cs-actions chapter__transport">
      <button v-if="setup" type="button" class="cs-button" @click="emit('apply', setup.change)">
        {{ setup.label }}
      </button>
      <span class="chapter__status" role="status" aria-live="polite">
        <template v-if="props.status === 'rendering'">{{ copy.shared.rendering }}</template>
        <template v-else-if="props.status === 'error'">{{ copy.shared.failed }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.chapter {
  min-inline-size: 0;
}

.chapter__note--blocked {
  color: var(--plate-key-ink-dim);
}

/* A blocked variant stays focusable so its reason can be reached; it only looks disabled. */
.cs-variant[aria-disabled='true'] {
  opacity: var(--demo-disabled-opacity, 0.45);
  cursor: not-allowed;
}

.cs-variant[aria-disabled='true']:hover {
  background: var(--plate-key);
}

.chapter__transport {
  align-items: center;
}

/* Reserves a line so the status appearing does not move the buttons. */
.chapter__status {
  flex: 1 1 auto;
  min-block-size: 1.2em;
  color: var(--plate-ink-dim);
  font-size: 0.74rem;
  text-align: end;
}

.chapter__sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
