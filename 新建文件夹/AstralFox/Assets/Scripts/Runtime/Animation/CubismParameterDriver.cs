using System;
using System.Collections.Generic;
using UnityEngine;

#if CUBISM_SDK_PRESENT
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;
#endif

namespace AstralFox.Animation
{
    /// <summary>
    /// Bridges the FoxAnimationController to a Live2D CubismModel.
    /// Reads/writes CubismParameter values via string IDs.
    ///
    /// Prerequisites:
    ///   1. Import Live2D Cubism SDK for Unity into the project
    ///   2. Add "CUBISM_SDK_PRESENT" to PlayerSettings → Scripting Define Symbols
    ///   3. Attach this component to a GameObject with a CubismModel in its children
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public sealed class CubismParameterDriver : MonoBehaviour, IFoxParameterDriver
    {
        #region Inspector

        [Header("Model Reference")]
        [SerializeField, Tooltip("Auto-find CubismModel in children if left empty.")]
        private GameObject _modelRoot;

        [Header("Smoothing")]
        [SerializeField, Range(0.01f, 0.5f)]
        private float _smoothTime = 0.08f;

        [Header("Fallback (No SDK)")]
        [SerializeField, Tooltip("Used when Cubism SDK is not present. Parameters stored in a dictionary.")]
        private bool _useFallbackOnMissingSDK = true;

        #endregion

        #region Private Fields

#if CUBISM_SDK_PRESENT
        private CubismModel _model;
        private CubismParameterStore _paramStore;
        private Dictionary<string, CubismParameter> _paramLookup = new Dictionary<string, CubismParameter>();
#endif

        // Fallback storage (no SDK)
        private Dictionary<string, ParameterData> _fallbackParams = new Dictionary<string, ParameterData>();
        private Dictionary<string, float> _currentValues = new Dictionary<string, float>();
        private Dictionary<string, float> _velocityRefs = new Dictionary<string, float>();

        private bool _isReady;
        private bool _usingCubism;

        #endregion

        #region Properties

        public int ParameterCount
        {
            get
            {
#if CUBISM_SDK_PRESENT
                if (_usingCubism && _model != null)
                    return _model.Parameters.Length;
#endif
                return _fallbackParams.Count;
            }
        }

        public bool IsReady => _isReady;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
#if CUBISM_SDK_PRESENT
            InitializeCubism();
            if (_usingCubism) return;
#endif
            if (_useFallbackOnMissingSDK)
                InitializeFallback();
        }

        private void Start()
        {
            if (!_isReady)
            {
                Debug.LogWarning("[CubismParameterDriver] Not ready. " +
                    "Import Live2D Cubism SDK and add CUBISM_SDK_PRESENT to scripting defines, " +
                    "or enable fallback mode.");
            }
        }

        private void LateUpdate()
        {
            if (!_isReady) return;
            // Cubism SDK v5 updates model parameters automatically via the framework.
            // No explicit _model.Update() needed.
        }

        #endregion

        #region Initialization

#if CUBISM_SDK_PRESENT
        private void InitializeCubism()
        {
            if (_modelRoot != null)
                _model = _modelRoot.GetComponentInChildren<CubismModel>();
            else
                _model = GetComponentInChildren<CubismModel>();

            if (_model == null)
            {
                Debug.LogWarning("[CubismParameterDriver] No CubismModel found. Using fallback.");
                return;
            }

            _paramStore = GetComponentInChildren<CubismParameterStore>();
            _paramLookup.Clear();

            foreach (var param in _model.Parameters)
            {
                _paramLookup[param.Id] = param;
                _currentValues[param.Id] = param.DefaultValue;
                _velocityRefs[param.Id] = 0f;
            }

            _usingCubism = true;
            _isReady = true;
            Debug.Log($"[CubismParameterDriver] Initialized with {_model.Parameters.Length} Cubism parameters.");
        }
#endif

