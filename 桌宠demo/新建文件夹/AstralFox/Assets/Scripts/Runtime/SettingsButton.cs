using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Renders a small gear icon button next to the pet that opens the settings panel.
    /// Provides a visible, always-accessible settings entry point for end users.
    /// </summary>
    public sealed class SettingsButton : MonoBehaviour
    {
        [Header("Button Appearance")]
        [SerializeField, Range(20f, 80f)]
        private float _buttonSize = 36f;

        [SerializeField, Range(0.3f, 1f)]
        private float _normalAlpha = 0.6f;

        [SerializeField, Range(0.5f, 1f)]
        private float _hoverAlpha = 0.9f;

        [Header("Position")]
        [SerializeField]
        private ButtonPosition _position = ButtonPosition.TopRight;

        [SerializeField, Range(0f, 30f)]
        private float _offsetX = 8f;

        [SerializeField, Range(0f, 30f)]
        private float _offsetY = 8f;

        private enum ButtonPosition { TopRight, TopLeft, BottomRight, BottomLeft }

        private Texture2D _gearTexture;
        private Rect _buttonRect;
        private bool _isHovering;
        private float _currentAlpha;
        private float _alphaVelocity;

        private AppLifecycle _appLifecycle;
        private FoxInteraction _interaction;

        private void Awake()
        {
            _gearTexture = GenerateGearTexture();
            _appLifecycle = FindObjectOfType<AppLifecycle>();
            _interaction = GetComponent<FoxInteraction>();
        }

        private void OnGUI()
        {
            if (_gearTexture == null) return;

            UpdateButtonPosition();
            HandleInteraction();

            // Draw semi-transparent gear icon
            float targetAlpha = _isHovering ? _hoverAlpha : _normalAlpha;
            if (_interaction != null && _interaction.IsDragging)
                targetAlpha = 0.2f; // Fade during drag

            _currentAlpha = Mathf.SmoothDamp(_currentAlpha, targetAlpha, ref _alphaVelocity, 0.1f);

            Color prevColor = GUI.color;
            GUI.color = new Color(1f, 1f, 1f, _currentAlpha);
            GUI.DrawTexture(_buttonRect, _gearTexture, ScaleMode.ScaleToFit);
            GUI.color = prevColor;
        }

        private void UpdateButtonPosition()
        {
            float size = _buttonSize;
            float x = _position switch
            {
                ButtonPosition.TopRight or ButtonPosition.BottomRight => Screen.width - size - _offsetX,
                _ => _offsetX,
            };
            float y = _position switch
            {
                ButtonPosition.TopLeft or ButtonPosition.TopRight => _offsetY,
                _ => Screen.height - size - _offsetY,
            };
            _buttonRect = new Rect(x, y, size, size);
        }

        private void HandleInteraction()
        {
            Vector2 mousePos = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y);
            _isHovering = _buttonRect.Contains(mousePos);

            if (_isHovering && Input.GetMouseButtonDown(0))
            {
                OpenSettings();
            }
        }

        private void OpenSettings()
        {
            if (_appLifecycle != null)
            {
                _appLifecycle.OpenSettingsPanel();
                Debug.Log("[SettingsButton] Settings panel opened.");
            }
            else
            {
                // Fallback: open via command
                System.Diagnostics.Process.Start("http://localhost:18920");
                Debug.Log("[SettingsButton] Settings opened via browser fallback.");
            }
        }

        /// <summary>Generate a simple gear icon texture procedurally.</summary>
        private Texture2D GenerateGearTexture()
        {
            int size = 128;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color clear = Color.clear;
            Color gear = Color.white;

            // Fill transparent
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    tex.SetPixel(x, y, clear);

            // Draw gear shape (simplified — concentric circles + teeth)
            float cx = size / 2f, cy = size / 2f;
            float outerR = size * 0.42f;
            float innerR = size * 0.25f;
            float holeR = size * 0.12f;
            int teeth = 8;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - cx, dy = y - cy;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    float angle = Mathf.Atan2(dy, dx);

                    // Teeth
                    float toothAngle = (angle + Mathf.PI) / (Mathf.PI * 2f) * teeth;
                    float toothPhase = Mathf.Abs(toothAngle - Mathf.Round(toothAngle));
                    float effectiveOuter = Mathf.Lerp(outerR, outerR * 0.78f, Mathf.SmoothStep(0f, 0.25f, toothPhase));

                    if (dist <= effectiveOuter && dist >= holeR)
                    {
                        // Inner cutout for spokes
                        if (dist < innerR * 0.85f) continue;
                        // Spoke gaps
                        float spokeAngle = (toothAngle % 1f);
                        if (dist < innerR && spokeAngle > 0.3f && spokeAngle < 0.7f) continue;

                        tex.SetPixel(x, y, gear);
                    }
                }
            }

            tex.Apply();
            return tex;
        }
    }
}
