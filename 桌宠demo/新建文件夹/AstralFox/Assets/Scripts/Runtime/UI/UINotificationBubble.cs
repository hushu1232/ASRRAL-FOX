using UnityEngine;
using UnityEngine.UI;

namespace AstralFox.UI
{
    /// <summary>
    /// Simple notification bubble that subscribes to VoiceManager.OnUserNotification
    /// and displays status messages to the user. Messages auto-fade after a configurable duration.
    ///
    /// Attach to a Canvas child with a Text or TMPro component.
    /// </summary>
    public sealed class UINotificationBubble : MonoBehaviour
    {
        [Header("Display")]
        [SerializeField, Range(1f, 10f)]
        private float _displayDuration = 4f;

        [SerializeField, Range(0.5f, 3f)]
        private float _fadeDuration = 1f;

        [Header("References")]
        [SerializeField]
        private Voice.VoiceManager _voiceManager;

        [SerializeField]
        private GameObject _bubbleRoot;

        [SerializeField]
        private UnityEngine.UI.Text _text;

        private float _showTimer;
        private float _fadeTimer;
        private bool _isShowing;

        private void Awake()
        {
            if (_voiceManager == null)
                _voiceManager = FindObjectOfType<Voice.VoiceManager>();
            if (_bubbleRoot == null)
                _bubbleRoot = transform.Find("BubbleRoot")?.gameObject;
            if (_text == null && _bubbleRoot != null)
                _text = _bubbleRoot.GetComponentInChildren<UnityEngine.UI.Text>();

            if (_bubbleRoot != null)
                _bubbleRoot.SetActive(false);
        }

        private void Start()
        {
            if (_voiceManager != null)
                _voiceManager.OnUserNotification += ShowMessage;

            // Also listen to DiagnosticBus for system-level errors
            Diagnostics.DiagnosticBus.Instance.OnDiagnostic += OnSystemDiagnostic;
        }

        private void Update()
        {
            if (!_isShowing) return;

            _showTimer += Time.deltaTime;
            float totalFadeStart = _displayDuration - _fadeDuration;

            if (_showTimer >= totalFadeStart)
            {
                _fadeTimer += Time.deltaTime;
                float alpha = Mathf.Clamp01(1f - (_fadeTimer / _fadeDuration));
                SetAlpha(alpha);

                if (_fadeTimer >= _fadeDuration)
                {
                    Hide();
                }
            }
        }

        private void OnSystemDiagnostic(Diagnostics.DiagnosticBus.Severity severity, string source, string message)
        {
            // Only show errors and warnings to the user
            if (severity == Diagnostics.DiagnosticBus.Severity.Error ||
                severity == Diagnostics.DiagnosticBus.Severity.Fatal)
            {
                ShowMessage($"{message}");
            }
        }

        private void OnDestroy()
        {
            if (_voiceManager != null)
                _voiceManager.OnUserNotification -= ShowMessage;
            Diagnostics.DiagnosticBus.Instance.OnDiagnostic -= OnSystemDiagnostic;
        }

        public void ShowMessage(string message)
        {
            if (string.IsNullOrEmpty(message)) return;
            if (_text != null)
                _text.text = message;
            if (_bubbleRoot != null)
                _bubbleRoot.SetActive(true);

            _showTimer = 0f;
            _fadeTimer = 0f;
            _isShowing = true;
            SetAlpha(1f);
        }

        private void Hide()
        {
            _isShowing = false;
            if (_bubbleRoot != null)
                _bubbleRoot.SetActive(false);
        }

        private void SetAlpha(float alpha)
        {
            if (_text != null)
            {
                var color = _text.color;
                color.a = alpha;
                _text.color = color;
            }
        }
    }
}
