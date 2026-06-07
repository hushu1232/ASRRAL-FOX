using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Procedural audio-to-face animation driver.
    /// Maps audio amplitude to Live2D mouth parameters for lip sync.
    ///
    /// Current implementation uses amplitude envelope analysis.
    /// Production path: integrate Azure SDK VisemeReceived event
    /// for real viseme blendshape data (see Navi-Studio reference).
    ///
    /// Reference: Navi-Studio/Virtual-Human-for-Chatting (MIT License)
    ///   - Azure viseme index mapping: jawOpen(17), mouthFunnel(19), mouthPucker(20)
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class Audio2Face : MonoBehaviour
    {
        [Header("Audio Source")]
        [SerializeField, Tooltip("Auto-detected if empty.")]
        private AudioSource _audioSource;

        [Header("Viseme Sensitivity")]
        [SerializeField, Range(0.1f, 5f)]
        private float _sensitivity = 1.5f;

        [SerializeField, Range(0f, 1f)]
        private float _jawOpenThreshold = 0.15f;

        [Header("Smoothing")]
        [SerializeField, Range(0.01f, 0.5f)]
        private float _smoothTime = 0.08f;

        [Header("Viseme Variation")]
        [SerializeField, Range(0f, 1f)]
        private float _mouthFormVariation = 0.3f;

        // Runtime state
        private CubismParameterDriver _driver;
        private float[] _audioSamples = new float[1024];
        private int _sampleRate = 24000;

        // Smoothed values
        private float _jawOpenVelocity;
        private float _mouthFormVelocity;
        private float _cheekPuffVelocity;

        private float _currentJawOpen;
        private float _currentMouthForm;
        private float _currentCheekPuff;

        // Viseme timing
        private float _visemeTimer;
        private float _nextVisemeChange;
        private float _targetMouthForm;

        private bool _isInitialized;

        public bool IsSpeaking { get; private set; }

        private void Awake()
        {
            _audioSource = _audioSource ?? GetComponent<AudioSource>();
            _driver = GetComponentInChildren<CubismParameterDriver>();
            if (_driver == null)
                _driver = FindObjectOfType<CubismParameterDriver>();
        }

        private void Start()
        {
            if (_audioSource == null)
            {
                Debug.LogWarning("[Audio2Face] No AudioSource found. Disabled.");
                enabled = false;
                return;
            }

            _isInitialized = true;
            SampleRate = AudioSettings.outputSampleRate;
        }

        public int SampleRate
        {
            get => _sampleRate;
            set => _sampleRate = Mathf.Max(8000, value);
        }

        private void LateUpdate()
        {
            if (!_isInitialized || _driver == null || !_driver.IsReady) return;

            IsSpeaking = _audioSource.isPlaying && _audioSource.clip != null;

            if (IsSpeaking)
            {
                UpdateVisemeFromAudio();
                ApplyToLive2D();
            }
            else
            {
                ResetParams();
            }
        }

        /// <summary>
        /// Analyze current audio frame to estimate mouth shape.
        /// Simulates Azure viseme data from amplitude + spectral approximation.
        /// </summary>
        private void UpdateVisemeFromAudio()
        {
            if (_audioSource.clip == null) return;

            // Get current audio data
            var clip = _audioSource.clip;
            var timeSamples = _audioSource.timeSamples;
            var dataAvailable = timeSamples + _audioSamples.Length < clip.samples;

            if (dataAvailable)
            {
                clip.GetData(_audioSamples, timeSamples);

                // Compute RMS amplitude
                float sum = 0f;
                for (int i = 0; i < _audioSamples.Length; i++)
                    sum += _audioSamples[i] * _audioSamples[i];
                float rms = Mathf.Sqrt(sum / _audioSamples.Length);

                // Map RMS to jaw open (0-1)
                float targetJawOpen = Mathf.Clamp01(rms * 10f * _sensitivity);

                // Above threshold: open mouth; below: close
                if (targetJawOpen < _jawOpenThreshold)
                    targetJawOpen = 0f;

                // Periodic mouth form variation (simulates different visemes)
                _visemeTimer += Time.deltaTime;
                if (_visemeTimer >= _nextVisemeChange)
                {
                    _visemeTimer = 0f;
                    _nextVisemeChange = Random.Range(0.05f, 0.2f); // 5-20Hz viseme rate
                    _targetMouthForm = Random.Range(-_mouthFormVariation, _mouthFormVariation);
                }

                // Smooth all values
                _currentJawOpen = Mathf.SmoothDamp(_currentJawOpen, targetJawOpen,
                    ref _jawOpenVelocity, _smoothTime);
                _currentMouthForm = Mathf.SmoothDamp(_currentMouthForm, _targetMouthForm,
                    ref _mouthFormVelocity, _smoothTime);
                _currentCheekPuff = Mathf.SmoothDamp(_currentCheekPuff,
                    targetJawOpen * 0.3f, ref _cheekPuffVelocity, _smoothTime);
            }
        }

        /// <summary>
        /// Apply computed viseme values to Live2D parameters.
        /// Azure viseme → Live2D mapping:
        ///   jawOpen (17) → ParamMouthOpenY
        ///   mouthFunnel (19) → ParamMouthForm
        ///   mouthPucker (20) → cheek/ParamBreath (approximation)
        /// </summary>
        private void ApplyToLive2D()
        {
            _driver.SetParameter(FoxParamId.MouthOpenY, _currentJawOpen);
            _driver.SetParameter(FoxParamId.MouthForm, _currentMouthForm);
        }

        private void ResetParams()
        {
            _currentJawOpen = 0f;
            _currentMouthForm = 0f;
            _currentCheekPuff = 0f;
            _jawOpenVelocity = 0f;
            _mouthFormVelocity = 0f;
            _cheekPuffVelocity = 0f;
            _visemeTimer = 0f;
            _nextVisemeChange = 0.1f;

            if (_driver != null && _driver.IsReady)
            {
                _driver.SetParameter(FoxParamId.MouthOpenY, 0f);
                _driver.SetParameter(FoxParamId.MouthForm, 0f);
            }
        }
    }
}
