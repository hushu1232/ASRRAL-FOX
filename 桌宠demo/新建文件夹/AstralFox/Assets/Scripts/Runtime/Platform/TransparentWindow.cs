using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace AstralFox.Platform
{
    /// <summary>
    /// Manages the Windows transparent, borderless, always-on-top desktop window.
    /// Uses per-pixel alpha via UpdateLayeredWindow on a separate overlay window
    /// for reliable transparency across Unity versions.
    /// Win32 declarations live in NativeWindowInterop.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class TransparentWindow : MonoBehaviour
    {
        #region Win32 — Overlay WndProc

        private static NativeWindowInterop.WndProcDelegate _wndProc;
        private static TransparentWindow _instance;

        private static IntPtr OverlayWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            if (_instance != null && _instance.WindowHandle != IntPtr.Zero)
            {
                if (msg == NativeWindowInterop.WM_LBUTTONDOWN || msg == NativeWindowInterop.WM_LBUTTONUP ||
                    msg == NativeWindowInterop.WM_RBUTTONDOWN || msg == NativeWindowInterop.WM_RBUTTONUP ||
                    msg == NativeWindowInterop.WM_MOUSEMOVE)
                {
                    NativeWindowInterop.PostMessage(_instance.WindowHandle, msg, wParam, lParam);
                }
            }

            return NativeWindowInterop.DefWindowProc(hWnd, msg, wParam, lParam);
        }

        #endregion

        #region Inspector

        [Header("Window Size")]
        [SerializeField, Range(200, 2000)]
        private int _windowWidth = 1400;
        [SerializeField, Range(200, 2000)]
        private int _windowHeight = 1800;

        [Header("Chroma Key")]
        [SerializeField]
        private Color _chromaKeyColor = new Color(0f, 1f, 0f, 1f); // Green — less overlap with model colors

        [SerializeField, Range(0, 255)]
        private int _chromaKeyTolerance = 80;

        [Header("Initial Position")]
        [SerializeField]
        private WindowStartPosition _startPosition = WindowStartPosition.BottomRight;

        [Header("Debug")]
        [SerializeField]
        private bool _showDebugInfo = false;

        [Header("Disable Transparency (for testing)")]
        [SerializeField]
        private bool _disableTransparency = false;

        [Header("Per-Pixel Alpha (UpdateLayeredWindow)")]
        [SerializeField]
        private bool _usePerPixelAlpha = false;

        // Per-pixel alpha state
        private IntPtr _overlayHandle = IntPtr.Zero;
        private RenderTexture _renderTex;
        private Material _chromaKeyMat;    // GPU chroma key material (fallback: CPU loop)
        private Texture2D _readTex;
        private IntPtr _screenDC;
        private IntPtr _memDC;
        private IntPtr _hBitmap;
        private IntPtr _oldBitmap;
        private IntPtr _bitmapBits;
        private bool _ppAlphaReady;
        private bool _useGpuChromaKey = true; // auto-detected: true if URP ChromaKeyRenderFeature is active
        private byte[] _pixelBuffer;

        private static string _overlayClassName;

        private static string _diagLogPath;
        private static void DiagLog(string msg)
        {
            Debug.Log(msg);
            if (_diagLogPath != null)
            {
                try { System.IO.File.AppendAllText(_diagLogPath, $"{System.DateTime.Now:HH:mm:ss.fff} {msg}\n"); }
                catch { }
            }
        }

        public enum WindowStartPosition
        {
            BottomRight,
            BottomLeft,
            TopRight,
            TopLeft,
            Center,
            Custom
        }

        [SerializeField]
        private Vector2Int _customPosition = new Vector2Int(100, 100);

        #endregion

        #region Properties

        public IntPtr WindowHandle { get; private set; }
        private IntPtr ActiveHandle => _overlayHandle != IntPtr.Zero ? _overlayHandle : WindowHandle;
        public bool IsTransparent { get; private set; } = true;
        public Color ChromaKeyColor => _chromaKeyColor;
        public int WindowWidth => _windowWidth;
        public int WindowHeight => _windowHeight;

        public void DisableTransparency()
        {
            _disableTransparency = true;
            Debug.Log("[TransparentWindow] Transparency disabled via public API.");
        }

        public void SetWindowSize(int width, int height)
        {
            _windowWidth = width;
            _windowHeight = height;
            Debug.Log($"[TransparentWindow] Window size preset to {width}x{height}");
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            // Enforce singleton: destroy any OTHER TransparentWindow on this GameObject
            var all = GetComponents<TransparentWindow>();
            foreach (var tw in all)
            {
                if (tw != this)
                    Destroy(tw);
            }
        }

        private void Start()
        {
            StartCoroutine(InitWindowDelayed());
        }

        private System.Collections.IEnumerator InitWindowDelayed()
        {
            _diagLogPath = System.IO.Path.Combine(
                System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop),
                "AstralFox_OverlayDiag.log");
            DiagLog("=== Overlay Window Diagnostic ===");

            for (int i = 0; i < 10; i++)
                yield return null;

            int ourPid = System.Diagnostics.Process.GetCurrentProcess().Id;
            DiagLog($"[TransparentWindow] Looking for Unity window handle. PID={ourPid}");

            // --- Find Unity window handle ---
            IntPtr unityHandle = NativeWindowInterop.GetActiveWindow();
            if (unityHandle != IntPtr.Zero)
            {
                NativeWindowInterop.GetWindowThreadProcessId(unityHandle, out uint pid1);
                if (pid1 != ourPid) unityHandle = IntPtr.Zero;
            }
            if (unityHandle == IntPtr.Zero)
                unityHandle = NativeWindowInterop.FindWindow("UnityWndClass", null);
            if (unityHandle == IntPtr.Zero)
            {
                IntPtr found = IntPtr.Zero;
                NativeWindowInterop.EnumWindows((hWnd, lParam) => {
                    NativeWindowInterop.GetWindowThreadProcessId(hWnd, out uint pid);
                    if (pid != ourPid) return true;
                    if (NativeWindowInterop.GetWindow(hWnd, NativeWindowInterop.GW_OWNER) != IntPtr.Zero) return true;
                    if (!NativeWindowInterop.IsWindowVisible(hWnd)) return true;
                    found = hWnd;
                    return false;
                }, IntPtr.Zero);
                unityHandle = found;
            }
            if (unityHandle == IntPtr.Zero)
            {
                var proc = System.Diagnostics.Process.GetCurrentProcess();
                float deadline = Time.realtimeSinceStartup + 3f;
                while (proc.MainWindowHandle == IntPtr.Zero && Time.realtimeSinceStartup < deadline)
                {
                    proc.Refresh();
                    yield return null;
                }
                unityHandle = proc.MainWindowHandle;
            }

            WindowHandle = unityHandle;
            if (WindowHandle == IntPtr.Zero)
            {
                DiagLog("[TransparentWindow] ERROR: Cannot find Unity window handle.");
                yield break;
            }

            DiagLog($"[TransparentWindow] Unity window: 0x{WindowHandle:X}  Log file: {_diagLogPath}");

            SetDpiAwareness();

            if (_disableTransparency)
            {
                DiagLog("[TransparentWindow] _disableTransparency=true — normal window mode.");
                SetupNormalWindowStyle();
                PositionWindow();
                SetAlwaysOnTop();
                NativeWindowInterop.ShowWindow(WindowHandle, NativeWindowInterop.SW_SHOW);
                yield break;
            }

#if UNITY_EDITOR
            // In Editor Play Mode, never hide the Unity window or create an overlay.
            // The Game view must show the camera output directly for testing.
            DiagLog("[TransparentWindow] Editor mode — using normal window (no overlay).");
            SetupNormalWindowStyle();
            PositionWindow();
            SetAlwaysOnTop();
            NativeWindowInterop.ShowWindow(WindowHandle, NativeWindowInterop.SW_SHOW);
            yield break;
#else
            // --- Create overlay window ---
            DiagLog("[TransparentWindow] Creating overlay window...");
            if (!CreateOverlayWindow())
            {
                DiagLog($"[TransparentWindow] ERROR: CreateOverlayWindow failed. err={Marshal.GetLastWin32Error()}");
                yield break;
            }

            NativeWindowInterop.ShowWindow(WindowHandle, NativeWindowInterop.SW_HIDE);
            DiagLog("[TransparentWindow] Unity window hidden (SW_HIDE).");

            SetupPerPixelAlpha();

            DiagLog($"[TransparentWindow] Init complete. Overlay: 0x{_overlayHandle:X}, " +
                      $"Size: {_windowWidth}x{_windowHeight}, PPAlphaReady: {_ppAlphaReady}");
#endif
        }

        private bool CreateOverlayWindow()
        {
            if (_overlayClassName == null)
            {
                _wndProc = OverlayWndProc;
                _overlayClassName = $"AstralFoxOverlay_{System.Diagnostics.Process.GetCurrentProcess().Id}";
                var wc = new NativeWindowInterop.WNDCLASSEX
                {
                    cbSize = (uint)Marshal.SizeOf<NativeWindowInterop.WNDCLASSEX>(),
                    style = NativeWindowInterop.CS_VREDRAW | NativeWindowInterop.CS_HREDRAW,
                    lpfnWndProc = _wndProc,
                    hInstance = NativeWindowInterop.GetModuleHandle(null),
                    hCursor = IntPtr.Zero,
                    hbrBackground = IntPtr.Zero,
                    lpszClassName = _overlayClassName
                };
                ushort atom = NativeWindowInterop.RegisterClassEx(ref wc);
                if (atom == 0)
                {
                    int err = Marshal.GetLastWin32Error();
                    DiagLog($"[TransparentWindow] RegisterClassEx('{_overlayClassName}') FAILED: {err}");
                    return false;
                }
                DiagLog($"[TransparentWindow] Window class '{_overlayClassName}' registered (atom={atom}).");
            }

            CalcInitialPosition();

            uint exStyle = NativeWindowInterop.WS_EX_LAYERED | NativeWindowInterop.WS_EX_TOPMOST |
                           NativeWindowInterop.WS_EX_NOACTIVATE | NativeWindowInterop.WS_EX_TOOLWINDOW;
            _overlayHandle = NativeWindowInterop.CreateWindowEx(
                exStyle, _overlayClassName, "AstralFox",
                NativeWindowInterop.WS_POPUP | NativeWindowInterop.WS_VISIBLE,
                _initialX, _initialY, _windowWidth, _windowHeight,
                IntPtr.Zero, IntPtr.Zero, NativeWindowInterop.GetModuleHandle(null), IntPtr.Zero);

            if (_overlayHandle == IntPtr.Zero)
            {
                DiagLog($"[TransparentWindow] CreateWindowEx FAILED: {Marshal.GetLastWin32Error()}");
                return false;
            }

            _instance = this;

            DiagLog($"[TransparentWindow] Overlay window created: 0x{_overlayHandle:X} at ({_initialX},{_initialY}) size={_windowWidth}x{_windowHeight}");
            return true;
        }

        private void OnDestroy()
        {
            StopAllCoroutines();
            CleanupPerPixelAlpha();

            if (_overlayHandle != IntPtr.Zero)
            {
                NativeWindowInterop.DestroyWindow(_overlayHandle);
                _overlayHandle = IntPtr.Zero;
                Debug.Log("[TransparentWindow] Overlay window destroyed.");
            }

            if (_instance == this)
                _instance = null;

            if (WindowHandle != IntPtr.Zero)
            {
                NativeWindowInterop.ShowWindow(WindowHandle, NativeWindowInterop.SW_SHOW);
                RestoreWindowStyle();
            }
        }

        private void OnGUI()
        {
            if (_disableTransparency) return;
            if (!_showDebugInfo && WindowHandle == IntPtr.Zero) return;

            uint style = 0, exStyle = 0;
            if (WindowHandle != IntPtr.Zero)
            {
                style = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_STYLE);
                exStyle = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE);
            }

            GUI.color = Color.white;
            GUI.Label(new Rect(10, 10, 500, 160),
                $"[AstralFox] Unity: 0x{WindowHandle:X}  Overlay: 0x{_overlayHandle:X}\n" +
                $"PPAlpha: {_usePerPixelAlpha}  Ready: {_ppAlphaReady}\n" +
                $"Style: 0x{style:X8}  ExStyle: 0x{exStyle:X8}\n" +
                $"WS_EX_LAYERED: {(exStyle & NativeWindowInterop.WS_EX_LAYERED) != 0}  " +
                $"Disable: {_disableTransparency}\n" +
                $"Size: {_windowWidth}x{_windowHeight}");
        }

        #endregion

        #region Window Setup

        private void SetDpiAwareness()
        {
            try
            {
                int result = NativeWindowInterop.SetProcessDpiAwareness(2);
                if (result != 0)
                    NativeWindowInterop.SetProcessDPIAware();
            }
            catch
            {
                NativeWindowInterop.SetProcessDPIAware();
            }
        }

        private void SetupWindowStyle()
        {
            uint style = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_STYLE);
            style &= ~(NativeWindowInterop.WS_CAPTION | NativeWindowInterop.WS_SYSMENU |
                       NativeWindowInterop.WS_THICKFRAME | NativeWindowInterop.WS_MINIMIZEBOX |
                       NativeWindowInterop.WS_MAXIMIZEBOX);
            style |= NativeWindowInterop.WS_POPUP | NativeWindowInterop.WS_VISIBLE |
                     NativeWindowInterop.WS_CLIPCHILDREN | NativeWindowInterop.WS_CLIPSIBLINGS;
            NativeWindowInterop.SetWindowLongPtr(WindowHandle, NativeWindowInterop.GWL_STYLE, (IntPtr)style);

            uint exStyle = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE);
            exStyle |= NativeWindowInterop.WS_EX_LAYERED | NativeWindowInterop.WS_EX_TOPMOST |
                       NativeWindowInterop.WS_EX_NOACTIVATE;
            exStyle &= ~NativeWindowInterop.WS_EX_TOOLWINDOW;
            exStyle |= NativeWindowInterop.WS_EX_APPWINDOW;
            NativeWindowInterop.SetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE, exStyle);

            NativeWindowInterop.SetWindowPos(WindowHandle, IntPtr.Zero, 0, 0, 0, 0,
                NativeWindowInterop.SWP_NOMOVE | NativeWindowInterop.SWP_NOSIZE |
                NativeWindowInterop.SWP_NOACTIVATE | NativeWindowInterop.SWP_FRAMECHANGED);
        }

        private void SetupNormalWindowStyle()
        {
            uint style = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_STYLE);
            style &= ~(NativeWindowInterop.WS_CAPTION | NativeWindowInterop.WS_SYSMENU |
                       NativeWindowInterop.WS_THICKFRAME | NativeWindowInterop.WS_MINIMIZEBOX |
                       NativeWindowInterop.WS_MAXIMIZEBOX);
            style |= NativeWindowInterop.WS_POPUP | NativeWindowInterop.WS_VISIBLE |
                     NativeWindowInterop.WS_CLIPCHILDREN | NativeWindowInterop.WS_CLIPSIBLINGS;
            NativeWindowInterop.SetWindowLongPtr(WindowHandle, NativeWindowInterop.GWL_STYLE, (IntPtr)style);

            uint exStyle = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE);
            exStyle &= ~(NativeWindowInterop.WS_EX_LAYERED | NativeWindowInterop.WS_EX_TRANSPARENT);
            exStyle |= NativeWindowInterop.WS_EX_TOPMOST | NativeWindowInterop.WS_EX_NOACTIVATE;
            exStyle &= ~NativeWindowInterop.WS_EX_TOOLWINDOW;
            exStyle |= NativeWindowInterop.WS_EX_APPWINDOW;
            NativeWindowInterop.SetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE, exStyle);

            NativeWindowInterop.SetWindowPos(WindowHandle, IntPtr.Zero, 0, 0, 0, 0,
                NativeWindowInterop.SWP_NOMOVE | NativeWindowInterop.SWP_NOSIZE |
                NativeWindowInterop.SWP_NOACTIVATE | NativeWindowInterop.SWP_FRAMECHANGED);
        }

        private void RestoreWindowStyle()
        {
            if (WindowHandle == IntPtr.Zero) return;

            uint exStyle = NativeWindowInterop.GetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE);
            exStyle &= ~(NativeWindowInterop.WS_EX_LAYERED | NativeWindowInterop.WS_EX_TOPMOST |
                         NativeWindowInterop.WS_EX_TRANSPARENT | NativeWindowInterop.WS_EX_NOACTIVATE);
            exStyle |= NativeWindowInterop.WS_EX_APPWINDOW;
            NativeWindowInterop.SetWindowLong(WindowHandle, NativeWindowInterop.GWL_EXSTYLE, exStyle);

            NativeWindowInterop.SetLayeredWindowAttributes(WindowHandle, 0, 255, NativeWindowInterop.LWA_ALPHA);
        }

        #endregion

        #region Per-Pixel Alpha (UpdateLayeredWindow)

        private void SetupPerPixelAlpha()
        {
            _renderTex = new RenderTexture(_windowWidth, _windowHeight, 32, RenderTextureFormat.ARGB32);
            _renderTex.Create();

            var cam = Camera.main;
            if (cam != null)
            {
                cam.targetTexture = _renderTex;
                DiagLog($"[TransparentWindow] Camera '{cam.name}' renders to RenderTexture {_windowWidth}x{_windowHeight}");
            }
            else
            {
                DiagLog("[TransparentWindow] ERROR: No Camera.main! Cannot use per-pixel alpha.");
                return;
            }

            _readTex = new Texture2D(_windowWidth, _windowHeight, TextureFormat.BGRA32, false);

            // ── GPU chroma key material (auto-detected; falls back to CPU) ──
            var chromaShader = Shader.Find("Hidden/AstralFox/ChromaKey");
            if (chromaShader != null)
            {
                _chromaKeyMat = new Material(chromaShader);
                _chromaKeyMat.SetColor("_ChromaColor", _chromaKeyColor);
                _chromaKeyMat.SetFloat("_Tolerance", _chromaKeyTolerance / 255f * 1.5f);
                _chromaKeyMat.SetFloat("_Softness", 0.05f);
                _useGpuChromaKey = true;
                DiagLog("[TransparentWindow] GPU chroma key enabled.");
            }
            else
            {
                _useGpuChromaKey = false;
                DiagLog("[TransparentWindow] ChromaKey shader not found — CPU fallback.");
            }

            _screenDC = NativeWindowInterop.GetDC(IntPtr.Zero);
            _memDC = NativeWindowInterop.CreateCompatibleDC(_screenDC);
            if (_memDC == IntPtr.Zero)
            {
                DiagLog($"[TransparentWindow] CreateCompatibleDC FAILED: {Marshal.GetLastWin32Error()}");
                return;
            }

            var bmi = new NativeWindowInterop.BITMAPINFO();
            bmi.bmiHeader.biSize = (uint)Marshal.SizeOf<NativeWindowInterop.BITMAPINFOHEADER>();
            bmi.bmiHeader.biWidth = _windowWidth;
            bmi.bmiHeader.biHeight = _windowHeight;
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = 0;
            bmi.bmiHeader.biSizeImage = (uint)(_windowWidth * _windowHeight * 4);

            _hBitmap = NativeWindowInterop.CreateDIBSection(_memDC, ref bmi, NativeWindowInterop.DIB_RGB_COLORS,
                out _bitmapBits, IntPtr.Zero, 0);
            if (_hBitmap == IntPtr.Zero)
            {
                DiagLog($"[TransparentWindow] CreateDIBSection FAILED: {Marshal.GetLastWin32Error()}");
                return;
            }

            _oldBitmap = NativeWindowInterop.SelectObject(_memDC, _hBitmap);
            _pixelBuffer = new byte[_windowWidth * _windowHeight * 4];
            _ppAlphaReady = true;
            CalcInitialPosition();

            DiagLog($"[TransparentWindow] Per-pixel alpha initialized. " +
                      $"RT={_windowWidth}x{_windowHeight}, DIB=0x{_hBitmap:X}, " +
                      $"InitialPos=({_initialX},{_initialY})");

            StartCoroutine(PerPixelAlphaLoop());
        }

        private int _initialX, _initialY;
        private bool _firstFrame = true;
        private int _lastPosX, _lastPosY;

        private void CalcInitialPosition()
        {
            switch (_startPosition)
            {
                case WindowStartPosition.BottomRight:
                    (_initialX, _initialY) = GetBottomRightPosition(); break;
                case WindowStartPosition.BottomLeft:
                    (_initialX, _initialY) = GetBottomLeftPosition(); break;
                case WindowStartPosition.TopRight:
                    (_initialX, _initialY) = GetTopRightPosition(); break;
                case WindowStartPosition.TopLeft:
                    (_initialX, _initialY) = GetTopLeftPosition(); break;
                case WindowStartPosition.Center:
                    (_initialX, _initialY) = GetCenterPosition(); break;
                default:
                    _initialX = _customPosition.x; _initialY = _customPosition.y; break;
            }
        }

        private System.Collections.IEnumerator PerPixelAlphaLoop()
        {
            var waitForEndOfFrame = new WaitForEndOfFrame();
            int consecutiveErrors = 0;
            const int maxConsecutiveErrors = 30; // ~0.5s at 60fps — then give up

            while (_ppAlphaReady)
            {
                yield return waitForEndOfFrame;

                if (!_ppAlphaReady || _overlayHandle == IntPtr.Zero) break;

                // ── GPU chroma key pass (Blit through shader; sub-ms on GPU) ──
                if (_useGpuChromaKey && _chromaKeyMat != null)
                {
                    Graphics.Blit(_renderTex, _chromaKeyMat);
                }

                // ── GPU → CPU readback ──
                RenderTexture.active = _renderTex;
                _readTex.ReadPixels(new Rect(0, 0, _windowWidth, _windowHeight), 0, 0);
                _readTex.Apply();

                var colors = _readTex.GetRawTextureData<byte>();
                if (colors.Length < _pixelBuffer.Length)
                    continue;

                if (_useGpuChromaKey)
                {
                    // ── GPU path: shader already computed alpha → copy BGRA ──
                    colors.CopyTo(_pixelBuffer);
                }
                else
                {
                    // ── CPU path: BGRA chroma key loop (fallback) ──
                    byte ckR = (byte)(_chromaKeyColor.r * 255);
                    byte ckG = (byte)(_chromaKeyColor.g * 255);
                    byte ckB = (byte)(_chromaKeyColor.b * 255);

                    for (int i = 0; i < _pixelBuffer.Length; i += 4)
                    {
                        byte b = colors[i];
                        byte g = colors[i + 1];
                        byte r = colors[i + 2];
                        byte a = colors[i + 3];

                        if (IsChromaKey(r, g, b, ckR, ckG, ckB))
                        {
                            _pixelBuffer[i] = _pixelBuffer[i + 1] = _pixelBuffer[i + 2] = _pixelBuffer[i + 3] = 0;
                        }
                        else
                        {
                            _pixelBuffer[i] = b;
                            _pixelBuffer[i + 1] = g;
                            _pixelBuffer[i + 2] = r;
                            _pixelBuffer[i + 3] = a;
                        }
                    }
                }

                // ── Upload to DIB section → present via UpdateLayeredWindow ──
                Marshal.Copy(_pixelBuffer, 0, _bitmapBits, _pixelBuffer.Length);

                if (_firstFrame)
                {
                    _firstFrame = false;
                    _lastPosX = _initialX;
                    _lastPosY = _initialY;
                }

                var dstPos = new NativeWindowInterop.POINT { X = _lastPosX, Y = _lastPosY };
                var size = new NativeWindowInterop.SIZE { cx = _windowWidth, cy = _windowHeight };
                var srcPos = new NativeWindowInterop.POINT { X = 0, Y = 0 };
                var blend = new NativeWindowInterop.BLENDFUNCTION
                {
                    BlendOp = NativeWindowInterop.AC_SRC_OVER,
                    BlendFlags = 0,
                    SourceConstantAlpha = 255,
                    AlphaFormat = NativeWindowInterop.AC_SRC_ALPHA
                };

                bool ulwOk = NativeWindowInterop.UpdateLayeredWindow(
                    _overlayHandle, IntPtr.Zero,
                    ref dstPos, ref size, _memDC, ref srcPos,
                    0, ref blend, NativeWindowInterop.ULW_ALPHA);

                if (!ulwOk)
                {
                    consecutiveErrors++;
                    int err = Marshal.GetLastWin32Error();
                    DiagLog($"[TransparentWindow] UpdateLayeredWindow FAILED frame={Time.frameCount} err={err} consecutive={consecutiveErrors}");

                    if (consecutiveErrors >= maxConsecutiveErrors)
                    {
                        Debug.LogError("[TransparentWindow] UpdateLayeredWindow failed 30 consecutive frames. " +
                            "Disabling per-pixel alpha. Check GPU driver and DWM service.");
                        _ppAlphaReady = false;
                        break;
                    }
                }
                else
                {
                    consecutiveErrors = 0;
                    if (Time.frameCount <= 3)
                        DiagLog($"[TransparentWindow] UpdateLayeredWindow OK frame={Time.frameCount} pos=({_lastPosX},{_lastPosY})");
                }
            }

            Debug.Log("[TransparentWindow] Per-pixel alpha loop ended.");
        }

        private bool IsChromaKey(byte r, byte g, byte b, byte ckR, byte ckG, byte ckB)
        {
            int tolerance = _chromaKeyTolerance;
            if (tolerance <= 0)
                return r == ckR && g == ckG && b == ckB;
            int dr = r - ckR, dg = g - ckG, db = b - ckB;
            return (dr * dr + dg * dg + db * db) <= tolerance * tolerance;
        }

        /// <summary>
        /// Detects whether the URP ChromaKeyRenderFeature is active by sampling
        /// a few non-background pixels in the first frame's readback data.
        /// If model pixels have alpha > 0, URP already applied chroma key → GPU path.
        /// </summary>
        private void CleanupPerPixelAlpha()
        {
            _ppAlphaReady = false;

            if (_renderTex != null)
            {
                var cam = Camera.main;
                if (cam != null) cam.targetTexture = null;
                _renderTex.Release();
                Destroy(_renderTex);
                _renderTex = null;
            }
            if (_readTex != null) { Destroy(_readTex); _readTex = null; }
            if (_chromaKeyMat != null) { Destroy(_chromaKeyMat); _chromaKeyMat = null; }
            if (_oldBitmap != IntPtr.Zero) { NativeWindowInterop.SelectObject(_memDC, _oldBitmap); _oldBitmap = IntPtr.Zero; }
            if (_hBitmap != IntPtr.Zero) { NativeWindowInterop.DeleteObject(_hBitmap); _hBitmap = IntPtr.Zero; }
            if (_memDC != IntPtr.Zero) { NativeWindowInterop.DeleteDC(_memDC); _memDC = IntPtr.Zero; }
            if (_screenDC != IntPtr.Zero && WindowHandle != IntPtr.Zero) { NativeWindowInterop.ReleaseDC(IntPtr.Zero, _screenDC); _screenDC = IntPtr.Zero; }
        }

        #endregion

        #region Window Screen Rect

        public (int left, int top, int right, int bottom) GetWindowScreenRect()
        {
            NativeWindowInterop.GetWindowRect(ActiveHandle, out NativeWindowInterop.RECT rect);
            return (rect.Left, rect.Top, rect.Right, rect.Bottom);
        }

        public Vector2Int GetWindowScreenPosition()
        {
            NativeWindowInterop.GetWindowRect(ActiveHandle, out NativeWindowInterop.RECT rect);
            return new Vector2Int(rect.Left, rect.Top);
        }

        public Vector2Int GetClientSize()
        {
            NativeWindowInterop.GetClientRect(ActiveHandle, out NativeWindowInterop.RECT rect);
            return new Vector2Int(rect.Width, rect.Height);
        }

        #endregion

        #region Window Positioning

        private void PositionWindow()
        {
            int x, y;
            switch (_startPosition)
            {
                case WindowStartPosition.BottomRight: (x, y) = GetBottomRightPosition(); break;
                case WindowStartPosition.BottomLeft:  (x, y) = GetBottomLeftPosition(); break;
                case WindowStartPosition.TopRight:    (x, y) = GetTopRightPosition(); break;
                case WindowStartPosition.TopLeft:     (x, y) = GetTopLeftPosition(); break;
                case WindowStartPosition.Center:      (x, y) = GetCenterPosition(); break;
                default: x = _customPosition.x; y = _customPosition.y; break;
            }

            NativeWindowInterop.SetWindowPos(ActiveHandle, IntPtr.Zero,
                x, y, _windowWidth, _windowHeight,
                NativeWindowInterop.SWP_NOACTIVATE | NativeWindowInterop.SWP_SHOWWINDOW);
        }

        public void MoveWindow(int x, int y)
        {
            _lastPosX = x;
            _lastPosY = y;
#if UNITY_EDITOR
            // Editor mode: don't move the Unity IDE window. Drag position is tracked only.
#else
            NativeWindowInterop.SetWindowPos(ActiveHandle, NativeWindowInterop.HWND_TOPMOST,
                x, y, 0, 0,
                NativeWindowInterop.SWP_NOSIZE | NativeWindowInterop.SWP_NOACTIVATE);
#endif
        }

        public void MoveWindowDelta(int deltaX, int deltaY)
        {
            NativeWindowInterop.GetWindowRect(ActiveHandle, out NativeWindowInterop.RECT currentRect);
            _lastPosX = currentRect.Left + deltaX;
            _lastPosY = currentRect.Top + deltaY;
#if UNITY_EDITOR
            // Editor mode: don't move the Unity IDE window.
#else
            NativeWindowInterop.SetWindowPos(ActiveHandle, NativeWindowInterop.HWND_TOPMOST,
                _lastPosX, _lastPosY, 0, 0,
                NativeWindowInterop.SWP_NOSIZE | NativeWindowInterop.SWP_NOACTIVATE);
#endif
        }

        private (int x, int y) GetBottomRightPosition()
        {
            var workArea = GetWorkArea();
            const int margin = 20;
            return (workArea.Right - _windowWidth - margin,
                    workArea.Bottom - _windowHeight - margin);
        }

        private (int x, int y) GetBottomLeftPosition()
        {
            var workArea = GetWorkArea();
            const int margin = 20;
            return (workArea.Left + margin,
                    workArea.Bottom - _windowHeight - margin);
        }

        private (int x, int y) GetTopRightPosition()
        {
            var workArea = GetWorkArea();
            const int margin = 20;
            return (workArea.Right - _windowWidth - margin,
                    workArea.Top + margin);
        }

        private (int x, int y) GetTopLeftPosition()
        {
            var workArea = GetWorkArea();
            const int margin = 20;
            return (workArea.Left + margin, workArea.Top + margin);
        }

        private (int x, int y) GetCenterPosition()
        {
            var workArea = GetWorkArea();
            return (workArea.Left + (workArea.Right - workArea.Left - _windowWidth) / 2,
                    workArea.Top + (workArea.Bottom - workArea.Top - _windowHeight) / 2);
        }

        private NativeWindowInterop.RECT GetWorkArea()
        {
            IntPtr monitor = NativeWindowInterop.MonitorFromWindow(ActiveHandle,
                NativeWindowInterop.MONITOR_DEFAULTTONEAREST);
            var monitorInfo = new NativeWindowInterop.MONITORINFO
            {
                cbSize = Marshal.SizeOf<NativeWindowInterop.MONITORINFO>()
            };
            NativeWindowInterop.GetMonitorInfo(monitor, ref monitorInfo);
            return monitorInfo.rcWork;
        }

        #endregion

        #region Transparency Toggle

        public void EnableClickThrough()
        {
            if (ActiveHandle == IntPtr.Zero) return;
            if (!IsTransparent) return;

            uint exStyle = NativeWindowInterop.GetWindowLong(ActiveHandle, NativeWindowInterop.GWL_EXSTYLE);
            exStyle |= NativeWindowInterop.WS_EX_TRANSPARENT;
            NativeWindowInterop.SetWindowLong(ActiveHandle, NativeWindowInterop.GWL_EXSTYLE, exStyle);
        }

        public void DisableClickThrough()
        {
            if (ActiveHandle == IntPtr.Zero) return;

            uint exStyle = NativeWindowInterop.GetWindowLong(ActiveHandle, NativeWindowInterop.GWL_EXSTYLE);
            exStyle &= ~NativeWindowInterop.WS_EX_TRANSPARENT;
            NativeWindowInterop.SetWindowLong(ActiveHandle, NativeWindowInterop.GWL_EXSTYLE, exStyle);
        }

        public void SetTransparentState(bool visuallyTransparent, bool clickThrough)
        {
            IsTransparent = visuallyTransparent;
            if (clickThrough) EnableClickThrough();
            else DisableClickThrough();
        }

        #endregion

        #region Always On Top

        public void SetAlwaysOnTop()
        {
            NativeWindowInterop.SetWindowPos(ActiveHandle, NativeWindowInterop.HWND_TOPMOST,
                0, 0, 0, 0,
                NativeWindowInterop.SWP_NOMOVE | NativeWindowInterop.SWP_NOSIZE |
                NativeWindowInterop.SWP_NOACTIVATE);
        }

        #endregion

        #region Mouse Utilities

        public Vector2Int GetMouseScreenPosition()
        {
            NativeWindowInterop.GetCursorPos(out NativeWindowInterop.POINT pt);
            return new Vector2Int(pt.X, pt.Y);
        }

        public Vector2Int GetMousePositionRelative()
        {
            NativeWindowInterop.GetCursorPos(out NativeWindowInterop.POINT pt);
            NativeWindowInterop.ScreenToClient(ActiveHandle, ref pt);
            return new Vector2Int(pt.X, pt.Y);
        }

        public Vector2Int ScreenToClientPoint(Vector2Int screenPoint)
        {
            var pt = new NativeWindowInterop.POINT { X = screenPoint.x, Y = screenPoint.y };
            NativeWindowInterop.ScreenToClient(ActiveHandle, ref pt);
            return new Vector2Int(pt.X, pt.Y);
        }

        #endregion

        #region Window Size

        public void ResizeWindow(int width, int height)
        {
            _windowWidth = width;
            _windowHeight = height;
            NativeWindowInterop.SetWindowPos(ActiveHandle, IntPtr.Zero,
                0, 0, width, height,
                NativeWindowInterop.SWP_NOMOVE | NativeWindowInterop.SWP_NOACTIVATE);
        }

        #endregion
    }
}
