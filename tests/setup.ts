// Setup global pour les tests — mock de Three.js et du canvas WebGL
import { vi } from "vitest";

// Mock canvas WebGL (pas disponible dans jsdom)
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => ({
    getParameter: () => 0,
    getExtension: () => null,
    createShader: () => ({}),
    shaderSource:  () => {},
    compileShader: () => {},
    createProgram: () => ({}),
    attachShader:  () => {},
    linkProgram:   () => {},
  }),
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe:   vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
