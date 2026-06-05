using System.Threading.Tasks;
using MCPForUnity.Editor.Constants;
using MCPForUnity.Editor.Helpers;
using MCPForUnity.Editor.Services;
using MCPForUnity.Editor.Services.Transport;
using MCPForUnity.Editor.Setup;
using MCPForUnity.Editor.Windows;
using UnityEditor;
using UnityEngine;

namespace MCPBootstrap.Editor
{
    [InitializeOnLoad]
    internal static class MCPForceConnect
    {
        private const string ForceConnectDoneKey = "MCPBootstrap.ForceConnectDone";

        static MCPForceConnect()
        {
            if (Application.isBatchMode) return;
            if (SessionState.GetBool(ForceConnectDoneKey, false)) return;
            SessionState.SetBool(ForceConnectDoneKey, true);

            EditorApplication.delayCall += async () =>
            {
                await Task.Delay(2000);
                await ForceConnectAsync();
            };
        }

        private static async Task ForceConnectAsync()
        {
            try
            {
                // Mark setup as completed so setup wizard doesn't block
                if (!EditorPrefs.GetBool(EditorPrefKeys.SetupCompleted, false))
                {
                    SetupWindowService.MarkSetupCompleted();
                    McpLog.Info("[MCPBootstrap] Setup marked as completed");
                }

                // Enable auto-start for future sessions
                EditorPrefs.SetBool(EditorPrefKeys.AutoStartOnLoad, true);

                // Ensure HTTP transport is enabled
                if (!EditorConfigurationCache.Instance.UseHttpTransport)
                {
                    EditorPrefs.SetBool(EditorPrefKeys.UseHttpTransport, true);
                }

                // Check if already running
                if (MCPServiceLocator.TransportManager.IsRunning(TransportMode.Http))
                {
                    McpLog.Info("[MCPBootstrap] HTTP bridge already running");
                    return;
                }

                // Start HTTP bridge (this connects to the MCP server)
                bool started = await MCPServiceLocator.TransportManager.StartAsync(TransportMode.Http);
                if (started)
                {
                    McpLog.Info("[MCPBootstrap] HTTP bridge started successfully");
                    MCPForUnityEditorWindow.RequestHealthVerification();
                }
                else
                {
                    var state = MCPServiceLocator.TransportManager.GetState(TransportMode.Http);
                    string error = string.IsNullOrWhiteSpace(state?.Error) ? "unknown" : state.Error;
                    McpLog.Warn($"[MCPBootstrap] Failed to start HTTP bridge: {error}");

                    // Retry once after a delay
                    await Task.Delay(3000);
                    started = await MCPServiceLocator.TransportManager.StartAsync(TransportMode.Http);
                    if (started)
                    {
                        McpLog.Info("[MCPBootstrap] HTTP bridge started on retry");
                    }
                    else
                    {
                        McpLog.Warn("[MCPBootstrap] HTTP bridge failed on retry too");
                    }
                }
            }
            catch (System.Exception ex)
            {
                McpLog.Error($"[MCPBootstrap] Error: {ex.Message}");
            }
        }
    }
}
