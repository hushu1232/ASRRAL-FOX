const mockSendChatMessageStream = jest.fn();
const mockPlayer = {
  isPlaying: false,
  reset: jest.fn(),
  enqueue: jest.fn(),
  stop: jest.fn(),
};

jest.mock('@/lib/api/pet-chat', () => ({
  sendChatMessageStream: mockSendChatMessageStream,
  fetchPetPreviewConfig: jest.fn(),
}));

jest.mock('@/lib/audio/stream-player', () => ({
  getAudioStreamPlayer: () => mockPlayer,
}));

import { usePetPreviewStore } from '@/stores/petPreviewStore';

describe('pet preview chat stream lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    usePetPreviewStore.setState({
      messages: [],
      isProcessing: false,
      voiceState: 'idle',
      streamAbortController: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves as soon as the SSE done event arrives', async () => {
    const abort = jest.fn();
    mockSendChatMessageStream.mockImplementationOnce((_message, _history, callbacks) => {
      callbacks.onDone({ text: '', emotion: 'neutral' });
      return { abort } as unknown as AbortController;
    });

    const sendPromise = usePetPreviewStore.getState().sendMessage('hello');
    await expect(sendPromise).resolves.toBeUndefined();
    expect(abort).not.toHaveBeenCalled();
    expect(usePetPreviewStore.getState().isProcessing).toBe(false);
  });
});
