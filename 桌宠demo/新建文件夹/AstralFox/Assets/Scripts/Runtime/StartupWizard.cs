using System;
using System.Collections.Generic;
using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// First-run setup wizard for end users.
    /// Guides new users through configuring their pet before the first interaction.
    /// Automatically detects whether setup is needed and shows only when appropriate.
    /// </summary>
    public sealed class StartupWizard : MonoBehaviour
    {
        [Header("Wizard Settings")]
        [SerializeField]
        private bool _showOnFirstRun = true;

        [SerializeField, Range(0.5f, 3f)]
        private float _fadeInDuration = 1f;

        private enum WizardStep { Welcome, VoiceConfig, ModelSelect, Personality, Done }
        private WizardStep _step = WizardStep.Welcome;
        private bool _isVisible;
        private float _alpha;
        private float _fadeVelocity;
        private string _tempCharacterName = "小星";
        private string _tempPersonality = "温柔善良的猫耳精灵";
        private int _selectedModelIndex;
        private bool _hasDismissed;
        private Config.AppConfig _config;
        private Texture2D _panelTexture;
        private GUIStyle _panelStyle;
        private readonly List<Config.PetModelRegistry.ModelEntry> _availableModels = new();
        private string[] _modelNames = new string[0];

        private void Awake()
        {
            _config = Config.ConfigManager.Instance?.CurrentConfig;
            if (_config == null) _config = new Config.AppConfig();
            _panelTexture = MakeColorTexture(new Color(0.15f, 0.12f, 0.2f, 0.95f));
            RefreshModelList();

            // Only show if setup is needed (no API keys configured)
            _isVisible = _showOnFirstRun && _config.NeedsFirstTimeSetup;
        }

        private void OnDestroy()
        {
            if (_panelTexture != null) Destroy(_panelTexture);
        }

        private void OnGUI()
        {
            if (!_isVisible || _hasDismissed) return;
            if (_panelStyle == null)
            {
                _panelStyle = new GUIStyle(GUI.skin.box);
                _panelStyle.normal.background = _panelTexture;
            }

            // Fade in
            _alpha = Mathf.SmoothDamp(_alpha, 1f, ref _fadeVelocity, _fadeInDuration);
            GUI.color = new Color(1f, 1f, 1f, _alpha);

            // Full-screen dark overlay
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height),
                Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0,
                new Color(0.1f, 0.05f, 0.15f, 0.85f * _alpha), 0, 0);

            // Dialog box
            float boxW = 420f, boxH = 380f;
            Rect box = new Rect((Screen.width - boxW) / 2f, (Screen.height - boxH) / 2f, boxW, boxH);

            // Background panel
            GUI.Box(box, "", _panelStyle);

            GUILayout.BeginArea(new Rect(box.x + 24, box.y + 20, boxW - 48, boxH - 40));

            switch (_step)
            {
                case WizardStep.Welcome:
                    DrawWelcome();
                    break;
                case WizardStep.VoiceConfig:
                    DrawVoiceConfig();
                    break;
                case WizardStep.ModelSelect:
                    DrawModelSelect();
                    break;
                case WizardStep.Personality:
                    DrawPersonality();
                    break;
                case WizardStep.Done:
                    DrawDone();
                    break;
            }

            GUILayout.EndArea();
        }

        private void DrawWelcome()
        {
            GUIStyle titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            titleStyle.normal.textColor = new Color(0.8f, 0.6f, 1f);
            GUILayout.Label("欢迎来到星尘世界！", titleStyle);
            GUILayout.Space(16);

            GUIStyle bodyStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, wordWrap = true, alignment = TextAnchor.MiddleCenter };
            bodyStyle.normal.textColor = new Color(0.8f, 0.8f, 0.9f);
            GUILayout.Label("我是你的桌面AI伙伴 ~\n我会在桌面上陪伴你、和你聊天、\n提醒你休息、分享你的喜怒哀乐。\n\n让我们先做一些简单的设置吧！", bodyStyle);

            GUILayout.Space(30);
            if (GUILayout.Button("开始设置 →", GUILayout.Height(40)))
                _step = WizardStep.VoiceConfig;
        }

        private void DrawVoiceConfig()
        {
            GUILayout.Label("语音对话设置", new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold });
            GUILayout.Space(12);
            GUILayout.Label("要和星尘语音聊天吗？\n配置语音服务后就可以对话啦！（可跳过）", new GUIStyle(GUI.skin.label) { wordWrap = true });

            GUILayout.Space(16);
            GUILayout.Label("OpenAI API Key (聊天):");
            _config.openai_api_key = GUILayout.TextField(_config.openai_api_key, GUILayout.Height(30));
            GUILayout.Label("Azure Speech Key (语音):");
            _config.azure_speech_key = GUILayout.TextField(_config.azure_speech_key, GUILayout.Height(30));

            GUILayout.Space(20);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("跳过", GUILayout.Height(35)))
                _step = WizardStep.ModelSelect;
            if (GUILayout.Button("下一步 →", GUILayout.Height(35)))
            {
                Config.ConfigManager.Instance?.SaveConfig(_config);
                _step = WizardStep.ModelSelect;
            }
            GUILayout.EndHorizontal();
        }

        private void DrawModelSelect()
        {
            GUILayout.Label("选择角色模型", new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold });
            GUILayout.Space(12);

            if (_availableModels.Count == 0)
            {
                GUILayout.Label("未找到本地 Live2D 模型。请确认 model3.json 已放在 StreamingAssets/Models 下。", new GUIStyle(GUI.skin.label) { wordWrap = true });
            }
            else
            {
                _selectedModelIndex = Mathf.Clamp(_selectedModelIndex, 0, _availableModels.Count - 1);
                _selectedModelIndex = GUILayout.SelectionGrid(_selectedModelIndex, _modelNames, 2, GUILayout.Height(120));
            }

            GUILayout.Space(20);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("← 返回", GUILayout.Height(35))) _step = WizardStep.VoiceConfig;
            if (GUILayout.Button("下一步 →", GUILayout.Height(35)))
            {
                if (_availableModels.Count > 0)
                {
                    var model = _availableModels[Mathf.Clamp(_selectedModelIndex, 0, _availableModels.Count - 1)];
                    if (Config.PetModelRegistry.TryGetExistingModelPath(model.modelPath, out var normalizedPath))
                        _config.model_path = normalizedPath;
                    else
                        Debug.LogWarning($"[StartupWizard] Ignored unavailable model path: {model.modelPath}");
                }
                _step = WizardStep.Personality;
            }
            GUILayout.EndHorizontal();
        }

        private void DrawPersonality()
        {
            GUILayout.Label("定制性格", new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold });
            GUILayout.Space(12);

            GUILayout.Label("名字:");
            _tempCharacterName = GUILayout.TextField(_tempCharacterName, GUILayout.Height(30));
            GUILayout.Label("性格描述:");
            _tempPersonality = GUILayout.TextArea(_tempPersonality, GUILayout.Height(60));

            GUILayout.Space(20);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("← 返回", GUILayout.Height(35))) _step = WizardStep.ModelSelect;
            if (GUILayout.Button("完成！", GUILayout.Height(35)))
            {
                _config.character_name = _tempCharacterName;
                _config.character_personality = _tempPersonality;
                Config.ConfigManager.Instance?.SaveConfig(_config);
                _step = WizardStep.Done;
            }
            GUILayout.EndHorizontal();
        }

        private void DrawDone()
        {
            GUIStyle bigStyle = new GUIStyle(GUI.skin.label) { fontSize = 36, alignment = TextAnchor.MiddleCenter };
            GUILayout.Label("✨", bigStyle);
            GUILayout.Space(8);
            GUILayout.Label("设置完成！", new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter });
            GUILayout.Space(12);
            GUILayout.Label("星尘已经准备好陪伴你啦！\n按 F12 或点击语音按钮开始对话。\n随时可以右键托盘图标修改设置。", new GUIStyle(GUI.skin.label) { fontSize = 13, wordWrap = true, alignment = TextAnchor.MiddleCenter });

            GUILayout.Space(24);
            if (GUILayout.Button("开始陪伴 →", GUILayout.Height(40)))
            {
                _hasDismissed = true;
                _isVisible = false;
            }
        }

        private static Texture2D MakeColorTexture(Color color)
        {
            var tex = new Texture2D(1, 1);
            tex.SetPixel(0, 0, color);
            tex.Apply();
            return tex;
        }

        private void RefreshModelList()
        {
            _availableModels.Clear();
            var models = Config.PetModelRegistry.Instance.GetAvailableModels();
            foreach (var model in models)
                _availableModels.Add(model);

            _modelNames = new string[_availableModels.Count];
            var currentPath = Config.PetModelRegistry.NormalizeModelPath(_config?.model_path);
            for (int i = 0; i < _availableModels.Count; i++)
            {
                _modelNames[i] = _availableModels[i].displayName;
                if (string.Equals(_availableModels[i].modelPath, currentPath, StringComparison.OrdinalIgnoreCase))
                    _selectedModelIndex = i;
            }
        }
    }
}
