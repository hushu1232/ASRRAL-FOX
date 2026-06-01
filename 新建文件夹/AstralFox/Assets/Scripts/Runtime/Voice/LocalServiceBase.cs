using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using AstralFox.Diagnostics;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace AstralFox.Voice
{
    /// <summary>
    /// Base class for managing a local Python service subprocess.
    /// Handles: StreamingAssets extraction → process lifecycle → health polling → graceful shutdown.
    ///
    /// Subclass implements: ServiceName, ExeName, DefaultPort, GetArgs(), OnHealthCheck().
    /// </summary>
    public abstract class LocalServiceBase : MonoBehaviour
    {
        [Header("Process")]
        [SerializeField, Range(1, 30)]
        private float _startupTimeout = 15f;

        [SerializeField, Range(1, 10)]
        private float _healthPollInterval = 2f;

        [SerializeField]
        private bool _autoStart = true;

        [Header("Debug")]
        [SerializeField]
        private bool _logOutput = false;

        public event Action OnReady;
        public event Action<string> OnError;

        public bool IsReady { get; protected set; }
        public bool IsRunning => _process != null && !_process.HasExited;

        public abstract string ServiceName { get; }
        protected abstract string ExeName { get; }
        protected abstract int DefaultPort { get; }
        protected abstract string HealthEndpoint { get; }
        protected virtual string GetArgs() => $"--port {DefaultPort} --preload";

        private Process _process;
        private float _startupTimer;
        private float _pollTimer;
        private bool _startAttempted;
        private CancellationTokenSource _healthCts;

        #region Unity Lifecycle

        protected virtual void Start()
        {
            if (_autoStart)
                _ = StartServiceAsync();
        }

        protected virtual void Update()
        {
            if (!IsReady && _startAttempted)
            {
                _startupTimer += Time.unscaledDeltaTime;
                if (_startupTimer >= _startupTimeout)
                {
                    OnError?.Invoke($"[{ServiceName}] Startup timeout ({_startupTimeout}s)");
                    _startAttempted = false;
                }
            }

            if (IsReady)
            {
                _pollTimer += Time.unscaledDeltaTime;
                if (_pollTimer >= _healthPollInterval)
                {
                    _pollTimer = 0f;
                    _ = CheckHealthAsync();
                }
            }
        }

        protected virtual void OnDestroy()
        {
            StopService();
        }

        private void OnApplicationQuit()
        {
            StopService();
        }

        #endregion

        #region Start / Stop

        public async Task StartServiceAsync()
        {
            if (IsRunning || IsReady) return;
            _startAttempted = true;
            _startupTimer = 0f;

            // Step 1: Ensure executable is extracted from StreamingAssets
            string exePath = await ExtractExecutableAsync();
            if (string.IsNullOrEmpty(exePath))
            {
                OnError?.Invoke($"[{ServiceName}] Failed to extract executable");
                _startAttempted = false;
                return;
            }

            // Step 2: Launch process
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = GetArgs(),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    WorkingDirectory = Path.GetDirectoryName(exePath) ?? "",
                };

                _process = new Process { StartInfo = psi, EnableRaisingEvents = true };

                if (_logOutput)
                {
                    _process.OutputDataReceived += (_, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                            Debug.Log($"[{ServiceName}] {e.Data}");
                    };
                    _process.ErrorDataReceived += (_, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                            Debug.LogWarning($"[{ServiceName}] stderr: {e.Data}");
                    };
                }

                _process.Exited += OnProcessExited;
                _process.Start();

                if (_logOutput)
                {
                    _process.BeginOutputReadLine();
                    _process.BeginErrorReadLine();
                }

                Debug.Log($"[{ServiceName}] Process started (PID: {_process.Id})");

                // ── 3-Second Death Check ──────────────────────────
                // If the process exits within 3 seconds of starting,
                // it likely failed to initialize (missing DLL, bad config, port conflict).
                await Task.Delay(3000);
                if (_process.HasExited)
                {
                    int exitCode = _process.ExitCode;
                    string errorMsg = $"[{ServiceName}] Process exited after {(DateTime.Now - _process.StartTime).TotalSeconds:F1}s " +
                                      $"with code {exitCode}. Likely missing dependency or port conflict.";
                    Debug.LogError(errorMsg);
                    Diagnostics.CrashHandler.LogError(errorMsg);
                    OnError?.Invoke(errorMsg);
                    _startAttempted = false;
                    _process = null;
                    return;
                }

                // Step 3: Wait for health check
                _healthCts?.Cancel();
                _healthCts = new CancellationTokenSource();
                _ = PollUntilReadyAsync(_healthCts.Token);
            }
            catch (System.ComponentModel.Win32Exception winEx)
            {
                string errorMsg = $"[{ServiceName}] Cannot launch {Path.GetFileName(exePath)}: {winEx.Message}. " +
                                  "Missing VC++ runtime or system DLL.";
                Debug.LogError(errorMsg);
                Diagnostics.CrashHandler.LogError(errorMsg);
                OnError?.Invoke(errorMsg);
                _startAttempted = false;
                _process = null;
            }
            catch (Exception ex)
            {
                string errorMsg = $"[{ServiceName}] Failed to start: {ex.Message}";
                Debug.LogError(errorMsg);
                Diagnostics.CrashHandler.LogError(errorMsg, ex.StackTrace);
                OnError?.Invoke(errorMsg);
                _startAttempted = false;
                _process = null;
            }
        }

        public void StopService()
        {
            _healthCts?.Cancel();

            if (_process != null)
            {
                try
                {
                    if (!_process.HasExited)
                    {
                        _process.Kill();
                        _process.WaitForExit(3000);
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[{ServiceName}] Error killing process: {ex.Message}");
                }
                finally
                {
                    _process.Dispose();
                    _process = null;
                }
            }

            IsReady = false;
            _startAttempted = false;
            Debug.Log($"[{ServiceName}] Stopped.");
        }

        #endregion

        #region Health Check

        private async Task PollUntilReadyAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && !IsReady)
            {
                bool healthy = await CheckHealthAsync();
                if (healthy)
                {
                    IsReady = true;
                    _startAttempted = false;
                    Debug.Log($"[{ServiceName}] Ready.");
                    OnReady?.Invoke();
                    return;
                }
                await Task.Delay(500, ct);
            }
        }

        private async Task<bool> CheckHealthAsync()
        {
            try
            {
                using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(3) };
                var resp = await http.GetAsync($"http://127.0.0.1:{DefaultPort}{HealthEndpoint}");
                return resp.IsSuccessStatusCode;
            }
            catch
            {
                if (IsReady)
                {
                    // Was healthy, now unreachable
                    IsReady = false;
                    OnError?.Invoke($"[{ServiceName}] Health check failed — service may have crashed");
                }
                return false;
            }
        }

        #endregion

        #region Executable Extraction

        /// <summary>
        /// Extracts the Python service executable from StreamingAssets to persistentDataPath.
        /// On first run, copies the bundled exe. Returns the path to the executable.
        /// </summary>
        protected virtual async Task<string> ExtractExecutableAsync()
        {
            string targetDir = Path.Combine(Application.persistentDataPath, ServiceName.ToLower());
            string exePath = Path.Combine(targetDir, ExeName);

            // Check if already extracted
            if (File.Exists(exePath))
                return exePath;

            // Copy from StreamingAssets
            string sourcePath = Path.Combine(Application.streamingAssetsPath, ServiceName.ToLower(), ExeName);

            // StreamingAssets may be inside .apk or .unity3d bundle — handle both
            if (Application.platform == RuntimePlatform.Android)
            {
                // Android: use UnityWebRequest to extract from APK
                return await ExtractFromStreamingAssetsAsync(sourcePath, exePath);
            }

            if (!File.Exists(sourcePath))
            {
                Debug.LogError($"[{ServiceName}] Executable not found at: {sourcePath}");
                return null;
            }

            try
            {
                Directory.CreateDirectory(targetDir);
                File.Copy(sourcePath, exePath, overwrite: true);

                // Also copy model files if present
                string sourceDir = Path.GetDirectoryName(sourcePath);
                string modelsDir = Path.Combine(sourceDir, "models");
                string targetModels = Path.Combine(targetDir, "models");
                if (Directory.Exists(modelsDir) && !Directory.Exists(targetModels))
                {
                    CopyDirectory(modelsDir, targetModels);
                }

                Debug.Log($"[{ServiceName}] Extracted to: {exePath}");
                return exePath;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[{ServiceName}] Extraction failed: {ex.Message}");
                return null;
            }
        }

        private async Task<string> ExtractFromStreamingAssetsAsync(string sourcePath, string destPath)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(destPath));
            using var req = UnityEngine.Networking.UnityWebRequest.Get(sourcePath);
            var op = req.SendWebRequest();
            while (!op.isDone)
                await Task.Delay(50);
            if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[{ServiceName}] Failed to read from StreamingAssets: {req.error}");
                return null;
            }
            File.WriteAllBytes(destPath, req.downloadHandler.data);
            return destPath;
        }

        #endregion

        #region Event Handlers

        private void OnProcessExited(object sender, EventArgs e)
        {
            IsReady = false;
            int exitCode = _process?.ExitCode ?? -1;
            Debug.LogWarning($"[{ServiceName}] Process exited with code {exitCode}");

            // Auto-restart if not shutting down
            if (this != null && gameObject != null && gameObject.activeInHierarchy)
            {
                _startAttempted = false;
                _ = StartServiceAsync();
            }
        }

        #endregion

        #region Utilities

        protected static void CopyDirectory(string sourceDir, string destDir)
        {
            Directory.CreateDirectory(destDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string dest = Path.Combine(destDir, Path.GetFileName(file));
                File.Copy(file, dest, overwrite: true);
            }
            foreach (string dir in Directory.GetDirectories(sourceDir))
            {
                CopyDirectory(dir, Path.Combine(destDir, Path.GetFileName(dir)));
            }
        }

        #endregion
    }
}
