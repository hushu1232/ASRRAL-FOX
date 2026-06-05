using UnityEngine;

namespace AstralFox
{
    /// <summary>
    /// Application-level lifecycle: data persistence, config loading,
    /// system tray icon, global hotkeys, command line handling,
    /// and web-based settings server integration.
    /// </summary>
    public sealed class AppLifecycle : MonoBehaviour
    {
        [Header("Startup")]
        [SerializeField] private bool _applyAffectionDecayOnStart = true;
        [SerializeField] private bool _enableTrayIcon = true;
        [SerializeField] private bool _enableGlobalHotkeys = true;

        [Header("Web Settings")]
#pragma warning disable CS0414 // Inspector field, reserved for web settings panel integration
        [SerializeField] private bool _useWebSettings = true;
#pragma warning restore CS0414

        private bool _settingsMode;
        private Config.SettingsWebServer _webServer;

        private void Awake()
        {
            DontDestroyOnLoad(gameObject);

            var args = Config.CommandLineArgs.Instance;
            _settingsMode = args.OpenSettings;

            // Handle --no-transparent and --settings flags
            if (args.NoTransparent || args.OpenSettings)
            {
                var tw = FindObjectOfType<TransparentWindow>();
                if (tw != null)
                {
                    tw.DisableTransparency();
                    Debug.Log($"[AppLifecycle] Window transparency disabled " +
                              $"(no-transparent={args.NoTransparent}, settings={args.OpenSettings}).");
                }
                else
                {
                    Debug.LogWarning("[AppLifecycle] TransparentWindow not found! Cannot disable transparency.");
                }
            }

            // Trigger config loading (encrypted file -> memory)
            _ = Config.ConfigManager.Instance;

            if (_applyAffectionDecayOnStart)
                Data.DataStore.Instance.ApplyAffectionDecay();

            SyncPersonalityFromConfig();

            Debug.Log($"[AppLifecycle] Initialized. " +
                      $"Affection: {Data.DataStore.Instance.GetAffection().affectionLevel:F0}/100, " +
                      $"Personality: {Data.DataStore.Instance.GetCharacterPersonality()}");
        }

        private void Start()
        {
            if (Config.CommandLineArgs.Instance.DiagnosticMode)
            {
                gameObject.AddComponent<Diagnostics.BuildDiagnostics>();
                var cam = Camera.main;
                if (cam != null) cam.gameObject.AddComponent<Diagnostics.DebugOverlay>();
                Debug.Log("[AppLifecycle] Diagnostic mode enabled.");
            }

            if (_settingsMode)
            {
                // Make the Unity window small — browser handles all UI
                var tw = FindObjectOfType<TransparentWindow>();
                if (tw != null)
                    tw.SetWindowSize(400, 200);

                var cam = Camera.main;
                if (cam != null)
                    cam.backgroundColor = new Color(0.10f, 0.10f, 0.16f, 1f);

                // Hide pet
                var petInteraction = FindObjectOfType<FoxInteraction>();
                if (petInteraction != null)
                    petInteraction.enabled = false;

                var petPlaceholder = GameObject.Find("FoxPlaceholder");
                if (petPlaceholder != null)
                    petPlaceholder.SetActive(false);

                // Start web settings server
                StartWebSettings();
            }

            if (_enableTrayIcon)
                SetupTrayIcon();

            if (_enableGlobalHotkeys)
                SetupHotkeys();
        }

        private void Update()
        {
            if (_enableGlobalHotkeys)
                Config.GlobalHotkeyManager.Instance.Poll();

            // Check if web settings exit was requested
            if (_webServer != null && _webServer.ExitRequested)
            {
                _webServer.Stop();
                _webServer = null;
                Debug.Log("[AppLifecycle] Web settings exited. Closing application.");
                Application.Quit();
            }
        }

        private void OnApplicationQuit()
        {
            _webServer?.Stop();
            Config.GlobalHotkeyManager.Instance.Dispose();
            Config.TrayIconManager.Instance.Dispose();
            Data.DataStore.OnApplicationQuit();
            Debug.Log("[AppLifecycle] Shutdown complete.");
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused)
                Data.DataStore.Instance.Save();
        }

        #region Web Settings

        private void StartWebSettings()
        {
            _webServer = Config.SettingsWebServer.Instance;
            _webServer.Start();

            // Open browser to settings page
            Application.OpenURL("http://localhost:18920/");

            Debug.Log("[AppLifecycle] Web settings server started. Browser opened.");
        }

        /// <summary>Open web settings from tray icon or hotkey (normal mode).</summary>
        public void OpenSettingsPanel()
        {
            if (_webServer == null)
            {
                // Disable transparency and start web settings
                var tw = FindObjectOfType<TransparentWindow>();
                if (tw != null)
                {
                    tw.DisableTransparency();
                    tw.SetWindowSize(400, 200);
                }

                var petInteraction = FindObjectOfType<FoxInteraction>();
                if (petInteraction != null)
                    petInteraction.enabled = false;

                StartWebSettings();
            }
            else
            {
                // Settings already open — just bring browser to front
                Application.OpenURL("http://localhost:18920/");
            }
        }

        #endregion

        #region Personality Sync

        private void SyncPersonalityFromConfig()
        {
            var cfg = Config.ConfigManager.Instance.CurrentConfig;
            Data.DataStore.Instance.SetCharacterPersonality(cfg.character_personality);
            Config.ConfigManager.Instance.OnConfigChanged += OnConfigUpdated;
        }

        private void OnConfigUpdated(Config.AppConfig newConfig)
        {
            Data.DataStore.Instance.SetCharacterPersonality(newConfig.character_personality);
            Debug.Log("[AppLifecycle] Character personality synced from config.");
        }

        private void OnDestroy()
        {
            Config.ConfigManager.Instance.OnConfigChanged -= OnConfigUpdated;
        }

        #endregion

        #region Tray Icon

        private void SetupTrayIcon()
        {
            if (!Config.TrayIconManager.Instance.IsSupported) return;

            Config.TrayIconManager.Instance.Initialize(
                onShow: () =>
                {
                    var tw = FindObjectOfType<TransparentWindow>();
                    if (tw != null)
                        tw.gameObject.SetActive(true);
                },
                onSettings: () =>
                {
                    OpenSettingsPanel();
                },
                onExit: () =>
                {
                    Application.Quit();
                }
            );
        }

        #endregion

        #region Global Hotkeys

        private void SetupHotkeys()
        {
            Config.GlobalHotkeyManager.Instance.Register(
                onSettings: () =>
                {
                    Config.UnityMainThreadDispatcher.Enqueue(() =>
                        OpenSettingsPanel());
                },
                onTogglePet: () =>
                {
                    Config.UnityMainThreadDispatcher.Enqueue(() =>
                    {
                        var tw = FindObjectOfType<TransparentWindow>();
                        if (tw != null)
                            tw.gameObject.SetActive(!tw.gameObject.activeSelf);
                    });
                }
            );
        }

        #endregion
    }
}
