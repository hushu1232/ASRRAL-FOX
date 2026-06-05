using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Windows global hotkey registration via RegisterHotKey.
    /// Captures hotkeys even when the app window is not focused.
    ///
    /// Default: Ctrl+Alt+S → open settings, Ctrl+Alt+F → show/hide pet
    /// </summary>
    public sealed class GlobalHotkeyManager : IDisposable
    {
        #region Singleton

        private static GlobalHotkeyManager _instance;
        public static GlobalHotkeyManager Instance => _instance ?? (_instance = new GlobalHotkeyManager());

        private GlobalHotkeyManager() { }

        #endregion

        #region Win32

        private const int MOD_ALT = 0x0001;
        private const int MOD_CONTROL = 0x0002;
        private const int MOD_SHIFT = 0x0004;
        private const int WM_HOTKEY = 0x0312;
        private const int HWND_BROADCAST = 0xFFFF;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        #endregion

        #region Types

        public enum HotkeyId
        {
            Settings = 9001,  // Ctrl+Alt+S
            TogglePet = 9002, // Ctrl+Alt+F
        }

        #endregion

        #region Fields

        private IntPtr _windowHandle;
        private bool _registered;
        private Action _onSettingsHotkey;
        private Action _onTogglePetHotkey;

        #endregion

        #region Public API

        public void Register(Action onSettings, Action onTogglePet)
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            _onSettingsHotkey = onSettings;
            _onTogglePetHotkey = onTogglePet;

            _windowHandle = GetUnityWindowHandle();
            if (_windowHandle == IntPtr.Zero)
            {
                Debug.LogWarning("[Hotkey] Cannot get window handle. Global hotkeys disabled.");
                return;
            }

            bool ok1 = RegisterHotKey(_windowHandle, (int)HotkeyId.Settings,
                MOD_CONTROL | MOD_ALT, (int)UnityEngine.KeyCode.S);
            bool ok2 = RegisterHotKey(_windowHandle, (int)HotkeyId.TogglePet,
                MOD_CONTROL | MOD_ALT, (int)UnityEngine.KeyCode.F);

            if (ok1 && ok2)
            {
                _registered = true;
                Debug.Log("[Hotkey] Registered: Ctrl+Alt+S (settings), Ctrl+Alt+F (toggle pet)");
            }
            else
            {
                Debug.LogWarning($"[Hotkey] RegisterHotKey failed: {Marshal.GetLastWin32Error()}");
            }
#else
            Debug.Log("[Hotkey] Global hotkeys only supported on Windows.");
#endif
        }

        public void Dispose()
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            if (!_registered) return;
            if (_windowHandle != IntPtr.Zero)
            {
                UnregisterHotKey(_windowHandle, (int)HotkeyId.Settings);
                UnregisterHotKey(_windowHandle, (int)HotkeyId.TogglePet);
            }
            _registered = false;
#endif
        }

        #endregion

        #region Message Pump Hook

        private IntPtr GetUnityWindowHandle()
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            // Unity's main window: find by process
            var proc = System.Diagnostics.Process.GetCurrentProcess();
            return proc.MainWindowHandle;
#else
            return IntPtr.Zero;
#endif
        }

        /// <summary>
        /// Called from MonoBehaviour.Update to poll for hotkey messages.
        /// Unity doesn't expose native WndProc, so we poll via Win32 PeekMessage.
        /// </summary>
        public void Poll()
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            if (!_registered || _windowHandle == IntPtr.Zero) return;

            MSG msg;
            while (PeekMessage(out msg, _windowHandle, WM_HOTKEY, WM_HOTKEY, 1)) // PM_REMOVE
            {
                int id = msg.wParam.ToInt32();
                switch ((HotkeyId)id)
                {
                    case HotkeyId.Settings:
                        _onSettingsHotkey?.Invoke();
                        Debug.Log("[Hotkey] Ctrl+Alt+S → Settings");
                        break;
                    case HotkeyId.TogglePet:
                        _onTogglePetHotkey?.Invoke();
                        Debug.Log("[Hotkey] Ctrl+Alt+F → Toggle Pet");
                        break;
                }
            }
#endif
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public POINT pt;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int x; public int y; }

        [DllImport("user32.dll")]
        private static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd,
            uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);

        #endregion
    }
}
