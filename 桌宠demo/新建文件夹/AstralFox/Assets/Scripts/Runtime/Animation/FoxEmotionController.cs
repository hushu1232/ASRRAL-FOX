using System;
using System.Collections.Generic;
using UnityEngine;

#if CUBISM_SDK_PRESENT
using Live2D.Cubism.Framework;
using Live2D.Cubism.Framework.Expression;
#endif

namespace AstralFox.Animation
{
    /// <summary>
    /// Emotion controller that drives Live2D expression parameters.
    /// Handles emotion transitions, breathing, ear twitch, tail sway, and eye tracking.
    /// Works in tandem with PADEmotionEngine (high-level PAD model) for parameter-level execution.
    /// </summary>
    [RequireComponent(typeof(CubismParameterDriver))]
    public sealed class FoxEmotionController : MonoBehaviour
    {
        #region Inspector

        [Header("Transition")]
        [SerializeField, Range(0.1f, 5f)]
        private float _transitionDuration = 1f;

        [SerializeField]
        private AnimationCurve _transitionCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Header("Idle Animation")]
        [SerializeField, Range(0.1f, 3f)]
        private float _breathSpeed = 1.2f;

        [SerializeField, Range(0f, 1f)]
        private float _breathAmplitude = 0.3f;

        [SerializeField, Range(0.05f, 1f)]
        private float _earTwitchIntervalMin = 0.8f;

        [SerializeField, Range(1f, 10f)]
        private float _earTwitchIntervalMax = 4f;

        [SerializeField, Range(0f, 1f)]
        private float _earTwitchStrength = 0.4f;

        [SerializeField, Range(0.1f, 3f)]
        private float _tailSwaySpeed = 0.7f;

        [SerializeField, Range(0f, 1f)]
        private float _tailSwayAmplitude = 0.5f;

        [Header("Eye Tracking")]
        [SerializeField, Range(0f, 1f)]
        private float _eyeTrackStrength = 0.3f;

        [SerializeField, Range(0.01f, 0.5f)]
        private float _eyeTrackSmoothTime = 0.1f;

        [Header("Native Live2D Expressions")]
        [SerializeField]
        private bool _driveNativeExpressions = true;

        [SerializeField, Tooltip("Expression index for Happy. Default maps to YouXiaoMiao star-eye.")]
        private int _happyExpressionIndex = 4;

        [SerializeField, Tooltip("Expression index for Sad. Default maps to YouXiaoMiao crying.")]
        private int _sadExpressionIndex = 1;

        [SerializeField, Tooltip("Expression index for Shy. Default maps to YouXiaoMiao blush.")]
        private int _shyExpressionIndex = 9;

        [SerializeField, Tooltip("Expression index for Angry. Default maps to YouXiaoMiao dark-face.")]
        private int _angryExpressionIndex = 16;

        #endregion

        #region Private Fields

        private IFoxParameterDriver _driver;
        private FoxEmotion _currentEmotion = FoxEmotion.Neutral;

        // Transition state
        private FoxEmotion _fromEmotion;
        private FoxEmotion _toEmotion;
        private float _transitionTimer;
        private bool _inTransition;

        // Per-emotion target values — lazy-initialized
        private Dictionary<FoxEmotion, EmotionParamSnapshot> _emotionMap;

        // Idle animation state
        private float _breathPhase;
        private float _earTwitchTimer;
        private float _earTwitchEndTimer;
        private bool _earTwitchActive;
        private float _tailPhase;
        private float _earTwitchTarget;
        private float _tailSwingBaseValue;  // cached base from emotion, avoids read-modify-write drift

        // Eye tracking
        private Vector2 _lookTarget;      // -1..1 normalized
        private Vector2 _currentLook;
        private Vector2 _lookVelocity;

#if CUBISM_SDK_PRESENT
        private CubismExpressionController _nativeExpressionController;
        private CubismUpdateController _nativeUpdateController;
        private bool _warnedMissingNativeExpression;
#endif

        #endregion

        #region Types

        public enum FoxEmotion
        {
            Neutral,
            Happy,
            Sad,
            Shy,
            Angry
        }

        /// <summary>Snapshot of all animatable parameters for a given emotion state.</summary>
        public struct EmotionParamSnapshot
        {
            public float eyeSmileL, eyeSmileR;
            public float browLY, browRY;
            public float browLAngle, browRAngle;
            public float mouthForm;         // -1 frown, 0 neutral, +1 smile
            public float earL, earR;
            public float tailSwingBase;     // base offset for tail
            public float tailCurl;
            public float blush;
        }

        #endregion

        #region Properties

