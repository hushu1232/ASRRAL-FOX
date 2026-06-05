using System;

namespace AstralFox.Voice
{
    /// <summary>
    /// Unified voice interaction pipeline interface.
    ///
    /// Concrete implementations:
    ///   BackendClient       — cloud AI via WebSocket to Python BFF
    ///   AIManager           — offline AI (FunASR + local LLM + local TTS)
    ///   MockVoicePipeline   — canned responses for testing
    ///
    /// VoiceManager depends on this interface, not on any concrete type.
    /// </summary>
    public interface IVoicePipeline
    {
        bool IsConnected { get; }
        event Action<bool> OnConnectionChanged;
        event Action<string> OnFinalTranscript;
        event Action<string> OnLLMToken;
        event Action<string> OnEmotionTag;
        event Action<string> OnActionTag;
        event Action<string> OnLLMResponse;
        event Action<int, byte[]> OnTTSAudio;
        event Action<int, byte[]> OnTTSWavAudio;
        event Action OnTTSDone;
        event Action<string, string> OnReminder;
        event Action<string> OnError;
        event Action OnReconnected;

        void SendAudio(float[] samples, int sampleRate, int channels);
        System.Threading.Tasks.Task SendTextAsync(string contextJson);
        System.Threading.Tasks.Task FlushAudioAsync();
        System.Threading.Tasks.Task DisconnectAsync();
    }
}
