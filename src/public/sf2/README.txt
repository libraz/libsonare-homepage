acoustic-grand.sf2
==================

The acoustic-grand piano (bank 0 / program 0) used by the Piano Practice demo
(/practice). Bundled and served as a static asset; loaded at runtime by the
libsonare SoundFont player.

This is a single-preset subset: the demo only plays program 0, so the upstream
full General MIDI bank (~5.5 MB, ~190 unused instruments) is reduced to just the
grand piano's samples with `scripts/trim-practice-sf2.mjs`. The kept samples are
copied byte-for-byte, so the piano sounds identical to the source bank. To
regenerate, download the upstream bank below and run:

        node scripts/trim-practice-sf2.mjs <upstream-full-bank>.sf2 \
             src/public/sf2/acoustic-grand.sf2

Source: "005.6mg Aspirin Stereo V1.2 Bank"
        https://musical-artifacts.com/artifacts/1808
License: Public Domain (the SoundFont file itself is public domain; the
         artifact page text on musical-artifacts.com is CC-BY-SA 4.0, which
         does not apply to this binary).

The project source is Apache-2.0; this public-domain font is bundled without
additional restriction.
