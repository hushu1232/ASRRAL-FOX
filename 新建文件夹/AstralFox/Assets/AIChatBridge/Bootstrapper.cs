using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;

namespace AstralFox
{
    /// <summary>
    /// One-click auto-startup orchestrator for AstralFox.
    /// Attaches via [RuntimeInitializeOnLoadMethod] to initialize before the first scene.
    ///
    /// Flow:
    ///   1. Check for first-run flag (PlayerPrefs)
    ///   2. If first run → show StartupWizard
    ///   3. Extract + start ASR/TTS subprocesses (LocalServiceBase)
    ///   4. Load LLM model (LLMService)
    ///   5. Initialize desktop pet main interface
    ///   6. Show progress throughout
    ///
    /// Can be configured via AIConfig.asset in Resources.
    /// </summary>
    public class Bootstrapper : MonoBehaviour
    {
        #region Inspector

        [Header("Services")]
        [SerializeField]
        private Voice.AIManager _aiManager;

        [SerializeField]
        private Voice.VoiceManager _voiceManager;

        [Header("UI")]
        [SerializeField]
        private GameObject _loadingOverlay;

        [SerializeField]
        private Image _progressFillBar;

        [SerializeField]
        private Text _progressMessage;

        [Header("Settings")]
        [SerializeField, Range(1f, 30f)]
        private float _loadingMinDisplayTime = 1.5f;

        [SerializeField, Tooltip("Skip loading screen when services are already running.")]
        private bool _skipWhenReady = true;

        #endregion

        #region Events

        public event Action<string, float> OnProgress; // message, percent 0-1
        public event Action OnReady;
        public event Action<string> OnError;

        #endregion

        #region Private State

        private Config.AIConfig _config;
        private bool _isBooting;
        private float _startTime;

        #endregion

        #region Runtime Initialization

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void OnRuntimeInitialize()
        {
            // Create bootstrapper GameObject that persists across scenes
            var go = new GameObject("AstralFox_Bootstrapper");
            go.AddComponent<Bootstrapper>();
            DontDestroyOnLoad(go);
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            Diagnostics.CrashHandler.LogStartup("Bootstrapper.Awake — loading config");
            _config = Config.AIConfig.LoadOrDefault();
        }

        private async void Start()
        {
            if (_isBooting) return;
            _isBooting = true;
            _startTime = Time.time;

            Diagnostics.CrashHandler.LogStartup("Bootstrapper.Start — beginning bootstrap sequence");
            ShowLoading(true);

            try
            {
                await BootstrapAsync();
                Diagnostics.CrashHandler.LogStartup("Bootstrap complete. Invoking OnReady.");
                OnReady?.Invoke();
            }
            catch (Exception ex)
            {
                string stackTrace = ex.StackTrace ?? "";
                Debug.LogError($"[Bootstrapper] Bootstrap failed: {ex.Message}\n{stackTrace}");
                Diagnostics.CrashHandler.LogError($"Bootstrap failed: {ex.Message}", stackTrace);
                OnError?.Invoke(ex.Message);
            }
            finally
            {
                // Ensure minimum display time for loading screen
                float elapsed = Time.time - _startTime;
                if (elapsed < _loadingMinDisplayTime)
                    await Task.Delay((int)((_loadingMinDisplayTime - elapsed) * 1000));

                ShowLoading(false);
                _isBooting = false;
            }
        }

        #endregion

        #region Bootstrap Sequence

