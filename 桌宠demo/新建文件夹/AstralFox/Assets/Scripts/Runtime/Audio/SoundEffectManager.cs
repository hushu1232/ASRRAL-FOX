using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Audio;

namespace AstralFox.Audio
{
    /// <summary>
    /// Manages interaction sound effects and emotional voice snippets.
    /// Uses Unity Audio Mixer for grouping (Voice, SFX, UI).
    ///
    /// Voice cloning profiles allow switching character voices.
    /// Default profile: "Elysia" (爱莉希雅) — elegant maiden of Honkai Impact 3rd.
    ///
    /// Audio assets are loaded from Resources/Sounds/[Profile]/[SoundEvent].wav
    /// Falls back to procedurally generated placeholders if no audio file is found.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class SoundEffectManager : MonoBehaviour
    {
        #region Inspector

        [Header("Audio Mixer")]
        [SerializeField]
        private AudioMixer _audioMixer;

        [SerializeField]
        private string _sfxMixerGroup = "SFX";

        [SerializeField]
        private string _voiceMixerGroup = "Voice";

        [Header("Volume")]
        [SerializeField, Range(0f, 1f)]
        private float _sfxVolume = 0.7f;

        [SerializeField, Range(0f, 1f)]
        private float _voiceSnippetVolume = 0.8f;

        [SerializeField, Range(0f, 1f)]
        private float _uiVolume = 0.6f;

        [Header("Voice Profile")]
        [SerializeField, Tooltip("Character voice profile folder in Resources/Sounds/. Default: Elysia (爱莉希雅)")]
        private string _voiceProfile = "Elysia";

        [SerializeField, Tooltip("Fall back to procedural generation if no voice clips found.")]
        private bool _allowFallback = true;

        [Header("Debug")]
        [SerializeField]
        private bool _logSoundEvents = false;

        #endregion

        #region Types

        public enum SoundCategory { SFX, Voice, UI }

        public enum SoundEvent
        {
            VoiceHappy, VoiceSad, VoiceShy, VoiceAngry, VoiceCurious,
            PatHead, DragStart, DragEnd, WakeUp, Sleep, Feed,
            Notification, Reminder,
            Bounce, Land,
        }

        [Serializable]
        public struct SoundDefinition
        {
            public SoundEvent eventType;
            public AudioClip clip;
            public SoundCategory category;
            [Range(0f, 1f)] public float volume;
            [Range(0.1f, 3f)] public float pitch;
            [Range(0f, 1f)] public float pitchVariation;
        }

        #endregion

        #region Private Fields

        private AudioSource _sfxSource;
        private AudioSource _voiceSource;
        private AudioSource _uiSource;

        private Dictionary<SoundEvent, SoundDefinition> _soundMap
            = new Dictionary<SoundEvent, SoundDefinition>();

        private Dictionary<SoundEvent, float> _cooldowns
            = new Dictionary<SoundEvent, float>();

        private const float DefaultCooldown = 0.5f;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            CreateAudioSources();
            BuildSoundMap();
        }

        private List<SoundEvent> _cooldownKeys = new List<SoundEvent>(); // cached for Update

        private void Update()
        {
            _cooldownKeys.Clear();
            _cooldownKeys.AddRange(_cooldowns.Keys);
            foreach (var key in _cooldownKeys)
            {
                if (_cooldowns[key] > 0f)
                    _cooldowns[key] -= Time.unscaledDeltaTime;
            }
        }

        #endregion

        #region Audio Source Setup

