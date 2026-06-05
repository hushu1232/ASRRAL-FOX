using System.Collections;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Simulates the full ASR → LLM → TTS pipeline for offline testing.
    /// When enabled, bypasses the BackendClient and generates canned responses
    /// with emotion/action tags directly.
    ///
    /// Usage: Enable this component and disable BackendClient to test
    /// the voice UI / animation pipeline without a running backend server.
    /// </summary>
    public sealed class MockVoicePipeline : MonoBehaviour
    {
        #region Inspector

        [Header("Mock Settings")]
        [SerializeField]
        private bool _enableMock = true;

        [SerializeField, Range(0.5f, 5f)]
        private float _mockProcessingDelay = 1f;

        [SerializeField, Range(0.5f, 10f)]
        private float _mockSpeakingDuration = 3f;

        [Header("Mock Responses")]
        [TextArea(2, 4)]
        [SerializeField]
        private string[] _mockResponses = new string[]
        {
            "[happy]你好呀！我是星尘～有什么想聊的吗？",
            "[happy][action:wave]嗨！今天心情真好！",
            "[shy]唔…被发现了…",
            "[sad]刚才做了个不好的梦…",
            "[angry]哼！不准说我头发乱！",
            "[neutral]嗯，我在听呢。",
        };

        [Header("Mock Transcripts")]
        [SerializeField]
        private string[] _mockTranscripts = new string[]
        {
            "你好",
            "今天天气怎么样",
            "讲个笑话吧",
            "你叫什么名字",
            "我饿了",
            "陪我玩游戏",
        };

        #endregion

        #region Private Fields

        private VoiceManager _voiceManager;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _voiceManager = GetComponent<VoiceManager>();
        }

        private void Start()
        {
            if (_enableMock)
            {
                // Hook into VoiceManager events to intercept the pipeline
                _voiceManager.OnStateChanged += OnVoiceStateChanged;
                Debug.Log("[MockVoicePipeline] Mock mode enabled. Voice pipeline will use canned responses.");
            }
        }

        private void OnDestroy()
        {
            if (_voiceManager != null)
                _voiceManager.OnStateChanged -= OnVoiceStateChanged;
        }

        #endregion

        #region Mock Pipeline

        private void OnVoiceStateChanged(VoiceManager.VoiceState from, VoiceManager.VoiceState to)
        {
            if (!_enableMock) return;

            if (to == VoiceManager.VoiceState.Processing)
            {
                // Simulate backend processing
                StartCoroutine(MockProcessAsync());
            }
            else if (to == VoiceManager.VoiceState.Speaking)
            {
                // Simulate TTS playback
                StartCoroutine(MockSpeakingAsync());
            }
        }

        private IEnumerator MockProcessAsync()
        {
            yield return new WaitForSecondsRealtime(_mockProcessingDelay);

            // Pick random mock transcript and response
            string transcript = _mockTranscripts[Random.Range(0, _mockTranscripts.Length)];
            string response = _mockResponses[Random.Range(0, _mockResponses.Length)];

            Debug.Log($"[Mock] Transcript: \"{transcript}\"");
            Debug.Log($"[Mock] Response: \"{response}\"");

            // Feed the response directly as if it came from the backend
            string cleanText = VoiceManager.ParseResponseTags(response, out string emotion, out string action);

            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator != null)
            {
                animator.OnSpeakingStart();
                if (!string.IsNullOrEmpty(emotion))
                    animator.SetEmotion(VoiceManager.ParseEmotionTag(emotion));
            }

            Data.DataStore.Instance.AddChatRecord("user", _mockTranscripts[Random.Range(0, _mockTranscripts.Length)]);
            Data.DataStore.Instance.AddChatRecord("assistant", cleanText, emotion);
        }

        private IEnumerator MockSpeakingAsync()
        {
            // Simulate TTS playback duration
            yield return new WaitForSecondsRealtime(_mockSpeakingDuration);

            // Signal completion
            Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();

            // Force voice manager back to Idle
            // (Since we're mocking, we bypass the normal TTS-done flow)
        }

        #endregion

    }
}
