using System;
using System.Collections.Generic;
using UnityEngine;

#if VOSK_PRESENT
using Vosk;
#endif

namespace AstralFox.Voice
{
    /// <summary>
    /// Offline wake word detector. Supports Vosk for real recognition
    /// and a mock mode (key press) for testing without Vosk models.
    ///
    /// Wake word: "小星小星" (xiao xing xiao xing)
    ///
    /// Setup:
    ///   1. Download vosk-model-small-cn-0.22 from https://alphacephei.com/vosk/models
    ///   2. Extract to Assets/StreamingAssets/vosk-model/
    ///   3. Add Vosk C# bindings DLL to project
    ///   4. Add "VOSK_PRESENT" to Scripting Define Symbols
    /// </summary>
    public sealed class WakeWordDetector : MonoBehaviour
    {
        #region Inspector

        [Header("Wake Word")]
        [SerializeField]
        private string _wakeWord = "小星小星";

        [SerializeField]
        private string[] _alternateWakeWords = { "小星", "星尘" };

        [Header("Vosk Settings")]
#pragma warning disable CS0414 // Inspector fields, used in VOSK_PRESENT builds or reserved
        [SerializeField]
        private string _modelPath = "vosk-model/vosk-model-small-cn-0.22";

        [SerializeField, Range(8000, 48000)]
        private int _sampleRate = 16000;
#pragma warning restore CS0414

        [SerializeField, Range(0.1f, 5f)]
        private float _cooldownTime = 2f; // minimum time between wake triggers

        [Header("Mock Mode (no Vosk)")]
#pragma warning disable CS0414 // Inspector field, referenced in Awake()
        [SerializeField]
        private bool _useMockMode = true;
#pragma warning restore CS0414

        [SerializeField]
        private KeyCode _mockWakeKey = KeyCode.F12;

        [Header("Debug")]
#pragma warning disable CS0414 // Inspector field, reserved for verbose logging
        [SerializeField]
        private bool _logPartialResults = false;
#pragma warning restore CS0414

        #endregion

        #region Events

        /// <summary>Fired when the wake word is detected.</summary>
        public event Action OnWakeWordDetected;

        /// <summary>Fired with the recognized text (partial results, for debug).</summary>
#pragma warning disable CS0067 // Reserved for future Vosk integration
        public event Action<string> OnPartialResult;
#pragma warning restore CS0067

        /// <summary>Fired when Vosk model is loaded and ready.</summary>
        public event Action<bool> OnReadyChanged;

        #endregion

        #region Properties

        public bool IsReady { get; private set; }
        public bool IsListening { get; private set; } // actively checking for wake word
        public float CooldownRemaining => Mathf.Max(0f, _lastWakeTime + _cooldownTime - Time.unscaledTime);

        #endregion

        #region Private Fields

#if VOSK_PRESENT
        private Model _model;
        private VoskRecognizer _recognizer;
#endif
        private float _lastWakeTime = -999f;
        private List<float> _audioBuffer = new List<float>();
        private bool _mockModeActive;
        private float _mockTriggerHoldTime;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
#if VOSK_PRESENT
            if (!_useMockMode)
                InitializeVosk();
            else
#endif
            {
                _mockModeActive = true;
                IsReady = true;
                IsListening = true;
                OnReadyChanged?.Invoke(true);
                Debug.Log($"[WakeWordDetector] Mock mode active. Press {_mockWakeKey} to simulate wake word.");
            }
        }

        private void Update()
        {
            if (_mockModeActive)
            {
                UpdateMockMode();
            }
        }

        private void OnDestroy()
        {
#if VOSK_PRESENT
            _recognizer?.Dispose();
            _model?.Dispose();
#endif
        }

        #endregion

        #region Initialization

#if VOSK_PRESENT
        private void InitializeVosk()
        {
            try
            {
                Vosk.Vosk.SetLogLevel(0); // errors only

                string fullPath = System.IO.Path.Combine(Application.streamingAssetsPath, _modelPath);
                if (!System.IO.Directory.Exists(fullPath))
                {
                    Debug.LogError($"[WakeWordDetector] Vosk model not found at: {fullPath}");
                    FallbackToMock("Model path not found.");
                    return;
                }

                _model = new Model(fullPath);
                _recognizer = new VoskRecognizer(_model, _sampleRate);
                _recognizer.SetWords(true);

                IsReady = true;
                IsListening = true;
                _mockModeActive = false;
                OnReadyChanged?.Invoke(true);
                Debug.Log($"[WakeWordDetector] Vosk initialized. Model: {fullPath}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[WakeWordDetector] Vosk init failed: {ex.Message}");
                FallbackToMock(ex.Message);
            }
        }
#endif

