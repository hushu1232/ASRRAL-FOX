using System;
using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Animation state machine that drives Live2D parameters through CubismParameterDriver.
    /// Handles idle behaviors, blinking, head motion, state poses, and per-state parameter overrides.
    /// PADEmotionEngine drives high-level emotion decisions; this class handles parameter-level execution.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    [RequireComponent(typeof(CubismParameterDriver))]
    [RequireComponent(typeof(FoxEmotionController))]
    public sealed class FoxAnimationController : MonoBehaviour
    {
        #region Inspector

        [Header("State Defaults")]
        [SerializeField, Range(0.1f, 30f)]
        private float _idleToSleepTime = 15f;  // seconds idle before sleep

        [Header("Listening Pose")]
        [SerializeField, Range(0f, 1f)]
        private float _listeningLeanAmount = 0.6f;
        [SerializeField, Range(0f, 1f)]
        private float _listeningEarPerk = 0.7f;

        [Header("Sleep Pose")]
        [SerializeField, Range(0f, 1f)]
        private float _sleepEyeClose = 0.85f;
#pragma warning disable CS0414 // Inspector field, reserved for sleep animation tuning
        [SerializeField, Range(0f, 1f)]
        private float _sleepBreathSlow = 0.4f;
#pragma warning restore CS0414
        [SerializeField, Range(0f, 1f)]
        private float _sleepHeadDroop = 0.5f;

        [Header("Speaking")]
        [SerializeField, Range(0f, 1f)]
        private float _speakingHeadBobAmp = 0.15f;
        [SerializeField, Range(1f, 8f)]
        private float _speakingHeadBobFreq = 3f;

        [Header("Greeting Pose")]
        [SerializeField, Range(0f, 1f)]
        private float _greetingEarPerk = 0.9f;
        [SerializeField, Range(0f, 1f)]
        private float _greetingTailWag = 0.8f;
        [SerializeField, Range(1f, 5f)]
        private float _greetingDuration = 2.5f;

        [Header("Dragging Pose")]
        [SerializeField, Range(0f, 1f)]
        private float _dragDangleAmount = 0.7f;
#pragma warning disable CS0414 // Inspector field, reserved for drag animation tuning
        [SerializeField, Range(0f, 1f)]
        private float _dragSurpriseEyes = 0.8f;
#pragma warning restore CS0414

        [Header("Blinking")]
        [SerializeField, Range(1f, 8f)]
        private float _blinkIntervalMin = 2.5f;
        [SerializeField, Range(2f, 15f)]
        private float _blinkIntervalMax = 6f;
        [SerializeField, Range(0.05f, 0.2f)]
        private float _blinkDuration = 0.1f;

        [Header("Head Idle Motion")]
        [SerializeField, Range(0f, 5f)]
        private float _headIdleSwayRange = 2f;
        [SerializeField, Range(0f, 5f)]
        private float _headIdleSwaySpeed = 0.5f;

        #endregion

        #region Types

        public enum FoxState
        {
            Idle,
            Listening,
            Speaking,
            Sleep,
            Dragging,
            Greeting,
        }

        private enum IdleBehavior
        {
            None,
            Scratch,     // scratch ear with hind leg
            Stretch,     // stretch body
            Sneeze,      // quick sneeze
            LookAround,  // turn head left-right
            ChaseTail,   // spin chasing own tail
            ShakeBody,   // full body shake
            Nuzzle,      // rub cheek with paw
            TiltHead,    // curious head tilt
            Bounce,      // happy little hop
            WavePaw,     // wave at user
            FlopEars,    // ears droop then perk up
            Wiggle,      // happy wiggle dance
        }

        #endregion

        #region Inspector — Idle Behaviors

        [Header("Idle Behaviors")]
        [SerializeField, Range(3f, 60f)]
        private float _idleBehaviorIntervalMin = 8f;

        [SerializeField, Range(5f, 90f)]
        private float _idleBehaviorIntervalMax = 25f;

        [SerializeField, Range(0.5f, 5f)]
        private float _scratchDuration = 1.5f;

        [SerializeField, Range(1f, 5f)]
        private float _stretchDuration = 2.5f;

        [SerializeField, Range(0.2f, 1f)]
        private float _sneezeDuration = 0.5f;

        [SerializeField, Range(1f, 4f)]
        private float _lookAroundDuration = 2f;

        [SerializeField, Range(1f, 4f)]
        private float _chaseTailDuration = 2.5f;

        [SerializeField, Range(0.5f, 2f)]
        private float _shakeBodyDuration = 1f;

        #endregion

        #region Private Fields

        private Animator _animator;
        private IFoxParameterDriver _driver;
        private FoxEmotionController _emotionController;
        private PADEmotionEngine _padEngine;
        private Audio.SoundEffectManager _sfx;

        private FoxState _currentState = FoxState.Idle;

        // Timers
        private float _idleTimer;
        private float _blinkTimer;
        private float _blinkCloseTimer;
        private bool _isBlinking;
        private bool _blinkEyesClosed;

        // Head idle motion
        private float _headSwayPhaseX;
        private float _headSwayPhaseY;

        // Speaking head bob
        private float _speakBobPhase;

        // Greeting timer
        private float _greetingTimer;

        // State pose parameters (interpolated toward targets)
        private float _currentLeanAmount;
        private float _currentEarPerk;

        // Idle behavior
        private IdleBehavior _currentIdleBehavior = IdleBehavior.None;
        private float _idleBehaviorTimer;
        private float _idleBehaviorPhase;
        private float _nextBehaviorScheduledTime;

        // Animator parameter hashes (cached)
        private static readonly int Param_State = Animator.StringToHash("State");
        private static readonly int Param_EmotionWeight = Animator.StringToHash("EmotionWeight");

        private bool _isReady;

        #endregion

        #region Properties

        public FoxState CurrentState => _currentState;
        public bool IsReady => _isReady;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _animator = GetComponent<Animator>();
            _driver = GetComponent<CubismParameterDriver>();
            _emotionController = GetComponent<FoxEmotionController>();
            _padEngine = GetComponent<PADEmotionEngine>();
            _sfx = GetComponent<Audio.SoundEffectManager>();
        }

        private void Start()
        {
            if (_animator == null || _driver == null || !_driver.IsReady)
            {
                Debug.LogWarning("[FoxAnimationController] Missing Animator or Driver. Disabled.");
                enabled = false;
                return;
            }

            _isReady = true;
            _idleTimer = 0f;
            ScheduleNextBlink();
            SetState(FoxState.Idle);
        }

        private void Update()
        {
            if (!_isReady || _driver == null) return;

            UpdateIdleTimer();
            UpdateGreetingTimer();
            UpdateBlinking();
            UpdateHeadIdleMotion();
            UpdateStatePose();
            UpdateIdleBehavior();
        }

        private void OnDestroy()
        {
            _isReady = false;
        }

        #endregion

        #region Public API — State Control

        /// <summary>Switch to a new animation state.</summary>
        public void SetState(FoxState newState)
        {
            if (!_isReady) return;
            if (newState == _currentState) return;

            FoxState previous = _currentState;
            _currentState = newState;

            // Update Animator (only if alive and controller assigned — Live2D doesn't need one)
            if (_animator != null && _animator.runtimeAnimatorController != null)
                _animator.SetInteger(Param_State, (int)newState);

            // Reset timers on transition
            if (newState != FoxState.Idle)
                _idleTimer = 0f;

            // State entry behaviors
            switch (newState)
            {
                case FoxState.Listening:
                    // Auto-transition to Idle after a timeout (handled by external caller in later phases)
                    break;
                case FoxState.Sleep:
                    _driver.SetParameter(FoxParamId.EyeLOpen, _sleepEyeClose);
                    _driver.SetParameter(FoxParamId.EyeROpen, _sleepEyeClose);
                    break;
                case FoxState.Idle:
                    if (previous == FoxState.Sleep)
                    {
                        // Wake up: open eyes immediately
                        _driver.SetParameterImmediate(FoxParamId.EyeLOpen, 1f);
                        _driver.SetParameterImmediate(FoxParamId.EyeROpen, 1f);
                    }
                    break;
                case FoxState.Greeting:
                    _greetingTimer = 0f;
                    break;
            }

            Debug.Log($"[FoxAnimationController] State: {previous} → {newState}");
        }

        /// <summary>Called by FoxInteraction when drag starts.</summary>
        public void OnDragStart()
        {
            _padEngine?.ApplyEventType(PADEmotionEngine.EmotionEventType.Dragged);
            _sfx?.Play(Audio.SoundEffectManager.SoundEvent.DragStart);
            SetState(FoxState.Dragging);
        }

        /// <summary>Called by FoxInteraction when drag ends.</summary>
        public void OnDragEnd()
        {
            _sfx?.Play(Audio.SoundEffectManager.SoundEvent.DragEnd);
            SetState(FoxState.Idle);
            _idleTimer = 0f;
        }

        /// <summary>Called when wake word is detected.</summary>
        public void OnWakeWord()
        {
            _padEngine?.ApplyEventType(PADEmotionEngine.EmotionEventType.WakeUp);
            _sfx?.Play(Audio.SoundEffectManager.SoundEvent.WakeUp);
            if (_currentState == FoxState.Sleep || _currentState == FoxState.Idle)
                SetState(FoxState.Listening);
        }

        /// <summary>Called when a voice response starts playing.</summary>
        public void OnSpeakingStart()
        {
            if (!_isReady || _driver == null) return;
            SetState(FoxState.Speaking);
        }

        /// <summary>Called when voice response finishes.</summary>
        public void OnSpeakingEnd()
        {
            if (!_isReady || _driver == null) return;
            SetState(FoxState.Idle);
            _idleTimer = 0f;
        }

        /// <summary>Set mouth openness for lip sync (0-1). Called every frame during speech.</summary>
        public void SetMouthOpen(float value)
        {
            _driver.SetParameter(FoxParamId.MouthOpenY, Mathf.Clamp01(value));
        }

        /// <summary>Set a look target for the fox's eyes (world or screen space handled by emotion controller).</summary>
        public void SetLookTarget(Vector2 target)
        {
            _emotionController.SetLookTarget(target);
        }

        /// <summary>Switch emotion with transition.</summary>
        public void SetEmotion(FoxEmotionController.FoxEmotion emotion)
        {
            _emotionController.SetEmotion(emotion);
        }

        /// <summary>Switch emotion by name (string-based API for external consumers).</summary>
        public void SetEmotion(string emotionName)
        {
            var emotion = emotionName?.ToLowerInvariant() switch
            {
                "happy" => FoxEmotionController.FoxEmotion.Happy,
                "sad" => FoxEmotionController.FoxEmotion.Sad,
                "shy" => FoxEmotionController.FoxEmotion.Shy,
                "angry" => FoxEmotionController.FoxEmotion.Angry,
                "surprised" => FoxEmotionController.FoxEmotion.Happy,
                _ => FoxEmotionController.FoxEmotion.Neutral,
            };
            SetEmotion(emotion);
        }

        /// <summary>Play a named one-shot animation (string-based API).</summary>
        public void PlayAnimation(string animationName)
        {
            var state = animationName?.ToLowerInvariant() switch
            {
                "jump" => FoxState.Greeting,
                "idle" => FoxState.Idle,
                "speaking" => FoxState.Speaking,
                "sleep" => FoxState.Sleep,
                _ => FoxState.Idle,
            };
            SetState(state);
        }

        #endregion

        #region Idle Timer (Idle → Sleep)

        private void UpdateIdleTimer()
        {
            if (_currentState != FoxState.Idle) return;

            _idleTimer += Time.deltaTime;
            if (_idleTimer >= _idleToSleepTime)
            {
                _padEngine?.ApplyEventType(PADEmotionEngine.EmotionEventType.FallAsleep);
                SetState(FoxState.Sleep);
            }
        }

        #endregion

        #region Greeting Timer (Greeting → Idle)

        private void UpdateGreetingTimer()
        {
            if (_currentState != FoxState.Greeting) return;

            _greetingTimer += Time.deltaTime;
            if (_greetingTimer >= _greetingDuration)
            {
                SetState(FoxState.Idle);
                _idleTimer = 0f;
            }
        }

        #endregion

        #region Blinking

        private void UpdateBlinking()
        {
            if (_currentState == FoxState.Sleep) return; // Eyes stay closed in sleep

            if (_isBlinking)
            {
                _blinkCloseTimer += Time.deltaTime;

                if (!_blinkEyesClosed && _blinkCloseTimer >= _blinkDuration * 0.3f)
                {
                    // Close eyes
                    _blinkEyesClosed = true;
                    _driver.SetParameter(FoxParamId.EyeLOpen, 0f);
                    _driver.SetParameter(FoxParamId.EyeROpen, 0f);
                }

                if (_blinkCloseTimer >= _blinkDuration)
                {
                    // Open eyes
                    _isBlinking = false;
                    _blinkEyesClosed = false;
                    _driver.SetParameter(FoxParamId.EyeLOpen, 1f);
                    _driver.SetParameter(FoxParamId.EyeROpen, 1f);
                    ScheduleNextBlink();
                }
            }
            else
            {
                _blinkTimer -= Time.deltaTime;
                if (_blinkTimer <= 0f)
                {
                    _isBlinking = true;
                    _blinkCloseTimer = 0f;
                    _blinkEyesClosed = false;
                }
            }
        }

        private void ScheduleNextBlink()
        {
            _blinkTimer = UnityEngine.Random.Range(_blinkIntervalMin, _blinkIntervalMax);
        }

        #endregion

        #region Head Idle Motion

        private void UpdateHeadIdleMotion()
        {
            if (_currentState == FoxState.Dragging) return;

            float speed = _headIdleSwaySpeed;
            float range = _headIdleSwayRange;

            // Slower head motion during sleep
            if (_currentState == FoxState.Sleep)
            {
                speed *= 0.3f;
                range *= 0.5f;
            }

            _headSwayPhaseX += Time.deltaTime * speed * 1.3f;
            _headSwayPhaseY += Time.deltaTime * speed * 0.7f;

            float angleX = Mathf.Sin(_headSwayPhaseX) * range;
            float angleY = Mathf.Cos(_headSwayPhaseY) * range * 0.6f;
            float angleZ = Mathf.Sin(_headSwayPhaseX * 1.7f) * range * 0.3f;

            _driver.SetParameter(FoxParamId.AngleX, angleX);
            _driver.SetParameter(FoxParamId.AngleY, angleY);
            _driver.SetParameter(FoxParamId.AngleZ, angleZ);
        }

        #endregion

        #region State Pose

        /// <summary>Apply per-state pose overrides on top of the base idle animation.</summary>
        private void UpdateStatePose()
        {
            float targetLean = 0f;
            float targetEar = 0f;
            float targetBodyAngleX = 0f;
            float targetBodyAngleY = 0f;

            switch (_currentState)
            {
                case FoxState.Listening:
                    targetLean = _listeningLeanAmount;
                    targetEar = _listeningEarPerk;
                    targetBodyAngleX = -3f * _listeningLeanAmount; // lean forward
                    break;

                case FoxState.Sleep:
                    targetLean = _sleepHeadDroop;
                    targetEar = -0.5f;
                    targetBodyAngleX = 5f; // slight recline
                    targetBodyAngleY = 2f; // slight tilt
                    break;

                case FoxState.Speaking:
                    targetEar = 0.3f;
                    UpdateSpeakingBob();
                    break;

                case FoxState.Greeting:
                    // Ears fully perked + tail vigorously wagging
                    targetEar = _greetingEarPerk;
                    targetBodyAngleX = -2f; // slight forward lean (interested)
                    // Cycle tail wag with greeting energy
                    float greetPhase = _greetingTimer * 8f;
                    _driver.SetParameter(FoxParamId.TailWag, _greetingTailWag * (0.6f + 0.4f * Mathf.Sin(greetPhase)));
                    _driver.SetParameter(FoxParamId.TailSwing, Mathf.Sin(greetPhase * 1.3f) * _greetingTailWag);
                    // Happy eye squint
                    _driver.SetParameter(FoxParamId.EyeLOpen, 0.85f);
                    _driver.SetParameter(FoxParamId.EyeROpen, 0.85f);
                    break;

                case FoxState.Dragging:
                    targetEar = -0.3f;
                    // Limbs dangle — set arms to loose position
                    _driver.SetParameter(FoxParamId.ArmL, -_dragDangleAmount);
                    _driver.SetParameter(FoxParamId.ArmR, -_dragDangleAmount);
                    _driver.SetParameter(FoxParamId.TailCurl, 0.1f); // tail hangs down
                    break;

                default: // Idle
                    _driver.SetParameter(FoxParamId.ArmL, 0f);
                    _driver.SetParameter(FoxParamId.ArmR, 0f);
                    break;
            }

            // Smooth interpolation for pose parameters
            float smoothSpeed = 4f;
            _currentLeanAmount = Mathf.Lerp(_currentLeanAmount, targetLean, Time.deltaTime * smoothSpeed);
            _currentEarPerk = Mathf.Lerp(_currentEarPerk, targetEar, Time.deltaTime * smoothSpeed);

            // Apply body lean
            _driver.SetParameter(FoxParamId.BodyAngleX, targetBodyAngleX + _currentLeanAmount * 3f);
            _driver.SetParameter(FoxParamId.BodyAngleY, targetBodyAngleY);

            // Apply ear perk (adds to baseline from emotion controller)
            if (_currentState != FoxState.Dragging)
            {
                float earBase = _driver.GetParameter(FoxParamId.EarL);
                _driver.SetParameter(FoxParamId.EarL, earBase + _currentEarPerk * 0.3f);
                _driver.SetParameter(FoxParamId.EarR, _driver.GetParameter(FoxParamId.EarR) + _currentEarPerk * 0.3f);
            }
        }

        private void UpdateSpeakingBob()
        {
            _speakBobPhase += Time.deltaTime * _speakingHeadBobFreq;
            float bob = Mathf.Sin(_speakBobPhase) * _speakingHeadBobAmp;
            _driver.SetParameter(FoxParamId.BodyAngleX, bob);
            _driver.SetParameter(FoxParamId.AngleY, bob * 0.3f);
        }

        #endregion

        #region Idle Behaviors

        private void UpdateIdleBehavior()
        {
            if (_currentState != FoxState.Idle) return;

            if (_currentIdleBehavior == IdleBehavior.None)
            {
                _idleBehaviorTimer += Time.deltaTime;
                if (_idleBehaviorTimer >= _nextBehaviorScheduledTime)
                {
                    _idleBehaviorTimer = 0f;
                    StartRandomBehavior();
                }
            }
            else
            {
                _idleBehaviorTimer += Time.deltaTime;
                DriveCurrentBehavior();
            }
        }

        private void StartRandomBehavior()
        {
            // Pick behavior from 12 types, weighted toward common/natural ones
            float rand = UnityEngine.Random.value;
            if (rand < 0.16f)
                _currentIdleBehavior = IdleBehavior.Scratch;
            else if (rand < 0.30f)
                _currentIdleBehavior = IdleBehavior.LookAround;
            else if (rand < 0.42f)
                _currentIdleBehavior = IdleBehavior.Stretch;
            else if (rand < 0.52f)
                _currentIdleBehavior = IdleBehavior.Sneeze;
            else if (rand < 0.62f)
                _currentIdleBehavior = IdleBehavior.ShakeBody;
            else if (rand < 0.70f)
                _currentIdleBehavior = IdleBehavior.TiltHead;
            else if (rand < 0.77f)
                _currentIdleBehavior = IdleBehavior.Wiggle;
            else if (rand < 0.84f)
                _currentIdleBehavior = IdleBehavior.Nuzzle;
            else if (rand < 0.90f)
                _currentIdleBehavior = IdleBehavior.FlopEars;
            else if (rand < 0.95f)
                _currentIdleBehavior = IdleBehavior.Bounce;
            else if (rand < 0.98f)
                _currentIdleBehavior = IdleBehavior.WavePaw;
            else
                _currentIdleBehavior = IdleBehavior.ChaseTail;

            _idleBehaviorPhase = 0f;
            _idleBehaviorTimer = 0f;

            Debug.Log($"[FoxAnimationController] Idle behavior: {_currentIdleBehavior}");
        }

        private void EndCurrentBehavior()
        {
            _currentIdleBehavior = IdleBehavior.None;
            _idleBehaviorTimer = 0f;
            _nextBehaviorScheduledTime = UnityEngine.Random.Range(_idleBehaviorIntervalMin, _idleBehaviorIntervalMax);

            // Reset all behavior-driven parameters
            _driver.SetParameter(FoxParamId.EarL, 0f);
            _driver.SetParameter(FoxParamId.EarR, 0f);
            _driver.SetParameter(FoxParamId.TailWag, 0f);
            _driver.SetParameter(FoxParamId.BodyAngleX, 0f);
            _driver.SetParameter(FoxParamId.BodyAngleZ, 0f);
            _driver.SetParameter(FoxParamId.ArmL, 0f);
            _driver.SetParameter(FoxParamId.ArmR, 0f);
        }

        private void DriveCurrentBehavior()
        {
            switch (_currentIdleBehavior)
            {
                case IdleBehavior.Scratch:
                    DriveScratch();
                    break;
                case IdleBehavior.Stretch:
                    DriveStretch();
                    break;
                case IdleBehavior.Sneeze:
                    DriveSneeze();
                    break;
                case IdleBehavior.LookAround:
                    DriveLookAround();
                    break;
                case IdleBehavior.ChaseTail:
                    DriveChaseTail();
                    break;
                case IdleBehavior.ShakeBody:
                    DriveShakeBody();
                    break;
                case IdleBehavior.Nuzzle:
                    DriveNuzzle();
                    break;
                case IdleBehavior.TiltHead:
                    DriveTiltHead();
                    break;
                case IdleBehavior.Bounce:
                    DriveBounce();
                    break;
                case IdleBehavior.WavePaw:
                    DriveWavePaw();
                    break;
                case IdleBehavior.FlopEars:
                    DriveFlopEars();
                    break;
                case IdleBehavior.Wiggle:
                    DriveWiggle();
                    break;
            }
        }

        private void DriveScratch()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            _idleBehaviorPhase += Time.deltaTime * 8f;

            // Scratch: raise hind leg, tilt head, ears flicker
            float legLift = Mathf.Sin(t * Mathf.PI) * 0.7f; // leg motion bell curve
            float headTilt = Mathf.Sin(_idleBehaviorPhase * 2f) * 3f * Mathf.Sin(t * Mathf.PI);

            _driver.SetParameter(FoxParamId.BodyAngleX, headTilt);
            _driver.SetParameter(FoxParamId.BodyAngleZ, legLift * 5f);
            _driver.SetParameter(FoxParamId.EarL, Mathf.Sin(_idleBehaviorPhase * 5f) * 0.3f);
            _driver.SetParameter(FoxParamId.EarR, 0f);
            _driver.SetParameter(FoxParamId.TailWag, Mathf.Sin(_idleBehaviorPhase * 3f) * 0.2f);

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveStretch()
        {
            float t = _idleBehaviorTimer / _stretchDuration;

            // Stretch: slow lean back, then forward arch, arms out, tail curls
            float phase = Mathf.Clamp01(t);
            // Three-phase: lean back (0-0.3), hold (0.3-0.5), forward stretch (0.5-1.0)
            float leanBack;
            float forwardStretch;
            if (phase < 0.3f)
            {
                leanBack = (phase / 0.3f) * 4f; // ramp up lean back
                forwardStretch = 0f;
            }
            else if (phase < 0.5f)
            {
                leanBack = 4f; // hold
                forwardStretch = 0f;
            }
            else
            {
                float t2 = (phase - 0.5f) / 0.5f;
                leanBack = (1f - t2) * 4f;
                forwardStretch = Mathf.Sin(t2 * Mathf.PI) * 0.6f; // arms stretch forward
            }

            _driver.SetParameter(FoxParamId.BodyAngleX, -leanBack + forwardStretch * 3f);
            _driver.SetParameter(FoxParamId.BodyAngleY, Mathf.Sin(phase * Mathf.PI) * 2f);
            _driver.SetParameter(FoxParamId.ArmL, forwardStretch);
            _driver.SetParameter(FoxParamId.ArmR, forwardStretch);
            _driver.SetParameter(FoxParamId.TailCurl, phase * 0.8f);
            _driver.SetParameter(FoxParamId.EyeLOpen, Mathf.Lerp(1f, 0.4f, phase * 0.7f));
            _driver.SetParameter(FoxParamId.EyeROpen, Mathf.Lerp(1f, 0.4f, phase * 0.7f));

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveSneeze()
        {
            float t = _idleBehaviorTimer / _sneezeDuration;
            // Sneeze: brief body shake, head jerk forward, ears flatten
            // Build-up (0-0.4), sneeze (0.4-0.6), recovery (0.6-1.0)
            float intensity;
            if (t < 0.4f)
                intensity = t / 0.4f * 0.3f; // small wind-up
            else if (t < 0.6f)
                intensity = 1f; // full sneeze
            else
                intensity = Mathf.Lerp(1f, 0f, (t - 0.6f) / 0.4f);

            // Full body shake on sneeze
            float shakeFreq = 15f;
            float shake = Mathf.Sin(_idleBehaviorTimer * shakeFreq) * intensity * 3f;

            _driver.SetParameter(FoxParamId.BodyAngleX, 10f * intensity - shake); // lurch forward
            _driver.SetParameter(FoxParamId.AngleX, shake);
            _driver.SetParameter(FoxParamId.EarL, -0.5f * intensity); // ears flat
            _driver.SetParameter(FoxParamId.EarR, -0.5f * intensity);
            _driver.SetParameter(FoxParamId.EyeLOpen, Mathf.Lerp(1f, 0.1f, intensity));
            _driver.SetParameter(FoxParamId.EyeROpen, Mathf.Lerp(1f, 0.1f, intensity));
            _driver.SetParameter(FoxParamId.TailWag, intensity * 0.5f);

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveLookAround()
        {
            float t = _idleBehaviorTimer / _lookAroundDuration;

            // Slow horizontal head sweep: left → right → center
            float sweep = Mathf.Sin(t * Mathf.PI * 2f) * 4f;
            float earMotion = Mathf.Cos(t * Mathf.PI * 1.4f) * 0.25f;

            _driver.SetParameter(FoxParamId.AngleY, sweep);
            _driver.SetParameter(FoxParamId.AngleZ, Mathf.Sin(t * Mathf.PI * 1.7f) * 1.5f);
            _driver.SetParameter(FoxParamId.EarL, earMotion);
            _driver.SetParameter(FoxParamId.EarR, -earMotion);
            _driver.SetParameter(FoxParamId.BodyAngleY, sweep * 0.3f);

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveChaseTail()
        {
            float t = _idleBehaviorTimer / _chaseTailDuration;

            // Chase tail: spin body in place, tail moves away
            float spinSpeed = 4f;
            float spin = Mathf.Sin(t * spinSpeed * Mathf.PI * 2f) * 6f;
            float intensity = Mathf.Sin(t * Mathf.PI); // bell curve

            _driver.SetParameter(FoxParamId.BodyAngleZ, spin * intensity);
            _driver.SetParameter(FoxParamId.BodyAngleY, Mathf.Cos(t * spinSpeed * Mathf.PI * 2f) * 4f * intensity);
            _driver.SetParameter(FoxParamId.TailSwing, Mathf.Sin(t * 6f * Mathf.PI * 2f) * intensity);
            _driver.SetParameter(FoxParamId.TailWag, intensity * 0.4f);
            _driver.SetParameter(FoxParamId.AngleZ, -spin * 0.4f * intensity);

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveShakeBody()
        {
            float t = _idleBehaviorTimer / _shakeBodyDuration;

            // Full body shake like a wet dog
            float freq = 12f;
            float intensity = Mathf.Sin(t * Mathf.PI); // bell curve
            float shake = Mathf.Sin(t * freq * Mathf.PI * 2f) * intensity;

            _driver.SetParameter(FoxParamId.BodyAngleZ, shake * 4f);
            _driver.SetParameter(FoxParamId.AngleZ, shake * 2f);
            _driver.SetParameter(FoxParamId.TailWag, intensity * 0.8f + shake * 0.5f);
            _driver.SetParameter(FoxParamId.EarL, shake * 0.3f);
            _driver.SetParameter(FoxParamId.EarR, shake * 0.3f);
            _driver.SetParameter(FoxParamId.ArmL, shake * 0.4f);
            _driver.SetParameter(FoxParamId.ArmR, shake * 0.4f);

            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveNuzzle()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            // Rub cheek with paw — gentle, affectionate
            float nuzzle = Mathf.Sin(t * Mathf.PI) * 0.5f;
            _driver.SetParameter(FoxParamId.BodyAngleX, nuzzle * 3f);
            _driver.SetParameter(FoxParamId.ArmL, Mathf.Sin(t * Mathf.PI * 2f) * 0.4f);
            _driver.SetParameter(FoxParamId.EyeLOpen, Mathf.Lerp(1f, 0.5f, Mathf.Sin(t * Mathf.PI)));
            _driver.SetParameter(FoxParamId.EyeROpen, Mathf.Lerp(1f, 0.5f, Mathf.Sin(t * Mathf.PI)));
            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveTiltHead()
        {
            float t = _idleBehaviorTimer / _lookAroundDuration * 0.6f;
            // Curious head tilt — quick head angle shift with ear perk
            float tilt = Mathf.Sin(t * Mathf.PI * 2f) * 8f;
            _driver.SetParameter(FoxParamId.AngleZ, tilt);
            _driver.SetParameter(FoxParamId.EarL, Mathf.Abs(Mathf.Sin(t * Mathf.PI)) * 0.6f);
            _driver.SetParameter(FoxParamId.EarR, Mathf.Abs(Mathf.Sin(t * Mathf.PI)) * 0.6f);
            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveBounce()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            // Happy little hop — vertical bounce
            float bounce = Mathf.Abs(Mathf.Sin(t * Mathf.PI * 2f)) * Mathf.Clamp01(1f - t);
            _driver.SetParameter(FoxParamId.BodyAngleY, bounce * 1.5f);
            _driver.SetParameter(FoxParamId.TailWag, bounce * 0.8f);
            _driver.SetParameter(FoxParamId.EarL, bounce * 0.3f);
            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveWavePaw()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            // Wave at user — lift arm and sway
            float wave = Mathf.Sin(t * Mathf.PI * 3f) * Mathf.Sin(t * Mathf.PI);
            _driver.SetParameter(FoxParamId.ArmL, wave * 0.6f + 0.3f);
            _driver.SetParameter(FoxParamId.EyeLOpen, 0.6f);
            _driver.SetParameter(FoxParamId.EyeROpen, 0.6f);
            _driver.SetParameter(FoxParamId.TailWag, Mathf.Sin(t * Mathf.PI) * 0.7f);
            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveFlopEars()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            // Ears droop down then perk back up — 3 quick cycles
            float cycle = Mathf.Sin(t * Mathf.PI * 6f);
            float env = Mathf.Sin(t * Mathf.PI);
            _driver.SetParameter(FoxParamId.EarL, -0.5f + cycle * 0.4f * env);
            _driver.SetParameter(FoxParamId.EarR, -0.5f + cycle * 0.4f * env);
            _driver.SetParameter(FoxParamId.TailWag, env * 0.3f);
            if (t >= 1f) EndCurrentBehavior();
        }

        private void DriveWiggle()
        {
            float t = _idleBehaviorTimer / _scratchDuration;
            // Happy wiggle dance — whole body sways joyfully
            float wiggle = Mathf.Sin(t * Mathf.PI * 4f) * Mathf.Sin(t * Mathf.PI);
            _driver.SetParameter(FoxParamId.BodyAngleZ, wiggle * 5f);
            _driver.SetParameter(FoxParamId.TailWag, Mathf.Abs(wiggle) * 0.9f);
            _driver.SetParameter(FoxParamId.AngleY, wiggle * 2f);
            _driver.SetParameter(FoxParamId.EarL, Mathf.Abs(wiggle) * 0.5f);
            _driver.SetParameter(FoxParamId.EarR, Mathf.Abs(wiggle) * 0.5f);
            if (t >= 1f) EndCurrentBehavior();
        }

        #endregion
    }
}
