using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Local FunASR speech recognition service.
    ///
    /// Manages the funasr_server.exe subprocess (Python → PyInstaller),
    /// sends PCM/WAV audio via HTTP, and receives recognized text.
    ///
    /// Audio format: 16kHz, 16-bit, mono PCM (same as MicrophoneCapture).
    /// </summary>
    public sealed class FunASRService : LocalServiceBase
    {
        #region LocalServiceBase Overrides

        public override string ServiceName => "FunASR";
        protected override string ExeName => "funasr_server.exe";
        protected override int DefaultPort => 8766;
        protected override string HealthEndpoint => "/health";

        #endregion

        #region Events

        public event Action<string> OnTranscript;
        public event Action<string> OnPartialResult; // for streaming (future)

        #endregion

        #region Inspector

        [Header("FunASR Settings")]
        [SerializeField, Range(0.5f, 10f)]
        private float _recognitionTimeout = 5f;

        #endregion

        #region Public API

        /// <summary>
        /// Send raw PCM16 audio bytes for recognition. Returns the recognized text.
        /// Call this after VAD detects end of speech.
        /// </summary>
        public async Task<string> RecognizeAsync(byte[] pcm16Audio)
        {
            if (!IsReady)
            {
                Debug.LogWarning("[FunASR] Service not ready, cannot recognize.");
                return null;
            }

            if (pcm16Audio == null || pcm16Audio.Length == 0)
                return "";

            try
            {
                // Wrap PCM in minimal WAV header for broader model compatibility
                byte[] wavData = CreateWavFromPcm(pcm16Audio, sampleRate: 16000, channels: 1, bitsPerSample: 16);

                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(_recognitionTimeout) };
                var content = new ByteArrayContent(wavData);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/wav");

                var resp = await client.PostAsync($"http://127.0.0.1:{DefaultPort}/recognize", content);
                string json = await resp.Content.ReadAsStringAsync();

                if (resp.IsSuccessStatusCode)
                {
                    var result = JsonUtility.FromJson<RecognizeResult>(json);
                    string text = result?.text ?? "";
                    if (!string.IsNullOrEmpty(text))
                    {
                        Debug.Log($"[FunASR] Recognized: \"{text}\"");
                        OnTranscript?.Invoke(text);
                    }
                    return text;
                }
                else
                {
                    Debug.LogError($"[FunASR] Recognition failed: {resp.StatusCode} — {json}");
                    return null;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[FunASR] Request error: {ex.Message}");
                return null;
            }
        }

        /// <summary>Recognize from float audio samples (convenience overload).</summary>
        public async Task<string> RecognizeAsync(float[] samples, int sampleRate = 16000)
        {
            // Resample if needed
            float[] resampled = sampleRate == 16000 ? samples : Resample(samples, sampleRate, 16000);

            // Convert float to PCM16
            byte[] pcm = new byte[resampled.Length * 2];
            for (int i = 0; i < resampled.Length; i++)
            {
                short s = (short)(Mathf.Clamp(resampled[i], -1f, 1f) * 32767f);
                pcm[i * 2] = (byte)(s & 0xFF);
                pcm[i * 2 + 1] = (byte)((s >> 8) & 0xFF);
            }

            return await RecognizeAsync(pcm);
        }

        #endregion

        #region Helpers

        [Serializable]
        private class RecognizeResult
        {
            public string text;
        }

        /// <summary>Create minimal WAV file bytes from raw PCM16 data.</summary>
        private static byte[] CreateWavFromPcm(byte[] pcmData, int sampleRate, int channels, int bitsPerSample)
        {
            int byteRate = sampleRate * channels * (bitsPerSample / 8);
            int blockAlign = channels * (bitsPerSample / 8);
            int dataSize = pcmData.Length;
            int fileSize = 44 + dataSize;

            byte[] wav = new byte[fileSize];
            // RIFF header
            System.Buffer.BlockCopy(Encoding.ASCII.GetBytes("RIFF"), 0, wav, 0, 4);
            System.Buffer.BlockCopy(BitConverter.GetBytes(fileSize - 8), 0, wav, 4, 4);
            System.Buffer.BlockCopy(Encoding.ASCII.GetBytes("WAVE"), 0, wav, 8, 4);
            // fmt chunk
            System.Buffer.BlockCopy(Encoding.ASCII.GetBytes("fmt "), 0, wav, 12, 4);
            System.Buffer.BlockCopy(BitConverter.GetBytes(16), 0, wav, 16, 4);       // chunk size
            System.Buffer.BlockCopy(BitConverter.GetBytes((short)1), 0, wav, 20, 2);   // PCM
            System.Buffer.BlockCopy(BitConverter.GetBytes((short)channels), 0, wav, 22, 2);
            System.Buffer.BlockCopy(BitConverter.GetBytes(sampleRate), 0, wav, 24, 4);
            System.Buffer.BlockCopy(BitConverter.GetBytes(byteRate), 0, wav, 28, 4);
            System.Buffer.BlockCopy(BitConverter.GetBytes((short)blockAlign), 0, wav, 32, 2);
            System.Buffer.BlockCopy(BitConverter.GetBytes((short)bitsPerSample), 0, wav, 34, 2);
            // data chunk
            System.Buffer.BlockCopy(Encoding.ASCII.GetBytes("data"), 0, wav, 36, 4);
            System.Buffer.BlockCopy(BitConverter.GetBytes(dataSize), 0, wav, 40, 4);
            System.Buffer.BlockCopy(pcmData, 0, wav, 44, dataSize);

            return wav;
        }

        /// <summary>Simple linear resampling (for non-16kHz sources).</summary>
        private static float[] Resample(float[] input, int fromRate, int toRate)
        {
            if (fromRate == toRate) return input;
            float ratio = (float)fromRate / toRate;
            int outputLen = Mathf.RoundToInt(input.Length / ratio);
            float[] output = new float[outputLen];
            for (int i = 0; i < outputLen; i++)
            {
                float srcIndex = i * ratio;
                int idx0 = Mathf.FloorToInt(srcIndex);
                int idx1 = Mathf.Min(idx0 + 1, input.Length - 1);
                float frac = srcIndex - idx0;
                output[i] = Mathf.Lerp(input[idx0], input[idx1], frac);
            }
            return output;
        }

        #endregion
    }
}
