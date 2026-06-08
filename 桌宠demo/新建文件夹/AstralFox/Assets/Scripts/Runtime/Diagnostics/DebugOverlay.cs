using UnityEngine;
using UnityEngine.Rendering;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// Diagnostic overlay showing system info, GPU metrics, and AI pipeline status.
    /// Attach to Main Camera. Toggle with F3 key. Remove after diagnosis.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class DebugOverlay : MonoBehaviour
    {
        [SerializeField] private bool _showDebugMarkers = true;
        [SerializeField] private bool _showGpuMetrics = true;
        [SerializeField] private Color _debugBgColor = new Color(0.8f, 0.1f, 0.1f, 1f);

        private Color _originalBg;
        private Camera _cam;
        private GameObject _debugCube;
        private bool _overlayVisible = true;
        private GpuDetector _gpuDetector;
        private AstralFox.Voice.VoiceManager _voiceManager;
        private AstralFox.Voice.AIManager _aiManager;  // cached for OnGUI
        private GUIStyle _labelStyle;
        private GUIStyle _boxStyle;
        private System.Text.StringBuilder _sysInfoSb = new System.Text.StringBuilder();  // cached
        private System.Text.StringBuilder _pipelineInfoSb = new System.Text.StringBuilder();

        private void Start()
        {
            _cam = GetComponent<Camera>();
            if (_cam != null)
            {
                _originalBg = _cam.backgroundColor;
                _cam.backgroundColor = _debugBgColor;
            }

            if (_showDebugMarkers)
                CreateDebugCube();

            _gpuDetector = FindObjectOfType<GpuDetector>();
            _voiceManager = FindObjectOfType<AstralFox.Voice.VoiceManager>();
            _aiManager = FindObjectOfType<AstralFox.Voice.AIManager>();

            Debug.Log("[DebugOverlay] Press F3 to toggle diagnostic overlay.");
        }

        private void CreateDebugCube()
        {
            _debugCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _debugCube.name = "DEBUG_RedCube";
            _debugCube.transform.position = new Vector3(3f, 2f, 0f);
            _debugCube.transform.localScale = new Vector3(0.5f, 0.5f, 0.5f);

            var mr = _debugCube.GetComponent<MeshRenderer>();
            mr.material.color = new Color(1f, 0.2f, 0.2f, 1f);
            mr.material.renderQueue = 4000;

            Debug.Log("[DebugOverlay] Camera bg set to red. Small red cube at (3, 2, 0).");
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.F3))
                _overlayVisible = !_overlayVisible;
        }

        private void OnGUI()
        {
            if (!_overlayVisible) return;

            // Lazy-init styles
            if (_labelStyle == null)
            {
                _labelStyle = new GUIStyle(GUI.skin.label);
                _labelStyle.fontSize = 14;
                _labelStyle.normal.textColor = Color.white;
                _boxStyle = new GUIStyle(GUI.skin.box);
                _boxStyle.fontSize = 14;
                _boxStyle.normal.textColor = Color.white;
                _boxStyle.padding = new RectOffset(8, 8, 4, 4);
            }

            // Left panel: System & GPU
            DrawSystemPanel();

            // Right panel: AI Pipeline
            if (_voiceManager != null)
                DrawPipelinePanel();

            // Center: Diagnostic mode indicator
            GUI.color = Color.yellow;
            GUI.Label(new Rect(10, 10, 400, 25), "[DIAGNOSTIC MODE — F3 to toggle]");
            GUI.color = Color.white;
        }

        private void DrawSystemPanel()
        {
            float y = 60f;
            float x = 10f;
            float width = 380f;

            var sysInfo = _sysInfoSb;
            sysInfo.Clear();
            sysInfo.AppendLine("=== SYSTEM ===");
            sysInfo.AppendLine($"GPU: {SystemInfo.graphicsDeviceName}");
            sysInfo.AppendLine($"API: {SystemInfo.graphicsDeviceType}");
            sysInfo.AppendLine($"VRAM: {SystemInfo.graphicsMemorySize / (1024 * 1024)} MB");
            sysInfo.AppendLine($"RAM: {SystemInfo.systemMemorySize} MB");
            sysInfo.AppendLine($"CPU: {SystemInfo.processorCount} cores @ {SystemInfo.processorFrequency}MHz");

            if (_showGpuMetrics && _gpuDetector != null)
            {
                var gpu = _gpuDetector.LocalGpuInfo;
                sysInfo.AppendLine();
                sysInfo.AppendLine("=== LOCAL GPU ===");
                sysInfo.AppendLine($"Provider: {gpu.provider}");
                sysInfo.AppendLine($"DirectML: {(_gpuDetector.IsDirectMLAvailable ? "YES" : "no")}");
                sysInfo.AppendLine($"CUDA: {(_gpuDetector.IsCudaAvailable ? "YES" : "no")}");

                var rigging = _gpuDetector.RiggingGpuInfo;
                if (rigging.gpuAvailable)
                {
                    sysInfo.AppendLine();
                    sysInfo.AppendLine("=== RIGGING SERVICE GPU ===");
                    sysInfo.AppendLine($"Provider: {rigging.provider}");
                    sysInfo.AppendLine($"VRAM: {rigging.memoryUsedMb}/{rigging.memoryTotalMb} MB");
                    sysInfo.AppendLine($"Util: {rigging.utilizationPct:F1}%");
                    sysInfo.AppendLine($"Inferences: {rigging.inferenceCount}");
                    sysInfo.AppendLine($"Avg Latency: {rigging.avgInferenceMs:F1}ms");
                }
                else if (!string.IsNullOrEmpty(rigging.provider))
                {
                    sysInfo.AppendLine();
                    sysInfo.AppendLine("=== RIGGING SERVICE ===");
                    sysInfo.AppendLine($"Status: {rigging.deviceName}");
                }
            }

            float height = 50f + 20f * (sysInfo.ToString().Split('\n').Length);
            GUI.Box(new Rect(x, y, width, height), sysInfo.ToString(), _boxStyle);
        }

        private void DrawPipelinePanel()
        {
            float y = 60f;
            float x = Screen.width - 310f;
            float width = 300f;

            var info = _pipelineInfoSb;
            info.Clear();
            info.AppendLine("=== AI PIPELINE ===");
            info.AppendLine($"Voice State: {_voiceManager.CurrentState}");

            if (_aiManager != null)
            {
                info.AppendLine($"Pipeline Stage: {_aiManager.CurrentStage}");
                info.AppendLine($"ASR: {StatusLabel(_aiManager.CurrentStatus.asr)}");
                info.AppendLine($"LLM: {StatusLabel(_aiManager.CurrentStatus.llm)}");
                info.AppendLine($"TTS: {StatusLabel(_aiManager.CurrentStatus.tts)}");
                info.AppendLine($"Offline: {(_aiManager.IsFullyOffline ? "YES" : "no")}");
                if (!string.IsNullOrEmpty(_aiManager.CurrentStatus.message))
                    info.AppendLine($"Msg: {_aiManager.CurrentStatus.message}");
            }

            float height = 30f + 20f * (info.ToString().Split('\n').Length);
            GUI.Box(new Rect(x, y, width, height), info.ToString(), _boxStyle);
        }

        private string StatusLabel(AstralFox.Voice.AIManager.ServiceTier tier)
        {
            return tier switch
            {
                AstralFox.Voice.AIManager.ServiceTier.Ready => "Ready",
                AstralFox.Voice.AIManager.ServiceTier.Degraded => "Degraded",
                AstralFox.Voice.AIManager.ServiceTier.Initializing => "Init...",
                _ => "Unavailable",
            };
        }

        private void OnDestroy()
        {
            if (_cam != null)
                _cam.backgroundColor = _originalBg;
            if (_debugCube != null)
                Destroy(_debugCube);
        }
    }
}
