/**
 * The loudness-fit orchestration over model bounces: at most three bounces,
 * a third only when bounce two misses by more than 0.3 LU, and "limited" when
 * the final residual exceeds 0.5 LU.
 */
import { describe, expect, it } from 'vitest';
import {
  fitLoudness,
  LOUDNESS_FIT_LIMITED_LU,
  LOUDNESS_FIT_MAX_BOUNCES,
  type LoudnessFitBounceRequest,
} from '@/demos/mastering/masteringLoudnessFit';

/**
 * A master whose open (limiter bypassed) loudness is `open + drive`; the
 * limiter takes back `squash` per dB of drive above `knee`, and no amount of
 * drive gets past `wall`.
 */
function model(open: number, knee: number, squash: number, wall = 0) {
  const calls: LoudnessFitBounceRequest[] = [];
  const bounce = (request: LoudnessFitBounceRequest) => {
    calls.push(request);
    const level = open + request.driveDb;
    if (request.limiterBypassed) return level;
    return Math.min(wall, level - squash * Math.max(0, request.driveDb - knee));
  };
  return { bounce, calls };
}

describe('fitLoudness', () => {
  it('opens with the limiter bypassed at drive 0', async () => {
    const { bounce, calls } = model(-20, 100, 0);
    await fitLoudness({ targetLufs: -14, bounce });
    expect(calls[0]).toEqual({ driveDb: 0, limiterBypassed: true });
    expect(calls.slice(1).every((call) => !call.limiterBypassed)).toBe(true);
  });

  it('stops after two bounces when the limiter barely touches the level', async () => {
    const { bounce } = model(-20, 5.9, 0.4);
    const fit = await fitLoudness({ targetLufs: -14, bounce });
    expect(fit.bounces).toBe(2);
    expect(Math.abs(fit.residualLu)).toBeLessThanOrEqual(0.3);
    expect(fit.driveDb).toBe(6);
    expect(fit.limited).toBe(false);
  });

  it('corrects once more when the limiter eats more than 0.3 LU', async () => {
    const { bounce, calls } = model(-20, 3, 0.4);
    const fit = await fitLoudness({ targetLufs: -14, bounce });
    expect(fit.bounces).toBe(3);
    expect(calls).toHaveLength(LOUDNESS_FIT_MAX_BOUNCES);
    // Bounce 2 measured -15.2 at drive 6; bounce 3 adds the 1.2 LU it missed
    // and lands 0.48 LU short, inside the 0.5 LU reach tolerance.
    expect(fit.driveDb).toBeCloseTo(7.2, 9);
    expect(fit.measuredLufs).toBeCloseTo(-14.48, 9);
    expect(fit.residualLu).toBeCloseTo(0.48, 9);
    expect(fit.limited).toBe(false);
  });

  it('converges when the limiter only shaves a little', async () => {
    const { bounce } = model(-18, 2, 0.2);
    const fit = await fitLoudness({ targetLufs: -14, bounce });
    expect(fit.bounces).toBe(3);
    expect(Math.abs(fit.residualLu)).toBeLessThanOrEqual(LOUDNESS_FIT_LIMITED_LU);
    expect(fit.limited).toBe(false);
  });

  it('reports a target the limiter cannot reach as limited', async () => {
    const { bounce } = model(-20, 0, 0, -9);
    const fit = await fitLoudness({ targetLufs: -6, bounce });
    expect(fit.bounces).toBe(3);
    expect(fit.measuredLufs).toBe(-9);
    expect(fit.residualLu).toBe(3);
    expect(fit.limited).toBe(true);
  });

  it('turns a master louder than its target down', async () => {
    const { bounce } = model(-8, 100, 0);
    const fit = await fitLoudness({ targetLufs: -14, bounce });
    expect(fit.driveDb).toBe(-6);
    expect(fit.residualLu).toBe(0);
    expect(fit.bounces).toBe(2);
  });

  it('rejects a silent programme', async () => {
    await expect(
      fitLoudness({ targetLufs: -14, bounce: () => Number.NEGATIVE_INFINITY }),
    ).rejects.toThrow(/silent/);
  });

  it('stops when a bounce rejects', async () => {
    let calls = 0;
    const bounce = () => {
      calls++;
      if (calls === 2) throw new Error('cancelled');
      return -20;
    };
    await expect(fitLoudness({ targetLufs: -14, bounce })).rejects.toThrow('cancelled');
    expect(calls).toBe(2);
  });
});