        private void FallbackToMock(string reason)
        {
            Debug.LogWarning($"[WakeWordDetector] Falling back to mock mode. Reason: {reason}");
            _mockModeActive = true;
            IsReady = true;
            IsListening = true;
            OnReadyChanged?.Invoke(true);
        }

        #endregion

        #region Audio Processing

        /// <summary>Feed audio samples to the wake word detector.</summary>
        public void ProcessAudio(float[] samples, int sampleRate, int channels)
        {
            if (!IsListening) return;
            if (Time.unscaledTime - _lastWakeTime < _cooldownTime) return;

#if VOSK_PRESENT
            if (!_mockModeActive && _recognizer != null)
            {
                ProcessVosk(samples, sampleRate, channels);
            }
#endif
        }

#if VOSK_PRESENT
        private void ProcessVosk(float[] samples, int sampleRate, int channels)
        {
            // Convert float samples to 16-bit PCM bytes
            byte[] pcm = ConvertToPCM16(samples);

            if (_recognizer.AcceptWaveform(pcm, pcm.Length))
            {
                // Final result
                string result = _recognizer.Result();
                CheckWakeWord(result);
            }
            else
            {
                // Partial result
                string partial = _recognizer.PartialResult();
                if (_logPartialResults)
                    OnPartialResult?.Invoke(partial);

                // Also check partial results for faster wake word detection
                CheckWakeWord(partial);
            }
        }
#endif

        /// <summary>Check if the recognition result contains the wake word.</summary>
        private void CheckWakeWord(string jsonResult)
        {
            if (string.IsNullOrEmpty(jsonResult)) return;

            string text = ExtractText(jsonResult).ToLower();
            if (string.IsNullOrEmpty(text)) return;

            // Check primary wake word
            if (text.Contains(_wakeWord))
            {
                TriggerWake();
                return;
            }

            // Check alternates
            foreach (string alt in _alternateWakeWords)
            {
                if (text.Contains(alt))
                {
                    TriggerWake();
                    return;
                }
            }
        }

        /// <summary>Extract recognized text from Vosk JSON result.</summary>
        private string ExtractText(string json)
        {
            // Vosk format: {"partial": "text"} or {"text": "text"}
            const string partialKey = "\"partial\" : \"";
            const string textKey = "\"text\" : \"";

            foreach (string key in new[] { textKey, partialKey })
            {
                int idx = json.IndexOf(key, StringComparison.Ordinal);
                if (idx >= 0)
                {
                    idx += key.Length;
                    int end = json.IndexOf('"', idx);
                    if (end > idx)
                        return json.Substring(idx, end - idx);
                }
            }
            return "";
        }

        #endregion

        #region Mock Mode

        private void UpdateMockMode()
        {
            if (!_mockModeActive) return;

            // Hold key for 0.3s to avoid accidental triggers
            if (Input.GetKey(_mockWakeKey))
            {
                _mockTriggerHoldTime += Time.unscaledDeltaTime;
                if (_mockTriggerHoldTime >= 0.3f)
                {
                    _mockTriggerHoldTime = 0f;
                    TriggerWake();
                }
            }
            else
            {
                _mockTriggerHoldTime = 0f;
            }
        }

        #endregion

        #region Trigger

        private void TriggerWake()
        {
            if (Time.unscaledTime - _lastWakeTime < _cooldownTime) return;

            _lastWakeTime = Time.unscaledTime;
            Debug.Log("[WakeWordDetector] Wake word detected!");
            OnWakeWordDetected?.Invoke();
        }

        /// <summary>Public API: trigger wake word from UI button or external caller.</summary>
        public void SimulateWakeWord() => TriggerWake();

        /// <summary>Enable/disable wake word listening.</summary>
        public void SetListening(bool listening)
        {
            IsListening = listening;
        }

        #endregion

        #region Utilities

        private static byte[] ConvertToPCM16(float[] samples)
        {
            return AudioUtility.ConvertToPCM16(samples);
        }

        #endregion
    }
}
