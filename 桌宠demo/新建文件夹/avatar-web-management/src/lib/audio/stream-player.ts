// Chunked audio streaming player — sequential HTMLAudioElement queue
// Plays TTS audio chunks in order as they arrive from the SSE stream.

type AudioChunk = {
  id: number;
  blobUrl: string;
};

type QueueCallback = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
};

export class AudioStreamPlayer {
  private queue: AudioChunk[] = [];
  private current: HTMLAudioElement | null = null;
  private nextId = 0;
  private playing = false;
  private destroyed = false;

  /** Enqueue a PCM/WAV audio chunk (raw bytes) for playback. */
  enqueue(audioBytes: Uint8Array): void {
    if (this.destroyed) return;

    const blob = new Blob([audioBytes as BlobPart], { type: 'audio/wav' });
    const blobUrl = URL.createObjectURL(blob);
    this.queue.push({ id: this.nextId++, blobUrl });

    if (!this.playing) {
      this.playNext();
    }
  }

  /** Stop playback and clear the queue. */
  stop(): void {
    this.queue.length = 0;
    if (this.current) {
      this.current.pause();
      this.cleanupCurrent();
    }
    this.playing = false;
  }

  /** Cancel everything and release resources. */
  destroy(): void {
    this.destroyed = true;
    this.stop();
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  /** Abort and start fresh. */
  reset(): void {
    this.stop();
    this.nextId = 0;
  }

  private playNext(): void {
    if (this.destroyed || this.queue.length === 0) {
      this.playing = false;
      return;
    }

    const chunk = this.queue.shift()!;
    const audio = new Audio(chunk.blobUrl);
    this.current = audio;
    this.playing = true;

    const cleanup = () => {
      URL.revokeObjectURL(chunk.blobUrl);
      this.current = null;
    };

    audio.onended = () => {
      cleanup();
      this.playNext();
    };

    audio.onerror = () => {
      cleanup();
      // Skip broken chunks silently, continue queue
      this.playNext();
    };

    audio.play().catch(() => {
      // Autoplay blocked — queue is still valid, will try next
      cleanup();
      this.playNext();
    });
  }

  private cleanupCurrent(): void {
    if (!this.current) return;
    this.current.pause();
    this.current.onended = null;
    this.current.onerror = null;
    try {
      URL.revokeObjectURL(this.current.src);
    } catch { /* already revoked */ }
    this.current = null;
  }
}

// Singleton for pet preview
let _player: AudioStreamPlayer | null = null;

export function getAudioStreamPlayer(): AudioStreamPlayer {
  if (!_player) {
    _player = new AudioStreamPlayer();
  }
  return _player;
}
