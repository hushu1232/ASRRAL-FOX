using System;
using UnityEditor;
using UnityEngine;

namespace AstralFox.Editor
{
    /// <summary>
    /// Editor window version of the settings panel.
    /// Open via: Window → AstralFox → 系统设置, or right-click the fox.
    /// Editor-time config editor. Runtime uses web-based settings via SettingsWebServer.
    /// </summary>
    public sealed class AstralFoxSettingsWindow : EditorWindow
    {
        #region State

        private Config.AppConfig _editingConfig;
        private Vector2 _scrollPos;
        private bool _showAzureKey;
        private bool _showOpenAIKey;
        private string _azureRegionCustom = "";
        private bool _azureRegionUseCustom;
        private bool _isDirty;
        private string _statusMessage = "";
        private bool _isTesting;

        private static readonly string[] AzureRegions =
        {
            "eastasia", "southeastasia", "eastus", "westus",
            "westeurope", "northeurope", "japaneast", "japanwest",
            "koreacentral", "__custom__"
        };

        private int _selectedRegionIndex;

        private const float LabelWidth = 130f;

        #endregion

        #region Menu

        [MenuItem("AstralFox/系统设置", false, 100)]
        public static void ShowWindow()
        {
            var window = GetWindow<AstralFoxSettingsWindow>("星尘 · 系统设置");
            window.minSize = new Vector2(520, 560);
            window.maxSize = new Vector2(650, 800);
            window.Show();
        }

        [MenuItem("AstralFox/打开保存目录", false, 200)]
        public static void OpenDataFolder()
        {
            EditorUtility.RevealInFinder(Application.persistentDataPath);
        }

        #endregion

        #region Lifecycle

        private void OnEnable()
        {
            LoadConfig();
        }

        private void OnDisable()
        {
            if (_isDirty)
            {
                bool save = EditorUtility.DisplayDialog(
                    "未保存的更改",
                    "配置已修改但未保存。是否保存？",
                    "保存", "放弃");
                if (save) SaveConfig();
            }
        }

        #endregion

        #region Config IO

        private void LoadConfig()
        {
            _editingConfig = Config.ConfigManager.Instance.CurrentConfig;
            _statusMessage = Config.ConfigManager.Instance.ConfigFileExists
                ? "已加载加密配置文件"
                : "首次使用 — 请配置 API Key 并保存";
            _isDirty = false;

            // Determine Azure region dropdown index
            _azureRegionUseCustom = true;
            _azureRegionCustom = _editingConfig.azure_speech_region;
            for (int i = 0; i < AzureRegions.Length; i++)
            {
                if (AzureRegions[i] == _editingConfig.azure_speech_region)
                {
                    _selectedRegionIndex = i;
                    _azureRegionUseCustom = false;
                    break;
                }
            }
            if (_azureRegionUseCustom)
                _selectedRegionIndex = AzureRegions.Length - 1; // __custom__
        }

        private void SaveConfig()
        {
            if (_azureRegionUseCustom)
                _editingConfig.azure_speech_region = _azureRegionCustom.Trim();
            Config.ConfigManager.Instance.SaveConfig(_editingConfig);
            _isDirty = false;
            _statusMessage = "配置已加密保存到 config.enc";
            Repaint();
        }

        private void MarkDirty()
        {
            _isDirty = true;
        }

        #endregion

        #region GUI

