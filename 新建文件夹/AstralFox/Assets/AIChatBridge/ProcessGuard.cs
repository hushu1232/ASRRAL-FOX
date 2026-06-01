using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace AstralFox.Voice
{
    /// <summary>
    /// Process health monitor and auto-restart guard for AI subprocesses
    /// (FunASR, sherpa-onnx TTS, etc.).
    ///
    /// Usage: Attach to the same GameObject as LocalServiceBase-derived services.
    ///   ProcessGuard.Instance.Watch(service, maxRetries: 3, onExhausted: () => { ... });
    ///
    /// Features:
    ///   - PID registration and periodic liveness check
    ///   - Auto-restart on unexpected exit (up to maxRetries)
    ///   - Cooldown between restarts (exponential backoff: 1s → 4s → 16s)
    ///   - Fallback notification when retries exhausted
    ///   - Restart statistics via OnServiceEvent callback
    /// </summary>
    public class ProcessGuard : MonoBehaviour
    {
        #region Singleton

        private static ProcessGuard _instance;
        public static ProcessGuard Instance
        {
            get
            {
                if (_instance == null)
                {
                    var go = new GameObject("ProcessGuard");
                    _instance = go.AddComponent<ProcessGuard>();
                    DontDestroyOnLoad(go);
                }
                return _instance;
            }
        }

        #endregion

        #region Types

        [Serializable]
        public class GuardEntry
        {
            public string serviceName;
            public LocalServiceBase service;
            public int maxRetries = 3;
            public int retryCount;
            public float cooldownSeconds = 1f;
            public bool isExhausted;
            public DateTime lastRestart;
            public Action onExhausted;
        }

        public struct ServiceEvent
        {
            public string serviceName;
            public enum EventType { Started, Restarted, Crashed, ExhaustedRetries, Recovered }
            public EventType type;
            public int retryCount;
            public DateTime timestamp;
        }

        #endregion

        #region Events

        public event Action<ServiceEvent> OnServiceEvent;

        #endregion

        #region Inspector

        [Header("Monitoring")]
        [SerializeField, Range(1f, 30f), Tooltip("Seconds between health checks.")]
        private float _checkInterval = 5f;

        [SerializeField, Tooltip("Maximum total restarts across all services.")]
        private int _globalMaxRestarts = 20;

        [Header("Debug")]
        [SerializeField]
        private bool _verboseLogging = false;

        #endregion

        #region Private Fields

        private readonly System.Collections.Generic.Dictionary<string, GuardEntry> _entries = new();
        private CancellationTokenSource _monitorCts;
        private int _totalRestarts;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            _monitorCts = new CancellationTokenSource();
            _ = MonitorLoopAsync(_monitorCts.Token);
        }

        private void OnDestroy()
        {
            _monitorCts?.Cancel();
            _monitorCts?.Dispose();
        }

        #endregion

        #region Public API

        /// <summary>Register a service for health monitoring.</summary>
        public void Watch(LocalServiceBase service, int maxRetries = 3, Action onExhausted = null)
        {
            if (service == null)
            {
                Debug.LogError("[ProcessGuard] Cannot watch null service.");
                return;
            }

            var entry = new GuardEntry
            {
                serviceName = service.ServiceName,
                service = service,
                maxRetries = maxRetries,
                onExhausted = onExhausted,
                lastRestart = DateTime.MinValue,
            };

            _entries[entry.serviceName] = entry;

            if (_verboseLogging)
                Debug.Log($"[ProcessGuard] Watching: {entry.serviceName} (max retries: {maxRetries})");
        }

        /// <summary>Unregister a service from monitoring.</summary>
        public void Unwatch(string serviceName)
        {
            _entries.Remove(serviceName);
        }

        /// <summary>Get current status for a watched service.</summary>
        public GuardEntry GetStatus(string serviceName)
        {
            return _entries.TryGetValue(serviceName, out var entry) ? entry : null;
        }

        /// <summary>Return a summary string for all watched services.</summary>
        public string GetSummary()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("ProcessGuard Status:");
            foreach (var (name, entry) in _entries)
            {
                string status = entry.isExhausted ? "EXHAUSTED" :
                                entry.retryCount > 0 ? $"WARN ({entry.retryCount}/{entry.maxRetries})" :
                                "OK";
                sb.AppendLine($"  {name}: {status}");
            }
            sb.AppendLine($"  Total restarts: {_totalRestarts}/{_globalMaxRestarts}");
            return sb.ToString();
        }

        #endregion

        #region Monitor Loop

        private async Task MonitorLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay((int)(_checkInterval * 1000), ct);

                foreach (var (name, entry) in _entries)
                {
                    if (entry.isExhausted) continue;

                    // Check if service process is still alive
                    bool isAlive = entry.service != null && entry.service.IsRunning;

                    if (!isAlive && entry.service != null && entry.service.IsReady == false)
                    {
                        // Service has died — attempt restart
                        await HandleServiceCrash(entry);
                    }
                }
            }
        }

        private async Task HandleServiceCrash(GuardEntry entry)
        {
            if (entry.isExhausted) return;
            if (_totalRestarts >= _globalMaxRestarts)
            {
                Debug.LogError($"[ProcessGuard] Global restart limit ({_globalMaxRestarts}) reached. Cannot restart {entry.serviceName}.");
                return;
            }

            // Cooldown check — exponential backoff
            float cooldown = entry.cooldownSeconds;
            float elapsed = (float)(DateTime.Now - entry.lastRestart).TotalSeconds;
            if (elapsed < cooldown)
            {
                if (_verboseLogging)
                    Debug.Log($"[ProcessGuard] {entry.serviceName} crashed within cooldown ({elapsed:F1}s < {cooldown}s). Waiting...");
                return;
            }

            entry.retryCount++;
            _totalRestarts++;

            Debug.LogWarning($"[ProcessGuard] {entry.serviceName} appears to have crashed. Attempting restart ({entry.retryCount}/{entry.maxRetries})...");

            OnServiceEvent?.Invoke(new ServiceEvent
            {
                serviceName = entry.serviceName,
                type = ServiceEvent.EventType.Crashed,
                retryCount = entry.retryCount,
                timestamp = DateTime.Now,
            });

            try
            {
                await entry.service.StartServiceAsync();

                if (entry.service.IsReady)
                {
                    entry.lastRestart = DateTime.MinValue; // reset cooldown on success
                    entry.cooldownSeconds = 1f; // reset backoff

                    OnServiceEvent?.Invoke(new ServiceEvent
                    {
                        serviceName = entry.serviceName,
                        type = ServiceEvent.EventType.Recovered,
                        retryCount = entry.retryCount,
                        timestamp = DateTime.Now,
                    });

                    Debug.Log($"[ProcessGuard] {entry.serviceName} recovered successfully.");
                }
                else
                {
                    // Still not ready — increase backoff
                    entry.lastRestart = DateTime.Now;
                    entry.cooldownSeconds = Mathf.Min(entry.cooldownSeconds * 4f, 30f);

                    if (entry.retryCount >= entry.maxRetries)
                    {
                        entry.isExhausted = true;
                        entry.onExhausted?.Invoke();

                        OnServiceEvent?.Invoke(new ServiceEvent
                        {
                            serviceName = entry.serviceName,
                            type = ServiceEvent.EventType.ExhaustedRetries,
                            retryCount = entry.retryCount,
                            timestamp = DateTime.Now,
                        });

                        Debug.LogError($"[ProcessGuard] {entry.serviceName} failed to recover after {entry.maxRetries} attempts. Service marked as exhausted.");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ProcessGuard] Error restarting {entry.serviceName}: {ex.Message}");
            }
        }

        #endregion
    }
}
