using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace AstralFox.UI
{
    /// <summary>
    /// Character-by-character text reveal with punctuation-aware timing.
    /// Ported from Unity-AIChat's ChatSample.StartTypeWords and improved.
    ///
    /// Usage:
    ///   typewriter.Play("你好！我是星尘狐～");  // start typing
    ///   typewriter.Skip();                      // instantly show full text
    ///   typewriter.IsPlaying                    // check if typing is in progress
    ///
    /// Events:
    ///   OnCharacterTyped(char) — fired for each character
    ///   OnComplete — fired when typing finishes
    /// </summary>
    public class TypewriterEffect : MonoBehaviour
    {
        #region Inspector

        [Header("Speed")]
        [SerializeField, Tooltip("Seconds per character for normal text.")]
        private float _charDelay = 0.05f;

        [SerializeField, Tooltip("Seconds per punctuation character (，。！？,.!? etc).")]
        private float _punctuationDelay = 0.15f;

        [SerializeField, Tooltip("Extra delay after a comma (，,).")]
        private float _commaDelay = 0.2f;

        [SerializeField, Tooltip("Extra delay after a period (。.!！?？).")]
        private float _periodDelay = 0.35f;

        [Header("Rich Text")]
        [SerializeField, Tooltip("If true, process rich text tags (<color>, <b>, etc.) without delay.")]
        private bool _supportRichText = true;

        #endregion

        #region Properties

        public bool IsPlaying { get; private set; }
        public string FullText { get; private set; }
        public int VisibleCharCount { get; private set; }

        #endregion

        #region Events

        /// <summary>Fired for each visible character typed.</summary>
        public event System.Action<char> OnCharacterTyped;

        /// <summary>Fired when all text has been revealed.</summary>
        public event System.Action OnComplete;

        #endregion

        #region Private Fields

        private Text _textComponent;
        private Coroutine _currentCoroutine;
        private string _cachedRichText;
        private static readonly char[] _punctuationChars = { '，', '。', '！', '？', ',', '.', '!', '?', '；', ';', '：', ':' };
        private static readonly char[] _periodChars = { '。', '.', '！', '!', '？', '?' };
        private static readonly char[] _commaChars = { '，', ',', '；', ';', '：', ':' };

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _textComponent = GetComponent<Text>();
            if (_textComponent == null)
            {
                Debug.LogWarning("[TypewriterEffect] No Text component found on GameObject. Adding one.");
                _textComponent = gameObject.AddComponent<Text>();
            }
        }

        private void OnDisable()
        {
            Stop();
        }

        #endregion

        #region Public API

        /// <summary>Start typing the given text character by character.</summary>
        public void Play(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                SetText("");
                return;
            }

            Stop();
            FullText = text;
            VisibleCharCount = 0;
            _textComponent.text = "";
            IsPlaying = true;
            _currentCoroutine = StartCoroutine(TypeTextCoroutine(text));
        }

        /// <summary>Instantly reveal the full text and stop typing.</summary>
        public void Skip()
        {
            if (!IsPlaying) return;
            Stop();
            SetText(FullText);
            OnComplete?.Invoke();
        }

        /// <summary>Stop typing (keeps currently visible text).</summary>
        public void Stop()
        {
            if (_currentCoroutine != null)
            {
                StopCoroutine(_currentCoroutine);
                _currentCoroutine = null;
            }
            IsPlaying = false;
        }

        /// <summary>Clear the text component.</summary>
        public void Clear()
        {
            Stop();
            FullText = "";
            VisibleCharCount = 0;
            SetText("");
        }

        #endregion

        #region Implementation

        private IEnumerator TypeTextCoroutine(string text)
        {
            int plainIndex = 0; // tracks position in plain text (ignoring rich tags)

            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];

                // Handle rich text tags: skip entire tag without delay
                if (_supportRichText && c == '<')
                {
                    int endTag = text.IndexOf('>', i);
                    if (endTag > i)
                    {
                        // Append the entire tag at once
                        _textComponent.text = text.Substring(0, endTag + 1);
                        i = endTag;
                        continue;
                    }
                }

                // Append this character
                _textComponent.text = text.Substring(0, i + 1);
                VisibleCharCount = i + 1;
                plainIndex++;

                OnCharacterTyped?.Invoke(c);

                // Calculate delay based on character type
                float delay = _charDelay;
                if (System.Array.IndexOf(_periodChars, c) >= 0)
                    delay = _periodDelay;
                else if (System.Array.IndexOf(_commaChars, c) >= 0)
                    delay = _commaDelay;
                else if (System.Array.IndexOf(_punctuationChars, c) >= 0)
                    delay = _punctuationDelay;

                yield return new WaitForSeconds(delay);
            }

            IsPlaying = false;
            _currentCoroutine = null;
            OnComplete?.Invoke();
        }

        private void SetText(string text)
        {
            if (_textComponent != null)
                _textComponent.text = text;
        }

        #endregion
    }
}
