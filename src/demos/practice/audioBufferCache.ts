export interface AudioBufferCache<TBuffer = AudioBuffer> {
  get(speed: number): TBuffer | undefined;
  set(speed: number, buffer: TBuffer): void;
  clear(): void;
  setPieceKey(pieceKey: string): void;
}

export function createAudioBufferCache<TBuffer = AudioBuffer>(
  initialPieceKey: string,
  maxEntries: number,
): AudioBufferCache<TBuffer> {
  let pieceKey = initialPieceKey;
  const buffers = new Map<string, TBuffer>();

  function cacheKey(speed: number): string {
    return `${pieceKey}:${speed}`;
  }

  return {
    get(speed: number): TBuffer | undefined {
      const key = cacheKey(speed);
      const buffer = buffers.get(key);
      if (buffer) {
        buffers.delete(key);
        buffers.set(key, buffer);
      }
      return buffer;
    },
    set(speed: number, buffer: TBuffer): void {
      buffers.set(cacheKey(speed), buffer);
      while (buffers.size > maxEntries) {
        const oldest = buffers.keys().next().value;
        if (oldest === undefined) break;
        buffers.delete(oldest);
      }
    },
    clear(): void {
      buffers.clear();
    },
    setPieceKey(nextPieceKey: string): void {
      pieceKey = nextPieceKey;
    },
  };
}
