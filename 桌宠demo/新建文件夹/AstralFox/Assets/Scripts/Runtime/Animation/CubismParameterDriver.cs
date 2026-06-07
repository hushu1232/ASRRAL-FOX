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
    /// Uses <see cref="FoxParam"/> enum-indexed arrays for zero-allocation
    /// per-frame parameter access.
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
        [SerializeField, Tooltip("Used when Cubism SDK is not present. Parameters stored in arrays.")]
        private bool _useFallbackOnMissingSDK = true;

        #endregion

        #region Private Fields

        private static readonly int FoxParamCount = (int)FoxParam.COUNT;

#if CUBISM_SDK_PRESENT
        private CubismModel _model;
        private CubismParameterStore _paramStore;
        /// <summary>CubismParameter references indexed by FoxParam enum.</summary>
        private CubismParameter[] _cubismParams;
#endif

        // Fallback metadata (no SDK)
        private ParameterData[] _fallbackData;

        // Per-frame state — zero-allocation array access indexed by FoxParam
        private float[] _currentValues;
        private float[] _velocityRefs;

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
                return _fallbackData?.Length ?? 0;
            }
        }

        public bool IsReady => _isReady;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _currentValues = new float[FoxParamCount];
            _velocityRefs = new float[FoxParamCount];
#if CUBISM_SDK_PRESENT
            _cubismParams = new CubismParameter[FoxParamCount];
#endif
            _fallbackData = new ParameterData[FoxParamCount];

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

            foreach (var param in _model.Parameters)
            {
                if (FoxParamId.StringToEnum.TryGetValue(param.Id, out var foxParam))
                {
                    int idx = (int)foxParam;
                    _cubismParams[idx] = param;
                    _currentValues[idx] = param.DefaultValue;
                    _velocityRefs[idx] = 0f;
                }
            }

            _usingCubism = true;
            _isReady = true;
            Debug.Log($"[CubismParameterDriver] Initialized with {_model.Parameters.Length} Cubism parameters.");
        }
