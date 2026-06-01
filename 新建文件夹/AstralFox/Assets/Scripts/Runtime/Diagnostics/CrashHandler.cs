using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// Global crash and exception logger for AstralFox.
    ///
    /// Initializes before the first scene via [RuntimeInitializeOnLoadMethod].
    /// Writes all exceptions/errors to a timestamped crash log on the desktop,
    /// making it easy for users to report issues.
    ///
    /// Also captures:
    ///   - Unhandled AppDomain exceptions (native crashes, GC finalizer errors)
    ///   - Unity log messages (Error and Exception level)
    ///   - System information snapshot at startup
    /// </summary>
    public static class CrashHandler
    {
        private static string _logPath;
        private static readonly StringBuilder _startupLog = new StringBuilder();
        private static bool _initialized;

        /// <summary>Path to the crash log file.</summary>
        public static string LogPath => _logPath;

        /// <summary>
        /// Called automatically before the first scene loads.
        /// Priority is set high so this runs before Bootstrapper.
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            if (_initialized) return;

            try
            {
                // Write to Desktop for easy user access
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                _logPath = Path.Combine(desktop, $"AstralFox_Crash_{DateTime.Now:yyyyMMdd_HHmmss}.log");

                LogStartup("=== AstralFox Crash Log ===");
                LogStartup($"Started: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
                LogStartup($"Version: {Application.version}");
                LogStartup($"Unity: {Application.unityVersion}");
                LogStartup($"Platform: {SystemInfo.operatingSystem}");
                LogStartup($"CPU: {SystemInfo.processorType} ({SystemInfo.processorCount} cores)");
                LogStartup($"RAM: {SystemInfo.systemMemorySize} MB");
                LogStartup($"GPU: {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsMemorySize} MB)");
                LogStartup($"Resolution: {Screen.currentResolution.width}x{Screen.currentResolution.height}");
                LogStartup("");

                // Hook Unity log messages
                Application.logMessageReceived += OnLogMessageReceived;

                // Hook unhandled AppDomain exceptions
                AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

                _initialized = true;
            }
            catch
            {
                // If we can't even create the log file, there's nothing we can do.
                // The app should still try to start.
            }
        }

        /// <summary>
        /// Log a startup milestone. These are buffered and flushed when the log file is ready.
        /// Use this from Bootstrapper and other early-init components.
        /// </summary>
        public static void LogStartup(string message)
        {
            string line = $"[{DateTime.Now:HH:mm:ss.fff}] [STARTUP] {message}";

            if (_logPath != null)
            {
                try
                {
                    File.AppendAllText(_logPath, line + Environment.NewLine);
                }
                catch { }
            }

            _startupLog.AppendLine(line);
            Debug.Log($"[CrashHandler] {message}");
        }

        public static void LogWarning(string message)
        {
            WriteLog("WARN", message, null);
            Debug.LogWarning($"[CrashHandler] {message}");
        }

        public static void LogError(string message, string stackTrace = null)
        {
            WriteLog("ERROR", message, stackTrace);
            Debug.LogError($"[CrashHandler] {message}");
        }

        private static void OnLogMessageReceived(string condition, string stackTrace, LogType type)
        {
            if (type == LogType.Exception || type == LogType.Error)
            {
                WriteLog(type == LogType.Exception ? "EXCEPTION" : "ERROR",
                        condition, stackTrace);
            }
            else if (type == LogType.Assert)
            {
                WriteLog("ASSERT", condition, stackTrace);
            }
        }

        private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            var ex = e.ExceptionObject as Exception;
            string message = ex?.ToString() ?? e.ExceptionObject?.ToString() ?? "Unknown native exception";

            WriteLog("FATAL", message, ex?.StackTrace);

            // Also write a more prominent marker
            try
            {
                File.AppendAllText(_logPath,
                    Environment.NewLine +
                    "======================================================" + Environment.NewLine +
                    "  FATAL UNHANDLED EXCEPTION — Application Will Close" + Environment.NewLine +
                    "======================================================" + Environment.NewLine +
                    Environment.NewLine);
            }
            catch { }
        }

        private static void WriteLog(string level, string message, string stackTrace)
        {
            if (_logPath == null) return;

            try
            {
                var sb = new StringBuilder();
                sb.Append($"[{DateTime.Now:HH:mm:ss.fff}] [{level}] {message}");
                if (!string.IsNullOrEmpty(stackTrace))
                {
                    sb.AppendLine();
                    sb.Append(stackTrace);
                }
                sb.AppendLine();

                File.AppendAllText(_logPath, sb.ToString());
            }
            catch
            {
                // Logging must never throw
            }
        }
    }
}
