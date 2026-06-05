using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Dual-engine TTS service.
    ///
    /// Supports two backends controlled by AppConfig.tts_engine:
    ///   "sherpa-onnx" — local offline engine via tts_server.exe subprocess (default)
    ///   "gpt-sovits"  — custom voice engine via BFF proxy to GPT-SoVITS Docker service
    ///
    /// Output: 16-bit PCM WAV, converted to Unity AudioClip.
    /// </summary>
    public sealed class TTSService : LocalServiceBase
    {
        #region LocalServiceBase Overrides (sherpa-onnx only)

        public override string ServiceName => "TTS";
        protected override string ExeName => "tts_server.exe";
        protected override int DefaultPort => 8767;
        protected override string HealthEndpoint => "/health";

        #endregion

        #region Events

        /// <summary>Fired with the generated AudioClip. null on failure.</summary>
        public event Action<AudioClip> OnSpeechReady;

        /// <summary>Fired with raw WAV bytes for external processing.</summary>
        public event Action<byte[], int> OnWavGenerated; // wavBytes, sampleRate

        #endregion

        #region Inspector

        [Header("TTS Settings")]
        [SerializeField, Range(0, 9)]
        private int _speakerId = 0;

        [SerializeField, Range(0.5f, 2f)]
        private float _speed = 1.0f;

        [SerializeField, Range(5f, 30f)]
        private float _synthesisTimeout = 10f;

        [Header("GPT-SoVITS (remote)")]
        [SerializeField]
        private float _gptSovitsTimeout = 30f;

        [Header("Audio Output")]
        [SerializeField, Range(8000, 48000)]
        private int _outputSampleRate = 16000;

        #endregion

        #region Private Fields

        private HttpClient _httpClient;
        private Config.AppConfig _config;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _httpClient = new HttpClient();
        }

        protected override void Start()
        {
            base.Start();
            _config = Config.ConfigManager.Instance.CurrentConfig;
        }

        protected override void OnDestroy()
        {
            _httpClient?.Dispose();
            base.OnDestroy();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Synthesize speech from text. Routes to sherpa-onnx or GPT-SoVITS
        /// based on AppConfig.tts_engine.
        /// </summary>
        public async Task<AudioClip> SpeakAsync(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return null;

            // Refresh config (may have been updated via settings UI)
            _config = Config.ConfigManager.Instance.CurrentConfig;

            if (_config.IsGptSovitsMode)
                return await SpeakGptSovitsAsync(text);
            else
                return await SpeakSherpaOnnxAsync(text);
        }

        /// <summary>Change the speaker voice (sherpa-onnx only).</summary>
        public void SetSpeaker(int speakerId)
        {
            _speakerId = Mathf.Clamp(speakerId, 0, 9);
        }

        /// <summary>Adjust speaking speed. 1.0 = normal, 0.5 = slow, 2.0 = fast.</summary>
        public void SetSpeed(float speed)
        {
            _speed = Mathf.Clamp(speed, 0.5f, 2f);
        }

        #endregion

        #region Sherpa-onnx (Local Offline)

        private async Task<AudioClip> SpeakSherpaOnnxAsync(string text)
        {
            if (!IsReady)
            {
                Debug.LogWarning("[TTS] Local sherpa-onnx service not ready.");
                return null;
            }

            try
            {
                var payload = new SynthesizeRequest
                {
                    text = text,
                    speaker_id = _speakerId,
                    speed = _speed,
                };
                string json = JsonUtility.ToJson(payload);

                using var cts = new System.Threading.CancellationTokenSource(
                    TimeSpan.FromSeconds(_synthesisTimeout));
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var resp = await _httpClient.PostAsync(
                    $"http://127.0.0.1:{DefaultPort}/synthesize", content, cts.Token);

                if (resp.IsSuccessStatusCode)
                {
                    byte[] wavBytes = await resp.Content.ReadAsByteArrayAsync();
                    int sampleRate = _outputSampleRate;

                    if (resp.Headers.TryGetValues("X-Sample-Rate", out var srVals))
                    {
                        foreach (string v in srVals)
                            if (int.TryParse(v, out int sr)) { sampleRate = sr; break; }
                    }

                    OnWavGenerated?.Invoke(wavBytes, sampleRate);
                    var clip = WavToAudioClip(wavBytes, sampleRate);
                    if (clip != null)
                    {
                        Debug.Log($"[TTS:sherpa-onnx] Generated clip: {clip.length:F1}s " +
                                  $"for: \"{text.Substring(0, Math.Min(text.Length, 30))}\"");
                        OnSpeechReady?.Invoke(clip);
                    }
                    return clip;
                }
                else
                {
                    string err = await resp.Content.ReadAsStringAsync();
                    Debug.LogError($"[TTS:sherpa-onnx] Synthesis failed: {resp.StatusCode} — {err}");
                    return null;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TTS:sherpa-onnx] Request error: {ex.Message}");
                return null;
            }
        }

        #endregion

        #region GPT-SoVITS (Remote via BFF)

        private async Task<AudioClip> SpeakGptSovitsAsync(string text)
        {
            try
            {
                string url = $"{_config.gpt_sovits_url}/synthesize";
                var payload = new SynthesizeRequest
                {
                    text = text,
                    speaker_id = _speakerId,
                    speed = _speed,
                };

                // Add voice_id if configured
                string json = JsonUtility.ToJson(payload);

                using var cts = new System.Threading.CancellationTokenSource(
                    TimeSpan.FromSeconds(_gptSovitsTimeout));
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Add custom voice header
                var req = new HttpRequestMessage(HttpMethod.Post, url);
                req.Content = content;
                if (!string.IsNullOrEmpty(_config.custom_voice_id))
                {
                    req.Headers.Add("X-Custom-Voice-Id", _config.custom_voice_id);
                }

                var resp = await _httpClient.SendAsync(req, cts.Token);

                if (!resp.IsSuccessStatusCode)
                {
                    string err = await resp.Content.ReadAsStringAsync();
                    Debug.LogError($"[TTS:gpt-sovits] BFF returned {resp.StatusCode}: {err}");
                    // Fallback to sherpa-onnx if available
                    if (IsReady)
                    {
                        Debug.Log("[TTS:gpt-sovits] Falling back to local sherpa-onnx...");
                        return await SpeakSherpaOnnxAsync(text);
                    }
                    return null;
                }

                string contentType = resp.Content.Headers.ContentType?.MediaType ?? "";

                if (contentType == "audio/wav")
                {
                    // GPT-SoVITS returned audio directly
                    byte[] wavBytes = await resp.Content.ReadAsByteArrayAsync();
                    int sampleRate = _outputSampleRate;

                    if (resp.Headers.TryGetValues("X-Sample-Rate", out var srVals))
                    {
                        foreach (string v in srVals)
                            if (int.TryParse(v, out int sr)) { sampleRate = sr; break; }
                    }

                    string voiceId = "";
                    if (resp.Headers.TryGetValues("X-Voice-Id", out var viVals))
                    {
                        foreach (string v in viVals) { voiceId = v; break; }
                    }

                    OnWavGenerated?.Invoke(wavBytes, sampleRate);
                    var clip = WavToAudioClip(wavBytes, sampleRate);
                    if (clip != null)
                    {
                        Debug.Log($"[TTS:gpt-sovits] Generated clip: {clip.length:F1}s " +
                                  $"voice={voiceId} for: \"{text.Substring(0, Math.Min(text.Length, 30))}\"");
                        OnSpeechReady?.Invoke(clip);
                    }
                    return clip;
                }
                else
                {
                    // BFF signaled fallback to local sherpa-onnx
                    Debug.Log("[TTS:gpt-sovits] BFF delegated to local sherpa-onnx");
                    if (IsReady)
                        return await SpeakSherpaOnnxAsync(text);

                    Debug.LogWarning("[TTS:gpt-sovits] Local sherpa-onnx not available, no TTS possible");
                    return null;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TTS:gpt-sovits] Request error: {ex.Message}");
                // Fallback to local
                if (IsReady)
                {
                    Debug.Log("[TTS:gpt-sovits] Falling back to local sherpa-onnx after error...");
                    return await SpeakSherpaOnnxAsync(text);
                }
                return null;
            }
        }

        #endregion

        #region WAV → AudioClip

        private AudioClip WavToAudioClip(byte[] wavBytes, int targetSampleRate)
        {
            try
            {
                if (wavBytes.Length < 44) return null;
                if (Encoding.ASCII.GetString(wavBytes, 0, 4) != "RIFF") return null;

                int channels = BitConverter.ToInt16(wavBytes, 22);
                int sourceSampleRate = BitConverter.ToInt32(wavBytes, 24);
                int bitsPerSample = BitConverter.ToInt16(wavBytes, 34);
                int dataStart = FindDataChunk(wavBytes);

                if (dataStart < 0) return null;
                int dataSize = BitConverter.ToInt32(wavBytes, dataStart + 4);
                int sampleCount = dataSize / (bitsPerSample / 8);

                float[] samples = new float[sampleCount];
                int offset = dataStart + 8;
                for (int i = 0; i < sampleCount; i++)
                {
                    if (offset + 1 >= wavBytes.Length) break;
                    short s = (short)(wavBytes[offset] | (wavBytes[offset + 1] << 8));
                    samples[i] = s / 32768f;
                    offset += 2;
                }

                if (sourceSampleRate != targetSampleRate)
                    samples = ResampleSimple(samples, sourceSampleRate, targetSampleRate);

                int finalRate = (sourceSampleRate != targetSampleRate) ? targetSampleRate : sourceSampleRate;
                finalRate = Mathf.Max(8000, Mathf.Min(finalRate, 48000));

                var clip = AudioClip.Create("tts_" + DateTime.Now.Ticks, samples.Length, 1, finalRate, false);
                clip.SetData(samples, 0);
                return clip;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TTS] WAV parse error: {ex.Message}");
                return null;
            }
        }

        private static int FindDataChunk(byte[] wav)
        {
            int pos = 12;
            while (pos + 8 <= wav.Length)
            {
                string chunkId = Encoding.ASCII.GetString(wav, pos, 4);
                if (chunkId == "data") return pos;
                int chunkSize = BitConverter.ToInt32(wav, pos + 4);
                pos += 8 + chunkSize;
            }
            return -1;
        }

        private static float[] ResampleSimple(float[] input, int fromRate, int toRate)
        {
            if (fromRate == toRate) return input;
            float ratio = (float)fromRate / toRate;
            int outputLen = Mathf.RoundToInt(input.Length / ratio);
            float[] output = new float[outputLen];
            for (int i = 0; i < outputLen; i++)
            {
                float srcIdx = i * ratio;
                int idx0 = Mathf.FloorToInt(srcIdx);
                int idx1 = Mathf.Min(idx0 + 1, input.Length - 1);
                output[i] = Mathf.Lerp(input[idx0], input[idx1], srcIdx - idx0);
            }
            return output;
        }

        #endregion

        #region Types

        [Serializable]
        private class SynthesizeRequest
        {
            public string text;
            public int speaker_id;
            public float speed;
        }

        #endregion
    }
}
