using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Drives Live2D mouth open (ParamMouthOpenY) based on audio amplitude.
    /// Works with TTSPlayer's AudioSource or can be fed amplitude values directly.
    ///
    /// Multiple modes:
    ///   OutputData — uses AudioSource.GetOutputData for real-time amplitude
    ///   DirectAmplitude — uses externally provided amplitude values
    ///   CustomCallback — uses a delegate for custom amplitude calculation
    ///
    /// Maps amplitude (0-1) to mouth openness with configurable sensitivity curve.
    /// </summary>
    public sealed class LipSync : MonoBehaviour
    {
        #region Inspector

        [Header("Audio Source")]
        [SerializeField]
        private TTSPlayer _ttsPlayer; // auto-detected if null

        [Header("Amplitude to Mouth Mapping")]
        [SerializeField]
        private AnimationCurve _amplitudeToMouthCurve = AnimationCurve.Linear(0f, 0f, 1f, 1f);

        [SerializeField, Range(0.5f, 5f)]
        private float _sensitivity = 1.5f;

        [SerializeField, Range(0.01f, 0.5f)]
        private float _smoothUpTime = 0.04f; // fast open

        [SerializeField, Range(0.01f, 0.5f)]
        private float _smoothDownTime = 0.08f; // slower close (natural look)

        [Header("Noise Gate")]
        [SerializeField, Range(0f, 0.2f)]
        private float _noiseGate = 0.01f; // amplitude below this → mouth closed

        [Header("Talking Animation")]
        [SerializeField, Range(0f, 0.5f)]
        private float _jitterAmount = 0.05f; // random variation for natural look

        [Header("Debug")]
        [SerializeField]
        private bool _showDebugGUI = false;

        #endregion

        #region Properties

        public float MouthOpenTarget { get; private set; }
        public float MouthOpenSmooth { get; private set; }
        public float CurrentAmplitude { get; private set; }
        public bool IsActive { get; set; } = true;

        #endregion

        #region Private Fields

        private AudioSource _source;
        private float _velocity; // for SmoothDamp
        private float[] _audioDataBuffer = new float[256];

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_ttsPlayer == null)
                _ttsPlayer = GetComponent<TTSPlayer>();

            if (_ttsPlayer != null)
                _source = _ttsPlayer.GetAudioSource();
        }

        private void Start()
        {
            if (Animation.PetAnimationManager.Instance?.CurrentAnimator == null)
            {
                Debug.LogWarning("[LipSync] No PetAnimationManager/CurrentAnimator found. Disabling.");
                enabled = false;
                return;
            }

            if (_source == null)
            {
                Debug.LogWarning("[LipSync] No AudioSource found. Will use direct amplitude mode.");
            }

            // Subscribe to TTSPlayer events for direct sample feed
            if (_ttsPlayer != null)
            {
                _ttsPlayer.OnPlaybackStarted += OnTTSPlaybackStarted;
                _ttsPlayer.OnPlaybackComplete += OnTTSPlaybackComplete;
            }
        }

        private void Update()
        {
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (!IsActive || animator == null) return;

            float rawAmplitude = 0f;

            // Prefer direct TTS chunk data when playing
            if (_source != null && _source.isPlaying)
            {
                _source.GetOutputData(_audioDataBuffer, 0);
                float sum = 0f;
                for (int i = 0; i < _audioDataBuffer.Length; i++)
                    sum += _audioDataBuffer[i] * _audioDataBuffer[i];
                rawAmplitude = Mathf.Sqrt(sum / _audioDataBuffer.Length);
            }
            else if (_ttsPlayer != null)
            {
                // Use TTSPlayer's pre-computed amplitude
                rawAmplitude = _ttsPlayer.CurrentAmplitude;
            }

            CurrentAmplitude = rawAmplitude;

            // Noise gate
            if (rawAmplitude < _noiseGate)
                rawAmplitude = 0f;

            // Apply sensitivity curve
            float amplified = rawAmplitude * _sensitivity;
            amplified = Mathf.Clamp01(amplified);
            MouthOpenTarget = _amplitudeToMouthCurve.Evaluate(amplified);

            // Add jitter for natural variation
            if (MouthOpenTarget > 0.01f)
            {
                float jitter = (Mathf.PerlinNoise(Time.unscaledTime * 12f, 0f) - 0.5f) * _jitterAmount;
                MouthOpenTarget = Mathf.Clamp01(MouthOpenTarget + jitter);
            }

            // Asymmetric smoothing (fast open, slow close)
            float smoothTime = MouthOpenTarget > MouthOpenSmooth ? _smoothUpTime : _smoothDownTime;
            MouthOpenSmooth = Mathf.SmoothDamp(MouthOpenSmooth, MouthOpenTarget, ref _velocity, smoothTime);

            // Drive the animation
            animator.SetMouthOpen(MouthOpenSmooth);
        }

        private void OnDestroy()
        {
            if (_ttsPlayer != null)
            {
                _ttsPlayer.OnPlaybackStarted -= OnTTSPlaybackStarted;
                _ttsPlayer.OnPlaybackComplete -= OnTTSPlaybackComplete;
            }
        }

        private void OnGUI()
        {
            if (!_showDebugGUI || !Application.isPlaying) return;

            GUI.color = Color.cyan;
            GUI.Label(new Rect(10, 100, 300, 150),
                $"[LipSync]\n" +
                $"  Amp: {CurrentAmplitude:F3}\n" +
                $"  Target: {MouthOpenTarget:F3}\n" +
                $"  Smooth: {MouthOpenSmooth:F3}\n" +
                $"  Source Playing: {_source?.isPlaying ?? false}\n" +
                $"  Active: {IsActive}");
        }

        #endregion

        #region Event Handlers

        private void OnTTSPlaybackStarted()
        {
            IsActive = true;
        }

        private void OnTTSPlaybackComplete()
        {
            IsActive = false;
            MouthOpenTarget = 0f;
            MouthOpenSmooth = 0f;
            CurrentAmplitude = 0f;
            Animation.PetAnimationManager.Instance?.CurrentAnimator?.SetMouthOpen(0f);
        }

        #endregion

        #region Public API

        /// <summary>Feed amplitude directly (bypasses AudioSource).</summary>
        public void SetAmplitude(float amplitude)
        {
            CurrentAmplitude = Mathf.Clamp01(amplitude);
        }

        /// <summary>Reset mouth to closed position.</summary>
        public void ResetMouth()
        {
            MouthOpenTarget = 0f;
            MouthOpenSmooth = 0f;
            CurrentAmplitude = 0f;
            Animation.PetAnimationManager.Instance?.CurrentAnimator?.SetMouthOpen(0f);
        }

        #endregion
    }
}
