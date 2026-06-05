using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Live2D Cubism adapter implementing IPetAnimator.
    /// Wraps CubismParameterDriver + FoxAnimationController + FoxEmotionController
    /// so all game modules drive animation through a unified interface.
    ///
    /// Expected to live on the same GameObject as the Cubism model root,
    /// alongside Animator, CubismParameterDriver, FoxAnimationController,
    /// and FoxEmotionController.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    [RequireComponent(typeof(CubismParameterDriver))]
    [RequireComponent(typeof(FoxEmotionController))]
    [RequireComponent(typeof(FoxAnimationController))]
    public sealed class Live2DAnimator : MonoBehaviour, IPetAnimator
    {
        #region Private Fields

        private Animator _animator;
        private CubismParameterDriver _driver;
        private FoxAnimationController _animCtrl;
        private FoxEmotionController _emotionCtrl;
        private bool _isReady;
        private PetAnimationState _cachedState = PetAnimationState.Idle;

        #endregion

        #region IPetAnimator — Lifecycle

        public bool IsReady => _isReady && _driver != null && _driver.IsReady;

        public GameObject GetGameObject() => gameObject;

        public void SetVisible(bool visible)
        {
            gameObject.SetActive(visible);

            // When becoming visible, reset to Idle
            if (visible && _isReady)
            {
                _animCtrl.SetState(FoxAnimationController.FoxState.Idle);
                _cachedState = PetAnimationState.Idle;
            }
        }

        #endregion

        #region IPetAnimator — State Machine

        public PetAnimationState CurrentState
        {
            get
            {
                if (!_isReady) return _cachedState;
                _cachedState = ConvertState(_animCtrl.CurrentState);
                return _cachedState;
            }
        }

        public void SetState(PetAnimationState state)
        {
            _cachedState = state;
            if (_isReady)
                _animCtrl.SetState(ConvertState(state));
        }

        #endregion

        #region IPetAnimator — Event Callbacks

        public void OnDragStart()
        {
            _animCtrl?.OnDragStart();
        }

        public void OnDragEnd()
        {
            _animCtrl?.OnDragEnd();
        }

        public void OnWakeWord()
        {
            _animCtrl?.OnWakeWord();
        }

        public void OnSpeakingStart()
        {
            _animCtrl?.OnSpeakingStart();
        }

        public void OnSpeakingEnd()
        {
            _animCtrl?.OnSpeakingEnd();
        }

        #endregion

        #region IPetAnimator — Expression

        public void SetEmotion(PetEmotion emotion)
        {
            if (_isReady)
                _animCtrl.SetEmotion(ConvertEmotion(emotion));
        }

        #endregion

        #region IPetAnimator — Parameter Driving

        public void SetMouthOpen(float value)
        {
            _animCtrl?.SetMouthOpen(value);
        }

        public void SetEyeOpen(float value)
        {
            if (_driver == null || !_driver.IsReady) return;
            _driver.SetParameter(FoxParamId.EyeLOpen, value);
            _driver.SetParameter(FoxParamId.EyeROpen, value);
        }

        public void SetBodyPose(float angleX, float angleY, float angleZ)
        {
            if (_driver == null || !_driver.IsReady) return;
            _driver.SetParameter(FoxParamId.BodyAngleX, angleX);
            _driver.SetParameter(FoxParamId.BodyAngleY, angleY);
            _driver.SetParameter(FoxParamId.BodyAngleZ, angleZ);
        }

        public void SetTailWag(float value)
        {
            if (_driver == null || !_driver.IsReady) return;
            _driver.SetParameter(FoxParamId.TailWag, value);
        }

        public void SetTailSwing(float value)
        {
            if (_driver == null || !_driver.IsReady) return;
            _driver.SetParameter(FoxParamId.TailSwing, value);
        }

        public void SetEarPose(float left, float right)
        {
            if (_driver == null || !_driver.IsReady) return;
            _driver.SetParameter(FoxParamId.EarL, left);
            _driver.SetParameter(FoxParamId.EarR, right);
        }

        #endregion

        #region IPetAnimator — Per-Frame Update

        public void UpdateAnimator(float deltaTime)
        {
            // Sub-components (FoxAnimationController, FoxEmotionController)
            // run their own Update loops via Unity. This method exists for
            // drives all animation parameters explicitly per frame.
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _animator = GetComponent<Animator>();
            _driver = GetComponent<CubismParameterDriver>();
            _animCtrl = GetComponent<FoxAnimationController>();
            _emotionCtrl = GetComponent<FoxEmotionController>();
        }

        private void Start()
        {
            if (_animator == null)
            {
                Debug.LogError("[Live2DAnimator] Missing Animator component.");
                enabled = false;
                return;
            }

            _animator.applyRootMotion = false;
            _animator.updateMode = AnimatorUpdateMode.UnscaledTime;

            // Try to assign Animator Controller if missing
            if (_animator.runtimeAnimatorController == null)
            {
                var ctrl = Resources.Load<RuntimeAnimatorController>("FoxAnimator");
                if (ctrl == null)
                {
                    // Try AssetDatabase path (editor only) at runtime via pre-loaded asset
                    Debug.LogWarning("[Live2DAnimator] No Animator Controller assigned. " +
                        "Blend-tree animations will not play. Assign FoxAnimator.controller in the Inspector.");
                }
                else
                {
                    _animator.runtimeAnimatorController = ctrl;
                }
            }

            if (_driver == null)
            {
                Debug.LogError("[Live2DAnimator] Missing CubismParameterDriver.");
                enabled = false;
                return;
            }

            if (_animCtrl == null)
            {
                Debug.LogError("[Live2DAnimator] Missing FoxAnimationController.");
                enabled = false;
                return;
            }

            if (_emotionCtrl == null)
            {
                Debug.LogError("[Live2DAnimator] Missing FoxEmotionController.");
                enabled = false;
                return;
            }

            _isReady = true;
            Debug.Log("[Live2DAnimator] Initialized — Live2D Cubism adapter ready.");
        }

        #endregion

        #region Enum Conversion Helpers

        private static PetAnimationState ConvertState(FoxAnimationController.FoxState s) => s switch
        {
            FoxAnimationController.FoxState.Idle      => PetAnimationState.Idle,
            FoxAnimationController.FoxState.Listening => PetAnimationState.Listening,
            FoxAnimationController.FoxState.Speaking  => PetAnimationState.Speaking,
            FoxAnimationController.FoxState.Sleep     => PetAnimationState.Sleep,
            FoxAnimationController.FoxState.Dragging  => PetAnimationState.Dragging,
            FoxAnimationController.FoxState.Greeting  => PetAnimationState.Greeting,
            _ => PetAnimationState.Idle,
        };

        private static FoxAnimationController.FoxState ConvertState(PetAnimationState s) => s switch
        {
            PetAnimationState.Idle      => FoxAnimationController.FoxState.Idle,
            PetAnimationState.Listening => FoxAnimationController.FoxState.Listening,
            PetAnimationState.Speaking  => FoxAnimationController.FoxState.Speaking,
            PetAnimationState.Sleep     => FoxAnimationController.FoxState.Sleep,
            PetAnimationState.Dragging  => FoxAnimationController.FoxState.Dragging,
            PetAnimationState.Greeting  => FoxAnimationController.FoxState.Greeting,
            _ => FoxAnimationController.FoxState.Idle,
        };

        private static FoxEmotionController.FoxEmotion ConvertEmotion(PetEmotion e) => e switch
        {
            PetEmotion.Neutral => FoxEmotionController.FoxEmotion.Neutral,
            PetEmotion.Happy   => FoxEmotionController.FoxEmotion.Happy,
            PetEmotion.Sad     => FoxEmotionController.FoxEmotion.Sad,
            PetEmotion.Shy     => FoxEmotionController.FoxEmotion.Shy,
            PetEmotion.Angry   => FoxEmotionController.FoxEmotion.Angry,
            _ => FoxEmotionController.FoxEmotion.Neutral,
        };

        #endregion

        /// <summary>Switch to a different Live2D model at runtime (config update + restart).</summary>
        public void ReloadModel(string modelPath)
        {
            Debug.Log($"[Live2DAnimator] Model path updated to: {modelPath}. Full reload on next restart.");
            // Model reload requires Cubism SDK lifecycle — safe approach is config update + restart
            SetVisible(false);
            // Config is saved by QuickModelSwitch; user restarts or scene reloads for full model swap
        }
    }
}