        private void InitializeFallback()
        {
            // Define basic parameters for testing without a Live2D model
            RegisterFallbackParam(FoxParamId.AngleX,         -30f, 30f, 0f);
            RegisterFallbackParam(FoxParamId.AngleY,         -30f, 30f, 0f);
            RegisterFallbackParam(FoxParamId.AngleZ,         -30f, 30f, 0f);
            RegisterFallbackParam(FoxParamId.BodyAngleX,     -20f, 20f, 0f);
            RegisterFallbackParam(FoxParamId.BodyAngleY,     -20f, 20f, 0f);
            RegisterFallbackParam(FoxParamId.BodyAngleZ,     -20f, 20f, 0f);
            RegisterFallbackParam(FoxParamId.EyeLOpen,        0f,  1f, 1f);
            RegisterFallbackParam(FoxParamId.EyeROpen,        0f,  1f, 1f);
            RegisterFallbackParam(FoxParamId.EyeBallX,       -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EyeBallY,       -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EyeSmileL,       0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EyeSmileR,       0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.BrowLY,         -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.BrowRY,         -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.BrowLAngle,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.BrowRAngle,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.MouthOpenY,      0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.MouthForm,      -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EarL,           -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EarR,           -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EarLRotate,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EarRRotate,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.TailSwing,      -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.TailCurl,       -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.TailWag,         0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.ArmL,           -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.ArmR,           -1f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.Breath,          0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EmotionHappy,    0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EmotionSad,      0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EmotionShy,      0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.EmotionAngry,    0f,  1f, 0f);
            RegisterFallbackParam(FoxParamId.Blush,           0f,  1f, 0f);

            _usingCubism = false;
            _isReady = true;
            Debug.Log($"[CubismParameterDriver] Fallback mode: {_fallbackParams.Count} parameters registered.");
        }

        private void RegisterFallbackParam(string id, float min, float max, float def)
        {
            _fallbackParams[id] = new ParameterData { min = min, max = max, defaultValue = def };
            _currentValues[id] = def;
            _velocityRefs[id] = 0f;
        }

        #endregion

        #region IFoxParameterDriver

        public void SetParameter(string paramId, float value)
        {
            if (!_isReady) return;
            if (!_currentValues.ContainsKey(paramId)) return;

#if CUBISM_SDK_PRESENT
            if (_usingCubism && _paramLookup.TryGetValue(paramId, out var cubismParam))
            {
                float target = Mathf.Clamp(value, cubismParam.MinimumValue, cubismParam.MaximumValue);
                float velocity = _velocityRefs[paramId];
                float smoothed = Mathf.SmoothDamp(_currentValues[paramId], target, ref velocity, _smoothTime);
                _velocityRefs[paramId] = velocity;
                _currentValues[paramId] = smoothed;
                cubismParam.Value = smoothed;
                return;
            }
#endif
            // Fallback
            if (_fallbackParams.TryGetValue(paramId, out var data))
            {
                float target = Mathf.Clamp(value, data.min, data.max);
                float velocity = _velocityRefs[paramId];
                float smoothed = Mathf.SmoothDamp(_currentValues[paramId], target, ref velocity, _smoothTime);
                _velocityRefs[paramId] = velocity;
                _currentValues[paramId] = smoothed;
            }
        }

        public void SetParameterImmediate(string paramId, float value)
        {
            if (!_isReady) return;

#if CUBISM_SDK_PRESENT
            if (_usingCubism && _paramLookup.TryGetValue(paramId, out var cubismParam))
            {
                float clamped = Mathf.Clamp(value, cubismParam.MinimumValue, cubismParam.MaximumValue);
                _currentValues[paramId] = clamped;
                _velocityRefs[paramId] = 0f;
                cubismParam.Value = clamped;
                return;
            }
#endif
            if (_fallbackParams.TryGetValue(paramId, out var data))
            {
                float clamped = Mathf.Clamp(value, data.min, data.max);
                _currentValues[paramId] = clamped;
                _velocityRefs[paramId] = 0f;
            }
        }

        public float GetParameter(string paramId)
        {
            if (_currentValues.TryGetValue(paramId, out float val))
                return val;
            return 0f;
        }

        public bool HasParameter(string paramId)
        {
#if CUBISM_SDK_PRESENT
            if (_usingCubism) return _paramLookup.ContainsKey(paramId);
#endif
            return _fallbackParams.ContainsKey(paramId);
        }

        public float GetParameterMin(string paramId)
        {
#if CUBISM_SDK_PRESENT
            if (_usingCubism && _paramLookup.TryGetValue(paramId, out var p))
                return p.MinimumValue;
#endif
            if (_fallbackParams.TryGetValue(paramId, out var d))
                return d.min;
            return 0f;
        }

        public float GetParameterMax(string paramId)
        {
#if CUBISM_SDK_PRESENT
            if (_usingCubism && _paramLookup.TryGetValue(paramId, out var p))
                return p.MaximumValue;
#endif
            if (_fallbackParams.TryGetValue(paramId, out var d))
                return d.max;
            return 1f;
        }

        public float GetParameterDefault(string paramId)
        {
#if CUBISM_SDK_PRESENT
            if (_usingCubism && _paramLookup.TryGetValue(paramId, out var p))
                return p.DefaultValue;
#endif
            if (_fallbackParams.TryGetValue(paramId, out var d))
                return d.defaultValue;
            return 0f;
        }

        #endregion

        #region Types

        private struct ParameterData
        {
            public float min;
            public float max;
            public float defaultValue;
        }

        #endregion
    }
}
