using System;
using System.Runtime.InteropServices;
using System.Threading;
using UnityEngine;
using AstralFox.Config;

namespace AstralFox.Platform
{
    /// <summary>
    /// Windows system tray icon for AstralFox.
    ///
    /// In Unity Editor: uses System.Windows.Forms.NotifyIcon (always available).
    /// In Standalone builds: uses Shell_NotifyIcon P/Invoke with a registered
    ///   window class for message handling.
    ///
    /// The tray icon is created from an embedded orange circle (32x32).
    /// For a polished look, replace CreateTrayIcon() with an .ico file load.
    ///
    /// Usage:
    ///   TrayIconManager.Instance.Initialize(showAction, settingsAction, exitAction);
    ///   TrayIconManager.Instance.Dispose(); // on app quit
    /// </summary>
    public sealed class TrayIconManager : IDisposable
    {
        #region Singleton

        private static TrayIconManager _instance;
        public static TrayIconManager Instance => _instance ?? (_instance = new TrayIconManager());

        private TrayIconManager() { }

        #endregion

        #region Public Types

        public bool IsSupported
        {
            get
            {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
                return true;
#else
                return false;
#endif
            }
        }

        #endregion

        #region Fields

        private Action _onShow;
        private Action _onSettings;
        private Action _onExit;
        private bool _initialized;
        private bool _disposed;

        #endregion

        #region Public API

        public void Initialize(Action onShow, Action onSettings, Action onExit)
        {
            if (_initialized || _disposed) return;

            _onShow = onShow;
            _onSettings = onSettings;
            _onExit = onExit;

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            InitializeNative();
#else
            Debug.LogWarning("[TrayIcon] System tray is only supported on Windows.");
#endif
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            DisposeNative();
#endif
        }

        #endregion

        #region Native Implementation

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN

        // ── Win32 Constants ────────────────────────────────────

        private const int WM_NOTIFYICON = 0x0400 + 101;
        private const int WM_DESTROY = 0x0002;
        private const int WM_LBUTTONDOWN = 0x0201;
        private const int WM_RBUTTONUP = 0x0205;
        private const int WM_RBUTTONDOWN = 0x0204;

        private const int NIM_ADD = 0;
        private const int NIM_DELETE = 2;
        private const int NIF_MESSAGE = 1;
        private const int NIF_ICON = 2;
        private const int NIF_TIP = 4;

        private const int WS_POPUP = unchecked((int)0x80000000);
        private const int WS_EX_TOOLWINDOW = 0x80;
        private const int HWND_MESSAGE = -3;

        private const uint MF_STRING = 0;
        private const uint MF_SEPARATOR = 0x800;
        private const int TPM_RIGHTBUTTON = 2;
        private const int TPM_RETURNCMD = 0x100;

        private const int MENU_SHOW = 1001;
        private const int MENU_SETTINGS = 1002;
        private const int MENU_EXIT = 1003;

        private const int CS_VREDRAW = 1;
        private const int CS_HREDRAW = 2;

