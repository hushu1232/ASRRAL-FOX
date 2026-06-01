using System;
using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Singleton manager for the pet animation system.
    /// Holds Live2DAnimator, exposes it via CurrentAnimator.
    /// All game modules access animation through this interface.
    /// </summary>
    [DefaultExecutionOrder(-100)] // Initialize before other modules
    public sealed class PetAnimationManager : MonoBehaviour
    {
        #region Singleton

        public static PetAnimationManager Instance { get; private set; }

        #endregion

        #region Inspector

        [Header("Model References")]
        [SerializeField, Tooltip("Live2D model root. Auto-detected if empty.")]
        private Live2DAnimator _live2DAnimator;

        #endregion

        #region Events

        /// <summary>Fired after model initialization completes.</summary>
        public event Action OnModelReady;

        #endregion

        #region Properties

        public IPetAnimator CurrentAnimator { get; private set; }

        public PetModelType CurrentModelType => PetModelType.Live2D;

        #endregion

        #region Private Fields

        // (reserved for future multi-model support)

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[PetAnimationManager] Duplicate instance destroyed.");
                Destroy(this);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            if (_live2DAnimator == null)
                _live2DAnimator = FindAnimatorInChildren<Live2DAnimator>();

            if (_live2DAnimator != null)
            {
                _live2DAnimator.SetVisible(true);
                CurrentAnimator = _live2DAnimator;
                Debug.Log("[PetAnimationManager] Live2D animator initialized.");
                OnModelReady?.Invoke();
            }
            else
            {
                Debug.LogError("[PetAnimationManager] No Live2DAnimator found under PetPlaceholder.");
            }
        }

        private void Update()
        {
            CurrentAnimator?.UpdateAnimator(Time.deltaTime);
        }

        #endregion

        #region Public API — Animator Access

        /// <summary>Get the Live2D animator directly (for editor/debug).</summary>
        public Live2DAnimator Live2D => _live2DAnimator;

        #endregion

        private static T FindAnimatorInChildren<T>() where T : Component
        {
            // Search under PetPlaceholder first, then root
            var petPlaceholder = GameObject.Find("FoxPlaceholder"); // "FoxPlaceholder" is the internal code name
            if (petPlaceholder != null)
            {
                var result = petPlaceholder.GetComponentInChildren<T>(includeInactive: true);
                if (result != null) return result;
            }

            // Fallback: search entire scene
            return FindObjectOfType<T>(includeInactive: true);
        }
    }
}
