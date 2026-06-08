using System;
using System.Collections;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// GPU provider detection and metrics collection for the AstralFox desktop client.
    ///
    /// Detects available GPU compute providers:
    ///   - DirectML (Windows, via ONNX Runtime)
    ///   - CUDA (NVIDIA, via PyTorch/ONNX)
    ///   - Vulkan (Unity built-in)
    ///   - Metal (macOS, Unity built-in)
    ///
    /// Also polls the rigging service /api/metrics endpoint for backend GPU stats.
    /// </summary>
    public sealed class GpuDetector : MonoBehaviour
    {
        #region Types

        [Serializable]
        public struct GpuInfo
        {
            public string deviceName;
            public string provider;        // directml / cuda / vulkan / metal / cpu
            public bool gpuAvailable;
            public long memoryTotalMb;
            public long memoryUsedMb;
            public float utilizationPct;
            public int inferenceCount;
            public float avgInferenceMs;
        }

        public event Action<GpuInfo> OnGpuInfoUpdated;
        public event Action<GpuInfo> OnRiggingMetricsUpdated;

        #endregion

        #region Inspector

        [Header("Rigging Service")]
        [SerializeField]
        private string _riggingServiceUrl = "http://localhost:8001";

        [SerializeField, Range(5f, 60f)]
        private float _metricsPollInterval = 15f;

        [Header("Debug")]
        [SerializeField]
        private bool _logGpuInfo = true;

        #endregion

        #region Properties

        public GpuInfo LocalGpuInfo { get; private set; }
        public GpuInfo RiggingGpuInfo { get; private set; }
        public bool IsDirectMLAvailable { get; private set; }
        public bool IsCudaAvailable { get; private set; }

        #endregion

        #region Private Fields

        private HttpClient _httpClient;
        private float _pollTimer;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(5);
        }

        private void Start()
        {
            DetectLocalGpu();
            _ = PollRiggingMetricsAsync();
        }

        private void Update()
        {
            _pollTimer += Time.unscaledDeltaTime;
            if (_pollTimer >= _metricsPollInterval)
            {
                _pollTimer = 0f;
                _ = PollRiggingMetricsAsync();
            }
        }

        private void OnDestroy()
        {
            _httpClient?.Dispose();
        }

        #endregion

        #region GPU Detection

        /// <summary>Detect local GPU capabilities via Unity SystemInfo.</summary>
        public void DetectLocalGpu()
        {
            string deviceName = SystemInfo.graphicsDeviceName;
            string provider = DetectProvider();

            IsDirectMLAvailable = provider == "directml";
            IsCudaAvailable = provider == "cuda" || SystemInfo.graphicsDeviceVendor.Contains("NVIDIA");

            LocalGpuInfo = new GpuInfo
            {
                deviceName = deviceName,
                provider = provider,
                gpuAvailable = SystemInfo.graphicsDeviceType != UnityEngine.Rendering.GraphicsDeviceType.Null,
                memoryTotalMb = (long)(SystemInfo.graphicsMemorySize / (1024f * 1024f)), // in MB
                memoryUsedMb = 0, // Unity doesn't expose current VRAM usage
                utilizationPct = 0f,
                inferenceCount = 0,
                avgInferenceMs = 0f,
            };

            OnGpuInfoUpdated?.Invoke(LocalGpuInfo);

            if (_logGpuInfo)
                Debug.Log($"[GpuDetector] GPU: {deviceName} | Provider: {provider} | " +
                          $"VRAM: {LocalGpuInfo.memoryTotalMb}MB | " +
                          $"DML: {IsDirectMLAvailable} | CUDA: {IsCudaAvailable}");
        }

        private string DetectProvider()
        {
            var api = SystemInfo.graphicsDeviceType;

            // Check for DirectML availability via ONNX Runtime detection
            // Unity's SystemInfo doesn't directly expose ONNX providers,
            // but we can infer from API + OS
#if UNITY_STANDALONE_WIN
            // On Windows, DirectML is available via ONNX Runtime DirectML package
            // Check if we're on a DirectX 12 capable GPU
            if (api == UnityEngine.Rendering.GraphicsDeviceType.Direct3D12 ||
                api == UnityEngine.Rendering.GraphicsDeviceType.Direct3D11)
            {
                // DirectML compatible — available via onnxruntime-directml
                return "directml";
            }
#endif

#if UNITY_STANDALONE_LINUX || UNITY_STANDALONE_WIN
            if (SystemInfo.graphicsDeviceVendor.Contains("NVIDIA"))
                return "cuda";
#endif

            if (api == UnityEngine.Rendering.GraphicsDeviceType.Vulkan)
                return "vulkan";

            if (api == UnityEngine.Rendering.GraphicsDeviceType.Metal)
                return "metal";

            return "cpu";
        }

        #endregion

        #region Rigging Metrics Polling

        /// <summary>Poll the rigging service /api/metrics for backend GPU stats.</summary>
        public async Task PollRiggingMetricsAsync()
        {
            try
            {
                string url = $"{_riggingServiceUrl}/api/metrics";
                var resp = await _httpClient.GetAsync(url);

                if (resp.IsSuccessStatusCode)
                {
                    string text = await resp.Content.ReadAsStringAsync();
                    var metrics = ParsePrometheusMetrics(text);
                    RiggingGpuInfo = metrics;
                    OnRiggingMetricsUpdated?.Invoke(metrics);
                }
                else
                {
                    // Rigging service unreachable — clear metrics
                    RiggingGpuInfo = new GpuInfo { deviceName = "unreachable", provider = "none" };
                }
            }
            catch (Exception ex)
            {
                // Service not running — expected in offline mode, log once
                Debug.Log($"[GpuDetector] Rigging GPU metrics unavailable: {ex.Message}");
            }
        }

        /// <summary>Parse Prometheus text format into GpuInfo.</summary>
        private static GpuInfo ParsePrometheusMetrics(string text)
        {
            var info = new GpuInfo();

            foreach (string line in text.Split('\n'))
            {
                if (line.StartsWith("#")) continue; // skip comments

                if (line.StartsWith("rigging_gpu_available "))
                    info.gpuAvailable = ParseValue(line) > 0;

                if (line.StartsWith("rigging_gpu_memory_used_mb "))
                    info.memoryUsedMb = (long)ParseValue(line);

                if (line.StartsWith("rigging_gpu_memory_total_mb "))
                    info.memoryTotalMb = (long)ParseValue(line);

                if (line.StartsWith("rigging_gpu_utilization_pct "))
                    info.utilizationPct = ParseValue(line);

                if (line.StartsWith("rigging_inference_count_total "))
                    info.inferenceCount = (int)ParseValue(line);

                if (line.StartsWith("rigging_inference_duration_ms_avg "))
                    info.avgInferenceMs = ParseValue(line);

                if (line.StartsWith("rigging_provider_info{"))
                {
                    int start = line.IndexOf("provider=\"") + 10;
                    int end = line.IndexOf("\"", start);
                    if (start > 9 && end > start)
                        info.provider = line.Substring(start, end - start);
                }
            }

            if (string.IsNullOrEmpty(info.deviceName))
                info.deviceName = $"Rigging Service ({info.provider})";

            return info;
        }

        private static float ParseValue(string line)
        {
            int lastSpace = line.LastIndexOf(' ');
            if (lastSpace >= 0 && float.TryParse(line.Substring(lastSpace + 1),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out float val))
            {
                return val;
            }
            return 0f;
        }

        #endregion
    }
}
