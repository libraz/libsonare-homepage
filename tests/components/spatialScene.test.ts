import { describe, expect, it } from 'vitest';
import { sceneCoords, truthMarkerCoords } from '@/components/spatial/RoomScene.vue';
import type { ScanResult } from '@/workers/spatial.worker';

describe('spatial scene geometry mapping', () => {
  it('centers a room point on the given room dimensions', () => {
    // A point at the room's floor center maps to the scene origin (x/z centered).
    expect(sceneCoords({ x: 5, y: 4, z: 0 }, { length: 10, width: 8 })).toEqual([0, 0, 0]);
    // libsonare z (height) becomes the scene's up axis.
    expect(sceneCoords({ x: 5, y: 4, z: 1.5 }, { length: 10, width: 8 })).toEqual([0, 1.5, 0]);
  });

  it('maps the truth source marker using the truth room dims, not the estimated room', () => {
    const res = {
      room: { length: 10, width: 8, height: 3, volume: 240 },
      truth: {
        room: { length: 4, width: 3, height: 2.5 },
        // At the center of the (much smaller) truth room.
        source: { x: 2, y: 1.5, z: 1 },
        listener: { x: 0, y: 0, z: 0 },
      },
    } as unknown as ScanResult;

    // Centered on the truth room → sits at its box center, staying inside the dashed box.
    expect(truthMarkerCoords(res)).toEqual([0, 1, 0]);
    // The previous bug centered on the estimated room, floating the marker away.
    expect(truthMarkerCoords(res)).not.toEqual(sceneCoords(res.truth!.source, res.room));
  });

  it('returns null when there is no truth overlay', () => {
    const res = { room: { length: 6, width: 4, height: 3, volume: 72 }, truth: null };
    expect(truthMarkerCoords(res as unknown as ScanResult)).toBeNull();
  });
});