        public FoxEmotion CurrentEmotion => _currentEmotion;
        public bool InTransition => _inTransition;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _driver = GetComponent<CubismParameterDriver>();
#if CUBISM_SDK_PRESENT
            CacheNativeExpressionController();
#endif
            BuildEmotionMap();
        }

        private void Update()
        {
            if (_driver == null) return;
            UpdateEmotionTransition();
            UpdateIdleAnimation();
            UpdateEyeTracking();
        }

        private void OnDestroy()
        {
            _driver = null;
        }

        #endregion

        #region Public API

        /// <summary>Switch to an emotion with smooth transition.</summary>
        public void SetEmotion(FoxEmotion emotion, float? customDuration = null)
        {
            if (emotion == _currentEmotion && !_inTransition) return;
            if (!_emotionMap.ContainsKey(emotion)) return;

            ApplyNativeExpression(emotion);

            float dur = customDuration ?? _transitionDuration;
            if (dur <= 0f)
            {
                ApplySnapshot(_emotionMap[emotion]);
                _currentEmotion = emotion;
                _inTransition = false;
                return;
            }

            _fromEmotion = _currentEmotion;
            _toEmotion = emotion;
            _transitionTimer = 0f;
            _inTransition = true;
        }

        public void ClearNativeExpression()
        {
#if CUBISM_SDK_PRESENT
            if (!_driveNativeExpressions) return;
            CacheNativeExpressionController();
            if (_nativeExpressionController == null) return;
            _nativeExpressionController.CurrentExpressionIndex = -1;
            _nativeUpdateController?.Refresh();
            _nativeExpressionController.OnLateUpdate();
#endif
        }

        /// <summary>Set look-at target in normalized coordinates (-1..1).</summary>
        public void SetLookTarget(Vector2 target)
        {
            _lookTarget = Vector2.ClampMagnitude(target, 1f);
        }

        /// <summary>Set a look target from a screen point (handles coordinate conversion
        /// from screen space to model space). Call this from FoxInteraction or externally.</summary>
        public void SetLookTargetFromScreen(Vector2 screenPoint, Camera cam)
        {
            // Simple mapping: screen center = (0,0), edges = (±1, ±1)
            if (cam == null) return;
            Vector2 viewport = cam.ScreenToViewportPoint(screenPoint);
            _lookTarget = new Vector2(
                (viewport.x - 0.5f) * 2f,
                (viewport.y - 0.5f) * 2f);
            _lookTarget = Vector2.ClampMagnitude(_lookTarget, 1f);
        }

        #endregion

        #region Native Live2D Expressions

        private void ApplyNativeExpression(FoxEmotion emotion)
        {
#if CUBISM_SDK_PRESENT
            if (!_driveNativeExpressions) return;

            CacheNativeExpressionController();
            if (_nativeExpressionController == null)
            {
                WarnMissingNativeExpressionOnce();
                return;
            }

            int index = GetNativeExpressionIndex(emotion);
            var expressions = _nativeExpressionController.ExpressionsList?.CubismExpressionObjects;
            if (index >= 0 && (expressions == null || index >= expressions.Length))
            {
                if (expressions == null || expressions.Length == 0)
                {
                    Debug.LogWarning("[FoxEmotionController] Native expression list is empty.");
                    return;
                }

                Debug.LogWarning($"[FoxEmotionController] Native expression index {index} for {emotion} is out of range. Using last expression.");
                index = expressions.Length - 1;
            }

            _nativeExpressionController.CurrentExpressionIndex = index;
            _nativeUpdateController?.Refresh();
            _nativeExpressionController.OnLateUpdate();
#endif
        }

#if CUBISM_SDK_PRESENT
        private void CacheNativeExpressionController()
        {
            if (_nativeExpressionController == null)
                _nativeExpressionController = GetComponentInChildren<CubismExpressionController>();

            if (_nativeExpressionController != null && _nativeUpdateController == null)
                _nativeUpdateController = _nativeExpressionController.GetComponent<CubismUpdateController>();
        }

        private int GetNativeExpressionIndex(FoxEmotion emotion)
        {
            return emotion switch
            {
                FoxEmotion.Happy => _happyExpressionIndex,
                FoxEmotion.Sad => _sadExpressionIndex,
                FoxEmotion.Shy => _shyExpressionIndex,
                FoxEmotion.Angry => _angryExpressionIndex,
                _ => -1,
            };
        }

        private void WarnMissingNativeExpressionOnce()
        {
            if (_warnedMissingNativeExpression) return;
            _warnedMissingNativeExpression = true;
            Debug.LogWarning("[FoxEmotionController] No CubismExpressionController found in children. Native expression mapping is disabled.");
        }