#endif

        private void InitializeFallback()
        {
            // Define basic parameters for testing without a Live2D model
            RegisterFallbackParam(FoxParam.ParamAngleX,       -30f, 30f, 0f);
            RegisterFallbackParam(FoxParam.ParamAngleY,       -30f, 30f, 0f);
            RegisterFallbackParam(FoxParam.ParamAngleZ,       -30f, 30f, 0f);
            RegisterFallbackParam(FoxParam.ParamBodyAngleX,   -20f, 20f, 0f);
            RegisterFallbackParam(FoxParam.ParamBodyAngleY,   -20f, 20f, 0f);
            RegisterFallbackParam(FoxParam.ParamBodyAngleZ,   -20f, 20f, 0f);
            RegisterFallbackParam(FoxParam.ParamEyeLOpen,      0f,  1f, 1f);
            RegisterFallbackParam(FoxParam.ParamEyeROpen,      0f,  1f, 1f);
            RegisterFallbackParam(FoxParam.ParamEyeBallX,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamEyeBallY,     -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamBrowLY,       -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamBrowRY,       -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamBrowLAngle,   -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamBrowRAngle,   -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamMouthOpenY,    0f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamMouthForm,    -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamEarL,         -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamEarR,         -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamTail,         -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamBreath,        0f,  1f, 0f);
            // Emotion params — reuse existing parameter slots with dedicated indices
            // (Emotion values are driven through the same brow/tail params)
            RegisterFallbackParam(FoxParam.ParamHairFront,    -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamHairSideL,    -1f,  1f, 0f);
            RegisterFallbackParam(FoxParam.ParamHairSideR,    -1f,  1f, 0f);

            _usingCubism = false;
            _isReady = true;
            Debug.Log($"[CubismParameterDriver] Fallback mode: {FoxParamCount} parameter slots.");
        }

        private void RegisterFallbackParam(FoxParam param, float min, float max, float def)
        {
            int idx = (int)param;
            _fallbackData[idx] = new ParameterData { min = min, max = max, defaultValue = def };
            _currentValues[idx] = def;
            _velocityRefs[idx] = 0f;
        }

        #endregion

        #region IFoxParameterDriver — Fast Path (FoxParam enum)

        /// <summary>
        /// Sets a parameter value (smoothed). ZERO allocation — use for per-frame calls.
        /// </summary>
        public void SetParameter(FoxParam param, float value)
        {
            if (!_isReady) return;
            int idx = (int)param;

#if CUBISM_SDK_PRESENT
            if (_usingCubism)
            {
                var cubismParam = _cubismParams[idx];
                if (cubismParam == null) return;
                float target = Mathf.Clamp(value, cubismParam.MinimumValue, cubismParam.MaximumValue);
                float velocity = _velocityRefs[idx];
                float smoothed = Mathf.SmoothDamp(_currentValues[idx], target, ref velocity, _smoothTime);
                _velocityRefs[idx] = velocity;
                _currentValues[idx] = smoothed;
                cubismParam.Value = smoothed;
                return;
            }
#endif
            // Fallback: direct array access
            {
                var data = _fallbackData[idx];
                if (Mathf.Approximately(data.max, 0f) && Mathf.Approximately(data.min, 0f)) return; // unregistered
                float target = Mathf.Clamp(value, data.min, data.max);
                float velocity = _velocityRefs[idx];
                float smoothed = Mathf.SmoothDamp(_currentValues[idx], target, ref velocity, _smoothTime);
                _velocityRefs[idx] = velocity;
                _currentValues[idx] = smoothed;
            }
        }

        /// <summary>
        /// Sets a parameter immediately (no smoothing). ZERO allocation.
        /// </summary>
        public void SetParameterImmediate(FoxParam param, float value)
        {
            if (!_isReady) return;
            int idx = (int)param;

#if CUBISM_SDK_PRESENT
            if (_usingCubism)
            {
                var cubismParam = _cubismParams[idx];
                if (cubismParam == null) return;
                float clamped = Mathf.Clamp(value, cubismParam.MinimumValue, cubismParam.MaximumValue);
                _currentValues[idx] = clamped;
                _velocityRefs[idx] = 0f;
                cubismParam.Value = clamped;
                return;
            }
#endif
            {
                var data = _fallbackData[idx];
                if (Mathf.Approximately(data.max, 0f) && Mathf.Approximately(data.min, 0f)) return;
                float clamped = Mathf.Clamp(value, data.min, data.max);
                _currentValues[idx] = clamped;
                _velocityRefs[idx] = 0f;
            }
        }

        /// <summary>
        /// Gets a parameter value. ZERO allocation.
        /// </summary>
        public float GetParameter(FoxParam param)
        {
            return _currentValues[(int)param];
        }

        /// <summary>
        /// Checks if a parameter is registered.
        /// </summary>
        public bool HasParameter(FoxParam param)
        {
            int idx = (int)param;
#if CUBISM_SDK_PRESENT
            if (_usingCubism) return _cubismParams[idx] != null;
#endif
            var data = _fallbackData[idx];
            return !(Mathf.Approximately(data.max, 0f) && Mathf.Approximately(data.min, 0f));
        }

        #endregion

        #region IFoxParameterDriver — String Compatibility (bridges to enum fast path)

        public void SetParameter(string paramId, float value)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
                SetParameter(p, value);
        }

        public void SetParameterImmediate(string paramId, float value)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
                SetParameterImmediate(p, value);
        }

        public float GetParameter(string paramId)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
                return GetParameter(p);
            return 0f;
        }

        public bool HasParameter(string paramId)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
                return HasParameter(p);
            return false;
        }

        public float GetParameterMin(string paramId)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
            {
                int idx = (int)p;
#if CUBISM_SDK_PRESENT
                if (_usingCubism && _cubismParams[idx] != null)
                    return _cubismParams[idx].MinimumValue;
#endif
                return _fallbackData[idx].min;
            }
            return 0f;
        }

        public float GetParameterMax(string paramId)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
            {
                int idx = (int)p;
#if CUBISM_SDK_PRESENT
                if (_usingCubism && _cubismParams[idx] != null)
                    return _cubismParams[idx].MaximumValue;
#endif
                return _fallbackData[idx].max;
            }
            return 1f;
        }

        public float GetParameterDefault(string paramId)
        {
            if (FoxParamId.StringToEnum.TryGetValue(paramId, out var p))
            {
                int idx = (int)p;
#if CUBISM_SDK_PRESENT
                if (_usingCubism && _cubismParams[idx] != null)
                    return _cubismParams[idx].DefaultValue;
#endif
                return _fallbackData[idx].defaultValue;
            }
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