        private void CreateAudioSources()
        {
            _sfxSource = gameObject.AddComponent<AudioSource>();
            _sfxSource.playOnAwake = false;
            _sfxSource.loop = false;
            _sfxSource.spatialBlend = 0f;
            _sfxSource.volume = _sfxVolume;
            ConfigureMixerGroup(_sfxSource, _sfxMixerGroup);

            _voiceSource = gameObject.AddComponent<AudioSource>();
            _voiceSource.playOnAwake = false;
            _voiceSource.loop = false;
            _voiceSource.spatialBlend = 0f;
            _voiceSource.volume = _voiceSnippetVolume;
            ConfigureMixerGroup(_voiceSource, _voiceMixerGroup);

            _uiSource = gameObject.AddComponent<AudioSource>();
            _uiSource.playOnAwake = false;
            _uiSource.loop = false;
            _uiSource.spatialBlend = 0f;
            _uiSource.volume = _uiVolume;
        }

        private void ConfigureMixerGroup(AudioSource source, string groupName)
        {
            if (_audioMixer == null) return;
            var groups = _audioMixer.FindMatchingGroups(groupName);
            if (groups.Length > 0)
                source.outputAudioMixerGroup = groups[0];
        }

        #endregion

        #region Sound Map

        private void BuildSoundMap()
        {
            foreach (SoundEvent evt in Enum.GetValues(typeof(SoundEvent)))
            {
                _soundMap[evt] = new SoundDefinition
                {
                    eventType = evt, clip = null,
                    category = GetDefaultCategory(evt),
                    volume = 1f, pitch = 1f, pitchVariation = 0.05f,
                };
            }

            SetDef(SoundEvent.VoiceHappy, pitch: 1.1f, pitchVar: 0.08f);
            SetDef(SoundEvent.VoiceSad, pitch: 0.9f, pitchVar: 0.05f);
            SetDef(SoundEvent.VoiceShy, pitch: 0.95f, pitchVar: 0.06f);
            SetDef(SoundEvent.VoiceAngry, pitch: 1.05f, pitchVar: 0.1f);
            SetDef(SoundEvent.WakeUp, pitch: 1.2f, pitchVar: 0.1f);
            SetDef(SoundEvent.PatHead, volume: 0.6f, pitchVar: 0.15f);
            SetDef(SoundEvent.DragStart, volume: 0.4f);
            SetDef(SoundEvent.Notification, volume: 0.7f, pitch: 1.3f);

            int loadedCount = LoadAudioClips();
            int fallbackCount = 0;

            if (_allowFallback)
                fallbackCount = GenerateMissingClips();

            if (_logSoundEvents)
                Debug.Log($"[SoundEffectManager] Audio ready: {loadedCount} from Resources, " +
                         $"{fallbackCount} procedurally generated. Profile: {GetProfileName()}");
        }

        /// <summary>
        /// Load audio clips from Resources/Sounds/{Profile}/{SoundEvent}.wav.
        /// Falls back to Resources/Sounds/{SoundEvent}.wav if profile directory is empty.
        /// </summary>
        private int LoadAudioClips()
        {
            int loaded = 0;
            string profile = GetProfileName();

            foreach (SoundEvent evt in Enum.GetValues(typeof(SoundEvent)))
            {
                // Try profile-specific clip first
                var clip = Resources.Load<AudioClip>($"Sounds/{profile}/{evt}");
                if (clip == null)
                    clip = Resources.Load<AudioClip>($"Sounds/{evt}");

                if (clip != null)
                {
                    var def = _soundMap[evt];
                    def.clip = clip;
                    _soundMap[evt] = def;
                    loaded++;
                    if (_logSoundEvents)
                        Debug.Log($"[SoundEffectManager] Loaded: Sounds/{profile}/{evt}");
                }
            }
            return loaded;
        }

        /// <summary>Get the configured or default voice profile name.</summary>
        private string GetProfileName()
        {
            return !string.IsNullOrEmpty(_voiceProfile) ? _voiceProfile : "Elysia";
        }

        /// <summary>Change the active voice profile at runtime and reload clips.</summary>
        public void SetVoiceProfile(string profileName)
        {
            _voiceProfile = profileName;
            BuildSoundMap();
            if (_logSoundEvents)
                Debug.Log($"[SoundEffectManager] Voice profile switched to: {profileName}");
        }

