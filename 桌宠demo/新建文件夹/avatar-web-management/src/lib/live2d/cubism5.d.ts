/**
 * Type declaration for the compiled Live2D Cubism SDK JS bundle.
 * The actual implementation is in cubism5.js (compiled from C++ via Emscripten).
 */
declare module '@/lib/live2d/cubism5.js' {
  import type { Live2DAppDelegate } from './adapter';

  export const AppDelegate: new () => Live2DAppDelegate;
}
