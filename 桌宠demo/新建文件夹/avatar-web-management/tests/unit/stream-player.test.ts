// AudioStreamPlayer unit tests
import { AudioStreamPlayer } from '../../src/lib/audio/stream-player';

// Mock HTMLAudioElement
class MockAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();

  constructor(src: string) {
    this.src = src;
  }
}

// @ts-expect-error — partial mock
globalThis.Audio = MockAudio;
globalThis.URL.createObjectURL = jest.fn(() => 'blob:test');
globalThis.URL.revokeObjectURL = jest.fn();

describe('AudioStreamPlayer', () => {
  let player: AudioStreamPlayer;

  beforeEach(() => {
    player = new AudioStreamPlayer();
    jest.clearAllMocks();
  });

  afterEach(() => {
    player.destroy();
  });

  it('starts idle', () => {
    expect(player.isPlaying).toBe(false);
    expect(player.queueLength).toBe(0);
  });

  it('enqueue creates blob URL and starts playing', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    player.enqueue(bytes);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(player.isPlaying).toBe(true);
  });

  it('stop clears queue and pauses', () => {
    player.enqueue(new Uint8Array([1]));
    player.stop();

    expect(player.isPlaying).toBe(false);
    expect(player.queueLength).toBe(0);
  });

  it('reset clears everything', () => {
    player.enqueue(new Uint8Array([1]));
    player.enqueue(new Uint8Array([2]));
    player.reset();

    expect(player.isPlaying).toBe(false);
    expect(player.queueLength).toBe(0);
  });

  it('destroy prevents further enqueue', () => {
    player.destroy();
    player.enqueue(new Uint8Array([1]));

    expect(player.isPlaying).toBe(false);
    expect(player.queueLength).toBe(0);
    // createObjectURL should not have been called
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('enqueue while playing adds to queue', () => {
    // Start first chunk (calls play which resolves immediately)
    player.enqueue(new Uint8Array([1]));
    expect(player.isPlaying).toBe(true);

    // Enqueue second chunk — should go to internal queue
    player.enqueue(new Uint8Array([2]));
    // Queue length check (first chunk already shifted out)
    expect(player.queueLength).toBe(1);
  });
});
