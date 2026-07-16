// Stubs for browser APIs that demo composables touch but jsdom lacks.
import { beforeEach, vi } from 'vitest';

function installUrlMocks() {
  if (typeof URL === 'undefined') return;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:test'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

function createCanvasContextMock() {
  const state: Record<string, unknown> = {
    canvas: null,
    fillStyle: '#000',
    font: '10px sans-serif',
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: 'transparent',
    strokeStyle: '#000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === 'getImageData') {
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      }
      if (key === 'createImageData') {
        return (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        });
      }
      if (key === 'measureText') {
        return (text: string) => ({ width: String(text).length * 6 });
      }
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop: vi.fn() });
      }
      if (key === 'createPattern') return () => null;
      return vi.fn();
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  });
}

function installCanvasMocks() {
  if (typeof HTMLCanvasElement === 'undefined') return;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn((contextId: string) => {
      if (contextId === '2d') return createCanvasContextMock();
      return null;
    }),
  });
}

installUrlMocks();
installCanvasMocks();

beforeEach(() => {
  installUrlMocks();
  installCanvasMocks();
});
