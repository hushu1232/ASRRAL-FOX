using System;
using UnityEngine;

namespace AstralFox.Diagnostics
{
    /// <summary>
    /// Central diagnostic bus for structured error/warning/info reporting.
    ///
    /// Replaces scattered Debug.LogWarning/Error calls with a single event stream
    /// that UI, logging, and analytics can subscribe to.
    ///
    /// Usage:
    ///   DiagnosticBus.Report(Severity.Error, "BackendClient", "Connection failed: timeout");
    ///   DiagnosticBus.Report(Severity.Warning, "TTSPlayer", "Buffer underrun");
    /// </summary>
    public sealed class DiagnosticBus
    {
        #region Singleton

        private static DiagnosticBus _instance;
        public static DiagnosticBus Instance => _instance ??= new DiagnosticBus();

        private DiagnosticBus() { }

        #endregion

        #region Types

        public enum Severity
        {
            Info,
            Warning,
            Error,
            Fatal,
        }

        #endregion

        #region Events

        /// <summary>Fired for every diagnostic event. Subscribe from UI/logging/analytics.</summary>
        public event Action<Severity, string, string> OnDiagnostic;

        #endregion

        #region Public API

        /// <summary>Report a diagnostic event. Thread-safe.</summary>
        public static void Report(Severity severity, string source, string message)
        {
            // Always log to Unity console
            switch (severity)
            {
                case Severity.Info:
                    Debug.Log($"[{source}] {message}");
                    break;
                case Severity.Warning:
                    Debug.LogWarning($"[{source}] {message}");
                    break;
                case Severity.Error:
                case Severity.Fatal:
                    Debug.LogError($"[{source}] {message}");
                    break;
            }

            // Also fire event for subscribers (UI, etc.)
            Instance.OnDiagnostic?.Invoke(severity, source, message);
        }

        /// <summary>Convenience: info.</summary>
        public static void Info(string source, string message)
            => Report(Severity.Info, source, message);

        /// <summary>Convenience: warning.</summary>
        public static void Warn(string source, string message)
            => Report(Severity.Warning, source, message);

        /// <summary>Convenience: error.</summary>
        public static void Error(string source, string message)
            => Report(Severity.Error, source, message);

        #endregion
    }
}
