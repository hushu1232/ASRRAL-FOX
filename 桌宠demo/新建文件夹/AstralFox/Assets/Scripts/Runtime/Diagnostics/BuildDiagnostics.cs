using AstralFox.Platform;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// Attach to AstralFoxRoot (or any root GameObject).
    /// Outputs scene name, camera state, and window info on startup.
    /// In a build, this writes to a log file on the desktop.
    /// </summary>
    public sealed class BuildDiagnostics : MonoBehaviour
    {
        [SerializeField] private bool _enabled = true;

        private string _logPath;
        private System.Text.StringBuilder _sb = new System.Text.StringBuilder();

        private void Awake()
        {
            if (!_enabled) return;

            _logPath = System.IO.Path.Combine(
                System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop),
                "AstralFox_Diagnostic.log");

            Log("=== AstralFox Build Diagnostic ===");
            Log($"Time: {System.DateTime.Now}");
            Log($"Platform: {Application.platform}");
            Log($"Version: {Application.version}");
            Log($"PersistentPath: {Application.persistentDataPath}");
            Log("");

            // Scene info
            Log($"Active Scene: {SceneManager.GetActiveScene().name}");
            Log($"Scene Count: {SceneManager.sceneCount}");
            for (int i = 0; i < SceneManager.sceneCount; i++)
            {
                var s = SceneManager.GetSceneAt(i);
                Log($"  Scene[{i}]: {s.name} loaded={s.isLoaded}");
            }

            Log("");
            Log($"Root GameObjects: {gameObject.scene.GetRootGameObjects().Length}");
            foreach (var go in gameObject.scene.GetRootGameObjects())
            {
                Log($"  Root: '{go.name}' active={go.activeSelf} layer={go.layer}");
            }

            // Camera check (run after TransparentWindow finishes — 15 frames)
            StartCoroutine(DelayedCheck());
        }

        private System.Collections.IEnumerator DelayedCheck()
        {
            // TransparentWindow.InitWindowDelayed waits 10 frames + up to 3s.
            // We must wait longer to capture the real WindowHandle.
            for (int i = 0; i < 20; i++)
                yield return null;

            Log("");
            Log("--- Camera Check ---");
            var cams = FindObjectsOfType<Camera>();
            Log($"Camera count: {cams.Length}");
            foreach (var cam in cams)
            {
                Log($"  Camera: '{cam.name}' tag='{cam.tag}'");
                Log($"    ClearFlags: {cam.clearFlags}");
                Log($"    Background: {cam.backgroundColor}");
                Log($"    Orthographic: {cam.orthographic} size={cam.orthographicSize}");
                Log($"    Active: {cam.gameObject.activeSelf} enabled={cam.enabled}");
            }

            // TransparentWindow check
            Log("");
            Log("--- TransparentWindow Check ---");
            var tw = FindObjectOfType<TransparentWindow>();
            if (tw != null)
            {
                Log($"  Found: {tw.name}");
                Log($"  Handle: 0x{tw.WindowHandle:X}");
                Log($"  IsTransparent: {tw.IsTransparent}");
                Log($"  Chroma: {tw.ChromaKeyColor}");
            }
            else
            {
                Log("  NOT FOUND in scene!");
            }

            // FoxInteraction check
            Log("");
            Log("--- FoxInteraction Check ---");
            var fi = FindObjectOfType<FoxInteraction>();
            Log(fi != null
                ? $"  Found: {fi.name} enabled={fi.enabled}"
                : "  NOT FOUND in scene!");

            // Renderer check
            Log("");
            Log("--- Renderers ---");
            var renderers = FindObjectsOfType<Renderer>();
            Log($"Renderer count: {renderers.Length}");
            foreach (var r in renderers)
            {
                Log($"  {r.name}: enabled={r.enabled} visible={r.isVisible} mat={r.sharedMaterial?.name ?? "null"}");
            }

            // Any errors
            Log("");
            Log("--- Last N Logs ---");
            // Read last 20 Unity log lines from Player.log
            try
            {
                string playerLog = System.IO.Path.Combine(
                    Application.persistentDataPath, "Player.log");
                if (System.IO.File.Exists(playerLog))
                {
                    var lines = System.IO.File.ReadAllLines(playerLog);
                    int start = Mathf.Max(0, lines.Length - 50);
                    for (int i = start; i < lines.Length; i++)
                        Log($"  [UnityLog] {lines[i]}");
                }
            }
            catch { }

            FlushLog();
        }

        private void Log(string msg)
        {
            _sb.AppendLine(msg);
            Debug.Log($"[BuildDiag] {msg}");
        }

        private void FlushLog()
        {
            _sb.AppendLine("=== End Diagnostic ===");
            try
            {
                System.IO.File.WriteAllText(_logPath, _sb.ToString());
                Debug.Log($"[BuildDiag] Diagnostic log written to: {_logPath}");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[BuildDiag] Cannot write log: {e.Message}");
            }
        }
    }
}