        // ── Win32 Structs ──────────────────────────────────────

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct NOTIFYICONDATA
        {
            public int cbSize;
            public IntPtr hWnd;
            public int uID;
            public int uFlags;
            public int uCallbackMessage;
            public IntPtr hIcon;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
            public string szTip;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct WNDCLASSEX
        {
            public int cbSize;
            public int style;
            public IntPtr lpfnWndProc;
            public int cbClsExtra;
            public int cbWndExtra;
            public IntPtr hInstance;
            public IntPtr hIcon;
            public IntPtr hCursor;
            public IntPtr hbrBackground;
            public string lpszMenuName;
            public string lpszClassName;
            public IntPtr hIconSm;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int x; public int y; }

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

        private delegate IntPtr WndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        // ── Win32 Functions ────────────────────────────────────

        [DllImport("shell32.dll", SetLastError = true)]
        private static extern bool Shell_NotifyIcon(int dwMessage, ref NOTIFYICONDATA lpData);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr CreateWindowEx(
            int dwExStyle, string lpClassName, string lpWindowName,
            int dwStyle, int x, int y, int nWidth, int nHeight,
            IntPtr hWndParent, IntPtr hMenu, IntPtr hInstance, IntPtr lpParam);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool DestroyWindow(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr DefWindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern bool TranslateMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern ushort RegisterClassEx(ref WNDCLASSEX lpwcx);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterClass(string lpClassName, IntPtr hInstance);

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        // Menu
        [DllImport("user32.dll")]
        private static extern IntPtr CreatePopupMenu();
        [DllImport("user32.dll")]
        private static extern bool AppendMenu(IntPtr hMenu, uint uFlags, IntPtr uIDNewItem, string lpNewItem);
        [DllImport("user32.dll")]
        private static extern int TrackPopupMenuEx(IntPtr hMenu, uint uFlags, int x, int y, IntPtr hWnd, IntPtr lpTPMParams);
        [DllImport("user32.dll")]
        private static extern bool DestroyMenu(IntPtr hMenu);
        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        // Icon
        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr hIcon);
        [DllImport("user32.dll")]
        private static extern IntPtr CreateIconIndirect(ref ICONINFO piconinfo);
        [DllImport("gdi32.dll")]
        private static extern IntPtr CreateBitmap(int nWidth, int nHeight, uint cPlanes, uint cBitsPerPel, byte[] lpvBits);
        [DllImport("gdi32.dll")]
        private static extern bool DeleteObject(IntPtr hObject);

        [StructLayout(LayoutKind.Sequential)]
        private struct ICONINFO
        {
            public bool fIcon;
            public int xHotspot;
            public int yHotspot;
            public IntPtr hbmMask;
            public IntPtr hbmColor;
        }

        // ── Fields ─────────────────────────────────────────────

        private IntPtr _hwnd;
        private IntPtr _hIcon;
        private Thread _messageThread;
        private volatile bool _running;
        private string _windowClass;
        private WndProc _wndProcDelegate;

        // ── Init / Dispose ─────────────────────────────────────

        private void InitializeNative()
        {
            try
            {
                _hIcon = CreateSimpleIcon();
                _windowClass = $"AstralFoxTray_{Guid.NewGuid():N}";
                _wndProcDelegate = WindowProcHandler;
                _running = true;

                _messageThread = new Thread(MessagePumpThread)
                {
                    Name = "TrayIcon",
                    IsBackground = true
                };
                _messageThread.Start();

                // Wait for window creation
                for (int i = 0; i < 50 && _hwnd == IntPtr.Zero; i++)
                    Thread.Sleep(20);

                if (_hwnd != IntPtr.Zero)
                {
                    var nid = BuildNid();
                    if (Shell_NotifyIcon(NIM_ADD, ref nid))
                    {
                        _initialized = true;
                        Debug.Log("[TrayIcon] Ready.");
                    }
                    else
                    {
                        Debug.LogError($"[TrayIcon] NIM_ADD failed: {Marshal.GetLastWin32Error()}");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TrayIcon] Init error: {ex.Message}");
            }
        }

        private void DisposeNative()
        {
            if (!_initialized) return;
            _initialized = false;

            if (_hwnd != IntPtr.Zero)
            {
                var nid = BuildNid();
                Shell_NotifyIcon(NIM_DELETE, ref nid);
                PostMessage(_hwnd, WM_DESTROY, IntPtr.Zero, IntPtr.Zero);
            }

            _running = false;
            _messageThread?.Join(1500);

            if (_hIcon != IntPtr.Zero) { DestroyIcon(_hIcon); _hIcon = IntPtr.Zero; }

            Debug.Log("[TrayIcon] Disposed.");
        }

        // ── Message Pump ───────────────────────────────────────

        private void MessagePumpThread()
        {
            IntPtr module = GetModuleHandle(null);

            var wc = new WNDCLASSEX();
            wc.cbSize = Marshal.SizeOf(wc);
            wc.style = CS_VREDRAW | CS_HREDRAW;
            wc.lpfnWndProc = Marshal.GetFunctionPointerForDelegate(_wndProcDelegate);
            wc.hInstance = module;
            wc.hCursor = IntPtr.Zero;
            wc.hbrBackground = IntPtr.Zero;
            wc.lpszClassName = _windowClass;

            ushort atom = RegisterClassEx(ref wc);
            if (atom == 0)
            {
                Debug.LogError($"[TrayIcon] RegisterClassEx failed: {Marshal.GetLastWin32Error()}");
                return;
            }

            _hwnd = CreateWindowEx(
                WS_EX_TOOLWINDOW, _windowClass, "",
                WS_POPUP, 0, 0, 1, 1,
                new IntPtr(HWND_MESSAGE), IntPtr.Zero, module, IntPtr.Zero);

            if (_hwnd == IntPtr.Zero)
            {
                Debug.LogError($"[TrayIcon] CreateWindowEx failed: {Marshal.GetLastWin32Error()}");
                UnregisterClass(_windowClass, module);
                return;
            }

            MSG msg;
            while (_running)
            {
                int ret = GetMessage(out msg, IntPtr.Zero, 0, 0);
                if (ret <= 0) break;
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            DestroyWindow(_hwnd);
            _hwnd = IntPtr.Zero;
            UnregisterClass(_windowClass, module);
        }

        private IntPtr WindowProcHandler(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            if (msg == WM_NOTIFYICON)
            {
                int eventType = lParam.ToInt32() & 0xFFFF;
                if (eventType == WM_RBUTTONUP)
                {
                    ShowContextMenu();
                }
                else if (eventType == WM_LBUTTONDOWN)
                {
                    UnityMainThreadDispatcher.Enqueue(() => _onShow?.Invoke());
                }
            }
            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        // ── Context Menu ───────────────────────────────────────

        private void ShowContextMenu()
        {
            IntPtr menu = CreatePopupMenu();
            AppendMenu(menu, MF_STRING, new IntPtr(MENU_SHOW), "显示桌宠");
            AppendMenu(menu, MF_STRING, new IntPtr(MENU_SETTINGS), "系统设置");
            AppendMenu(menu, MF_SEPARATOR, IntPtr.Zero, null);
            AppendMenu(menu, MF_STRING, new IntPtr(MENU_EXIT), "退出");

            GetCursorPos(out POINT pt);
            SetForegroundWindow(_hwnd);

            int cmd = TrackPopupMenuEx(
                menu, TPM_RIGHTBUTTON | TPM_RETURNCMD,
                pt.x, pt.y, _hwnd, IntPtr.Zero);

            DestroyMenu(menu);

            switch (cmd)
            {
                case MENU_SHOW:
                    UnityMainThreadDispatcher.Enqueue(() => _onShow?.Invoke());
                    break;
                case MENU_SETTINGS:
                    UnityMainThreadDispatcher.Enqueue(() => _onSettings?.Invoke());
                    break;
                case MENU_EXIT:
                    UnityMainThreadDispatcher.Enqueue(() =>
                    {
                        _onExit?.Invoke();
                        Dispose();
                    });
                    break;
            }
        }

        // ── Tray Icon ──────────────────────────────────────────

        private NOTIFYICONDATA BuildNid()
        {
            return new NOTIFYICONDATA
            {
                cbSize = Marshal.SizeOf(typeof(NOTIFYICONDATA)),
                hWnd = _hwnd,
                uID = 1,
                uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP,
                uCallbackMessage = WM_NOTIFYICON,
                hIcon = _hIcon,
                szTip = "星尘 AstralFox"
            };
        }

        /// <summary>Create a simple orange fox-shaped icon (32x32 ARGB).</summary>
        private static IntPtr CreateSimpleIcon()
        {
            int w = 32, h = 32;
            byte[] colorBits = new byte[w * h * 4]; // BGRA
            byte[] maskBits = new byte[w * h / 8];   // 1bpp mask (all visible = 0)

            int cx = w / 2, cy = h / 2, r = 12;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int idx = (y * w + x) * 4;
                    float dx = x - cx, dy = y - cy;
                    float dist = (float)Math.Sqrt(dx * dx + dy * dy);
                    if (dist <= r)
                    {
                        float t = dist / r;
                        colorBits[idx + 0] = (byte)(50 + t * 30);    // B
                        colorBits[idx + 1] = (byte)(100 + t * 60);   // G
                        colorBits[idx + 2] = (byte)(255);             // R
                        colorBits[idx + 3] = 255;                     // A
                    }
                }
            }

            IntPtr hbmColor = CreateBitmap(w, h, 1, 32, colorBits);
            IntPtr hbmMask = CreateBitmap(w, h, 1, 1, maskBits);

            if (hbmColor == IntPtr.Zero)
                return IntPtr.Zero;

            var ii = new ICONINFO
            {
                fIcon = true,
                xHotspot = 0,
                yHotspot = 0,
                hbmColor = hbmColor,
                hbmMask = hbmMask,
            };

            IntPtr hIcon = CreateIconIndirect(ref ii);
            DeleteObject(hbmColor);
            if (hbmMask != IntPtr.Zero) DeleteObject(hbmMask);
            return hIcon;
        }

#endif
        #endregion
    }
}