#endif

        #endregion

        #region Emotion Transition

        private void UpdateEmotionTransition()
        {
            if (!_inTransition) return;

            _transitionTimer += Time.deltaTime;
            float t = Mathf.Clamp01(_transitionTimer / _transitionDuration);
            t = _transitionCurve.Evaluate(t);

            var from = _emotionMap[_fromEmotion];
            var to = _emotionMap[_toEmotion];
            var blended = LerpSnapshots(from, to, t);
            ApplySnapshot(blended);

            if (_transitionTimer >= _transitionDuration)
            {
                _inTransition = false;
                _currentEmotion = _toEmotion;
                ApplySnapshot(_emotionMap[_currentEmotion]);
            }
        }

        private EmotionParamSnapshot LerpSnapshots(EmotionParamSnapshot a, EmotionParamSnapshot b, float t)
        {
            return new EmotionParamSnapshot
            {
                eyeSmileL   = Mathf.Lerp(a.eyeSmileL,   b.eyeSmileL,   t),
                eyeSmileR   = Mathf.Lerp(a.eyeSmileR,   b.eyeSmileR,   t),
                browLY      = Mathf.Lerp(a.browLY,      b.browLY,      t),
                browRY      = Mathf.Lerp(a.browRY,      b.browRY,      t),
                browLAngle  = Mathf.Lerp(a.browLAngle,  b.browLAngle,  t),
                browRAngle  = Mathf.Lerp(a.browRAngle,  b.browRAngle,  t),
                mouthForm   = Mathf.Lerp(a.mouthForm,   b.mouthForm,   t),
                earL        = Mathf.Lerp(a.earL,        b.earL,        t),
                earR        = Mathf.Lerp(a.earR,        b.earR,        t),
                tailSwingBase = Mathf.Lerp(a.tailSwingBase, b.tailSwingBase, t),
                tailCurl    = Mathf.Lerp(a.tailCurl,    b.tailCurl,    t),
                blush       = Mathf.Lerp(a.blush,       b.blush,       t),
            };
        }

        private void ApplySnapshot(EmotionParamSnapshot s)
        {
            _driver.SetParameter(FoxParamId.EyeSmileL,  s.eyeSmileL);
            _driver.SetParameter(FoxParamId.EyeSmileR,  s.eyeSmileR);
            _driver.SetParameter(FoxParamId.BrowLY,     s.browLY);
            _driver.SetParameter(FoxParamId.BrowRY,     s.browRY);
            _driver.SetParameter(FoxParamId.BrowLAngle, s.browLAngle);
            _driver.SetParameter(FoxParamId.BrowRAngle, s.browRAngle);
            _driver.SetParameter(FoxParamId.MouthForm,  s.mouthForm);
            _driver.SetParameter(FoxParamId.EarL,       s.earL);
            _driver.SetParameter(FoxParamId.EarR,       s.earR);
            _driver.SetParameter(FoxParamId.TailSwing,  s.tailSwingBase);
            _driver.SetParameter(FoxParamId.TailCurl,   s.tailCurl);
            _driver.SetParameter(FoxParamId.Blush,      s.blush);

            _tailSwingBaseValue = s.tailSwingBase;
        }

        #endregion

        #region Idle Animation

        private void UpdateIdleAnimation()
        {
            UpdateBreathing();
            UpdateEarTwitch();
            UpdateTailSway();
        }

        private void UpdateBreathing()
        {
            _breathPhase += Time.deltaTime * _breathSpeed;
            float breath = Mathf.Sin(_breathPhase * Mathf.PI * 2f) * 0.5f + 0.5f;
            breath = Mathf.Lerp(0f, _breathAmplitude, breath);

            // Apply breath to body and slight head bob
            _driver.SetParameter(FoxParamId.Breath, breath);
            _driver.SetParameter(FoxParamId.BodyAngleX, breath * 2f - _breathAmplitude);
        }

        private void UpdateEarTwitch()
        {
            if (_earTwitchActive)
            {
                _earTwitchTimer += Time.deltaTime;
                if (_earTwitchTimer >= _earTwitchEndTimer)
                {
                    _earTwitchActive = false;
                    // Reset ears to normal
                    _driver.SetParameter(FoxParamId.EarLRotate, 0f);
                    _driver.SetParameter(FoxParamId.EarRRotate, 0f);
                    ScheduleNextEarTwitch();
                }
                else
                {
                    // Quick flick: sharp ease-out
                    float p = Mathf.Clamp01(_earTwitchTimer / _earTwitchEndTimer);
                    float strength = _earTwitchStrength * (1f - p) * Mathf.Sin(p * Mathf.PI * 4f);
                    _driver.SetParameter(FoxParamId.EarLRotate, strength * _earTwitchTarget);
                    _driver.SetParameter(FoxParamId.EarRRotate, strength * _earTwitchTarget);
                }
            }
            else if (_earTwitchTimer <= 0f && _driver.IsReady)
            {
                TriggerEarTwitch();
            }
            else
            {
                _earTwitchTimer -= Time.deltaTime;
            }
        }

        private void TriggerEarTwitch()
        {
            _earTwitchActive = true;
            _earTwitchTimer = 0f;
            _earTwitchEndTimer = 0.08f; // visible twitch
            _earTwitchTarget = UnityEngine.Random.Range(-1f, 1f);
        }

        private void ScheduleNextEarTwitch()
        {
            _earTwitchTimer = -UnityEngine.Random.Range(_earTwitchIntervalMin, _earTwitchIntervalMax);
        }

        private void UpdateTailSway()
        {
            _tailPhase += Time.deltaTime * _tailSwaySpeed;
            float sway = Mathf.Sin(_tailPhase) * _tailSwayAmplitude;

            // Use cached base value to avoid read-modify-write drift
            _driver.SetParameter(FoxParamId.TailSwing, _tailSwingBaseValue + sway);
            _driver.SetParameter(FoxParamId.TailWag, Mathf.Abs(Mathf.Sin(_tailPhase)) * _tailSwayAmplitude);
        }

        #endregion

        #region Eye Tracking

        private void UpdateEyeTracking()
        {
            _currentLook = Vector2.SmoothDamp(_currentLook, _lookTarget, ref _lookVelocity, _eyeTrackSmoothTime);
            _driver.SetParameter(FoxParamId.EyeBallX, _currentLook.x * _eyeTrackStrength);
            _driver.SetParameter(FoxParamId.EyeBallY, _currentLook.y * _eyeTrackStrength);
        }

        #endregion

        #region Emotion Map

        private void BuildEmotionMap()
        {
            _emotionMap = new Dictionary<FoxEmotion, EmotionParamSnapshot>
            {
                [FoxEmotion.Neutral] = new EmotionParamSnapshot
                {
                    eyeSmileL = 0.0f, eyeSmileR = 0.0f,
                    browLY = 0f, browRY = 0f,
                    browLAngle = 0f, browRAngle = 0f,
                    mouthForm = 0f,
                    earL = 0f, earR = 0f,
                    tailSwingBase = 0f, tailCurl = 0.5f,
                    blush = 0f,
                },
                [FoxEmotion.Happy] = new EmotionParamSnapshot
                {
                    eyeSmileL = 0.8f, eyeSmileR = 0.8f,
                    browLY = 0.3f, browRY = 0.3f,
                    browLAngle = 0.1f, browRAngle = 0.1f,
                    mouthForm = 1f,    // big smile
                    earL = 0.4f, earR = 0.4f,  // ears perked up
                    tailSwingBase = 0.6f, tailCurl = 0.7f,  // tail wagging
                    blush = 0.15f,
                },
                [FoxEmotion.Sad] = new EmotionParamSnapshot
                {
                    eyeSmileL = 0f, eyeSmileR = 0f,
                    browLY = -0.6f, browRY = -0.6f,
                    browLAngle = -0.3f, browRAngle = -0.3f,
                    mouthForm = -0.7f,  // frown
                    earL = -0.6f, earR = -0.6f,  // ears droop
                    tailSwingBase = 0f, tailCurl = 0.2f,  // tail low
                    blush = 0f,
                },
                [FoxEmotion.Shy] = new EmotionParamSnapshot
                {
                    eyeSmileL = 0.4f, eyeSmileR = 0.4f,
                    browLY = 0.1f, browRY = 0.1f,
                    browLAngle = -0.1f, browRAngle = -0.1f,
                    mouthForm = 0.2f,   // slight nervous smile
                    earL = -0.2f, earR = -0.2f,  // ears slightly back
                    tailSwingBase = 0f, tailCurl = 0.6f,  // tail wrapped around
                    blush = 0.7f,       // heavy blush
                },
                [FoxEmotion.Angry] = new EmotionParamSnapshot
                {
                    eyeSmileL = 0f, eyeSmileR = 0f,
                    browLY = -0.5f, browRY = -0.5f,
                    browLAngle = -0.6f, browRAngle = -0.6f,  // brow furrowed
                    mouthForm = -0.4f,  // slight snarl
                    earL = -0.8f, earR = 0.5f,  // ears pinned back (asymmetric)
                    tailSwingBase = -0.3f, tailCurl = 0.8f,  // tail stiff
                    blush = 0.1f,
                },
            };
        }

        #endregion
    }
}