        /// <summary>Get a list of available voice profiles found in Resources/Sounds/.</summary>
        public string[] GetAvailableProfiles()
        {
            var profiles = new List<string>();
            var allSounds = Resources.LoadAll<AudioClip>("Sounds");
            var seen = new HashSet<string>();
            foreach (var s in allSounds)
            {
                string path = s.name;
                int slash = path.LastIndexOf('/');
                if (slash > 0)
                {
                    string folder = path.Substring(0, slash);
                    if (!seen.Contains(folder))
                    {
                        seen.Add(folder);
                        profiles.Add(folder);
                    }
                }
            }
            return profiles.ToArray();
        }

        /// <summary>Generate procedural fallback clips for any missing sound events.</summary>
        private int GenerateMissingClips()
        {
            int generated = 0;
            foreach (var kvp in _soundMap)
            {
                if (kvp.Value.clip != null) continue;
                GeneratePlaceholder(kvp.Key);
                generated++;
            }
            return generated;
        }

        private void SetDef(SoundEvent evt, float? volume = null, float? pitch = null, float? pitchVar = null)
        {
            var def = _soundMap[evt];
            if (volume.HasValue) def.volume = volume.Value;
            if (pitch.HasValue) def.pitch = pitch.Value;
            if (pitchVar.HasValue) def.pitchVariation = pitchVar.Value;
            _soundMap[evt] = def;
        }

        private static SoundCategory GetDefaultCategory(SoundEvent evt)
        {
            return evt switch
            {
                SoundEvent.VoiceHappy or SoundEvent.VoiceSad or SoundEvent.VoiceShy
                    or SoundEvent.VoiceAngry or SoundEvent.VoiceCurious
                    => SoundCategory.Voice,
                SoundEvent.Notification or SoundEvent.Reminder => SoundCategory.UI,
                _ => SoundCategory.SFX,
            };
        }

        #endregion

        #region Public API

        public void Play(SoundEvent evt, float? overrideVolume = null)
        {
            if (!_soundMap.TryGetValue(evt, out var def)) return;
            if (def.clip == null) return;

            if (_cooldowns.TryGetValue(evt, out float cd) && cd > 0f)
                return;

            _cooldowns[evt] = DefaultCooldown;

            AudioSource source = def.category switch
            {
                SoundCategory.Voice => _voiceSource,
                SoundCategory.UI => _uiSource,
                _ => _sfxSource,
            };

            float vol = (overrideVolume ?? def.volume) * GetCategoryVolume(def.category);
            float pitch = def.pitch + UnityEngine.Random.Range(-def.pitchVariation, def.pitchVariation);

            source.pitch = pitch;
            source.PlayOneShot(def.clip, vol);

            if (_logSoundEvents)
                Debug.Log($"[SFX] {evt} | vol:{vol:F2} pitch:{pitch:F2}");
        }

        public void PlayByName(string eventName)
        {
            if (Enum.TryParse<SoundEvent>(eventName, out var evt))
                Play(evt);
        }

        public void PlayEmotionVoice(Animation.PetEmotion emotion)
        {
            SoundEvent evt = emotion switch
            {
                Animation.PetEmotion.Happy => SoundEvent.VoiceHappy,
                Animation.PetEmotion.Sad => SoundEvent.VoiceSad,
                Animation.PetEmotion.Shy => SoundEvent.VoiceShy,
                Animation.PetEmotion.Angry => SoundEvent.VoiceAngry,
                _ => SoundEvent.VoiceCurious,
            };
            Play(evt);
        }

        #endregion

        #region Placeholder Sound Generation (Fallback)

