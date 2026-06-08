using UnityEngine;

namespace AstralFox.Animation
{
    /// <summary>
    /// Makes the pet's eyes follow the mouse cursor for lifelike gaze behavior.
    /// Drives EyeBallX/EyeBallY Live2D parameters based on screen-space cursor position
    /// relative to the pet's on-screen position.
    /// </summary>
    public sealed class GazeTracker : MonoBehaviour
    {
        [Header("Gaze Settings")]
        [SerializeField, Range(0f, 1f)]
        private float _gazeStrength = 0.6f;

        [SerializeField, Range(0.2f, 10f)]
        private float _smoothSpeed = 1.5f; // lower = smoother, more natural delay

        [SerializeField, Range(0.1f, 1f)]
        private float _maxOffset = 0.5f;

        [Header("Saccade (Micro-movements)")]
        [SerializeField]
        private bool _enableSaccade = true;

        [SerializeField, Range(0.5f, 5f)]
        private float _saccadeInterval = 2f;

        [SerializeField, Range(0.01f, 0.15f)]
        private float _saccadeAmplitude = 0.06f;

        [Header("Blink on Gaze Shift")]
        [SerializeField]
        private bool _blinkOnShift = true;

        [SerializeField, Range(0.1f, 0.5f)]
        private float _blinkDuration = 0.15f;

        private IFoxParameterDriver _driver;
        private Camera _cachedCamera;
        private float _targetX, _targetY;
        private float _currentX, _currentY;
        private float _velocityX, _velocityY;
        private float _saccadeTimer;
        private float _saccadeX, _saccadeY;
        private float _blinkTimer;
        private bool _isBlinking;

        private void Awake()
        {
            _driver = GetComponent<IFoxParameterDriver>();
            if (_driver == null)
                _driver = GetComponentInChildren<IFoxParameterDriver>();

            _cachedCamera = Camera.main;

            _saccadeTimer = Random.Range(0f, _saccadeInterval);
        }

        private void Update()
        {
            if (_driver == null || !_driver.IsReady) return;

            UpdateGazeTarget();
            UpdateSaccade();
            ApplyGaze();
        }

        private void UpdateGazeTarget()
        {
            // Convert cursor position to normalized screen coordinates relative to pet position
            Vector3 petScreenPos = _cachedCamera != null
                ? _cachedCamera.WorldToScreenPoint(transform.position)
                : Vector3.zero;

            Vector2 cursorPos = Input.mousePosition;
            Vector2 delta = (cursorPos - (Vector2)petScreenPos) / new Vector2(Screen.width, Screen.height);

            // Map to eye parameter range (-1 to 1 for EyeBallX, 0 to 1 for EyeBallY)
            _targetX = Mathf.Clamp(delta.x * _gazeStrength / _maxOffset, -1f, 1f);
            _targetY = Mathf.Clamp(-delta.y * _gazeStrength / _maxOffset, -1f, 1f);

            // Add quick blink when gaze shifts significantly
            float shift = Mathf.Abs(_targetX - _currentX) + Mathf.Abs(_targetY - _currentY);
            if (shift > 0.3f && !_isBlinking && _blinkOnShift)
            {
                TriggerBlink();
            }
        }

        private void UpdateSaccade()
        {
            if (!_enableSaccade) return;

            _saccadeTimer -= Time.deltaTime;
            if (_saccadeTimer <= 0f)
            {
                _saccadeTimer = Random.Range(_saccadeInterval * 0.5f, _saccadeInterval * 1.5f);
                _saccadeX = Random.Range(-_saccadeAmplitude, _saccadeAmplitude);
                _saccadeY = Random.Range(-_saccadeAmplitude * 0.5f, _saccadeAmplitude * 0.5f);
            }
            else
            {
                // Smoothly return saccade to zero
                _saccadeX = Mathf.Lerp(_saccadeX, 0f, Time.deltaTime * 4f);
                _saccadeY = Mathf.Lerp(_saccadeY, 0f, Time.deltaTime * 4f);
            }
        }

        private void ApplyGaze()
        {
            // Smooth damp to target — use maxDelta for frame-rate-independent feel
            float smoothTime = 1f / _smoothSpeed;
            float maxSpeed = 3f; // max parameter units per second
            _currentX = Mathf.SmoothDamp(_currentX, _targetX + _saccadeX, ref _velocityX, smoothTime, maxSpeed, Time.deltaTime);
            _currentY = Mathf.SmoothDamp(_currentY, _targetY + _saccadeY, ref _velocityY, smoothTime, maxSpeed, Time.deltaTime);

            // Handle blink
            if (_isBlinking)
            {
                _blinkTimer -= Time.deltaTime;
                if (_blinkTimer <= 0f) _isBlinking = false;
            }

            float blinkScale = _isBlinking ? 0.2f : 1f;

            _driver.SetParameter(FoxParam.ParamEyeBallX, _currentX * blinkScale);
            _driver.SetParameter(FoxParam.ParamEyeBallY, _currentY * blinkScale);
        }

        private void TriggerBlink()
        {
            _isBlinking = true;
            _blinkTimer = _blinkDuration;
        }

#if UNITY_EDITOR
        private void OnDrawGizmosSelected()
        {
            if (!Application.isPlaying) return;
            Vector3 pos = transform.position + Vector3.up * 0.5f;
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(pos, 0.05f);
            Gizmos.DrawLine(pos, pos + new Vector3(_currentX, _currentY, 0) * 0.1f);
        }
#endif
    }
}
