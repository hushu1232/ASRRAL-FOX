using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Visible microphone button that replaces F12 simulation for wake word triggering.
    /// Also displays backend connection status with a colored dot indicator.
    /// </summary>
    public sealed class VoiceButton : MonoBehaviour
    {
        [Header("Button Appearance")]
        [SerializeField, Range(30f, 80f)]
        private float _buttonSize = 44f;

        [SerializeField, Range(0.4f, 1f)]
        private float _idleAlpha = 0.5f;

        [SerializeField, Range(0.6f, 1f)]
        private float _activeAlpha = 0.9f;

        [Header("Connection Dot")]
        [SerializeField, Range(8f, 20f)]
        private float _dotSize = 10f;

        [Header("Position")]
        [SerializeField, Range(0f, 30f)]
        private float _marginX = 52f;

        [SerializeField, Range(0f, 30f)]
        private float _marginY = 8f;

        private Texture2D _micTexture;
        private Texture2D _dotTexture;
        private Rect _micRect;
        private Rect _dotRect;
        private bool _isHovering;
        private bool _isListening;
        private float _pulsePhase;

        private Voice.VoiceManager _voiceManager;
        private Voice.BackendClient _backendClient;
        private FoxInteraction _interaction;
        private float _currentAlpha;
        private float _alphaVelocity;

        private void Awake()
        {
            _micTexture = GenerateMicTexture();
            _voiceManager = FindObjectOfType<Voice.VoiceManager>();
            _backendClient = FindObjectOfType<Voice.BackendClient>();
            _interaction = GetComponent<FoxInteraction>();
        }

        private void Update()
        {
            _pulsePhase += Time.deltaTime * 3f;
        }

        private void OnGUI()
        {
            if (_micTexture == null) return;

            UpdatePositions();
            HandleInteraction();

            bool isDragging = _interaction != null && _interaction.IsDragging;
            float targetAlpha = isDragging ? 0.15f
                : (_isListening ? _activeAlpha : _idleAlpha);

            _currentAlpha = Mathf.SmoothDamp(_currentAlpha, targetAlpha, ref _alphaVelocity, 0.12f);

            Color prev = GUI.color;

            // Connection status dot
            bool connected = _backendClient != null && _backendClient.IsConnected;
            Color dotColor = connected ? new Color(0.2f, 0.9f, 0.3f)
                : new Color(0.9f, 0.3f, 0.3f);
            // Pulse when listening
            if (_isListening) dotColor = Color.Lerp(dotColor, Color.white, Mathf.Sin(_pulsePhase) * 0.5f + 0.5f);

            GUI.color = new Color(dotColor.r, dotColor.g, dotColor.b, _currentAlpha);
            GUI.DrawTexture(_dotRect, Texture2D.whiteTexture);

            // Mic button
            float pulseScale = _isListening ? 1f + Mathf.Sin(_pulsePhase) * 0.08f : 1f;
            GUI.color = new Color(1f, 1f, 1f, _currentAlpha);
            GUI.DrawTexture(_micRect, _micTexture, ScaleMode.ScaleToFit);

            GUI.color = prev;
        }

        private void UpdatePositions()
        {
            _dotRect = new Rect(_marginX, _marginY, _dotSize, _dotSize);
            _micRect = new Rect(_marginX + _dotSize + 8f, _marginY - 4f, _buttonSize, _buttonSize);
        }

        private void HandleInteraction()
        {
            Vector2 mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y);
            _isHovering = _micRect.Contains(mp);

            if (_isHovering && Input.GetMouseButtonDown(0))
            {
                TriggerVoice();
            }

            // Update listening state
            if (_voiceManager != null)
            {
                var vs = _voiceManager.CurrentState;
                _isListening = vs == Voice.VoiceManager.VoiceState.Listening
                    || vs == Voice.VoiceManager.VoiceState.Recording;
            }
        }

        private void TriggerVoice()
        {
            if (_voiceManager != null)
            {
                // Simulate wake word detection to start the voice pipeline
                var wakeDetector = FindObjectOfType<Voice.WakeWordDetector>();
                if (wakeDetector != null)
                {
                    wakeDetector.SimulateWakeWord();
                }
            }
        }

        /// <summary>Generate a simple microphone icon texture.</summary>
        private Texture2D GenerateMicTexture()
        {
            int s = 128;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            Color clear = Color.clear, white = Color.white;

            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                    tex.SetPixel(x, y, clear);

            float cx = s / 2f, cy = s * 0.35f;
            // Mic body (rounded rect)
            for (int y = (int)(cy - s * 0.25f); y < (int)(cy + s * 0.25f); y++)
                for (int x = (int)(cx - s * 0.15f); x < (int)(cx + s * 0.15f); x++)
                    if (Mathf.Abs(x - cx) < s * 0.12f || y > cy + s * 0.15f)
                        tex.SetPixel(x, y, white);

            // Mic arc
            float arcCy = cy + s * 0.28f;
            for (int y = (int)arcCy; y < (int)(arcCy + s * 0.15f); y++)
                for (int x = (int)(cx - s * 0.2f); x < (int)(cx + s * 0.2f); x++)
                {
                    float dx = (x - cx) / (s * 0.2f), dy = (y - arcCy) / (s * 0.15f);
                    if (dx * dx + dy * dy < 0.8f && y > arcCy)
                        tex.SetPixel(x, y, white);
                }

            // Base
            for (int y = (int)(arcCy + s * 0.12f); y < (int)(arcCy + s * 0.18f); y++)
                for (int x = (int)(cx - s * 0.22f); x < (int)(cx + s * 0.22f); x++)
                    tex.SetPixel(x, y, white);

            tex.Apply();
            return tex;
        }
    }
}