        private void GeneratePlaceholder(SoundEvent evt)
        {
            int sampleRate = 22050;
            switch (evt)
            {
                case SoundEvent.VoiceHappy:   GenerateTone(evt, sampleRate, 440f, 0.3f, WaveShape.Sine); break;
                case SoundEvent.VoiceSad:     GenerateTone(evt, sampleRate, 330f, 0.35f, WaveShape.Sine); break;
                case SoundEvent.VoiceShy:     GenerateTone(evt, sampleRate, 370f, 0.25f, WaveShape.Sine); break;
                case SoundEvent.VoiceAngry:   GenerateTone(evt, sampleRate, 520f, 0.2f, WaveShape.Square); break;
                case SoundEvent.VoiceCurious: GenerateTone(evt, sampleRate, 494f, 0.25f, WaveShape.Sine); break;
                case SoundEvent.PatHead:      GenerateNoise(evt, sampleRate, 0.08f, 0.6f); break;
                case SoundEvent.DragStart:    GenerateNoise(evt, sampleRate, 0.1f, 0.4f); break;
                case SoundEvent.DragEnd:      GenerateNoise(evt, sampleRate, 0.12f, 0.3f); break;
                case SoundEvent.WakeUp:       GenerateTone(evt, sampleRate, 660f, 0.15f, WaveShape.Sine); break;
                case SoundEvent.Sleep:        GenerateTone(evt, sampleRate, 330f, 0.3f, WaveShape.Sine); break;
                case SoundEvent.Feed:         GenerateTone(evt, sampleRate, 500f, 0.15f, WaveShape.Triangle); break;
                case SoundEvent.Bounce:       GenerateTone(evt, sampleRate, 300f, 0.1f, WaveShape.Sine); break;
                case SoundEvent.Land:         GenerateTone(evt, sampleRate, 200f, 0.08f, WaveShape.Sine); break;
                case SoundEvent.Notification: GenerateTone(evt, sampleRate, 880f, 0.15f, WaveShape.Sine); break;
                case SoundEvent.Reminder:     GenerateTone(evt, sampleRate, 1000f, 0.2f, WaveShape.Triangle); break;
            }
        }

        private enum WaveShape { Sine, Square, Triangle }

        private void GenerateTone(SoundEvent evt, int sampleRate, float frequency, float duration, WaveShape shape)
        {
            int samples = Mathf.CeilToInt(sampleRate * duration);
            var clip = AudioClip.Create($"sfx_{evt}", samples, 1, sampleRate, false);
            float[] data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / sampleRate;
                float envelope = Mathf.Clamp01((1f - (t / duration)) * 2f);
                float sample = shape switch
                {
                    WaveShape.Square => Mathf.Sign(Mathf.Sin(2f * Mathf.PI * frequency * t)),
                    WaveShape.Triangle => Mathf.PingPong(t * frequency * 2f, 1f) * 2f - 1f,
                    _ => Mathf.Sin(2f * Mathf.PI * frequency * t),
                };
                data[i] = sample * envelope * 0.3f;
            }

            clip.SetData(data, 0);
            var def = _soundMap[evt];
            def.clip = clip;
            _soundMap[evt] = def;
        }

        private void GenerateNoise(SoundEvent evt, int sampleRate, float duration, float volume)
        {
            int samples = Mathf.CeilToInt(sampleRate * duration);
            var clip = AudioClip.Create($"sfx_{evt}", samples, 1, sampleRate, false);
            float[] data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = (float)i / sampleRate;
                float envelope = 1f - (t / duration);
                data[i] = (UnityEngine.Random.value * 2f - 1f) * envelope * volume * 0.3f;
            }

            clip.SetData(data, 0);
            var def = _soundMap[evt];
            def.clip = clip;
            _soundMap[evt] = def;
        }

        #endregion

        #region Helpers

        private float GetCategoryVolume(SoundCategory cat) => cat switch
        {
            SoundCategory.Voice => _voiceSnippetVolume,
            SoundCategory.UI => _uiVolume,
            _ => _sfxVolume,
        };

        #endregion
    }
}
