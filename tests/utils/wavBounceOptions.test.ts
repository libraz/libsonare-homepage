import { describe, expect, it } from 'vitest';
import { WAV_DITHERS, WAV_FORMATS, wavBounceOptions } from '@/utils/audio';

describe('wavBounceOptions', () => {
  it.each(WAV_FORMATS.flatMap((format) => WAV_DITHERS.map((dither) => [format, dither] as const)))(
    'maps %s with %s dither to the bounce options',
    (format, dither) => {
      const options = wavBounceOptions(format, dither);
      if (format === 'float32' || dither === 'none') {
        expect(options).toEqual({ dither: 0 });
        return;
      }
      expect(options).toEqual({
        dither: dither === 'tpdf' ? 2 : 3,
        ditherBits: format === 'pcm16' ? 16 : 24,
      });
    },
  );

  it('maps word length and dither onto the bounce options', () => {
    expect(wavBounceOptions('pcm16', 'tpdf')).toEqual({ dither: 2, ditherBits: 16 });
    expect(wavBounceOptions('pcm24', 'noiseShaped')).toEqual({ dither: 3, ditherBits: 24 });
    expect(wavBounceOptions('pcm24', 'none')).toEqual({ dither: 0 });
    expect(wavBounceOptions('float32', 'tpdf')).toEqual({ dither: 0 });
  });
});
