using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Bridges the physiological needs system with the emotional model.
    /// Hunger/fatigue/entertainment levels modulate PAD values, creating
    /// a deeper, more organic emotional response.
    /// </summary>
    [RequireComponent(typeof(PADEmotionEngine))]
    public sealed class NeedsEmotionBridge : MonoBehaviour
    {
        [Header("Need → Emotion Modulation")]
        [SerializeField, Range(0f, 1f)]
        private float _modulationStrength = 0.3f;

        [Header("User Emotion Contagion")]
        [SerializeField]
        private bool _enableContagion = true;

        [SerializeField, Range(0f, 0.5f)]
        private float _contagionStrength = 0.15f;

        [SerializeField, Range(60f, 600f)]
        private float _contagionCheckInterval = 120f; // How often to sample user mood

        private PADEmotionEngine _emotion;
        private Behavior.PetNeeds _needs;
        private float _contagionTimer;
        private float _lastUserActivityTime;
        private int _userActivityCount;
        private float _userMoodBias; // -1 (negative) to +1 (positive) estimated user mood

        private void Awake()
        {
            _emotion = GetComponent<PADEmotionEngine>();
            _needs = GetComponent<Behavior.PetNeeds>();
        }

        private void Start()
        {
            _lastUserActivityTime = Time.unscaledTime;
        }

        private void Update()
        {
            if (_needs == null || _emotion == null) return;

            ApplyNeedsModulation();

            if (_enableContagion)
            {
                _contagionTimer += Time.unscaledDeltaTime;
                if (_contagionTimer >= _contagionCheckInterval)
                {
                    _contagionTimer = 0f;
                    UpdateUserMoodEstimate();
                }
            }
        }

        private void ApplyNeedsModulation()
        {
            float pMod = 0f, aMod = 0f, dMod = 0f;

            // Hunger → decreased pleasure, increased arousal (restless)
            if (_needs.HungerLevel <= Behavior.PetNeeds.NeedLevel.Low)
            {
                float hungerSeverity = 1f - (_needs.Hunger / 30f);
                pMod -= hungerSeverity * 0.3f;
                aMod += hungerSeverity * 0.2f;
            }

            // Fatigue → decreased arousal, decreased pleasure
            if (_needs.FatigueLevel <= Behavior.PetNeeds.NeedLevel.Low)
            {
                float fatigueSeverity = 1f - (_needs.Fatigue / 30f);
                aMod -= fatigueSeverity * 0.4f;
                pMod -= fatigueSeverity * 0.15f;
            }

            // Boredom → decreased pleasure, increased arousal (seeking stimuli)
            if (_needs.EntertainmentLevel <= Behavior.PetNeeds.NeedLevel.Low)
            {
                float boreSeverity = 1f - (_needs.Entertainment / 30f);
                pMod -= boreSeverity * 0.25f;
                aMod += boreSeverity * 0.15f;
            }

            // Critical levels → amplify
            float criticalBoost = 0f;
            if (_needs.HungerLevel <= Behavior.PetNeeds.NeedLevel.Critical) criticalBoost += 0.5f;
            if (_needs.FatigueLevel <= Behavior.PetNeeds.NeedLevel.Critical) criticalBoost += 0.5f;
            if (_needs.EntertainmentLevel <= Behavior.PetNeeds.NeedLevel.Critical) criticalBoost += 0.3f;
            criticalBoost = Mathf.Clamp01(criticalBoost);

            // Apply modulation
            _emotion.ModulatePAD(
                pMod * _modulationStrength * (1f + criticalBoost),
                aMod * _modulationStrength * (1f + criticalBoost),
                dMod * _modulationStrength * (1f + criticalBoost)
            );
        }

        /// <summary>Estimate user's mood from activity patterns and apply mild contagion.</summary>
        private void UpdateUserMoodEstimate()
        {
            float elapsed = Time.unscaledTime - _lastUserActivityTime;

            // More activity = more positive estimated user mood
            float activityRate = _userActivityCount / (_contagionCheckInterval / 60f); // per minute
            _userActivityCount = 0;

            // Low activity → user might be stressed/negative (or just away)
            // High activity → user is engaged/positive
            if (elapsed < _contagionCheckInterval * 2f) // user was present
            {
                _userMoodBias = Mathf.Clamp((activityRate - 2f) / 5f, -0.5f, 0.5f);
            }
            else
            {
                _userMoodBias = Mathf.Lerp(_userMoodBias, -0.2f, 0.1f); // absent→slightly negative
            }

            // Apply contagion: pet's mood drifts toward estimated user mood
            if (Mathf.Abs(_userMoodBias) > 0.1f)
            {
                _emotion.ModulatePAD(
                    _userMoodBias * _contagionStrength,
                    Mathf.Abs(_userMoodBias) * _contagionStrength * 0.5f,
                    _userMoodBias * _contagionStrength * 0.3f
                );
            }
        }

        /// <summary>Call this from interaction handlers to track user activity.</summary>
        public void RegisterUserActivity()
        {
            _userActivityCount++;
            _lastUserActivityTime = Time.unscaledTime;
        }
    }
}
