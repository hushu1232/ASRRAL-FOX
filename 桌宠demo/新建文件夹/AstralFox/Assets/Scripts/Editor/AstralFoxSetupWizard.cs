using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace AstralFox.Editor
{
    /// <summary>
    /// One-click setup wizard for the AstralFox data-driven behavior refactoring.
    ///
    /// Steps performed in order:
    ///   1. Connect MCP bridge (if MCPForUnity package is installed)
    ///   2. Generate 12 IdleBehaviorDef .asset files from legacy hardcoded parameters
    ///   3. Report status
    ///
    /// Usage: Tools → AstralFox → Run Setup Wizard
    /// </summary>
    public static class AstralFoxSetupWizard
    {
        [MenuItem("Tools/AstralFox/Run Setup Wizard (MCP + IdleBehaviors)")]
        public static async void Run()
        {
            EditorUtility.DisplayProgressBar("AstralFox Setup", "Starting...", 0f);
            try
            {
                // ── Step 1: Try to connect MCP ──────────────────
                EditorUtility.DisplayProgressBar("AstralFox Setup", "Step 1/3: Connecting MCP bridge...", 0.1f);
                bool mcpOk = await TryConnectMcpAsync();

                // ── Step 2: Generate IdleBehavior assets ────────
                EditorUtility.DisplayProgressBar("AstralFox Setup", "Step 2/3: Generating IdleBehavior assets...", 0.4f);
                IdleBehaviorGenerator.GenerateAll();
                AssetDatabase.Refresh();

                // ── Step 3: Final report ─────────────────────────
                EditorUtility.DisplayProgressBar("AstralFox Setup", "Step 3/3: Finalizing...", 0.9f);
                await Task.Delay(500);

                EditorUtility.ClearProgressBar();
                string report = BuildReport(mcpOk);
                EditorUtility.DisplayDialog("AstralFox Setup Complete", report, "OK");
                Debug.Log($"[AstralFoxSetup] {report}");
            }
            catch (System.Exception ex)
            {
                EditorUtility.ClearProgressBar();
                Debug.LogError($"[AstralFoxSetup] Failed: {ex.Message}\n{ex.StackTrace}");
                EditorUtility.DisplayDialog("AstralFox Setup Failed",
                    $"Error: {ex.Message}\n\nCheck Console for details.", "OK");
            }
        }

        [MenuItem("Tools/AstralFox/Connect MCP Bridge Only")]
        public static async void ConnectMcp()
        {
            bool ok = await TryConnectMcpAsync();
            EditorUtility.DisplayDialog(
                ok ? "MCP Connected" : "MCP Connection Failed",
                ok ? "MCP bridge started successfully." : "MCP bridge could not start. Is the Python server running on port 8080?",
                "OK");
        }

        private static async Task<bool> TryConnectMcpAsync()
        {
            try
            {
                // Dynamically access MCPForUnity via reflection (avoid hard dependency)
                var transportType = System.Type.GetType(
                    "MCPForUnity.Editor.Services.MCPServiceLocator, MCPForUnity.Editor");
                var transportModeType = System.Type.GetType(
                    "MCPForUnity.Editor.Services.Transport.TransportMode, MCPForUnity.Editor");

                if (transportType == null || transportModeType == null)
                {
                    Debug.LogWarning("[AstralFoxSetup] MCPForUnity package not found. Skipping MCP connection.");
                    return false;
                }

                var transportManagerProp = transportType.GetProperty("TransportManager",
                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                if (transportManagerProp == null)
                {
                    Debug.LogWarning("[AstralFoxSetup] TransportManager property not found.");
                    return false;
                }

                var manager = transportManagerProp.GetValue(null);
                var isRunningMethod = manager.GetType().GetMethod("IsRunning");
                var startAsyncMethod = manager.GetType().GetMethod("StartAsync");

                if (isRunningMethod == null || startAsyncMethod == null)
                {
                    Debug.LogWarning("[AstralFoxSetup] TransportManager methods not found.");
                    return false;
                }

                // Check if already running
                bool isRunning = (bool)isRunningMethod.Invoke(manager, new object[] { 1 }); // 1 = Http
                if (isRunning)
                {
                    Debug.Log("[AstralFoxSetup] MCP HTTP bridge already running.");
                    return true;
                }

                // Start HTTP bridge
                var task = (Task<bool>)startAsyncMethod.Invoke(manager, new object[] { 1 });
                bool started = await task;

                if (started)
                {
                    Debug.Log("[AstralFoxSetup] MCP HTTP bridge started successfully.");
                }
                else
                {
                    Debug.LogWarning("[AstralFoxSetup] Failed to start MCP HTTP bridge.");
                }

                return started;
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[AstralFoxSetup] MCP connection failed: {ex.Message}");
                return false;
            }
        }

        private static string BuildReport(bool mcpOk)
        {
            string dir = "Assets/Settings/IdleBehaviors";
            int assetCount = AssetDatabase.FindAssets("t:IdleBehaviorDef", new[] { dir }).Length;

            return $"Setup complete!\n\n" +
                   $"MCP Bridge: {(mcpOk ? "Connected ✓" : "Skipped (package not found)")}\n" +
                   $"IdleBehavior assets: {assetCount} generated in {dir}/\n\n" +
                   $"Next: Select the Fox GameObject and assign\n" +
                   $"IdleBehaviorDefs array in FoxAnimationController.";
        }
    }
}
