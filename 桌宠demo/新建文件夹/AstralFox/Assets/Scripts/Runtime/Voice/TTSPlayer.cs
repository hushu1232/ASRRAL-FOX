using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Streaming TTS audio player — plays PCM16 chunks as they arrive.
    ///
    /// Audio format: 16000 Hz (configurable), mono, PCM 16-bit.
    /// Uses a single streaming AudioClip with incremental SetData writes,
    /// avoiding per-chunk clip recreation (~4MB each) that caused GC pressure.
    ///
    /// Also supports raw WAV byte chunks (44-byte RIFF header + PCM data).
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class TTSPlayer : MonoBehaviour
    {
        #region Inspector

        [Header("Audio")]
        [SerializeField, Range(8000, 48000)]
        private int _sampleRate = 16000;

        [SerializeField, Range(10f, 120f)]
        private float _maxClipDuration = 60f; // pre-allocated clip length

        [SerializeField, Range(0.5f, 2f)]
        private float _volume = 1f;

        [Header("Debug")]
        [SerializeField]
        private bool _logChunks = false;

        #endregion

        #region Events

        public event Action OnPlaybackStarted;
        public event Action OnPlaybackComplete;

        #endregion

        #region Properties

        public bool IsPlaying { get; private set; }
        public bool HasPendingAudio { get; private set; }
        public int TotalSamplesBuffered => _totalSamplesWritten;

        public float PlaybackProgress
        {
            get
            {
                if (_totalSamplesWritten == 0 || _source.clip == null) return 0f;
                float playTime = _source.isPlaying ? _source.time : 0f;
                float totalDuration = _totalSamplesWritten / (float)_sampleRate;
                return Mathf.Clamp01(playTime / Mathf.Max(totalDuration, 0.01f));
            }
        }

        public float CurrentAmplitude { get; private set; }

        /// <summary>Set to false to disable auto-play on first chunk (for pre-buffering).</summary>
        public bool AutoPlay { get; set; } = true;

        #endregion

        #region Private Fields

        private AudioSource _source;
        private AudioClip _streamingClip;
        private float[] _sampleBuffer;
        private int _totalSamplesWritten;
        private int _maxSamples;
        private bool _playbackStarted;
        private int _playbackFrameDelay;
        private int _dataCompleteFrameCount;
        private bool _dataComplete;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _source = GetComponent<AudioSource>();
            _source.playOnAwake = false;
            _source.loop = false;
            _source.volume = _volume;
            _source.spatialBlend = 0f;
            _source.bypassEffects = true;
            _source.bypassListenerEffects = true;
            _source.bypassReverbZones = true;

            _maxSamples = Mathf.CeilToInt(_sampleRate * _maxClipDuration);
            _sampleBuffer = new float[_maxSamples];

            // Pre-create a single streaming AudioClip — reused for lifetime
            _streamingClip = AudioClip.Create("tts_stream", _maxSamples, 1, _sampleRate, stream: true,
                pcmreadercallback: null, pcmsetpositioncallback: null);
            _source.clip = _streamingClip;
        }

        private void Update()
        {
            if (IsPlaying && _playbackStarted)
            {
                // Skip N frames after Play() — Unity audio engine init delay
                if (_playbackFrameDelay > 0)
                {
                    _playbackFrameDelay--;
                    return;
                }

                // Calculate current amplitude for lip-sync
                if (_source.isPlaying && _source.clip != null)
                {
                    int currentSample = Mathf.FloorToInt(_source.time * _sampleRate);
                    if (currentSample >= 0 && currentSample < _totalSamplesWritten)
                    {
                        CurrentAmplitude = Mathf.Abs(_sampleBuffer[currentSample]);
                    }
                }

                if (!_source.isPlaying)
                {
                    if (_dataComplete)
                    {
                        // Natural playback end — all data written and played
                        FinishPlayback();
                    }
                    else
                    {
                        // Clip ended but more data may arrive — switch to waiting mode
                        // The next AddPCMChunk will restart playback
                        _playbackStarted = false;
                        if (_logChunks)
                            Debug.Log($"[TTSPlayer] Buffer underrun — waiting for more data. Written: {_totalSamplesWritten}");
                    }
                }
            }
        }

        private void OnDestroy()
        {
            StopImmediate();
        }

        #endregion

        #region Public API

        /// <summary>Add a chunk of raw PCM16 audio data. Plays immediately on first chunk.</summary>
        public void AddPCMChunk(byte[] pcm16)
        {
            if (pcm16 == null || pcm16.Length == 0) return;

            float[] samples = ConvertPCM16ToFloat(pcm16);
            AddFloatSamples(samples);
        }

        /// <summary>Add raw WAV bytes (with RIFF header). Strips header, plays PCM data.</summary>
        public void AddWavChunk(byte[] wavBytes)
        {
            if (wavBytes == null || wavBytes.Length < 44) return;

            try
            {
                // Parse WAV header
                int dataStart = FindDataChunk(wavBytes);
                if (dataStart < 0) return;

                int dataSize = BitConverter.ToInt32(wavBytes, dataStart + 4);
                if (dataSize <= 0 || dataStart + 8 + dataSize > wavBytes.Length)
                {
                    Debug.LogWarning($"[TTSPlayer] Invalid WAV data chunk size: {dataSize}");
                    return;
                }
                int sampleCount = dataSize / 2; // 16-bit mono

                float[] samples = new float[sampleCount];
                int offset = dataStart + 8;
                for (int i = 0; i < sampleCount && offset + 1 < wavBytes.Length; i++)
                {
                    short s = (short)(wavBytes[offset] | (wavBytes[offset + 1] << 8));
                    samples[i] = s / 32768f;
                    offset += 2;
                }

                // Read sample rate from header (may differ from default)
                int wavSampleRate = BitConverter.ToInt32(wavBytes, 24);
                if (wavSampleRate != _sampleRate && wavSampleRate > 0)
                {
                    samples = ResampleSimple(samples, wavSampleRate, _sampleRate);
                }

                AddFloatSamples(samples);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[TTSPlayer] Failed to parse WAV chunk: {ex.Message}");
            }
        }

        /// <summary>Signal that no more TTS audio data will be sent.</summary>
        public void OnTTSDataComplete()
        {
            _dataComplete = true;
            _dataCompleteFrameCount = Time.frameCount;

            // If not yet playing and we have data, start now
            if (_totalSamplesWritten > 0 && !_playbackStarted && AutoPlay)
            {
                _playbackStarted = true;
                OnPlaybackStarted?.Invoke();
            }

            if (_logChunks)
                Debug.Log($"[TTSPlayer] TTS data stream complete. Total: {_totalSamplesWritten} samples ({_totalSamplesWritten / (float)_sampleRate:F1}s)");
        }

        /// <summary>Interrupt playback immediately. Clears all buffered data.</summary>
        public void StopImmediate()
        {
            _source.Stop();
            _totalSamplesWritten = 0;
            _playbackStarted = false;
            _playbackFrameDelay = 0;
            _dataComplete = false;
            CurrentAmplitude = 0f;
            HasPendingAudio = false;

            if (IsPlaying)
            {
                IsPlaying = false;
                // Don't fire OnPlaybackComplete on manual stop
            }

            if (_logChunks)
                Debug.Log("[TTSPlayer] Stopped immediately.");
        }

        /// <summary>Get buffered audio samples for external processing (lip-sync).</summary>
        public bool GetCurrentSamples(out float[] samples, out int count)
        {
            if (_totalSamplesWritten > 0)
            {
                samples = _sampleBuffer;
                count = _totalSamplesWritten;
                return true;
            }
            samples = null;
            count = 0;
            return false;
        }

        public AudioSource GetAudioSource() => _source;
        public int SampleRate => _sampleRate;

        #endregion

        #region Private Methods

        private void AddFloatSamples(float[] samples)
        {
            if (samples == null || samples.Length == 0) return;

            int spaceLeft = _maxSamples - _totalSamplesWritten;
            if (samples.Length > spaceLeft)
            {
                Debug.LogWarning($"[TTSPlayer] Buffer overflow — truncating {samples.Length - spaceLeft} samples.");
                Array.Resize(ref samples, spaceLeft);
            }

            if (samples.Length == 0) return;

            // Incremental write into the streaming clip — no full-clip recreation
            _streamingClip.SetData(samples, _totalSamplesWritten);
            _totalSamplesWritten += samples.Length;
            HasPendingAudio = true;

            if (_logChunks)
                Debug.Log($"[TTSPlayer] +{samples.Length} samples (total: {_totalSamplesWritten})");

            // Start or resume playback on the same clip
            if (!_playbackStarted && AutoPlay)
            {
                _source.Play();
                IsPlaying = true;
                _playbackStarted = true;
                _playbackFrameDelay = 3;
                if (_logChunks)
                    Debug.Log($"[TTSPlayer] Playback started ({_totalSamplesWritten} samples)");
                OnPlaybackStarted?.Invoke();
            }
            else if (_playbackStarted && !_source.isPlaying && !_dataComplete)
            {
                // Buffer underrun recovery — resume same clip
                _source.Play();
                _playbackFrameDelay = 2;
                if (_logChunks)
                    Debug.Log($"[TTSPlayer] Playback resumed after buffer underrun");
            }
        }

        private void FinishPlayback()
        {
            IsPlaying = false;
            HasPendingAudio = false;
            CurrentAmplitude = 0f;
            _playbackStarted = false;

            if (_logChunks)
                Debug.Log($"[TTSPlayer] Playback complete. Total: {_totalSamplesWritten} samples ({_totalSamplesWritten / (float)_sampleRate:F1}s)");

            _totalSamplesWritten = 0;
            _dataComplete = false;

            OnPlaybackComplete?.Invoke();
        }

        #endregion

        #region Utilities

        private static float[] ConvertPCM16ToFloat(byte[] pcm16)
        {
            float[] samples = new float[pcm16.Length / 2];
            for (int i = 0; i < samples.Length; i++)
            {
                short s = (short)(pcm16[i * 2] | (pcm16[i * 2 + 1] << 8));
                samples[i] = s / 32768f;
            }
            return samples;
        }

        private static int FindDataChunk(byte[] wav)
        {
            int pos = 12;
            while (pos + 8 <= wav.Length)
            {
                string chunkId = System.Text.Encoding.ASCII.GetString(wav, pos, 4);
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
    }
}
