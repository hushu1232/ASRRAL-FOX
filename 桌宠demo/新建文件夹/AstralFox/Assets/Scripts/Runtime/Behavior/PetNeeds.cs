using System;
using UnityEngine;

namespace AstralFox.Behavior
{
    /// <summary>
    /// Simulates physiological needs that drive pet behavior.
    /// Three independent dimensions: Hunger, Fatigue, Entertainment.
    /// Needs decay over time and are replenished by interactions, creating a
    /// "living being" illusion that reacts to user attention.
    /// </summary>
    public sealed class PetNeeds : MonoBehaviour
    {
        #region Inspector

        [Header("Decay Rates (per minute)")]
        [SerializeField, Range(0.5f, 10f)]
        private float _hungerDecay = 2f;

        [SerializeField, Range(0.5f, 10f)]
        private float _fatigueDecay = 1.5f;

        [SerializeField, Range(0.5f, 10f)]
        private float _entertainmentDecay = 3f;

        [Header("Thresholds")]
        [SerializeField, Range(0f, 100f)]
        private float _lowThreshold = 30f;

        [SerializeField, Range(0f, 100f)]
        private float _criticalThreshold = 15f;

        [Header("Replenishment")]
        [SerializeField, Range(1f, 30f)]
        private float _chatReplenishEntertainment = 8f;

        [SerializeField, Range(1f, 30f)]
        private float _patReplenishEntertainment = 5f;

        [Header("Behavior Effects")]
        [SerializeField, Range(0.5f, 3f)]
        private float _fatigueSlowFactor = 1.8f;    // Speed multiplier when tired

        [SerializeField, Range(0.5f, 3f)]
        private float _hungerRestlessFactor = 1.5f;  // Speed multiplier when hungry

        #endregion

        #region Events

        public event Action<NeedType, NeedLevel> OnNeedChanged;
        public event Action<NeedType> OnNeedCritical;

        public enum NeedType { Hunger, Fatigue, Entertainment }
        public enum NeedLevel { High, Normal, Low, Critical }

        #endregion

        #region Properties

        public float Hunger { get; private set; } = 100f;
        public float Fatigue { get; private set; } = 100f;
        public float Entertainment { get; private set; } = 100f;

        public NeedLevel HungerLevel => GetLevel(Hunger);
        public NeedLevel FatigueLevel => GetLevel(Fatigue);
        public NeedLevel EntertainmentLevel => GetLevel(Entertainment);

        public float MovementSpeedMultiplier
        {
            get
            {
                float mult = 1f;
                if (FatigueLevel <= NeedLevel.Low) mult /= _fatigueSlowFactor;
                if (HungerLevel <= NeedLevel.Low) mult *= _hungerRestlessFactor;
                return mult;
            }
        }

        public bool IsTired => FatigueLevel <= NeedLevel.Low;
        public bool IsBored => EntertainmentLevel <= NeedLevel.Low;
        public bool IsHungry => HungerLevel <= NeedLevel.Low;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            // Load persisted needs
            var data = Data.DataStore.Instance;
            if (data != null)
            {
                Hunger = data.GetFloat("need_hunger", 100f);
                Fatigue = data.GetFloat("need_fatigue", 100f);
                Entertainment = data.GetFloat("need_entertainment", 100f);
            }
        }

        private void Update()
        {
            float dt = Time.deltaTime / 60f; // Per-minute decay

            float prevHunger = Hunger, prevFatigue = Fatigue, prevEntertainment = Entertainment;

            Hunger = Mathf.Max(0f, Hunger - _hungerDecay * dt);
            Fatigue = Mathf.Max(0f, Fatigue - _fatigueDecay * dt);
            Entertainment = Mathf.Max(0f, Entertainment - _entertainmentDecay * dt);

            // Fire events on threshold crosses
            CheckThresholdChange(NeedType.Hunger, prevHunger, Hunger);
            CheckThresholdChange(NeedType.Fatigue, prevFatigue, Fatigue);
            CheckThresholdChange(NeedType.Entertainment, prevEntertainment, Entertainment);

            // Persist periodically
            if (Time.frameCount % 300 == 0) SaveNeeds();
        }

        private void OnDestroy() => SaveNeeds();

        #endregion

        #region Public API

        /// <summary>Called when user chats with the pet.</summary>
        public void OnUserChatted()
        {
            Entertainment = Mathf.Min(100f, Entertainment + _chatReplenishEntertainment);
            Fatigue = Mathf.Max(0f, Fatigue - 2f); // Chatting wakes up slightly
        }

        /// <summary>Called when user pats the pet.</summary>
        public void OnUserPatted()
        {
            Entertainment = Mathf.Min(100f, Entertainment + _patReplenishEntertainment);
        }

        /// <summary>Called when pet wakes up from sleep.</summary>
        public void OnWakeUp()
        {
            Fatigue = Mathf.Min(100f, Fatigue + 40f);
        }

        /// <summary>Called when pet goes to sleep.</summary>
        public void OnSleep()
        {
            Fatigue = Mathf.Min(100f, Fatigue + 5f); // Slow recovery during sleep
        }

        /// <summary>Cheat: feed the pet.</summary>
        public void Feed()
        {
            Hunger = 100f;
            Entertainment = Mathf.Min(100f, Entertainment + 10f);
        }

        public NeedLevel GetLevel(NeedType type)
        {
            float val = type switch
            {
                NeedType.Hunger => Hunger,
                NeedType.Fatigue => Fatigue,
                NeedType.Entertainment => Entertainment,
                _ => 100f,
            };
            return GetLevel(val);
        }

        #endregion

        #region Helpers

        private static NeedLevel GetLevel(float val) => val switch
        {
            <= 0f => NeedLevel.Critical,
            <= 15f => NeedLevel.Critical,
            <= 30f => NeedLevel.Low,
            <= 60f => NeedLevel.Normal,
            _ => NeedLevel.High,
        };

        private void CheckThresholdChange(NeedType type, float prev, float curr)
        {
            NeedLevel prevLvl = GetLevel(prev), currLvl = GetLevel(curr);
            if (prevLvl != currLvl)
            {
                OnNeedChanged?.Invoke(type, currLvl);
                if (currLvl <= NeedLevel.Critical)
                    OnNeedCritical?.Invoke(type);
            }
        }

        private void SaveNeeds()
        {
            var data = Data.DataStore.Instance;
            if (data != null)
            {
                data.SetFloat("need_hunger", Hunger);
                data.SetFloat("need_fatigue", Fatigue);
                data.SetFloat("need_entertainment", Entertainment);
            }
        }

        #endregion
    }
}