        private async Task BootstrapAsync()
        {
            var totalSteps = 5;
            var currentStep = 0;

            // Step 1: Configuration check
            ReportProgress("正在检查配置...", (float)currentStep++ / totalSteps);
            Diagnostics.CrashHandler.LogStartup("Step 1/5: Configuration check");

            bool isFirstRun = PlayerPrefs.GetInt("AstralFox_FirstRun", 1) == 1;
            if (isFirstRun)
            {
                Debug.Log("[Bootstrapper] First run detected. Launching startup wizard...");
                await ShowStartupWizardAsync();
            }

            // Step 2: Initialize AI services (ASR + TTS subprocesses)
            ReportProgress("正在启动语音服务...", (float)currentStep++ / totalSteps);
            Diagnostics.CrashHandler.LogStartup("Step 2/5: Starting AI services (ASR + TTS)");

            if (_aiManager == null)
                _aiManager = FindObjectOfType<Voice.AIManager>();

            if (_aiManager != null)
            {
                _aiManager.InitializeServices();
                await WaitForServicesAsync(_aiManager);
                Diagnostics.CrashHandler.LogStartup($"AI services status: ASR={_aiManager.CurrentStatus.asr} LLM={_aiManager.CurrentStatus.llm} TTS={_aiManager.CurrentStatus.tts}");
            }
            else
            {
                Diagnostics.CrashHandler.LogWarning("AIManager not found — AI services skipped");
            }

            // Step 3: Load LLM model
            ReportProgress("正在加载语言模型...", (float)currentStep++ / totalSteps);
            Diagnostics.CrashHandler.LogStartup("Step 3/5: Loading LLM model");

            var llmService = FindObjectOfType<Voice.LLMService>();
            if (llmService != null && !llmService.IsReady)
            {
                await Task.Run(() =>
                {
                    float waitTime = 0;
                    while (!llmService.IsReady && waitTime < _config.pipelineTimeout)
                    {
                        Task.Delay(200).Wait();
                        waitTime += 0.2f;
                    }
                });

                if (!llmService.IsReady)
                {
                    Debug.LogWarning("[Bootstrapper] LLM model failed to load within timeout. Continuing in degraded mode.");
                }
            }

            // Step 4: Initialize voice capture
            ReportProgress("正在初始化麦克风...", (float)currentStep++ / totalSteps);

            if (_voiceManager == null)
                _voiceManager = FindObjectOfType<Voice.VoiceManager>();

            // VoiceManager handles its own initialization in Start()
            await Task.Delay(500);

            // Step 5: Desktop interface ready
            ReportProgress("正在准备桌面界面...", (float)currentStep++ / totalSteps);

            // Apply saved configuration
            await ApplySavedConfigurationAsync();

            ReportProgress("启动完成！", 1.0f);

            // Mark first run complete
            PlayerPrefs.SetInt("AstralFox_FirstRun", 0);
            PlayerPrefs.Save();

            Debug.Log("[Bootstrapper] Bootstrap complete. AstralFox is ready.");
        }

        #endregion

        #region Helpers

        private async Task WaitForServicesAsync(Voice.AIManager aiManager)
        {
            float elapsed = 0;
            while (!aiManager.IsReady && elapsed < _config.pipelineTimeout)
            {
                await Task.Delay(200);
                elapsed += 0.2f;

                float progress = elapsed / _config.pipelineTimeout;
                ReportProgress($"正在启动 AI 服务 ({elapsed:F0}s)...", 0.2f + progress * 0.3f);
            }

            if (!aiManager.IsReady)
            {
                Debug.LogWarning("[Bootstrapper] AI services not fully ready. Continuing with available services.");
                ReportProgress("AI 引擎部分就绪（降级模式）", 0.5f);
            }
        }

        private async Task ApplySavedConfigurationAsync()
        {
            // Apply saved preferences from PlayerPrefs or ConfigManager
            await Task.Delay(100); // placeholder for any async config loading

            string personality = PlayerPrefs.GetString("AstralFox_Personality", "");
            if (!string.IsNullOrEmpty(personality))
            {
                Data.DataStore.Instance?.SetCharacterPersonality(personality);
            }
        }

        private async Task ShowStartupWizardAsync()
        {
            // The wizard is handled by a separate UI component.
            // Here we just set a flag that the wizard should be shown.
            PlayerPrefs.SetInt("AstralFox_ShowWizard", 1);
            PlayerPrefs.Save();
            await Task.Delay(200);
        }

        private void ReportProgress(string message, float percent)
        {
            if (_progressMessage != null)
                _progressMessage.text = message;

            if (_progressFillBar != null)
                _progressFillBar.fillAmount = percent;

            OnProgress?.Invoke(message, percent);

            if (Config.AIConfig.LoadOrDefault().verboseLogging)
                Debug.Log($"[Bootstrapper] {percent * 100:F0}% — {message}");
        }

        private void ShowLoading(bool show)
        {
            if (_loadingOverlay != null)
                _loadingOverlay.SetActive(show);
        }

        #endregion
    }
}
