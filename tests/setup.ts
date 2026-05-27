// Stubs for browser APIs that demo composables touch but jsdom lacks.
import { beforeEach, vi } from 'vitest';

function installUrlMocks() {
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

installUrlMocks();

beforeEach(() => {
  installUrlMocks();
});