        private void OnGUI()
        {
            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            EditorGUILayout.Space(6);
            GUILayout.Label("星尘 · 系统设置", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);

            // ── Azure Section ────────────────────────────────
            DrawSectionHeader("Azure 语音服务", "用于语音识别 (ASR)");

            EditorGUILayout.BeginVertical("box");
            {
                // Speech Key
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("Speech Key", GUILayout.Width(LabelWidth));
                if (_showAzureKey)
                    _editingConfig.azure_speech_key = EditorGUILayout.TextField(_editingConfig.azure_speech_key);
                else
                    _editingConfig.azure_speech_key = EditorGUILayout.PasswordField(_editingConfig.azure_speech_key);
                _showAzureKey = GUILayout.Toggle(_showAzureKey, "👁", "Button", GUILayout.Width(30));
                EditorGUILayout.EndHorizontal();
                if (GUI.changed) MarkDirty();

                // Region
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("区域", GUILayout.Width(LabelWidth));
                int newIdx = EditorGUILayout.Popup(_selectedRegionIndex, AzureRegions);
                if (newIdx != _selectedRegionIndex)
                {
                    _selectedRegionIndex = newIdx;
                    _azureRegionUseCustom = (AzureRegions[newIdx] == "__custom__");
                    if (!_azureRegionUseCustom)
                    {
                        _editingConfig.azure_speech_region = AzureRegions[newIdx];
                        MarkDirty();
                    }
                }
                EditorGUILayout.EndHorizontal();

                // Custom region
                if (_azureRegionUseCustom)
                {
                    EditorGUILayout.BeginHorizontal();
                    EditorGUILayout.LabelField("自定义区域", GUILayout.Width(LabelWidth));
                    string newCustom = EditorGUILayout.TextField(_azureRegionCustom);
                    if (newCustom != _azureRegionCustom)
                    {
                        _azureRegionCustom = newCustom;
                        _editingConfig.azure_speech_region = newCustom.Trim();
                        MarkDirty();
                    }
                    EditorGUILayout.EndHorizontal();
                }
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(8);

            // ── OpenAI Section ────────────────────────────────
            DrawSectionHeader("OpenAI 对话服务", "用于大语言模型 (LLM)");

            EditorGUILayout.BeginVertical("box");
            {
                // API Key
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("API Key", GUILayout.Width(LabelWidth));
                if (_showOpenAIKey)
                    _editingConfig.openai_api_key = EditorGUILayout.TextField(_editingConfig.openai_api_key);
                else
                    _editingConfig.openai_api_key = EditorGUILayout.PasswordField(_editingConfig.openai_api_key);
                _showOpenAIKey = GUILayout.Toggle(_showOpenAIKey, "👁", "Button", GUILayout.Width(30));
                EditorGUILayout.EndHorizontal();
                if (GUI.changed) MarkDirty();

                // Base URL
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("Base URL", GUILayout.Width(LabelWidth));
                string newUrl = EditorGUILayout.TextField(_editingConfig.openai_base_url);
                if (newUrl != _editingConfig.openai_base_url)
                {
                    _editingConfig.openai_base_url = newUrl;
                    MarkDirty();
                }
                EditorGUILayout.EndHorizontal();
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(8);

            // ── Character Section ─────────────────────────────
            DrawSectionHeader("角色设定", "影响 AI 对话风格");

            EditorGUILayout.BeginVertical("box");
            {
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("名字", GUILayout.Width(LabelWidth));
                string newName = EditorGUILayout.TextField(_editingConfig.character_name);
                if (newName != _editingConfig.character_name)
                { _editingConfig.character_name = newName; MarkDirty(); }
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.Space(4);

                EditorGUILayout.LabelField("性格 (最长2000字)", EditorStyles.miniLabel);
                string newPers = EditorGUILayout.TextArea(_editingConfig.character_personality,
                    GUILayout.Height(60));
                if (newPers != _editingConfig.character_personality)
                {
                    _editingConfig.character_personality = Truncate(newPers, 2000);
                    MarkDirty();
                }

                EditorGUILayout.Space(4);

                EditorGUILayout.LabelField("背景故事 (最长2000字)", EditorStyles.miniLabel);
                string newBack = EditorGUILayout.TextArea(_editingConfig.character_backstory,
                    GUILayout.Height(60));
                if (newBack != _editingConfig.character_backstory)
                {
                    _editingConfig.character_backstory = Truncate(newBack, 2000);
                    MarkDirty();
                }

                EditorGUILayout.Space(4);

                EditorGUILayout.LabelField("其他补充 (可选)", EditorStyles.miniLabel);
                string newExtra = EditorGUILayout.TextArea(_editingConfig.character_extra,
                    GUILayout.Height(40));
                if (newExtra != _editingConfig.character_extra)
                {
                    _editingConfig.character_extra = Truncate(newExtra, 1000);
                    MarkDirty();
                }

                EditorGUILayout.Space(6);

                if (GUILayout.Button("恢复默认角色设定", GUILayout.Width(150)))
                {
                    var defaults = new Config.AppConfig();
                    _editingConfig.character_name = defaults.character_name;
                    _editingConfig.character_personality = defaults.character_personality;
                    _editingConfig.character_backstory = defaults.character_backstory;
                    _editingConfig.character_extra = defaults.character_extra;
                    MarkDirty();
                    Repaint();
                }
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(8);

            // ── Animation Model Section ─────────────────────────
            DrawSectionHeader("动画模型", "选择桌宠使用的动画引擎");

            EditorGUILayout.BeginVertical("box");
            {
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("模型类型", GUILayout.Width(LabelWidth));
                EditorGUILayout.LabelField("Live2D (Cubism)", EditorStyles.boldLabel);
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.LabelField(
                    "  Live2D: 使用 Cubism 模型，表情细腻，支持物理模拟",
                    EditorStyles.miniLabel);
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(8);

            // ── ffmpeg Section ────────────────────────────────
            DrawSectionHeader("ffmpeg 工具", "音频格式转换 (可选)");

            EditorGUILayout.BeginVertical("box");
            {
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("ffmpeg 路径", GUILayout.Width(LabelWidth));
                string newFfmpeg = EditorGUILayout.TextField(_editingConfig.ffmpeg_path);
                if (newFfmpeg != _editingConfig.ffmpeg_path)
                { _editingConfig.ffmpeg_path = newFfmpeg; MarkDirty(); }
                if (GUILayout.Button("浏览...", GUILayout.Width(60)))
                {
                    string path = Config.FilePicker.OpenFile("选择 ffmpeg.exe", "exe");
                    if (!string.IsNullOrEmpty(path))
                    {
                        _editingConfig.ffmpeg_path = path;
                        MarkDirty();
                    }
                }
                EditorGUILayout.EndHorizontal();
                EditorGUILayout.LabelField("  提示: 可从 https://ffmpeg.org 下载", EditorStyles.miniLabel);
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(12);

            // ── Status ────────────────────────────────────────
            if (!string.IsNullOrEmpty(_statusMessage))
            {
                EditorGUILayout.HelpBox(_statusMessage, _statusMessage.StartsWith("配置已")
                    ? MessageType.Info : MessageType.None);
            }

            // ── Bottom Buttons ────────────────────────────────
            EditorGUILayout.BeginHorizontal();
            {
                GUI.enabled = !_isTesting;
                if (GUILayout.Button("测试连接", GUILayout.Height(28)))
                {
                    TestConnections();
                }

                GUILayout.FlexibleSpace();

                GUI.backgroundColor = _isDirty ? Color.green : Color.white;
                if (GUILayout.Button("保存配置", GUILayout.Height(28), GUILayout.Width(100)))
                {
                    SaveConfig();
                }
                GUI.backgroundColor = Color.white;

                if (GUILayout.Button("重新加载", GUILayout.Height(28), GUILayout.Width(80)))
                {
                    Config.ConfigManager.Instance.ReloadConfig();
                    LoadConfig();
                    Repaint();
                }

                GUI.enabled = true;
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            // ── Help Links ────────────────────────────────────
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("", GUILayout.Width(LabelWidth));
            if (GUILayout.Button("获取 Azure Key", EditorStyles.linkLabel))
                Application.OpenURL("https://portal.azure.com");
            if (GUILayout.Button("获取 OpenAI Key", EditorStyles.linkLabel))
                Application.OpenURL("https://platform.openai.com/api-keys");
            if (GUILayout.Button("下载 ffmpeg", EditorStyles.linkLabel))
                Application.OpenURL("https://ffmpeg.org/download.html");
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(8);

            // Connection test status
            if (_isTesting)
            {
                EditorGUILayout.HelpBox("正在测试连接...", MessageType.Info);
            }

            EditorGUILayout.EndScrollView();
        }

        #endregion

        #region Connection Test

        private void TestConnections()
        {
            _isTesting = true;
            _statusMessage = "正在测试连接...";
            Repaint();

            Config.ConfigValidator.RunAllTests(
                _editingConfig,
                (service, status) =>
                {
                    _statusMessage = $"测试 {service}...";
                    Repaint();
                },
                results =>
                {
                    _isTesting = false;
                    var sb = new System.Text.StringBuilder();
                    sb.AppendLine("测试结果:");
                    AppendResult(sb, "Azure", results.Azure);
                    AppendResult(sb, "OpenAI", results.OpenAI);
                    AppendResult(sb, "ffmpeg", results.Ffmpeg);
                    sb.Append(results.AllPassed
                        ? "\n所有服务连接正常！可以正常使用。"
                        : "\n部分服务不可用，可进入 mock 模式。");
                    _statusMessage = sb.ToString();
                    Repaint();
                });
        }

        private static void AppendResult(System.Text.StringBuilder sb, string name, Config.ConfigValidator.TestResult r)
        {
            string icon = r.Status == Config.ConfigValidator.TestStatus.Success ? "✓" :
                          r.Status == Config.ConfigValidator.TestStatus.NotRun ? "—" : "✗";
            sb.AppendLine($"  [{icon}] {name}: {r.Message}");
        }

        #endregion

        #region Helpers

        private static void DrawSectionHeader(string title, string subtitle)
        {
            GUILayout.Label(title, EditorStyles.boldLabel);
            if (!string.IsNullOrEmpty(subtitle))
                EditorGUILayout.LabelField(subtitle, EditorStyles.miniLabel);
            EditorGUILayout.Space(2);
        }

        private static string Truncate(string text, int max) =>
            string.IsNullOrEmpty(text) ? "" :
            text.Length <= max ? text : text.Substring(0, max);

        #endregion
    }
}
