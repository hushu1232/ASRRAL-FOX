using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using AstralFox.Voice;

namespace AstralFox.Editor
{
    /// <summary>
    /// Real-time WebSocket message monitor for interview demos.
    /// Shows the last 50 messages flowing through the voice pipeline
    /// with color-coded types and timestamps.
    ///
    /// Menu: AstralFox → WebSocket Monitor
    /// </summary>
    public sealed class WebSocketMonitorWindow : EditorWindow
    {
        private struct LogEntry
        {
            public float time;
            public string direction; // → send / ← recv
            public string type;
            public string summary;
            public bool isError;
        }

        private readonly List<LogEntry> _entries = new();
        private Vector2 _scrollPos;
        private bool _autoScroll = true;
        private bool _isPaused;
        private BackendClient _client;

        // Color coding
        private static readonly Color SendColor     = new(0.3f, 0.8f, 0.3f, 0.3f);
        private static readonly Color RecvColor     = new(0.3f, 0.5f, 1.0f, 0.3f);
        private static readonly Color ErrorColor    = new(1.0f, 0.3f, 0.3f, 0.3f);
        private static readonly Color TextColor     = new(0.85f, 0.85f, 0.85f);

        private GUIStyle _entryStyle;
        private GUIStyle _headerStyle;

        [MenuItem("AstralFox/WebSocket Monitor")]
        public static void ShowWindow()
        {
            var window = GetWindow<WebSocketMonitorWindow>("WS 消息监视器");
            window.minSize = new Vector2(500, 300);
            window.Show();
        }

        private void OnEnable()
        {
            EditorApplication.update += PullMessages;
            if (_entryStyle == null) InitStyles();
        }

        private void OnDisable()
        {
            EditorApplication.update -= PullMessages;
        }

        private void InitStyles()
        {
            _entryStyle = new GUIStyle(EditorStyles.label)
            {
                richText = true,
                wordWrap = true,
                padding = new RectOffset(4, 4, 2, 2),
            };
            _headerStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 11,
                padding = new RectOffset(4, 4, 2, 2),
            };
        }

        private void PullMessages()
        {
            if (_isPaused || !Application.isPlaying) return;

            // Try to find BackendClient
            if (_client == null)
                _client = FindObjectOfType<BackendClient>();

            // TODO: Subscribe to BackendClient events for real-time push.
            // Currently polling BackendClient.IsConnected for status.
            // For full real-time monitoring, BackendClient would need an OnMessageLogged event.
        }

        private void OnGUI()
        {
            if (!Application.isPlaying)
            {
                EditorGUILayout.HelpBox(
                    "进入 Play Mode 后查看 WebSocket 消息流。\n" +
                    "语音对话时消息将在此实时显示。",
                    MessageType.Info);

                // Show diagnostic info
                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField("消息协议说明", EditorStyles.boldLabel);
                EditorGUILayout.BeginVertical(EditorStyles.helpBox);
                DrawProtocolLegend("→ 发送", "pcm_audio, ping, hello", SendColor);
                DrawProtocolLegend("← 接收", "partial_transcript, final_transcript, llm_response, tts_audio, reminder, welcome, error", RecvColor);
                DrawProtocolLegend("⚠ 错误", "connection_failed, protocol_mismatch, timeout", ErrorColor);
                EditorGUILayout.EndVertical();
                return;
            }

            DrawToolbar();
            DrawConnectionStatus();
            DrawMessageList();
        }

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            GUILayout.Label($"📨 {_entries.Count} 消息", EditorStyles.miniLabel);

            _autoScroll = GUILayout.Toggle(_autoScroll, "自动滚动", EditorStyles.toolbarButton);
            _isPaused = GUILayout.Toggle(_isPaused, _isPaused ? "▶ 继续" : "⏸ 暂停", EditorStyles.toolbarButton);

            if (GUILayout.Button("清空", EditorStyles.toolbarButton, GUILayout.Width(40)))
                _entries.Clear();

            if (GUILayout.Button("刷新", EditorStyles.toolbarButton, GUILayout.Width(40)))
                _client = null;

            GUILayout.FlexibleSpace();

            // Add test message button
            if (GUILayout.Button("+ 测试消息", EditorStyles.toolbarButton))
                AddEntry("→", "test", "Manual test entry at " + Time.time.ToString("F2") + "s", false);

            EditorGUILayout.EndHorizontal();
        }

        private void DrawConnectionStatus()
        {
            if (_client == null)
            {
                _client = FindObjectOfType<BackendClient>();
                if (_client == null)
                {
                    EditorGUILayout.HelpBox("未找到 BackendClient。请确认场景中有 VoiceManager。", MessageType.Warning);
                    return;
                }
            }

            bool connected = false;
            try { connected = _client.IsConnected; } catch { }

            var oldColor = GUI.color;
            GUI.color = connected ? new Color(0.3f, 1f, 0.3f) : new Color(1f, 0.5f, 0.3f);
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField(
                connected ? "🟢 WebSocket 已连接" : "🔴 WebSocket 未连接",
                EditorStyles.boldLabel);
            EditorGUILayout.EndVertical();
            GUI.color = oldColor;
        }

        private void DrawMessageList()
        {
            if (_entryStyle == null) InitStyles();

            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            if (_entries.Count == 0)
            {
                EditorGUILayout.LabelField(
                    "  等待消息... (开始语音对话后消息将出现在这里)",
                    new GUIStyle(EditorStyles.centeredGreyMiniLabel) { padding = new RectOffset(0, 0, 40, 40) });
            }

            for (int i = _entries.Count - 1; i >= 0; i--)
            {
                var entry = _entries[i];
                Color bgColor = entry.isError ? ErrorColor :
                    entry.direction.Contains("→") ? SendColor : RecvColor;

                var rect = EditorGUILayout.BeginHorizontal(EditorStyles.helpBox);
                EditorGUI.DrawRect(rect, bgColor);

                // Time
                var timeStyle = new GUIStyle(EditorStyles.miniLabel) { normal = { textColor = Color.gray } };
                EditorGUILayout.LabelField($"{entry.time:F1}s", timeStyle, GUILayout.Width(45));

                // Direction badge
                EditorGUILayout.LabelField(entry.direction, EditorStyles.boldLabel, GUILayout.Width(20));

                // Type
                EditorGUILayout.LabelField(entry.type, GUILayout.Width(140));

                // Summary
                EditorGUILayout.LabelField(entry.summary, _entryStyle, GUILayout.ExpandWidth(true));

                EditorGUILayout.EndHorizontal();
            }

            EditorGUILayout.EndScrollView();

            if (_autoScroll && _entries.Count > 0)
                _scrollPos.y = float.MaxValue; // Force scroll to bottom next frame
        }

        private void DrawProtocolLegend(string direction, string types, Color color)
        {
            EditorGUILayout.BeginHorizontal();
            var rect = EditorGUILayout.GetControlRect(false, 12, GUILayout.Width(12));
            EditorGUI.DrawRect(rect, color);
            EditorGUILayout.LabelField(direction, EditorStyles.boldLabel, GUILayout.Width(50));
            EditorGUILayout.LabelField(types, EditorStyles.miniLabel);
            EditorGUILayout.EndHorizontal();
        }

        /// <summary>Add a message entry (call from BackendClient or test code).</summary>
        public void AddEntry(string direction, string type, string summary, bool isError = false)
        {
            _entries.Add(new LogEntry
            {
                time = Time.time,
                direction = direction,
                type = type,
                summary = summary,
                isError = isError,
            });

            // Keep only last 50
            while (_entries.Count > 50)
                _entries.RemoveAt(0);
        }
    }
}
