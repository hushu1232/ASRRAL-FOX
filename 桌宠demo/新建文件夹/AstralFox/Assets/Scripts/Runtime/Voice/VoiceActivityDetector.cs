using System;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Simple energy-based Voice Activity Detector.
    /// Monitors audio RMS level and detects speech start/end with configurable
    /// thresholds, hold time, and silence timeout.
    ///
    /// Can be replaced with WebRTC VAD or Silero VAD for better accuracy.
    /// </summary>
    public sealed class VoiceActivityDetector : MonoBehaviour
    {
        #region Inspector

        [Header("Thresholds")]
        [SerializeField, Range(0.001f, 0.5f), Tooltip("RMS level above which audio is considered speech.")]
        private float _speechThreshold = 0.02f;

        [SerializeField, Range(0.001f, 0.5f), Tooltip("RMS level below which speech is considered ended.")]
        private float _silenceThreshold = 0.01f;

        [Header("Timing")]
        [SerializeField, Range(0.05f, 0.5f), Tooltip("Time audio must be above threshold to trigger speech start.")]
        private float _speechOnsetTime = 0.15f;

        [SerializeField, Range(0.1f, 3f), Tooltip("Silence duration before speech end is triggered.")]
        private float _silenceTimeout = 0.8f;

        [SerializeField, Range(0.1f, 2f), Tooltip("Minimum speech duration (ignore very short sounds).")]
        private float _minSpeechDuration = 0.3f;

        [Header("Smoothing")]
        [SerializeField, Range(0f, 0.95f)]
        private float _rmsSmoothing = 0.9f;

        #endregion

        #region Events

        /// <summary>Fired when speech activity starts.</summary>
        public event Action OnSpeechStart;

        /// <summary>Fired when speech activity ends. Contains the total speech duration.</summary>
        public event Action<float> OnSpeechEnd;

        /// <summary>Fired every frame with current VAD state info.</summary>
        public event Action<float, bool> OnLevelChanged; // rms, isSpeaking

        #endregion

        #region Properties

        public bool IsSpeaking { get; private set; }
        public float CurrentRMS { get; private set; }
        public float SmoothedRMS { get; private set; }
        public float SpeechDuration { get; private set; }

        #endregion

        #region Private Fields

        public enum VadState { Silence, Onset, Speaking, Trailing }

        private VadState _state = VadState.Silence;
        private float _stateTimer;
        private float _speechStartTime;

        #endregion

        #region Unity Lifecycle

        private void Update()
        {
            // Update timers
            _stateTimer += Time.unscaledDeltaTime;
            if (IsSpeaking)
                SpeechDuration = Time.unscaledTime - _speechStartTime;
        }

        #endregion

        #region Public API

        /// <summary>
        /// Feed a buffer of audio samples to the VAD for analysis.
        /// Call this from MicrophoneCapture.OnAudioData or similar.
        /// </summary>
        /// <param name="samples">Float audio samples [-1, 1].</param>
        public void ProcessAudio(float[] samples)
        {
            if (samples == null || samples.Length == 0) return;

            // Calculate RMS
            float sum = 0f;
            for (int i = 0; i < samples.Length; i++)
                sum += samples[i] * samples[i];
            float rms = Mathf.Sqrt(sum / samples.Length);
            CurrentRMS = rms;

            // Smooth
            SmoothedRMS = SmoothedRMS * _rmsSmoothing + rms * (1f - _rmsSmoothing);

            // State machine
            UpdateState(SmoothedRMS);

            OnLevelChanged?.Invoke(SmoothedRMS, IsSpeaking);
        }

        /// <summary>Reset VAD state to silence.</summary>
        public void Reset()
        {
            _state = VadState.Silence;
            _stateTimer = 0f;
            IsSpeaking = false;
            SpeechDuration = 0f;
            SmoothedRMS = 0f;
            CurrentRMS = 0f;
        }

        #endregion

        #region State Machine

        private void UpdateState(float rms)
        {
            switch (_state)
            {
                case VadState.Silence:
                    if (rms >= _speechThreshold)
                    {
                        _state = VadState.Onset;
                        _stateTimer = 0f;
                    }
                    break;

                case VadState.Onset:
                    if (rms < _speechThreshold)
                    {
                        // False trigger — go back to silence
                        _state = VadState.Silence;
                        _stateTimer = 0f;
                    }
                    else if (_stateTimer >= _speechOnsetTime)
                    {
                        // Confirmed speech
                        _state = VadState.Speaking;
                        _stateTimer = 0f;
                        IsSpeaking = true;
                        _speechStartTime = Time.unscaledTime;
                        SpeechDuration = 0f;
                        OnSpeechStart?.Invoke();
                    }
                    break;

                case VadState.Speaking:
                    if (rms < _silenceThreshold)
                    {
                        _state = VadState.Trailing;
                        _stateTimer = 0f;
                    }
                    break;

                case VadState.Trailing:
                    if (rms >= _speechThreshold)
                    {
                        // Speech resumed
                        _state = VadState.Speaking;
                        _stateTimer = 0f;
                    }
                    else if (_stateTimer >= _silenceTimeout)
                    {
                        // Speech ended
                        float duration = Time.unscaledTime - _speechStartTime;
                        if (duration >= _minSpeechDuration)
                        {
                            IsSpeaking = false;
                            SpeechDuration = duration;
                            OnSpeechEnd?.Invoke(duration);
                        }
                        _state = VadState.Silence;
                        _stateTimer = 0f;
                    }
                    break;
            }
        }

        #endregion
    }
}
