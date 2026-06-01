using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Handles mouse-based interaction with the fox:
    /// - Drag to move the window
    /// - Click-through when mouse is not over the fox
    /// Uses Win32 GetCursorPos for polling so click-through detection
    /// works even when WS_EX_TRANSPARENT is set.
    /// </summary>
    [RequireComponent(typeof(TransparentWindow))]
    // Collider2D lives on FoxPlaceholder child, not on root
    public sealed class FoxInteraction : MonoBehaviour
    {
        #region Inspector

        [Header("Drag Settings")]
        [SerializeField]
        private MouseButton _dragButton = MouseButton.Left;

        [SerializeField, Range(0f, 50f)]
        private float _dragDeadzone = 3f;

        [Header("Drag Physics")]
        [SerializeField, Range(0.5f, 20f)]
        private float _springStiffness = 8f;      // How tightly the pet follows cursor

        [SerializeField, Range(0.05f, 0.5f)]
        private float _springDamping = 0.15f;     // Smoothness of follow

        [SerializeField, Range(0.5f, 3f)]
        private float _throwMultiplier = 1.5f;    // Momentum on release

        [SerializeField, Range(0.01f, 1f)]
        private float _squashAmount = 0.15f;      // Deformation during drag

        [Header("Gravity & Bounce")]
        [SerializeField, Range(50f, 500f)]
        private float _gravity = 200f;            // Pixels/sec² downward pull

        [SerializeField, Range(0.1f, 0.9f)]
        private float _bounceDamping = 0.5f;      // Energy loss on bounce

        [SerializeField]
        private bool _enableGravity = true;       // Fall to bottom on release

        [Header("Click-Through")]
        [SerializeField]
        private bool _enableClickThrough = true;

        [SerializeField, Range(0.01f, 0.2f)]
        private float _pollInterval = 0.05f;

        public enum MouseButton { Left = 0, Right = 1, Middle = 2 }

        #endregion

        #region Private Fields

        private TransparentWindow _tw;
        private Camera _mainCamera;
        private Collider2D[] _foxColliders;
        private Animation.PADEmotionEngine _padEngine;
        private Audio.SoundEffectManager _sfx;

        private bool _isDragging;
        private bool _isHovering;
        private bool _mouseDown;
        private bool _dragStarted;
        private bool _isThrowing;            // In free-fall after release

        private Vector2Int _mouseDownScreenPos;
        private Vector2Int _dragStartMouseScreen;
        private Vector2Int _dragStartWindowPos;

        // Physics state
        private Vector2 _velocity;           // Current throw velocity (pixels/sec)
        private Vector2 _offsetFromCenter;   // Spring offset during drag
        private Vector2 _throwStartPos;      // Position where throw started
        private float _squashScale = 1f;     // Current squash/stretch factor
        private float _squashVelocity;       // For smooth squash recovery
        private Vector2Int _prevMousePos;    // For velocity calculation

        private float _pollTimer;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _tw = GetComponent<TransparentWindow>();
            _foxColliders = GetComponentsInChildren<Collider2D>();
            _padEngine = GetComponent<Animation.PADEmotionEngine>();
            _sfx = GetComponent<Audio.SoundEffectManager>();
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            if (_mainCamera == null)
            {
                Debug.LogError("[FoxInteraction] No Camera tagged 'MainCamera' found.");
                enabled = false;
                return;
            }

            // Start transparent (click-through enabled when mouse is away)
            if (_enableClickThrough)
                _tw.EnableClickThrough();
        }

        private void Update()
        {
            if (_mainCamera == null) return;

            HandleMousePolling();
            HandleInput();
            HandleDrag();
            HandleHotkeys();
        }

        #endregion

        #region Mouse Polling

        private void HandleMousePolling()
        {
            if (!_enableClickThrough) return;

            _pollTimer += Time.deltaTime;
            if (_pollTimer < _pollInterval) return;
            _pollTimer = 0f;

            bool overFox = IsMouseOverFox();

            if (overFox != _isHovering)
            {
                _isHovering = overFox;

                if (_isDragging)
                {
                    // Lock out click-through during drag
                    _tw.DisableClickThrough();
                }
                else if (overFox)
                {
                    _tw.DisableClickThrough();
                }
                else
                {
                    _tw.EnableClickThrough();
                }
            }
        }

        /// <summary>
        /// Convert screen pixel coordinates to Unity world position via the main camera.
        /// Screen coords: (Left, Top) origin. Unity coords: (0,0) = bottom-left of window.
        /// </summary>
        private bool IsMouseOverFox()
        {
            Vector2Int screenPos = _tw.GetMouseScreenPosition();
            var screenRect = _tw.GetWindowScreenRect();

            // Convert from screen coords (Y-down) to Unity client coords (Y-up)
            float unityX = screenPos.x - screenRect.left;
            float unityY = screenRect.bottom - screenPos.y;

            // Convert to world position using camera
            Vector3 worldPos = _mainCamera.ScreenToWorldPoint(
                new Vector3(unityX, unityY, 0f));

            foreach (var col in _foxColliders)
            {
                if (col != null && col.OverlapPoint(worldPos))
                    return true;
            }

            return false;
        }

        #endregion

        #region Input Handling

        private void HandleInput()
        {
            int btn = (int)_dragButton;

            if (Input.GetMouseButtonDown(btn))
                OnMouseDown();
            else if (Input.GetMouseButtonUp(btn))
                OnMouseUp();
        }

        private void OnMouseDown()
        {
            if (!_isHovering) return;

            _mouseDownScreenPos = _tw.GetMouseScreenPosition();
            _dragStartMouseScreen = _mouseDownScreenPos;
            _dragStartWindowPos = _tw.GetWindowScreenPosition();

            _mouseDown = true;
            _dragStarted = false;
            _isDragging = false;

            _tw.DisableClickThrough();
        }

        private void OnMouseUp()
        {
            _mouseDown = false;

            if (_isDragging)
            {
                _isDragging = false;

                // Throw physics: apply stored velocity as momentum
                if (_velocity.magnitude > 100f)
                {
                    _isThrowing = true;
                    _velocity *= _throwMultiplier;
                    _throwStartPos = new Vector2(
                        _tw.GetWindowScreenPosition().x,
                        _tw.GetWindowScreenPosition().y);
                    Debug.Log($"[FoxInteraction] Throw! velocity={_velocity.magnitude:F0} px/s");
                }
                else
                {
                    Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnDragEnd();
                }
            }
            else if (!_dragStarted)
            {
                OnFoxClicked();
            }

            if (_enableClickThrough && !_isHovering)
            {
                _tw.EnableClickThrough();
            }
        }

        #endregion

        #region Drag

        private void HandleDrag()
        {
            // ── Free-fall / Gravity after throw ──────────────
            if (_isThrowing && _enableGravity)
            {
                _velocity.y -= _gravity * Time.deltaTime;

                Vector2 pos = new Vector2(_tw.GetWindowScreenPosition().x, _tw.GetWindowScreenPosition().y);
                pos += _velocity * Time.deltaTime;

                // Bounce off bottom of screen
                int screenH = Screen.mainWindowDisplayInfo.height;
                var rect = _tw.GetWindowScreenRect();
                int windowH = rect.bottom - rect.top;
                float floor = screenH - windowH + 20;

                if (pos.y >= floor)
                {
                    pos.y = floor;
                    _velocity.y *= -_bounceDamping;

                    if (Mathf.Abs(_velocity.y) < 30f)
                    {
                        _velocity.y = 0f;
                        _isThrowing = false;
                        Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnDragEnd();
                    }
                }

                _tw.MoveWindow((int)pos.x, (int)pos.y);
                return;
            }

            if (!_mouseDown) return;

            Vector2Int currentMouse = _tw.GetMouseScreenPosition();
            float dist = Vector2Int.Distance(currentMouse, _mouseDownScreenPos);

            if (!_dragStarted && dist >= _dragDeadzone)
            {
                _dragStarted = true;
                _isDragging = true;
                _isThrowing = false;
                _dragStartMouseScreen = currentMouse;
                _dragStartWindowPos = _tw.GetWindowScreenPosition();
                _prevMousePos = currentMouse;
                _velocity = Vector2.zero;
                Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnDragStart();
            }

            if (_isDragging)
            {
                // Calculate velocity for throw on release
                Vector2 mouseDelta = new Vector2(
                    currentMouse.x - _prevMousePos.x,
                    currentMouse.y - _prevMousePos.y);
                _velocity = Vector2.Lerp(_velocity, mouseDelta / Time.deltaTime, 0.3f);

                // Spring physics: pet follows cursor with elastic delay
                Vector2 targetOffset = new Vector2(
                    currentMouse.x - _dragStartMouseScreen.x,
                    currentMouse.y - _dragStartMouseScreen.y);

                _offsetFromCenter = Vector2.Lerp(_offsetFromCenter, targetOffset,
                    1f - Mathf.Exp(-_springStiffness * Time.deltaTime));

                int newX = _dragStartWindowPos.x + (int)_offsetFromCenter.x;
                int newY = _dragStartWindowPos.y + (int)_offsetFromCenter.y;

                _tw.MoveWindow(newX, newY);

                // Squash & stretch deformation
                float speed = _velocity.magnitude;
                float targetSquash = 1f - Mathf.Clamp01(speed / 500f) * _squashAmount;
                _squashScale = Mathf.SmoothDamp(_squashScale, targetSquash, ref _squashVelocity, 0.1f);

                _prevMousePos = currentMouse;
            }
        }

        #endregion

        #region Public API

        /// <summary>Current squash/stretch scale (1 = normal, <1 = squashed, >1 = stretched).</summary>
        public float SquashScale => _squashScale;

        /// <summary>Whether the pet is currently being dragged.</summary>
        public bool IsDragging => _isDragging;

        /// <summary>Whether the pet is in free-fall after being thrown.</summary>
        public bool IsThrowing => _isThrowing;

        #endregion

        #region Click

        private void OnFoxClicked()
        {
            // Trigger PAD emotion: petted
            _padEngine?.ApplyEventType(Animation.PADEmotionEngine.EmotionEventType.Petted);
            Data.DataStore.Instance.UpdateAffection(0.5f); // small affection gain
            _sfx?.Play(Audio.SoundEffectManager.SoundEvent.PatHead);
            Debug.Log("[FoxInteraction] Fox clicked (pat pat)!");
        }

        private void HandleHotkeys()
        {
            // F2: open web settings
            if (Input.GetKeyDown(KeyCode.F2))
            {
                var appLifecycle = FindObjectOfType<AppLifecycle>();
                if (appLifecycle != null)
                    appLifecycle.OpenSettingsPanel();
                else
                    Debug.LogWarning("[FoxInteraction] No AppLifecycle found.");
            }
        }

        #endregion
    }
}
