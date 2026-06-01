using System;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Captures audio from the default microphone and provides it as PCM float samples.
    /// Uses Unity's Microphone API. Runs a continuous recording loop with a configurable
    /// buffer duration, firing an event each time new audio data is available.
    /// </summary>
    public sealed class MicrophoneCapture : MonoBehaviour
    {
        #region Inspector

        [Header("Device")]
        [SerializeField]
        private string _deviceName = ""; // empty = default device

        [SerializeField, Range(8000, 48000)]
        private int _sampleRate = 16000;

        [Header("Buffer")]
        [SerializeField, Range(0.5f, 5f)]
        private float _clipDuration = 1f; // length of each recording clip in seconds

        [SerializeField, Range(0.05f, 0.5f)]
        private float _processInterval = 0.1f; // how often to emit audio data events

        [Header("Debug")]
        [SerializeField]
        private bool _logDeviceInfo = true;

        #endregion

        #region Events

        /// <summary>Fired when new audio samples are available. float[], sampleRate, channels.</summary>
        public event Action<float[], int, int> OnAudioData;

        /// <summary>Fired when recording starts or stops.</summary>
        public event Action<bool> OnRecordingStateChanged;

        /// <summary>Fired on microphone errors.</summary>
        public event Action<string> OnError;

        #endregion

        #region Properties

        public bool IsRecording { get; private set; }
        public int SampleRate => _sampleRate;
        public int Channels => _channels;
        public float CurrentLevel { get; private set; } // RMS volume 0-1
        public bool Muted { get; set; } // When true, audio events are suppressed (prevents voice loopback during TTS)

        #endregion

        #region Private Fields

        private AudioClip _micClip;
        private int _channels = 1;
        private int _lastSamplePos;
        private float _processTimer;
        private float[] _sampleBuffer;
        private string _activeDevice;
        private float _recordingStartTime;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            // Auto-start if we have a microphone
            if (Microphone.devices.Length > 0)
            {
                StartRecording();
            }
            else
            {
                OnError?.Invoke("No microphone devices found.");
                Debug.LogError("[MicrophoneCapture] No microphone detected.");
            }
        }

        private void Update()
        {
            if (!IsRecording) return;

            _processTimer += Time.unscaledDeltaTime;
            if (_processTimer >= _processInterval)
            {
                _processTimer = 0f;
                ProcessAudioData();
            }

            // Update RMS level for UI/VAD
            UpdateCurrentLevel();
        }

        private void OnDestroy()
        {
            StopRecording();
        }

        #endregion

        #region Public API

        /// <summary>Start microphone recording.</summary>
        public void StartRecording()
        {
            if (IsRecording) return;

            if (Microphone.devices.Length == 0)
            {
                OnError?.Invoke("No microphone available.");
                return;
            }

            _activeDevice = string.IsNullOrEmpty(_deviceName)
                ? Microphone.devices[0]
                : _deviceName;

            if (_logDeviceInfo)
            {
                Debug.Log($"[MicrophoneCapture] Devices: {string.Join(", ", Microphone.devices)}");
                Debug.Log($"[MicrophoneCapture] Using: {_activeDevice}, Rate: {_sampleRate}Hz");
            }

            _channels = 1;
            _micClip = Microphone.Start(_activeDevice, true, (int)_clipDuration, _sampleRate);

            if (_micClip == null)
            {
                OnError?.Invoke($"Failed to start microphone on device: {_activeDevice}");
                return;
            }

            _lastSamplePos = 0;
            _sampleBuffer = new float[_sampleRate * _channels]; // 1 second buffer
            IsRecording = true;
            _recordingStartTime = Time.unscaledTime;
            OnRecordingStateChanged?.Invoke(true);

            Debug.Log($"[MicrophoneCapture] Recording started. Clip: {_clipDuration}s, Buffer: {_sampleBuffer.Length}");
        }

        /// <summary>Stop microphone recording.</summary>
        public void StopRecording()
        {
            if (!IsRecording) return;

            Microphone.End(_activeDevice);
            IsRecording = false;
            _micClip = null;
            OnRecordingStateChanged?.Invoke(false);
            Debug.Log("[MicrophoneCapture] Recording stopped.");
        }

        /// <summary>Switch to a different microphone device.</summary>
        public void SwitchDevice(string deviceName)
        {
            bool wasRecording = IsRecording;
            StopRecording();
            _deviceName = deviceName;
            if (wasRecording) StartRecording();
        }

        #endregion

        #region Audio Processing

        private void ProcessAudioData()
        {
            if (_micClip == null) return;

            // Wait 0.5s for mic buffer to be ready (Unity native bug workaround)
            if (Time.unscaledTime - _recordingStartTime < 0.5f) return;

            int currentPos = Microphone.GetPosition(_activeDevice);
            if (currentPos < 0) return;

            // Bounds check: clip might not have samples populated yet
            if (_lastSamplePos >= _micClip.samples) { _lastSamplePos = 0; return; }
            if (_lastSamplePos < 0) _lastSamplePos = 0;

            int samplesAvailable;
            if (currentPos > _lastSamplePos)
            {
                samplesAvailable = currentPos - _lastSamplePos;
            }
            else if (currentPos < _lastSamplePos)
            {
                // Ring buffer wrapped around
                samplesAvailable = (_micClip.samples - _lastSamplePos) + currentPos;
            }
            else
            {
                return; // no new data
            }

            if (samplesAvailable <= 0) return;

            // Safety: never read past the clip's sample count
            if (_lastSamplePos + samplesAvailable > _micClip.samples)
                samplesAvailable = _micClip.samples - _lastSamplePos;
            if (samplesAvailable <= 0) return;

            float[] data = new float[samplesAvailable];

            if (currentPos > _lastSamplePos || samplesAvailable <= (_micClip.samples - _lastSamplePos))
            {
                // Contiguous read
                if (_lastSamplePos >= 0 && _lastSamplePos + samplesAvailable <= _micClip.samples)
                    _micClip.GetData(data, _lastSamplePos);
                else
                    return;
            }
            else
            {
                // Two-part read across ring buffer boundary
                int part1Len = _micClip.samples - _lastSamplePos;
                int part2Len = samplesAvailable - part1Len;
                if (part1Len <= 0 || part2Len <= 0) return;
                if (_lastSamplePos + part1Len > _micClip.samples) return;
                float[] part1 = new float[part1Len];
                float[] part2 = new float[part2Len];
                _micClip.GetData(part1, _lastSamplePos);
                _micClip.GetData(part2, 0);
                System.Array.Copy(part1, 0, data, 0, part1Len);
                System.Array.Copy(part2, 0, data, part1Len, part2Len);
            }

            _lastSamplePos = currentPos;
            if (!Muted)
                OnAudioData?.Invoke(data, _sampleRate, _channels);
        }

        private void UpdateCurrentLevel()
        {
            if (_micClip == null) return;
            if (_micClip.samples <= 0) return;
            int pos = Microphone.GetPosition(_activeDevice);
            if (pos < 0) return;

            // Sample a small window for RMS
            int windowSize = Mathf.Min(256, _micClip.samples);
            int startPos = Mathf.Clamp(pos - windowSize, 0, _micClip.samples - windowSize);
            if (startPos < 0 || startPos + windowSize > _micClip.samples) return;
            float[] window = new float[windowSize];
            _micClip.GetData(window, startPos);

            float sum = 0f;
            for (int i = 0; i < window.Length; i++)
                sum += window[i] * window[i];

            float rms = Mathf.Sqrt(sum / window.Length);
            CurrentLevel = Mathf.Clamp01(rms * 5f); // amplify for visibility
        }

        #endregion

        #region Static Helpers

        /// <summary>Get list of available microphone devices.</summary>
        public static string[] GetDevices() => Microphone.devices;

        /// <summary>Check if any microphone is available.</summary>
        public static bool HasMicrophone() => Microphone.devices.Length > 0;

        #endregion
    }
}
