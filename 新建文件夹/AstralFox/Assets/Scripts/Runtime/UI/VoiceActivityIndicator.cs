using UnityEngine;
using UnityEngine.UI;

namespace AstralFox.UI
{
    /// <summary>
    /// Visual feedback overlay for voice activity state.
    /// Listens to AIManager pipeline stages and displays appropriate UI.
    ///
    /// States (mapped from AIManager.PipelineStage):
    ///   Idle          → hidden
    ///   Transcribing  → "listening" animation + waveform
    ///   Thinking      → "thinking" spinner
    ///   Speaking      → "speaking" audio visualization
    ///
    /// Usage:
    ///   Attach to a Canvas GameObject. Drag AIManager reference in Inspector.
    ///   The indicator automatically shows/hides based on pipeline state.
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class VoiceActivityIndicator : MonoBehaviour
    {
        #region Inspector

        [Header("Targets")]
        [SerializeField, Tooltip("Reference to the AIManager that drives pipeline state changes.")]
        private Voice.AIManager _aiManager;

        [SerializeField, Tooltip("CanvasGroup used for smooth fade in/out.")]
        private CanvasGroup _canvasGroup;

        [Header("State Icons")]
        [SerializeField, Tooltip("Icon shown during Transcribing (listening).")]
        private GameObject _listeningIcon;

        [SerializeField, Tooltip("Icon shown during Thinking (AI processing).")]
        private GameObject _thinkingIcon;

        [SerializeField, Tooltip("Icon shown during Speaking (TTS playback).")]
        private GameObject _speakingIcon;

        [Header("Status Text")]
        [SerializeField, Tooltip("Text element for status message.")]
        private Text _statusMessage;

        [Header("Progress Bar")]
        [SerializeField, Tooltip("Optional progress bar (0-1) showing pipeline progress.")]
        private Slider _progressBar;

        [Header("Animation")]
        [SerializeField, Tooltip("Fade in/out speed.")]
        private float _fadeSpeed = 4f;

        [SerializeField, Tooltip("Auto-hide delay after pipeline returns to idle (seconds).")]
        private float _autoHideDelay = 0.5f;

        #endregion

        #region Localized Messages

        private static readonly string[] _transcribingMessages = {
            "正在倾听...", "Listening...",
            "听到了～", "I'm listening～"
        };
        private static readonly string[] _thinkingMessages = {
            "星尘思考中...", "Thinking...",
            "让我想想～", "Let me think～"
        };
        private static readonly string[] _speakingMessages = {
            "正在说...", "Speaking...",
            ""  // empty = show nothing, just audio visualization
        };

        #endregion

        #region State

        private float _targetAlpha;
        private float _hideTimer;
        private Voice.AIManager.PipelineStage _currentStage;
        private bool _subscribed;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_canvasGroup == null)
                _canvasGroup = GetComponent<CanvasGroup>();
        }

        private void Start()
        {
            if (_aiManager == null)
            {
                _aiManager = FindObjectOfType<Voice.AIManager>();
                if (_aiManager == null)
                {
                    Debug.LogWarning("[VoiceActivityIndicator] No AIManager found in scene. Indicator disabled.");
                    enabled = false;
                    return;
                }
            }

            Subscribe();
            HideAll();
        }

        private void Update()
        {
            // Smooth fade
            float current = _canvasGroup.alpha;
            float target = _targetAlpha;
            _canvasGroup.alpha = Mathf.Lerp(current, target, Time.unscaledDeltaTime * _fadeSpeed);

            // Auto-hide timer
            if (_currentStage == Voice.AIManager.PipelineStage.Idle && target == 0f)
            {
                _hideTimer += Time.unscaledDeltaTime;
                if (_hideTimer >= _autoHideDelay && _canvasGroup.alpha < 0.01f)
                {
                    gameObject.SetActive(false);
                }
            }
        }

        private void OnDestroy()
        {
            Unsubscribe();
        }

        #endregion

        #region Event Handling

        private void Subscribe()
        {
            if (_aiManager == null) return;
            _aiManager.OnPipelineStageChanged += OnStageChanged;
            _aiManager.OnProgress += OnProgress;
            _subscribed = true;
        }

        private void Unsubscribe()
        {
            if (!_subscribed || _aiManager == null) return;
            _aiManager.OnPipelineStageChanged -= OnStageChanged;
            _aiManager.OnProgress -= OnProgress;
            _subscribed = false;
        }

        private void OnStageChanged(Voice.AIManager.PipelineStage stage)
        {
            _currentStage = stage;
            HideAll();

            switch (stage)
            {
                case Voice.AIManager.PipelineStage.Transcribing:
                    ShowIcon(_listeningIcon);
                    SetMessage(_transcribingMessages);
                    Show(1f);
                    break;

                case Voice.AIManager.PipelineStage.Thinking:
                    ShowIcon(_thinkingIcon);
                    SetMessage(_thinkingMessages);
                    Show(1f);
                    break;

                case Voice.AIManager.PipelineStage.Speaking:
                    ShowIcon(_speakingIcon);
                    SetMessage(_speakingMessages);
                    Show(1f);
                    break;

                case Voice.AIManager.PipelineStage.Idle:
                default:
                    Hide();
                    break;
            }
        }

        private void OnProgress(string message, float percent)
        {
            if (!string.IsNullOrEmpty(message) && _statusMessage != null)
                _statusMessage.text = message;

            if (_progressBar != null)
                _progressBar.value = percent;
        }

        #endregion

        #region Helpers

        private void Show(float alpha)
        {
            gameObject.SetActive(true);
            _targetAlpha = alpha;
            _hideTimer = 0f;
        }

        private void Hide()
        {
            _targetAlpha = 0f;
            _hideTimer = 0f;
        }

        private void HideAll()
        {
            if (_listeningIcon != null) _listeningIcon.SetActive(false);
            if (_thinkingIcon != null) _thinkingIcon.SetActive(false);
            if (_speakingIcon != null) _speakingIcon.SetActive(false);
        }

        private void ShowIcon(GameObject icon)
        {
            if (icon != null) icon.SetActive(true);
        }

        private void SetMessage(string[] candidates)
        {
            if (_statusMessage == null) return;
            // Pick a random message for variety
            if (candidates.Length > 0)
            {
                int idx = Random.Range(0, candidates.Length);
                string msg = candidates[idx];
                if (!string.IsNullOrEmpty(msg))
                    _statusMessage.text = msg;
            }
        }

        #endregion
    }
}
