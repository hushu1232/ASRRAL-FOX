using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;

namespace AstralFox.Behavior
{
    /// <summary>
    /// Context awareness engine — monitors the user's system state and triggers
    /// pet behaviors based on what the user is doing. This is the core "aliveness"
    /// differentiator that elevates AstralFox beyond reactive pets to proactive companions.
    /// </summary>
    public sealed class ContextAwareness : MonoBehaviour
    {
        #region Win32 P/Invoke

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll")]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

        #endregion

        #region Events

        /// <summary>Fired when user switches to a new application.</summary>
        public event Action<string, string> OnAppSwitched; // appName, category

        /// <summary>Fired when system becomes idle (no input for N seconds).</summary>
        public event Action<float> OnUserIdle; // idleSeconds

        /// <summary>Fired when user returns after being idle.</summary>
        public event Action<float> OnUserReturned; // awaySeconds

        /// <summary>Fired when pet should proactively speak based on context.</summary>
        public event Action<string> OnContextTrigger; // triggerReason

        #endregion

        #region Inspector

        [Header("Polling")]
        [SerializeField, Range(1f, 10f)]
        private float _pollInterval = 3f;

        [Header("Idle Detection")]
        [SerializeField, Range(30f, 600f)]
        private float _idleThreshold = 120f;  // Seconds before considered idle

        [SerializeField, Range(60f, 1800f)]
        private float _longIdleThreshold = 600f; // Deep idle

        [Header("Proactive Triggers")]
        [SerializeField]
        private bool _enableProactiveChat = true;

        [SerializeField, Range(300f, 3600f)]
        private float _proactiveInterval = 900f; // Min seconds between proactive chats

        #endregion

        #region State

        private string _currentApp = "";
        private string _currentCategory = "unknown";
        private float _pollTimer;
        private float _idleSeconds;
        private bool _isIdle;
        private bool _isLongIdle;
        private float _lastProactiveTime;
        private float _lastSwitchTime;

        // App → category mapping
        private static readonly Dictionary<string, string> AppCategories = new(StringComparer.OrdinalIgnoreCase)
        {
            ["devenv"] = "coding", ["code"] = "coding", ["cursor"] = "coding",
            ["rider"] = "coding", ["vim"] = "coding", ["nvim"] = "coding",
            ["terminal"] = "coding", ["cmd"] = "coding", ["powershell"] = "coding",
            ["chrome"] = "browsing", ["firefox"] = "browsing", ["edge"] = "browsing",
            ["slack"] = "working", ["teams"] = "working", ["discord"] = "social",
            ["spotify"] = "music", ["youtube"] = "entertainment",
            ["steam"] = "gaming", ["league"] = "gaming", ["valorant"] = "gaming",
            ["photoshop"] = "creative", ["figma"] = "creative", ["blender"] = "creative",
            ["word"] = "writing", ["notion"] = "writing", ["obsidian"] = "writing",
        };

        #endregion

        #region Unity Lifecycle

        private void Update()
        {
            _pollTimer += Time.unscaledDeltaTime;
            if (_pollTimer < _pollInterval) return;
            _pollTimer = 0f;

            DetectActiveWindow();
            DetectIdle();
            CheckProactiveTrigger();
        }

        #endregion

        #region Window Detection

        private void DetectActiveWindow()
        {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return;

            var sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, sb.Capacity);
            string title = sb.ToString();

            if (string.IsNullOrEmpty(title) || title == _currentApp) return;

            _currentApp = title;
            _currentCategory = CategorizeApp(title);
            _lastSwitchTime = Time.unscaledTime;

            OnAppSwitched?.Invoke(title, _currentCategory);
            Debug.Log($"[Context] App switched: {title} ({_currentCategory})");
        }

        private static string CategorizeApp(string windowTitle)
        {
            foreach (var kvp in AppCategories)
                if (windowTitle.IndexOf(kvp.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                    return kvp.Value;
            return "other";
        }

        #endregion

        #region Idle Detection

        private void DetectIdle()
        {
            var lii = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
            if (!GetLastInputInfo(ref lii)) return;

            _idleSeconds = (Environment.TickCount - (int)lii.dwTime) / 1000f;

            bool wasIdle = _isIdle;
            bool wasLongIdle = _isLongIdle;

            _isIdle = _idleSeconds >= _idleThreshold;
            _isLongIdle = _idleSeconds >= _longIdleThreshold;

            if (!wasIdle && _isIdle)
                OnUserIdle?.Invoke(_idleSeconds);

            if (wasIdle && !_isIdle)
                OnUserReturned?.Invoke(_idleSeconds);
        }

        #endregion

        #region Proactive Chat

        private void CheckProactiveTrigger()
        {
            if (!_enableProactiveChat) return;
            if (Time.unscaledTime - _lastProactiveTime < _proactiveInterval) return;

            // Trigger conditions
            string reason = null;

            // User deeply idle for a long time — pet checks in
            if (_isLongIdle && _idleSeconds > _longIdleThreshold * 1.5f)
                reason = "long_idle";

            // User just switched to coding after browsing — encourage
            if (_currentCategory == "coding" && Time.unscaledTime - _lastSwitchTime < 5f)
                reason = "started_coding";

            // Late night + gaming — remind to rest
            int hour = DateTime.Now.Hour;
            if (hour >= 23 && _currentCategory == "gaming")
                reason = "late_night_gaming";

            if (reason != null)
            {
                _lastProactiveTime = Time.unscaledTime;
                OnContextTrigger?.Invoke(reason);
                Debug.Log($"[Context] Proactive trigger: {reason}");
            }
        }

        #endregion

        #region Public API

        public string CurrentApp => _currentApp;
        public string CurrentCategory => _currentCategory;
        public float IdleSeconds => _idleSeconds;
        public bool IsUserIdle => _isIdle;
        public bool IsUserLongIdle => _isLongIdle;

        /// <summary>Generate a context-aware message for the pet to speak.</summary>
        public string GetContextMessage()
        {
            int hour = DateTime.Now.Hour;
            return _currentCategory switch
            {
                "coding" when _isIdle => "写代码辛苦了，休息一下吧~",
                "coding" => $"在写{_currentApp.Split('-')[0].Trim()}呢？加油！",
                "gaming" when hour >= 23 => "这么晚了还在打游戏呀，该休息啦~",
                "gaming" => "看起来很好玩的样子！",
                "browsing" => "在看什么呢？有什么有趣的分享给我呀~",
                "music" => "这首歌真好听 🎵",
                "creative" => "在创作吗？好厉害！",
                "writing" => "在写什么呢？给我看看嘛~",
                _ when _isLongIdle => "你还在吗？星尘好想你...",
                _ => null,
            };
        }

        #endregion
    }
}
