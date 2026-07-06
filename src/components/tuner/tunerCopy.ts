/**
 * en/ja copy for the physical-model tuner page, consumed through
 * `localizedValue({ en: enCopy, ja: jaCopy })`. The `ja` object is typed
 * against `enCopy` so the two locales stay structurally identical (the
 * `yarn check:i18n` gate depends on that parity).
 */

/** Body-resonator option labels, keyed by `BodyType`. */
export const enCopy = {
  title: 'Physical Model Tuner',
  subtitle: "Tune libsonare's physical-model engines live, then export the patch",
  localOnly: 'LOCAL ONLY',
  status: {
    idle: 'Idle',
    starting: 'Starting',
    armed: 'Ready',
    ready: 'Playing',
    error: 'Error',
  },
  deck: {
    model: 'PM-9',
    tagline: 'PHYSICAL MODEL VOICE TUNER',
  },
  sections: {
    engine: 'Exciter model',
    chain: 'Signal chain',
    body: 'Resonator body',
    amp: 'Amp envelope',
    params: 'Model parameters',
    compare: 'A / B compare',
    oracle: 'Reference sound',
    keys: 'Keybed',
    patch: 'Patch',
    midi: 'MIDI phrase',
    score: 'Score',
    target: 'Contribution target',
  },
  target: {
    subtitle: 'Pick the GM/GS voice this patch fills in',
    enable: 'Target a GM/GS slot',
    disabled: 'No target — free tuning. Turn on to voice a specific GM/GS slot.',
    type: 'Target type',
    standard: 'Standard',
    modeMelodic: 'Melodic',
    modeDrum: 'Drums',
    program: 'GM program',
    drum: 'GM drum note',
    variation: 'GS variation (CC0)',
    drumKit: 'GS drum kit',
    slot: 'Slot',
    suggested: 'Suggested engine',
    use: 'Use',
    hearCurrent: 'Hear current built-in voice',
    optionOutOfScope: 'not tunable here',
    outOfScope: 'Voiced by the {engine} engine — physical-model tuning n/a here.',
    hint: 'This tags your patch for one GM/GS slot and sets the A/B "original" to libsonare\'s current built-in fallback voice for it — so you tune against today\'s sound. A shared patch may be folded into that slot of the GM fallback bank.',
    gsNote:
      'GS bank / kit records the exact slot address; the A/B still renders the closest built-in GM voice.',
  },
  chain: {
    exciter: 'Exciter',
    body: 'Body',
    amp: 'Amp',
    out: 'Out',
    bodyMix: 'Body mix',
    drive: 'Drive',
    gain: 'Gain',
  },
  amp: {
    attack: 'Attack',
    decay: 'Decay',
    sustain: 'Sustain',
    release: 'Release',
  },
  bodies: {
    none: 'None',
    guitar: 'Guitar',
    violin: 'Violin',
    'wood-tube': 'Wood tube',
    'brass-bell': 'Brass bell',
    vocal: 'Vocal',
  },
  compare: {
    original: 'Original',
    adjusted: 'Adjusted',
    oracle: 'Reference',
    delta: 'Δ',
    rmsError: 'RMS error',
    specSim: 'Spectral match',
    auditionOriginal: 'Hear original',
    auditionAdjusted: 'Hear adjusted',
    auditionOracle: 'Hear reference',
    against: 'Error vs',
    rendering: 'Rendering…',
    hint: 'The original is the libsonare core rendering this engine at its baseline. Tune the parameters and watch the adjusted trace diverge.',
    empty: 'Play a note or press Compare to render the traces.',
    compare: 'Compare',
  },
  oracle: {
    import: 'Import WAV',
    clear: 'Clear',
    loaded: 'Reference loaded',
    none: 'No reference loaded',
    hint: 'Import a reference WAV (e.g. a real instrument, or a phrase rendered elsewhere) and tune to minimize the error against it.',
    decodeError: 'Could not decode that audio file.',
  },
  autofit: {
    importOracle: 'Import reference (WAV / MIDI)',
    oracleNote: 'Reference note',
    hint: 'Import a reference sound (WAV) and, optionally, its note as a one-note MIDI file — then auto-fit searches the core parameters to approximate it. The result is a starting point for the slot, not a finished voice.',
    fit: 'Auto-fit to reference',
    running: 'Fitting…',
    cancel: 'Cancel',
    keep: 'Keep',
    revert: 'Revert',
    poorMatch:
      'This model may not reach that sound — try the target’s suggested engine, or tune by ear from here.',
    tooShort: 'That reference is too short or too quiet to fit against.',
  },
  midi: {
    connect: 'Connect MIDI device',
    connecting: 'Connecting…',
    connected: 'Listening',
    unavailable:
      'Web MIDI is not available in this browser. Chrome and Edge support USB MIDI keyboards.',
    record: 'Record',
    stop: 'Stop',
    clear: 'Clear',
    exportSmf: 'Export MIDI',
    importSmf: 'Import MIDI',
    play: 'Play phrase',
    empty: 'No phrase recorded yet. Record from the keys or import a MIDI file.',
    count: 'notes',
  },
  patch: {
    export: 'Export JSON',
    import: 'Import JSON',
    reset: 'Reset engine',
    share: 'Share via GitHub issue',
    importError: 'That file is not a valid tuner patch.',
    hint: 'The exported JSON mirrors the C++ *PatchParams struct 1:1 — feed it back to libsonare.',
    shareHint:
      'Happy with a voice? Share the JSON as a GitHub issue — the author may fold good patches into a future built-in instrument update.',
    shareBody:
      'I tuned this physical-model patch in the browser tuner and would like to contribute it. Below is the engine + parameters (it mirrors the C++ *PatchParams struct 1:1).',
  },
  score: {
    show: 'Show score',
    hide: 'Hide score',
    rendering: 'Engraving…',
    empty: 'Record or import a phrase to engrave it.',
    unavailable: 'Score engraving is unavailable in this browser.',
  },
  controls: {
    octave: 'Octave',
    octaveDown: 'Octave down',
    octaveUp: 'Octave up',
    panic: 'All notes off',
    playScale: 'Play scale',
  },
  output: {
    peak: 'Peak',
    engine: 'Engine',
  },
  engineLock: {
    slotModel: 'Slot model',
    diverged: 'Off the slot model',
    overrideLabel: 'Voice with a different model',
    overrideWarn:
      "The target slot uses the model above. A patch tuned on a different model can't fill this slot — override only if you're proposing the model itself (e.g. an ethnic voice).",
    reset: 'Back to slot model',
    outOfScope: 'Not a physical model',
    outOfScopeHint:
      'This slot is voiced by a non-physical engine, which this physical-model tuner does not cover. You can still hear its current built-in voice above; shape it on the synth demo instead.',
    synthLink: 'Open the synth demo →',
    approxLabel: 'Approximate it with a physical model anyway',
  },
  bodyLock: {
    slotBody: 'Slot body',
    diverged: 'Off the slot body',
    overrideLabel: 'Use a different body',
    overrideWarn:
      'The instrument implies the resonator above. Swap it only if you mean to reshape the corpus — the mix knob still fine-tunes how much of it you hear.',
    reset: 'Back to slot body',
  },
  synthModes: {
    subtractive: 'Subtractive',
    fm: 'FM',
    additive: 'Additive',
  },
  paramsIntro:
    'Grouped by physical layer — the signal flows top to bottom: exciter → resonator → coupling → body → dynamics.',
  keyboardHint:
    'Click or tap the keys, or play with your computer keyboard: A W S E D F T G Y H U J K. Use Z / X to shift the octave. Struck and plucked voices (piano, guitar, mallets, drums) ring out naturally when you release; bowed, wind and organ voices sound while held and fade on release.',
  errors: {
    start: 'Could not start the tuner engine. Reload and try again.',
  },
  guide: {
    title: 'An OSS contribution tool — help voice the built-in instruments',
    body: "libsonare's twelve physical-model engines hardcode their deep parameters in C++. This tuner runs a parity-verified TypeScript port of those cores so you can adjust every parameter live, compare against the libsonare original and an imported reference WAV, and export the tuned values as JSON. It is not a demo: share a JSON you are happy with as a GitHub issue and the author may fold it into a future built-in instrument update.",
    docs: 'Synthesizer docs',
  },
  families: {
    string: 'Strings',
    keyboard: 'Keyboard',
    mallet: 'Mallets',
    percussion: 'Percussion',
    wind: 'Winds',
    vocal: 'Voice',
  },
  // Physical-layer headings for the grouped model-parameter panel.
  layers: {
    exciter: {
      label: 'Exciter',
      blurb:
        'The energy source — pluck, hammer, bow, breath or strike — and its contact point and character.',
    },
    resonator: {
      label: 'Resonator',
      blurb: 'The vibrating body — string, bore, bar or membrane: its tuning, decay and damping.',
    },
    coupling: {
      label: 'Coupling',
      blurb: 'Secondary paths coupled in — extra strings, sympathetic resonance, vents, ranks.',
    },
    body: {
      label: 'Body & Radiation',
      blurb: 'How the vibration reaches the air — soundboard, shell, bell, pickup, output.',
    },
    dynamics: {
      label: 'Articulation & Dynamics',
      blurb: 'How the gesture shapes the note — velocity response, attack/release, expression.',
    },
  },
  // Perceptual macros: a few intuitive sliders that sweep the deep params together
  // so you can aim by ear ("brighter", "longer", "more air") without hunting the
  // full knob grid. Keyed by macro id (shared ids reuse one label across engines).
  macros: {
    title: 'Sound shaping',
    intro:
      'Aim by ear: each slider moves several deep parameters together in one musical direction. Fine-tune the individual values under Model parameters below.',
    items: {
      tone: { label: 'Brightness', hint: 'Dull and mellow → bright and present.' },
      sustain: { label: 'Sustain', hint: 'Short and damped → long, singing ring.' },
      bite: { label: 'Pluck attack', hint: 'Smooth fingertip → hard, snappy pick.' },
      pluckPos: {
        label: 'Pluck position',
        hint: 'Near the bridge (thin) → over the neck (round).',
      },
      body: { label: 'Body', hint: 'Bare string → coupled, resonant body.' },
      pressure: { label: 'Bow pressure', hint: 'Light and airy → firm, digging tone.' },
      attack: { label: 'Attack', hint: 'Slow, gentle onset → fast, immediate start.' },
      bowPos: { label: 'Bow position', hint: 'Near the bridge (edgy) → over the board (soft).' },
      rosin: { label: 'Rosin', hint: 'Clean → scratchy, gritty rosin noise.' },
      hammer: {
        label: 'Hammer hardness',
        hint: 'Soft felt (mellow) → hard hammer (bright, sharp).',
      },
      detune: { label: 'Detune', hint: 'Pure unison → wider, honky-tonk beating.' },
      board: { label: 'Soundboard', hint: 'Dry → resonant soundboard bloom.' },
      hardness: { label: 'Mallet hardness', hint: 'Soft mallet (round) → hard mallet (bright).' },
      stretch: { label: 'Decay spread', hint: 'Harmonics decay together → highs die first.' },
      pitch: { label: 'Pitch', hint: 'Low, deep → high, tight tuning.' },
      decay: { label: 'Decay', hint: 'Tight and dead → long, ringing tail.' },
      noise: { label: 'Noise amount', hint: 'Pure tone → more attack noise / air.' },
      noiseTone: { label: 'Noise tone', hint: 'Dark noise → bright, crisp noise.' },
      shell: { label: 'Shell', hint: 'No shell → resonant drum shell.' },
      airflow: { label: 'Air supply', hint: 'Gentle wind → full, pushed wind.' },
      reed: { label: 'Reediness', hint: 'Pure flue → buzzy, reedy voicing.' },
      chiff: { label: 'Chiff', hint: 'Clean speech → breathy onset chiff.' },
      tremulant: { label: 'Tremulant', hint: 'Steady → undulating tremulant.' },
      breath: { label: 'Breath', hint: 'Soft breath → strong, loud blowing.' },
      stiffness: { label: 'Reed stiffness', hint: 'Soft, mellow reed → stiff, bright reed.' },
      breathiness: { label: 'Breathiness', hint: 'Focused tone → audible breath noise.' },
      brilliance: { label: 'Brilliance', hint: 'Round → brassy, blaring cuivre.' },
      lip: { label: 'Lip tension', hint: 'Loose lips (dark) → tight lips (bright).' },
      mute: { label: 'Mute', hint: 'Open bell → muted, nasal tone.' },
      jet: { label: 'Jet', hint: 'Low harmonics → bright, overblown jet.' },
      vibrato: { label: 'Vibrato', hint: 'Flat → deep, singing vibrato.' },
      buzz: { label: 'Bridge buzz', hint: 'Clean pluck → sitar / tanpura shimmer.' },
    },
  },
  // Localized exciter-model names + one-line descriptions for the picker rack.
  // The canonical English labels live in ENGINE_INFO; these override the display.
  engines: {
    'karplus-strong': {
      label: 'Karplus-Strong',
      blurb: 'Plucked string — a damped delay loop.',
    },
    'bowed-string': { label: 'Bowed String', blurb: 'Friction-excited waveguide + corpus.' },
    piano: { label: 'Piano', blurb: 'Stiff strings, felt hammer, soundboard.' },
    modal: { label: 'Modal Mallet', blurb: 'Struck bar / bell — a resonator bank.' },
    percussion: { label: 'Percussion', blurb: 'Membrane modes + noise + shell.' },
    'pipe-organ': { label: 'Pipe Organ', blurb: 'Self-oscillating flue pipe, multi-rank.' },
    reed: { label: 'Reed', blurb: 'Single-reed valve on a bore.' },
    brass: { label: 'Brass', blurb: 'Lip-reed valve on a flaring bore.' },
    flute: { label: 'Flute', blurb: 'Air jet across an embouchure hole.' },
    'plucked-string': {
      label: 'Plucked String',
      blurb: 'Buzzing-bridge string — harp / koto / sitar.',
    },
    vocal: { label: 'Vocal', blurb: 'Glottal source through a formant bank.' },
    'free-reed': {
      label: 'Free Reed',
      blurb: 'Driven free-reed tongue — accordion / harmonica.',
    },
  },
  // Per-parameter help, keyed by the `*PatchParams` field name (plus the amp /
  // chain wrapper keys). Beginner-first: each entry says what physically changes
  // when you turn the control, not a textbook definition. Rendered as the "i"
  // info dot + rich tooltip on every knob / toggle, mirroring the synth demo.
  terms: {
    eyebrow: 'Parameter',
    tipLabel: 'When you turn it',
    linkLabel: 'Synthesizer docs',
    items: {
      // ---- amp / chain wrapper ----
      body: {
        title: 'Resonator body',
        body: 'The acoustic body the exciter drives — none, guitar, violin, wood tube, brass bell, or vocal. The exciter makes the raw vibration; the body colors it, the way a guitar string needs its box.',
        tip: 'Pair an exciter with a body to build a hybrid instrument.',
      },
      bodyMix: {
        title: 'Body mix',
        body: 'How much of the resonator body is blended over the bare exciter tone.',
        tip: 'Up for a resonant acoustic body; 0 leaves the raw model.',
      },
      drive: {
        title: 'Drive',
        body: 'Pushes the signal into soft saturation, adding warmth and harmonic grit as it climbs.',
        tip: 'Up for a dirtier, thicker tone; 0 stays clean.',
      },
      gain: {
        title: 'Output gain',
        body: 'The final level of the voice. Above 100% it can clip — watch the peak meter.',
        tip: 'Trim so the peak meter stays out of the red.',
      },
      ampAttack: {
        title: 'Amp attack',
        body: 'How fast the note fades in to full volume after you press a key.',
        tip: 'Short for a percussive start; long for a soft swell.',
      },
      ampDecay: {
        title: 'Amp decay',
        body: 'How the loudness settles right after the initial attack peak.',
        tip: 'Shapes the volume contour just after the hit.',
      },
      ampSustain: {
        title: 'Amp sustain',
        body: 'The level held while a note stays down — 100% keeps full volume until release.',
        tip: 'Lower it so the note drops back after the attack.',
      },
      ampRelease: {
        title: 'Amp release',
        body: 'How long the note takes to fade out once you let go of the key.',
        tip: 'Long for a lingering tail; short for an abrupt stop.',
      },

      // ---- shared exciter / string ----
      brightness: {
        title: 'Brightness',
        body: 'Opens or closes the loop filter, so the tone gets brighter and more present or darker and rounder.',
        tip: 'Up for a crisp, cutting tone; down for a warm, muffled one.',
      },
      damping: {
        title: 'Damping',
        body: 'How much energy the string or air column loses each cycle — the loss that shapes tone and sustain.',
        tip: 'Up for a darker, shorter tone; down for a brighter, ringier one.',
      },
      attackMs: {
        title: 'Attack',
        body: 'How quickly the exciter (breath or bow) rises to full at note-on, in milliseconds.',
        tip: 'Short for a sharp attack; long for a gentle swell in.',
      },
      releaseMs: {
        title: 'Release',
        body: 'How quickly the exciter fades after note-off, in milliseconds.',
        tip: 'Short for an abrupt stop; long for a gentle fade out.',
      },
      decayS: {
        title: 'Decay time',
        body: 'How long the string keeps ringing after the pluck before it dies away, in seconds.',
        tip: 'Longer for a sustained ring; shorter for a tight, muted pluck.',
      },
      decayStretch: {
        title: 'Decay stretch',
        body: 'Makes high notes die away faster than low notes, like a real string. 0 = every note rings equally long.',
        tip: 'Raise so bass sustains while treble fades quickly.',
      },
      releaseDampS: {
        title: 'Release damping',
        body: 'How fast the note is muted after you let go — the damper landing back on the string.',
        tip: 'Short for a quick choke; long to let it ring past key-up.',
      },
      velToBrightness: {
        title: 'Velocity → brightness',
        body: 'How much harder playing brightens the tone, so dynamics change timbre, not just volume.',
        tip: 'Raise so hard hits sound noticeably brighter than soft ones.',
      },
      polarization: {
        title: 'Polarization',
        body: "Blends the string's two vibration planes, adding a slow beating shimmer to the decay.",
        tip: 'Raise for a livelier, chorusing sustain; 0 for a plain decay.',
      },
      dispersion: {
        title: 'Dispersion',
        body: 'String stiffness that stretches the harmonics sharp (inharmonicity), giving a metallic, piano-like edge.',
        tip: 'Up for a stiff bell/piano character; 0 for an ideal string.',
      },
      sympathetic: {
        title: 'Sympathetic strings',
        body: 'Lets undamped strings ring in sympathy with the played note, adding a halo of resonance.',
        tip: 'Turn on for sitar / piano-like resonance behind the note.',
      },

      // ---- Karplus-Strong ----
      pickPosition: {
        title: 'Pick position',
        body: 'Where along the string you pluck. Near the bridge is thin and nasal; toward the middle is round and full.',
        tip: 'Toward the bridge for a bright twang; center for a mellow body.',
      },
      excBrightness: {
        title: 'Pluck brightness',
        body: 'How bright the initial pluck noise is before the string filters it — the edge of the attack.',
        tip: 'Up for a sharper attack; down for a softer finger pluck.',
      },
      slap: {
        title: 'Fret slap',
        body: 'Adds a percussive fret / finger slap noise at the attack.',
        tip: 'A touch adds funk/bass bite; 0 for a clean pluck.',
      },
      bodyCoupling: {
        title: 'Bridge coupling',
        body: 'How strongly the string couples to the bridge and body, adding resonance and shortening sustain.',
        tip: 'Up for a woody, resonant tone; down for a longer, purer ring.',
      },
      pluckStyle: {
        title: 'Pluck style',
        body: 'Morphs the pluck shape from a soft, round attack to a sharp, edged one.',
        tip: 'Up for a pick attack; down for a fingertip.',
      },
      nail: {
        title: 'Nail',
        body: 'Adds a bright fingernail edge to the pluck (classical-guitar nail vs flesh).',
        tip: 'Up for a crisp nail attack; 0 for a soft flesh pluck.',
      },
      pickupPos: {
        title: 'Pickup position',
        body: 'Where an imaginary pickup senses the string, comb-filtering which harmonics come through.',
        tip: 'Move it to notch out harmonics and recolor the tone.',
      },
      tensionMod: {
        title: 'Tension mod',
        body: 'Pitch bends slightly as string tension drops during a hard attack, like a real plucked note.',
        tip: 'A little adds a natural attack blip; 0 for steady pitch.',
      },
      octaveMix: {
        title: "Octave 4'",
        body: 'Mixes in a string tuned an octave up for a fuller, 12-string-like tone.',
        tip: 'Raise for a shimmering octave double; 0 for a single string.',
      },
      keyoffNoise: {
        title: 'Key-off noise',
        body: 'Adds a release click or thunk when the note is let go.',
        tip: 'A touch adds realism; 0 keeps the release silent.',
      },

      // ---- Bowed string ----
      bowPosition: {
        title: 'Bow position',
        body: 'Where the bow contacts the string. Near the bridge is bright and edgy (sul ponticello); farther is soft.',
        tip: 'Toward the bridge for a scratchy attack; away for a smooth tone.',
      },
      bowForce: {
        title: 'Bow force',
        body: 'How hard the bow presses. Too little slips into a whistle; too much crushes; the middle sings.',
        tip: 'Find the sweet spot for a clean tone; push for a forced scratch.',
      },
      bowSpeed: {
        title: 'Bow speed',
        body: 'How fast the bow is drawn — brighter and louder as it rises.',
        tip: 'Up for an energetic, bright stroke; down for a soft, dark one.',
      },
      velToSpeed: {
        title: 'Velocity → bow speed',
        body: 'How much your playing dynamics drive bow speed, linking loudness to attack energy.',
        tip: 'Raise so hard notes attack faster and brighter.',
      },
      rosin: {
        title: 'Rosin',
        body: 'Adds sticky bow-hair texture, roughening the attack with a hint of grit.',
        tip: 'A little adds realistic bite to the bow attack.',
      },
      elastoPlastic: {
        title: 'Elasto-plastic friction',
        body: 'Switches to a richer friction model with a more nuanced, evolving stick–slip attack.',
        tip: 'Turn on for a more expressive, physically detailed bow.',
      },
      stribeck: {
        title: 'Stribeck',
        body: 'Shapes the friction curve, tuning how easily the string breaks into vibration.',
        tip: 'Adjust between an easy, smooth start and a grabbier one.',
      },

      // ---- Piano ----
      strings: {
        title: 'Unison strings',
        body: 'How many slightly-detuned strings sound per note (1–3), the source of piano richness and beating.',
        tip: '3 for a full grand tone; 1 for a thin, harpsichord-like note.',
      },
      detuneCents: {
        title: 'Detune',
        body: 'How far apart the unison strings are tuned — the gentle beating and chorus of a real piano.',
        tip: 'More for a livelier shimmer; less for a pure tone.',
      },
      decayFastS: {
        title: 'Prompt decay',
        body: 'The fast initial decay right after the hammer strike (the "prompt" sound), in seconds.',
        tip: 'Shorter for a plucky attack; longer to keep the initial body.',
      },
      decaySlowS: {
        title: 'Aftersound',
        body: 'The long residual ring that continues after the initial decay, in seconds.',
        tip: 'Longer for a singing sustain; shorter for a dry, quick note.',
      },
      strikePosition: {
        title: 'Strike position',
        body: 'Where the hammer hits the string, comb-filtering which harmonics are strong or missing.',
        tip: 'Move it to reshape the harmonic balance (~1/8 is classic).',
      },
      hammerExponent: {
        title: 'Hammer felt',
        body: 'Felt hardness curve — soft felt is mellow, hard felt is bright and percussive.',
        tip: 'Up for a bright, aggressive hammer; down for a soft, warm one.',
      },
      hammerContactMs: {
        title: 'Hammer contact',
        body: 'How long the hammer stays on the string — longer contact filters out the highest harmonics.',
        tip: 'Longer for a rounder tone; shorter for a brighter strike.',
      },
      hammerDynamics: {
        title: 'Hammer dynamics',
        body: 'How much harder hits compress the felt and brighten, so forte notes bite more than piano ones.',
        tip: 'Raise for a wide brightness range across dynamics.',
      },
      soundboard: {
        title: 'Soundboard',
        body: 'Mixes in the resonant soundboard body, adding warmth and a natural acoustic bloom.',
        tip: 'Up for a rich acoustic body; 0 for a dry, direct string.',
      },

      // ---- Modal mallet ----
      numModes: {
        title: 'Modes',
        body: 'How many resonant partials the bar or bell rings with — more modes give a richer, more complex tone.',
        tip: 'Fewer for a pure bell; more for a complex metallic timbre.',
      },
      strikeBrightness: {
        title: 'Mallet hardness',
        body: 'How hard the mallet is — a hard mallet excites high modes (bright, pingy), a soft one stays mellow.',
        tip: 'Up for a hard, bright strike; down for a soft, round one.',
      },

      // ---- Winds (shared) ----
      breathPressure: {
        title: 'Breath pressure',
        body: 'How hard the player blows — the steady driving pressure that sets loudness and brightness.',
        tip: 'Up for a louder, brighter blow; too low and the note will not speak.',
      },
      velToBreath: {
        title: 'Velocity → breath',
        body: 'How much your playing dynamics drive breath pressure, tying loudness to touch.',
        tip: 'Raise so hard notes blow harder and brighter.',
      },
      breathNoise: {
        title: 'Breath noise',
        body: 'The breathy air turbulence mixed into the blow.',
        tip: 'A little adds realism; more for a breathy, airy tone.',
      },
      chiff: {
        title: 'Chiff',
        body: 'The little speech / consonant transient at the very start of the note.',
        tip: 'Up for a pronounced attack "chiff"; 0 for a smooth onset.',
      },
      chiffMs: {
        title: 'Chiff time',
        body: 'How long the onset chiff lasts before the steady tone settles.',
        tip: 'Longer for a slower, breathier attack; shorter for a quick one.',
      },
      conical: {
        title: 'Conical bore',
        body: 'A cylinder sounds hollow with odd harmonics (clarinet); a cone is fuller (sax / oboe).',
        tip: 'Off for a clarinet-like tone; on for a saxophone-like one.',
      },

      // ---- Reed ----
      reedStiffness: {
        title: 'Reed stiffness',
        body: 'How stiff the reed is — stiffer reeds resist more, changing how the note speaks and its brightness.',
        tip: 'Toward an easy, dark reed or a stiff, bright one.',
      },
      reedOpening: {
        title: 'Reed opening',
        body: 'The reed’s resting gap before you blow, affecting response and dynamics.',
        tip: 'Wider for a freer, louder reed; tighter for a controlled one.',
      },
      dynamicReed: {
        title: 'Dynamic reed',
        body: 'Models the reed as a moving mass-spring, giving a livelier, more physically responsive tone.',
        tip: 'Turn on for a richer, more realistic reed.',
      },
      reedResonance: {
        title: 'Reed resonance',
        body: 'The reed’s own pitch (only with Dynamic reed on) — tunes its squawk and formant.',
        tip: 'Adjust the reed’s color when Dynamic reed is on.',
      },
      registerVent: {
        title: 'Register vent',
        body: 'Damps the fundamental toward the register break, helping upper-register notes speak.',
        tip: 'Raise to push the tone toward its overblown register.',
      },
      growl: {
        title: 'Growl',
        body: 'A slow sub-audio breath modulation that adds a growling, vocal texture.',
        tip: 'Add for a jazzy, gritty growl; 0 for a clean tone.',
      },
      coneGrowth: {
        title: 'Cone growth',
        body: 'On conical bores, the throat-taper term that shapes the low end.',
        tip: 'Adjust the conical bore’s low-register fullness.',
      },
      tonehole: {
        title: 'Tonehole',
        body: 'An open tonehole / register-key scattering junction inside the bore, coloring the tone.',
        tip: 'Raise to add a vented, register-key coloration.',
      },

      // ---- Brass ----
      lipTension: {
        title: 'Lip tension',
        body: 'Fine-tunes the buzzing lip’s resonance around the note — the embouchure firmness.',
        tip: 'Adjust so the note centers cleanly and speaks easily.',
      },
      lipDamping: {
        title: 'Lip damping',
        body: 'Low is a tight, bright buzz; high is a mellow, dark tone.',
        tip: 'Down for a brassy, cutting tone; up for a soft, round one.',
      },
      brassiness: {
        title: 'Brassiness (cuivré)',
        body: 'Amplitude-driven shockwave steepening — the bright metallic blare when brass is pushed loud.',
        tip: 'Up for a blaring fortissimo edge; 0 for a smooth tone.',
      },
      cuivreDynamics: {
        title: 'Cuivré dynamics',
        body: 'How much the played dynamic scales the brassiness, so only loud notes blare.',
        tip: 'Raise so the blare only appears on the loudest notes.',
      },
      mute: {
        title: 'Mute',
        body: 'A nasal, muted-bell formant with a pitch scoop — a plunger / harmon mute character.',
        tip: 'Up for a muted, nasal color; 0 for an open bell.',
      },
      halfValve: {
        title: 'Half-valve',
        body: 'Extra loop loss plus a small detune — the choked, hazy half-pressed valve sound.',
        tip: 'Add for a fuzzy half-valve effect; 0 for clean valves.',
      },
      dynamicLip: {
        title: 'Dynamic lip',
        body: 'Adds a second transverse lip mode for a livelier, more complex buzz.',
        tip: 'Up for a richer, more physical lip; 0 for a simple buzz.',
      },

      // ---- Flute ----
      jetRatio: {
        title: 'Jet ratio',
        body: 'The air-jet vs bore delay ratio — which register (octave) the pipe speaks in.',
        tip: 'Adjust to select the flute’s speaking register.',
      },
      jetReflection: {
        title: 'Jet drive',
        body: 'The jet’s drive strength; around 0.5 is stable, higher pushes harder.',
        tip: 'Near 0.5 for a stable tone; raise for a harder-driven jet.',
      },
      endReflection: {
        title: 'End reflection',
        body: 'How strongly the open bore end reflects sound back — around 0.5 is stable.',
        tip: 'Keep near 0.5 for a steady tone; adjust to detune it.',
      },
      vibratoRateHz: {
        title: 'Vibrato rate',
        body: 'The speed of the built-in vibrato, in Hz.',
        tip: 'Faster for an intense vibrato; slower for a gentle wave.',
      },
      vibratoDepth: {
        title: 'Vibrato depth',
        body: 'How wide the vibrato swings; 0 turns vibrato off.',
        tip: 'Add depth for a singing flute; 0 for a straight tone.',
      },
      overblow: {
        title: 'Overblow',
        body: 'Drives the jet up into the next register — the flutter of an overblown note.',
        tip: 'Raise to force the note into its higher octave.',
      },
      jetTurbulence: {
        title: 'Jet turbulence',
        body: 'Extra shaping of the breathy jet noise for a more textured air sound.',
        tip: 'Up for a breathier, airier tone; 0 for a pure one.',
      },
      edgeHysteresis: {
        title: 'Edge hysteresis',
        body: 'Models the jet flipping across the edge with lag, adding a subtle nonlinearity.',
        tip: 'A touch adds organic instability; 0 for a clean jet.',
      },
      vortex: {
        title: 'Vortex',
        body: 'A discrete-vortex noise source for realistic edge-tone turbulence.',
        tip: 'Add for a lifelike breathy edge; 0 for a smooth tone.',
      },

      // ---- Pipe organ ----
      stopped: {
        title: 'Stopped pipe',
        body: 'Caps the pipe end — a stopped pipe sounds an octave lower and hollow (odd harmonics only).',
        tip: 'On for a soft, hollow stopped flute; off for a full open pipe.',
      },
      toneDecayS: {
        title: 'Bore purity',
        body: 'A longer nominal ring means a purer, more sustained pipe tone.',
        tip: 'Up for a pure, singing pipe; down for a breathier one.',
      },
      breath: {
        title: 'Wind drive',
        body: 'How hard the wind drives the pipe’s mouth — its loudness and edge.',
        tip: 'Up for a stronger, brighter speech; down for a gentle voice.',
      },
      reed: {
        title: 'Reed character',
        body: 'Blends in a reed-pipe quality — the buzzy, brassy character of reed stops.',
        tip: 'Up for a reedy, buzzing rank; 0 for a smooth flue pipe.',
      },
      radiation: {
        title: 'Radiation',
        body: 'Mouth / radiation correction that shapes how the pipe projects — its brightness and bloom.',
        tip: 'Adjust for a more forward or more distant pipe.',
      },
      keytrack: {
        title: 'Treble regulation',
        body: 'Rank-level keytracking that regulates how upper notes voice; 0 bypasses it.',
        tip: 'Raise to balance the treble against the bass across the keys.',
      },
      rankCount: {
        title: 'Ranks',
        body: 'How many pipe ranks are drawn (0 = one implicit 8′ rank) — the registration size.',
        tip: 'Add ranks for a fuller organ registration.',
      },
      tremulantRateHz: {
        title: 'Tremulant rate',
        body: 'The speed of the tremulant’s wind pulsation, in Hz (0 = off).',
        tip: 'Faster for a shimmering tremulant; slower for a gentle sway.',
      },
      tremulantDepth: {
        title: 'Tremulant depth',
        body: 'How deep the tremulant modulates the wind; 0 turns it off.',
        tip: 'Add depth for a vibrato-like organ warmth.',
      },
      windSag: {
        title: 'Wind sag',
        body: 'How much the wind pressure droops under load — the breathy sag of a real wind supply.',
        tip: 'Up for a characterful, unsteady wind; 0 for rock-steady.',
      },
      swell: {
        title: 'Swell box',
        body: 'Simulates closing the swell shutters, muffling and softening the whole rank.',
        tip: 'Raise to close the box for a distant, muffled organ.',
      },

      // ---- Percussion ----
      gmKit: {
        title: 'GM drum kit',
        body: 'Maps each key to a General MIDI drum sound instead of one tuned membrane.',
        tip: 'On to play a full kit across the keys; off for one tunable drum.',
      },
      exclusiveClass: {
        title: 'Mute group',
        body: 'Notes sharing a group cut each other off, like closed vs open hi-hat; 0 = none.',
        tip: 'Group sounds that should choke one another (hi-hats).',
      },
      modeDecayS: {
        title: 'Tone decay',
        body: 'How long the drum’s pitched membrane tone rings, in seconds.',
        tip: 'Longer for a resonant tom; shorter for a tight, dead thud.',
      },
      toneGain: {
        title: 'Tone level',
        body: 'How loud the pitched membrane layer sits in the mix.',
        tip: 'Up for a pitched, tonal drum; down to favor the attack noise.',
      },
      baseFreqHz: {
        title: 'Base pitch',
        body: 'Overrides the drum’s fundamental pitch in Hz (0 = follow the struck key).',
        tip: 'Set a fixed drum pitch, or 0 to play it chromatically.',
      },
      pitchDrop: {
        title: 'Pitch drop',
        body: 'The pitch overshoot at the strike that falls back down — the "dow" of a tuned tom.',
        tip: 'Up for a pronounced pitch-bend attack; 0 for steady pitch.',
      },
      pitchDropMs: {
        title: 'Pitch drop time',
        body: 'How long the strike pitch takes to settle back to the base pitch.',
        tip: 'Longer for a slow bend down; shorter for a quick snap.',
      },
      strikeR: {
        title: 'Strike radius',
        body: 'Where the drum is hit — the center is pure and boomy, the rim brings out complex overtones.',
        tip: 'Center for a deep tone; toward the rim for a brighter hit.',
      },
      strikeTheta: {
        title: 'Strike angle',
        body: 'The angle of the strike around the head, orienting which asymmetric modes ring.',
        tip: 'Nudge to vary the overtone color of off-center hits.',
      },
      noiseGain: {
        title: 'Noise level',
        body: 'How loud the transient noise burst is — the stick or snare "crack".',
        tip: 'Up for a snappy, noisy attack; 0 for a pure tone.',
      },
      noiseDecayMs: {
        title: 'Noise decay',
        body: 'How long the noise burst lasts, in milliseconds.',
        tip: 'Longer for a wash / sizzle; shorter for a tight click.',
      },
      noiseCutoffHz: {
        title: 'Noise color',
        body: 'The cutoff of the noise filter — the pitch and brightness of the crack.',
        tip: 'Higher for a bright sizzle; lower for a dull thud.',
      },
      noiseQ: {
        title: 'Noise Q',
        body: 'How narrow the noise filter is — high Q rings at one pitch, low Q is broadband.',
        tip: 'Up for a pitched, ringing noise; down for a broad crack.',
      },
      shellMix: {
        title: 'Shell resonance',
        body: 'Mixes in the drum shell’s body resonance over the hit; 0 bypasses it.',
        tip: 'Up for a woody, resonant shell; 0 for a pure head sound.',
      },
      shellNumModes: {
        title: 'Shell modes',
        body: 'How many resonant modes the shell body contributes.',
        tip: 'More for a complex resonant body; fewer for a simple one.',
      },
      wireBuzz: {
        title: 'Snare buzz',
        body: 'The rattle of snare wires against the head; 0 = no snares (a tom).',
        tip: 'Up to turn a tom into a buzzing snare; 0 for no wires.',
      },
      wireThreshold: {
        title: 'Buzz threshold',
        body: 'How hard you must hit before the snare wires start rattling.',
        tip: 'Lower so soft hits still buzz; higher so only hard hits rattle.',
      },
      wireCutoffHz: {
        title: 'Buzz color',
        body: 'The high-pass cutoff voicing the snare rattle — its brightness.',
        tip: 'Higher for a crisp sizzle; lower for a looser rattle.',
      },
      shimmer: {
        title: 'Shimmer',
        body: 'A nonlinear high wash pumped by the hit energy — the building shimmer of a cymbal or gong.',
        tip: 'Up for a cymbal-like blooming wash; 0 for a dry hit.',
      },
      shimmerAttackMs: {
        title: 'Shimmer buildup',
        body: 'How long the shimmer wash takes to bloom in after the strike.',
        tip: 'Longer for a slow gong swell; shorter for an instant crash.',
      },
      shimmerCutoffHz: {
        title: 'Shimmer color',
        body: 'The high-pass cutoff of the shimmer band — how high and airy the wash sits.',
        tip: 'Higher for an airy sheen; lower for a fuller wash.',
      },
      phisemBeans: {
        title: 'Particle count',
        body: 'How many beads rattle inside — the density of a shaker or scraper (0 = off).',
        tip: 'More for a dense maraca; fewer for a sparse, clicky shaker.',
      },
      phisemEnergyMs: {
        title: 'Shake energy',
        body: 'How long one shake gesture’s energy lasts before the particles settle.',
        tip: 'Longer for a sustained shake; shorter for a quick flick.',
      },
      phisemSoundMs: {
        title: 'Grain length',
        body: 'The click length of each single particle collision.',
        tip: 'Longer for softer beads; shorter for a sharp, ticky grain.',
      },
      phisemResHz: {
        title: 'Gourd resonance',
        body: 'The resonant body pitch the particles ring through (0 = raw noise).',
        tip: 'Set for a maraca / cabasa gourd tone; 0 for a dry rattle.',
      },
      phisemResQ: {
        title: 'Resonance Q',
        body: 'How strongly the gourd resonates — weak (cabasa) to strong (maraca / jingle).',
        tip: 'Up for a pitched, ringing shaker; down for a soft wash.',
      },
      phisemScrapeHz: {
        title: 'Scrape rate',
        body: 'The ridge rate of a scraper (guiro); 0 = a pure random shaker.',
        tip: 'Raise to turn a shaker into a rhythmic scrape.',
      },
      phisemPitchGlide: {
        title: 'Pitch glide',
        body: 'The resonance pitch slides down after the hit — the cuica’s weep.',
        tip: 'Add for a cuica-like pitch bend; 0 for steady pitch.',
      },

      // ---- Plucked string (buzzing bridge) ----
      buzz: {
        title: 'Bridge buzz',
        body: 'How hard the curved bridge (a sitar / tanpura jawari) limits the string each cycle, spraying energy into the high partials for that shimmering metallic buzz. 0 is a clean pluck (harp / koto).',
        tip: 'Up for a sitar / tanpura shimmer; 0 for a clean plucked string.',
      },

      // ---- Vocal (source-filter) ----
      vowel: {
        title: 'Vowel',
        body: 'Which vowel the formant bank sings — /a/ /e/ /i/ /o/ /u/ (0–4). Each moves the resonant peaks that define the sung sound.',
        tip: 'Step through the vowels to reshape the sung tone.',
      },

      // ---- Free reed (accordion / harmonica) ----
      detune: {
        title: 'Musette detune',
        body: 'How far the two reed tongues per note are tuned apart — the wet, shimmering beat of an accordion. 0 is a single dry tongue.',
        tip: 'Up for a wide, wet musette; 0 for a single pure reed.',
      },
    },
  },
};

