using AstralFox.AI.Context;
using System;
using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// PAD (Pleasure-Arousal-Dominance) emotion model for AstralFox.
    ///
    /// P (Pleasure/愉悦度):   -1=unpleasant, +1=pleasant
    /// A (Arousal/唤醒度):    -1=calm/sleepy, +1=excited/alert
    /// D (Dominance/支配度):  -1=submissive, +1=dominant
    ///
    /// PAD values drive the FoxEmotionController via PAD-to-emotion mapping,
    /// and are themselves affected by user interactions and conversation context.
    ///
    /// Decay: P and A decay toward baseline (0) over time.
    ///        D decays very slowly (stable personality trait).
    /// </summary>
    public sealed class PADEmotionEngine : MonoBehaviour
    {
        #region Inspector

        [Header("Initial State")]
        [SerializeField, Range(-1f, 1f)]
        private float _initialPleasure = 0.2f; // slightly positive

        [SerializeField, Range(-1f, 1f)]
        private float _initialArousal = 0.3f; // curious

        [SerializeField, Range(-1f, 1f)]
        private float _initialDominance = 0.1f; // slightly confident

        [Header("Decay")]
        [SerializeField, Range(0f, 0.1f), Tooltip("P decay per second toward baseline.")]
        private float _pleasureDecayRate = 0.003f; // ~5 min to decay 1.0

        [SerializeField, Range(0f, 0.1f), Tooltip("A decay per second toward baseline.")]
        private float _arousalDecayRate = 0.005f; // ~3 min

        [SerializeField, Range(0f, 0.01f), Tooltip("D decay per second (personality is stable).")]
        private float _dominanceDecayRate = 0.0005f; // ~30 min

        [Header("Baseline")]
        [SerializeField, Range(-1f, 1f)]
        private float _pleasureBaseline = 0f;

        [SerializeField, Range(-1f, 1f)]
        private float _arousalBaseline = 0f;

        [SerializeField, Range(-1f, 1f)]
        private float _dominanceBaseline = 0.1f; // fox has slight confidence baseline

        [Header("Smoothing")]
        [SerializeField, Range(0.01f, 0.5f)]
        private float _smoothTime = 0.15f;

        [Header("Debug")]
        [SerializeField]
        private bool _logEmotionChanges = false;

        #endregion

        #region Types

        /// <summary>Predefined emotion events with PAD deltas.</summary>
        public enum EmotionEventType
        {
            Petted,             // +P +A
            Ignored,            // -P -A
            PositiveChat,       // +P +A +D
            NegativeChat,       // -P (defensive +D)
            WakeUp,             // +A
            FallAsleep,         // -A
            Dragged,            // -P +A (surprised)
            Fed,                // +P +A
            Scared,             // -P +A -D
            Complimented,       // +P +D
            Insulted,           // -P +D (defensive)
            PlayedWith,         // +P +A
            LongAbsence,        // -P -A
        }

        [Serializable]
        public struct EmotionEvent
        {
            public EmotionEventType type;
            [Range(-1f, 1f)] public float pleasureDelta;
            [Range(-1f, 1f)] public float arousalDelta;
            [Range(-1f, 1f)] public float dominanceDelta;
            public float duration; // how long the effect lasts (0 = instant)

            public EmotionEvent(EmotionEventType type, float p, float a, float d, float dur = 0f)
            {
                this.type = type;
                pleasureDelta = p;
                arousalDelta = a;
                dominanceDelta = d;
                duration = dur;
            }
        }

        #endregion

        #region Properties

        public float Pleasure => _smoothP;
        public float Arousal => _smoothA;
        public float Dominance => _smoothD;

        /// <summary>Raw (unsmoothed) PAD values.</summary>
        public float RawPleasure => _rawP;
        public float RawArousal => _rawA;
        public float RawDominance => _rawD;

        /// <summary>Emotion label derived from PAD.</summary>
        public string EmotionLabel => PADToLabel(_smoothP, _smoothA, _smoothD);

        /// <summary>Mapped to FoxEmotion enum for animation.</summary>
        public PetEmotion CurrentEmotion
        {
            get
            {
                // Cache: only recalculate when PAD values actually change
                const float epsilon = 0.005f;
                if (Mathf.Abs(_smoothP - _lastRawP) > epsilon ||
                    Mathf.Abs(_smoothA - _lastRawA) > epsilon ||
                    Mathf.Abs(_smoothD - _lastRawD) > epsilon)
                {
                    _cachedEmotion = PADToEmotion(_smoothP, _smoothA, _smoothD);
                    _lastRawP = _smoothP;
                    _lastRawA = _smoothA;
                    _lastRawD = _smoothD;
                }
                return _cachedEmotion;
            }
        }

        #endregion

        #region Private Fields

        // Raw PAD values (instant changes, then decay)
        private float _rawP, _rawA, _rawD;

        // Smoothed PAD values (gradual transitions)
        private float _smoothP, _smoothA, _smoothD;

        // SmoothDamp velocities
        private float _velP, _velA, _velD;

        // Decay multipliers (set per-event, reset on next event)
        private float _decayMultP = 1f, _decayMultA = 1f, _decayMultD = 1f;

        private float _lastEmotionSwitchTime;
        private PetEmotion _lastEmittedEmotion;

        private float _saveTimer;

        // ── Per-frame optimization: cache slow-changing values ──
        private float _lastAffectionCheckTime;
        private float _cachedAffectionScale = 1f;
        private IPetAnimator _cachedAnimator;
        private PetEmotion _cachedEmotion;
        private float _lastRawP = float.NaN, _lastRawA, _lastRawD;
        private const float AffectionCheckInterval = 2f;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            // Cache frequently accessed references
            _cachedAnimator = PetAnimationManager.Instance?.CurrentAnimator;

            // Load saved emotion or use initial values
            var saved = Data.DataStore.Instance.LoadCurrentEmotion();
            if (Mathf.Approximately(saved.p, 0f) && Mathf.Approximately(saved.a, 0f) && Mathf.Approximately(saved.d, 0f))
            {
                _rawP = _initialPleasure;
                _rawA = _initialArousal;
                _rawD = _initialDominance;
            }
            else
            {
                _rawP = saved.p;
                _rawA = saved.a;
                _rawD = saved.d;
            }

            _smoothP = _rawP;
            _smoothA = _rawA;
            _smoothD = _rawD;
        }

        private void Update()
        {
            ApplyDecay();
            UpdateSmoothedValues();
            UpdateEmotionOutput();

            _saveTimer += Time.deltaTime;
            if (_saveTimer >= 30f)
            {
                _saveTimer = 0f;
                Data.DataStore.Instance.SaveCurrentEmotion(_smoothP, _smoothA, _smoothD);
            }
        }

        private void OnDestroy()
        {
            Data.DataStore.Instance.SaveCurrentEmotion(_smoothP, _smoothA, _smoothD);
            Data.DataStore.Instance.Save();
        }

        #endregion

        #region Decay

        private void ApplyDecay()
        {
            float dt = Time.deltaTime;

            // Affection-based decay scaling:
            // High affection → slower decay (the fox is happier to see you)
            // Low affection → normal decay
            // Throttled: affection changes rarely, check every N seconds instead of every frame
            if (Time.unscaledTime - _lastAffectionCheckTime > AffectionCheckInterval)
            {
                float affection = Data.DataStore.Instance.GetAffection().affectionLevel;
                _cachedAffectionScale = Mathf.Clamp01(1f - affection / 200f);
                _lastAffectionCheckTime = Time.unscaledTime;
            }

            _rawP = MoveToward(_rawP, _pleasureBaseline, _pleasureDecayRate * _decayMultP * dt * _cachedAffectionScale);
            _rawA = MoveToward(_rawA, _arousalBaseline, _arousalDecayRate * _decayMultA * dt);
            _rawD = MoveToward(_rawD, _dominanceBaseline, _dominanceDecayRate * _decayMultD * dt);

            // Reset decay multipliers
            _decayMultP = _decayMultA = _decayMultD = 1f;
        }

        private static float MoveToward(float current, float target, float maxDelta)
        {
            if (current < target)
                return Mathf.Min(current + maxDelta, target);
            return Mathf.Max(current - maxDelta, target);
        }

        #endregion

        #region Smoothing

        private void UpdateSmoothedValues()
        {
            _smoothP = Mathf.SmoothDamp(_smoothP, _rawP, ref _velP, _smoothTime);
            _smoothA = Mathf.SmoothDamp(_smoothA, _rawA, ref _velA, _smoothTime);
            _smoothD = Mathf.SmoothDamp(_smoothD, _rawD, ref _velD, _smoothTime);
        }

        #endregion

        #region Emotion Output

        private void UpdateEmotionOutput()
        {
            // Refresh cached animator reference if null (lazy init / model switch)
            if (_cachedAnimator == null)
                _cachedAnimator = PetAnimationManager.Instance?.CurrentAnimator;
            if (_cachedAnimator == null) return;

            var emotion = CurrentEmotion;

            // Only switch emotion if it has been stable for at least 2 seconds
            if (emotion != _lastEmittedEmotion)
            {
                if (Time.unscaledTime - _lastEmotionSwitchTime > 2f)
                {
                    _cachedAnimator.SetEmotion(emotion);
                    _lastEmittedEmotion = emotion;
                    _lastEmotionSwitchTime = Time.unscaledTime;

                    if (_logEmotionChanges)
                        Debug.Log($"[PAD] Emotion → {emotion} (P:{_smoothP:F2} A:{_smoothA:F2} D:{_smoothD:F2})");
                }
            }
            else
            {
                _lastEmotionSwitchTime = Time.unscaledTime;
            }
        }

        #endregion

        #region Public API

        /// <summary>Apply an emotion event, modifying raw PAD values.</summary>
        public void ApplyEvent(EmotionEvent evt)
        {
            _rawP = Mathf.Clamp(_rawP + evt.pleasureDelta, -1f, 1f);
            _rawA = Mathf.Clamp(_rawA + evt.arousalDelta, -1f, 1f);
            _rawD = Mathf.Clamp(_rawD + evt.dominanceDelta, -1f, 1f);

            Data.DataStore.Instance.AddEmotionRecord(_rawP, _rawA, _rawD, evt.type.ToString());

            if (_logEmotionChanges)
                Debug.Log($"[PAD] Event: {evt.type} → P:{_rawP:F2} A:{_rawA:F2} D:{_rawD:F2}");

            // Suppress decay for events that need prolonged effect
            if (evt.duration > 0f)
            {
                // Decay suppression is handled via multipliers in ApplyDecay
                _decayMultP = 0.1f;
                _decayMultA = 0.1f;
            }
        }

        /// <summary>Apply event by type with predefined deltas.</summary>
        public void ApplyEventType(EmotionEventType type)
        {
            ApplyEvent(GetPredefinedEvent(type));
        }

        /// <summary>Modulate PAD values directly without event overhead. Used by NeedsEmotionBridge and ContextAwareness.</summary>
        public void ModulatePAD(float pDelta, float aDelta, float dDelta)
        {
            _rawP = Mathf.Clamp(_rawP + pDelta, -1f, 1f);
            _rawA = Mathf.Clamp(_rawA + aDelta, -1f, 1f);
            _rawD = Mathf.Clamp(_rawD + dDelta, -1f, 1f);
        }

        /// <summary>Get the predefined PAD deltas for an event type.</summary>
        public static EmotionEvent GetPredefinedEvent(EmotionEventType type)
        {
            return type switch
            {
                EmotionEventType.Petted        => new EmotionEvent(type, +0.3f, +0.2f, +0.1f),
                EmotionEventType.Ignored       => new EmotionEvent(type, -0.1f, -0.15f, -0.05f),
                EmotionEventType.PositiveChat  => new EmotionEvent(type, +0.2f, +0.15f, +0.1f),
                EmotionEventType.NegativeChat  => new EmotionEvent(type, -0.2f, +0.05f, +0.1f),
                EmotionEventType.WakeUp        => new EmotionEvent(type, +0.05f, +0.5f, +0.05f),
                EmotionEventType.FallAsleep    => new EmotionEvent(type, 0f, -0.4f, -0.1f),
                EmotionEventType.Dragged       => new EmotionEvent(type, -0.1f, +0.3f, -0.2f),
                EmotionEventType.Fed           => new EmotionEvent(type, +0.35f, +0.25f, +0.05f),
                EmotionEventType.Scared        => new EmotionEvent(type, -0.4f, +0.5f, -0.4f),
                EmotionEventType.Complimented  => new EmotionEvent(type, +0.4f, +0.1f, +0.2f),
                EmotionEventType.Insulted      => new EmotionEvent(type, -0.3f, +0.2f, +0.15f),
                EmotionEventType.PlayedWith    => new EmotionEvent(type, +0.3f, +0.3f, +0.15f),
                EmotionEventType.LongAbsence   => new EmotionEvent(type, -0.25f, -0.3f, -0.15f),
                _ => new EmotionEvent(type, 0f, 0f, 0f),
            };
        }

        /// <summary>Get a text description of the current emotional state for LLM prompt injection.</summary>
        public string GetEmotionPromptContext()
        {
            float p = _smoothP, a = _smoothA, d = _smoothD;

            string mood = p switch
            {
                > 0.5f => "很开心",
                > 0.2f => "心情不错",
                > -0.2f => "心情平静",
                > -0.5f => "有点不开心",
                _ => "很难过",
            };

            string energy = a switch
            {
                > 0.5f => "精力充沛",
                > 0.2f => "比较精神",
                > -0.2f => "状态一般",
                > -0.5f => "有点困",
                _ => "很困倦",
            };

            string confidence = d switch
            {
                > 0.5f => "很自信",
                > 0.2f => "比较大方",
                > -0.2f => "态度平常",
                > -0.5f => "有点害羞",
                _ => "很胆怯",
            };

            // Affection context
            var affection = Data.DataStore.Instance.GetAffection();
            string friendship = affection.affectionLevel switch
            {
                > 80f => "非常亲密的伙伴",
                > 50f => "关系很好的朋友",
                > 20f => "正在熟悉的朋友",
                _ => "刚认识不久",
            };

            return $"当前情绪: {mood}, {energy}, {confidence}。与主人的关系: {friendship} (好感度 {affection.affectionLevel:F0}/100)。";
        }

        #endregion

        #region PAD → Emotion Mapping

        /// <summary>Map PAD values to the closest matching PetEmotion.</summary>
        public static PetEmotion PADToEmotion(float p, float a, float d)
        {
            // Compute distance to each emotion's PAD center
            float distHappy = PADDistance(p, a, d, +0.7f, +0.5f, +0.4f);
            float distSad   = PADDistance(p, a, d, -0.7f, -0.4f, -0.5f);
            float distShy   = PADDistance(p, a, d, +0.1f, -0.3f, -0.5f);
            float distAngry = PADDistance(p, a, d, -0.6f, +0.5f, +0.5f);
            float distNeutral = PADDistance(p, a, d, 0f, 0f, 0f) * 1.2f; // slight bias toward neutral

            float minDist = Mathf.Min(distHappy, distSad, distShy, distAngry, distNeutral);

            if (minDist >= distHappy)  return PetEmotion.Happy;
            if (minDist >= distSad)    return PetEmotion.Sad;
            if (minDist >= distShy)    return PetEmotion.Shy;
            if (minDist >= distAngry)  return PetEmotion.Angry;
            return PetEmotion.Neutral;
        }

        private static float PADDistance(float p, float a, float d, float cp, float ca, float cd)
        {
            float dp = p - cp, da = a - ca, dd = d - cd;
            return dp * dp + da * da + dd * dd; // squared Euclidean distance
        }

        private static string PADToLabel(float p, float a, float d)
        {
            var emotion = PADToEmotion(p, a, d);
            return emotion switch
            {
                PetEmotion.Happy => "开心",
                PetEmotion.Sad => "难过",
                PetEmotion.Shy => "害羞",
                PetEmotion.Angry => "生气",
                _ => "平静",
            };
        }

        #endregion
    }
}