export type TunerCopy = typeof enCopy;

export const jaCopy: TunerCopy = {
  title: '物理モデルチューナー',
  subtitle: 'libsonare の物理モデルエンジンをその場で調整し、パッチを書き出し',
  localOnly: 'ローカル処理',
  status: {
    idle: '待機中',
    starting: '起動中',
    armed: '準備完了',
    ready: '演奏中',
    error: 'エラー',
  },
  deck: {
    model: 'PM-9',
    tagline: 'PHYSICAL MODEL VOICE TUNER',
  },
  sections: {
    engine: '励振モデル',
    chain: 'シグナルチェーン',
    body: '共鳴ボディ',
    amp: 'アンプエンベロープ',
    params: 'モデルパラメーター',
    compare: 'A / B 比較',
    oracle: 'リファレンス音源',
    keys: '鍵盤',
    patch: 'パッチ',
    midi: 'MIDI フレーズ',
    score: '楽譜',
    target: '貢献ターゲット',
  },
  target: {
    subtitle: 'このパッチが埋める GM/GS 音色を選びます',
    enable: 'GM/GS スロットを対象にする',
    disabled: 'ターゲットなし — 自由に調整。特定の GM/GS スロットを作るにはオンにします。',
    type: 'ターゲット種別',
    standard: '規格',
    modeMelodic: '音程あり',
    modeDrum: 'ドラム',
    program: 'GM プログラム',
    drum: 'GM ドラムノート',
    variation: 'GS バリエーション (CC0)',
    drumKit: 'GS ドラムキット',
    slot: 'スロット',
    suggested: '推奨エンジン',
    use: '使う',
    hearCurrent: '現在の内蔵音を聴く',
    optionOutOfScope: '対象外',
    outOfScope: '{engine} エンジンで鳴らされます — ここでは物理モデル調整の対象外です。',
    hint: 'パッチを1つの GM/GS スロットに紐付け、A/B の「原音」を libsonare の現在の内蔵フォールバック音に設定します。つまり「今の音」を基準に調整できます。共有したパッチは、GM フォールバックバンクのそのスロットに反映される場合があります。',
    gsNote:
      'GS のバンク／キットはスロットのアドレスを記録するだけで、A/B は最も近い内蔵 GM 音を再生します。',
  },
  chain: {
    exciter: '励振',
    body: 'ボディ',
    amp: 'アンプ',
    out: '出力',
    bodyMix: 'ボディ量',
    drive: 'ドライブ',
    gain: 'ゲイン',
  },
  amp: {
    attack: 'アタック',
    decay: 'ディケイ',
    sustain: 'サステイン',
    release: 'リリース',
  },
  bodies: {
    none: 'なし',
    guitar: 'ギター',
    violin: 'バイオリン',
    'wood-tube': '木管',
    'brass-bell': '金管ベル',
    vocal: 'ボーカル',
  },
  compare: {
    original: '原音',
    adjusted: '調整後',
    oracle: 'リファレンス',
    delta: 'Δ',
    rmsError: 'RMS 誤差',
    specSim: 'スペクトル一致',
    auditionOriginal: '原音を聴く',
    auditionAdjusted: '調整後を聴く',
    auditionOracle: 'リファレンスを聴く',
    against: '誤差の基準',
    rendering: 'レンダリング中…',
    hint: '原音は libsonare コアがこのエンジンの初期値で鳴らした音です。パラメーターを調整すると、調整後の波形が原音から離れていきます。',
    empty: 'ノートを弾くか、比較を押すと波形が描画されます。',
    compare: '比較',
  },
  oracle: {
    import: 'WAV を読み込み',
    clear: 'クリア',
    loaded: 'リファレンス読み込み済み',
    none: 'リファレンス未読み込み',
    hint: 'リファレンス WAV（実楽器や別音源のフレーズなど）を読み込み、その誤差が最小になるよう調整します。',
    decodeError: 'この音声ファイルをデコードできませんでした。',
  },
  autofit: {
    importOracle: 'リファレンスを取り込み（WAV / MIDI）',
    oracleNote: 'リファレンスの音高',
    hint: '目標の音（WAV）と、必要なら1音の MIDI で音高を取り込むと、自動フィットがコアパラメータを探索して近似します。結果はスロットの出発点であり、完成した音色ではありません。',
    fit: 'リファレンスへ自動フィット',
    running: 'フィット中…',
    cancel: 'キャンセル',
    keep: '採用',
    revert: '元に戻す',
    poorMatch:
      'このモデルではその音に届かない場合があります。ターゲットの推奨エンジンを試すか、ここから耳で調整してください。',
    tooShort: 'リファレンスが短すぎるか静かすぎてフィットできません。',
  },
  midi: {
    connect: 'MIDI デバイスを接続',
    connecting: '接続中…',
    connected: '受信中',
    unavailable:
      'このブラウザでは Web MIDI を利用できません。USB MIDI キーボードは Chrome / Edge で利用できます。',
    record: '録音',
    stop: '停止',
    clear: 'クリア',
    exportSmf: 'MIDI を書き出し',
    importSmf: 'MIDI を読み込み',
    play: 'フレーズを再生',
    empty: 'まだフレーズがありません。鍵盤から録音するか MIDI ファイルを読み込みます。',
    count: 'ノート',
  },
  patch: {
    export: 'JSON を書き出し',
    import: 'JSON を読み込み',
    reset: 'エンジンをリセット',
    share: 'GitHub Issue で共有',
    importError: 'これは有効なチューナーパッチではありません。',
    hint: '書き出す JSON は C++ の *PatchParams 構造体と 1:1 で対応します。libsonare にそのまま戻せます。',
    shareHint:
      '気に入った音色ができたら JSON を GitHub Issue で共有してください。良いパッチは作者が内蔵音源のアップデートに反映する場合があります。',
    shareBody:
      'ブラウザのチューナーで物理モデルのパッチを調整したので貢献したいです。以下がエンジンとパラメーターです（C++ の *PatchParams 構造体と 1:1 で対応します）。',
  },
  score: {
    show: '楽譜を表示',
    hide: '楽譜を隠す',
    rendering: '浄書中…',
    empty: 'フレーズを録音または読み込むと浄書されます。',
    unavailable: 'このブラウザでは楽譜の浄書を利用できません。',
  },
  controls: {
    octave: 'オクターブ',
    octaveDown: 'オクターブを下げる',
    octaveUp: 'オクターブを上げる',
    panic: '全音オフ',
    playScale: 'スケールを再生',
  },
  output: {
    peak: 'ピーク',
    engine: 'エンジン',
  },
  engineLock: {
    slotModel: 'スロットのモデル',
    diverged: 'スロットのモデルから逸脱',
    overrideLabel: '別のモデルで音を作る',
    overrideWarn:
      'このターゲットスロットは上のモデルを使います。別のモデルで調整したパッチはこのスロットには使えません — モデル自体を提案する場合（民族楽器など）のみ変更してください。',
    reset: 'スロットのモデルに戻す',
    outOfScope: '物理モデルではない',
    outOfScopeHint:
      'このスロットは非物理モデルのエンジンで鳴らされ、この物理モデルチューナーの対象外です。現在の内蔵音は上で試聴できますが、音作りはシンセデモ側で行います。',
    synthLink: 'シンセデモを開く →',
    approxLabel: 'それでも物理モデルで近似する',
  },
  bodyLock: {
    slotBody: 'スロットの共鳴体',
    diverged: 'スロットの共鳴体から逸脱',
    overrideLabel: '別の共鳴体を使う',
    overrideWarn:
      'この楽器は上の共鳴体を前提とします。胴鳴りそのものを作り替える場合のみ変更してください — ミックスつまみで鳴りの量は引き続き微調整できます。',
    reset: 'スロットの共鳴体に戻す',
  },
  synthModes: {
    subtractive: 'サブトラクティブ',
    fm: 'FM',
    additive: 'アディティブ',
  },
  paramsIntro:
    '物理レイヤー順に整理 — 信号は上から下へ流れます:励振 → 共鳴体 → 結合 → 胴鳴り・放射 → 奏法。',
  keyboardHint:
    '鍵盤をクリック／タップするか、PC キーボードで演奏できます: A W S E D F T G Y H U J K。Z / X でオクターブを切り替えます。撥弦・打鍵系（ピアノ・ギター・マレット・ドラム）は指を離しても自然に鳴り切り、擦弦・管・オルガン系は押している間だけ鳴り離すとフェードします。',
  errors: {
    start: 'チューナーエンジンを起動できませんでした。再読み込みして再度お試しください。',
  },
  guide: {
    title: 'OSS 貢献ツール — 内蔵音源の音作りに参加できます',
    body: 'libsonare の 12 種類の物理モデルエンジンは、深いパラメーターを C++ 内にハードコードしています。このチューナーは、それらのコアをパリティ検証済みの TypeScript に移植して動かします。全パラメーターをその場で調整し、libsonare の原音や読み込んだリファレンス WAV と比較し、調整値を JSON として書き出せます。これはデモではありません。気に入った JSON を GitHub Issue で共有すると、作者が内蔵音源のアップデートに反映する場合があります。',
    docs: 'シンセサイザーのドキュメント',
  },
  families: {
    string: '弦',
    keyboard: '鍵盤',
    mallet: 'マレット',
    percussion: '打楽器',
    wind: '管',
    vocal: 'ボイス',
  },
  layers: {
    exciter: {
      label: '励振',
      blurb: 'エネルギー源 — 撥弦・打鍵・擦弦・息・打撃 — と接触点や性格。',
    },
    resonator: {
      label: '共鳴体',
      blurb: '振動する本体 — 弦・管・棒・膜 — の音程・減衰・ダンピング。',
    },
    coupling: {
      label: '結合',
      blurb: '結合する副次経路 — 追加弦・共鳴・ベント・ランク。',
    },
    body: {
      label: '胴鳴り・放射',
      blurb: '振動が空気へ届く過程 — 響板・胴・ベル・ピックアップ・出力。',
    },
    dynamics: {
      label: '奏法・ダイナミクス',
      blurb: '演奏動作が音を形づくる — ベロシティ応答・アタック/リリース・表現。',
    },
  },
  macros: {
    title: '音づくり',
    intro:
      '耳で狙う — 各スライダーが複数の深部パラメータを一つの音楽的な方向へまとめて動かします。細かい値は下の「モデルパラメータ」で微調整できます。',
    items: {
      tone: { label: '明るさ', hint: 'こもった柔らかい音 → 明るく前に出る音。' },
      sustain: { label: '余韻', hint: '短く詰まった音 → 長く歌う響き。' },
      bite: { label: '弾きのアタック', hint: '柔らかい指先 → 硬く歯切れのよいピック。' },
      pluckPos: { label: '弾く位置', hint: 'ブリッジ寄り（細い）→ ネック寄り（丸い）。' },
      body: { label: '胴の鳴り', hint: '裸の弦 → 胴に結合した共鳴。' },
      pressure: { label: '弓圧', hint: '軽くかすれた音 → 芯のある強い音。' },
      attack: { label: '立ち上がり', hint: 'ゆっくり穏やかな発音 → 素早い即応。' },
      bowPos: { label: '弓の位置', hint: 'ブリッジ寄り（鋭い）→ 指板寄り（柔らかい）。' },
      rosin: { label: '松脂ノイズ', hint: 'クリーン → ざらついた松脂ノイズ。' },
      hammer: {
        label: 'ハンマーの硬さ',
        hint: '柔らかいフェルト（丸い）→ 硬いハンマー（明るく鋭い）。',
      },
      detune: { label: 'うなり', hint: '純正なユニゾン → 広がったうなり。' },
      board: { label: '響板', hint: 'ドライ → 響板の豊かな鳴り。' },
      hardness: {
        label: 'マレットの硬さ',
        hint: '柔らかいマレット（丸い）→ 硬いマレット（明るい）。',
      },
      stretch: { label: '倍音の減衰差', hint: '倍音が揃って減衰 → 高音から先に消える。' },
      pitch: { label: '基音の高さ', hint: '低く深い → 高く締まった音。' },
      decay: { label: '余韻', hint: '締まった短い音 → 長く響く余韻。' },
      noise: { label: 'ノイズ量', hint: '純音 → アタックノイズ・空気感を増やす。' },
      noiseTone: { label: 'ノイズの明るさ', hint: '暗いノイズ → 明るく鋭いノイズ。' },
      shell: { label: '胴の共鳴', hint: '胴なし → 響く太鼓の胴。' },
      airflow: { label: '息の量', hint: '穏やかな風 → 満ちた強い風。' },
      reed: { label: 'リード感', hint: '純粋なフルー管 → バジー でリードらしい音。' },
      chiff: { label: '発音のかすれ', hint: 'クリーンな発音 → 息まじりのチフ。' },
      tremulant: { label: 'トレモロ', hint: '一定 → うねるトレムラント。' },
      breath: { label: '息の強さ', hint: '弱い息 → 強く大きな吹き込み。' },
      stiffness: { label: 'リードの硬さ', hint: '柔らかく丸いリード → 硬く明るいリード。' },
      breathiness: { label: '息ノイズ', hint: '芯のある音 → 息の音が聞こえる。' },
      brilliance: { label: '輝き', hint: '丸い音 → 金管らしく鳴り渡るキュイヴレ。' },
      lip: { label: 'リップの張り', hint: 'ゆるい唇（暗い）→ 締めた唇（明るい）。' },
      mute: { label: '弱音器', hint: '開いたベル → ミュートした鼻にかかった音。' },
      jet: { label: '息の当て方', hint: '低次倍音 → 明るくオーバーブローしたジェット。' },
      vibrato: { label: 'ビブラート', hint: '平坦 → 深く歌うビブラート。' },
      buzz: { label: 'ブリッジのバズ', hint: 'クリーンな撥弦 → シタール／タンプーラの煌めき。' },
    },
  },
  engines: {
    'karplus-strong': {
      label: 'カープラス・ストロング',
      blurb: '撥弦 — 減衰する遅延ループ。',
    },
    'bowed-string': { label: '擦弦', blurb: '摩擦で励振する導波管＋胴。' },
    piano: { label: 'ピアノ', blurb: '硬い弦・フェルトハンマー・響板。' },
    modal: { label: 'モーダル・マレット', blurb: '打棒／ベル — 共鳴体バンク。' },
    percussion: { label: '打楽器', blurb: '膜モード＋ノイズ＋胴。' },
    'pipe-organ': { label: 'パイプオルガン', blurb: '自励振のフルー管・マルチランク。' },
    reed: { label: 'リード', blurb: 'ボアに付くシングルリード。' },
    brass: { label: '金管', blurb: '広がるボアに付く唇リード。' },
    flute: { label: 'フルート', blurb: '歌口を横切る空気ジェット。' },
    'plucked-string': {
      label: '撥弦（バズブリッジ）',
      blurb: 'バズるブリッジの弦 — ハープ／琴／シタール。',
    },
    vocal: { label: 'ボーカル', blurb: '声門音源＋フォルマントバンク。' },
    'free-reed': {
      label: 'フリーリード',
      blurb: '駆動されるフリーリードの舌 — アコーディオン／ハーモニカ。',
    },
  },
  terms: {
    eyebrow: 'パラメーター',
    tipLabel: '回すと',
    linkLabel: 'シンセの資料',
    items: {
      // ---- アンプ／チェーン ----
      body: {
        title: '共鳴ボディ',
        body: '励振部が鳴らす共鳴体（なし／ギター／バイオリン／木管／金管ベル／ボーカル）。励振部が素の振動を作り、ボディがそれに色付けします（弦が箱を必要とするのと同じ）。',
        tip: '励振部とボディを組み合わせてハイブリッド楽器を作れます。',
      },
      bodyMix: {
        title: 'ボディ量',
        body: '素の励振音に共鳴ボディをどれだけ混ぜるかです。',
        tip: '上げると共鳴の効いたアコースティックな胴鳴り、0で素のモデル。',
      },
      drive: {
        title: 'ドライブ',
        body: '信号をソフトサチュレーションに押し込み、上げるほど温かみと倍音の歪みが増します。',
        tip: '上げると太く歪んだ音、0でクリーン。',
      },
      gain: {
        title: '出力ゲイン',
        body: 'ボイスの最終音量です。100%を超えるとクリップするのでピークメーターに注意します。',
        tip: 'ピークメーターが赤に振り切れない範囲に調整します。',
      },
      ampAttack: {
        title: 'アンプ・アタック',
        body: '鍵を押してから最大音量まで立ち上がる速さです。',
        tip: '短いと打撃的な立ち上がり、長いと柔らかく膨らみます。',
      },
      ampDecay: {
        title: 'アンプ・ディケイ',
        body: 'アタックのピーク直後に音量が落ち着いていく様子です。',
        tip: '打った直後の音量カーブを整えます。',
      },
      ampSustain: {
        title: 'アンプ・サステイン',
        body: '鍵を押している間に保持される音量です。100%でリリースまで最大音量を維持します。',
        tip: '下げるとアタック後に音量が落ちます。',
      },
      ampRelease: {
        title: 'アンプ・リリース',
        body: '鍵を離してから音が消えるまでの時間です。',
        tip: '長いと余韻を残し、短いとすぐ止まります。',
      },

      // ---- 共通（励振／弦）----
      brightness: {
        title: '明るさ',
        body: 'ループのフィルターを開閉し、音を明るく前に出したり、暗く丸くしたりします。',
        tip: '上げると鋭く抜ける音、下げると温かくこもった音。',
      },
      damping: {
        title: 'ダンピング',
        body: '弦や気柱が1周ごとに失うエネルギー量で、音色と余韻を左右する損失です。',
        tip: '上げると暗く短い音、下げると明るく良く響く音。',
      },
      attackMs: {
        title: 'アタック',
        body: 'ノートオンで励振（息や弓）が最大まで立ち上がる速さ（ミリ秒）です。',
        tip: '短いと鋭い立ち上がり、長いと緩やかに入ります。',
      },
      releaseMs: {
        title: 'リリース',
        body: 'ノートオフ後に励振が消えていく速さ（ミリ秒）です。',
        tip: '短いと急に止まり、長いと穏やかに消えます。',
      },
      decayS: {
        title: '減衰時間',
        body: '弾いた後、弦が消えるまで鳴り続ける長さ（秒）です。',
        tip: '長いと持続する余韻、短いとタイトなミュート弾き。',
      },
      decayStretch: {
        title: '減衰ストレッチ',
        body: '実際の弦のように高音を低音より速く減衰させます。0ですべての音が同じ長さ鳴ります。',
        tip: '上げると低音は伸び、高音は素早く消えます。',
      },
      releaseDampS: {
        title: 'リリース減衰',
        body: '鍵を離した後に音がミュートされる速さ（弦にダンパーが戻る動き）です。',
        tip: '短いと素早くミュート、長いと離しても余韻が残ります。',
      },
      velToBrightness: {
        title: 'ベロシティ→明るさ',
        body: '強く弾くほど音が明るくなる量。音量だけでなく音色も変化させます。',
        tip: '上げると強打が弱打よりはっきり明るくなります。',
      },
      polarization: {
        title: '偏波',
        body: '弦の2つの振動面をブレンドし、減衰にゆっくりしたうねりのきらめきを加えます。',
        tip: '上げると生き生きしたコーラス的な余韻、0で素直な減衰。',
      },
      dispersion: {
        title: '分散',
        body: '弦の硬さで倍音を高めにずらし（非整数倍音）、金属的でピアノ的な芯を与えます。',
        tip: '上げると硬いベル／ピアノ的な質感、0で理想的な弦。',
      },
      sympathetic: {
        title: '共鳴弦',
        body: 'ミュートしない弦を弾いた音に共鳴させ、響きの後光を加えます。',
        tip: 'オンでシタールやピアノのような背後の共鳴が付きます。',
      },

      // ---- カープラス・ストロング ----
      pickPosition: {
        title: 'ピック位置',
        body: '弦のどこを弾くか。ブリッジ寄りは細く鼻にかかった音、中央寄りは丸く豊かな音です。',
        tip: 'ブリッジ寄りで明るいツイン、中央で柔らかい胴鳴り。',
      },
      excBrightness: {
        title: 'ピックの明るさ',
        body: '弦がフィルターする前の、最初のピックノイズの明るさ＝アタックの鋭さです。',
        tip: '上げると鋭いアタック、下げると柔らかい指弾き。',
      },
      slap: {
        title: 'フレットスラップ',
        body: 'アタックに打撃的なフレット／指のスラップノイズを加えます。',
        tip: '少し加えるとファンク／ベース的な歯切れ、0でクリーン。',
      },
      bodyCoupling: {
        title: 'ブリッジ結合',
        body: '弦がブリッジや胴にどれだけ結合するか。共鳴が増え、余韻は短くなります。',
        tip: '上げると木質で共鳴する音、下げると長く純粋な余韻。',
      },
      pluckStyle: {
        title: '弾き方',
        body: 'ピックの形を、柔らかく丸いアタックから鋭く尖ったものへ変化させます。',
        tip: '上げるとピック弾き、下げると指先。',
      },
      nail: {
        title: '爪',
        body: 'ピックに明るい爪の鋭さを加えます（クラシックギターの爪と肉の違い）。',
        tip: '上げると鋭い爪のアタック、0で柔らかい肉の弾き。',
      },
      pickupPos: {
        title: 'ピックアップ位置',
        body: '仮想ピックアップが弦を拾う位置。倍音をコムフィルターで通り抜けさせます。',
        tip: '動かすと特定の倍音を削って音色を変えられます。',
      },
      tensionMod: {
        title: 'テンション変調',
        body: '強打で弦の張力が下がる際、実際の弦のようにピッチがわずかに動きます。',
        tip: '少し加えると自然なアタックの揺れ、0で安定したピッチ。',
      },
      octaveMix: {
        title: 'オクターブ 4′',
        body: '1オクターブ上に調律した弦を混ぜ、12弦のような豊かな音にします。',
        tip: '上げるときらめくオクターブ重ね、0で単弦。',
      },
      keyoffNoise: {
        title: 'キーオフノイズ',
        body: '音を離したときのリリースのクリック／トンという音を加えます。',
        tip: '少し加えるとリアル、0でリリースを無音に。',
      },

      // ---- 擦弦 ----
      bowPosition: {
        title: '弓の位置',
        body: '弓が弦に触れる位置。ブリッジ寄りは明るく鋭く（スル・ポンティチェロ）、離れると柔らか。',
        tip: 'ブリッジ寄りでざらついた明るいアタック、離すと滑らかな音。',
      },
      bowForce: {
        title: '弓圧',
        body: '弓の押し付けの強さ。弱いと滑って笛のよう、強いと潰れ、中間でよく歌います。',
        tip: '適所でクリーンな音、押し込むと荒く力んだ音。',
      },
      bowSpeed: {
        title: '弓速',
        body: '弓を引く速さ。上げるほど明るく大きくなります。',
        tip: '上げると元気で明るいストローク、下げると柔らかく暗い音。',
      },
      velToSpeed: {
        title: 'ベロシティ→弓速',
        body: '演奏の強弱が弓速をどれだけ動かすか。音量とアタックの勢いを結びます。',
        tip: '上げると強い音ほど速く明るく立ち上がります。',
      },
      rosin: {
        title: '松脂',
        body: '弓毛の粘りの質感を加え、アタックにざらつきを与えます。',
        tip: '少し加えると弓のアタックにリアルな噛みつきが出ます。',
      },
      elastoPlastic: {
        title: '弾塑性摩擦',
        body: 'より精密な摩擦モデルに切り替え、粘りと滑りが変化する繊細なアタックにします。',
        tip: 'オンで表情豊かで物理的に緻密な弓になります。',
      },
      stribeck: {
        title: 'ストライベック',
        body: '摩擦曲線の滑り方を形作り、弦が振動へ移る起こりやすさを調整します。',
        tip: '滑らかな出だしと、食いつく出だしの間で調整します。',
      },

      // ---- ピアノ ----
      strings: {
        title: 'ユニゾン弦',
        body: '1音あたりわずかにデチューンされた弦の本数（1〜3）。ピアノの豊かさとうねりの源です。',
        tip: '3で豊かなグランド、1で細いチェンバロ的な音。',
      },
      detuneCents: {
        title: 'デチューン',
        body: 'ユニゾン弦の調律のずれ幅。本物のピアノの緩やかなうねり／コーラスです。',
        tip: '大きいと生き生きしたきらめき、小さいと純粋な音。',
      },
      decayFastS: {
        title: '初期減衰',
        body: 'ハンマー打鍵直後の速い初期減衰（プロンプト音）の長さ（秒）です。',
        tip: '短いと弾けるアタック、長いと初期の胴鳴りを保ちます。',
      },
      decaySlowS: {
        title: 'アフターサウンド',
        body: '初期減衰の後も続く長い残響の長さ（秒）です。',
        tip: '長いと歌う持続音、短いと乾いた素早い音。',
      },
      strikePosition: {
        title: '打弦位置',
        body: 'ハンマーが弦を叩く位置。どの倍音が強く／欠けるかをコムフィルターで決めます。',
        tip: '動かして倍音バランスを調整します（約1/8が定番）。',
      },
      hammerExponent: {
        title: 'ハンマーフェルト',
        body: 'フェルトの硬さ曲線。柔らかいフェルトは丸く、硬いフェルトは明るく打撃的です。',
        tip: '上げると明るく攻撃的、下げると柔らかく温かいハンマー。',
      },
      hammerContactMs: {
        title: 'ハンマー接触',
        body: 'ハンマーが弦に触れている時間。長いほど最高倍音が削られます。',
        tip: '長いと丸い音、短いと明るい打撃。',
      },
      hammerDynamics: {
        title: 'ハンマー・ダイナミクス',
        body: '強打ほどフェルトが圧縮され明るくなる量。フォルテがピアノより噛みつきます。',
        tip: '上げると強弱による明るさの幅が広がります。',
      },
      soundboard: {
        title: '響板',
        body: '共鳴する響板の胴鳴りを混ぜ、温かみと自然な音の広がりを加えます。',
        tip: '上げると豊かなアコースティックな胴、0で乾いた直の弦。',
      },

      // ---- モーダル（マレット）----
      numModes: {
        title: 'モード数',
        body: 'バーやベルが鳴らす共鳴倍音の数。多いほど豊かで複雑な音色になります。',
        tip: '少ないと純粋なベル、多いと複雑な金属的音色。',
      },
      strikeBrightness: {
        title: 'マレットの硬さ',
        body: 'マレットの硬さ。硬いと高次モードが鳴り（明るくカンと）、柔らかいと穏やかです。',
        tip: '上げると硬く明るい打撃、下げると柔らかく丸い打撃。',
      },

      // ---- 管（共通）----
      breathPressure: {
        title: '息の圧力',
        body: '奏者がどれだけ強く吹くか。音量と明るさを決める安定した駆動圧です。',
        tip: '上げると大きく明るい吹奏、低すぎると音が鳴りません。',
      },
      velToBreath: {
        title: 'ベロシティ→息',
        body: '演奏の強弱が息の圧力をどれだけ動かすか。音量とタッチを結びます。',
        tip: '上げると強い音ほど強く明るく吹きます。',
      },
      breathNoise: {
        title: '息ノイズ',
        body: '吹奏に混じる息の空気の乱れです。',
        tip: '少しでリアル、多いと息づかいの効いた音。',
      },
      chiff: {
        title: 'チフ',
        body: '音の出だしにある小さな子音のような発音トランジェントです。',
        tip: '上げると明確なアタックの「チフ」、0で滑らかな出だし。',
      },
      chiffMs: {
        title: 'チフ時間',
        body: '定常音に落ち着くまでの、出だしのチフが続く長さです。',
        tip: '長いと遅く息っぽいアタック、短いと素早い出だし。',
      },
      conical: {
        title: '円錐ボア',
        body: '円筒は奇数倍音の空ろな音（クラリネット）、円錐は豊かな音（サックス／オーボエ）。',
        tip: 'オフでクラリネット的、オンでサックス的。',
      },

      // ---- リード ----
      reedStiffness: {
        title: 'リードの硬さ',
        body: 'リードの硬さ。硬いほど抵抗が増え、発音の仕方と明るさが変わります。',
        tip: '軽く暗いリードと、硬く明るいリードの間で調整します。',
      },
      reedOpening: {
        title: 'リード開度',
        body: '吹く前のリードの静止時の隙間。反応と強弱に影響します。',
        tip: '広いと自由で大きな音、狭いと制御された音。',
      },
      dynamicReed: {
        title: 'ダイナミックリード',
        body: 'リードを質量-バネの可動系としてモデル化し、より生き生きと反応する音にします。',
        tip: 'オンでより豊かでリアルなリードになります。',
      },
      reedResonance: {
        title: 'リード共鳴',
        body: 'リード自身のピッチ（ダイナミックリード時のみ）。その鳴き／フォルマントを調律します。',
        tip: 'ダイナミックリード時にリードの音色を調整します。',
      },
      registerVent: {
        title: 'レジスターベント',
        body: 'レジスターブレイクに向けて基音を減衰させ、高域の発音を助けます。',
        tip: '上げるとオーバーブロー側のレジスターへ寄せます。',
      },
      growl: {
        title: 'グロウル',
        body: '低速の可聴下の息の変調で、うなるような声質のテクスチャを加えます。',
        tip: '加えるとジャジーでざらついたグロウル、0でクリーン。',
      },
      coneGrowth: {
        title: 'コーン成長',
        body: '円錐ボアで、低域を形作る喉部のテーパー項です。',
        tip: '円錐ボアの低域の豊かさを調整します。',
      },
      tonehole: {
        title: 'トーンホール',
        body: 'ボア内の開いたトーンホール／レジスターキーの散乱接合で、音色に色を付けます。',
        tip: '上げると開孔／レジスターキー的な色付けを加えます。',
      },

      // ---- 金管 ----
      lipTension: {
        title: '唇の張力',
        body: 'ブザーのように鳴る唇の共鳴を音の周りで微調整＝アンブシュアの締まりです。',
        tip: '音がきれいに定まり鳴りやすくなるよう調整します。',
      },
      lipDamping: {
        title: '唇のダンピング',
        body: '低いと締まった明るいバズ、高いと穏やかで暗い音です。',
        tip: '下げると金管的に抜ける音、上げると柔らかく丸い音。',
      },
      brassiness: {
        title: '金管の輝き（キュイヴレ）',
        body: '振幅依存の衝撃波の鋭鋒化。金管を大きく吹いたときの明るい金属的な咆哮です。',
        tip: '上げるとフォルティッシモの咆哮、0で滑らかな音。',
      },
      cuivreDynamics: {
        title: 'キュイヴレ・ダイナミクス',
        body: '演奏の強弱が金管の輝きをどれだけ左右するか。強い音だけが咆哮します。',
        tip: '上げると最も強い音だけで咆哮が出ます。',
      },
      mute: {
        title: 'ミュート',
        body: '鼻にかかったミュートベルのフォルマントとピッチのしゃくり＝プランジャー／ハーマン的。',
        tip: '上げるとミュートした鼻声、0で開いたベル。',
      },
      halfValve: {
        title: 'ハーフバルブ',
        body: 'ループ損失の増加とわずかなデチューン＝半押しバルブの詰まった霞んだ音です。',
        tip: '加えるとファジーなハーフバルブ、0でクリーンなバルブ。',
      },
      dynamicLip: {
        title: 'ダイナミックリップ',
        body: '2つ目の横方向の唇モードを加え、より生き生きと複雑なバズにします。',
        tip: '上げると豊かで物理的な唇、0で単純なバズ。',
      },

      // ---- フルート ----
      jetRatio: {
        title: 'ジェット比',
        body: '空気ジェットとボアの遅延比＝パイプがどのレジスター（オクターブ）で鳴るかです。',
        tip: 'フルートの鳴るレジスターを選びます。',
      },
      jetReflection: {
        title: 'ジェット駆動',
        body: 'ジェットの駆動の強さ。0.5前後で安定、高いほど強く押します。',
        tip: '0.5付近で安定した音、上げると強く駆動されたジェット。',
      },
      endReflection: {
        title: '端部反射',
        body: '開いたボア端が音をどれだけ跳ね返すか。0.5前後で安定します。',
        tip: '0.5付近で安定、調整で共鳴をデチューンできます。',
      },
      vibratoRateHz: {
        title: 'ビブラート速度',
        body: '内蔵ビブラートの速さ（Hz）です。',
        tip: '速いと激しいビブラート、遅いと緩やかな波。',
      },
      vibratoDepth: {
        title: 'ビブラート深さ',
        body: 'ビブラートの振れ幅。0でビブラートを切ります。',
        tip: '深くすると歌うフルート、0でまっすぐな音。',
      },
      overblow: {
        title: 'オーバーブロー',
        body: 'ジェットを次のレジスターへ押し上げます＝吹き上げた音のはためきです。',
        tip: '上げると音を上のオクターブへ押し上げます。',
      },
      jetTurbulence: {
        title: 'ジェット乱流',
        body: '息っぽいジェットノイズをさらに整形し、より質感のある空気音にします。',
        tip: '上げると息づかいの効いた音、0で純粋な音。',
      },
      edgeHysteresis: {
        title: 'エッジヒステリシス',
        body: 'ジェットが遅れを伴いエッジを跨ぐ挙動をモデル化し、微妙な非線形性を加えます。',
        tip: '少しで有機的な不安定さ、0でクリーンなジェット。',
      },
      vortex: {
        title: '渦',
        body: 'リアルなエッジトーンの乱流のための離散渦ノイズ源です。',
        tip: '加えると生々しい息のエッジ、0で滑らかな音。',
      },

      // ---- パイプオルガン ----
      stopped: {
        title: 'ストップ管',
        body: 'パイプ端をふさぎます。ストップ管は1オクターブ低く空ろに鳴ります（奇数倍音のみ）。',
        tip: 'オンで柔らかく空ろなストップ・フルート、オフで開いた管。',
      },
      toneDecayS: {
        title: 'ボアの純度',
        body: '公称の鳴りが長いほど、純粋で持続的なパイプ音になります。',
        tip: '上げると純粋に歌うパイプ、下げると息っぽい音。',
      },
      breath: {
        title: '風の駆動',
        body: '風がパイプの唄口をどれだけ強く駆動するか＝音量と鋭さです。',
        tip: '上げると力強く明るい発音、下げると穏やかな声。',
      },
      reed: {
        title: 'リード感',
        body: 'リードパイプの質感＝リードストップのざらついた金管的な性格を混ぜます。',
        tip: '上げるとリード的なざらつくランク、0で滑らかなフルー管。',
      },
      radiation: {
        title: '放射',
        body: '唄口／放射の補正で、パイプの音の飛び方＝明るさと広がりを形作ります。',
        tip: 'より前に出る音か、遠い音かを調整します。',
      },
      keytrack: {
        title: '高音調整',
        body: 'ランク単位のキートラックで高音の鳴りを整えます。0でバイパスします。',
        tip: '上げると鍵盤全域で高音と低音のバランスを取ります。',
      },
      rankCount: {
        title: 'ランク数',
        body: '引き出すパイプランクの数（0で暗黙の8′ランク1本）＝レジストレーションの規模です。',
        tip: 'ランクを増やすと豊かなオルガンのレジストレーションに。',
      },
      tremulantRateHz: {
        title: 'トレムラント速度',
        body: 'トレムラントの風の脈動の速さ（Hz、0でオフ）です。',
        tip: '速いときらめくトレムラント、遅いと緩やかな揺れ。',
      },
      tremulantDepth: {
        title: 'トレムラント深さ',
        body: 'トレムラントが風をどれだけ深く変調するか。0で切ります。',
        tip: '深くするとビブラート的なオルガンの温かみ。',
      },
      windSag: {
        title: 'ウインドサグ',
        body: '負荷で風圧がどれだけ落ち込むか＝実際の送風の息っぽい沈み込みです。',
        tip: '上げると味のある不安定な風、0でびくともしない風。',
      },
      swell: {
        title: 'スウェルボックス',
        body: 'スウェルの扉を閉じる動作を模し、ランク全体をこもらせ和らげます。',
        tip: '上げると箱を閉じて遠くこもったオルガンに。',
      },

      // ---- 打楽器 ----
      gmKit: {
        title: 'GM ドラムキット',
        body: '各鍵を1つの調律された膜ではなく、General MIDI のドラム音に割り当てます。',
        tip: 'オンで鍵全域にドラムキット、オフで1つの調律できる太鼓。',
      },
      exclusiveClass: {
        title: 'ミュートグループ',
        body: '同じグループの音は互いを止めます（クローズ／オープンのハイハットなど）。0でなし。',
        tip: '互いを止め合うべき音（ハイハット等）をグループ化します。',
      },
      modeDecayS: {
        title: 'トーン減衰',
        body: '太鼓の音程を持つ膜のトーンが鳴る長さ（秒）です。',
        tip: '長いと共鳴するタム、短いとタイトで詰まった打音。',
      },
      toneGain: {
        title: 'トーン音量',
        body: '音程を持つ膜のレイヤーがミックス内でどれだけ大きいかです。',
        tip: '上げると音程感のある太鼓、下げるとアタックのノイズ重視。',
      },
      baseFreqHz: {
        title: '基本ピッチ',
        body: '太鼓の基音ピッチを Hz で上書きします（0で叩いた鍵の音程に追従）。',
        tip: '固定の太鼓ピッチにするか、0で半音階演奏。',
      },
      pitchDrop: {
        title: 'ピッチドロップ',
        body: '打撃時のピッチの行き過ぎが落ちてくる量＝調律タムの「ダウン」です。',
        tip: '上げると明確なピッチベンドのアタック、0で安定ピッチ。',
      },
      pitchDropMs: {
        title: 'ピッチドロップ時間',
        body: '打撃ピッチが基本ピッチへ戻るまでの時間です。',
        tip: '長いとゆっくり下がり、短いと素早く決まります。',
      },
      strikeR: {
        title: '打点半径',
        body: '太鼓を叩く位置。中心は純粋で低く響き、縁は複雑な倍音を引き出します。',
        tip: '中心で深い音、縁寄りで明るくよく鳴る打音。',
      },
      strikeTheta: {
        title: '打点角度',
        body: 'ヘッド上の打点の角度。どの非対称モードが鳴るかを方向づけます。',
        tip: '動かすと中心を外した打音の倍音の色が変わります。',
      },
      noiseGain: {
        title: 'ノイズ音量',
        body: 'トランジェントのノイズバーストの大きさ＝スティックやスナッピーの「クラック」です。',
        tip: '上げると歯切れよいノイズのアタック、0で純粋な音。',
      },
      noiseDecayMs: {
        title: 'ノイズ減衰',
        body: 'ノイズバーストが続く長さ（ミリ秒）です。',
        tip: '長いとウォッシュ／サイズル、短いとタイトなクリック。',
      },
      noiseCutoffHz: {
        title: 'ノイズの色',
        body: 'ノイズフィルターのカットオフ＝クラックのピッチと明るさです。',
        tip: '高いと明るいサイズル、低いと鈍い打音。',
      },
      noiseQ: {
        title: 'ノイズ Q',
        body: 'ノイズフィルターの狭さ。高い Q は1つのピッチで鳴り、低い Q は広帯域です。',
        tip: '上げると音程感のある鳴り、下げると広いクラック。',
      },
      shellMix: {
        title: 'シェル共鳴',
        body: '打音の上に太鼓の胴（シェル）の共鳴を混ぜます。0でバイパスします。',
        tip: '上げると木質で共鳴する胴、0でヘッドだけの純粋な音。',
      },
      shellNumModes: {
        title: 'シェルモード数',
        body: '胴（シェル）が加える共鳴モードの数です。',
        tip: '多いと複雑な共鳴胴、少ないと単純な胴。',
      },
      wireBuzz: {
        title: 'スナッピー',
        body: 'ヘッドに当たるスナッピー線のびびり。0でスナッピーなし（タム）になります。',
        tip: '上げるとタムをびびるスネアに、0で線なし。',
      },
      wireThreshold: {
        title: 'びびり閾値',
        body: 'スナッピー線がびびり始めるまでに必要な打撃の強さです。',
        tip: '低いと弱打でもびびり、高いと強打だけでびびります。',
      },
      wireCutoffHz: {
        title: 'びびりの色',
        body: 'スナッピーのびびりを鳴らすハイパスのカットオフ＝その明るさです。',
        tip: '高いと歯切れよいサイズル、低いと緩いびびり。',
      },
      shimmer: {
        title: 'シマー',
        body: '打撃エネルギーで駆動される非線形の高域ウォッシュ＝シンバルやゴングの湧き上がりです。',
        tip: '上げるとシンバル的に湧き上がるウォッシュ、0で乾いた打音。',
      },
      shimmerAttackMs: {
        title: 'シマー立ち上がり',
        body: '打撃後にシマーのウォッシュが湧き上がるまでの時間です。',
        tip: '長いと遅いゴングの盛り上がり、短いと即座のクラッシュ。',
      },
      shimmerCutoffHz: {
        title: 'シマーの色',
        body: 'シマー帯域のハイパスカットオフ＝ウォッシュがどれだけ高く空気感を持つかです。',
        tip: '高いと空気感のある艶、低いと厚みのあるウォッシュ。',
      },
      phisemBeans: {
        title: '粒子の数',
        body: '内部でびびる玉／粒子の数＝シェイカーやスクレイパーの密度です（0でオフ）。',
        tip: '多いと密なマラカス、少ないとまばらでカチカチしたシェイカー。',
      },
      phisemEnergyMs: {
        title: '振りのエネルギー',
        body: '1回の振りのエネルギーが、粒子が落ち着くまで続く長さです。',
        tip: '長いと持続する振り、短いと素早いひと振り。',
      },
      phisemSoundMs: {
        title: '粒の長さ',
        body: '1粒の衝突ごとのクリックの長さです。',
        tip: '長いと柔らかい玉、短いと鋭くチクッとした粒。',
      },
      phisemResHz: {
        title: 'ひょうたん共鳴',
        body: '粒子が鳴り抜ける共鳴体のピッチです（0で素のノイズ）。',
        tip: 'マラカス／カバサのひょうたん音に、0で乾いたびびり。',
      },
      phisemResQ: {
        title: '共鳴 Q',
        body: 'ひょうたんの共鳴の強さ。弱い（カバサ）〜強い（マラカス／ジングル）まで。',
        tip: '上げると音程感のある鳴り、下げると柔らかいウォッシュ。',
      },
      phisemScrapeHz: {
        title: 'こすり速度',
        body: 'スクレイパー（ギロ）の刻み速度です。0で純粋なランダムなシェイカー。',
        tip: '上げるとシェイカーがリズミカルなこすりに変わります。',
      },
      phisemPitchGlide: {
        title: 'ピッチグライド',
        body: '打撃後に共鳴ピッチが滑り落ちます＝クイーカの「泣き」です。',
        tip: '加えるとクイーカ的なピッチベンド、0で安定ピッチ。',
      },

      // ---- 撥弦（バズブリッジ）----
      buzz: {
        title: 'ブリッジのバズ',
        body: '湾曲したブリッジ（シタール／タンプーラのジャワリ）が周期ごとに弦をどれだけ制限し、高次倍音へエネルギーを撒くか。あの金属的で煌めくバズを生みます。0でクリーンな撥弦（ハープ／琴）。',
        tip: '上げるとシタール／タンプーラの煌めき、0でクリーンな撥弦。',
      },

      // ---- ボーカル（ソース・フィルター）----
      vowel: {
        title: '母音',
        body: 'フォルマントバンクが歌う母音 — /a/ /e/ /i/ /o/ /u/（0〜4）。それぞれ、歌声を決める共鳴ピークの位置を動かします。',
        tip: '母音を切り替えて歌声の音色を作り替えます。',
      },

      // ---- フリーリード（アコーディオン／ハーモニカ）----
      detune: {
        title: 'ミュゼットのうなり',
        body: '1音あたり2枚のリード舌をどれだけ離してチューニングするか — アコーディオンの濡れた煌めくうなり。0で単一のドライな舌。',
        tip: '上げると広く濡れたミュゼット、0で単一の純粋なリード。',
      },
    },
  },
};
